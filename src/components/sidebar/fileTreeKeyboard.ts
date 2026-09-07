import type { KeyboardEvent } from "react";

export function getVisibleTreeItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));
}

export function focusTreeItem(el: HTMLElement | null | undefined) {
  if (!el) return;
  const items = getVisibleTreeItems();
  items.forEach((item) => {
    item.tabIndex = -1;
  });
  el.tabIndex = 0;
  el.focus();
}

export function moveTreeFocus(current: HTMLElement, direction: "up" | "down") {
  const items = getVisibleTreeItems();
  const idx = items.findIndex((el) => el === current);
  if (idx === -1) return;
  const nextIdx =
    direction === "down" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
  focusTreeItem(items[nextIdx]);
}

function findParentTreeItem(current: HTMLElement): HTMLElement | null {
  return (
    (current.closest(".tree-dir-item")?.parentElement?.closest(
      '[role="treeitem"]'
    ) as HTMLElement | null) ?? null
  );
}

export interface FileTreeKeyboardOptions {
  isDirectory: boolean;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  openNote: () => void;
  openWithDefault: () => void;
}

/** Roving-focus keyboard handling for a single treeitem. */
export function handleFileTreeKeyDown(
  e: KeyboardEvent,
  opts: FileTreeKeyboardOptions
): void {
  const current = e.currentTarget as HTMLElement;

  if (e.key === " " && !opts.isDirectory) {
    e.preventDefault();
    opts.openWithDefault();
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveTreeFocus(current, "down");
    return;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    moveTreeFocus(current, "up");
    return;
  }

  if (opts.isDirectory && e.key === "ArrowRight") {
    e.preventDefault();
    if (!opts.isOpen) {
      opts.setOpen(true);
    } else {
      const items = getVisibleTreeItems();
      const idx = items.findIndex((el) => el === current);
      focusTreeItem(items[idx + 1]);
    }
    return;
  }

  if (opts.isDirectory && e.key === "ArrowLeft") {
    e.preventDefault();
    if (opts.isOpen) {
      opts.setOpen(false);
    } else {
      focusTreeItem(findParentTreeItem(current));
    }
    return;
  }

  if (e.key === "Enter" || (e.key === " " && opts.isDirectory)) {
    e.preventDefault();
    if (opts.isDirectory) {
      opts.setOpen(!opts.isOpen);
    } else {
      opts.openNote();
    }
  }
}
