import React, { useState, useMemo } from "react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useTabStore } from "../../stores/useTabStore";
import { flushActiveNote } from "../../lib/flushActiveNote";
import { VaultNode } from "../../types/vault";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FlattenedNote {
  name: string;
  path: string;
  relativePath: string;
}

function flattenVaultTree(nodes: VaultNode[], parentDir: string = ""): FlattenedNote[] {
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

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const tree = useVaultStore((state) => state.tree);
  const vaultPath = useVaultStore((state) => state.vaultPath);
  const selectNote = useTabStore((state) => state.selectNote);
  const [query, setQuery] = useState("");

  const allNotes = useMemo(() => flattenVaultTree(tree), [tree]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNotes;
    return allNotes.filter(
      (note) => note.name.toLowerCase().includes(q) || note.relativePath.toLowerCase().includes(q)
    );
  }, [allNotes, query]);

  if (!vaultPath) return null;

  const handleSelect = async (note: FlattenedNote) => {
    if (note.path !== useTabStore.getState().activePath && !(await flushActiveNote())) return;
    selectNote(note.path, note.name);
    onClose();
    setQuery("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setQuery(""); } }}>
      <DialogContent
        className="palette-dialog ui-surface top-[14vh] translate-y-0 w-[calc(100%-2rem)] max-w-[520px] p-0 gap-0 overflow-hidden border"
        aria-describedby={undefined}
        // Tailwind's DialogContent has close button; keep it for accessibility but hide visually if desired
      >
        <Command shouldFilter={false} className="rounded-none">
          <CommandInput
            placeholder="Search notes by name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[320px] p-1">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No matching notes found</CommandEmpty>
            <CommandGroup>
              {filteredNotes.map((note) => (
                <CommandItem
                  key={note.path}
                  value={`${note.name} ${note.relativePath}`}
                  onSelect={() => handleSelect(note)}
                  className="flex justify-between gap-3 px-3 py-2 aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <span className="text-[13px] font-medium truncate">{note.name}</span>
                  <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[220px] aria-selected:text-accent-foreground group-aria-selected:text-accent-foreground">
                    {note.relativePath}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
