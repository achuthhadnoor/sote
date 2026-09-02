---
title: 'Story 3.2: Echo Suppression Cache (AD-3)'
type: 'feature'
created: '2026-09-02'
baseline_revision: '195af045a94330e4f5c2112b99e524561aa19af1'
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

**Problem:** Whenever Snipnote persists an edit to disk via debounced auto-save or note creation, the native file watcher detects the filesystem modification and emits a `vault-changed` event. Without echo suppression, Snipnote would receive its own saves as external changes, risking false conflict banners, cursor jumps, or infinite reload loops.

**Approach:** Implement `EchoSuppressionCache` (AD-3) in Rust (`src-tauri/src/watcher.rs`). When `write_file` or `create_note` persists a note, the canonical path is recorded in `EchoSuppressionCache` with the current `Instant`. The file watcher inspects `is_suppressed(&path)` for every modification event; if the path was written within 2 seconds, the event is silently suppressed.

## Boundaries & Constraints

**Always:**
- Use a thread-safe in-memory cache (`Arc<Mutex<HashMap<PathBuf, Instant>>>>`) with a 2-second TTL.
- Record canonical paths in `EchoSuppressionCache` upon successful `write_file` and `create_note`.
- Suppress watcher events whose path matches an active unexpired entry in the cache.
- Prune expired entries lazily on lookup/insert to avoid unbounded memory growth.
- Provide comprehensive Rust unit tests verifying suppression within TTL and expiry after TTL.
- Ensure `cargo test` and `yarn build` pass with 0 errors.

**Block If:**
- Watcher events from external tools (e.g. Claude Code modifying notes) match an expired or absent cache entry and get incorrectly dropped.

**Never:**
- Suppress events permanently (must strictly expire after 2s TTL).
- Block the main thread during cache synchronization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Snipnote Auto-Save | User types, `write_file` persists | Path recorded in cache; watcher modify event arrives within 100ms and is suppressed | No `vault-changed` emitted |
| External Claude Edit | Claude Code modifies file in terminal | File not in cache; watcher modify event arrives | `vault-changed` emitted |
| Consecutive Writes | Snipnote saves twice within 1s | Cache timestamp updated; subsequent event suppressed | Both events suppressed |
| Save Followed by External Edit After 2s | Snipnote saves, 2.5s later Claude edits | Entry expired; external edit event emitted | Allowed through cleanly |

</intent-contract>

## Code Map

- `src-tauri/src/watcher.rs` -- Implement `EchoSuppressionCache` with 2-second TTL, integrate with watcher callback, add unit tests.
- `src-tauri/src/storage.rs` -- Connect `write_file` and `create_note` to record paths in `EchoSuppressionCache`.
- `src-tauri/src/lib.rs` -- Share `EchoSuppressionCache` across `storage` and `watcher` through `VaultWatcherState`.

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/watcher.rs` -- Implement `EchoSuppressionCache` struct, `record_write`, `is_suppressed`, and wire into watcher handler -- Implements AD-3.
- `src-tauri/src/storage.rs` -- Update `write_file` and `create_note` to record written path in `EchoSuppressionCache` -- Feeds cache.
- `src-tauri/src/watcher.rs` (tests) -- Add unit tests for TTL suppression and expiry -- Validates accuracy.

**Acceptance Criteria:**
- Given Snipnote writing a note to disk via `write_file`, when the resulting filesystem modify event is intercepted by the watcher, then it is suppressed and no `vault-changed` event is emitted.
- Given an external modification to a note after the 2s TTL has expired (or to an unrecorded note), then `vault-changed` is emitted.
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

`EchoSuppressionCache` uses `std::time::Instant` rather than system clocks, guaranteeing monotonic comparison immune to system clock shifts.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, all echo suppression tests pass
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Implemented `EchoSuppressionCache` (AD-3) in `src-tauri/src/watcher.rs` using `Instant` timestamps and a 2-second TTL to distinguish Snipnote's own debounced auto-saves from external disk modifications made by Claude Code. Connected `write_file` and `create_note` in `storage.rs` to record canonical write destinations in the cache. Updated the background watcher to check `echo_cache.is_suppressed(&p)` before emitting `vault-changed` events. Added comprehensive Rust unit tests validating cache suppression within TTL and correct pass-through for unrecorded files.

### Files Changed
- `src-tauri/src/watcher.rs`: Implemented `EchoSuppressionCache`, added to `VaultWatcherState`, wired into `watch_vault`, added unit tests
- `src-tauri/src/storage.rs`: Added `internal_write_file` / `internal_create_note` helpers, and wired `write_file` and `create_note` to record paths in `echo_cache`

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed all 12 tests with 0 failures (`watcher::tests::test_echo_suppression_cache_lifecycle ... ok`).
- Ran `yarn build`: Bundled 2188 modules cleanly with 0 TypeScript/Vite errors.

### Residual Risks
None. Self-inflicted write loops safely suppressed.
