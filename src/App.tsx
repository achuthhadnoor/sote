import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TabBar } from "./components/editor/TabBar";
import { ConflictBanner } from "./components/editor/ConflictBanner";
import { StatusBar } from "./components/editor/StatusBar";
import { useVaultStore } from "./stores/useVaultStore";
import { useTabStore } from "./stores/useTabStore";
import { useEditorStore } from "./stores/useEditorStore";
import { useThemeStore } from "./stores/useThemeStore";
import { useRecentNotesStore } from "./stores/useRecentNotesStore";
import { SessionState } from "./types/session";
import { createLogger, msSinceJsBoot, recordStartupSample, getStartupLoadBreakdown } from "./lib/logger";
import "./App.css";

// Heavy UI split out of the initial bundle so first paint only pays for the
// shell (sidebar + tab bar). The editor chunk (~500KB tiptap) starts loading
// in parallel with session restore via Suspense and is ready by the time a
// note opens; dialogs load on first open.
const EditorSurface = lazy(() =>
  import("./components/editor/EditorSurface").then((m) => ({ default: m.EditorSurface }))
);
const CommandPalette = lazy(() =>
  import("./components/palette/CommandPalette").then((m) => ({ default: m.CommandPalette }))
);
const SettingsDialog = lazy(() =>
  import("./components/settings/SettingsDialog").then((m) => ({ default: m.SettingsDialog }))
);

const log = createLogger("app");

// StrictMode double-mounts effects in dev, so restoreSession completes twice
// per launch — only the first completion records a startup sample.
let startupSampleRecorded = false;

