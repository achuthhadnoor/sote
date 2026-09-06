import React, { useState, useMemo, useCallback } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Edit3, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/* =========================================================================
 * PREVIOUS IMPLEMENTATION (Custom Manual Table & Markdown Parser)
 * Preserved / commented as requested:
 *
 * import {
 *   Table,
 *   TableBody,
 *   TableCell,
 *   TableHead,
 *   TableHeader,
 *   TableRow,
 * } from "@/components/ui/table";
 *
 * function parseMarkdownTable(raw: string) { ... }
 * function renderInlineMarkdown(text: string) { ... }
 * ========================================================================= */

export const TableNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const raw = (node.attrs.raw as string) || "";
  const [rawDraft, setRawDraft] = useState(raw);
  const [copied, setCopied] = useState(false);

  // Use marked (already provided in the environment) to format markdown tables and all inline elements
  const html = useMemo(() => {
    try {
      return DOMPurify.sanitize(marked.parse(raw) as string, {
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "svg", "math"],
        FORBID_ATTR: ["style"],
        ALLOW_UNKNOWN_PROTOCOLS: false,
      });
    } catch {
      return "";
    }
  }, [raw]);

  const handleSave = useCallback(() => {
    updateAttributes({ raw: rawDraft });
    setIsEditing(false);
  }, [rawDraft, updateAttributes]);

  const handleCancel = useCallback(() => {
    setRawDraft(raw);
    setIsEditing(false);
  }, [raw]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = raw;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [raw]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  return (
    <NodeViewWrapper
      className={`not-prose snipnote-table-wrapper my-4 block select-none ${
        selected ? "ring-2 ring-primary/40 rounded-md" : ""
      }`}
    >
      <Card className="relative overflow-hidden border shadow-sm group">
        {/* Floating action buttons */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {!isEditing && raw && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1 bg-background/80 backdrop-blur-sm shadow-xs"
              onClick={handleCopy}
              title="Copy table markdown"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          )}
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs flex items-center gap-1 bg-background/80 backdrop-blur-sm shadow-xs"
              onClick={() => {
                setRawDraft(raw);
                setIsEditing(true);
              }}
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </Button>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="p-2 bg-background space-y-2">
            <Textarea
              className="w-full font-mono text-xs leading-5 resize-y focus-visible:ring-1 focus-visible:ring-primary min-h-[120px]"
              value={rawDraft}
              onChange={(e) => setRawDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={"| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |"}
              spellCheck={false}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘Enter</kbd> to save · <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to cancel
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-6 px-2 text-xs flex items-center gap-1"
                  onClick={handleSave}
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Done</span>
                </Button>
              </div>
            </div>
          </div>
        ) : html ? (
          <div
            className="overflow-x-auto p-3 bg-card/60 snipnote-table-container"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="p-4 text-center text-[13px] italic text-muted-foreground">
            Empty table. Click &ldquo;Edit&rdquo; to add markdown table syntax.
          </div>
        )}
      </Card>
    </NodeViewWrapper>
  );
};
