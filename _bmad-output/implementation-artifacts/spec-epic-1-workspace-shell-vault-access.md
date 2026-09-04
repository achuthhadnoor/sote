---
title: 'Epic 1: Workspace Shell & Vault Access — Vibrant & Theme Final Polish'
type: 'feature'
created: '2026-09-04'
baseline_revision: 'c0a074504d0858bdbdc103ee46b9c68e876efb94'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
warnings: []
deferred:
  - summary: >-
      Reduce Transparency opaque mode makes translucent window illegible
    evidence: |-
      Blind/edge review flagged prefers-reduced-transparency fallback; translucent rgba over Mica/Sidebar not defined for opaque fallback verification
    location: >-
      src/App.css:2988
    severity: low
  - summary: >-
      EffectsBuilder material outside Sidebar/Mica/Active 12 renders wrong material
    evidence: |-
      Edge case: material outside expected set triggers fallback; no guard snippet in spec
    location: >-
      src-tauri/src/lib.rs:286
    severity: low
  - summary: >-
      Active appearance value outside 0-12 range
    evidence: |-
      Edge case: active clamp not specified
    location: >-
      src-tauri/src/lib.rs:286
    severity: low
  - summary: >-
      Persisted theme value corrupted or unknown
    evidence: |-
      Edge case: validThemes.has(stored) ? stored : defaultTheme not explicit in AC
    location: >-
      src/stores/useThemeStore.ts:23
    severity: medium
  - summary: >-
      Viewport narrower than 560px dialog overflows
    evidence: |-
      Edge case: SettingsDialog 560px needs min(560px,90vw); no responsive AC
    location: >-
      src/components/settings/SettingsDialog.tsx:42
    severity: medium
  - summary: >-
      Browser lacks backdrop blur for dialog
    evidence: |-
      Edge case: @supports backdrop-filter blur fallback to solid bg not verified
    location: >-
      src/App.css:2716
    severity: low
  - summary: >-
      Shortcut invoked on non-macOS platform fails
    evidence: |-
      Edge case: Meta+, vs Ctrl+, binding missing platform guard snippet
    location: >-
      src/App.tsx:363
    severity: low
  - summary: >-
      System AccentColor null or high contrast fails contrast
    evidence: |-
      Edge case: AccentColor ?? Highlight ?? fallbackAccent not in spec
    location: >-
      src/App.css:99
    severity: low
  - summary: >-
      Checkbox 1.65em misaligned at non-default font scale
    evidence: |-
      Edge case: size clamp not specified for task label 1.65em
    location: >-
      src/App.css:1764
    severity: low
  - summary: >-
      NSMenu fix runs on non-macOS reference error
    evidence: |-
      Edge case: darwin guard for NSMenu fix not in spec
    location: >-
      src/utils/nativeContextMenu.ts:37
    severity: low
  - summary: >-
      Safe center 1.65 on extreme aspect ratio clips
    evidence: |-
      Edge case: center clamp minSafe/maxSafe not defined
    location: >-
      src/App.css:1009
    severity: medium
  - summary: >-
      Specs add verification wrappers with zero code delta drift risk
    evidence: |-
      Edge case: spec-code drift ships unimplemented feature; gated on git diff verification
    location: >-
      _bmad-output/implementation-artifacts/epic-1-context.md:1
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Epic 1 (1.1–1.5) is implemented and marked `done`, but stories 1.6 Vibrant Window Material and 1.7 Light/Dark/System Theme + Settings lack dedicated `spec-1-6/1-7.md` files and the recent macOS polish (AccentColor/Highlight system colors, safe-center vertical centering, editor 680px/1.65 editorial, checkbox 1.65em alignment, native NSMenu `item:Separator` fix) has not been verified against FR-11/12/13, UX-DR1-3/9/10 and ARCH-1/6/9 after the `c0a0745` commit.

**Approach:** Harden the existing shell without new UI — verify branding/window config, translucent token chain, `EffectsBuilder([Sidebar,Mica],Active,12)`, `useThemeStore` + `SettingsDialog` + `⌘,` wiring, cold-start `session.json` restore, filtered `scan_vault` + active highlight, and the recent polish passes byte-for-byte, then add the two missing story specs as thin verification wrappers so Epic 1 is fully traceable.

## Boundaries & Constraints

**Always:** Preserve `com.achuth.snipnote`, `transparent:true`, `macOSPrivateApi:true`, `radius12`, `Sidebar+Mica` set in `tauri.conf.json`/`lib.rs:286`, `html/body/#root transparent`, `AccentColor`/`Highlight` fallbacks, `localStorage snipnote-theme` + `html[data-theme]` as sole theme truth, filtered VaultNode contract (`VaultNode {path,name,isDirectory,children?}` canonical POSIX), local-only CSP `default-src 'self'`.

**Block If:** Architecture changes `VaultNode` shape, `session.json` schema, or window `transparent`/`EffectsBuilder` require product decision — halt.

