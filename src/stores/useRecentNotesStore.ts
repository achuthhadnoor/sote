import { create } from "zustand";
import { getProductItem, setProductItem } from "../lib/productStorage";

export interface RecentNote {
  path: string;
  title: string;
  vaultPath: string;
  lastOpened: number;
}

const STORAGE_KEY = "sote-recent-notes";
const MAX_RECENTS = 30;

function loadInitial(): RecentNote[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = getProductItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentNote[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.path === "string" && typeof r.vaultPath === "string")
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function persist(recents: RecentNote[]) {
  setProductItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

interface RecentNotesState {
  recents: RecentNote[];
  pushRecent: (path: string, title: string, vaultPath: string) => void;
  pruneMissing: (existingPaths: Set<string>) => void;
  clearForVault: (vaultPath: string) => void;
}

export const useRecentNotesStore = create<RecentNotesState>((set, get) => ({
  recents: loadInitial(),

  pushRecent: (path, title, vaultPath) => {
    if (!path || !vaultPath) return;
    const { recents } = get();
    const now = Date.now();
    const next: RecentNote[] = [
      { path, title, vaultPath, lastOpened: now },
      ...recents.filter((r) => r.path !== path),
    ].slice(0, MAX_RECENTS);
    set({ recents: next });
    persist(next);
  },

  pruneMissing: (existingPaths) => {
    const { recents } = get();
    const next = recents.filter((r) => existingPaths.has(r.path));
    if (next.length !== recents.length) {
      set({ recents: next });
      persist(next);
    }
  },

  clearForVault: (vaultPath) => {
    const { recents } = get();
    const next = recents.filter((r) => r.vaultPath !== vaultPath);
    set({ recents: next });
    persist(next);
  },
}));
