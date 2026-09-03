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
/// - Shows dot-folders (e.g. `.obsidian`, `.templates`) if they contain markdown
/// - Hidden files (dot-files like `.DS_Store`, `.hidden.md`) are still excluded
/// - Hides folders which do not contain any `.md`/`.markdown` files in their subtree
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
        let is_dir = path.is_dir();

        if is_dir {
            // Include dot-folders now; hide later if they contain no markdown
            let children = scan_directory(&path)?;
            if children.is_empty() {
                // Hide folders which do not have .md files in subtree
                continue;
            }
            nodes.push(VaultNode {
                path: path.to_string_lossy().to_string(),
                name: file_name,
                is_directory: true,
                children: Some(children),
            });
        } else if path.is_file() {
            // Still skip hidden files (dot-files)
            if file_name.starts_with('.') {
                continue;
            }
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

/// Tauri command to rename a file or folder.
#[tauri::command]
pub fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    let old = PathBuf::from(&old_path);
    if !old.exists() {
        return Err(format!("Path does not exist: {:?}", old));
    }
    let parent = old.parent().ok_or_else(|| "Cannot rename root".to_string())?;
    if new_name.contains('/') || new_name.contains('\\') || new_name.is_empty() {
        return Err("Invalid new name".to_string());
    }
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err(format!("Target already exists: {:?}", new_path));
    }
    fs::rename(&old, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

/// Tauri command to delete a file or folder (recursive for folders).
#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {:?}", p));
    }
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Tauri command to create an empty file at a given directory with a name.
#[tauri::command]
pub fn create_file_at_path(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    dir_path: String,
    file_name: String,
) -> Result<String, String> {
    let dir = PathBuf::from(&dir_path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {:?}", dir));
    }
    if file_name.contains('/') || file_name.contains('\\') || file_name.is_empty() {
        return Err("Invalid file name".to_string());
    }
    let mut name = file_name;
    if Path::new(&name).extension().is_none() {
        name.push_str(".md");
    }
    let candidate = dir.join(&name);
    if candidate.exists() {
        return Err(format!("File already exists: {:?}", candidate));
    }
    fs::write(&candidate, "").map_err(|e| e.to_string())?;
    state.echo_cache.record_write(&candidate);
    Ok(candidate.to_string_lossy().to_string())
}

/// Tauri command to create a folder at a given directory.
#[tauri::command]
pub fn create_folder_at_path(dir_path: String, folder_name: String) -> Result<String, String> {
    let dir = PathBuf::from(&dir_path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {:?}", dir));
    }
    if folder_name.contains('/') || folder_name.contains('\\') || folder_name.is_empty() {
        return Err("Invalid folder name".to_string());
    }
    let new_folder = dir.join(&folder_name);
    if new_folder.exists() {
        return Err(format!("Already exists: {:?}", new_folder));
    }
    fs::create_dir_all(&new_folder).map_err(|e| e.to_string())?;
    Ok(new_folder.to_string_lossy().to_string())
}

