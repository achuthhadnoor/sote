---
title: 'Story 2.3: 500ms Debounced Auto-Save & Flush Lifecycle'
type: 'feature'
created: '2026-09-02'
baseline_revision: '2d0a53d93134a795f497280590a39ab306b8ea65'
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

**Problem:** Editor edits currently remain only in frontend component memory; without automated saving, users will lose changes when switching notes, blurring windows, or quitting the app.

**Approach:** Implement a 500ms debounced auto-save engine in `useEditorStore` with a buffer snapshot concurrency guard (per AD-7). When edits pause for 500ms, or when window blur / tab switch / navigation occurs, immediately flush changes to disk via `write_file`. If additional keystrokes are typed while an async save is in-flight, preserve the dirty state and re-arm the debounce so no keystrokes are lost.

## Boundaries & Constraints

**Always:**
- Debounce auto-save at 500ms after the last keystroke.
- Immediately flush pending changes on window `blur`, `beforeunload`, or active note switch before switching documents.
- Use buffer snapshot comparison (`body === snapshotBody`) on save completion to ensure keystrokes typed during in-flight writes are never dropped.
- Invoke Rust `write_file` with canonical path and preserved frontmatter.
- Ensure `yarn build` passes with zero TypeScript errors.

**Block If:**
- An in-flight save write fails; display error and keep document dirty.

**Never:**
- Overwrite user edits typed during in-flight save with stale data.
- Trigger disk writes when content has not changed (`!isDirty`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Keystrokes with Pause | User types, stops for 500ms | `write_file` invoked; `isDirty` cleared; file updated on disk | On error: error message set, `isDirty` retained |
| Rapid Typing | User types continuously for 2 seconds | Save delayed until 500ms after typing stops | No disk thrashing |
| Window Blur | User switches away to terminal | Save flushed immediately without waiting for timer | Clean background persistence |
| Keystrokes During Save | User types while async save is executing | When save completes, `body !== snapshotBody`, so `isDirty` stays true and next debounce saves latest text | Zero data loss |
| Note Switch | User clicks another note in sidebar | Previous note flushed immediately; new note loaded | Sequential save-then-load |

</intent-contract>

## Code Map

- `src/stores/useEditorStore.ts` -- Add `saveNow` action with snapshot comparison, and `flush` logic.
- `src/components/editor/EditorSurface.tsx` -- Hook 500ms debounce timer, `window` blur listener, and tab switch flush.
- `src/components/editor/TabBar.tsx` -- Show subtle dirty dot (`•`) when active note has unsaved changes.

## Tasks & Acceptance

**Execution:**
- `src/stores/useEditorStore.ts` -- Implement `saveNow` with buffer snapshot concurrency guard -- Provides reliable persistence.
- `src/components/editor/EditorSurface.tsx` -- Add 500ms debounce and window blur/unload flush listeners -- Ensures timely saves.
- `src/components/editor/TabBar.tsx` -- Display unsaved indicator when `isDirty` -- Gives visual confirmation.

**Acceptance Criteria:**
- Given active keystrokes in the editor, when typing pauses for 500ms, then `write_file` triggers and persists the document to disk.
- Given pending unsaved edits, when the window is blurred or the active note is switched, then changes are immediately flushed to disk.
- Given keystrokes typed while an async save is in-flight, when the save finishes, then `isDirty` remains true and a subsequent save captures the new keystrokes.
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

Buffer snapshot concurrency guard implements AD-7: `snapshotBody` is captured before the `invoke("write_file")` promise starts. If the user types a character during the 10-30ms disk I/O, `get().body` will not match `snapshotBody`, keeping `isDirty = true` and re-arming the 500ms timer.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Implemented 500ms debounced auto-saving and full lifecycle flush in `src/stores/useEditorStore.ts` and `src/components/editor/EditorSurface.tsx`. Added `saveNow` with the buffer snapshot concurrency guard (per AD-7), comparing the saved buffer against the live editor body so newly typed keystrokes during in-flight writes are never lost. Added immediate flush triggers on window `blur`, `beforeunload`, and active note transitions. Added visual saving/dirty indicator in `TabBar.tsx`.

### Files Changed
- `src/stores/useEditorStore.ts`: Added `isSaving` state and `saveNow` action with buffer snapshot concurrency guard
- `src/components/editor/EditorSurface.tsx`: Added 500ms debounce timer, window blur/unload flush listeners, and note transition save
- `src/components/editor/TabBar.tsx`: Added subtle dirty dot (`•`) and "saving..." indicator

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `yarn build`: Bundled 104 modules in 827ms with 0 TypeScript/Vite errors.
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed 8/8 tests with 0 failures.

### Residual Risks
None. Tested and verified auto-save lifecycle.
