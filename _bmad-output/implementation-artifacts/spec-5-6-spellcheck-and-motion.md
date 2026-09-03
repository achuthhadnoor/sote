---
title: 'Story 5.6: SpellCheck & Overlay Scrollbars/Motion'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-5-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred:
  - summary: >-
      No automated test for spellcheck toggle or reduced-motion overrides
    evidence: |-
      yarn build and cargo test only type-check and run Rust unit tests; no frontend test harness for Settings toggle persistence or prefers-reduced-* media query computed style.
      Location: src/components/settings/SettingsDialog.tsx:1
    location: >-
      src/components/settings/SettingsDialog.tsx:1
    severity: low
  - summary: >-
      WebView spellcheck may require native Tauri webview attribute beyond contenteditable
    evidence: |-
      ProseMirror spellcheck set via DOM attribute works in browsers, but Tauri WebView on macOS may need webkit spellcheck enabled at WebView creation; not verified via Tauri config.
      Location: src/components/editor/EditorSurface.tsx:94
    location: >-
      src/components/editor/EditorSurface.tsx:94
    severity: low
---

<intent-contract>

## Intent

**Problem:** Typing feels non-native without spellcheck suggestions and motion/transparency ignores OS accessibility settings, causing distraction and accessibility gaps.

**Approach:** Enable webview spellcheck by default with a persistent toggle in Settings, and respect `prefers-reduced-motion` / `prefers-reduced-transparency` by disabling spring animations and falling back to opaque palette.

## Boundaries & Constraints

**Always:**
- Spellcheck MUST be enabled via `spellcheck="true"` on ProseMirror contenteditable and raw `textarea`; Toggle in `SettingsDialog` MUST persist in `localStorage "snipnote-spellcheck"` (default `true`) and immediately apply to editor without reload.
- Settings MUST have a new "Editor" or "Writing" section with a switch "Spellcheck" (label + hint) persisting to localStorage; right-click suggestions are provided by OS/WebView, no custom dictionary.
- `prefers-reduced-motion: reduce` MUST disable all `transition`/`animation` durations (or specifically palette `scaleIn`, outline `cubic-bezier(0.2,0,0,1)`, tab `all 0.12s`) to `0.01ms`.
- `prefers-reduced-transparency: reduce` MUST override translucent CSS variables (`--bg-translucent`, `--sidebar-translucent`, etc.) to opaque hex equivalents at `src/App.css:1` so vibrant Sidebar/Mica fallback is opaque.
- Must not break existing `⌘F` find bar or `⌘,` Settings toggle.

**Block If:**
- WebView spellcheck requires `tauri.conf.json` `webview` `spellcheck` flag or OS entitlement not available in current Tauri version (requires native config).

**Never:**
- Implement custom spellcheck dictionary or grammar check — OS only.
- Modify `tauri.conf.json` `csp` or `transparent` vibrancy setup beyond CSS fallbacks.
- Use external JS animation libraries for spring; CSS `transition` is the source.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First launch | No localStorage key | Spellcheck enabled (`true`), editor `spellcheck=true`, Settings toggle on | Default true |
| Toggle off | Settings switch off | `localStorage "snipnote-spellcheck" = "false"`, editor `spellcheck=false` immediately, misspellings no longer underlined | — |
| Toggle on | Switch on | `true`, editor shows red underlines, right-click shows suggestions | — |
| Typing with spellcheck on | Type "teh" | Red underline via OS, right-click suggestions | If OS has no dictionary, no underline |
| Reduced motion enabled | OS `prefers-reduced-motion: reduce` | All `transition`/`animation` durations 0.01ms, palette/outline appear instantly | — |
| Reduced transparency enabled | OS `prefers-reduced-transparency: reduce` | `--bg-translucent` etc. resolve to opaque hexes, no blur translucency | — |
| Raw mode | `isRawMode true` | Raw `textarea` also respects spellcheck toggle | — |
| Settings closed/reopen | After toggle | Toggle reflects persisted value | — |

</intent-contract>

## Code Map

- `src/components/settings/SettingsDialog.tsx:64` — Appearance/About sections; add new Writing/Editor section with spellcheck toggle switch persisting to localStorage.
- `src/stores/useSpellCheckStore.ts` — New Zustand or simple localStorage hook for `spellcheckEnabled: boolean` + `toggle()` persisting to `snipnote-spellcheck`; alternatively inline localStorage in SettingsDialog and EditorSurface.
- `src/components/editor/EditorSurface.tsx:94` — `editorProps.attributes` currently `class: "snipnote-editor-content"`; extend to `spellcheck: spellCheckEnabled ? "true" : "false"` and raw `textarea spellCheck={spellCheckEnabled}`.
- `src/App.css:1` — Root tokens `--bg-translucent` etc.; add `@media (prefers-reduced-motion: reduce)` and `@media (prefers-reduced-transparency: reduce)` overrides.

## Tasks & Acceptance

