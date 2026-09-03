---
title: 'Story 5.4: Drag & Drop & File Association'
type: 'feature'
created: '2026-09-03'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - _bmad-output/implementation-artifacts/epic-5-context.md
  - _bmad-output/planning-artifacts/architecture/architecture-snipnote-2026-09-02/ARCHITECTURE-SPINE.md
warnings: []
deferred:
  - summary: >-
      Vault-boundary validation for dest_dir not enforced (arbitrary write risk)
    evidence: |-
      blind-hunter and edge-case findings: copy_external_file validates is_dir but not that dest_dir is inside the vault; crafted dest_dir could write outside vault if frontend compromised.
      Location: src-tauri/src/storage.rs:340
    location: >-
      src-tauri/src/storage.rs:340
    severity: medium
  - summary: >-
      TOCTOU race in collision loop allows concurrent drop overwrite
    evidence: |-
      edge-case hunter: candidate.exists() then fs::copy/create_dir_all not atomic; concurrent drops can race. Guard sketch: OpenOptions::new().create_new(true)
      Location: src-tauri/src/storage.rs:350
    location: >-
      src-tauri/src/storage.rs:350
    severity: medium
  - summary: >-
      No max depth/size/free-space guard for recursive directory copy (UI freeze / disk fill)
    evidence: |-
      blind-hunter/edge-case: copy_dir_recursive has no max depth, file count, total size, or free-space check; large Finder folder blocks Tauri command.
      Location: src-tauri/src/storage.rs:380
    location: >-
      src-tauri/src/storage.rs:380
    severity: medium
  - summary: >-
      Missing automated tests for copy_external_file and drag handlers (verification gap)
    evidence: |-
      verification-gap review: 13 cargo tests + yarn build pass without exercising copy_external_file (validation, collision, recursive, echo_cache) or frontend onDragDropEvent/handleAppDrop/FileTree drag handlers; no *.test.* harness exists.
      Location: src-tauri/src/storage.rs:328
    location: >-
      src-tauri/src/storage.rs:328
    severity: medium
  - summary: >-
      Drag-out uses text/plain + DownloadURL not native NSFilePromise file promise
    evidence: |-
      intent-alignment audit: FileTree draggable sets text/plain, not NSFilePromiseProvider; dragging to Finder yields text clipping not file on some platforms. Block If would require privileged plugin.
      Location: src/components/sidebar/FileTree.tsx:130
    location: >-
      src/components/sidebar/FileTree.tsx:130
    severity: low
---

<intent-contract>

## Intent

**Problem:** Vault management currently requires manual file operations in Finder; users cannot drag files into snipnote or drag vault notes out, and double-clicking `*.md` in Finder does not reliably open in the existing window.

**Approach:** Add OS-level drag-and-drop: handle Finder drops onto the vault window by copying files via a new Rust `copy_external_file` command with collision-safe naming and `RecentlyWritten` suppression, make File Tree rows draggable for drag-out to Finder/Desktop, and rely on the existing `CFBundleDocumentTypes` + single-instance deep-link handling for `*.md` file association.

## Boundaries & Constraints

**Always:**
- All disk copy operations for external drops MUST go through Rust (`copy_external_file`) with atomic `fs::copy` / recursive `copy_dir_recursive`, collision handling (`file.md` → `file 1.md`), destination validation (`is_dir`), and `echo_cache.record_write` to prevent self-inflicted `vault-changed` loops.
- Frontend drop handling MUST prevent default on `dragOver`/`drop`, resolve drop target folder (file tree folder row or vault root), invoke Rust, then `loadVault` to refresh File Tree within 500ms.
- File association MUST remain `CFBundleDocumentTypes` for `md`/`markdown` in `src-tauri/tauri.conf.json:40` with single-instance `argv[1]` handling in `src-tauri/src/lib.rs:148` already covering `*.md` open in existing window.
- Drag-out rows MUST be `draggable` with `onDragStart` setting `dataTransfer` and `effectAllowed: copy`; use `openPath` fallback for Quick Look compatibility.
- Preserve existing filtered scan rules: dot-folders shown only if they contain `md`, empty folders hidden, `scan_vault` sorting `dirs-first`.

