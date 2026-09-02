---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/EXPERIENCE.md
---

# snipnote - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for snipnote, decomposing the requirements from the PRD, UX Design contract, and Architecture Spine into implementable stories.

## Requirements Inventory

### Functional Requirements

- **FR-1**: User can pick a local folder as Vault via system dialog. App persists the choice and restores it on relaunch without re-prompting.
- **FR-2**: System displays File Tree in Sidebar matching file system 1:1 (folders and `.md` files only, sorted alphabetically). External renaming/moving on disk is reflected within 2s via file watcher.
- **FR-3**: System highlights the currently open Note in File Tree and exposes Library entry in Sidebar footer.
- **FR-4**: User can press Cmd+P (Ctrl+P on Win/Linux) to focus Search, type a substring, see filtered list of Note filenames, and jump to selected note.
- **FR-5**: User can click a Note in File Tree or its Tab to make it active, with highlight and Tab Bar update. Back/forward arrows navigate session tab history.
- **FR-6**: Editor renders headings, bold, links, and bullets live as user types without a split preview pane. Fenced Mermaid blocks, task lists, and inline code are rendered.
- **FR-7**: System preserves Markdown Source on save exactly as standard CommonMark/GFM with no injected HTML/class attributes. Frontmatter is preserved verbatim.
- **FR-8**: System watches Markdown Source on disk; when external agents (Claude) write to a Note: auto-reloads if clean (dirty=false); displays non-blocking banner "File changed on disk — Reload / Keep mine" if dirty (dirty=true).
- **FR-9**: User can see active Note name in Tab Bar, navigate history via arrows, and create a new Note via `+` (creates `Untitled.md` on disk immediately in current folder/vault root).
- **FR-10**: System shows live word count, character count, and paragraph count in Status Bar, updating on every keystroke and on file load.
- **FR-11**: System shows standard macOS traffic lights (close/minimize/maximize) and persists window size and position across relaunch.

### NonFunctional Requirements

- **NFR-1 (Performance)**: Cold launch to Editor < 1.5s on M1; file open < 200ms for < 100KB md; search filter < 100ms for 500 files.
- **NFR-2 (Reliability)**: Never silently overwrite Markdown Source. Crash must not corrupt file (atomic write via temp file + rename).
- **NFR-3 (Privacy & Security)**: Strictly local-only in v1; no outbound network calls; no telemetry without opt-in; no cloud sync; hardened Tauri Content Security Policy (`script-src 'self'`).
- **NFR-4 (Accessibility)**: Full keyboard navigability for Sidebar/File Tree, Cmd+P command palette, and Tab traversal.
- **NFR-5 (Observability)**: Local file-watcher errors surfaced as non-blocking UI banner, not silent failures.
- **NFR-6 (Testing & Quality)**: Round-trip serialization verified by automated test suite of at least 50 fixtures (headings, lists, links, code, frontmatter, Mermaid) passing byte-level equality.

### Additional Requirements

- **ARCH-1 (App Branding & Starter Cleanup)**: Rename starter template from `tauri-app` to `snipnote` in `package.json`, `Cargo.toml`, and `tauri.conf.json`. Set bundle identifier to `com.achuth.snipnote` and configure window title to `snipnote`.
- **ARCH-2 (Rust Backend Disk Authority - AD-1)**: All disk I/O, atomic persistence (write temp + rename), directory indexing, and file watching MUST be owned by Rust backend. Frontend WebView MUST NOT perform direct disk I/O.
- **ARCH-3 (Document Envelope Model - AD-2)**: Note Document MUST separate `rawFrontmatter` string and `body` string. Frontmatter is untouched by Tiptap and prepended verbatim on save.
- **ARCH-4 (Echo Suppression - AD-3)**: Rust file watcher MUST use in-memory `RecentlyWritten` cache (path + mtime/hash with 2s TTL) to swallow self-inflicted save events.
- **ARCH-5 (External Change Resolution - AD-4)**: Clean note auto-reloads preserving scroll/cursor; dirty note displays inline banner under Tab Bar.
- **ARCH-6 (State Partitioning & Performance - AD-5)**: Partition frontend state into isolated Zustand stores (`useVaultStore`, `useTabStore`, `useEditorStore`). Stats subscriber isolated from component re-renders. Mermaid code blocks use custom React NodeView.
- **ARCH-7 (Session Persistence - AD-6)**: App session and window geometry persisted in `$APP_CONFIG_DIR/session.json` by Rust; restored during `tauri::Builder::setup` before window show.
- **ARCH-8 (Write Debounce & Snapshot Concurrency - AD-7)**: Keystroke auto-save debounced at 500ms; immediate flush on blur, tab switch, and close. Buffer snapshot comparison ensures keystrokes typed during in-flight saves are not lost.
- **ARCH-9 (Disk-First Note Creation - AD-8)**: Clicking `+` immediately creates `Untitled.md` on disk to maintain strict 1:1 disk mirror invariant.
- **ARCH-10 (IPC Contracts & Data Shapes)**: Strict IPC contract for `VaultNode { path: string; name: string; isDirectory: boolean; children?: VaultNode[]; }` and canonical absolute POSIX paths as universal entity identity.

