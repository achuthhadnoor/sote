# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-f-floating-menubar-notes.md`
  summary: Dual webviews (float + main) share disk session but not Zustand — concurrent edits can conflict.
  evidence: Review found separate JS heaps with no cross-window sync when flag is on.

- source_spec: `_bmad-output/implementation-artifacts/spec-f-floating-menubar-notes.md`
  summary: Use a macOS template/menu-bar tray glyph instead of the colored app icon.
  evidence: Blind-hunter noted `default_window_icon()` may look wrong in light/dark menu bars.

- source_spec: `_bmad-output/implementation-artifacts/spec-f-floating-menubar-notes.md`
  summary: Settings UI for hotkey conflict / re-register when CmdOrCtrl+Shift+Space fails.
  evidence: Registration failure is log-only today.

- source_spec: `_bmad-output/implementation-artifacts/spec-f-floating-menubar-notes.md`
  summary: Consider Accessory activation policy so Dock icon is hidden in tray-only mode.
  evidence: Left as Regular to avoid breaking full-editor Dock presence (Ask-First).

- source_spec: `_bmad-output/implementation-artifacts/spec-f-floating-menubar-notes.md`
  summary: Add automated runtime tests for tray/hotkey/hide-to-tray (project has no test runner yet).
  evidence: Verification-gap review — cargo check/yarn build cannot catch inverted I/O matrix rows.

- source_spec: `_bmad-output/implementation-artifacts/spec-f-floating-menubar-notes.md`
  summary: Failsafe/show consistency for lazy-built `main` after open_full_editor / deep-link.
  evidence: Edge-case hunter noted empty-flash and permanently-hidden main if JS never reveals.
