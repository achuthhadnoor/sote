---
title: snipnote - Full-Size Markdown Editor for Claude Code
created: 2026-09-02
updated: 2026-09-03
status: draft
changelog:
  - 2026-09-03: Vibrant window (Sidebar/Mica via EffectsBuilder, transparent, radius 12, 1280×720); multi-tab center pane with draft-until-content; dot-folders shown if contain md, empty folders hidden; folder/file SVG icons; light/dark/system theme + Cmd+, Settings; right panel (Terminal/Browser/Canvas) built then hidden for later
---

# PRD: snipnote - Full-Size Markdown Editor for Claude Code
*Working title — confirm. Code name from repo: snipnote / tauri-app.*

## 0. Document Purpose
This PRD is for Achuth (builder/PM), downstream architecture and build workflows, and early design review. It turns the hardened forge idea at `_bmad-output/forge/tauri-markdown-editor/forged-idea.md` into a shippable v1 scope for build-in-public to first dollar. It is structured Glossary-anchored (terms defined once in §3 and reused verbatim), features grouped with globally numbered FRs, assumptions tagged inline as `[ASSUMPTION: ...]` and indexed in §9, and journeys (UJ) referenced by ID in FRs. This PRD builds on the forge report at `_bmad-output/forge/tauri-markdown-editor/forge-report.html` — it does not duplicate its rejected-options rationale, only locks what ships in v1.

## 1. Vision
snipnote is the full-size, fast, local markdown companion for Claude Code terminal lovers. It is not a floating panel (Mote), not a heavy IDE (Cursor 3.0), and not a generic Obsidian replacement — it is the editor you leave open beside Ghostty/iTerm while Claude writes.

Humans edit in a rich WYSIWYG surface (Tiptap) with instant Mermaid/todos/code rendering; Claude reads and writes the same raw Markdown files on disk. The app's job is to never corrupt that shared file, to render what Claude wrote faithfully, and to let the user navigate a local vault in milliseconds — sidebar, Cmd+P, tabs — without context loss.

Why now: Claude Code has moved agentic coding to the terminal. The output (plan.md, spec.md, tasks, Mermaid charts) is Markdown, but the terminal can't render it well and Obsidian is too heavy/generic for this side-by-side workflow. Mote proved solo-dev floating markdown at $19 can sell; snipnote bets that a full-size, cross-platform Tauri editor optimized for the human-agent file handoff is the side-by-side surface that earns the first $5 and grows to $19+ as Canvas/Terminal/Floating land incrementally.

## 2. Target User

### 2.1 Jobs To Be Done
- **Functional — Keep the Claude file open without leaving the terminal workflow.** As a Claude Code user who lives in Ghostty/Terminal, I want my `plan.md` / `Tech Stack Decisions` open in a fast full-size pane that stays in sync with Claude's writes, so I don't context-switch to Obsidian/VS Code. [ASSUMPTION: User uses Claude Code at least weekly and already keeps a local folder of Markdown specs.]
- **Functional — Navigate a vault at keyboard speed.** I want Cmd+P and file tree to jump between 50-200 Markdown files without lag, so I can follow Claude's multi-file output.
- **Functional — Trust the file.** I want the raw Markdown on disk to stay pure and human-readable, so Claude can overwrite it and I can git-diff it without the editor injecting HTML or mangling frontmatter.
- **Emotional — Feel in control, not replaced.** I want a local-first tool I own (no cloud account, files stay on disk) that makes Claude's work reviewable, not an AI that hides the file.
- **Social/Contextual — Build in public with a tool I use myself.** As the builder, I want to ship a shippable Markdown surface in 2-4 weeks that I dogfood daily beside Claude, so I can credibly show progress and earn the first dollar.

### 2.2 Non-Users (v1)
- Teams needing real-time collaboration or cloud sync — v1 is local-only, single-user.
- Mobile users — v1 is desktop only.
- Users who never use terminal/AI agents and want a generic note system — better served by Obsidian/Bear/Typora in v1.
- Users who only want a tiny floating capture window — better served by Mote.

### 2.3 Key User Journeys

