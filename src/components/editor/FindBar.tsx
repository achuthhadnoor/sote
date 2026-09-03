import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Editor } from "@tiptap/react";
import { useEditorStore } from "../../stores/useEditorStore";

interface FindBarProps {
  editor: Editor | null;
  isOpen: boolean;
  showReplace: boolean;
  onClose: () => void;
  onToggleReplace: () => void;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      const regex = new RegExp(escapeRegExp(q), "gi");
      let count = 0;
      const doc = editor.state.doc;
      doc.descendants((node: any) => {
        if (node.isText && node.text) {
          const text = node.text as string;
          let m: RegExpExecArray | null;
          regex.lastIndex = 0;
          while ((m = regex.exec(text)) !== null) {
            count++;
            if (m[0].length === 0) regex.lastIndex++;
          }
        }
      });
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
    // Find active match range and replace
    const doc = editor.state.doc;
    const regex = new RegExp(escapeRegExp(query), "gi");
    let current = 0;
    let replaced = false;
    let targetFrom = -1;
    let targetTo = -1;
    doc.descendants((node: any, pos: number) => {
      if (replaced) return false;
      if (!node.isText || !node.text) return;
      const text = node.text as string;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        if (current === activeIndex) {
          targetFrom = pos + m.index;
          targetTo = targetFrom + m[0].length;
          replaced = true;
          break;
        }
        current++;
        if (m[0].length === 0) regex.lastIndex++;
      }
    });
    if (targetFrom >= 0) {
      const tr = editor.state.tr.replaceWith(targetFrom, targetTo, editor.state.schema.text(replaceQuery));
      editor.view.dispatch(tr);
      // update body store via markdown serialization
      const ed: any = editor;
      const md = typeof ed.getMarkdown === "function" ? ed.getMarkdown() : "";
      if (md) updateBody(md);
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
    const doc = editor.state.doc;
    const regex = new RegExp(escapeRegExp(query), "gi");
    const ranges: Array<{ from: number; to: number }> = [];
    doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      const text = node.text as string;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        const from = pos + m.index;
        const to = from + m[0].length;
        ranges.push({ from, to });
        if (m[0].length === 0) regex.lastIndex++;
      }
    });
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
      if (md) updateBody(md);
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
    <div className="find-bar" role="search" aria-label="Find in editor">
      <div className="find-bar-row">
        <div className="find-input-group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="find-icon">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="find-input"
            placeholder="Find"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Find"
          />
          <span className="find-count" aria-live="polite">
            {displayCount}
          </span>
        </div>
        <div className="find-actions">
          <button className="find-btn" onClick={goPrev} disabled={matchCount === 0} title="Previous (Shift+Enter)" aria-label="Previous match">
            ↑
          </button>
          <button className="find-btn" onClick={goNext} disabled={matchCount === 0} title="Next (Enter)" aria-label="Next match">
            ↓
          </button>
          <button className="find-btn" onClick={onToggleReplace} title="Toggle Replace (Shift+Cmd+F)" aria-label="Toggle replace">
            {/* replace icon */}
            <span style={{ fontSize: "11px" }}>⇧</span>
          </button>
          <button className="find-close" onClick={onClose} title="Close (Esc)" aria-label="Close find bar">
            ×
          </button>
        </div>
      </div>
      {showReplace && (
        <div className="find-bar-row">
          <div className="find-input-group">
            <input
              ref={replaceInputRef}
              className="find-input"
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
          <div className="find-actions">
            <button className="find-replace-btn" onClick={handleReplace} disabled={matchCount === 0 || !query}>
              Replace
            </button>
            <button className="find-replace-btn" onClick={handleReplaceAll} disabled={matchCount === 0 || !query}>
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
