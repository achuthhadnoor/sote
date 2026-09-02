use serde::{Deserialize, Serialize};
use std::fs;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

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
