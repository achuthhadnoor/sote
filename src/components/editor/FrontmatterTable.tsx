import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import {
  parseYamlFrontmatter,
  serializeYamlFrontmatter,
  FrontmatterProperty,
} from "../../utils/frontmatterParser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FrontmatterTableProps {
  onAutoSaveTrigger?: () => void;
}

function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return ref;
}

const AutoResizeTextarea: React.FC<
  React.ComponentProps<typeof Textarea>
> = ({ value, className, ...props }) => {
  const ref = useAutoResizeTextarea(String(value ?? ""));

  return (
    <Textarea
      {...props}
      ref={ref}
      value={value}
      rows={1}
      className={cn(
        "frontmatter-textarea min-h-0 overflow-hidden resize-none border-0 bg-transparent px-1 py-0.5 shadow-none leading-5",
        "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none",
        className
      )}
    />
  );
};

export const FrontmatterTable: React.FC<FrontmatterTableProps> = ({
  onAutoSaveTrigger,
}) => {
  const frontmatter = useEditorStore((state) => state.frontmatter);
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "raw">("table");
  const [rawText, setRawText] = useState(frontmatter || "");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isAddingProperty, setIsAddingProperty] = useState(false);

  useEffect(() => {
    setRawText(frontmatter || "");
  }, [frontmatter]);

  const properties = useMemo(() => {
    return parseYamlFrontmatter(frontmatter || "");
  }, [frontmatter]);

  const handleUpdateProperties = (
    updated: FrontmatterProperty[],
    triggerSave = true
  ) => {
    const yamlStr = serializeYamlFrontmatter(updated);
    updateFrontmatter(yamlStr ? yamlStr : null);
    if (triggerSave && onAutoSaveTrigger) {
      onAutoSaveTrigger();
    }
  };

  const handleValueChange = (index: number, val: any) => {
    const next = [...properties];
    next[index] = { ...next[index], value: val };
    handleUpdateProperties(next);
  };

  const handleToggleBoolean = (index: number) => {
    const next = [...properties];
    next[index] = { ...next[index], value: !next[index].value, type: "boolean" };
    handleUpdateProperties(next);
  };

  const handleDeleteProperty = (index: number) => {
    const next = properties.filter((_, i) => i !== index);
    handleUpdateProperties(next);
  };

  const handleAddListItem = (index: number, itemText: string) => {
    if (!itemText.trim()) return;
    const next = [...properties];
    const currentList = Array.isArray(next[index].value) ? next[index].value : [];
    next[index] = {
      ...next[index],
      value: [...currentList, itemText.trim()],
      type: "list",
    };
    handleUpdateProperties(next);
  };

  const handleRemoveListItem = (propIndex: number, itemIndex: number) => {
    const next = [...properties];
    const currentList = Array.isArray(next[propIndex].value)
      ? next[propIndex].value
      : [];
    next[propIndex] = {
      ...next[propIndex],
      value: currentList.filter((_, i) => i !== itemIndex),
    };
    handleUpdateProperties(next);
  };

  const handleAddNewProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;

    let parsedVal: any = newValue.trim();
    let type: FrontmatterProperty["type"] = "string";

    if (parsedVal === "true") {
      parsedVal = true;
      type = "boolean";
    } else if (parsedVal === "false") {
      parsedVal = false;
      type = "boolean";
    } else if (!isNaN(Number(parsedVal)) && parsedVal !== "") {
      parsedVal = Number(parsedVal);
      type = "number";
    } else if (parsedVal.startsWith("[") && parsedVal.endsWith("]")) {
      parsedVal = parsedVal
        .slice(1, -1)
        .split(",")
        .map((s: string) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      type = "list";
    }

    const next: FrontmatterProperty[] = [
      ...properties,
      { key: newKey.trim(), value: parsedVal, type },
    ];
    handleUpdateProperties(next);
    setNewKey("");
    setNewValue("");
    setIsAddingProperty(false);
  };

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    updateFrontmatter(text.trim() ? text : null);
    if (onAutoSaveTrigger) {
      onAutoSaveTrigger();
    }
  };

  const handleInitFrontmatter = () => {
    const initial = `title: Untitled\ntags: []\nstatus: draft`;
    updateFrontmatter(initial);
    if (onAutoSaveTrigger) {
      onAutoSaveTrigger();
    }
  };

  if (!frontmatter && properties.length === 0) {
    return (
      <div className="mb-3 flex">
        <Button variant="outline" size="sm" onClick={handleInitFrontmatter} className="border-dashed type-label h-7 bg-transparent">
          <Plus className="mr-1 h-3 w-3" /> Add Properties
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-4 overflow-hidden border-0 bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 bg-transparent px-0 py-2">
        <button
          className="flex items-center gap-2 type-chrome font-medium hover:text-foreground transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          Properties
          <Badge variant="outline" className="ml-1 border-border-translucent bg-transparent px-1.5 py-0 type-meta">
            {properties.length}
          </Badge>
        </button>

        {!isCollapsed && (
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-6 px-2 type-meta",
                viewMode === "table" && "bg-transparent border border-border-translucent shadow-none"
              )}
              onClick={() => setViewMode("table")}
            >
              Table
            </Button>
            <Button
              variant={viewMode === "raw" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-6 px-2 type-meta",
                viewMode === "raw" && "bg-transparent border border-border-translucent shadow-none"
              )}
              onClick={() => setViewMode("raw")}
            >
              Raw YAML
            </Button>
            {viewMode === "table" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 type-meta ml-1 border border-dashed border-border-translucent bg-transparent"
                onClick={() => setIsAddingProperty(!isAddingProperty)}
              >
                {isAddingProperty ? "Cancel" : "+ Add"}
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-0">
          {viewMode === "raw" ? (
            <Textarea
              className="frontmatter-textarea frontmatter-raw-textarea min-h-[120px] w-full rounded-none border-0 bg-transparent font-mono text-[13px] leading-[1.6] shadow-none focus-visible:ring-0 p-3 outline-none"
              value={rawText}
              onChange={handleRawChange}
              placeholder="key: value..."
              rows={Math.max(4, rawText.split("\n").length + 1)}
              spellCheck={false}
            />
          ) : (
            <>
              <Table className="type-label">
                <TableBody>
                  {properties.map((prop, idx) => (
                    <TableRow key={`${prop.key}-${idx}`} className="border-0 hover:bg-transparent">
                      <TableCell className="w-[160px] max-w-[200px] bg-transparent p-2 align-top">
                        <span className="type-meta font-medium truncate block" title={prop.key}>
                          {prop.key}
                        </span>
                      </TableCell>
                      <TableCell className="bg-transparent p-2 align-middle">
                        <PropertyValueRenderer
                          prop={prop}
                          onUpdate={(newVal) => handleValueChange(idx, newVal)}
                          onToggleBoolean={() => handleToggleBoolean(idx)}
                          onAddListItem={(item) => handleAddListItem(idx, item)}
                          onRemoveListItem={(itemIdx) =>
                            handleRemoveListItem(idx, itemIdx)
                          }
                        />
                      </TableCell>
                      <TableCell className="w-[36px] bg-transparent p-1 text-center align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-60 hover:opacity-100 hover:bg-transparent hover:text-destructive"
                          onClick={() => handleDeleteProperty(idx)}
                          title={`Delete ${prop.key}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {isAddingProperty && (
                <form
                  className="flex gap-2 bg-transparent p-2"
                  onSubmit={handleAddNewProperty}
                >
                  <AutoResizeTextarea
                    placeholder="Property name"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="w-[150px] font-mono text-[13px] leading-[1.6] outline-none"
                    autoFocus
                  />
                  <AutoResizeTextarea
                    placeholder="Value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="flex-1 font-mono text-[13px] leading-[1.6] outline-none"
                  />
                  <Button type="submit" size="sm" className="h-7 px-3 type-label">
                    Add
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

interface PropertyValueRendererProps {
  prop: FrontmatterProperty;
  onUpdate: (val: any) => void;
  onToggleBoolean: () => void;
  onAddListItem: (item: string) => void;
  onRemoveListItem: (index: number) => void;
}

const PropertyValueRenderer: React.FC<PropertyValueRendererProps> = ({
  prop,
  onUpdate,
  onToggleBoolean,
  onAddListItem,
  onRemoveListItem,
}) => {
  const [textDraft, setTextDraft] = useState(String(prop.value ?? ""));
  const [newChipText, setNewChipText] = useState("");

  useEffect(() => {
    setTextDraft(String(prop.value ?? ""));
  }, [prop.value]);

  const commitText = (raw: string) => {
    if (prop.type === "number" && raw.trim() !== "" && !isNaN(Number(raw))) {
      onUpdate(Number(raw));
    } else {
      onUpdate(raw);
    }
  };

  if (prop.type === "boolean" || typeof prop.value === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch checked={!!prop.value} onCheckedChange={onToggleBoolean} />
        <span className="font-mono text-[13px] leading-[1.6]">{prop.value ? "true" : "false"}</span>
      </div>
    );
  }

  if (Array.isArray(prop.value)) {
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {prop.value.map((item, i) => (
          <Badge
            key={i}
            variant="outline"
            className="gap-1 border-border-translucent bg-transparent pr-1 type-meta"
          >
            <span>{String(item)}</span>
            <button
              type="button"
              className="ml-1 rounded-full p-0.5 hover:bg-muted-translucent"
              onClick={() => onRemoveListItem(i)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <AutoResizeTextarea
          className="w-[100px] font-mono text-[13px] leading-[1.6] outline-none"
          value={newChipText}
          onChange={(e) => setNewChipText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (newChipText.trim()) {
                onAddListItem(newChipText);
                setNewChipText("");
              }
            }
          }}
          onBlur={() => {
            if (newChipText.trim()) {
              onAddListItem(newChipText);
              setNewChipText("");
            }
          }}
          placeholder="+ item"
        />
      </div>
    );
  }

  if (typeof prop.value === "object" && prop.value !== null) {
    return (
      <div className="flex flex-col gap-1">
        {Object.entries(prop.value).map(([subK, subV]) => (
          <div key={subK} className="flex items-start gap-1.5">
            <span className="shrink-0 pt-0.5 type-meta font-medium">
              {subK}:
            </span>
            <AutoResizeTextarea
              className="font-mono text-[13px] leading-[1.6] outline-none"
              value={String(subV ?? "")}
              onChange={(e) => {
                onUpdate({ ...prop.value, [subK]: e.target.value });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <AutoResizeTextarea
      className="font-mono text-[13px] leading-[1.6] outline-none"
      value={textDraft}
      onChange={(e) => setTextDraft(e.target.value)}
      onBlur={() => commitText(textDraft)}
      placeholder="empty"
    />
  );
};
