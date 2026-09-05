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
      className={`outline-floating ${expanded ? "is-expanded" : ""}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Document outline"
    >
      {/* collapsed: horizontal dashes stacked vertically */}
      <div className="outline-dashes" aria-hidden={expanded}>
        {outline.map((item) => (
          <button
            key={item.id}
            className={`outline-dash level-${item.level} ${activeId === item.id ? "is-active" : ""}`}
            onClick={() => handleClick(item)}
            title={item.text}
            aria-label={item.text}
          />
        ))}
      </div>

      {/* expanded: titles */}
      <div className="outline-panel" role="navigation" aria-label="Headings">
        <div className="outline-panel-header">On this page</div>
        <div className="outline-panel-list">
          {outline.map((item) => (
            <button
              key={item.id}
              className={`outline-item level-${item.level} ${activeId === item.id ? "is-active" : ""}`}
              onClick={() => handleClick(item)}
              title={item.text}
            >
              <span className="outline-item-dash" aria-hidden="true" />
              <span className="outline-item-text">{item.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
