import React, { useMemo } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { useTabStore } from "../../stores/useTabStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const StatusBar: React.FC = () => {
  const body = useEditorStore((state) => state.body);
  const activePath = useTabStore((state) => state.activePath);
  const isRawMode = useEditorStore((state) => state.isRawMode);
  const toggleRawMode = useEditorStore((state) => state.toggleRawMode);

  const stats = useMemo(() => {
    if (!activePath || !body || !body.trim()) {
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
  }, [body, activePath]);

  return (
    <footer className="status-bar flex h-[var(--status-height)] items-center justify-between gap-3 border-t border-[var(--border-translucent)] bg-[var(--status-translucent)] px-2 pl-4 text-[11px] font-mono text-muted-foreground select-none" role="status" aria-live="polite" aria-atomic="true">
      <span className="status-stats truncate" aria-live="polite">
        {stats.words} words · {stats.characters} characters · {stats.paragraphs} paragraphs
      </span>
      <Button
        variant={isRawMode ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-[20px] px-2 text-[10px] font-medium font-sans gap-1.5 rounded-[var(--radius-sm)] border border-transparent",
          isRawMode && "bg-background border-border shadow-sm text-foreground",
          !activePath && "opacity-40 pointer-events-none"
        )}
        onClick={toggleRawMode}
        title={isRawMode ? "Switch to rich view" : "Show raw markdown"}
        aria-label={isRawMode ? "Switch to rich view" : "Show raw markdown"}
        aria-pressed={isRawMode}
        disabled={!activePath}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 9L4 12L8 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 9L20 12L16 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 5L10 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>{isRawMode ? "Rich" : "Raw"}</span>
      </Button>
    </footer>
  );
};
