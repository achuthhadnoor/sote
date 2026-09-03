---
title: snipnote EXPERIENCE
status: draft
created: 2026-09-02
updated: 2026-09-03
sources:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/forge/tauri-markdown-editor/forged-idea.md
  - https://localeditor.app
---

# snipnote — Experience Spine

> Desktop Tauri v2, full-size single window, local-first. Paired with `DESIGN.md` (LocalEditor.app minimal monochrome theme). Theme request theme like https://localeditor.app — light, content-first, "not every file needs an IDE."

## Foundation

**Form-factor:** Single-surface desktop (Tauri v2 + React 19 + Vite), full-size **vibrant** window — macOS `Sidebar` vibrancy + Windows 11 `Mica` via `EffectsBuilder` only — `1280×720` `min 1100×600` `Overlay` (was `800×600`), macOS primary (Win/Linux builds ready but not QA'd per PRD Open Question 5). No mobile/web in v1. `DESIGN.md` is the visual identity reference — monochrome LocalEditor palette light `#FFFFFF`/`#F8F8F9` → dark `#141416`/`#1A1A1E` via `[data-theme="dark"]`, translucent `rgba` over material (`{colors.background}` `#FFFFFF`→`0.78` white / `0.72` dark; `DESIGN.md` §Colors / §Elevation & Depth define variants). **Right Panel** (`Terminal`/`Browser`/`Canvas`) built but hidden (`App.tsx` commented) for later. `Theme` `light|dark|system` via `useThemeStore` + `localStorage snipnote-theme` + `prefers-color-scheme`. This spine is how it works; DESIGN.md is how it looks. Single Vault open at a time in v1 [ASSUMPTION]. No accounts, no cloud, no sync — files never leave disk. Auto-update deferred.

**Window-material premise:** The window is `transparent:true` + `macOSPrivateApi:true` (see `src-tauri/tauri.conf.json:12` `1280×720`) and Rust `src-tauri/src/lib.rs:14` `.setup` applies `tauri::window::EffectsBuilder::new().effects([Effect::Sidebar, Effect::Mica]).state(EffectState::Active).radius(12.0).build()` via `window.set_effects(...)` — macOS consumes `Sidebar`, Windows consumes `Mica`, other platforms ignore both and fall back to opaque fills (`light`/`dark` `#141416`). HTML `html, body, #root` are `transparent` so the native blur shows through `rgba`-translucent surfaces. No `window-vibrancy` crate — EffectsBuilder is the only path.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Welcome / Vault Picker | Cold launch, no vault set | Pick/confirm Vault folder, restore last vault |
| Main Window | Vault open | Vibrant `1280×720` window, now multi-tab + hidden right panel |
| ├─ Sidebar | Persistent left `260px` | Search → File Tree (SVG icons, dot-folders if contain md, empty hidden) → Library footer (folder SVG + Switch + gear Settings `⌘,`) |
| ├─ Tab Bar | Top of Main `40px` | Back/forward `←→`, scrollable multi-tabs (`Untitled.md` draft italic/hollow, dirty •, `×` close) + `+` (`⌘N` draft-until-content) |
| ├─ Editor | Center, `760px` centered content | Live WYSIWYG markdown, raw Markdown Source on disk (draft `isNew` stays in-memory until `hasContent`) |
| ├─ Status Bar | Bottom `24px` | Live `words | chars | paragraphs` |
| ├─ Right Panel | (hidden in current build, `App.tsx` commented) | `Terminal`/`Browser` (`iframe`)/`Canvas` (`canvas` stub) — built `src/components/rightPanel/*` for later |
| ├─ Command Palette (⌘P) | `⌘P` anywhere / click Search | Floating palette to jump to any Note by filename (opens as tab) |
| ├─ File Changed Banner | Inline under Tab Bar when external change detected | `Reload / Keep mine` decision without loss |
| └─ Settings (⌘,) | `⌘,`/`Ctrl+,` or Sidebar gear or `×`/`Esc`/`Done` | Overlay `560px` `blur 8px` with Appearance (Light/Dark/System radios) + About; persists `localStorage snipnote-theme` + `data-theme` |

→ Composition reference: PRD screenshot breakdown (`prds/prd-snipnote-2026-09-02/prd.md:1 §2.3`), LocalEditor.app `Pokedex.md` + `package.json` property panels for content-width and palette reference. Spine wins on conflict.

Sidebar always visible in v1 full-size window; no Sheet/collapse until later increments. Vault is filtered file-system truth: `Vault → File Tree` is `filtered 1:1` (dot-folders shown only if subtree has `md`, empty hidden, hidden files excluded, dirs-first then alpha, SVG icons; see `src-tauri/src/storage.rs:79` `scan_directory`).

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
| File Tree | Sidebar | Filtered FS: `filtered 1:1` dot-folders shown only if subtree has `.md` (`.templates/template.md` visible, `.emptyDot` hidden), empty folders hidden, hidden files (`.DS_Store`, `.hidden.md`) excluded, dirs-first then alpha, SVG icons (`FolderIcon` closed/open `0.14 fill`, `FileIcon` doc with md lines, `ChevronIcon` `rotate 90` when open, `tree-file-indent` spacer). Click folder toggles expand; click Note opens as tab + highlights `is-active` (`accent-translucent` + `shadow`). External rename/move reflected within 2s (markdown in dot-folders still emits). Empty folder shows nothing, no placeholder. See `src-tauri/src/storage.rs:79`. |
| Search / Command Palette | Sidebar top + `⌘P` | `⌘P` focuses and floats palette (`{components.command-palette}` `520×400` `12px` `shadow`, stays opaque `bg` above vibrant). Typing filters Note filenames substring, case-insensitive. `↑/↓` moves highlight, `Enter` jumps (opens as tab), `Esc` closes and returns focus to Editor. Palette also reachable by clicking Search input. [ASSUMPTION: filename-only in v1.] |
| Tab Bar | Main top `40px` | Scrollable multi-tab row: `tabs: Tab[] {path,title,isNew}` → `tab-item` (`28px` `max 180px` `ellipsis`, `is-active` `bg`+`border`+`shadow`, `is-draft` italic + hollow `6px` border / `draft` label, dirty `• 6px` `primary`, `saving…` 10px). `×` closes (`⌘W` also), `+` (`⌘N`) creates draft `Untitled.md` `{isNew:true}` virtual (no disk until `hasContent`), `←→` back/forward history, `Ctrl/⌘+Tab` cycles (Shift reverses). Persist `session.json {openTabs, activeFilePath}` (drafts excluded). Close of window persists tabs/vault for restore via `src/stores/useTabStore.ts:3` + `src/App.tsx:32`. |
| Editor | Main center | Tiptap live render: headings/bold/links/bullets. Draft `isNew` tabs init empty (`body ""`, `frontmatter null`, `isDirty false`, `editor.setContent("")`) without `read_file`; first `hasContent` (`body/frontmatter trimmed>0`) triggers 500ms `saveNow` → `write_file` → `markTabSaved(false)` + `loadVault` to show file in tree. Load parses Markdown Source → Tiptap; save serializes back CommonMark/GFM, frontmatter preserved verbatim, no injected HTML. `⌘S` implicit auto-save 500ms + flush on blur/prevPath/window blur (skips `wasNew && !hasContent`). Slash `/` not in v1 [ASSUMPTION: deferred]. See `src/components/editor/EditorSurface.tsx:12` + `src/stores/useEditorStore.ts:84`. |
| Right Panel (hidden) | Right `420px` | Built `src/components/rightPanel/RightPanel.tsx:1` (`TerminalPane` dark `#0F0F0F` mock `help/ls/pwd/echo`, `BrowserPane` `iframe` + URL bar + reload, `CanvasPane` `canvas` dotted grid + pen/rect/arrow + Clear, collapsed `40px` rail) but not rendered (`App.tsx` commented) — will be re-enabled later; no behavior in current build. |
| Library footer | Sidebar bottom | Shows vault folder SVG + `Switch/Open…` + gear Settings (`⌘,` overlay). Entry point to sort/options. In v1, `Library` exposes Sort (alpha) and `Open Vault…` (re-pick folder). No vault switcher beyond re-pick [ASSUMPTION per PRD Open Question 6]. |
| File Changed Banner | Inline under Tab Bar | Appears only when dirty Note overwritten on disk. Non-blocking, no auto-dismiss. `Reload` discards buffer and loads disk; `Keep mine` keeps buffer and suppresses banner until next external write. If clean, auto-reloads silently and preserves cursor/scroll. Draft `isNew` with no file on disk never shows banner. |
| Settings | Overlay `560px` | `SettingsDialog` `z 10000` `blur 8px` `12px` radius, header `Settings` + `×`, body `Appearance` radios Light/Dark/System (`useThemeStore` `localStorage snipnote-theme` + `html[data-theme]` + `colorScheme`, System follows `prefers-color-scheme` live) + About, footer `Done`; opened via `⌘,`/`Ctrl+,` or gear, closed via `Esc`/`×`/`Done`/`⌘,` toggle. See `src/components/settings/SettingsDialog.tsx:1` + `src/stores/useThemeStore.ts:1` + `src/App.css:1646`. |
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
- Click — File Tree row opens Note as tab; Tab `×` closes tab; Tab click switches; Library gear opens Settings
- `⌘N` / `Ctrl+N` — New draft tab `Untitled.md` `{isNew:true}` (no disk until content)
- `⌘,` / `Ctrl+,` — Toggle Settings overlay (also `Esc`/`×`/`Done` to close)
- `⌘W` / `Ctrl+W` — Close active tab (flush handled; empty draft with no content just closes)
- `Ctrl/⌘+Tab` / `Shift+Tab` — Cycle tabs forward/back
- `⌘S` — Save (implicit auto-save also on 500ms debounce [ASSUMPTION]); draft `hasContent` guard (`body/frontmatter trimmed>0`) prevents empty file creation; save is atomic temp+rename, now with `isDirty`/`saving…` + dirty `•` / draft hollow dot in tab
- `Back/Forward` `⌘[` / `⌘]` in Tab Bar — Session history navigation [ASSUMPTION: history + tabs]

**Mouse:** click to act; no drag-to-reorder in v1, no drag-to-move file in File Tree in v1. Hover reveals file row highlight (`{colors.accent}` overlay). Editor scrolling is native. Right Panel collapsed rail (when re-enabled) shows vertical icon buttons.

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
 5. Alex clicks `+` in Tab Bar. `Untitled.md` appears as draft italic tab with hollow dot (no file on disk yet). Types `# Quick take` → 500ms debounce `saveNow` sees `hasContent` → `write_file` → `markTabSaved(false)` + vault reload → File Tree now shows `Untitled.md` highlighted.
 6. **Climax:** Without switching to Obsidian, without preview toggle, Alex has reviewed Claude's multi-file output and captured a note — all in one quiet vibrant window beside the terminal, files still plain `.md` on disk that `git diff` shows faithfully, empty drafts never pollute disk. The handoff (Claude wrote, human read) succeeded with no corruption.

Failure: External change while Alex was mid-edit on active Note with unsaved buffer → inline banner under Tab Bar: "File changed on disk — Reload / Keep mine." `Reload` loads disk and discards buffer; `Keep mine` keeps buffer and suppresses banner. No toast, no auto-merge.

### Flow 2 — Priya capture-to-vault in 10 seconds (Realizes UJ-2)

1. Priya has snipnote open on `Daily Notes/` during a Claude planning session.
 2. Hits `+` → draft `Untitled.md` italic tab (no file on disk) focused in Editor, File Tree not yet showing it. Types `# Quick take` with `**bold**` and `[link](https://example.com)` — rendered live, no mode switch; 500ms later file appears in tree.
 3. Hits `⌘P`, types `tech`, jumps back to `Tech Stack Decisions.md` (now second tab). Palette opens as tab; `×`/`⌘W` can close either. Gear `⌘,` opens Settings to switch Light/Dark/System without leaving flow. Palette behavior same as Flow 1 but multi-tab.
 4. **Climax:** Content is live-rendered and still plain `.md` on disk — she can `cat` it in terminal or commit. Empty `Untitled.md` closed without content would have left no file. No IDE launch, no cloud.

Failure: Vault folder missing (moved/deleted) on launch → Welcome surface with error "Folder not found at ~/snipnote-vault" + primary "Open Vault…" button. No data loss messaging beyond path.

## Responsive & Platform

Desktop only, single full-size **vibrant** window. No responsive breakpoints beyond window resize. `1280×720` `min 1100×600` per `src-tauri/tauri.conf.json:15` (was `800×600`), content reflows via centered `760px` max-width — gutters grow/shrink as window widens/narrows, File Tree and Sidebar remain fixed `260px`, Tab Bar scrolls horizontally, Right Panel `420px` hidden for now but built. Not a responsive web product like Drift example; this section exists to lock "desktop-only, not responsive web" as the platform posture. `Theme` `light|dark|system` via `data-theme` + `localStorage`; `Settings` overlay does not affect layout.

**Vibrant / Mica platform behavior (EffectsBuilder only):**

| Platform | Effect via `EffectsBuilder` | Window config | Visual | Fallback |
|---|---|---|---|---|
| **macOS 10.14+** | `Effect::Sidebar` + `EffectState::Active` + `radius(12.0)` (`src-tauri/src/lib.rs:12` `.setup` + `window.set_effects`) | `transparent:true`, `macOSPrivateApi:true`, `tauri` feature `macos-private-api` | Translucent `rgba(248,248,249,0.68)` sidebar + `rgba(255,255,255,0.78)` editor over `NSVisualEffectView` Sidebar material — wallpaper tint + blur shows through, rounded corners 12px, traffic lights float over vibrancy | If material unavailable (old macOS / permission), renders as opaque `#F8F8F9` / `#FFFFFF` — no functional loss |
| **Windows 11 22H1+** | `Effect::Mica` (system `light`/`dark` adaptive) | `transparent:true` | Same translucent fills over Desktop Window Manager `Mica` — subtle desktop tint + noise behind content; border still `rgba(234,234,234,0.85)` | On Windows 10 or older 11 builds, `Mica` is ignored and falls back to opaque fills; no `Blur`/`Acrylic` fallback is applied per "EffectsBuilder just" constraint |
| **Linux / unsupported** | (ignored) | `transparent:true` ignored by compositor | Solid fills `#FFFFFF` / `#F8F8F9` exactly as pre-vibrant spec | — |

Constraints: vibrancy is window-level, not per-component — CSS `backdrop-filter` is not used; the native material is the blur. Surfaces directly over the material use the `rgba` variants from `DESIGN.md` §Colors; sheets that must read as elevated (Command Palette, dialogs) stay **opaque white** so they pop above the material. Text tokens never go translucent, so AA contrast holds even over wallpaper. `html, body, #root` are `transparent` on all platforms; the opaque fallback is applied at `.app-shell`/`.sidebar`/`.main-container` level, not at the document root, so the material region is contiguous. Resizing/dragging stays GPU-composited by the OS; no JS blur is involved.

**Why Sidebar + Mica:** `Sidebar` is Apple's Finder-sidebar material — slightly translucent, wallpaper-aware, works light-first — matching snipnote's sidebar-heavy layout better than `HudWindow` (too dark) or `WindowBackground` (too opaque). `Mica` is the Windows 11 system material that tints with the desktop wallpaper and respects light/dark — matching snipnote's light-first posture without requiring explicit `MicaLight`/`MicaDark` variants. `Tabbed`/`Acrylic`/`Blur` are intentionally not used per the "EffectsBuilder just, vibrant + Mica only" request.

