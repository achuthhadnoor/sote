import { invoke } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { ask } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useVaultStore } from "../stores/useVaultStore";
import { useTabStore } from "../stores/useTabStore";
import { useSidebarActionsStore } from "../stores/useSidebarActionsStore";
import { useFileTreeExpandStore } from "../stores/useFileTreeExpandStore";
import type { VaultNode } from "../types/vault";
import { createLogger } from "../lib/logger";
import { isMac } from "./platform";
import { pathBasename } from "./paths";

const log = createLogger("context-menu");

async function refreshVault() {
  const vaultPath = useVaultStore.getState().vaultPath;
  if (!vaultPath) return;
  try {
    await useVaultStore.getState().loadVault(vaultPath);
  } catch {}
}

function closeTabsUnder(path: string, isDirectory: boolean) {
  const tabs = useTabStore.getState().tabs;
  tabs.forEach((t) => {
    if (t.path === path || (isDirectory && t.path.startsWith(path + "/"))) {
      useTabStore.getState().closeTab(t.path);
    }
  });
}

function retargetTabsAfterRename(oldPath: string, newPath: string, isDirectory: boolean, newName: string) {
  const tabs = useTabStore.getState().tabs;
  if (!isDirectory) {
    const tab = tabs.find((t) => t.path === oldPath);
    if (tab) {
      useTabStore.getState().closeTab(oldPath);
      useTabStore.getState().selectNote(newPath, newName);
    }
    return;
  }
  tabs.forEach((t) => {
    if (t.path === oldPath || t.path.startsWith(oldPath + "/")) {
      const newTabPath = t.path.replace(oldPath, newPath);
      const title = pathBasename(newTabPath) || t.title;
      useTabStore.getState().closeTab(t.path);
      useTabStore.getState().selectNote(newTabPath, title);
    }
  });
}

/** Confirm rename from the sidebar name dialog. Throws on failure. */
export async function commitRename(oldPath: string, newName: string, isDirectory: boolean) {
  const vaultPath = useVaultStore.getState().vaultPath;
  if (!vaultPath) {
    useSidebarActionsStore.getState().clear();
    return;
  }
  const trimmed = newName.trim();
  if (!trimmed || trimmed === pathBasename(oldPath)) {
    useSidebarActionsStore.getState().clear();
    return;
  }
  const newPath = await invoke<string>("rename_path", {
    vaultPath,
    oldPath,
    newName: trimmed,
  });
  retargetTabsAfterRename(oldPath, newPath, isDirectory, trimmed);
  await refreshVault();
  useSidebarActionsStore.getState().clear();
}

/** Confirm create from the sidebar name dialog. Throws on failure. */
export async function commitCreate(dirPath: string, kind: "file" | "folder", name: string) {
  const vaultPath = useVaultStore.getState().vaultPath;
  if (!vaultPath) {
    useSidebarActionsStore.getState().clear();
    return;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    useSidebarActionsStore.getState().clear();
    return;
  }
  if (kind === "file") {
    const newPath = await invoke<string>("create_file_at_path", {
      vaultPath,
      dirPath,
      fileName: trimmed,
    });
    await refreshVault();
    useFileTreeExpandStore.getState().setExpanded(vaultPath, dirPath, true);
    const title = pathBasename(newPath) || trimmed;
    useTabStore.getState().selectNote(newPath, title);
  } else {
    const newPath = await invoke<string>("create_folder_at_path", {
      vaultPath,
      dirPath,
      folderName: trimmed,
    });
    await refreshVault();
    useFileTreeExpandStore.getState().setExpanded(vaultPath, dirPath, true);
    useFileTreeExpandStore.getState().setExpanded(vaultPath, newPath, true);
  }
  useSidebarActionsStore.getState().clear();
}

export async function showNativeContextMenu(
  node: VaultNode | null,
  _event?: React.MouseEvent
) {
  const vaultPath = useVaultStore.getState().vaultPath;

  if (!node) {
    if (!vaultPath) return;
    try {
      const revealFolder = await MenuItem.new({
        text: `Reveal in ${isMac ? "Finder" : "Explorer"}`,
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
        action: () => useSidebarActionsStore.getState().startCreate(vaultPath, "file"),
      });
      const newFolder = await MenuItem.new({
        text: "New Folder…",
        action: () => useSidebarActionsStore.getState().startCreate(vaultPath, "folder"),
      });
      const sep2 = await PredefinedMenuItem.new({ item: "Separator" });
      const copyFolderPath = await MenuItem.new({
        text: "Copy Path",
        action: async () => {
          try {
            await navigator.clipboard.writeText(vaultPath);
          } catch {}
        },
      });
      const menu = await Menu.new({
        items: [revealFolder, sep1, newFile, newFolder, sep2, copyFolderPath],
      });
      await menu.popup();
    } catch (err) {
      log.error("Native menu failed", err);
    }
    return;
  }

  const isDirectory = node.isDirectory;
  const parentDir = node.path.substring(0, node.path.lastIndexOf("/")) || vaultPath || "";
  const targetDir = isDirectory ? node.path : parentDir;

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

    const items: any[] = [reveal];

    items.push(await PredefinedMenuItem.new({ item: "Separator" }));

    items.push(
      await MenuItem.new({
        text: "Rename…",
        action: () =>
          useSidebarActionsStore.getState().startRename(node.path, node.name, isDirectory),
      })
    );

    items.push(
      await MenuItem.new({
        text: "Move to Trash",
        action: async () => {
          const ok = await ask(`Move “${node.name}” to the Trash?`, {
            title: "Move to Trash",
            kind: "warning",
            okLabel: "Move to Trash",
            cancelLabel: "Cancel",
          });
          if (!ok) return;
          try {
            await invoke("delete_path", { vaultPath, path: node.path });
            closeTabsUnder(node.path, isDirectory);
            await refreshVault();
          } catch (e: any) {
            alert(`Trash failed: ${e?.message || e}`);
          }
        },
      })
    );

    items.push(await PredefinedMenuItem.new({ item: "Separator" }));

    items.push(
      await MenuItem.new({
        text: "Copy Path",
        action: async () => {
          try {
            await navigator.clipboard.writeText(node.path);
          } catch {}
        },
      })
    );

    items.push(
      await MenuItem.new({
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
      })
    );

    items.push(await PredefinedMenuItem.new({ item: "Separator" }));

    items.push(
      await MenuItem.new({
        text: "New File…",
        action: () => {
          if (!targetDir) return;
          useFileTreeExpandStore.getState().setExpanded(vaultPath, targetDir, true);
          useSidebarActionsStore.getState().startCreate(targetDir, "file");
        },
      })
    );

    items.push(
      await MenuItem.new({
        text: "New Folder…",
        action: () => {
          if (!targetDir) return;
          useFileTreeExpandStore.getState().setExpanded(vaultPath, targetDir, true);
          useSidebarActionsStore.getState().startCreate(targetDir, "folder");
        },
      })
    );

    const menu = await Menu.new({ items });
    await menu.popup();
  } catch (err) {
    log.error("Native menu failed", err);
  }
}
