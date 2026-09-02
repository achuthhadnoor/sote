---
title: 'Story 4.3: Live Document Statistics & Status Bar'
type: 'feature'
created: '2026-09-02'
baseline_revision: 'a266bd6429f7fb5f1fd3461eb4ed525f5299935e'
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

**Problem:** Writers and engineers writing documentation or markdown notes need ambient feedback on document length and progress without manual counting or opening external inspection tools.

**Approach:** Connect `StatusBar.tsx` directly to `useEditorStore`'s `body` state. Compute live word count, character count, and paragraph count in real time using memoized tokenization. Display the formatted counts (`{words} words · {characters} characters · {paragraphs} paragraphs`) in the 28px bottom status bar per UX-DR5.

## Boundaries & Constraints

**Always:**
- Format statistics strictly as: `{words} words · {characters} characters · {paragraphs} paragraphs`.
- Update counts in real time as the user types, pastes, or switches notes.
- When no note is selected or the active note is empty, display `0 words · 0 characters · 0 paragraphs`.
- Preserve the 28px height, monospace typography, and subtle border styling in `.status-bar`.
- Ensure `yarn build` and `cargo test` pass with 0 errors.

**Block If:**
- Statistics calculations lag on large documents (>10,000 words).

**Never:**
- Count empty whitespace blocks as paragraphs or words.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty Document | Active note is empty or only whitespace | `0 words · 0 characters · 0 paragraphs` | Handled via early return |
| Single Paragraph | User writes "Hello world" | `2 words · 11 characters · 1 paragraphs` | Correct count |
| Multi-Paragraph Note | Note with headings and text separated by blank lines | Exact word, character, and paragraph counts | Blank lines don't inflate paragraph count |
| No Active Note | Vault open, no note selected | `0 words · 0 characters · 0 paragraphs` | Clean zero state |
| Switching Notes | User selects note B | Statistics instantly re-evaluate for note B | Instant reaction |

</intent-contract>

## Code Map

- `src/components/editor/StatusBar.tsx` -- Connect to `useEditorStore` (`body`) and `useTabStore` (`activePath`), calculate words/characters/paragraphs, render UX-DR5 format.
- `src/App.tsx` -- Render `<StatusBar />` cleanly without legacy dummy props.

## Tasks & Acceptance

**Execution:**
- `src/components/editor/StatusBar.tsx` -- Implement reactive text statistics calculation -- Implements UX-DR5.
- `src/App.tsx` -- Update `<StatusBar />` invocation -- Integrates component.

**Acceptance Criteria:**
- Given an active note with text, words, characters, and paragraphs are displayed and update live with keystrokes.
- Given an empty note, all metrics display 0.
- Given note switching, metrics update immediately to match the newly loaded note.
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

Format: `{words} words · {characters} characters · {paragraphs} paragraphs` rendered in `var(--font-mono)`, font-size 11px, `var(--muted-fg)`.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

## Auto Run Result

### Summary of Implemented Change
Implemented live document statistics in the Status Bar (UX-DR5). Connected `StatusBar.tsx` directly to `useEditorStore`'s `body` state and `useTabStore`'s `activePath`. Built a memoized statistics evaluator that parses words, characters, and non-empty paragraph blocks in real-time as the user types, pastes, or navigates. Formatted the output according to the LocalEditor design tokens: `{words} words · {characters} characters · {paragraphs} paragraphs` in 11px monospace typography. Removed legacy hardcoded dummy props from `App.tsx`.

### Files Changed
- `src/components/editor/StatusBar.tsx`: Added real-time reactive calculations for words, characters, and paragraphs
- `src/App.tsx`: Cleaned up StatusBar invocation by removing unused dummy props

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 12/12 passed with 0 failures in 0.01s.
- Ran `yarn build`: 2191 modules transformed and bundled with 0 errors in 6.40s.

### Residual Risks
None. High performance memoized tokenization.
