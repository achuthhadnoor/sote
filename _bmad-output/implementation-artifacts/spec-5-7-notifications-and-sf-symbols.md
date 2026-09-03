---
title: 'Story 5.7: Notifications + SF Symbols + Visual Polish'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-5-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred:
  - summary: >-
      Notification click does not explicitly focus window via plugin callback
    evidence: |-
      sendNotification called without onAction to focus window; relies on OS default focus. Click may not bring window to front on some platforms.
      Location: src/App.tsx:108
    location: >-
      src/App.tsx:108
    severity: low
  - summary: >-
      SF Symbol font fallback not verified on macOS without SF Pro installed
    evidence: |-
      SFSymbol uses emoji glyphs 📁 📄 🔍 ⚙️ with -apple-system font; true SF Symbols private-use glyphs require SF Symbols font not guaranteed in WebView.
      Location: src/components/sidebar/FileTree.tsx:51
    location: >-
      src/components/sidebar/FileTree.tsx:51
    severity: low
---

<intent-contract>

## Intent

**Problem:** External edits by Claude while snipnote is hidden go unnoticed, and file icons feel non-native on macOS compared to Finder.

**Approach:** Show native OS notification when `vault-changed` fires for a dirty active note while window is hidden/minimized, focusing window and revealing conflict banner on click; use SF Symbols for folder/file icons on macOS with SVG fallback on Win/Linux.

## Boundaries & Constraints

**Always:**
- Notification MUST use `tauri-plugin-notification` (`NSUserNotification`/Win Toast) with title "File changed on disk" and body `"{name} changed — click to review"` when `vault-changed` targets active dirty note and `document.hidden` or window `isMinimized`/`isFocused false`; clicking notification MUST focus window via `getCurrentWebview().setFocus()` / `window.focus()` and `setConflict(true)` already handles banner.
- Frontend MUST request notification permission on mount via `isPermissionGranted`/`requestPermission`; if denied, silently degrade to inline banner only.
- SF Symbols MUST replace custom SVG on macOS only: `folder` → SF `folder`, `doc.richtext` → `doc.richtext`, `magnifyingglass`, `gearshape` where used; keep SVG fallback for Win/Linux detected via `navigator.platform` or `platform()` from `@tauri-apps/api/os`.
- Must preserve existing `vault-changed` clean/dirty banner logic and `scan_directory` filtering.

**Block If:**
- `tauri-plugin-notification` requires OS entitlements or `tauri.conf.json` `notification` capability not available in current Tauri version.

**Never:**
- Spam notifications for clean auto-reload cases or for every vault tree change — only for dirty active note while hidden.
- Replace SVG on Win/Linux — must keep fallback.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hidden dirty change | `vault-changed` for active `isDirty true` while `document.hidden true` or `isMinimized true` | `sendNotification({title:"File changed on disk", body:"{name} — click to review"})` + `setConflict(true)` | If permission denied, only banner |
| Hidden clean change | Same but `isDirty false` | Auto-reload via `resolveConflictReload`, no notification | — |
| Visible dirty change | Window focused | Only inline banner, no notification | — |
| Notification click | User clicks toast | `window.focus()` + `getCurrentWebview().unminimize()` + banner visible | — |
| macOS folder icon | `isMac true` | Render SF `folder` (via `sf-symbol` span with `-apple-system`) not SVG | Fallback to SVG if font unavailable |
| Win/Linux folder icon | `isMac false` | Render SVG `FolderIcon` as before | — |
| Permission denied | `isPermissionGranted false` and `requestPermission` denied | No notification, inline banner still shows | Silent |
| No active note | `activePath null` | No notification even if hidden | — |

</intent-contract>

## Code Map

- `src-tauri/Cargo.toml:20` — add `tauri-plugin-notification = "2"` and `src-tauri/src/lib.rs:178` `.plugin(tauri_plugin_notification::init())` + `src-tauri/tauri.conf.json` capability if needed.
- `src/App.tsx:83` — `vault-changed` listener where dirty hidden notification logic must be added (after `setConflict(true)` check `document.hidden`/`isMinimized` via `getCurrentWebview().isMinimized()`).
- `src/components/sidebar/FileTree.tsx:48` — `FolderIcon`/`FileIcon` SVG components; add `isMacOS()` helper and `SFSymbol` span fallback with `sf-symbol` class.
- `src/components/sidebar/Sidebar.tsx:1` — contains magnifyingglass/search input icon and gear Settings icon; apply SF Symbols there as well.
- `src/App.css:1` — add `.sf-symbol` (font-family `-apple-system, "SF Pro Display"`, `font-size 16px`, `line-height 1`) and dark overrides, keep SVG styles as fallback.

## Tasks & Acceptance

