import { create } from "zustand";
import { getProductItem, setProductItem } from "../lib/productStorage";

const STORAGE_KEY = "sote-file-tree-expanded";

type ExpandedByVault = Record<string, Record<string, boolean>>;

function load(): ExpandedByVault {
  try {
    const raw = getProductItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ExpandedByVault;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persist(byVault: ExpandedByVault) {
  setProductItem(STORAGE_KEY, JSON.stringify(byVault));
}

interface FileTreeExpandState {
  byVault: ExpandedByVault;
  isExpanded: (vaultPath: string | null, folderPath: string, defaultOpen: boolean) => boolean;
  setExpanded: (vaultPath: string | null, folderPath: string, open: boolean) => void;
}

export const useFileTreeExpandStore = create<FileTreeExpandState>((set, get) => ({
  byVault: typeof window !== "undefined" ? load() : {},

  isExpanded: (vaultPath, folderPath, defaultOpen) => {
    if (!vaultPath) return defaultOpen;
    const entry = get().byVault[vaultPath]?.[folderPath];
    return entry === undefined ? defaultOpen : entry;
  },

  setExpanded: (vaultPath, folderPath, open) => {
    if (!vaultPath) return;
    set((state) => {
      const vaultMap = { ...(state.byVault[vaultPath] ?? {}), [folderPath]: open };
      const byVault = { ...state.byVault, [vaultPath]: vaultMap };
      persist(byVault);
      return { byVault };
    });
  },
}));
