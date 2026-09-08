---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
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

- **FR-1**: User can pick a local folder as Vault via system dialog, WelcomeGate Choose Folder, or drag-drop. App persists and restores without re-prompting. [UPDATED 2026-09-08]
- **FR-2**: System displays File Tree in Sidebar with filtered FS: dot-folders shown only if subtree has `.md`, empty folders hidden, hidden files excluded, dirs-first then alpha, SVG icons + chevron. 
- **FR-3**: System highlights the currently open Note in File Tree and exposes Library footer with folder SVG + `Switch/Open…` + gear Settings (`{mod},` opens Settings **tab**). [UPDATED 2026-09-08]
- **FR-4**: User can press Cmd+P (Ctrl+P on Win/Linux) to focus Search, type a substring, see filtered Note filenames, and jump (opens as tab). Labels via `modShortcut`.
- **FR-5**: User can click a Note in File Tree or its Tab to make it active; tabs scrollable with `×`/`⌘W`/`Ctrl+Tab`, draft/dirty affordances; sidebar collapsible `{mod}B`.
- **FR-6**: Editor renders headings, bold, links, bullets live; Mermaid/tasks/code rendered; draft `isNew` empty until `hasContent`.
- **FR-7**: System preserves Markdown Source on save as CommonMark/GFM with no injected HTML; frontmatter verbatim; atomic write + `hasContent` guard.
- **FR-8**: File watcher: clean auto-reload; dirty banner Reload / Keep mine.
- **FR-9**: Multi-tab lifecycle with draft-until-content `+`/`⌘N`; `openTabs` persisted.
- **FR-10**: Live word/char/paragraph Status Bar.
- **FR-11**: Platform-split window: macOS Overlay + Sidebar vibrancy; Windows native decorations + Mica; Linux opaque; persist geometry + `openTabs`. [UPDATED 2026-09-08]
- **FR-12**: Theme Light/Dark/System + tint hue/intensity + Reduce Transparency in Settings. [UPDATED 2026-09-08]
- **FR-13**: Settings as editor **tab** via `{mod},`/gear; close via toggle or close tab. [UPDATED 2026-09-08]
- **FR-14**: Auto-update (startup ≤12h + Settings Check) and Launch at Login. [NEW 2026-09-08]

### NonFunctional Requirements

- **NFR-1 (Performance)**: Cold launch to Editor < 1.5s on M1; file open < 200ms for < 100KB md; search filter < 100ms for 500 files.
- **NFR-2 (Reliability)**: Never silently overwrite Markdown Source. Crash must not corrupt file (atomic write via temp file + rename).
- **NFR-3 (Privacy & Security)**: Local-first; no telemetry/cloud; vault files never leave disk; **outbound HTTPS allowed only for updater** endpoints; hardened Tauri CSP.
- **NFR-4 (Accessibility)**: Full keyboard navigability for Sidebar/File Tree, command palette, and Tab traversal; platform-correct shortcut labels.
- **NFR-5 (Observability)**: Local file-watcher errors surfaced as non-blocking UI banner, not silent failures.
- **NFR-6 (Testing & Quality)**: Round-trip serialization verified by automated test suite of at least 50 fixtures.

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

