/** Normalize filesystem paths for safe comparisons across native event sources. */
export function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/+$/, "");
  return normalized.length > 1 ? normalized.toLocaleLowerCase() : normalized;
}

export function canonicalPath(value: string, root?: string): string {
  const normalized = normalizePath(value);
  if (!root || /^(?:[a-z]:\/|\/)/i.test(normalized)) return normalized;
  return normalizePath(joinPath(root, normalized));
}

export function isPathWithin(path: string, root: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function joinPath(root: string, child: string): string {
  return `${root.replace(/[\\/]+$/, "")}/${child.replace(/^[\\/]+/, "")}`;
}
