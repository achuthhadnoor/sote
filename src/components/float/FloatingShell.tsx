import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Settings as SettingsIcon, X, FolderOpen } from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { useThemeStore } from "../../stores/useThemeStore";
import { SessionState } from "../../types/session";
import { createLogger } from "../../lib/logger";
import { canonicalPath, isPathWithin } from "../../lib/path";
import { flushActiveNote } from "../../lib/flushActiveNote";
import {
  SETTINGS_TAB_PATH,
  SETTINGS_TAB_TITLE,
  isSettingsTab,
  isVirtualTab,
} from "../../lib/specialTabs";
import { isFullEditorEnabled } from "../../lib/fullEditorFlag";
import { ConflictBanner } from "../editor/ConflictBanner";
import "./float.css";

// Share the editor chunk with the full shell — no duplicated TipTap stack.
const EditorSurface = lazy(() =>
  import("../editor/EditorSurface").then((m) => ({ default: m.EditorSurface }))
);

const log = createLogger("float");

/** Pick a unique `Untitled*.md` path in the given vault. */
function nextDraftPath(vaultPath: string): { path: string; name: string } {
  const baseVault = vaultPath.replace(/\/+$/, "");
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
  let name = "Untitled.md";
  let path = `${baseVault}/${name}`;
  let idx = 1;
  while (existing.has(path)) {
    name = `Untitled ${idx}.md`;
    path = `${baseVault}/${name}`;
    idx++;
  }
  return { path, name };
}

/**
 * v1 floating panel shell. Minimal chrome (title + settings + hide) hosting the
 * shared `EditorSurface`. Owns its own lightweight bootstrap: restore the last
 * note (or start a draft) so the panel is ready the moment it is shown.
 */
