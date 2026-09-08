---
title: snipnote DESIGN
status: final
created: 2026-09-02
updated: 2026-09-08
sources:
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-08-floating-v1.md
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
colors:
  background: '#FFFFFF'
  foreground: '#0F0F0F'
  muted: '#F6F6F7'
  muted-foreground: '#6B7280'
  border: '#EAEAEA'
  primary: '#0F0F0F'
  primary-foreground: '#FFFFFF'
  accent: 'hsl(var(--theme-tint-hue) 58% 42%)'
  link: '#2563EB'
  sidebar: '#F8F8F9'
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
spacing:
  float-width: 420px
  float-height: 520px
  sidebar-width: 260px
  editor-max-width: 760px
---

## Brand & Style

snipnote is calm, local, content-first. **v1 presents as a floating note** from the menu bar/tray — quiet presence, not an IDE. **v2** reuses the full vault shell visual system (Sidebar, TabBar, WelcomeGate) when the user enables full editor.

Monochrome base + optional tint; TipTap content is the hero inside the float. Do not turn the float into a marketing dashboard.

**Window material:** Reuse platform EffectsBuilder patterns where they fit the float; full-shell Overlay+Sidebar (mac) / native+Mica (win) rules still apply to the **v2 `main` window** only.

## Colors / Typography / Spacing

Same CSS variable system as `App.css` / prior full-shell DESIGN. Floating panel fills its frame (no forced 760px centering required in float). Full-shell layout tokens remain for v2.

## Components (v1)

- **Floating panel** — Compact shell ~`420×520` [ASSUMPTION]; hosts EditorSurface; minimal header (note title/path, settings, hide).
- **Tray icon** — Recognizable monochrome mark; menu Show / New / Settings / Quit.
- **EditorSurface / SettingsView** — Shared with v2.
- **Full shell (v2)** — Prior Sidebar, TabBar, WelcomeGate, StatusBar, Command Palette specs remain valid for flagged mode.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the float content-first and calm | Pack Sidebar/tabs into the default float |
| Reuse existing tokens and editor chrome | Invent a second purple/glow theme for “new app” |
| Platform-correct shortcut labels | Hard-code Mac glyphs on Windows |
| Hide to tray by default | Force the full vault window on every launch |
