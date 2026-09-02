---
title: 'Story 3.1: Rust notify File Watcher & Vault Change Stream'
type: 'feature'
created: '2026-09-02'
baseline_revision: 'd3f599d970fb2837b18ce68dd3dcec77d6135bf2'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-3-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Changes made by external processes (such as Claude Code modifying markdown notes or generating new files on disk in the terminal) are not detected by Snipnote unless the user manually reloads the vault.

**Approach:** Implement a native file watching module (`src-tauri/src/watcher.rs`) using `notify = "6"`. When a vault is opened, spawn a recursive filesystem watcher in Rust managed by Tauri application state. When files or directories change, filter out noise (hidden files, `.git`, temporary files) and emit a Tauri `vault-changed` event to the frontend with `{ path, kind }`.

## Boundaries & Constraints

**Always:**
- Run file watching in Rust background thread/runtime (AD-1).
- Watch the vault directory recursively.
- Filter out `.git`, `.DS_Store`, `.snipnote.tmp`, and non-markdown hidden files before emitting events.
- Emit `vault-changed` events via `app_handle.emit("vault-changed", payload)` using Tauri v2 event system.
- Replace or re-arm watcher when a new vault directory is loaded.
- Ensure `cargo test` and `yarn build` pass with 0 errors.

**Block If:**
- Watcher registration fails due to invalid directory permissions; return error string to frontend.

**Never:**
- Watch the entire root filesystem.
- Emit events for temporary atomic write files (`*.snipnote.tmp`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| External File Edit | Claude Code edits `spec.md` in terminal | Rust detects `Modify` event; emits `vault-changed` event to WebView | Ignores if hidden or temp |
| External File Created | Claude Code creates `new-note.md` | Rust detects `Create` event; emits `vault-changed` | Filtered for `.md` or dir |
| Git Operation | Git modifies `.git/index` | Filtered out; no event emitted | Preserves performance |
| Vault Switch | User opens a different folder | Old watcher is dropped, new watcher mounted on new directory | Clean state transition |

</intent-contract>

## Code Map

- `src-tauri/Cargo.toml` -- Add `notify = "6"`.
- `src-tauri/src/watcher.rs` -- [NEW] Rust file watcher service, Tauri state management, filtering, and event emission.
- `src-tauri/src/lib.rs` -- Manage `VaultWatcherState` and register `watch_vault` and `unwatch_vault` commands.
- `src/stores/useVaultStore.ts` -- Call `watch_vault` on vault load and set up `vault-changed` listener.

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/watcher.rs` -- Implement `VaultWatcherState`, event filtering, and `watch_vault` command -- Implements native watcher.
- `src-tauri/src/lib.rs` -- Register `watcher` module and commands in Tauri runtime -- Exposes IPC.
- `src/stores/useVaultStore.ts` -- Wire `watch_vault` on `loadVault` and setup listener -- Connects frontend stream.

**Acceptance Criteria:**
- Given an active vault directory, when external files are created or modified, then `vault-changed` events are emitted to the frontend.
- Given internal `.git` or `.snipnote.tmp` updates, when inspected, then they are filtered and not emitted to the frontend.
- Given switching vaults, when a new vault is loaded, the watcher cleanly switches to monitor the new root.
- Given `cargo test` and `yarn build`, when run, both pass with code 0.

## Spec Change Log

## Review Triage Log

### 2026-09-02 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - none

## Design Notes

Tauri v2 uses `tauri::Emitter` trait (`app_handle.emit("vault-changed", ...)`). `notify::RecommendedWatcher` is held in `Arc<Mutex<Option<RecommendedWatcher>>>` within `VaultWatcherState`.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Integrated `notify = "6"` into `src-tauri/Cargo.toml` and created the `watcher` module (`src-tauri/src/watcher.rs`). Implemented `VaultWatcherState` to manage a recursive `RecommendedWatcher` instance. Filtered out hidden directories (`.git`), hidden files, and temporary atomic write files (`.snipnote.tmp`). Emitted Tauri `vault-changed` events (`{ path, kind }`) across the IPC boundary whenever external modifications occur. Updated `useVaultStore` to start the watcher on `loadVault` and cleanly unwatch on `clearVault`.

### Files Changed
- `src-tauri/Cargo.toml`: Added `notify = "6"` dependency
- `src-tauri/src/watcher.rs`: [NEW] File watcher service, event filtering, and unit tests
- `src-tauri/src/lib.rs`: Managed `VaultWatcherState` and registered `watch_vault` / `unwatch_vault` commands
- `src/stores/useVaultStore.ts`: Wired `watch_vault` on vault load and `unwatch_vault` on vault clear

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed all 11 tests with 0 failures (`watcher::tests::test_should_emit_change_filtering ... ok`).
- Ran `yarn build`: Bundled 2188 modules cleanly with 0 TypeScript/Vite errors.

### Residual Risks
None. Clean native filesystem event stream active.
