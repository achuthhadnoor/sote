---
title: 'Story 5.9: Distribution: Auto-update, Launch at Login, Haptics'
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
      Updater uses placeholder pubkey and example.com endpoint with no real feed
    evidence: |-
      tauri.conf.json updater pubkey is dummy and endpoint https://example.com/appcast.json returns 404; check() will show up-to-date or network error, not a real update.
      Location: src-tauri/tauri.conf.json:52
    location: >-
      src-tauri/tauri.conf.json:52
    severity: low
  - summary: >-
      Haptics via navigator.vibrate fallback only, no native NSHapticFeedbackManager
    evidence: |-
      invoke("haptic_feedback") will fail as no Rust command exists; fallback to vibrate(10) is used, which may not trigger on desktop without vibration support.
      Location: src/App.tsx:31
    location: >-
      src/App.tsx:31
    severity: low
---

<intent-contract>

## Intent

**Problem:** Users must manually check for updates, re-enable launch at login after reboot, and lack tactile feedback for key toggles, reducing freshness and native feel.

**Approach:** Configure Sparkle updater via `tauri-plugin-updater` with a Settings “Check for Updates” flow, add Launch at Login toggle via `tauri-plugin-autostart` persisting across reboots, and fire subtle haptics (`NSHapticFeedbackManager` alignment) on sidebar/settings toggles plus `NSSound.beep`/`navigator.vibrate` fallback on save error.

## Boundaries & Constraints

**Always:**
- Updater MUST be `tauri-plugin-updater` with `tauri.conf.json` `plugins.updater` `pubkey` (placeholder) and `endpoints` (`https://example.com/appcast.json` placeholder for v1, no network in tests), and Settings MUST have “Check for Updates” button showing `checking`/`up-to-date`/`available`/`error` states via `check()` from `@tauri-apps/plugin-updater`.
- Autostart MUST be `tauri-plugin-autostart` with Settings toggle `Launch at Login` persisting via `enable()`/`disable()`/`isEnabled()` from `@tauri-apps/plugin-autostart`, surviving reboot; toggle state reflects `isEnabled()` on mount.
- Haptics MUST fire on `Toggle Sidebar` (`⌘B`/button) and `Settings open` (`⌘,`/gear) via `navigator.vibrate(10)` fallback and, when available, Tauri `haptic` plugin or `NSHapticFeedbackManager` via `invoke("haptic_feedback")` (graceful no-op if unavailable); `NSSound.beep` on save error via `invoke("beep")` or `navigator.vibrate([30,20,30])` fallback.
- Must preserve `transparent` `Overlay` `EffectsBuilder` and not add outbound telemetry.

**Block If:**
- Sparkle updater requires Apple Developer signing/entitlements not available in dev, or `tauri-plugin-autostart` requires OS helper install that fails without admin.

**Never:**
- Auto-install updates without user confirmation — `Check for Updates` is manual for v1 (download+relaunch only on explicit action).
- Use `localStorage` for autostart state alone — must use OS autostart plugin.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Check for Updates — up to date | Click button, no update | Button shows “Checking…” then “Up to date ✓” for 3s | If network error, show “Check failed” |
| Check for Updates — available | Mock endpoint returns 0.2.0 | Show “Update available 0.2.0 — Restart to update” and `Download` button that triggers `downloadAndInstall` + `relaunch` on confirm | If download fails, show error |
| Launch at Login on | Toggle on | `enable()` then `isEnabled()` returns true, survives reboot | If enable fails, toggle reverts and shows toast |
| Launch at Login off | Toggle off | `disable()` then `isEnabled()` false | — |
| Toggle Sidebar | `⌘B` or button | `navigator.vibrate(10)` or `invoke("haptic_feedback")` fires, sidebar collapses/expands | No-op if vibrate unsupported |
| Settings open | `⌘,` or gear | Same haptic fires, dialog opens | — |
| Save error | `write_file` fails | `navigator.vibrate([30,20,30])` or `invoke("beep")` plus error banner | No crash |

</intent-contract>

## Code Map

- `src-tauri/Cargo.toml:20` — add `tauri-plugin-updater = "2"` and `tauri-plugin-autostart = "2"` (and optional `tauri-plugin-haptics` or keep `navigator.vibrate` fallback).
- `src-tauri/src/lib.rs:178` — `.plugin(tauri_plugin_updater::Builder::new().build())` and `.plugin(tauri_plugin_autostart::init(...))` (with `MacosLauncher::LaunchAgent`).
- `src-tauri/tauri.conf.json:49` — `plugins.updater` `{ pubkey: "dW50...==", endpoints: ["https://example.com/appcast.json"] }` and `plugins.autostart` if needed; keep `bundle` etc.
- `src/components/settings/SettingsDialog.tsx:1` — add Distribution section with `Check for Updates` button (state `checking`/`result`) and `Launch at Login` toggle (using `isEnabled`/`enable`/`disable` from `@tauri-apps/plugin-autostart`); import `@tauri-apps/plugin-updater` `check`.
- `src/App.tsx:220` — `setSidebarCollapsed` and `setIsSettingsOpen` toggles where haptics should fire via `navigator.vibrate` or `invoke("haptic_feedback")`.
- `src/stores/useEditorStore.ts:1` — `saveNow` error path where beep/vibrate should fire on catch.

## Tasks & Acceptance

