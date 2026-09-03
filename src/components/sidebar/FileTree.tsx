import React, { useState } from "react";
import { VaultNode } from "../../types/vault";
import { useTabStore } from "../../stores/useTabStore";
import { useVaultStore } from "../../stores/useVaultStore";
import { FileContextMenu } from "./FileContextMenu";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";

interface FileTreeProps {
  nodes: VaultNode[];
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, level = 0 }) => {
  const [menu, setMenu] = useState<{ node: VaultNode | null; x: number; y: number } | null>(null);
  const activePath = useTabStore((s) => s.activePath);
  const rovingPath = activePath || nodes[0]?.path || null;

  const handleContextMenu = (e: React.MouseEvent, node: VaultNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ node, x: e.clientX, y: e.clientY });
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    // only if clicking on the container itself (empty area)
    if (e.target === e.currentTarget) {
      handleContextMenu(e, null);
    }
  };

  return (
    <>
      <div
        className="file-tree"
        role="tree"
        aria-label="Vault files"
        style={{ paddingLeft: level > 0 ? 12 : 0 }}
        onContextMenu={level === 0 ? handleEmptyContextMenu : undefined}
      >
        {nodes.map((node) => (
          <FileTreeNode key={node.path} node={node} level={level} onContextMenu={handleContextMenu} rovingPath={rovingPath} />
        ))}
      </div>
      {menu && <FileContextMenu node={menu.node} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </>
  );
};

interface FileTreeNodeProps {
  node: VaultNode;
  level: number;
  onContextMenu: (e: React.MouseEvent, node: VaultNode) => void;
  rovingPath?: string | null;
}

const FolderIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className="tree-icon tree-folder-icon"
    aria-hidden="true"
  >
    {open ? (
      <path
        d="M3 7.5a2.5 2.5 0 0 1 2.5-2.5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-10Z"
        fill="currentColor"
        opacity="0.14"
      />
    ) : (
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20H5.5A2.5 2.5 0 0 1 3 17.5v-10Z"
        fill="currentColor"
        opacity="0.14"
      />
    )}
    <path
      d="M5.5 5A2.5 2.5 0 0 0 3 7.5v10A2.5 2.5 0 0 0 5.5 20H18.5A2.5 2.5 0 0 0 21 17.5v-8A2.5 2.5 0 0 0 18.5 7H11L9 5H5.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {open && <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />}
  </svg>
);

