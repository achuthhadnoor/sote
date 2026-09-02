import { useState } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TabBar } from "./components/editor/TabBar";
import { EditorSurface } from "./components/editor/EditorSurface";
import { StatusBar } from "./components/editor/StatusBar";
import "./App.css";

function App() {
  const [activeTitle, setActiveTitle] = useState("Welcome");

  const handleOpenVault = () => {
    console.log("Open vault triggered");
  };

  const handleNewNote = () => {
    setActiveTitle("Untitled.md");
  };

  return (
    <div className="app-shell">
      <Sidebar onOpenVault={handleOpenVault} />
      <main className="main-container">
        <TabBar activeTitle={activeTitle} onNewNote={handleNewNote} />
        <EditorSurface onOpenVault={handleOpenVault} />
        <StatusBar wordCount={0} charCount={0} paragraphCount={0} />
      </main>
    </div>
  );
}

export default App;
