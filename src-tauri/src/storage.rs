use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;

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

/// Canonicalize a vault root and reject non-directory roots.
pub fn canonical_vault_root(vault_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(vault_path)
        .map_err(|e| format!("Invalid folder path: {}", e))?;
    if !root.is_dir() {
        return Err("Selected path is not a directory".to_string());
    }
    Ok(root)
}

/// Resolve a user-supplied path below a vault, including symlink-safe handling
/// for paths that do not exist yet (such as a newly-created note).
pub fn resolve_vault_path(vault_path: &str, requested: &str, allow_missing: bool) -> Result<PathBuf, String> {
    let root = canonical_vault_root(vault_path)?;
    let raw = Path::new(requested);
    let candidate = if raw.is_absolute() { raw.to_path_buf() } else { root.join(raw) };
    let resolved = if allow_missing && !candidate.exists() {
        let parent = candidate.parent().ok_or_else(|| "Invalid path".to_string())?;
        let parent = fs::canonicalize(parent).map_err(|e| format!("Invalid parent path: {}", e))?;
        parent.join(candidate.file_name().ok_or_else(|| "Invalid path".to_string())?)
    } else {
        fs::canonicalize(&candidate).map_err(|e| format!("Invalid path: {}", e))?
    };
    if !resolved.starts_with(&root) {
        return Err("Path escapes the selected folder".to_string());
    }
    Ok(resolved)
}

pub fn validate_file_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name == "." || name == ".." || name.len() > 200 {
        return Err("Invalid file name".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.chars().any(|c| c.is_control()) {
        return Err("Invalid file name".to_string());
    }
    if name.ends_with(' ') || name.ends_with('.') {
        return Err("File names may not end with a space or period".to_string());
    }
    let reserved = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "LPT1", "LPT2", "LPT3"];
    let stem = name.split('.').next().unwrap_or(name);
    if reserved.iter().any(|r| stem.eq_ignore_ascii_case(r)) {
        return Err("Reserved file name".to_string());
    }
    Ok(())
}

/// Parses raw file content into a NoteEnvelope, separating YAML frontmatter from body.
pub fn parse_note_envelope(raw_content: &str) -> NoteEnvelope {
    let normalized = raw_content.strip_prefix('\u{feff}').unwrap_or(raw_content);
    let mut lines = normalized.split_inclusive('\n');
    let first = lines.next().unwrap_or("").trim_end_matches(['\r', '\n']);
    if first != "---" {
        return NoteEnvelope {
            frontmatter: None,
            body: raw_content.to_string(),
        };
    }
    let mut frontmatter_lines = Vec::new();
    while let Some(line) = lines.next() {
        let content = line.trim_end_matches(['\r', '\n']);
        if content == "---" || content == "..." {
            let body = lines.collect::<String>();
            let body = body.strip_prefix("\r\n").or_else(|| body.strip_prefix('\n')).unwrap_or(&body);
            return NoteEnvelope { frontmatter: Some(frontmatter_lines.join("\n")), body: body.to_string() };
        }
        frontmatter_lines.push(content.to_string());
    }
    NoteEnvelope { frontmatter: None, body: raw_content.to_string() }
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

/// Ignored directory names that should never be traversed during vault scans.
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "target",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".output",
    ".turbo",
    ".cache",
    ".snipnote",
];

pub fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIRS.iter().any(|&ignored| name.eq_ignore_ascii_case(ignored))
}

