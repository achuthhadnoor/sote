# Epic 1 Context: Workspace Shell & Vault Access (Vibrant + Theme + Settings)

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver a branded, native-feeling `snipnote` desktop shell that launches as a vibrant translucent window with correct traffic lights, lets users pick any local folder as vault via system dialog, browses the filtered folder hierarchy with active highlight and SVG icons, supports light/dark/system theme via Settings, and restores vault, open tabs, theme, and window geometry automatically on relaunch without flicker.

## Stories

- Story 1.1: Project Branding, Configuration & Hardening
- Story 1.2: LocalEditor Design System & Shell Wireframe (Vibrant + Dark + Multi-Tab)
- Story 1.3: Rust Storage Service & Vault Directory Scanning (Dot-Folders + Hide Empty)
- Story 1.4: Vault Opening, File Tree Rendering & Active File Highlighting (Icons + Settings)
- Story 1.5: Cold-Start Session, Tabs & Theme Persistence
- Story 1.6: Vibrant Window Material (Sidebar/Mica via EffectsBuilder)
- Story 1.7: Light/Dark/System Theme + Settings (⌘,)

## Requirements & Constraints

- App identity is `snipnote` everywhere: package, crate, product name, window title, bundle identifier `com.achuth.snipnote`, HTML title `snipnote`.
- Window is `1280×720` default (`1100×600` min), `transparent:true`, `macOSPrivateApi:true`, title bar `Overlay` with floating traffic lights and 12px corner radius.
- Content Security Policy must allow only `default-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: asset:`; no external scripts.
- Vault selection uses native OS folder picker; the chosen path persists and restores on next launch without re-prompting. Missing/invalid vault shows error and re-prompts, never silently creates.
- File Tree is filtered, not 1:1: empty folders hidden, dot-folders shown only if their subtree contains `.md`/`.markdown`, hidden dot-files and non-markdown files excluded, sorted directories-first then alphabetically case-insensitive.
- Active note has single highlight in tree and tab bar reflects same selection; Library footer shows vault name with Switch/Open and gear button to open Settings.
- Theme is user-selectable `light|dark|system` in Settings; `system` follows OS live; choice persists across launches without flash and maintains readable contrast over vibrant material.
- Settings opens via `⌘,`/`Ctrl+,` or gear, closes via `Esc`/`×`/`Done`/toggle; no settings may require restart.
- Operation is strictly local-only: no outbound network, no telemetry without opt-in, no cloud sync.
- Cold-start restores last vault, sanitized open tabs (only existing files, drafts excluded), active tab, theme, and window size/position before window is shown.

## Technical Decisions

- All disk I/O, directory scanning, atomic writes, and file watching are owned by the Rust backend; frontend never does direct filesystem access.
- Directory scan returns recursive `VaultNode { path: string; name: string; isDirectory: boolean; children?: VaultNode[] }` using canonical absolute POSIX paths as identity. Filtering and sorting happen in `storage.rs:79 scan_directory`; markdown changes inside dot-folders still emit watcher events.
- Session and window geometry persist in `$APP_CONFIG_DIR/session.json` as `{ lastVaultPath, activeFilePath, openTabs: string[] }` plus size/position; Rust restores geometry in `tauri::Builder::setup` before showing window, sanitizes tabs to existing files, and excludes `isNew` drafts.
- Vibrant material uses `EffectsBuilder([Sidebar, Mica], Active, radius 12)` in `lib.rs:14` with `macos-private-api` feature; CSS uses translucent `rgba` variants over native blur (light `bg 0.78`/`sidebar 0.68`, dark `bg 0.72`/`sidebar 0.68`) with opaque hex fallback on Linux/unsupported; `html/body/#root` stay transparent.
- Theme state lives in `useThemeStore` (`theme` + `effectiveTheme`), persisted in `localStorage snipnote-theme`, applied via `html[data-theme]` and `style.colorScheme`, with `matchMedia(prefers-color-scheme)` listener for live system tracking; dark tokens at `App.css:43 [data-theme="dark"]` (`#141416` bg, `#1A1A1E` sidebar, `#2A2A2E` border, `#EDEEF0` fg, `#60A5FA` link).
- Frontend state is partitioned into isolated Zustand stores (`useVaultStore`, `useTabStore`, `useEditorStore`, `useThemeStore`) to avoid cross-concern re-renders.
- IPC event naming is colon-delimited kebab-case; errors use `{ code, message }`; naming conventions: PascalCase components, camelCase stores/hooks, snake_case Rust modules/commands, kebab-case CSS.

## UX & Interaction Patterns

- Layout: fixed 260px Sidebar (40px Search header → scrollable File Tree → 40px Library footer) + Main column (40px Tab Bar with scrollable `28px` `max 180px` tabs, `×` close, `+` new, back/forward arrows → centered 760px Editor with 24px gutters → 24px Status Bar). Right Panel `420px` Terminal/Browser/Canvas exists but stays hidden in v1.
- Design tokens: monochrome light (`#FFFFFF` editor, `#F8F8F9` sidebar, `#EAEAEA` hairlines, `#0F0F0F` primary, `#2563EB` link) and dark (`#141416`/`#1A1A1E`/`#2A2A2E`/`#EDEEF0`/`#60A5FA`) with translucent `rgba` over vibrant; Inter/SF Pro Text 14px/1.6 body, 13px/1.5 sidebar, 13px/1.6 mono, 24px/700 h1, 18px/600 h2; radii 6/8/12px; flat surfaces with hairline borders, only Command Palette elevated.
- File Tree rows: folder `16px` SVG (`0.14` fill) + `14px` chevron rotating 90° on expand + file `16px` doc-with-lines + indent spacer; active row `accent-translucent` `8px` radius, hover `hover-translucent`, icons tint `muted-fg→fg`.
- Tab Bar: `is-active` white/dark bg+border+shadow, `is-draft` italic + hollow `6px` dot / `draft` label, dirty `•`, `saving…`; `+` creates virtual draft `Untitled.md` (no disk until content).
- Settings: overlay `560px` with `blur 8px`, `12px` radius, `shadow 0 20px 50px`, `z 10000`, header `Settings`+`×`, body Appearance radios Light/Dark/System + About, footer `Done`; opened by gear or `⌘,` global `keydown` handling `","`/`Comma`.
- Status Bar: quiet `11px` muted right-aligned over `status-translucent`; ephemeral states (no vault, empty vault, load) use plain placeholder text, no skeletons.
- Keyboard: `⌘P` palette, `↑/↓`/`Enter`/`Esc` navigation, `⌘N` new draft, `⌘W` close, `Ctrl/⌘+Tab` cycle (Shift reverses), `⌘,` toggle Settings.

## Cross-Story Dependencies

- Story 1.1 (branding, window config, CSP, `macos-private-api`) is prerequisite for all others; 1.6 verifies its `transparent` + `EffectsBuilder` wiring.
- Story 1.2 (tokens, vibrant translucency, shell layout, dark overrides) must land before 1.4 (tree styling), 1.6 (material demo), and 1.7 (theme application).
- Story 1.3 (scan/filter/sort, `VaultNode` contract) is backend for Story 1.4 (tree rendering, highlight, gear).
- Story 1.5 (session restore for vault, tabs, geometry, theme) depends on 1.1 (session.json path), 1.3 (re-scan on restore), 1.4 (tab selection), and 1.7 (theme flash prevention).
- Story 1.7 builds on 1.2 dark tokens and 1.5 persistence; 1.6 shares the same translucent token set.
