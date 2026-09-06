# Snipnote — Full Frontend & Backend Issues Audit

**Date:** 2026-09-06
**Repo:** `/Users/achuth/data/Developer/apps/snipnote/snipnote`
**Method:** Two parallel subagents — one frontend-only (`src/` React 19 + Vite 7 + Tauri 2, Tiptap 3, Zustand 5, Tailwind v4), one backend-only (`src-tauri/` Rust + Tauri config). All findings evidence-based with file:line refs. `npx tsc --noEmit` passes.
**Scope:** No `server/`, `api/`, `backend/` — backend is Tauri Rust core: `src-tauri/src/*.rs` + `tauri.conf.json` + `capabilities/default.json` + `Cargo.toml`. IPC surface (`lib.rs:201-219`): `scan_vault`, `read_file`, `write_file`, `create_note`, `rename_path`, `delete_path`, `create_file_at_path`, `create_folder_at_path`, `copy_external_file`, `get_session`, `save_session`, `watch_vault`, `unwatch_vault`, `frontend_log`, `get_log_path`, `add_recent_vault`, `reveal_window`.

---

# PART 1 — FRONTEND (`src/`)

## 1. Critical

### C1 — Global “borderless mode” nukes every border, outline, and focus ring
**Severity:** Critical · **File:** `src/App.css:702-723` (contradicts `src/App.css:238-250`)
```css
*, *::before, *::after {
  border-width: 0 !important;
  border-style: none !important;
  outline: none !important;
}
.ctx-sep, .ProseMirror hr { background: transparent !important; }
```
**Description:** Wildcard `!important` strips borders/outlines app-wide, including `:focus-visible` rings defined 460 lines earlier, dialog/input/table borders, `outline-dashed` drag states (`src/components/sidebar/FileTree.tsx:224`), and `<hr>`.
**Impact:** Keyboard focus invisible (WCAG 2.4.7 failure), inputs/dialogs/tables lose structure, `prefers-contrast: more` border boost at `App.css:632-651` is dead code.
**Fix:** Delete block. If “borderless” is a feature, scope to explicit class (e.g. `.borderless .card { border:0 }`) and never touch `outline` / `:focus-visible`.

### C2 — Stored XSS via unsanitized `marked` HTML in table node view
**Severity:** Critical · **File:** `src/components/editor/extensions/TableNodeView.tsx:37-43,170-174`
```ts
const html = useMemo(() => marked.parse(raw) as string, [raw]);
<div dangerouslySetInnerHTML={{ __html: html }} />
```
**Description:** `raw` is vault file content. `marked.parse` preserves raw HTML by default; output is injected without DOMPurify/sanitization.
**Impact:** Malicious `.md` (shared vault, pasted content, synced file) with `<img onerror=…>`, `<svg onload=…>`, `<a href="javascript:…">` executes in Tauri webview with IPC access.
**Fix:** `npm i dompurify` + `DOMPurify.sanitize(marked.parse(raw))`, or set `marked` to escape HTML. Add test with payload.

