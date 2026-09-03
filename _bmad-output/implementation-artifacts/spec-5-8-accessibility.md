---
title: 'Story 5.8: Accessibility'
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
      No automated axe/ VoiceOver test for aria roles and roving tabindex
    evidence: |-
      No jest-axe or playwright a11y test harness; manual VoiceOver rotor and Tab order verification only. yarn build and cargo test do not exercise aria attributes.
      Location: src/components/sidebar/FileTree.tsx:30
    location: >-
      src/components/sidebar/FileTree.tsx:30
    severity: low
  - summary: >-
      High contrast 2px border not snapshot-tested
    evidence: |-
      @media (prefers-contrast: more) rule added but not verified via automated style assertion; relies on manual OS setting.
      Location: src/App.css:2704
    location: >-
      src/App.css:2704
    severity: low
---

<intent-contract>

## Intent

**Problem:** Keyboard and screen-reader users cannot navigate vault, tabs, palette, or stats without a mouse, and High Contrast mode lacks sufficient border contrast.

**Approach:** Add ARIA roles and attributes to File Tree, TabBar, palette, status, outline, and ensure roving tabindex keyboard order plus `prefers-contrast` border increase, matching AD-5 and UX-DR.

## Boundaries & Constraints

**Always:**
- File Tree MUST have `role="tree"` on container, each folder row `role="treeitem"` `aria-expanded="true|false"`, each file row `role="treeitem"` `aria-selected="true|false"` for active, and roving `tabIndex` (0 for active/first, -1 others) with arrow-key navigation (Up/Down moves focus, Enter selects, Right expands, Left collapses).
- TabBar MUST have `role="tablist"` on scroll container and each tab `role="tab"` `aria-selected="true|false"` (already `is-active` but add aria), `aria-controls` if applicable, and `Tab`/`Shift+Tab` order integration.
- Outline MUST have `role="navigation"` `aria-label="Document outline"` (already done at `MarkdownOutline.tsx:152` but verify).
- CommandPalette MUST have `role="dialog"` `aria-modal="true"` (already) plus `aria-live="polite"` on list and `aria-selected` on highlighted item.
- StatusBar MUST have `aria-live="polite"` `aria-atomic="true"` for stats.
- `prefers-contrast: more` MUST increase `--border` to `2px` and ensure outline/border colors meet high contrast (keep vibrant fallback opaque as in 5.6).
- Full keyboard Tab order MUST be: `Sidebar Search (tabIndex 0)` → `File Tree` (roving) → `Library` footer `Switch`/`gear` → `TabBar +` → `Editor` (`ProseMirror` `tabIndex 0`) → `StatusBar Raw toggle` → `Settings` (when open). `Esc` from any panel returns focus to Editor.

**Block If:**
- Roving tabindex requires ProseMirror to expose `tabIndex` that conflicts with Tiptap's internal focus management.

**Never:**
- Remove existing SVG icons or vibrant translucency — only augment with ARIA.
- Implement custom screen-reader announcements beyond `aria-live` — use native roles.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| File Tree with VoiceOver | Rotor → Headings/Landmarks, arrow keys | `role=tree` with `treeitem` `aria-expanded` for folders, `aria-selected` for active file, focus moves with arrows | If no tree, no role |
| TabBar with VoiceOver | Rotor tabs | `tablist` with `tab` `aria-selected` true for active, `is-active` visual matches | — |
| CommandPalette open | `⌘P` | `role=dialog` `aria-modal` + list `aria-live` and selected `aria-selected` | If closed, no live region |
| StatusBar stats | Body changes | `aria-live="polite"` announces `X words …` | No duplicate announcements |
| Full Keyboard Tab | Press `Tab` from Sidebar Search | Focus moves to File Tree first item (roving 0), next Tab to Library `Switch`, next to `+`, next to Editor, next to `Raw` toggle | `Shift+Tab` reverse |
| File Tree arrow nav | Focus on File Tree item, press `↓` | `tabIndex` roves to next visible node (skip collapsed children), `focus()` moves | Wrap or stop at ends |
| Folder expand/collapse | Focus on folder, press `Right`/`Left` or `Enter`/`Space` | `aria-expanded` toggles, children show/hide, focus stays | — |
| High Contrast OS | `prefers-contrast: more` | `--border` is `2px` solid, borders more visible | — |
| No vault | Empty state | No `role=tree` rendered | — |

