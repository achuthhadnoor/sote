# sote

A fast local Markdown file editor for macOS and Windows (Tauri + React).

Open a folder, edit `.md` files in a WYSIWYG editor, and keep disk as the source of truth — autosave, tabs, command palette, and live reload when files change outside the app.

## Features

- Local-first Markdown editing with disk as source of truth (autosave, tabs, command palette, live reload)
- Platform-native window chrome (macOS Overlay + Sidebar vibrancy; Windows undecorated + Mica)
- **Narrow / compact window**
  - Windows can shrink to a **400×600** floor; wide tables scroll horizontally instead of forcing a wide layout
  - At **≤720px** width: overlay sidebar, tabs on a second row, outline docked above the status area, status bar hidden
  - One-click toggle resizes to a compact **420×700** note window (and restores the previous size)
  - Optional menu-bar / tray icon and (macOS) Dock hide while compact, with Settings controls for those prefs
- **Inactive-window hover (macOS)** — CSS `:hover` and first-click work while another app is frontmost (`accept_first_mouse` + WKWebView tracking + scoped `isKeyWindow` spoof); floating hover scrollbars in the editor

## Develop

```bash
yarn install
yarn tauri dev
```

Run on the OS you are targeting (macOS or Windows). Window chrome differs by platform: Overlay title bar + Sidebar vibrancy on macOS; native decorations + Mica on Windows 11.

## Build

```bash
yarn tauri build
```

Artifacts land under `src-tauri/target/release/bundle/`:

| Platform | Typical outputs |
|----------|-----------------|
| macOS | `macos/sote.app`, `dmg/*.dmg`, updater `.app.tar.gz` + `.sig` |
| Windows | `nsis/*.exe`, `msi/*.msi`, updater `.nsis.zip` / `.msi.zip` + `.sig` |

Updater signing keys (`TAURI_SIGNING_PRIVATE_KEY`) are required for `.sig` / `latest.json` artifacts.

## Release

See [RELEASE.md](./RELEASE.md) for version bumps, updater keys, Apple signing/notarization, Windows notes, and GitHub Releases.

## Stack

- Tauri 2 + Rust (file I/O, folder scan, watcher)
- React 19 + Vite + Tailwind CSS v4
- TipTap (Markdown round-trip)
