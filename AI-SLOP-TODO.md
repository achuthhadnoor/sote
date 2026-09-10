# AI slop cleanup todo

Audit by [AI slop code audit](ea5a11d6-9284-4246-abb3-5aaf8bb1cb77) (2026-09-10).

## High

- [x] **`macos_hover` swizzle** — Dropped process-wide `NSWindow` IMP replace. WebKit still needs `isKeyWindow` spoofing; scoped to the main window via a dynamic subclass of that window’s current isa (KVO-safe). Tracking + `acceptsMouseMovedEvents` kept; `accept_first_mouse` already in `lib.rs`.
- [x] **`website/`** — Kept source; root `.gitignore` now ignores only `website/node_modules`, `.next`, `out`, `.vercel` (no longer blanket `/website/*`). Brand/CTA cleanup deferred.

## Medium

- [ ] **Right panel mocks** — Delete or quarantine `src/components/rightPanel/**` (still unused; AGENTS.md says intentionally not rendered). Clean the stale App comment.
- [ ] **Path helpers** — Consolidate `src/lib/path.ts` and `src/utils/paths.ts`. Replace `split("/")` / Untitled path builders so Windows `\` works (AGENTS.md).
- [ ] **`haptic_feedback`** — Remove the dead `invoke("haptic_feedback")` in `App.tsx` or implement the Rust command; drop double empty catch.
- [ ] **Window drag duplication** — Share TabBar / Sidebar drag + double-click maximize handlers.
- [ ] **EditorSurface `setContent`** — One markdown→editor helper; reduce empty `catch {}` / `as any` where cheap.

## Low

- [x] **`macos_hover` tracking OnceLock** — Replaced with `AtomicUsize` view identity; debug-log failed main-thread hops.
- [ ] **Settings footer** — Trim “local-first markdown notes” fluff; surface autostart failures instead of silent `catch {}`.
- [ ] **`isHostAbsolutePath`** — Drop brittle `/Users/`/`/home/` prefix allowlist; use real absolute-path rules.

## Out of scope / already clean

- Custom TTS store / `tts.ts` — removed; rely on native WebKit Speech menu.
- Platform window chrome (Overlay/Sidebar vs Mica) — matches AGENTS.md; do not “simplify” into combined effects.
