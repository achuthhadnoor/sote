import { isTauri } from "@tauri-apps/api/core";
import { createLogger } from "./logger";
import { getProductItem, setProductItem } from "./productStorage";

const log = createLogger("updater");

const AUTO_CHECK_KEY = "sote-auto-update-check";
const LAST_CHECK_KEY = "sote-auto-update-last-check";
/** Minimum gap between silent startup checks (ms). Manual Check ignores this. */
const AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h

export type UpdateInstallResult =
  | { status: "up-to-date" }
  | { status: "available"; version: string }
  | { status: "declined"; version: string }
  | { status: "installed"; version: string }
  | { status: "error"; message: string };

export function isAutoUpdateCheckEnabled(): boolean {
  const raw = getProductItem(AUTO_CHECK_KEY);
  if (raw == null) return true; // default on
  return raw === "1" || raw === "true";
}

export function setAutoUpdateCheckEnabled(enabled: boolean): void {
  setProductItem(AUTO_CHECK_KEY, enabled ? "1" : "0");
}

function shouldRunStartupCheck(): boolean {
  if (!isAutoUpdateCheckEnabled()) return false;
  const last = Number(getProductItem(LAST_CHECK_KEY) || "0");
  if (!Number.isFinite(last) || last <= 0) return true;
  return Date.now() - last >= AUTO_CHECK_INTERVAL_MS;
}

function markCheckedNow(): void {
  setProductItem(LAST_CHECK_KEY, String(Date.now()));
}

/** Prompt, download, install, relaunch. Returns without throwing. */
export async function promptAndInstallUpdate(update: {
  version: string;
  downloadAndInstall: () => Promise<void>;
}): Promise<UpdateInstallResult> {
  const install = window.confirm(
    `Update ${update.version} is available.\n\nDownload and install now? The app will restart when finished.`,
  );
  if (!install) {
    return { status: "declined", version: update.version };
  }

  try {
    await update.downloadAndInstall();
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      log.warn("relaunch after update failed", e);
      return { status: "installed", version: update.version };
    }
    return { status: "installed", version: update.version };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("downloadAndInstall failed", e);
    return { status: "error", message };
  }
}

/**
 * Run an updater check. Pass `{ prompt: true }` to offer install when available
 * (Settings button). Startup uses `{ prompt: true }` only when an update exists.
 */
export async function runUpdateCheck(options?: {
  prompt?: boolean;
}): Promise<UpdateInstallResult> {
  if (!isTauri()) {
    return { status: "error", message: "Updater only runs in the desktop app" };
  }

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    markCheckedNow();

    if (!update) {
      return { status: "up-to-date" };
    }

    if (options?.prompt) {
      return promptAndInstallUpdate(update);
    }

    return { status: "available", version: update.version };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log.warn("update check failed", e);
    return { status: "error", message };
  }
}

/**
 * Silent startup check: at most every 12h when auto-check is enabled.
 * Prompts only when a newer version is found. Failures are swallowed.
 */
export async function runStartupUpdateCheck(): Promise<void> {
  if (!isTauri() || !shouldRunStartupCheck()) return;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    markCheckedNow();
    if (!update) {
      log.debug("startup check: up to date");
      return;
    }
    log.info(`startup check: update ${update.version} available`);
    await promptAndInstallUpdate(update);
  } catch (e) {
    // Expected in dev / before first published release / offline.
    log.debug("startup update check skipped", e);
  }
}
