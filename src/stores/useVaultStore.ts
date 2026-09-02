import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { VaultNode } from "../types/vault";

interface VaultState {
  vaultPath: string | null;
  tree: VaultNode[];
  isLoading: boolean;
  error: string | null;
  openVaultDialog: () => Promise<void>;
  loadVault: (path: string) => Promise<void>;
  createNote: () => Promise<string | null>;
  clearVault: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  tree: [],
  isLoading: false,
  error: null,

  openVaultDialog: async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Notes Vault",
      });

      if (selected && typeof selected === "string") {
        await useVaultStore.getState().loadVault(selected);
      }
    } catch (err: any) {
      set({ error: err?.message || String(err) });
    }
  },

  loadVault: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const tree = await invoke<VaultNode[]>("scan_vault", { vaultPath: path });
      set({ vaultPath: path, tree, isLoading: false, error: null });
      // Start watching vault directory for external changes
      invoke("watch_vault", { vaultPath: path }).catch((err) => {
        console.error("Failed to start vault file watcher:", err);
      });
    } catch (err: any) {
      set({
        error: err?.message || String(err),
        isLoading: false,
      });
    }
  },

  createNote: async () => {
    let currentPath = get().vaultPath;
    if (!currentPath) {
      await get().openVaultDialog();
      currentPath = get().vaultPath;
      if (!currentPath) return null;
    }

    try {
      const newPath = await invoke<string>("create_note", {
        vaultPath: currentPath,
      });
      await get().loadVault(currentPath);
      return newPath;
    } catch (err: any) {
      set({ error: err?.message || String(err) });
      return null;
    }
  },

  clearVault: () => {
    invoke("unwatch_vault").catch(() => {});
    set({ vaultPath: null, tree: [], isLoading: false, error: null });
  },
}));