export function FloatingShell() {
  // Ensure theme store side-effects run (applies data-theme + tint to <html>).
  useThemeStore((s) => s.effectiveTheme);

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const activePath = useTabStore((s) => s.activePath);
  const activeTitle = useTabStore((s) => s.activeTitle);
  // State (not a ref) so the session-save effect re-runs once bootstrap
  // completes — a ref flip in `finally` would not trigger it.
  const [initialized, setInitialized] = useState(false);
  // Remember the last real note so toggling Settings can return to it.
  const lastNotePathRef = useRef<string | null>(null);

  useEffect(() => {
    if (activePath && !isVirtualTab(activePath)) lastNotePathRef.current = activePath;
  }, [activePath]);

  const createDraft = useCallback(async () => {
    if (!(await flushActiveNote())) return;
    let vp = useVaultStore.getState().vaultPath;
    if (!vp) {
      await useVaultStore.getState().openVaultDialog();
      vp = useVaultStore.getState().vaultPath;
      if (!vp) return;
    }
    const { path, name } = nextDraftPath(vp);
    useTabStore.getState().selectNote(path, name, { isNew: true });
  }, []);

  const openSettings = useCallback(() => {
    const active = useTabStore.getState().activePath;
    if (isSettingsTab(active)) return;
    useTabStore.getState().selectNote(SETTINGS_TAB_PATH, SETTINGS_TAB_TITLE);
  }, []);

  const toggleSettings = useCallback(async () => {
    const active = useTabStore.getState().activePath;
    if (isSettingsTab(active)) {
      const prev = lastNotePathRef.current;
      if (prev) {
        const name = prev.split("/").pop() || "Note";
        useTabStore.getState().selectNote(prev, name);
      } else {
        await createDraft();
      }
      return;
    }
    openSettings();
  }, [createDraft, openSettings]);

  const focusEditor = useCallback(() => {
    // Delay a tick so the webview has focus before we focus the contenteditable.
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(".snipnote-editor-content");
      el?.focus();
    }, 40);
  }, []);

  const hidePanel = useCallback(async () => {
    // Persist the dirty buffer before the panel disappears — hiding must never
    // drop unsaved edits.
    try {
      await flushActiveNote();
    } catch {}
    invoke("hide_float").catch(() => {});
  }, []);

  // Bootstrap: restore the last vault + note (or start a draft), then signal
  // readiness and open the full editor if the flag is on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await invoke<SessionState>("get_session");
        if (!cancelled && session.lastVaultPath) {
          await useVaultStore.getState().loadVault(session.lastVaultPath);
          const active =
            session.activeFilePath && !isVirtualTab(session.activeFilePath)
              ? session.activeFilePath
              : null;
          if (!cancelled) {
            if (active) {
              const name = active.split("/").pop() || "Note";
              useTabStore.getState().selectNote(active, name);
            } else {
              await createDraft();
            }
          }
        }
      } catch (err) {
        log.error("Float bootstrap failed:", err);
      } finally {
        // Skip post-bootstrap side effects if the component unmounted mid-flight
        // (StrictMode double-mount / fast teardown) — otherwise we'd reveal or
        // re-open windows for a dead instance.
        if (!cancelled) {
          setInitialized(true);
          // Persist the restored note immediately (the save effect also runs
          // when `initialized` flips, but do it explicitly so a restore that
          // didn't change activePath still records session state).
          const vp = useVaultStore.getState().vaultPath;
          if (vp && !isFullEditorEnabled()) {
            const active = useTabStore.getState().activePath;
            invoke("save_session", {
              session: {
                lastVaultPath: vp,
                activeFilePath: active && !isVirtualTab(active) ? active : null,
                openTabs: [],
              },
            }).catch(() => {});
          }
          // Tell Rust JS is alive so the failsafe won't force the panel visible.
          invoke("float_ready").catch(() => {});
          // Flag on → also bring up the full vault shell (main).
          if (isFullEditorEnabled()) {
            invoke("open_full_editor").catch(() => {});
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the active note so reopening the panel restores it. Shared session
  // format with the full shell (open tabs are a full-shell concept).
  useEffect(() => {
    if (!initialized || !vaultPath) return;
    // When the full editor is enabled, `main`/App owns the session (including
    // openTabs). Writing `openTabs: []` from the panel would wipe its tabs, so
    // let the full shell be the sole session author in that mode.
    if (isFullEditorEnabled()) return;
    invoke("save_session", {
      session: {
        lastVaultPath: vaultPath,
        activeFilePath:
          activePath && !isVirtualTab(activePath) ? activePath : null,
        openTabs: [],
      },
    }).catch((err) => log.error("Float save_session failed:", err));
  }, [initialized, vaultPath, activePath]);

  // Tray / menu glue.
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;
    const add = async (event: string, handler: (e: any) => void) => {
      const un = await listen(event, handler);
      if (disposed) un();
      else unlisteners.push(un);
    };
    void (async () => {
      await add("float:new-note", () => void createDraft());
      await add("float:open-settings", () => openSettings());
      await add("float:focus-editor", () => focusEditor());
      // App-menu accelerators fire while the panel is focused (mirror App.tsx).
      await add("menu:new_note", () => void createDraft());
      await add("menu:open_vault", () => void useVaultStore.getState().openVaultDialog());
      await add("menu:open_recent", (e) => void useVaultStore.getState().loadVault(e.payload));
    })();
    return () => {
      disposed = true;
      unlisteners.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [createDraft, openSettings, focusEditor]);

  // Keyboard: Esc hides, Cmd/Ctrl+, toggles Settings, Cmd/Ctrl+N new note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void hidePanel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "," || (e as any).code === "Comma")) {
        e.preventDefault();
        void toggleSettings();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void createDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createDraft, toggleSettings, hidePanel]);

  // Watcher: reload/conflict handling for the open float note (mirrors the
  // full shell's authority rules, trimmed for the single-note panel).
  useEffect(() => {
    const unlistenPromise = listen<{ path: string; kind: string }>(
      "vault-changed",
      (event) => {
        const changedPath = event.payload.path;
        const currentVault = useVaultStore.getState().vaultPath;
        const currentActive = useTabStore.getState().activePath;
        if (!currentActive || !currentVault || isVirtualTab(currentActive)) return;

        const selfWrite = useEditorStore.getState().lastSelfWrite;
        if (
          selfWrite &&
          Date.now() - selfWrite.at < 5000 &&
          canonicalPath(selfWrite.path, currentVault) ===
            canonicalPath(changedPath, currentVault)
        ) {
          return;
        }

        if (
          canonicalPath(changedPath, currentVault) ===
            canonicalPath(currentActive, currentVault) &&
          isPathWithin(changedPath, currentVault)
        ) {
          if (!useEditorStore.getState().isDirty) {
            useEditorStore.getState().resolveConflictReload(currentActive);
          } else {
            useEditorStore.getState().setConflict(true);
          }
        }
      }
    );
    return () => {
      unlistenPromise.then((un) => un());
    };
  }, []);

  const headerTitle = isSettingsTab(activePath)
    ? "Settings"
    : activeTitle || "snipnote";

  return (
    <div className="snipnote-float flex flex-col w-screen h-screen overflow-hidden bg-bg-translucent rounded-[var(--surface-radius-lg)] select-none">
      <header
        data-tauri-drag-region
        className="flex items-center justify-between gap-2 h-9 shrink-0 px-2.5 border-b border-border-translucent"
      >
        <span
          data-tauri-drag-region
          className="min-w-0 truncate text-[12px] font-medium text-muted-foreground"
        >
          {headerTitle}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {!vaultPath && (
            <button
              type="button"
              onClick={() => void createDraft()}
              title="Open folder"
              aria-label="Open folder"
              className="grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void toggleSettings()}
            title="Settings"
            aria-label="Settings"
            className="grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void hidePanel()}
            title="Hide (Esc)"
            aria-label="Hide panel"
            className="grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      {!isSettingsTab(activePath) && <ConflictBanner />}
      <main className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent">
        <Suspense fallback={<div className="flex-1" />}>
          <EditorSurface />
        </Suspense>
      </main>
    </div>
  );
}
