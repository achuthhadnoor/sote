use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub last_vault_path: Option<String>,
    pub active_file_path: Option<String>,
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
        if !Path::new(vault_path).is_dir() {
            session.last_vault_path = None;
            session.active_file_path = None;
            return session;
        }
    }

    if let Some(ref file_path) = session.active_file_path {
        if !Path::new(file_path).is_file() {
            session.active_file_path = None;
        }
    }

    session
}

#[tauri::command]
pub fn get_session(app: AppHandle) -> Result<SessionState, String> {
    let session_path = get_session_file_path(&app)?;
    if !session_path.exists() {
        return Ok(SessionState::default());
    }

    let contents = match fs::read_to_string(&session_path) {
        Ok(c) => c,
        Err(_) => return Ok(SessionState::default()),
    };

    let session: SessionState = serde_json::from_str(&contents)
        .unwrap_or_default();

    Ok(sanitize_session(session))
}

#[tauri::command]
pub fn save_session(app: AppHandle, session: SessionState) -> Result<(), String> {
    let session_path = get_session_file_path(&app)?;
    let serialized = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;

    fs::write(&session_path, serialized)
        .map_err(|e| format!("Failed to write session file: {}", e))?;

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
        };
        let json = serde_json::to_string(&session).unwrap();
        assert!(json.contains("lastVaultPath"));
        assert!(json.contains("activeFilePath"));

        let deserialized: SessionState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, session);
    }

    #[test]
    fn test_sanitize_session_cleans_missing_vault() {
        let session = SessionState {
            last_vault_path: Some("/non/existent/path/for/snipnote/vault".to_string()),
            active_file_path: Some("/non/existent/path/for/snipnote/vault/note.md".to_string()),
        };
        let sanitized = sanitize_session(session);
        assert_eq!(sanitized.last_vault_path, None);
        assert_eq!(sanitized.active_file_path, None);
    }
}
