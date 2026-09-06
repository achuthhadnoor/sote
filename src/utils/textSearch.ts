export interface TextSearchMatch {
  from: number;
  to: number;
}

interface TextSegment {
  text: string;
  from: number;
  start: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Search the document's logical inline text and map matches back to PM positions. */
export function findTextMatches(doc: any, query: string): TextSearchMatch[] {
  if (!query) return [];
  const segments: TextSegment[] = [];
  let text = "";
  let previousEnd: number | null = null;
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    if (previousEnd !== null && previousEnd !== pos) text += "\n";
    segments.push({ text: node.text as string, from: pos, start: text.length });
    text += node.text as string;
    previousEnd = pos + node.nodeSize;
  });

  const matches: TextSearchMatch[] = [];
  const regex = new RegExp(escapeRegExp(query), "gi");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const first = segments.find((segment) => start >= segment.start && start < segment.start + segment.text.length);
    const last = segments.find((segment) => end > segment.start && end <= segment.start + segment.text.length);
    if (first && last) {
      matches.push({
        from: first.from + start - first.start,
        to: last.from + end - last.start,
      });
    }
    if (match[0].length === 0) regex.lastIndex++;
  }
  return matches;
}
