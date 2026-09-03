import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { CustomCodeBlock } from "./extensions/CustomCodeBlock";
import { SearchHighlight } from "./extensions/SearchHighlight";
import { FrontmatterTable } from "./FrontmatterTable";
import { MarkdownOutline } from "./MarkdownOutline";
import { FindBar } from "./FindBar";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { useSpellCheckStore } from "../../stores/useSpellCheckStore";
import { openPath } from "@tauri-apps/plugin-opener";

function resolveMarkdownLink(href: string, activePath: string | null, vaultPath: string | null): string | null {
  const clean = href.split("#")[0].split("?")[0].trim();
  if (!clean) return null;
  if (/^(https?:|mailto:|ftp:|\/\/)/i.test(clean)) return null;
  const lower = clean.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) return null;
  if (!vaultPath) return null;
  let target: string;
  if (clean.startsWith("/")) {
    target = vaultPath.replace(/\/+$/, "") + clean;
  } else {
    const dir = activePath ? activePath.substring(0, activePath.lastIndexOf("/")) : vaultPath;
    target = (dir.replace(/\/+$/, "") || vaultPath) + "/" + clean;
  }
  const parts: string[] = [];
  for (const p of target.split("/")) {
    if (p === "" || p === ".") {
      if (parts.length === 0) parts.push("");
      continue;
    }
    if (p === "..") {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(p);
  }
  return parts.join("/") || "/";
}

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
  const isRawMode = useEditorStore((state) => state.isRawMode);
  const body = useEditorStore((state) => state.body);

  const activeTab = tabs.find((t) => t.path === activePath);
  const isNewDraft = !!activeTab?.isNew;

  const activePathRef = useRef<string | null>(activePath);
  activePathRef.current = activePath;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);

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
        link: false,
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      CustomCodeBlock,
      SearchHighlight,
      Link.configure({
        openOnClick: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "snipnote-image",
        },
      }),
      Markdown,
    ],
    editorProps: {
      attributes: {
        class: "snipnote-editor-content",
        spellcheck: spellCheckEnabled ? "true" : "false",
      },
      handleDrop: (view: any, event: DragEvent, _slice: any, _moved: boolean) => {
        const files = (event as any).dataTransfer?.files as FileList | undefined;
        if (!files || files.length === 0) return false;
        const imageFiles = Array.from(files).filter((f: File) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        imageFiles.forEach((file: File) => {
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const pos = view.posAtCoords({ left: (event as any).clientX, top: (event as any).clientY })?.pos;
            const e = editor as any;
            if (!e) return;
            if (typeof pos === "number") {
              e.chain().setTextSelection(pos).setImage({ src, alt: file.name }).run();
            } else {
              e.chain().focus().setImage({ src, alt: file.name }).run();
            }
            const md = typeof e.getMarkdown === "function" ? e.getMarkdown() : "";
            updateBody(md);
            triggerAutoSave();
          };
          reader.readAsDataURL(file);
        });
        return true;
      },
      handlePaste: (_view: any, event: ClipboardEvent, _slice: any) => {
        const cd = event.clipboardData as DataTransfer | null;
        const items = cd?.items;
        if (!items) return false;
        const hasImageItem = Array.from(items).some((it: any) => it.type.startsWith("image/"));
        if (!hasImageItem) return false;
        const files = Array.from(cd?.files ?? []).filter((f: File) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file: File) => {
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const e = editor as any;
            if (!e) return;
            e.chain().focus().setImage({ src, alt: file.name }).run();
            const md = typeof e.getMarkdown === "function" ? e.getMarkdown() : "";
            updateBody(md);
            triggerAutoSave();
          };
          reader.readAsDataURL(file);
        });
        return true;
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

  // Find bar shortcuts: Cmd+F open, Shift+Cmd+F toggle replace
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (!activePath) return;
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (e.shiftKey) {
          setIsFindOpen(true);
          setShowReplace((prev) => !prev);
        } else {
          setIsFindOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePath]);

  const handleFindClose = () => {
    setIsFindOpen(false);
    try {
      (editor as any)?.chain()?.clearSearch?.()?.run();
    } catch {}
    try {
      setTimeout(() => editor?.commands.focus(), 30);
    } catch {}
  };

  useEffect(() => {
    try {
      const dom = (editor as any)?.view?.dom as HTMLElement | undefined;
      if (dom) dom.setAttribute("spellcheck", spellCheckEnabled ? "true" : "false");
    } catch {}
  }, [spellCheckEnabled, editor]);

  useEffect(() => {
    if (isFindOpen) {
      setIsFindOpen(false);
      try {
        (editor as any)?.chain()?.clearSearch?.()?.run();
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, isRawMode]);

  // Click on .md links → open in snipnote (normal) or new background tab (Cmd/Ctrl+Click); external links via opener
  useEffect(() => {
    if (!editor) return;
    let dom: HTMLElement | null = null;
    try {
      dom = (editor as any)?.view?.dom as HTMLElement | undefined ?? null;
    } catch {
      dom = null;
    }
    if (!dom) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
      if (!target) return;
      const hrefAttr = target.getAttribute("href");
      if (!hrefAttr) return;
      const href = hrefAttr.trim();
      if (!href) return;
      // External -> opener
      if (/^(https?:|mailto:|ftp:|\/\/)/i.test(href)) {
        e.preventDefault();
        openPath(href).catch(() => {});
        return;
      }
      const cleanCheck = href.split("#")[0].split("?")[0].toLowerCase();
      const isMd = cleanCheck.endsWith(".md") || cleanCheck.endsWith(".markdown");
      if (!isMd) return;
      e.preventDefault();
      e.stopPropagation();
      const vaultPath = useVaultStore.getState().vaultPath;
      const curActive = useTabStore.getState().activePath;
      const resolved = resolveMarkdownLink(href, curActive, vaultPath);
      if (!resolved) return;
      const name = resolved.split("/").pop() || "Note";
      const isMod = (e as MouseEvent & { metaKey: boolean; ctrlKey: boolean }).metaKey || (e as any).ctrlKey;
      if (isMod) {
        useTabStore.getState().openInNewBackgroundTab(resolved, name);
      } else {
        useTabStore.getState().selectNote(resolved, name);
      }
    };
    dom.addEventListener("click", handler);
    return () => dom?.removeEventListener("click", handler);
  }, [editor]);

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

  // When toggling from raw → rich, sync editor content from body
  const prevRawRef = useRef(isRawMode);
  useEffect(() => {
    const wasRaw = prevRawRef.current;
    prevRawRef.current = isRawMode;
    if (wasRaw && !isRawMode && editor) {
      const ed = editor as any;
      try {
        if (ed.markdown?.parse) {
          const parsedDoc = ed.markdown.parse(body || "");
          editor.commands.setContent(parsedDoc);
        } else {
          (editor.commands as any).setContent(body || "", { contentType: "markdown" });
        }
      } catch {}
    }
  }, [isRawMode, body, editor]);

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
        {isRawMode ? (
          <textarea
            className="raw-editor"
            value={body}
            onChange={(e) => {
              updateBody(e.target.value);
              triggerAutoSave();
            }}
            placeholder="Raw markdown…"
            spellCheck={spellCheckEnabled}
            autoFocus
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
      {/* Floating outline — horizontal dashes at right center, expand on hover */}
      <MarkdownOutline editor={editor} body={body} isRawMode={isRawMode} />
      {!isRawMode && (
        <FindBar
          editor={editor}
          isOpen={isFindOpen}
          showReplace={showReplace}
          onClose={handleFindClose}
          onToggleReplace={() => setShowReplace((v) => !v)}
        />
      )}
    </section>
  );
};
