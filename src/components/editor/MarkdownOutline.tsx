import { useMemo, useState, useEffect, useCallback } from "react";
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

export const MarkdownOutline: React.FC<Props> = ({ editor, body, isRawMode }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const outline = useMemo(() => {
    if (!isRawMode && editor) {
      try {
        return extractFromEditor(editor);
      } catch {
        return extractFromMarkdown(body);
      }
    }
    return extractFromMarkdown(body);
  }, [editor, body, isRawMode, editor?.state.doc.content.size]);

  // Track active heading based on editor selection (rich mode)
  useEffect(() => {
    if (isRawMode || !editor || outline.length === 0) return;
    const updateActive = () => {
      const { from } = editor.state.selection;
      let current: OutlineItem | null = null;
      for (let i = 0; i < outline.length; i++) {
        if (outline[i].pos <= from) current = outline[i];
        else break;
      }
      setActiveId(current?.id ?? outline[0]?.id ?? null);
    };
    updateActive();
    editor.on("selectionUpdate", updateActive);
    editor.on("update", updateActive);
    return () => {
      editor.off("selectionUpdate", updateActive);
      editor.off("update", updateActive);
    };
  }, [editor, outline, isRawMode]);

  const handleClick = useCallback(
    (item: OutlineItem) => {
      if (isRawMode) {
        // scroll raw textarea to line
        const ta = document.querySelector(".raw-editor") as HTMLTextAreaElement | null;
        if (ta) {
          const lines = body.split("\n");
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
        setActiveId(item.id);
      }
    },
    [editor, body, isRawMode]
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