</intent-contract>

## Code Map

- `src/components/sidebar/FileTree.tsx:30` — `file-tree` container `role="tree"` needed; `FileTreeNode` folder/file rows `role="treeitem"` `aria-expanded`/`aria-selected` + roving `tabIndex` + `onKeyDown` for arrows; currently has `tabIndex 0` on all items, needs roving.
- `src/components/editor/TabBar.tsx:1` — `tabs-scroll` container `role="tablist"` and `tab-item` `role="tab"` `aria-selected`; currently has scroll but no ARIA.
- `src/components/palette/CommandPalette.tsx:1` — `palette-overlay` `role="dialog"` `aria-modal`, `palette-list` `aria-live="polite"` and `palette-item` `aria-selected` for highlighted index.
- `src/components/editor/StatusBar.tsx:1` — `status-bar` container `aria-live="polite"` `aria-atomic="true"` for word/char/paragraph stats.
- `src/components/editor/MarkdownOutline.tsx:131` — already `role="navigation"` `aria-label="Document outline"` on `outline-floating`; verify `aria-hidden` on dashes when expanded.
- `src/components/sidebar/Sidebar.tsx:26` — `sidebar-search-input` `tabIndex 0`, `sidebar-footer` buttons `tabIndex 0`; ensure Tab order via natural DOM order + roving.
- `src/App.css:1` — add `@media (prefers-contrast: more)` rule to increase `--border` and border widths.

## Tasks & Acceptance

**Execution:**
- `src/components/sidebar/FileTree.tsx:30` — Add `role="tree"` `aria-label="Vault files"` to `.file-tree` container; make `FileTreeNode` folder: `role="treeitem"` `aria-expanded={isOpen}` `aria-selected={false}` `tabIndex={isActiveNode ? 0 : -1}` (roving), file: `role="treeitem"` `aria-selected={isActive}` `tabIndex={isActive ? 0 : -1}`; implement `onKeyDown` for `ArrowUp`/`ArrowDown` (roving), `ArrowRight` expand, `ArrowLeft` collapse, `Enter`/`Space` select/toggle; manage roving via `useRef` list or `document.querySelectorAll('[role="treeitem"]')` focus.
- `src/components/editor/TabBar.tsx:1` — Add `role="tablist"` `aria-label="Open tabs"` to `.tabs-scroll`; each `.tab-item` add `role="tab"` `aria-selected={isActive}` `tabIndex={isActive ? 0 : -1}` `aria-controls` pointing to editor id; ensure `Tab` key moves into TabBar and arrows cycle via existing `Ctrl/⌘+Tab` plus `ArrowLeft`/`ArrowRight` for a11y.
- `src/components/palette/CommandPalette.tsx:1` — Ensure `palette-overlay` has `role="dialog"` `aria-modal="true"` `aria-label="Command palette"`, `palette-list` has `role="listbox"` `aria-live="polite"`, each `palette-item` has `role="option"` `aria-selected={isSelected}`; keep existing `Up`/`Down`/`Enter`/`Esc`.
- `src/components/editor/StatusBar.tsx:1` — Add `role="status"` `aria-live="polite"` `aria-atomic="true"` to `.status-bar` or `.status-stats` containing `X words | Y characters | Z paragraphs`.
- `src/App.css:1` — Add `@media (prefers-contrast: more) { :root { --border: #000; } .tree-row, .tab-item, .outline-panel, .status-bar { border-width: 2px; } }` and ensure high contrast border colors meet AA.

