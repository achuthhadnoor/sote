pub mod boot;
pub mod logger;
pub mod session;
pub mod storage;
pub mod watcher;

#[cfg(target_os = "macos")]
mod macos_hover;

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
    let open_vault = MenuItem::with_id(app, "open_vault", "Open Folder…", true, Some("CmdOrCtrl+O"))?;

    let recent_submenu = if recent.is_empty() {
        Submenu::with_items(
            app,
            "Open Recent",
            true,
            &[&MenuItem::with_id(app, "recent_empty", "(No Recent Folders)", false, None::<&str>)?],
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

    // macOS uses Ctrl+Cmd+F; Windows/Linux use F11.
    #[cfg(target_os = "macos")]
    let fullscreen_accel = Some("Ctrl+Cmd+F");
    #[cfg(not(target_os = "macos"))]
    let fullscreen_accel = Some("F11");

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "toggle_fullscreen", "Toggle Full Screen", true, fullscreen_accel)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let about = MenuItem::with_id(app, "about_snipnote", "About snipnote", true, None::<&str>)?;
    let help_menu = Submenu::with_items(app, "Help", true, &[&about])?;

    let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])?;

    // Preserve visibility across rebuilds (e.g. Open Recent updates). On Windows the
    // menubar starts hidden and is toggled with Alt from the frontend.
    let was_visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_menu_visible().ok())
        .unwrap_or(cfg!(not(target_os = "windows")));

    app.set_menu(menu)?;

    if let Some(w) = app.get_webview_window("main") {
        if was_visible {
            let _ = w.show_menu();
        } else {
            let _ = w.hide_menu();
        }
    }
    Ok(())
}

/// Toggle the native window menu bar (Windows/Linux). macOS keeps the system menu.
#[tauri::command]
fn toggle_app_menu(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing".to_string())?;
        let visible = window.is_menu_visible().unwrap_or(false);
        if visible {
            window.hide_menu().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            window.show_menu().map_err(|e| e.to_string())?;
            Ok(true)
        }
    }
}

#[tauri::command]
fn reveal_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        // WKWebView may not exist yet during setup; re-apply inactive hover here.
        #[cfg(target_os = "macos")]
        macos_hover::enable_inactive_hover(&w);
        crate::logger::debug("app", "window revealed (frontend ready)");
    }
    Ok(())
}

/// Sync the native window/chrome theme with the app appearance preference.
/// `"system"` clears the forced theme so the OS preference is used.
#[tauri::command]
fn set_window_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let native = match theme.as_str() {
        "light" => Some(tauri::Theme::Light),
        "dark" => Some(tauri::Theme::Dark),
        "system" => None,
        other => return Err(format!("invalid theme: {other}")),
    };
    window
        .set_theme(native)
        .map_err(|e| format!("failed to set window theme: {e}"))?;
    crate::logger::debug("app", &format!("window theme set to {theme}"));
    Ok(())
}

#[tauri::command]
fn path_is_directory(path: String) -> bool {
    std::path::Path::new(&path).is_dir()
}

const NARROW_TRAY_ID: &str = "snipnote-narrow";

fn ensure_narrow_tray(app: &AppHandle) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri::Emitter;

    if app.tray_by_id(NARROW_TRAY_ID).is_some() {
        return Ok(());
    }

    let icon = app
        .default_window_icon()
        .ok_or_else(|| "No default window icon for tray".to_string())?
        .clone();

    let show = MenuItem::with_id(app, "tray_show", "Show snipnote", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let expand = MenuItem::with_id(app, "tray_expand", "Expand window", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit snipnote")).map_err(|e| e.to_string())?;
    let menu = Menu::with_items(app, &[&show, &expand, &sep, &quit]).map_err(|e| e.to_string())?;

    let mut builder = TrayIconBuilder::with_id(NARROW_TRAY_ID)
        .icon(icon)
        .tooltip("snipnote")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray_show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "tray_expand" => {
                let _ = app.emit("narrow:expand", ());
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        });

    #[cfg(target_os = "macos")]
    {
        builder = builder.icon_as_template(true);
    }

    builder.build(app).map_err(|e| e.to_string())?;
    Ok(())
}

