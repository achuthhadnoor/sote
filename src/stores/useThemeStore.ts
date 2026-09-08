import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type Theme = "light" | "dark" | "system";

const DEFAULT_TINT_HUE = 220;
const DEFAULT_TINT_AMOUNT = 12;

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveTheme: "light" | "dark";
  bgOpacity: number;
  setBgOpacity: (opacity: number) => void;
  /** True while the native window is fullscreen — surfaces render opaque. */
  isFullscreen: boolean;
  setFullscreen: (fullscreen: boolean) => void;
  tintHue: number;
  setTintHue: (hue: number) => void;
  tintAmount: number;
  setTintAmount: (amount: number) => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function computeEffective(theme: Theme): "light" | "dark" {
  if (theme === "system") return getSystemTheme();
  return theme;
}

/** Apply the theme to the DOM instantly — transitions are suspended for one
 * frame so nothing visibly cross-fades (see html.theming in App.css). */
function applyThemeToDom(effective: "light" | "dark") {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.add("theming");
  el.setAttribute("data-theme", effective);
  el.style.colorScheme = effective;
  // Force style recalc while transitions are off, then re-enable next frame.
  void el.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.remove("theming");
    });
  });
}

/** Keep the native window chrome (titlebar / traffic lights / menus) in sync. */
function syncNativeWindowTheme(theme: Theme) {
  invoke("set_window_theme", { theme }).catch(() => {});
}

function applyBgOpacityToDom(opacity: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--bg-opacity", `${opacity / 100}`);
}

/** Prefer user opacity; force fully opaque while fullscreen (vibrancy looks wrong). */
function applyEffectiveBgOpacity(bgOpacity: number, isFullscreen: boolean) {
  applyBgOpacityToDom(isFullscreen ? 100 : bgOpacity);
}

function applyTintToDom(hue: number, amount: number) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.setProperty("--theme-tint-hue", String(hue));
  el.style.setProperty("--theme-tint-amount", String(amount));
}

function loadInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem("snipnote-theme") as Theme | null;
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {}
  return "system";
}

function loadInitialBgOpacity(): number {
  try {
    const saved = localStorage.getItem("snipnote-bg-opacity");
    if (saved !== null) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 100) {
        return parsed;
      }
    }
  } catch {}
  return 85;
}

function loadInitialTintHue(): number {
  try {
    const saved = localStorage.getItem("snipnote-theme-tint-hue");
    if (saved !== null) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 360) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_TINT_HUE;
}

function loadInitialTintAmount(): number {
  try {
    const saved = localStorage.getItem("snipnote-theme-tint-amount");
    if (saved !== null) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 40) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_TINT_AMOUNT;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: loadInitialTheme(),
  effectiveTheme: computeEffective(loadInitialTheme()),
  bgOpacity: loadInitialBgOpacity(),
  isFullscreen: false,
  tintHue: loadInitialTintHue(),
  tintAmount: loadInitialTintAmount(),
  setTheme: (t) =>
    set(() => {
      try {
        localStorage.setItem("snipnote-theme", t);
      } catch {}
      const effective = computeEffective(t);
      applyThemeToDom(effective);
      syncNativeWindowTheme(t);
      return { theme: t, effectiveTheme: effective };
    }),
  setBgOpacity: (opacity) => {
    try {
      localStorage.setItem("snipnote-bg-opacity", String(opacity));
    } catch {}
    applyEffectiveBgOpacity(opacity, get().isFullscreen);
    set({ bgOpacity: opacity });
  },
  setFullscreen: (fullscreen) => {
    const { isFullscreen, bgOpacity } = get();
    if (isFullscreen === fullscreen) return;
    applyEffectiveBgOpacity(bgOpacity, fullscreen);
    set({ isFullscreen: fullscreen });
  },
  setTintHue: (hue) => {
    const clamped = Math.min(360, Math.max(0, Math.round(hue)));
    try {
      localStorage.setItem("snipnote-theme-tint-hue", String(clamped));
    } catch {}
    const { tintAmount } = useThemeStore.getState();
    applyTintToDom(clamped, tintAmount);
    set({ tintHue: clamped });
  },
  setTintAmount: (amount) => {
    const clamped = Math.min(40, Math.max(0, Math.round(amount)));
    try {
      localStorage.setItem("snipnote-theme-tint-amount", String(clamped));
    } catch {}
    const { tintHue } = useThemeStore.getState();
    applyTintToDom(tintHue, clamped);
    set({ tintAmount: clamped });
  },
}));

// Initialize DOM on load
if (typeof window !== "undefined") {
  const initial = loadInitialTheme();
  const eff = computeEffective(initial);
  document.documentElement.setAttribute("data-theme", eff);
  document.documentElement.style.colorScheme = eff;
  syncNativeWindowTheme(initial);

  const initialOpacity = loadInitialBgOpacity();
  applyBgOpacityToDom(initialOpacity);

  const initialHue = loadInitialTintHue();
  const initialAmount = loadInitialTintAmount();
  applyTintToDom(initialHue, initialAmount);

  // Keep effectiveTheme in sync when system changes and mode is system
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      const next = getSystemTheme();
      applyThemeToDom(next);
      useThemeStore.setState({ effectiveTheme: next });
      // Native window is already on system theme (None); no forced override needed.
    }
  });

  // Fullscreen: drop translucency; leave fullscreen restores the saved preference.
  void (async () => {
    try {
      const win = getCurrentWindow();
      const syncFullscreen = async () => {
        const fullscreen = await win.isFullscreen();
        useThemeStore.getState().setFullscreen(fullscreen);
      };
      await syncFullscreen();
      await win.onResized(() => {
        void syncFullscreen();
      });
    } catch {
      // Non-Tauri / preview: leave opacity as configured.
    }
  })();
}
