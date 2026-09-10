import { invoke } from "@tauri-apps/api/core";
import { getProductItem, setProductItem } from "./productStorage";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const MAX_BUFFER = 500;
const MAX_MESSAGE = 2000;

const LOG_LEVEL_KEY = "sote-log-level";
const STREAM_LOGS_KEY = "sote-stream-logs";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
}

const buffer: LogEntry[] = [];
let backendAvailable: boolean | null = null;

function minLevel(): LogLevel {
  const stored = getProductItem(LOG_LEVEL_KEY) as LogLevel | null;
  if (stored && stored in LEVEL_ORDER) return stored;
  return import.meta.env.DEV ? "debug" : "info";
}

export function setLogLevel(level: LogLevel) {
  setProductItem(LOG_LEVEL_KEY, level);
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
  const v = getProductItem(STREAM_LOGS_KEY);
  if (v === "1") return true;
  if (v === "0") return false;
  return import.meta.env.DEV;
}

export function setStreamLogs(enabled: boolean) {
  setProductItem(STREAM_LOGS_KEY, enabled ? "1" : "0");
}

/**
 * Startup timing anchors. `NAV_TO_JS_MS` is captured when this module first
 * evaluates — i.e. ms from webview navigation start (fetch + parse of the
 * bundle) to first JS execution. Compare with backend timestamps in the log
 * to split the launch gap into: Rust setup → webview spawn → JS parse →
 * React work.
 */
export const NAV_TO_JS_MS: number =
  typeof performance !== "undefined" ? performance.now() : -1;

export function msSinceJsBoot(): number {
  return typeof performance !== "undefined" ? performance.now() - NAV_TO_JS_MS : -1;
}

/** Epoch ms of webview navigation start — subtract the backend "setup done"
 *  timestamp to isolate WKWebView process-spawn cost from load/parse cost. */
export function navigationEpochMs(): number {
  return typeof performance !== "undefined" ? Math.round(performance.timeOrigin) : -1;
}

export interface StartupLoadBreakdown {
  resourceCount: number;
  totalJsBytes: number;
  domContentLoadedMs: number | null;
  slowest: Array<{ name: string; ms: number }>;
}

/**
 * One-shot resource-level breakdown of the launch load: in dev every Vite
 * transform shows up as a resource, so the slowest entries point directly at
 * what's expensive (transform latency vs. parse vs. count).
 */
export function getStartupLoadBreakdown(): StartupLoadBreakdown | null {
  try {
    if (typeof performance === "undefined") return null;
    const navs = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    let totalJsBytes = 0;
    const slowest = resources
      .map((r) => {
        // WKWebView often reports 0 for encodedBodySize; fall back to transferSize.
        const bytes = r.encodedBodySize || (r as PerformanceResourceTiming).transferSize || 0;
        if (/\.js($|\?)/.test(r.name)) totalJsBytes += bytes;
        return { name: r.name.split("/").slice(-2).join("/"), ms: r.responseEnd };
      })
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
      .map(({ name, ms }) => ({ name, ms: Math.round(ms) }));
    return {
      resourceCount: resources.length,
      // WKWebView hides transfer sizes (reports 0); -1 signals "unknown".
      totalJsBytes: totalJsBytes > 0 ? totalJsBytes : -1,
      domContentLoadedMs: navs[0] ? Math.round(navs[0].domContentLoadedEventEnd) : null,
      slowest,
    };
  } catch {
    return null;
  }
}

export interface StartupSample {
  ts: number;
  dev: boolean;
  navToJsMs: number;
  jsToRestoreMs: number;
  restoreMs: number;
}

const STARTUP_HISTORY_KEY = "sote-startup-history";
const MAX_STARTUP_SAMPLES = 10;

/**
 * Persist this launch's timings and return the recent history plus the
 * running average of navigation→JS. Launch times are noisy (cold webview
 * spawn, Vite re-transforms after edits), so compare averages across
 * relaunches — never single runs.
 */
export function recordStartupSample(
  jsToRestoreMs: number,
  restoreMs: number
): { samples: StartupSample[]; avgNavToJsMs: number } {
  try {
    const raw = getProductItem(STARTUP_HISTORY_KEY);
    const samples: StartupSample[] = raw ? JSON.parse(raw) : [];
    samples.push({
      ts: Date.now(),
      dev: import.meta.env.DEV,
      navToJsMs: Math.round(NAV_TO_JS_MS),
      jsToRestoreMs: Math.round(jsToRestoreMs),
      restoreMs: Math.round(restoreMs),
    });
    while (samples.length > MAX_STARTUP_SAMPLES) samples.shift();
    setProductItem(STARTUP_HISTORY_KEY, JSON.stringify(samples));
    const navs = samples.map((s) => s.navToJsMs).filter((n) => n >= 0);
    const avg = navs.length
      ? Math.round(navs.reduce((a, b) => a + b, 0) / navs.length)
      : -1;
    return { samples, avgNavToJsMs: avg };
  } catch {
    return { samples: [], avgNavToJsMs: -1 };
  }
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

/** Resolve the Rust log file path (app_data_dir/sote.log). Null in browser mode. */
export async function getBackendLogPath(): Promise<string | null> {
  try {
    return await invoke<string>("get_log_path");
  } catch {
    return null;
  }
}
