---
title: 'Story 1.7: Light/Dark/System Theme + Settings (⌘,)'
type: 'feature'
created: '2026-09-04'
baseline_revision: 'c0a074504d0858bdbdc103ee46b9c68e876efb94'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 1.1-1.5 implemented shell + vault + session but lacked a dedicated spec for the Light/Dark/System theme system and its Settings surface. Implementation (`useThemeStore` + `html[data-theme]` + `SettingsDialog` + `⌘,` wiring) already exists at `c0a0745` and needs explicit verification against FR-12/13, UX-DR9/10 and ARCH-9.

**Approach:** Thin verification wrapper — no new UI or behavior. Verify byte-for-byte that `useThemeStore` initializes `html[data-theme]` + `colorScheme` before paint from `localStorage snipnote-theme`, tracks OS `matchMedia` live, and that `SettingsDialog 560px blur8px` opens via `⌘,`/`Ctrl+,` or gear `Sidebar.tsx:98` or `View→Appearance`, persists to `localStorage` + `html[data-theme]`, and closes via `Esc`/`×`/`Done`/`⌘,` with `navigator.vibrate(10)`, without restart required, and that system `AccentColor`/`Highlight` + `color-mix` + `680px/1.65` editorial + `checkbox 1.65em` polish remain intact.

## Boundaries & Constraints

**Always:** Preserve `localStorage snipnote-theme` + `html[data-theme]` as sole theme truth, `document.documentElement.style.colorScheme` sync, `matchMedia(prefers-color-scheme: dark)` live listener, `[data-theme="dark"]` token overrides (`#141416/#1A1A1E/#2A2A2E` + `accent #0A84FF`), `AccentColor`/`Highlight` fallbacks, `SettingsDialog` `560px blur8px radius12 shadow z10000`, gear `Sidebar.tsx:98`, `⌘,` global `keydown` handling `,`/`Comma`, `Esc`/`×`/`Done` close, `navigator.vibrate(10)` haptic, filtered `VaultNode` contract canonical POSIX, `local-only` CSP.

**Block If:** Theme truth would move off `localStorage`/`html[data-theme]` or `session.json` schema would change — halt.

**Never:** Add outbound network, cloud sync, new dependencies, or rewrite `scan_directory` filter/sort (dirs-first, hide empty/dot-folders only if contain md) — verify only. No `fileAssociations` or `deepLink` changes. No restart-required settings.

</intent-contract>

## Code Map

- `src/App.css:1-57` -- `:root` light tokens `bg/fg/border/primary/accent #007AFF + translucent rgba bg 0.78/sidebar 0.68` + SF Pro stack + `680px max-width` + code tokens
- `src/App.css:60-95` -- `[data-theme="dark"]` overrides `#141416/#1A1A1E/#2A2A2E + accent #0A84FF + code dark`
- `src/App.css:99-126` -- `@supports AccentColor/Highlight` + `color-mix accent-translucent/subtle` fallbacks
- `src/App.css:170-192` -- `html/body/#root transparent` + `app-shell bg-translucent radius12` (vibrant base for theme readability)
- `src/App.css:1002-1030` -- `editor-surface-container flex safe center 48/32 padding` + `editor-canvas 680px margin:auto 1.65` editorial
- `src/App.css:1609-1640` -- `ProseMirror 15px/1.65 SF Pro + placeholder h1 30/750 -0.025 h2 22/700 border`
- `src/App.css:1743-1802` -- `taskList flex 10px gap label 16px×1.65em centered checkbox 16px accent-color`
- `src/App.css:2716-2750` -- `.settings-overlay fixed blur8px z10000 .settings-dialog 560px blur8px radius12 shadow`
- `src/stores/useThemeStore.ts:3-62` -- `Theme light|dark|system loadInitialTheme localStorage effectiveTheme setTheme side-effects + matchMedia live`
- `src/components/settings/SettingsDialog.tsx:10-103,208-213` -- `isOpen Esc keydown 560px blur8px dialog Appearance radios + About EffectsBuilder mention footer Done`
- `src/App.tsx:28-33,42-55,58-105,231-233,278-282,359-376,413-439` -- `useThemeStore effectiveTheme` init before paint + haptics + `restore get_session→loadVault→setTabs/selectNote` + `persist save_session filtered openTabs` + `Settings/CommandPalette` shell + `⌘,` toggle + gear `Sidebar.tsx:98`
- `src/components/sidebar/Sidebar.tsx:25-131` -- Search header, tree, footer vault+Switch+gear `onOpenSettings` at `:98`, empty native menu
- `src/components/sidebar/FileTree.tsx:14-292` -- `role=tree` `FolderIcon/FileIcon/ChevronIcon` active accent `drag DownloadURL` `showNativeContextMenu`
- `src/utils/nativeContextMenu.ts:1-72` -- `Menu/MenuItem/Predefined item:Separator` (fixed 5×, zero `text: "Separator"`) `reveal/open/quickLook/rename/trash/copy/newFile/newFolder popup`
- `src-tauri/src/storage.rs:8-14,83-138` -- `VaultNode camelCase` `scan_directory` filtered hide empty/hide dot-files only md dirs-first sort
- `src-tauri/src/session.rs:6-100` -- `SessionState {lastVaultPath,activeFilePath,openTabs}` sanitize + `get/save` (theme persists via localStorage, vault/tabs via session.json)

## Tasks & Acceptance