- **UX-DR1 (Design Tokens)**: Monochrome palette light (`#FFFFFF` editor, `#F8F8F9` sidebar, `#EAEAEA` hairlines, `#0F0F0F` primary, `#2563EB` link) + dark (`#141416` bg, `#1A1A1E` sidebar, `#2A2A2E` border, `#EDEEF0` fg, `#60A5FA` link) + translucent `rgba` over vibrant Sidebar/Mica (`bg 0.78` white / `0.72` dark, etc.) via `src/App.css:1` + `html[data-theme]`.
- **UX-DR2 (Typography)**: Inter / SF Pro Text typography ramp: body sans 14px/1.6, sidebar/status sans-sm 13px/1.5, mono 13px/1.6, heading-1 24px/700, heading-2 18px/600, display 18px/600.
- **UX-DR3 (Layout & Spacing)**: Sidebar 260px (collapsible), TabBar 40px, Editor 760px / Settings 640px / WelcomeGate 420px, StatusBar 24px; window `1280×720` platform-split chrome; Right Panel hidden.
- **UX-DR4 (Sidebar & File Tree)**: Hierarchical tree with SVG folder/file icons, active accent highlight, filtered FS rules.
- **UX-DR5 (Command Palette)**: Elevated opaque palette via `{mod}P`, filename filter, keyboard nav.
- **UX-DR6 (Tab Bar)**: Multi-tabs with draft/dirty affordances; welcomeMode minimal chrome; platform caption spacing.
- **UX-DR7 (Status Bar)**: Quiet words/chars/paragraphs.
- **UX-DR8 (Conflict Banner)**: Inline Reload / Keep mine under Tab Bar.
- **UX-DR9 (Settings)**: Settings **tab** (`SettingsView`) — Appearance (theme, hue, intensity, reduce transparency), Writing, System (autostart, automatic updates, check), Diagnostics.
- **UX-DR10 (Theme)**: `light|dark|system` + tint + Reduce Transparency via `useThemeStore`.
- **UX-DR11 (WelcomeGate)**: Brand-first first-run drop zone + Choose Folder + `modShortcut("O")`.
- **UX-DR12 (Shortcuts)**: All chrome chips use `modShortcut` (`⌘` mac / `Ctrl+` Win).

### FR Coverage Map

- **FR-1**: Epic 1 — Open vault + WelcomeGate
- **FR-2**: Epic 1 — Filtered File Tree
- **FR-3**: Epic 1 — Active highlight + Library + Settings gear
- **FR-4**: Epic 4 — `{mod}P` Command Palette
- **FR-5**: Epic 4 — File Tree / multi-tab / sidebar toggle
- **FR-6**: Epic 2 — Live WYSIWYG + Mermaid
- **FR-7**: Epic 2 — Round-trip fidelity
- **FR-8**: Epic 3 — Watcher + conflict banner
- **FR-9**: Epic 2 — Multi-tab draft-until-content
- **FR-10**: Epic 4 — Status Bar stats
- **FR-11**: Epic 1 — Platform chrome + material
- **FR-12**: Epic 1 — Theme + tint
- **FR-13**: Epic 1 — Settings tab
- **FR-14**: Epic 5 — Auto-update + Launch at Login (Story 5.9)

## Epic List

### Epic F: Floating Notes & Menu Bar (v1 Ship) [NEW 2026-09-08]
Users get notes from the **menu bar / tray**: global hotkey toggles a floating panel hosting shared `EditorSurface`; Settings and updater remain available; full vault shell stays behind a flag.
**FRs covered:** FR-F1..FR-F6 (+ shared FR-6, FR-7, FR-8, FR-12, FR-14)

#### Story F.1: System tray / menu bar
As a user, I want a tray/menubar icon with Show, New note, Settings, Quit,
So that snipnote is always reachable without a full window.

#### Story F.2: Floating panel window
As a user, I want a compact floating panel,
So that I can write without the full vault chrome.

#### Story F.3: Global hotkey
As a user, I want `CmdOrCtrl+Shift+Space` to show/hide the panel,
So that capture is one gesture.

#### Story F.4: EditorSurface in the panel
As a user, I want the same TipTap editor and autosave in the float,
So that files stay faithful Markdown on disk.

#### Story F.5: Settings from tray/panel
As a user, I want SettingsView from the tray or panel,
So that theme/updater/autostart work without the full shell.

#### Story F.6: Full editor (v2) feature flag
As a user/builder, I want to enable the existing full vault window,
So that v2 shell remains available without being default.

### Epic 1: Workspace Shell & Vault Access (**v2**)
Users can enable the branded full-size vault application (Sidebar, WelcomeGate, tabs, platform chrome) when the full-editor flag is on.
**FRs covered:** FR-1, FR-2, FR-3, FR-11, FR-12, FR-13 (v2 path)

