import React, { useState } from "react";
import { VaultNode } from "../../types/vault";
import { useTabStore } from "../../stores/useTabStore";
import { useVaultStore } from "../../stores/useVaultStore";
import { FileContextMenu } from "./FileContextMenu";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

interface FileTreeProps {
  nodes: VaultNode[];
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, level = 0 }) => {
  const [menu, setMenu] = useState<{ node: VaultNode | null; x: number; y: number } | null>(null);

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
      <div className="file-tree" style={{ paddingLeft: level > 0 ? 12 : 0 }} onContextMenu={level === 0 ? handleEmptyContextMenu : undefined}>
        {nodes.map((node) => (
          <FileTreeNode key={node.path} node={node} level={level} onContextMenu={handleContextMenu} />
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

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level, onContextMenu }) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && !node.isDirectory) {
      e.preventDefault();
      // Quick Look: open with default app (Preview on macOS)
      openPath(node.path).catch(() => {});
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

  if (node.isDirectory) {
    return (
      <div className="tree-dir-item">
        <div
          className={`tree-row tree-dir-row ${isDragOver ? "drag-over" : ""}`}
          draggable
          onDragStart={handleDragStart}
          onClick={() => setIsOpen((prev) => !prev)}
          onContextMenu={(e) => onContextMenu(e, node)}
          onDragOver={handleFolderDragOver}
          onDragLeave={handleFolderDragLeave}
          onDragEnd={handleFolderDragEnd}
          onDrop={handleFolderDrop}
          data-folder-path={node.path}
          title={node.path}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <span className="tree-chevron">
            <ChevronIcon open={isOpen} />
          </span>
          <FolderIcon open={isOpen} />
          <span className="tree-name">{node.name}</span>
        </div>
        {isOpen && node.children && <FileTreeWithMenu nodes={node.children} level={level + 1} onContextMenu={onContextMenu} />}
      </div>
    );
  }

  const isActive = activePath === node.path;

  return (
    <div
      className={`tree-row tree-file-row ${isActive ? "active-row" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onClick={() => selectNote(node.path, node.name)}
      onContextMenu={(e) => onContextMenu(e, node)}
      onKeyDown={handleKeyDown}
      title={node.path}
      tabIndex={0}
    >
      <span className="tree-file-indent" aria-hidden="true" />
      <FileIcon name={node.name} />
      <span className="tree-name">{node.name}</span>
    </div>
  );
};

// Helper to propagate context menu through nested levels without creating new menu state each level
const FileTreeWithMenu: React.FC<FileTreeProps & { onContextMenu: (e: React.MouseEvent, node: VaultNode) => void }> = ({
  nodes,
  level = 0,
  onContextMenu,
}) => {
  return (
    <div className="file-tree" style={{ paddingLeft: level > 0 ? 12 : 0 }}>
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} level={level} onContextMenu={onContextMenu} />
      ))}
    </div>
  );
};
