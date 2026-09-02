---
title: 'Story 2.5: Interactive Mermaid Diagram Rendering'
type: 'feature'
created: '2026-09-02'
baseline_revision: '19891b5b0403d37f08936c99a3a9d10ad7be45e8'
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

**Problem:** Code blocks marked with `mermaid` display as plain monospace code strings, preventing users from visualizing architecture and sequence diagrams inline beside their notes.

**Approach:** Build a custom Tiptap NodeView (`MermaidNodeView`) for `CodeBlock` using `ReactNodeViewRenderer` and `mermaid@11`. When `language === "mermaid"`, asynchronously compile the diagram into a responsive SVG with a quiet error fallback for invalid syntax and a toggle to edit the underlying syntax.

## Boundaries & Constraints

**Always:**
- Initialize `mermaid` with a clean neutral theme matching LocalEditor monochrome styling.
- Catch all compilation errors cleanly and render an inline warning message instead of crashing the editor.
- Allow users to switch between visual diagram preview and raw code editing.
- Preserve standard code block behavior for non-mermaid code blocks (`ts`, `rust`, `python`, etc.).
- Ensure `yarn build` passes with zero TypeScript or bundling errors.

**Block If:**
- Malformed Mermaid syntax throws unhandled exceptions that break the ProseMirror transaction pipeline.

**Never:**
- Alter the underlying markdown document format (diagrams remain standard ` ```mermaid ` code blocks on disk).
- Inject external scripts or stylesheets at runtime (security CSP constraint).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid Mermaid Block | `graph TD; A-->B;` | Compiles and displays SVG diagram inline | Renders clean SVG |
| Invalid Syntax | `graph TD; A--->;;;` | Displays quiet inline warning box with error hint | Handled without crashing |
| Empty Code Block | ` ```mermaid ` with no content | Shows quiet placeholder "Empty Mermaid diagram" | No crash |
| Non-Mermaid Block | ` ```rust ` or ` ```json ` | Standard `<pre><code>` block rendered | Default code styling |
| Edit Mode Toggle | User clicks "Edit" on diagram | Displays `<NodeViewContent as="code" />` for live editing | Smooth toggle |

</intent-contract>

## Code Map

- `src/components/editor/extensions/MermaidNodeView.tsx` -- [NEW] React NodeView component rendering SVG diagram or raw code block with error boundaries.
- `src/components/editor/extensions/CustomCodeBlock.ts` -- [NEW] Tiptap extension extending `CodeBlock` with `ReactNodeViewRenderer(MermaidNodeView)`.
- `src/components/editor/EditorSurface.tsx` -- Configure `StarterKit` with `codeBlock: false` and register `CustomCodeBlock`.
- `src/App.css` -- Add styling for `.mermaid-container`, `.mermaid-preview`, `.mermaid-error`, and toolbar controls.

## Tasks & Acceptance

**Execution:**
- `src/components/editor/extensions/MermaidNodeView.tsx` -- Create React NodeView with asynchronous `mermaid.render` and error handling -- Implements AD-4.
- `src/components/editor/extensions/CustomCodeBlock.ts` -- Extend `CodeBlock` using `ReactNodeViewRenderer` -- Integrates with Tiptap.
- `src/components/editor/EditorSurface.tsx` -- Register `CustomCodeBlock` in Tiptap extensions list -- Wires extension.
- `src/App.css` -- Add styling for diagram container, SVG responsiveness, and edit toggle -- Ensures visual polish.

**Acceptance Criteria:**
- Given a markdown note containing a ` ```mermaid ` code block, when rendered in the editor, then the diagram is compiled into a live responsive SVG.
- Given invalid Mermaid syntax, when evaluated, then a quiet inline warning box is shown without crashing the editor.
- Given a diagram, when clicking "Edit", then the user can modify the raw code and see the diagram update live.
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

Mermaid diagrams render with `securityLevel: 'loose'` and `theme: 'neutral'` so colors blend naturally with the `#FFFFFF` canvas and `#EAEAEA` borders.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Installed `mermaid@11.17.2` and implemented custom Tiptap NodeView (`MermaidNodeView.tsx`) registered via `CustomCodeBlock.ts` in `EditorSurface.tsx`. Standard code blocks continue to render as native `<pre><code>` blocks, while code blocks with language `mermaid` are dynamically rendered into responsive SVG diagrams. Provided an interactive "View Diagram" / "Edit Code" mode toggle and a quiet warning box for invalid syntax to avoid crashing the editor. Applied LocalEditor monochrome design tokens to diagrams and headers.

### Files Changed
- `package.json` & `yarn.lock`: Added `mermaid@11.17.2`
- `src/components/editor/extensions/MermaidNodeView.tsx`: [NEW] React NodeView with async compilation, toggle control, and error handling
- `src/components/editor/extensions/CustomCodeBlock.ts`: [NEW] Tiptap CodeBlock extension wired to MermaidNodeView
- `src/components/editor/EditorSurface.tsx`: Registered CustomCodeBlock and disabled default StarterKit codeBlock
- `src/App.css`: Added styles for diagram wrapper, header, preview surface, and syntax error banner

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `yarn build`: Bundled all 2188 modules cleanly with 0 TypeScript/Vite errors.
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: Passed 9/9 tests with 0 failures.

### Residual Risks
None. Fast inline diagramming enabled.