**Acceptance Criteria:**
- Given VoiceOver rotor, when navigating File Tree, then `role=tree` and `treeitem` `aria-expanded`/`aria-selected` are exposed and arrow keys move roving focus with `tabIndex 0` only on active.
- Given TabBar with VoiceOver, when rotor tabs, then `tablist`/`tab` `aria-selected` matches visual `is-active`.
- Given `Tab` from Sidebar Search, when pressed, then focus order is Search → File Tree (roving) → Library `Switch`/`gear` → TabBar `+` → Editor → StatusBar `Raw` toggle → Settings (if open), `Esc` returns to Editor.
- Given `prefers-contrast: more`, when enabled, then `--border` renders as `2px` and borders are high contrast (verified via computed style).
- Given `yarn build` and `cargo test`, both succeed.

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 2: (high 0, medium 0, low 2)
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` Remove duplicate isActive/isRovingActive declarations in FileTreeNode that caused TS2451 and left roving tabIndex broken at `src/components/sidebar/FileTree.tsx:131`.
  - `[low]` `[patch]` Fix TabBar roving: Tab store `tabs` vs `tabsEls` confusion at `src/components/editor/TabBar.tsx:104` where `tab.getAttribute` failed on `Tab` interface; changed to `el.getAttribute`.

## Design Notes

Roving tabindex pattern: only one `treeitem` has `tabIndex 0` (the active or first visible), others `-1`; on `ArrowUp`/`ArrowDown`, move `tabIndex` and `focus()`. For TabBar, roving is simpler: active tab `0`, others `-1`, but `Tab` should enter TabBar at active tab then `ArrowLeft`/`ArrowRight` roves. Keep existing `Ctrl/⌘+Tab` cycling for power users plus a11y arrows. High contrast: use `@media (prefers-contrast: more)` and `:root { --border: #000 }` etc., but preserve dark theme `[data-theme="dark"]` override to `#fff` or `#EDEEF0` border.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

**Manual checks:**
- VoiceOver rotor → File Tree headings show `treeitem` expanded/selected
- Tab through UI → focus order as spec, Esc returns to Editor
- System → Accessibility → Increase contrast → borders 2px

## Auto Run Result

### Summary of Implemented Change
Implemented Story 5.8 Accessibility: added `role="tree"`/`treeitem` with `aria-expanded`/`aria-selected` and roving `tabIndex` plus arrow-key navigation to FileTree, `role="tablist"`/`tab` with roving and `ArrowLeft`/`Right`/`Home`/`End` to TabBar, `aria-live` `role="dialog"` `listbox`/`option` to CommandPalette, `role="status"` `aria-live` to StatusBar, `role="navigation"` retained on MarkdownOutline, and `@media (prefers-contrast: more)` 2px border increase.

### Files Changed
- `src/components/sidebar/FileTree.tsx:14` — Added `role="tree"` `aria-label`, `role="treeitem"` `aria-expanded`/`aria-selected`, roving `tabIndex` via `rovingPath`, arrow-key handlers, `role="group"` for nested, native folder menu retained with SVG icons
- `src/components/editor/TabBar.tsx:86` — Moved `role="tablist"` to `tabs-scroll`, added `aria-selected` `tabIndex` roving and `onKeyDown` for arrows, `aria-controls` and focus handling
- `src/components/palette/CommandPalette.tsx:147` — Added `aria-live="polite"` `aria-label="Note results"` to list
- `src/components/editor/StatusBar.tsx:31` — Added `role="status"` `aria-live="polite"` `aria-atomic="true"` to footer and `aria-live` to stats span
- `src/App.css:2704` — Added `@media (prefers-contrast: more)` with `--border` `#000`/`#fff` and `border-width:2px` for tree/tab/outline/status
- `src/components/editor/EditorSurface.tsx:236` — Added Esc-to-editor focus handler for chrome elements
- `_bmad-output/implementation-artifacts/spec-5-8-accessibility.md:1` — Created spec

### Review Findings Breakdown
- Patches applied: 2 (low 2)
- Items deferred: 2 (low 2) — axe tests, high-contrast snapshot
- Items rejected: 0

### Follow-up Review Recommendation
`false` (2 patches, 0 high, 0 medium, 2 low =2 <5)

### Verification Performed
- Ran `yarn build`: built in 4.32s with 0 errors
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed

### Residual Risks
- Roving tabindex for deeply nested collapsed trees relies on DOM query of visible `treeitem`s; if virtualized later may need stored focus index.
- No automated VoiceOver test — manual rotor verification required.
- `prefers-contrast: more` 2px border may need per-component fine-tuning for dark theme AA.
