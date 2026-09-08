---
title: 'Epic F: Floating menubar notes (v1 default)'
type: 'feature'
created: '2026-09-08'
status: 'done'
baseline_commit: '899f0162e9a8e77e6ee449d5f6e6488c4966856e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-F-context.md'
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Default product still boots the full vault window; there is no tray, float panel, or global hotkey.

**Approach:** Add `float` window + system tray + `CmdOrCtrl+Shift+Space`; host shared `EditorSurface`/`SettingsView` in a thin shell; gate `main`/`App` behind `snipnote-full-editor` (default off). Keep full-shell code.

## Boundaries & Constraints

**Always:**
- Labels: `float` (v1), `main` (v2). Reuse EditorSurface, SettingsView, stores, Rust IO/updater.
- Tray: Show/Hide, New note, Settings, Quit. Hotkey toggles float.
- Float close hides to tray; Quit exits. Always-on-top off. Default size ~420×520.
- Flag `snipnote-full-editor` (localStorage + Settings) gates full App. Capabilities include `float`.
- Failsafe must not force-show `main` on v1 boot.

**Ask First:** Changing default hotkey; separate Settings window; always-on-top default on.

**Never:** Delete shell code; pack Sidebar/tabs into float; force full window every launch; copy Overlay insets into float; duplicate TipTap stacks.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold launch | Flag off | Tray up; no forced full `main` | Log setup errors; stay alive |
| Hotkey | Shortcut | Float show+focus ↔ hide | Register fail → tray still works |
| Edit + hide | Note open | Autosave unchanged | Existing save/conflict |
| Close float | Window close | Hide to tray; process runs | N/A |
| Quit | Tray Quit | Process exits | N/A |
| Settings | Tray/panel | SettingsView without full shell | N/A |
| New note | Tray New | Create note (or vault pick) + show float | Reuse vault dialog errors |
| Flag on | Enabled | `main` can show App; float may coexist | Bad value → off |
| Flag off | Default | No boot reveal of full shell | Failsafe ≠ force `main` |

</frozen-after-approval>

## Code Map

- `src-tauri/Cargo.toml` — tray-icon on tauri + `tauri-plugin-global-shortcut`
- `src-tauri/src/lib.rs` — only `"main"` today (`reveal_window`, 10s failsafe ~L411); add `float`, tray, hotkey, hide-on-close, dual reveal/failsafe
- `src-tauri/capabilities/default.json` — add `"float"` + shortcut permissions
- `src-tauri/icons/` — tray icon source (`32x32.png` etc.); windows built in Rust (`tauri.conf.json` `windows: []`)
- `src/main.tsx` — always `<App />`; route by `getCurrentWindow().label`
- `src/App.tsx` — full shell + session restore + `reveal_window`; keep for flagged `main`
- `src/components/editor/EditorSurface.tsx` — prop-less, store-driven; Settings via special tab — reuse in float
- `src/components/settings/SettingsView.tsx` — add full-editor flag control
- `src/lib/specialTabs.ts` — `SETTINGS_TAB_PATH`
- `src/stores/useVaultStore.ts` / `useTabStore.ts` / `useEditorStore.ts` — vault + activePath + save
- New: `src/components/float/FloatingShell.tsx` — minimal chrome + EditorSurface + bootstrap
- New: `src/lib/fullEditorFlag.ts` — read/write flag

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/Cargo.toml` (+ lock) -- tray + global-shortcut deps
- [x] `src-tauri/src/lib.rs` -- float window, tray, hotkey, hide-on-close, dual failsafe/reveal
- [x] `src-tauri/capabilities/default.json` -- `float` + shortcut permissions
- [x] `src/lib/fullEditorFlag.ts` + Settings row -- persist F.6 flag
- [x] `src/components/float/FloatingShell.tsx` -- bootstrap + EditorSurface + Settings/New/Hide
- [x] `src/main.tsx` -- mount by label; gate App on flag for `main`
- [x] Tray→FE glue for New/Settings/open-full-editor -- actions work
- [x] `cargo check` / `yarn build` -- compiles

**Acceptance Criteria:**
- Given cold launch flag-off, when start, then tray exists and full vault is not forced visible.
- Given hotkey or tray Show, when activated, then float focuses with editable autosaving Markdown.
- Given float close/hide, when triggered, then panel hides and process stays in tray.
- Given tray Settings, when chosen, then SettingsView works without full shell.
- Given flag on, when open full editor, then `App` on `main` works and shell code remains.

## Spec Change Log

## Design Notes

- Rust-owned tray + global shortcut; FE handles New/Settings via events if needed.
- Float: minimal header only. `main` may exist hidden for deep-link/single-instance but must not steal focus on v1 boot.
- No vault: lightweight `openVaultDialog` from float — not WelcomeGate-first.

## Verification

**Commands:**
- `cd src-tauri && cargo check` -- expected: success
- `yarn build` -- expected: success

**Manual checks:**
- Tray menu; hotkey; edit; hide vs quit; Settings; flag → full shell

## Suggested Review Order

**Boot & dual windows**

- Build compact float first; lazy `main` only when needed
  [`lib.rs:265`](../../src-tauri/src/lib.rs#L265)

- Close hides to tray instead of quitting
  [`lib.rs:519`](../../src-tauri/src/lib.rs#L519)

- Failsafe reveals float, never forces `main`
  [`lib.rs:378`](../../src-tauri/src/lib.rs#L378)

**Tray & hotkey**

- System tray menu + left-click toggle
  [`lib.rs:619`](../../src-tauri/src/lib.rs#L619)

- Global `CmdOrCtrl+Shift+Space` registration
  [`lib.rs:671`](../../src-tauri/src/lib.rs#L671)

**Floating UI**

- Route by window label to FloatingShell vs App
  [`main.tsx:39`](../../src/main.tsx#L39)

- Thin shell reuses shared EditorSurface
  [`FloatingShell.tsx:61`](../../src/components/float/FloatingShell.tsx#L61)

- Flush dirty buffer before hide
  [`FloatingShell.tsx:119`](../../src/components/float/FloatingShell.tsx#L119)

**Feature flag**

- Persist `snipnote-full-editor` (malformed → off)
  [`fullEditorFlag.ts:12`](../../src/lib/fullEditorFlag.ts#L12)

- Settings toggle opens/closes full shell with rollback
  [`SettingsView.tsx:193`](../../src/components/settings/SettingsView.tsx#L193)

**Capabilities**

- Grant `float` + shortcut/window permissions
  [`default.json:5`](../../src-tauri/capabilities/default.json#L5)
