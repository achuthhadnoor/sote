---
title: snipnote - Menubar Floating Notes (v1) + Full Vault Editor (v2)
created: 2026-09-02
updated: 2026-09-08
status: final
changelog:
  - 2026-09-03: Vibrant window (Sidebar/Mica via EffectsBuilder, transparent, radius 12, 1280×720); multi-tab center pane with draft-until-content; dot-folders shown if contain md, empty folders hidden; folder/file SVG icons; light/dark/system theme + Cmd+, Settings; right panel (Terminal/Browser/Canvas) built then hidden for later
  - 2026-09-08: Correct Course — Windows first-class (native chrome + Mica); Overlay+Sidebar macOS-only; WelcomeGate; Settings as editor tab (tint, reduce transparency, autostart, auto-updater); OQ-5 resolved; updater HTTPS exception to local-only NFR
  - 2026-09-08: Correct Course floating-v1 — MVP = tray/menubar floating notes; full vault shell = v2 behind flag; reuse EditorSurface + SettingsView
sources:
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-08-floating-v1.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-08.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/EXPERIENCE.md
---

# PRD: snipnote — Floating Notes (v1) / Full Editor (v2)
*Working title — confirm. Code name from repo: snipnote.*

## 0. Document Purpose
This PRD is for Achuth (builder/PM), downstream architecture and build workflows, and early design review. **v1 ships menubar/tray floating notes.** The full-size vault editor already built in-repo is **v2**, enabled behind a feature flag. Shared core: TipTap `EditorSurface`, Settings, disk IO, updater.

## 1. Vision
snipnote v1 is the **always-available local Markdown note** — a floating panel from the **menu bar (macOS) / system tray (Windows)**, hotkey to show/hide, calm WYSIWYG editing of plain `.md` on disk. It is not a heavy IDE and not the default full vault browser.

**v2** (flagged) is the full-size vault companion beside the terminal (Sidebar, tabs, WelcomeGate, ⌘P) — already implemented; not the default install experience.

Humans edit in TipTap; files stay plain Markdown on disk. Why now: faster path to “notes always there” (Raycast Notes–like) while preserving the full editor for users who opt in.

## 2. Target User

### 2.1 Jobs To Be Done
- **Functional — Capture or continue a note without switching apps.** Hotkey or tray → floating panel → type → hide. [ASSUMPTION: single active note in v1 panel.]
- **Functional — Trust the file.** Raw Markdown on disk stays pure for git / agents.
- **Functional (v2) — Navigate a vault at keyboard speed.** Sidebar + `{mod}P` + tabs when full editor enabled.
- **Emotional — Feel in control, local-first.** No cloud account; files stay on disk.
- **Social — Ship something demoable fast.** Menubar presence beats a full IDE for first dollar.

### 2.2 Non-Users (v1)
- Teams needing real-time collaboration or cloud sync — v1 is local-only, single-user.
- Mobile users — v1 is desktop only.
- Users who never use terminal/AI agents and want a generic note system — better served by Obsidian/Bear/Typora for vault-scale IA (v1 is floating-first).
- Users who need a full multi-pane IDE — Cursor/VS Code; snipnote is notes-only.

### 2.3 Key User Journeys

- **UJ-F1. Jordan captures from the menu bar (v1 primary).** [NEW 2026-09-08]
  - **Persona + context:** Jordan, desktop user, wants a note without opening a big window.
  - **Entry state:** snipnote running in tray/menubar; last note or empty draft ready. [ASSUMPTION: last note path restored; else new note in last vault / default notes folder.]
  - **Path:** (1) Clicks tray or presses `{mod}+Shift+Space`. (2) Floating panel focuses; TipTap editor ready. (3) Types; autosave writes `.md` on disk. (4) Hides panel (hotkey / close); app stays in tray. [ASSUMPTION: close hides to tray, Quit exits.]
  - **Climax:** Note was always one gesture away; file remains plain Markdown.
  - **Edge case:** No vault yet → panel prompts Choose Folder (lightweight), then continues.

- **UJ-1. Alex reviews Claude's Tech Stack Decisions side-by-side.** **(v2 — full editor flag on)**
  - Full vault shell: File Tree, `{mod}P`, tabs, Status Bar, conflict banner. See prior PRD detail; not default v1.

- **UJ-2. Priya capture-to-vault in 10 seconds.** **(v2 or via floating New note)**
  - Floating v1 covers quick capture; multi-tab vault jump is v2.

- **UJ-3. Jordan first-run on Windows.** **(v1 adapted)**
  - Install → tray icon appears; first hotkey/tray open → floating panel + vault pick if needed (not full WelcomeGate shell by default).

