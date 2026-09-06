import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Editor } from "@tiptap/react";
import { useEditorStore } from "../../stores/useEditorStore";
import { Card } from "@/components/ui/card";
import { findTextMatches } from "@/utils/textSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";

interface FindBarProps {
  editor: Editor | null;
  isOpen: boolean;
  showReplace: boolean;
  onClose: () => void;
  onToggleReplace: () => void;
}

export const FindBar: React.FC<FindBarProps> = ({ editor, isOpen, showReplace, onClose, onToggleReplace }) => {
  const [query, setQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const updateBody = useEditorStore((s) => s.updateBody);

  // Compute matches live from editor doc
  const recomputeMatches = useCallback(
    (q: string) => {
      if (!editor || !q) {
        setMatchCount(0);
        return 0;
      }
      const count = findTextMatches(editor.state.doc, q).length;
      setMatchCount(count);
      return count;
    },
    [editor]
  );

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
      // restore previous query active index clamped
      if (query) {
        const c = recomputeMatches(query);
        const clamped = c === 0 ? 0 : Math.min(activeIndex, Math.max(0, c - 1));
        setActiveIndex(clamped);
        (editor?.chain() as any)?.setSearchTerm(query)?.run();
        (editor?.chain() as any)?.setSearchActiveIndex(clamped)?.run();
        scrollToActive(clamped);
      }
    } else {
      // clear search when closed
      (editor?.chain() as any)?.clearSearch?.()?.run();
      setActiveIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When query changes, update decorations and active
  useEffect(() => {
    if (!isOpen) return;
    const c = recomputeMatches(query);
    let idx = activeIndex;
    if (c === 0) idx = 0;
    else if (idx >= c) idx = 0;
    setActiveIndex(idx);
    if (editor) {
      (editor.chain() as any).setSearchTerm(query).run();
      // after setSearchTerm, set active index
      setTimeout(() => {
        (editor.chain() as any).setSearchActiveIndex(idx).run();
        scrollToActive(idx);
      }, 10);
    }
  }, [query, isOpen, editor, recomputeMatches]);

  // When document changes while open, recompute
  useEffect(() => {
    if (!isOpen || !editor) return;
    const handler = () => {
      recomputeMatches(query);
    };
    editor.on("update", handler);
    editor.on("transaction", handler as any);
    return () => {
      editor.off("update", handler);
      editor.off("transaction", handler as any);
    };
  }, [editor, isOpen, query, recomputeMatches]);

  const scrollToActive = (_idx: number) => {
    if (!editor) return;
    setTimeout(() => {
      const el = editor.view.dom.querySelector(".search-highlight-active") as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 30);
  };

  const goNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = (activeIndex + 1) % matchCount;
    setActiveIndex(next);
    (editor?.chain() as any)?.setSearchActiveIndex(next)?.run();
    scrollToActive(next);
  }, [activeIndex, matchCount, editor]);

  const goPrev = useCallback(() => {
    if (matchCount === 0) return;
    const next = (activeIndex - 1 + matchCount) % matchCount;
    setActiveIndex(next);
    (editor?.chain() as any)?.setSearchActiveIndex(next)?.run();
    scrollToActive(next);
  }, [activeIndex, matchCount, editor]);

  const handleReplace = useCallback(() => {
    if (!editor || !query) return;
    if (matchCount === 0) return;
    const target = findTextMatches(editor.state.doc, query)[activeIndex];
    if (target) {
      const { from: targetFrom, to: targetTo } = target;
      const tr = editor.state.tr.replaceWith(targetFrom, targetTo, editor.state.schema.text(replaceQuery));
      editor.view.dispatch(tr);
      // update body store via markdown serialization
      const ed: any = editor;
      const md = typeof ed.getMarkdown === "function" ? ed.getMarkdown() : "";
      updateBody(md);
      // recompute after replace
      const newCount = recomputeMatches(query);
      const newIdx = newCount === 0 ? 0 : Math.min(activeIndex, newCount - 1);
      setActiveIndex(newIdx);
      (editor.chain() as any).setSearchActiveIndex(newIdx).run();
      scrollToActive(newIdx);
    }
  }, [editor, query, replaceQuery, activeIndex, matchCount, recomputeMatches, updateBody]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !query) return;
    if (matchCount === 0) return;
    const ranges = findTextMatches(editor.state.doc, query);
    // Replace from end to start to keep positions valid
    let tr = editor.state.tr;
    for (let i = ranges.length - 1; i >= 0; i--) {
      const r = ranges[i];
      tr = tr.replaceWith(r.from, r.to, editor.state.schema.text(replaceQuery));
    }
    if (ranges.length > 0) {
      editor.view.dispatch(tr);
      const ed: any = editor;
      const md = typeof ed.getMarkdown === "function" ? ed.getMarkdown() : "";
      updateBody(md);
      (editor.chain() as any).clearSearch().run();
      setQuery("");
      setActiveIndex(0);
      setMatchCount(0);
    }
  }, [editor, query, replaceQuery, matchCount, updateBody]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) goPrev();
      else goNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const displayCount = useMemo(() => {
    if (!query) return "";
    if (matchCount === 0) return "No results";
    return `${activeIndex + 1}/${matchCount}`;
  }, [query, matchCount, activeIndex]);

  if (!isOpen) return null;

  return (
    <Card className="find-bar ui-surface absolute bottom-9 left-1/2 -translate-x-1/2 w-[560px] max-w-[90%] p-2.5 flex flex-col gap-2 backdrop-blur-[8px] animate-in fade-in zoom-in-95" role="search" aria-label="Find in editor">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-transparent bg-muted/70 px-2 py-1 focus-within:border-ring focus-within:bg-background transition-colors">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            className="h-auto border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0"
            placeholder="Find"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Find"
          />
          <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap" aria-live="polite">
            {displayCount}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev} disabled={matchCount === 0} title="Previous (Shift+Enter)" aria-label="Previous match">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext} disabled={matchCount === 0} title="Next (Enter)" aria-label="Next match">
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleReplace} title="Toggle Replace" aria-label="Toggle replace">
            <span className="text-[11px]">⇧</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Close (Esc)" aria-label="Close find bar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {showReplace && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-transparent bg-muted/70 px-2 py-1 focus-within:border-ring focus-within:bg-background">
            <Input
              ref={replaceInputRef}
              className="h-auto border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0"
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleReplace();
                } else if (e.key === "Escape") onClose();
              }}
              aria-label="Replace"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={handleReplace} disabled={matchCount === 0 || !query}>
              Replace
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={handleReplaceAll} disabled={matchCount === 0 || !query}>
              Replace All
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
