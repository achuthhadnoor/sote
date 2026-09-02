import React from "react";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";

interface TabBarProps {
  onNewNote?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onNewNote }) => {
  const activeTitle = useTabStore((state) => state.activeTitle);
  const canGoBack = useTabStore((state) => state.canGoBack);
  const canGoForward = useTabStore((state) => state.canGoForward);
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);

  const isDirty = useEditorStore((state) => state.isDirty);
  const isSaving = useEditorStore((state) => state.isSaving);

  return (
    <header className="tab-bar">
      <div className="tab-nav-group">
        <button
          type="button"
          className="tab-nav-btn"
          disabled={!canGoBack}
          onClick={goBack}
          title="Go back (⌘[)"
        >
          ←
        </button>
        <button
          type="button"
          className="tab-nav-btn"
          disabled={!canGoForward}
          onClick={goForward}
          title="Go forward (⌘])"
        >
          →
        </button>
      </div>

      <div
        className="tab-title"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        <span>{activeTitle}</span>
        {isSaving && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--muted-fg)",
              fontWeight: 400,
            }}
          >
            saving...
          </span>
        )}
        {!isSaving && isDirty && (
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--primary)",
              display: "inline-block",
            }}
            title="Unsaved changes"
          />
        )}
      </div>

      <button
        type="button"
        className="tab-action-btn"
        onClick={onNewNote}
        title="New note (⌘N)"
      >
        +
      </button>
    </header>
  );
};
