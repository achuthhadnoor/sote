import React, { useState, useRef, useEffect, useCallback } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Link as LinkIcon,
  Unlink,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorBubbleMenuProps {
  editor: Editor | null;
  isRawMode?: boolean;
}

export const EditorBubbleMenu: React.FC<EditorBubbleMenuProps> = ({
  editor,
  isRawMode = false,
}) => {
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Focus link input when entering link mode
  useEffect(() => {
    if (isLinkMode) {
      const timer = setTimeout(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isLinkMode]);

  // Keyboard shortcut: Cmd+K / Ctrl+K toggles link mode when text is selected
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        const { selection } = editor.state;
        if (!selection.empty) {
          e.preventDefault();
          const currentHref = editor.getAttributes("link").href || "";
          setLinkUrl(currentHref);
          setIsLinkMode(true);
        }
      }
    };
    dom.addEventListener("keydown", handleKeyDown);
    return () => dom.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  // Reset link mode if selection collapses
  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => {
      if (editor.state.selection.empty && isLinkMode) {
        setIsLinkMode(false);
      }
    };
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor, isLinkMode]);

  const shouldShow = useCallback(
    ({ editor: ed, state, from, to }: any) => {
      if (isRawMode) return false;
      if (!ed || !ed.isEditable) return false;
      if (isLinkMode) return true;

      // Selection must be non-empty text
      const { selection, doc } = state;
      if (selection.empty || from === to) return false;

      const text = doc.textBetween(from, to, " ");
      if (!text || text.trim().length === 0) return false;

      // Hide inside code blocks or images
      if (
        ed.isActive("codeBlock") ||
        ed.isActive("customCodeBlock") ||
        ed.isActive("image")
      ) {
        return false;
      }

      return true;
    },
    [isRawMode, isLinkMode]
  );

  if (!editor || isRawMode) return null;

  const handleApplyLink = () => {
    let target = linkUrl.trim();
    if (!target) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      if (/^www\./i.test(target)) {
        target = `https://${target}`;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: target }).run();
    }
    setIsLinkMode(false);
  };

  const handleRemoveLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkMode(false);
  };

  const handleLinkInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyLink();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsLinkMode(false);
      editor.commands.focus();
    }
  };

  const isLinkActive = editor.isActive("link");

  const preventMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const itemClass = (active: boolean) =>
    cn(
      "relative flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer select-none",
      active
        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
    );

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={80}
      shouldShow={shouldShow}
      className="snipnote-bubble-menu ui-surface flex items-center gap-0.5 p-1 border z-50 animate-in fade-in zoom-in-95 duration-100"
    >
      {isLinkMode ? (
        <div className="flex items-center gap-1.5 px-1 py-0.5">
          <LinkIcon className="w-3.5 h-3.5 text-muted-foreground ml-0.5 shrink-0" />
          <input
            ref={linkInputRef}
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkInputKeyDown}
            placeholder="URL or markdown path..."
            className="h-6.5 w-52 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden border border-border/70 rounded-md focus:border-primary/80"
          />
          <button
            type="button"
            onClick={handleApplyLink}
            title="Apply (Enter)"
            className="h-6.5 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center gap-1 cursor-pointer transition-opacity"
          >
            <Check className="w-3 h-3" />
            <span>Apply</span>
          </button>
          {isLinkActive && (
            <button
              type="button"
              onClick={handleRemoveLink}
              title="Remove link"
              className="h-6.5 w-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer transition-colors"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsLinkMode(false)}
            title="Cancel (Esc)"
            className="h-6.5 w-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* Block type / Headings */}
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={itemClass(editor.isActive("paragraph") && !editor.isActive("heading"))}
            title="Paragraph"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={itemClass(editor.isActive("heading", { level: 1 }))}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={itemClass(editor.isActive("heading", { level: 2 }))}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={itemClass(editor.isActive("heading", { level: 3 }))}
            title="Heading 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          {/* Divider */}
          <div className="w-[1px] h-3.5 bg-border/80 mx-0.5" />

          {/* Inline marks: Bold, Italic, Strike, Code */}
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={itemClass(editor.isActive("bold"))}
            title="Bold (⌘B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={itemClass(editor.isActive("italic"))}
            title="Italic (⌘I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={itemClass(editor.isActive("strike"))}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={itemClass(editor.isActive("code"))}
            title="Inline Code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          {/* Divider */}
          <div className="w-[1px] h-3.5 bg-border/80 mx-0.5" />

          {/* Link */}
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => {
              const currentHref = editor.getAttributes("link").href || "";
              setLinkUrl(currentHref);
              setIsLinkMode(true);
            }}
            className={itemClass(isLinkActive)}
            title="Link (⌘K)"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>

          {/* Divider */}
          <div className="w-[1px] h-3.5 bg-border/80 mx-0.5" />

          {/* Lists & Quote */}
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={itemClass(editor.isActive("bulletList"))}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={itemClass(editor.isActive("orderedList"))}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={itemClass(editor.isActive("taskList"))}
            title="Task List"
          >
            <ListTodo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={preventMouseDown}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={itemClass(editor.isActive("blockquote"))}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </BubbleMenu>
  );
};
