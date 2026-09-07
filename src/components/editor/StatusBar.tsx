import React, { useMemo } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { useTabStore } from "../../stores/useTabStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isVirtualTab } from "../../lib/specialTabs";

export const StatusBar: React.FC = () => {
  const body = useEditorStore((state) => state.body);
  const activePath = useTabStore((state) => state.activePath);
  const isRawMode = useEditorStore((state) => state.isRawMode);
  const toggleRawMode = useEditorStore((state) => state.toggleRawMode);
  const isVirtual = isVirtualTab(activePath);
  const notePath = isVirtual ? null : activePath;

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
      className="status-bar relative isolate flex h-status items-center justify-between gap-3 px-3 type-meta select-none border-t border-border-translucent bg-transparent shrink-0"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="chrome-blur chrome-blur--footer status-blur" aria-hidden="true">
        <div className="chrome-blur__layer" />
        <div className="chrome-blur__layer chrome-blur__soft" />
      </div>
      <div className="flex items-center min-w-0 flex-1 mr-2">
        {notePath && (
          <span className="truncate" title={notePath}>
            {notePath}
          </span>
        )}
        {isVirtual && (
          <span className="truncate" title="Settings">
            Settings
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!isVirtual && (
          <span className="truncate" aria-live="polite">
            {stats.words} words · {stats.characters} characters · {stats.paragraphs} paragraphs
          </span>
        )}
        <Button
          variant={isRawMode ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-5 px-2 type-label font-medium gap-1.5 rounded-sm border border-transparent",
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
    </footer>
  );
};
