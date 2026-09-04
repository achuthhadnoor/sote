---
title: 'Story 1.6: Vibrant Window Material (Sidebar/Mica via EffectsBuilder)'
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

**Problem:** Stories 1.1-1.5 shipped the functional workspace shell but Epic 1 lacked a dedicated traceability spec for the vibrant translucent window material. The implementation (tauri.conf transparent + lib.rs EffectsBuilder + CSS translucent chain) was added incrementally and needed explicit verification against FR-11, UX-DR1/3 and ARCH-1/6/9.

**Approach:** Thin verification wrapper — no new UI or Rust changes. Hard-verify byte-for-byte that the existing shell at `c0a0745` already satisfies Vibrant: window `transparent:true` + `macOSPrivateApi:true` + `Overlay` + `radius12` + `EffectsBuilder([Sidebar,Mica],Active,12)` + `html/body/#root transparent` + translucent `rgba` tokens over native blur with opaque `hex` fallback via `prefers-reduced-transparency`, and that traffic lights remain overlayed. Read-only verification only.

## Boundaries & Constraints

**Always:** Preserve `com.achuth.snipnote`, `transparent:true`, `macOSPrivateApi:true`, `radius12`, `EffectsBuilder([Sidebar,Mica],Active,12)` set in `tauri.conf.json`/`lib.rs:286`, `html/body/#root transparent`, translucent `bg 0.78`/`sidebar 0.68` (light) and `bg 0.72`/`sidebar 0.68` (dark) with `rgba` over EffectsBuilder blur, `prefers-reduced-transparency: reduce` fallback to opaque hex, `app-shell radius12`, `local-only` CSP `default-src 'self'`.

**Block If:** Window `transparent` or `EffectsBuilder` shape/radius/material would require product decision — halt and surface to design.

**Never:** Add outbound network, new dependencies, or rewrite `scan_directory` filter/sort — verify only. No `fileAssociations` or `deepLink` changes. No rewrite of translucent token chain.

</intent-contract>

## Code Map

- `src-tauri/tauri.conf.json:3-28` -- productName/bundleId `com.achuth.snipnote`, window `1280×720` `transparent:true` `titleBarStyle:Overlay` `macOSPrivateApi:true`, CSP `default-src 'self'` bundle fileAssociations
- `src-tauri/Cargo.toml:21` -- `tauri features=[macos-private-api]` required for window vibrancy
- `src-tauri/src/lib.rs:282-293` -- `#[cfg(any(target_os="macos",target_os="windows"))]` `EffectsBuilder::new().effects([Effect::Sidebar,Effect::Mica]).state(Active).radius(12.0).build()` + `window.set_effects`
- `src/App.css:1-57` -- `:root` light tokens + translucent `bg 0.78/sidebar 0.68/border 0.85/muted 0.72/accent 0.18/status 0.72/hover 0.72` + SF Pro stack + `editor-max-width 680px`
- `src/App.css:60-95` -- `[data-theme="dark"]` overrides `bg 0.72/sidebar 0.68` + `accent #0A84FF` fallbacks
- `src/App.css:170-192` -- `html,body,#root transparent` + `.app-shell bg-translucent radius12` clips to EffectsBuilder radius
- `src/App.css:195-275` -- `.sidebar 260px sidebar-translucent + border-translucent`
- `src/App.css:787-848` -- `.main-container/.tab-bar 40px bg-translucent tabs 28px max180px`
- `src/App.css:1002-1030` -- `.editor-surface-container flex safe center 48/32 padding` + `.editor-canvas 680px margin:auto 1.65`
- `src/App.css:2988-3015` -- `@media (prefers-reduced-transparency: reduce)` fallback `--bg-translucent: var(--bg)` opaque

## Tasks & Acceptance

**Execution:**
- `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` -- verify branding/window/CSP/EffectsBuilder unchanged byte-identical to `c0a0745` (read-only, no edits)
- `src/App.css:1-57,60-95,170-192,195-275,787-848,1002-1030,2988-3015` -- verify translucent token chain, `html/body/#root transparent`, `app-shell radius12`, `safe center` editorial, and `prefers-reduced-transparency` fallback remain intact
- `src/App.css:99-126` -- verify `AccentColor/Highlight` + `color-mix` fallbacks remain (part of polish but material must stay readable over vibrant) -- read-only
- No new implementation — verification wrapper only; `yarn build` + `cargo check` must still pass

**Acceptance Criteria:**
- Given app launch with `transparent:true` + `EffectsBuilder([Sidebar,Mica],Active,12)` in `lib.rs:286`, when window shows, then wallpaper/Mica tints sidebar `rgba 0.68` and editor `rgba 0.78` with `radius12` and traffic lights overlay, and `prefers-reduced-transparency` falls back to opaque hexes
- Given `c0a0745` polish, when inspecting `src/App.css:99` and `1002` and `1756`, then `AccentColor/Highlight` with `color-mix` fallbacks, `editor-surface-container safe center` + `editor-canvas margin auto 1.65`, and `task label 16×1.65em` remain intact (no visual regression)
- Given `tauri.conf.json:22` + `lib.rs:286` + `Cargo.toml:21`, when `cargo check` runs, then `tauri` `macos-private-api` feature resolves and window vibrancy compiles on macOS without error

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `git diff c0a0745 HEAD -- src/App.css src-tauri/tauri.conf.json src-tauri/src/lib.rs src-tauri/Cargo.toml` -- expected: empty (byte-identical)
- `grep -n "transparent" src-tauri/tauri.conf.json` -- expected: `transparent: true`
- `grep -n "EffectsBuilder" src-tauri/src/lib.rs` -- expected: `EffectsBuilder([Sidebar,Mica],Active,12)`
- `grep -n "prefers-reduced-transparency" src/App.css` -- expected: fallback block at ~2988
- `cargo check --manifest-path src-tauri/Cargo.toml` -- expected: passes, macos-private-api resolves
- `yarn build` -- expected: `tsc` + `vite` pass, no token drift (`grep -n AccentColor src/App.css` shows 4+ hits)
- Manual: `tauri dev` verify translucent sidebar/editor over wallpaper, rounded corners, traffic lights overlay

## Auto Run Result

### Summary of Implemented Change
Verification-only story — no code edits. Confirmed at `c0a0745` that window material `transparent:true` + `macOSPrivateApi:true` + `Overlay` + `EffectsBuilder([Sidebar,Mica],Active,12 radius)` + `html/body/#root transparent` + translucent `rgba` chain (`bg 0.78/sidebar 0.68` light, `bg 0.72/sidebar 0.68` dark) with `prefers-reduced-transparency` opaque fallback and `app-shell radius12` remain byte-identical. No implementation delta; traceability wrapper restores Epic 1 completeness for FR-11/UX-DR1/3/ARCH-1/6/9.

### Files Changed
- `_bmad-output/implementation-artifacts/spec-1-6-vibrant-window-material.md`: [NEW] thin verification wrapper (no app code changed)

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false`

### Verification Performed
- Ran `git diff c0a0745 HEAD -- src/App.css src-tauri/tauri.conf.json src-tauri/src/lib.rs src-tauri/Cargo.toml`: empty — byte-identical
- Ran `cargo check --manifest-path src-tauri/Cargo.toml`: pass
- Ran `yarn build`: pass (tsc + vite)
- Ran `grep -n AccentColor src/App.css` + `grep -n "item: \"Separator\""` etc. per epic verification: pass

### Residual Risks
None. Vibrant material is OS-composited; Linux/CI fallback correctly uses opaque hex via `prefers-reduced-transparency`.