### Epic 2: Live Markdown Editor & Document Fidelity (shared v1+v2)
**FRs covered:** FR-6, FR-7, FR-9 (FR-9 multi-tab primarily v2)

### Epic 3: External File Synchronization & Conflict Guard (shared)
**FRs covered:** FR-8

### Epic 4: Fast Keyboard Navigation & Document Insights (**v2-primary**)
**FRs covered:** FR-4, FR-5, FR-10

### Epic 5: Native Desktop Polish
Updater/autostart remain **v1**; Overlay-heavy chrome stories apply to v2 shell / float as appropriate.
**FRs covered:** FR-14 + polish stories

## Epic 1: Workspace Shell & Vault Access

Users can launch the branded `snipnote` desktop application (with native window traffic lights, clean identity, LocalEditor styling, and hardened security), pick any local folder as their note vault via system dialog, explore their folder and `.md` file hierarchy 1:1 in the Sidebar with active file highlighting, and have their vault path and window geometry restored automatically on relaunch.

### Story 1.1: Project Branding, Configuration & Hardening

As a developer/user,
I want the Tauri application and package manifests rebranded to `snipnote` with production bundle IDs, native window properties, and security headers,
So that the desktop shell is cleanly identified and hardened against security regressions.

**Acceptance Criteria:**

**Given** `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`,
**When** inspected,
**Then** the package name, crate name, and `productName` are all `snipnote`, the bundle identifier is `com.achuth.snipnote`, and the product window title is `snipnote` on non-macOS (macOS Overlay uses empty title).
**And** `index.html` has title `snipnote`.

**Given** `src-tauri/src/lib.rs` window setup,
**When** built for each OS,
**Then** macOS uses Overlay + empty title + `Effect::Sidebar` + radius 12; Windows uses native decorations + titled window + `Effect::Mica` (soft-fail ok); Linux uses native + opaque fills; window size `1280×720` min `1100×600` `transparent:true`.
**And** CSS `html/body` remain transparent with translucent shell fills (or opaque when Reduce Transparency / unsupported).

**Given** the application security configuration in `src-tauri/tauri.conf.json`,
**When** CSP is evaluated,
**Then** Tauri CSP is strictly configured to `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:;` with no external scripts allowed.

### Story 1.2: LocalEditor Design System & Shell Wireframe (Vibrant + Dark + Multi-Tab)

As a user,
I want a clean vibrant 2-pane + 2-bar (3-pane-ready, right hidden) desktop layout styled with the LocalEditor design tokens plus dark theme,
So that I have a calm, distraction-free reading and editing surface beside my terminal.

**Acceptance Criteria:**

**Given** the launched application,
**When** rendered,
**Then** the screen displays a fixed 260px Sidebar on the left (with SVG folder/file icons + chevron), a 40px Header TabBar on top (scrollable multi-tabs `28px` `max 180px` + `×` + `+`), a centered 760px maximum width main canvas with 24px gutters, and a 24px StatusBar at the bottom; Right Panel `420px` Terminal/Browser/Canvas is built but hidden (`App.tsx` commented) for later.
**And** vibrant window shows `transparent` + `Sidebar`/`Mica` `radius 12` with translucent fills; Right Panel hidden does not affect layout.

**Given** the CSS design tokens in `src/App.css:1`,
**When** evaluated,
**Then** the palette implements light `#FFFFFF`/`#F8F8F9`/`#EAEAEA`/`#0F0F0F` and dark `[data-theme="dark"]` `#141416`/`#1A1A1E`/`#2A2A2E`/`#EDEEF0` + translucent `rgba` variants (`bg 0.78` white / `0.72` dark, etc.), along with the Inter/system sans typography ramp and `[data-theme]` switching via `useThemeStore`.

### Story 1.3: Rust Storage Service & Vault Directory Scanning (Dot-Folders + Hide Empty)

