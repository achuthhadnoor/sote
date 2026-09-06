use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub last_vault_path: Option<String>,
    pub active_file_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub open_tabs: Option<Vec<String>>,
}

fn get_session_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app_data_dir: {}", e))?;
    }

    Ok(app_dir.join("session.json"))
}

pub fn sanitize_session(mut session: SessionState) -> SessionState {
    if let Some(ref vault_path) = session.last_vault_path {
        let p = match crate::storage::canonical_vault_root(vault_path) {
            Ok(p) if fs::read_dir(&p).is_ok() => p,
            _ => {
                session.last_vault_path = None;
                session.active_file_path = None;
                session.open_tabs = None;
                return session;
            }
        };
        if p != Path::new(vault_path) {
            session.last_vault_path = Some(p.to_string_lossy().to_string());
        }
        let vault = session.last_vault_path.clone().unwrap_or_default();
        if let Some(file_path) = session.active_file_path.as_ref() {
            if crate::storage::resolve_vault_path(&vault, file_path, false).is_err() {
                session.active_file_path = None;
            }
        }
        if let Some(tabs) = session.open_tabs.take() {
            let filtered: Vec<String> = tabs.into_iter().filter(|p| {
                crate::storage::resolve_vault_path(&vault, p, false)
                    .map(|resolved| resolved.is_file())
                    .unwrap_or(false)
            }).collect();
            if !filtered.is_empty() {
                if session.active_file_path.as_ref().map(|active| !filtered.contains(active)).unwrap_or(true) {
                    session.active_file_path = filtered.first().cloned();
                }
                session.open_tabs = Some(filtered);
            } else {
                session.open_tabs = None;
                session.active_file_path = None;
            }
        }
        return session;
    } else {
        session.active_file_path = None;
        session.open_tabs = None;
        return session;
    }
}

#[tauri::command]
pub fn get_session(app: AppHandle) -> Result<SessionState, String> {
    // Serve preloaded boot data when available (one-shot).
    if let Some(cache) = app.try_state::<crate::boot::BootCache>() {
        if let Some(cached) = cache.take_session() {
            crate::logger::debug("session", "get_session served from boot cache");
            return Ok(cached);
        }
    }
    let session_path = get_session_file_path(&app)?;
    if !session_path.exists() {
        crate::logger::debug("session", "no session.json, returning default");
        return Ok(SessionState::default());
    }

    let contents = match fs::read_to_string(&session_path) {
        Ok(c) => c,
        Err(e) => {
            crate::logger::warn("session", &format!("failed to read session.json: {}", e));
            return Ok(SessionState::default());
        }
    };

    match serde_json::from_str::<SessionState>(&contents) {
        Ok(session) => Ok(sanitize_session(session)),
        Err(e) => {
            crate::logger::warn("session", &format!("corrupt session.json, returning default: {}", e));
            Ok(SessionState::default())
        }
    }
}

#[tauri::command]
pub fn save_session(app: AppHandle, session: SessionState) -> Result<(), String> {
    let session = sanitize_session(session);
    let session_path = get_session_file_path(&app)?;
    let serialized = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;

    let temp_path = session_path.with_extension("tmp");
    if let Err(e) = fs::write(&temp_path, serialized) {
        crate::logger::error("session", &format!("failed to write session tmp: {}", e));
        return Err(format!("Failed to write temporary session file: {}", e));
    }

    if let Err(e) = fs::rename(&temp_path, &session_path) {
        crate::logger::error("session", &format!("failed to replace session.json: {}", e));
        return Err(format!("Failed to atomically replace session file: {}", e));
    }

    crate::logger::debug(
        "session",
        &format!(
            "saved vault={:?} active={:?} tabs={}",
            session.last_vault_path,
            session.active_file_path,
            session.open_tabs.as_ref().map(|t| t.len()).unwrap_or(0)
        ),
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_state_serialization() {
        let session = SessionState {
            last_vault_path: Some("/Users/test/vault".to_string()),
            active_file_path: Some("/Users/test/vault/note.md".to_string()),
            open_tabs: Some(vec!["/Users/test/vault/note.md".to_string(), "/Users/test/vault/other.md".to_string()]),
        };
        let json = serde_json::to_string(&session).unwrap();
        assert!(json.contains("lastVaultPath"));
        assert!(json.contains("activeFilePath"));
        assert!(json.contains("openTabs"));

        let deserialized: SessionState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, session);
    }

    #[test]
    fn test_sanitize_session_cleans_missing_vault() {
        let session = SessionState {
            last_vault_path: Some("/non/existent/path/for/snipnote/vault".to_string()),
            active_file_path: Some("/non/existent/path/for/snipnote/vault/note.md".to_string()),
            open_tabs: Some(vec!["/non/existent/path/for/snipnote/vault/note.md".to_string()]),
        };
        let sanitized = sanitize_session(session);
        assert_eq!(sanitized.last_vault_path, None);
        assert_eq!(sanitized.active_file_path, None);
        assert_eq!(sanitized.open_tabs, None);
    }

    #[test]
    fn test_sanitize_session_with_inaccessible_vault() {
        let json = r#"{
            "lastVaultPath": "/non/existent/path/for/snipnote/inaccessible-vault",
            "activeFilePath": "/non/existent/path/for/snipnote/Readme.md",
            "openTabs": [
                "/non/existent/path/for/snipnote/Readme.md"
            ]
        }"#;
        let session: SessionState = serde_json::from_str(json).unwrap();
        let sanitized = sanitize_session(session);
        assert_eq!(sanitized.last_vault_path, None);
    }
}
