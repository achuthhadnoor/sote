---
title: snipnote EXPERIENCE
status: final
created: 2026-09-02
updated: 2026-09-08
sources:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/forge/tauri-markdown-editor/forged-idea.md
  - https://localeditor.app
  - shipped: WelcomeGate, SettingsView tab, platform.ts, lib.rs chrome/effects, release CI
---

# snipnote — Experience Spine

> Desktop Tauri v2, full-size single window, local-first. Paired with `DESIGN.md`. Ships on **macOS and Windows**; Linux remains opaque fallback / non-QA. Theme: LocalEditor calm monochrome + optional user tint.

## Foundation

**Form-factor:** Single-surface desktop (Tauri v2 + React 19 + Vite). Default window `1280×720`, min `1100×600`, `transparent:true`.

**Platform chrome & material** (see `DESIGN.md` Brand & Style):

| Platform | Title bar | Material | Shortcut labels |
|---|---|---|---|
| macOS | Overlay + empty title; traffic lights over TabBar | `Effect::Sidebar` + radius 12 | `⌘…` via `modShortcut` |
| Windows 11 | Native decorations + title `snipnote` | `Effect::Mica` (soft-fail older Windows) | `Ctrl+…` |
| Linux | Native decorations | Opaque CSS fallback | `Ctrl+…` |

**Theme:** `light | dark | system` + tint hue/intensity + Reduce Transparency (`useThemeStore`). Settings is an **editor tab**, not a modal. Auto-update is user-initiated (“Check for Updates”); Launch at Login via autostart plugin. Deep link scheme `snipnote://` + single-instance. No accounts, no cloud, no sync — files never leave disk. Single vault open at a time [ASSUMPTION]. Right Panel built but hidden.

`DESIGN.md` owns visual identity; this spine owns behavior.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| WelcomeGate | Cold launch, no vault / vault missing | Brand-first drop zone + Choose Folder; drag-drop open |
| Main Window | Vault open | Vibrant/Mica (or opaque) shell with TabBar + editor column |
| ├─ Sidebar | Persistent left when expanded | Search → File Tree → Library footer (Switch vault + settings entry) |
| ├─ Tab Bar | Top of Main | Back/forward, tabs, `+`, settings; minimal in welcome mode; sidebar reveal when collapsed |
| ├─ Editor | Note tab | TipTap WYSIWYG + Find/Replace + spellcheck |
| ├─ HomeView | Vault open, no note focused | Vault note list / search; `{mod}P` hint |
| ├─ Settings (tab) | `{mod},` / gear / TabBar | Appearance, Writing, System, Logs — close via `{mod},` again or close tab |
| ├─ Status Bar | Bottom when vault open | Live `words · chars · paragraphs` |
| ├─ Command Palette | `{mod}P` / Search click | Filename jump; opens note as tab |
| ├─ File Changed Banner | Inline under Tab Bar | Reload / Keep mine on dirty external change |
| └─ Right Panel | (hidden) | Terminal / Browser / Canvas stubs for later |

Vault tree is filtered FS truth: dot-folders only if they contain `.md`, empty folders hidden, hidden files excluded (`storage.rs` scan).

## Voice and Tone

Microcopy. Brand voice lives in `DESIGN.md` Brand & Style.

| Do | Don't |
|---|---|
| “Your notes live in a folder on disk.” | “Welcome to snipnote! Let’s get started 🚀” |
| “Drop a folder here” / “Choose Folder” | “Select a vault directory to initialize” |
| “File changed on disk — Reload / Keep mine” | “Conflict detected! Choose an action…” |
| “Up to date” / “Checking…” | Celebratory update confetti copy |
| Platform-correct shortcut chips (`⌘O` / `Ctrl+O`) | Hard-coded Mac glyphs on Windows |