As a user,
I want the Rust backend to recursively scan and index my local vault directory with filtered rules,
So that my markdown files are discovered at native speed without clutter from empty folders.

**Acceptance Criteria:**

**Given** a local directory containing `.md` files, nested subfolders, dot-folders, empty folders, and hidden files,
**When** the Rust command `scan_vault` (`src-tauri/src/storage.rs:79` `scan_directory`) is called via Tauri IPC,
**Then** it returns a recursive `VaultNode` structure (`{ path, name, isDirectory, children }`) containing only subdirectories whose subtree contains `.md`/`.markdown` (empty folders hidden, e.g. `Beta` or `.emptyDot` hidden) and `.md` files (e.g. `.templates/template.md` shown because its dot-folder contains md), sorted `dirs-first then alpha case-insensitive` with SVG icons in UI.
**And** hidden files (dot-files like `.DS_Store`, `.hidden.md`) and non-markdown files (except directories) are filtered out from the tree.
**And** `watcher::should_emit_change` still emits markdown changes inside dot-folders (e.g. `.templates/template.md`).

### Story 1.4: Vault Opening, File Tree Rendering & Active File Highlighting (Icons + Settings)

As a user,
I want to select a local directory via a native OS dialog and browse my notes in an interactive Sidebar File Tree with icons,
So that I can easily inspect and select notes from my vault with filtered accuracy and open Settings.

**Acceptance Criteria:**

**Given** the app in an empty state (no vault selected),
**When** the user clicks "Open Vault" in the empty state or Sidebar,
**Then** a native OS folder picker dialog opens.
**When** a folder is selected,
**Then** `useVaultStore` updates and the Sidebar renders the hierarchical file tree with SVG folder (`FolderIcon` closed/open `0.14 fill`) + file (`FileIcon` doc with md lines) + `14px` chevron `rotate 90` when open, and indent spacer for files.
**When** a note row is clicked,
**Then** it receives the active highlight (`accent-translucent` `8px` radius, `muted-fg`→`fg` on hover/active) and opens as tab via `useTabStore.selectNote` (adds to `tabs` if not present).
**And** Sidebar footer shows folder SVG + vault name + `Switch/Open…` + gear Settings (`⌘,`) button (`Sidebar.tsx:5`).

### Story 1.5: Cold-Start Session, Tabs & Theme Persistence

As a user,
I want my opened vault, open tabs, active tab, theme, and window geometry remembered across relaunches,
So that I never have to re-select my vault or reposition my window when reopening the app.

**Acceptance Criteria:**

**Given** an open vault with multiple tabs (`Untitled.md` drafts excluded) and theme `light|dark|system` and customized window size/position,
**When** the application is closed and reopened,
**Then** Rust `session.rs:6` restores `{lastVaultPath, activeFilePath, openTabs: string[]}` from `$APP_CONFIG_DIR/session.json` (sanitized to existing files) + `App.tsx:32` restores via `setTabs` before window show; theme restores from `localStorage snipnote-theme` via `useThemeStore` + `html[data-theme]` before paint (preventing flicker).
**And** the previously opened vault path is automatically re-scanned and rendered without prompt, with tabs re-opened; draft `isNew` tabs are not persisted.

### Story 1.6: Vibrant Window Material (Sidebar/Mica via EffectsBuilder)

As a user,
I want my window to feel native with macOS Sidebar vibrancy and Windows Mica,
So that snipnote feels at home beside Finder/Explorer and respects light/dark.

**Acceptance Criteria:**

**Given** `src-tauri/src/lib.rs` platform-split effects + chrome,
**When** launched on macOS 10.14+,
**Then** Overlay title bar + empty title + `Effect::Sidebar` + radius 12 apply; translucent fills show material.
**When** launched on Windows 11,
**Then** native decorations + titled window + `Effect::Mica` apply (soft-fail ok on older Windows).
**And** `html,body,#root` remain transparent; Linux falls back to opaque hexes; no combined `[Sidebar, Mica]` list.

