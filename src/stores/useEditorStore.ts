import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { NoteEnvelope } from "../types/note";

interface EditorState {
  frontmatter: string | null;
  body: string;
  lastSavedBody: string;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  hasConflict: boolean;
  reloadCount: number;
  loadNote: (path: string) => Promise<string>;
  updateBody: (body: string) => void;
  saveNow: (filePath: string) => Promise<void>;
  setSaved: () => void;
  clearNote: () => void;
  setConflict: (val: boolean) => void;
  resolveConflictReload: (path: string) => Promise<string>;
  resolveConflictKeepMine: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  frontmatter: null,
  body: "",
  lastSavedBody: "",
  isDirty: false,
  isSaving: false,
  isLoading: false,
  error: null,
  hasConflict: false,
  reloadCount: 0,

  loadNote: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const envelope = await invoke<NoteEnvelope>("read_file", {
        filePath: path,
      });

      set({
        frontmatter: envelope.frontmatter,
        body: envelope.body,
        lastSavedBody: envelope.body,
        isDirty: false,
        isLoading: false,
        error: null,
        hasConflict: false,
      });

      return envelope.body;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      set({
        isLoading: false,
        error: errMsg,
      });
      throw err;
    }
  },

  updateBody: (body: string) => {
    const { lastSavedBody } = get();
    set({
      body,
      isDirty: body !== lastSavedBody,
    });
  },

  saveNow: async (filePath: string) => {
    const { body, frontmatter, isDirty } = get();
    if (!filePath || !isDirty) return;

    const snapshotBody = body;
    const snapshotFrontmatter = frontmatter;
    set({ isSaving: true });

    try {
      await invoke("write_file", {
        filePath,
        body: snapshotBody,
        frontmatter: snapshotFrontmatter,
      });

      // Buffer snapshot concurrency guard:
      // If user typed during write, current body will differ from snapshotBody
      if (get().body === snapshotBody) {
        set({
          lastSavedBody: snapshotBody,
          isDirty: false,
          isSaving: false,
          error: null,
        });
      } else {
        set({ isSaving: false, error: null });
      }
    } catch (err: any) {
      set({
        isSaving: false,
        error: err?.message || String(err),
      });
    }
  },

  setSaved: () => {
    const { body } = get();
    set({
      lastSavedBody: body,
      isDirty: false,
    });
  },

  clearNote: () => {
    set({
      frontmatter: null,
      body: "",
      lastSavedBody: "",
      isDirty: false,
      isSaving: false,
      isLoading: false,
      error: null,
      hasConflict: false,
    });
  },

  setConflict: (val: boolean) => {
    set({ hasConflict: val });
  },

  resolveConflictReload: async (path: string) => {
    const body = await get().loadNote(path);
    set((state) => ({
      hasConflict: false,
      reloadCount: state.reloadCount + 1,
    }));
    return body;
  },

  resolveConflictKeepMine: () => {
    set({ hasConflict: false });
  },
}));
