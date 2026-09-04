import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveTheme: "light" | "dark";
  bgOpacity: number;
  setBgOpacity: (opacity: number) => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function computeEffective(theme: Theme): "light" | "dark" {
  if (theme === "system") return getSystemTheme();
  return theme;
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

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadInitialTheme(),
  effectiveTheme: computeEffective(loadInitialTheme()),
  bgOpacity: loadInitialBgOpacity(),
  setTheme: (t) =>
    set(() => {
      try {
        localStorage.setItem("snipnote-theme", t);
      } catch {}
      const effective = computeEffective(t);
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", effective);
        document.documentElement.style.colorScheme = effective;
      }
      return { theme: t, effectiveTheme: effective };
    }),
  setBgOpacity: (opacity) => {
    try {
      localStorage.setItem("snipnote-bg-opacity", String(opacity));
    } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--bg-opacity", `${opacity / 100}`);
    }
    set({ bgOpacity: opacity });
  },
}));

// Initialize DOM on load
if (typeof window !== "undefined") {
  const initial = loadInitialTheme();
  const eff = computeEffective(initial);
  document.documentElement.setAttribute("data-theme", eff);
  document.documentElement.style.colorScheme = eff;

  const initialOpacity = loadInitialBgOpacity();
  document.documentElement.style.setProperty("--bg-opacity", `${initialOpacity / 100}`);

  // Keep effectiveTheme in sync when system changes and mode is system
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      const next = getSystemTheme();
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.colorScheme = next;
      useThemeStore.setState({ effectiveTheme: next });
    }
  });
}
