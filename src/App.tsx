import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TabBar } from "./components/editor/TabBar";
import { EditorSurface } from "./components/editor/EditorSurface";
import { StatusBar } from "./components/editor/StatusBar";
import { useVaultStore } from "./stores/useVaultStore";
import { useTabStore } from "./stores/useTabStore";
import { SessionState } from "./types/session";
import "./App.css";

function App() {
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const loadVault = useVaultStore((state) => state.loadVault);
  const activePath = useTabStore((state) => state.activePath);
  const selectNote = useTabStore((state) => state.selectNote);
  const isInitialized = useRef(false);

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

  const handleNewNote = () => {
    selectNote("Untitled.md", "Untitled.md");
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-container">
        <TabBar onNewNote={handleNewNote} />
        <EditorSurface />
        <StatusBar wordCount={0} charCount={0} paragraphCount={0} />
      </main>
    </div>
  );
}

export default App;
