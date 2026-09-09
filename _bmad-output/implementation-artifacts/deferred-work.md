# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-scrollable-tables-and-min-width-400.md`
  summary: Planning docs still document window min `1100×600` after code floor dropped to 400.
  evidence: PRD, ARCHITECTURE-SPINE, epics, and UX DESIGN/EXPERIENCE still state min 1100×600 while `src-tauri/src/lib.rs` uses `min_inner_size(400.0, 600.0)`.

- source_spec: `_bmad-output/implementation-artifacts/spec-scrollable-tables-and-min-width-400.md`
  summary: Open library sidebar at 400px window leaves a near-unusable editor strip.
  evidence: `--sidebar-width` is 280px (or `min(280px, 82vw)` under 720px ≈ 328px at 400px), with no auto-collapse when the new min width is reached.

- source_spec: `_bmad-output/implementation-artifacts/spec-scrollable-tables-and-min-width-400.md`
  summary: Table Edit/Copy controls stay pinned over the right edge while scrolling horizontally.
  evidence: Absolute-positioned action row in `TableNodeView.tsx` overlays the scrollport; pre-existing, not introduced by scroll CSS.