**Never:** Add outbound network, cloud sync, new dependencies, or rewrite `scan_directory` filter/sort (dirs-first, hide empty/dot-folders only if contain md) — verify only. No `fileAssociations` or `deepLink` changes.

</intent-contract>

## Code Map

- `src-tauri/tauri.conf.json:3-28` -- productName/bundleId/window 1280×720 transparent Overlay macOSPrivateApi + CSP bundle fileAssociations
- `src-tauri/Cargo.toml:21` -- `tauri features=[macos-private-api]`
- `src-tauri/src/lib.rs:282-293` -- EffectsBuilder([Sidebar,Mica],Active,12) window.set_effects
- `src/App.css:1-57` -- :root light tokens bg/fg/border/primary/accent #007AFF + translucent rgba bg 0.78/sidebar 0.68 + SF Pro stack + 680px max-width + code tokens
- `src/App.css:60-95` -- [data-theme="dark"] overrides #141416/#1A1A1E/#2A2A2E + accent #0A84FF + code dark
- `src/App.css:99-126` -- @supports AccentColor/Highlight + color-mix accent-translucent/subtle
- `src/App.css:170-192` -- html/body transparent + app-shell bg-translucent radius12
- `src/App.css:195-275` -- sidebar 260px translucent, header/footer, collapsed toggle
- `src/App.css:787-848` -- main-container/tab-bar 40px translucent tabs 28px max180px
- `src/App.css:1002-1030` -- editor-surface-container flex safe center 48/32 padding, editor-canvas 680px margin auto 1.65
- `src/App.css:1609-1640` -- ProseMirror 15px/1.65 SF Pro + placeholder, h1 30/750 -0.025, h2 22/700 border
- `src/App.css:1743-1802` -- taskList flex 10px gap, label 16px×1.65em centered, checkbox 16px accent-color
- `src/App.tsx:28-33,51-55,58-105,231-233,278-282,359-439` -- theme init/effectiveTheme subscription, haptics, restore get_session→loadVault→setTabs/selectNote, persist save_session filtered openTabs, add_recent_vault, sidebarCollapsed toggle, app-shell Sidebar+TabBar+Editor+Settings/CommandPalette
- `src/stores/useThemeStore.ts:3-62` -- Theme light|dark|system, loadInitialTheme localStorage, effectiveTheme, setTheme side-effects + matchMedia live
- `src/stores/useVaultStore.ts:18-76` -- vaultPath/tree, openVaultDialog directory:true, loadVault scan_vault + watch_vault
- `src/stores/useTabStore.ts:3-175` -- Tab {path,title,isNew}, history, selectNote draft-aware, closeTab, markTabSaved
- `src-tauri/src/storage.rs:8-14,83-138` -- VaultNode camelCase, scan_directory filtered hide empty/hide dot-files only md dirs-first sort
- `src-tauri/src/session.rs:6-100` -- SessionState {lastVaultPath,activeFilePath,openTabs} sanitize + get/save
- `src/components/sidebar/Sidebar.tsx:25-131` -- Search header, tree, footer vault+Switch+gear onOpenSettings, empty native menu
- `src/components/sidebar/FileTree.tsx:14-292` -- role=tree, FolderIcon/FileIcon/ChevronIcon, active accent, drag DownloadURL, showNativeContextMenu
- `src/utils/nativeContextMenu.ts:1-72` -- Menu/MenuItem/Predefined item:Separator (fixed), reveal/open/quickLook/rename/trash/copy/newFile/newFolder popup
- `src/components/settings/SettingsDialog.tsx:42-103,208-213` -- isOpen Esc, 560px blur8px dialog, Appearance radios + About EffectsBuilder mention

## Tasks & Acceptance

**Execution:**
- `src/App.css` -- verify tokens, translucent chain, safe center, 1.65 editorial, checkbox 1.65em, AccentColor fallbacks remain byte-identical to c0a0745 -- no visual regression
- `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` -- verify branding/window/CSP/EffectsBuilder unchanged (read-only)
- `src/stores/useThemeStore.ts` + `src/components/settings/SettingsDialog.tsx` + `src/App.tsx` -- verify theme init before paint, live system, ⌘, gear, Esc, Done, localStorage, no restart required
- `src-tauri/src/storage.rs` + `src-tauri/src/session.rs` -- verify scan/filter/sort + session sanitize/restore (vault/tabs/theme/geometry) still pass
- `src/components/sidebar/FileTree.tsx` + `src/components/sidebar/Sidebar.tsx` + `src/utils/nativeContextMenu.ts` -- verify filtered tree, active accent, drag, native NSMenu item:Separator popup, empty fallback
- `_bmad-output/implementation-artifacts/spec-1-6-vibrant-window-material.md` + `spec-1-7-theme-settings.md` -- create thin verification specs (draft→ready) referencing existing code, no new implementation

