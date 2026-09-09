import React, { useMemo } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { useTabStore } from "../../stores/useTabStore";
import { useVaultStore } from "../../stores/useVaultStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isVirtualTab } from "../../lib/specialTabs";

function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(n / 1000)}k`;
}

function statusBarPathLabel(vaultPath: string | null, absPath: string): string {
  const fileParts = absPath.split(/[/\\]/).filter(Boolean);
  const fileName = fileParts[fileParts.length - 1] || absPath;
  if (!vaultPath) return fileName;

  const vaultNorm = vaultPath.replace(/[/\\]+$/, "");
  const vaultParts = vaultNorm.split(/[/\\]/).filter(Boolean);
  const vaultName = vaultParts[vaultParts.length - 1] || vaultNorm;

  const absLower = absPath.toLocaleLowerCase();
  const vaultLower = vaultNorm.toLocaleLowerCase();
  const prefixSlash = vaultLower + "/";
  const prefixBackslash = vaultLower + "\\";

  let relative: string | null = null;
  if (absLower.startsWith(prefixSlash) || absLower.startsWith(prefixBackslash)) {
    relative = absPath.slice(vaultNorm.length + 1);
  } else if (absLower === vaultLower) {
    return vaultName;
  }

  if (!relative) return [vaultName, fileName].join(" > ");
  const relParts = relative.split(/[/\\]/).filter(Boolean);
  return [vaultName, ...relParts].join(" > ");
}

export const StatusBar: React.FC = () => {
  const body = useEditorStore((state) => state.body);
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const activePath = useTabStore((state) => state.activePath);
  const isRawMode = useEditorStore((state) => state.isRawMode);
  const toggleRawMode = useEditorStore((state) => state.toggleRawMode);
  const isVirtual = isVirtualTab(activePath);
  const notePath = isVirtual ? null : activePath;
  const pathLabel = notePath ? statusBarPathLabel(vaultPath, notePath) : null;

  const stats = useMemo(() => {
    if (!notePath || !body || !body.trim()) {
      return { words: 0, characters: 0, paragraphs: 0 };
    }

    const characters = body.length;
    const words = (body.match(/\S+/g) || []).length;
    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0).length;

    return {
      words,
      characters,
      paragraphs: Math.max(paragraphs, words > 0 ? 1 : 0),
    };
  }, [body, notePath]);

  return (
    <footer
      className="status-bar relative z-20 isolate flex h-status items-center border-t border-border-translucent bg-transparent shrink-0 overflow-visible"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="chrome-blur chrome-blur--footer status-blur" aria-hidden="true">
        <div className="chrome-blur__layer chrome-blur__b1" />
        <div className="chrome-blur__layer chrome-blur__b2" />
        <div className="chrome-blur__layer chrome-blur__b3" />
        <div className="chrome-blur__layer chrome-blur__b4" />
        <div className="chrome-blur__layer chrome-blur__b5" />
        <div className="chrome-blur__layer chrome-blur__tint" />
      </div>
      <div className="relative z-10 flex w-full h-full items-center justify-between gap-2 max-[480px]:gap-1.5 px-3 max-[480px]:px-2 type-meta select-none">
      <div className="flex items-center min-w-0 flex-1 mr-2 max-[480px]:hidden">
        {pathLabel && (
          <span className="truncate" title={notePath ?? pathLabel}>
            {pathLabel}
          </span>
        )}
        {isVirtual && (
          <span className="truncate" title="Settings">
            Settings
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 max-[480px]:gap-2 min-w-0 shrink max-[480px]:flex-1">
        {isVirtual && (
          <span className="min-[481px]:hidden truncate min-w-0" title="Settings">
            Settings
          </span>
        )}
        {!isVirtual && (
          <>
            <span
              className="hidden min-[481px]:inline truncate min-w-0"
              aria-live="polite"
              title={`${stats.words} words · ${stats.characters} characters · ${stats.paragraphs} paragraphs`}
            >
              {stats.words} words · {stats.characters} characters · {stats.paragraphs} paragraphs
            </span>
            <span
              className="min-[481px]:hidden truncate min-w-0"
              aria-live="polite"
              title={`${stats.words} words · ${stats.characters} characters · ${stats.paragraphs} paragraphs`}
            >
              {formatCompactCount(stats.words)} words
            </span>
          </>
        )}
        <Button
          variant={isRawMode ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-5 px-2 type-label font-medium gap-1.5 rounded-sm border border-transparent shrink-0",
            isRawMode && "bg-transparent border-border-translucent text-foreground",
            (!notePath || isVirtual) && "opacity-40 pointer-events-none"
          )}
          onClick={toggleRawMode}
          title={isRawMode ? "Switch to rich view" : "Show raw markdown"}
          aria-label={isRawMode ? "Switch to rich view" : "Show raw markdown"}
          aria-pressed={isRawMode}
          disabled={!notePath || isVirtual}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 9L4 12L8 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 9L20 12L16 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 5L10 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{isRawMode ? "Rich" : "Raw"}</span>
        </Button>
      </div>
      </div>
    </footer>
  );
};
