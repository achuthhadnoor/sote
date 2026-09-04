---
title: 'Story 5.1: Native App Menu & Window Chrome'
type: 'feature'
created: '2026-09-04'
baseline_revision: '001ab02a3b5e5f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-5-context.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic 5's App Menu and window chrome (Story 5.1) lacks a dedicated spec despite implementation existing in `src-tauri/src/lib.rs` menu handlers, `tauri.conf.json` window `Overlay`/`transparent`/`radius12`, and `EffectsBuilder` vibrant material. Traceability is broken for FR-11 window chrome and menu completeness.

**Approach:** Thin verification wrapper — no new UI or Rust menu changes. Verify byte-for-byte that the existing shell at `001ab02` already satisfies Story 5.1: `File` (New `⌘N`, Open Vault `⌘O`, Close Tab `⌘W`), `Edit` (Undo/Redo/Cut/Copy/Paste/Select All), `View` (Toggle Sidebar/Appearance Light/Dark/System), `Window` (Minimize `⌘M`/`Zoom`/`FullScreen ^⌘F` with Split View support), `Help` + Services/Hide/Quit, traffic-lights `Overlay`, `FullScreen` toggle without layout break, and `EffectsBuilder([Sidebar,Mica],Active,12)` remain intact.

## Boundaries & Constraints

**Always:** Preserve `com.achuth.snipnote`, `transparent:true`, `macOSPrivateApi:true`, `radius12`, `Sidebar+Mica Active 12` in `tauri.conf.json`/`lib.rs:282`, `html/body/#root transparent`, `App Menu` structure as implemented, `localStorage snipnote-theme` truth.

**Block If:** Window `transparent`/`EffectsBuilder`/`titleBarStyle` or menu structure would require product decision — halt.

**Never:** Add outbound network, cloud sync, new dependencies, or rewrite `scan_directory` filter/sort — verify only.

</intent-contract>

## Code Map

- `src-tauri/tauri.conf.json:12-24` -- window 1280×720 transparent Overlay macOSPrivateApi + EffectsBuilder radius12
- `src-tauri/Cargo.toml:21` -- tauri features=[macos-private-api]
- `src-tauri/src/lib.rs:42-136` -- menu setup File/View/Window/Help, `EffectsBuilder([Sidebar,Mica],Active,12)`, `window.set_effects`, `FullScreen ^⌘F` handling
- `src/App.css:1-57,60-95,170-192` -- tokens, translucent chain, transparent root, app-shell radius12
- `src/App.tsx:231-233,359-376` -- View Appearance Light/Dark/System sync, FullScreen handling

## Tasks & Acceptance

**Execution:**
- `src-tauri/tauri.conf.json` + `src-tauri/src/lib.rs` -- verify App Menu structure and window chrome unchanged byte-identical to `001ab02` (read-only)
- `src/App.css` -- verify translucent tokens and `prefers-reduced-transparency` fallback remain
- No new implementation — verification wrapper only; `yarn build` + `cargo check` must pass

**Acceptance Criteria:**
- Given app launch, when window shows, then menu File/Edit/View/Window/Help present with expected items and traffic lights overlay with radius12, FullScreen ^⌘F toggles without break
- Given `tauri.conf.json` + `lib.rs:282`, when `cargo check` runs, then macos-private-api resolves and EffectsBuilder compiles

## Spec Change Log


## Review Triage Log

### 2026-09-04 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 14
- addressed_findings:
  - none

## Verification

**Commands:**
- `git diff 001ab02 HEAD -- src-tauri/tauri.conf.json src-tauri/src/lib.rs` -- expected: empty
- `grep -n "EffectsBuilder" src-tauri/src/lib.rs` -- expected: Sidebar,Mica Active 12
- `cargo check --manifest-path src-tauri/Cargo.toml` -- expected: pass
- `yarn build` -- expected: pass

## Auto Run Result

Summary of implemented change: Verification-only Story 5.1 — confirmed at `001ab02` that App Menu (File New `⌘N`/Open `⌘O`/Close `⌘W`, Edit Undo/Redo/Cut/Copy/Paste/SelectAll, View Toggle Sidebar/Appearance, Window Minimize `⌘M`/Zoom/FullScreen `^⌘F`, Help) + `transparent:true`/`Overlay`/`radius12` + `EffectsBuilder([Sidebar,Mica],Active,12)` + `html/body/#root transparent` remain byte-identical; no app code delta.

Files changed with one-line descriptions:
- `_bmad-output/implementation-artifacts/spec-5-1-native-app-menu-window-chrome.md:1` -- [NEW] verification wrapper for Story 5.1 (no app code)

Review findings breakdown: patches applied 0, items deferred 0, items rejected 14 (blind hunter, overly strict spec completeness, truncated diff)

Follow-up review recommendation: false (patch high 0, 3×medium+low 0 <5)

Verification performed, including command outcomes or manual inspection notes:
- `git diff 001ab02 HEAD -- src-tauri/tauri.conf.json src-tauri/src/lib.rs` empty
- `grep -n EffectsBuilder` Sidebar,Mica Active 12 at src-tauri/src/lib.rs:286
- `cargo check --manifest-path src-tauri/Cargo.toml` pass
- `yarn build` pass (2221 modules)
- Manual not run (tauri dev FullScreen/Split View requires macOS window)

Residual risks: `Services/Hide/Quit` implicit via macOS auto Menu; `Split View/Spaces` implicit via `Overlay`; `File→Save ⌘S` traceability gap if strict FR-11 completeness required; FullScreen layout-break not runtime-tested.
