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
- **FR-2**: System displays File Tree in Sidebar with filtered FS: dot-folders (e.g. `.templates`) shown only if subtree has `.md`, empty folders hidden, hidden files (`.DS_Store`, `.hidden.md`) excluded, sorted dirs-first then alpha, with SVG folder/file icons + chevron rotate. [UPDATED 2026-09-03: was strict 1:1; now filtered + icons, see `storage.rs:79`]
- **FR-3**: System highlights the currently open Note in File Tree and exposes Library entry in Sidebar footer with folder SVG + `Switch/Open…` + gear Settings (`⌘,` overlay). [UPDATED: icons + gear]
- **FR-4**: User can press Cmd+P (Ctrl+P on Win/Linux) to focus Search, type a substring, see filtered list of Note filenames, and jump to selected note (opens as tab).
- **FR-5**: User can click a Note in File Tree or its Tab to make it active, with highlight and Tab Bar update; tabs are scrollable multi-tabs with `×` close, `⌘W` close, `Ctrl/⌘+Tab` cycle, draft italic/hollow, dirty •/saving…. Back/forward arrows navigate session tab history.
- **FR-6**: Editor renders headings, bold, links, and bullets live as user types without a split preview pane. Fenced Mermaid blocks, task lists, and inline code are rendered. Draft `isNew` tabs init empty without `read_file` until `hasContent`.
- **FR-7**: System preserves Markdown Source on save exactly as standard CommonMark/GFM with no injected HTML/class attributes. Frontmatter is preserved verbatim. Save is atomic temp+rename; draft guard `hasContent` prevents empty file creation.
- **FR-8**: System watches Markdown Source on disk; when external agents (Claude) write to a Note: auto-reloads if clean (dirty=false); displays non-blocking banner "File changed on disk — Reload / Keep mine" if dirty (dirty=true). Dot-folder markdown still emits.
- **FR-9**: User can open notes as tabs (`+`/`⌘N` creates draft `Untitled.md` `{isNew:true}` virtual, no disk until content → 500ms debounce `write_file` → `markTabSaved` + `loadVault`; `×`/`⌘W` close, `openTabs` persisted in `session.json`). [UPDATED: was immediate disk create; now draft-until-content]
- **FR-10**: System shows live word count, character count, and paragraph count in Status Bar, updating on every keystroke and on file load.
- **FR-11**: System shows standard macOS traffic lights over vibrant window (`Sidebar` on macOS / `Mica` on Win11 via `EffectsBuilder`, `transparent:true`, `radius 12`, `1280×720` `min 1100×600` `Overlay`) and persists window size/position + `openTabs` across relaunch.
- **FR-12**: User can pick Light/Dark/System theme in Settings (`⌘,`) — `System` follows `prefers-color-scheme` live; `data-theme` drives `App.css [data-theme="dark"]` overrides, persisted in `localStorage snipnote-theme`. [NEW 2026-09-03]
- **FR-13**: User can open Settings overlay via `⌘,`/`Ctrl+,` or Sidebar gear, close via `Esc`/`×`/`Done`/`⌘,` toggle, and switch theme. [NEW 2026-09-03]

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

