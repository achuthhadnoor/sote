import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useVaultStore } from "../../stores/useVaultStore";
import { FileTree } from "./FileTree";
import { showNativeContextMenu } from "../../utils/nativeContextMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, PanelLeft } from "lucide-react";

interface SidebarProps {
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
  onOpenPalette?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings, onToggleSidebar, onOpenPalette }) => {
  const { vaultPath, tree, isLoading, error, openVaultDialog } = useVaultStore();

  const folderName = vaultPath ? vaultPath.split("/").pop() || vaultPath : null;

  const handleEmptyContextMenu = async (e: React.MouseEvent) => {
    // only if clicking on the container itself (empty area below tree) — native menu
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      await showNativeContextMenu(null, e);
    }
  };

  const handleTopBarDragging = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, [role="button"], a')) return;
    if (e.detail === 2) {
      getCurrentWindow().toggleMaximize().catch(() => {});
      return;
    }
    getCurrentWindow().startDragging().catch(() => {});
  };

  return (
    <aside className="w-sidebar min-w-sidebar max-w-sidebar h-full bg-sidebar-translucent border-r border-border-translucent flex flex-col select-none">
      <div
        className="flex h-header items-center justify-end px-3 border-b border-border-translucent shrink-0"
        data-tauri-drag-region
        onMouseDown={handleTopBarDragging}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          title="Toggle Sidebar (⌘B)"
          aria-label="Toggle Sidebar"
          className="h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-hover-translucent hover:text-foreground"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-border-translucent shrink-0">
        <Input
          className="h-[26px] bg-muted-translucent border-transparent focus-visible:ring-1 focus-visible:ring-ring text-[13px] cursor-pointer"
          placeholder="Search notes... (⌘P)"
          readOnly
          onClick={onOpenPalette}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-0" onContextMenu={handleEmptyContextMenu}>
        <ScrollArea className="flex-1 h-full [&>div>div]:!block">
          <div className="p-2">
          {isLoading && (
            <div className="p-4 text-center text-[13px] text-muted-fg leading-relaxed">Scanning vault...</div>
          )}

          {error && (
            <div className="p-4 text-center text-[13px] text-destructive leading-relaxed">
              Error: {error}
            </div>
          )}

          {!isLoading && !error && tree.length === 0 && (
            <div className="p-4 text-center text-[13px] text-muted-fg leading-relaxed">
              {vaultPath ? (
                "No markdown files found in this vault."
              ) : (
                <>
                  No vault opened.<br />
                  <Button
                    variant="link"
                    size="sm"
                    onClick={openVaultDialog}
                    className="mt-2 h-auto p-0 text-[13px] text-primary"
                  >
                    Select a folder
                  </Button>
                </>
              )}
            </div>
          )}

          {!isLoading && tree.length > 0 && <FileTree nodes={tree} />}
          </div>
        </ScrollArea>
      </div>

      <div className="h-header px-3 flex items-center justify-between border-t border-border-translucent text-[13px] text-muted-fg shrink-0">
        <span className="truncate max-w-[160px] inline-flex items-center gap-1.5 text-foreground font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted-foreground shrink-0">
              <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20H5.5A2.5 2.5 0 0 1 3 17.5v-10Z" fill="currentColor" opacity="0.14" />
              <path d="M5.5 5A2.5 2.5 0 0 0 3 7.5v10A2.5 2.5 0 0 0 5.5 20H18.5A2.5 2.5 0 0 0 21 17.5v-8A2.5 2.5 0 0 0 18.5 7H11L9 5H5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {folderName ?? "Library"}
          </span>
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={openVaultDialog}
            className="h-7 px-2 text-[13px] font-medium text-foreground hover:bg-hover-translucent"
            title={vaultPath || "Open vault"}
          >
            {vaultPath ? "Switch" : "Open..."}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenSettings?.()}
            title="Settings (⌘,)"
            aria-label="Open settings"
            className="h-[22px] w-[22px] rounded-sm text-muted-foreground hover:bg-hover-translucent hover:text-foreground"
          >
            <Settings className="h-[14px] w-[14px]" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
