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
      <aside className="w-11 min-w-11 h-full bg-sidebar-translucent border-l border-border-translucent flex flex-col items-center select-none py-2 shrink-0">
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-muted-foreground hover:bg-muted-translucent hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setCollapsed(false)}
            title="Expand panel"
            aria-label="Expand panel"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-muted-foreground hover:bg-muted-translucent hover:text-foreground transition-colors cursor-pointer"
              onClick={() => { setActiveTab("terminal"); setCollapsed(false); }}
              title="Terminal"
            >
              <TerminalIcon />
            </button>
            <button
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-muted-foreground hover:bg-muted-translucent hover:text-foreground transition-colors cursor-pointer"
              onClick={() => { setActiveTab("browser"); setCollapsed(false); }}
              title="Browser"
            >
              <BrowserIcon />
            </button>
            <button
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-muted-foreground hover:bg-muted-translucent hover:text-foreground transition-colors cursor-pointer"
              onClick={() => { setActiveTab("canvas"); setCollapsed(false); }}
              title="Canvas"
            >
              <CanvasIcon />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] min-w-[280px] max-w-[480px] h-full bg-sidebar-translucent border-l border-border-translucent flex flex-col select-none shrink-0 overflow-hidden">
      <div className="h-header border-b border-border-translucent px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "terminal"}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              activeTab === "terminal"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted-translucent hover:text-foreground"
            }`}
            onClick={() => setActiveTab("terminal")}
          >
            <TerminalIcon />
            <span>Terminal</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "browser"}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              activeTab === "browser"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted-translucent hover:text-foreground"
            }`}
            onClick={() => setActiveTab("browser")}
          >
            <BrowserIcon />
            <span>Browser</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "canvas"}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              activeTab === "canvas"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted-translucent hover:text-foreground"
            }`}
            onClick={() => setActiveTab("canvas")}
          >
            <CanvasIcon />
            <span>Canvas</span>
          </button>
        </div>
        <button
          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-muted-foreground hover:bg-muted-translucent hover:text-foreground transition-colors cursor-pointer"
          onClick={() => setCollapsed(true)}
          title="Collapse panel"
          aria-label="Collapse panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)", transformOrigin: "center" }} />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
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
