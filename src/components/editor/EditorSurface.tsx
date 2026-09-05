import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { CustomCodeBlock } from "./extensions/CustomCodeBlock";
import { CustomTableBlock } from "./extensions/CustomTableBlock";
import { SearchHighlight } from "./extensions/SearchHighlight";
import { FrontmatterTable } from "./FrontmatterTable";
import { MarkdownOutline } from "./MarkdownOutline";
import { healEscapedMarkdown } from "../../utils/markdownUtils";
import { FindBar } from "./FindBar";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { useSpellCheckStore } from "../../stores/useSpellCheckStore";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { RawEditor } from "./RawEditor";
import { EditorBubbleMenu } from "./EditorBubbleMenu";

/**
 * Determines if a given href is an external web link that should open in the system default browser.
 */
function isExternalWebLink(href: string): boolean {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|ftp:|\/\/)/i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return false;
  if (trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return false;
  }
  // Detect domain pattern like example.com, github.com/user/repo
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(?:\.(?:com|org|net|io|dev|ai|app|co|me|edu|gov|uk|de|ca|jp|fr|au|in|info|biz|tv|cc|tech|xyz|online|site|page|link))(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)) {
    return true;
  }
  if (/^localhost(:\d+)?(?:[/?#].*)?$/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Opens any external link or non-markdown file in the system default browser or default application.
 */
async function openInExternalBrowser(href: string, activePath: string | null, vaultPath: string | null): Promise<void> {
  let target = href.trim();
  if (!target) return;

  // 1. Normalize protocol-relative or extensionless web domains
  if (target.startsWith("//")) {
    target = `https:${target}`;
  } else if (/^www\./i.test(target) || isExternalWebLink(target)) {
    if (!/^[a-zA-Z0-9+.-]+:\/\//.test(target) && !/^mailto:/i.test(target) && !/^tel:/i.test(target)) {
      target = `https://${target}`;
    }
  }

  // 2. If it's a web/email/phone URL, open in default browser using openUrl
  if (/^(https?:|mailto:|tel:)/i.test(target)) {
    try {
      await openUrl(target);
      return;
    } catch (err) {
      console.warn("openUrl failed, attempting window.open fallback:", err);
      try {
        window.open(target, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.error("Failed to open web link:", e);
      }
      return;
    }
  }

  // 3. For local non-markdown files (e.g. PDF, image, etc.), resolve path and open with system default app
  let filePath = target.replace(/^file:\/\//i, "");
  filePath = filePath.split("#")[0].split("?")[0].trim();
  try {
    filePath = decodeURIComponent(filePath);
  } catch {}

  if (vaultPath && !filePath.startsWith("/") && !/^[a-zA-Z0-9+.-]+:\/\//.test(filePath)) {
    const dir = activePath ? activePath.substring(0, activePath.lastIndexOf("/")) : vaultPath;
    const normalizedDir = (dir || vaultPath).replace(/\/+$/, "");
    filePath = `${normalizedDir}/${filePath}`;
  }

  // 4. Open local files via openPath (which opens the file in default OS application / browser)
  try {
    await openPath(filePath);
    return;
  } catch (err) {
    console.error("openPath failed for local file:", filePath, err);
  }
}

function resolveMarkdownLink(href: string, activePath: string | null, vaultPath: string | null): string | null {
  if (!href || !vaultPath) return null;

  // 1. Skip external web links
  if (isExternalWebLink(href)) return null;

  // 2. Remove file:// protocol if present
  let clean = href.trim().replace(/^file:\/\//i, "");

  // 3. Remove hash anchors and query params
  clean = clean.split("#")[0].split("?")[0].trim();
  if (!clean) return null;

  // 4. Skip external schemes
  if (/^[a-zA-Z0-9+.-]+:\/\//.test(clean) || /^(mailto:|tel:|ftp:)/i.test(clean)) return null;

  // 5. URL decode (e.g. %20 -> space)
  try {
    clean = decodeURIComponent(clean);
  } catch {}

  // 6. Check extension - skip known non-markdown files
  const lower = clean.toLowerCase();
  const knownNonMd = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".pdf", ".mp4", ".mov", ".zip", ".tar", ".gz",
    ".json", ".rs", ".ts", ".tsx", ".js", ".jsx",
    ".html", ".css", ".scss", ".wasm",
  ];
  if (knownNonMd.some((ext) => lower.endsWith(ext))) {
    return null;
  }

  // If no extension at all, append .md
  if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) {
    clean = clean + ".md";
  }

  // 7. Target path calculation
  let target: string;
  const normalizedVault = vaultPath.replace(/\/+$/, "");

  if (clean.startsWith(normalizedVault)) {
    // Already an absolute path inside the vault
    target = clean;
  } else if (clean.startsWith("/")) {
    // Check if it is an absolute path on filesystem
    if (
      clean.startsWith("/Users/") ||
      clean.startsWith("/home/") ||
      clean.startsWith("/Volumes/") ||
      clean.startsWith("/var/") ||
      clean.startsWith("/tmp/")
    ) {
      target = clean;
    } else {
      // Relative to vault root (e.g. /docs/intro.md)
      target = normalizedVault + clean;
    }
  } else {
    // Relative to active note's directory
    const dir = activePath ? activePath.substring(0, activePath.lastIndexOf("/")) : normalizedVault;
    target = (dir.replace(/\/+$/, "") || normalizedVault) + "/" + clean;
  }

  // 8. Normalize path (resolve . and ..)
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

function handleEditorLinkClick(e: MouseEvent, dom: HTMLElement | null): boolean {
  if (e.button !== 0) return false;
  const target = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
  if (!target) return false;
  const hrefAttr = target.getAttribute("href");
  if (!hrefAttr) return false;
  const href = hrefAttr.trim();
  if (!href) return false;

  // 1. In-page hash anchor (e.g. #heading)
  if (href.startsWith("#")) {
    e.preventDefault();
    e.stopPropagation();
    const slug = href.slice(1).toLowerCase();
    if (dom) {
      const headings = Array.from(dom.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      const match = headings.find(
        (h) => h.textContent?.trim().toLowerCase().replace(/\s+/g, "-") === slug
      );
      if (match) {
        match.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
    }
    return true;
  }

  const vaultPath = useVaultStore.getState().vaultPath;
  const curActive = useTabStore.getState().activePath;

  // 2. Explicit external web link -> open in external browser
  if (isExternalWebLink(href)) {
    e.preventDefault();
    e.stopPropagation();
    openInExternalBrowser(href, curActive, vaultPath).catch((err) =>
      console.error("Failed to open external link:", err)
    );
    return true;
  }

  // 3. Markdown note inside vault -> open in Snipnote tab
  const resolved = resolveMarkdownLink(href, curActive, vaultPath);
  if (resolved) {
    e.preventDefault();
    e.stopPropagation();
    const name = resolved.split("/").pop() || "Note";
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod) {
      useTabStore.getState().openInNewBackgroundTab(resolved, name);
    } else {
      useTabStore.getState().selectNote(resolved, name);
    }
    return true;
  }

  // 4. All other links (non-markdown files, custom schemes, etc.) -> open in external browser / default app
  e.preventDefault();
  e.stopPropagation();
  openInExternalBrowser(href, curActive, vaultPath).catch((err) =>
    console.error("Failed to open link:", err)
  );
  return true;
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
  const isProgrammaticUpdateRef = useRef(false);
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
      CustomTableBlock,
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
        if (!cd) return false;

        // 1. Handle image paste
        const items = cd.items;
        const hasImageItem = items && Array.from(items).some((it: any) => it.type.startsWith("image/"));
        if (hasImageItem) {
          const files = Array.from(cd?.files ?? []).filter((f: File) => f.type.startsWith("image/"));
          if (files.length > 0) {
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
          }
        }

        // 2. Handle markdown text paste
        const text = cd.getData("text/plain");
        const html = cd.getData("text/html");
        // Intercept plain text paste if it contains markdown formatting syntax or if no HTML present
        if (text && (!html || /[*_`#~\[\]>|\n]/.test(text))) {
          event.preventDefault();
          const cleanText = healEscapedMarkdown(text);
          const e = editor as any;
          if (e) {
            try {
              e.commands.insertContent(cleanText, { contentType: "markdown" });
            } catch {
              e.commands.insertContent(text);
            }
            const md = typeof e.getMarkdown === "function" ? e.getMarkdown() : "";
            updateBody(md);
            triggerAutoSave();
          }
          return true;
        }

        return false;
      },
      handleClick: (view: any, _pos: number, event: MouseEvent) => {
        if (event.defaultPrevented) return true;
        const dom = (view?.dom as HTMLElement | undefined) ?? null;
        return handleEditorLinkClick(event, dom);
      },
    },
    onUpdate: ({ editor }) => {
      if (isProgrammaticUpdateRef.current) return;
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

  // Esc from any sidebar/tab/status element returns focus to editor
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isFindOpen) return; // FindBar handles its own Esc
      const activeEl = document.activeElement as HTMLElement | null;
      const isInChrome = activeEl?.closest?.('[role="tree"], [role="tablist"], .sidebar, .tab-bar, .status-bar');
      if (isInChrome && editor) {
        e.preventDefault();
        try {
          editor.commands.focus();
        } catch {}
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [editor, isFindOpen]);

  // Capture-phase fallback for links: in-page anchors, markdown notes, and external browser links
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
      if (e.defaultPrevented) return;
      handleEditorLinkClick(e, dom);
    };
    dom.addEventListener("click", handler, true);
    return () => dom?.removeEventListener("click", handler, true);
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
      isProgrammaticUpdateRef.current = true;
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
      editor.commands.setContent("", { emitUpdate: false } as any);
      setTimeout(() => {
        isProgrammaticUpdateRef.current = false;
      }, 50);
      return;
    }

    let cancelled = false;
    loadNote(activePath)
      .then((body) => {
        if (!cancelled && editor) {
          isProgrammaticUpdateRef.current = true;
          try {
            const cleanBody = healEscapedMarkdown(body);
            const ed = editor as any;
            if (ed.markdown?.parse) {
              const parsedDoc = ed.markdown.parse(cleanBody);
              editor.commands.setContent(parsedDoc, { emitUpdate: false } as any);
            } else {
              (editor.commands as any).setContent(cleanBody, { contentType: "markdown", emitUpdate: false });
            }
          } finally {
            setTimeout(() => {
              isProgrammaticUpdateRef.current = false;
            }, 50);
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
      isProgrammaticUpdateRef.current = true;
      const ed = editor as any;
      try {
        const cleanBody = healEscapedMarkdown(body || "");
        if (ed.markdown?.parse) {
          const parsedDoc = ed.markdown.parse(cleanBody);
          editor.commands.setContent(parsedDoc, { emitUpdate: false } as any);
        } else {
          (editor.commands as any).setContent(cleanBody, { contentType: "markdown", emitUpdate: false });
        }
      } catch {}
      finally {
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 50);
      }
    }
  }, [isRawMode, body, editor]);

  if (!vaultPath) {
    return (
      <section className="editor-surface-container">
        <div className="editor-canvas">
          <div className="empty-state flex flex-col items-center justify-center gap-3 py-12 text-center">
            <h1 className="empty-title text-[18px] font-semibold">snipnote</h1>
            <p className="text-sm text-muted-foreground">The full-size local Markdown companion for Claude Code.</p>
            <Button onClick={openVaultDialog} className="mt-2">Open Local Vault</Button>
          </div>
        </div>
      </section>
    );
  }

  if (!activePath) {
    return (
      <section className="editor-surface-container">
        <div className="editor-canvas">
          <div className="empty-state flex flex-col items-center justify-center gap-3 py-12 text-center">
            <h2 className="empty-title text-[18px] font-semibold">No Note Selected</h2>
            <p className="text-sm text-muted-foreground">Select a markdown note from the sidebar or click + to start writing.</p>
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
          <RawEditor
            value={body}
            onChange={(val) => {
              updateBody(val);
              triggerAutoSave();
            }}
            spellCheck={spellCheckEnabled}
          />
        ) : (
          <>
            <EditorBubbleMenu editor={editor} isRawMode={isRawMode} />
            <EditorContent editor={editor} />
          </>
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
