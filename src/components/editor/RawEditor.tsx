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
    <div className="w-full min-h-[480px] flex-1 flex bg-background border border-border rounded-lg overflow-hidden transition-all duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      {/* Line numbers gutter */}
      <div
        ref={gutterRef}
        className="select-none shrink-0 py-3.5 pl-2 pr-2.5 font-mono text-[13px] leading-relaxed text-right border-r border-border-translucent bg-muted-translucent overflow-hidden text-muted-foreground"
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
              className={cn(
                "cursor-pointer leading-relaxed transition-colors duration-100 hover:text-foreground",
                isActive ? "text-foreground font-semibold opacity-100" : "opacity-45"
              )}
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
        className="flex-1 w-full min-h-[480px] font-mono text-[13px] leading-relaxed text-foreground bg-transparent border-0 rounded-none p-3.5 resize-none outline-hidden whitespace-pre overflow-auto tab-2"
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
