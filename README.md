# snipnote

A fast local Markdown file editor for macOS and Windows (Tauri + React).

Open a folder, edit `.md` files in a WYSIWYG editor, and keep disk as the source of truth — autosave, tabs, command palette, and live reload when files change outside the app.

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
| macOS | `macos/snipnote.app`, `dmg/*.dmg`, updater `.app.tar.gz` + `.sig` |
| Windows | `nsis/*.exe`, `msi/*.msi`, updater `.nsis.zip` / `.msi.zip` + `.sig` |

Updater signing keys (`TAURI_SIGNING_PRIVATE_KEY`) are required for `.sig` / `latest.json` artifacts.

## Release

See [RELEASE.md](./RELEASE.md) for version bumps, updater keys, Apple signing/notarization, Windows notes, and GitHub Releases.

## Stack

- Tauri 2 + Rust (file I/O, folder scan, watcher)
- React 19 + Vite + Tailwind CSS v4
- TipTap (Markdown round-trip)
