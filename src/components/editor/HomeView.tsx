import React, { useMemo, useState } from "react";
import { Search, FileText, Clock, Plus } from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { useRecentNotesStore } from "../../stores/useRecentNotesStore";
import { flushActiveNote } from "../../lib/flushActiveNote";
import { VaultNode } from "../../types/vault";
import { modShortcut } from "../../utils/platform";

interface FlatNote {
  name: string;
  path: string;
  relativePath: string;
}

function flattenVaultTree(nodes: VaultNode[], vaultPath: string): FlatNote[] {
  const normalizedVault = vaultPath.replace(/[/\\]+$/, "");
  const out: FlatNote[] = [];
  const walk = (list: VaultNode[]) => {
    for (const node of list) {
      if (node.isDirectory) {
        if (node.children) walk(node.children);
      } else {
        let rel = node.path;
        if (rel.startsWith(normalizedVault + "/") || rel.startsWith(normalizedVault + "\\")) {
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
  const base = vaultPath.replace(/[/\\]+$/, "");
  if (absPath.startsWith(base + "/") || absPath.startsWith(base + "\\")) {
    return absPath.slice(base.length + 1);
  }
  return absPath.split(/[/\\]/).pop() || absPath;
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

  const openNote = async (path: string, title: string) => {
    if (path !== useTabStore.getState().activePath && !(await flushActiveNote())) return;
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
    <section className="flex-1 overflow-y-auto flex justify-center py-12 px-8 sm:px-6 relative scroll-smooth">
      <div className="w-full max-w-[560px] flex flex-col gap-5 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 bg-transparent border border-border-translucent rounded-[var(--radius-md)] px-3 h-10 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
          <Search size={15} className="text-muted-foreground shrink-0" aria-hidden />
          <input
            className="flex-1 min-w-0 border-0 outline-hidden bg-transparent type-chrome text-foreground font-sans h-full"
            placeholder={`Search notes…  (${modShortcut("P")} for palette)`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            aria-label="Search notes"
          />
          {query && (
            <button
              className="border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted-translucent p-1 rounded-sm cursor-pointer type-label leading-none"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {isSearching ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 type-label font-semibold tracking-wider uppercase px-1 text-muted-foreground">
              {results.length > 0
                ? `${results.length} result${results.length === 1 ? "" : "s"}`
                : "No matching notes"}
            </div>
            {results.length > 0 ? (
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5" role="listbox" aria-label="Search results">
                {results.map((n) => (
                  <li key={n.path}>
                    <button
                      className="flex items-center gap-2.5 w-full text-left p-2 rounded-md border border-transparent bg-transparent cursor-pointer font-sans transition-colors duration-100 hover:bg-muted-translucent hover:border-border-translucent"
                      onClick={() => openNote(n.path, n.name)}
                      title={n.path}
                    >
                      <FileText size={15} className="text-muted-foreground shrink-0" aria-hidden />
                        <span className="flex items-baseline gap-2 min-w-0 flex-1">
                          <span className="type-chrome font-medium text-foreground truncate">{n.name}</span>
                          <span className="type-meta truncate shrink-1 min-w-0">{n.relativePath}</span>
                        </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-chrome text-muted-foreground leading-relaxed p-1 m-0">Try a different name or folder. Press Enter to open the top match.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 type-label font-semibold tracking-wider uppercase px-1 text-muted-foreground">
              <Clock size={13} aria-hidden /> Recent notes
            </div>
            {vaultRecents.length > 0 ? (
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5" aria-label="Recently opened notes">
                {vaultRecents.map((r) => {
                  const known = noteByPath.get(r.path);
                  const title = known?.name ?? r.title;
                  const rel = vaultPath ? relativeLabel(vaultPath, r.path) : r.title;
                  return (
                    <li key={r.path}>
                      <button
                        className="flex items-center gap-2.5 w-full text-left p-2 rounded-md border border-transparent bg-transparent cursor-pointer font-sans transition-colors duration-100 hover:bg-muted-translucent hover:border-border-translucent"
                        onClick={() => openNote(r.path, title)}
                        title={r.path}
                      >
                        <FileText size={15} className="text-muted-foreground shrink-0" aria-hidden />
                        <span className="flex items-baseline gap-2 min-w-0 flex-1">
                          <span className="type-chrome font-medium text-foreground truncate">{title}</span>
                          <span className="type-meta truncate shrink-1 min-w-0">{rel}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="type-chrome text-muted-foreground leading-relaxed p-1 m-0">
                  {allNotes.length > 0
                    ? "Notes you open will show up here."
                    : "No notes yet — create your first one to get started."}
                </p>
                {allNotes.length > 0 && (
                  <ul className="list-none m-0 p-0 flex flex-col gap-0.5" aria-label="Notes in folder">
                    {allNotes.slice(0, 8).map((n) => (
                      <li key={n.path}>
                        <button
                          className="flex items-center gap-2.5 w-full text-left p-2 rounded-md border border-transparent bg-transparent cursor-pointer font-sans transition-colors duration-100 hover:bg-muted-translucent hover:border-border-translucent"
                          onClick={() => openNote(n.path, n.name)}
                          title={n.path}
                        >
                          <FileText size={15} className="text-muted-foreground shrink-0" aria-hidden />
                        <span className="flex items-baseline gap-2 min-w-0 flex-1">
                          <span className="type-chrome font-medium text-foreground truncate">{n.name}</span>
                          <span className="type-meta truncate shrink-1 min-w-0">{n.relativePath}</span>
                        </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {onNewNote && (
                  <button
                    className="inline-flex items-center gap-1.5 self-start h-[30px] px-3 rounded-md border border-border-translucent bg-transparent text-foreground type-chrome font-medium cursor-pointer font-sans mt-1 hover:bg-accent hover:border-accent hover:text-accent-foreground transition-colors"
                    onClick={onNewNote}
                  >
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
