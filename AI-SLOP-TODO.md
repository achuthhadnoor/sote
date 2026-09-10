# AI slop cleanup todo

Audit by [AI slop code audit](ea5a11d6-9284-4246-abb3-5aaf8bb1cb77) (2026-09-10).

## High

- [x] **`macos_hover` swizzle** — Restored pointer-scoped `NSWindow isKeyWindow` IMP replace (forwards other windows to the original; no `object_setClass`). `object_setClass` / private-selector exchange both crash AppKit. Tracking + `acceptsMouseMovedEvents` + `accept_first_mouse` kept.
- [x] **`website/`** — Kept source; root `.gitignore` now ignores only `website/node_modules`, `.next`, `out`, `.vercel` (no longer blanket `/website/*`). Brand/CTA cleanup deferred.

## Medium

- [x] **Right panel mocks** — Deleted `src/components/rightPanel/**` and removed the stale App.tsx comment; nothing imported it.
- [x] **Path helpers** — Canonical `utils/paths.ts` (+ `lib/path` re-export); `pathBasename` / `nextUntitledNotePath` fix App/EditorSurface/tabs/context-menu.
- [x] **`haptic_feedback`** — Removed dead `invoke("haptic_feedback")` and callers from `App.tsx`.
- [x] **Window drag duplication** — Shared TabBar / Sidebar drag + double-click maximize via `windowChromeDrag.ts`.
- [x] **EditorSurface `setContent`** — Local `setEditorMarkdown` helper for note load and raw→rich sync.

## Low

- [x] **`macos_hover` tracking OnceLock** — Replaced with `AtomicUsize` view identity; debug-log failed main-thread hops.
- [x] **Settings footer** — Version line instead of marketing tagline; brief autostart failure status.
- [x] **`isHostAbsolutePath`** — Real absolute-path rules (Unix `/`, Windows drive, UNC) via `isAbsoluteFsPath`.

## Out of scope / already clean

- Custom TTS store / `tts.ts` — removed; rely on native WebKit Speech menu.
- Platform window chrome (Overlay/Sidebar vs Mica) — matches AGENTS.md; do not “simplify” into combined effects.
