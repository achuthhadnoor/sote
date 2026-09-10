import { create } from "zustand";

export type SidebarCreateKind = "file" | "folder";

export type SaveDraftRequest = {
  draftPath: string;
  suggestedName: string;
  dirPath: string;
  body: string;
  frontmatter: string | null;
};

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
    }
  | {
      mode: "save-draft";
      draftPath: string;
      suggestedName: string;
      dirPath: string;
      body: string;
      frontmatter: string | null;
      resolve: (saved: boolean) => void;
    };

interface SidebarActionsState {
  dialog: SidebarNameDialog | null;
  startRename: (path: string, name: string, isDirectory: boolean) => void;
  startCreate: (dirPath: string, kind: SidebarCreateKind) => void;
  /**
   * Prompt for name + folder before the first disk write of a draft.
   * Resolves true if saved, false if cancelled / failed open.
   */
  requestSaveDraft: (req: SaveDraftRequest) => Promise<boolean>;
  clear: () => void;
}

export const useSidebarActionsStore = create<SidebarActionsState>((set, get) => ({
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
  requestSaveDraft: (req) =>
    new Promise<boolean>((resolve) => {
      const current = get().dialog;
      if (current?.mode === "save-draft") {
        // Already prompting for a draft — don't stack dialogs.
        resolve(false);
        return;
      }
      if (current) {
        // Another dialog is open; don't interrupt it.
        resolve(false);
        return;
      }
      set({
        dialog: {
          mode: "save-draft",
          draftPath: req.draftPath,
          suggestedName: req.suggestedName,
          dirPath: req.dirPath,
          body: req.body,
          frontmatter: req.frontmatter,
          resolve,
        },
      });
    }),
  clear: () => {
    const current = get().dialog;
    if (current?.mode === "save-draft") {
      current.resolve(false);
    }
    set({ dialog: null });
  },
}));