### C3 — `mermaid.securityLevel: "loose"` + raw SVG injection
**Severity:** Critical · **File:** `src/components/editor/extensions/MermaidNodeView.tsx:292-303,616-626`
```ts
mermaid.initialize({ securityLevel: "loose", ... });
<div dangerouslySetInnerHTML={{ __html: svgHtml }} />
```
**Description:** `loose` explicitly allows click-interactions / JS URLs in diagrams. SVG string (post-processed by regex `toMonochrome`) is injected unsanitized.
**Impact:** Crafted ```mermaid block → script execution. Regexes are not a sanitizer.
**Fix:** `securityLevel: "strict"`, sanitize SVG with DOMPurify (`FORBID_TAGS: ['script','foreignObject']`, strip `on*`).

### C4 — Silent data loss: close/tab-switch before 500 ms autosave flush
**Severity:** Critical · **Files:** `src/components/editor/TabBar.tsx:68-72`, `src/App.tsx:439-446`, `src/components/editor/EditorSurface.tsx:290-305,561-628`, `src/stores/useEditorStore.ts:92-98`
**Description:** Autosave debounced 500 ms. `closeTab` closes immediately with no dirty/draft check. `beforeunload` calls async `saveNow` (IPC) without awaiting. Drafts (`isNew`) with only whitespace are never saved but `isDirty` stays true; session persist at `App.tsx:160` filters `!t.isNew`, so drafts vanish on restart.
**Impact:** Typing + `Cmd+W`/tab switch/quit within 500 ms loses characters; whitespace-only drafts discarded.
**Fix:** Flush synchronously on close (await `saveNow` before `closeTab`), confirm dialog for dirty/draft close, persist drafts to `localStorage` or temp file.

## 2. High

### H1 — `handleNewNote` recreated each render; native-menu effect re-subscribes every render
**File:** `src/App.tsx:256-286,289-347,431-481` — `const handleNewNote` no `useCallback` in deps `[handleNewNote, setTheme]`. Every render tears down + re-`listen()`s 10+ Tauri events. Keyboard effect deps omit `handleNewNote` → stale closure.
**Fix:** `useCallback(..., [])`, fix effect deps.

### H2 — Pasted/dropped images inlined as unbounded base64 data-URLs
**File:** `src/components/editor/EditorSurface.tsx:342-367,368-394,328-330` — `FileReader.readAsDataURL` → `setImage` with `allowBase64:true`. No size/count check.
**Impact:** Single screenshot inflates `.md` to MBs; full markdown in Zustand + ProseMirror + IPC `write_file` every 500 ms → jank, disk bloat.
**Fix:** Reject/warn >1–2 MB, downscale/compress, or save to vault `assets/` and insert relative path. Validate `file.type` + `file.size`.

### H3 — Cross-platform path bugs + `endsWith` false-positive reload
**Files:** `src/App.tsx:97-109,192,263-285`, `src/components/editor/EditorSurface.tsx:143-184`, `HomeView.tsx:22-28`, `TabBar.tsx:195`
- Titles via `p.split("/").pop()` break on Windows `\`.
- `changedPath.endsWith(currentActive)` matches `/vault/a/note.md` vs `note.md` in another folder → wrong reload / false conflict banner.
- `resolveMarkdownLink` hardcodes `/Users/`, `/home/`, `/Volumes/`, `/var/`, `/tmp/` — misses Windows drives.
**Fix:** Central `pathUtils` (split on `/[\\/]/`, normalize, compare normalized absolute), use Tauri path APIs.

### H4 — Vault watcher leak + full-rescan race, no cancellation
**File:** `src/stores/useVaultStore.ts:43-61` — `loadVault` awaits `scan_vault`, then `invoke("watch_vault")` every call without `unwatch`. Concurrent loads race — last finisher wins.
**Fix:** Request token/cancel, `unwatch_vault` before `watch_vault` on switch, debounce + single-flight.

### H5 — `window.prompt` / `alert` / `confirm` for all file operations, no validation
**Files:** `src/utils/nativeContextMenu.ts:44,55,62,71,139,165,173,185,222,234,242,252`, `src/components/sidebar/FileContextMenu.tsx:80,110,117,130,137,146,153,160` — Blocking native dialogs, unstyled, often broken in Tauri. Names sent raw to `create_file_at_path`/`rename_path` — no check for `/`, `\`, `..`, `\0`, reserved names, duplicates.
**Fix:** Custom Radix dialog with validation, toast/inline errors, disable during IPC.

### H6 — FileTree keyboard + DnD semantics broken
**File:** `src/components/sidebar/FileTree.tsx:103-155,157-190`
- `Space` calls `openPath` (external app) while `Enter`/click opens in-app tab — violates ARIA tree pattern.
- Arrow nav queries `document.querySelectorAll('[role="treeitem"]')` globally, includes collapsed-hidden nodes.
- Roving `tabIndex` mutated via DOM instead of state.
- `DownloadURL` drag data embeds absolute `node.path`, leaking home-dir path.
**Fix:** `Space`/`Enter` both `selectNote`; skip hidden/collapsed; lift roving index to state; drop `DownloadURL` or use filename only.

### H7 — Invalid nested interactive + dangling ARIA in TabBar
**File:** `src/components/editor/TabBar.tsx:172-218` — `<button role="tab">` contains `<span role="button" onClick={handleClose}>` (not focusable, `preventDefault` blocks focus). `aria-controls={editor-${tab.path}}` points to no element.
**Fix:** Real `<button>` for close (stopPropagation); add matching `id`/`tabpanel` or remove `aria-controls`.

### H8 — Hand-rolled link classifier is wrong + double click handling
**File:** `src/components/editor/EditorSurface.tsx:32-103,105-184,186-248,419-424,517-532` — TLD whitelist misses most gTLDs (`.sh`, `.docs`, etc.) → `foo.sh` treated as note + `.md` appended. `ftp:` classified external but `openInExternalBrowser` only handles `https/mailto/tel`. `javascript:`/`data:` not blocklisted. Both `editorProps.handleClick` and capture-phase `dom.addEventListener("click",…,true)` invoke handler (fragile `defaultPrevented` ordering).
**Fix:** Single handler, allowlist `https/http/mailto/tel` → `openUrl`, vault-relative → internal, block `javascript:/data:/vbscript:/file:`; unit tests.

### H9 — RawEditor renders one div per line, steals focus
**File:** `src/components/editor/RawEditor.tsx:19,89-105,124,64-68` — `value.split("\n")` + `Array.from({length:lineCount})` no virtualization — 10k-line file = 10k nodes. `autoFocus` on every mount yanks focus. `handleWheel` without `preventDefault`.
**Fix:** Virtualize gutter or CSS counters, remove `autoFocus` (explicit action only).

### H10 — CommandPalette renders entire vault unbounded, no fuzzy rank
**File:** `src/components/palette/CommandPalette.tsx:44-50,73-89` — Empty query returns `allNotes` as `<CommandItem>`s no cap/virtualization; manual substring filter, `shouldFilter={false}`.
**Fix:** Cap 50–100, virtualize, ranked fuzzy (name > path, recency boost), debounce.

### H11 — Undeclared `marked` dependency (works by accident)
**Files:** `src/components/editor/extensions/TableNodeView.tsx:3`, `package.json:12-45` — `import { marked } from "marked"` but absent from `dependencies` (only `@tiptap/markdown`). Present transitively.
**Fix:** `yarn add marked` (pin) or replace with Tiptap serializer.

## 3. Medium

### M1 — ~700 lines dead UI shipped (never imported)
**Files:** `src/components/sidebar/FileContextMenu.tsx:1-288`, `src/components/rightPanel/RightPanel.tsx:1-142`, `TerminalPane.tsx`, `BrowserPane.tsx`, `CanvasPane.tsx` (App.tsx:514 “hidden for now”)
**Fix:** Delete or feature-flag; exclude from build.

### M2 — Triplicated vault flatten + Untitled-name logic
**Files:** `src/App.tsx:263-285`, `EditorSurface.tsx:671-695`, `CommandPalette.tsx:19-34`, `HomeView.tsx:14-34` — Three `flattenVaultTree` variants + two `Untitled` loops.
**Fix:** Single `src/utils/vaultTree.ts`.

### M3 — Frontmatter allows duplicate keys; raw-mode clobbers caret
**File:** `src/components/editor/FrontmatterTable.tsx:34-36,94-127,216,300-302,392-396` — No uniqueness check; `useEffect setRawText(frontmatter)` overwrites textarea each keystroke (cursor jump); `Number("")===0` saves `0`; `0x10`/`Infinity` as numbers.
**Fix:** Reject/merge dupes, sync raw only on external identity change, stricter number regex.

### M4 — Outline raw-mode navigation dead; change-detection never stabilizes
**File:** `src/components/editor/MarkdownOutline.tsx:70-76,134-155,139` — `querySelector(".raw-editor")` finds nothing; `id=slug-pos` shifts on edit → `sameOutline` false every keystroke; hover-only expand fails touch/keyboard; no Esc.
**Fix:** Pass textarea ref, stable id (`slug-index`), `onFocus/Blur` + Esc + `aria-current`.

### M5 — FindBar walks entire doc per keystroke, double-subscribed
**File:** `src/components/editor/FindBar.tsx:32-56,80-109,137-214` — `doc.descendants` + regex on query change + both `update` and `transaction`; `setTimeout(10ms)` races; replace dispatches raw `tr` + full `getMarkdown()` sync.
**Fix:** Debounce 100–150 ms, subscribe `update` only, derive count from decoration state.

### M6 — StatusBar recomputes stats per keystroke, spams SR, leaks home path
**File:** `src/components/editor/StatusBar.tsx:13-30,33-52` — `body.match(/\S+/g)` + `split` O(n) every keystroke; `role=status aria-live=polite` announces each keystroke; absolute `activePath` displayed.
**Fix:** Debounce/memo/worker, `aria-live="off"` for stats, show vault-relative path.

### M7 — Unversioned `localStorage`; pruning never wired
**Files:** `src/lib/logger.ts:140-150`, `src/stores/useRecentNotesStore.ts:28-71`, `useThemeStore.ts:40-59`, `useSpellCheckStore.ts:11-20` — No schema version/migration, silent quota failures. `pruneMissing`/`clearForVault` never called.
**Fix:** Version keys (`:v1`), call `pruneMissing` after `loadVault`, cap history, handle `QuotaExceededError`.

### M8 — Edits during `saveNow` never trigger follow-up save
**File:** `src/stores/useEditorStore.ts:100-134` — Guard leaves `isDirty:true` + `isSaving:false` but does not re-enqueue.
**Fix:** After write, if `body !== snapshotBody`, schedule `saveNow`.

### M9 — Rename/delete closes tabs before IPC, loses dirty buffer
**File:** `src/utils/nativeContextMenu.ts:135-188` (same in dead `FileContextMenu.tsx:77-133`) — `closeTab` + `selectNote` before/after `invoke("rename_path")` without flushing `isDirty`; folder rename loops per tab → races. Delete leaves `useEditorStore` body (next autosave recreates file).
**Fix:** `await saveNow` before rename/delete, update tabs via path-map, `clearNote` if active deleted.

### M10 — Sidebar search field is read-only fake input
**File:** `src/components/sidebar/Sidebar.tsx:61-68` — `readOnly` `<Input onClick={onOpenPalette}>`, not keyboard-activatable.
**Fix:** `<Button>` styled as field, or `role="button" tabIndex={0}` + `onKeyDown`.

### M11 — Settings `Option` remounts + autostart triple-toggle
**File:** `src/components/settings/SettingsDialog.tsx:57-85,226-272,29` — `Option` defined inside component → new type each render; autostart `onClick` + `onKeyDown` + `Switch onCheckedChange` can double-fire; `createLogger` per render.
**Fix:** Hoist `Option` + `log`, single `onCheckedChange`, loading state.

### M12 — `aria-describedby={undefined}` on dialogs
**Files:** `src/components/palette/CommandPalette.tsx:64`, `src/components/settings/SettingsDialog.tsx:92`
**Fix:** Add `<DialogDescription className="sr-only">` or remove prop.

### M13 — CanvasPane rect tool paints permanent trail; ignores theme/resize
**File:** `src/components/rightPanel/CanvasPane.tsx:43-50,79-84,16-41,109-127` — `strokeRect` every `mousemove` without snapshot → dashed trail; no resize observer; hardcoded `#FFFFFF`; mouse/touch cast, no pointer events.
**Fix:** Snapshot `ImageData`/offscreen, Pointer Events + `ResizeObserver`, theme-aware colors (moot if M1 deletes).

