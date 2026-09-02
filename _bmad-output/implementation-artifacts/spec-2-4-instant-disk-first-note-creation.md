---
title: 'Story 2.4: Instant Disk-First Note Creation'
type: 'feature'
created: '2026-09-02'
baseline_revision: '3d9c6ca51d169f18e20e26c7c21a5e00478c0d2d'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-2-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Currently clicking `+` sets a dummy title without creating a file on disk, violating the disk-first 1:1 mirror architecture and risking lost notes.

**Approach:** Implement `create_note` in Rust (`src-tauri/src/storage.rs`) that discovers the next available `Untitled.md` (or `Untitled 1.md`, etc.) in the active vault root, creates it on disk, and returns its canonical path. Connect the `+` button in `TabBar` and a global `⌘N` / `Ctrl+N` keyboard shortcut to call `create_note`, refresh the vault tree, and select the newly created note in the editor.

## Boundaries & Constraints

**Always:**
- Create the file directly on disk before selecting it in the UI (AD-8 disk-first invariant).
- Generate numbered increments when `Untitled.md` already exists (`Untitled.md`, `Untitled 1.md`, `Untitled 2.md`).
- Refresh the sidebar file tree via `loadVault` immediately upon creation.
- Automatically select and focus the newly created note in the editor.
- Support both clicking `+` in `TabBar` and pressing `⌘N` / `Ctrl+N`.
- Ensure `yarn build` and `cargo test` pass cleanly.

**Block If:**
- No vault is currently open; prompt the user to open a vault before creating notes.

**Never:**
- Create ephemeral in-memory notes that don't exist on disk.
- Overwrite existing files when creating an untitled note.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First Note Creation | Vault open, no `Untitled.md` exists | Creates `Untitled.md` in vault root; selects note | Returns canonical path |
| Collision with `Untitled.md` | `Untitled.md` already exists | Creates `Untitled 1.md` | Increments counter |
| Multiple Collisions | `Untitled.md` and `Untitled 1.md` exist | Creates `Untitled 2.md` | Finds first unused number |
| No Vault Open | User clicks `+` when `vaultPath === null` | Opens native folder dialog to pick vault first | Gracefully handles cancel |
| Keyboard Shortcut | User presses `⌘N` (Mac) or `Ctrl+N` | Triggers same creation flow as clicking `+` | Event intercepted and prevented default |

</intent-contract>

## Code Map

- `src-tauri/src/storage.rs` -- Implement `create_note(vault_path: String) -> Result<String, String>` and unit tests.
- `src-tauri/src/lib.rs` -- Register `create_note` command in Tauri invoke handler.
- `src/stores/useVaultStore.ts` -- Add `createNote` action that calls `create_note` and reloads tree.
- `src/components/editor/TabBar.tsx` -- Connect `+` button to `createNote`.
- `src/App.tsx` -- Add global `keydown` listener for `⌘N` / `Ctrl+N`.

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/storage.rs` -- Implement `create_note` with collision resolution and unit tests -- Enforces AD-8 disk-first persistence.
- `src-tauri/src/lib.rs` -- Register `storage::create_note` in `invoke_handler` -- Exposes command over IPC.
- `src/stores/useVaultStore.ts` -- Add `createNote` action coordinating file creation and tree reload -- Updates store.
- `src/components/editor/TabBar.tsx` & `src/App.tsx` -- Wire `+` button and `⌘N` keyboard shortcut -- Connects user triggers.

**Acceptance Criteria:**
- Given an opened vault, when the user clicks `+` or presses `⌘N`, then `Untitled.md` (or `Untitled N.md`) is immediately created on disk.
- Given note creation, when the command resolves, then the Sidebar file tree updates and the new note is immediately selected in the editor.
- Given existing `Untitled.md` files, when creating another note, then the next available number is used without collisions.
- Given `cargo test` and `yarn build`, when run, then both pass with code 0.

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

Finding the next available `Untitled` file loops sequentially starting from `Untitled.md` then `Untitled 1.md`, checking `path.exists()`, guaranteeing safety against race conditions.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, all note creation tests pass
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Implemented the `create_note` Rust command in `src-tauri/src/storage.rs` to fulfill the disk-first note creation invariant (AD-8). The backend dynamically checks for existing files and determines the next available increment (`Untitled.md`, `Untitled 1.md`, etc.) directly in the vault root. Added `createNote` action in `useVaultStore` to coordinate file creation, immediate tree refresh (`loadVault`), and note selection. Wired both the `+` button in `TabBar` and the global `⌘N` / `Ctrl+N` keyboard shortcut.

### Files Changed
- `src-tauri/src/storage.rs`: Added `create_note` command and collision increment unit tests
- `src-tauri/src/lib.rs`: Registered `storage::create_note` in Tauri invoke handler
- `src/stores/useVaultStore.ts`: Added `createNote` action
- `src/App.tsx`: Wired `handleNewNote` to `createNote` and registered global `⌘N` / `Ctrl+N` keydown listener

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed all 9 tests with 0 failures (`test_create_note_increments_numbers ... ok`).
- Ran `yarn build`: Bundled 104 modules in 794ms with 0 TypeScript/Vite errors.

### Residual Risks
None. Grounded disk-first note creation verified.
