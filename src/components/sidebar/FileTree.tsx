import React, { useState } from "react";
import { VaultNode } from "../../types/vault";
import { useTabStore } from "../../stores/useTabStore";
import { useVaultStore } from "../../stores/useVaultStore";
import { useFileTreeExpandStore } from "../../stores/useFileTreeExpandStore";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { showNativeContextMenu } from "../../utils/nativeContextMenu";
import { flushActiveNote } from "../../lib/flushActiveNote";
import { handleFileTreeKeyDown } from "./fileTreeKeyboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { createLogger } from "../../lib/logger";

const log = createLogger("file-tree");

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
      className="flex flex-col gap-0.5 w-full"
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

const FolderIcon: React.FC<{ open: boolean }> = ({ open }) => {
  if (open) {
    return <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />;
  }
  return <Folder className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />;
};

const FileIcon: React.FC<{ name: string; isActive?: boolean }> = ({ name, isActive }) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isMd = ext === "md" || ext === "markdown";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={cn(
        "shrink-0 text-muted-foreground group-hover:text-foreground",
        isMd && "text-foreground",
        isActive && "text-[var(--accent-fg)] group-hover:text-[var(--accent-fg)]"
      )}
      aria-hidden="true"
    >
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16Z" fill="currentColor" opacity="0.10" />
      <path d="M8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16A1.5 1.5 0 0 1 8.5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V6.5H18" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10 13H15M10 16H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={isMd ? 0.9 : 0.35} />
      {isMd && <path d="M10 10H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.9} />}
    </svg>
  );
};

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <ChevronRight
    className={cn(
      "h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform duration-150",
      open && "rotate-90"
    )}
    aria-hidden="true"
  />
);

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level, rovingPath }) => {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const defaultOpen = level === 0;
  const isOpen = useFileTreeExpandStore((s) => {
    if (!vaultPath) return defaultOpen;
    const entry = s.byVault[vaultPath]?.[node.path];
    return entry === undefined ? defaultOpen : entry;
  });
  const setExpanded = useFileTreeExpandStore((s) => s.setExpanded);
  const setIsOpen = (open: boolean) => setExpanded(vaultPath, node.path, open);

  const [isDragOver, setIsDragOver] = useState(false);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const isActive = !node.isDirectory && activePath === node.path;
  const isRovingActive = rovingPath ? rovingPath === node.path : isActive;

  const openNote = async (path: string, name: string) => {
    if (path === useTabStore.getState().activePath) return;
    if (!(await flushActiveNote())) return;
    selectNote(path, name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    handleFileTreeKeyDown(e, {
      isDirectory: node.isDirectory,
      isOpen,
      setOpen: setIsOpen,
      openNote: () => void openNote(node.path, node.name),
      openWithDefault: () => {
        openPath(node.path).catch(() => {});
      },
    });
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
    e.stopPropagation();
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
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath) return;
    await Promise.allSettled(valid.map((srcPath) => invoke("copy_external_file", { vaultPath, srcPath, destDir: node.path }).catch((err) => { log.error("copy_external_file failed", err); throw err; })));
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
      <div className="tree-dir-item w-full">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="row"
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
              style={{
                paddingLeft: `${8 + level * 16}px`,
              }}
              className={cn(
                "group flex h-7 w-full items-center gap-1.5 rounded-md pr-2 py-0 text-[13px] font-normal justify-start hover:bg-[var(--hover-translucent)] hover:text-foreground select-none",
                isDragOver && "bg-[var(--accent-subtle)] outline outline-1 outline-dashed outline-[var(--accent)] outline-offset-[-1px]"
              )}
            >
              <ChevronIcon open={isOpen} />
              <FolderIcon open={isOpen} />
              <span className="truncate text-[13px]">{node.name}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            {node.children && <FileTreeSubGroup nodes={node.children} level={level + 1} rovingPath={rovingPath} />}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  return (
    <Button
      variant="row"
      role="treeitem"
      aria-selected={isActive}
      tabIndex={isRovingActive ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={() => void openNote(node.path, node.name)}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      title={node.path}
      style={{
        paddingLeft: `${8 + level * 16}px`,
      }}
      className={cn(
        "group flex h-7 w-full items-center gap-1.5 rounded-md pr-2 py-0 text-[13px] font-normal justify-start hover:bg-[var(--hover-translucent)] hover:text-foreground select-none",
        isActive && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] shadow-sm font-medium",
        !isActive && "text-[var(--sidebar-fg)]"
      )}
    >
      <span className="w-3.5 shrink-0" aria-hidden="true" />
      <FileIcon name={node.name} isActive={isActive} />
      <span className="truncate">{node.name}</span>
    </Button>
  );
};

const FileTreeSubGroup: React.FC<FileTreeProps & { rovingPath?: string | null }> = ({ nodes, level = 0, rovingPath }) => {
  return (
    <div className="flex flex-col gap-0.5 w-full" role="group">
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} level={level} rovingPath={rovingPath} />
      ))}
    </div>
  );
};
