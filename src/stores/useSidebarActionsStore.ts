import { create } from "zustand";

export type SidebarCreateKind = "file" | "folder";

export type SaveDraftRequest = {
  draftPath: string;
  suggestedName: string;
  dirPath: string;
  body: string;
  frontmatter: string | null;
};

export type CloseDraftChoice = "save" | "discard" | "cancel";

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
    }
  | {
      mode: "confirm-close-draft";
      title: string;
      resolve: (choice: CloseDraftChoice) => void;
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
  /**
   * Ask Save / Discard / Cancel before closing a draft with content.
   */
  requestCloseDraftChoice: (title: string) => Promise<CloseDraftChoice>;
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
      if (current?.mode === "save-draft" || current?.mode === "confirm-close-draft") {
        resolve(false);
        return;
      }
      if (current) {
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
  requestCloseDraftChoice: (title) =>
    new Promise<CloseDraftChoice>((resolve) => {
      const current = get().dialog;
      if (current) {
        resolve("cancel");
        return;
      }
      set({
        dialog: {
          mode: "confirm-close-draft",
          title,
          resolve,
        },
      });
    }),
  clear: () => {
    const current = get().dialog;
    if (current?.mode === "save-draft") {
      current.resolve(false);
    } else if (current?.mode === "confirm-close-draft") {
      current.resolve("cancel");
    }
    set({ dialog: null });
  },
}));
