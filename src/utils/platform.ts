/** OS detection + shortcut labels for cross-platform UI chrome. */

export type Platform = "mac" | "windows" | "other";

export const PLATFORM: Platform = (() => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  return "other";
})();

export const isMac = PLATFORM === "mac";
export const isWindows = PLATFORM === "windows";

/** Modifier glyph/label: ⌘ on macOS, Ctrl elsewhere. */
export const modKeyLabel = isMac ? "⌘" : "Ctrl";

/** Shortcut chip: `⌘B` on macOS, `Ctrl+B` on Windows/Linux. */
export function modShortcut(key: string): string {
  return isMac ? `${modKeyLabel}${key}` : `${modKeyLabel}+${key}`;
}
