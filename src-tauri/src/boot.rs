use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

use crate::session::SessionState;
use crate::storage::{NoteEnvelope, VaultNode};

/// Upper bound on note contents preloaded at startup (active + recent tabs).
const MAX_PRELOAD_FILES: usize = 10;

/// One-shot startup cache: session + vault tree + open note contents prepared
/// on a background thread while the window is revealing, so the frontend's
/// first `get_session` / `scan_vault` / `read_file` calls return instantly.
/// Entries are consumed on read (`take`/`remove`), so later calls always hit
/// disk — no staleness or invalidation logic needed.
#[derive(Default)]
pub struct BootCache {
    session: Mutex<Option<SessionState>>,
    trees: Mutex<HashMap<String, Vec<VaultNode>>>,
    files: Mutex<HashMap<String, NoteEnvelope>>,
}

impl BootCache {
    pub fn take_session(&self) -> Option<SessionState> {
        self.session.lock().ok()?.take()
    }

    pub fn take_tree(&self, vault_path: &str) -> Option<Vec<VaultNode>> {
        self.trees.lock().ok()?.remove(vault_path)
    }

    pub fn take_file(&self, path: &str) -> Option<NoteEnvelope> {
        self.files.lock().ok()?.remove(path)
    }
}

/// Preload boot data. Runs on a background thread in parallel with window
/// reveal; safe to call once at startup. Reuses the exact command code
/// paths, so cached values are identical to fresh disk reads.
pub fn warm_boot_cache(app: tauri::AppHandle) {
    // Session first (same sanitize path as the get_session command; the
    // cache is still empty here so this falls through to disk).
    let session = crate::session::get_session(app.clone()).unwrap_or_default();

    if let Some(ref vault_path) = session.last_vault_path {
        // Vault tree
        if let Ok(tree) = crate::storage::scan_vault(app.clone(), vault_path.clone()) {
            if let Some(cache) = app.try_state::<BootCache>() {
                if let Ok(mut trees) = cache.trees.lock() {
                    trees.insert(vault_path.clone(), tree);
                }
            }
        }

        // Active note + open tabs contents (bounded).
        let mut paths: Vec<String> = Vec::new();
        if let Some(ref active) = session.active_file_path {
            paths.push(active.clone());
        }
        if let Some(ref tabs) = session.open_tabs {
            for t in tabs {
                if !paths.contains(t) {
                    paths.push(t.clone());
                }
                if paths.len() >= MAX_PRELOAD_FILES {
                    break;
                }
            }
        }
        if let Some(cache) = app.try_state::<BootCache>() {
            if let Ok(mut files) = cache.files.lock() {
                for p in paths {
                    if let Ok(env) = crate::storage::read_file(app.clone(), p.clone()) {
                        files.insert(p, env);
                    }
                }
            }
        }
    }

    if let Some(cache) = app.try_state::<BootCache>() {
        if let Ok(mut session_slot) = cache.session.lock() {
            *session_slot = Some(session);
        }
    }
}
