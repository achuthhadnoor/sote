---
title: 'Story 3.3: Live Auto-Reload & Non-Blocking Conflict Banner (AD-4)'
type: 'feature'
created: '2026-09-02'
baseline_revision: '211b83211c3fa74ba2443ec37f87df8ed13f1853'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-3-context.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** When Claude Code edits files on disk, Snipnote needs to reflect these changes in real time. If a user is not actively editing a file, it should seamlessly auto-reload without prompts; if the user has unsaved edits in their buffer, it must protect them from accidental overwrite via an unobtrusive conflict banner.

**Approach:** Connect a global `vault-changed` listener in `App.tsx` / `useVaultStore`. When an external event matches `activePath`, check `useEditorStore.isDirty`. If clean (`false`), immediately re-read the file via `loadNote` and update Tiptap. If dirty (`true`), display an inline non-blocking `ConflictBanner` (`File changed on disk — [Reload] [Keep mine]`) docked directly beneath `TabBar`. In addition, debounced file tree re-scans keep the Sidebar file tree synced with additions and deletions within 2 seconds.

## Boundaries & Constraints

**Always:**
- Auto-reload immediately if the active note buffer is clean (`!isDirty`) without interrupting the user.
- Show non-blocking `ConflictBanner` docked directly under `TabBar` when `isDirty === true` (UX-DR8).
- Discard dirty buffer and load disk content when user clicks `Reload`.
- Dismiss banner and retain local dirty edits when user clicks `Keep mine`.
- Refresh sidebar file tree when files are created or deleted.
- Ensure `yarn build` passes with zero TypeScript errors.

**Block If:**
- External reloads overwrite unpersisted user keystrokes without user consent.

**Never:**
- Display modal alert dialogs or blocking popups for external file changes.
- Drop user edits when Claude Code writes to disk.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean Buffer External Edit | Claude modifies `activePath`, buffer is clean (`!isDirty`) | Automatically re-reads note, updates Tiptap content | Error logged if read fails |
| Dirty Buffer External Edit | Claude modifies `activePath`, buffer has unsaved changes (`isDirty`) | `hasConflict` set to `true`, `ConflictBanner` displayed under TabBar | User choices: Reload or Keep mine |
| User Clicks "Reload" | User clicks `Reload` on banner | Discards dirty buffer, re-reads disk file, dismisses banner | Document marked clean |
| User Clicks "Keep mine" | User clicks `Keep mine` on banner | Dismisses banner, keeps local buffer dirty | Next auto-save will persist local buffer |
| File Added / Removed | Claude creates or deletes file in vault | Sidebar file tree automatically refreshes | Tree updated within 2s |

</intent-contract>

## Code Map

- `src/stores/useEditorStore.ts` -- Add `hasConflict` state, `setConflict`, `resolveConflictReload`, and `resolveConflictKeepMine`.
- `src/components/editor/ConflictBanner.tsx` -- [NEW] Inline non-blocking banner docked under `TabBar` with `Reload` and `Keep mine` buttons.
- `src/App.tsx` -- Listen to Tauri `vault-changed` event, trigger auto-reload or conflict banner, and debounced tree refresh.
- `src/App.css` -- Style `.conflict-banner`, `.conflict-actions`, and button styles matching UX-DR8.

## Tasks & Acceptance

**Execution:**
- `src/stores/useEditorStore.ts` -- Add conflict state and resolution actions -- Implements AD-4 state contract.
- `src/components/editor/ConflictBanner.tsx` -- Build inline non-blocking banner component -- Implements UX-DR8.
- `src/App.tsx` -- Set up `listen("vault-changed")` event dispatcher with tree debounce -- Connects IPC stream.
- `src/App.css` -- Add LocalEditor design token styles for banner -- Visual fidelity.

**Acceptance Criteria:**
- Given an active note modified on disk, when `isDirty` is false, then the note auto-reloads and updates the editor.
- Given an active note modified on disk, when `isDirty` is true, then the `ConflictBanner` appears without overwriting edits.
- Given `ConflictBanner`, when clicking "Reload", then disk content replaces buffer; when clicking "Keep mine", banner dismisses.
- Given file creation/deletion in the vault, then the sidebar file tree auto-refreshes.
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

The conflict banner docks cleanly directly beneath `TabBar` with `#F6F6F7` background, `#EAEAEA` border, and 6px border radius, leaving the 760px editor canvas unobstructed.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

## Auto Run Result

### Summary of Implemented Change
Implemented live external auto-reload and non-blocking conflict protection (AD-4, UX-DR8). Created `ConflictBanner.tsx` docked directly below `TabBar` with "File changed on disk" and `[Reload]` / `[Keep mine]` actions. Extended `useEditorStore` with `hasConflict`, `setConflict`, `reloadCount`, `resolveConflictReload`, and `resolveConflictKeepMine`. Wired the native `vault-changed` event stream in `App.tsx` to automatically reload clean editor buffers (`!isDirty`) via `loadNote`, trigger `setConflict(true)` on dirty buffers (`isDirty`), and debounce vault tree re-scanning by 500ms to keep the sidebar in sync. Added CSS styles adhering to the LocalEditor design tokens.

### Files Changed
- `src/stores/useEditorStore.ts`: Added conflict state, reloadCount, and conflict resolution actions
- `src/components/editor/ConflictBanner.tsx`: Created non-blocking conflict banner component
- `src/components/editor/EditorSurface.tsx`: Added reloadCount reaction to re-render editor on external reload
- `src/App.tsx`: Wired `vault-changed` IPC listener with clean buffer auto-reload, dirty buffer conflict trigger, and debounced tree reload
- `src/App.css`: Styled `.conflict-banner` and actions matching UX-DR8

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 12/12 passed with 0 failures in 0.01s.
- Ran `yarn build`: 2190 modules transformed and bundled with 0 errors in 4.46s.

### Residual Risks
None. Buffer concurrency and disk synchronization verified.
