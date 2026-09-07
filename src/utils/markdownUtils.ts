/**
 * Normalizes and repairs over-escaped markdown formatting produced by
 * serializer roundtrips or plain text paste (e.g. \*\*bold\*\*, \`code\`, \_italic\_).
 * Preserves code blocks from modification.
 */
export function healEscapedMarkdown(md: string): string {
  if (!md) return md;

  // If there are no backslashes or encoded ampersands, return fast
  if (!md.includes("\\") && !md.includes("&amp;")) {
    return md;
  }

  // Protect fenced code blocks (```...```) from any replacement
  const codeBlocks: string[] = [];
  let protectedMd = md.replace(/(```[\s\S]*?```)/g, (match) => {
    codeBlocks.push(match);
    return `\x00CODEBLOCK_${codeBlocks.length - 1}\x00`;
  });

  protectedMd = protectedMd
    // 1. Task checkboxes: - \[ \] or - \[x\] or - \[X\]
    .replace(/\\\[([ xX])\\\]/g, "[$1]")
    // 2. Bold pairs: \*\*text\*\*
    .replace(/\\\*\\\*(.*?)\\\*\\\*/g, "**$1**")
    // 3. Leading bold on list item: - \*\* or * \*\*
    .replace(/^(\s*[-*+]\s*)\\\*\\\*/gm, "$1**")
    // 4. Inline code: \`code\` with unescaped inner delimiters
    .replace(/\\`([^`\n]+)\\`/g, (_m, code) => "`" + code.replace(/\\([_*\\])/g, "$1") + "`")
    // 5. Strikethrough: \~\~text\~\~
    .replace(/\\~\\~(.*?)\\~\\~/g, "~~$1~~")
    // 6. Escaped tildes (e.g. \~3 s)
    .replace(/\\~/g, "~")
    // 7. Italic pairs: \_text\_
    .replace(/\\_([^_ \n][^_\n]*?)\\_/g, "_$1_")
    // 8. Standalone escaped underscores in words/identifiers (e.g. cleanup\_export)
    .replace(/([a-zA-Z0-9])\\_([a-zA-Z0-9])/g, "$1_$2")
    // 9. Accidental HTML-encoded ampersands outside code blocks
    .replace(/&amp;/g, "&");

  // Restore protected code blocks
  return protectedMd.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_m, index) => {
    return codeBlocks[parseInt(index, 10)] ?? "";
  });
}

/**
 * CommonMark (and marked) reject link/image destinations that contain raw
 * spaces unless they are wrapped in angle brackets:
 *   [Kitchen Sink](Projects/Kitchen Sink.md)     → plain text
 *   [Kitchen Sink](<Projects/Kitchen Sink.md>)   → link
 * Note apps often write the first form; wrap those destinations so TipTap
 * can render them. Skips fenced and inline code.
 */
export function normalizeMarkdownLinkDestinations(md: string): string {
  if (!md || !md.includes("](")) return md;

  const protectedChunks: string[] = [];
  let out = md.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    protectedChunks.push(match);
    return `\x00MDCHUNK_${protectedChunks.length - 1}\x00`;
  });

  out = out.replace(/(!?\[)([^\]]*)\]\(([^)\n]*)\)/g, (full, open, text, dest) => {
    const trimmed = dest.trim();
    if (!trimmed || /^<[^>\n]*>/.test(trimmed)) return full;

    // Optional title: href "title" | 'title' | (title)
    const withTitle = trimmed.match(
      /^([\s\S]+?)(\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))\s*$/
    );
    const href = (withTitle ? withTitle[1] : trimmed).trim();
    const titlePart = withTitle ? withTitle[2] : "";

    if (!/\s/.test(href)) return full;
    if (href.startsWith("<") && href.endsWith(">")) return full;

    return `${open}${text}](<${href}>${titlePart})`;
  });

  return out.replace(/\x00MDCHUNK_(\d+)\x00/g, (_m, index) => {
    return protectedChunks[parseInt(index, 10)] ?? "";
  });
}

/** Prepare note/paste markdown for TipTap's marked-based parser. */
export function prepareMarkdownForEditor(md: string): string {
  return normalizeMarkdownLinkDestinations(healEscapedMarkdown(md));
}

/** Serialize a markdown link/image destination, angle-bracketing if needed. */
export function formatMarkdownLinkDestination(href: string, title?: string | null): string {
  const needsBrackets = /[\s()]/.test(href);
  const dest = needsBrackets ? `<${href}>` : href;
  if (!title) return dest;
  const safeTitle = title.replace(/"/g, '\\"');
  return `${dest} "${safeTitle}"`;
}
