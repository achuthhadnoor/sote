use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultNode {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<VaultNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NoteEnvelope {
    pub frontmatter: Option<String>,
    pub body: String,
}

/// Parses raw file content into a NoteEnvelope, separating YAML frontmatter from body.
pub fn parse_note_envelope(raw_content: &str) -> NoteEnvelope {
    if !raw_content.starts_with("---") {
        return NoteEnvelope {
            frontmatter: None,
            body: raw_content.to_string(),
        };
    }

    // Check delimiter on line 1
    let rest = &raw_content[3..];
    if !rest.starts_with('\n') && !rest.starts_with("\r\n") {
        return NoteEnvelope {
            frontmatter: None,
            body: raw_content.to_string(),
        };
    }

    let search_start = if rest.starts_with("\r\n") { 5 } else { 4 };
    let content_after_first_line = &raw_content[search_start..];

    // Look for closing delimiter `\n---` or `\r\n---`
    if let Some(pos) = content_after_first_line.find("\n---") {
        let frontmatter = content_after_first_line[..pos].trim_end_matches('\r').to_string();
        let after_closing_delimiter = &content_after_first_line[pos + 4..];

        // Consume remaining characters on delimiter line and trailing newlines
        let body = if let Some(newline_pos) = after_closing_delimiter.find('\n') {
            let b = &after_closing_delimiter[newline_pos + 1..];
            b.strip_prefix("\r\n").or_else(|| b.strip_prefix('\n')).unwrap_or(b)
        } else {
            ""
        };

        NoteEnvelope {
            frontmatter: Some(frontmatter),
            body: body.to_string(),
        }
    } else {
        NoteEnvelope {
            frontmatter: None,
            body: raw_content.to_string(),
        }
    }
}

/// Reassembles frontmatter and markdown body into raw file content.
pub fn reassemble_envelope(body: &str, frontmatter: Option<&str>) -> String {
    match frontmatter {
        Some(fm) if !fm.trim().is_empty() => {
            format!("---\n{}\n---\n\n{}", fm.trim_matches('\n'), body)
        }
        _ => body.to_string(),
    }
}

/// Recursively scans a directory, returning a sorted tree of directories and markdown files.
/// Hidden files and non-markdown files are excluded.
pub fn scan_directory(dir_path: &Path) -> Result<Vec<VaultNode>, String> {
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {:?}", dir_path));
    }

    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories (e.g. .git, .DS_Store, .snipnote)
        if file_name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = scan_directory(&path)?;
            nodes.push(VaultNode {
                path: path.to_string_lossy().to_string(),
                name: file_name,
                is_directory: true,
                children: Some(children),
            });
        } else if path.is_file() {
            // Include only .md and .markdown files
            if let Some(ext) = path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if ext_lower == "md" || ext_lower == "markdown" {
                    nodes.push(VaultNode {
                        path: path.to_string_lossy().to_string(),
                        name: file_name,
                        is_directory: false,
                        children: None,
                    });
                }
            }
        }
    }

    // Sort: directories first, then alphabetically case-insensitively
    nodes.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(nodes)
}

/// Tauri command to scan a local vault directory.
#[tauri::command]
pub fn scan_vault(vault_path: String) -> Result<Vec<VaultNode>, String> {
    let path = PathBuf::from(&vault_path);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    scan_directory(&canonical)
}

/// Tauri command to read a markdown file and return its NoteEnvelope.
#[tauri::command]
pub fn read_file(file_path: String) -> Result<NoteEnvelope, String> {
    let path = PathBuf::from(&file_path);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    if !canonical.is_file() {
        return Err(format!("Path is not a file: {:?}", canonical));
    }

    let contents = fs::read_to_string(&canonical)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(parse_note_envelope(&contents))
}

/// Internal helper for writing note file atomically.
pub fn internal_write_file(
    file_path: &Path,
    body: &str,
    frontmatter: Option<&str>,
) -> Result<(), String> {
    let temp_path = file_path.with_extension("snipnote.tmp");
    let full_content = reassemble_envelope(body, frontmatter);

    // Write to temp file and sync
    let mut file = File::create(&temp_path)
        .map_err(|e| format!("Failed to create temporary write file: {}", e))?;

    file.write_all(full_content.as_bytes())
        .map_err(|e| format!("Failed to write content to temporary file: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to sync temporary file to disk: {}", e))?;

    // Atomic rename
    fs::rename(&temp_path, file_path)
        .map_err(|e| format!("Failed to atomically replace destination file: {}", e))?;

    Ok(())
}

/// Tauri command to write a markdown file atomically using NoteEnvelope.
#[tauri::command]
pub fn write_file(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    file_path: String,
    body: String,
    frontmatter: Option<String>,
) -> Result<(), String> {
    let dest_path = PathBuf::from(&file_path);
    internal_write_file(&dest_path, &body, frontmatter.as_deref())?;
    state.echo_cache.record_write(&dest_path);
    Ok(())
}

/// Internal helper for creating an untitled note.
pub fn internal_create_note(vault_path: &Path) -> Result<PathBuf, String> {
    let canonical = vault_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    if !canonical.is_dir() {
        return Err(format!("Vault path is not a directory: {:?}", canonical));
    }

    let candidate = if !canonical.join("Untitled.md").exists() {
        canonical.join("Untitled.md")
    } else {
        let mut idx = 1;
        loop {
            let candidate_path = canonical.join(format!("Untitled {}.md", idx));
            if !candidate_path.exists() {
                break candidate_path;
            }
            idx += 1;
        }
    };

    fs::write(&candidate, "")
        .map_err(|e| format!("Failed to create new note file: {}", e))?;

    Ok(candidate)
}

