/**
 * F.6 — Full editor (v2) feature flag.
 *
 * Gates the existing full vault shell (`App` on the `main` window). Default is
 * OFF: the app boots to the floating panel + tray only. Persisted in
 * localStorage so both the float panel and the main shell agree. A malformed
 * value reads as OFF (fail safe — never boot the full shell by accident).
 */
export const FULL_EDITOR_FLAG_KEY = "snipnote-full-editor";

/** Read the flag. Any value other than the literal `"true"` is treated as off. */
export function isFullEditorEnabled(): boolean {
  try {
    return localStorage.getItem(FULL_EDITOR_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persist the flag. Callers are responsible for showing/hiding `main`. */
export function setFullEditorEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FULL_EDITOR_FLAG_KEY, enabled ? "true" : "false");
  } catch {
    /* localStorage unavailable — flag simply won't persist */
  }
}
