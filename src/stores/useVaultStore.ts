import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { VaultNode } from "../types/vault";
import { createLogger, loggedInvoke } from "../lib/logger";

const log = createLogger("vault");

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

let watchedVaultPath: string | null = null;

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
      log.error("openVaultDialog failed:", err?.message || String(err));
      set({ error: err?.message || String(err) });
    }
  },

  loadVault: async (path: string) => {
    set({ isLoading: true, error: null });
    log.debug("loadVault start:", path);
    try {
      const tree = await loggedInvoke<VaultNode[]>("vault", "scan_vault", { vaultPath: path });
      const previousWatchedPath = watchedVaultPath;
      const shouldRestartWatcher = previousWatchedPath !== path;
      if (shouldRestartWatcher && previousWatchedPath) await invoke("unwatch_vault").catch(() => {});
      set({ vaultPath: path, tree, isLoading: false, error: null });
      log.info("loadVault ok:", path, `(${tree.length} top-level nodes)`);
      // Start watching vault directory for external changes
      if (shouldRestartWatcher || !previousWatchedPath) {
        try {
          await invoke("watch_vault", { vaultPath: path });
          watchedVaultPath = path;
        } catch (watchErr: any) {
          log.error("watch_vault failed:", path, watchErr?.message || String(watchErr));
          set({
            error: `Vault opened, but live file watching failed: ${watchErr?.message || String(watchErr)}`,
          });
        }
      }
    } catch (err: any) {
      log.error("loadVault failed:", path, err?.message || String(err));
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
      const newPath = await loggedInvoke<string>("vault", "create_note", {
        vaultPath: currentPath,
      });
      await get().loadVault(currentPath);
      return newPath;
    } catch (err: any) {
      log.error("createNote failed:", err?.message || String(err));
      set({ error: err?.message || String(err) });
      return null;
    }
  },

  clearVault: () => {
    invoke("unwatch_vault").catch(() => {});
    watchedVaultPath = null;
    set({ vaultPath: null, tree: [], isLoading: false, error: null });
  },
}));
