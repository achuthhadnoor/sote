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
        .on_menu_event(|app, event| {
            use tauri::{Emitter, Manager};
            let id = event.id.as_ref();
            match id {
                "new_note" => {
                    let _ = app.emit("menu:new_note", ());
                }
                "open_vault" => {
                    let _ = app.emit("menu:open_vault", ());
                }
                "close_tab" => {
                    let _ = app.emit("menu:close_tab", ());
                }
                "toggle_sidebar" => {
                    let _ = app.emit("menu:toggle_sidebar", ());
                }
                "theme_light" => {
                    let _ = app.emit("menu:theme_light", ());
                }
                "theme_dark" => {
                    let _ = app.emit("menu:theme_dark", ());
                }
                "theme_system" => {
                    let _ = app.emit("menu:theme_system", ());
                }
                "toggle_fullscreen" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let is_full = window.is_fullscreen().unwrap_or(false);
                        let _ = window.set_fullscreen(!is_full);
                    }
                }
                "about_snipnote" => {
                    let _ = app.emit("menu:about", ());
                }
                _ => {}
            }
        })
        .setup(|app| {
            // Vibrant window: macOS Sidebar + Windows Mica via EffectsBuilder only
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

            // Native App Menu (File/Edit/View/Window/Help) with Traffic Lights Overlay already in tauri.conf
            {
                use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem};
                let new_note = MenuItem::with_id(app, "new_note", "New Note", true, Some("CmdOrCtrl+N"))?;
                let open_vault = MenuItem::with_id(app, "open_vault", "Open Vault…", true, Some("CmdOrCtrl+O"))?;
                let close_tab = MenuItem::with_id(app, "close_tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;
                let file_menu = Submenu::with_items(
                    app,
                    "File",
                    true,
                    &[
                        &new_note,
                        &open_vault,
                        &PredefinedMenuItem::separator(app)?,
                        &close_tab,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, None)?,
                    ],
                )?;

                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(app, None)?,
                        &PredefinedMenuItem::redo(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &PredefinedMenuItem::select_all(app, None)?,
                    ],
                )?;

                let toggle_sidebar = MenuItem::with_id(app, "toggle_sidebar", "Toggle Sidebar", true, Some("CmdOrCtrl+B"))?;
                let theme_light = MenuItem::with_id(app, "theme_light", "Light", true, None::<&str>)?;
                let theme_dark = MenuItem::with_id(app, "theme_dark", "Dark", true, None::<&str>)?;
                let theme_system = MenuItem::with_id(app, "theme_system", "System", true, None::<&str>)?;
                let appearance_submenu = Submenu::with_items(
                    app,
                    "Appearance",
                    true,
                    &[&theme_light, &theme_dark, &theme_system],
                )?;
                let view_menu = Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[&toggle_sidebar, &PredefinedMenuItem::separator(app)?, &appearance_submenu],
                )?;

                let window_menu = Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(app, None)?,
                        &PredefinedMenuItem::maximize(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "toggle_fullscreen", "Toggle Full Screen", true, Some("Ctrl+Cmd+F"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::close_window(app, None)?,
                    ],
                )?;

                let about = MenuItem::with_id(app, "about_snipnote", "About snipnote", true, None::<&str>)?;
                let help_menu = Submenu::with_items(app, "Help", true, &[&about])?;

                let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])?;
                app.set_menu(menu)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
