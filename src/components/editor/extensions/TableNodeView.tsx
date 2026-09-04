import React, { useState, useMemo } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { marked } from "marked";
import { Table as TableIcon, Edit3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TableNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const raw = (node.attrs.raw as string) || "";
  const [rawDraft, setRawDraft] = useState(raw);

  const html = useMemo(() => {
    try {
      return marked.parse(raw) as string;
    } catch {
      return "";
    }
  }, [raw]);

  const handleSave = () => {
    updateAttributes({ raw: rawDraft });
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper
      className={`snipnote-table-wrapper my-4 block select-none ${
        selected ? "ring-2 ring-primary/40 rounded-md" : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border border-b-0 rounded-t-md text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <TableIcon className="w-3.5 h-3.5" />
          <span>Table</span>
        </div>
        <div>
          {isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs flex items-center gap-1"
              onClick={handleSave}
            >
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Done</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs flex items-center gap-1"
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
      </div>

      {isEditing ? (
        <div className="border rounded-b-md p-2 bg-background">
          <textarea
            className="w-full font-mono text-xs p-2 rounded border bg-muted/20 resize-y focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px]"
            value={rawDraft}
            onChange={(e) => setRawDraft(e.target.value)}
          />
        </div>
      ) : (
        <div
          className="border rounded-b-md overflow-x-auto p-3 bg-card/60 snipnote-table-container"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
};