### M14 — BrowserPane iframe no URL validation, janky refresh
**File:** `src/components/rightPanel/BrowserPane.tsx:8-24,64-73` — Prepends `https://` to anything; refresh via `setUrl("")` blank flash + `key={url}` remount; `sandbox` allows scripts+same-origin; no error UI for `X-Frame-Options` block.
**Fix:** Validate `new URL()`, allowlist http(s), `iframeRef.contentWindow.location.reload()`, blocked-message timeout.

### M15 — Mermaid per-color DOM probes + regex recolor every diagram
**File:** `src/components/editor/extensions/MermaidNodeView.tsx:88-103,106-138,368-406` — `<span>` probe per color (layout thrash); `toMonochrome` 3 regex passes per theme (×2 pre-render) + serial queue.
**Fix:** Cache probes globally, prefer `themeVariables` only, memo by `(rawText, theme)`.

### M16 — Root `select-none` + sidebar collapse glitch
**Files:** `src/App.tsx:484-499`, `src/components/sidebar/Sidebar.tsx:43` — Root `select-none` forces opt-back; collapse `w-0 invisible` applies instantly so transition animates invisibly; `transition-[width]` layout thrash.
**Fix:** Remove root `select-none` (per-chrome only), animate `transform`/`grid-template-columns` or delay `visibility`.

