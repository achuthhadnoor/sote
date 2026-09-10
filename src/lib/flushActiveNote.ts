import {
  forgetDraftBuffer,
  readDraftBuffer,
  useEditorStore,
} from "../stores/useEditorStore";
import { useSidebarActionsStore } from "../stores/useSidebarActionsStore";
import { useTabStore } from "../stores/useTabStore";
import { isBlankNoteMarkdown } from "../utils/noteContent";
import { pathBasename } from "../utils/paths";
import { isVirtualTab } from "./specialTabs";

function draftHasContent(body: string, frontmatter: string | null | undefined): boolean {
  return !isBlankNoteMarkdown(body) || !!frontmatter?.trim().length;
}

/**
 * Persist the currently loaded note before navigating away.
 * Always snapshots from the editor store so a concurrent load cannot
 * write the next note's body into the previous path.
 *
 * Drafts with content prompt for name + location even after in-memory
 * autosave cleared `isDirty`. Cancel keeps the draft and still allows
 * navigation (use {@link flushBeforeClose} when closing a tab).
 */
export async function flushActiveNote(): Promise<boolean> {
  const activePath = useTabStore.getState().activePath;
  const editor = useEditorStore.getState();

  // Virtual tabs (e.g. Settings) are not files — flush the loaded note if dirty.
  const pathToFlush =
    activePath && !isVirtualTab(activePath)
      ? activePath
      : editor.loadedPath && !isVirtualTab(editor.loadedPath)
        ? editor.loadedPath
        : null;

  if (!pathToFlush) return true;

  const tab = useTabStore.getState().tabs.find((t) => t.path === pathToFlush);
  const needsDraftPrompt =
    !!tab?.isNew && draftHasContent(editor.body, editor.frontmatter);

  if (!editor.isDirty && editor.loadedPath === pathToFlush && !needsDraftPrompt) {
    return true;
  }

  // Only flush the note that is actually loaded in the editor buffer.
  if (editor.loadedPath && editor.loadedPath !== pathToFlush) {
    return !editor.isDirty;
  }

  const snapshot = { body: editor.body, frontmatter: editor.frontmatter };
  await editor.saveNow(pathToFlush, snapshot, { promptDraft: true });

  // Unsaved drafts may remain after cancel; never block navigation.
  const tabAfter = useTabStore.getState().tabs.find((t) => t.path === pathToFlush);
  if (tabAfter?.isNew) return true;

  return !useEditorStore.getState().isDirty;
}

/**
 * Prepare a tab for close. Empty drafts discard silently. Drafts with
 * content ask Save / Discard / Cancel; Save opens the name dialog.
 * Existing notes flush dirty buffers to disk.
 */
export async function flushBeforeClose(path: string): Promise<boolean> {
  if (isVirtualTab(path)) return true;

  const tab = useTabStore.getState().tabs.find((t) => t.path === path);
  if (!tab) return true;

  const editor = useEditorStore.getState();
  const fromEditor = editor.loadedPath === path;
  const buf = fromEditor ? null : readDraftBuffer(path);
  const body = fromEditor ? editor.body : (buf?.body ?? "");
  const frontmatter = fromEditor ? editor.frontmatter : (buf?.frontmatter ?? null);

  if (tab.isNew) {
    if (!draftHasContent(body, frontmatter)) {
      forgetDraftBuffer(path);
      return true;
    }

    const choice = await useSidebarActionsStore
      .getState()
      .requestCloseDraftChoice(tab.title || pathBasename(path) || "Untitled.md");

    if (choice === "cancel") return false;

    if (choice === "discard") {
      forgetDraftBuffer(path);
      return true;
    }

    // Save → name/location dialog
    await useEditorStore.getState().saveNow(path, { body, frontmatter }, { promptDraft: true });
    const stillDraft = useTabStore.getState().tabs.find((t) => t.path === path)?.isNew;
    return !stillDraft;
  }

  if (fromEditor && editor.isDirty) {
    await useEditorStore.getState().saveNow(path, { body, frontmatter });
    return !useEditorStore.getState().isDirty;
  }

  return true;
}