- **UJ-1. Alex reviews Claude's Tech Stack Decisions side-by-side.**
  - **Persona + context:** Alex, solo indie builder, runs `claude` in Ghostty to scaffold a Website Redesign. Has a local vault `~/snipnote-vault` with `Daily Notes`, `Projects`, `Website Redesign/` folders.
  - **Entry state:** Vault already opened in snipnote; file `Website Redesign/Tech Stack Decisions.md` exists from Claude. App was closed, now launched.
  - **Path:** (1) snipnote restores last open file `Tech Stack Decisions` highlighted in File Tree. (2) Alex reads headings/bold/links/bullets correctly rendered. (3) Alex hits Cmd+P, types `access`, jumps to `Accessibility Audit.md`. (4) Meanwhile Claude overwrites `Tech Stack Decisions.md` on disk — snipnote detects external change and updates view without losing Alex's cursor if still on that file.
  - **Climax:** Alex sees 174 words / 1,209 chars / 10 paragraphs in Status Bar and knows the doc is fully loaded and faithful to disk.
  - **Resolution:** Alex clicks `+` to create a new note, types, and the file appears in File Tree under current folder, saved to disk as raw Markdown.
  - **Edge case:** If Alex was mid-edit on `Tech Stack Decisions` when Claude wrote, v1 shows a non-blocking banner "File changed on disk — Reload / Keep mine" rather than silently overwriting. [ASSUMPTION: Banner pattern chosen; exact merge is v2.]

- **UJ-2. Priya capture-to-vault in 10 seconds.**
  - **Persona + context:** Priya, Claude Code power user, just finished a planning session where Claude generated `Tech Stack Decisions.md`.
  - **Entry state:** snipnote open on `Daily Notes/`.
  - **Path:** (1) Priya hits `+`, new Untitled note opens. (2) Types `# Quick take` with bold/links. (3) Uses Cmd+P to jump back to `Tech Stack Decisions` to copy a link.
  - **Climax:** Formatted content renders live, no preview toggle, file is plain `.md` on disk that she can `git diff`.
  - **Resolution:** Closes app; on reopen the same tabs/vault are restored.

## 3. Glossary
- **Vault** — The root local folder the user picks on first launch. Contains folders and Notes as plain files. 1 vault open at a time in v1. [ASSUMPTION: Single vault v1.]
- **Note** — A single `.md` file on disk, rendered in Editor. File name = Note title. Raw Markdown is source of truth. New notes are draft in-memory (`isNew`) until they have content.
- **File Tree** — Hierarchical view in Sidebar showing folders (dot-folders like `.templates` shown only if they contain `.md` in subtree; empty folders hidden) and Notes (`.md`/`.markdown` only, hidden files like `.DS_Store` excluded). Sorted directories-first then alpha case-insensitive, reflects filtered file-system truth.
- **Sidebar** — Left pane containing Search, File Tree, and Library footer. Persistent in full-size window; folder/file rows now have SVG icons (closed/open folder, md file with lines, chevron rotate).
- **Search** — The input at top of Sidebar triggered by Cmd+P. In v1, searches Note filenames. [ASSUMPTION: filename-only.]
- **Library** — Footer entry in Sidebar with `📁` vault name, `Switch/Open…` and gear `⚙` Settings (`⌘,`) entry. In v1, entry point to vault switcher/sort [ASSUMPTION: Vault switch + sort].
- **Editor** — Center pane where Note content is displayed/edited with Tiptap. Parses raw Markdown on open, serializes back on save.
- **Tab Bar** — Top bar in Main with back/forward, scrollable multi-tab row (`Untitled.md` draft italic + hollow dot, dirty •, saving…), per-tab close `×`, and `+`. Tabs persist in session `openTabs`.
- **Status Bar** — Footer at bottom of Editor showing live document statistics: words, characters, paragraphs.
- **Right Panel** — Right `420px` pane for Terminal / In-App Browser / Canvas (Excalidraw stub). Built but hidden in current build (`App.tsx` commented) to be re-enabled later [ASSUMPTION: deferred, see §6.2].
- **Settings** — Modal overlay opened via `⌘,` / `Ctrl+,` (or Sidebar gear), with Appearance section (Light/Dark/System) persisted in `localStorage snipnote-theme` and `data-theme` attribute.
- **Theme** — `light` (monochrome white `#FFFFFF`/`#F8F8F9`) / `dark` (`#141416`/`#1A1A1E`) / `system` (follows `prefers-color-scheme`). Translucent `rgba` variants sit over vibrant Sidebar/Mica material.
- **Markdown Source** — The raw `.md` file on disk. Must round-trip through Tiptap without corruption or injected HTML.

