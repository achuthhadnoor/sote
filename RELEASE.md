# sote release checklist

Version **0.1.1** is configured in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. Keep those three in sync when bumping.

## Before first public build

1. **GitHub remote** — `achuthhadnoor/sote` (update `plugins.updater.endpoints` and `Cargo.toml` `repository` if the name differs).
2. **Updater private key** — already generated at `.tauri/snipnote.key` (gitignored; filename kept for existing backups). Back it up offline. Public key is embedded in `tauri.conf.json`.
3. **Apple Developer ID** (macOS) — install a **Developer ID Application** certificate (not Apple Development). Required for Gatekeeper + notarization.
4. **Notarization credentials** (macOS) — App Store Connect API key or `notarytool` Apple ID app-specific password.
5. **Windows code signing** (optional) — unsigned NSIS/MSI installs work for testing; for public SmartScreen-friendly releases, add an Authenticode certificate and wire signing later. Updater payload signatures still use `TAURI_SIGNING_PRIVATE_KEY` on all platforms.

## Environment for a signed macOS release

```bash
# Prefer the cert SHA when Keychain has duplicate display names
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
# export APPLE_SIGNING_IDENTITY="$(security find-identity -v -p codesigning | awk -F'\"' '/Developer ID Application/{print $1}' | awk '{print $2; exit}')"

export APPLE_ID="you@example.com"                 # or use API key vars below
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"

# Updater artifact signatures (PATH alone can fail; content env is reliable)
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$PWD/.tauri/snipnote.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

Optional App Store Connect API key:

```bash
export APPLE_API_KEY="..."
export APPLE_API_ISSUER="..."
export APPLE_API_KEY_PATH="/path/to/AuthKey_XXX.p8"
```

## Build

### macOS

```bash
yarn install
yarn tauri build
```

Confirm:

- `src-tauri/target/release/bundle/macos/sote.app`
- `src-tauri/target/release/bundle/dmg/*.dmg`
- Updater: `*.app.tar.gz` + matching `*.sig`

### Windows

On a Windows machine (or CI `windows-latest`):

```bash
yarn install
yarn tauri build
```

Confirm:

- `src-tauri/target/release/bundle/nsis/*.exe` (and/or `msi/*.msi`)
- Updater zip + `.sig` next to the installer when signing keys are set

WebView2 is required at runtime (bundled with recent Windows 11; evergreen bootstrapper otherwise).

## Publish

1. Tag: `git tag v0.1.0 && git push origin v0.1.0`
2. CI drafts a GitHub Release and uploads installers + updater archives + `.sig` + `latest.json`.
3. **Publish the draft** (Draft → Publish release). Until it is public, `…/releases/latest/download/latest.json` 404s and the in-app updater reports up-to-date / network error.
4. Endpoint expected by the app:

   `https://github.com/achuthhadnoor/sote/releases/latest/download/latest.json`

### Auto-updater behavior

- On launch (≈4s after window reveal), sote checks that endpoint if **Automatic Updates** is on (Settings → System; default on), at most every 12 hours.
- When a newer signed build is found, the user is prompted to download, install, and relaunch.
- **Check for Updates** in Settings always checks immediately and offers the same install prompt.
- Requires `TAURI_SIGNING_PRIVATE_KEY` in CI so `.sig` files match the public key in `tauri.conf.json`.

## CI

`.github/workflows/release.yml` builds on `v*` tags for:

- `macos-latest` — `aarch64-apple-darwin` and `x86_64-apple-darwin`
- `windows-latest` — default host target (NSIS/MSI + updater)

Add repository secrets:

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `.tauri/snipnote.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (empty string if none) |
| `APPLE_CERTIFICATE` | Base64 `.p12` of Developer ID Application |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` password |
| `APPLE_SIGNING_IDENTITY` | Full identity string |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarization (or API key equivalents) |

Windows Authenticode secrets are intentionally not required yet; add them when you implement codesigning.

## Smoke test

### macOS

- Fresh install from DMG on a second Mac (or clean user) — Gatekeeper should accept a notarized build.
- Open a folder, create/edit/save a note, ⌘P, theme + hue, Check for Updates (expects up to date on latest).
- Quit and relaunch — folder/tabs/theme restore.

### Windows

- Install from NSIS (or MSI) on Windows 11; confirm WebView2 present.
- Launch — native title bar + Mica (Win11); opaque-enough chrome if Mica unavailable.
- Open a folder on a drive letter path, create/edit/save a `.md` note, Ctrl+P palette, theme + hue.
- Deep link / file association: open a `.md` via Explorer “Open with” sote if registered.
- Check for Updates; quit and relaunch — session restore.
