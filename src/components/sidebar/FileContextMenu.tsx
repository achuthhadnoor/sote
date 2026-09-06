import React, { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { VaultNode } from "../../types/vault";
import { createLogger } from "../../lib/logger";

const log = createLogger("context-menu");

interface Props {
  node: VaultNode | null; // null means empty area (vault root)
  x: number;
  y: number;
  onClose: () => void;
}

export const FileContextMenu: React.FC<Props> = ({ node, x, y, onClose }) => {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const loadVault = useVaultStore((s) => s.loadVault);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const dirPath = node ? (node.isDirectory ? node.path : node.path.substring(0, node.path.lastIndexOf("/")) || vaultPath || "") : vaultPath || "";

  const handleReveal = async () => {
    try {
      const target = node ? node.path : vaultPath!;
      await revealItemInDir(target);
    } catch (e) {
      log.error("Reveal failed", e);
    }
    onClose();
  };

  const handleOpenWithDefault = async () => {
    try {
      const target = node ? node.path : vaultPath!;
      await openPath(target);
    } catch (e) {
      log.error("Open failed", e);
    }
    onClose();
  };

  const handleCopyPath = async () => {
    const target = node ? node.path : vaultPath || "";
    try {
      await navigator.clipboard.writeText(target);
    } catch {}
    onClose();
  };

  const handleCopyRelative = async () => {
    if (!vaultPath || !node) { onClose(); return; }
    const rel = node.path.startsWith(vaultPath) ? node.path.slice(vaultPath.length).replace(/^\/+/, "") : node.path;
    try {
      await navigator.clipboard.writeText(rel);
    } catch {}
    onClose();
  };

  const handleRename = async () => {
    if (!node) { onClose(); return; }
    const current = node.name;
    const next = window.prompt(`Rename "${current}" to:`, current);
    if (!next || next === current || !next.trim()) { onClose(); return; }
    try {
      const newPath = await invoke<string>("rename_path", { vaultPath, oldPath: node.path, newName: next.trim() });
      // Update tab if open
      const tabs = useTabStore.getState().tabs;
      const tab = tabs.find((t) => t.path === node.path);
      if (tab) {
        // close old tab and open new
        useTabStore.getState().closeTab(node.path);
        useTabStore.getState().selectNote(newPath, next.trim());
        // also update editor if active was renamed file and had dirty? For now close
        if (useTabStore.getState().activePath === node.path) {
          // already handled
        }
      }
      // If folder renamed, need to update tabs whose paths start with old prefix
      if (node.isDirectory) {
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
      if (vaultPath) await loadVault(vaultPath);
    } catch (e: any) {
      alert(`Rename failed: ${e?.message || e}`);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!node) { onClose(); return; }
    const ok = window.confirm(`Delete "${node.name}"? This cannot be undone.`);
    if (!ok) { onClose(); return; }
    try {
      await invoke("delete_path", { vaultPath, path: node.path });
      // close tabs for deleted path
      const tabs = useTabStore.getState().tabs;
      tabs.forEach((t) => {
        if (t.path === node.path || t.path.startsWith(node.path + "/")) {
          useTabStore.getState().closeTab(t.path);
        }
      });
      if (vaultPath) await loadVault(vaultPath);
    } catch (e: any) {
      alert(`Delete failed: ${e?.message || e}`);
    }
    onClose();
  };

  const handleNewFile = async () => {
    if (!vaultPath) { onClose(); return; }
    const name = window.prompt("New file name (e.g. Note.md):", "Untitled.md");
    if (!name || !name.trim()) { onClose(); return; }
    try {
      const targetDir = dirPath || vaultPath;
      const newPath = await invoke<string>("create_file_at_path", { vaultPath, dirPath: targetDir, fileName: name.trim() });
      if (vaultPath) await loadVault(vaultPath);
      const title = newPath.split("/").pop() || name;
      useTabStore.getState().selectNote(newPath, title);
    } catch (e: any) {
      alert(`Create file failed: ${e?.message || e}`);
    }
    onClose();
  };

  const handleNewFolder = async () => {
    if (!vaultPath) { onClose(); return; }
    const name = window.prompt("New folder name:", "New Folder");
    if (!name || !name.trim()) { onClose(); return; }
    try {
      const targetDir = dirPath || vaultPath;
      await invoke<string>("create_folder_at_path", { vaultPath, dirPath: targetDir, folderName: name.trim() });
      if (vaultPath) await loadVault(vaultPath);
    } catch (e: any) {
      alert(`Create folder failed: ${e?.message || e}`);
    }
    onClose();
  };

  const handleQuickLook = async () => {
    // Quick Look on macOS: for now open with default app (Preview for images, etc.)
    // Tauri opener will open with default app; for markdown it opens in default editor, but we keep simple
    await handleOpenWithDefault();
  };

  // Clamp position to viewport
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 300),
  };

  return (
    <div
      ref={ref}
      className="fixed w-[220px] bg-background border border-border rounded-lg shadow-xl p-1.5 flex flex-col gap-0.5 z-[9999] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      style={style}
      role="menu"
    >
      {node ? (
        <>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors group"
            onClick={handleReveal}
            role="menuitem"
          >
            <span className="w-3.5 inline-flex justify-center opacity-60 text-[11px] group-hover:opacity-100">◧</span> Reveal in {navigator.platform.includes("Mac") ? "Finder" : "Explorer"}
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors group"
            onClick={handleOpenWithDefault}
            role="menuitem"
          >
            <span className="w-3.5 inline-flex justify-center opacity-60 text-[11px] group-hover:opacity-100">↗</span> Open with Default App
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors group"
            onClick={handleQuickLook}
            role="menuitem"
          >
            <span className="w-3.5 inline-flex justify-center opacity-60 text-[11px] group-hover:opacity-100">◎</span> Quick Look <span className="ml-auto text-[10px] text-muted-foreground font-mono group-hover:text-accent-foreground">Space</span>
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleRename}
            role="menuitem"
          >
            Rename…
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-destructive text-xs font-normal cursor-pointer font-sans hover:bg-destructive/10 transition-colors"
            onClick={handleDelete}
            role="menuitem"
          >
            Delete
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleCopyPath}
            role="menuitem"
          >
            Copy Path
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleCopyRelative}
            role="menuitem"
          >
            Copy Relative Path
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleNewFile}
            role="menuitem"
          >
            New File…
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleNewFolder}
            role="menuitem"
          >
            New Folder…
          </button>
        </>
      ) : (
        <>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors group"
            onClick={handleReveal}
            role="menuitem"
          >
            <span className="w-3.5 inline-flex justify-center opacity-60 text-[11px] group-hover:opacity-100">◧</span> Reveal Vault in {navigator.platform.includes("Mac") ? "Finder" : "Explorer"}
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleNewFile}
            role="menuitem"
          >
            New File…
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleNewFolder}
            role="menuitem"
          >
            New Folder…
          </button>
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sm border-0 bg-transparent text-foreground text-xs font-normal cursor-pointer font-sans hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleCopyPath}
            role="menuitem"
          >
            Copy Vault Path
          </button>
        </>
      )}
    </div>
  );
};