/// Recursively scans a directory, returning a sorted tree of directories and markdown files.
/// - Shows dot-folders (e.g. `.obsidian`, `.templates`) if they contain markdown
/// - Hidden files (dot-files like `.DS_Store`, `.hidden.md`) are still excluded
/// - Heavy directories (node_modules, target, .git, etc.) are skipped
/// - Symlinked directories are skipped to avoid cycles
/// - Inaccessible subdirectories are skipped gracefully
/// - Hides folders which do not contain any `.md`/`.markdown` files in their subtree
pub fn scan_directory(dir_path: &Path) -> Result<Vec<VaultNode>, String> {
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {:?}", dir_path));
    }

    let entries = match fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(e) => return Err(format!("Failed to read directory {:?}: {}", dir_path, e)),
    };
    let mut nodes = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // Skip unreadable entries gracefully
        };
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Check symlinks using symlink_metadata to prevent cycles and symlink attacks
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        if file_type.is_symlink() {
            // If it points to a directory, skip to prevent recursion loops
            if path.is_dir() {
                continue;
            }
        }

        if file_type.is_dir() {
            // Skip heavy build/system directories
            if is_ignored_dir(&file_name) {
                continue;
            }

            // Include dot-folders now; hide later if they contain no markdown
            let children = match scan_directory(&path) {
                Ok(c) => c,
                Err(_) => continue, // Gracefully ignore subdirectories with permission errors
            };
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
        } else if file_type.is_file() || (file_type.is_symlink() && path.is_file()) {
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
pub fn scan_vault(app: tauri::AppHandle, vault_path: String) -> Result<Vec<VaultNode>, String> {
    // Serve preloaded boot data when available (one-shot).
    if let Some(cache) = app.try_state::<crate::boot::BootCache>() {
        if let Some(tree) = cache.take_tree(&vault_path) {
            crate::logger::debug("storage", &format!("scan_vault served from boot cache: {}", vault_path));
            return Ok(tree);
        }
    }
    let started = std::time::Instant::now();
    crate::logger::debug("storage", &format!("scan_vault start: {}", vault_path));
    let target_path = canonical_vault_root(&vault_path)?;
    match scan_directory(&target_path) {
        Ok(tree) => {
            crate::logger::info(
                "storage",
                &format!("scan_vault ok: {} top-level nodes in {:?}: {}", tree.len(), started.elapsed(), vault_path),
            );
            Ok(tree)
        }
        Err(e) => {
            crate::logger::error("storage", &format!("scan_vault failed for {}: {}", vault_path, e));
            Err(e)
        }
    }
}

/// Tauri command to read a markdown file and return its NoteEnvelope.
#[tauri::command]
pub fn read_file(app: tauri::AppHandle, vault_path: String, file_path: String) -> Result<NoteEnvelope, String> {
    let _resolved_path = resolve_vault_path(&vault_path, &file_path, false)?;
    // Serve preloaded boot data when available (one-shot).
    if let Some(cache) = app.try_state::<crate::boot::BootCache>() {
        if let Some(env) = cache.take_file(&file_path) {
            crate::logger::debug("storage", &format!("read_file served from boot cache: {}", file_path));
            return Ok(env);
        }
    }
    match read_file_from_vault(&vault_path, &file_path) {
        Ok(env) => Ok(env),
        Err(e) => {
            crate::logger::warn("storage", &format!("read_file failed for {}: {}", file_path, e));
            Err(e)
        }
    }
}

/// Unscoped disk-read helper retained only for unit tests.
#[cfg(test)]
pub fn read_file_from_disk(file_path: &str) -> Result<NoteEnvelope, String> {
    let path = PathBuf::from(file_path);
    let target_path = path.canonicalize().unwrap_or_else(|_| path.clone());

    if !target_path.is_file() {
        return Err(format!("Path is not a file: {:?}", target_path));
    }

    let contents = fs::read_to_string(&target_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(parse_note_envelope(&contents))
}

pub fn read_file_from_vault(vault_path: &str, file_path: &str) -> Result<NoteEnvelope, String> {
    let target_path = resolve_vault_path(vault_path, file_path, false)?;
    if !target_path.is_file() {
        return Err("Path is not a file".to_string());
    }
    let contents = fs::read_to_string(&target_path)
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
    vault_path: String,
    file_path: String,
    body: String,
    frontmatter: Option<String>,
) -> Result<(), String> {
    let dest_path = resolve_vault_path(&vault_path, &file_path, true)?;
    // Record before rename so the FS event cannot race ahead of suppression.
    state.echo_cache.record_write(&dest_path);
    match internal_write_file(&dest_path, &body, frontmatter.as_deref()) {
        Ok(()) => {
            crate::logger::debug(
                "storage",
                &format!("write_file ok ({} body bytes): {}", body.len(), file_path),
            );
            // Re-record after rename so canonicalize succeeds for new files.
            state.echo_cache.record_write(&dest_path);
            Ok(())
        }
        Err(e) => {
            crate::logger::error("storage", &format!("write_file failed for {}: {}", file_path, e));
            Err(e)
        }
    }
}

/// Internal helper for creating an untitled note.
pub fn internal_create_note(vault_path: &Path) -> Result<PathBuf, String> {
    let canonical = vault_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    if !canonical.is_dir() {
        return Err(format!("Selected path is not a directory: {:?}", canonical));
    }

    let mut idx = 0;
    loop {
        let name = if idx == 0 { "Untitled.md".to_string() } else { format!("Untitled {}.md", idx) };
        let candidate = canonical.join(name);
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(_) => return Ok(candidate),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => idx += 1,
            Err(e) => return Err(format!("Failed to create new note file: {}", e)),
        }
    }
}

/// Tauri command to create a new untitled markdown note on disk.
#[tauri::command]
pub fn create_note(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    vault_path: String,
) -> Result<String, String> {
    let path = canonical_vault_root(&vault_path)?;
    match internal_create_note(&path) {
        Ok(candidate) => {
            crate::logger::info("storage", &format!("create_note: {:?}", candidate));
            state.echo_cache.record_write(&candidate);
            Ok(candidate.to_string_lossy().to_string())
        }
        Err(e) => {
            crate::logger::error("storage", &format!("create_note failed in {}: {}", vault_path, e));
            Err(e)
        }
    }
}

/// Tauri command to rename a file or folder.
#[tauri::command]
pub fn rename_path(vault_path: String, old_path: String, new_name: String) -> Result<String, String> {
    let old = resolve_vault_path(&vault_path, &old_path, false)?;
    let parent = old.parent().ok_or_else(|| "Cannot rename root".to_string())?;
    validate_file_name(&new_name)?;
    let new_path = parent.join(&new_name);
    if !new_path.starts_with(canonical_vault_root(&vault_path)?) {
        return Err("Path escapes the selected folder".to_string());
    }
    if new_path.exists() {
        return Err(format!("Target already exists: {:?}", new_path));
    }
    match fs::rename(&old, &new_path) {
        Ok(()) => {
            crate::logger::info("storage", &format!("rename {:?} -> {:?}", old, new_path));
            Ok(new_path.to_string_lossy().to_string())
        }
        Err(e) => {
            crate::logger::error("storage", &format!("rename_path {:?} -> {:?} failed: {}", old, new_path, e));
            Err(e.to_string())
        }
    }
}

/// Tauri command to move a file or folder to the system Trash.
#[tauri::command]
pub fn delete_path(vault_path: String, path: String) -> Result<(), String> {
    let p = resolve_vault_path(&vault_path, &path, false)?;
    trash::delete(&p).map_err(|e| {
        crate::logger::error("storage", &format!("delete_path (trash) failed for {}: {}", path, e));
        e.to_string()
    })?;
    crate::logger::info("storage", &format!("delete_path moved to trash: {}", path));
    Ok(())
}

/// Tauri command to create an empty file at a given directory with a name.
#[tauri::command]
pub fn create_file_at_path(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    vault_path: String,
    dir_path: String,
    file_name: String,
) -> Result<String, String> {
    let dir = resolve_vault_path(&vault_path, &dir_path, false)?;
    if !dir.is_dir() { return Err("Not a directory".to_string()); }
    validate_file_name(&file_name)?;
    let mut name = file_name;
    if Path::new(&name).extension().is_none() && !name.starts_with('.') {
        name.push_str(".md");
    }
    let candidate = dir.join(&name);
    let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&candidate)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(b"").map_err(|e| e.to_string())?;
    state.echo_cache.record_write(&candidate);
    crate::logger::info("storage", &format!("create_file_at_path: {:?}", candidate));
    Ok(candidate.to_string_lossy().to_string())
}

