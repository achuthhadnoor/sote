import React, { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { flushActiveNote } from "../../lib/flushActiveNote";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Minus, PanelLeft, Pin, Plus, Settings, Square, X } from "lucide-react";
import { isSettingsTab, isVirtualTab } from "../../lib/specialTabs";
import { PLATFORM, isWindows, modShortcut } from "../../utils/platform";
import { cn } from "@/lib/utils";

const ALWAYS_ON_TOP_KEY = "snipnote-always-on-top";

/** Windows restore glyph (overlapping squares) when the window is maximized. */
const RestoreIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={className}>
    <path d="M2.5 3.5H7.5V8.5H2.5V3.5Z" stroke="currentColor" strokeWidth="1.1" />
    <path d="M3.5 3.5V2.5H8.5V7.5H7.5" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);

interface TabBarProps {
  onNewNote?: () => void;
  onOpenSettings?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  /** Minimal chrome while waiting for a folder (no sidebar/tabs/new-note). */
  welcomeMode?: boolean;
}

const FileTabIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={active ? "text-foreground shrink-0" : "text-muted-foreground shrink-0"}
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

export const TabBar: React.FC<TabBarProps> = ({
  onNewNote,
  onOpenSettings,
  sidebarCollapsed,
  onToggleSidebar,
  welcomeMode = false,
}) => {
  const tabs = useTabStore((state) => state.tabs);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const closeTab = useTabStore((state) => state.closeTab);
  const canGoBack = useTabStore((state) => state.canGoBack);
  const canGoForward = useTabStore((state) => state.canGoForward);
  const goBack = useTabStore((state) => state.goBack);
  const goForward = useTabStore((state) => state.goForward);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const isDirty = useEditorStore((state) => state.isDirty);
  const isSaving = useEditorStore((state) => state.isSaving);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = localStorage.getItem(ALWAYS_ON_TOP_KEY) === "1";
        const win = getCurrentWindow();
        if (saved) await win.setAlwaysOnTop(true);
        const actual = await win.isAlwaysOnTop();
        if (!cancelled) setPinned(actual);
      } catch {
        // Non-Tauri / capability missing — leave unpinned.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isWindows) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const win = getCurrentWindow();
        const sync = async () => {
          const next = await win.isMaximized();
          if (!disposed) setMaximized(next);
        };
        await sync();
        unlisten = await win.onResized(() => {
          void sync();
        });
      } catch {}
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // Keep the active tab visible inside the horizontal strip.
  useEffect(() => {
    const strip = tabsScrollRef.current;
    const tab = activeTabRef.current;
    if (!strip || !tab) return;

    const pad = 12;
    const tabLeft = tab.offsetLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;

    if (tabLeft < viewLeft + pad) {
      strip.scrollTo({ left: Math.max(0, tabLeft - pad), behavior: "smooth" });
    } else if (tabRight > viewRight - pad) {
      strip.scrollTo({ left: tabRight - strip.clientWidth + pad, behavior: "smooth" });
    }
  }, [activePath, tabs]);

  const handleTabClick = async (path: string, title: string) => {
    if (path !== activePath && !(await flushActiveNote())) return;
    selectNote(path, title);
  };

  const handleClose = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (path === activePath && !(await flushActiveNote())) return;
    closeTab(path);
  };

  const handleGoBack = async () => {
    if (!(await flushActiveNote())) return;
    goBack();
  };

  const handleGoForward = async () => {
    if (!(await flushActiveNote())) return;
    goForward();
  };

  const handleStartDragging = (e: React.MouseEvent) => {
    // Only drag on primary click (left mouse button) and if not clicking an interactive child element
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, [role="button"], [role="tab"], .tab-item, a, .tab-strip')) {
      return;
    }
    // Double click to maximize/unmaximize window (native macOS/Windows behavior)
    if (e.detail === 2) {
      getCurrentWindow().toggleMaximize().catch(() => {});
      return;
    }
    getCurrentWindow().startDragging().catch(() => {});
  };

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Trackpads often report vertical delta; map it to horizontal tab scrolling.
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  const togglePinned = async () => {
    const next = !pinned;
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
      try {
        localStorage.setItem(ALWAYS_ON_TOP_KEY, next ? "1" : "0");
      } catch {}
      setPinned(next);
    } catch {}
  };

  const minimizeWindow = () => {
    getCurrentWindow().minimize().catch(() => {});
  };

  const toggleMaximizeWindow = () => {
    getCurrentWindow().toggleMaximize().catch(() => {});
  };

  const closeWindow = async () => {
    await flushActiveNote();
    getCurrentWindow().close().catch(() => {});
  };

  return (
    <header
      className="sticky top-0 z-20 isolate w-full flex h-header items-center border-b border-border-translucent select-none bg-transparent overflow-visible"
      data-tauri-drag-region
      onMouseDown={handleStartDragging}
    >
      {/* Progressive blur — stacked radii (weakest feathers furthest) + tint wash */}
      <div className="chrome-blur chrome-blur--header" aria-hidden="true">
        <div className="chrome-blur__layer chrome-blur__b1" />
        <div className="chrome-blur__layer chrome-blur__b2" />
        <div className="chrome-blur__layer chrome-blur__b3" />
        <div className="chrome-blur__layer chrome-blur__b4" />
        <div className="chrome-blur__layer chrome-blur__b5" />
        <div className="chrome-blur__layer chrome-blur__tint" />
      </div>
      <div className="relative z-10 flex w-full h-full items-center gap-3 px-3">
      {/* Left cluster: sidebar toggle + navigation, then tabs — all in the
          titlebar row. macOS Overlay reserves traffic-lights space on the left
          when the bar reaches the window edge. */}
      <div
        className={`flex gap-1 shrink-0 ${
          welcomeMode || sidebarCollapsed
            ? PLATFORM === "mac"
              ? "pl-16 justify-end "
              : "w-[86px]"
            : "w-[56px]"
        }`}
        data-tauri-drag-region
      >
        {!welcomeMode && sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-muted-translucent hover:text-foreground"
            onClick={onToggleSidebar}
            title={`Show Sidebar (${modShortcut("B")})`}
            aria-label="Show Sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        {!welcomeMode && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-muted-translucent hover:text-foreground disabled:opacity-30"
              disabled={!canGoBack}
              onClick={() => void handleGoBack()}
              title={`Go back (${modShortcut("[")})`}
              aria-label="Go back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-muted-translucent hover:text-foreground disabled:opacity-30"
              disabled={!canGoForward}
              onClick={() => void handleGoForward()}
              title={`Go forward (${modShortcut("]")})`}
              aria-label="Go forward"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Tabs: horizontal scroll when they overflow the titlebar. */}
      <div className="flex-1 min-w-0 flex items-center overflow-hidden h-full justify-start" data-tauri-drag-region>
        {welcomeMode ? (
          <div className="flex-1 h-full" data-tauri-drag-region />
        ) : tabs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center" data-tauri-drag-region>
            No open notes
          </div>
        ) : (
          <div
            ref={tabsScrollRef}
            className="tab-strip w-full h-full overflow-x-auto overflow-y-hidden overscroll-x-contain"
            onWheel={handleTabsWheel}
            data-tauri-drag-region
          >
            <div
              className="flex items-center gap-1.5 h-full px-2 py-1.5 w-max min-w-full"
              role="tablist"
              aria-label="Open notes"
              data-tauri-drag-region
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
                  tabsEls[nextIdx].scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
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
                const isVirtual = isVirtualTab(tab.path);
                const showDirty = isActive && !isVirtual && isDirty && !isSaving;
                const showSaving = isActive && !isVirtual && isSaving;
                return (
                  <button
                    key={tab.path}
                    ref={isActive ? activeTabRef : undefined}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`editor-${tab.path}`}
                    tabIndex={isActive ? 0 : -1}
                    data-tab-path={tab.path}
                    data-tab-title={tab.title}
                    className={`tab-item ui-row group relative inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 border border-transparent type-label font-medium whitespace-nowrap shrink-0 max-w-[180px] cursor-pointer ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => handleTabClick(tab.path, tab.title)}
                    onFocus={(e) => {
                      const tabsEls = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
                      tabsEls.forEach((el) => (el.tabIndex = -1));
                      (e.currentTarget as HTMLElement).tabIndex = 0;
                    }}
                    title={isDraft ? `${tab.path} — not yet saved` : isSettingsTab(tab.path) ? "Settings" : tab.path}
                  >
                    {isSettingsTab(tab.path) ? (
                      <Settings className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                    ) : (
                      <FileTabIcon active={isActive} />
                    )}
                    <span className={`truncate max-w-[120px] ${isDraft ? "italic" : ""}`}>{tab.title}</span>
                    {isDraft && !isActive && <span className="w-1.5 h-1.5 rounded-full border border-muted-foreground/70 shrink-0 group-hover:opacity-0 transition-opacity" title="Not yet saved" />}
                    {isActive && isDraft && !isDirty && <span className="type-meta italic font-normal shrink-0">draft</span>}
                    {showDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 group-hover:opacity-0 transition-opacity" title="Unsaved changes" />
                    )}
                    {showSaving && (
                      <span className="type-meta font-normal shrink-0">saving…</span>
                    )}
                    <span
                      className="tab-item__close absolute right-0.5 top-1/2 -translate-y-1/2 h-5 pl-5 pr-1 rounded-md inline-flex items-center justify-end text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
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
          </div>
        )}
      </div>

      {/* Right cluster: app actions; Windows also draws caption buttons (frameless). */}
      <div className="flex items-center justify-end shrink-0 h-full" data-tauri-drag-region>
        <div className="flex items-center justify-end gap-1.5 pr-1">
          {!welcomeMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-muted-translucent hover:text-foreground"
              onClick={onNewNote}
              title={`New note (${modShortcut("N")})`}
              aria-label="New note"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-muted-translucent hover:text-foreground",
              pinned && "text-foreground bg-muted-translucent"
            )}
            onClick={() => void togglePinned()}
            title={pinned ? "Unpin window (always on top)" : "Pin window (always on top)"}
            aria-label={pinned ? "Unpin window" : "Pin window"}
            aria-pressed={pinned}
          >
            <Pin className={cn("h-[14px] w-[14px]", pinned && "fill-current")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-[26px] w-[26px] rounded-sm text-muted-foreground hover:bg-muted-translucent hover:text-foreground"
            onClick={() => onOpenSettings?.()}
            title={`Settings (${modShortcut(",")})`}
            aria-label="Open settings"
          >
            <Settings className="h-[14px] w-[14px]" />
          </Button>
        </div>
        {isWindows && (
          <div className="flex items-stretch h-full -mr-3 ml-1" role="group" aria-label="Window controls">
            <button
              type="button"
              className="flex h-full w-[46px] items-center justify-center text-foreground/80 hover:bg-muted-translucent hover:text-foreground transition-colors"
              onClick={minimizeWindow}
              title="Minimize"
              aria-label="Minimize"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="flex h-full w-[46px] items-center justify-center text-foreground/80 hover:bg-muted-translucent hover:text-foreground transition-colors"
              onClick={toggleMaximizeWindow}
              title={maximized ? "Restore" : "Maximize"}
              aria-label={maximized ? "Restore" : "Maximize"}
            >
              {maximized ? (
                <RestoreIcon />
              ) : (
                <Square className="h-3 w-3" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              className="flex h-full w-[46px] items-center justify-center text-foreground/80 hover:bg-[#E81123] hover:text-white transition-colors"
              onClick={() => void closeWindow()}
              title="Close"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
      </div>
    </header>
  );
};
