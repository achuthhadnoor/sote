---
title: 'Story 1.2: LocalEditor Design System & Shell Wireframe'
type: 'feature'
created: '2026-09-02'
baseline_revision: 'db514dbf7a4846e42d9a7c24cf553f8779407d52'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The app currently renders the default Vite/Tauri logo greeting counter instead of the snipnote 2-pane + 2-bar desktop layout, and lacks the LocalEditor design tokens.

**Approach:** Implement the CSS design token system in `src/App.css` (or `index.css`) matching `DESIGN.md`, and build the component layout shell: a fixed 260px `Sidebar`, a 40px `TabBar`, a centered 760px `EditorSurface`, and a 24px `StatusBar`.

## Boundaries & Constraints

**Always:**
- Apply exact LocalEditor monochrome tokens (`--bg: #FFFFFF`, `--sidebar: #F8F8F9`, `--border: #EAEAEA`, `--primary: #0F0F0F`, `--muted: #F6F6F7`, `--muted-foreground: #6B7280`, `--accent: #F3F4F6`, `--link: #2563EB`).
- Enforce layout geometry: 260px fixed Sidebar, 40px Header TabBar, 24px StatusBar, centered 760px EditorSurface canvas with 24px horizontal padding.
- Use Inter / SF Pro Text typography ramp with clean font-smoothing.
- Ensure `yarn build` passes with zero TypeScript or CSS errors.

**Block If:**
- Saturated non-monochrome color accents or dark mode toggles are requested (v1 is light-first monochrome per DESIGN.md).

**Never:**
- Allow full-bleed edge-to-edge unconstrained text in the editor area (must be constrained to max 760px).
- Use third-party CSS utility frameworks like Tailwind without specification (vanilla CSS variables used).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| App Mount | App launches in Tauri window | Full viewport 2-pane + 2-bar shell rendered | Clean flex layout, no scrollbars on outer shell |
| Window Resize | User resizes window down to 800x600 or up | Sidebar stays 260px; EditorSurface remains centered at 760px max width | No layout clipping or overlap |
| Typography Render | System renders sans body | Inter / SF Pro Text font applied cleanly | Fallback to system-ui sans-serif |

</intent-contract>

## Code Map

- `src/App.css` -- Root CSS variables, typography reset, and shell layout styles.
- `src/components/sidebar/Sidebar.tsx` -- 260px fixed Sidebar container with Search header, File Tree scroll area, and Library footer.
- `src/components/editor/TabBar.tsx` -- 40px header bar with history arrows, active note title, and `+` button.
- `src/components/editor/EditorSurface.tsx` -- Centered 760px canvas with 24px gutters and placeholder welcome message.
- `src/components/editor/StatusBar.tsx` -- 24px quiet status bar docked at bottom with right-aligned metrics.
- `src/App.tsx` -- Main application layout orchestrator assembling Sidebar and Editor column.

## Tasks & Acceptance

**Execution:**
- `src/App.css` -- Define all design tokens (`--bg`, `--sidebar`, `--border`, `--fg`, etc.) and flexbox layout classes -- Establishes visual theme.
- `src/components/sidebar/Sidebar.tsx` -- Create Sidebar component wireframe with Search input header, tree container, and Library footer -- Fulfills UX-DR3 and UX-DR4 container.
- `src/components/editor/TabBar.tsx` -- Create TabBar component with navigation controls and active note title -- Fulfills UX-DR3 and UX-DR6 container.
- `src/components/editor/EditorSurface.tsx` -- Create centered 760px editor canvas with reading gutters -- Fulfills UX-DR3 editor container.
- `src/components/editor/StatusBar.tsx` -- Create quiet 24px status bar component -- Fulfills UX-DR3 and UX-DR7 container.
- `src/App.tsx` -- Replace boilerplate with modular shell assembling Sidebar, TabBar, EditorSurface, and StatusBar -- Wireframes the full application.

**Acceptance Criteria:**
- Given the launched application, when rendered, then the screen displays a fixed 260px Sidebar on the left, a 40px Header TabBar on top, a centered 760px maximum width main canvas with 24px gutters, and a 24px StatusBar at the bottom.
- Given the CSS design tokens, when evaluated, then the palette implements `#FFFFFF` (canvas), `#F8F8F9` (sidebar), `#EAEAEA` (hairlines), `#0F0F0F` (primary), `#F6F6F7` (muted), `#6B7280` (muted-foreground), and `#2563EB` (link blue), along with the Inter/system sans typography ramp.
- Given `yarn build`, when run, then TypeScript compilation and Vite bundling exit with code 0.

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

Monochrome palette directly reflects `DESIGN.md` and LocalEditor.app. Fixed sidebar at 260px avoids jumpiness before folder tree population. Centered 760px reading column guarantees ergonomic line length for markdown notes.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean TypeScript check and Vite bundle

## Auto Run Result

### Summary of Implemented Change
Implemented the LocalEditor monochrome design token palette (`#FFFFFF` canvas, `#F8F8F9` sidebar, `#EAEAEA` hairlines, `#0F0F0F` primary, `#F6F6F7` muted, `#6B7280` muted-foreground, `#2563EB` link blue, Inter typography) in `src/App.css`. Created modular components for the application shell: 260px fixed `Sidebar`, 40px Header `TabBar`, centered 760px max-width `EditorSurface` with reading gutters, and 24px `StatusBar`. Assembled the layout in `src/App.tsx`.

### Files Changed
- `src/App.css`: Root design tokens and layout classes for the 2-pane + 2-bar desktop layout
- `src/components/sidebar/Sidebar.tsx`: [NEW] 260px fixed sidebar with search header and library footer
- `src/components/editor/TabBar.tsx`: [NEW] 40px header bar with history arrows and new note button
- `src/components/editor/EditorSurface.tsx`: [NEW] Centered 760px reading/writing canvas with empty state
- `src/components/editor/StatusBar.tsx`: [NEW] 24px status bar docked at bottom with word/char/paragraph counters
- `src/App.tsx`: Replaced template counter demo with modular app layout shell

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `yarn build`: Passed (`tsc && vite build` bundled 33 modules in 324ms with 0 errors).
- Ran `cargo check --manifest-path src-tauri/Cargo.toml`: Passed with 0 errors.

### Residual Risks
None. Clean component wireframe ready for data wiring in Stories 1.3 & 1.4.
