import { useEditorStore } from "../stores/useEditorStore";
import { useTabStore } from "../stores/useTabStore";

/**
 * Persist the currently loaded note before navigating away or closing.
 * Always snapshots from the editor store so a concurrent load cannot
 * write the next note's body into the previous path.
 */
export async function flushActiveNote(): Promise<boolean> {
  const activePath = useTabStore.getState().activePath;
  if (!activePath) return true;

  const editor = useEditorStore.getState();
  if (!editor.isDirty && editor.loadedPath === activePath) return true;

  // Only flush the note that is actually loaded in the editor buffer.
  if (editor.loadedPath && editor.loadedPath !== activePath) {
    return !editor.isDirty;
  }

  const snapshot = { body: editor.body, frontmatter: editor.frontmatter };
  await editor.saveNow(activePath, snapshot);
  return !useEditorStore.getState().isDirty;
}