### UX Design Requirements

- **UX-DR1 (Design Tokens)**: Monochrome palette (`#FFFFFF` editor, `#F8F8F9` sidebar, `#EAEAEA` hairlines, `#0F0F0F` primary, `#2563EB` link, `#F6F6F7` muted, `#6B7280` muted-foreground, `#F3F4F6` accent, `#EF4444` destructive).
- **UX-DR2 (Typography)**: Inter / SF Pro Text typography ramp: body sans 14px/1.6, sidebar/status sans-sm 13px/1.5, mono 13px/1.6, heading-1 24px/700, heading-2 18px/600, display 18px/600.
- **UX-DR3 (Layout & Spacing)**: Fixed 260px Sidebar (Search header 40px, scrollable File Tree, Library footer 40px), Main area with 40px TabBar, centered 760px max-width EditorSurface with 24px gutters, and 24px StatusBar.
- **UX-DR4 (Sidebar & File Tree)**: Hierarchical tree view with folder chevrons, `.md` note rows, active row highlight (`accent` background, 8px radius), hover states.
- **UX-DR5 (Command Palette)**: Elevated floating modal (`white`, 12px radius, shadow `0 8px 32px rgba(0,0,0,0.08)`, max 480x320) triggered by `⌘P`, fuzzy filtering note filenames with keyboard navigation (Up/Down/Enter/Esc).
- **UX-DR6 (Tab Bar)**: 40px height, bottom border, back/forward history arrows, active note name (14px sans 600), right `+` button.
- **UX-DR7 (Status Bar)**: Quiet 11px mono/sans-sm muted text right-aligned showing `X words | Y characters | Z paragraphs`.
- **UX-DR8 (Conflict Banner)**: Non-blocking inline banner docked directly under Tab Bar (`muted` background, `border`, 6px radius, 13px text) with "Reload" and "Keep mine" buttons.

### FR Coverage Map

- **FR-1**: Epic 1 — Open local Vault via native dialog and restore across restarts
- **FR-2**: Epic 1 — Render 1:1 File Tree in Sidebar with alphabetical sorting
- **FR-3**: Epic 1 — Active File Highlight in File Tree and Library footer
- **FR-4**: Epic 4 — ⌘P Command Palette fuzzy search across note filenames
- **FR-5**: Epic 4 — Navigate via File Tree clicks and Tab Bar history arrows
- **FR-6**: Epic 2 — Live WYSIWYG Markdown & Mermaid diagram rendering
- **FR-7**: Epic 2 — Raw Markdown round-trip fidelity & Envelope frontmatter preservation
- **FR-8**: Epic 3 — Real-time file watcher, echo suppression, and conflict resolution banner
- **FR-9**: Epic 2 — Tab lifecycle, active note indicator, and `+` instant note creation
- **FR-10**: Epic 4 — Live document statistics (words, characters, paragraphs) in Status Bar
- **FR-11**: Epic 1 — Native window controls, traffic lights, and geometry persistence

## Epic List

