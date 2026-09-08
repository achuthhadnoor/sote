---
title: snipnote EXPERIENCE
status: final
created: 2026-09-02
updated: 2026-09-08
sources:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-08-floating-v1.md
  - shipped: EditorSurface, SettingsView, platform chrome (full shell = v2)
---

# snipnote — Experience Spine

> **v1 default:** menubar/tray + floating notes panel. **v2:** full vault shell behind flag. Paired with `DESIGN.md`. macOS + Windows.

## Foundation

**Form-factor:** Desktop Tauri v2 + React 19. **Primary UI = floating panel** (~420×520 [ASSUMPTION]) toggled from tray / global hotkey (`CmdOrCtrl+Shift+Space` [ASSUMPTION]). App may run with no visible window (tray only). **Full editor window** (`1280×720`, existing shell) is **v2** — created/shown only when `snipnote-full-editor` flag is on.

**Shared:** `EditorSurface`, autosave, theme/tint, `SettingsView`, updater, vault path + note files on disk.

**Platform chrome:**
- **Float (v1):** Compact panel; material/transparency may reuse Sidebar/Mica patterns where sensible; do not require full Overlay TabBar traffic-light layout.
- **Main (v2):** Existing platform-split Overlay/Sidebar vs native/Mica rules.

**Assumptions (v1):** Close panel → hide to tray; Quit from tray exits; single active note; always-on-top **off** by default.

## Information Architecture

### v1 (default)

| Surface | Reached from | Purpose |
|---|---|---|
| Tray / menu bar | Always (while app running) | Show/Hide, New note, Settings, Quit; Open full editor if flag allowed |
| Floating panel | Tray, hotkey | Minimal chrome + `EditorSurface` + save |
| Settings | Tray / panel | Existing SettingsView |
| Vault pick | First run / missing vault | Lightweight choose folder (not full WelcomeGate required) |

### v2 (flag on) — existing shell

| Surface | Purpose |
|---|---|
| WelcomeGate, Sidebar, TabBar, Home, StatusBar, Command Palette, full Settings tab | Prior full-shell experience; secondary product mode |

## Voice and Tone

| Do | Don't |
|---|---|
| “Notes stay on disk.” | “Welcome to your second brain 🚀” |
| Platform-correct hotkey chips | Hard-coded `⌘` on Windows |
| Hide to tray quietly | Force full vault window on every launch |

## Component Patterns (v1 delta)

| Component | Behavioral rules |
|---|---|
| Tray menu | Show/Hide panel, New note, Settings, Quit |
| Floating panel | Focus editor on show; Esc may hide [ASSUMPTION]; autosave same as full app |
| EditorSurface | Shared TipTap; Find/spellcheck when practical in compact chrome |
| SettingsView | Opened from tray/panel without requiring full shell |
| Full App shell | Mounted only when flag on |

## Key Flows

### Flow F1 — Hotkey capture (v1)
1. Jordan presses global hotkey → panel shows.
2. Types in EditorSurface → autosave to `.md`.
3. Hotkey again or close → panel hides; tray remains.
4. **Climax:** Note available without a full IDE window.

### Flow F2 — Enable v2
1. Settings or tray → Enable full editor.
2. `main` window shows existing vault shell.
3. Float may remain available [ASSUMPTION: both can coexist].

## Responsive & Platform

Desktop only. Tray semantics differ slightly macOS vs Windows; same plugin path. Unsigned builds still install; Gatekeeper/SmartScreen warnings unchanged by this pivot.
