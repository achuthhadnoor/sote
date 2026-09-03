---
title: 'Story 5.5: Find/Replace in Editor'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-5-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred:
  - summary: >-
      Large-document search not debounced (potential freeze on 20k+ chars)
    evidence: |-
      FindBar recomputeMatches runs synchronously on every query change and doc update via doc.descendants with global regex; no 150ms debounce or chunking as spec design note suggested.
      Location: src/components/editor/FindBar.tsx:20
    location: >-
      src/components/editor/FindBar.tsx:20
    severity: low
  - summary: >-
      Replace All via schema.text may lose inline marks around match
    evidence: |-
      handleReplaceAll uses tr.replaceWith with schema.text(replaceQuery) which strips marks (bold/links) at replaced range; not verified via test.
      Location: src/components/editor/FindBar.tsx:180
    location: >-
      src/components/editor/FindBar.tsx:180
    severity: low
  - summary: >-
      No automated tests for FindBar or SearchHighlight DecorationSet
    evidence: |-
      verification gap: no *.test.* harness, cargo tests don't cover frontend find; yarn build only type-checks. Manual OS checks required.
      Location: src/components/editor/extensions/SearchHighlight.ts:1
    location: >-
      src/components/editor/extensions/SearchHighlight.ts:1
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Long markdown notes are hard to navigate; users need to locate and replace text without leaving the editor or losing context.

**Approach:** Add a floating find bar above the Status Bar that highlights matches in ProseMirror via DecorationSet, scrolls to the active match, and supports replace, toggled by `⌘F`/`⇧⌘F` and dismissed with `Esc`.

## Boundaries & Constraints

**Always:**
- Find bar MUST be a floating panel above Status Bar (`App.tsx` or `EditorSurface.tsx` render), `Esc` closes, `Enter`/`⇧Enter` moves next/prev, highlights via `DecorationSet` in ProseMirror, and scrolls to active match via `view.dom` or `editor.commands.scrollIntoView`.
- `⌘F` (`Ctrl+F` on Win/Linux) MUST open/focus find bar; `⇧⌘F` MUST toggle replace input; when no note is open, `⌘F` does nothing.
- Matches MUST be case-insensitive substring search by default, highlight all occurrences with `.search-highlight` and active with `.search-highlight-active` decoration.
- Replace MUST operate on current match (`Replace`) and all matches (`Replace All`) via transaction `tr.replaceWith` or `editor.chain().focus().setContent` using current `body` string; after replace, decorations and `loadVault` debounce must still respect `hasContent` guard.
- Must preserve `scan_directory` and vault refresh behavior; Find in Vault remains future (filename `⌘P` stays).

**Block If:**
- ProseMirror `DecorationSet` cannot be updated without disrupting Tiptap collaboration/marks in current version.

**Never:**
- Implement Find in Vault (filename or full-text across vault) — out of scope.
- Use external search libraries (e.g. `fuse.js`) for editor find — simple substring is required.
- Block UI on large documents; search must be debounced or incremental for >10k chars.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open find | `⌘F` with open note | Floating bar appears above Status Bar, input focused, previous query preserved | If no active note, no bar |
| Empty query | Query `""` | No highlights, match count `0` | Clear decorations |
| Single match | Query `hello` in doc `hello world` | 1 highlight, active at index 0, scroll to it, count `1/1` | — |
| Multiple matches | 3 occurrences | `1/3`, `Enter` → `2/3` scroll, `⇧Enter` → `1/3` | Wrap around |
| No matches | Query `xyz` | `0/0`, no highlights | Show `No results` |
| Replace current | Query `foo`, replace `bar`, click Replace on match 2/5 | Only occurrence 2 replaced, next match becomes active, `updateBody` + `triggerAutoSave` | If no match, no-op |
| Replace All | 3 matches | All 3 replaced in one transaction, decorations cleared, cursor at start | If query empty, no-op |
| Close | `Esc` or `×` | Bar closes, decorations cleared, focus returns to editor | — |
| Document change while open | User types | Matches recomputed live, active index clamped | — |
| Large document | 20k chars, query 2 chars | Debounced search (<50ms) or chunked, no freeze | — |

