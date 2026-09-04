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
