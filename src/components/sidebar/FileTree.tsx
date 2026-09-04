import React, { useState } from "react";
import { VaultNode } from "../../types/vault";
import { useTabStore } from "../../stores/useTabStore";
import { useVaultStore } from "../../stores/useVaultStore";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { showNativeContextMenu } from "../../utils/nativeContextMenu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  nodes: VaultNode[];
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ nodes, level = 0 }) => {
  const activePath = useTabStore((s) => s.activePath);
  const rovingPath = activePath || nodes[0]?.path || null;

  const handleEmptyContextMenu = async (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      await showNativeContextMenu(null, e);
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-0.5", level > 0 && "ml-2 border-l border-transparent pl-1")}
      role="tree"
      aria-label="Vault files"
      onContextMenu={level === 0 ? handleEmptyContextMenu : undefined}
    >
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} level={level} rovingPath={rovingPath} />
      ))}
    </div>
  );
};

interface FileTreeNodeProps {
  node: VaultNode;
  level: number;
  rovingPath?: string | null;
}

const FolderIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted-foreground" aria-hidden="true">
    {open ? (
      <path d="M3 7.5a2.5 2.5 0 0 1 2.5-2.5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-10Z" fill="currentColor" opacity="0.14" />
    ) : (
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20H5.5A2.5 2.5 0 0 1 3 17.5v-10Z" fill="currentColor" opacity="0.14" />
    )}
    <path d="M5.5 5A2.5 2.5 0 0 0 3 7.5v10A2.5 2.5 0 0 0 5.5 20H18.5A2.5 2.5 0 0 0 21 17.5v-8A2.5 2.5 0 0 0 18.5 7H11L9 5H5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    {open && <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />}
  </svg>
);

const FileIcon: React.FC<{ name: string }> = ({ name }) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isMd = ext === "md" || ext === "markdown";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={cn("shrink-0 text-muted-foreground", isMd && "text-foreground")} aria-hidden="true">
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16Z" fill="currentColor" opacity="0.10" />
      <path d="M8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16A1.5 1.5 0 0 1 8.5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V6.5H18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10 13H15M10 16H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={isMd ? 0.9 : 0.35} />
      {isMd && <path d="M10 10H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.9} />}
    </svg>
  );
};

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-90")} aria-hidden="true">
    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level, rovingPath }) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const isActive = !node.isDirectory && activePath === node.path;
  const isRovingActive = rovingPath ? rovingPath === node.path : isActive;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && !node.isDirectory) {
      e.preventDefault();
      openPath(node.path).catch(() => {});
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));
      const idx = items.findIndex((el) => el === e.currentTarget);
      if (idx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      const next = items[nextIdx];
      items.forEach((el) => (el.tabIndex = -1));
      next.tabIndex = 0;
      next.focus();
      return;
    }
    if (node.isDirectory && e.key === "ArrowRight") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else {
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
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", node.path);
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
    const files = Array.from(e.dataTransfer.files) as unknown as Array<File & { path?: string }>;
    if (files.length === 0) return;
    const valid = files.map((f) => (f as any).path as string | undefined).filter((p): p is string => !!p && typeof p === "string");
    if (valid.length === 0) return;
    await Promise.allSettled(valid.map((srcPath) => invoke("copy_external_file", { srcPath, destDir: node.path }).catch((err) => console.error("copy_external_file failed", err))));
    try {
      await useVaultStore.getState().loadVault(vp);
    } catch {}
  };

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await showNativeContextMenu(node, e);
  };

  if (node.isDirectory) {
    return (
      <div className="tree-dir-item">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              role="treeitem"
              aria-expanded={isOpen}
              aria-selected={false}
              tabIndex={isRovingActive ? 0 : -1}
              onKeyDown={handleKeyDown}
              onContextMenu={handleContextMenu}
              draggable
              onDragStart={handleDragStart}
              onDragOver={handleFolderDragOver}
              onDragLeave={handleFolderDragLeave}
              onDragEnd={handleFolderDragEnd}
              onDrop={handleFolderDrop}
              data-folder-path={node.path}
              title={node.path}
              className={cn(
                "group flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 py-0 text-[13px] font-normal justify-start hover:bg-[var(--hover-translucent)] hover:text-foreground",
                isDragOver && "bg-[var(--accent-subtle)] outline outline-1 outline-dashed outline-[var(--accent)] outline-offset-[-1px]"
              )}
            >
              <ChevronIcon open={isOpen} />
              <FolderIcon open={isOpen} />
              <span className="truncate text-[13px]">{node.name}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            {isOpen && node.children && <FileTreeWithMenu nodes={node.children} level={level + 1} rovingPath={rovingPath} />}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      role="treeitem"
      aria-selected={isActive}
      tabIndex={isRovingActive ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={() => selectNote(node.path, node.name)}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      title={node.path}
      className={cn(
        "group flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 py-0 text-[13px] font-normal justify-start hover:bg-[var(--hover-translucent)] hover:text-foreground",
        isActive && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] shadow-sm font-medium",
        !isActive && "text-[var(--sidebar-fg)]"
      )}
    >
      <span className="w-[12px] shrink-0" aria-hidden="true" />
      <FileIcon name={node.name} />
      <span className="truncate">{node.name}</span>
    </Button>
  );
};

const FileTreeWithMenu: React.FC<FileTreeProps & { rovingPath?: string | null }> = ({ nodes, level = 0, rovingPath }) => {
  return (
    <div className={cn("flex flex-col gap-0.5", level > 0 && "ml-2 pl-1")} role="group">
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} level={level} rovingPath={rovingPath} />
      ))}
    </div>
  );
};
