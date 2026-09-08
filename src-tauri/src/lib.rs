pub mod boot;
pub mod logger;
pub mod session;
pub mod storage;
pub mod watcher;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewWindow};

/// Tracks whether the floating panel's frontend signaled it booted, so the
/// failsafe can distinguish "intentionally hidden (tray-only)" from
/// "JS never ran". Never used to force the full `main` window visible.
#[derive(Clone, Default)]
struct FloatReady(Arc<AtomicBool>);

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
    app.set_menu(menu)?;
    Ok(())
}

#[tauri::command]
fn reveal_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
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

#[tauri::command]
fn add_recent_vault(app: AppHandle, vault_path: String) -> Result<(), String> {
    save_recent_vaults(&app, vault_path.clone())?;
    let _ = build_and_set_menu(&app);
    Ok(())
}

/// Build the full-shell `main` window (v2). Extracted so it can be created
/// lazily — the default v1 experience never shows it, so we only pay for it
/// when the user opens the full editor (flag on, tray, or deep-link/file open).
fn build_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    // Window chrome:
    // - macOS: Overlay title bar + empty title so traffic lights sit over
    //   our custom TabBar (no system title text drawn centered).
    // - Windows/Linux: keep native decorations + a real title. Transparent
    //   stays on for Win11 Mica; set_effects fails soft on older Windows.
    let mut window_builder = tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::default(),
    )
    .inner_size(1280.0, 720.0)
    .min_inner_size(1100.0, 600.0)
    .transparent(true)
    // Start hidden; the frontend calls `reveal_window` once session restore
    // completes, so the window only appears with content.
    .visible(false);

    #[cfg(target_os = "macos")]
    {
        window_builder = window_builder
            .title("")
            .title_bar_style(tauri::TitleBarStyle::Overlay);
    }
    #[cfg(not(target_os = "macos"))]
    {
        window_builder = window_builder.title("snipnote");
    }

    let window = window_builder.build()?;

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
        // Win11 Mica only — Sidebar is a macOS material. Ignore errors on
        // Windows 10 / unsupported where Mica is unavailable.
        let effects = EffectsBuilder::new()
            .effects([Effect::Mica])
            .state(EffectState::Active)
            .build();
        let _ = window.set_effects(Some(effects));
    }

    Ok(window)
}

/// Return the existing `main` window or build it on demand.
fn ensure_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    if let Some(w) = app.get_webview_window("main") {
        return Ok(w);
    }
    build_main_window(app)
}

/// Build the compact floating panel (v1 default UX). Minimal chrome — the
/// frontend draws its own header. Always-on-top is off; close hides to tray.
fn build_float_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = tauri::WebviewWindowBuilder::new(
        app,
        "float",
        tauri::WebviewUrl::default(),
    )
    .title("snipnote")
    .inner_size(420.0, 520.0)
    .min_inner_size(320.0, 360.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(false)
    .skip_taskbar(true)
    // Hidden on boot: default UX is tray-only. Shown on hotkey / tray / flag.
    .visible(false)
    .build()?;

    #[cfg(target_os = "macos")]
    {
        use tauri::window::{Effect, EffectState, EffectsBuilder};
        // Popover material reads as a floating panel (vs. Sidebar for the
        // full shell); rounded to match our translucent surface radius.
        let effects = EffectsBuilder::new()
            .effects([Effect::Popover])
            .state(EffectState::Active)
            .radius(12.0)
            .build();
        let _ = window.set_effects(Some(effects));
    }
    #[cfg(target_os = "windows")]
    {
        use tauri::window::{Effect, EffectState, EffectsBuilder};
        let effects = EffectsBuilder::new()
            .effects([Effect::Acrylic])
            .state(EffectState::Active)
            .build();
        let _ = window.set_effects(Some(effects));
    }

    Ok(window)
}

/// Show + focus the floating panel, asking the frontend to focus the editor.
fn show_float(app: &AppHandle) {
    use tauri::Emitter;
    if let Some(w) = app.get_webview_window("float") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        let _ = app.emit("float:focus-editor", ());
    }
}