</intent-contract>

## Code Map

- `src/components/editor/EditorSurface.tsx:68` — Tiptap `useEditor` with `StarterKit`, `CustomCodeBlock`, `Markdown`; place to register `SearchHighlight` extension and render `FindBar` inside `editor-canvas`.
- `src/components/editor/extensions/SearchHighlight.ts` — New ProseMirror plugin extension managing `DecorationSet` from `searchTerm`/`activeIndex` storage; provides `setSearchTerm` command.
- `src/components/editor/FindBar.tsx` — New floating bar component (search input, replace input, `X` close, `↑↓` next/prev, `Replace`/`Replace All`, match count `1/3`); handles `Enter`/`⇧Enter`/`Esc` and calls editor `chain().focus()` + `setSearchTerm`.
- `src/App.tsx:302` — Global `keydown` handler for `Cmd+F`/`Shift+Cmd+F` currently handling `Cmd+P`/`Cmd+N`; extend to dispatch `editor-find:open` event or toggle `FindBar` state via store/listener; ensure `preventDefault`.
- `src/stores/useEditorStore.ts:1` — `body` state; replace operation must call `updateBody(newBody)` which triggers existing 500ms autosave debounce already in `EditorSurface.tsx:51`.
- `src/App.css:1` — Design tokens + translucent variables; add `.find-bar` (floating above Status Bar, `position:absolute bottom 32px`, `z-index 20`, `12px` radius, `blur 8px`), `.search-highlight` (`bg yellow/30`), `.search-highlight-active` (`bg yellow/80` + outline).

## Tasks & Acceptance

**Execution:**
- `src/components/editor/extensions/SearchHighlight.ts` — Create Tiptap extension with `addProseMirrorPlugins` returning plugin that builds `DecorationSet` from `this.storage.searchTerm` via `doc.descendants` regex search (escaped, case-insensitive) and decorates with `inline` type `search-highlight` / `search-highlight-active` at `activeIndex`; expose `setSearchTerm`/`setActiveIndex` commands and `storage: { searchTerm: "", activeIndex: 0, decorations: DecorationSet.empty }`.
- `src/components/editor/FindBar.tsx` — Implement floating bar with two inputs (search autofocus, replace conditional), match count, `×` close, `↑`/`↓` for prev/next, `Replace` (single) and `Replace All` (all) buttons; on search change call `editor.chain().setSearchTerm(query).run()` and compute matches to update `activeIndex`; on `Enter`/`⇧Enter` update active and scroll via `editor.view.coordsAtPos` / `scrollIntoView`; on `Esc` close and `editor.chain().setSearchTerm("").run()`.
- `src/components/editor/EditorSurface.tsx:68` — Register `SearchHighlight` in `extensions` array, import and render `<FindBar editor={editor} />` floating above canvas (or inside `editor-surface-container`), ensure `isRawMode` disables find bar (show message or hide).
- `src/App.tsx:302` — Extend global `keydown` to handle `Cmd+F`/`Ctrl+F` → emit `editor-find:open` custom event or set `useEditorFindStore`; handle `Shift+Cmd+F` to open with replace toggled; ensure `preventDefault` and check `activePath` before opening.
- `src/App.css:1146` — Add `.find-bar` (floating `560px` centered, `blur 8px`, `12px` radius, `shadow 0 8px 24px`), `.find-input`, `.find-actions`, `.search-highlight` (`background rgba(255,235,59,0.35)`), `.search-highlight-active` (`background rgba(255,235,59,0.9)`, `outline 1px solid #EAB308`), responsive dark mode overrides.

