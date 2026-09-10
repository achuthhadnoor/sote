# AI slop cleanup todo

Audit by [AI slop code audit](ea5a11d6-9284-4246-abb3-5aaf8bb1cb77) (2026-09-10).

## High

- [x] **`macos_hover` swizzle** — Removed all `isKeyWindow` spoofing (`object_setClass` and process-wide IMP replace both crash). Kept WKWebView `ActiveAlways` tracking + `acceptsMouseMovedEvents`; `accept_first_mouse` remains in `lib.rs`. Inactive `:hover` may be incomplete until a non-crashing approach exists.
- [x] **`website/`** — Kept source; root `.gitignore` now ignores only `website/node_modules`, `.next`, `out`, `.vercel` (no longer blanket `/website/*`). Brand/CTA cleanup deferred.

## Medium

- [x] **Right panel mocks** — Deleted `src/components/rightPanel/**` and removed the stale App.tsx comment; nothing imported it.
- [x] **Path helpers** — Canonical `utils/paths.ts` (+ `lib/path` re-export); `pathBasename` / `nextUntitledNotePath` fix App/EditorSurface/tabs/context-menu.
- [x] **`haptic_feedback`** — Remove the dead `invoke("haptic_feedback")` in `App.tsx` or implement the Rust command; drop double empty catch.
- [x] **Window drag duplication** — Share TabBar / Sidebar drag + double-click maximize handlers.
- [x] **EditorSurface `setContent`** — One markdown→editor helper; reduce empty `catch {}` / `as any` where cheap.

## Low

- [x] **`macos_hover` tracking OnceLock** — Replaced with `AtomicUsize` view identity; debug-log failed main-thread hops.
- [x] **Settings footer** — Trim “local-first markdown notes” fluff; surface autostart failures instead of silent `catch {}`.
- [x] **`isHostAbsolutePath`** — Drop brittle `/Users/`/`/home/` prefix allowlist; use real absolute-path rules.

## Out of scope / already clean

- Custom TTS store / `tts.ts` — removed; rely on native WebKit Speech menu.
- Platform window chrome (Overlay/Sidebar vs Mica) — matches AGENTS.md; do not “simplify” into combined effects.
