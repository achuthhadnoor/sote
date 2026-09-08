---
title: snipnote DESIGN
status: final
created: 2026-09-02
updated: 2026-09-08
sources:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/forge/tauri-markdown-editor/forged-idea.md
  - https://localeditor.app
  - shipped: src-tauri/src/lib.rs window chrome + EffectsBuilder
  - shipped: src/utils/platform.ts, WelcomeGate, SettingsView, App.css tint tokens
colors:
  background: '#FFFFFF'
  foreground: '#0F0F0F'
  muted: '#F6F6F7'
  muted-foreground: '#6B7280'
  border: '#EAEAEA'
  input: '#EAEAEA'
  ring: '#0F0F0F'
  primary: '#0F0F0F'
  primary-foreground: '#FFFFFF'
  accent: 'hsl(var(--theme-tint-hue) 58% 42%)'
  accent-foreground: '#111827'
  link: '#2563EB'
  sidebar: '#F8F8F9'
  sidebar-foreground: '#0F0F0F'
  status-bar: '#FAFAFA'
  success: '#10B981'
  destructive: '#EF4444'
typography:
  sans:
    fontFamily: 'Inter, SF Pro Text, system-ui, -apple-system, sans-serif'
    fontSize: 14px
    lineHeight: 1.6
    letterSpacing: 0em
  sans-sm:
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif'
    fontSize: 13px
    lineHeight: 1.5
  mono:
    fontFamily: 'JetBrains Mono, SF Mono, ui-monospace, monospace'
    fontSize: 13px
    lineHeight: 1.6
  display:
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif'
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.015em
  brand:
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif'
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.02em
  heading-1:
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif'
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  heading-2:
    fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif'
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  sidebar-width: 260px
  editor-max-width: 760px
  settings-max-width: 640px
  welcome-max-width: 420px
  header-height: 40px
  status-height: 24px
  gap: 16px
components:
  sidebar:
    background: '{colors.sidebar}'
    foreground: '{colors.sidebar-foreground}'
    border: '{colors.border}'
  sidebar-active:
    background: '{colors.accent}'
    foreground: '{colors.foreground}'
    radius: '{rounded.md}'
  tab-bar:
    background: '{colors.background}'
    border: '{colors.border}'
    height: '{spacing.header-height}'
  editor-surface:
    background: '{colors.background}'
    max-width: '{spacing.editor-max-width}'
  status-bar:
    background: '{colors.status-bar}'
    foreground: '{colors.muted-foreground}'
    height: '{spacing.status-height}'
  command-palette:
    background: '{colors.background}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
  welcome-gate:
    max-width: '{spacing.welcome-max-width}'
    drop-radius: '{rounded.xl}'
  settings-view:
    max-width: '{spacing.settings-max-width}'
---

## Brand & Style

snipnote is the editor you keep meaning to build — lightweight, local, and calm beside the terminal. Theme still references **https://localeditor.app**: minimal chrome, content-first, no IDE heaviness, no cloud. Brand posture is *local-first quiet confidence*: files live where they already are (plain `.md` on disk), the UI stays out of the way, and every surface earns its place.

Base chrome stays monochrome (white editor, faint sidebar gray, hairline borders, black primary). Users can dial a **tint hue + intensity** in Settings so accent surfaces pick up a soft chromatic wash without breaking the calm posture. Link blue remains the default semantic link color.

**Window material (platform-split, EffectsBuilder only — no `window-vibrancy` crate):**

| Platform | Native material | Window chrome | Notes |
|---|---|---|---|
| **macOS** | `Effect::Sidebar` + `EffectState::Active` + `radius(12.0)` | `TitleBarStyle::Overlay`, empty window title, traffic lights float over custom TabBar | `transparent:true` + `macOSPrivateApi` + `macos-private-api` feature |
| **Windows 11** | `Effect::Mica` + `EffectState::Active` (no radius) | **Native decorations** + title `"snipnote"`; caption buttons live in the system title bar | `transparent:true`; `set_effects` fails soft on Win10 / unsupported |
| **Linux / fallback** | (ignored) | Native decorations + title | Opaque CSS fills |

HTML `html, body, #root` stay transparent so native material shows through translucent surfaces. Window default `1280×720`, min `1100×600`.

## Colors

Palette is **monochrome base + user tint + semantic link/destructive/success**. On vibrant/Mica windows, shell fills use translucent `rgba` / `color-mix` so material shows through; opaque hexes remain the Reduce Transparency / unsupported fallback.

- **Background / Foreground** — Editor canvas. Opaque white (light) / `#141416` (dark) when Reduce Transparency is on or material unavailable; translucent variants over Sidebar/Mica otherwise. Foreground stays high-contrast.
- **Sidebar / Border / Muted** — Same translucency rule as background. Hairlines stay visible over blur at ~0.85 alpha.
- **Primary** — Opaque always. Near-black (light) / near-white (dark). Vibrancy never tints the CTA.
- **Accent** — Derived from `--theme-tint-hue` / `--theme-tint-amount` (Settings Hue + Intensity). Used for active tree rows, welcome drop highlight, segmented accents. Default hue ~220°.
- **Link (`#2563EB` light / `#60A5FA` dark)** — Opaque semantic link color in content.
- **Destructive / Success** — Opaque. Banners and save/update status only.