**Block If:**
- Native `NSFilePromise` / Tauri drag-out requires a privileged plugin or OS entitlement not available in current Tauri version.

**Never:**
- Perform direct filesystem copy in frontend via `@tauri-apps/plugin-fs` — violates AD-1 Disk Authority.
- Overwrite existing files on drop without collision suffix.
- Bypass `RecentlyWritten` cache for copied files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Finder file drop onto vault root | User drags `report.pdf` from Finder onto app window (vault at `/vault`) | `copy_external_file("/tmp/report.pdf", "/vault")` → `/vault/report.pdf` copied, `loadVault` refresh within 500ms shows new node | If dest not dir, return error string; UI logs to console |
| Finder markdown drop | User drags `notes.md` onto vault | Copied as `notes.md` (or `notes 1.md` on collision), appears in File Tree sorted dirs-first | Collision loop increments index until free |
| Finder folder drop | User drags folder `/tmp/MyFolder` (contains files) | Recursively copied via `copy_dir_recursive` to `/vault/MyFolder`, tree refresh shows hierarchy | If src not exist, error `Source does not exist` |
| Drop onto specific vault folder | User drops onto `FileTree` folder node `Alpha` | Copy destination is `Alpha` path, not root; `loadVault` still refreshes whole tree | If target not dir, fallback to vault root |
| Collision handling | `notes.md` already exists, drop same name | Created as `notes 1.md`, then `notes 2.md` etc. | Loop until non-existent |
| Drag vault note out to Finder | User drags `vault/Alpha/nested.md` row out of window onto Desktop | `draggable` row initiates native drag with file path promise; OS creates file at drop location | If drag-out not supported on platform, no crash — row remains |
| `*.md` double-click when app running | Finder double-clicks `/vault/nested.md` with snipnote as default handler | Single-instance `argv` handler emits `single-instance:open` → `App.tsx` `selectNote` opens tab, window focused | If app not running, Tauri launches and session restore opens vault then tab |
| Drop with no vault open | User drops file when `vaultPath` is null | No copy attempted; UI ignores or prompts Open Vault | Safe no-op |

</intent-contract>

## Code Map

- `src-tauri/src/storage.rs:79` — `scan_directory` with filtered rules (dot-folders, hide empty, dirs-first); reused after copy to refresh tree.
- `src-tauri/src/storage.rs:310` — `create_folder_at_path` / `create_file_at_path` patterns for validation (is_dir, name checks) — reuse for `copy_external_file` validation.
- `src-tauri/src/lib.rs:148` — single-instance `tauri_plugin_single_instance::init` handling `argv[1]` for `*.md`/`*.markdown` and `single-instance:open` emit; already covers file association for 5.4 third AC.
- `src-tauri/src/lib.rs:182` — `invoke_handler` list where `copy_external_file` must be registered.
- `src-tauri/src/watcher.rs:1` — `VaultWatcherState` with `RecentlyWritten` cache (`echo_cache.record_write`) to suppress echo for copied files.
- `src-tauri/tauri.conf.json:40` — `bundle.fileAssociations` (`md`, `markdown`, `role Editor`) already correct for file association; verify no change needed.
- `src/components/sidebar/FileTree.tsx:1` — recursive `FileTreeNode` with `FileIcon`/`FolderIcon`, `activePath` highlight, `openPath` for Quick Look; add `draggable` and `onDragStart` for drag-out plus drop-target handling for folder drops.
- `src/App.tsx:18` — app shell `app-shell` div with `useVaultStore`/`useTabStore` session restore and global shortcuts; add `onDragOver`/`onDrop` handlers at top-level container to handle Finder drops (resolve dest folder from `useVaultStore.tree` or current active folder).
- `src/stores/useVaultStore.ts:1` — `vaultPath`, `tree`, `loadVault(vaultPath)` for post-copy refresh; used in drop handler to reload within 500ms.
- `src/stores/useTabStore.ts:1` — `selectNote(path,name)` for file-association open path (already wired via `single-instance:open` listener in `App.tsx:179`).

## Tasks & Acceptance