/// Toggle the floating panel: hide if it is up and focused, otherwise reveal.
fn toggle_float(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("float") {
        let visible = w.is_visible().unwrap_or(false);
        let focused = w.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = w.hide();
        } else {
            show_float(app);
        }
    }
}

#[tauri::command]
fn toggle_float_window(app: AppHandle) -> Result<(), String> {
    toggle_float(&app);
    Ok(())
}

#[tauri::command]
fn hide_float(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("float") {
        let _ = w.hide();
    }
    Ok(())
}

/// Reveal the full-shell `main` window (creating it if needed). Called when
/// the full-editor flag is enabled, from the tray, or from Settings.
#[tauri::command]
fn open_full_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Already built (hidden in the tray) — reveal immediately.
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    } else {
        // Fresh build starts hidden; the App frontend reveals itself via
        // `reveal_window` once session restore completes, so the window never
        // flashes empty translucent content.
        build_main_window(&app).map_err(|e| e.to_string())?;
    }
    crate::logger::debug("app", "full editor (main) opened");
    Ok(())
}

/// Hide the full-shell `main` window back to the tray (flag turned off).
#[tauri::command]
fn close_full_editor(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
        crate::logger::debug("app", "full editor (main) hidden");
    }
    Ok(())
}

/// The floating panel's frontend calls this once it has booted, so the
/// failsafe knows JS is alive and does not force any window visible.
#[tauri::command]
fn float_ready(state: tauri::State<FloatReady>) -> Result<(), String> {
    state.0.store(true, Ordering::SeqCst);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::Emitter;
            // Opening a file/vault is a "full editor" intent — the App shell
            // (main) owns the open-note/open-vault listeners, so ensure it
            // exists and is focused before emitting.
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
                    if let Ok(window) = ensure_main_window(app) {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                    let path_str = p.to_string_lossy().to_string();
                    let _ = app.emit("single-instance:open", path_str);
                } else if p.is_dir() {
                    if let Ok(window) = ensure_main_window(app) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    let _ = app.emit("single-instance:open-vault", p.to_string_lossy().to_string());
                }
            } else {
                // Bare re-launch with no path: bring the default panel forward.
                show_float(app);
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Only one shortcut is registered (toggle float); react on
                    // key-down so the panel toggles once per press.
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_float(app);
                    }
                })
                .build(),
        )
        .manage(watcher::VaultWatcherState::default())
        .manage(boot::BootCache::default())
        .manage(FloatReady::default())
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
            toggle_float_window,
            hide_float,
            open_full_editor,
            close_full_editor,
            float_ready,
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
        .on_window_event(|window, event| {
            // Closing either window hides it to the tray so the process keeps
            // running; the tray "Quit" item is the only real exit.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "float" || label == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let setup_started = std::time::Instant::now();
            let log_path = logger::init(app.handle());
            logger::info("app", &format!("starting, log={}", log_path.to_string_lossy()));

            // Most Tauri builders/helpers want `&AppHandle` (not `&mut App`).
            let handle = app.handle().clone();

            // v1 default UX: build the compact floating panel (hidden). The
            // full-shell `main` window is created lazily (open_full_editor /
            // tray / deep-link) so a cold, flag-off launch is tray-only.
            let float_window = build_float_window(&handle)?;

            // Deep links (snipnote://…) target notes/vaults, which the full
            // App shell owns — ensure `main` before emitting.
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                use tauri::Emitter;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    for url in urls {
                        let url_str = url.to_string();
                        if let Ok(parsed) = url::Url::parse(&url_str) {
                            let emit = |event_name: &str, payload: String| {
                                if let Ok(window) = ensure_main_window(&handle) {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                                let _ = handle.emit(event_name, payload);
                            };
                            if let Some(path) = parsed
                                .query_pairs()
                                .find(|(k, _)| k == "path")
                                .map(|(_, v)| v.to_string())
                            {
                                emit("deep-link:open", path);
                            } else if let Some(vault) = parsed
                                .query_pairs()
                                .find(|(k, _)| k == "vault")
                                .map(|(_, v)| v.to_string())
                            {
                                emit("deep-link:open-vault", vault);
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
                                    emit("deep-link:open", p);
                                }
                            }
                        }
                    }
                });
            }

            // Application menu (top menu bar) — used by the full editor; on the
            // float panel it provides standard File/Edit/New shortcuts.
            build_and_set_menu(app.handle())?;

            // System tray / menu bar: Show/Hide, New note, Settings, Quit,
            // plus "Open full editor" for the flagged v2 shell.
            {
                use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

                let show_hide = MenuItem::with_id(&handle, "tray_show_hide", "Show / Hide", true, None::<&str>)?;
                let new_note = MenuItem::with_id(&handle, "tray_new_note", "New Note", true, None::<&str>)?;
                let settings = MenuItem::with_id(&handle, "tray_settings", "Settings…", true, None::<&str>)?;
                let open_full = MenuItem::with_id(&handle, "tray_open_full_editor", "Open Full Editor", true, None::<&str>)?;
                let quit = MenuItem::with_id(&handle, "tray_quit", "Quit snipnote", true, None::<&str>)?;
                let tray_menu = Menu::with_items(
                    &handle,
                    &[
                        &show_hide,
                        &new_note,
                        &settings,
                        &PredefinedMenuItem::separator(&handle)?,
                        &open_full,
                        &PredefinedMenuItem::separator(&handle)?,
                        &quit,
                    ],
                )?;

                let mut tray_builder = TrayIconBuilder::with_id("snipnote-tray")
                    .tooltip("snipnote")
                    .menu(&tray_menu)
                    // Left-click toggles the panel; right-click shows the menu.
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        use tauri::Emitter;
                        match event.id.as_ref() {
                            "tray_show_hide" => toggle_float(app),
                            "tray_new_note" => {
                                show_float(app);
                                let _ = app.emit("float:new-note", ());
                            }
                            "tray_settings" => {
                                show_float(app);
                                let _ = app.emit("float:open-settings", ());
                            }
                            "tray_open_full_editor" => {
                                let _ = open_full_editor(app.clone());
                            }
                            "tray_quit" => app.exit(0),
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            toggle_float(tray.app_handle());
                        }
                    });

                if let Some(icon) = app.default_window_icon() {
                    tray_builder = tray_builder.icon(icon.clone());
                }
                if let Err(e) = tray_builder.build(&handle) {
                    crate::logger::error("app", &format!("tray build failed: {e}"));
                }
            }

            // Global shortcut: CmdOrCtrl+Shift+Space toggles the float panel.
            // Failure is non-fatal — the tray still works.
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
                #[cfg(target_os = "macos")]
                let mods = Modifiers::SUPER | Modifiers::SHIFT;
                #[cfg(not(target_os = "macos"))]
                let mods = Modifiers::CONTROL | Modifiers::SHIFT;
                let shortcut = Shortcut::new(Some(mods), Code::Space);
                if let Err(e) = handle.global_shortcut().register(shortcut) {
                    crate::logger::warn("app", &format!("global shortcut register failed: {e}"));
                }
            }

            // Preload session + vault tree + open note contents in parallel so
            // the frontend's first data calls resolve from ready memory.
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || boot::warm_boot_cache(handle));
            }

            // Failsafe: if the float frontend never signals ready (boot JS
            // failed), reveal the panel after 10s so the app isn't a silent,
            // invisible process. Never forces the full `main` shell visible.
            {
                let ready = handle.state::<FloatReady>().0.clone();
                let float_win = float_window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    if ready.load(Ordering::SeqCst) {
                        return;
                    }
                    if float_win.is_visible().unwrap_or(false) {
                        return;
                    }
                    crate::logger::warn("app", "float frontend never signaled ready; revealing panel");
                    let _ = float_win.show();
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