## 4. Features

### 4.1 Vault & File Management
**Description:** Local-first vault as file system mirror. On first launch, user picks a folder; app remembers it. Sidebar shows File Tree with expand/collapse, Active File Highlight, and folders like Daily Notes/Projects/Website Redesign. All Notes are plain `.md` files. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Open local Vault
User can pick a local folder as Vault via system dialog. App persists the choice and restores it on relaunch. Realizes UJ-1. [ASSUMPTION: Tauri dialog plugin; single vault.]
**Consequences:**
- After picking `~/snipnote-vault`, relaunch restores same path without re-prompt.
- Invalid/missing folder shows error and re-prompts; app does not create vault silently.

#### FR-2: Render File Tree (filtered, sorted, iconized)
System displays File Tree in Sidebar matching filtered file system: folders shown only if their subtree contains `.md`/`.markdown` (empty folders hidden), dot-folders (e.g. `.templates`, `.obsidian`) shown when they contain md (e.g. `.templates/template.md` visible, `.emptyDot` hidden), hidden files (`.DS_Store`, `.hidden.md`) always excluded, sorted directories-first then alpha case-insensitive, with SVG folder (closed/open, chevron rotate) + file (md lines) icons. Realizes UJ-1. [UPDATED 2026-09-03: was strict 1:1; now filtered + icons]
**Consequences:**
- File Tree shows `Daily Notes/`, `Projects/`, `Website Redesign/` and `Tech Stack Decisions.md` etc.; empty `Beta` or `.emptyDot` do not appear; `.templates` appears only with `.templates/template.md`.
- Dot-folders like `.templates` appear with folder icon when they contain markdown.
- Renaming/moving a file on disk (including by Claude) is reflected in File Tree within 2s via file watcher (markdown in dot-folders still emits `vault-changed`).

#### FR-3: Active File Highlight and Library footer (with icons + Settings entry)
System highlights the currently open Note in File Tree (accent `rgba(243,244,246,0.76)` + 8px radius, folder/file icons tint `fg` on hover/active) and exposes Library entry in Sidebar footer with folder SVG + `Switch/Open…` + gear Settings (`⌘,` opens Settings dialog). Realizes UJ-1. [UPDATED 2026-09-03: icons + Settings gear]
**Consequences:**
- Only one Note is highlighted at a time; highlight follows Tab switch and File Tree click; icons use `currentColor` `muted-fg` → `fg` on hover/active.
- Gear in footer opens Settings (same as `⌘,`/`Ctrl+,`).

**Notes:** Obsidian-compatible folder structure is required for readiness (plain `.md`, frontmatter preserved as text even if not rendered in v1). [ASSUMPTION]

### 4.2 Quick Navigation & Search
**Description:** Keyboard-speed navigation. Sidebar Search with Cmd+P, and File Tree click. Realizes UJ-1 (step 3), UJ-2.

**Functional Requirements:**

#### FR-4: Search via Cmd+P (filename-only)
User can press Cmd+P (Ctrl+P on Win/Linux [ASSUMPTION]) to focus Search, type a substring, see filtered list of Note filenames, and jump. Realizes UJ-1.
**Consequences:**
- Typing `tech` shows `Tech Stack Decisions.md`; `access` shows `Accessibility Audit.md`.
- Search is filename-only in v1; no full-text. [ASSUMPTION]

#### FR-5: Navigate via File Tree and Multi-Tab selection
User can click a Note in File Tree or its Tab to make it active (opens as tab if not already open), with highlight and Tab Bar update. Tabs are scrollable, show `×` close, draft `italic + hollow dot` / `draft` label, dirty `•` / `saving…`, and persist in `session.json openTabs`. Realizes UJ-1, UJ-2. [UPDATED 2026-09-03: single-tab → multi-tab]
**Consequences:**
- Clicking a Note opens/adds tab; active tab is `is-active` (`bg`/`border` + shadow) + `FileTabIcon`.
- `×` or `⌘W` closes tab; `Ctrl/⌘+Tab` cycles tabs (Shift reverses). Closing the last tab shows `No open notes` + `No Note Selected` empty state.
- Back/forward arrows navigate tab history within the same window session. [ASSUMPTION: session history only + tabs].

