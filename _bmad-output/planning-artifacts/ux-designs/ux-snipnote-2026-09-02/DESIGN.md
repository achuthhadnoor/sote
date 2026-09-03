---
title: snipnote DESIGN
status: draft
created: 2026-09-02
updated: 2026-09-03
sources:
  - _bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md
  - _bmad-output/forge/tauri-markdown-editor/forged-idea.md
  - https://localeditor.app
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
  accent: '#F3F4F6'
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
  full: 9999px
spacing:
  sidebar-width: 260px
  editor-max-width: 760px
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
---

## Brand & Style

snipnote is the editor you keep meaning to build — lightweight, local, and calm beside the terminal. Theme directly references **https://localeditor.app** at user request: minimal chrome, content-first, no IDE heaviness, no cloud. The brand posture is *local-first quiet confidence*: files live where they already are (plain `.md` on disk), the UI stays out of the way, and every surface earns its place. If LocalEditor's tagline is "Not every file needs an IDE," snipnote's echo is "Not every Markdown file needs Obsidian — especially the ones Claude just wrote."

snipnote inherits the LocalEditor aesthetic wholesale: white editor, faint `sidebar` gray (`#F8F8F9`), hairline `border` (`#EAEAEA`), neutral typography, and black `primary` for the single decisive action per surface. This DESIGN.md specifies only the brand-layer deltas needed for a Tauri/desktop reading surface; all unlisted components inherit the minimal defaults. Theme is now light/dark/system via `data-theme` (dark `bg #141416` / `fg #EDEEF0`, see §Colors) with vibrant translucency kept.

**Window material:** The Tauri window itself is native-vibrant: **macOS `Sidebar` vibrancy** via `tauri::window::Effect::Sidebar` and **Windows 11 `Mica`** via `Effect::Mica`, both applied through **`EffectsBuilder::new().effects([Effect::Sidebar, Effect::Mica])`** (platform ignores the irrelevant effect). The window is `transparent:true` + `macOSPrivateApi:true` + `tauri` feature `macos-private-api`; HTML `html, body` is `transparent` so the native material shows through translucent surface fills. On platforms without effects (Linux, older Windows) the same tokens fall back to opaque fills. No `window-vibrancy` crate is added — EffectsBuilder is the single implementation path per user request. Window `1280×720` `min 1100×600` `Overlay` titleBarStyle, `border-radius 12`.

## Colors

