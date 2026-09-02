---
title: snipnote - Full-Size Markdown Editor for Claude Code
created: 2026-09-02
updated: 2026-09-02
status: draft
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
- **Note** — A single `.md` file on disk, rendered in Editor. File name = Note title. Raw Markdown is source of truth.
- **File Tree** — Hierarchical view in Sidebar showing folders (e.g., Daily Notes, Projects, Website Redesign) and Notes. Reflects file system 1:1.
- **Sidebar** — Left pane containing Search, File Tree, and Library footer. Persistent in full-size window.
- **Search** — The input at top of Sidebar triggered by Cmd+P. In v1, searches Note filenames. [ASSUMPTION: filename-only.]
- **Library** — Footer entry in Sidebar with sort/options. In v1, entry point to vault switcher/sort. [ASSUMPTION: Vault switch + sort.]
- **Editor** — Large right pane where Note content is displayed/edited with Tiptap. Parses raw Markdown on open, serializes back on save.
- **Tab Bar / Breadcrumb Bar** — Top bar in Editor with back/forward arrows, active Note name, and `+` to create a new Note.
- **Status Bar** — Footer at bottom of Editor showing live document statistics: words, characters, paragraphs.
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

#### FR-2: Render File Tree 1:1
System displays File Tree in Sidebar matching file system: folders and `.md` files only, sorted alphabetically. Realizes UJ-1.
**Consequences:**
- File Tree shows `Daily Notes/`, `Projects/`, `Website Redesign/` and `Tech Stack Decisions.md` etc. exactly as on disk.
- Renaming/moving a file on disk (including by Claude) is reflected in File Tree within 2s via file watcher.

#### FR-3: Active File Highlight and Library footer
System highlights the currently open Note in File Tree and exposes Library entry in Sidebar footer. Realizes UJ-1.
**Consequences:**
- Only one Note is highlighted at a time; highlight follows Tab switch and File Tree click.

**Notes:** Obsidian-compatible folder structure is required for readiness (plain `.md`, frontmatter preserved as text even if not rendered in v1). [ASSUMPTION]

### 4.2 Quick Navigation & Search
**Description:** Keyboard-speed navigation. Sidebar Search with Cmd+P, and File Tree click. Realizes UJ-1 (step 3), UJ-2.

**Functional Requirements:**

#### FR-4: Search via Cmd+P (filename-only)
User can press Cmd+P (Ctrl+P on Win/Linux [ASSUMPTION]) to focus Search, type a substring, see filtered list of Note filenames, and jump. Realizes UJ-1.
**Consequences:**
- Typing `tech` shows `Tech Stack Decisions.md`; `access` shows `Accessibility Audit.md`.
- Search is filename-only in v1; no full-text. [ASSUMPTION]

#### FR-5: Navigate via File Tree and Tab selection
User can click a Note in File Tree or its Tab to make it active, with highlight and Tab Bar update. Realizes UJ-1, UJ-2.
**Consequences:**
- Clicking a Note opens it in Editor and highlights it; Tab Bar shows its name.
- Back/forward arrows navigate tab history within the same window session. [ASSUMPTION: session history only.]

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

### 4.4 Tabs & Breadcrumb Navigation
**Description:** Tab Bar in Editor shows navigation arrows, Active Note name, and `+` to create new Note. Tabs represent open Notes; v1 supports single active tab visible at a time plus `+` [ASSUMPTION: multi-tab row is v1, not single-tab only — matches "+ to open a new tab/file" in breakdown.]

**Functional Requirements:**

#### FR-9: Tab lifecycle
User can see active Note name in Tab Bar, navigate history via arrows, and create a new Note via `+`. Realizes UJ-1, UJ-2.
**Consequences:**
- `+` creates `Untitled.md` / `Untitled 2.md` in current folder (or Vault root if no folder selected) and opens it in Editor, added to File Tree immediately. File is created on disk on creation (not only on save). [ASSUMPTION: immediate create.]
- Closing the window restores prior tabs/vault on next launch via persisted session.

### 4.5 Status Bar & Document Insights
**Description:** Status Bar at bottom right of Editor shows live counts. Realizes UJ-1 climax.

**Functional Requirements:**

#### FR-10: Live document statistics
System shows live word count, character count, and paragraph count in Status Bar, updating on every keystroke and on file load. Realizes UJ-1.
**Consequences:**
- For `Tech Stack Decisions` example, displays `174 words | 1,209 characters | 10 paragraphs` (paragraph = block separated by blank line [ASSUMPTION]).

### 4.6 Window & System Integration
**Description:** Native desktop windowing per breakdown. macOS window controls, single full-size window in v1.

**Functional Requirements:**

#### FR-11: Native window controls and persistence
System shows standard macOS traffic lights (close/minimize/maximize) and persists window size/position across relaunch. Realizes UJ-1, UJ-2. [ASSUMPTION: Native Tauri window; min 800x600.]
**Consequences:**
- Close hides/minimizes per OS; relaunch restores prior size/position and vault.

