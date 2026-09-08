/** Cross-platform filesystem path helpers for link resolution. */

/** True for Unix absolute, Windows drive (`C:\` / `C:/`), or UNC (`\\server\…`). */
export function isAbsoluteFsPath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith("/")) return true;
  if (/^[a-zA-Z]:[/\\]/.test(p)) return true;
  if (p.startsWith("\\\\")) return true;
  return false;
}

/**
 * Absolute paths that are clearly host filesystem roots (not vault-relative
 * markdown links like `/docs/intro.md`).
 */
export function isHostAbsolutePath(p: string): boolean {
  if (/^[a-zA-Z]:[/\\]/.test(p) || p.startsWith("\\\\")) return true;
  return (
    p.startsWith("/Users/") ||
    p.startsWith("/home/") ||
    p.startsWith("/Volumes/") ||
    p.startsWith("/var/") ||
    p.startsWith("/tmp/") ||
    p.startsWith("/private/")
  );
}

/** Directory portion of a path (handles `/` and `\`). */
export function pathDirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(0, i) : p;
}

/** Join base + relative with the separator style of `base`. */
export function pathJoin(base: string, relative: string): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  const trimmed = base.replace(/[/\\]+$/, "");
  const rel = relative.replace(/^[/\\]+/, "");
  return `${trimmed}${sep}${rel}`;
}

/** Resolve `.` / `..` segments while preserving Windows drive / UNC roots. */
export function normalizeFsPath(target: string): string {
  const unc = target.startsWith("\\\\");
  const sep = unc || (target.includes("\\") && !target.startsWith("/")) ? "\\" : "/";
  const rawParts = target.split(/[/\\]/);
  const parts: string[] = [];

  for (let i = 0; i < rawParts.length; i++) {
    const p = rawParts[i];
    if (p === "" || p === ".") {
      // Keep leading empty (Unix root) or drive root empties after `C:`
      if (parts.length === 0 && (sep === "/" || unc)) parts.push("");
      continue;
    }
    if (p === "..") {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(p);
  }

  if (unc) {
    return "\\\\" + parts.filter(Boolean).join("\\");
  }
  // Drive letter: ["C:", "Users", ...] → C:\Users\...
  if (parts.length > 0 && /^[a-zA-Z]:$/.test(parts[0])) {
    return parts[0] + "\\" + parts.slice(1).join("\\");
  }
  const joined = parts.join(sep);
  return joined || (sep === "/" ? "/" : joined);
}
