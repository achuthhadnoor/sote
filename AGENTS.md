<!-- bmad:context:start -->
# snipnote — Agent Context

Local-first Markdown editor (Tauri 2 + React 19 + TipTap). Disk is source of truth. Ships **macOS + Windows**.

## Commands

```bash
yarn install
yarn tauri dev          # run on the OS you are targeting
yarn build              # tsc + vite
yarn tauri build        # platform installers + updater artifacts when keys set
```

## Non-negotiables (do not regress)

1. **Window chrome is platform-split** (`src-tauri/src/lib.rs`):
   - macOS: Overlay + empty title + `Effect::Sidebar` + radius 12
   - Windows: undecorated + title `snipnote` + `Effect::Mica` (soft-fail); TabBar draws min/max/close
   - Never reintroduce combined `EffectsBuilder([Sidebar, Mica])` or Overlay-on-Windows
2. **Settings is a tab** (`SettingsView.tsx`), not a modal dialog
3. **Shortcut labels** use `modShortcut` / `platform.ts` — never hard-code `⌘` for Windows UI
4. **Paths** may be `/` or `\`; use `paths.ts` / `path.ts` helpers
5. **Updater**: only outbound HTTPS; drafts must be **published** for `/releases/latest`; see `src/lib/updater.ts` + `RELEASE.md`
6. **Draft notes** stay in-memory until `hasContent` — do not recreate disk-first `Untitled.md`

## Where things are

| Concern | Location |
|---|---|
| Window / menu / effects | `src-tauri/src/lib.rs` |
| Vault scan / IO | `src-tauri/src/storage.rs` |
| Watcher | `src-tauri/src/watcher.rs` |
| UX spines | `_bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/` |
| PRD | `_bmad-output/planning-artifacts/prds/prd-snipnote-2026-09-02/prd.md` |
| Architecture | `_bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md` |
| Change proposal (2026-09-08) | `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-08.md` |

## Pitfalls

- Updater check fails quietly in `yarn tauri dev` / before first public release — expected
- WelcomeGate owns first-run; do not resurrect a separate empty-state dashboard
- Right Panel exists but is intentionally not rendered

Updated: 2026-09-08 (Correct Course doc sync)
<!-- bmad:context:end -->
