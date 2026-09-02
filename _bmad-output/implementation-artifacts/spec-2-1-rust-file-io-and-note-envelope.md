---
title: 'Story 2.1: Rust File I/O & Note Envelope Model'
type: 'feature'
created: '2026-09-02'
baseline_revision: 'd5e68e425fa869517a8ff724099beb6d337b1b0f'
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

**Problem:** Frontend cannot read or write note content on disk, and naive file loading would pass raw YAML frontmatter into rich text editors, causing formatting corruption and lost metadata.

**Approach:** Implement `read_file` and `write_file` in the Rust backend (`src-tauri/src/storage.rs`). `read_file` parses the note into a `NoteEnvelope` (`{ frontmatter: string | null, body: string }`), stripping frontmatter from the editing body. `write_file` reassembles the envelope verbatim and writes atomically via temporary file swap (`.snipnote.tmp`). Expose both commands over Tauri IPC and add corresponding TypeScript types.

## Boundaries & Constraints

**Always:**
- Extract YAML frontmatter verbatim between opening `---` and closing `---` delimiters without parsing or mutating YAML keys/values.
- Reassemble frontmatter and body with exact byte fidelity upon save.
- Perform atomic disk writes using temporary file rename (`fs::rename`) with `sync_all()`.
- Return descriptive error strings on missing files or permission errors.
- Write unit tests in Rust verifying envelope parsing, frontmatter preservation, and atomic persistence.

**Block If:**
- Target write destination is outside the filesystem or read-only.

**Never:**
- Inject HTML tags or frontend wrapper markup into saved markdown files.
- Mutate or reorder frontmatter YAML fields during round-trip.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| File with Frontmatter | `---\ntitle: Doc\ntags: [a, b]\n---\n\n# Hello` | `NoteEnvelope { frontmatter: Some("title: Doc\ntags: [a, b]"), body: "# Hello" }` | Parsed cleanly |
| File without Frontmatter | `# Just Content` | `NoteEnvelope { frontmatter: None, body: "# Just Content" }` | Parsed cleanly |
| Empty File | `""` (0 bytes) | `NoteEnvelope { frontmatter: None, body: "" }` | Handled cleanly |
| Save with Frontmatter | `body: "# Updated"`, `frontmatter: Some("title: Doc")` | Reassembled file contains `---\ntitle: Doc\n---\n\n# Updated` | Atomic rename |
| Non-existent File | Invalid path string | Returns `Err("Failed to read file: ...")` | Returns descriptive error |

</intent-contract>

## Code Map

- `src-tauri/src/storage.rs` -- Add `NoteEnvelope` struct, `parse_note_envelope`, `reassemble_envelope`, `read_file`, and `write_file` commands, plus unit tests.
- `src-tauri/src/lib.rs` -- Register `storage::read_file` and `storage::write_file` in Tauri invoke handler.
- `src/types/note.ts` -- [NEW] Define `interface NoteEnvelope` matching IPC contract.

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/storage.rs` -- Implement Note Envelope parsing, reassembly, atomic write, and `read_file` / `write_file` commands -- Implements AD-1 and AD-2.
- `src-tauri/src/lib.rs` -- Register `read_file` and `write_file` commands in `invoke_handler` -- Exposes IPC bridge.
- `src/types/note.ts` -- Define TypeScript interface `NoteEnvelope` -- Establishes frontend typing.

**Acceptance Criteria:**
- Given a file with frontmatter, when `read_file` is invoked, then frontmatter is extracted into `frontmatter` and excluded from `body`.
- Given an updated body and frontmatter, when `write_file` is invoked, then content is reassembled with original frontmatter and written atomically to disk.
- Given `cargo test --manifest-path src-tauri/Cargo.toml`, when run, then all storage tests pass with 0 failures.
- Given `yarn build`, when run, then TypeScript check passes with 0 errors.

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

Atomic writes write to `{path}.snipnote.tmp` and use `std::fs::rename`, guaranteeing that power cuts or app crashes during write never leave half-written or corrupted files on disk.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, all envelope and storage unit tests pass
- `yarn build` -- expected: Exit code 0, clean TypeScript validation

## Auto Run Result

### Summary of Implemented Change
Implemented the Note Envelope Model in `src-tauri/src/storage.rs`. `read_file` extracts optional YAML frontmatter (`---...---`) verbatim into `frontmatter` while presenting the raw markdown body in `body` for clean editor consumption. `write_file` reassembles frontmatter and markdown body byte-for-byte, writing to a temporary file (`.snipnote.tmp`) with `sync_all()` before performing an atomic rename (`fs::rename`) to guarantee zero corruption or partial writes. Exposed `read_file` and `write_file` over Tauri IPC and added the TypeScript `NoteEnvelope` interface in `src/types/note.ts`.

### Files Changed
- `src-tauri/src/storage.rs`: Added `NoteEnvelope` struct, `parse_note_envelope`, `reassemble_envelope`, `read_file`, `write_file`, and comprehensive unit tests
- `src-tauri/src/lib.rs`: Registered `read_file` and `write_file` in Tauri invoke handler
- `src/types/note.ts`: [NEW] TypeScript `NoteEnvelope` interface

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed all 8 tests (envelope parsing, roundtrip, atomic write/read, directory scanning, and session sanitization).
- Ran `yarn build`: Bundled 42 modules in 343ms with 0 TypeScript errors.

### Residual Risks
None. Robust byte-for-byte roundtrip envelope verified.