### Epic 1: Workspace Shell & Vault Access
Users can launch the branded `snipnote` desktop application (with native window traffic lights, clean identity, LocalEditor styling, and hardened security), pick any local folder as their note vault via system dialog, explore their folder and `.md` file hierarchy 1:1 in the Sidebar with active file highlighting, and have their vault path and window geometry restored automatically on relaunch.
**FRs covered:** FR-1, FR-2, FR-3, FR-11 (incorporates ARCH-1 template rename & configs)

### Epic 2: Live Markdown Editor & Document Fidelity
Users can open, view, edit, and create new notes (`+` button) in a centered, clean editing canvas with instant live WYSIWYG rendering for headings, bold, links, lists, code, and Mermaid diagrams. Users can trust that saving maintains pure CommonMark/GFM formatting and preserves YAML frontmatter byte-for-byte on disk without injected HTML.
**FRs covered:** FR-6, FR-7, FR-9

### Epic 3: External File Synchronization & Conflict Guard
Users can keep `snipnote` open side-by-side with their terminal while Claude Code generates or edits spec files on disk. Clean files auto-reload seamlessly with preserved cursor/scroll position, while unsaved buffers display an inline non-blocking banner (`File changed on disk — [Reload] [Keep mine]`) without data loss. Snipnote never triggers false reloads on its own saves.
**FRs covered:** FR-8

### Epic 4: Fast Keyboard Navigation & Document Insights
Users can navigate their vault at keyboard speed using a ⌘P Command Palette to instantly fuzzy-search and jump between notes by filename, traverse their session tab history with back/forward arrows, and monitor live word, character, and paragraph statistics in the quiet Status Bar as they write.
**FRs covered:** FR-4, FR-5, FR-10

## Epic 1: Workspace Shell & Vault Access

Users can launch the branded `snipnote` desktop application (with native window traffic lights, clean identity, LocalEditor styling, and hardened security), pick any local folder as their note vault via system dialog, explore their folder and `.md` file hierarchy 1:1 in the Sidebar with active file highlighting, and have their vault path and window geometry restored automatically on relaunch.

### Story 1.1: Project Branding, Configuration & Hardening

As a developer/user,
I want the Tauri application and package manifests rebranded to `snipnote` with production bundle IDs, native window properties, and security headers,
So that the desktop shell is cleanly identified and hardened against security regressions.

**Acceptance Criteria:**

**Given** `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`,
**When** inspected,
**Then** the package name, crate name, and `productName` are all `snipnote`, the bundle identifier is `com.achuth.snipnote`, and the window title is `snipnote`.
**And** `index.html` has title `snipnote`.

**Given** `src-tauri/tauri.conf.json`,
**When** window settings are evaluated,
**Then** the window enforces `minWidth: 800`, `minHeight: 600`, and macOS native traffic light window controls.

**Given** the application security configuration in `src-tauri/tauri.conf.json`,
**When** CSP is evaluated,
**Then** Tauri CSP is strictly configured to `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:;` with no external scripts allowed.

### Story 1.2: LocalEditor Design System & Shell Wireframe

As a user,
I want a clean 2-pane + 2-bar desktop layout styled with the LocalEditor design tokens,
So that I have a calm, distraction-free reading and editing surface beside my terminal.

**Acceptance Criteria:**

**Given** the launched application,
**When** rendered,
**Then** the screen displays a fixed 260px Sidebar on the left, a 40px Header TabBar on top, a centered 760px maximum width main canvas with 24px gutters, and a 24px StatusBar at the bottom.

**Given** the CSS design tokens,
**When** evaluated,
**Then** the palette implements `#FFFFFF` (canvas), `#F8F8F9` (sidebar), `#EAEAEA` (hairlines), `#0F0F0F` (primary), `#F6F6F7` (muted), `#6B7280` (muted-foreground), and `#2563EB` (link blue), along with the Inter/system sans typography ramp.

### Story 1.3: Rust Storage Service & Vault Directory Scanning

As a user,
I want the Rust backend to recursively scan and index my local vault directory,
So that my markdown files are discovered at native speed without risking frontend filesystem vulnerabilities.

**Acceptance Criteria:**

