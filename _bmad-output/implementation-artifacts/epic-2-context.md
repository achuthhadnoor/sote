# Epic 2 Context: Live Markdown Editor & Document Fidelity

## Epic Overview
Users can open, view, edit, and create new notes (`+` button) in a centered, clean editing canvas with instant live WYSIWYG rendering for headings, bold, links, lists, code, and Mermaid diagrams. Users can trust that saving maintains pure CommonMark/GFM formatting and preserves YAML frontmatter byte-for-byte on disk without injected HTML.

## Requirements Inventory & Invariants

### Functional Requirements
- **FR-6**: Live WYSIWYG Markdown & Mermaid diagram rendering. The active note renders in a clean, full-size reading and editing canvas with instant live formatting for headings, bold, italics, lists, blockquotes, code blocks, tables, and Mermaid diagrams.
- **FR-7**: Raw Markdown round-trip fidelity & Envelope frontmatter preservation. All note content persists as plain Markdown files (`.md`). The note envelope preserves YAML frontmatter (`---...---`) byte-for-byte; edits in the body do not corrupt frontmatter keys, types, or comments.
- **FR-9**: Tab lifecycle, active note indicator, and `+` instant note creation. Users can click `+` to instantly create a new note on disk (`Untitled.md` or next available number) and begin writing.

### Architecture Invariants (from ARCHITECTURE-SPINE.md)
- **AD-1 (Rust Backend Disk Authority)**: All file reading (`read_file`), writing (`write_file`), and note creation (`create_note`) execute strictly in the Rust backend.
- **AD-2 (Note Envelope Model)**: Notes on disk are parsed into `{ frontmatter: string | null, body: string }`. Frontmatter between opening/closing `---` delimiters is never passed through the WYSIWYG DOM; on save, Rust reassembles the envelope verbatim (`---\n{frontmatter}\n---\n\n{body}`).
- **AD-3 (Editor Engine & Fidelity Pipeline)**: Headless Tiptap v2 with `@tiptap/react`, `@tiptap/starter-kit`, and `@tiptap/markdown 3.30.5`. Output must be pure Markdown string without HTML leakage.
- **AD-4 (Mermaid Diagram Rendering)**: Custom NodeView for `codeBlock` with language `mermaid` rendering inline SVGs.
- **AD-5 (Frontend State Management)**: State partitioned into Zustand stores (`useVaultStore`, `useTabStore`, `useEditorStore`).
- **AD-7 (Debounced Auto-Save with Buffer Snapshot Concurrency)**: 500ms keystroke debounce, immediate flush on blur/navigation/close.
- **AD-8 (Disk-First Note Creation)**: `+` creates `Untitled.md` on disk immediately.

## Current Codebase State (Continuity from Epic 1)
- Branded Tauri desktop shell (`com.achuth.snipnote`, CSP, 800x600 min bounds).
- LocalEditor design tokens and 2-pane + 2-bar desktop layout skeleton.
- Rust storage scanning engine with recursive `VaultNode` structure and unit tests.
- Native folder picker dialog and recursive `FileTree` in `Sidebar` with active note highlighting.
- Session persistence (`session.json`) automatically restoring previous vault and active note on cold start.

## Target Stories in Epic 2
- **Story 2.1**: Rust File I/O & Note Envelope Model (`read_file`, `write_file`, atomic persistence)
- **Story 2.2**: Tiptap WYSIWYG Markdown Editor Engine (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown 3.30.5`)
- **Story 2.3**: 500ms Debounced Auto-Save & Flush Lifecycle
- **Story 2.4**: Instant Disk-First Note Creation (`create_note` command and `+` action)
- **Story 2.5**: Interactive Mermaid Diagram Rendering