/// Tauri command to copy an external file into the vault (for drag & drop from Finder).
#[tauri::command]
pub fn copy_external_file(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    src_path: String,
    dest_dir: String,
) -> Result<String, String> {
    let src = PathBuf::from(&src_path);
    if !src.exists() {
        return Err(format!("Source does not exist: {:?}", src));
    }
    let dest = PathBuf::from(&dest_dir);
    if !dest.is_dir() {
        return Err(format!("Destination not a directory: {:?}", dest));
    }
    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string_lossy()
        .to_string();
    let mut candidate = dest.join(&file_name);
    // handle name collision: file.md -> file 1.md
    if candidate.exists() {
        let file_path = Path::new(&file_name);
        let ext = file_path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();
        // file_stem returns None for dotfiles like `.gitignore`; fall back to full name
        let stem_raw = file_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let stem = if stem_raw.is_empty() {
            // dotfile or empty stem - use full file_name without extension handling already done via ext
            if ext.is_empty() {
                file_name.clone()
            } else {
                file_name.trim_end_matches(&ext).to_string()
            }
        } else {
            stem_raw
        };
        let stem = if stem.is_empty() { file_name.clone() } else { stem };
        let mut idx = 1;
        loop {
            let new_name = format!("{} {}{}", stem, idx, ext);
            let p = dest.join(&new_name);
            if !p.exists() {
                candidate = p;
                break;
            }
            idx += 1;
            if idx > 10000 {
                return Err("Too many collisions, aborting".to_string());
            }
        }
    }
    // Prevent copying a directory into itself or its descendant (infinite recursion)
    if src.is_dir() {
        let src_canon = src.canonicalize().unwrap_or_else(|_| src.clone());
        let dest_canon = dest.canonicalize().unwrap_or_else(|_| dest.clone());
        let cand_canon = candidate.clone();
        if dest_canon.starts_with(&src_canon) || cand_canon.starts_with(&src_canon) {
            return Err("Cannot copy a directory into itself".to_string());
        }
        copy_dir_recursive(&src, &candidate).map_err(|e| e.to_string())?;
        // Record directory copy for echo suppression as well
        state.echo_cache.record_write(&candidate);
    } else {
        // Reject special file types: symlinks, fifos, sockets, devices
        let meta = std::fs::symlink_metadata(&src).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("Symlink copy not supported".to_string());
        }
        if !meta.is_file() {
            return Err("Source is not a regular file".to_string());
        }
        fs::copy(&src, &candidate).map_err(|e| e.to_string())?;
        state.echo_cache.record_write(&candidate);
    }
    Ok(candidate.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        // Skip symlinks to avoid escaping vault or cycles
        let meta = std::fs::symlink_metadata(&src_path)?;
        if meta.file_type().is_symlink() {
            continue;
        }
        let ty = meta.file_type();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if ty.is_file() {
            fs::copy(&src_path, &dst_path)?;
        }
        // Skip other types (fifo, socket, device, etc.)
    }
    Ok(())
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

        // Beta is empty (no md) -> hidden; .git is empty dot-folder -> hidden; .hidden.md is hidden file
        // Top level should contain: Alpha (dir with md) then apple.md, zebra.md
        assert_eq!(nodes.len(), 3);
        assert_eq!(nodes[0].name, "Alpha");
        assert!(nodes[0].is_directory);
        assert_eq!(nodes[1].name, "apple.md");
        assert!(!nodes[1].is_directory);
        assert_eq!(nodes[2].name, "zebra.md");
        assert!(!nodes[2].is_directory);

        // Alpha should contain nested.md
        let alpha_children = nodes[0].children.as_ref().unwrap();
        assert_eq!(alpha_children.len(), 1);
        assert_eq!(alpha_children[0].name, "nested.md");
        assert!(!alpha_children[0].is_directory);

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scan_directory_shows_dot_folders_with_md_and_hides_empty() {
        let temp_dir = std::env::temp_dir().join(format!("snipnote_test_vault_dot_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // Dot folder with md should be shown
        let dot_with_md = temp_dir.join(".templates");
        fs::create_dir_all(&dot_with_md).unwrap();
        let mut f_dot = File::create(dot_with_md.join("template.md")).unwrap();
        writeln!(f_dot, "# Template").unwrap();

        // Dot folder without md should be hidden
        let dot_empty = temp_dir.join(".emptyDot");
        fs::create_dir_all(&dot_empty).unwrap();

        // Regular empty folder should be hidden
        let empty = temp_dir.join("EmptyFolder");
        fs::create_dir_all(&empty).unwrap();

        // Regular folder with md nested in subfolder should be shown
        let parent = temp_dir.join("Parent");
        let child = parent.join("Child");
        fs::create_dir_all(&child).unwrap();
        let mut f_nested = File::create(child.join("deep.md")).unwrap();
        writeln!(f_nested, "# Deep").unwrap();

        // Top-level md file
        let mut f_top = File::create(temp_dir.join("top.md")).unwrap();
        writeln!(f_top, "# Top").unwrap();

        let nodes = scan_directory(&temp_dir).unwrap();

        // Expected: .templates and Parent (dirs first, sorted), then top.md
        // .emptyDot and EmptyFolder hidden; .templates shown because it has md
        assert_eq!(nodes.len(), 3);
        assert_eq!(nodes[0].name, ".templates");
        assert!(nodes[0].is_directory);
        assert_eq!(nodes[1].name, "Parent");
        assert!(nodes[1].is_directory);
        assert_eq!(nodes[2].name, "top.md");

        // .templates children
        let dot_children = nodes[0].children.as_ref().unwrap();
        assert_eq!(dot_children.len(), 1);
        assert_eq!(dot_children[0].name, "template.md");

        // Parent should contain Child (which contains deep.md) — Parent not empty
        let parent_children = nodes[1].children.as_ref().unwrap();
        assert_eq!(parent_children.len(), 1);
        assert_eq!(parent_children[0].name, "Child");
        assert!(parent_children[0].is_directory);
        assert_eq!(parent_children[0].children.as_ref().unwrap()[0].name, "deep.md");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scan_directory_non_existent() {
        let path = Path::new("/non/existent/path/for/snipnote/test");
        let result = scan_directory(path);
        assert!(result.is_err());
    }
}
