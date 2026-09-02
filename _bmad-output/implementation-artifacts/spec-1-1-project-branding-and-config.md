---
title: 'Story 1.1: Project Branding, Configuration & Hardening'
type: 'chore'
created: '2026-09-02'
baseline_revision: '4947e20f13c8dd8c0bdf8c9dadcdc8ba6537073b'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - _bmad-output/implementation-artifacts/epic-1-context.md
warnings: []
deferred:
  - summary: >-
      README.md still contains generic starter template text and title
    evidence: |-
      README.md line 1 is '# Tauri + React + Typescript'
    location: >-
      README.md:1
    severity: low
---

<intent-contract>

## Intent

**Problem:** The repository is currently configured with generic starter defaults (`tauri-app`, open `csp: null`, default window bounds) across npm, cargo, and Tauri manifests.

**Approach:** Update package.json, Cargo.toml, src-tauri/src/main.rs, tauri.conf.json, and index.html to rename the application to `snipnote`, configure bundle identifier `com.achuth.snipnote`, set minimum window dimensions of 800x600 with native traffic lights, and harden Tauri Content Security Policy.

## Boundaries & Constraints

**Always:**
- Keep crate and package names synchronized (`snipnote` package, `snipnote` crate, `snipnote_lib` library).
- Set `minWidth: 800` and `minHeight: 600` on the main window.
- Lock CSP to disallow external scripts (`default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:;`).
- Ensure both `cargo check` and `yarn build` pass with zero errors.

**Block If:**
- External credentials, certificates, or code signing configurations are demanded for basic local dev build.

**Never:**
- Allow `csp: null` or wildcard remote scripts in production config.
- Break the Rust entrypoint link (`main.rs` must call `snipnote_lib::run()`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cargo build check | `cargo check --manifest-path src-tauri/Cargo.toml` | Successfully builds with `snipnote_lib` crate | Exit code 0, no unresolved symbols |
| Frontend build check | `yarn build` | Successful TypeScript validation and Vite bundling | Exit code 0 |
| Window bounds config | Launch Tauri app | Window minimum size enforced to 800x600 | Reject window resize below 800x600 |

</intent-contract>

## Code Map

- `package.json` -- Root Node package manifest; update name to `snipnote`.
- `src-tauri/Cargo.toml` -- Rust package manifest; update package name to `snipnote` and lib name to `snipnote_lib`.
- `src-tauri/src/main.rs` -- Rust binary entry point; update import and invocation to `snipnote_lib::run()`.
- `src-tauri/tauri.conf.json` -- Tauri configuration; update `productName`, `identifier`, window `title`, `minWidth`, `minHeight`, and `csp`.
- `index.html` -- HTML template root; update document title to `snipnote`.

## Tasks & Acceptance

**Execution:**
- `package.json` -- Update `"name"` field from `"tauri-app"` to `"snipnote"` -- Establishes npm package identity.
- `src-tauri/Cargo.toml` -- Update `[package] name` to `"snipnote"` and `[lib] name` to `"snipnote_lib"` -- Establishes Cargo crate identity.
- `src-tauri/src/main.rs` -- Update call from `tauri_app_lib::run()` to `snipnote_lib::run()` -- Prevents compilation failure after lib renaming.
- `src-tauri/tauri.conf.json` -- Update `productName` to `"snipnote"`, `identifier` to `"com.achuth.snipnote"`, window `title` to `"snipnote"`, add `minWidth: 800` and `minHeight: 600`, and set `security.csp` -- Configures app windowing, branding, and CSP hardening.
- `index.html` -- Update `<title>` tag content to `"snipnote"` -- Ensures browser tab and title reflect correct name.

**Acceptance Criteria:**
- Given `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, when inspected, then the package name, crate name, and `productName` are all `snipnote`, the bundle identifier is `com.achuth.snipnote`, and the window title is `snipnote`.
- Given `src-tauri/tauri.conf.json`, when window settings are evaluated, then the window enforces `minWidth: 800`, `minHeight: 600`, and macOS native traffic light window controls.
- Given `src-tauri/tauri.conf.json`, when CSP is evaluated, then Tauri CSP is strictly configured to `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:;` with no external scripts allowed.
- Given the codebase after modifications, when `cargo check --manifest-path src-tauri/Cargo.toml` and `yarn build` are run, then both exit with code 0.

## Spec Change Log

## Review Triage Log

### 2026-09-02 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1: (high 0, medium 0, low 1)
- reject: 0
- addressed_findings:
  - none

## Design Notes

The crate library name `snipnote_lib` is required because Cargo cannot have a library and binary with identical crate types unless named distinctly on Windows and static linking setups. `main.rs` serves as the entrypoint dispatching to `snipnote_lib::run()`.

## Verification

**Commands:**
- `cargo check --manifest-path src-tauri/Cargo.toml` -- expected: Exit code 0, compiles `snipnote` and `snipnote_lib`
- `yarn build` -- expected: Exit code 0, builds `tsc && vite build` cleanly

## Auto Run Result

### Summary of Implemented Change
Rebranded the Tauri application, Rust crates, package manifests, and HTML shell from the generic starter template `tauri-app` to `snipnote`. Configured bundle identifier `com.achuth.snipnote`, minimum window dimensions of 800x600, native macOS window controls, and locked down Tauri Content Security Policy (`default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:;`).

### Files Changed
- `package.json`: Updated `name` to `snipnote`
- `src-tauri/Cargo.toml`: Updated package name to `snipnote` and lib name to `snipnote_lib`
- `src-tauri/src/main.rs`: Updated call from `tauri_app_lib::run()` to `snipnote_lib::run()`
- `src-tauri/tauri.conf.json`: Updated `productName` to `snipnote`, `identifier` to `com.achuth.snipnote`, window `title` to `snipnote`, added `minWidth: 800` & `minHeight: 600`, and configured strict `security.csp`
- `index.html`: Updated `<title>` to `snipnote`

### Review Findings Breakdown
- Patches applied: 0
- Items deferred: 1 (README.md template title update)
- Items rejected: 0

### Follow-up Review Recommendation
`false` (0 patches, score: 0)

### Verification Performed
- Ran `cargo check --manifest-path src-tauri/Cargo.toml`: Passed (compiled `snipnote` and `snipnote_lib` successfully).
- Ran `yarn build`: Passed (`tsc && vite build` bundled cleanly with 0 errors).

### Residual Risks
None. Clean separation and valid compilation.