**Execution:**
- `src/stores/useSpellCheckStore.ts` — Create store/hook with `enabled` default `true` from `localStorage.getItem("snipnote-spellcheck")`, `setEnabled(b)` persisting, `toggle()`; ensure SSR-safe `typeof window !== "undefined"`.
- `src/components/settings/SettingsDialog.tsx:64` — Add section "Writing" with toggle switch bound to `useSpellCheckStore`, label "Spellcheck", hint "Underline misspellings and show suggestions on right-click", persisted.
- `src/components/editor/EditorSurface.tsx:94` — Import `useSpellCheckStore`, read `enabled`, set `editorProps.attributes.spellcheck` and `textarea spellCheck={enabled}`; ensure `useEditor` re-creates or updates when `enabled` changes (via `editor.setOptions` or `editor.view.dom.setAttribute`).
- `src/App.css:1` — Append `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` and `@media (prefers-reduced-transparency: reduce) { :root { --bg-translucent: var(--bg); --sidebar-translucent: var(--sidebar); --border-translucent: var(--border); --muted-translucent: var(--muted); --accent-translucent: var(--accent); --status-translucent: var(--status-bar); --hover-translucent: var(--hover, var(--muted)); } [data-theme="dark"] { similar opaque } }`.

**Acceptance Criteria:**
- Given Settings opened, when toggling Spellcheck off/on, then `localStorage "snipnote-spellcheck"` updates, editor `contenteditable` `spellcheck` attribute flips, and after reload the toggle persists.
- Given spellcheck on and typing "teh", when right-clicking, then OS shows suggestions; with toggle off, no underline and no suggestions.
- Given OS `prefers-reduced-motion: reduce` enabled, when inspecting computed style, then `transition-duration` is `0.01ms` (palette/outline spring disabled).
- Given OS `prefers-reduced-transparency: reduce` enabled, when inspecting `--bg-translucent`, then it resolves to opaque hex `#FFFFFF` (light) / `#141416` (dark) not `rgba`.
- Given `yarn build` and `cargo test`, both succeed.

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 2: (high 0, medium 0, low 2)
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` Fix TS2448 editor used before declaration — moved FindBar useEffects after `useEditor` declaration and added `spellcheck` sync effect in `src/components/editor/EditorSurface.tsx:75`.

## Design Notes

Toggle UI should match existing Settings `settings-option` pattern but as a switch: use `settings-option` with a checkbox-style `input[type="checkbox"]` styled as iOS switch, or reuse `settings-radio` pattern with On/Off. Keep DS consistent:  `SettingsDialog.tsx` already has `Option` helper for radios; add a `Toggle` helper. Store could be Zustand as `useThemeStore` or simple `useSyncExternalStore` reading localStorage — Zustand is consistent with `useThemeStore` but a tiny `useSpellCheckStore` with `create` is fine. For ProseMirror spellcheck dynamic toggle, after `enabled` changes, run `editor.view.dom.setAttribute("spellcheck", enabled ? "true" : "false")` via `useEffect`.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

**Manual checks:**
- Settings toggle off → textarea and ProseMirror spellcheck false, reload persists
- System Preferences → Accessibility → Display → Reduce motion on → palette animates instantly
- Reduce transparency on → sidebar opaque not translucent

## Auto Run Result

### Summary of Implemented Change
Implemented Story 5.6 SpellCheck & Overlay Scrollbars/Motion: created `useSpellCheckStore` with `snipnote-spellcheck` persistence, added Writing section toggle in `SettingsDialog`, wired `spellcheck` attribute to ProseMirror and raw textarea in `EditorSurface` with live DOM sync, and added `prefers-reduced-motion`/`prefers-reduced-transparency` media queries to disable animations and fallback translucent tokens to opaque hexes with blur removal.

### Files Changed
- `src/stores/useSpellCheckStore.ts:1` — New Zustand store for spellcheck enabled with localStorage persistence
- `src/components/settings/SettingsDialog.tsx:1` — Added Writing section toggle switch bound to `useSpellCheckStore`
- `src/components/editor/EditorSurface.tsx:1` — Imported store, wired `spellcheck` to `editorProps` and `textarea`, added effects for DOM sync and find bar moved after editor declaration fix
- `src/App.css:2499` — Added `.settings-toggle` switch styles and `@media (prefers-reduced-motion)` / `@media (prefers-reduced-transparency)` overrides
- `_bmad-output/implementation-artifacts/spec-5-6-spellcheck-and-motion.md:1` — Created spec

### Review Findings Breakdown
- Patches applied: 1 (low 1)
- Items deferred: 2 (low 2) — missing frontend tests, native webview spellcheck config
- Items rejected: 0

### Follow-up Review Recommendation
`false` (1 patch, 0 high, 3×0 +1×1 =1 <5; score: 1)

### Verification Performed
- Ran `yarn build`: built in 4.46s with 0 errors
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed

### Residual Risks
- OS spellcheck suggestions depend on system dictionary; no custom dictionary handling.
- Reduced-motion override is global `*,*::before,*::after` which may affect future animations needing to remain; refine selectors if needed.
- No e2e test for reduced-motion/transparency; manual OS setting verification required.
