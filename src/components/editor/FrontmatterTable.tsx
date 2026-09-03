import React, { useState, useMemo, useEffect } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import {
  parseYamlFrontmatter,
  serializeYamlFrontmatter,
  FrontmatterProperty,
} from "../../utils/frontmatterParser";

interface FrontmatterTableProps {
  onAutoSaveTrigger?: () => void;
}

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

  // Sync rawText whenever store frontmatter changes from outside
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
      <div className="frontmatter-add-banner">
        <button
          type="button"
          className="btn-add-frontmatter"
          onClick={handleInitFrontmatter}
          title="Add YAML metadata properties to this note"
        >
          + Add Properties
        </button>
      </div>
    );
  }

  return (
    <div className="frontmatter-container">
      <div className="frontmatter-header">
        <div
          className="frontmatter-title-group"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="frontmatter-collapse-icon">
            {isCollapsed ? "▶" : "▼"}
          </span>
          <span className="frontmatter-title">Properties</span>
          <span className="frontmatter-count-badge">{properties.length}</span>
        </div>

        <div className="frontmatter-header-actions">
          {!isCollapsed && (
            <>
              <button
                type="button"
                className={`frontmatter-tab-btn ${
                  viewMode === "table" ? "active" : ""
                }`}
                onClick={() => setViewMode("table")}
              >
                Table
              </button>
              <button
                type="button"
                className={`frontmatter-tab-btn ${
                  viewMode === "raw" ? "active" : ""
                }`}
                onClick={() => setViewMode("raw")}
              >
                Raw YAML
              </button>

              {viewMode === "table" && (
                <button
                  type="button"
                  className="frontmatter-action-btn"
                  onClick={() => setIsAddingProperty(!isAddingProperty)}
                >
                  {isAddingProperty ? "Cancel" : "+ Add"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="frontmatter-body">
          {viewMode === "raw" ? (
            <textarea
              className="frontmatter-raw-textarea"
              value={rawText}
              onChange={handleRawChange}
              placeholder="key: value..."
              rows={Math.max(4, rawText.split("\n").length + 1)}
              spellCheck={false}
            />
          ) : (
            <div className="frontmatter-table-wrapper">
              <table className="frontmatter-table">
                <tbody>
                  {properties.map((prop, idx) => (
                    <tr key={`${prop.key}-${idx}`} className="frontmatter-row">
                      <td className="frontmatter-key-cell">
                        <span className="frontmatter-key-label" title={prop.key}>
                          {prop.key}
                        </span>
                      </td>
                      <td className="frontmatter-val-cell">
                        <PropertyValueRenderer
                          prop={prop}
                          onUpdate={(newVal) => handleValueChange(idx, newVal)}
                          onToggleBoolean={() => handleToggleBoolean(idx)}
                          onAddListItem={(item) => handleAddListItem(idx, item)}
                          onRemoveListItem={(itemIdx) =>
                            handleRemoveListItem(idx, itemIdx)
                          }
                        />
                      </td>
                      <td className="frontmatter-action-cell">
                        <button
                          type="button"
                          className="frontmatter-del-btn"
                          onClick={() => handleDeleteProperty(idx)}
                          title={`Delete ${prop.key}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isAddingProperty && (
                <form
                  className="frontmatter-new-prop-form"
                  onSubmit={handleAddNewProperty}
                >
                  <input
                    type="text"
                    className="frontmatter-input frontmatter-input-key"
                    placeholder="Property name (e.g. tags, author)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="frontmatter-input frontmatter-input-val"
                    placeholder="Value (e.g. 'Draft', '[a, b]', 'true', '42')"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                  <button type="submit" className="frontmatter-submit-btn">
                    Add
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
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
  const [isEditingText, setIsEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState(String(prop.value ?? ""));
  const [newChipText, setNewChipText] = useState("");
  const [isAddingChip, setIsAddingChip] = useState(false);

  useEffect(() => {
    setTextDraft(String(prop.value ?? ""));
  }, [prop.value]);

  // Boolean Toggle
  if (prop.type === "boolean" || typeof prop.value === "boolean") {
    return (
      <button
        type="button"
        className={`frontmatter-boolean-toggle ${
          prop.value ? "is-true" : "is-false"
        }`}
        onClick={onToggleBoolean}
      >
        <span className="toggle-dot" />
        <span className="toggle-text">{prop.value ? "true" : "false"}</span>
      </button>
    );
  }

  // Array / List representation as Chips
  if (Array.isArray(prop.value)) {
    return (
      <div className="frontmatter-chip-list">
        {prop.value.map((item, i) => (
          <span key={i} className="frontmatter-chip">
            <span className="chip-text">{String(item)}</span>
            <button
              type="button"
              className="chip-remove-btn"
              onClick={() => onRemoveListItem(i)}
            >
              ×
            </button>
          </span>
        ))}

        {isAddingChip ? (
          <input
            type="text"
            className="frontmatter-chip-input"
            value={newChipText}
            onChange={(e) => setNewChipText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newChipText.trim()) {
                  onAddListItem(newChipText);
                  setNewChipText("");
                  setIsAddingChip(false);
                }
              } else if (e.key === "Escape") {
                setIsAddingChip(false);
                setNewChipText("");
              }
            }}
            onBlur={() => {
              if (newChipText.trim()) {
                onAddListItem(newChipText);
              }
              setIsAddingChip(false);
              setNewChipText("");
            }}
            placeholder="item..."
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="frontmatter-add-chip-btn"
            onClick={() => setIsAddingChip(true)}
          >
            + item
          </button>
        )}
      </div>
    );
  }

  // Nested Object
  if (typeof prop.value === "object" && prop.value !== null) {
    return (
      <div className="frontmatter-nested-object">
        {Object.entries(prop.value).map(([subK, subV]) => (
          <div key={subK} className="nested-item">
            <span className="nested-key">{subK}:</span>
            <span className="nested-val">{String(subV)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Number / String
  if (isEditingText) {
    return (
      <input
        type="text"
        className="frontmatter-inline-input"
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        onBlur={() => {
          setIsEditingText(false);
          if (prop.type === "number" && !isNaN(Number(textDraft))) {
            onUpdate(Number(textDraft));
          } else {
            onUpdate(textDraft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setIsEditingText(false);
            if (prop.type === "number" && !isNaN(Number(textDraft))) {
              onUpdate(Number(textDraft));
            } else {
              onUpdate(textDraft);
            }
          } else if (e.key === "Escape") {
            setIsEditingText(false);
            setTextDraft(String(prop.value ?? ""));
          }
        }}
        autoFocus
      />
    );
  }

  return (
    <div
      className="frontmatter-val-display"
      onClick={() => setIsEditingText(true)}
      title="Click to edit value"
    >
      {String(prop.value ?? "") || (
        <span className="frontmatter-empty-val">empty</span>
      )}
    </div>
  );
};
