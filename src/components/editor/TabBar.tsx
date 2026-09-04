import React from "react";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface TabBarProps {
  onNewNote?: () => void;
}

const FileTabIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ color: active ? "var(--fg)" : "var(--muted-fg)", flexShrink: 0 }}
  >
    <path
      d="M7 3.5A1.5 1.5 0 0 1 8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16Z"
      fill="currentColor"
      opacity={active ? 0.14 : 0.09}
    />
    <path
      d="M8.5 2H14l4 4.5V19.5A1.5 1.5 0 0 1 16.5 21H8.5A1.5 1.5 0 0 1 7 19.5v-16A1.5 1.5 0 0 1 8.5 2Z"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinejoin="round"
    />
    <path d="M14 2.5V6.5H18" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
  </svg>
);

export const TabBar: React.FC<TabBarProps> = ({ onNewNote }) => {
  const tabs = useTabStore((state) => state.tabs);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const closeTab = useTabStore((state) => state.closeTab);
  const canGoBack = useTabStore((state) => state.canGoBack);
  const canGoForward = useTabStore((state) => state.canGoForward);
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);

  const isDirty = useEditorStore((state) => state.isDirty);
  const isSaving = useEditorStore((state) => state.isSaving);

  const handleTabClick = (path: string, title: string) => {
    // flush handled in EditorSurface via activePath change
    selectNote(path, title);
  };

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    // If closing dirty active tab, still allow but we already auto-save on tab switch; just close
    closeTab(path);
  };

  return (
    <header className="tab-bar flex h-[var(--header-height)] items-center gap-3 border-b border-[var(--border-translucent)] bg-[var(--bg-translucent)] px-2 pl-3 select-none overflow-hidden">
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-[26px] w-[26px] rounded-[var(--radius-sm)] text-muted-foreground hover:bg-[var(--muted-translucent)] hover:text-foreground disabled:opacity-30"
          disabled={!canGoBack}
          onClick={goBack}
          title="Go back (⌘[)"
          aria-label="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-[26px] w-[26px] rounded-[var(--radius-sm)] text-muted-foreground hover:bg-[var(--muted-translucent)] hover:text-foreground disabled:opacity-30"
          disabled={!canGoForward}
          onClick={goForward}
          title="Go forward (⌘])"
          aria-label="Go forward"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-w-0 flex items-center overflow-hidden h-full">
        {tabs.length === 0 ? (
          <div className="text-xs text-muted-foreground pl-2">No open notes</div>
        ) : (
          <ScrollArea className="flex-1 h-full">
            <div
              className="flex items-center gap-1.5 h-full px-0.5 py-1.5"
              role="tablist"
              aria-label="Open notes"
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
                const tabsEls = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
                const activeIdx = tabsEls.findIndex((el) => el.getAttribute("aria-selected") === "true");
                let nextIdx = activeIdx;
                if (e.key === "ArrowLeft") nextIdx = Math.max(0, activeIdx - 1);
                else if (e.key === "ArrowRight") nextIdx = Math.min(tabsEls.length - 1, activeIdx + 1);
                else if (e.key === "Home") nextIdx = 0;
                else if (e.key === "End") nextIdx = tabsEls.length - 1;
                if (nextIdx !== activeIdx && tabsEls[nextIdx]) {
                  e.preventDefault();
                  tabsEls.forEach((el) => (el.tabIndex = -1));
                  tabsEls[nextIdx].tabIndex = 0;
                  tabsEls[nextIdx].focus();
                  const el = tabsEls[nextIdx];
                  const path = el.getAttribute("data-tab-path");
                  const title = el.getAttribute("data-tab-title");
                  if (path && title) handleTabClick(path, title);
                }
              }}
            >
            {tabs.map((tab) => {
              const isActive = tab.path === activePath;
              const isDraft = !!tab.isNew;
              return (
                <button
                  key={tab.path}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`editor-${tab.path}`}
                  tabIndex={isActive ? 0 : -1}
                  data-tab-path={tab.path}
                  data-tab-title={tab.title}
                  className={`tab-item ${isActive ? "is-active" : ""} ${isDraft ? "is-draft" : ""}`}
                  onClick={() => handleTabClick(tab.path, tab.title)}
                  onFocus={(e) => {
                    // roving: when tab receives focus via Tab, ensure it becomes roving active
                    const tabsEls = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
                    tabsEls.forEach((el) => (el.tabIndex = -1));
                    (e.currentTarget as HTMLElement).tabIndex = 0;
                  }}
                  title={isDraft ? `${tab.path} — not yet saved` : tab.path}
                >
                  <FileTabIcon active={isActive} />
                  <span className="tab-item-title">{tab.title}</span>
                  {isDraft && !isActive && <span className="tab-draft-dot" title="Not yet saved" />}
                  {isActive && isDraft && !isDirty && <span className="tab-draft-label">draft</span>}
                  {isActive && isDirty && !isSaving && (
                    <span className="tab-dirty-dot" title="Unsaved changes" />
                  )}
                  {isActive && isSaving && (
                    <span className="tab-saving-label">saving…</span>
                  )}
                  <span
                    className="tab-close-btn"
                    role="button"
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => handleClose(e, tab.path)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              );
            })}
            </div>
          </ScrollArea>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-[26px] w-[26px] shrink-0 rounded-[var(--radius-sm)] text-muted-foreground hover:bg-[var(--muted-translucent)] hover:text-foreground"
        onClick={onNewNote}
        title="New note (⌘N)"
        aria-label="New note"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </header>
  );
};
