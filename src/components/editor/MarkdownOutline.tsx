import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  /** Line index in the active note markdown body. */
  line: number;
}

interface Props {
  editor: Editor | null;
  /** Active note markdown body (source of truth). */
  body: string;
  isRawMode: boolean;
  /** Active note path — resets outline when the tab changes. */
  notePath: string | null;
  /** Active note title shown in the panel header. */
  noteTitle?: string | null;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

/** Skip ATX headings inside fenced code blocks. Always from active note body. */
function extractFromMarkdown(body: string): OutlineItem[] {
  const lines = body.split("\n");
  const items: OutlineItem[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  let fenceMarker = "";

  lines.forEach((line, idx) => {
    const fence = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }
      return;
    }
    if (inFence) return;

    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (!m) return;
    const level = m[1].length;
    const text = m[2].trim().replace(/\s+#+\s*$/, "").trim();
    if (!text) return;
    const base = `${level}-${slugify(text) || "heading"}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    items.push({
      id: n === 1 ? base : `${base}-${n}`,
      level,
      text,
      line: idx,
    });
  });
  return items;
}

function sameOutline(a: OutlineItem[], b: OutlineItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].level !== b[i].level ||
      a[i].text !== b[i].text ||
      a[i].line !== b[i].line
    ) {
      return false;
    }
  }
  return true;
}

function findScrollRoot(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const marked = el.closest("[data-editor-scroll]") as HTMLElement | null;
  if (marked) return marked;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

function measureRawLineHeight(ta: HTMLTextAreaElement): number {
  const style = getComputedStyle(ta);
  const parsed = parseFloat(style.lineHeight);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const fontSize = parseFloat(style.fontSize) || 13;
  return fontSize * 1.6;
}

/** Heading DOM nodes in the rich editor, in document order. */
function getEditorHeadingEls(editor: Editor | null): HTMLElement[] {
  if (!editor || editor.isDestroyed) return [];
  const dom = editor.view?.dom;
  if (!dom) return [];
  return Array.from(dom.querySelectorAll("h1, h2, h3, h4")) as HTMLElement[];
}

/** ProseMirror positions for headings, in document order. */
function getEditorHeadingPositions(editor: Editor | null): number[] {
  if (!editor || editor.isDestroyed) return [];
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true;
    const level = node.attrs.level as number;
    if (level < 1 || level > 4) return true;
    if (!node.textContent.trim()) return true;
    positions.push(pos);
    return true;
  });
  return positions;
}

export const MarkdownOutline: React.FC<Props> = ({
  editor,
  body,
  isRawMode,
  notePath,
  noteTitle,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<OutlineItem[]>([]);
  const bodyRef = useRef(body);
  const closeTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const notePathRef = useRef(notePath);

  bodyRef.current = body;
  activeIdRef.current = activeId;

  // Reset when the active note changes.
  useEffect(() => {
    if (notePathRef.current === notePath) return;
    notePathRef.current = notePath;
    setExpanded(false);
    setActiveId(null);
    outlineRef.current = [];
    setOutline([]);
  }, [notePath]);

  // Outline always comes from the active note body — never a stale TipTap doc.
  useEffect(() => {
    const items = extractFromMarkdown(body);
    if (!sameOutline(outlineRef.current, items)) {
      outlineRef.current = items;
      setOutline(items);
    }
  }, [body, notePath]);

  // Keep activeId valid for the current outline.
  useEffect(() => {
    if (outline.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !outline.some((item) => item.id === activeId)) {
      setActiveId(outline[0].id);
    }
  }, [outline, activeId]);

  // Scroll-spy against the active note's headings in the viewport.
  useEffect(() => {
    if (outline.length === 0) return;

    let scrollRoot: HTMLElement | null = null;
    let ta: HTMLTextAreaElement | null = null;
    let attached = false;

    const pickFromScroll = () => {
      const list = outlineRef.current;
      if (list.length === 0) return;

      let nextId: string | null = list[0].id;

      if (!isRawMode && editor && !editor.isDestroyed) {
        const root = scrollRoot ?? findScrollRoot(rootRef.current);
        const markerY = (root?.getBoundingClientRect().top ?? 0) + 88;
        const headingEls = getEditorHeadingEls(editor);
        // Prefer DOM rects (stable); fall back to index 0 if editor not painted yet.
        if (headingEls.length > 0) {
          let idx = 0;
          const limit = Math.min(headingEls.length, list.length);
          for (let i = 0; i < limit; i++) {
            if (headingEls[i].getBoundingClientRect().top <= markerY) idx = i;
            else break;
          }
          nextId = list[idx]?.id ?? list[0].id;
        }
      } else {
        const raw =
          ta ?? (document.querySelector("textarea.raw-editor") as HTMLTextAreaElement | null);
        if (raw) {
          const lineHeight = measureRawLineHeight(raw);
          const topLine = Math.max(0, Math.floor((raw.scrollTop + 40) / lineHeight));
          for (const item of list) {
            if (item.line <= topLine) nextId = item.id;
            else break;
          }
        }
      }

      if (nextId && nextId !== activeIdRef.current) {
        setActiveId(nextId);
      }
    };

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        pickFromScroll();
      });
    };

    const attachTimer = window.setTimeout(() => {
      scrollRoot = findScrollRoot(rootRef.current);
      ta = document.querySelector("textarea.raw-editor") as HTMLTextAreaElement | null;
      pickFromScroll();
      scrollRoot?.addEventListener("scroll", onScroll, { passive: true });
      ta?.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      attached = true;
    }, 0);

    // Re-run spy when TipTap finishes rendering the active note.
    const onEditorUpdate = () => onScroll();
    if (!isRawMode && editor && !editor.isDestroyed) {
      editor.on("update", onEditorUpdate);
    }

    return () => {
      window.clearTimeout(attachTimer);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (attached) {
        scrollRoot?.removeEventListener("scroll", onScroll);
        ta?.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
      if (!isRawMode && editor && !editor.isDestroyed) {
        editor.off("update", onEditorUpdate);
      }
    };
  }, [editor, isRawMode, outline, notePath]);

  useLayoutEffect(() => {
    if (!expanded || !activeId || !listRef.current) return;
    const row = listRef.current.querySelector(
      `[data-outline-id="${CSS.escape(activeId)}"]`
    ) as HTMLElement | null;
    row?.scrollIntoView({ block: "nearest" });
  }, [activeId, expanded]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPanel = () => {
    clearCloseTimer();
    setExpanded(true);
  };

  const scheduleClosePanel = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setExpanded(false);
      closeTimerRef.current = null;
    }, 160);
  };

  useEffect(() => () => clearCloseTimer(), []);

  const handleClick = useCallback(
    (item: OutlineItem, index: number) => {
      setActiveId(item.id);
      clearCloseTimer();
      setExpanded(true);

      if (isRawMode) {
        const ta = document.querySelector("textarea.raw-editor") as HTMLTextAreaElement | null;
        if (!ta) return;
        const lines = bodyRef.current.split("\n");
        let charPos = 0;
        for (let i = 0; i < item.line && i < lines.length; i++) {
          charPos += lines[i].length + 1;
        }
        const lineHeight = measureRawLineHeight(ta);
        ta.focus();
        ta.setSelectionRange(charPos, charPos);
        ta.scrollTop = Math.max(0, item.line * lineHeight - 72);
        return;
      }

      if (!editor || editor.isDestroyed) return;

      const headingEls = getEditorHeadingEls(editor);
      const el = headingEls[index];
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }

      const positions = getEditorHeadingPositions(editor);
      const pos = positions[index];
      if (typeof pos === "number") {
        const sel = Math.min(pos + 1, editor.state.doc.content.size);
        editor.chain().focus().setTextSelection(sel).run();
      }
    },
    [editor, isRawMode]
  );

  if (outline.length === 0) return null;

  const headerLabel = (noteTitle && noteTitle.trim()) || "On this page";

  return (
    <div
      ref={rootRef}
      className="fixed right-3 top-1/2 z-30 -translate-y-1/2 flex items-center gap-2 py-2 pl-2 pointer-events-auto"
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClosePanel}
      aria-label={`Outline for ${headerLabel}`}
    >
      <div
        className={cn(
          "outline-panel flex flex-col max-h-[60vh] overflow-hidden border border-border-translucent rounded-[var(--radius-md)] transition-all duration-200 ease-out origin-right",
          expanded
            ? "w-[260px] opacity-100 translate-x-0"
            : "w-0 opacity-0 translate-x-2 pointer-events-none border-transparent"
        )}
        role="navigation"
        aria-label="Headings"
        aria-hidden={!expanded}
      >
        <div className="px-3 pt-2.5 pb-2 border-b border-border-translucent shrink-0 min-w-[248px]">
          <div className="type-label font-semibold text-foreground truncate" title={headerLabel}>
            {headerLabel}
          </div>
          <div className="type-meta tracking-wider uppercase mt-0.5">On this page</div>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5 min-w-[248px]">
          {outline.map((item, index) => {
            const isActive = activeId === item.id;
            const indentClass =
              item.level === 1
                ? "pl-2 font-medium type-chrome"
                : item.level === 2
                ? "pl-4 type-label"
                : item.level === 3
                ? "pl-6 type-label opacity-90"
                : "pl-8 type-meta opacity-90";

            return (
              <button
                key={`${notePath ?? "note"}:${item.id}`}
                type="button"
                data-outline-id={item.id}
                className={cn(
                  "flex items-center gap-2 w-full text-left py-1.5 pr-2 rounded-md border border-transparent leading-snug cursor-pointer transition-colors duration-100",
                  indentClass,
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted-translucent hover:text-foreground hover:border-border-translucent"
                )}
                onClick={() => handleClick(item, index)}
                title={item.text}
                aria-current={isActive ? "true" : undefined}
              >
                <span
                  className={cn(
                    "w-2.5 h-[2px] rounded-full shrink-0",
                    isActive ? "bg-accent-foreground opacity-100" : "bg-current opacity-40"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate flex-1 min-w-0">{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="flex flex-col items-end gap-2 p-2 bg-bg-translucent border border-border-translucent rounded-full backdrop-blur-md shadow-xs shrink-0"
        aria-hidden={expanded}
      >
        {outline.map((item, index) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={`${notePath ?? "note"}:${item.id}:dash`}
              type="button"
              className={cn(
                "h-[2px] rounded-full bg-muted-foreground border-0 cursor-pointer p-0 shrink-0 transition-all duration-150 hover:opacity-100 hover:bg-foreground hover:scale-x-110",
                isActive
                  ? "w-5 h-[2.5px] bg-accent opacity-100"
                  : item.level === 1
                  ? "w-[18px] opacity-60"
                  : item.level === 2
                  ? "w-3 opacity-50"
                  : item.level === 3
                  ? "w-2 opacity-45"
                  : "w-1.5 opacity-40"
              )}
              onClick={() => handleClick(item, index)}
              title={item.text}
              aria-label={item.text}
              aria-current={isActive ? "true" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};