**Given** a local directory containing `.md` files and nested subfolders,
**When** the Rust command `scan_vault` is called via Tauri IPC,
**Then** it returns a recursive `VaultNode` structure (`{ path, name, isDirectory, children }`) containing only subdirectories and `.md` files, sorted alphabetically.
**And** all non-markdown files (except directories) are filtered out from the tree.

### Story 1.4: Vault Opening, File Tree Rendering & Active File Highlighting

As a user,
I want to select a local directory via a native OS dialog and browse my notes in an interactive Sidebar File Tree,
So that I can easily inspect and select notes from my vault with 1:1 disk accuracy.

**Acceptance Criteria:**

**Given** the app in an empty state (no vault selected),
**When** the user clicks "Open Vault" in the empty state or Sidebar,
**Then** a native OS folder picker dialog opens.
**When** a folder is selected,
**Then** `useVaultStore` updates and the Sidebar renders the hierarchical file tree with expandable/collapsible folder chevrons.
**When** a note row is clicked,
**Then** it receives the active highlight (`accent` background, 8px radius) and registers as the active file in `useTabStore`.

### Story 1.5: Cold-Start Session & Window State Persistence

As a user,
I want my opened vault and window geometry remembered across relaunches,
So that I never have to re-select my vault or reposition my window when reopening the app.

**Acceptance Criteria:**

**Given** an open vault and customized window size/position,
**When** the application is closed and reopened,
**Then** the Rust setup lifecycle restores window size and position from `$APP_CONFIG_DIR/session.json` before displaying the window (preventing visual flickers).
**And** the previously opened vault path is automatically re-scanned and rendered without prompt.

## Epic 2: Live Markdown Editor & Document Fidelity

Users can open, view, edit, and create new notes (`+` button) in a centered, clean editing canvas with instant live WYSIWYG rendering for headings, bold, links, lists, code, and Mermaid diagrams. Users can trust that saving maintains pure CommonMark/GFM formatting and preserves YAML frontmatter byte-for-byte on disk without injected HTML.

### Story 2.1: Rust File I/O & Note Envelope Model
As a user,
I want the Rust backend to load and save notes using the Note Envelope Model (separating frontmatter from markdown body),
So that my note frontmatter is preserved byte-for-byte on disk while keeping my editing buffer clean.

**Acceptance Criteria:**
**Given** a markdown file on disk with YAML frontmatter (`---...---`),
**When** `read_file(path)` is called via Tauri IPC,
**Then** the Rust backend parses the note into `{ frontmatter: string | null, body: string }` and returns it without modifying the disk contents.
**Given** an active note buffer and preserved frontmatter string,
**When** `write_file(path, body, frontmatter)` is called,
**Then** the Rust backend reassembles the envelope verbatim (`---\n{frontmatter}\n---\n\n{body}`) and writes it atomically via temporary file rename to prevent data corruption.
**And** unit tests in Rust verify envelope round-trip preservation and atomic persistence.

### Story 2.2: Tiptap WYSIWYG Markdown Editor Engine
As a user,
I want a clean, responsive WYSIWYG markdown editing surface with Inter typography,
So that reading and writing notes feels effortless and visually polished.

**Acceptance Criteria:**
**Given** an active markdown note selected in the file tree,
**When** loaded into the editor surface,
**Then** the Tiptap headless engine renders headings, bold, italics, lists, blockquotes, and code blocks live in a centered 760px canvas with 24px reading gutters.
**And** styling adheres strictly to the LocalEditor monochrome design tokens.

### Story 2.3: 500ms Debounced Auto-Save & Flush Lifecycle
As a user,
I want my edits automatically saved without interruption,
So that my work is continuously safely persisted to disk without lag or disk thrashing.

**Acceptance Criteria:**
**Given** active keystrokes in the editor,
**When** typing pauses for 500ms,
**Then** an auto-save triggers via `write_file`.
**When** the user switches tabs, blurs the window, or closes the app,
**Then** any pending changes are immediately flushed to disk synchronously before the navigation completes.

### Story 2.4: Instant Disk-First Note Creation
As a user,
I want clicking the `+` button to immediately create a new note on disk,
So that my notes are always grounded in the filesystem without orphaned unsaved scratch buffers.