/// Tauri command to create a new untitled markdown note on disk.
#[tauri::command]
pub fn create_note(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    vault_path: String,
) -> Result<String, String> {
    let path = PathBuf::from(&vault_path);
    let candidate = internal_create_note(&path)?;
    state.echo_cache.record_write(&candidate);
    Ok(candidate.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_note_increments_numbers() {
        let temp_dir = std::env::temp_dir().join(format!("snipnote_create_note_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let n1 = internal_create_note(&temp_dir).unwrap();
        assert!(n1.to_string_lossy().ends_with("Untitled.md"));
        assert!(n1.is_file());

        let n2 = internal_create_note(&temp_dir).unwrap();
        assert!(n2.to_string_lossy().ends_with("Untitled 1.md"));
        assert!(n2.is_file());

        let n3 = internal_create_note(&temp_dir).unwrap();
        assert!(n3.to_string_lossy().ends_with("Untitled 2.md"));
        assert!(n3.is_file());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_parse_note_envelope_with_frontmatter() {
        let raw = "---\ntitle: My Note\nstatus: draft\n---\n\n# Heading\nThis is the body.";
        let envelope = parse_note_envelope(raw);
        assert_eq!(
            envelope.frontmatter,
            Some("title: My Note\nstatus: draft".to_string())
        );
        assert_eq!(envelope.body, "# Heading\nThis is the body.");
    }

    #[test]
    fn test_parse_note_envelope_without_frontmatter() {
        let raw = "# Just Markdown\nLine 2";
        let envelope = parse_note_envelope(raw);
        assert_eq!(envelope.frontmatter, None);
        assert_eq!(envelope.body, raw);
    }

    #[test]
    fn test_reassemble_envelope_roundtrip() {
        let body = "# Hello World\nParagraph.";
        let fm = "title: Test\ntags: [a, b]";
        let reassembled = reassemble_envelope(body, Some(fm));
        let parsed = parse_note_envelope(&reassembled);
        assert_eq!(parsed.frontmatter, Some(fm.to_string()));
        assert_eq!(parsed.body, body);
    }

    #[test]
    fn test_atomic_write_and_read_file() {
        let temp_dir = std::env::temp_dir().join(format!("snipnote_atomic_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let file_path = temp_dir.join("test_note.md");
        let path_str = file_path.to_string_lossy().to_string();

        let body = "# Test Content\nBody here.";
        let frontmatter = Some("author: Tester\nversion: 1".to_string());

        internal_write_file(&file_path, body, frontmatter.as_deref()).unwrap();

        let envelope = read_file(path_str).unwrap();
        assert_eq!(envelope.frontmatter, frontmatter);
        assert_eq!(envelope.body, body);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scan_directory_filters_and_sorts() {
        let temp_dir = std::env::temp_dir().join(format!("snipnote_test_vault_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // Create subdirectories
        let sub_b = temp_dir.join("Beta");
        let sub_a = temp_dir.join("Alpha");
        let hidden_dir = temp_dir.join(".git");
        fs::create_dir_all(&sub_b).unwrap();
        fs::create_dir_all(&sub_a).unwrap();
        fs::create_dir_all(&hidden_dir).unwrap();

        // Create markdown and non-markdown files
        let mut f1 = File::create(temp_dir.join("zebra.md")).unwrap();
        writeln!(f1, "# Zebra").unwrap();

        let mut f2 = File::create(temp_dir.join("apple.md")).unwrap();
        writeln!(f2, "# Apple").unwrap();

        let mut f3 = File::create(temp_dir.join("ignored.txt")).unwrap();
        writeln!(f3, "plain text").unwrap();

        let mut f4 = File::create(temp_dir.join(".hidden.md")).unwrap();
        writeln!(f4, "hidden note").unwrap();

        // Create file inside Alpha
        let mut sub_f = File::create(sub_a.join("nested.md")).unwrap();
        writeln!(sub_f, "# Nested").unwrap();

        let nodes = scan_directory(&temp_dir).unwrap();

        // Top level should contain: Alpha, Beta (directories first), then apple.md, zebra.md
        assert_eq!(nodes.len(), 4);
        assert_eq!(nodes[0].name, "Alpha");
        assert!(nodes[0].is_directory);
        assert_eq!(nodes[1].name, "Beta");
        assert!(nodes[1].is_directory);
        assert_eq!(nodes[2].name, "apple.md");
        assert!(!nodes[2].is_directory);
        assert_eq!(nodes[3].name, "zebra.md");
        assert!(!nodes[3].is_directory);

        // Alpha should contain nested.md
        let alpha_children = nodes[0].children.as_ref().unwrap();
        assert_eq!(alpha_children.len(), 1);
        assert_eq!(alpha_children[0].name, "nested.md");
        assert!(!alpha_children[0].is_directory);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scan_directory_non_existent() {
        let path = Path::new("/non/existent/path/for/snipnote/test");
        let result = scan_directory(path);
        assert!(result.is_err());
    }
}