### Story 1.7: Light/Dark/System Theme + Settings Tab (`{mod},`)

As a user,
I want to choose theme, tint, and transparency in a Settings tab opened via `{mod},`/gear,
So that I can match my OS and keep vibrant readability.

**Acceptance Criteria:**

**Given** `useThemeStore` + `SettingsView.tsx` + `App.css` `[data-theme="dark"]`,
**When** the user presses `{mod},` or clicks gear,
**Then** Settings opens as an editor **tab** (not a modal) with Appearance (theme, hue, intensity, reduce transparency), Writing, System, and Diagnostics.
**And** theme/tint persist via localStorage; System follows `prefers-color-scheme` live.
**And** closing via `{mod},` again or close tab returns to prior note/home.

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
### Story 2.3: 500ms Debounced Auto-Save & Flush Lifecycle (Draft Guard)
As a user,
I want my edits automatically saved without interruption but without creating empty files,
So that my work is continuously safely persisted to disk without lag or disk thrashing and without polluting vault with empty `Untitled.md`.

**Acceptance Criteria:**

**Given** active keystrokes in the editor (including `FrontmatterTable`),
**When** typing pauses for 500ms,
**Then** an auto-save triggers via `write_file` only if `isDirty` and `hasContent` (`body.trim()||frontmatter.trim() >0`); empty draft `isNew` with no content does nothing (`src/stores/useEditorStore.ts:84` guard + `EditorSurface.tsx:12` `triggerAutoSave` `wasNew && !hasContent` skip).
**When** the user switches tabs, blurs the window, or closes the app,
**Then** any pending changes are immediately flushed to disk synchronously before the navigation completes with same `hasContent` guard; after `isNew` draft with content saves, `markTabSaved(false)` + `loadVault` shows file in tree.
### Story 2.4: Draft-Until-Content Note Creation (was Disk-First)
As a user,
I want clicking the `+` button to immediately open a draft tab without touching disk,
So that empty `Untitled.md` tabs don't pollute my vault until they have content.

**Acceptance Criteria:**

**Given** an opened vault (or no vault → `openVaultDialog` first),
**When** the user clicks the `+` button in the TabBar or presses `⌘N`,
**Then** `App.tsx:124` `handleNewNote` generates next non-colliding `Untitled.md`/`Untitled 1.md` vs. existing files + open tabs (e.g. `baseVault/Untitled.md` vs. `Set(existingPaths)`), and `selectNote(path,name,{isNew:true})` opens a draft tab with italic title + hollow dot / `draft` label, `editor.setContent("")` without `read_file`, and does NOT call `create_note` nor create file on disk.
**And** typing content → 500ms debounce → `hasContent` → `write_file` → file appears in tree via `loadVault` after `markTabSaved`; closing empty draft with `×`/`⌘W` without content just closes tab with no disk side-effect.

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

**Acceptance Criteria:**

**Given** an open note with content in the Editor,
**When** the user types or loads a note,
**Then** the Status Bar updates within 50ms to show `X words | Y characters | Z paragraphs` (paragraph = blank-line block).
**And** the Status Bar remains `status-translucent` over vibrant, `11px` `muted-fg` right-aligned with `Raw/Rich` toggle at far right.

## Epic 5: Native Desktop Polish

Users feel snipnote as a native macOS/Win app: real App Menu, traffic-lights `Overlay` + `FullScreen`, `Reveal in Finder`/`Quick Look`/`Share`, `Context Menus`, drag & drop, `Find` `⌘F`, spellcheck, file association, overlay scrollbars + spring motion, notifications, `SF Symbols`, `VoiceOver`/`High Contrast`, `Sparkle` update + `Launch at Login`, haptics — all polished without cloud.
**FRs covered:** FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28

### Story 5.1: Native App Menu & Window Chrome

As a user,
I want a native `App Menu` and proper window chrome with traffic-lights `Overlay` and `FullScreen` `^⌘F` support,
So that snipnote feels at home beside Finder/Explorer and respects window management.

