import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TabBar } from "./components/editor/TabBar";
import { ConflictBanner } from "./components/editor/ConflictBanner";
import { EditorSurface } from "./components/editor/EditorSurface";
import { StatusBar } from "./components/editor/StatusBar";
import { CommandPalette } from "./components/palette/CommandPalette";
import { RightPanel } from "./components/rightPanel/RightPanel";
import { useVaultStore } from "./stores/useVaultStore";
import { useTabStore } from "./stores/useTabStore";
import { useEditorStore } from "./stores/useEditorStore";
import { SessionState } from "./types/session";
import "./App.css";

function App() {
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const loadVault = useVaultStore((state) => state.loadVault);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const isInitialized = useRef(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const session = await invoke<SessionState>("get_session");
        if (session.lastVaultPath) {
          await loadVault(session.lastVaultPath);
          if (session.activeFilePath) {
            const fileName = session.activeFilePath.split("/").pop() || "Note";
            selectNote(session.activeFilePath, fileName);
          }
        }
      } catch (err) {
        console.error("Failed to restore session:", err);
      } finally {
        isInitialized.current = true;
      }
    }

    restoreSession();
  }, [loadVault, selectNote]);

  // Persist session on state changes
  useEffect(() => {
    if (!isInitialized.current) return;

    invoke("save_session", {
      session: {
        lastVaultPath: vaultPath,
        activeFilePath: activePath,
      },
    }).catch((err) => {
      console.error("Failed to save session:", err);
    });
  }, [vaultPath, activePath]);

  // Listen for native filesystem changes emitted by Rust file watcher (AD-4)
  useEffect(() => {
    let treeRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    const unlistenPromise = listen<{ path: string; kind: string }>(
      "vault-changed",
      (event) => {
        const changedPath = event.payload.path;
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
          }
        }

        // Debounce refreshing the sidebar file tree within 500ms
        if (currentVault) {
          if (treeRefreshTimer) clearTimeout(treeRefreshTimer);
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

  const createNote = useVaultStore((state) => state.createNote);

  const handleNewNote = async () => {
    const newPath = await createNote();
    if (newPath) {
      const fileName = newPath.split("/").pop() || "Untitled.md";
      selectNote(newPath, fileName);
    }
  };

  // Global keyboard shortcuts (Cmd+N for new note, Cmd+P for command palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNote, selectNote]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-container">
        <TabBar onNewNote={handleNewNote} />
        <ConflictBanner />
        <EditorSurface />
        <StatusBar />
      </main>
      <RightPanel />
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
      />
    </div>
  );
}

export default App;
