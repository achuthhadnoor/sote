---
title: Sprint Change Proposal — snipnote planning sync to shipped release
created: 2026-09-08
status: approved
approved: 2026-09-08
approved_by: Achuth
trigger: Post-delivery doc drift (Windows ship, chrome split, WelcomeGate, Settings tab, auto-updater)
mode: batch
scope: Major (planning replan) — product code already landed
handoff: Major → PM (bmad-prd) then Architect (bmad-architecture) then epics / project-context / sprint-planning
---

# Sprint Change Proposal — snipnote

## 1. Issue Summary

**Problem:** Planning artifacts (PRD, Architecture, Epics, older specs) still describe a **macOS-primary / Overlay-everywhere / Settings-modal / updater-deferred** product. The shipped app is a **macOS + Windows** release with platform-split window chrome, WelcomeGate, Settings-as-tab, tint/transparency controls, sidebar collapse, Find/Replace, and an automatic updater.

**When discovered:** 2026-09-08, after Windows compatibility work, UX spine fast-path sync, and auto-updater client wiring — while preparing to “update all BMad documents.”

**Evidence:**

| Area | Artifact claim (stale) | Shipped reality |
|---|---|---|
| Platform | macOS primary; Win/Linux “ready but not QA’d”; OQ-5 open | Windows in CI (`windows-latest`) + release docs; Mica + native decorations |
| Window chrome | Universal Overlay + combined `EffectsBuilder([Sidebar, Mica])` | Overlay + Sidebar **macOS-only**; native title + Mica **Windows** |
| Settings | Modal overlay `SettingsDialog` | Editor **tab** `SettingsView` (theme, hue, intensity, reduce transparency, spellcheck, autostart, updater, logs) |
| First launch | Simple “No vault open” | **WelcomeGate** brand + drop zone + Choose Folder |
| Updater | Deferred / placeholder | Pubkey + GitHub `latest.json` + startup auto-check + Settings toggle |
| UX spines | Were draft / Overlay-centric | **Updated `final` 2026-09-08** (`DESIGN.md` / `EXPERIENCE.md`) |
| NFR-3 | “No outbound network in v1” | Updater requires HTTPS to GitHub Releases (opt-in install; check is automatic when enabled) |

This is **documentation / plan ratification after successful delivery**, not a failed approach or product rollback.

---

## 2. Impact Analysis

### Checklist status (batch)

#### §1 Trigger & context
- [x] 1.1 Trigger — not a single failing story; **Epic 1 + Epic 5 / Story 5.9** plus post-MVP delivery deltas
- [x] 1.2 Type — **Strategic / delivery reality** (platform + distribution landed; docs lag)
- [x] 1.3 Evidence — table above + `lib.rs` chrome/effects, `WelcomeGate`, `SettingsView`, `src/lib/updater.ts`, `.github/workflows/release.yml`

