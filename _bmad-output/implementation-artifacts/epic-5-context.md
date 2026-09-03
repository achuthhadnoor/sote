# Epic 5 Context: Native Desktop Polish

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make snipnote feel like a native macOS/Windows desktop app alongside Finder/Explorer — with real App Menu and window chrome, Dock/Recent/Single-Instance handling, context menus and Reveal/Quick Look/Share, Finder drag-and-drop and `*.md` file association, Find, spellcheck, scrollbars/motion, notifications, SF Symbols polish, full accessibility, and Sparkle auto-update — without adding cloud or network dependencies.

## Stories

- Story 5.1: Native App Menu & Window Chrome
- Story 5.2: Dock & Recent Documents + Single Instance & Deep Link
- Story 5.3: Context Menus + Reveal/Quick Look/Share
- Story 5.4: Drag & Drop & File Association
- Story 5.5: Find/Replace in Editor
- Story 5.6: SpellCheck & Overlay Scrollbars/Motion
- Story 5.7: Notifications + SF Symbols + Visual Polish
- Story 5.8: Accessibility
- Story 5.9: Distribution: Auto-update, Launch at Login, Haptics

## Requirements & Constraints

- App Menu must provide File (New `⌘N` draft, Open Vault `⌘O`, Save `⌘S`, Close Tab `⌘W`), Edit (Undo/Redo/Cut/Copy/Paste/Select All), View (Toggle Sidebar, Appearance Light/Dark/System), Window (Minimize `⌘M`, Zoom, FullScreen `^⌘F` with Split View/Spaces), Help + Services/Hide/Quit; vibrant `transparent` + `Overlay` + `EffectsBuilder(Sidebar,Mica,Active,radius12)` must remain.
- Single instance must focus existing window on `snipnote://open?path=` or `*.md` open; no duplicate windows; Recent Vaults via system controller and Dock menu for New Note/Open Vault.
- File Tree and Editor context menus must expose Reveal in Finder/Show in Explorer, Open with default app, Rename/Delete/New File/Folder, Copy (Absolute/Relative) Path; Editor must still expose clipboard actions; Quick Look on `Space` and Share via opener.
- Drag & drop: Finder files dropped onto vault window must copy into vault (root or target folder) and appear in File Tree within 500ms; vault note drag-out must provide file promise to Finder/Desktop; `*.md`/`*.markdown` double-click must route to existing window via `CFBundleDocumentTypes`.
- Find must be editor-local (`⌘F` bar, `Esc` closes, `Enter`/`⇧Enter` next/prev, `DecorationSet` highlights, `⇧⌘F` replace toggle); vault-wide search stays filename-only via `⌘P`.
- Spellcheck toggle must persist and use platform checker; reduced motion/transparency must disable spring and fall back to opaque hexes.
- Notifications for external changes while hidden/minimized plus `SF Symbols` icon replacement on macOS (with SVG fallback) required.
- Accessibility: `role=tree`/`tablist`, `aria-expanded`/`selected`, `aria-live` for palette, status live region, roving tabindex, and `prefers-contrast` border increase.
- Distribution: Sparkle updater (`tauri-plugin-updater`), Launch at Login (`tauri-plugin-autostart`), and haptics on key toggles.

## Technical Decisions

- Hexagonal + Tauri IPC bridge remains: all disk I/O via Rust `storage.rs` (atomic temp+rename, `scan_directory` with dot-folder + hide-empty filtering) and `watcher.rs` (`notify` + `RecentlyWritten` 2s TTL); frontend never touches `@tauri-apps/plugin-fs` directly.
- Vibrant window via `tauri` `macos-private-api` + `EffectsBuilder` in `lib.rs:14` with `transparent:true`, `macOSPrivateApi:true`, `titleBarStyle Overlay`; CSS `rgba` over native effect, opaque fallback on Linux.
- State partitioned into Zustand stores (`useVaultStore`, `useTabStore`, `useEditorStore`, `useThemeStore`); document stats isolated from tree re-renders; Mermaid via NodeView.
- Session persisted in `$APP_CONFIG_DIR/session.json` (vault path, openTabs, window geometry) with sanitization to existing files; theme in `localStorage snipnote-theme` with `html[data-theme]` switching.
- Draft-until-content (`AD-8`): `+`/`⌘N` creates virtual `isNew` tab, no disk until `hasContent`; first save does `markTabSaved` + `loadVault`.

## UX & Interaction Patterns

- Fixed 260px Sidebar (Search 40px, scrollable File Tree with SVG folder/file + chevron, Library footer 40px with gear), 40px TabBar (scrollable `tab-item` 28px, `is-draft` italic/hollow, `dirty •`, `+` draft), centered 760px Editor with 24px gutters, 24px StatusBar; Right Panel 420px remains hidden but built.
- Monochrome tokens via `App.css` (`#FFFFFF`/`#F8F8F9`/`#EAEAEA` light + `[data-theme="dark"]` `#141416`/`#1A1A1E`/`#2A2A2E` + translucent `rgba`), Inter/SF Pro typography, `12px` radii, translucent banners.
- Global shortcuts: `⌘N` draft, `⌘P` palette, `⌘,` settings, `⌘W` close, `Ctrl/⌘+Tab` cycle, `⌘F` find, `Space` Quick Look; `Esc` dismisses overlays/banners.

## Cross-Story Dependencies

- 5.1 App Menu provides the menu shell that 5.2 (Dock/Recent/Single Instance), 5.3 (context menus), and 5.4 (file association) extend.
- 5.4 drag & drop reuses `storage.rs` atomic copy and `vault-changed` refresh used in Epic 3 watcher flow; must not bypass `RecentlyWritten` echo suppression.
- 5.5 Find builds on Tiptap `EditorSurface`/`ProseMirror` decorations; 5.6 spellcheck and reduced-motion both affect the same editor surface.
- 5.8 accessibility augments markup added in 5.3–5.7 (tree roles, tablist, palette live regions).
- 5.9 distribution plugins (`updater`, `autostart`) hook into the existing `tauri.conf.json` and Settings overlay from 1.7.