### 4.3 Editor Core (Tiptap, Markdown Source)
**Description:** Full-size Editor with live WYSIWYG rendering but raw Markdown on disk. Parses MarkdownSource to Tiptap model on open, serializes back on save. Supports v1 Markdown features visible in screenshot: headings, bold, links, bullet points. [ASSUMPTION: v1 also ships Mermaid fenced blocks, task lists, and inline code as read-rendered — toggled via Tiptap extensions.] Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-6: Live Markdown rendering
Editor renders headings, bold, links, bullets live as user types, with no split preview pane. Realizes UJ-1, UJ-2.
**Consequences:**
- `# Heading` renders as heading; `**bold**` renders bold; `[text](url)` renders clickable link; `- item` renders bullet.

#### FR-7: Raw Markdown round-trip fidelity
System preserves Markdown Source on save exactly as standard CommonMark/GFM, with no injected HTML/class attributes. Frontmatter (if present) is preserved verbatim. Realizes UJ-1. [ASSUMPTION: CommonMark + GFM.]
**Consequences:**
- Opening a file written by Claude and saving without edits produces byte-identical output (except normalized line endings).
- Bold written as `**x**` is not rewritten as `__x__`.

#### FR-8: File-watcher with external-change handling
System watches Markdown Source on disk; when Claude overwrites a Note, Editor handles it without silent data loss. Realizes UJ-1.
**Consequences:**
- If Note is not dirty, Editor auto-reloads and preserves scroll/cursor where possible.
- If Note is dirty (user has unsaved keystrokes), Editor shows banner "File changed on disk — Reload / Keep mine" and never auto-overwrites user's buffer. [ASSUMPTION: Banner chosen; merge is v2.]
**Out of Scope:** Three-way merge, conflict files.

**Feature-specific NFRs:**
- Round-trip serialization covered by automated tests: at least 50 fixtures (headings, lists, links, code, frontmatter, Mermaid) must pass byte-equality. [ASSUMPTION: test threshold.]

### 4.4 Tabs & Multi-Tab Navigation (Draft-until-content)
**Description:** Tab Bar in Editor shows navigation arrows, scrollable multi-tab row (each `Untitled.md` draft italic + hollow dot, dirty •, saving…), per-tab `×` close, and `+`. Tabs represent open Notes; draft tabs (`isNew`) are in-memory virtual (`Untitled.md` path not yet on disk) until they have content (body/frontmatter trimmed >0) then auto-saved via 500ms debounce → `write_file` → `markTabSaved` + vault reload. [UPDATED 2026-09-03: was immediate disk create; now draft-until-content per user request; resolves Open Question 3.]

**Functional Requirements:**

#### FR-9: Tab lifecycle (multi-tab, draft, persist)
User can open notes as tabs (`+` or File Tree/`⌘P`), switch by clicking tab, close via `×`/`⌘W`, cycle via `Ctrl/⌘+Tab`, and have open tabs + active restored on relaunch via `session.json { openTabs: string[], activeFilePath }`. Realizes UJ-1, UJ-2.
**Consequences:**
- `+`/`⌘N` creates `Untitled.md` / `Untitled 1.md` as draft `isNew` tab (choose first non-colliding name vs. existing files + open tabs, `baseVault/Name`), shows italic + `draft`/`hollow dot`, does NOT create file on disk if no content. Typing → `isDirty` → 500ms `saveNow` → `hasContent` guard → `write_file` → `markTabSaved(false)` + `loadVault` to show file in tree. Empty draft closed or window blurred with no content does nothing on disk.
- Closing active tab picks neighbor (same index else previous) or `Welcome`; `⌘W` closes active; empty hint when no tabs.
- Persist: `openTabs` excludes `isNew` drafts; `sanitize_session` filters to existing files; `active` must be inside `openTabs` else first.

### 4.5 Status Bar & Document Insights
**Description:** Status Bar at bottom right of Editor shows live counts. Realizes UJ-1 climax.

**Functional Requirements:**

#### FR-10: Live document statistics
System shows live word count, character count, and paragraph count in Status Bar, updating on every keystroke and on file load. Realizes UJ-1.
**Consequences:**
- For `Tech Stack Decisions` example, displays `174 words | 1,209 characters | 10 paragraphs` (paragraph = block separated by blank line [ASSUMPTION]).