## 3. Glossary
- **Floating Panel** — Compact always-available editor window (`float`) shown from tray/hotkey; hosts `EditorSurface`. Default v1 UI.
- **Tray / Menu Bar** — System tray (Windows) or menu bar extra (macOS) with Show / New note / Settings / Quit (and Open full editor when flag allowed).
- **Full Editor / v2 Shell** — Existing full-size window (`main`): WelcomeGate, Sidebar, TabBar, multi-tab vault IA. Off by default; enabled via feature flag `snipnote-full-editor`.
- **Vault** — The root local folder for notes. 1 vault at a time. [ASSUMPTION]
- **Note** — A single `.md` file on disk, rendered in Editor. Raw Markdown is source of truth.
- **File Tree / Sidebar / Tab Bar / WelcomeGate / Status Bar / Right Panel** — Full-shell (v2) concepts; see prior definitions. Not default v1 chrome.
- **Editor** — TipTap surface (`EditorSurface`) used in floating panel and full shell.
- **Settings** — `SettingsView` (theme, tint, updater, autostart, etc.), opened from tray/panel in v1; as tab in v2 shell.
- **Theme** — `light` / `dark` / `system` + tint + Reduce Transparency.
- **Markdown Source** — The raw `.md` file on disk. Must round-trip without injected HTML.

## 4. Features

### 4.1 Vault & File Management
**Description:** Local-first vault as file system mirror. On first launch, user picks a folder; app remembers it. Sidebar shows File Tree with expand/collapse, Active File Highlight, and folders like Daily Notes/Projects/Website Redesign. All Notes are plain `.md` files. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Open local Vault
User can pick a local folder as Vault via system dialog, WelcomeGate Choose Folder, or drag-drop a folder onto WelcomeGate/window. App persists the choice and restores it on relaunch. Realizes UJ-1, UJ-3. [ASSUMPTION: Tauri dialog plugin; single vault.]
**Consequences:**
- After picking a vault path (including Windows drive-letter paths), relaunch restores same path without re-prompt.
- Invalid/missing folder shows error on WelcomeGate and re-prompts; app does not create vault silently.

#### FR-2: Render File Tree (filtered, sorted, iconized)
System displays File Tree in Sidebar matching filtered file system: folders shown only if their subtree contains `.md`/`.markdown` (empty folders hidden), dot-folders (e.g. `.templates`, `.obsidian`) shown when they contain md (e.g. `.templates/template.md` visible, `.emptyDot` hidden), hidden files (`.DS_Store`, `.hidden.md`) always excluded, sorted directories-first then alpha case-insensitive, with SVG folder (closed/open, chevron rotate) + file (md lines) icons. Realizes UJ-1. [UPDATED 2026-09-03: was strict 1:1; now filtered + icons]
**Consequences:**
- File Tree shows `Daily Notes/`, `Projects/`, `Website Redesign/` and `Tech Stack Decisions.md` etc.; empty `Beta` or `.emptyDot` do not appear; `.templates` appears only with `.templates/template.md`.
- Dot-folders like `.templates` appear with folder icon when they contain markdown.
- Renaming/moving a file on disk (including by Claude) is reflected in File Tree within 2s via file watcher (markdown in dot-folders still emits `vault-changed`).

#### FR-3: Active File Highlight and Library footer (with icons + Settings entry)
System highlights the currently open Note in File Tree (accent tint translucent + 8px radius, folder/file icons tint `fg` on hover/active) and exposes Library entry in Sidebar footer with folder SVG + `Switch/Open…` + gear Settings (`⌘,`/`Ctrl+,` opens Settings **tab**). Realizes UJ-1. [UPDATED 2026-09-08: Settings is a tab, not a modal]
**Consequences:**
- Only one Note is highlighted at a time; highlight follows Tab switch and File Tree click; icons use `currentColor` `muted-fg` → `fg` on hover/active.
- Gear in footer opens Settings tab (same as `{mod},`).

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
**Description:** Native desktop windowing with platform-split chrome and material. macOS uses Overlay title bar + `Effect::Sidebar`; Windows 11 uses native decorations + `Effect::Mica`; Linux uses native decorations + opaque fallback. EffectsBuilder only — no `window-vibrancy` crate. Single full-size window in v1. [UPDATED 2026-09-08: chrome/effects split by OS per Correct Course]

**Functional Requirements:**