### M17 — StrictMode double session restore; unsafe root cast
**Files:** `src/main.tsx:23-29`, `src/App.tsx:77-150` — StrictMode double-invokes `restoreSession` in dev → double IPC; `getElementById("root") as HTMLElement` throws outside `ErrorBoundary` if missing.
**Fix:** `isInitialized` ref + `AbortController`, null-check root.

## 4. Low / Hygiene

- **L1 — ~40 `as any` casts defeat `strict`:** `App.tsx:54,94,274,369,413,434`, `EditorSurface.tsx:343,352-353,383,403,427,474,483,521,592-593,607-644,683`, `FindBar.tsx:67-68,73,88,91,104,107,125,133,175,209`, `nativeContextMenu.ts:123`. Type IPC `invoke<T>`, use Tiptap types, add `eslint no-explicit-any`.
- **L2 — Deprecated `navigator.platform` (6 sites):** `EditorSurface.tsx:453`, `EditorBubbleMenu.tsx:53`, `nativeContextMenu.ts:17`, `FileContextMenu.tsx:191,260`, `TabBar.tsx:18-24`. Fix: `userAgentData?.platform` or Tauri OS plugin.
- **L3 — Deprecated `document.execCommand("copy")`:** `TableNodeView.tsx:61-71`, `MermaidNodeView.tsx:335-345`. Fix: `navigator.clipboard.writeText` + toast.
- **L4 — `index.html` metadata + shadcn alias drift:** `index.html:1-14`, `components.json:12-18`. Title lowercase, no description/theme-color; `hooks` alias but no `src/hooks/`.
- **L5 — No lint/test/typecheck scripts or CI:** `package.json:6-11`, no `eslint.config.*`, `vitest*`, `.github/workflows`. Only `dev/build/preview/tauri`. Zero tests for parsers/stores/outline. Fix: `typecheck`, `lint`, `test` (Vitest + Testing Library), Playwright smoke, GH Actions.
- **L6 — Nits:** `logger.ts:204-207` logs to console in prod; `vite.config.ts:17-31` omits `mermaid`/`marked`/`zustand`/`cmdk` from `optimizeDeps`/`manualChunks`; `ui/table.tsx:4-9` ref confusion; `SettingsDialog.tsx:215` no `aria-busy`; `HomeView.tsx:99` + `RawEditor.tsx:124` duel `autoFocus`; `.DS_Store` committed in `src/` despite `.gitignore`.

## Frontend — Checked OK
- `tsc --noEmit` clean; `strict`, `noUnusedLocals/Parameters` on.
- `ErrorBoundary` + `unhandledrejection`/`error` logging (`main.tsx:16-21`); sidebar/editor loading/error/empty states exist.
- Theme respects `prefers-reduced-motion/transparency/contrast` (`App.css:587-651`).
- BubbleMenu gating avoids crash; conflict banner + autosave guards exist (but see C4/M8/M9).

## Frontend Priority
1. Now: C1, C2, C3, H11 (sanitize + strict + declare `marked`).
2. Next: C4, H1–H4 (data-loss, listener churn, image bloat, watcher/paths).
3. Then: H5–H10, M1–M9.
4. Hygiene: L5 CI/tests/lint; L1 `any`; L4 metadata.

---

# PART 2 — BACKEND (`src-tauri` Rust + Tauri Config)

## 1. Bugs / Broken Logic

### B1 — No vault-containment on any file command: arbitrary FS read/write/delete [Critical]
**Files:** `storage.rs:194-223` (`scan_vault`), `:227-257` (`read_file`), `:287-308` (`write_file`), `:341-357` (`create_note`), `:361-385` (`rename_path`), `:389-410` (`delete_path`), `:414-457` (`create_file_at_path`/`create_folder_at_path`), `:461-543` (`copy_external_file`); `session.rs:29-72`
**Description:** Every command does `PathBuf::from(user_string)` + `canonicalize().unwrap_or_else(|_| clone())` fallback then operates. No check canonical path is inside vault. `delete_path` does `remove_dir_all` on any path.
**Impact:** Compromised frontend JS (XSS via markdown, malicious deep-link) gets full filesystem access. Bug sending `/`, `~` destroys data.
**Fix:** `resolve_in_vault(vault_root, user_path)` with strict canonicalize (no fallback) + `starts_with(vault_root_canonical)`; reject escapes with `VaultEscape`; tests for `../`, symlink, `/etc/passwd`, `/`.