- **UX-DR1 (Design Tokens)**: Monochrome palette light (`#FFFFFF` editor, `#F8F8F9` sidebar, `#EAEAEA` hairlines, `#0F0F0F` primary, `#2563EB` link) + dark (`#141416` bg, `#1A1A1E` sidebar, `#2A2A2E` border, `#EDEEF0` fg, `#60A5FA` link) + translucent `rgba` over vibrant Sidebar/Mica (`bg 0.78` white / `0.72` dark, etc.) via `src/App.css:1` + `html[data-theme]`.
- **UX-DR2 (Typography)**: Inter / SF Pro Text typography ramp: body sans 14px/1.6, sidebar/status sans-sm 13px/1.5, mono 13px/1.6, heading-1 24px/700, heading-2 18px/600, display 18px/600.
- **UX-DR3 (Layout & Spacing)**: Fixed 260px Sidebar (Search header 40px, scrollable File Tree, Library footer 40px with gear), Main area with 40px TabBar (scrollable tabs `28px` `max 180px`), centered 760px max-width EditorSurface with 24px gutters, and 24px StatusBar; Right Panel `420px` Terminal/Browser/Canvas built but hidden (`App.tsx` commented); window `1280×720` `min 1100×600` vibrant `radius 12` `Overlay`.
- **UX-DR4 (Sidebar & File Tree)**: Hierarchical tree view with SVG folder (closed/open `0.14 fill`) + `16px` file (doc with md lines) + `14px` chevron rotate, `.md` note rows, active row highlight (`accent-translucent` `8px` radius), hover `hover-translucent`, dot-folders shown only if contain md, empty hidden.
- **UX-DR5 (Command Palette)**: Elevated floating modal (`white`/`dark #141416`, `12px` radius, shadow `0 8px 32px`, `520×400`) triggered by `⌘P`, fuzzy filtering note filenames with keyboard navigation (Up/Down/Enter/Esc), opens as tab.
- **UX-DR6 (Tab Bar)**: `40px` height, bottom `border-translucent`, `bg-translucent`, `26px` back/forward `←→`, scrollable `tabs-scroll` (`gap 6px`, hidden scrollbar) with `tab-item` (`28px`, `is-active` `bg`+`border`+shadow, `is-draft` italic + hollow `6px` / `draft` label, dirty `•`, `saving…`, `×` close), right `+` `26px` draft-until-content.
- **UX-DR7 (Status Bar)**: Quiet `11px` mono/sans-sm muted text right-aligned showing `X words | Y characters | Z paragraphs`, translucent `status-translucent` over vibrant.
- **UX-DR8 (Conflict Banner)**: Non-blocking inline banner docked directly under Tab Bar (`muted-translucent`, `border-translucent`, `6px` radius, `13px` text) with "Reload" and "Keep mine" buttons.
- **UX-DR9 (Settings)**: Overlay `560px` `blur 8px` `z 10000` `12px` radius `shadow 0 20px 50px`, header `Settings` + `×`, body `Appearance` radios Light/Dark/System + About, footer `Done`; opened via `⌘,`/gear, closed via `Esc`/`×`.
- **UX-DR10 (Theme)**: `light|dark|system` via `useThemeStore` + `localStorage snipnote-theme` + `document[data-theme]` + `colorScheme`; System follows `prefers-color-scheme` live.

### FR Coverage Map

- **FR-1**: Epic 1 — Open local Vault via native dialog and restore across restarts
- **FR-2**: Epic 1 — Render filtered File Tree (dot-folders + hide empty) with SVG icons + alphabetical sorting
- **FR-3**: Epic 1 — Active File Highlight + Library footer with gear Settings
- **FR-4**: Epic 4 — ⌘P Command Palette fuzzy search across note filenames (opens as tab)
- **FR-5**: Epic 4 — Navigate via File Tree clicks and Tab Bar multi-tab + `×`/`⌘W`/`Ctrl+Tab` history
- **FR-6**: Epic 2 — Live WYSIWYG Markdown & Mermaid diagram rendering, draft-empty init
- **FR-7**: Epic 2 — Raw Markdown round-trip fidelity & Envelope frontmatter preservation + `hasContent` guard
- **FR-8**: Epic 3 — Real-time file watcher, echo suppression, and conflict resolution banner (dot-folder md still watched)
- **FR-9**: Epic 2 — Multi-tab lifecycle, draft-until-content `+`/`⌘N`, `openTabs` persistence in `session.json`
- **FR-10**: Epic 4 — Live document statistics (words, characters, paragraphs) in Status Bar
- **FR-11**: Epic 1 — Vibrant window (`Sidebar`/`Mica`, `1280×720`, `transparent`, `radius 12`) + native traffic lights + geometry + `openTabs` persistence
- **FR-12**: Epic 1 — Theme Light/Dark/System via `data-theme` + `localStorage` + `useThemeStore`
- **FR-13**: Epic 1 — Settings overlay via `⌘,`/gear

