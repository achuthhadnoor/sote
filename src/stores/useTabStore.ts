import { create } from "zustand";

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
    const active = tabs.find((t) => t.path === activePath) ?? tabs[0] ?? null;
    // rebuild history from tabs order for initial load
    const history = tabs.map((t) => t.path);
    const idx = active ? history.indexOf(active.path) : -1;
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

    // keep history but remove entry if present? Simpler: filter history to remove closed path? But keep for back/forward? Remove it
    let nextHistory = history.filter((p) => p !== path);
    let nextHistoryIndex = historyIndex;
    // adjust index if active changed due to close
    if (nextActivePath) {
      const pos = nextHistory.indexOf(nextActivePath);
      if (pos !== -1) nextHistoryIndex = pos;
      else {
        // active not in history (closed tab was last), push it
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
      const name = tab?.title ?? (prevPath.split("/").pop() || prevPath);
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
      const name = tab?.title ?? (nextPath.split("/").pop() || nextPath);
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