**Acceptance Criteria:**

**Given** `src-tauri/tauri.conf.json:12` `transparent:true` + `macOSPrivateApi:true` + `titleBarStyle Overlay` + `EffectsBuilder` vibrant already, and `tauri-plugin-menu` installed,
**When** the user opens the `App Menu`,
**Then** `File` shows `New` `⌘N` draft, `Open Vault…` `⌘O`, `Save` `⌘S` (auto-save), `Close Tab` `⌘W`; `Edit` shows `Undo` `⌘Z`/`Redo` `⇧⌘Z`/`Cut`/`Copy`/`Paste`/`Select All`; `View` shows `Toggle Sidebar`/`Appearance` `Light/Dark/System` (syncs `useThemeStore`); `Window` shows `Minimize` `⌘M`/`Zoom`/`FullScreen` `^⌘F` with `Split View`/`Spaces`/`Stage Manager` support; `Help` + `Services`/`Hide` `⌘H`/`Quit` `⌘Q` are present.
**And** `FullScreen` toggles via `Window` → `FullScreen` and `^⌘F` without layout break.

### Story 5.2: Dock & Recent Documents + Single Instance & Deep Link

As a user,
I want `Dock` `Recent Vaults`, `Dock menu`, badge/progress, and `snipnote://open?path=` to open in the existing window,
So that I can jump back to vaults and open files from Finder/CLI without duplicate windows.

**Acceptance Criteria:**

**Given** an open vault,
**When** the user opens another vault,
**Then** `Recent Vaults` via `NSDocumentController`/`tauri-plugin-menu` lists it under `File` → `Open Recent`.
**Given** the app in `Dock`,
**When** the user right-clicks the Dock icon,
**Then** `Dock menu` shows `New Note`/`Open Vault` (via `tauri-plugin`).
**Given** a `snipnote://open?path=/vault/note.md` URL or `open` of `*.md` with `snipnote` as default app,
**When** invoked while an instance is running,
**Then** `Single Instance` (`tauri-plugin-single-instance`) focuses the existing window and `selectNote(path,name)` opens the file as tab (no second window).

### Story 5.3: Context Menus + Reveal/Quick Look/Share

As a user,
I want `right-click` `Context Menus` on File Tree and Editor with `Reveal`, `Quick Look`, and `Share`,
So that I can act on files without leaving the vault.

**Acceptance Criteria:**

**Given** a File Tree row `right-click`,
**When** the `ContextMenu` (`tauri-plugin-context-menu` or DOM `onContextMenu` + `Menu`) opens,
**Then** it shows `Reveal in Finder`/`Show in Explorer` (`opener reveal`), `Open with default app`, `Rename` (inline), `Delete` (move to trash), `New File/Folder`, `Copy Path`, `Copy Relative Path`.
**Given** an Editor `right-click`,
**When** invoked,
**Then** it shows `Cut`/`Copy`/`Paste`/`Select All`/`Inspect`.
**Given** a file selected and `Space` pressed,
**When** triggered,
**Then** `Quick Look` (`qlmanage`/`opener`) previews the file; `Share` sheet is available via `opener`.

### Story 5.4: Drag & Drop & File Association

As a user,
I want to drag files between Finder and vault and have `*.md` double-click open in snipnote,
So that vault management feels native.

**Acceptance Criteria:**

**Given** a Finder drag of files onto the vault window,
**When** dropped,
**Then** files are copied into the vault root (or dragged folder) and appear in File Tree within 500ms (via `scan_directory` refresh).
**Given** a vault note drag started in File Tree,
**When** dropped onto Finder/Desktop,
**Then** `NSFilePromise`/`tauri drag` provides `VaultNode.path` as file promise and creates the file at drop location.
**Given** `*.md`/`*.markdown` double-click in Finder with `snipnote` set as default (`CFBundleDocumentTypes` in `tauri.conf.json`),
**When** opened,
**Then** the existing window `selectNote` opens it as tab.

