import React, { useCallback, useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "../../stores/useVaultStore";
import { cn } from "@/lib/utils";
import { modShortcut } from "../../utils/platform";

interface WelcomeGateProps {
  /** True while Finder is dragging over the window (Tauri drag-drop). */
  isExternalDragActive?: boolean;
}

export const WelcomeGate: React.FC<WelcomeGateProps> = ({ isExternalDragActive = false }) => {
  const openVaultDialog = useVaultStore((s) => s.openVaultDialog);
  const isLoading = useVaultStore((s) => s.isLoading);
  const error = useVaultStore((s) => s.error);
  const [isLocalDragOver, setIsLocalDragOver] = useState(false);

  const isDragActive = isExternalDragActive || isLocalDragOver;

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsLocalDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear when leaving the zone itself, not children
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsLocalDragOver(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLocalDragOver(false);
    // Tauri onDragDropEvent in App handles the real open; HTML5 path is a fallback there.
  }, []);

  return (
    <section
      className="welcome-gate relative flex-1 flex flex-col items-center justify-center px-8 py-10 overflow-hidden"
      aria-label="Open a folder to get started"
    >
      <div className="welcome-gate__atmosphere" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center gap-8 text-center">
        <header className="flex flex-col items-center gap-2">
          <h1 className="font-display text-[34px] sm:text-[40px] font-semibold tracking-tight text-foreground leading-none">
            sote
          </h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[28ch]">
            Your notes live in a folder on disk.
          </p>
        </header>

        <div
          onClick={() => {
            if (!isLoading) void openVaultDialog();
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "welcome-gate__drop group w-full rounded-2xl border border-dashed px-6 py-10",
            "flex flex-col items-center gap-4 transition-[border-color,background-color,box-shadow,transform] duration-200",
            isDragActive
              ? "border-accent bg-accent-translucent scale-[1.01] shadow-[0_0_0_1px_var(--accent)]"
              : "border-border-translucent bg-muted-translucent/40 hover:border-border hover:bg-muted-translucent/70",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
              isDragActive ? "bg-accent text-accent-fg" : "bg-background/60 text-muted-foreground",
            )}
          >
            <FolderOpen className="h-6 w-6" strokeWidth={1.75} />
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-medium text-foreground">
              {isDragActive ? "Release to open" : isLoading ? "Opening…" : "Drop a folder here"}
            </p>
            {!isDragActive && !isLoading && (
              <p className="text-[13px] text-muted-foreground">or choose one from disk</p>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            disabled={isLoading}
            className="mt-1 min-w-[160px]"
            onClick={(e) => {
              e.stopPropagation();
              void openVaultDialog();
            }}
          >
            Choose Folder
          </Button>
        </div>

        {error ? (
          <p className="text-[13px] text-destructive leading-relaxed" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-[12px] text-muted-foreground/80 tracking-wide">
            <kbd className="font-mono text-[11px] opacity-80">{modShortcut("O")}</kbd>
            <span className="mx-1.5">to open anytime</span>
          </p>
        )}
      </div>
    </section>
  );
};
