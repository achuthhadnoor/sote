use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

static LOG_FILE: OnceLock<Mutex<std::fs::File>> = OnceLock::new();
static LOG_PATH: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

/// Max log file size before rotation (~2 MB). Keeps debugging cheap on disk.
const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;

/// Current log level filter. Debug builds log everything, release skips debug.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Level {
    Debug,
    Info,
    Warn,
    Error,
}

fn env_flag(primary: &str, legacy: &str) -> Option<String> {
    std::env::var(primary)
        .ok()
        .or_else(|| std::env::var(legacy).ok())
}

fn min_level() -> Level {
    // Prefer `SOTE_LOG_LEVEL`; accept legacy `SNIPNOTE_LOG_LEVEL`.
    if let Some(v) = env_flag("SOTE_LOG_LEVEL", "SNIPNOTE_LOG_LEVEL") {
        match v.to_lowercase().as_str() {
            "debug" => return Level::Debug,
            "info" => return Level::Info,
            "warn" => return Level::Warn,
            "error" => return Level::Error,
            _ => {}
        }
    }
    if cfg!(debug_assertions) {
        Level::Debug
    } else {
        Level::Info
    }
}

/// Mirror every line to stderr — i.e. the terminal running `tauri dev`.
/// Always on for debug builds; opt-in for release via `SOTE_LOG_STDERR=1`
/// (legacy `SNIPNOTE_LOG_STDERR` still accepted).
fn mirror_to_stderr() -> bool {
    if cfg!(debug_assertions) {
        return true;
    }
    env_flag("SOTE_LOG_STDERR", "SNIPNOTE_LOG_STDERR")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn timestamp() -> String {
    // Seconds.millis since epoch (UTC) — no chrono dependency needed.
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}", now.as_secs(), now.subsec_millis())
}

fn level_str(l: Level) -> &'static str {
    match l {
        Level::Debug => "DEBUG",
        Level::Info => "INFO",
        Level::Warn => "WARN",
        Level::Error => "ERROR",
    }
}

fn write_line(level: Level, target: &str, msg: &str) {
    // The file gets everything at/above the filter; stderr gets everything
    // when mirroring (dev terminal) and always gets warn+ so failures are
    // never silent in release either.
    if level >= min_level() {
        let line = format!("[{}][{}][{}] {}\n", timestamp(), level_str(level), target, msg);
        if let Some(m) = LOG_FILE.get() {
            if let Ok(mut f) = m.lock() {
                let _ = f.write_all(line.as_bytes());
                let _ = f.flush();
            }
        }
    }
    if mirror_to_stderr() || level >= Level::Warn {
        eprintln!("[sote][{}][{}] {}", level_str(level), target, msg);
    }
}

pub fn debug(target: &str, msg: impl AsRef<str>) {
    write_line(Level::Debug, target, msg.as_ref());
}

pub fn info(target: &str, msg: impl AsRef<str>) {
    write_line(Level::Info, target, msg.as_ref());
}

pub fn warn(target: &str, msg: impl AsRef<str>) {
    write_line(Level::Warn, target, msg.as_ref());
}

pub fn error(target: &str, msg: impl AsRef<str>) {
    write_line(Level::Error, target, msg.as_ref());
}

/// Initialise the file logger. Call once from `setup()` before anything else
/// that logs. Returns the log file path for diagnostics UI.
pub fn init(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("sote"));
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("sote.log");

    // Rotate: keep one backup so a runaway session can't grow the log forever.
    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > MAX_LOG_BYTES {
            let _ = fs::rename(&path, dir.join("sote.log.1"));
        }
    }

    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(f) => {
            let _ = LOG_FILE.set(Mutex::new(f));
            let _ = LOG_PATH.set(Mutex::new(Some(path.clone())));
            write_line(
                Level::Info,
                "logger",
                &format!("log started v{} pid={}", env!("CARGO_PKG_VERSION"), std::process::id()),
            );
            path
        }
        Err(e) => {
            eprintln!("[sote][logger] failed to open log file: {}", e);
            path
        }
    }
}

pub fn log_path() -> Option<PathBuf> {
    LOG_PATH.get()?.lock().ok()?.clone()
}

/// Frontend `console.*` funnel: `invoke("frontend_log", {level, target, message})`.
/// Fire-and-forget from JS — never fails the caller.
#[tauri::command]
pub fn frontend_log(level: String, target: String, message: String) {
    // Cap message length so a huge object dump can't flood the log.
    let msg: String = message.chars().take(2000).collect();
    match level.to_lowercase().as_str() {
        "debug" => debug(&format!("frontend:{}", target), &msg),
        "warn" => warn(&format!("frontend:{}", target), &msg),
        "error" => error(&format!("frontend:{}", target), &msg),
        _ => info(&format!("frontend:{}", target), &msg),
    }
}

#[tauri::command]
pub fn get_log_path(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(p) = log_path() {
        return Ok(p.to_string_lossy().to_string());
    }
    // Fallback if init hasn't run (e.g. tests).
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    Ok(dir.join("sote.log").to_string_lossy().to_string())
}
