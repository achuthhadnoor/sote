import { invoke } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useVaultStore } from "../stores/useVaultStore";
import { useTabStore } from "../stores/useTabStore";
import type { VaultNode } from "../types/vault";
import { createLogger } from "../lib/logger";

const log = createLogger("context-menu");

export async function showNativeContextMenu(
  node: VaultNode | null,
  _event?: React.MouseEvent
) {
  const vaultPath = useVaultStore.getState().vaultPath;
  const loadVault = useVaultStore.getState().loadVault;
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

  const refresh = async () => {
    if (vaultPath) {
      try {
        await loadVault(vaultPath);
      } catch {}
    }
  };

  if (!node) {
    if (!vaultPath) return;
    try {
      const revealVault = await MenuItem.new({
        text: `Reveal Vault in ${isMac ? "Finder" : "Explorer"}`,
        action: async () => {
          try {
            await revealItemInDir(vaultPath);
          } catch (e) {
            log.error("Reveal failed", e);
          }
        },
      });
      const sep1 = await PredefinedMenuItem.new({ item: "Separator" });
      const newFile = await MenuItem.new({
        text: "New File…",
        action: async () => {
          const name = window.prompt("New file name (e.g. Note.md):", "Untitled.md");
          if (!name || !name.trim()) return;
          try {
            const newPath = await invoke<string>("create_file_at_path", {
              dirPath: vaultPath,
              fileName: name.trim(),
            });
            await refresh();
            const title = newPath.split("/").pop() || name;
            useTabStore.getState().selectNote(newPath, title);
          } catch (e: any) {
            alert(`Create file failed: ${e?.message || e}`);
          }
        },
      });
      const newFolder = await MenuItem.new({
        text: "New Folder…",
        action: async () => {
          const name = window.prompt("New folder name:", "New Folder");
          if (!name || !name.trim()) return;
          try {
            await invoke<string>("create_folder_at_path", {
              dirPath: vaultPath,
              folderName: name.trim(),
            });
            await refresh();
          } catch (e: any) {
            alert(`Create folder failed: ${e?.message || e}`);
          }
        },
      });
      const sep2 = await PredefinedMenuItem.new({ item: "Separator" });
      const copyVaultPath = await MenuItem.new({
        text: "Copy Vault Path",
        action: async () => {
          try {
            await navigator.clipboard.writeText(vaultPath);
          } catch {}
        },
      });
      const menu = await Menu.new({
        items: [revealVault, sep1, newFile, newFolder, sep2, copyVaultPath],
      });
      await menu.popup();
    } catch (err) {
      log.error("Native menu failed", err);
    }
    return;
  }

  const isDirectory = node.isDirectory;
  const parentDir = node.path.substring(0, node.path.lastIndexOf("/")) || vaultPath || "";

  try {
    const reveal = await MenuItem.new({
      text: `Reveal in ${isMac ? "Finder" : "Explorer"}`,
      action: async () => {
        try {
          await revealItemInDir(node.path);
        } catch (err) {
          log.error("Reveal failed", err);
        }
      },
    });

    const open = await MenuItem.new({
      text: "Open with Default App",
      action: async () => {
        try {
          await openPath(node.path);
        } catch {}
      },
    });

    let quickLook: any = null;
    if (!isDirectory) {
      quickLook = await MenuItem.new({
        text: "Quick Look",
        // accelerator hint for macOS; ignore if unsupported
        // @ts-ignore
        accelerator: "Space",
        action: async () => {
          try {
            await openPath(node.path);
          } catch {}
        },
      });
    }

    const sep1 = await PredefinedMenuItem.new({ item: "Separator" });

    const renameItem = await MenuItem.new({
      text: "Rename…",
      action: async () => {
        const current = node.name;
        const next = window.prompt(`Rename "${current}" to:`, current);
        if (!next || next === current || !next.trim()) return;
        try {
          const newPath = await invoke<string>("rename_path", {
            oldPath: node.path,
            newName: next.trim(),
          });
          const tabs = useTabStore.getState().tabs;
          const tab = tabs.find((t) => t.path === node.path);
          if (tab) {
            useTabStore.getState().closeTab(node.path);
            useTabStore.getState().selectNote(newPath, next.trim());
          }
          if (isDirectory) {
            const allTabs = useTabStore.getState().tabs;
            allTabs.forEach((t) => {
              if (t.path.startsWith(node.path + "/")) {
                const newTabPath = t.path.replace(node.path, newPath);
                const title = newTabPath.split("/").pop() || t.title;
                useTabStore.getState().closeTab(t.path);
                useTabStore.getState().selectNote(newTabPath, title);
              }
            });
          }
          await refresh();
        } catch (e: any) {
          alert(`Rename failed: ${e?.message || e}`);
        }
      },
    });

    const del = await MenuItem.new({
      text: "Move to Trash",
      action: async () => {
        const ok = window.confirm(`Move "${node.name}" to Trash?`);
        if (!ok) return;
        try {
          await invoke("delete_path", { path: node.path });
          const tabs = useTabStore.getState().tabs;
          tabs.forEach((t) => {
            if (t.path === node.path || t.path.startsWith(node.path + "/")) {
              useTabStore.getState().closeTab(t.path);
            }
          });
          await refresh();
        } catch (e: any) {
          alert(`Delete failed: ${e?.message || e}`);
        }
      },
    });

    const sep2 = await PredefinedMenuItem.new({ item: "Separator" });

    const copyPath = await MenuItem.new({
      text: "Copy Path",
      action: async () => {
        try {
          await navigator.clipboard.writeText(node.path);
        } catch {}
      },
    });

    const copyRel = await MenuItem.new({
      text: "Copy Relative Path",
      action: async () => {
        const vp = useVaultStore.getState().vaultPath;
        const rel =
          vp && node.path.startsWith(vp)
            ? node.path.slice(vp.length).replace(/^\/+/, "")
            : node.path;
        try {
          await navigator.clipboard.writeText(rel);
        } catch {}
      },
    });

    const sep3 = await PredefinedMenuItem.new({ item: "Separator" });

    const targetDir = isDirectory ? node.path : parentDir || vaultPath || "";

    const newFile = await MenuItem.new({
      text: "New File…",
      action: async () => {
        const name = window.prompt("New file name (e.g. Note.md):", "Untitled.md");
        if (!name || !name.trim()) return;
        try {
          const dirPath = targetDir;
          const newPath = await invoke<string>("create_file_at_path", {
            dirPath,
            fileName: name.trim(),
          });
          await refresh();
          const title = newPath.split("/").pop() || name;
          useTabStore.getState().selectNote(newPath, title);
        } catch (e: any) {
          alert(`Create file failed: ${e?.message || e}`);
        }
      },
    });

    const newFolder = await MenuItem.new({
      text: "New Folder…",
      action: async () => {
        const name = window.prompt("New folder name:", "New Folder");
        if (!name || !name.trim()) return;
        try {
          const dirPath = targetDir;
          await invoke<string>("create_folder_at_path", {
            dirPath,
            folderName: name.trim(),
          });
          await refresh();
        } catch (e: any) {
          alert(`Create folder failed: ${e?.message || e}`);
        }
      },
    });

    const items: any[] = isDirectory
      ? [reveal, open, sep1, renameItem, del, sep2, copyPath, copyRel, sep3, newFile, newFolder]
      : [reveal, open, quickLook, sep1, renameItem, del, sep2, copyPath, copyRel, sep3, newFile, newFolder];

    const filtered = items.filter(Boolean);

    const menu = await Menu.new({ items: filtered });
    await menu.popup();
  } catch (err) {
    log.error("Native menu failed", err);
  }
}
