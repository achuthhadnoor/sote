/** Virtual tab paths that are not vault files. */
export const SETTINGS_TAB_PATH = "snipnote://settings";
export const SETTINGS_TAB_TITLE = "Settings";

export function isSettingsTab(path: string | null | undefined): boolean {
  return path === SETTINGS_TAB_PATH;
}

export function isVirtualTab(path: string | null | undefined): boolean {
  return typeof path === "string" && path.startsWith("snipnote://");
}