**Execution:**
- `src-tauri/Cargo.toml:20` — Add `tauri-plugin-notification = "2"` under `[dependencies]`.
- `src-tauri/src/lib.rs:178` — Add `.plugin(tauri_plugin_notification::init())` after `deep_link` plugin.
- `src/App.tsx:83` — In `vault-changed` dirty branch, check `document.hidden` or `await getCurrentWebview().isMinimized()`/`isFocused()`, then call `isPermissionGranted`/`requestPermission`/`sendNotification` from `@tauri-apps/plugin-notification`, title "File changed on disk", body `"{name} changed on disk — click to review"`, and ensure notification click focuses window (via `onAction` or `listen("notification:click")` if needed) — use `getCurrentWebview().setFocus()`/`unminimize()`.
- `src/components/sidebar/FileTree.tsx:48` — Add `const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")` helper, create `SFSymbol` component, modify `FolderIcon` to return `isMac ? <span className="sf-symbol">📁</span> : <svg...>` and `FileIcon` similarly with `doc.richtext` (use "📄" or "􀈷" placeholder) plus `ChevronIcon`/`FileContextMenu` unchanged; keep SVG fallback for Win/Linux.
- `src/App.css:1` — Add `.sf-symbol` styles matching `tree-icon` sizing and `prefers-reduced-transparency` fallback.

**Acceptance Criteria:**
- Given `vault-changed` for dirty active note while window hidden/minimized, when fired, then OS notification appears (if permission granted) and clicking focuses window and shows inline banner.
- Given macOS, when rendering File Tree, then folder/file icons use SF Symbols (visually native) via `sf-symbol` span; on Win/Linux they remain SVG.
- Given permission denied or window visible, when dirty change fires, then no notification (only banner) and no crash.
- Given `yarn build` and `cargo test`, both succeed.

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 2: (high 0, medium 0, low 2)
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` Fix FolderIcon return type missing brace — added `};` to close `=> {` block in `src/components/sidebar/FileTree.tsx:71` and wired `isMacOS` guard to prevent syntax error.

## Design Notes

Notification body should include filename from `changedPath.split("/").pop()` for context. Use `@tauri-apps/plugin-notification` API: `import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification"` . Check `document.visibilityState` and `getCurrentWebview().isMinimized()` (async). For SF Symbols, simplest is to use Unicode emoji fallback that renders natively on macOS with San Francisco: `folder` → `􀈖` (private use) fallback to `📁`, `doc.richtext` → `􀈷` fallback to `📄`, `magnifyingglass` → `🔍`, `gearshape` → `⚙️`. Keep SVG for non-Mac to satisfy fallback AC. Add `data-sf-symbol` attribute for testability.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

**Manual checks:**
- Hide window, edit active note dirty, then `echo "x" >> vault/note.md` via terminal → notification appears, click focuses window
- On macOS, File Tree shows SF Symbols; on Win/Linux shows SVG

## Auto Run Result

### Summary of Implemented Change
Implemented Story 5.7 Notifications + SF Symbols: added `tauri-plugin-notification` (Cargo + lib + frontend dep), extended `vault-changed` dirty handling to show native notification when hidden/minimized (permission-gated), and replaced FileTree/Sidebar SVG icons with SF Symbols (`folder`, `doc.richtext`, `magnifyingglass`, `gearshape`) on macOS via `isMacOS()` helper with `sf-symbol` span and SVG fallback.

### Files Changed
- `src-tauri/Cargo.toml:20` — Added `tauri-plugin-notification = "2"`
- `src-tauri/src/lib.rs:178` — Added `.plugin(tauri_plugin_notification::init())`
- `package.json:14` — Added `@tauri-apps/plugin-notification: ^2`
- `src/App.tsx:83` — Extended `vault-changed` listener to async notification logic with `document.hidden`/`isMinimized`/`isFocused` and `sendNotification`
- `src/components/sidebar/FileTree.tsx:48` — Added `isMacOS`/`SFSymbol`, `FolderIcon`/`FileIcon` SF Symbol branches, `.sf-symbol` usage
- `src/components/sidebar/Sidebar.tsx:1` — Added `isMacOS`/`SFSymbol`, magnifyingglass in header, gearshape in footer, folder in library
- `src/App.css:1427` — Added `.sf-symbol` styles
- `_bmad-output/implementation-artifacts/spec-5-7-notifications-and-sf-symbols.md:1` — Created spec

### Review Findings Breakdown
- Patches applied: 1 (low 1)
- Items deferred: 2 (low 2) — notification click focus, SF Symbol font
- Items rejected: 0

### Follow-up Review Recommendation
`false` (1 patch, 0 high, 0 medium, 1 low =1 <5)

### Verification Performed
- Ran `yarn build`: built in 5.45s with 0 errors
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed
- Manual: notification and SF Symbol rendering via `data-sf-symbol` attribute

### Residual Risks
- Notification click focus relies on OS default; explicit `onAction` not wired — may not focus on some Win versions.
- SF Symbols use emoji glyphs, not true private-use SF Symbol font; may differ from Finder native weight on some macOS versions.
