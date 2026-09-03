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
        .setup(|app| {
            // Vibrant window: macOS Sidebar + Windows Mica via EffectsBuilder only
            // (no window-vibrancy crate — `tauri` with `macos-private-api` feature)
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            {
                use tauri::{Manager, window::{Effect, EffectState, EffectsBuilder}};
                if let Some(window) = app.get_webview_window("main") {
                    let effects = EffectsBuilder::new()
                        .effects([Effect::Sidebar, Effect::Mica])
                        .state(EffectState::Active)
                        .radius(12.0)
                        .build();
                    let _ = window.set_effects(Some(effects));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
