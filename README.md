# snipnote

A fast local Markdown file editor for macOS (Tauri + React).

Open a folder, edit `.md` files in a WYSIWYG editor, and keep disk as the source of truth — autosave, tabs, ⌘P, and live reload when files change outside the app.

## Develop

```bash
yarn install
yarn tauri dev
```

## Build

```bash
yarn tauri build
```

Artifacts land in `src-tauri/target/release/bundle/` (`.app`, `.dmg`, and updater `.tar.gz` + `.sig` when signing keys are set).

## Release

See [RELEASE.md](./RELEASE.md) for version bumps, updater keys, Apple signing/notarization, and GitHub Releases.

## Stack

- Tauri 2 + Rust (file I/O, folder scan, watcher)
- React 19 + Vite + Tailwind CSS v4
- TipTap (Markdown round-trip)
