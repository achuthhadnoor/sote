import { create } from "zustand";

export type SidebarCreateKind = "file" | "folder";

export type SidebarNameDialog =
  | {
      mode: "rename";
      path: string;
      name: string;
      isDirectory: boolean;
    }
  | {
      mode: "create-file";
      dirPath: string;
    }
  | {
      mode: "create-folder";
      dirPath: string;
    };

interface SidebarActionsState {
  dialog: SidebarNameDialog | null;
  startRename: (path: string, name: string, isDirectory: boolean) => void;
  startCreate: (dirPath: string, kind: SidebarCreateKind) => void;
  clear: () => void;
}

export const useSidebarActionsStore = create<SidebarActionsState>((set) => ({
  dialog: null,
  startRename: (path, name, isDirectory) =>
    set({ dialog: { mode: "rename", path, name, isDirectory } }),
  startCreate: (dirPath, kind) =>
    set({
      dialog:
        kind === "file"
          ? { mode: "create-file", dirPath }
          : { mode: "create-folder", dirPath },
    }),
  clear: () => set({ dialog: null }),
}));
