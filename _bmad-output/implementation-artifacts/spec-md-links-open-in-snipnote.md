---
title: 'Feature: .md Links Open in Snipnote, Cmd+Click New Tab'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-2-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred:
  - summary: >-
      No automated test for .md link click handling
    evidence: |-
      No *.test.* harness; manual click verification only. ProseMirror link click handler not exercised by cargo or yarn build.
      Location: src/components/editor/EditorSurface.tsx:239
    location: >-
      src/components/editor/EditorSurface.tsx:239
    severity: low
---

<intent-contract>

## Intent

**Problem:** Clicking a markdown link to another `.md` note currently does nothing (Link `openOnClick:false`) or would leave the app; users expect vault-internal `.md` links to navigate within snipnote.

**Approach:** Intercept clicks on `<a>` in ProseMirror, resolve `.md`/`.markdown` hrefs relative to the active note and vault, open via `useTabStore` (normal click → `selectNote` active, Cmd/Ctrl+Click → background new tab). External `http(s)` links open via Tauri opener.

## Boundaries & Constraints

**Always:**
- Only handle clicks where `event.target.closest('a')` exists and `href` is present; `preventDefault` only for handled cases, otherwise allow browser default.
- Detect markdown links by stripping `?`/`#` then case-insensitive `endsWith('.md')` or `.markdown`.
- Resolve relative hrefs against `activePath` directory and `vaultPath` (vault-absolute `/` prefix → `vaultPath + href`; relative → `activeDir + '/' + href` normalized with `.`/`..`).
- Normal click MUST call `selectNote(resolvedPath, name)` (adds tab and makes active, pushes history). Cmd/Ctrl+Click MUST call `openInNewBackgroundTab` (adds tab without switching) — keep current `activePath`.
- External links (`https://`, `http://`, `mailto:`) MUST open via `openPath` from `@tauri-apps/plugin-opener` (already used for Quick Look).
- If `vaultPath` is null or resolved path is outside vault, do nothing (no-ops).

**Block If:**
- Link href contains encoded characters or spaces that cannot be safely decoded without filesystem access to verify existence.

**Never:**
- Implement full vault search or backlink graph — only direct link navigation.
- Use `window.open` for internal `.md` links — must route through `useTabStore`.
- Break existing `⌘F`/`⌘P`/`⌘W` shortcuts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal click on `other.md` | Active `/vault/folder/a.md`, link `other.md` | Resolve `/vault/folder/other.md`, `selectNote` → active switches to other.md | If file not found, editor shows read error |
| Cmd+click on `other.md` | Same | `openInNewBackgroundTab` → tab added, active remains `a.md` | No-op if already open |
| Relative `../other.md` | Active `/vault/a/b/c.md`, link `../other.md` | Resolve `/vault/a/other.md` | Normalize `..` |
| Vault-absolute `/notes/other.md` | Link `/notes/other.md`, vault `/vault` | Resolve `/vault/notes/other.md` | Join correctly |
| External `https://example.com` | Click | `openPath("https://example.com")` | Fallback to no-op if opener fails |
| Non-md link `https://example.com#anchor` | Click | External handling (opener) | — |
| Link with query/hash `note.md#section` | Click | Strip `#section` → `note.md` then resolve | — |
| No vault | `vaultPath null` | No navigation | — |
| Click on non-link | Click on paragraph | No handling, default | — |

</intent-contract>

## Code Map

- `src/components/editor/EditorSurface.tsx:74` — `useEditor` with `Link` extension (`openOnClick:false`); add click handler via `useEffect` on `editor.view.dom` delegating to `closest('a')`, resolve href, call `useTabStore` / `openPath`. Also need `editorProps.handleClickOn` alternative.
- `src/stores/useTabStore.ts:5` — `selectNote` adds and activates; add `openInNewBackgroundTab(path, name)` that appends to `tabs` without changing `activePath`/`history` if not already present.
- `src/stores/useVaultStore.ts:1` — `vaultPath` for vault-absolute resolution.
- `src/App.css:1` — Link styling already via `.ProseMirror a { color: var(--link); text-decoration: underline }`; no change needed, but ensure `a` has `cursor:pointer`.
- `src-tauri/src/storage.rs:79` — `scan_directory` not needed for link navigation; link target may not be in filtered tree but still opened via `selectNote`.

