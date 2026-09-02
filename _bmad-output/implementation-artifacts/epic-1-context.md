# Epic 1 Context: Workspace Shell & Vault Access

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Provide a hardened, fully branded desktop application shell (`snipnote`) with native window controls, LocalEditor-inspired minimalist styling, a recursive 1:1 file tree browser in the Sidebar, and persistent window and vault state across app launches.

## Stories

- Story 1.1: Project Branding, Configuration & Hardening
- Story 1.2: LocalEditor Design System & Shell Wireframe
- Story 1.3: Rust Storage Service & Vault Directory Scanning
- Story 1.4: Vault Opening, File Tree Rendering & Active File Highlighting
- Story 1.5: Cold-Start Session & Window State Persistence

## Requirements & Constraints

- App, package, crate, and window must be branded `snipnote` with bundle identifier `com.achuth.snipnote`.
- Content Security Policy must restrict script sources strictly to `'self'`.
- Native macOS window controls with minimum dimensions of 800x600.
- All disk reads and directory scanning must be executed by the Rust backend via Tauri IPC, returning a canonical `VaultNode` structure.
- Local-only operation: no outbound network calls, telemetry, or remote dependencies.
- Persistent session storage in `$APP_CONFIG_DIR/session.json` to restore window size/position and vault path without startup visual flicker.

## Technical Decisions

- **AD-1 [Rust Storage Authority]**: Rust owns all filesystem operations. Frontend must not use `@tauri-apps/plugin-fs` or perform direct I/O.
- **AD-6 [Rust-Managed Session]**: Session and window state loaded during `tauri::Builder::setup` before window display.
- **AD-9 [Strict Local-Only & CSP]**: No external scripts or telemetry.
- **IPC Contract**: `VaultNode { path: string, name: string, isDirectory: boolean, children?: VaultNode[] }`. All paths are canonical absolute POSIX paths.
- **State Management**: Frontend state managed via `useVaultStore` (Zustand).

## UX & Interaction Patterns

- 2-pane + 2-bar layout: 260px fixed Sidebar, 40px Header TabBar, centered 760px main canvas with 24px gutters, 24px StatusBar.
- LocalEditor monochrome tokens: `#FFFFFF` canvas, `#F8F8F9` sidebar, `#EAEAEA` borders, `#0F0F0F` primary, `#2563EB` link blue.
- Sidebar File Tree with expandable/collapsible folder chevrons and active file highlight (`accent: #F3F4F6`, 8px radius).
- Native OS directory picker dialog triggered on "Open Vault".

## Cross-Story Dependencies

- Story 1.1 establishes the build and config baseline required by all subsequent stories.
- Story 1.2 establishes the UI layout container.
- Story 1.3 provides the Rust `scan_vault` backend command consumed by Story 1.4.
- Story 1.4 implements the frontend file tree interactions.
- Story 1.5 adds cold-start session restoration to the vault and window.
