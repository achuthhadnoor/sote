import React, { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface RawEditorProps {
  value: string;
  onChange: (value: string) => void;
  spellCheck?: boolean;
}

export const RawEditor: React.FC<RawEditorProps> = ({
  value,
  onChange,
  spellCheck = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [currentLine, setCurrentLine] = useState(1);

  const lines = value.split("\n");
  const lineCount = lines.length;

  const updateCurrentLine = useCallback((ta: HTMLTextAreaElement) => {
    const selStart = ta.selectionStart;
    const textBeforeCursor = ta.value.substring(0, selStart);
    const lineNum = textBeforeCursor.split("\n").length;
    setCurrentLine(lineNum);
  }, []);

  const handleLineNumberClick = (lineIndex: number) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    let charPos = 0;
    for (let i = 0; i < lineIndex; i++) {
      charPos += lines[i].length + 1;
    }
    ta.focus();
    ta.setSelectionRange(charPos, charPos);
    updateCurrentLine(ta);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const spaces = "  ";
      const newVal = val.substring(0, start) + spaces + val.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + spaces.length;
        updateCurrentLine(ta);
      });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop += e.deltaY;
    }
  };

  // Sync scroll position on mount
  useEffect(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="raw-editor-container">
      {/* Line numbers gutter */}
      <div
        ref={gutterRef}
        className="raw-editor-gutter"
        style={{
          minWidth: `${Math.max(40, String(lineCount).length * 9 + 20)}px`,
        }}
        onWheel={handleWheel}
        aria-hidden="true"
      >
        {Array.from({ length: Math.max(1, lineCount) }, (_, i) => {
          const lineNum = i + 1;
          const isActive = lineNum === currentLine;
          return (
            <div
              key={lineNum}
              className={cn("raw-editor-line-num", isActive && "is-active")}
              onClick={() => handleLineNumberClick(i)}
              title={`Line ${lineNum}`}
            >
              {lineNum}
            </div>
          );
        })}
      </div>

      {/* Raw textarea */}
      <textarea
        ref={textareaRef}
        className="raw-editor"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          updateCurrentLine(e.currentTarget);
        }}
        onScroll={handleScroll}
        onSelect={(e) => updateCurrentLine(e.currentTarget)}
        onKeyUp={(e) => updateCurrentLine(e.currentTarget)}
        onClick={(e) => updateCurrentLine(e.currentTarget)}
        onKeyDown={handleKeyDown}
        placeholder="Raw markdown…"
        spellCheck={spellCheck}
        autoFocus
      />
    </div>
  );
};
