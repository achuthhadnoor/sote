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
  clearVault: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
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
    } catch (err: any) {
      set({
        error: err?.message || String(err),
        isLoading: false,
      });
    }
  },

  clearVault: () => {
    set({ vaultPath: null, tree: [], isLoading: false, error: null });
  },
}));
