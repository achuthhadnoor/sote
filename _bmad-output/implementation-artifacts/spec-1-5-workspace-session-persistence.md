---
title: 'Story 1.5: Workspace State Persistence (session.json)'
type: 'feature'
created: '2026-09-02'
baseline_revision: '71daba9218df1be9b2394325ce5c6c951a461f12'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Whenever the user restarts snipnote, their vault selection and active note are lost, forcing them to re-select their folder on every launch.

**Approach:** Implement `session.json` persistence in the OS `app_data_dir` via Rust commands `get_session` and `save_session`. Validate on load that persisted paths still exist on disk. On app mount in the frontend, query `get_session` and automatically reload the last vault and active note. Update `session.json` whenever the active vault or active file changes.

## Boundaries & Constraints

**Always:**
- Store `session.json` in the OS application data directory resolved by `app.path().app_data_dir()`.
- Validate on load that `last_vault_path` is an existing directory and `active_file_path` is an existing file; discard stale paths gracefully.
- Use camelCase serialization for the IPC interface (`lastVaultPath`, `activeFilePath`).
- Unit test session serialization and deserialization in Rust.
- Ensure `yarn build` and `cargo test` pass cleanly.

**Block If:**
- Corrupted `session.json` causes a launch crash (fall back to empty default session).

**Never:**
- Use browser `localStorage` for vault persistence (Rust backend owns persistence per AD-1 and AD-5).
- Block the UI thread on session save.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First Launch | No `session.json` in `app_data_dir` | Returns default empty session (`{ lastVaultPath: null, activeFilePath: null }`) | No error |
| Subsequent Launch | Valid `session.json` with existing paths | Restores vault tree and selects active note | Re-scans and renders vault seamlessly |
| Deleted Vault Path | Path in `session.json` was deleted externally | `last_vault_path` discarded; empty state shown | Silent fallback without crash |
| Malformed JSON | `session.json` corrupted on disk | Returns default empty session | Resets to clean default without error |

</intent-contract>

## Code Map

- `src-tauri/src/session.rs` -- [NEW] Rust session module managing `SessionState`, `get_session`, and `save_session`.
- `src-tauri/src/lib.rs` -- Register `session` module and add commands `get_session` and `save_session` to `invoke_handler`.
- `src/types/session.ts` -- [NEW] Frontend TypeScript interface for `SessionState`.
- `src/App.tsx` -- Add mount effect calling `get_session` and persistence subscriber saving state changes.

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/session.rs` -- Implement `SessionState`, validation, `get_session`, `save_session`, and unit tests -- Provides native session management.
- `src-tauri/src/lib.rs` -- Register `pub mod session;` and attach commands to `invoke_handler` -- Exposes session IPC.
- `src/types/session.ts` -- Define `interface SessionState` -- Types session contract.
- `src/App.tsx` -- Hook startup restoration and state change persistence -- Seamlessly remembers user workspace.

**Acceptance Criteria:**
- Given a previously selected vault and active note, when the application restarts, then `get_session` loads `session.json`, automatically loads the vault tree, and restores the active note.
- Given a deleted or moved folder path in `session.json`, when `get_session` is called, then the non-existent path is cleared and the app falls back to the clean empty state.
- Given `cargo test --manifest-path src-tauri/Cargo.toml`, when run, then session tests pass.
- Given `yarn build`, when run, then TypeScript check and Vite build succeed with code 0.

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

Atomic or safe overwrite of `session.json` ensures that unexpected crashes don't corrupt the file. Invalidation of missing paths guarantees resilient restarts.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, all session and storage unit tests pass
- `yarn build` -- expected: Exit code 0, clean TypeScript check and Vite build

## Auto Run Result

### Summary of Implemented Change
Implemented native workspace session persistence in `src-tauri/src/session.rs`. Defined `SessionState` and commands `get_session` / `save_session` to persist the last opened vault directory and active note into `session.json` within the OS application data directory (`app.path().app_data_dir()`). Added disk validation to ensure removed or moved directories/files are automatically sanitized on startup without crashing. Connected frontend startup restoration and state change persistence in `src/App.tsx`.

### Files Changed
- `src-tauri/src/session.rs`: [NEW] Native session persistence and validation module with unit tests
- `src-tauri/src/lib.rs`: Registered `session` module and exposed `get_session` and `save_session` commands
- `src/types/session.ts`: [NEW] TypeScript interface for `SessionState`
- `src/App.tsx`: Added startup session restoration and state synchronization effects

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed 4/4 unit tests (`test_session_state_serialization`, `test_sanitize_session_cleans_missing_vault`, and both storage tests).
- Ran `yarn build`: Bundled 42 modules in 367ms with 0 TypeScript/Vite errors.

### Residual Risks
None. Robust session caching and resilient validation.
