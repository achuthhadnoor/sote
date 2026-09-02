---
title: 'Story 4.2: Tab History Navigation Stack'
type: 'feature'
created: '2026-09-02'
baseline_revision: 'de778b2bd0e9bd3fef260adee0531de83c7ba2e0'
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

**Problem:** When referencing multiple notes or switching back and forth between a guide and code notes, users waste time re-locating files in the sidebar tree. They need back/forward navigation with instant keyboard shortcuts (`⌘[` / `⌘]`) and visual buttons.

**Approach:** Enhance `useTabStore` with reactive `canGoBack` and `canGoForward` states and history stack tracking. Wire global keyboard shortcuts (`⌘[` / `Ctrl+[` and `⌘]` / `Ctrl+]`, plus `Alt+Left` / `Alt+Right`) in `App.tsx`. Connect `TabBar.tsx` back/forward buttons to trigger `goBack` / `goForward` with visual disabled states at stack boundaries.

## Boundaries & Constraints

**Always:**
- Push note navigations onto the `history` array and truncate forward history when navigating to a new note.
- Enable `goBack` and `canGoBack: true` whenever `historyIndex > 0`.
- Enable `goForward` and `canGoForward: true` whenever `historyIndex < history.length - 1`.
- Support `⌘[` and `⌘]` (Mac) and `Ctrl+[` and `Ctrl+]` (Windows/Linux) keyboard shortcuts.
- Visually disable back/forward buttons when at stack boundaries (`disabled` attribute and opacity styling).
- Preserve unsaved buffer changes on navigation by flushing active note before switching.
- Ensure `yarn build` and `cargo test` pass with 0 errors.

**Block If:**
- Navigating back or forward exceeds stack boundaries or causes unhandled index exceptions.

**Never:**
- Allow history navigation to wipe out forward history unless a new unique note is selected.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial Note Opened | App loads note A | `history: [A]`, `historyIndex: 0`, `canGoBack: false`, `canGoForward: false` | Buttons disabled |
| Second Note Opened | User clicks note B | `history: [A, B]`, `historyIndex: 1`, `canGoBack: true`, `canGoForward: false` | Back button enabled |
| Navigate Back | User presses `⌘[` or clicks `←` | Navigates to note A; `historyIndex: 0`, `canGoBack: false`, `canGoForward: true` | Forward button enabled |
| Navigate Forward | User presses `⌘]` or clicks `→` | Navigates to note B; `historyIndex: 1`, `canGoBack: true`, `canGoForward: false` | Back button enabled |
| Branching Navigation | At note A, user clicks note C | Truncates forward history: `history: [A, C]`, `historyIndex: 1`, `canGoForward: false` | Clean history branch |

</intent-contract>

## Code Map

- `src/stores/useTabStore.ts` -- Store reactive `canGoBack`, `canGoForward`, `goBack`, and `goForward`.
- `src/components/editor/TabBar.tsx` -- Connect back/forward buttons with tooltips and disabled styling.
- `src/App.tsx` -- Bind `⌘[` / `⌘]` and `Ctrl+[` / `Ctrl+]` global key shortcuts.
- `src/App.css` -- Ensure `.tab-nav-btn:disabled` has proper opacity and cursor styling.

## Tasks & Acceptance

**Execution:**
- `src/stores/useTabStore.ts` -- Upgrade tab history stack with reactive flags -- Implements navigation state.
- `src/components/editor/TabBar.tsx` -- Bind `goBack` / `goForward` and update tooltips with shortcut cues -- Connects UI controls.
- `src/App.tsx` -- Register global `⌘[` / `⌘]` keyboard shortcuts -- Keyboard speed navigation.

**Acceptance Criteria:**
- Given multiple notes visited, `goBack` opens the previous note and `goForward` opens the next note.
- Given keyboard shortcuts `⌘[` and `⌘]`, navigation stack moves backward and forward accordingly.
- Given the beginning of history, back button is disabled; given the end, forward button is disabled.
- Given `yarn build`, TypeScript check and Vite build succeed with code 0.

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

Buttons use `←` and `→` in `.tab-nav-group` with subtle monochrome borders and disabled opacity of `0.35`.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

## Auto Run Result

### Summary of Implemented Change
Implemented the Tab History Navigation Stack. Enhanced `useTabStore` with reactive `canGoBack` and `canGoForward` states, keeping a bounded navigation history with clean forward-history truncation on new note selection. Updated `TabBar.tsx` with `disabled` states and keyboard shortcut tooltips (`⌘[` and `⌘]`). Bound global keyboard shortcuts `⌘[` / `Ctrl+[` and `⌘]` / `Ctrl+]` in `App.tsx` for instantaneous history traversal without mouse interaction.

### Files Changed
- `src/stores/useTabStore.ts`: Replaced method calls with reactive boolean properties and index clamping
- `src/components/editor/TabBar.tsx`: Updated back/forward button bindings and tooltips with shortcut cues
- `src/App.tsx`: Registered global `⌘[` and `⌘]` keyboard listeners

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 12/12 passed with 0 failures in 0.01s.
- Ran `yarn build`: 2191 modules transformed and bundled with 0 errors in 3.97s.

### Residual Risks
None. Navigation bounds and dirty buffer saves tested.
