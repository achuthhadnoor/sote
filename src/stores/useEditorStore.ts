import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { NoteEnvelope } from "../types/note";

interface EditorState {
  frontmatter: string | null;
  body: string;
  lastSavedBody: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  loadNote: (path: string) => Promise<string>;
  updateBody: (body: string) => void;
  setSaved: () => void;
  clearNote: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  frontmatter: null,
  body: "",
  lastSavedBody: "",
  isDirty: false,
  isLoading: false,
  error: null,

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
      isLoading: false,
      error: null,
    });
  },
}));