/// Narrow / compact mode chrome. `show_tray` and `hide_dock` are independent prefs,
/// but hiding the Dock without a tray would strand the app — force a tray then.
#[tauri::command]
fn set_narrow_chrome(
    app: AppHandle,
    enabled: bool,
    show_tray: bool,
    hide_dock: bool,
) -> Result<(), String> {
    // Never hide Dock with no tray: user loses Cmd-Tab + menu-bar recovery.
    let hide_dock = hide_dock;
    let show_tray = show_tray || hide_dock;

    if enabled {
        if show_tray {
            ensure_narrow_tray(&app)?;
        } else {
            let _ = app.remove_tray_by_id(NARROW_TRAY_ID);
        }

        #[cfg(target_os = "macos")]
        {
            app.set_dock_visibility(!hide_dock)
                .map_err(|e| format!("dock visibility failed: {e}"))?;
            if !hide_dock {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
            }
        }
    } else {
        let _ = app.remove_tray_by_id(NARROW_TRAY_ID);

        #[cfg(target_os = "macos")]
        {
            app.set_dock_visibility(true)
                .map_err(|e| format!("show dock failed: {e}"))?;
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
        }

        if let Some(w) = app.get_webview_window("main") {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }

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
        .plugin(tauri_plugin_process::init())
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
            logger::frontend_log,
            logger::get_log_path,
            add_recent_vault,
            path_is_directory,
            reveal_window,
            set_window_theme,
            toggle_app_menu,
            set_narrow_chrome,
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
            let setup_started = std::time::Instant::now();
            let log_path = logger::init(app.handle());
            logger::info("app", &format!("starting, log={}", log_path.to_string_lossy()));
            // Window chrome:
            // - macOS: Overlay title bar + empty title so traffic lights sit over
            //   our custom TabBar (no system title text drawn centered).
            // - Windows: undecorated + Mica; TabBar draws min/max/close on the right.
            // - Linux: native decorations + title (opaque / non-QA).
            // Never combine Sidebar+Mica or use Overlay on Windows.
            let mut window_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::default(),
            )
            .inner_size(1280.0, 720.0)
            .min_inner_size(400.0, 600.0)
            .transparent(true)
            // Start hidden; the frontend calls `reveal_window` once session
            // restore completes, so the window only appears with content.
            // (Promise-driven IPC resolves while hidden; only rAF/timers
            // are throttled, and those don't gate the reveal path.)
            .visible(false);

            #[cfg(target_os = "macos")]
            {
                window_builder = window_builder
                    .title("")
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    // First click over an inactive window is delivered to the
                    // webview (hover / outline) instead of only activating.
                    .accept_first_mouse(true);
            }
            #[cfg(target_os = "windows")]
            {
                window_builder = window_builder
                    .title("snipnote")
                    .decorations(false)
                    .shadow(true);
            }
            #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
            {
                window_builder = window_builder.title("snipnote");
            }

            let window = window_builder.build()?;

            #[cfg(target_os = "macos")]
            macos_hover::enable_inactive_hover(&window);

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
                                // snipnote://open/<path> — URL path is slash-separated.
                                // Restore Windows drive letters (C:/…) instead of
                                // forcing a Unix leading slash.
                                let raw = parsed.path().trim_start_matches('/');
                                let p = if raw.len() >= 2 && raw.as_bytes().get(1) == Some(&b':') {
                                    raw.to_string()
                                } else if !raw.is_empty() {
                                    format!("/{}", raw)
                                } else {
                                    String::new()
                                };
                                if !p.is_empty() && p != "/" {
                                    let _ = handle.emit("deep-link:open", p);
                                }
                            }
                        }
                    }
                });
            }

            #[cfg(target_os = "macos")]
            {
                use tauri::window::{Effect, EffectState, EffectsBuilder};
                let effects = EffectsBuilder::new()
                    .effects([Effect::Sidebar])
                    .state(EffectState::Active)
                    .radius(12.0)
                    .build();
                let _ = window.set_effects(Some(effects));
            }
            #[cfg(target_os = "windows")]
            {
                use tauri::window::{Effect, EffectState, EffectsBuilder};
                // Win11 Mica only — Sidebar is a macOS material. Ignore errors
                // on Windows 10 / unsupported where Mica is unavailable.
                let effects = EffectsBuilder::new()
                    .effects([Effect::Mica])
                    .state(EffectState::Active)
                    .build();
                let _ = window.set_effects(Some(effects));
            }

            build_and_set_menu(app.handle())?;
            // Windows: hide the menubar until Alt toggles it (keeps frameless chrome clean).
            #[cfg(target_os = "windows")]
            {
                let _ = window.hide_menu();
            }

            // Preload session + vault tree + open note contents in parallel
            // with window creation, so the frontend's first data calls resolve
            // from ready memory instead of cold disk reads.
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || boot::warm_boot_cache(handle));
            }

            // Failsafe: if the frontend never signals ready (boot JS failed),
            // force the window visible after 10s. A stuck invisible app with
            // no window and no Dock presence feedback is worse than an empty
            // window — and the log will show what's missing.
            {
                let ready_window = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    if ready_window.is_visible().unwrap_or(true) {
                        return;
                    }
                    crate::logger::warn("app", "frontend never signaled ready; forcing window visible");
                    let _ = ready_window.show();
                });
            }

            crate::logger::info(
                "boot",
                &format!("setup done in {:?}", setup_started.elapsed()),
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
