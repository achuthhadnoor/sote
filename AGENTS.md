<!-- bmad:context:start -->
# snipnote — Agent Context

Local-first Markdown notes (Tauri 2 + React 19 + TipTap). Disk is source of truth. Ships **macOS + Windows**.

## Product modes

| Mode | Default? | What |
|---|---|---|
| **v1 Floating** | Yes | Tray/menubar + floating panel + `EditorSurface` |
| **v2 Full shell** | No (flag) | Existing `App` vault UI (Sidebar, tabs, WelcomeGate) |

Flag: `snipnote-full-editor` (localStorage / Settings). Do **not** delete full-shell code.

## Commands

```bash
yarn install
yarn tauri dev
yarn build
yarn tauri build
```

## Non-negotiables

1. **Default UX = float + tray** — do not show full vault window on every launch
2. **Reuse** `EditorSurface`, `SettingsView`, stores, Rust IO/updater
3. Window labels: `float` (v1), `main` (v2 shell)
4. Full-shell chrome rules (Overlay mac / native+Mica win) apply to **`main` only**
5. Shortcut labels via `modShortcut` / `platform.ts`
6. Updater HTTPS only; publish GitHub drafts for `/releases/latest`

## Where things are

| Concern | Location |
|---|---|
| Proposal (floating v1) | `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-08-floating-v1.md` |
| PRD / UX / Arch | `_bmad-output/planning-artifacts/` |
| Full shell (v2) | `src/App.tsx` + sidebar/tab components |
| Editor / Settings | `EditorSurface.tsx`, `SettingsView.tsx` |

## Next build focus

Epic F: tray → float window → hotkey → embed editor → settings → full-editor flag.

Updated: 2026-09-08 (Correct Course floating-v1)
<!-- bmad:context:end -->
