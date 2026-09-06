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
    // Non-blocking takes: a one-shot startup cache must never stall IPC.
    // `try_lock` turns lock contention into a plain cache miss (disk read).
    pub fn take_session(&self) -> Option<SessionState> {
        self.session.try_lock().ok()?.take()
    }

    pub fn take_tree(&self, vault_path: &str) -> Option<Vec<VaultNode>> {
        self.trees.try_lock().ok()?.remove(vault_path)
    }

    pub fn take_file(&self, path: &str) -> Option<NoteEnvelope> {
        self.files.try_lock().ok()?.remove(path)
    }
}

pub fn warm_boot_cache(app: tauri::AppHandle) {
    let started = std::time::Instant::now();
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        // Session first: load and immediately store into cache so that the UI's
        // get_session call can return right away without waiting for vault scans.
        let session = crate::session::get_session(app.clone()).unwrap_or_default();

        if let Some(cache) = app.try_state::<BootCache>() {
            if let Ok(mut session_slot) = cache.session.lock() {
                *session_slot = Some(session.clone());
            }
        }

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
            // NOTE: read from disk FIRST, then insert under lock. Holding the
            // `files` lock across `read_file` self-deadlocks: `read_file`
            // calls `take_file`, which locks the same non-reentrant mutex on
            // this thread — freezing the boot thread AND every later frontend
            // `read_file` (which blocks on the same mutex), so the app hangs
            // on launch with the note stuck loading.
            let mut preloaded: Vec<(String, NoteEnvelope)> = Vec::new();
            for p in paths {
                if let Ok(env) = crate::storage::read_file(app.clone(), vault_path.clone(), p.clone()) {
                    preloaded.push((p, env));
                }
            }
            if let Some(cache) = app.try_state::<BootCache>() {
                if let Ok(mut files) = cache.files.lock() {
                    for (p, env) in preloaded {
                        files.insert(p, env);
                    }
                }
            }
            crate::logger::info(
                "boot",
                &format!("warm_boot_cache done in {:?} (vault preloaded)", started.elapsed()),
            );
        }
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_take_never_blocks_when_locked() {
        // Regression test: `warm_boot_cache` once held `files` while calling
        // `read_file` → `take_file` on the same thread, self-deadlocking the
        // boot thread and hanging every later frontend `read_file` (the app
        // froze on launch with the note stuck loading). Takes must not block:
        // contention degrades to a cache miss instead.
        let cache = BootCache::default();
        let guard = cache.files.lock().unwrap();
        assert!(cache.take_file("anything.md").is_none());
        assert!(cache.take_tree("anything").is_none());
        drop(guard);
        // Unlocking restores normal behaviour (still a miss — nothing cached).
        assert!(cache.take_file("anything.md").is_none());
    }
}
