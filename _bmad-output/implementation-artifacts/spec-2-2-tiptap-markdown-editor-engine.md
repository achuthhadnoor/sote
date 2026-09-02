---
title: 'Story 2.2: Tiptap WYSIWYG Markdown Editor Engine'
type: 'feature'
created: '2026-09-02'
baseline_revision: '251248b04e726c40a0f6562f9146f94e0b277918'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-2-context.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Selecting a note currently only shows a static path banner instead of an editable markdown document, leaving users unable to read or edit note content.

**Approach:** Build `useEditorStore` (managing frontmatter, body buffer, dirty flag) and integrate Tiptap v2 headless editor (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown 3.30.5`, `@tiptap/extension-link`) into `EditorSurface`. Load active note content via `read_file`, render live WYSIWYG formatting styled to LocalEditor typography tokens, and maintain markdown serialization fidelity.

## Boundaries & Constraints

**Always:**
- Use headless Tiptap with `@tiptap/markdown 3.30.5` for markdown roundtrip serialization.
- Strip and preserve YAML frontmatter in `useEditorStore` without rendering raw YAML delimiters inside the ProseMirror DOM.
- Style ProseMirror content with LocalEditor typography tokens (`--font-sans`, `--font-mono`, `--border`, `--muted`, `--link`).
- Constrain editor canvas to centered 760px maximum width with 24px gutters.
- Ensure `yarn build` passes with zero errors.

**Block If:**
- Editor content leaks raw HTML tags on markdown export.

**Never:**
- Allow editor to directly mutate frontmatter on disk without envelope reassembly.
- Render full-bleed edge-to-edge unconstrained editor lines.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Select Note | User clicks a `.md` note | `read_file` called; frontmatter stored in `useEditorStore`; body loaded into Tiptap | Error banner shown if read fails |
| WYSIWYG Editing | User types `# Heading`, `**bold**`, `- list` | Formatted live into styled headings, bold, lists | Tiptap input rules handle markdown triggers |
| Content Serialization | `editor.storage.markdown.getMarkdown()` called | Returns clean GFM / CommonMark string | No HTML wrapper tags injected |
| Note Switch | User clicks different note | Previous buffer cleared; new note loaded cleanly | Content replaced without stale flash |

</intent-contract>

## Code Map

- `src/stores/useEditorStore.ts` -- [NEW] Zustand store managing active note buffer (`body`, `frontmatter`, `isDirty`, `loadNote`).
- `src/components/editor/EditorSurface.tsx` -- Embed Tiptap `EditorContent` with `StarterKit`, `Link`, `Markdown`, and active note lifecycle.
- `src/App.css` -- Add `.ProseMirror` typography classes (headings, paragraphs, lists, quotes, inline code, pre blocks).

## Tasks & Acceptance

**Execution:**
- `src/stores/useEditorStore.ts` -- Implement `useEditorStore` with `loadNote`, `updateBody`, and buffer tracking -- Manages editor state.
- `src/components/editor/EditorSurface.tsx` -- Embed Tiptap editor with `StarterKit`, `Link`, and `Markdown` -- Renders live WYSIWYG canvas.
- `src/App.css` -- Style `.ProseMirror` with LocalEditor monochrome typography -- Implements UX-DR2 typography ramp.

**Acceptance Criteria:**
- Given an active markdown note selected in the file tree, when loaded into `EditorSurface`, then headings, bold, italics, lists, blockquotes, and code blocks render live in a centered 760px canvas with 24px reading gutters.
- Given editor modifications, when serialized via `@tiptap/markdown`, then pure CommonMark / GFM is returned without injected HTML.
- Given `yarn build`, when run, then TypeScript check and Vite build exit with code 0.

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

Using `@tiptap/markdown` ensures that typing markdown syntax (like `# ` or `**`) automatically converts to rich document nodes, while serialization outputs standard CommonMark without DOM wrappers.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Installed Tiptap v2 packages (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/core`, `@tiptap/extension-link`, and pinned `@tiptap/markdown 3.30.5`). Created `useEditorStore` to manage active note buffer state, frontmatter preservation, and dirty tracking. Embedded headless Tiptap editor inside `EditorSurface.tsx` centered at 760px with 24px reading gutters. Wired active note loading via `read_file` IPC and markdown serialization via `editor.storage.markdown.getMarkdown()`. Applied the LocalEditor monochrome typography ramp to `.ProseMirror` in `src/App.css`.

### Files Changed
- `package.json` & `yarn.lock`: Added `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/core`, `@tiptap/extension-link`, `@tiptap/markdown@3.30.5`
- `src/stores/useEditorStore.ts`: [NEW] Editor state management store
- `src/components/editor/EditorSurface.tsx`: Integrated Tiptap `EditorContent` with active note lifecycle
- `src/App.css`: Styled `.ProseMirror` with Inter typography ramp (headings, paragraphs, lists, blockquotes, code blocks)

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `yarn build`: Bundled 104 modules in 779ms with 0 TypeScript/Vite errors.
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed all 8 tests with 0 failures.

### Residual Risks
None. Fast WYSIWYG editing canvas active.