/// Tauri command to create a folder at a given directory.
#[tauri::command]
pub fn create_folder_at_path(vault_path: String, dir_path: String, folder_name: String) -> Result<String, String> {
    let dir = resolve_vault_path(&vault_path, &dir_path, false)?;
    if !dir.is_dir() { return Err("Not a directory".to_string()); }
    validate_file_name(&folder_name)?;
    let new_folder = dir.join(&folder_name);
    if new_folder.exists() {
        return Err(format!("Already exists: {:?}", new_folder));
    }
    fs::create_dir_all(&new_folder).map_err(|e| e.to_string())?;
    crate::logger::info("storage", &format!("create_folder_at_path: {:?}", new_folder));
    Ok(new_folder.to_string_lossy().to_string())
}

/// Tauri command to copy an external file into the vault (for drag & drop from Finder).
#[tauri::command]
pub fn copy_external_file(
    state: tauri::State<'_, crate::watcher::VaultWatcherState>,
    vault_path: String,
    src_path: String,
    dest_dir: String,
) -> Result<String, String> {
    let src = PathBuf::from(&src_path);
    if !src.exists() {
        return Err(format!("Source does not exist: {:?}", src));
    }
    let dest = resolve_vault_path(&vault_path, &dest_dir, false)?;
    if !dest.is_dir() {
        return Err(format!("Destination not a directory: {:?}", dest));
    }
    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string_lossy()
        .to_string();
    validate_file_name(&file_name)?;
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
            crate::logger::warn("storage", &format!("copy_external_file refused self-copy: {:?} -> {:?}", src, dest));
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
    crate::logger::info("storage", &format!("copy_external_file {:?} -> {:?}", src, candidate));
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
    fn test_parse_note_envelope_requires_exact_delimiter_lines() {
        for raw in ["--- not frontmatter\nbody", "---\nvalue\n--- extra\nbody", "# Heading\n---\nbody", "```\n---\n```"] {
            let envelope = parse_note_envelope(raw);
            assert_eq!(envelope.frontmatter, None, "unexpected frontmatter for {raw:?}");
            assert_eq!(envelope.body, raw);
        }
        let crlf = "---\r\ntitle: Note\r\n---\r\n\r\nBody";
        let envelope = parse_note_envelope(crlf);
        assert_eq!(envelope.frontmatter, Some("title: Note".to_string()));
        assert_eq!(envelope.body, "Body");
    }

    #[test]
    fn test_resolve_vault_path_rejects_traversal_and_absolute_escape() {
        let root = std::env::temp_dir().join(format!("snipnote_containment_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("nested")).unwrap();
        fs::write(root.join("nested/note.md"), "# note").unwrap();
        let root_str = root.to_string_lossy().to_string();
        assert!(resolve_vault_path(&root_str, "nested/note.md", false).is_ok());
        assert!(resolve_vault_path(&root_str, "../outside.md", true).is_err());
        assert!(resolve_vault_path(&root_str, "/etc/passwd", false).is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn test_resolve_vault_path_rejects_symlink_escape() {
        use std::os::unix::fs::symlink;
        let root = std::env::temp_dir().join(format!("snipnote_symlink_test_{}", std::process::id()));
        let outside = std::env::temp_dir().join(format!("snipnote_symlink_outside_{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.md"), "secret").unwrap();
        symlink(&outside, root.join("linked")).unwrap();
        assert!(resolve_vault_path(&root.to_string_lossy(), "linked/secret.md", false).is_err());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn test_validate_file_name_rejects_path_segments_and_controls() {
        for name in ["", ".", "..", "a/b", "a\\\\b", "CON", "bad\nname", "trailing."] {
            assert!(validate_file_name(name).is_err(), "accepted invalid name {name:?}");
        }
        assert!(validate_file_name("Note.md").is_ok());
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

        let envelope = read_file_from_disk(&path_str).unwrap();
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