### B2 — `parse_note_envelope` mis-parses `---` HRs / non-frontmatter [High]
**File:** `storage.rs:25-68` — Closing delimiter via `find("\n---")` matches `\n--- foo`, `\n----`, code-fence, HR in body. No requirement line is exactly `---`.
**Impact:** Notes with HRs/fences corrupt on read; `reassemble_envelope` (`:71-78`) rewrites corrupted content — data loss.
**Fix:** Split lines, require line0 trimmed == `---` and closing trimmed == `---`/`...`; tests: HR, fenced `---`, `--- foo`, CRLF, BOM.

### B3 — `internal_write_file` temp collision, leak, no durability [High]
**File:** `storage.rs:260-283` — `with_extension("snipnote.tmp")` collapses extensions; concurrent writes share one temp → interleave/lost update. No cleanup on failure. No fsync parent dir, no locking, no mtime check.
**Fix:** Unique temp per write (`write_file.<pid>.<nanos>.tmp` + `O_EXCL`), fsync file + parent, `remove_file(temp)` on error, advisory lock or CAS on mtime.

### B4 — `create_note` / `create_file_at_path` TOCTOU + invisible dotfile bug [High]
**Files:** `storage.rs:311-337`, `:414-438` — `exists()` then `fs::write` non-atomic — two callers can pick same `Untitled N.md`. Collision loop in `copy_external_file:481-516` capped 10000. `create_file_at_path:427-429` appends `.md` when `extension().is_none()` — `.gitignore` → `.gitignore.md` but scanner (`:163-165`) skips dot-files → invisible. `Dockerfile` → `Dockerfile.md`.
**Fix:** `OpenOptions::create_new(true)` loop; reject dot-files or warn “hidden”; don’t auto-append `.md` to dotfiles; deduplicate Untitled logic (Rust + `App.tsx:277-284` + `EditorSurface.tsx:674-694`).

### B5 — `copy_external_file` file branch missing self-copy guard; dir partial-failure [High]
**File:** `storage.rs:461-565` — Self-copy guard (`:518-525`) only for `is_dir()`. `copy_dir_recursive:545-565` aborts on first `Err` leaving half-copied tree no rollback. Only top-level `candidate` is `record_write` (`:528`); nested files aren’t → watcher storm.
**Fix:** Unify guard; pre-count with limit; copy to `dest.<tmp>` then rename; suppress watcher during bulk copy; cleanup partial dest.

### B6 — Watcher echo suppression misses deletes/renames [Medium]
**File:** `watcher.rs:26-50` — `record_write` canonicalizes existing path; `is_suppressed` on deleted path fails `canonicalize` → fallback non-canonical → never equals stored canonical.
**Impact:** Own deletes/renames always emit `vault-changed` → redundant `loadVault` + banner flicker.
**Fix:** Canonicalize parent + join filename fallback; store both keys; regression test.

### B7 — `rename_path` / `create_*` allows `.`/`..`/control/reserved [Medium]
**Files:** `storage.rs:361-385`, `:414-457` — Only checks `/`, `\`, empty. Allows `.`, `..`, `\0`, trailing spaces/dots, `CON`/`NUL`, 255+ chars, `.DS_Store`.
**Fix:** Central `validate_file_name()`: reject `.`/`..`, controls, trailing space/dot, len>200, Windows reserved; enforce `.md` for note renames or warn.

### B8 — Frontend calls unregistered `haptic_feedback` command [Medium]
**Files:** `src/App.tsx:52-59` vs `src-tauri/src/lib.rs:201-219` — No `#[tauri::command]`; swallowed `.catch(()=>{})`.
**Fix:** Register or remove; add command contract test.

### B9 — `reassemble_envelope` blank-line drift [Low]
**File:** `storage.rs:71-78` — Always `---\n{fm}\n---\n\n{body}`. Body starting `\n` gains blank line; `trim_matches('\n')` strips intentional newlines.
**Fix:** Preserve single `\n`; round-trip test.

## 2. API Design

### A1 — All errors opaque `String`; no typed errors/codes [High]
**Files:** `storage.rs:194,227,287,341,361,389,414,442,461`, `session.rs:75,107`, `watcher.rs:124,194` — `Result<_, String>` with `format!("{:?}", path)` + `e.to_string()`. Frontend can only `alert(e.message)`. `NotFound` vs `PermissionDenied` indistinguishable; paths leak.
**Fix:** `enum ApiError { NotFound, NotADirectory, AlreadyExists, InvalidName, VaultEscape, Io(String) }` + separate human message.

