use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct VaultChangeEvent {
    pub path: String,
    pub kind: String,
}

/// In-memory cache tracking recently written files to suppress self-inflicted save echoes (AD-3).
#[derive(Clone, Default)]
pub struct EchoSuppressionCache {
    entries: Arc<Mutex<HashMap<PathBuf, Instant>>>,
}

impl EchoSuppressionCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_write(&self, path: &Path) {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if let Ok(mut lock) = self.entries.lock() {
            let now = Instant::now();
            // Prune entries older than 2s
            lock.retain(|_, timestamp| now.duration_since(*timestamp) < Duration::from_secs(2));
            lock.insert(canonical, now);
        }
    }

    pub fn is_suppressed(&self, path: &Path) -> bool {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if let Ok(mut lock) = self.entries.lock() {
            let now = Instant::now();
            if let Some(timestamp) = lock.get(&canonical) {
                if now.duration_since(*timestamp) < Duration::from_secs(2) {
                    return true;
                }
            }
            lock.remove(&canonical);
        }
        false
    }
}

pub struct VaultWatcherState {
    pub watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    pub watched_path: Arc<Mutex<Option<PathBuf>>>,
    pub echo_cache: EchoSuppressionCache,
}

impl Default for VaultWatcherState {
    fn default() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            watched_path: Arc::new(Mutex::new(None)),
            echo_cache: EchoSuppressionCache::default(),
        }
    }
}

/// Filter determining whether a filesystem path change should be surfaced to Snipnote.
pub fn should_emit_change(path: &Path) -> bool {
    let path_str = path.to_string_lossy();

    // Ignore version control, hidden files, and temporary atomic write files
    if path_str.contains("/.git/") || path_str.ends_with("/.git") || path_str.contains("\\.git\\") {
        return false;
    }

    if path_str.ends_with(".snipnote.tmp") {
        return false;
    }

    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
        if file_name.starts_with('.') {
            return false;
        }

        // If file exists or has an extension, filter for markdown
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            return ext_lower == "md" || ext_lower == "markdown";
        }
    }

    // Allow directories and new items
    true
}

pub fn map_event_kind(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        _ => "other",
    }
}

/// Tauri command to start watching a vault directory.
#[tauri::command]
pub fn watch_vault(
    app: AppHandle,
    state: State<'_, VaultWatcherState>,
    vault_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&vault_path);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize vault path: {}", e))?;

    if !canonical.is_dir() {
        return Err(format!("Vault path is not a directory: {:?}", canonical));
    }

    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    let mut watched_path_lock = state.watched_path.lock().map_err(|e| e.to_string())?;

    // Drop any existing watcher
    *watcher_lock = None;

    let app_clone = app.clone();
    let echo_cache = state.echo_cache.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| match res {
            Ok(event) => {
                let kind_str = map_event_kind(&event.kind);
                for p in event.paths {
                    if should_emit_change(&p) && !echo_cache.is_suppressed(&p) {
                        let payload = VaultChangeEvent {
                            path: p.to_string_lossy().to_string(),
                            kind: kind_str.to_string(),
                        };
                        let _ = app_clone.emit("vault-changed", payload);
                    }
                }
            }
            Err(e) => {
                eprintln!("[snipnote watcher error]: {}", e);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to initialize file watcher: {}", e))?;

    watcher
        .watch(&canonical, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch vault directory: {}", e))?;

    *watcher_lock = Some(watcher);
    *watched_path_lock = Some(canonical);

    Ok(())
}

/// Tauri command to stop watching the active vault.
#[tauri::command]
pub fn unwatch_vault(state: State<'_, VaultWatcherState>) -> Result<(), String> {
    let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
    let mut watched_path_lock = state.watched_path.lock().map_err(|e| e.to_string())?;

    *watcher_lock = None;
    *watched_path_lock = None;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_echo_suppression_cache_lifecycle() {
        let cache = EchoSuppressionCache::new();
        let test_path = Path::new("/tmp/test_note.md");

        // Initially not suppressed
        assert!(!cache.is_suppressed(test_path));

        // Record write
        cache.record_write(test_path);

        // Immediately suppressed within 2s TTL
        assert!(cache.is_suppressed(test_path));

        // Different path not suppressed
        assert!(!cache.is_suppressed(Path::new("/tmp/other_note.md")));
    }

    #[test]
    fn test_should_emit_change_filtering() {
        assert!(should_emit_change(Path::new("/vault/note.md")));
        assert!(should_emit_change(Path::new("/vault/nested/doc.MARKDOWN")));
        assert!(should_emit_change(Path::new("/vault/subfolder")));

        // Filtered items
        assert!(!should_emit_change(Path::new("/vault/.git/HEAD")));
        assert!(!should_emit_change(Path::new("/vault/.DS_Store")));
        assert!(!should_emit_change(Path::new("/vault/note.snipnote.tmp")));
        assert!(!should_emit_change(Path::new("/vault/image.png")));
        assert!(!should_emit_change(Path::new("/vault/script.py")));
    }

    #[test]
    fn test_map_event_kind() {
        assert_eq!(map_event_kind(&EventKind::Create(notify::event::CreateKind::File)), "create");
        assert_eq!(map_event_kind(&EventKind::Modify(notify::event::ModifyKind::Data(notify::event::DataChange::Content))), "modify");
        assert_eq!(map_event_kind(&EventKind::Remove(notify::event::RemoveKind::File)), "remove");
    }
}
