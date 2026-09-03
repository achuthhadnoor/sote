import { useState } from "react";
import { TerminalPane } from "./TerminalPane";
import { BrowserPane } from "./BrowserPane";
import { CanvasPane } from "./CanvasPane";

type RightTab = "terminal" | "browser" | "canvas";

export const RightPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RightTab>("terminal");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="right-panel right-panel-collapsed">
        <div className="right-panel-collapsed-bar">
          <button
            className="right-panel-collapse-btn"
            onClick={() => setCollapsed(false)}
            title="Expand panel"
            aria-label="Expand panel"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="right-panel-collapsed-icons">
            <button className="right-panel-icon-btn" onClick={() => { setActiveTab("terminal"); setCollapsed(false); }} title="Terminal">
              <TerminalIcon />
            </button>
            <button className="right-panel-icon-btn" onClick={() => { setActiveTab("browser"); setCollapsed(false); }} title="Browser">
              <BrowserIcon />
            </button>
            <button className="right-panel-icon-btn" onClick={() => { setActiveTab("canvas"); setCollapsed(false); }} title="Canvas">
              <CanvasIcon />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="right-panel">
      <div className="right-panel-header">
        <div className="right-panel-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "terminal"}
            className={`right-panel-tab ${activeTab === "terminal" ? "is-active" : ""}`}
            onClick={() => setActiveTab("terminal")}
          >
            <TerminalIcon />
            <span>Terminal</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "browser"}
            className={`right-panel-tab ${activeTab === "browser" ? "is-active" : ""}`}
            onClick={() => setActiveTab("browser")}
          >
            <BrowserIcon />
            <span>Browser</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "canvas"}
            className={`right-panel-tab ${activeTab === "canvas" ? "is-active" : ""}`}
            onClick={() => setActiveTab("canvas")}
          >
            <CanvasIcon />
            <span>Canvas</span>
          </button>
        </div>
        <button
          className="right-panel-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Collapse panel"
          aria-label="Collapse panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)", transformOrigin: "center" }} />
          </svg>
        </button>
      </div>
      <div className="right-panel-content">
        {activeTab === "terminal" && <TerminalPane />}
        {activeTab === "browser" && <BrowserPane />}
        {activeTab === "canvas" && <CanvasPane />}
      </div>
    </aside>
  );
};

const TerminalIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 10L10 13L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 16H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const BrowserIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 9H21" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="7" cy="6.5" r="1" fill="currentColor" />
    <circle cx="10.5" cy="6.5" r="1" fill="currentColor" />
    <circle cx="14" cy="6.5" r="1" fill="currentColor" />
  </svg>
);

const CanvasIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 8H17M7 12H14M7 16H15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="17.5" cy="17.5" r="1.2" fill="currentColor" />
  </svg>
);