Tone stays plain and local. Errors are factual: missing folder path + Choose Folder. [NOTE] Shipped Launch at Login description still says “this Mac” — intended copy is platform-neutral (“this computer”).

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md`.

| Component | Use | Behavioral rules |
|---|---|---|
| WelcomeGate | First launch / no vault | Brand headline + drop zone. Click zone or **Choose Folder** opens system folder dialog. Tauri drag-drop of a folder opens vault. Errors surface under the zone (`role="alert"`). Shortcut hint uses `modShortcut("O")`. |
| File Tree | Sidebar | Filtered 1:1 FS rules. Click folder toggles; click note opens tab + `is-active`. External rename/move reflected via watcher (~2s). |
| Search / Command Palette | Sidebar + `{mod}P` | Filename substring filter; ↑/↓ Enter Esc. Opens as tab. [ASSUMPTION: filename-only.] |
| Tab Bar | Main top | Multi-tab with draft/dirty affordances; `{mod}N` new draft; `{mod}W` close; `{mod}Tab` cycle; `{mod}B` toggle sidebar; `{mod},` settings tab. Persist `openTabs` (drafts excluded). Welcome mode: drag region + settings only. |
| Editor | Note tab | Autosave 500ms + flush on blur/nav/quit; draft `isNew` stays memory-only until `hasContent`. FindBar: `{mod}F` / Shift+`{mod}F` replace. Spellcheck follows Settings switch. |
| HomeView | No note tab | Lists notes from vault tree; search filters; new-note CTA. Paths handle `/` and `\`. |
| SettingsView | Special tab | Appearance (theme, hue, intensity, reduce transparency), Writing (spellcheck), System (autostart, updater check+install+relaunch), Logs (path, copy, stream). Not a modal overlay. |
| Library footer | Sidebar bottom | Vault name + open/switch folder + settings entry. |
| File Changed Banner | Under Tab Bar | Dirty+external only. Reload discards buffer; Keep mine suppresses until next external write. Clean notes silent-reload. |
| Status Bar | Main bottom | Live counts; no click actions in v1. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| No vault (first launch) | WelcomeGate | Brand + drop zone + Choose Folder. No sample files. |
| Vault missing on restore | WelcomeGate | Error string + same open actions. |
| Vault empty | File Tree + Home/Editor | Folders maybe; placeholder to select or create note. |
| Note loading | Editor | No skeleton; pulse only if slow [ASSUMPTION]. |
| Dirty + external change | Banner | Buffer never overwritten. |
| Clean + external change | Editor | Silent reload; preserve cursor/scroll when possible. |
| Save failure | Banner | Destructive factual copy; edits retained. |
| Update available | Settings | Confirm → download/install → relaunch. |
| No search matches | Palette | “No matches…” — no create-from-palette in v1. |
| Offline | Global | No banner — app is offline by design. |

## Interaction Primitives

Keyboard-first. Labels are platform-aware (`⌘` vs `Ctrl+`); accelerators are `CmdOrCtrl` in menus.

- `{mod}O` — Open folder (menu + welcome hint)
- `{mod}P` — Command palette
- `{mod}N` — New draft tab
- `{mod},` — Toggle Settings tab
- `{mod}W` — Close active tab
- `{mod}B` — Toggle sidebar
- `{mod}[` / `{mod}]` — Back / forward
- `{mod}Tab` / Shift+`{mod}Tab` — Cycle tabs
- `{mod}F` / Shift+`{mod}F` — Find / Find+Replace
- `{mod}S` — Explicit save (autosave also runs)
- `F11` — Fullscreen on non-macOS (menu)
- `Esc` — Close palette / find / return focus to editor

**Mouse:** click to act; drag-drop folder on WelcomeGate (and window-level Tauri drag). No drag-reorder tabs/files in v1.

**Banned in v1:** multi-window, full-text search, slash `/` command palette, floating scratchpad, collaborative cursors.

## Accessibility Floor

- WCAG 2.2 AA for chrome text against token backgrounds (Reduce Transparency helps when material tint risks contrast).
- Focus order: Sidebar Search → Tree → Library → Tab Bar → Editor/Settings → Status. `Esc` returns focus or closes overlays/palette/find.
- WelcomeGate drop zone is keyboard-reachable via Choose Folder button; errors use `role="alert"`.
- Palette results announce via live region as filter changes.
- Focus rings use `{colors.ring}` at 2px offset.
- Editor preserves heading hierarchy for AT; spellcheck underlines are system-native.
- Window controls are OS-native (Overlay traffic lights on macOS; system caption on Windows).

## Inspiration & Anti-patterns

- **Lifted from LocalEditor.app:** calm local posture, centered reading width, palette jump, plain-folder vault, no sync.
- **Lifted from Obsidian:** vault-as-folder, FS truth, active file highlight.
- **Rejected — Mote:** floating panel over every app.
- **Rejected — Cursor/IDE heaviness:** LSP, git UI, AI chat sidebar.
- **Rejected — Notion complexity:** slash explosion, databases, colored sidebars as brand.

## Key Flows

### Flow 1 — Alex reviews Claude’s notes side-by-side (UJ-1)

1. Alex relaunches snipnote; session restores vault + tabs. Sidebar highlights last note; Editor shows live Markdown; Status Bar updates counts.
2. `{mod}P` → types to jump to another note as a second tab.
3. Claude overwrites a clean note on disk; watcher silent-reloads when Alex returns to it.
4. Alex hits `+` / `{mod}N` → draft tab → types heading → autosave creates file → tree updates.
5. **Climax:** Multi-file review beside the terminal without leaving plain `.md` on disk.

Failure: dirty buffer + external change → banner Reload / Keep mine.

### Flow 2 — Priya capture in ~10 seconds (UJ-2)

1. Vault already open. `{mod}N` → draft → types → file appears after debounce.
2. `{mod}P` jumps back to another tab; `{mod},` opens Settings tab to flip theme/tint without a modal.
3. **Climax:** Note is live-rendered and still `cat`-able / `git diff`-able on disk.

### Flow 3 — First-run Jordan on Windows (platform)

1. Fresh install from NSIS. Window shows native title bar + (on Win11) Mica.
2. WelcomeGate: brand, drop zone, **Ctrl+O** chip. Jordan drops `D:\notes` or clicks Choose Folder.
3. TabBar fills with Home; sidebar lists `.md` files; paths with `\` resolve correctly.
4. **Climax:** Same calm editor as macOS — different chrome, same folder truth.

Failure: folder missing later → WelcomeGate error + Choose Folder.

## Responsive & Platform

Desktop only. No web breakpoints. Content reflows via centered max-widths; sidebar fixed `260px` when expanded; Tab Bar scrolls horizontally.

**Vibrant / Mica behavior:**

| Platform | Effect | Chrome | Fallback |
|---|---|---|---|
| macOS | `Sidebar` + radius 12 | Overlay traffic lights over TabBar | Opaque fills if material unavailable |
| Windows 11 | `Mica` only | Native caption + title | Opaque on Win10 / soft-fail |
| Linux | none | Native decorations | Opaque fills |

Constraints: material is window-level; elevated sheets (palette) stay opaque; text tokens never translucent; deep links preserve Windows drive letters (`snipnote://open/C:/…`). Release CI builds macOS (arm64+x64) and `windows-latest`.