**Dark theme:** `[data-theme="dark"]` overrides (`bg #141416` / `fg #EDEEF0`, sidebar `#1A1A1E`, border `#2A2A2E`, muted-fg `#9AA0A8`). `System` follows `prefers-color-scheme` via `useThemeStore` + `localStorage snipnote-theme`. Tint hue/amount persist separately (`snipnote-theme-tint-hue` / amount).

**Reduce Transparency:** Settings forces `bgOpacity` to 100 — shell surfaces go opaque while theme/tint tokens remain.

Avoid: saturated full-bleed navs, gradient hero chrome, IDE purple glow stacks, making the editor canvas too transparent for AA text.

## Typography

Single sans ramp for UI and content (LocalEditor discipline).

- **Brand (`~34–40px / 600`)** — WelcomeGate product name only. Hero-level brand signal on first launch.
- **Display (`18px / 600`)** — Settings title and sparse empty-state headlines.
- **Sans (`14px / 1.6`)** — File tree chrome, Tab Bar, body, lists, tables.
- **Sans-sm (`13px / 1.5`)** — Sidebar names, Status Bar, settings descriptions, welcome supporting copy.
- **Mono (`13px / 1.6`)** — Code blocks, inline code, shortcut chips (`⌘O` / `Ctrl+O` via `modShortcut`).

Line length: editor content `760px` max centered; Settings content `640px` max; WelcomeGate column `420px` max.

## Layout & Spacing

Spacing scale is 4-based: 4, 8, 12, 16, 20, 24, 32.

Single-window desktop layout:

- **Welcome mode** — No sidebar. Minimal TabBar (drag region + settings affordance) + full-bleed WelcomeGate.
- **Vault open** — Optional Sidebar `260px` (collapsible via `{mod}B` / TabBar toggle) → Main column: Tab Bar `40px` → Editor/Home/Settings → Status Bar `24px`.
- **Right Panel** — Built but hidden in current build (`App.tsx` commented) for later.
- **Window** — Size/position + vault + open tabs restore across relaunch.

## Elevation & Depth

Almost flat, with a **native material** layer underneath. No card shadows in the main surface.

- **Material (-1):** OS vibrancy/Mica (see Brand & Style table). CSS does not fake blur with `backdrop-filter` on the shell.
- **Flat (0):** Editor, Sidebar, Tab Bar, Status Bar, Welcome drop zone — borders + translucent fills.
- **Raised (1):** Command palette — opaque sheet + soft shadow above material. Settings is **not** a raised modal; it is an in-canvas tab.
- **Banner (inline):** File-changed banner docks under Tab Bar.

## Shapes

- `rounded/sm` (`6px`) — Search input, inline chips, banner.
- `rounded/md` (`8px`) — Active file row, buttons, segmented control.
- `rounded/lg` (`12px`) — Palette shell, settings section cards (`10px` shipped), icon wells.
- `rounded/xl` (`16px`) — WelcomeGate dashed drop zone (`rounded-2xl`).
- `rounded/full` — Tint preview swatch only.

## Components

- **WelcomeGate** — Brand-first first viewport: `snipnote` wordmark, one supporting line (“Your notes live in a folder on disk.”), dashed drop zone (“Drop a folder here” / “Choose Folder”), platform shortcut chip (`modShortcut("O")`). Atmosphere gradient breathes quietly behind content. Drag-active state scales drop zone slightly and accents the border.
- **Sidebar** — Translucent column, Search → File Tree → Library footer. Hidden in welcome mode; collapsible when vault open.
- **File Tree Row** — SVG folder/file icons, dirs-first alpha, active row uses tinted accent translucent.
- **Search / Command Palette** — `modShortcut("P")`. Palette stays opaque above vibrancy.
- **Tab Bar** — Multi-tab chrome + back/forward + new note + settings. On macOS, left inset respects Overlay traffic lights; on Windows, no client-area caption padding (system title bar owns min/max/close). `welcomeMode` strips tabs/new-note.
- **Editor Surface** — Centered `760px`, TipTap WYSIWYG, FindBar, spellcheck attribute from Settings.
- **HomeView** — Vault overview / note list when no note tab is focused; search field with platform shortcut hint.
- **SettingsView** — Editor **tab** (not modal). Sections: Appearance (Theme, Hue, Intensity, Reduce Transparency), Writing (Spellcheck), System (Launch at Login, Check for Updates), Logs. Max width `640px`.
- **Status Bar** — Quiet `words · chars · paragraphs`.
- **Banner (File Changed)** — Inline under Tab Bar: Reload / Keep mine.
- **Button (primary)** — Black/white flip by theme; used for Choose Folder and decisive actions.
- **Window Chrome** — Platform-split (Overlay vs native decorations). Shortcut labels always via `{modShortcut}` / `modKeyLabel`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep calm monochrome base; tint is a dial, not a brand takeover | Flood chrome with saturated gradients or multi-accent rainbows |
| Split window chrome by OS (Overlay mac / native Win) | Fake Windows caption buttons inside the TabBar |
| Show `⌘` on Mac and `Ctrl+` elsewhere via `modShortcut` | Hard-code `⌘` in tooltips or welcome copy |
| Treat WelcomeGate as brand-first first viewport | Dashboards, stats, or secondary marketing on first launch |
| Keep Settings as an in-canvas tab | Modal Settings overlay that blocks the editor metaphor |
| Keep command palette opaque above material | Translucent palette that fights wallpaper noise |
| Preserve raw Markdown fidelity on disk | Inject HTML chrome into saved Markdown Source |