### A2 — `scan_vault` returns entire tree, no pagination/limits [High]
**File:** `storage.rs:193-223`, `:109-190` — Recursive `scan_directory` full vault → `Vec<VaultNode>` JSON one IPC. No depth/count/bytes cap, streaming.
**Impact:** Selecting `$HOME`/large repo OOMs Rust + webview; blocks threadpool.
**Fix:** Reject/confirm >N files (e.g. 20k) or depth>12; `scan_vault_shallow` + lazy children; `async` + `spawn_blocking`.

### A3 — Blocking `std::fs` in sync Tauri commands [Medium]
**Files:** `storage.rs:114,253,269-282,333`, `session.rs:89,113-118`, `watcher.rs:148-180` — Sync I/O on IPC threadpool. Large scan starves other invokes.
**Fix:** `async` + `spawn_blocking`.

### A4 — No input size limits on `write_file.body` / `save_session.open_tabs` [Medium]
**Files:** `storage.rs:287-293`, `session.rs:107-110` — `body: String` unbounded — autosave full note every 500 ms; base64 images bloat to tens of MB. `open_tabs` unbounded.
**Fix:** Limits (body ≤10 MB, frontmatter ≤100 KB, tabs ≤100, path ≤4 KB); `TooLarge` error; store images as files.

## 3. Database (Filesystem as DB)

### D1 — No integrity for concurrent save vs external edit [High]
**Files:** `storage.rs:260-308`, `App.tsx:189-234` — No revision/mtime/etag. Frontend conflict detection best-effort (`isDirty` + 2s TTL). `write_file` overwrites unconditionally.
**Fix:** Return `mtime+len` on `read_file`; require `expected_mtime` on `write_file`; `Conflict` if mismatch.

### D2 — Session/watcher/recent state no schema version/migration [Medium]
**Files:** `session.rs:6-13`, `lib.rs:22-42`, `boot.rs:17-21` — `session.json`, `recent.json`, `BootCache` no `version`. Corrupt/old → `get_session:97-103` returns `default()` discarding vault+tabs; no backup.
**Fix:** `version: u32`, backup corrupt to `.bak.<ts>`, migrate, log.

### D3 — Case-insensitive sort `to_lowercase()` per comparison [Low]
**File:** `storage.rs:183-187` — `sort_by(|a,b| a.name.to_lowercase().cmp(...))` O(n log n) allocs.
**Fix:** `sort_by_cached_key` or `unicase`.

## 4. Auth/AuthZ

### Z1 — No IPC authorization: any webview JS can delete filesystem [Critical]
**Files:** `lib.rs:201-219`, `capabilities/default.json:1-30` — All 18 commands globally invocable. Malicious note XSS → `invoke("delete_path",{path:"/"})` or `read_file("/etc/passwd")`. No per-command scoping, no vault allowlist.
**Impact:** Single XSS = full file access (read SSH keys, plant LaunchAgent via `copy_external_file` to `~/Library/LaunchAgents`).
**Fix:** (1) vault-containment server-side (B1); (2) scope `opener`/`dialog`; (3) sanitize markdown (forbid `script`/`iframe`/`object`, sandbox mermaid); (4) per-command ACL; (5) CSP lockdown (S4).

## 5. Security

### S1 — Overbroad `opener` permissions [Critical]
**File:** `capabilities/default.json:14-16` — `opener:allow-open-url`, `allow-open-path` unscoped — any injected JS can `openUrl("https://phish…")` / `openPath("/Applications/Evil.app")`.
**Fix:** Scope opener (`vault dir + https:` only); validate `href` in Rust; block `file://` escapes (`EditorSurface.tsx:84-98`).

### S2 — Deep-link / single-instance accept arbitrary paths [High]
**Files:** `lib.rs:160-189`, `:289-314` — `snipnote://open?path=/etc/passwd`, `?vault=/`, `snipnote://open//etc/passwd` emitted without validation; `argv[1]` similarly. Host-branch not percent-decoded, builds `/{path}` naively.
**Fix:** Canonicalize, require `.md` for files, dir+readable for vaults, reject `/`/`$HOME` unless allowed; normalize encoding; emit only after validation.

### S3 — `frontend_log` log injection + disk-DoS [High]
**File:** `logger.rs:142-154`, `:69-85` — Arbitrary `target`/`message` (only message truncated 2000; `target` unbounded, newlines kept). No rate limit.
**Impact:** Log forging, file fill via rapid invokes, `Mutex` contention.
**Fix:** `target` allowlist `[a-z0-9-]` max 32, strip `\r\n`, token-bucket 50/s, drop `debug` in release.

### S4 — CSP incomplete [Medium]
**File:** `tauri.conf.json:15-17` — `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:;` No `script-src`, `connect-src`, `frame-src`, `object-src`, `worker-src`, `media-src`. `img-src data:` + `allowBase64:true` permits huge inline SVG.
**Fix:** Explicit `script-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'self' blob:; connect-src 'self' asset: http://localhost:1420 ws://localhost:1420` (dev only), audit `data:` SVG.

### S5 — Placeholder updater key + endpoint in release [High]
**File:** `tauri.conf.json:45-52` — `pubkey: "dW50cnVzdGVkIGNvbW1lbnQ6IGR1bW15IHB1YmtleSBmb3IgdjEgLSBubyByZWFsIHVwZGF0ZSBzZXJ2ZXI="` = “dummy pubkey … no real update server”, `endpoints: ["https://example.com/appcast.json"]`, `windows.installMode: "passive"`.
**Impact:** Update checks always fail or trust attacker JSON; passive install = silent exec.
**Fix:** Disable `updater` until real appcast + minisign key; require user-confirmed restart (no passive).

