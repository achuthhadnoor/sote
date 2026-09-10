import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Default interactive targets that should not start a window drag. */
export const WINDOW_CHROME_DRAG_INTERACTIVE =
  'button, input, [role="button"], a';

/**
 * Primary-button drag region handler: double-click toggles maximize,
 * otherwise starts window dragging. Ignores clicks on interactive children.
 */
export function createWindowChromeDragHandler(
  interactiveSelector: string = WINDOW_CHROME_DRAG_INTERACTIVE
): (e: ReactMouseEvent) => void {
  return (e) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest(interactiveSelector)) return;
    if (e.detail === 2) {
      getCurrentWindow().toggleMaximize().catch(() => {});
      return;
    }
    getCurrentWindow().startDragging().catch(() => {});
  };
}
