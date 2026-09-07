import { create } from "zustand";
import { NoteEnvelope } from "../types/note";
import { createLogger, loggedInvoke } from "../lib/logger";
import { useVaultStore } from "./useVaultStore";

const log = createLogger("editor");

interface EditorState {
  loadedPath: string | null;
  frontmatter: string | null;
  lastSavedFrontmatter: string | null;
  body: string;
  lastSavedBody: string;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  hasConflict: boolean;
  reloadCount: number;
  isRawMode: boolean;
  lastSelfWrite: { path: string; at: number } | null;
  loadNote: (path: string) => Promise<string>;
  updateBody: (body: string) => void;
  updateFrontmatter: (frontmatter: string | null) => void;
  saveNow: (filePath: string, snapshot?: { body: string; frontmatter: string | null }) => Promise<boolean>;
  setSaved: () => void;
  clearNote: () => void;
  setConflict: (val: boolean) => void;
  resolveConflictReload: (path: string) => Promise<string>;
  resolveConflictKeepMine: (path?: string) => Promise<void>;
  toggleRawMode: () => void;
  setRawMode: (val: boolean) => void;
}

let latestLoadRequestId = 0;
const saveQueues = new Map<string, Promise<void>>();
const savedSnapshots = new Map<string, { body: string; frontmatter: string | null }>();

export const useEditorStore = create<EditorState>((set, get) => ({
  loadedPath: null,
  frontmatter: null,
  lastSavedFrontmatter: null,
  body: "",
  lastSavedBody: "",
  isDirty: false,
  isSaving: false,
  isLoading: false,
  error: null,
  hasConflict: false,
  reloadCount: 0,
  isRawMode: false,
  lastSelfWrite: null,

  loadNote: async (path: string) => {
    const requestId = ++latestLoadRequestId;
    set({ isLoading: true, error: null, loadedPath: path });
    log.debug("loadNote start:", path);
    try {
      const vaultPath = useVaultStore.getState().vaultPath;
      if (!vaultPath) throw new Error("No vault is open");
      const envelope = await loggedInvoke<NoteEnvelope>("editor", "read_file", {
        vaultPath,
        filePath: path,
      });

      if (requestId === latestLoadRequestId) {
        savedSnapshots.set(path, { body: envelope.body, frontmatter: envelope.frontmatter });
        set({
          loadedPath: path,
          frontmatter: envelope.frontmatter,
          lastSavedFrontmatter: envelope.frontmatter,
          body: envelope.body,
          lastSavedBody: envelope.body,
          isDirty: false,
          isLoading: false,
          error: null,
          hasConflict: false,
        });
      }

      return envelope.body;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      log.error("loadNote failed:", path, errMsg);
      if (requestId === latestLoadRequestId) set({ isLoading: false, error: errMsg });
      throw err;
    }
  },

  updateBody: (body: string) => {
    const { lastSavedBody, frontmatter, lastSavedFrontmatter } = get();
    set({
      body,
      isDirty: body !== lastSavedBody || frontmatter !== lastSavedFrontmatter,
    });
  },

  updateFrontmatter: (frontmatter: string | null) => {
    const { body, lastSavedBody, lastSavedFrontmatter } = get();
    set({
      frontmatter,
      isDirty: body !== lastSavedBody || frontmatter !== lastSavedFrontmatter,
    });
  },

  saveNow: async (filePath: string, snapshot) => {
    if (!filePath) return false;
    let didWrite = false;
    const previous = saveQueues.get(filePath) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const current = get();
      // Without an explicit snapshot, only the currently loaded note may be saved
      // from the live buffer — otherwise a tab switch can write note B into path A.
      if (!snapshot && current.loadedPath && current.loadedPath !== filePath) {
        log.error("saveNow refused: live buffer is for", current.loadedPath, "not", filePath);
        return;
      }
      const snapshotBody = snapshot ? snapshot.body : current.body;
      const snapshotFrontmatter = snapshot ? snapshot.frontmatter : current.frontmatter;
      const savedForPath = savedSnapshots.get(filePath);
      const isDirty = snapshot
        ? snapshotBody !== (savedForPath?.body ?? current.lastSavedBody) ||
          snapshotFrontmatter !== (savedForPath?.frontmatter ?? current.lastSavedFrontmatter)
        : current.isDirty;
      if (!isDirty) return;

      // Do not create a new note file if there is no content.
      const hasContent = snapshotBody.trim().length > 0 || !!snapshotFrontmatter?.trim().length;
      if (!hasContent) return;

      set({ isSaving: true });
      try {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) throw new Error("No vault is open");
        await loggedInvoke("editor", "write_file", {
          vaultPath,
          filePath,
          body: snapshotBody,
          frontmatter: snapshotFrontmatter,
        });
        didWrite = true;
        savedSnapshots.set(filePath, { body: snapshotBody, frontmatter: snapshotFrontmatter });
        set({ lastSelfWrite: { path: filePath, at: Date.now() }, error: null });
        if (
          get().loadedPath === filePath &&
          get().body === snapshotBody &&
          get().frontmatter === snapshotFrontmatter
        ) {
          set({
            lastSavedBody: snapshotBody,
            lastSavedFrontmatter: snapshotFrontmatter,
            isDirty: false,
          });
        }
      } catch (err: any) {
        try { (navigator as any).vibrate?.([30, 20, 30]); } catch {}
        log.error("saveNow failed:", filePath, err?.message || String(err));
        set({ error: err?.message || String(err) });
      } finally {
        set({ isSaving: false });
      }
    });
    saveQueues.set(filePath, operation);
    try {
      await operation;
    } finally {
      if (saveQueues.get(filePath) === operation) saveQueues.delete(filePath);
    }
    return didWrite;
  },

  setSaved: () => {
    const { body, frontmatter } = get();
    set({
      lastSavedBody: body,
      lastSavedFrontmatter: frontmatter,
      isDirty: false,
    });
  },

  clearNote: () => {
    latestLoadRequestId++;
    set({
      loadedPath: null,
      frontmatter: null,
      lastSavedFrontmatter: null,
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

  resolveConflictKeepMine: async (path) => {
    const filePath = path ?? get().loadedPath;
    set({ hasConflict: false });
    if (!filePath) return;
    const { body, frontmatter } = get();
    await get().saveNow(filePath, { body, frontmatter });
  },

  toggleRawMode: () => {
    set((s) => ({ isRawMode: !s.isRawMode }));
  },

  setRawMode: (val: boolean) => {
    set({ isRawMode: val });
  },
}));