### S6 — Sensitive absolute paths logged; log file no restrictive mode [Medium]
**Files:** `logger.rs:105-136`, `storage.rs:203,213`, `session.rs:123-131` — `scan_vault start: /Users/…`, `write_file ok: /Users/…` at `debug`/`info`. `snipnote.log` default umask; fallback `temp_dir()/snipnote` world-readable.
**Fix:** Redact home (`~/…`); `mode(0o600)` on unix; avoid full paths at `info` in release.

### S7 — `macosPrivateApi: true` + `macos-private-api` without justification [Medium]
**Files:** `tauri.conf.json:13`, `Cargo.toml:21` — Enables private AppKit APIs (`lib.rs:317-326` Sidebar/Mica).
**Impact:** App Store rejection, fragile upgrades.
**Fix:** Gate with fallback to standard translucency; document necessity.

## 6. Performance & Scalability

### P1 — Single global `RecommendedWatcher` with `Config::default()`, no tuning [Medium]
**File:** `watcher.rs:140-189` — notify 6 defaults; every `Modify(Data)` emits per-path + verbose `debug` log per event (`:155-164`) → log + IPC flood. No backend coalescing (only frontend 500 ms debounce `App.tsx:240-243`).
**Fix:** Explicit `with_poll_interval(2s).with_compare_contents(false)`; coalesce in Rust (500 ms window, dedupe); skip `Access`.

### P2 — Lost rename semantics; `Access` noise [Medium]
**Files:** `watcher.rs:113-120`, `:165-171` — `Modify(Name(Rename))` → `"modify"`; frontend can’t update tab paths → stale tabs, next autosave recreates deleted file. `Access` → `"other"` still emits for dirs.
**Fix:** Emit `rename {from,to}` (handle `RenameMode::Both`); filter `Access`.

### P3 — Watcher/scanner ignore-list divergence [Medium]
**Files:** `storage.rs:81-96` vs `watcher.rs:69-111` — Scanner ignores `node_modules,.git,.svn,.hg,target,dist,build,out,.next,.nuxt,.output,.turbo,.cache,.snipnote`; watcher only `.git,node_modules,target,dist,build,*.snipnote.tmp` + dot-files. `.svn/.hg/.cache/.next/.turbo`, extensionless `README`/`LICENSE` still emit but never shown.
**Fix:** Share single `is_ignored_path()`; unit-test parity.

### P4 — Boot cache never evicted; unbounded preload [Medium]
**File:** `boot.rs:39-102` — `trees: HashMap<String, Vec<VaultNode>>` + `files` one-shot but stale if different vault opened. Preload up to 10 files no byte cap (`:84-88`).
**Impact:** Memory leak; 500 MB attachment OOMs boot thread.
**Fix:** TTL 30s + size cap (skip >2 MB, tree >50k nodes); `clear()` on switch.

### P5 — Logger `env::var` + `eprintln!` per line; `Mutex<File>` per IPC [Low]
**Files:** `logger.rs:23-50`, `:69-85` — `min_level()` + `mirror_to_stderr()` hit env every line. `frontend_log` locks global mutex.
**Fix:** Cache in `OnceLock`; `mpsc` logger thread or `parking_lot::Mutex`.

## 7. Code Quality

### Q1 — `storage.rs` 758 lines god-module; duplicated helpers [Medium]
**File:** `storage.rs` — Envelope, ignore lists, scan, 9 commands, collision-naming (3 variants), recursive copy, 7 tests. `canonicalize().unwrap_or_else(|_| clone())` ×5 (`:205,247,519-520`, `watcher.rs:27,38`); Untitled logic triplicated with frontend.
**Fix:** Split `envelope.rs`, `vault_tree.rs`, `paths.rs`, `commands/*`; centralize `canonicalize_strict` + `validate_name`.

### Q2 — Error context loss: `map_err(|e| e.to_string())` [Medium]
**Files:** `storage.rs:375-383,396-407,434,454,526-538`, `session.rs:89-94` — `ErrorKind` discarded.
**Fix:** Preserve `kind()` in structured error (A1).

### Q3 — `sanitize_session` TOCTOU + `active outside vault` allowed [Medium]
**File:** `session.rs:29-72` — `is_dir`/`is_file` advisory; `active_file_path` need not be under `last_vault_path` → session can point at `/etc/passwd` and `read_file` serves it (B1).
**Fix:** After B1, validate `active` + tabs inside vault; cap tabs 50, path len; test.

### Q4 — Temp-file cleanup missing on atomic writes [Medium]
**Files:** `storage.rs:268-282`, `session.rs:112-121` — Neither `internal_write_file` nor `save_session` removes `.tmp` on failure; no fsync; concurrent `save_session` (frontend saves on every `vaultPath/activePath/tabs` change `App.tsx:153-165`) races.
**Fix:** `remove_file(temp)` on error; debounce `save_session` 500 ms + fsync.

