import { invoke } from "@tauri-apps/api/core";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const MAX_BUFFER = 500;
const MAX_MESSAGE = 2000;

export interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
}

const buffer: LogEntry[] = [];
let backendAvailable: boolean | null = null;

function minLevel(): LogLevel {
  try {
    const stored = localStorage.getItem("snipnote-log-level") as LogLevel | null;
    if (stored && stored in LEVEL_ORDER) return stored;
  } catch {}
  return import.meta.env.DEV ? "debug" : "info";
}

export function setLogLevel(level: LogLevel) {
  try {
    localStorage.setItem("snipnote-log-level", level);
  } catch {}
}

export function getLogLevel(): LogLevel {
  return minLevel();
}

/**
 * Whether frontend logs are streamed to the Rust backend (log file +
 * terminal via stderr). On by default in dev, opt-in in production.
 * Toggleable from Settings → Diagnostics.
 */
export function isStreamLogs(): boolean {
  try {
    const v = localStorage.getItem("snipnote-stream-logs");
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {}
  return import.meta.env.DEV;
}

export function setStreamLogs(enabled: boolean) {
  try {
    localStorage.setItem("snipnote-stream-logs", enabled ? "1" : "0");
  } catch {}
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? `\n${a.stack.split("\n").slice(1, 4).join("\n")}` : ""}`;
      if (typeof a === "string") return a;
      try {
        const s = JSON.stringify(a);
        return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s;
      } catch {
        return String(a);
      }
    })
    .join(" ")
    .slice(0, MAX_MESSAGE);
}

function forwardToBackend(level: LogLevel, scope: string, message: string) {
  // Stream everything to the Rust log (file + terminal) when enabled —
  // on by default in dev. Otherwise only warn+ to avoid IPC spam.
  if (LEVEL_ORDER[level] < LEVEL_ORDER.warn && !isStreamLogs()) return;
  if (backendAvailable === false) return;
  try {
    invoke("frontend_log", { level, target: scope, message }).then(
      () => {
        if (backendAvailable === null) backendAvailable = true;
      },
      () => {
        backendAvailable = false; // browser dev mode — stop retrying
      }
    );
  } catch {
    backendAvailable = false;
  }
}

function emit(level: LogLevel, scope: string, args: unknown[]) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  const message = formatArgs(args);
  const entry: LogEntry = { ts: new Date().toISOString(), level, scope, message };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);

  const line = `[${entry.ts}][${level.toUpperCase()}][${scope}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);

  forwardToBackend(level, scope, message);
}

export interface ScopedLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Create a scoped logger: `const log = createLogger("vault")` → `[vault]` prefix everywhere. */
export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (...args) => emit("debug", scope, args),
    info: (...args) => emit("info", scope, args),
    warn: (...args) => emit("warn", scope, args),
    error: (...args) => emit("error", scope, args),
  };
}

/** Default root logger for one-off use. Prefer createLogger(scope) in modules. */
export const log = createLogger("app");

/** Last N entries for diagnostics / copy-to-clipboard. Newest last. */
export function getRecentLogs(count = 200): LogEntry[] {
  return buffer.slice(-count);
}

export function formatLogsAsText(entries: LogEntry[] = buffer): string {
  return entries.map((e) => `[${e.ts}][${e.level.toUpperCase()}][${e.scope}] ${e.message}`).join("\n");
}

/**
 * Compact one-line summary of invoke args for terminal streaming.
 * Long strings (note bodies) are truncated with their length kept, so the
 * terminal stays readable while paths and timings remain visible.
 */
function summarizeValue(value: unknown, depth = 0): string {
  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 160)}…(${value.length} chars)` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") {
    if (depth > 1) return "{…}";
    try {
      const s = `{${Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}=${summarizeValue(v, depth + 1)}`)
        .join(", ")}}`;
      return s.length > 500 ? `${s.slice(0, 500)}…` : s;
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

/**
 * Wrap a Tauri invoke with timing + error logging.
 * Usage: `await loggedInvoke<VaultNode[]>("vault", "scan_vault", { vaultPath })`
 */
export async function loggedInvoke<T>(scope: string, command: string, args?: Record<string, unknown>): Promise<T> {
  const start = performance.now();
  emit("debug", scope, [`invoke ${command} start ${summarizeValue(args ?? {})}`]);
  try {
    const result = await invoke<T>(command, args);
    emit("debug", scope, [`invoke ${command} ok in ${Math.round(performance.now() - start)}ms`]);
    return result;
  } catch (err) {
    emit("error", scope, [`invoke ${command} failed after ${Math.round(performance.now() - start)}ms:`, err]);
    throw err;
  }
}

/** Resolve the Rust log file path (app_data_dir/snipnote.log). Null in browser mode. */
export async function getBackendLogPath(): Promise<string | null> {
  try {
    return await invoke<string>("get_log_path");
  } catch {
    return null;
  }
}
