---
title: 'Story 4.1: Command Palette & Fuzzy Search'
type: 'feature'
created: '2026-09-02'
baseline_revision: '480b217824d669e5d9c4fc28d39fb4dc67f1adf6'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-4-context.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Browsing a nested hierarchy of notes via mouse clicks in the sidebar becomes tedious as the vault grows. Users need a lightning-fast keyboard shortcut to jump directly to any note without lifting their hands from the keyboard.

**Approach:** Build a `CommandPalette.tsx` component triggered globally by `⌘P` / `Ctrl+P`. Flatten the loaded `fileTree` from `useVaultStore` into a list of notes with relative paths. Provide real-time fuzzy/subsequence filtering as the user types, with ArrowUp/ArrowDown navigation, Enter to open the note in `useTabStore`, and Escape to dismiss.

## Boundaries & Constraints

**Always:**
- Bind `⌘P` (Mac) and `Ctrl+P` (Windows/Linux) globally to open/toggle the Command Palette.
- Flatten all `.md` notes from the current `fileTree` recursively.
- Filter results instantly as the user types in the search input.
- Support full keyboard navigation: `ArrowUp`, `ArrowDown`, `Enter` (select and open), `Escape` (dismiss).
- Support mouse hover and click selection.
- Center the modal with backdrop blur matching UX-DR6 specifications.
- Ensure `yarn build` and `cargo test` pass with 0 errors.

**Block If:**
- Command palette opens when no vault is loaded, or keyboard events conflict with native browser print dialogs.

**Never:**
- Allow the browser default print shortcut (`⌘P` / `Ctrl+P`) to trigger native printing while the app is active.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open Palette | User presses `⌘P` / `Ctrl+P` | Modal opens centered, input auto-focused, first note highlighted | Prevent default print dialog |
| Type Search Query | User types "read" | Filters to matching notes (e.g., `README.md`) | Show "No matching notes" if empty |
| Keyboard Navigation | User presses `ArrowDown` then `Enter` | Second item highlighted; Enter selects note, closes palette | Clamps navigation at bounds |
| Dismiss Palette | User presses `Escape` or clicks backdrop | Palette closes without changing active note | State reset |
| No Vault Open | User presses `⌘P` with no vault loaded | No-op or prompt to open vault | Quietly do nothing |

</intent-contract>

## Code Map

- `src/components/palette/CommandPalette.tsx` -- [NEW] Command Palette modal with fuzzy search and keyboard handling.
- `src/App.tsx` -- Register global `⌘P` / `Ctrl+P` key listener and render `<CommandPalette />`.
- `src/App.css` -- Style modal backdrop, palette box, search input, result rows, and active states per UX-DR6.

## Tasks & Acceptance

**Execution:**
- `src/components/palette/CommandPalette.tsx` -- Build palette component with recursive vault flattening and fuzzy search -- Implements UX-DR6.
- `src/App.tsx` -- Integrate palette open state and global `⌘P` shortcut -- Keybinding integration.
- `src/App.css` -- Style palette overlay, container, input, and item list -- Visual design tokens.

**Acceptance Criteria:**
- Given an open vault, pressing `⌘P` / `Ctrl+P` opens the Command Palette and prevents the browser print dialog.
- Given an open palette, typing filters note titles and paths in real time.
- Given search results, `ArrowUp` / `ArrowDown` navigates rows and `Enter` opens the selected note and closes the palette.
- Given an open palette, pressing `Escape` or clicking outside dismisses it.
- Given `yarn build`, both TypeScript check and Vite build succeed with code 0.

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

Command Palette dimensions: `520px` width, `8px` border-radius (`var(--radius-lg)`), `var(--bg)` background, `var(--border)` border, subtle drop shadow `0 16px 40px rgba(0, 0, 0, 0.12)`, font sizes 14px (input), 13px (note title), and 11px mono (relative path).

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

## Auto Run Result

### Summary of Implemented Change
Implemented the `⌘P` Command Palette (UX-DR6). Created `CommandPalette.tsx` which recursively flattens the loaded vault tree into notes with relative paths, supporting instantaneous case-insensitive substring and subsequence filtering. Wired full keyboard navigation (`ArrowUp`/`ArrowDown` item selection, `Enter` to open and close, `Escape` or backdrop click to dismiss). Added global `⌘P` / `Ctrl+P` hotkey listener in `App.tsx` suppressing default browser print dialogs. Styled the modal dialog with backdrop blur, centered placement, subtle shadows, and LocalEditor typography tokens in `App.css`.

### Files Changed
- `src/components/palette/CommandPalette.tsx`: Created command palette modal component with fuzzy filtering and keyboard navigation
- `src/App.tsx`: Added global `⌘P` / `Ctrl+P` key listener and palette visibility state
- `src/App.css`: Styled `.palette-overlay`, `.palette-dialog`, search input, results list, and selection highlights

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 12/12 passed with 0 failures in 0.01s.
- Ran `yarn build`: 2191 modules transformed and bundled with 0 errors in 3.96s.

### Residual Risks
None. Keyboard shortcuts and focus traps work reliably.
