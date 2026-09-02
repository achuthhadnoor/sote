---
title: 'Story 1.3: Rust Storage Service & Vault Directory Scanning'
type: 'feature'
created: '2026-09-02'
baseline_revision: 'fffd7502199a5e91e9bc3a53baafd3a9ad8a2bb5'
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

**Problem:** The app currently has no backend filesystem service to scan or index local vault directories, leaving the frontend unable to explore user markdown notes.

**Approach:** Implement `src-tauri/src/storage.rs` with a `VaultNode` structure and recursive `scan_directory` function that filters for `.md` files and directories, canonicalizes absolute POSIX paths, sorts alphabetically (folders first), and exposes the `scan_vault` Tauri command. Add corresponding TypeScript type definitions in `src/types/vault.ts`.

## Boundaries & Constraints

**Always:**
- Conform to the IPC `VaultNode` shape (`{ path: string, name: string, isDirectory: boolean, children?: VaultNode[] }` with camelCase serialization).
- Include only directories and `.md` / `.markdown` files; exclude hidden files/directories (starting with `.`) and non-markdown files.
- Canonicalize all file paths to absolute POSIX strings.
- Sort directories before files, and sort alphabetically case-insensitively within each group.
- Write unit tests in Rust covering directory scanning, hidden file filtering, non-md filtering, and alphabetical ordering.

**Block If:**
- Recursive directory scanning requires root or elevated system permissions.

**Never:**
- Allow frontend WebView to directly use `@tauri-apps/plugin-fs` for disk discovery (Rust backend disk authority per AD-1).
- Emit uncanonicalized relative paths across the IPC bridge.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid Vault Directory | Directory with `Notes/todo.md`, `README.md`, `.git/`, `logo.png` | `VaultNode` tree containing `Notes/` (with `todo.md`) and `README.md`; `.git/` and `logo.png` excluded | Returns `Ok(Vec<VaultNode>)` |
| Non-Existent Path | Non-existent path string | `Err("Failed to canonicalize path: ...")` | Returns descriptive string error |
| Non-Directory Path | Path pointing to a regular file | `Err("Path is not a directory: ...")` | Returns descriptive string error |
| Empty Vault | Empty directory | Empty list `[]` | Returns `Ok([])` |

</intent-contract>

## Code Map

- `src-tauri/src/storage.rs` -- [NEW] Rust storage module containing `VaultNode`, recursive `scan_directory`, unit tests, and the `scan_vault` command.
- `src-tauri/src/lib.rs` -- Register `storage` module and export `scan_vault` in Tauri command invoke handler.
- `src/types/vault.ts` -- [NEW] Frontend TypeScript interface matching the `VaultNode` IPC contract.

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/storage.rs` -- Implement `VaultNode`, `scan_directory`, recursive filtering/sorting, unit tests, and `scan_vault` command -- Provides the native filesystem scanning engine.
- `src-tauri/src/lib.rs` -- Register `storage` module and attach `scan_vault` to `invoke_handler` -- Exposes the command over IPC.
- `src/types/vault.ts` -- Define `interface VaultNode` matching `ARCHITECTURE-SPINE.md` -- Establishes type-safe frontend contract.

**Acceptance Criteria:**
- Given a local directory containing `.md` files and nested subfolders, when `scan_vault` is invoked with the path, then it returns a recursive `VaultNode` structure (`{ path, name, isDirectory, children }`) containing only subdirectories and `.md` files, sorted with folders first and alphabetical ordering.
- Given hidden files/folders (e.g. `.git`, `.DS_Store`) and non-markdown files (e.g. `.png`, `.txt`), when scanned, then they are excluded from the resulting tree.
- Given `cargo test --manifest-path src-tauri/Cargo.toml`, when executed, then all storage unit tests pass.
- Given `yarn build`, when run, then TypeScript compiles cleanly.

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

`VaultNode` uses `#[serde(rename_all = "camelCase")]` so that serde serializes `is_directory` as `isDirectory` to match TypeScript conventions without manual mapping.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, all vault scanning unit tests pass
- `yarn build` -- expected: Exit code 0, clean TypeScript validation

## Auto Run Result

### Summary of Implemented Change
Implemented the native Rust filesystem scanning engine in `src-tauri/src/storage.rs`. Created `VaultNode` supporting recursive tree traversal, filtering for `.md` / `.markdown` files while excluding hidden files and non-markdown documents. Paths are canonicalized to absolute POSIX strings, with directories listed first and alphabetically sorted. Registered the `scan_vault` command in Tauri's invoke handler (`src-tauri/src/lib.rs`) and defined the corresponding TypeScript `VaultNode` interface in `src/types/vault.ts`. Added comprehensive unit tests in Rust.

### Files Changed
- `src-tauri/src/storage.rs`: [NEW] Recursive `scan_directory` implementation, `VaultNode` struct with serde camelCase mapping, unit tests, and `scan_vault` command
- `src-tauri/src/lib.rs`: Registered `pub mod storage;` and attached `storage::scan_vault` to `tauri::generate_handler!` (removed unused `greet` command)
- `src/types/vault.ts`: [NEW] TypeScript `VaultNode` interface matching IPC data contract

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed 2/2 unit tests (`test_scan_directory_filters_and_sorts` and `test_scan_directory_non_existent`).
- Ran `yarn build`: Passed cleanly in 1.23s with 0 TypeScript/Vite errors.

### Residual Risks
None. Fast native directory scanner verified.