#### FR-11: Native window controls, vibrant material, and persistence
System presents platform-appropriate chrome and material: **macOS** — Overlay title bar, empty window title, traffic lights over custom TabBar, `Effect::Sidebar` + `radius(12)`; **Windows** — native decorations + title `snipnote`, `Effect::Mica` (soft-fail on older Windows); **Linux** — native decorations, opaque CSS fills. Window `1280×720` default `1100×600` min; `transparent:true` so translucent surfaces reveal material; persists size/position + vault + `openTabs` across relaunch. Realizes UJ-1, UJ-2, UJ-3. [ASSUMPTION: `macos-private-api` feature for macOS Overlay/vibrancy only.]
**Consequences:**
- `src-tauri/src/lib.rs` window builder is `#[cfg]`-gated; effects applied separately per OS.
- `src/App.css` translucent vars + `html/body` transparent; Reduce Transparency / unsupported → opaque.
- Close/minimize/maximize follow OS chrome; relaunch restores prior size/position and vault + tabs.

### 4.7 Appearance Theme (Light/Dark/System + Tint)
**Description:** App supports `light` / `dark` / `system`, plus user-controlled tint hue/intensity and Reduce Transparency. Vibrant material tints both themes when transparency is enabled. [UPDATED 2026-09-08]

**Functional Requirements:**

#### FR-12: Theme switching and tint
User can pick Light/Dark/System, Hue, Intensity, and Reduce Transparency in Settings; `System` follows OS; `data-theme` on `html` drives CSS; tint via `--theme-tint-hue` / `--theme-tint-amount`; persisted in `localStorage`. [UPDATED]
**Consequences:**
- `src/stores/useThemeStore.ts` owns theme + tint + bgOpacity.
- Dark switch keeps AA contrast over vibrant; Reduce Transparency forces opaque shell fills.

### 4.8 Settings
**Description:** Settings as an in-canvas editor **tab** (max ~640px content), not a modal overlay. [UPDATED 2026-09-08]

**Functional Requirements:**

#### FR-13: Open Settings via Cmd+,
User can open Settings tab via `⌘,`/`Ctrl+,` (global keydown), Sidebar gear, or TabBar settings control; close via `{mod},` toggle or close tab. Realizes theme/tint and system controls. [UPDATED]
**Consequences:**
- `src/components/settings/SettingsView.tsx` rendered when settings virtual tab is active; no `SettingsDialog` modal.

### 4.9 Distribution (Auto-update & Launch at Login)
**Description:** Signed auto-updates via Tauri updater + GitHub Releases `latest.json`, plus Launch at Login. [NEW 2026-09-08 — was deferred]

**Functional Requirements:**

#### FR-14: Auto-update and Launch at Login
System checks GitHub Releases updater endpoint when Automatic Updates is enabled (default on; at most every 12h, ~4s after window reveal). When a newer signed build exists, prompts to download, install, and relaunch. Settings also offers immediate Check and Launch at Login toggle. Realizes long-term dogfood without manual reinstall. [ASSUMPTION: requires published (non-draft) release + matching `TAURI_SIGNING_PRIVATE_KEY` artifacts.]
**Consequences:**
- Endpoint: `https://github.com/achuth/snipnote/releases/latest/download/latest.json`.
- Failures in dev / before first public release are silent on startup; Settings Check surfaces status.
- Outbound HTTPS only for updater check/download — no telemetry.

### 4.10 Floating Notes & Tray (v1 primary) [NEW 2026-09-08]

**Description:** Default product is a tray/menubar app with a floating editor panel. Full vault window is v2.

#### FR-F1: Tray / menu bar presence
App installs a menu bar (macOS) / tray (Windows) icon with at least Show/Hide panel, New note, Settings, Quit. Realizes UJ-F1.

#### FR-F2: Floating panel window
User can show/hide a compact floating panel that hosts shared `EditorSurface`. [ASSUMPTION: ~420×520 default; always-on-top off by default; close hides to tray.]

#### FR-F3: Global hotkey
User can toggle the floating panel with a global shortcut. [ASSUMPTION: `CmdOrCtrl+Shift+Space`.]

#### FR-F4: Edit & autosave in panel
Panel uses the same TipTap engine, envelope, debounce autosave, and disk authority as the full editor (FR-6, FR-7). [ASSUMPTION: single active note path in v1.]

#### FR-F5: Settings from tray/panel
User can open `SettingsView` from tray or panel chrome (theme, tint, updater, autostart).

#### FR-F6: Full editor (v2) feature flag
User (or build flag) can enable the existing full vault shell (`main` window). Default **off** in v1 release. Does not delete shell code.

## 5. Non-Goals (Explicit)
- Not shipping the **full vault shell as default** in v1 (Sidebar/tabs/WelcomeGate primary) — that is **v2**.
- Not a Canvas/whiteboard full product — stubs may remain hidden.
- Not an embedded terminal/PTY running Claude.
- Not cloud sync, collaboration, or accounts.
- Not mobile / web.
- Not a full IDE (no LSP, debugger, git UI).
- Not matching Raycast Notes feature-for-feature (AI, sync) — local Markdown only.

## 6. MVP Scope