## 5. Non-Goals (Explicit)
- Not a floating capture panel in v1 (Mote owns this; deferred to v5).
- Not a Canvas/whiteboard — Excalidraw is v3, not v1.
- Not an embedded terminal/PTY running Claude — v4, not v1; Claude stays in user's Ghostty/iTerm beside the editor.
- Not cloud sync, collaboration, or accounts — v1 is local-only. Ready for future sync (file abstraction) but no sync logic in v1.
- Not mobile, not web — desktop Tauri only.
- Not a full IDE — no LSP, debugger, or git UI in v1.
- Not a generic "second Obsidian" — must win on Claude side-by-side sync, not on plugin ecosystem breadth.

## 6. MVP Scope

### 6.1 In Scope
- Local Vault pick/restore (FR-1), File Tree 1:1 (FR-2), Active highlight + Library footer (FR-3)
- Cmd+P filename search (FR-4), File Tree/Tab navigation (FR-5)
- Tiptap live rendering headings/bold/links/bullets (+ Mermaid/tasks/code as rendered) (FR-6), raw Markdown round-trip (FR-7), file-watcher with banner (FR-8)
- Tab Bar with `+` new note (FR-9)
- Status Bar word/char/paragraph (FR-10)
- Native window controls + persistence (FR-11)
- Plain `.md` files, frontmatter preserved, vault folder = file system

### 6.2 Out of Scope for MVP
- Canvas/Excalidraw — deferred to v3. Reason: major scope, not needed for first dollar. [NOTE FOR PM: Keep separate JSON files design ready.]
- Embedded Terminal / running Claude inside app — deferred to v4. Reason: PTY backend complexity. [NOTE FOR PM: Users already have Ghostty.]
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
3. `+` creation semantics: Should Untitled be unsaved (in-memory) until first keystroke, or created on disk immediately as assumed in FR-9?
4. Mermaid/tasks in v1: Must Mermaid render live in Tiptap for v1 or can it be code-block fallback with preview on save?
5. Platform QA for v1: Ship macOS-only (fast) vs Mac/Win/Linux signed builds from Day 1?
6. Vault switcher: Does Library footer need vault switcher in v1 or single vault is enough for first dollar?
7. Pricing ladder: Confirm $5 -> $9 -> $19 ladder tied to Canvas/Terminal, and lifetime vs subscription semantics.

## 9. Assumptions Index
- CommonMark+GFM, Tauri dialog single vault, session history only, filename-only search, Ctrl+P on Win/Linux, immediate Untitled.md create, paragraph = blank-line block, native 800x600 window, 50-fixture round-trip suite, auto-reload when clean, banner when dirty, forwardmatter preserved verbatim, single vault, local-first ready-for-future sync, macOS-first vs cross-platform toggle, Obsidian plain-file readiness, Mermaid/tasks rendered in v1.

---
## Adapt-In Menu

### Platform
- **Target:** Desktop Tauri v2, React 19, Vite. Primary: macOS 13+ [ASSUMPTION]; Win/Linux builds ready via Tauri `targets: all` but QA scope per Open Question 5. No mobile/web in v1. Auto-update via Tauri updater deferred [ASSUMPTION].

### Monetization
- **Model:** Paid one-time, price ladder: v1 $5, then increase as features land (e.g. +Canvas $9, +Terminal $19) — lifetime updates included for early tier [ASSUMPTION]. No subscription in v1. Payment via Lemon Squeezy/Gumroad/Stripe. Free trial? [ASSUMPTION: 7-day trial or free with 7-note limit — confirm before launch.] No accounts in app; license key file.

### Information Architecture
- **Surfaces:** Single full-size window. Left: Sidebar (top Search Cmd+P, middle File Tree with folders/files, bottom Library). Right: Tab Bar (arrows, active name, +) over Editor (rendered Markdown) over Status Bar (words/chars/paragraphs). No floating panel in v1.

### Aesthetic and Tone
- **References:** Obsidian/Typora cleanliness, not Notion heaviness. Anti-reference: IDE chrome. Tone: calm, local, fast. Visual: native macOS traffic lights, neutral typography, live rendering without preview toggle.

### Cross-Cutting NFRs
- **Performance:** Cold launch to Editor < 1.5s on M1, file open < 200ms for < 100KB md, search filter < 100ms for 500 files [ASSUMPTION].
- **Reliability:** Never silently overwrite MarkdownSource. Crash must not corrupt file (atomic write via temp+rename).
- **Privacy/Security:** No network calls in v1, no telemetry without opt-in, no cloud. Files never leave disk. Tauri CSP hardened (currently `csp: null` in `tauri.conf.json:21` must be tightened before launch).
- **Accessibility:** Keyboard-navigable Sidebar/File Tree, Cmd+P, Tab traversal. [ASSUMPTION: WCAG AA deferred but keyboard path required.]
- **Observability:** Local file-watcher errors surfaced as banner, not silent.