**Execution:**
- `src-tauri/Cargo.toml:20` — Add `tauri-plugin-updater = "2"` and `tauri-plugin-autostart = "2"` to `[dependencies]`.
- `src-tauri/src/lib.rs:178` — Register `.plugin(tauri_plugin_updater::Builder::new().build())` and `.plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))` after `opener`/`notification`.
- `src-tauri/tauri.conf.json:49` — Add `plugins.updater` with placeholder `pubkey` and `endpoints`, and ensure `plugins` contains `autostart` if required by plugin.
- `src/components/settings/SettingsDialog.tsx:88` — Add “Updates & System” section: `Check for Updates` button with `async` `try { const update = await check(); if (!update) setResult("Up to date") else setResult("Available") } catch { setResult("Failed") }`, and `Launch at Login` switch using `import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart"` with `useEffect` on mount to sync `isEnabled()` to toggle state.
- `src/App.tsx:220` — After `setSidebarCollapsed` and `setIsSettingsOpen(true)` calls, fire `try { navigator.vibrate(10); } catch {}` and optionally `invoke("haptic_feedback", { kind: "alignment" }).catch(()=>{})`.
- `src/stores/useEditorStore.ts:1` — In `saveNow` catch / `write_file` error handling, fire `try { navigator.vibrate([30,20,30]); } catch {}` or `invoke("beep")`.

**Acceptance Criteria:**
- Given Settings “Check for Updates” clicked, when no update, then button shows “Checking…” then “Up to date”; when mock update available, shows “Available” and download path (manual confirm, no auto-install).
- Given “Launch at Login” toggled on/off, when checked via `isEnabled()` after toggle and after simulated reboot (re-read), then state persists via OS autostart plugin (not just localStorage).
- Given Toggle Sidebar (`⌘B`) or Settings open (`⌘,`), when triggered, then haptic `vibrate(10)` fires (no error if unsupported) and UI toggles.
- Given `write_file` error, when save fails, then beep/vibrate fires and error is not swallowed.
- Given `yarn build` and `cargo test`, both succeed.

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 2: (high 0, medium 0, low 2)
- reject: 0
- addressed_findings:
  - none

## Design Notes

Updater placeholder: generate test key via `tauri signer generate` but v1 can use dummy `pubkey` `"dW50cnVzdGVkIGNvbW1lbnQ6...=="` and endpoint `https://example.com/appcast.json` returning 404 — `check()` will then report up-to-date or network error, which is acceptable for v1 with no real feed. Autostart plugin on macOS uses `LaunchAgent` (no admin), on Windows uses registry. Haptics: `navigator.vibrate` is widely supported as fallback; native `NSHapticFeedbackManager` requires `tauri-plugin-haptics` or custom Rust `invoke("haptic_feedback")` that calls `NSHapticFeedbackManager.defaultPerformer().perform(.alignment, performanceTime: .now)` on macOS and no-op elsewhere. Keep `haptic_feedback` as optional `invoke` that may fail gracefully.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

**Manual checks:**
- Settings → Check for Updates → shows checking/up-to-date
- Settings → Launch at Login toggle → survives app restart (`isEnabled` true)
- Toggle Sidebar → brief haptic (on supported device)

## Auto Run Result

### Summary of Implemented Change
Implemented Story 5.9 Distribution: added `tauri-plugin-updater` and `tauri-plugin-autostart` (Cargo + lib + tauri.conf placeholder + frontend deps), built Settings “Updates & System” section with Check for Updates (`check()`) and Launch at Login toggle (`isEnabled`/`enable`/`disable`), and added haptics via `navigator.vibrate(10)` on sidebar/settings toggles plus beep vibrate `[30,20,30]` on save error.

### Files Changed
- `src-tauri/Cargo.toml:20` — Added `tauri-plugin-updater = "2"` and `tauri-plugin-autostart = "2"`
- `src-tauri/src/lib.rs:181` — Registered `.plugin(tauri_plugin_updater::Builder::new().build())` and `.plugin(tauri_plugin_autostart::init(LaunchAgent))`
- `src-tauri/tauri.conf.json:52` — Added `plugins.updater` placeholder pubkey and endpoints
- `src-tauri/capabilities/default.json:8` — Added `updater:default`/`allow-check`/`allow-download-and-install` and `autostart:default`/`allow-enable`/`allow-disable`/`allow-is-enabled`
- `package.json:12` — Added `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-autostart`
- `src/components/settings/SettingsDialog.tsx:1` — Added Updates & System section with Check for Updates button and Launch at Login toggle
- `src/App.tsx:31` — Added `triggerHaptic` via `navigator.vibrate(10)` and effects for sidebar/settings toggles
- `src/stores/useEditorStore.ts:120` — Added beep vibrate `[30,20,30]` on save error catch
- `_bmad-output/implementation-artifacts/spec-5-9-distribution.md:1` — Created spec

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 2 (low 2) — placeholder updater, haptics fallback
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches)

### Verification Performed
- Ran `yarn build`: built in 5.43s with 0 errors
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed

### Residual Risks
- Updater placeholder endpoint will always report up-to-date or network error until real feed is configured.
- Autostart LaunchAgent on macOS requires no admin but may be blocked by MDM; toggle may fail silently.
- Haptics via vibrate not supported on many desktops; native NSHapticFeedbackManager not wired — tactile feedback may be absent on MacBook trackpad.
