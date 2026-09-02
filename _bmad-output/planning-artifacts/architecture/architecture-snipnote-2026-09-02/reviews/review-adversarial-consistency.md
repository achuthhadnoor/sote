# Adversarial Consistency Review

## Findings

### Hole 1: Vault Tree Data Shape Mismatch Across IPC
- **Attack:** Backend dev builds `scan_vault` returning flat `Vec<PathBuf>`, while frontend dev builds `FileTree.tsx` expecting nested `{ name, is_dir, children: [...] }`. Both follow AD-1, but the IPC contract breaks.
- **Fix:** Define the exact `VaultNode` interface in Consistency Conventions:
  ```ts
  interface VaultNode {
    path: string;       // Canonical absolute POSIX path
    name: string;       // File or directory name
    isDirectory: boolean;
    children?: VaultNode[];
  }
  ```

### Hole 2: In-Flight Keystroke Race During Auto-Save
- **Attack:** User types during an in-flight 500ms debounced save. When the async save resolves, the frontend blindly clears `dirty = false`, discarding the fact that keystrokes arrived during the network/IPC transit.
- **Fix:** Tighten AD-7 with a revision counter or buffer snapshot comparison: `dirty` is cleared if and only if the current editor buffer matches the exact snapshot that was dispatched to disk.

### Hole 3: Note Identity Discrepancy (Path vs UUID)
- **Attack:** Tab store uses generated UUIDs for tabs, while file watcher emits OS file paths. Reconciling external change events requires searching across tabs.
- **Fix:** Invariant convention: Canonical absolute POSIX path is the sole unique identifier for all note entities across IPC, tabs, and editor stores.

## Verdict
Pass with additions. Add `VaultNode` IPC interface, specify buffer snapshot dirty resolution in AD-7, and ratify canonical path as the primary key.