### 4.6 Window & System Integration (Vibrant)
**Description:** Native desktop windowing with vibrant material. macOS `Sidebar` vibrancy + Windows `Mica` via `EffectsBuilder` only, single full-size window in v1. [UPDATED 2026-09-03: added vibrant via `tauri` `macos-private-api` + `transparent:true` + `macOSPrivateApi:true` + `EffectsBuilder([Sidebar,Mica],Active,radius12)`, `html/body` transparent, translucent fills.]

**Functional Requirements:**

#### FR-11: Native window controls, vibrant material, and persistence
System shows standard macOS traffic lights (close/minimize/maximize) over vibrant window, `1280×720` default `1100×600` min (was `800×600` to make room for future right panel), `Overlay` titleBarStyle, `border-radius 12` + translucent `rgba` surfaces (`bg 0.78`, `sidebar 0.68`, etc.) over `NSVisualEffectView`/`Mica`; Linux falls back to opaque hexes; persists window size/position + vault + `openTabs` across relaunch. Realizes UJ-1, UJ-2. [ASSUMPTION: `transparent:true` + `macos-private-api` feature; no `window-vibrancy` crate.]
**Consequences:**
- `src-tauri/tauri.conf.json:12` + `src-tauri/Cargo.toml:21` + `src-tauri/src/lib.rs:14` `.setup` `window.set_effects(Some(EffectsBuilder…))`.
- `src/App.css:1` translucent vars + `html/body` transparent; fallback opaque on unsupported.
- Close hides/minimizes per OS; relaunch restores prior size/position and vault + tabs.

### 4.7 Appearance Theme (Light/Dark/System)
**Description:** App supports `light` (monochrome `#FFFFFF`/`#0F0F0F`), `dark` (`#141416`/`#EDEEF0` + translucent dark `rgba(20,20,22,0.72)` etc.), and `system` (follows `prefers-color-scheme`, listens to OS changes). Vibrant material tints both. [NEW 2026-09-03]

**Functional Requirements:**

#### FR-12: Theme switching
User can pick Light/Dark/System in Settings (`⌘,`); `System` follows OS; `data-theme` attribute on `html` drives `src/App.css:43` `[data-theme="dark"]` overrides; persisted in `localStorage snipnote-theme` + `document.style.colorScheme`; `System` updates live on OS change. [NEW]
**Consequences:**
- `src/stores/useThemeStore.ts:1` `theme: Theme` + `effectiveTheme`, `setTheme` writes `localStorage` + `data-theme`.
- Dark switch keeps AA contrast over vibrant.

### 4.8 Settings
**Description:** Single Settings modal overlay (blur `8px`, `12px` radius, `560px` max) with Appearance section and About. [NEW]

**Functional Requirements:**

#### FR-13: Open Settings via Cmd+,
User can open Settings via `⌘,`/`Ctrl+,` (global `keydown` in `src/App.tsx:119` handling `key ","`/`code Comma`), Sidebar gear, and close via `Esc`, `×`, or `Done`. Realizes theme switching. [NEW]
**Consequences:**
- `src/components/settings/SettingsDialog.tsx:1` overlay + `settings-dialog` + `settings-option` radios; `Sidebar.tsx:5` gear button; `App.tsx` `isSettingsOpen` state.

## 5. Non-Goals (Explicit)
- Not a floating capture panel in v1 (Mote owns this; deferred to v5).
- Not a Canvas/whiteboard — Excalidraw stub built for Right Panel but hidden in current build (`App.tsx` commented) and deferred to v3 for full integration (keep JSON design ready) [UPDATED 2026-09-03: canvas scaffold exists].
- Not an embedded terminal/PTY running Claude — Terminal pane built for Right Panel but hidden; v4 will wire `tauri-plugin-shell` PTY (v1 Claude stays in Ghostty) [UPDATED: stub exists].
- Not an In-App Browser full replacement — Browser pane (`iframe` + URL bar) built but hidden behind Right Panel.
- Not cloud sync, collaboration, or accounts — v1 is local-only. Ready for future sync (file abstraction) but no sync logic in v1.
- Not mobile, not web — desktop Tauri only.
- Not a full IDE — no LSP, debugger, or git UI in v1.
- Not a generic "second Obsidian" — must win on Claude side-by-side sync, not on plugin ecosystem breadth.

## 6. MVP Scope

