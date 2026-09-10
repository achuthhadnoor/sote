import type { JSONContent } from "@tiptap/core";

/** True when markdown has no meaningful note content (empty or empty ATX heading only). */
export function isBlankNoteMarkdown(body: string): boolean {
  const t = body.trim();
  return t.length === 0 || /^#{1,6}\s*$/.test(t);
}

/** TipTap JSON for a new/empty note: bare Heading 1. */
export const EMPTY_H1_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "heading", attrs: { level: 1 }, content: [] }],
};