Palette is **monochrome + one semantic link blue**, lifted from LocalEditor.app screenshots (white canvas, #F8F8F9 sidebar, #EAEAEA hairlines, black primary, muted #6B7280 secondary text). On vibrant/Mica windows the fills become translucent so the native material shows through; opaque hexes remain the fallback.

- **Background (`#FFFFFF` → `rgba(255,255,255,0.78)` on vibrancy)** / Foreground (`#0F0F0F`) — Editor canvas. Opaque white on fallback/Linux; `rgba(255,255,255,0.78)` on macOS `Sidebar` + Windows `Mica` so wallpaper/material tints the canvas without washing text. Foreground stays `#0F0F0F` for AA contrast against the translucent white.
- **Sidebar (`#F8F8F9` → `rgba(248,248,249,0.68)` on vibrancy)** / Sidebar Foreground (`#0F0F0F`) — Sidebar sits in this token, separated by a 1px `border`. Translucent on vibrancy lets the `Sidebar` material (macOS) / `Mica` (Windows) read as a slightly darker column, matching Finder/Explorer. Fallback is solid `#F8F8F9`.
- **Muted (`#F6F6F7` → `rgba(246,246,247,0.72)`) / Muted Foreground (`#6B7280`)** — File tree secondary text, Status Bar, inactive states, Library footer. Translucent on vibrancy to avoid an opaque band over the material.
- **Border / Input (`#EAEAEA` → `rgba(234,234,234,0.85)` on vibrancy)** — Hairline separators: Sidebar–Editor split, Tab Bar bottom, Status Bar top, command palette outline. On vibrancy the border stays hairline but at `0.85` alpha so it does not look like a solid stroke over blur.
- **Primary (`#0F0F0F`) / Primary Foreground (`#FFFFFF`)** — Opaque always. Vibrancy never tints the CTA — near-black stays decisive.
- **Accent (`#F3F4F6` → `rgba(243,244,246,0.76)`) / Accent Foreground (`#111827`)** — Active File Highlight in File Tree and hover row. Translucent accent lets material show while still marking selection.
- **Link (`#2563EB`)** — Opaque always. The only chromatic token. Inline markdown links. All other chrome is achromatic.
- **Destructive (`#EF4444`) / Success (`#10B981`)** — Opaque always. Banner errors and silent-save confirmations only. Never for chrome.

Translucency rule: any surface whose CSS is directly over the vibrancy (`sidebar`, `main-container`, `tab-bar`, `status-bar`) uses the `rgba` variant when `@supports (backdrop-filter: blur(1px))` or when `window.set_effects` is active; fallback `@supports not` uses the solid hex. Text tokens never go translucent.

**Dark theme (2026-09-03):** `src/App.css:43` `[data-theme="dark"]` overrides: `bg #141416`/`fg #EDEEF0`, `sidebar #1A1A1E`/`sidebar-fg #EDEEF0`, `border #2A2A2E`, `muted #1E1E22`/`muted-fg #9AA0A8`, `accent #26262A`, `link #60A5FA`, `primary #EDEEF0` on `primary-fg #0F0F0F`, translucent dark `bg 0.72`/`sidebar 0.68`/`border 0.90` kept over `Sidebar`/`Mica` dark material; AA contrast maintained. `System` follows `prefers-color-scheme` via `src/stores/useThemeStore.ts:1` + `localStorage snipnote-theme`.

Avoid: saturated accent navs, gradient surfaces, colored sidebars, more than one chromatic token (link blue only light → `#60A5FA` dark), Mote-style dark `#0a0a0a` + orange — snipnote stays monochrome in both themes. Also avoid making the editor canvas too transparent (`<0.68`) — text contrast must stay AA in both.

## Typography

LocalEditor uses a single sans ramp for UI and content — headings, body, properties panel all share the same family. snipnote follows.

- **Sans (`Inter / SF Pro Text, 14px / 1.6`)** — File Tree, Search, Tab Bar, body text, lists, tables. Content headings scale via `heading-1` (24px/700) and `heading-2` (18px/600) but stay in the same family — no serif display moment. The quiet hierarchy matches LocalEditor's Pokedex.md example where `# Pokedex` and `## Catch log` are bolder/larger but not a different font.
- **Sans-sm (`13px / 1.5`)** — Sidebar file names, Status Bar (`174 words | 1,209 chars`), Library footer, banner copy.
- **Mono (`JetBrains Mono / SF Mono, 13px / 1.6`)** — Code blocks, inline code, `.env`/`YAML` property values, `⌘P` kbd hints. LocalEditor shows `package.json` rendered as a formatted property table but preserves mono for values.
- **Display (`18px / 600`)** — Empty-state headline ("No vault open") and first-launch welcome. Spare, not decorative.

Line length: Editor content constrained to `editor-max-width` (`760px`) centered, for optimal reading — same as LocalEditor's centered markdown page.

## Layout & Spacing

Spacing scale is 4-based: 4, 8, 12, 16, 20, 24, 32. Content width `760px` max — snipnote is a reading/writing surface, not a wide table.

Single-window, three-pane-ready but currently two-pane + two-bar layout (Right Panel hidden) matching PRD §6 IA:

- **Sidebar** — Fixed `260px` [ASSUMPTION: fixed for v1, resizable 220–320 in v2], full-height left. Stack: Search (40px header) → File Tree (flex, scroll, SVG folder/file icons, dot-folders shown if contain md, empty hidden) → Library footer (40px, folder SVG + `Switch/Open…` + gear Settings `⌘,`). Hairline `border-translucent` right edge.
- **Main** — Flex column `flex:1`. Top: Tab Bar (`header-height` 40px, `4px` nav `←→` + scrollable multi-tab row + `+`; each tab `28px` `max 180px` `ellipsis`, `is-active` white/shadow, draft italic + hollow dot / `draft` label, dirty `•`, `×` close). Middle: Editor (scroll, centered `760px` content with 24px gutters). Bottom: Status Bar (`status-height` 24px, right-aligned `words | chars | paragraphs`).
- **Right Panel** — `420px` (`320–560`) `Terminal`/`Browser`/`Canvas` — built (`src/components/rightPanel/*` + `src/App.css:136`) but hidden behind `App.tsx` comment for later, not rendered in current build.
- **Window** — Tauri native traffic lights `Overlay`, `1280×720` default `min 1100×600` per `src-tauri/tauri.conf.json:15` (was `800×600` to fit 3-pane), `border-radius 12` over vibrant, persists size/position + `openTabs`. [ASSUMPTION: v1 fixed layout, not responsive web breakpoints — desktop only.]

Sidebar nav is always visible in v1 full-size window — no Sheet/collapse until Floating/Palette work in later increments. The discipline is LocalEditor's: one window, one sidebar, one editor.

## Elevation & Depth

Almost flat, like LocalEditor, now with a **material** layer underneath. No card shadows in the main surface — hierarchy is built from translucent fills + native vibrancy/Mica + hairline borders, not elevation.

- **Material (-1):** The OS-provided vibrancy/Mica itself. Applied at window level via `EffectsBuilder` (`Effect::Sidebar` on macOS, `Effect::Mica` on Windows 11, `EffectState::Active`, `radius: 12.0` on macOS). Window is `transparent:true` so CSS translucency reveals this layer. Not a CSS shadow — it is the native blur + wallpaper tint + noise that gives depth without shadow cost.
- **Flat (0):** Editor, Sidebar, File Tree rows, Tab Bar, Status Bar — flat with borders, but fills are now `rgba(..., 0.68–0.78)` over the material so separation is felt as material variation, not just color step. On fallback (no material) they render as solid hexes — visually identical to pre-vibrant spec.
- **Raised (1):** Command palette (`⌘P` / `⌘K` in later increments) — `white` + `12px` radius + `0 8px 32px rgba(0,0,0,0.08)` + `0 1px 2px rgba(0,0,0,0.06)`. The only elevated surface. On vibrancy builds it stays opaque `white` (not translucent) so it reads as a sheet above the material. Matches LocalEditor's `Jump to anything…` palette.
- **Banner (inline):** File-changed banner docks under Tab Bar, not as toast — `border` + `muted` background (`rgba(246,246,247,0.72)` on vibrancy, solid fallback), no shadow.

## Shapes

Subtly rounded, not pill-driven — LocalEditor's controls are softly rectangular.

- `rounded/sm` (`6px`) — Search input, inline code, Library sort button, banner.
- `rounded/md` (`8px`) — Active File Highlight row, command palette result row, new-note button.
- `rounded/lg` (`12px`) — Command palette shell and any dialog (e.g., Open Vault picker).
- `rounded/full` — Only for word-count dots or status pills if added later; not used in v1.

## Components

v1 uses a minimal component set — no design system inheritance beyond these. LocalEditor's component language is the reference: plain lists, subtle highlights, one black primary action.

- **Sidebar** — `rgba(248,248,249,0.68)` on vibrancy (fallback `{colors.sidebar}` `#F8F8F9`) `dark rgba(26,26,30,0.68)`. Full-height, `260px`. No shadow, 1px `border-translucent` right. Active row = `rgba(243,244,246,0.76)` `dark rgba(38,38,42,0.78)` + `8px` radius. Hover = `rgba(237,238,240,0.72)` `dark rgba(42,42,46,0.6)`. The translucency lets `Effect::Sidebar` / `Effect::Mica` show through.
- **File Tree Row** — `13px sans-sm`, `6px` vertical padding, `8px` horizontal. Folder rows: `14px` chevron `rotate 90` when open + `16px` folder SVG (closed/open `fill 0.14` + stroke `1.5`) + name; file rows: `14px` indent spacer + `16px` file SVG (doc with fold, `0.10` fill, `1.5` stroke, md lines `1.2` / hollow when not md) + name; `FolderIcon`/`FileIcon` `muted-fg→fg` on hover/active, `FileIcon.is-md` `fg 0.9`. Active row uses `sidebar-active` translucent accent.
- **Search (⌘P)** — Sidebar-top input `rgba(246,246,247,0.72)` `dark rgba(30,30,34,0.72)` with `6px` radius, placeholder "Search notes… (⌘P)". Palette `command-palette` stays opaque `white` `dark #141416` (not translucent) above vibrancy, `12px` radius, max `520×400`.
- **Tab Bar** — `40px` high, `bg-translucent` + bottom `border-translucent`. Left: `26px` back/forward `←→` (`muted-fg`, hover `muted-translucent`). Center: scrollable `tabs-container` → `tabs-scroll` (`gap 6px`, `scrollbar hidden`, `padding 6px 2px`) with `tab-item` (`28px` `max 180px` `ellipsis`, `border transparent` → hover `hover-translucent`, `is-active` `bg`+`border`+`shadow`, `is-draft` title italic + `draft` label 10px italic / hollow dot `6px` border, dirty `• 6px` `primary`, `saving…` 10px). Right: `+` `26px` (`muted-fg` → hover `muted-translucent`). Now multi-tab, not single title.
- **Editor Surface** — `bg-translucent` (`white 0.78` / `dark 0.72`), centered `760px`, `24px` gutters. Surrounding `.app-shell` `transparent` + `border-radius 12`. Draft `isNew` tabs init empty (`body ""`, `frontmatter null`, `isDirty false`) without `read_file`; first `hasContent` (`body/frontmatter trimmed >0`) triggers `write_file` → `markTabSaved` + `loadVault`.
- **Status Bar** — `status-translucent` (`#FAFAFA 0.72` / dark `#18181B 0.72`) + top `border-translucent`, `24px`, right `11px` `muted-fg` `mono`.
- **Right Panel (hidden)** — `420px` (`320–560`) `sidebar-translucent` + left `border-translucent`, header `40px` with `Tabs` (`Terminal`/`Browser`/`Canvas` icons, `26px` `is-active` white/shadow) + collapse `→`; content `bg-translucent`; `TerminalPane` dark `#0F0F0F` (`$` green), `BrowserPane` URL bar + `iframe`, `CanvasPane` toolbar + dotted grid `canvas` — all built but not rendered (`App.tsx` commented) for later.
- **Settings Dialog** — Overlay `rgba(0,0,0,0.32)` `blur 8px` `z 10000` + `settings-dialog` `560px` `12px` radius `shadow 0 20px 50px`, header `Settings` + `×`, body `Appearance` (Light/Dark/System radios) + About, footer `Done`; `settings-option` `is-active` `accent` + radio `fg` dot; opened via `⌘,`/`Ctrl+,` or gear, `Esc` closes.
- **Banner (File Changed)** — `muted-translucent` + `border-translucent`, `12px` `8px`, `6px`, `13px` + "Reload"/"Keep mine".
- **Button (primary)** — `{colors.primary}` `primary-fg` `8px` `14px 500` `32px`; respects `[data-theme="dark"]` flip (`#EDEEF0` on `#0F0F0F`).
- **Window Chrome** — Native traffic lights / Win32 caption over vibrant, `radius 12` via `EffectsBuilder::radius(12)` on macOS.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the monochrome discipline — white editor, `#F8F8F9` sidebar, `#EAEAEA` hairlines, one link blue | Introduce saturated sidebar/nav colors, gradients, or Mote-style dark+orange |
| Use `{colors.accent}` only for Active File Highlight / hover row | Use accent for buttons, banners, or status — primary is black |
| Single sans family for UI + content (LocalEditor does this) | Add serif display or second font for "personality" |
| Center editor content at `760px` with gutters | Full-bleed edge-to-edge text (reading fatigue) |
| `6 / 8 / 12px` radii, flat + borders, one elevated palette | Heavy shadows, cards everywhere, elevated File Tree |
| Search as `⌘P` palette (LocalEditor's `⌘K` pattern) | Two separate search UIs (sidebar filter + palette) in v1 |
| Status Bar as quiet `11px` muted text, right-aligned | Status Bar with icons, colors, or left-aligned clutter |
| Preserve raw Markdown fidelity — no injected chrome in content | Style injected HTML classes that leak into Markdown Source |
