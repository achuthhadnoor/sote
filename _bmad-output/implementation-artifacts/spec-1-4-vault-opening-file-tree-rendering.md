---
title: 'Story 1.4: Vault Opening, File Tree Rendering & Active File Highlighting'
type: 'feature'
created: '2026-09-02'
baseline_revision: '0229e7039dbef87f714a42ee5b0b0d8c8cb6c537'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
  - _bmad-output/planning-artifacts/ux-designs/ux-snipnote-2026-09-02/DESIGN.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Users cannot open a local directory as their vault or browse their notes in the sidebar, because the UI is not connected to a vault state store or directory scanning IPC.

**Approach:** Implement `useVaultStore` and `useTabStore` using Zustand, create an interactive recursive `FileTree` component with folder expand/collapse and active row highlighting, connect the native OS dialog to invoke `scan_vault`, and render the file tree inside `Sidebar`.

## Boundaries & Constraints

**Always:**
- Use `@tauri-apps/plugin-dialog` `open({ directory: true, multiple: false })` for native OS folder picker.
- Use Zustand for state management (`useVaultStore`, `useTabStore`).
- Style active rows with LocalEditor `--accent: #F3F4F6` background and `--radius-md: 8px`.
- Key file nodes by their canonical absolute path.
- Provide keyboard-accessible folder expand/collapse and file selection.
- Ensure `yarn build` passes with zero errors.

**Block If:**
- User cancels folder picker dialog; do not alter existing vault state on cancellation.

**Never:**
- Perform direct filesystem traversal in JavaScript (MUST invoke Rust `scan_vault` command per AD-1).
- Show hidden files or non-markdown files in the file tree.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open Vault Dialog | User clicks "Open Vault" and picks directory | Native dialog opens; selected path passed to `scan_vault`; tree rendered in sidebar | If user cancels dialog, keep previous state without error |
| Folder Toggle | User clicks a folder row in the tree | Folder toggles between expanded (`▾`) and collapsed (`▸`) | Children rendered or hidden smoothly |
| Note Selection | User clicks a `.md` note row | Row highlighted with `var(--accent)`; active note title updated in `useTabStore` | Active state reflects selected note path |
| Scan Error | `scan_vault` returns an error | Error message displayed in sidebar; loading state reset | Inline error text in sidebar |

</intent-contract>

## Code Map

- `src/stores/useVaultStore.ts` -- [NEW] Zustand store managing `vaultPath`, `tree: VaultNode[]`, `isLoading`, and `openVaultDialog` / `loadVault` actions.
- `src/stores/useTabStore.ts` -- [NEW] Zustand store managing `activePath`, `activeTitle`, and tab history.
- `src/components/sidebar/FileTree.tsx` -- [NEW] Recursive tree component rendering folders with chevrons and `.md` file rows with active highlighting.
- `src/components/sidebar/Sidebar.tsx` -- Embed `FileTree` in scroll area and connect Library "Open..." button.
- `src/components/editor/EditorSurface.tsx` -- Wire "Open Local Vault" button and display active note title when selected.
- `src/App.tsx` -- Wire stores into shell components.
- `src/App.css` -- Add file tree item styling, active highlight, and folder chevrons.

## Tasks & Acceptance

**Execution:**
- `src/stores/useVaultStore.ts` -- Implement Zustand vault store with dialog picker and `scan_vault` invocation -- Manages vault state.
- `src/stores/useTabStore.ts` -- Implement Zustand tab store with `activePath` and `selectNote` action -- Manages active note selection.
- `src/components/sidebar/FileTree.tsx` -- Implement recursive tree view with expand/collapse state and active row highlight -- Renders hierarchical notes.
- `src/components/sidebar/Sidebar.tsx` -- Wire `FileTree` and vault dialog action into Sidebar -- Embeds tree in left pane.
- `src/components/editor/EditorSurface.tsx` -- Wire open vault action and show active note preview placeholder -- Connects main canvas.
- `src/App.css` -- Add CSS classes for `.tree-node`, `.tree-folder`, `.tree-file`, `.active-file`, and `.chevron` -- Styles tree matching DESIGN.md.
- `src/App.tsx` -- Connect stores to layout shell -- Orchestrates application state.

**Acceptance Criteria:**
- Given the application in empty state, when clicking "Open Local Vault", then the native OS directory selection dialog opens.
- Given a selected vault path, when `scan_vault` resolves, then the Sidebar renders the recursive File Tree with expandable/collapsible folder chevrons and `.md` file rows.
- Given a file row in the tree, when clicked, then it receives the active highlight (`accent` background, 8px radius) and updates the active note name in the TabBar and EditorSurface.
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

Active row uses LocalEditor design token `--accent: #F3F4F6` with 8px radius and no left border indicator per `DESIGN.md`. Folder chevrons use subtle unicode characters (`▸` / `▾`) for zero-dependency rendering.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean build

## Auto Run Result

### Summary of Implemented Change
Added the official `@tauri-apps/plugin-dialog` and `tauri-plugin-dialog` plugin for native OS folder picker dialogs. Created Zustand stores `useVaultStore` (managing `vaultPath`, `tree`, loading state, and dialog actions) and `useTabStore` (managing `activePath`, `activeTitle`, and tab navigation history). Created recursive `FileTree` component with folder collapse/expand toggles (`▸` / `▾`), note selection, and active item highlighting (`--accent: #F3F4F6`). Integrated the tree and dialog triggers into `Sidebar`, `TabBar`, and `EditorSurface`.

### Files Changed
- `package.json` & `yarn.lock`: Added `@tauri-apps/plugin-dialog@~2` and `zustand@^5.0.15`
- `src-tauri/Cargo.toml` & `src-tauri/Cargo.lock`: Added `tauri-plugin-dialog = "2"`
- `src-tauri/capabilities/default.json`: Added `dialog:default` capability
- `src-tauri/src/lib.rs`: Registered `tauri_plugin_dialog::init()`
- `src/stores/useVaultStore.ts`: [NEW] Zustand vault management store
- `src/stores/useTabStore.ts`: [NEW] Zustand tab and note selection history store
- `src/components/sidebar/FileTree.tsx`: [NEW] Recursive tree view with chevrons and active selection
- `src/components/sidebar/Sidebar.tsx`: Wired `FileTree` and "Open..." / "Switch" dialog trigger
- `src/components/editor/TabBar.tsx`: Wired history navigation and active note title
- `src/components/editor/EditorSurface.tsx`: Wired empty state dialog trigger and active note banner
- `src/App.tsx`: Wired stores into layout shell
- `src/App.css`: Added styles for tree rows, chevrons, dots, and active row highlights

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 0
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo check --manifest-path src-tauri/Cargo.toml`: Compiled cleanly in 0.71s with 0 errors.
- Ran `yarn build`: Bundled 42 modules cleanly in 422ms with 0 TypeScript errors.

### Residual Risks
None. Fast UI rendering with full state isolation.