**Acceptance Criteria:**
**Given** an opened vault,
**When** the user clicks the `+` button in the TabBar or presses `⌘N`,
**Then** Rust command `create_note` generates the next available `Untitled.md` (or `Untitled 1.md`) directly in the vault root.
**And** the file tree refreshes and the new note is immediately selected and focused in the editor.

### Story 2.5: Interactive Mermaid Diagram Rendering
As a user,
I want code blocks marked with `mermaid` to render as live interactive diagrams,
So that architecture and workflow diagrams are visualized inline directly beside my notes.

**Acceptance Criteria:**
**Given** a markdown note containing a ` ```mermaid ` code block,
**When** rendered in the editor,
**Then** a custom NodeView renders the syntax into an SVG diagram inline.
**And** syntax errors display a quiet warning box instead of crashing the editor.

## Epic 3: External File Synchronization & Conflict Guard

Users can keep `snipnote` open side-by-side with their terminal while Claude Code generates or edits spec files on disk. Clean files auto-reload seamlessly with preserved cursor/scroll position, while unsaved buffers display an inline non-blocking banner (`File changed on disk — [Reload] [Keep mine]`) without data loss. Snipnote never triggers false reloads on its own saves.

### Story 3.1: Rust `notify` File Watcher & Vault Change Stream
As a user,
I want the Rust backend to watch my vault directory for external changes using native filesystem events,
So that edits made by Claude Code in the terminal are immediately detected by Snipnote.

**Acceptance Criteria:**
**Given** an open vault directory,
**When** files or folders are created, deleted, or modified on disk by external tools,
**Then** the Rust `notify` background watcher detects the change and emits a Tauri `vault-changed` event containing `{ path: string, kind: string }`.
**And** non-markdown files and hidden directories (`.git`) are filtered out.

### Story 3.2: Echo Suppression Cache (AD-3)
As a user,
I want Snipnote to recognize its own saves,
So that local typing and debounced saves never trigger self-inflicted reload loops or false conflict banners.

**Acceptance Criteria:**
**Given** Snipnote executing `write_file`,
**When** the write completes,
**Then** the canonical file path and timestamp are recorded in an in-memory `RecentlyWritten` cache with a 2-second TTL.
**When** the file watcher intercepts a file modification event matching a `RecentlyWritten` entry,
**Then** the event is silently dropped and no `vault-changed` event is emitted.

### Story 3.3: Live Auto-Reload & Non-Blocking Conflict Banner (AD-4)
As a user,
I want clean files to reload instantly when modified externally, and dirty buffers protected with an inline conflict banner,
So that I can fluidly collaborate with Claude Code without losing unsaved changes.

**Acceptance Criteria:**
**Given** the active open note modified externally by Claude Code,
**When** the editor buffer is clean (`isDirty: false`),
**Then** Snipnote automatically re-reads the file from disk and updates the editor content without prompting.
**When** the editor buffer has unsaved changes (`isDirty: true`),
**Then** Snipnote displays a non-blocking banner docked under the Tab Bar:
`File changed on disk — [Reload] [Keep mine]`
**When** clicking "Reload", the local changes are discarded and the disk file loaded.
**When** clicking "Keep mine", the banner is dismissed and local changes retained.
**And** when the vault tree structure changes, the sidebar file tree automatically refreshes within 2 seconds.

## Epic 4: Fast Keyboard Navigation & Document Insights

Users can navigate their vault at keyboard speed using a ⌘P Command Palette to instantly fuzzy-search and jump between notes by filename, traverse their session tab history with back/forward arrows, and monitor live word, character, and paragraph statistics in the quiet Status Bar as they write.

### Story 4.1: Command Palette & Fuzzy Search
As a user,
I want to press `⌘P` to open a centered search palette and fuzzy-search my notes,
So that I can switch between notes instantly without taking my hands off the keyboard.

### Story 4.2: Tab History Navigation Stack
As a user,
I want back and forward arrows and keyboard shortcuts to traverse my note history,
So that I can jump between recently referenced notes effortlessly.

### Story 4.3: Live Document Statistics & Status Bar
As a user,
I want to see real-time word, character, and paragraph counts in the Status Bar,
So that I have continuous unobtrusive insight into my writing progress.



