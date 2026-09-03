import React, { useState, useEffect, useMemo, useRef } from "react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { VaultNode } from "../../types/vault";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FlattenedNote {
  name: string;
  path: string;
  relativePath: string;
}

function flattenVaultTree(
  nodes: VaultNode[],
  parentDir: string = ""
): FlattenedNote[] {
  const result: FlattenedNote[] = [];
  for (const node of nodes) {
    if (node.isDirectory && node.children) {
      const dirPath = parentDir ? `${parentDir}/${node.name}` : node.name;
      result.push(...flattenVaultTree(node.children, dirPath));
    } else if (!node.isDirectory) {
      result.push({
        name: node.name,
        path: node.path,
        relativePath: parentDir ? `${parentDir}/${node.name}` : node.name,
      });
    }
  }
  return result;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const tree = useVaultStore((state) => state.tree);
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const selectNote = useTabStore((state) => state.selectNote);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Flatten vault tree
  const allNotes = useMemo(() => {
    return flattenVaultTree(tree);
  }, [tree]);

  // Filter notes based on query
  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNotes;
    return allNotes.filter(
      (note) =>
        note.name.toLowerCase().includes(q) ||
        note.relativePath.toLowerCase().includes(q)
    );
  }, [allNotes, query]);

  // Reset query and selectedIndex when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Clamp selectedIndex if filtered list shrinks
  useEffect(() => {
    if (selectedIndex >= filteredNotes.length) {
      setSelectedIndex(Math.max(0, filteredNotes.length - 1));
    }
  }, [filteredNotes.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredNotes.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, filteredNotes.length - 1)
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredNotes[selectedIndex];
      if (target) {
        selectNote(target.path, target.name);
        onClose();
      }
    }
  };

  if (!isOpen || !vaultPath) return null;

  return (
    <div
      className="palette-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="palette-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="palette-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="palette-search-input"
            placeholder="Search notes by name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>

        <div className="palette-list" role="listbox" aria-live="polite" aria-label="Note results">
          {filteredNotes.length === 0 ? (
            <div className="palette-empty">No matching notes found</div>
          ) : (
            filteredNotes.map((note, index) => (
              <div
                key={note.path}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className={`palette-item ${
                  index === selectedIndex ? "palette-item-selected" : ""
                }`}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => {
                  selectNote(note.path, note.name);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="palette-item-title">{note.name}</div>
                <div className="palette-item-path">{note.relativePath}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
