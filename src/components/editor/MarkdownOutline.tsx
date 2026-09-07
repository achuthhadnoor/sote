import { useState, useEffect, useCallback, useRef } from "react";
import { Editor } from "@tiptap/react";

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  pos: number; // ProseMirror pos for rich, line index for raw
}

interface Props {
  editor: Editor | null;
  body: string;
  isRawMode: boolean;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function extractFromEditor(editor: Editor): OutlineItem[] {
  const items: OutlineItem[] = [];
  const doc = editor.state.doc;
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level as number;
      if (level >= 1 && level <= 4) {
        const text = node.textContent.trim();
        if (text) {
          items.push({
            id: `${slugify(text)}-${pos}`,
            level,
            text,
            pos,
          });
        }
      }
    }
    return true;
  });
  return items;
}

function extractFromMarkdown(body: string): OutlineItem[] {
  const lines = body.split("\n");
  const items: OutlineItem[] = [];
  lines.forEach((line, idx) => {
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim().replace(/\s+#+\s*$/, "").trim();
      if (text) {
        items.push({
          id: `${slugify(text)}-raw-${idx}`,
          level,
          text,
          pos: idx, // line index for raw
        });
      }
    }
  });
  return items;
}

function sameOutline(a: OutlineItem[], b: OutlineItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].level !== b[i].level || a[i].text !== b[i].text) return false;
  }
  return true;
}

export const MarkdownOutline: React.FC<Props> = ({ editor, body, isRawMode }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // Latest values for stable subscriptions (avoids re-subscribing per keystroke).
  const outlineRef = useRef<OutlineItem[]>([]);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  // Recompute the outline whenever content/editor changes, but only trigger a
  // re-render when the headings actually changed (typing body text usually
  // doesn't). The walks below are cheap; the re-render + resubscribe churn
  // they used to cause on every keystroke was the perf problem.
  useEffect(() => {
    let items: OutlineItem[];
    if (!isRawMode && editor) {
      try {
        items = extractFromEditor(editor);
      } catch {
        items = extractFromMarkdown(body);
      }
    } else {
      items = extractFromMarkdown(body);
    }
    if (!sameOutline(outlineRef.current, items)) {
      outlineRef.current = items;
      setOutline(items);
    }
  }, [editor, body, isRawMode]);

  // Track active heading based on editor selection (rich mode). Subscribed
  // once per editor — never torn down by typing.
  useEffect(() => {
    if (isRawMode || !editor) return;
    const updateActive = () => {
      const items = outlineRef.current;
      if (items.length === 0) return;
      const { from } = editor.state.selection;
      let current: OutlineItem | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].pos <= from) current = items[i];
        else break;
      }
      const next = current?.id ?? items[0]?.id ?? null;
      setActiveId((prev) => (prev === next ? prev : next));
    };
    updateActive();
    editor.on("selectionUpdate", updateActive);
    editor.on("update", updateActive);
    return () => {
      editor.off("selectionUpdate", updateActive);
      editor.off("update", updateActive);
    };
  }, [editor, isRawMode]);

  const handleClick = useCallback(
    (item: OutlineItem) => {
      if (isRawMode) {
        // scroll raw textarea to line
        const ta = document.querySelector(".raw-editor") as HTMLTextAreaElement | null;
        if (ta) {
          const lines = bodyRef.current.split("\n");
          let charPos = 0;
          for (let i = 0; i < item.pos; i++) charPos += lines[i].length + 1;
          ta.focus();
          ta.setSelectionRange(charPos, charPos);
          // approximate scroll: lineHeight ~20.8px (13px *1.6)
          const lineHeight = 20.8;
          ta.scrollTop = Math.max(0, item.pos * lineHeight - 80);
        }
      } else if (editor) {
        editor.chain().focus().setTextSelection(item.pos).scrollIntoView().run();
        setActiveId((prev) => (prev === item.id ? prev : item.id));
      }
    },
    [editor, isRawMode]
  );

  if (outline.length === 0) return null;

  return (
    <div
      className="fixed right-3 top-1/2 -translate-y-1/2 flex items-center z-10 py-3 pl-3 pointer-events-auto group"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Document outline"
    >
      {/* collapsed: horizontal dashes stacked vertically */}
      <div
        className={`flex flex-col items-end gap-2 p-2 bg-bg-translucent border border-border-translucent rounded-full backdrop-blur-md shadow-xs transition-all duration-150 ${
          expanded ? "opacity-0 translate-x-2 pointer-events-none" : "opacity-100 translate-x-0"
        }`}
        aria-hidden={expanded}
      >
        {outline.map((item) => {
          const isActive = activeId === item.id;
          const widthClass =
            isActive
              ? "w-5 h-[2.5px] bg-accent opacity-100"
              : item.level === 1
              ? "w-[18px] opacity-60"
              : item.level === 2
              ? "w-3 opacity-50"
              : item.level === 3
              ? "w-2 opacity-45"
              : "w-1.5 opacity-40";

          return (
            <button
              key={item.id}
              className={`h-[2px] rounded-full bg-muted-foreground border-0 cursor-pointer p-0 shrink-0 transition-all duration-150 hover:opacity-100 hover:bg-foreground hover:scale-x-110 ${widthClass}`}
              onClick={() => handleClick(item)}
              title={item.text}
              aria-label={item.text}
            />
          );
        })}
      </div>

      {/* expanded: titles panel */}
      <div
        className={`outline-panel absolute right-0 top-1/2 -translate-y-1/2 max-h-[60vh] overflow-hidden border flex flex-col transition-all duration-200 ease-out rounded-[var(--radius-md)] ${
          expanded
            ? "w-[260px] opacity-100 pointer-events-auto translate-x-0"
            : "w-0 opacity-0 pointer-events-none translate-x-2"
        }`}
        role="navigation"
        aria-label="Headings"
      >
        <div className="px-3 pt-2.5 pb-2 type-label font-semibold tracking-wider uppercase text-muted-foreground border-b border-border-translucent shrink-0">
          On this page
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
          {outline.map((item) => {
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
                key={item.id}
                className={`flex items-center gap-2 w-full text-left py-1.5 pr-2 rounded-md border border-transparent leading-snug cursor-pointer transition-colors duration-100 ${indentClass} ${
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted-translucent hover:text-foreground hover:border-border-translucent"
                }`}
                onClick={() => handleClick(item)}
                title={item.text}
              >
                <span
                  className={`w-2.5 h-[2px] rounded-full shrink-0 ${
                    isActive ? "bg-accent-foreground opacity-100" : "bg-current opacity-40"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate flex-1 min-w-0">{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
