import { create } from "zustand";

interface TabState {
  activePath: string | null;
  activeTitle: string;
  history: string[];
  historyIndex: number;
  selectNote: (path: string, name: string) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  activePath: null,
  activeTitle: "Welcome",
  history: [],
  historyIndex: -1,

  selectNote: (path: string, name: string) => {
    const { history, historyIndex, activePath } = get();
    if (activePath === path) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);

    set({
      activePath: path,
      activeTitle: name,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => {
    const { history, historyIndex } = get();
    return historyIndex >= 0 && historyIndex < history.length - 1;
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevPath = history[historyIndex - 1];
      const name = prevPath.split("/").pop() || prevPath;
      set({
        activePath: prevPath,
        activeTitle: name,
        historyIndex: historyIndex - 1,
      });
    }
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
      const nextPath = history[historyIndex + 1];
      const name = nextPath.split("/").pop() || nextPath;
      set({
        activePath: nextPath,
        activeTitle: name,
        historyIndex: historyIndex + 1,
      });
    }
  },
}));
