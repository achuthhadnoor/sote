---
title: 'Scrollable tables and 400px window min width'
type: 'feature'
created: '2026-09-09'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# Scrollable tables and 400px window min width

## Intent

**Problem:** Wide markdown tables crush into the editor column instead of scrolling, and the window floor of 1100px blocks narrow layouts the product now wants.

**Approach:** Let table blocks size to content and scroll horizontally; lower Tauri `min_inner_size` width to 400 while keeping height 600.

## Suggested Review Order

**Horizontal table scroll**

- Table sizes to content; cells stay nowrap so wide grids overflow into a scrollport.
  [`App.css:886`](../../src/App.css#L886)

- Wrapper shrinks in flex/prose; scroll lives on `.snipnote-table-container` only.
  [`TableNodeView.tsx:95`](../../src/components/editor/extensions/TableNodeView.tsx#L95)

**Window floor**

- Hard min width dropped from 1100 → 400 (height unchanged).
  [`lib.rs:356`](../../src-tauri/src/lib.rs#L356)