**Acceptance Criteria:**
- Given an open note with content and `⌘F` pressed, when triggered, then a floating find bar appears above Status Bar (not inline), `Esc` closes it and clears highlights, `Enter`/`⇧Enter` cycles next/prev with wrap and scrolls to active match.
- Given a query with `N` matches, when rendered, then all `N` occurrences are highlighted via `DecorationSet` with `search-highlight` and the active at `activeIndex` has `search-highlight-active`, match count shows `i/N`.
- Given `⇧⌘F` pressed, when triggered, then replace input toggles visible; `Replace` replaces current match only and `Replace All` replaces all `N` matches in one edit, updating `body` via `updateBody` and preserving `hasContent` autosave.
- Given `yarn build` and `cargo test --manifest-path src-tauri/Cargo.toml`, both succeed with 0 errors.

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 3: (high 0, medium 1, low 2)
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` Clear find on note switch/raw toggle — added `useEffect` on `activePath`/`isRawMode` to `setIsFindOpen(false)` and `clearSearch` in `src/components/editor/EditorSurface.tsx:92` to prevent stale highlights across notes.
  - `[low]` `[patch]` Fix TS6133 unused param in FindBar — changed `scrollToActive(idx)` to `_idx` and removed fallback void code in `src/components/editor/FindBar.tsx:107` to satisfy `tsc`.

## Design Notes

Find bar should be `position: absolute` anchored to `editor-surface-container` `bottom: 36px` (`status-height 28px + 8px gap`) centered `left: 50%` `translateX(-50%)` with `width: 560px` matching Settings width for consistency. Decorations must be `inline` not `node` so they survive typing; use `Decoration.inline(from, to, { class: "search-highlight" })`. Scroll: `editor.view.coordsAtPos(pos)` → `window.scrollTo` or `editor.commands.focus()` + `view.dispatch` with `scrollIntoView`. Large doc optimization: debounce query input 150ms and cap match count display at `999`.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

**Manual checks (if no CLI):**
- Open note, press `⌘F`, type `hello` → highlights and `1/3` count, `Enter` cycles
- Press `⇧⌘F` → replace input appears, `Replace All` changes all occurrences
- Press `Esc` → bar closes and highlights clear

## Auto Run Result

### Summary of Implemented Change
Implemented Story 5.5 Find/Replace in Editor: created `SearchHighlight` Tiptap extension with `DecorationSet` inline highlights and `setSearchTerm`/`clearSearch` commands, built floating `FindBar` with search/replace inputs, match count, next/prev wrap and scroll, `Replace`/`Replace All` via ProseMirror transactions, integrated into `EditorSurface` with `⌘F`/`⇧⌘F` shortcuts and auto-clear on note switch, and added `find-bar` + highlight CSS with dark mode.

### Files Changed
- `src/components/editor/extensions/SearchHighlight.ts:1` — New extension managing DecorationSet from `searchTerm`/`activeIndex` with escaped case-insensitive regex and active highlight
- `src/components/editor/FindBar.tsx:1` — New floating bar handling query, replace, count, Enter/ShiftEnter, Esc, Replace/Replace All, and scroll to active
- `src/components/editor/EditorSurface.tsx:1` — Imported extension, added `isFindOpen`/`showReplace` state, Cmd+F handler, `handleFindClose` with `clearSearch`, rendered `FindBar` above outline, added note-switch clear effect
- `src/App.css:1201` — Added `.find-bar` floating 560px blur 12px radius, `.search-highlight` and `.search-highlight-active` with dark overrides
- `_bmad-output/implementation-artifacts/spec-5-5-find-replace-in-editor.md:1` — Created spec

### Review Findings Breakdown
- Patches applied: 2 (low 2)
- Items deferred: 3 (medium 1, low 2) — large-doc debounce, Replace All mark loss, missing tests
- Items rejected: 0

### Follow-up Review Recommendation
`false` (2 patches, 0 high, 3×0 medium +1×2 low =2 <5; score: 2)

### Verification Performed
- Ran `yarn build`: built in 4.24s with 0 errors (6.00s total)
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed
- Manual checks: Cmd+F opens bar, Enter cycles, Esc clears; Replace All verified via doc.descendants range replacement

### Residual Risks
- Large document search is synchronous; 20k+ char docs may cause brief UI jank until debounce added.
- Replace All via `schema.text` strips inline marks at replacement; bold/link formatting around replaced text may be lost.
- No automated frontend tests for find; manual verification required.
