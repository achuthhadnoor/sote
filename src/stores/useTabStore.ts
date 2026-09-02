import { create } from "zustand";

interface TabState {
  activePath: string | null;
  activeTitle: string;
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  selectNote: (path: string, name: string) => void;
  goBack: () => void;
  goForward: () => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  activePath: null,
  activeTitle: "Welcome",
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,

  selectNote: (path: string, name: string) => {
    const { history, historyIndex, activePath } = get();
    if (activePath === path) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);
    const newIndex = newHistory.length - 1;

    set({
      activePath: path,
      activeTitle: name,
      history: newHistory,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false,
    });
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevPath = history[newIndex];
      const name = prevPath.split("/").pop() || prevPath;
      set({
        activePath: prevPath,
        activeTitle: name,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: newIndex < history.length - 1,
      });
    }
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextPath = history[newIndex];
      const name = nextPath.split("/").pop() || nextPath;
      set({
        activePath: nextPath,
        activeTitle: name,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: newIndex < history.length - 1,
      });
    }
  },
}));
