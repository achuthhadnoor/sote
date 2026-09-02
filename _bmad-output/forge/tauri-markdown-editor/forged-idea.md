# Idea: Full-Size Markdown Editor for Claude Code

## The Grand Vision
The markdown companion for Claude Code terminal lovers — a full-size, fast Tauri editor that treats raw Markdown as the shared database between human and agent. Humans edit in rich WYSIWYG; Claude reads/writes the same raw files. Build in public, shipping one feature at a time.

## Locked Decisions
- **Target:** Claude Code customers who love terminal. Positioned vs Cursor 3.0 (large IDE bundle) and vs Mote (floating native, macOS-only). This is full-size, cross-platform companion, not a floating panel and not an IDE replacement.
- **Strategy:** Build in public, incremental. Ship v1 simple, charge early, add features sequentially based on revenue/feedback.
- **v1 (First Dollar):** Full-size Markdown note editor. Tauri v2 + Tiptap (WYSIWYG, Mermaid, todos, inline images). File-watcher with conflict-aware reload. No canvas, no embedded terminal in v1.
- **v2+ Roadmap (in order):** 1) Obsidian vault compatibility (folder + frontmatter), 2) Canvas (Excalidraw, separate JSON files, Note/Canvas toggle), 3) Embedded Terminal (xterm.js + Rust PTY for running Claude inside app), 4) Floating notes (separate Tauri window).
- **Stack:** Tauri v2 (cross-platform Win/Mac/Linux, web-ecosystem). Tiptap for editor. Excalidraw for canvas (v2).
- **Data Model (The Crux):** Source of truth on disk is **raw Markdown**. App parses to Tiptap rich model and serializes back on save. AI agents read/write raw Markdown directly.
- **Canvas Storage (v2):** Canvas JSON in separate files, keeping Markdown pure. UI toggle, not inline embedding.
- **Windowing:** Full-size window is primary. Floating window is deferred to later increment.

## Rejected Options
- **Pure Native Swift/GPUI:** Rejected. Mote proves native is faster (<150MB), but Tauri chosen for cross-platform reach and web-ecosystem speed to market. Accepted trade-off.
- **Monaco/CodeMirror as primary:** Rejected. Prioritizes WYSIWYG/Mermaid over code-editor features for v1.
- **Floating-only as v1:** Rejected. Direct head-on vs Mote (native, shipped, $19). Full-size avoids direct floating competition, though it enters crowded full-size market (Obsidian, Typora).
- **Big-bang Unified Workspace (Note+Canvas+Terminal Day 1):** Rejected. Too much scope for first dollar; replaced with incremental build-in-public.

## Surviving Risks
- **Serialization Fidelity:** Tiptap JSON/HTML -> Markdown must be lossless or agent DB corrupts. Requires strict schema and round-trip tests from Day 1.
- **v1 Differentiation:** Generic "simple markdown editor" has no wedge vs Obsidian (free). v1 must nail Claude-specific sync (file-watcher, no corruption when Claude writes mid-edit) to justify $19.
- **Full-Size Competition:** More crowded than floating (Obsidian, Typora, Bear). Must win on Claude-native workflow, not design alone.
- **Scope Creep to Canvas/Terminal:** Each increment adds major complexity (multi-window sync, PTY backend). Requires architecture that doesn't require rewrite of editor core.
