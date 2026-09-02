import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";

export const EditorSurface: React.FC = () => {
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const openVaultDialog = useVaultStore((state) => state.openVaultDialog);
  const activePath = useTabStore((state) => state.activePath);
  const loadNote = useEditorStore((state) => state.loadNote);
  const updateBody = useEditorStore((state) => state.updateBody);
  const isLoading = useEditorStore((state) => state.isLoading);
  const error = useEditorStore((state) => state.error);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
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
      const storage = editor.storage as any;
      if (storage?.markdown?.getMarkdown) {
        const md = storage.markdown.getMarkdown();
        updateBody(md);
      }
    },
  });

  // When activePath changes, load file and set content
  useEffect(() => {
    if (!activePath || !editor) return;

    let cancelled = false;
    loadNote(activePath)
      .then((body) => {
        if (!cancelled && editor) {
          editor.commands.setContent(body);
        }
      })
      .catch((err) => {
        console.error("Failed to load note content:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [activePath, editor, loadNote]);

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
        <EditorContent editor={editor} />
      </div>
    </section>
  );
};
