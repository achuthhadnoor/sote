import React from "react";

interface TabBarProps {
  activeTitle?: string;
  onNewNote?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  activeTitle = "Welcome",
  onNewNote,
}) => {
  return (
    <header className="tab-bar">
      <div className="tab-nav-group">
        <button className="tab-nav-btn" disabled title="Go back">
          ←
        </button>
        <button className="tab-nav-btn" disabled title="Go forward">
          →
        </button>
      </div>

      <div className="tab-title">{activeTitle}</div>

      <button className="tab-action-btn" onClick={onNewNote} title="New note (+)">
        +
      </button>
    </header>
  );
};
