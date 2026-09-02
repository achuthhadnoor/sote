import React from "react";
import { useTabStore } from "../../stores/useTabStore";

interface TabBarProps {
  onNewNote?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onNewNote }) => {
  const activeTitle = useTabStore((state) => state.activeTitle);
  const canGoBack = useTabStore((state) => state.canGoBack());
  const canGoForward = useTabStore((state) => state.canGoForward());
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);

  return (
    <header className="tab-bar">
      <div className="tab-nav-group">
        <button
          className="tab-nav-btn"
          disabled={!canGoBack}
          onClick={goBack}
          title="Go back"
        >
          ←
        </button>
        <button
          className="tab-nav-btn"
          disabled={!canGoForward}
          onClick={goForward}
          title="Go forward"
        >
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
