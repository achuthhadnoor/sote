import React from "react";

interface SidebarProps {
  onOpenVault?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenVault }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Search notes... (⌘P)"
          readOnly
        />
      </div>

      <div className="sidebar-tree-container">
        <div className="sidebar-empty-hint">
          No vault opened.<br />
          Open a local folder to browse your markdown notes.
        </div>
      </div>

      <div className="sidebar-footer">
        <span>Library</span>
        <button
          onClick={onOpenVault}
          style={{
            background: "none",
            border: "none",
            color: "var(--fg)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          Open...
        </button>
      </div>
    </aside>
  );
};
