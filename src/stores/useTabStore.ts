import { create } from "zustand";
import { pathBasename } from "../utils/paths";

export interface Tab {
  path: string;
  title: string;
  isNew?: boolean; // unsaved draft — no file on disk yet
}

interface TabState {
  tabs: Tab[];
  activePath: string | null;
  activeTitle: string;
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  selectNote: (path: string, name: string, opts?: { isNew?: boolean }) => void;
  openInNewBackgroundTab: (path: string, name: string) => void;
  closeTab: (path: string) => void;
  closeAll: () => void;
  setTabs: (tabs: Tab[], activePath: string | null) => void;
  markTabSaved: (path: string) => void;
  updateTabTitle: (path: string, title: string) => void;
  goBack: () => void;
  goForward: () => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activePath: null,
  activeTitle: "Welcome",
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,

  setTabs: (tabs, activePath) => {
    const current = get();
    const active = tabs.find((t) => t.path === activePath) ?? tabs[0] ?? null;
    // Tabs are a collection; navigation history is an independent stack.
    // Only initialize it for the first session restore, then preserve the
    // existing sequence when a tree/session refresh supplies the tab list.
    const tabPaths = new Set(tabs.map((tab) => tab.path));
    let history = current.tabs.length === 0
      ? (active ? [active.path] : [])
      : current.history.filter((path) => tabPaths.has(path));
    if (active && !history.includes(active.path)) history = [...history, active.path];
    const idx = active ? history.lastIndexOf(active.path) : -1;
    set({
      tabs,
      activePath: active?.path ?? null,
      activeTitle: active?.title ?? "Welcome",
      history: history.length ? history : [],
      historyIndex: idx,
      canGoBack: idx > 0,
      canGoForward: idx >= 0 && idx < history.length - 1,
    });
  },

  openInNewBackgroundTab: (path: string, name: string) => {
    const { tabs } = get();
    if (tabs.find((t) => t.path === path)) return;
    set({ tabs: [...tabs, { path, title: name }] });
  },

  selectNote: (path: string, name: string, opts?: { isNew?: boolean }) => {
    const { history, historyIndex, activePath, tabs } = get();
    const isNew = opts?.isNew ?? false;
    if (activePath === path) {
      // ensure tab title stays fresh if renamed, and isNew flag update
      const nextTabs = tabs.map((t) => (t.path === path ? { ...t, title: name, isNew: isNew || t.isNew } : t));
      // if already active but isNew changed, update
      if (isNew && !tabs.find((t) => t.path === path)?.isNew) {
        set({ tabs: nextTabs, activeTitle: name });
      } else if (!isNew) {
        const cur = tabs.find((t) => t.path === path);
        if (cur && cur.title !== name) set({ tabs: nextTabs, activeTitle: name });
      }
      return;
    }

    let nextTabs = tabs;
    const existing = tabs.find((t) => t.path === path);
    if (!existing) {
      nextTabs = [...tabs, { path, title: name, isNew }];
    } else {
      // title refresh or isNew flag promotion
      if (existing.title !== name || (isNew && !existing.isNew)) {
        nextTabs = tabs.map((t) => (t.path === path ? { ...t, title: name, isNew: isNew || t.isNew } : t));
      }
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);
    const newIndex = newHistory.length - 1;

    set({
      tabs: nextTabs,
      activePath: path,
      activeTitle: name,
      history: newHistory,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false,
    });
  },

  closeTab: (path: string) => {
    const { tabs, activePath, history, historyIndex } = get();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    const nextTabs = tabs.filter((t) => t.path !== path);
    let nextActivePath: string | null = activePath;
    let nextActiveTitle = get().activeTitle;

    if (activePath === path) {
      if (nextTabs.length === 0) {
        nextActivePath = null;
        nextActiveTitle = "Welcome";
      } else {
        // pick neighbor: try same index, else previous
        const nextIdx = idx < nextTabs.length ? idx : nextTabs.length - 1;
        const nextTab = nextTabs[nextIdx];
        nextActivePath = nextTab.path;
        nextActiveTitle = nextTab.title;
      }
    }

    // Remove only entries belonging to the closed tab. Repeated visits to
    // other tabs remain meaningful back/forward destinations.
    const removedBefore = history.slice(0, historyIndex + 1).filter((p) => p === path).length;
    let nextHistory = history.filter((p) => p !== path);
    let nextHistoryIndex = Math.max(-1, historyIndex - removedBefore);
    // Repair the cursor when closing the active tab.
    if (nextActivePath) {
      const pos = nextHistory.lastIndexOf(nextActivePath, Math.max(0, nextHistoryIndex));
      if (pos !== -1) nextHistoryIndex = pos;
      else {
        // The neighboring tab may not have been visited yet.
        nextHistory = [...nextHistory, nextActivePath];
        nextHistoryIndex = nextHistory.length - 1;
      }
    } else {
      nextHistoryIndex = nextHistory.length - 1;
    }

    set({
      tabs: nextTabs,
      activePath: nextActivePath,
      activeTitle: nextActiveTitle,
      history: nextHistory,
      historyIndex: nextHistoryIndex,
      canGoBack: nextHistoryIndex > 0,
      canGoForward: nextHistoryIndex >= 0 && nextHistoryIndex < nextHistory.length - 1,
    });
  },

  closeAll: () => {
    set({
      tabs: [],
      activePath: null,
      activeTitle: "Welcome",
      history: [],
      historyIndex: -1,
      canGoBack: false,
      canGoForward: false,
    });
  },

  markTabSaved: (path: string) => {
    const { tabs } = get();
    const nextTabs = tabs.map((t) => (t.path === path ? { ...t, isNew: false } : t));
    set({ tabs: nextTabs });
  },

  updateTabTitle: (path: string, title: string) => {
    const { tabs, activePath } = get();
    const nextTabs = tabs.map((t) => (t.path === path ? { ...t, title } : t));
    set({
      tabs: nextTabs,
      activeTitle: activePath === path ? title : get().activeTitle,
    });
  },

  goBack: () => {
    const { history, historyIndex, tabs } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevPath = history[newIndex];
      const tab = tabs.find((t) => t.path === prevPath);
      const name = tab?.title ?? (pathBasename(prevPath) || prevPath);
      // ensure tab exists for this path
      let nextTabs = tabs;
      if (!tab) {
        nextTabs = [...tabs, { path: prevPath, title: name }];
      }
      set({
        tabs: nextTabs,
        activePath: prevPath,
        activeTitle: name,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: newIndex < history.length - 1,
      });
    }
  },

  goForward: () => {
    const { history, historyIndex, tabs } = get();
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextPath = history[newIndex];
      const tab = tabs.find((t) => t.path === nextPath);
      const name = tab?.title ?? (pathBasename(nextPath) || nextPath);
      let nextTabs = tabs;
      if (!tab) {
        nextTabs = [...tabs, { path: nextPath, title: name }];
      }
      set({
        tabs: nextTabs,
        activePath: nextPath,
        activeTitle: name,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: newIndex < history.length - 1,
      });
    }
  },
}));
