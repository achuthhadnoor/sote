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
    <footer
      className="status-bar relative isolate flex h-status items-center justify-between gap-3 px-3 type-meta select-none border-t border-border-translucent bg-transparent shrink-0"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="status-blur absolute inset-x-0 bottom-0 -z-10 h-[calc(100%+32px)] pointer-events-none backdrop-blur-[14px] [mask-image:linear-gradient(to_top,black_0%,black_65%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_top,black_0%,black_65%,transparent_100%)] bg-gradient-to-t from-status-translucent via-status-translucent/45 to-transparent"
        aria-hidden="true"
      />
      <div className="flex items-center min-w-0 flex-1 mr-2">
        {activePath && (
          <span className="truncate" title={activePath}>
            {activePath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="truncate" aria-live="polite">
          {stats.words} words · {stats.characters} characters · {stats.paragraphs} paragraphs
        </span>
        <Button
          variant={isRawMode ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-5 px-2 text-[10px] font-medium font-sans gap-1.5 rounded-sm border border-transparent",
            isRawMode && "bg-background border-border shadow-xs text-foreground",
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
      </div>
    </footer>
  );
};
