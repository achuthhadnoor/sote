/**
 * Product-scoped localStorage helpers.
 * Reads the new `sote-*` key first; if missing, migrates once from the legacy `snipnote-*` key.
 */

function legacyKey(key: string): string | null {
  if (key.startsWith("sote-")) return `snipnote-${key.slice("sote-".length)}`;
  return null;
}

/** Read a product key, migrating from the legacy snipnote-* key when present. */
export function getProductItem(key: string): string | null {
  try {
    const current = localStorage.getItem(key);
    if (current != null) return current;
    const legacy = legacyKey(key);
    if (!legacy) return null;
    const old = localStorage.getItem(legacy);
    if (old == null) return null;
    localStorage.setItem(key, old);
    return old;
  } catch {
    return null;
  }
}

/** Write a product key (new namespace only). */
export function setProductItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}