const FileIcon: React.FC<{ name: string }> = ({ name }) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isMd = ext === "md" || ext === "markdown";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={`tree-icon tree-file-icon ${isMd ? "is-md" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M7 3.5A1.5 1.5 0 0 1 8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16Z"
        fill="currentColor"
        opacity="0.10"
      />
      <path
        d="M8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16A1.5 1.5 0 0 1 8.5 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2.5V6.5H18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10 13H15M10 16H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={isMd ? 0.9 : 0.35} />
      {isMd && <path d="M10 10H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.9} />}
    </svg>
  );
};

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`tree-chevron-icon ${open ? "is-open" : ""}`} aria-hidden="true">
    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FileTreeNode: React.FC<FileTreeNodeProps & { rovingPath?: string | null }> = ({ node, level, onContextMenu, rovingPath }) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const isActive = !node.isDirectory && activePath === node.path;
  const isRovingActive = rovingPath ? rovingPath === node.path : isActive;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && !node.isDirectory) {
      e.preventDefault();
      // Quick Look: open with default app (Preview on macOS)
      openPath(node.path).catch(() => {});
      return;
    }
    // Roving tabindex arrow navigation
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));
      const idx = items.findIndex((el) => el === e.currentTarget);
      if (idx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      const next = items[nextIdx];
      // Update tabIndex for roving
      items.forEach((el) => (el.tabIndex = -1));
      next.tabIndex = 0;
      next.focus();
      return;
    }
    if (node.isDirectory && e.key === "ArrowRight") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else {
        // focus first child if expanded
        const items = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));
        const idx = items.findIndex((el) => el === e.currentTarget);
        const next = items[idx + 1];
        if (next) {
          items.forEach((el) => (el.tabIndex = -1));
          next.tabIndex = 0;
          next.focus();
        }
      }
      return;
    }
    if (node.isDirectory && e.key === "ArrowLeft") {
      e.preventDefault();
      if (isOpen) setIsOpen(false);
      else {
        // focus parent treeitem
        const parent = (e.currentTarget as HTMLElement).closest(".tree-dir-item")?.parentElement?.closest('[role="treeitem"]') as HTMLElement | null;
        if (parent) {
          const items = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));
          items.forEach((el) => (el.tabIndex = -1));
          parent.tabIndex = 0;
          parent.focus();
        }
      }
      return;
    }
    if (e.key === "Enter" || (e.key === " " && node.isDirectory)) {
      e.preventDefault();
      if (node.isDirectory) setIsOpen((prev) => !prev);
      else selectNote(node.path, node.name);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Provide file path for drag-out to Finder/Desktop (copy)
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", node.path);
    // Also set DownloadURL for browsers that support it
    try {
      e.dataTransfer.setData("DownloadURL", `application/octet-stream:${node.name}:${node.path}`);
    } catch {}
  };

  const handleFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFolderDragEnd = () => setIsDragOver(false);

  const handleFolderDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const vp = useVaultStore.getState().vaultPath;
    if (!vp) return;
    // HTML5 fallback: try to get paths from dataTransfer (Tauri's onDragDropEvent is primary in App.tsx)
    const files = Array.from(e.dataTransfer.files) as unknown as Array<File & { path?: string }>;
    if (files.length === 0) return;
    const valid = files.map((f) => (f as any).path as string | undefined).filter((p): p is string => !!p && typeof p === "string");
    if (valid.length === 0) return;
    await Promise.allSettled(
      valid.map((srcPath) =>
        invoke("copy_external_file", { srcPath, destDir: node.path }).catch((err) => {
          console.error("copy_external_file failed", err);
        })
      )
    );
    try {
      await useVaultStore.getState().loadVault(vp);
    } catch {}
  };

  const handleFolderContextMenuNative = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const vaultPath = useVaultStore.getState().vaultPath;
    const loadVault = useVaultStore.getState().loadVault;
    const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
    try {
      const reveal = await MenuItem.new({
        id: "reveal",
        text: `Reveal in ${isMac ? "Finder" : "Explorer"}`,
        action: async () => {
          try {
            await revealItemInDir(node.path);
          } catch (err) {
            console.error("Reveal failed", err);
          }
        },
      });
      const open = await MenuItem.new({
        id: "open",
        text: "Open with Default App",
        action: async () => {
          try {
            await openPath(node.path);
          } catch {}
        },
      });
      const sep1 = await PredefinedMenuItem.new({ text: "Separator" } as any);
      const renameItem = await MenuItem.new({
        id: "rename",
        text: "Rename…",
        action: async () => {
          const current = node.name;
          const next = window.prompt(`Rename "${current}" to:`, current);
          if (!next || next === current || !next.trim()) return;
          try {
            const newPath = await invoke<string>("rename_path", { oldPath: node.path, newName: next.trim() });
            const tabs = useTabStore.getState().tabs;
            const tab = tabs.find((t) => t.path === node.path);
            if (tab) {
              useTabStore.getState().closeTab(node.path);
              useTabStore.getState().selectNote(newPath, next.trim());
            }
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
        },
      });
      const del = await MenuItem.new({
        id: "delete",
        text: "Delete",
        action: async () => {
          const ok = window.confirm(`Delete "${node.name}"? This cannot be undone.`);
          if (!ok) return;
          try {
            await invoke("delete_path", { path: node.path });
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
        },
      });
      const sep2 = await PredefinedMenuItem.new({ text: "Separator" } as any);
      const copyPath = await MenuItem.new({
        id: "copyPath",
        text: "Copy Path",
        action: async () => {
          try {
            await navigator.clipboard.writeText(node.path);
          } catch {}
        },
      });
      const copyRel = await MenuItem.new({
        id: "copyRel",
        text: "Copy Relative Path",
        action: async () => {
          const vp = useVaultStore.getState().vaultPath;
          const rel = vp && node.path.startsWith(vp) ? node.path.slice(vp.length).replace(/^\/+/, "") : node.path;
          try {
            await navigator.clipboard.writeText(rel);
          } catch {}
        },
      });
      const sep3 = await PredefinedMenuItem.new({ text: "Separator" } as any);
      const newFile = await MenuItem.new({
        id: "newFile",
        text: "New File…",
        action: async () => {
          const name = window.prompt("New file name (e.g. Note.md):", "Untitled.md");
          if (!name || !name.trim()) return;
          try {
            const dirPath = node.path;
            const newPath = await invoke<string>("create_file_at_path", { dirPath, fileName: name.trim() });
            if (vaultPath) await loadVault(vaultPath);
            const title = newPath.split("/").pop() || name;
            useTabStore.getState().selectNote(newPath, title);
          } catch (e: any) {
            alert(`Create file failed: ${e?.message || e}`);
          }
        },
      });
      const newFolder = await MenuItem.new({
        id: "newFolder",
        text: "New Folder…",
        action: async () => {
          const name = window.prompt("New folder name:", "New Folder");
          if (!name || !name.trim()) return;
          try {
            const dirPath = node.path;
            await invoke<string>("create_folder_at_path", { dirPath, folderName: name.trim() });
            if (vaultPath) await loadVault(vaultPath);
          } catch (e: any) {
            alert(`Create folder failed: ${e?.message || e}`);
          }
        },
      });
      const menu = await Menu.new({
        items: [reveal, open, sep1, renameItem, del, sep2, copyPath, copyRel, sep3, newFile, newFolder],
      });
      await menu.popup();
    } catch (err) {
      console.error("Native folder menu failed, fallback to custom", err);
      onContextMenu(e, node);
    }
  };

  if (node.isDirectory) {
    return (
      <div className="tree-dir-item">
        <div
          className={`tree-row tree-dir-row ${isDragOver ? "drag-over" : ""}`}
          draggable
          onDragStart={handleDragStart}
          onClick={() => setIsOpen((prev) => !prev)}
          onContextMenu={handleFolderContextMenuNative}
          onDragOver={handleFolderDragOver}
          onDragLeave={handleFolderDragLeave}
          onDragEnd={handleFolderDragEnd}
          onDrop={handleFolderDrop}
          data-folder-path={node.path}
          title={node.path}
          role="treeitem"
          aria-expanded={isOpen}
          aria-selected={false}
          tabIndex={isRovingActive ? 0 : -1}
          onKeyDown={handleKeyDown}
        >
          <span className="tree-chevron">
            <ChevronIcon open={isOpen} />
          </span>
          <FolderIcon open={isOpen} />
          <span className="tree-name">{node.name}</span>
        </div>
        {isOpen && node.children && <FileTreeWithMenu nodes={node.children} level={level + 1} onContextMenu={onContextMenu} rovingPath={rovingPath} />}
      </div>
    );
  }

  return (
    <div
      className={`tree-row tree-file-row ${isActive ? "active-row" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onClick={() => selectNote(node.path, node.name)}
      onContextMenu={(e) => onContextMenu(e, node)}
      onKeyDown={handleKeyDown}
      title={node.path}
      role="treeitem"
      aria-selected={isActive}
      tabIndex={isRovingActive ? 0 : -1}
    >
      <span className="tree-file-indent" aria-hidden="true" />
      <FileIcon name={node.name} />
      <span className="tree-name">{node.name}</span>
    </div>
  );
};

// Helper to propagate context menu through nested levels without creating new menu state each level
const FileTreeWithMenu: React.FC<FileTreeProps & { onContextMenu: (e: React.MouseEvent, node: VaultNode) => void; rovingPath?: string | null }> = ({
  nodes,
  level = 0,
  onContextMenu,
  rovingPath,
}) => {
  return (
    <div className="file-tree" role="group" style={{ paddingLeft: level > 0 ? 12 : 0 }}>
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} level={level} onContextMenu={onContextMenu} rovingPath={rovingPath} />
      ))}
    </div>
  );
};
