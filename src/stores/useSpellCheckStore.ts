import { create } from "zustand";

interface SpellCheckState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
}

const STORAGE_KEY = "snipnote-spellcheck";

function loadInitial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export const useSpellCheckStore = create<SpellCheckState>((set) => ({
  enabled: loadInitial(),
  setEnabled: (v) =>
    set(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(v));
      } catch {}
      return { enabled: v };
    }),
  toggle: () =>
    set((s) => {
      const v = !s.enabled;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(v));
      } catch {}
      return { enabled: v };
    }),
}));
