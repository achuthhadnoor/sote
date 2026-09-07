# snipnote release checklist

Version **0.1.0** is configured in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. Keep those three in sync when bumping.

## Before first public build

1. **GitHub remote** — create `achuth/snipnote` (or update `plugins.updater.endpoints` and `Cargo.toml` `repository` if the name differs).
2. **Updater private key** — already generated at `.tauri/snipnote.key` (gitignored). Back it up offline. Public key is embedded in `tauri.conf.json`.
3. **Apple Developer ID** — install a **Developer ID Application** certificate (not Apple Development). Required for Gatekeeper + notarization.
4. **Notarization credentials** — App Store Connect API key or `notarytool` Apple ID app-specific password.

## Environment for a signed macOS release

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"                 # or use API key vars below
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"

# Updater artifact signatures
export TAURI_SIGNING_PRIVATE_KEY_PATH="$PWD/.tauri/snipnote.key"
# export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""   # only if the key is password-protected
```

Optional App Store Connect API key:

```bash
export APPLE_API_KEY="..."
export APPLE_API_ISSUER="..."
export APPLE_API_KEY_PATH="/path/to/AuthKey_XXX.p8"
```

## Build

```bash
yarn install
yarn tauri build
```

Confirm:

- `src-tauri/target/release/bundle/macos/snipnote.app`
- `src-tauri/target/release/bundle/dmg/*.dmg`
- Updater: `*.app.tar.gz` + matching `*.sig`

## Publish

1. Tag: `git tag v0.1.0 && git push origin v0.1.0`
2. Create a GitHub Release for that tag.
3. Upload DMG + updater `.tar.gz` + `.sig`, and a `latest.json` (tauri-action generates this in CI).
4. Endpoint expected by the app:

   `https://github.com/achuth/snipnote/releases/latest/download/latest.json`

## CI

`.github/workflows/release.yml` builds on `v*` tags. Add repository secrets:

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `.tauri/snipnote.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (empty string if none) |
| `APPLE_CERTIFICATE` | Base64 `.p12` of Developer ID Application |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` password |
| `APPLE_SIGNING_IDENTITY` | Full identity string |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarization (or API key equivalents) |

## Smoke test

- Fresh install from DMG on a second Mac (or clean user) — Gatekeeper should accept a notarized build.
- Open a folder, create/edit/save a note, ⌘P, theme + hue, Check for Updates (expects up to date on latest).
- Quit and relaunch — folder/tabs/theme restore.
