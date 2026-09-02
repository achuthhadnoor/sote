---
title: snipnote DESIGN
status: draft
created: 2026-09-02
updated: 2026-09-02
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

snipnote inherits the LocalEditor aesthetic wholesale: white editor, faint `sidebar` gray (`#F8F8F9`), hairline `border` (`#EAEAEA`), neutral typography, and black `primary` for the single decisive action per surface. This DESIGN.md specifies only the brand-layer deltas needed for a Tauri/desktop reading surface; all unlisted components inherit the minimal defaults. [ASSUMPTION: Light-first for v1; dark mode deferred but tokens are ready to invert `background`/`foreground`/`sidebar`.]

## Colors

Palette is **monochrome + one semantic link blue**, lifted from LocalEditor.app screenshots (white canvas, #F8F8F9 sidebar, #EAEAEA hairlines, black primary, muted #6B7280 secondary text).

- **Background (`#FFFFFF`) / Foreground (`#0F0F0F`)** — Editor canvas. Maximum contrast, no tint. LocalEditor renders markdown like a real page on white; snipnote does the same.
- **Sidebar (`#F8F8F9`) / Sidebar Foreground (`#0F0F0F`)** — The LocalEditor Projects pane is a touch darker than the editor, not a strong contrast. Sidebar sits in this token, separated by a 1px `border`.
- **Muted (`#F6F6F7`) / Muted Foreground (`#6B7280`)** — File tree secondary text, Status Bar, inactive states, Library footer. LocalEditor's file list uses this exact quiet gray.
- **Border / Input (`#EAEAEA`)** — Hairline separators: Sidebar–Editor split, Tab Bar bottom, Status Bar top, command palette outline. LocalEditor's divider is this faint.
- **Primary (`#0F0F0F`) / Primary Foreground (`#FFFFFF`)** — The single decisive action per surface (Open Vault, Create Note). Not a brand color — it's near-black for contrast, as LocalEditor's CTA is black.
- **Accent (`#F3F4F6`) / Accent Foreground (`#111827`)** — Active File Highlight in File Tree and hover row. LocalEditor highlights the selected file with this light gray, not a saturated accent.
- **Link (`#2563EB`)** — The only chromatic token. Inline markdown links. All other chrome is achromatic.
- **Destructive (`#EF4444`) / Success (`#10B981`)** — Banner errors and silent-save confirmations only. Never for chrome.

Avoid: saturated accent navs, gradient surfaces, colored sidebars, more than one chromatic token (link blue only), Mote-style dark `#0a0a0a` + orange — snipnote is light-first like LocalEditor.

## Typography

LocalEditor uses a single sans ramp for UI and content — headings, body, properties panel all share the same family. snipnote follows.

- **Sans (`Inter / SF Pro Text, 14px / 1.6`)** — File Tree, Search, Tab Bar, body text, lists, tables. Content headings scale via `heading-1` (24px/700) and `heading-2` (18px/600) but stay in the same family — no serif display moment. The quiet hierarchy matches LocalEditor's Pokedex.md example where `# Pokedex` and `## Catch log` are bolder/larger but not a different font.
- **Sans-sm (`13px / 1.5`)** — Sidebar file names, Status Bar (`174 words | 1,209 chars`), Library footer, banner copy.
- **Mono (`JetBrains Mono / SF Mono, 13px / 1.6`)** — Code blocks, inline code, `.env`/`YAML` property values, `⌘P` kbd hints. LocalEditor shows `package.json` rendered as a formatted property table but preserves mono for values.
- **Display (`18px / 600`)** — Empty-state headline ("No vault open") and first-launch welcome. Spare, not decorative.

Line length: Editor content constrained to `editor-max-width` (`760px`) centered, for optimal reading — same as LocalEditor's centered markdown page.

## Layout & Spacing

Spacing scale is 4-based: 4, 8, 12, 16, 20, 24, 32. Content width `760px` max — snipnote is a reading/writing surface, not a wide table.

Single-window, two-pane + two-bar layout matching the screenshot breakdown and PRD §6 IA:

- **Sidebar** — Fixed `260px` [ASSUMPTION: fixed for v1, resizable 220–320 in v2], full-height left. Stack: Search (40px header) → File Tree (flex, scroll) → Library footer (40px). Hairline `border` right edge.
- **Main** — Flex column. Top: Tab Bar (`header-height` 40px, arrows + active Note name + `+`). Middle: Editor (scroll, centered `760px` content with 24px gutters). Bottom: Status Bar (`status-height` 24px, right-aligned `words | chars | paragraphs`).
- **Window** — Tauri native traffic lights, min `800×600` per `src-tauri/tauri.conf.json:15`, persists size/position. [ASSUMPTION: v1 fixed layout, not responsive web breakpoints — desktop only.]

Sidebar nav is always visible in v1 full-size window — no Sheet/collapse until Floating/Palette work in later increments. The discipline is LocalEditor's: one window, one sidebar, one editor.

## Elevation & Depth

Almost flat, like LocalEditor. No card shadows in the main surface — the hierarchy is built from background contrast (white editor vs `#F8F8F9` sidebar) and hairline borders, not elevation.

- **Flat (0):** Editor, Sidebar, File Tree rows, Tab Bar, Status Bar — all flat with borders.
- **Raised (1):** Command palette (`⌘P` / `⌘K` in later increments) — `white` + `12px` radius + `0 8px 32px rgba(0,0,0,0.08)` + `0 1px 2px rgba(0,0,0,0.06)`. This is the only elevated surface in v1. Matches LocalEditor's `Jump to anything…` palette which floats above content.
- **Banner (inline):** File-changed banner docks under Tab Bar, not as toast — `border` + `muted` background, no shadow.

## Shapes

Subtly rounded, not pill-driven — LocalEditor's controls are softly rectangular.

- `rounded/sm` (`6px`) — Search input, inline code, Library sort button, banner.
- `rounded/md` (`8px`) — Active File Highlight row, command palette result row, new-note button.
- `rounded/lg` (`12px`) — Command palette shell and any dialog (e.g., Open Vault picker).
- `rounded/full` — Only for word-count dots or status pills if added later; not used in v1.

## Components

v1 uses a minimal component set — no design system inheritance beyond these. LocalEditor's component language is the reference: plain lists, subtle highlights, one black primary action.

- **Sidebar** — `{colors.sidebar}` fill. Full-height, `260px`. No shadow, 1px `border` right. Active row = `{colors.accent}` fill + `8px` radius, no left accent bar. Hover = slightly darker `#EDEEF0` [ASSUMPTION].
- **File Tree Row** — `13px sans-sm`, `6px` vertical padding, `8px` horizontal. Folder rows show chevron + name; file rows show `.md` file name only (no icons in v1 [ASSUMPTION]). Active row uses `sidebar-active` tokens.
- **Search (⌘P)** — Sidebar-top input + global palette. In Sidebar: `F6F6F7` input with `6px` radius, placeholder "Search notes…" + `⌘P` kbd hint in `muted-foreground` `11px` mono. When invoked via `⌘P`, same component floats as `command-palette` (elevated, `12px`, max 480×320) with fuzzy file-name results. [ASSUMPTION: palette is the `⌘P` surface, not in-place sidebar filtering.]
- **Tab Bar** — `40px` high, `white` + bottom `border`. Left: back/forward arrows (`16px` icon, `muted-foreground` inactive). Center: active Note name (`14px` sans, `600`). Right: `+` (16px, `muted-foreground`, hover `foreground`). Tabs: single active visible in v1; multi-tab row is a visual but only one active at a time per PRD FR-9. [ASSUMPTION]
- **Editor Surface** — `white`, centered `760px` content, `24px` gutters, `24px` top padding. Headings/bold/links/bullets render live per FR-6. Links use `{colors.link}` underline on hover only. Code blocks: `muted` background + `6px` radius + mono.
- **Status Bar** — `status-bar` tokens, `24px`, right-aligned `sans-sm` `11px` `muted-foreground`. Shows `words | chars | paragraphs` live. No interactive elements in v1.
- **Banner (File Changed)** — Inline under Tab Bar: `muted` background, `border`, `12px` horizontal padding, `8px` vertical, `6px` radius, `13px` text + two text buttons "Reload" (primary text = link) and "Keep mine" (muted). Dismissible. Non-blocking.
- **Button (primary)** — `{colors.primary}` fill, `{colors.primary-foreground}` text, `8px` radius, `14px` sans 500, `32px` height. Used for Open Vault / Create.

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