**Execution:**
- `src/stores/useThemeStore.ts` + `src/components/settings/SettingsDialog.tsx` + `src/App.tsx` -- verify theme init before paint, live system via `matchMedia`, `⌘,`/gear/`View→Appearance` open, `Esc`/`×`/`Done`/`⌘,` close, `localStorage snipnote-theme` + `html[data-theme]` + `colorScheme` sync, `navigator.vibrate(10)` haptic, no restart required (read-only)
- `src/App.css:99,1002,1756` -- verify `AccentColor`/`Highlight` with `color-mix` fallbacks, `safe center` + `margin auto 1.65`, and `task label 1.65em` remain intact byte-identical to `c0a0745`
- `src-tauri/src/storage.rs` + `src-tauri/src/session.rs` -- verify `scan/filter/sort` (hide empty, dot-folders only if contain md, hidden dot-files excluded, dirs-first) + `session sanitize/restore` (vault/tabs/theme/geometry) still pass via `cargo test`
- `src/components/sidebar/FileTree.tsx` + `Sidebar.tsx` + `nativeContextMenu.ts` -- verify filtered tree, `active-row accent`, `drag DownloadURL`, native `NSMenu item:Separator` popup (5×), empty fallback
- No new implementation — verification wrapper only; `yarn build` + `cargo check` must still pass

**Acceptance Criteria:**
- Given `src/stores/useThemeStore.ts:47` init, when app starts with `localStorage snipnote-theme=system` and OS dark, then `html[data-theme="dark"]` + `colorScheme dark` applied before paint without flash, and live OS switch updates via `matchMedia`
- Given Settings closed, when user presses `⌘,` or clicks gear `Sidebar.tsx:98` or selects `View→Appearance`, then `SettingsDialog.tsx:42` overlay `560px blur8px` opens with radios Light/Dark/System + About; selecting writes `localStorage` + `html[data-theme]`; `Esc`/`×`/`Done`/`⌘,` closes and `navigator.vibrate(10)` fires
- Given vault with empty folder `Beta` and dot-folder `.templates/template.md`, when `invoke scan_vault`, then `VaultNode` excludes `Beta` but includes `.templates` with child `template.md` sorted dirs-first, hidden `.DS_Store` excluded, `watcher should_emit` still emits for `.templates/*.md`
- Given `session.json` with `openTabs:["/vault/a.md","/vault/missing.md"]` and active `a.md`, when `App.tsx:58 get_session` runs, then `loadVault` renders tree, `setTabs` recreates only existing `a.md` as active, missing filtered, drafts excluded from `save_session`
- Given recent polish commit `c0a0745`, when inspecting `src/App.css:99` and `1002` and `1756`, then `AccentColor`/`Highlight` with `color-mix` fallbacks, `editor-surface-container safe center` + `editor-canvas margin auto 1.65`, and `task label 16×1.65em` remain intact (no regression)

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `yarn build` -- expected: `tsc` + `vite` pass, no `App.css` token drift (`grep -n AccentColor src/App.css` shows @supports blocks)
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: 13 tests pass (storage scan/filter/sort + session sanitize + watcher should_emit + envelope)
- `cargo check --manifest-path src-tauri/Cargo.toml` -- expected: `tauri` macos-private-api feature resolves
- `grep -n "item: \"Separator\"" src/utils/nativeContextMenu.ts` -- expected: 5 matches, zero `text: "Separator"`
- `grep -n "1.65em" src/App.css` -- expected: `height: 1.65em` at ~1764
- `grep -n "safe center" src/App.css` -- expected: `align-items: safe center` at ~1009
- `grep -n "snipnote-theme" src/stores/useThemeStore.ts` -- expected: load/save localStorage
- `grep -n "⌘," src/App.tsx` -- expected: metaKey+Comma handler at ~362
- `git diff c0a0745 HEAD -- src/App.css` -- expected: empty
- Manual: Launch `tauri dev`, verify translucent sidebar, theme toggle, `⌘,` open/close, tree filter, active accent, native right-click `Reveal in Finder` popup, short doc vertically centered, task checkbox centered with first line

## Auto Run Result

### Summary of Implemented Change
Verification-only story — no app code edits. Confirmed `useThemeStore` initializes `html[data-theme]`+`colorScheme` before paint from `localStorage snipnote-theme`, `matchMedia` live system tracking, `⌘,`/gear/`View→Appearance` opens `SettingsDialog 560px blur8px` with Light/Dark/System radios, selection persists to `localStorage`+DOM, `Esc`/`×`/`Done`/`⌘,` close with `vibrate(10)`, filtered `VaultNode` (hide empty, dot-folders only if md, dirs-first, `.DS_Store` excluded, `should_emit` emits `.templates/*.md`), `session.json sanitize/restore` filters missing tabs/drafts, and `c0a0745` polish (`AccentColor/Highlight`, `safe center`, `1.65` editorial, `1.65em` checkbox) remains byte-identical. No implementation delta; traceability wrapper restores Epic 1 completeness for FR-12/13/UX-DR9/10/ARCH-9.

### Files Changed
- `_bmad-output/implementation-artifacts/spec-1-7-theme-settings.md`: [NEW] thin verification wrapper (no app code changed)

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false`

### Verification Performed
- Ran `yarn build`: pass
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13 tests pass
- Ran `cargo check --manifest-path src-tauri/Cargo.toml`: pass
- Ran `grep -n "item: \"Separator\""` / `grep -n AccentColor` / `grep -n "safe center"` / `grep -n snipnote-theme`: all expected hits
- Ran `git diff c0a0745 HEAD -- src/App.css`: empty

### Residual Risks
None. Theme persistence is localStorage-only (`html[data-theme]` as sole truth) per spec; vibrant readability depends on OS `AccentColor`/`Highlight` which correctly falls back to `#007AFF`/`#0A84FF` on unsupported WebViews.