function App() {
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const loadVault = useVaultStore((state) => state.loadVault);
  const activePath = useTabStore((state) => state.activePath);
  const tabs = useTabStore((state) => state.tabs);
  const selectNote = useTabStore((state) => state.selectNote);
  const setTabs = useTabStore((state) => state.setTabs);
  const isInitialized = useRef(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // ensure theme is initialized (store side-effect loads from localStorage)
  useThemeStore((s) => s.effectiveTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const triggerHaptic = () => {
    try {
      (navigator as any).vibrate?.(10);
    } catch {}
    try {
      invoke("haptic_feedback", { kind: "alignment" }).catch(() => {});
    } catch {}
  };

  // Haptics on sidebar/settings toggles
  const prevSidebarRef = useRef(sidebarCollapsed);
  useEffect(() => {
    if (prevSidebarRef.current !== sidebarCollapsed) {
      prevSidebarRef.current = sidebarCollapsed;
      triggerHaptic();
    }
  }, [sidebarCollapsed]);

  const prevSettingsRef = useRef(isSettingsOpen);
  useEffect(() => {
    if (!prevSettingsRef.current && isSettingsOpen) triggerHaptic();
    prevSettingsRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  // Restore session on mount — restores vault + open tabs
  useEffect(() => {
    // Safety timer: reveal promptly even if restore hangs. The window starts
    // hidden and the promise chain below is the real reveal path (IPC
    // resolves while hidden; this timer may fire late if throttled).
    const revealTimeout = setTimeout(() => {
      invoke("reveal_window").catch(() => {});
    }, 150);

    async function restoreSession() {
      const t0 = performance.now();
      const jsToRestore = msSinceJsBoot();
      try {
        log.debug(`restoreSession start (+${Math.round(jsToRestore)}ms after JS boot)`);
        const session = await invoke<SessionState>("get_session");
        log.debug("restoreSession got session:", session.lastVaultPath ?? "(no vault)");
        if (session.lastVaultPath) {
          await loadVault(session.lastVaultPath);
          const openTabs = (session as any).openTabs as string[] | null | undefined;
          const active = session.activeFilePath ?? null;
          if (openTabs && openTabs.length > 0) {
            const tabObjs = openTabs.map((p) => ({
              path: p,
              title: p.split("/").pop() || "Note",
            }));
            setTabs(tabObjs, active);
            // if active not in openTabs, ensure it is opened
            if (active && !openTabs.includes(active)) {
              const fileName = active.split("/").pop() || "Note";
              selectNote(active, fileName);
            }
          } else if (session.activeFilePath) {
            const fileName = session.activeFilePath.split("/").pop() || "Note";
            selectNote(session.activeFilePath, fileName);
          }
        }
      } catch (err) {
        log.error("Failed to restore session:", err);
      } finally {
        const restoreMs = performance.now() - t0;
        log.debug(`restoreSession done in ${Math.round(restoreMs)}ms`);
        if (startupSampleRecorded) {
          clearTimeout(revealTimeout);
          return;
        }
        startupSampleRecorded = true;
        const { samples, avgNavToJsMs } = recordStartupSample(jsToRestore, restoreMs);
        const latest = samples[samples.length - 1];
        log.info(
          `startup history (${samples.length} runs, avg nav→js ${avgNavToJsMs}ms): ` +
            samples.map((s) => `${s.navToJsMs}/${s.jsToRestoreMs}/${s.restoreMs}`).join(" | ") +
            ` (nav→js/js→restore/restore ms; latest${latest?.dev ? ", dev" : ", prod"})`
        );
        const breakdown = getStartupLoadBreakdown();
        if (breakdown) {
          const jsSize = breakdown.totalJsBytes >= 0
            ? `js ${(breakdown.totalJsBytes / 1024).toFixed(0)}KB, `
            : "";
          log.info(
            `startup load: ${breakdown.resourceCount} resources, ` +
              jsSize +
              `domContentLoaded@${breakdown.domContentLoadedMs}ms, slowest: ` +
              breakdown.slowest.map((s) => `${s.name} ${s.ms}ms`).join(", ")
          );
        }
        clearTimeout(revealTimeout);
        isInitialized.current = true;
        // Reveal native window now that initial session, vault, and active tabs are set
        invoke("reveal_window").catch(() => {});
      }
    }

    restoreSession();
    return () => clearTimeout(revealTimeout);
  }, [loadVault, selectNote, setTabs]);

  // Persist session on state changes — now includes open tabs (only real files, drafts with no disk file are not persisted)
  useEffect(() => {
    if (!isInitialized.current) return;

    invoke("save_session", {
      session: {
        lastVaultPath: vaultPath,
        activeFilePath: activePath,
        openTabs: tabs.filter((t) => !t.isNew).map((t) => t.path),
      },
    }).catch((err) => {
      log.error("Failed to save session:", err);
    });
  }, [vaultPath, activePath, tabs]);

  // Track recently opened notes (persists across restarts via localStorage)
  useEffect(() => {
    if (!activePath || !vaultPath) return;
    const tab = tabs.find((t) => t.path === activePath);
    if (tab?.isNew) return; // don't record unsaved drafts
    const title = tab?.title ?? activePath.split("/").pop() ?? "Note";
    useRecentNotesStore.getState().pushRecent(activePath, title, vaultPath);
  }, [activePath, vaultPath, tabs]);

  // Listen for native filesystem changes emitted by Rust file watcher (AD-4)
  useEffect(() => {
    let treeRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    const unlistenPromise = listen<{ path: string; kind: string }>(
      "vault-changed",
      async (event) => {
        const changedPath = event.payload.path;
        log.debug("vault-changed:", event.payload.kind, changedPath);
        const selfWrite = useEditorStore.getState().lastSelfWrite;
        const normalizePath = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "");
        if (
          selfWrite &&
          Date.now() - selfWrite.at < 5000 &&
          normalizePath(selfWrite.path) === normalizePath(changedPath)
        ) {
          log.debug("vault-changed: ignoring recent self-write", changedPath);
          return;
        }
        const currentVault = useVaultStore.getState().vaultPath;
        const currentActive = useTabStore.getState().activePath;
        const isDirty = useEditorStore.getState().isDirty;

        // If the external change affects the currently active note
        if (
          currentActive &&
          (changedPath === currentActive || changedPath.endsWith(currentActive))
        ) {
          if (!isDirty) {
            // Clean buffer: automatically reload from disk
            useEditorStore.getState().resolveConflictReload(currentActive);
          } else {
            // Dirty buffer: display non-blocking conflict banner
            useEditorStore.getState().setConflict(true);
            // If window is hidden/minimized, also show native notification
            try {
              const isHidden = document.hidden || document.visibilityState === "hidden";
              let shouldNotify = isHidden;
              try {
                const { getCurrentWebview } = await import("@tauri-apps/api/webview");
                const wv: any = getCurrentWebview();
                if (wv.isMinimized) {
                  const minimized = await wv.isMinimized();
                  if (minimized) shouldNotify = true;
                }
                if (wv.isFocused) {
                  const focused = await wv.isFocused();
                  if (!focused) shouldNotify = true;
                } else if (document.hasFocus && !document.hasFocus()) {
                  shouldNotify = true;
                }
              } catch {}
              if (shouldNotify) {
                const { isPermissionGranted, requestPermission, sendNotification } = await import(
                  "@tauri-apps/plugin-notification"
                );
                let granted = await isPermissionGranted();
                if (!granted) {
                  const perm = await requestPermission();
                  granted = perm === "granted";
                }
                if (granted) {
                  const name = changedPath.split("/").pop() || "File";
                  sendNotification({ title: "File changed on disk", body: `${name} changed — click to review` });
                }
              }
            } catch {}
          }
        }

        // Debounce refreshing the sidebar file tree within 500ms
        if (currentVault) {
          if (treeRefreshTimer) clearTimeout(treeRefreshTimer);
          log.debug("vault-changed: scheduling tree refresh for", changedPath);
          treeRefreshTimer = setTimeout(() => {
            useVaultStore.getState().loadVault(currentVault);
          }, 500);
        }
      }
    );

    return () => {
      if (treeRefreshTimer) clearTimeout(treeRefreshTimer);
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);



  // New note is now a draft tab — no file on disk until there is content
  const handleNewNote = async () => {
    let vp = useVaultStore.getState().vaultPath;
    if (!vp) {
      await useVaultStore.getState().openVaultDialog();
      vp = useVaultStore.getState().vaultPath;
      if (!vp) return;
    }
    const baseVault = vp.replace(/\/+$/, "");
    // collect existing file paths from tree + open tabs
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
    let candidateName = "Untitled.md";
    let candidatePath = `${baseVault}/${candidateName}`;
    let idx = 1;
    while (existing.has(candidatePath)) {
      candidateName = `Untitled ${idx}.md`;
      candidatePath = `${baseVault}/${candidateName}`;
      idx++;
    }
    selectNote(candidatePath, candidateName, { isNew: true });
  };

  // Native menu / deep-link / single-instance listeners
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    const setup = async () => {
      unlisteners.push(await listen("menu:new_note", () => handleNewNote()));
      unlisteners.push(await listen("menu:open_vault", () => useVaultStore.getState().openVaultDialog()));
      unlisteners.push(await listen<string>("menu:open_recent", (e) => useVaultStore.getState().loadVault(e.payload)));
      unlisteners.push(
        await listen("menu:close_tab", () => {
          const active = useTabStore.getState().activePath;
          if (active) useTabStore.getState().closeTab(active);
        })
      );
      unlisteners.push(await listen("menu:toggle_sidebar", () => setSidebarCollapsed((v) => !v)));
      unlisteners.push(await listen("menu:theme_light", () => setTheme("light")));
      unlisteners.push(await listen("menu:theme_dark", () => setTheme("dark")));
      unlisteners.push(await listen("menu:theme_system", () => setTheme("system")));
      unlisteners.push(await listen("menu:about", () => setIsSettingsOpen(true)));
      // single-instance second launch with file/vault path
      unlisteners.push(
        await listen<string>("single-instance:open", (e) => {
          const p = e.payload;
          const name = p.split("/").pop() || "Note";
          const vault = p.substring(0, p.lastIndexOf("/"));
          const currentVault = useVaultStore.getState().vaultPath;
          if (!currentVault || !p.startsWith(currentVault)) {
            useVaultStore.getState().loadVault(vault).then(() => useTabStore.getState().selectNote(p, name)).catch(() => useTabStore.getState().selectNote(p, name));
          } else {
            useTabStore.getState().selectNote(p, name);
          }
        })
      );
      unlisteners.push(await listen<string>("single-instance:open-vault", (e) => useVaultStore.getState().loadVault(e.payload)));
      // deep link snipnote://open?path=... or vault=...
      unlisteners.push(
        await listen<string>("deep-link:open", (e) => {
          const p = e.payload;
          const name = p.split("/").pop() || "Note";
          // if vault not yet loaded, try to load its parent dir as vault
          const vault = p.substring(0, p.lastIndexOf("/"));
          const currentVault = useVaultStore.getState().vaultPath;
          if (!currentVault || !p.startsWith(currentVault)) {
            // try to load parent as vault if it exists
            useVaultStore.getState().loadVault(vault).then(() => useTabStore.getState().selectNote(p, name)).catch(() => useTabStore.getState().selectNote(p, name));
          } else {
            useTabStore.getState().selectNote(p, name);
          }
        })
      );
      unlisteners.push(await listen<string>("deep-link:open-vault", (e) => useVaultStore.getState().loadVault(e.payload)));
    };
    setup();
    return () => {
      unlisteners.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [handleNewNote, setTheme]);

  // Keep Recent Vaults menu in sync (also handles Dock Recent)
  useEffect(() => {
    if (!vaultPath) return;
    invoke("add_recent_vault", { vaultPath }).catch(() => {});
  }, [vaultPath]);

  // Drag & Drop: Finder → vault (Tauri onDragDropEvent is primary; HTML5 fallback on app-shell)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setupDrag = async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
          if (event.payload.type === "drop") {
            const paths = (event.payload as { type: "drop"; paths: string[]; position: { x: number; y: number } }).paths;
            const vp = useVaultStore.getState().vaultPath;
            if (!vp || paths.length === 0) return;
            // Detect folder drop target via element at position
            let destDir = vp;
            try {
              const pos = (event.payload as any).position as { x: number; y: number };
              const el = document.elementFromPoint(pos.x, pos.y);
              const folderEl = el?.closest("[data-folder-path]") as HTMLElement | null;
              if (folderEl?.dataset.folderPath) {
                destDir = folderEl.dataset.folderPath;
              }
            } catch {}
            // Await all copies before refreshing to avoid race
            const results = await Promise.allSettled(
              paths.map((p) => invoke("copy_external_file", { vaultPath: vp, srcPath: p, destDir }).catch((e) => { log.error("copy_external_file failed", e); throw e; }))
            );
            void results;
            // Refresh tree within 500ms per AC — await vault reload
            try {
              await useVaultStore.getState().loadVault(vp);
            } catch {}
          }
        });
      } catch (e) {
        // Webview API not available (e.g. in browser dev mode)
      }
    };
    setupDrag();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleAppDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleAppDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const vp = useVaultStore.getState().vaultPath;
    if (!vp) return;
    // HTML5 fallback: only works if browser exposes path (Tauri may not); primary is onDragDropEvent above
    // If Tauri's onDragDropEvent already handled this drop, dataTransfer.files will be empty or lack path — avoid double copy
    const files = Array.from(e.dataTransfer.files) as Array<File & { path?: string }>;
    if (files.length === 0) return;
    const validPaths: Array<{ srcPath: string; destDir: string }> = [];
    for (const f of files) {
      const srcPath = (f as any).path as string | undefined;
      if (!srcPath || typeof srcPath !== "string") continue;
      validPaths.push({ srcPath, destDir: vp });
    }
    if (validPaths.length === 0) return;
    await Promise.allSettled(
      validPaths.map(({ srcPath, destDir }) =>
        invoke("copy_external_file", { vaultPath: vp, srcPath, destDir }).catch((err) => {
          log.error("copy_external_file fallback failed", err);
        })
      )
    );
    try {
      await useVaultStore.getState().loadVault(vp);
    } catch {}
  };

  // Global keyboard shortcuts (Cmd+N, Cmd+P, Cmd+, Cmd+W, nav)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd+, / Ctrl+, -> Settings (macOS standard) — check both key and code for layout safety
      if ((e.metaKey || e.ctrlKey) && (e.key === "," || (e as any).code === "Comma")) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        const active = useTabStore.getState().activePath;
        if (active) {
          const editor = useEditorStore.getState();
          await editor.saveNow(active);
          if (useEditorStore.getState().isDirty) return;
          useTabStore.getState().closeTab(active);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewNote();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (useVaultStore.getState().vaultPath) {
          setIsPaletteOpen((prev) => !prev);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        useTabStore.getState().goBack();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        useTabStore.getState().goForward();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Tab") {
        // Ctrl+Tab / Cmd+Tab cycle tabs
        e.preventDefault();
        const { tabs, activePath } = useTabStore.getState();
        if (tabs.length <= 1) return;
        const idx = tabs.findIndex((t) => t.path === activePath);
        const nextIdx = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
        const next = tabs[nextIdx];
        useTabStore.getState().selectNote(next.path, next.title);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectNote]);

  return (
    <div
      className="flex w-screen h-screen overflow-hidden bg-bg-translucent rounded-xl select-none"
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
    >
      {/* Sidebar stays mounted so open/close can animate;
          inert + delayed visibility keep hidden controls out of the tab order */}
      <div
        className={`h-full shrink-0 overflow-hidden transition-[width,min-width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
          sidebarCollapsed
            ? "w-0 min-w-0 invisible"
            : "w-sidebar min-w-sidebar visible"
        }`}
        inert={sidebarCollapsed}
        aria-hidden={sidebarCollapsed}
      >
        <Sidebar
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(true)}
          onOpenPalette={() => setIsPaletteOpen(true)}
        />
      </div>
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
        <TabBar onNewNote={handleNewNote} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />
        <ConflictBanner />
        <Suspense fallback={<div className="flex-1" />}>
          <EditorSurface />
        </Suspense>
        <StatusBar />
      </main>
      {/* RightPanel hidden for now — terminal/browser/canvas to be handled later */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
        />
        <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </Suspense>
    </div>
  );
}

export default App;
