---
title: snipnote EXPERIENCE
status: draft
created: 2026-09-02
updated: 2026-09-02
sources:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/forge/tauri-markdown-editor/forged-idea.md
  - https://localeditor.app
---

# snipnote — Experience Spine

> Desktop Tauri v2, full-size single window, local-first. Paired with `DESIGN.md` (LocalEditor.app minimal monochrome theme). Theme request theme like https://localeditor.app — light, content-first, "not every file needs an IDE."

## Foundation

**Form-factor:** Single-surface desktop (Tauri v2 + React 19 + Vite), full-size window, macOS primary (Win/Linux builds ready but not QA'd per PRD Open Question 5). No mobile/web in v1. `DESIGN.md` is the visual identity reference — monochrome LocalEditor palette (`{colors.sidebar}` `#F8F8F9`, `{colors.background}` `#FFFFFF`, `{colors.border}` `#EAEAEA`, `{colors.primary}` `#0F0F0F`). This spine is how it works; DESIGN.md is how it looks. Single Vault open at a time in v1 [ASSUMPTION]. No accounts, no cloud, no sync — files never leave disk. Auto-update deferred.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Welcome / Vault Picker | Cold launch, no vault set | Pick/confirm Vault folder, restore last vault |
| Main Window | Vault open | Two-pane + two-bar layout that is the entire v1 product |
| ├─ Sidebar | Persistent left `260px` | Search → File Tree → Library footer |
| ├─ Tab Bar | Top of Main | Back/forward, active Note name, `+` |
| ├─ Editor | Center, `760px` centered content | Live WYSIWYG markdown, raw Markdown Source on disk |
| └─ Status Bar | Bottom `24px` | Live `words | chars | paragraphs` |
| Command Palette (⌘P) | `⌘P` anywhere / click Search | Floating palette to jump to any Note by filename |
| File Changed Banner | Inline under Tab Bar when external change detected | `Reload / Keep mine` decision without loss |

→ Composition reference: PRD screenshot breakdown (`prds/prd-snipnote-2026-09-02/prd.md:1 §2.3`), LocalEditor.app `Pokedex.md` + `package.json` property panels for content-width and palette reference. Spine wins on conflict.

Sidebar always visible in v1 full-size window; no Sheet/collapse until later increments. Vault is a plain folder; File Tree is file-system truth (`Vault → File Tree` is 1:1, sorted alpha, `.md` only).

## Voice and Tone

Microcopy. Brand voice (quiet, local, calm, "stays out of the way") lives in `DESIGN.md` Brand & Style.

| Do | Don't |
|---|---|
| "Search notes…" | "Search your vault 🔍" |
| "No vault open. Pick a folder to start." | "Welcome to snipnote! Let's get started 🚀" |
| "File changed on disk — Reload / Keep mine" | "Conflict detected! Choose an action to resolve." |
| "174 words · 1,209 chars · 10 paragraphs" | "Word Count: 174 (Great job!)" |
| "Untitled.md" | "New Note (1)" |

Tone is LocalEditor-like: plain, local, never celebratory. No streaks, no "nice work!" toasts. Errors are factual: "Folder not found. Pick another."

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md` Components (or `{colors.*}` / `{rounded.*}` tokens when inherited).

| Component | Use | Behavioral rules |
|---|---|---|
| File Tree | Sidebar | Reflects file system 1:1, `.md` only, alpha sorted. Click folder toggles expand; click Note opens in Editor and highlights row with `{colors.accent}`. External rename/move (including by Claude) reflected within 2s. Empty folder shows no children, not a placeholder. |
| Search / Command Palette | Sidebar top + `⌘P` | `⌘P` focuses and floats palette (`{components.command-palette}`). Typing filters Note filenames substring, case-insensitive. `↑/↓` moves highlight, `Enter` jumps, `Esc` closes and returns focus to Editor. Palette also reachable by clicking Search input. [ASSUMPTION: filename-only in v1.] |
| Tab Bar | Main top | Shows active Note name and `+`. `+` creates `Untitled.md` in current folder (or Vault root) immediately on disk and focuses it. Back/forward navigate session history within window. Close of window persists tabs/vault for restore. [ASSUMPTION: multi-tab row visual but single active at a time per PRD FR-9.] |
| Editor | Main center | Tiptap live render: headings/bold/links/bullets render as typed, no preview toggle. Slash `/` not in v1 [ASSUMPTION: deferred, LocalEditor has slash commands but v1 ships live render only]. Load parses Markdown Source → Tiptap; save serializes back CommonMark/GFM, frontmatter preserved verbatim, no injected HTML. `⌘S` is implicit auto-save on debounce [ASSUMPTION: 500ms]. |
| Library footer | Sidebar bottom | Entry point to sort/options. In v1, `Library` exposes Sort (alpha) and `Open Vault…` (re-pick folder). No vault switcher beyond re-pick [ASSUMPTION per PRD Open Question 6]. |
| File Changed Banner | Inline under Tab Bar | Appears only when dirty Note overwritten on disk. Non-blocking, no auto-dismiss. `Reload` discards buffer and loads disk; `Keep mine` keeps buffer and suppresses banner until next external write. If clean, auto-reloads silently and preserves cursor/scroll. |
| Status Bar | Main bottom | Right-aligned, quiet. Updates on every keystroke and file load. Paragraph = blank-line block [ASSUMPTION]. No click actions in v1. |
| Welcome / Vault Picker | Cold launch | If no Vault persisted, show centered `display` headline "No vault open" + `sans-sm` body + primary `Button` "Open Vault…" (Tauri dialog). If Vault persisted but missing, show error + same action. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| No vault (first launch) | Welcome | `display`: "No vault open." Body: "Pick a folder — your files stay where they are." Primary button "Open Vault…" No sample files created. |
| Vault empty (no `.md`) | File Tree + Editor | File Tree shows folders (if any) but no Notes. Editor shows empty canvas with placeholder "No file open — select a Note or press + to create." |
| Note loading | Editor | No skeleton in v1 [ASSUMPTION: files <100KB open <200ms per PRD NFR]. If load >200ms, show subtle `muted` pulse on content area, not full skeleton. |
| Dirty + external change | Banner | Banner as above. Editor buffer never overwritten. |
| Clean + external change | Editor | Silent reload; cursor/scroll preserved where possible; Status Bar counts update. |
| Save failure (disk full, perms) | Editor/Banner | Inline banner `destructive` tone: "Couldn't save — check permissions or disk space. Your edits are still here." No toast. |
| No search matches | Palette | "No matches. Try another name." No suggested creation from palette in v1 [ASSUMPTION]. |
| Offline | Global | No treatment — app is fully offline by design. No offline banner needed. Local writes continue. |

## Interaction Primitives

**Keyboard-first, like LocalEditor's `⌘K`/`⌘⌥S` discipline, but scoped to v1.** Mouse is fallback, not primary.

- `⌘P` / `Ctrl+P` — Focus Search / open Command Palette (filename search). `Esc` closes palette and returns focus to Editor. This is the `⌘K` equivalent for snipnote v1.
- `↑/↓` / `Enter` / `Esc` — Palette navigation
- Click — File Tree row opens Note; Tab Bar `+` creates Note; Library opens sort/menu
- `⌘S` — Save (implicit auto-save also on 500ms debounce [ASSUMPTION]); no "unsaved" dot in v1 — save is atomic temp+rename
- `⌘W` — Close window (persists vault/tabs; not close file)
- `Back/Forward` in Tab Bar — Session history navigation [ASSUMPTION: history only, not file history]

**Mouse:** click to act; no drag-to-reorder in v1, no drag-to-move file in File Tree in v1. Hover reveals file row highlight (`{colors.accent}` overlay). Editor scrolling is native.

**Banned everywhere:** drag-to-reorder, multi-window in v1, full-text search in v1, slash `/` palette in v1 (LocalEditor has it, snipnote defers), floating Scratchpad in v1 (`⌘⌥S` is LocalEditor, snipnote defers to v5 Floating), collaborative cursors.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md` (light-first monochrome, `foreground` `#0F0F0F` on `background` `#FFFFFF` meets AA; `primary` black on white fixed; `muted-foreground` `#6B7280` on `muted` `#F6F6F7` verified). 

- WCAG 2.2 AA across desktop window. All chrome text meets AA against its token.
- `Tab` order: Sidebar Search → File Tree (roving `tabindex` per row) → Library → Tab Bar (`+`) → Editor → Status Bar (skip). `Esc` always returns focus to Editor or closes palette/banner.
- Screen reader announces surface on vault open: "Vault {folder name}, {N} notes." File Tree rows announce "Note {name}" / "Folder {name}, collapsed/expanded, {N} items."
- Command palette fully keyboard-operable; results announce via `aria-live` as filter changes.
- Focus rings use `{colors.ring}` (`#0F0F0F`) at 2px offset, visible at AA against `background` and `sidebar`.
- Editor content is a single `contenteditable` with heading hierarchy preserved for AT (h1/h2), links announced as links, code blocks as code.
- No keyboard traps. Window controls are native Tauri and OS-accessible.

## Inspiration & Anti-patterns

- **Lifted from LocalEditor.app:** the entire posture — "A lightweight, local editor for the files your agents write" / "Not every file needs an IDE." Plain-folder Vault (no library/project import), light minimal palette (white editor, faint sidebar), centered `760px` reading width, file-type-specific readable views (v1 starts with Markdown only), no sync by principle ("No, and it never will"), `⌘K`-style palette (`Jump to anything…` → snipnote's `⌘P`), and the "Projects/notes/Architecture.lcv" file-tree density. LocalEditor's `Pokedex.md` property panel (status/tags/updated as editable fields) informs future YAML/frontmatter treatment but v1 preserves frontmatter as text rather than a property table [ASSUMPTION].
- **Lifted from Obsidian:** plain `.md` on disk, file-system truth, vault as folder, active file highlight.
- **Rejected — Mote:** floating `⌘.` panel over every app. snipnote is full-size by PRD §1 choice; floating is deferred to v5. Do not float in v1.
- **Rejected — Cursor 3.0 heavy IDE:** LSP, debugger, git UI, multi-panel IDE chrome, AI chat sidebar. snipnote is one editor beside the terminal, not a replacement.
- **Rejected — Notion complexity:** slash-command explosion, database views, collaborative cursors, colored sidebars. LocalEditor anti-reference is "Fed up of notion's growing interface complexity" — same anti-reference for snipnote.

## Key Flows

### Flow 1 — Alex reviews Claude's Tech Stack Decisions side-by-side (Realizes UJ-1, PRD FR-1..FR-10)

1. Alex quits snipnote last night with Vault `~/snipnote-vault` and `Website Redesign/Tech Stack Decisions.md` open.
2. Morning: Alex launches snipnote (cold launch <1.5s [ASSUMPTION NFR]). App restores Vault path, File Tree shows `Daily Notes`, `Projects`, `Website Redesign/` with `Tech Stack Decisions` highlighted via `{colors.accent}`. Tab Bar shows active Note name. Editor shows file centered at `760px`, headings/bold/links/bullets rendered live, Status Bar reads `174 words · 1,209 chars · 10 paragraphs`.
3. Alex hits `⌘P`, palette floats (elevated `{components.command-palette}`). Types `access`. Result list filters to `Accessibility Audit.md`. Hits `Enter` — palette closes, File Tree highlight moves, Editor swaps file without window flash, Status Bar updates.
4. In Ghostty beside snipnote, `claude` overwrites `Tech Stack Decisions.md` on disk. File watcher detects within 2s. Since Alex is now on `Accessibility Audit.md` (clean), no banner; File Tree timestamp not shown, but next time Alex hits `⌘P` and jumps back to `Tech Stack Decisions`, Editor shows fresh content at same scroll, cursor at top.
5. Alex clicks `+` in Tab Bar. `Untitled.md` appears in current folder (or Vault root) immediately on disk and in File Tree, highlighted, focused in Editor. Types `# Quick take`.
6. **Climax:** Without switching to Obsidian, without preview toggle, Alex has reviewed Claude's multi-file output and captured a note — all in one quiet window beside the terminal, files still plain `.md` on disk that `git diff` shows faithfully. The handoff (Claude wrote, human read) succeeded with no corruption.

Failure: External change while Alex was mid-edit on active Note with unsaved buffer → inline banner under Tab Bar: "File changed on disk — Reload / Keep mine." `Reload` loads disk and discards buffer; `Keep mine` keeps buffer and suppresses banner. No toast, no auto-merge.

### Flow 2 — Priya capture-to-vault in 10 seconds (Realizes UJ-2)

1. Priya has snipnote open on `Daily Notes/` during a Claude planning session.
2. Hits `+` → `Untitled.md` focused in Editor, File Tree shows it highlighted. Types `# Quick take` with `**bold**` and `[link](https://example.com)` — rendered live, no mode switch.
3. Hits `⌘P`, types `tech`, jumps back to `Tech Stack Decisions.md` to copy a decision link. Palette behavior same as Flow 1.
4. **Climax:** Content is live-rendered and still plain `.md` on disk — she can `cat` it in terminal or commit. No IDE launch, no cloud.

Failure: Vault folder missing (moved/deleted) on launch → Welcome surface with error "Folder not found at ~/snipnote-vault" + primary "Open Vault…" button. No data loss messaging beyond path.

## Responsive & Platform

Desktop only, single full-size window. No responsive breakpoints beyond window resize. Min `800×600` per `src-tauri/tauri.conf.json:15`, content reflows via centered `760px` max-width — gutters grow/shrink as window widens/narrows, File Tree and Sidebar remain fixed `260px`. Not a responsive web product like Drift example; this section exists to lock "desktop-only, not responsive web" as the platform posture.