#### §2 Epic impact
- [x] 2.1 Epic 1 still completable — **yes**, but ACs for 1.1 / 1.6 / 1.7 must be rewritten to match shipped chrome/Settings
- [x] 2.2 Modify Epic 1 + Epic 5 descriptions/ACs; **no new epic required** for Windows/updater (fits Epic 1 shell + Story 5.9)
- [x] 2.3 Epics 2–4 largely unaffected (path/`\` helpers already shipped; call out in FR notes only)
- [x] 2.4 No epic obsolete; optionally add **post-MVP** notes for HTML mock refresh / Authenticode
- [x] 2.5 Priority: **docs sync first**; no epic resequence for code

#### §3 Artifact conflicts
- [!] 3.1 **PRD** — Action-needed (many sections)
- [!] 3.2 **Architecture** — Action-needed (AD-9, AD-10, AD-11, structural seed, FR map)
- [x] 3.3 **UX** — Done (2026-09-08); optional HTML mock regen
- [!] 3.4 **Other** — Epics + story ACs; specs 1.1/1.6/1.7/5.9; RELEASE already current; missing `AGENTS.md` / sprint-status

#### §4 Path forward
- [x] 4.1 **Direct Adjustment** — Viable (Low effort docs, Low risk) — **SELECTED**
- [x] 4.2 Rollback — **Not viable** (would discard shipped Windows/updater value)
- [x] 4.3 MVP Review — Partially relevant: **expand** MVP platform/updater language; do not shrink core editor MVP
- [x] 4.4 Selected: **Option 1 (Direct Adjustment) + light MVP wording expansion**

---

### Epic Impact

| Epic | Impact |
|---|---|
| **Epic 1** | High — rewrite window chrome, WelcomeGate, Settings-as-tab, tint, collapsible sidebar in inventory + stories 1.1, 1.4, 1.6, 1.7 |
| **Epic 2** | Low — note Windows path separators in fidelity notes only |
| **Epic 3** | None material |
| **Epic 4** | Low — `modShortcut` labels in palette/status copy |
| **Epic 5** | Medium — Story 5.1 chrome ACs platform-split; **5.9** mark auto-updater as shipped (startup check + toggle), not placeholder |

### Story impact (edit targets)

- **1.1** — Overlay / EffectsBuilder ACs → platform-cfg rules
- **1.6** — Split effects by OS; Windows native decorations
- **1.7** — SettingsDialog → SettingsView tab; tint + reduce transparency
- **5.1** — Overlay not universal; F11 on non-mac
- **5.9** — Auto-check on launch; publish draft release required; NSIS prefer

### Artifact conflicts summary

| Artifact | Action |
|---|---|
| UX DESIGN / EXPERIENCE | **Keep** (already final) |
| UX `*.html` mocks | Optional regenerate |
| PRD | **Update** (required) |
| Architecture spine | **Update** (required) |
| Epics.md | **Update** inventory + Epic 1/5 stories |
| Specs 1.1, 1.6, 1.7, 5.9 | Annotate “ratified 2026-09-08” or light AC sync |
| `AGENTS.md` | **Create** via project-context |
| sprint-status | Create/repair after epic edits |

### Technical impact (code)

Already landed. Residual product polish (not blocking this proposal):

- Settings copy “Launch at Login … this Mac” → platform-neutral (noted in UX spine)
- First public release must be **published** (not draft) for updater endpoint

---

## 3. Recommended Approach

**Selected: Direct Adjustment** of planning artifacts to ratify shipped behavior.

**Rationale:** Code and UX spines already match product intent. Rolling back would destroy delivery value. MVP should **acknowledge** macOS + Windows + auto-updater rather than keep “deferred” language that misleads agents.

| Factor | Assessment |
|---|---|
| Effort | **Low–Medium** (doc/skill passes only) |
| Risk | **Low** (no code rollback) |
| Timeline | Same day–few sessions if fresh windows per skill |
| Momentum | Preserves ship narrative; unblocks accurate agent work |

**MVP impact:** Core editor MVP unchanged. Platform/distribution language expands: Windows is in-scope for release; updater is in-scope with user consent to install; Linux remains opaque/non-QA.

---

## 4. Detailed Change Proposals

### 4.1 UI/UX — DONE (reference only)

No further spine edits required for this proposal. Optional: regenerate `DESIGN.html` / `EXPERIENCE.html` to match Overlay-vs-native chrome.

---

### 4.2 PRD (`prd-snipnote-2026-09-02/prd.md`)

**Frontmatter**

```
OLD: status: draft; updated: 2026-09-03
NEW: status: final (or draft→updated); updated: 2026-09-08
+ changelog entry: Windows first-class; chrome split; WelcomeGate; Settings tab; auto-updater
```

**§3 Glossary — Settings / Theme**

```
OLD: Settings — Modal overlay …
NEW: Settings — Editor tab (SettingsView) opened via ⌘,/Ctrl+, or gear; Appearance (theme, hue, intensity, reduce transparency), Writing, System (autostart, updates), Diagnostics

OLD: Theme — light/dark/system + translucent over material
NEW: Theme — as above + user tint hue/intensity; Reduce Transparency forces opaque fills
```

**Add glossary:** WelcomeGate — brand-first first-run drop zone when no vault.

**FR-1 / UJ:** Add drag-drop folder open + WelcomeGate path (UJ-3 Windows first-run optional).

**FR-11**

```
OLD: Overlay titleBarStyle + EffectsBuilder([Sidebar,Mica]) + traffic lights over vibrant
NEW: macOS: Overlay + empty title + Effect::Sidebar + radius 12
     Windows: native decorations + title "snipnote" + Effect::Mica (soft-fail older)
     Linux: native + opaque fallback
```

**FR-12 / FR-13**

```
OLD: Settings modal; theme radios only
NEW: Settings tab; theme + hue + intensity + reduce transparency; close via ⌘, again or close tab
```

**New FR (or extend 5.9 into PRD Adapt-In):**  
**FR-14 (distribution):** Auto-update check (default on, ≤12h) against GitHub `latest.json`; prompt → downloadAndInstall → relaunch; manual Check in Settings; Launch at Login.

**§6.1 In Scope** — Add Windows release + auto-updater + WelcomeGate + Settings tab features.

**§6.2 Out of Scope**

```
OLD: Mobile / web / Linux packaged builds [macOS first, Win/Linux not QA'd]
NEW: Mobile / web still out; Linux packaged/QA still non-goal; Windows IS in MVP release scope
```

**§8 Open Questions**

```
OQ-5 RESOLVED 2026-09-08: Ship macOS + Windows; Linux opaque/non-QA
+ Note updater requires published (non-draft) GitHub Release
```

**Adapt-In Platform / Privacy**

```
OLD: Auto-update deferred; No network calls in v1
NEW: Auto-update via tauri-plugin-updater + signed artifacts; outbound HTTPS only for updater check/download (no telemetry)
```

**IA** — Settings overlay → Settings tab; WelcomeGate surface; platform-aware shortcut chips.

---

### 4.3 Architecture (`ARCHITECTURE-SPINE.md`)

**AD-9 Vibrant Window Material**

```
OLD: EffectsBuilder([Sidebar, Mica]) + Overlay for product window
NEW: #[cfg(macos)] Sidebar + radius 12 + Overlay empty title
     #[cfg(windows)] Mica only, native decorations, titled window
     No combined effect list; soft-fail when material unavailable
```

**AD-10 Theme + Settings**

```
OLD: SettingsDialog overlay
NEW: SettingsView as virtual/settings tab; useThemeStore tint + bgOpacity; modShortcut for labels
```

**AD-11 Network**

```
OLD: Strict local-only / no outbound
NEW: Default local-only EXCEPT updater plugin HTTPS to configured endpoints; no telemetry; CSP unchanged for WebView
```

**Structural seed**

```
OLD: SettingsDialog.tsx
NEW: SettingsView.tsx, WelcomeGate.tsx, utils/platform.ts, utils/paths.ts, lib/updater.ts
```

**Capability map** — Update FR-11 / FR-12 / FR-13 rows; add updater row → AD-11 + plugin registration in `lib.rs`.

**Frontmatter** — `updated: 2026-09-08`; bind new FR if numbered.

---

### 4.4 Epics (`epics.md`)

**Inventory FR-11 / FR-13 / UX-DR3 / UX-DR9 / UX-DR10** — Align to UX spine + PRD proposals above.

**NFR-3** — Exception for updater HTTPS.

**Epic 1 blurb** — Platform-split chrome; WelcomeGate; Settings tab.

**Story 1.1 AC** — Replace universal Overlay/combined effects with platform-cfg acceptance.

**Story 1.6 AC** — Split mac/win effects; Windows native chrome.

**Story 1.7 AC** — SettingsView tab; tint; reduce transparency; path `SettingsView.tsx`.

**Story 5.1 AC** — Overlay mac-only; F11 non-mac.

**Story 5.9 AC**

```
OLD: Placeholder updater / Check button only
NEW: Automatic Updates toggle (default on); startup check ~4s after reveal ≤12h;
     Check button; downloadAndInstall + relaunch; CI latest.json + publish draft required
```

**ARCH-9 note** — Already superseded by draft-until-content (AD-8); leave historical or strike.

---

### 4.5 Specs (lightweight)

Annotate frontmatter or footer on:

- `spec-1-1-project-branding-and-config.md`
- `spec-1-6-vibrant-window-material.md`
- `spec-1-7-theme-settings.md`
- `spec-5-9-distribution.md`

```
status: ratified-as-shipped-with-deltas
see: sprint-change-proposal-2026-09-08.md
```

Full rewrite optional if agents still read ACs as source of truth — prefer epics + PRD + arch as spine.

---

### 4.6 Project context / tracking

| Item | Proposal |
|---|---|
| `AGENTS.md` | Create via `bmad-project-context` with verified commands, Windows/mac chrome rules, updater pitfalls (draft releases) |
| sprint-status | Create/repair via `bmad-sprint-planning` after epic edits |
| HTML UX mocks | Optional visual refresh |

---

## 5. Implementation Handoff

**Scope classification: Major (planning)** — PM + Architect artifact updates; **Minor (code)** for leftover copy polish only.

### Execution order (fresh context windows recommended)

| Step | Skill / agent | Deliverable |
|---|---|---|
| 0 | — | This proposal approved |
| 1 | ~~`bmad-ux`~~ | Already done 2026-09-08 |
| 2 | `bmad-prd` (Update) / John | PRD sections in §4.2 |
| 3 | `bmad-architecture` / Winston | AD-9/10/11 + seed + FR map |
| 4 | `bmad-create-epics-and-stories` or targeted edit | `epics.md` Epic 1/5 + inventory |
| 5 | `bmad-project-context` | `AGENTS.md` |
| 6 | `bmad-sprint-planning` | sprint-status file |
| 7 | Optional `bmad-ux` | HTML mocks |
| 8 | Optional `bmad-build` | Launch-at-Login copy fix |

### Success criteria

1. PRD Adapt-In Platform matches shipped macOS+Windows + updater
2. Architecture AD-9/10/11 match `lib.rs` + SettingsView + updater
3. Epics Story 1.1/1.6/1.7/5.9 ACs no longer contradict code
4. `AGENTS.md` warns agents not to reintroduce Overlay-on-Windows or Settings modal
5. No requirement to rewrite Epics 2–4 wholesale

### What not to do

- Do not roll back Windows chrome or updater
- Do not reopen MVP for Canvas/Terminal
- Do not invent new epics for WelcomeGate/tint — fold into Epic 1 / FR-12–13

---

## Approval

**Status:** Approved by Achuth on 2026-09-08.

**Implementation executed (same day):**
- PRD → `status: final`, FR-11–14, UJ-3, OQ-5 resolved, Adapt-In synced
- Architecture → AD-9/10/11 updated, AD-12 added, seed + FR map synced
- Epics → inventory + Epic 1/5 story ACs synced
- `AGENTS.md` created
- `implementation-artifacts/sprint-status.md` created

**Still optional:** UX HTML mock regen; spec footers; Launch-at-Login copy polish.
