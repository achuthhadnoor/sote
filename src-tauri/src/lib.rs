pub mod boot;
pub mod session;
pub mod storage;
pub mod watcher;

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn get_recent_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app_data_dir: {}", e))?;
    }
    Ok(dir.join("recent.json"))
}

fn load_recent_vaults(app: &AppHandle) -> Vec<String> {
    if let Ok(path) = get_recent_file_path(app) {
        if let Ok(contents) = fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str::<Vec<String>>(&contents) {
                return list.into_iter().filter(|p| Path::new(p).is_dir()).take(5).collect();
            }
        }
    }
    Vec::new()
}

fn save_recent_vaults(app: &AppHandle, vault_path: String) -> Result<(), String> {
    let mut list = load_recent_vaults(app);
    list.retain(|p| p != &vault_path);
    list.insert(0, vault_path);
    list.truncate(5);
    let path = get_recent_file_path(app)?;
    let serialized = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    fs::write(&path, serialized).map_err(|e| e.to_string())?;
    Ok(())
}

fn build_and_set_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem};

    let recent = load_recent_vaults(app);

    let new_note = MenuItem::with_id(app, "new_note", "New Note", true, Some("CmdOrCtrl+N"))?;
    let open_vault = MenuItem::with_id(app, "open_vault", "Open Vault…", true, Some("CmdOrCtrl+O"))?;

    let recent_submenu = if recent.is_empty() {
        Submenu::with_items(
            app,
            "Open Recent",
            true,
            &[&MenuItem::with_id(app, "recent_empty", "(No Recent Vaults)", false, None::<&str>)?],
        )?
    } else {
        let sm = Submenu::new(app, "Open Recent", true)?;
        for (i, p) in recent.iter().take(5).enumerate() {
            let label = Path::new(p).file_name().and_then(|n| n.to_str()).unwrap_or(p);
            let id = format!("recent_{}", i);
            let item = MenuItem::with_id(app, id, label, true, None::<&str>)?;
            sm.append(&item)?;
        }
        sm
    };

    let close_tab = MenuItem::with_id(app, "close_tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_note,
            &open_vault,
            &recent_submenu,
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
    Ok(())
}

#[tauri::command]
fn add_recent_vault(app: AppHandle, vault_path: String) -> Result<(), String> {
    save_recent_vaults(&app, vault_path.clone())?;
    let _ = build_and_set_menu(&app);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::{Emitter, Manager};
            if let Some(path) = argv.get(1) {
                let p = PathBuf::from(path);
                if p.is_file()
                    && p
                        .extension()
                        .map(|e| {
                            let l = e.to_string_lossy().to_lowercase();
                            l == "md" || l == "markdown"
                        })
                        .unwrap_or(false)
                {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                    let path_str = p.to_string_lossy().to_string();
                    let _ = app.emit("single-instance:open", path_str);
                } else if p.is_dir() {
                    let _ = app.emit("single-instance:open-vault", p.to_string_lossy().to_string());
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_focus();
                    }
                }
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(watcher::VaultWatcherState::default())
        .manage(boot::BootCache::default())
        .invoke_handler(tauri::generate_handler![
            storage::scan_vault,
            storage::read_file,
            storage::write_file,
            storage::create_note,
            storage::rename_path,
            storage::delete_path,
            storage::create_file_at_path,
            storage::create_folder_at_path,
            storage::copy_external_file,
            session::get_session,
            session::save_session,
            watcher::watch_vault,
            watcher::unwatch_vault,
            add_recent_vault,
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
                s if s.starts_with("recent_") => {
                    if let Ok(idx) = s["recent_".len()..].parse::<usize>() {
                        let recent = load_recent_vaults(app);
                        if let Some(path) = recent.get(idx) {
                            let _ = app.emit("menu:open_recent", path.clone());
                        }
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            let window = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                // Empty window title: with Overlay style macOS would draw the
                // title text centered over our custom TabBar. App/menu identity
                // still comes from productName in tauri.conf.json.
                .title("")
                .inner_size(1280.0, 720.0)
                .min_inner_size(1100.0, 600.0)
                .transparent(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                // Start hidden: the frontend reveals the window after first
                // paint so users never see an empty webview flash.
                .visible(false)
                .build()?;

            {
                use tauri_plugin_deep_link::DeepLinkExt;
                use tauri::Emitter;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    for url in urls {
                        let url_str = url.to_string();
                        if let Ok(parsed) = url::Url::parse(&url_str) {
                            if let Some(path) = parsed
                                .query_pairs()
                                .find(|(k, _)| k == "path")
                                .map(|(_, v)| v.to_string())
                            {
                                let _ = handle.emit("deep-link:open", path);
                            } else if let Some(vault) = parsed
                                .query_pairs()
                                .find(|(k, _)| k == "vault")
                                .map(|(_, v)| v.to_string())
                            {
                                let _ = handle.emit("deep-link:open-vault", vault);
                            } else if parsed.host_str() == Some("open") {
                                let p = format!("/{}", parsed.path().trim_start_matches('/'));
                                if !p.is_empty() && p != "/" {
                                    let _ = handle.emit("deep-link:open", p);
                                }
                            }
                        }
                    }
                });
            }

            #[cfg(any(target_os = "macos", target_os = "windows"))]
            {
                use tauri::window::{Effect, EffectState, EffectsBuilder};
                let effects = EffectsBuilder::new()
                    .effects([Effect::Sidebar, Effect::Mica])
                    .state(EffectState::Active)
                    .radius(12.0)
                    .build();
                let _ = window.set_effects(Some(effects));
            }

            build_and_set_menu(app.handle())?;

            // Preload session + vault tree + open note contents in parallel
            // with window reveal, so the frontend's first data calls resolve
            // from ready memory instead of cold disk reads.
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || boot::warm_boot_cache(handle));
            }

            // The window starts hidden (see `visible(false)` above) so users
            // never see an empty webview. Reveal it from here after a short
            // delay: by then the frontend bundle is parsed and the initial
            // React commit is done, so the window paints with content on
            // first show. (A native timer is used because rAF/timers are
            // suspended while the webview is hidden, so the frontend cannot
            // reliably reveal itself. The frontend also calls show() on
            // mount — whichever runs first wins.)
            if let Some(w) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = w.show();
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
