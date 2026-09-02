# Epic 3: External File Synchronization & Conflict Guard — Context

## Purpose
Epic 3 equips `snipnote` to function seamlessly as the live local companion for Claude Code. As Claude Code writes, updates, or deletes markdown notes directly on disk in the terminal, Snipnote detects these changes instantly via a native Rust file watcher, auto-reloads clean editor buffers without prompting, and shields unsaved buffers with a non-blocking conflict banner (`File changed on disk — [Reload] [Keep mine]`). Crucially, Snipnote suppresses file-watch echo loops caused by its own 500ms debounced auto-saves.

## Architectural Invariants
- **AD-1 (Rust Backend Disk Authority)**: The file watcher (`notify` crate) runs in the native Rust runtime, monitoring the active vault root directory recursively.
- **AD-3 (Echo Suppression Cache)**: An in-memory cache (`RecentlyWritten`) tracks paths written by `write_file` along with timestamps (2-second TTL). The watcher drops modification events for paths present in this cache to prevent self-triggering loops.
- **AD-4 (External Change Resolution)**:
  - Clean buffer (`!isDirty`): Automatically re-reads the note from disk and updates Tiptap content.
  - Dirty buffer (`isDirty`): Displays an inline non-blocking banner docked directly under the Tab Bar with `[Reload]` (discard and load from disk) and `[Keep mine]` (dismiss banner and retain local edits).
  - Directory change: Triggers `loadVault` to refresh the sidebar tree within 2 seconds.

## Stories in Epic 3
- **Story 3.1: Rust `notify` File Watcher & Vault Change Stream** — Implement recursive directory watcher in Rust emitting `vault-changed` events.
- **Story 3.2: Echo Suppression Cache (AD-3)** — Implement thread-safe `RecentlyWritten` cache with 2s TTL to ignore Snipnote's own saves.
- **Story 3.3: Live Auto-Reload & Non-Blocking Conflict Banner (AD-4)** — Connect frontend listener to auto-reload clean notes, display conflict banner for dirty buffers, and refresh the sidebar file tree.
