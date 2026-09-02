pub mod session;
pub mod storage;
pub mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(watcher::VaultWatcherState::default())
        .invoke_handler(tauri::generate_handler![
            storage::scan_vault,
            storage::read_file,
            storage::write_file,
            storage::create_note,
            session::get_session,
            session::save_session,
            watcher::watch_vault,
            watcher::unwatch_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