### 6.1 In Scope (v1)
- Tray / menu bar + Show / New / Settings / Quit (FR-F1)
- Floating panel + global hotkey (FR-F2, FR-F3)
- Shared EditorSurface + autosave + Markdown fidelity (FR-6, FR-7, FR-F4)
- File watcher when a note file is open (FR-8) [ASSUMPTION: applies to active float note]
- Theme + tint + Settings from panel/tray (FR-12, FR-F5)
- Auto-update + Launch at Login (FR-14)
- Feature flag entry to full editor (FR-F6) — UI can be minimal
- macOS + Windows release targets

### 6.2 Out of Scope for v1 / deferred to v2+
- Full vault shell as default: WelcomeGate-first, Sidebar, multi-tab, `{mod}P` vault jump, Status Bar-as-primary (FR-1–5, FR-9–11 shell) — **v2 when flag on** (code already exists)
- Canvas / Terminal / Browser Right Panel
- Floating always-on-top as mandatory default
- Multi-note tabs inside the floating panel [ASSUMPTION: single note]
- Mobile / web / Linux QA

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
5. Platform QA for v1: **RESOLVED 2026-09-08** — Ship **macOS + Windows** (CI + release artifacts); Linux remains opaque fallback / non-QA. Vibrant: Mac `Sidebar` + Win11 `Mica` via EffectsBuilder (platform-split).
6. Vault switcher: Does Library footer need vault switcher in v1 or single vault is enough for first dollar? Footer now has `Switch/Open…` + gear Settings; single vault still.
7. Pricing ladder: Confirm $5 -> $9 -> $19 ladder tied to Canvas/Terminal, and lifetime vs subscription semantics.
8. Theme: Light/Dark/System + tint shipped; confirm dark palette remains AA over vibrant with tint intensity high.
9. Right Panel: Confirm keeping Terminal/Browser/Canvas hidden behind `App.tsx` flag until v3/v4 vs. exposing behind feature flag in v1.
10. Updater: Confirm draft→publish release discipline is enough for first public update path (no channel/staging endpoint). [NEW 2026-09-08]

## 9. Assumptions Index
- CommonMark+GFM, Tauri dialog single vault, session history + multi-tab `tabs: Tab[] {path,title,isNew}` + `history[]`, filename-only search, Ctrl+P/Ctrl+,/Ctrl+W/Ctrl+Tab on Win/Linux (`modShortcut` labels), **draft Untitled.md until content** (`hasContent` guard), paragraph = blank-line block, vibrant `1280×720` `min 1100×600` `transparent` + **platform-split** Sidebar/Mica (no combined effect list), 50-fixture round-trip suite, auto-reload when clean, banner when dirty, frontmatter preserved verbatim, single vault (Library footer gear → Settings **tab**), local-first with **updater HTTPS exception**, macOS+Windows shipping / Linux opaque non-QA, Obsidian plain-file readiness, Mermaid/tasks rendered in v1, theme `light/dark/system` + tint + Reduce Transparency, WelcomeGate first-run, auto-updater default-on ≤12h, dot-folders shown only if subtree has md, empty folders hidden, SVG icons.

---
## Adapt-In Menu

### Platform
- **Target:** Desktop Tauri v2. **v1 default:** tray/menubar + floating panel (`float` window) on macOS + Windows. **v2:** full vault `main` window behind flag (existing Overlay/Sidebar vs native/Mica chrome). Auto-update via updater plugin. No mobile/web.

### Information Architecture
- **v1 surfaces:** Tray menu → Floating panel (`EditorSurface`) → Settings. Optional “Open full editor”.
- **v2 surfaces:** Existing WelcomeGate + Sidebar + TabBar + Editor + StatusBar (hidden unless flag on).

### Aesthetic and Tone
- Calm, local, fast. Floating panel is brand-present but compact — not a dashboard. Platform-aware shortcuts.

### Monetization
- **Model:** Paid one-time, price ladder: v1 $5, then increase as features land (e.g. +Canvas $9, +Terminal $19) — lifetime updates included for early tier [ASSUMPTION]. No subscription in v1. Payment via Lemon Squeezy/Gumroad/Stripe. Free trial? [ASSUMPTION: 7-day trial or free with 7-note limit — confirm before launch.] No accounts in app; license key file.

### Cross-Cutting NFRs
- **Performance:** Float show < 200ms warm; cold launch to tray ready quickly [ASSUMPTION].
- **Reliability:** Never silently overwrite MarkdownSource. Atomic write via temp+rename.
- **Privacy/Security:** No telemetry; updater HTTPS only; CSP hardened.
- **Accessibility:** Floating panel keyboard operable; tray menu accessible.
- **Observability:** Updater/startup failures logged quietly.