### 6.1 In Scope
- Local Vault pick/restore (FR-1), File Tree filtered + icons (`isNew` draft, dot-folders, hide empty) (FR-2), Active highlight + Library footer + gear Settings (FR-3)
- Cmd+P filename search (FR-4), File Tree / multi-tab navigation + close/cycle (FR-5)
- Tiptap live rendering headings/bold/links/bullets (+ Mermaid/tasks/code as rendered) (FR-6), raw Markdown round-trip (FR-7), file-watcher with banner (FR-8)
- Tab Bar multi-tab with `+` draft-until-content (FR-9)
- Status Bar word/char/paragraph (FR-10)
- Native vibrant window (`Sidebar`/`Mica`, `1280×720`) + persistence of `openTabs` (FR-11)
- Appearance theme Light/Dark/System via `data-theme` + Settings modal `⌘,` (new FR-12)
- Settings dialog `⌘,`/gear (new FR-13)
- Plain `.md` files, frontmatter preserved, vault folder = file system; Right Panel scaffolds (Terminal/Browser/Canvas) hidden behind flag for later

### 6.2 Out of Scope for MVP
- Canvas/Excalidraw **full** integration (replace stub `<canvas>` with `@excalidraw/excalidraw` + JSON persistence) — deferred to v3. Reason: major scope; stub in `src/components/rightPanel/CanvasPane.tsx` keeps design ready while `App.tsx` hides RightPanel. [NOTE FOR PM: Keep separate JSON files design ready.]
- Embedded Terminal PTY **wiring** (`xterm.js` + `tauri-plugin-shell`) — stub `TerminalPane.tsx` (mock `help/ls/pwd/echo`, dark `#0F0F0F`) exists but hidden; deferred to v4. Reason: PTY backend complexity. [NOTE FOR PM: Users already have Ghostty.]
- In-App Browser full hardening (CSP `frame-src`, opener fallback) — `BrowserPane.tsx` (`iframe` + URL bar) built but hidden.
- Floating window/panel — deferred to v5. Reason: competes head-on with Mote, needs multi-window sync.
- Cloud sync / collaboration / accounts — deferred. Reason: local-first wedge. Architecture must keep file abstraction ready.
- Full-text search, tags, graph view, plugins — deferred.
- Obsidian full compat (wikilinks, canvas, plugins) — v2 only preserves frontmatter; deeper compat is v2.
- Mobile / web / Linux packaged builds [ASSUMPTION: macOS first, Win/Linux cross-platform build toggle ready but not QA'd in v1 if you choose macOS-first.]

## 7. Success Metrics

**Primary**
- **SM-1: First dollar.** 10 paying users at $5 within 60 days of public launch. Validates FR-1..FR-11 as shippable value. Measured via payment provider (Lemon Squeezy/Gumroad/Stripe [ASSUMPTION]).
- **SM-2: Dogfood retention.** Builder (Achuth) uses snipnote as daily driver beside Claude Code for 30 consecutive days without reverting to Obsidian/Typora for the same vault. Validates FR-7, FR-8.

**Secondary**
- **SM-3: Time-to-first-note.** Median < 30s from cold launch to editing a Note (pick vault -> File Tree -> Editor). Validates FR-1..FR-6.
- **SM-4: Sync trust.** 0 silent overwrites/file-loss bugs reported in first 30 days where Claude and human edited same file (validates FR-8 banner).

**Counter-metrics (do not optimize)**
- **SM-C1: Vault size.** Do not optimize for 10k-file vaults in v1; optimize for 50-500 file vaults that Claude Code actually generates. Counterbalances SM-3.
- **SM-C2: Feature count.** Do not add Canvas/Terminal to chase activation before SM-1 is hit. Counterbalances scope creep.

## 8. Open Questions
1. File conflict copy: Is banner "Reload / Keep mine" sufficient for v1, or do we need to write a `.conflict.md` side file? [Owner: PM, revisit if user testing shows mid-edit loss.]
2. `⌘P` scope: Confirm filename-only is acceptable for v1 or must support full-text fallback before paywall?
3. `+` creation semantics: **RESOLVED 2026-09-03** — `Untitled.md` is draft `isNew` in-memory until it has content (`body/frontmatter trimmed >0`) then auto-saved (`write_file` → `markTabSaved` + `loadVault`), empty drafts never hit disk; closes/blur with no content does nothing. [Was: immediate disk create.]
4. Mermaid/tasks in v1: Must Mermaid render live in Tiptap for v1 or can it be code-block fallback with preview on save?
5. Platform QA for v1: Ship macOS-only (fast) vs Mac/Win/Linux signed builds from Day 1? Vibrant now covers Mac (`Sidebar`) + Win11 (`Mica`) via EffectsBuilder; Linux is opaque fallback.
6. Vault switcher: Does Library footer need vault switcher in v1 or single vault is enough for first dollar? Footer now has `Switch/Open…` + gear Settings; single vault still.
7. Pricing ladder: Confirm $5 -> $9 -> $19 ladder tied to Canvas/Terminal, and lifetime vs subscription semantics.
8. Theme: Light/Dark/System shipped (`data-theme` + `localStorage snipnote-theme` + `⌘,` Settings); confirm dark palette `#141416` etc. is accessible AA for vibrant.
9. Right Panel: Confirm keeping Terminal/Browser/Canvas hidden behind `App.tsx` flag until v3/v4 vs. exposing behind feature flag in v1.

## 9. Assumptions Index
- CommonMark+GFM, Tauri dialog single vault, session history + multi-tab `tabs: Tab[] {path,title,isNew}` + `history[]`, filename-only search, Ctrl+P/Ctrl+,/Ctrl+W/Ctrl+Tab on Win/Linux, **draft Untitled.md until content** (`hasContent` guard), paragraph = blank-line block, vibrant `1280×720` `min 1100×600` `transparent` + `Sidebar`/`Mica` + `radius12`, 50-fixture round-trip suite, auto-reload when clean, banner when dirty, frontmatter preserved verbatim, single vault (Library footer gear → Settings), local-first ready-for-future sync, macOS-primary with Win Mica + Linux opaque fallback, Obsidian plain-file readiness, Mermaid/tasks rendered in v1, theme `light/dark/system` via `prefers-color-scheme` + `localStorage`, dot-folders shown only if subtree has md, empty folders hidden, SVG icons.

---
## Adapt-In Menu

### Platform
- **Target:** Desktop Tauri v2, React 19, Vite, vibrant `transparent` + `Sidebar`/`Mica` via `EffectsBuilder` + `macos-private-api`, `1280×720` `min 1100×600` `Overlay` titleBarStyle. Primary: macOS 13+ with Win11 Mica + Linux opaque fallback; Win/Linux builds ready via `targets: all` but QA scope per Open Question 5. No mobile/web in v1. Auto-update via Tauri updater deferred [ASSUMPTION].

### Monetization
- **Model:** Paid one-time, price ladder: v1 $5, then increase as features land (e.g. +Canvas $9, +Terminal $19) — lifetime updates included for early tier [ASSUMPTION]. No subscription in v1. Payment via Lemon Squeezy/Gumroad/Stripe. Free trial? [ASSUMPTION: 7-day trial or free with 7-note limit — confirm before launch.] No accounts in app; license key file.

### Information Architecture
- **Surfaces:** Single vibrant window `1280×720`. Left: Sidebar (Search `⌘P`, File Tree with SVG icons + dot-folders, Library footer with gear Settings `⌘,`). Center: Main (`Tab Bar` scrollable multi-tabs + `×` + `+` over `Editor` 760px + `StatusBar` + inline `ConflictBanner` + `CommandPalette` overlay + `Settings` overlay). Right: `RightPanel` (`Terminal`/`Browser`/`Canvas`) — built (`src/components/rightPanel/*`) but hidden behind `App.tsx` comment for later. No floating panel in v1.

### Aesthetic and Tone
- **References:** Obsidian/Typora cleanliness, not Notion heaviness. Anti-reference: IDE chrome. Tone: calm, local, fast. Visual: native macOS traffic lights, neutral typography, live rendering without preview toggle.

### Cross-Cutting NFRs
- **Performance:** Cold launch to Editor < 1.5s on M1, file open < 200ms for < 100KB md, search filter < 100ms for 500 files [ASSUMPTION].
- **Reliability:** Never silently overwrite MarkdownSource. Crash must not corrupt file (atomic write via temp+rename).
- **Privacy/Security:** No network calls in v1, no telemetry without opt-in, no cloud. Files never leave disk. Tauri CSP hardened (currently `csp: null` in `tauri.conf.json:21` must be tightened before launch).
- **Accessibility:** Keyboard-navigable Sidebar/File Tree, Cmd+P, Tab traversal. [ASSUMPTION: WCAG AA deferred but keyboard path required.]
- **Observability:** Local file-watcher errors surfaced as banner, not silent.

