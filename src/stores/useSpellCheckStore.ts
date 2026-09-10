import { create } from "zustand";
import { getProductItem, setProductItem } from "../lib/productStorage";

interface SpellCheckState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
}

const STORAGE_KEY = "sote-spellcheck";

function loadInitial(): boolean {
  if (typeof window === "undefined") return true;
  const raw = getProductItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === "true";
}

export const useSpellCheckStore = create<SpellCheckState>((set) => ({
  enabled: loadInitial(),
  setEnabled: (v) =>
    set(() => {
      setProductItem(STORAGE_KEY, String(v));
      return { enabled: v };
    }),
  toggle: () =>
    set((s) => {
      const v = !s.enabled;
      setProductItem(STORAGE_KEY, String(v));
      return { enabled: v };
    }),
}));