## Epic List

### Epic 1: Workspace Shell & Vault Access (Vibrant + Theme + Settings)
Users can launch the branded vibrant `snipnote` desktop application (`1280×720` `Sidebar`/`Mica` via `EffectsBuilder`, `transparent` + `radius 12`, traffic lights `Overlay`, `macos-private-api`, light/dark/system theme, `⌘,` Settings), pick any local folder as vault via system dialog, explore filtered hierarchy in Sidebar (dot-folders shown only if contain md, empty hidden, SVG icons), with active highlight, and have vault + `openTabs` + theme + window geometry restored automatically on relaunch.
**FRs covered:** FR-1, FR-2, FR-3, FR-11, FR-12, FR-13 (incorporates ARCH-1 + window material)

### Epic 2: Live Markdown Editor & Document Fidelity (Multi-Tab + Draft)
Users can open notes as tabs (`+` creates draft `{isNew:true}` `Untitled.md` not on disk until has content) in a centered, clean editing canvas with scrollable multi-tabs (`×`/`⌘W`/`Ctrl+Tab`), instant live WYSIWYG rendering for headings, bold, links, lists, code, and Mermaid diagrams. Users can trust saving maintains pure CommonMark/GFM and preserves YAML frontmatter byte-for-byte, with atomic write + `hasContent` guard and 500ms debounce.
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
**Then** the window enforces `width: 1280`, `height: 720`, `minWidth: 1100`, `minHeight: 600`, `transparent:true`, `macOSPrivateApi:true`, `titleBarStyle Overlay`, `macos-private-api` feature in `Cargo.toml`, and `EffectsBuilder([Sidebar,Mica],Active,radius12)` in `lib.rs:14` with `html/body` transparent + translucent `rgba` fills.
**And** macOS native traffic light window controls float over vibrant with `border-radius 12`.

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

**Given** `src-tauri/tauri.conf.json:12` `transparent:true` + `macOSPrivateApi:true` + `tauri` feature `macos-private-api` + `src-tauri/src/lib.rs:14` `.setup` `EffectsBuilder([Sidebar,Mica],Active,radius12)`,
**When** launched on macOS 10.14+ / Win11 22H1+,
**Then** sidebar `rgba(248,248,249,0.68)` / dark `rgba(26,26,30,0.68)` and editor `rgba(255,255,255,0.78)` / dark `rgba(20,20,22,0.72)` show wallpaper/Mica tint with `blur` and `border-radius 12`; `html,body,#root` remain `transparent`; Linux falls back to opaque hexes.

### Story 1.7: Light/Dark/System Theme + Settings (⌘,)

As a user,
I want to choose Light/Dark/System theme in a Settings overlay opened via `⌘,`/gear,
So that I can match my OS and keep vibrant readability.

**Acceptance Criteria:**

**Given** `src/stores/useThemeStore.ts:1` + `src/components/settings/SettingsDialog.tsx:1` + `src/App.css:43` `[data-theme="dark"]` + `Sidebar.tsx:5` gear,
**When** the user presses `⌘,`/`Ctrl+,` or clicks gear in Sidebar footer,
**Then** a modal overlay `560px` `blur 8px` appears with Appearance radios Light/Dark/System + About, footer `Done`; selecting a theme writes `localStorage snipnote-theme`, sets `html[data-theme]` + `colorScheme`, and System follows `prefers-color-scheme` live via `matchMedia` listener.
**And** tab bar, sidebar, editor, status, and settings reflect dark tokens (`#141416` etc.) with AA contrast over vibrant.

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