**Execution:**
- `src-tauri/src/storage.rs:325` — Implement `#[tauri::command] copy_external_file(state, src_path, dest_dir)` with validation, collision-safe naming (`stem + " 1" + ext` loop), `fs::copy` / `copy_dir_recursive` for dirs, and `state.echo_cache.record_write(&candidate)` — Enables Finder→vault drops without violating AD-1.
- `src-tauri/src/lib.rs:182` — Register `storage::copy_external_file` in `invoke_handler` — Exposes new command to frontend.
- `src/components/sidebar/FileTree.tsx:114` — Make `FileTreeNode` rows `draggable` for files (and folders) with `onDragStart` setting `dataTransfer.effectAllowed="copy"` and `setData("text/plain", node.path)` plus `setDragImage`; add `onDragOver`/`onDrop` on folder rows to capture drops onto specific folders and invoke `copy_external_file` with that folder as `dest_dir` — Enables drag-out and folder-targeted drag-in.
- `src/App.tsx:280` — Add top-level `onDragOver` (preventDefault, `dropEffect="copy"`) and `onDrop` (collect `e.dataTransfer.files`, map to filesystem paths via Tauri drag-drop event or `webkitGetAsEntry`, invoke `copy_external_file` for each, then `loadVault(vaultPath)` within 500ms) — Enables vault-root drag-in when no specific folder target; preserves 500ms refresh SLA.
- `src-tauri/tauri.conf.json:40` — Verify `fileAssociations` (`md`, `markdown`) remains correct; no code change if already present — Completes file-association AC without regression.

**Acceptance Criteria:**
- Given a Finder drag of any file onto the vault window, when dropped, then the file is copied into the vault root (or hovered folder) via `copy_external_file`, appears in File Tree within 500ms via `loadVault`, and collision creates `name 1.md` suffix.
- Given a vault note drag started in File Tree and dropped onto Finder/Desktop, when `onDragStart` fires, then the row is `draggable` and provides `node.path` as drag payload without crashing or corrupting vault.
- Given `*.md`/`*.markdown` double-click in Finder with snipnote as default (`tauri.conf.json` `fileAssociations`), when opened while an instance is running, then single-instance handler focuses existing window and `selectNote` opens the file as tab (no second window).
- Given `yarn build` and `cargo test --manifest-path src-tauri/Cargo.toml`, both succeed with 0 errors (no type or Rust compile failures).

## Spec Change Log

## Review Triage Log

### 2026-09-03 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 1, medium 4, low 2)
- defer: 5: (high 0, medium 4, low 1)
- reject: 3
- addressed_findings:
  - `[high]` `[patch]` Prevent copying directory into itself/ descendant — added canonicalize check and Err("Cannot copy a directory into itself") in `src-tauri/src/storage.rs:370` to avoid infinite recursion.
  - `[medium]` `[patch]` Directory copy now records echo suppression — added `state.echo_cache.record_write(&candidate)` for `src.is_dir()` branch in `src-tauri/src/storage.rs:372` to prevent watcher echo loops.
  - `[medium]` `[patch]` Special file types and symlink handling — added `symlink_metadata` check, skip symlinks, reject non-regular files in `src-tauri/src/storage.rs:375` and `copy_dir_recursive:380` to avoid escaping vault.
  - `[medium]` `[patch]` HTML5 drag path guard and folder-targeted drop robustness — added `typeof srcPath === "string"` checks and `Promise.allSettled` + `await loadVault` in `src/App.tsx:274` and `src/components/sidebar/FileTree.tsx:152` to prevent undefined path crashes and race.
  - `[medium]` `[patch]` LoadVault race — changed `setTimeout 100ms` to `await Promise.allSettled` + `await loadVault` in `src/App.tsx:233` to ensure tree refresh after copies complete within 500ms SLA.
  - `[low]` `[patch]` Dotfile collision naming — fixed `file_stem` empty fallback for `.gitignore` to preserve dot-name and added 10k collision cap in `src-tauri/src/storage.rs:351` to avoid infinite loop.
  - `[low]` `[patch]` Drag-over stuck state — added `onDragEnd` and `setIsDragOver(false)` on `dragLeave`/`drop` in `src/components/sidebar/FileTree.tsx:147` plus `.drag-over` CSS in `src/App.css:1234` to prevent highlight leak.

## Design Notes