### Q5 — Log rotation only at startup; single backup overwrite [Low]
**File:** `logger.rs:114-118` — `MAX_LOG_BYTES` (2 MB) checked once in `init`. Long session with watcher `debug` per event grows unbounded. Rename → `.1` clobbers backup.
**Fix:** Check per N lines / on `info+`; rotate `.1/.2` chain; downgrade watcher logs to `trace`/sampled.

### Q6 — `Mutex` poisoning → user error; single-instance only `argv[1]` [Low]
**Files:** `watcher.rs:140-141,195-196`, `lib.rs:160-189` — `lock().map_err(|e| e.to_string())` exposes internals. `argv.get(1)` drops 2nd+ files (multi-select Open With).
**Fix:** `lock().unwrap_or_else(|p| p.into_inner())`; iterate `argv[1..]`, emit `open-many`.

## 8. Config / DevOps / Tests / Build

### C1 — `notify = "6"` outdated [Medium]
**File:** `Cargo.toml:31` — Legacy (FSEvent/kqueue quirks, `Config::default()` differs v7/8). Caret drift.
**Fix:** Upgrade notify 8, explicit config, re-run `test_should_emit_change_filtering` + soak; pin policy.

### C2 — Release `panic = "abort"` no crash reporting [Low]
**File:** `Cargo.toml:34-38` — `panic="abort"` + `.expect(...)` (`lib.rs:361`) kills with no log tail. Failsafe 10s window (`lib.rs:343-352`) never fires.
**Fix:** `panic::set_hook` logging to `snipnote.log` before `run()`.

### C3 — No backend validation tests for destructive commands [High-process]
**Files:** `storage.rs:567-758`, `watcher.rs:205-247`, `session.rs:135-181`, `boot.rs:104-123` — Tests cover envelope round-trip, `create_note` numbering, scan filter/sort, echo TTL, `should_emit_change`. Missing: `rename`/`delete`/`create_file`/`create_folder`/`copy_external` validation, traversal rejection, temp cleanup, watcher delete suppression, tabs cap, boot eviction, deep-link parse, logger injection. Brittle hardcoded test `session.rs:169-180` (`/Users/achuth/…` assumes absence — fails on author machine if exists; use `temp_dir`).
**Fix:** `src-tauri/tests/` integration: traversal (`..`, absolute, symlink), collision, invalid names, huge inputs, partial-copy cleanup.

### C4 — Env handling undocumented; no config validation [Low]
**Files:** `logger.rs:23-50`, `tauri.conf.json:38-53` — Only `SNIPNOTE_LOG_LEVEL`/`SNIPNOTE_LOG_STDERR`; invalid silently ignored. No allowlist doc, no dev-vs-prod CSP split (`devUrl: http://localhost:1420` + `frontendDist: ../dist` correct, but CSP must allow HMR).
**Fix:** Document in README + validate at `init`; split `devCsp` or comment.

### C5 — `gen/schemas` git-ignored but `capabilities/default.json` refs it; no capability tests [Low]
**Files:** `.gitignore:6-8`, `capabilities/default.json:2` — `$schema: ../gen/schemas/desktop-schema.json` missing on fresh clone until `tauri dev`. No CI that capabilities match used plugins (`dialog`, `opener`, `notification`, `updater`, `autostart` present, but `single-instance`/`deep-link` in `lib.rs:160,190` have no entries).
**Fix:** CI `tauri build --debug` smoke; explicitly list `deep-link`/`single-instance` or comment why default suffices.

## Backend Priority
1. B1+Z1+S1/S2 — vault containment + scope opener + validate deep-links (closes arbitrary-FS hole).
2. Trash instead of `remove_dir_all`, disable placeholder updater (S5).
3. A1/D1 — typed errors + mtime write guard.
4. B3/Q4 — unique temp + cleanup + fsync.
5. P1-P4, Q5, S3 — watcher coalesce/rename, boot eviction, log rate-limit/rotation.
6. C3 — traversal/validation suite + fix hardcoded-path test.

---

# Combined Top-10 (Frontend + Backend)
1. Backend arbitrary FS read/write/delete — no vault containment (B1) + no IPC authz (Z1) + overbroad opener (S1) — Critical
2. Frontend stored XSS via `marked` (C2) + mermaid `loose` (C3) — Critical — chains directly to (1)
3. Frontend global `!important` kills focus rings/borders (C1) — Critical
4. Frontend silent data loss on close/tab-switch (C4) + backend lost-update no mtime (D1) + temp collision (B3) — Critical/High
5. Backend deep-link arbitrary paths (S2) + placeholder updater (S5) — High
6. Backend envelope `---` mis-parse (B2) + `create_note` TOCTOU/dotfile (B4) + `copy_external` partial (B5) — High
7. Backend opaque `String` errors (A1) + `scan_vault` unbounded (A2) + blocking `std::fs` (A3) + no input limits (A4) — High/Medium
8. Frontend IPC churn (H1), base64 image bloat (H2), path bugs (H3), watcher leak/race (H4) — High
9. Frontend native dialogs no validation (H5), FileTree kbd/DnD (H6), TabBar ARIA (H7), link classifier (H8), RawEditor/CommandPalette perf (H9/H10), undeclared `marked` (H11) — High
10. Hygiene: no frontend lint/test/CI (L5), `as any` (L1), dead UI M1, backend validation tests missing (C3), notify v6 (C1), log injection/rotation (S3/Q5), boot eviction (P4)
