import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
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
import { formatMarkdownLinkDestination, prepareMarkdownForEditor } from "../../utils/markdownUtils";
import { FindBar } from "./FindBar";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { useSpellCheckStore } from "../../stores/useSpellCheckStore";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";
import { RawEditor } from "./RawEditor";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { HomeView } from "./HomeView";
import { SettingsView } from "../settings/SettingsView";
import { createLogger } from "../../lib/logger";
import { flushActiveNote } from "../../lib/flushActiveNote";
import { isSettingsTab, isVirtualTab } from "../../lib/specialTabs";
import { isMac } from "../../utils/platform";
import {
  isAbsoluteFsPath,
  isHostAbsolutePath,
  nextUntitledNotePath,
  normalizeFsPath,
  pathBasename,
  pathDirname,
  pathJoin,
} from "../../utils/paths";
import { useNarrowLayout } from "../../hooks/useNarrowLayout";

const log = createLogger("editor-surface");
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

/** Strip scheme/hash/query and decode so path checks work on marked output. */
function hrefPathOnly(href: string): string {
  let clean = href.trim().replace(/^file:\/\//i, "");
  clean = clean.split("#")[0].split("?")[0].trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* keep raw */
  }
  return clean;
}

function isMarkdownNoteHref(href: string): boolean {
  const path = hrefPathOnly(href);
  if (!path) return false;
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

/**
 * Determines if a given href is an external web link that should open in the system default browser.
 */
function isExternalWebLink(href: string): boolean {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|ftp:|\/\/)/i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (isMarkdownNoteHref(trimmed)) return false;
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
 * Never opens `.md` / `.markdown` notes — those stay in snipnote.
 */
async function openInExternalBrowser(href: string, activePath: string | null, vaultPath: string | null): Promise<void> {
  let target = href.trim();
  if (!target) return;
  if (isMarkdownNoteHref(target)) {
    log.warn("Refusing to open markdown note in external app:", target);
    return;
  }

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
      log.warn("openUrl failed, attempting window.open fallback:", err);
      try {
        window.open(target, "_blank", "noopener,noreferrer");
      } catch (e) {
        log.error("Failed to open web link:", e);
      }
      return;
    }
  }

  // 3. For local non-markdown files (e.g. PDF, image, etc.), resolve path and open with system default app
  let filePath = hrefPathOnly(target);
  if (!filePath) return;
  if (isMarkdownNoteHref(filePath)) return;

  if (vaultPath && !isAbsoluteFsPath(filePath) && !/^[a-zA-Z0-9+.-]+:\/\//.test(filePath)) {
    const dir = activePath ? pathDirname(activePath) : vaultPath;
    filePath = pathJoin(dir || vaultPath, filePath);
  }

  // 4. Open local files via openPath (which opens the file in default OS application / browser)
  try {
    await openPath(filePath);
    return;
  } catch (err) {
    log.error("openPath failed for local file:", filePath, err);
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
  } catch {
    /* keep raw */
  }

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
  const normalizedVault = vaultPath.replace(/[/\\]+$/, "");

  if (
    clean === normalizedVault ||
    clean.startsWith(normalizedVault + "/") ||
    clean.startsWith(normalizedVault + "\\")
  ) {
    // Already an absolute path inside the vault
    target = clean;
  } else if (clean.startsWith("/")) {
    // Vault-root relative (e.g. /docs/intro.md). Leading `/` is also a Unix
    // absolute shape — prefer vault policy unless already under the vault above.
    target = pathJoin(normalizedVault, clean.replace(/^[/\\]+/, ""));
  } else if (isHostAbsolutePath(clean)) {
    // Windows drive / UNC (and any other non-`/` absolute form)
    target = clean;
  } else {
    // Relative to active note's directory
    const dir = activePath ? pathDirname(activePath) : normalizedVault;
    target = pathJoin(dir.replace(/[/\\]+$/, "") || normalizedVault, clean);
  }

  // 8. Normalize path (resolve . and ..)
  return normalizeFsPath(target);
}

/** Ignore duplicate click/auxclick deliveries within a short window. */
let lastLinkNavAt = 0;
let lastLinkNavKey = "";
function shouldSkipDuplicateLinkNav(key: string): boolean {
  const now = Date.now();
  if (key === lastLinkNavKey && now - lastLinkNavAt < 500) return true;
  lastLinkNavKey = key;
  lastLinkNavAt = now;
  return false;
}