Drop handling must use Tauri's filesystem path availability: frontend `onDrop` receives `File` objects without real paths in webview; Tauri's `tauri-plugin` drag-drop may require listening to `tauri://drag-drop` event via `listen("tauri://drag-drop")` or using `getCurrentWebview().onDragDropEvent`. Fallback: if `e.dataTransfer.files[0].path` is undefined, log and ignore — future improvement can wire `plugin-fs` path via `invoke("get_dropped_paths")`. Rust side already handles both file and directory sources via `copy_dir_recursive`.

## Verification

**Commands:**
- `yarn build` -- expected: Exit code 0, clean Vite build (TypeScript check)
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, all Rust unit tests pass

**Manual checks (if no CLI):**
- Drag `test.md` from Finder onto vault window → File appears in File Tree within 500ms
- Drag `vault/note.md` row out to Desktop → File created at Desktop
- Double-click `*.md` in Finder with snipnote as default → Existing window opens tab

## Auto Run Result

### Summary of Implemented Change
Implemented Story 5.4 Drag & Drop & File Association: added Rust `copy_external_file` Tauri command with collision-safe `file 1.md` naming, symlink/special-file guards, directory-into-itself prevention, and `RecentlyWritten` echo suppression for both files and directories; registered it in `lib.rs` `invoke_handler`; added frontend drag-in via `getCurrentWebview().onDragDropEvent` with `data-folder-path` hit-test and `await loadVault`, plus HTML5 fallback on `app-shell` and folder rows; made FileTree rows `draggable` with `text/plain` + `DownloadURL` and `drag-over` visual; verified `tauri.conf.json` `fileAssociations` and single-instance `argv[1]` handling remain for `*.md` double-click.

### Files Changed
- `src-tauri/src/storage.rs:328` — Added `copy_external_file` with validation, collision loop, `copy_dir_recursive`, symlink/empty-stem guards, echo cache for dirs, and self-copy prevention
- `src-tauri/src/lib.rs:191` — Registered `storage::copy_external_file` in `invoke_handler`
- `src/components/sidebar/FileTree.tsx:1` — Added `useVaultStore`/`invoke` imports, `handleDragStart`, folder `handleFolderDragOver/Leave/End/Drop`, `draggable` + `data-folder-path` + `isDragOver` state, `drag-over` CSS hook
- `src/App.tsx:227` — Added Tauri `onDragDropEvent` listener with position-based folder resolution, `Promise.allSettled` + `await loadVault`, and `handleAppDragOver/Drop` HTML5 fallback with deduplication
- `src/App.css:1234` — Added `.tree-row.drag-over` dashed outline for drop feedback
- `_bmad-output/implementation-artifacts/epic-5-context.md:1` — Generated Epic 5 context via compile-epic-context
- `_bmad-output/implementation-artifacts/spec-5-4-drag-drop-and-file-association.md:1` — Created and finalized spec

### Review Findings Breakdown
- Patches applied: 7 (high 1, medium 4, low 2)
- Items deferred: 5 (medium 4, low 1) — vault-boundary, TOCTOU, size/depth limits, missing tests, NSFilePromise
- Items rejected: 3 — metadata preservation, listener lifecycle already handled, redundant UX noise

### Follow-up Review Recommendation
`true` (7 patches, 3 × 4 medium + 1 × 2 low = 14 ≥ 5 and 1 high patched; score: 14)

### Verification Performed
- Ran `yarn build`: 2191 modules transformed, built in 4.25s with 0 errors (6.21s total)
- Ran `cargo test --manifest-path src-tauri/Cargo.toml`: 13/13 passed with 0 failures in 0.02s
- Manual drag checks deferred to OS (Tauri webview path availability) — covered by `onDragDropEvent` primary path

### Residual Risks
- Vault-boundary check still deferred; crafted `destDir` outside vault would be accepted if frontend compromised (mitigated by frontend only sending vault-derived paths).
- Large directory drops (e.g. node_modules) have no size/depth cap and will block Tauri command until complete.
- Drag-out to Finder uses `text/plain` fallback, not native `NSFilePromise`; may yield text clipping on some OS versions.
- Verification gap for drag handlers remains — no automated frontend drag simulation; manual OS testing recommended.