### Story 5.5: Find/Replace in Editor

As a user,
I want `⌘F` find bar in the Editor,
So that I can locate text without leaving the note.

**Acceptance Criteria:**

**Given** an open note with content and `⌘F` pressed,
**When** triggered,
**Then** a floating find bar (above Status Bar, `Esc` closes, `Enter`/`⇧Enter` next/prev) highlights matches in `ProseMirror` via `DecorationSet` and scrolls to them.
**And** `⇧⌘F` toggles replace input; `Find in Vault` remains future (filename `⌘P` stays).

### Story 5.6: SpellCheck & Overlay Scrollbars/Motion

As a user,
I want `SpellCheck` and native scrollbars/motion that respect OS settings,
So that typing feels native and accessible.

**Acceptance Criteria:**

**Given** `webview` `spellcheck: true` + `NSSpellChecker` autocorrect toggle in Settings (`tauri-plugin` + `SettingsDialog` switch),
**When** typing,
**Then** misspellings underline and `right-click` shows suggestions; toggle persists in `localStorage`.
**Given** `prefers-reduced-motion`/`prefers-reduced-transparency`,
**When** OS settings enabled,
**Then** palette/outline spring `0.2,0,0,1` is disabled and vibrant falls back to opaque hexes (`src/App.css:43`).

### Story 5.7: Notifications + SF Symbols + Visual Polish

As a user,
I want native notifications when `claude` writes while snipnote is hidden and `SF Symbols` where appropriate,
So that I stay aware without losing native look.

**Acceptance Criteria:**

**Given** `vault-changed` fires while window is hidden/minimized and active note is dirty,
**When** detected,
**Then** `NSUserNotification`/Win Toast (`tauri-plugin-notification`) shows `File changed on disk` (in addition to inline banner when visible); clicking focuses window and shows banner.
**Given** macOS,
**When** rendering folder/file icons,
**Then** `SF Symbols` (`folder`, `doc.richtext`, `magnifyingglass`, `gearshape`) via `SF Symbol` font or `NSImage` replace custom SVG fallback (keep SVG fallback for Win/Linux).

### Story 5.8: Accessibility

As a user relying on `VoiceOver`/`Full Keyboard Access`/`High Contrast`,
I want full `a11y` support,
So that snipnote is usable without a mouse.

**Acceptance Criteria:**

**Given** `VoiceOver` rotor,
**When** navigating,
**Then** headings are reachable via outline `role=navigation` (done) + `aria-*` on File Tree (`role=tree` `aria-expanded`/`selected`) and `TabBar` (`role=tablist`/`aria-selected` done) and `CommandPalette` (`aria-live`) + `StatusBar` live region.
**And** `Full Keyboard Access` `Tab` order: `Sidebar Search` → `File Tree` (roving `tabindex`) → `Library` → `TabBar` `+` → `Editor` → `StatusBar` `Raw` toggle → `Settings` (all `Tab`-reachable, `Esc` returns to Editor).
**And** `High Contrast` `prefers-contrast` increases border contrast (`--border` `2px`).

### Story 5.9: Distribution: Auto-update, Launch at Login, Haptics

As a user,
I want signed auto-updates, Launch at Login, and subtle haptics,
So that snipnote stays fresh and feels tactile.

**Acceptance Criteria:**

**Given** `tauri-plugin-updater` + pubkey/endpoints in `tauri.conf.json` + `src/lib/updater.ts`,
**When** Automatic Updates is enabled (default on) and a published newer release exists,
**Then** startup check (~4s after reveal, ≤12h) prompts to download/install/relaunch; Settings Check always checks immediately.
**And** Launch at Login persists via `tauri-plugin-autostart`.
**And** draft GitHub Releases must be published before `/releases/latest/download/latest.json` works.
**And** haptics (`navigator.vibrate` / optional native) fire on sidebar/settings toggles.



