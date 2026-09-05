import React, { useMemo, useState } from "react";
import { Search, FileText, Clock, Plus } from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useRecentNotesStore } from "../../stores/useRecentNotesStore";
import { VaultNode } from "../../types/vault";

interface FlatNote {
  name: string;
  path: string;
  relativePath: string;
}

function flattenVaultTree(nodes: VaultNode[], vaultPath: string): FlatNote[] {
  const normalizedVault = vaultPath.replace(/\/+$/, "");
  const out: FlatNote[] = [];
  const walk = (list: VaultNode[]) => {
    for (const node of list) {
      if (node.isDirectory) {
        if (node.children) walk(node.children);
      } else {
        let rel = node.path;
        if (rel.startsWith(normalizedVault + "/")) {
          rel = rel.slice(normalizedVault.length + 1);
        } else {
          rel = node.name;
        }
        out.push({ name: node.name, path: node.path, relativePath: rel });
      }
    }
  };
  walk(nodes);
  return out;
}

function relativeLabel(vaultPath: string, absPath: string): string {
  const base = vaultPath.replace(/\/+$/, "");
  if (absPath.startsWith(base + "/")) return absPath.slice(base.length + 1);
  return absPath.split("/").pop() || absPath;
}

export const HomeView: React.FC<{ onNewNote?: () => void }> = ({ onNewNote }) => {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const tree = useVaultStore((s) => s.tree);
  const selectNote = useTabStore((s) => s.selectNote);
  const recents = useRecentNotesStore((s) => s.recents);
  const [query, setQuery] = useState("");

  const allNotes = useMemo(
    () => (vaultPath ? flattenVaultTree(tree, vaultPath) : []),
    [tree, vaultPath]
  );
  const noteByPath = useMemo(() => new Map(allNotes.map((n) => [n.path, n])), [allNotes]);

  const vaultRecents = useMemo(() => {
    if (!vaultPath) return [];
    return recents
      .filter((r) => r.vaultPath === vaultPath)
      .slice(0, 8);
  }, [recents, vaultPath]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allNotes
      .filter(
        (n) => n.name.toLowerCase().includes(q) || n.relativePath.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [allNotes, query]);

  const isSearching = query.trim().length > 0;

  const openNote = (path: string, title: string) => {
    selectNote(path, title);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      openNote(results[0].path, results[0].name);
    } else if (e.key === "Escape" && query) {
      setQuery("");
    }
  };

  return (
    <section className="editor-surface-container">
      <div className="home-view">
        <div className="home-search-row">
          <Search size={15} className="home-search-icon" aria-hidden />
          <input
            className="home-search-input"
            placeholder="Search notes…  (⌘P for palette)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            aria-label="Search notes"
          />
          {query && (
            <button
              className="home-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {isSearching ? (
          <div className="home-section">
            <div className="home-section-title">
              {results.length > 0
                ? `${results.length} result${results.length === 1 ? "" : "s"}`
                : "No matching notes"}
            </div>
            {results.length > 0 ? (
              <ul className="home-list" role="listbox" aria-label="Search results">
                {results.map((n) => (
                  <li key={n.path}>
                    <button
                      className="home-item"
                      onClick={() => openNote(n.path, n.name)}
                      title={n.path}
                    >
                      <FileText size={15} className="home-item-icon" aria-hidden />
                      <span className="home-item-text">
                        <span className="home-item-title">{n.name}</span>
                        <span className="home-item-path">{n.relativePath}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-hint">Try a different name or folder. Press Enter to open the top match.</p>
            )}
          </div>
        ) : (
          <div className="home-section">
            <div className="home-section-title">
              <Clock size={13} aria-hidden /> Recent notes
            </div>
            {vaultRecents.length > 0 ? (
              <ul className="home-list" aria-label="Recently opened notes">
                {vaultRecents.map((r) => {
                  const known = noteByPath.get(r.path);
                  const title = known?.name ?? r.title;
                  const rel = vaultPath ? relativeLabel(vaultPath, r.path) : r.title;
                  return (
                    <li key={r.path}>
                      <button
                        className="home-item"
                        onClick={() => openNote(r.path, title)}
                        title={r.path}
                      >
                        <FileText size={15} className="home-item-icon" aria-hidden />
                        <span className="home-item-text">
                          <span className="home-item-title">{title}</span>
                          <span className="home-item-path">{rel}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="home-empty">
                <p className="home-hint">
                  {allNotes.length > 0
                    ? "Notes you open will show up here."
                    : "No notes yet — create your first one to get started."}
                </p>
                {allNotes.length > 0 && (
                  <ul className="home-list" aria-label="Notes in vault">
                    {allNotes.slice(0, 8).map((n) => (
                      <li key={n.path}>
                        <button
                          className="home-item"
                          onClick={() => openNote(n.path, n.name)}
                          title={n.path}
                        >
                          <FileText size={15} className="home-item-icon" aria-hidden />
                          <span className="home-item-text">
                            <span className="home-item-title">{n.name}</span>
                            <span className="home-item-path">{n.relativePath}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {onNewNote && (
                  <button className="home-new-btn" onClick={onNewNote}>
                    <Plus size={14} aria-hidden /> New note
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