function handleEditorLinkClick(e: MouseEvent, dom: HTMLElement | null): boolean {
  if (e.button !== 0) return false;
  const target = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
  if (!target) return false;
  // Prefer the authored href; DOM `.href` is absolute and can re-trigger OS open.
  const hrefAttr = target.getAttribute("href");
  if (!hrefAttr) return false;
  const href = hrefAttr.trim();
  if (!href) return false;

  // Always stop the webview from following <a href> (Cmd/Ctrl-click otherwise opens
  // the browser, and target=_blank would open a second window).
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }

  const isMod = e.metaKey || e.ctrlKey;
  const vaultPath = useVaultStore.getState().vaultPath;
  const curActive = useTabStore.getState().activePath;

  // 1. In-page hash anchor (e.g. #heading) — follow with ⌘/Ctrl-click
  if (href.startsWith("#")) {
    if (!isMod) return true;
    if (shouldSkipDuplicateLinkNav(href)) return true;
    const slug = href.slice(1).toLowerCase();
    if (dom) {
      const headings = Array.from(dom.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      const match = headings.find(
        (h) => h.textContent?.trim().toLowerCase().replace(/\s+/g, "-") === slug
      );
      if (match) {
        match.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    return true;
  }

  // 2. Markdown note inside the folder — ⌘/Ctrl-click opens in snipnote (never the browser)
  const resolved = resolveMarkdownLink(href, curActive, vaultPath);
  if (resolved || isMarkdownNoteHref(href)) {
    if (!isMod) return true;
    if (!resolved) {
      log.warn("Could not resolve markdown link inside folder:", href);
      return true;
    }
    if (shouldSkipDuplicateLinkNav(resolved)) return true;
    const name = pathBasename(resolved) || "Note";
    void flushActiveNote().then((ok) => {
      if (ok) useTabStore.getState().selectNote(resolved, name);
    });
    return true;
  }

  // 3. External web links — open in the system browser (plain or modified click)
  if (isExternalWebLink(href)) {
    if (shouldSkipDuplicateLinkNav(href)) return true;
    openInExternalBrowser(href, curActive, vaultPath).catch((err) =>
      log.error("Failed to open external link:", err)
    );
    return true;
  }

  // 4. Other local files (PDF, images, etc.) — ⌘/Ctrl-click opens in the default app
  if (!isMod) return true;
  if (shouldSkipDuplicateLinkNav(href)) return true;
  openInExternalBrowser(href, curActive, vaultPath).catch((err) =>
    log.error("Failed to open link:", err)
  );
  return true;
}

/** Load markdown into the TipTap editor (prefer extension parse, else contentType). */
function setEditorMarkdown(editor: Editor, body: string): void {
  const cleanBody = prepareMarkdownForEditor(body);
  const ed = editor as any;
  if (ed.markdown?.parse) {
    const parsedDoc = ed.markdown.parse(cleanBody);
    editor.commands.setContent(parsedDoc, { emitUpdate: false } as any);
  } else {
    (editor.commands as any).setContent(cleanBody, { contentType: "markdown", emitUpdate: false });
  }
}

export const EditorSurface: React.FC = () => {
  const vaultPath = useVaultStore((state) => state.vaultPath);
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
  const dockOutline = useNarrowLayout();
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);

  type PendingSave = { path: string; wasNew: boolean; body: string; frontmatter: string | null };
  const pendingSaveRef = useRef<PendingSave | null>(null);

  const handlePostSave = useCallback(async (path: string, wasNew: boolean, didWrite: boolean) => {
    // wasNew draft now has content and was saved -> promote to real file
    if (wasNew && didWrite) {
      useTabStore.getState().markTabSaved(path);
      const vp = useVaultStore.getState().vaultPath;
      if (vp) {
        // reload tree to show newly created file (watcher echo is suppressed)
        await useVaultStore.getState().loadVault(vp);
      }
    }
  }, []);

  const flushPendingAutoSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
    pendingSaveRef.current = null;
    if (!pending) return false;
    const didWrite = await saveNow(pending.path, {
      body: pending.body,
      frontmatter: pending.frontmatter,
    });
    if (didWrite) await handlePostSave(pending.path, pending.wasNew, true);
    return didWrite;
  }, [handlePostSave, saveNow]);

  const triggerAutoSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const path = activePathRef.current;
    if (!path) return;
    const tab = useTabStore.getState().tabs.find((t) => t.path === path);
    const { body, frontmatter } = useEditorStore.getState();
    const pending: PendingSave = { path, wasNew: !!tab?.isNew, body, frontmatter };
    pendingSaveRef.current = pending;
    debounceTimerRef.current = setTimeout(async () => {
      if (pendingSaveRef.current !== pending) return;
      pendingSaveRef.current = null;
      debounceTimerRef.current = null;
      const didWrite = await saveNow(path, { body, frontmatter });
      if (didWrite) await handlePostSave(path, pending.wasNew, true);
    }, 500);
  }, [handlePostSave, saveNow]);

  const editor = useEditor({
    contentType: "markdown",
    shouldRerenderOnTransaction: false,
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
      Link.extend({
        renderMarkdown(node, helpers) {
          const href = String(node.attrs?.href ?? "");
          const title = (node.attrs?.title as string | null | undefined) ?? null;
          const text = helpers.renderChildren(node);
          return `[${text}](${formatMarkdownLinkDestination(href, title)})`;
        },
      }).configure({
        openOnClick: false,
        // TipTap defaults to target="_blank", which opens a second window/tab
        // alongside our in-app / openUrl handling.
        HTMLAttributes: {
          target: null,
          rel: null,
          class: null,
        },
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
        class: "snipnote-editor-content prose dark:prose-invert max-w-none focus:outline-none",
        spellcheck: spellCheckEnabled ? "true" : "false",
      },
      handleDrop: (view: any, event: DragEvent, _slice: any, _moved: boolean) => {
        const files = (event as any).dataTransfer?.files as FileList | undefined;
        if (!files || files.length === 0) return false;
        const imageFiles = Array.from(files).filter((f: File) => f.type.startsWith("image/") && f.size <= MAX_INLINE_IMAGE_BYTES);
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
          const files = Array.from(cd?.files ?? []).filter((f: File) => f.type.startsWith("image/") && f.size <= MAX_INLINE_IMAGE_BYTES);
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
          const cleanText = prepareMarkdownForEditor(text);
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
      // Stop webview default navigation on click; TipTap's default target=_blank
      // is disabled above so we never open twice.
      handleDOMEvents: {
        click: (view: any, event: MouseEvent) => {
          return handleEditorLinkClick(event, (view?.dom as HTMLElement | undefined) ?? null);
        },
        auxclick: (_view: any, event: MouseEvent) => {
          // Middle-click on .md links should open a background tab, never the browser.
          if (event.button !== 1) return false;
          const target = (event.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
          if (!target?.getAttribute("href")) return false;
          event.preventDefault();
          event.stopPropagation();
          const href = target.getAttribute("href")!.trim();
          if (!href || href.startsWith("#") || isExternalWebLink(href)) return true;
          const vaultPath = useVaultStore.getState().vaultPath;
          const curActive = useTabStore.getState().activePath;
          const resolved = resolveMarkdownLink(href, curActive, vaultPath);
          if (resolved || isMarkdownNoteHref(href)) {
            if (!resolved) return true;
            if (shouldSkipDuplicateLinkNav(`aux:${resolved}`)) return true;
            const name = pathBasename(resolved) || "Note";
            useTabStore.getState().openInNewBackgroundTab(resolved, name);
            return true;
          }
          return true;
        },
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

  // Gate view-dependent overlays until the ProseMirror view is mounted.
  // `useEditor` returns the instance before its view exists (mount happens in
  // an effect), and EditorSurface can now first render with vault data already
  // present (lazy chunk resolves after session restore) — rendering
  // <BubbleMenu> against the unmounted instance throws "editor view is not
  // available". This effect is declared after useEditor's internals, so it
  // runs after the mount for the same commit. <EditorContent> below must
  // always render: it provides the DOM node the view mounts into.
  const [editorReady, setEditorReady] = useState(false);
  useEffect(() => {
    setEditorReady(!!editor);
    return () => setEditorReady(false);
  }, [editor]);

  // Find bar shortcuts: Cmd+F open, Shift+Cmd+F toggle replace
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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

  // Flush save on window blur or beforeunload (respects draft-no-content guard)
  useEffect(() => {
    const handleFlush = () => {
      void flushPendingAutoSave().then((didWrite) => {
        if (didWrite || !activePathRef.current || !useEditorStore.getState().isDirty) return;
        const path = activePathRef.current;
        const tab = useTabStore.getState().tabs.find((t) => t.path === path);
        void saveNow(path).then((written) => {
          if (written) return handlePostSave(path, !!tab?.isNew, true);
        });
      });
    };

    window.addEventListener("blur", handleFlush);
    window.addEventListener("beforeunload", handleFlush);

    return () => {
      handleFlush();
      window.removeEventListener("blur", handleFlush);
      window.removeEventListener("beforeunload", handleFlush);
    };
  }, [flushPendingAutoSave, handlePostSave, saveNow]);

  // When activePath changes, snapshot+flush previous note BEFORE loading the next
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPathRef.current;
    let snapshotForPrev: { body: string; frontmatter: string | null } | null = null;
    let wasNewPrev = false;

    if (prev && prev !== activePath) {
      if (isVirtualTab(prev)) {
        // Virtual tabs have no file buffer to flush.
      } else {
        const pending = pendingSaveRef.current;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pendingSaveRef.current = null;

        if (pending && pending.path === prev) {
          snapshotForPrev = { body: pending.body, frontmatter: pending.frontmatter };
          wasNewPrev = pending.wasNew;
        } else {
          const state = useEditorStore.getState();
          // Only use live buffer when it still belongs to the previous path
          if (!state.loadedPath || state.loadedPath === prev) {
            snapshotForPrev = { body: state.body, frontmatter: state.frontmatter };
            wasNewPrev = !!useTabStore.getState().tabs.find((t) => t.path === prev)?.isNew;
          }
        }
      }
    }
    prevPathRef.current = activePath;

    if (!activePath || !editor) return;

    let cancelled = false;

    const run = async () => {
      if (prev && snapshotForPrev && prev !== activePath && !isVirtualTab(prev)) {
        const didWrite = await saveNow(prev, snapshotForPrev);
        if (didWrite) await handlePostSave(prev, wasNewPrev, true);
      }
      if (cancelled) return;

      // Settings (and other virtual tabs) are not notes — keep prior buffer loaded.
      if (isVirtualTab(activePath)) return;

      // Draft new note: no file on disk yet, init empty
      if (isNewDraft) {
        isProgrammaticUpdateRef.current = true;
        useEditorStore.setState({
          loadedPath: activePath,
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

      try {
        const body = await loadNote(activePath);
        if (cancelled || !editor) return;
        isProgrammaticUpdateRef.current = true;
        try {
          setEditorMarkdown(editor, body);
        } finally {
          setTimeout(() => {
            isProgrammaticUpdateRef.current = false;
          }, 50);
        }
      } catch (err) {
        log.error("Failed to load note content:", err);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activePath, isNewDraft, reloadCount, editor, loadNote, saveNow, handlePostSave]);

  // When toggling from raw → rich, sync editor content from body
  const prevRawRef = useRef(isRawMode);
  useEffect(() => {
    const wasRaw = prevRawRef.current;
    prevRawRef.current = isRawMode;
    if (wasRaw && !isRawMode && editor) {
      isProgrammaticUpdateRef.current = true;
      try {
        setEditorMarkdown(editor, body || "");
      } catch (err) {
        log.warn("Failed to sync editor from raw body:", err);
      } finally {
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 50);
      }
    }
  }, [isRawMode, body, editor]);

  if (isSettingsTab(activePath)) {
    return <SettingsView />;
  }

  if (!vaultPath) {
    return (
      <section className="flex-1 overflow-y-auto flex justify-center items-center py-12 px-8" data-editor-scroll>
        <div className="text-[13px] text-muted-foreground">Open a folder to start writing.</div>
      </section>
    );
  }

  if (!activePath) {
    const handleHomeNewNote = () => {
      const vp = useVaultStore.getState().vaultPath;
      if (!vp) return;
      const collectPaths = (nodes: any[]): string[] => {
        const out: string[] = [];
        for (const n of nodes) {
          if (!n.isDirectory) out.push(n.path);
          if (n.children) out.push(...collectPaths(n.children));
        }
        return out;
      };
      const existing = new Set<string>([
        ...collectPaths(useVaultStore.getState().tree as any),
        ...useTabStore.getState().tabs.map((t) => t.path),
      ]);
      const { name, path } = nextUntitledNotePath(vp, existing);
      useTabStore.getState().selectNote(path, name, { isNew: true });
    };
    return <HomeView onNewNote={handleHomeNewNote} />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      <section
        className={
          isRawMode
            ? "flex-1 min-h-0 overflow-hidden flex flex-col relative pt-4 "
            : "flex-1 min-h-0 overflow-y-auto flex justify-center items-center py-12 px-8 sm:px-6 relative scroll-smooth"
        }
        data-editor-scroll
      >
        <div
          className={
            isRawMode
              ? "w-full h-full min-h-0 type-editor flex flex-col"
              : "w-full max-w-editor m-auto self-center type-editor flex flex-col justify-center"
          }
        >
          {isLoading && (
            <div className="py-4 type-label text-muted-foreground">
              Loading note...
            </div>
          )}
          {error && (
            <div className="py-4 type-label text-destructive">
              Failed to read note: {error}
            </div>
          )}
          <div className={isRawMode ? "shrink-0 px-3 pt-2" : undefined}>
            <FrontmatterTable onAutoSaveTrigger={triggerAutoSave} />
          </div>
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
              {editorReady && <EditorBubbleMenu editor={editor} isRawMode={isRawMode} />}
              <EditorContent editor={editor} />
            </>
          )}
        </div>
        {!dockOutline && (
          <MarkdownOutline
            key={activePath ?? "outline"}
            editor={editor}
            body={body}
            isRawMode={isRawMode}
            notePath={activePath}
            noteTitle={activeTab?.title ?? null}
            placement="floating"
          />
        )}
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
      {dockOutline && (
        <MarkdownOutline
          key={`${activePath ?? "outline"}-dock`}
          editor={editor}
          body={body}
          isRawMode={isRawMode}
          notePath={activePath}
          noteTitle={activeTab?.title ?? null}
          placement="docked"
        />
      )}
    </div>
  );
};
