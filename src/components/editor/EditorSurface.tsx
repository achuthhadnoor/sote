import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import { CustomCodeBlock } from "./extensions/CustomCodeBlock";
import { FrontmatterTable } from "./FrontmatterTable";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";

export const EditorSurface: React.FC = () => {
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const openVaultDialog = useVaultStore((state) => state.openVaultDialog);
  const activePath = useTabStore((state) => state.activePath);
  const tabs = useTabStore((state) => state.tabs);
  const loadNote = useEditorStore((state) => state.loadNote);
  const updateBody = useEditorStore((state) => state.updateBody);
  const saveNow = useEditorStore((state) => state.saveNow);
  const isLoading = useEditorStore((state) => state.isLoading);
  const error = useEditorStore((state) => state.error);
  const reloadCount = useEditorStore((state) => state.reloadCount);

  const activeTab = tabs.find((t) => t.path === activePath);
  const isNewDraft = !!activeTab?.isNew;

  const activePathRef = useRef<string | null>(activePath);
  activePathRef.current = activePath;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePostSave = async (path: string, wasNew: boolean) => {
    // wasNew draft now has content and was saved -> promote to real file
    const stillDirty = useEditorStore.getState().isDirty;
    if (wasNew && !stillDirty) {
      useTabStore.getState().markTabSaved(path);
      const vp = useVaultStore.getState().vaultPath;
      if (vp) {
        // reload tree to show newly created file (watcher echo is suppressed)
        await useVaultStore.getState().loadVault(vp);
      }
    }
  };

  const triggerAutoSave = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      const path = activePathRef.current;
      if (!path) return;
      const tab = useTabStore.getState().tabs.find((t) => t.path === path);
      const wasNew = !!tab?.isNew;
      const { body, frontmatter } = useEditorStore.getState();
      const hasContent = body.trim().length > 0 || (frontmatter && frontmatter.trim().length > 0);
      if (wasNew && !hasContent) return;
      await saveNow(path);
      await handlePostSave(path, wasNew);
    }, 500);
  };

  const editor = useEditor({
    contentType: "markdown",
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      CustomCodeBlock,
      Link.configure({
        openOnClick: false,
      }),
      Markdown,
    ],
    editorProps: {
      attributes: {
        class: "snipnote-editor-content",
      },
    },
    onUpdate: ({ editor }) => {
      const ed = editor as any;
      const md = typeof ed.getMarkdown === "function"
        ? ed.getMarkdown()
        : ed.storage?.markdown?.manager?.serialize?.(editor.getJSON()) || "";
      updateBody(md);
      triggerAutoSave();
    },
  });

  // Flush save on window blur or beforeunload (respects draft-no-content guard)
  useEffect(() => {
    const handleFlush = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const path = activePathRef.current;
      if (!path || !useEditorStore.getState().isDirty) return;
      const tab = useTabStore.getState().tabs.find((t) => t.path === path);
      const wasNew = !!tab?.isNew;
      const { body, frontmatter } = useEditorStore.getState();
      const hasContent = body.trim().length > 0 || (frontmatter && frontmatter.trim().length > 0);
      if (wasNew && !hasContent) return;
      // fire and handle post-save async
      saveNow(path).then(() => handlePostSave(path, wasNew));
    };

    window.addEventListener("blur", handleFlush);
    window.addEventListener("beforeunload", handleFlush);

    return () => {
      handleFlush();
      window.removeEventListener("blur", handleFlush);
      window.removeEventListener("beforeunload", handleFlush);
    };
  }, [saveNow]);

  // When activePath changes, flush previous note (if has content) and load new note
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathRef.current && prevPathRef.current !== activePath) {
      const prev = prevPathRef.current;
      if (prev && useEditorStore.getState().isDirty) {
        const tab = useTabStore.getState().tabs.find((t) => t.path === prev);
        const wasNew = !!tab?.isNew;
        const { body, frontmatter } = useEditorStore.getState();
        const hasContent = body.trim().length > 0 || (frontmatter && frontmatter.trim().length > 0);
        if (!(wasNew && !hasContent)) {
          saveNow(prev).then(() => handlePostSave(prev, wasNew));
        }
      }
    }
    prevPathRef.current = activePath;

    if (!activePath || !editor) return;

    // Draft new note: no file on disk yet, init empty
    if (isNewDraft) {
      useEditorStore.setState({
        frontmatter: null,
        lastSavedFrontmatter: null,
        body: "",
        lastSavedBody: "",
        isDirty: false,
        isLoading: false,
        error: null,
        hasConflict: false,
      } as any);
      editor.commands.setContent("");
      return;
    }

    let cancelled = false;
    loadNote(activePath)
      .then((body) => {
        if (!cancelled && editor) {
          const ed = editor as any;
          if (ed.markdown?.parse) {
            const parsedDoc = ed.markdown.parse(body);
            editor.commands.setContent(parsedDoc);
          } else {
            (editor.commands as any).setContent(body, { contentType: "markdown" });
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load note content:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [activePath, isNewDraft, reloadCount, editor, loadNote, saveNow]);

  if (!vaultPath) {
    return (
      <section className="editor-surface-container">
        <div className="editor-canvas">
          <div className="empty-state">
            <h1 className="empty-title">snipnote</h1>
            <p>The full-size local Markdown companion for Claude Code.</p>
            <button className="btn-primary" onClick={openVaultDialog}>
              Open Local Vault
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!activePath) {
    return (
      <section className="editor-surface-container">
        <div className="editor-canvas">
          <div className="empty-state">
            <h2 className="empty-title">No Note Selected</h2>
            <p>Select a markdown note from the sidebar or click + to start writing.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="editor-surface-container">
      <div className="editor-canvas">
        {isLoading && (
          <div style={{ padding: "16px 0", color: "var(--muted-fg)", fontSize: "13px" }}>
            Loading note...
          </div>
        )}
        {error && (
          <div style={{ padding: "16px 0", color: "var(--destructive)", fontSize: "13px" }}>
            Failed to read note: {error}
          </div>
        )}
        <FrontmatterTable onAutoSaveTrigger={triggerAutoSave} />
        <EditorContent editor={editor} />
      </div>
    </section>
  );
};
