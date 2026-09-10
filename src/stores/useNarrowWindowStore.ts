import { create } from "zustand";
import { getProductItem, setProductItem } from "../lib/productStorage";
import { isMac } from "../utils/platform";

const MENU_BAR_KEY = "sote-narrow-menu-bar-icon";
const HIDE_DOCK_KEY = "sote-narrow-hide-dock";

function loadBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = getProductItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function saveBool(key: string, value: boolean) {
  setProductItem(key, String(value));
}

/**
 * Compact mode must keep at least one recovery surface on macOS:
 * menu-bar icon and/or Dock. Hiding both strands the app (no Cmd-Tab entry).
 */
function sanitize(menuBarIcon: boolean, hideDock: boolean): { menuBarIcon: boolean; hideDock: boolean } {
  if (!isMac) return { menuBarIcon, hideDock: false };
  if (hideDock && !menuBarIcon) {
    // Prefer keeping the menu-bar icon when Dock is hidden.
    return { menuBarIcon: true, hideDock: true };
  }
  return { menuBarIcon, hideDock };
}

function loadInitial(): { menuBarIcon: boolean; hideDock: boolean } {
  const next = sanitize(loadBool(MENU_BAR_KEY, true), loadBool(HIDE_DOCK_KEY, true));
  saveBool(MENU_BAR_KEY, next.menuBarIcon);
  saveBool(HIDE_DOCK_KEY, next.hideDock);
  return next;
}

interface NarrowWindowState {
  /** Show a menu-bar (macOS) / tray (Windows) icon while compact. */
  menuBarIcon: boolean;
  /** Hide the Dock icon while compact (macOS only). */
  hideDock: boolean;
  setMenuBarIcon: (v: boolean) => void;
  setHideDock: (v: boolean) => void;
}

const initial = loadInitial();

export const useNarrowWindowStore = create<NarrowWindowState>((set) => ({
  menuBarIcon: initial.menuBarIcon,
  hideDock: initial.hideDock,
  setMenuBarIcon: (v) =>
    set((s) => {
      // Turning off the menu-bar icon while Dock is hidden would strand the app.
      const next = sanitize(v, v ? s.hideDock : false);
      saveBool(MENU_BAR_KEY, next.menuBarIcon);
      saveBool(HIDE_DOCK_KEY, next.hideDock);
      return next;
    }),
  setHideDock: (v) =>
    set((s) => {
      // Hiding the Dock requires a menu-bar icon so the user can still quit / show.
      const next = sanitize(v ? true : s.menuBarIcon, v);
      saveBool(MENU_BAR_KEY, next.menuBarIcon);
      saveBool(HIDE_DOCK_KEY, next.hideDock);
      return next;
    }),
}));

/** Snapshot used when applying / refreshing narrow chrome (always safe). */
export function narrowChromeOptions(): { showTray: boolean; hideDock: boolean } {
  const s = useNarrowWindowStore.getState();
  const safe = sanitize(s.menuBarIcon, s.hideDock);
  return {
    showTray: safe.menuBarIcon,
    hideDock: isMac && safe.hideDock,
  };
}
