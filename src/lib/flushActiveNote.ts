import { useEditorStore } from "../stores/useEditorStore";
import { useTabStore } from "../stores/useTabStore";
import { isVirtualTab } from "./specialTabs";

/**
 * Persist the currently loaded note before navigating away or closing.
 * Always snapshots from the editor store so a concurrent load cannot
 * write the next note's body into the previous path.
 *
 * Drafts prompt for name + location; cancel keeps the draft in memory
 * and still allows navigation.
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
  if (!editor.isDirty && editor.loadedPath === pathToFlush) return true;

  // Only flush the note that is actually loaded in the editor buffer.
  if (editor.loadedPath && editor.loadedPath !== pathToFlush) {
    return !editor.isDirty;
  }

  const snapshot = { body: editor.body, frontmatter: editor.frontmatter };
  await editor.saveNow(pathToFlush, snapshot, { promptDraft: true });

  const tab = useTabStore.getState().tabs.find((t) => t.path === pathToFlush);
  // Unsaved drafts may remain dirty-in-memory after cancel; never block navigation.
  if (tab?.isNew) return true;

  return !useEditorStore.getState().isDirty;
}