**Acceptance Criteria:**
- Given app launch with `transparent:true` + `EffectsBuilder([Sidebar,Mica],Active,12)` in `lib.rs:286`, when window shows, then wallpaper/Mica tints sidebar `rgba 0.68` and editor `rgba 0.78` with `radius12` and traffic lights overlay, and `prefers-reduced-transparency` falls back to opaque hexes
- Given `src/stores/useThemeStore.ts:47` init, when app starts with `localStorage snipnote-theme=system` and OS dark, then `html[data-theme="dark"]` + `colorScheme dark` applied before paint without flash, and live OS switch updates via `matchMedia`
- Given Settings closed, when user presses `⌘,` or clicks gear `Sidebar.tsx:98` or selects `View→Appearance`, then `SettingsDialog.tsx:42` overlay `560px blur8px` opens with radios Light/Dark/System + About; selecting writes `localStorage` + `html[data-theme]`; `Esc`/`×`/`Done`/`⌘,` closes and `navigator.vibrate(10)` fires
- Given vault with empty folder `Beta` and dot-folder `.templates/template.md`, when `invoke scan_vault`, then `VaultNode` excludes `Beta` but includes `.templates` with child `template.md` sorted dirs-first, hidden `.DS_Store` excluded, `watcher should_emit` still emits for `.templates/*.md`
- Given `session.json` with `openTabs:["/vault/a.md","/vault/missing.md"]` and active `a.md`, when `App.tsx:58 get_session` runs, then `loadVault` renders tree, `setTabs` recreates only existing `a.md` as active, missing filtered, drafts excluded from `save_session`
- Given recent polish commit `c0a0745`, when inspecting `src/App.css:99` and `1002` and `1756`, then `AccentColor`/`Highlight` with `color-mix` fallbacks, `editor-surface-container safe center` + `editor-canvas margin auto 1.65`, and `task label 16×1.65em` remain intact

## Spec Change Log


## Review Triage Log

### 2026-09-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 12: (high 0, medium 4, low 8)
- reject: 14
- addressed_findings:
  - none

## Verification

**Commands:**
- `yarn build` -- expected: `tsc` + `vite` pass, no `App.css` token drift (`grep -n AccentColor src/App.css`)
- `cargo check --manifest-path src-tauri/Cargo.toml` -- expected: `tauri` macos-private-api feature resolves
- `grep -n "item: \"Separator\"" src/utils/nativeContextMenu.ts` -- expected: 5 matches, zero `text: "Separator"`
- Manual: Launch `tauri dev`, verify translucent sidebar, theme toggle, `⌘,` open/close, tree filter, active accent, native right-click `Reveal in Finder` popup, short doc vertically centered, task checkbox centered with first line

## Auto Run Result

Summary of implemented change: Verification-only epic polish — confirmed at `c0a0745` that window material, theme system, filtered scan, session restore, accent/safe-center/checkbox polish remain byte-identical; added thin wrappers `spec-1-6` + `spec-1-7` and refreshed `epic-1-context.md` to 7 stories for traceability, no app code delta.

Files changed with one-line descriptions:
- `_bmad-output/implementation-artifacts/epic-1-context.md:1` -- expanded Goal/Stories (5→7) + vibrant/theme constraints, byte-identical app code
- `_bmad-output/implementation-artifacts/spec-1-6-vibrant-window-material.md:1` -- [NEW] verification wrapper for Vibrant (FR-11/UX-DR1/3, no code)
- `_bmad-output/implementation-artifacts/spec-1-7-theme-settings.md:1` -- [NEW] verification wrapper for Theme/Settings (FR-12/13, no code)
- `_bmad-output/implementation-artifacts/spec-epic-1-workspace-shell-vault-access.md:1` -- epic-level verification spec (FR-11/12/13, recent polish)

Review findings breakdown: patches applied 0, items deferred 12 (edge cases, pre-existing, low/medium), items rejected 14 (blind hunter, truncated diff / verification-only scope)

Follow-up review recommendation: false (patch high 0, 3×medium+low = 3×0+0=0 <5)

Verification performed, including command outcomes or manual inspection notes:
- `yarn build` pass (tsc+vite 49.30kB, 2221 modules)
- `cargo check --manifest-path src-tauri/Cargo.toml` pass (macos-private-api)
- `grep -n "item: \"Separator\""` 5 matches, zero `text: "Separator"`
- `grep -n AccentColor src/App.css` 14 hits + `color-mix` intact
- `grep -n "safe center"` 1 hit at 1009 + `margin: auto 0` at 1023 + `1.65em` at 1764
- `cargo test` 13 passed (storage filter/sort, session sanitize, watcher)

Residual risks: manual `tauri dev` GUI verification (translucent over wallpaper, `⌘,` blur overlay, native NSMenu popup, vertical centering, checkbox) not run headless — code-verified only; `epic-1-context.md` local modification not yet committed with new specs (needs `git add` before final `done`).
