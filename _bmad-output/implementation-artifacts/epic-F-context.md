# Epic F Context: Floating Notes & Menu Bar (v1 Ship)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Ship snipnote’s default product as a tray/menubar app with a compact floating panel: users capture or continue a Markdown note via hotkey or tray without opening the full vault IDE. The panel reuses the existing TipTap editor, settings, disk IO, and updater; the full vault shell stays in-repo but off by default behind a feature flag. Success means cold install → tray only (no mandatory full window), hotkey/tray → working editor + save, Settings/updater reachable, and flag enables today’s shell without deleting it.

## Stories

- Story F.1: System tray / menu bar
- Story F.2: Floating panel window
- Story F.3: Global hotkey
- Story F.4: EditorSurface in the panel
- Story F.5: Settings from tray/panel
- Story F.6: Full editor (v2) feature flag

## Requirements & Constraints

- Tray/menubar icon with Show/Hide panel, New note, Settings, Quit (macOS menu bar / Windows tray).
- Compact floating panel show/hide; hosts shared editor. Default size ~420×520; always-on-top off by default; close hides to tray; Quit exits the process. App may run with no visible window (tray only).
- Global shortcut toggles panel: `CmdOrCtrl+Shift+Space`. Shortcut chips use platform-correct labels (`modShortcut`).
- Panel edits one active note path with the same live Markdown rendering, CommonMark/GFM round-trip (no injected HTML; frontmatter verbatim), debounced autosave, and Rust disk authority as the full editor. Watcher/conflict handling applies to the open float note.
- Settings (theme/tint/reduce transparency, updater, Launch at Login) open from tray or panel without requiring the vault shell.
- Feature flag `snipnote-full-editor` (localStorage and/or env / Settings) enables the existing full vault window; default **off**. Do not delete full-shell code.
- Shared v1 also includes auto-update (HTTPS updater only; publish drafts for `/releases/latest`) and Launch at Login.
- Out of default v1: Sidebar, multi-tab IA, WelcomeGate-first, `{mod}P` vault jump as primary UX — those are v2 when the flag is on.
- Ship targets: macOS + Windows.

## Technical Decisions

- Dual presentation: window labels `float` (default UX) and `main` (full vault shell). Boot registers tray; default UX shows `float` on demand (hotkey/tray), not `main`.
- Both presentations share `EditorSurface`, `SettingsView`, Zustand stores, and Rust storage/watcher/updater — do not duplicate TipTap stacks.
- Full-shell Overlay (mac) / native+Mica (win) chrome rules apply to `main` only; do not copy TabBar traffic-light insets into the compact float.
- Tray + global shortcut live in Rust (`lib.rs` / tray & shortcut plugins); frontend panel shell wraps shared editor/settings and gates mounting current `App` on the flag.
- Suggested structural pieces: tray setup, floating shell component, flag helper. Float material may reuse EffectsBuilder patterns where they fit; float chrome is its own UX decision.

## UX & Interaction Patterns

- Brand/tone: calm, local, content-first floating note — TipTap is the hero; not an IDE or marketing dashboard. Reuse existing monochrome/tint tokens; no second theme.
- Float fills its frame (no forced 760px centering). Minimal header: note title/path, settings, hide.
- Tray menu: Show/Hide, New note, Settings, Quit; optional “Open full editor” when flag allowed.
- On show: focus editor. Esc may hide. Autosave behavior matches the full app.
- First run / missing vault: lightweight folder pick from the panel path — not the full WelcomeGate shell by default.
- Primary flow: hotkey → panel → type → autosave `.md` → hide; tray remains. Enabling full editor shows `main`; float may still coexist.
- Do not pack Sidebar/tabs into the default float; do not force the full vault window on every launch.

## Cross-Story Dependencies

- Build order: tray → float window → hotkey → embed editor → settings → full-editor flag.
- F.2–F.5 depend on F.1 presence and F.2 window lifecycle; F.4 depends on shared editor/autosave (Epic 2) and benefits from watcher/conflict (Epic 3); F.5 depends on existing Settings/updater (Epic 5.9 remains v1).
- F.6 depends on keeping Epic 1 shell code; Epic 4 (palette/multi-tab) is v2-primary and not required for float MVP.
- Float and full shell share stores/IO — changes to envelope, save debounce, or updater affect both surfaces.
