import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveTheme: "light" | "dark";
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

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadInitialTheme(),
  effectiveTheme: computeEffective(loadInitialTheme()),
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
}));

// Initialize DOM on load
if (typeof window !== "undefined") {
  const initial = loadInitialTheme();
  const eff = computeEffective(initial);
  document.documentElement.setAttribute("data-theme", eff);
  document.documentElement.style.colorScheme = eff;

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
