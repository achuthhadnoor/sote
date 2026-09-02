import { Sidebar } from "./components/sidebar/Sidebar";
import { TabBar } from "./components/editor/TabBar";
import { EditorSurface } from "./components/editor/EditorSurface";
import { StatusBar } from "./components/editor/StatusBar";
import { useTabStore } from "./stores/useTabStore";
import "./App.css";

function App() {
  const selectNote = useTabStore((state) => state.selectNote);

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