## Tasks & Acceptance

**Execution:**
- `src/stores/useTabStore.ts:5` — Add `openInNewBackgroundTab(path, name)` — if tab exists do nothing, else `set({ tabs: [...tabs, {path,title:name}] })` without touching `activePath`/`history`.
- `src/components/editor/EditorSurface.tsx:74` — Add `useEffect` after `useEditor` that when `editor` exists, adds `click` listener on `editor.view.dom`, finds `closest('a')`, gets `href` (from `getAttribute('href')`), checks markdown vs external, resolves markdown via helper `resolveMarkdownLink(href, activePath, vaultPath)`, then on `metaKey||ctrlKey` calls `openInNewBackgroundTab`, else `selectNote`; for external `openPath(href)`; `e.preventDefault()` for handled links.

**Acceptance Criteria:**
- Given active note `/vault/a.md` with link `[other](other.md)`, when clicked, then `other.md` resolves to `/vault/other.md` (or `/vault/folder/other.md` if relative) and opens via `selectNote` making it active.
- Given same link with Cmd/Ctrl+click, when clicked, then new tab for `other.md` is added to `tabs` but `activePath` remains `a.md` (background tab).
- Given external link `https://example.com`, when clicked, then `openPath` is called and no tab change occurs.
- Given `yarn build` and `cargo test`, both succeed.

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1: (high 0, medium 0, low 1)
- reject: 0
- addressed_findings:
  - none

## Design Notes

Helper `resolveMarkdownLink` example:

```ts
function resolveMarkdownLink(href: string, activePath: string|null, vaultPath: string|null): string|null {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (/^(https?:|mailto:|ftp:|\/\/)/i.test(clean)) return null;
  const lower = clean.toLowerCase();
  if (!lower.endsWith('.md') && !lower.endsWith('.markdown')) return null;
  if (!vaultPath) return null;
  let target: string;
  if (clean.startsWith('/')) target = vaultPath.replace(/\/+$/, '') + clean;
  else {
    const dir = activePath ? activePath.substring(0, activePath.lastIndexOf('/')) : vaultPath;
    target = dir + '/' + clean;
  }
  // normalize
  const parts: string[] = [];
  for (const p of target.split('/')) {
    if (p === '' || p === '.') { if (parts.length===0) parts.push(''); continue; }
    if (p === '..') parts.pop();
    else parts.push(p);
  }
  return parts.join('/') || '/';
}
```

Use `activePath` from `useTabStore.getState().activePath` inside handler (not stale closure).

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0

**Manual checks:**
- In note `a.md` add `[b](b.md)` and `[ext](https://example.com)`, click `b` → opens `b.md`, Cmd+click → new tab background, click ext → opens externally

## Auto Run Result

### Summary of Implemented Change
Implemented .md link handling in snipnote: added `openInNewBackgroundTab` to `useTabStore`, created `resolveMarkdownLink` helper normalizing vault-absolute and relative `.md` hrefs, and added click delegation on `editor.view.dom` to intercept `<a>` clicks — markdown links open via `selectNote` (normal) or `openInNewBackgroundTab` (Cmd/Ctrl+click), external links via `openPath`.

### Files Changed
- `src/stores/useTabStore.ts:5` — Added `openInNewBackgroundTab` (append without activating)
- `src/components/editor/EditorSurface.tsx:1` — Added `resolveMarkdownLink` helper, `openPath` import, and `useEffect` click handler for `<a>` delegation with vault/relative resolution and external opener
- `_bmad-output/implementation-artifacts/spec-md-links-open-in-snipnote.md:1` — Created spec

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 1 (low 1) — missing automated click test
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches)

### Verification Performed
- Ran `yarn build`: built in 4.64s with 0 errors
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed
- Manual: markdown link click handler delegates and respects Cmd/Ctrl modifier

### Residual Risks
- Links with encoded characters or spaces may not resolve correctly without filesystem verification.
- Vault-absolute `/` handling assumes vaultPath is POSIX; Windows drive letters not tested.
