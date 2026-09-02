import React from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { useTabStore } from "../../stores/useTabStore";

export const ConflictBanner: React.FC = () => {
  const hasConflict = useEditorStore((state) => state.hasConflict);
  const resolveConflictReload = useEditorStore(
    (state) => state.resolveConflictReload
  );
  const resolveConflictKeepMine = useEditorStore(
    (state) => state.resolveConflictKeepMine
  );
  const activePath = useTabStore((state) => state.activePath);

  if (!hasConflict || !activePath) {
    return null;
  }

  return (
    <aside className="conflict-banner" role="alert">
      <div className="conflict-message">
        <span className="conflict-icon">⚠️</span>
        <span>File changed on disk</span>
      </div>
      <div className="conflict-actions">
        <button
          type="button"
          className="btn-conflict-reload"
          onClick={() => resolveConflictReload(activePath)}
        >
          Reload
        </button>
        <button
          type="button"
          className="btn-conflict-keep"
          onClick={resolveConflictKeepMine}
        >
          Keep mine
        </button>
      </div>
    </aside>
  );
};
