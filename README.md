# snipnote

A fast local Markdown file editor for macOS (Tauri + React).

Open a folder as a vault, edit `.md` files in a WYSIWYG editor, and keep disk as the source of truth — autosave, tabs, ⌘P, and live reload when files change outside the app.

## Develop

```bash
yarn install
yarn tauri dev
```

## Build

```bash
yarn tauri build
```

## Stack

- Tauri 2 + Rust (file I/O, vault scan, watcher)
- React 19 + Vite + Tailwind CSS v4
- Tiptap (Markdown round-trip)

