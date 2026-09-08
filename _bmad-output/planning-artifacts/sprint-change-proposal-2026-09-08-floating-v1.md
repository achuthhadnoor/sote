---
title: Sprint Change Proposal — Floating menubar notes as v1; full shell as v2
created: 2026-09-08
status: approved
approved: 2026-09-08
approved_by: Achuth
trigger: Invert ship order — menubar/tray floating notes = v1; existing full vault editor = v2 behind flag
mode: batch
scope: Major (MVP replan)
handoff: Major → PM (bmad-prd) → UX → Architecture → Epic F → bmad-build
supersedes_partial: sprint-change-proposal-2026-09-08.md (platform sync remains valid; MVP surface flips)
---

# Sprint Change Proposal — snipnote Floating v1

## 1. Issue Summary

**Problem:** Planning and the default product UX assume a **full-size vault editor** as v1. Achuth now wants to **ship first** as a **Raycast Notes–like floating panel** reachable from the **menu bar (macOS) / system tray (Windows)**, while keeping the existing full app as **v2 behind a feature flag**, reusing the same editor, settings, and window-material patterns.

**When identified:** 2026-09-08, after full-shell + Windows/updater work, during go-to-market discussion (unsigned distribution + faster “notes always available” wedge).

**Evidence:**

| Source | Current claim | New intent |
|---|---|---|
| PRD §5 / §6.2 | Floating deferred to **v5**; not MVP | Floating + tray = **v1 MVP** |
| PRD Vision | Full-size beside Ghostty | Menubar quick notes first; full shell later |
| UX spines | Full window IA (Sidebar, TabBar, WelcomeGate) | Compact floating panel default |
| Epics 1–5 | Full shell = done/ship | Shell = **v2**; new Epic 0 / 6 for tray+float |
| Code | Single main full window; **no tray** yet | Add tray + floating window; gate full `App` shell |
| Product ask | Reuse `EditorSurface`, Settings, window type | Shared core; dual presentation |

This is an **MVP Review** (surface + journey change), not a technical failure. Full-shell code is an asset for v2, not waste.

---

## 2. Impact Analysis

### Checklist status (batch)

#### §1 Trigger & context
- [x] 1.1 Trigger — strategic pivot (ship order), not a failing story
- [x] 1.2 Type — **Strategic pivot / MVP redefinition**
- [x] 1.3 Evidence — conversation + PRD anti-floating language + no tray in codebase

#### §2 Epic impact
- [x] 2.1 Current “ship Epic 1–5 as default” plan — **no longer the v1 ship plan**
- [!] 2.2 **Add** Epic F (Floating & Tray v1); **re-label** Epic 1 shell / multi-tab vault IA as **v2**
- [x] 2.3 Epics 2–3 (editor fidelity, watcher) — **keep**; power floating + full shell
- [x] 2.4 Epic 4 palette/tabs — **v2-primary**; floating may use simplified note switcher
- [x] 2.5 Priority — **Floating+tray first**; full shell flagged off in release builds

#### §3 Artifact conflicts
- [!] 3.1 PRD — Action-needed (vision, UJs, MVP in/out, floating FRs)
- [!] 3.2 Architecture — Action-needed (multi-window, tray, feature flag AD)
- [!] 3.3 UX — Action-needed (floating panel EXPERIENCE/DESIGN; full shell = v2 mode)
- [!] 3.4 AGENTS.md, sprint-status, RELEASE messaging — Action-needed

#### §4 Path forward
- [x] 4.1 Direct Adjustment — Viable for stories (add floating epic; gate shell) — part of hybrid
- [x] 4.2 Rollback — **Not viable** (do not delete full shell)
- [x] 4.3 **MVP Review** — **SELECTED primary** — redefine what “v1” means
- [x] 4.4 Hybrid: **MVP Review + Direct Adjustment** (new epic + flag; no code rollback)

---

### Epic Impact

| Epic | Impact |
|---|---|
| **NEW Epic F — Floating Notes & Tray (v1)** | Create — tray, global hotkey, floating panel, last/active note, Settings in panel |
| **Epic 1** | Reclassify **v2 shell**; keep stories; default off behind `full_editor` / `v2_shell` flag |
| **Epic 2** | Shared — editor engine stays; floating hosts `EditorSurface` |
| **Epic 3** | Shared — watcher still applies when vault/file open |
| **Epic 4** | Mostly **v2** (palette/multi-tab); optional thin “recent notes” in float |
| **Epic 5** | Split — updater/autostart stay v1; Overlay-heavy chrome ACs apply to full shell / float separately |

### Story impact

| Action | Stories |
|---|---|
| **New** | F.1 Tray/menubar icon + menu (Show / New / Settings / Quit) |
| **New** | F.2 Floating panel window (compact, always-on-top option, material) |
| **New** | F.3 Global hotkey toggle show/hide |
| **New** | F.4 Host `EditorSurface` + autosave against vault note path |
| **New** | F.5 Settings in floating chrome / open Settings surface |
| **New** | F.6 Feature flag: enable full editor (v2) → current `App` shell |
| **Amend** | 1.1 / 1.2 — dual window labels; main may be hidden; float is default visible UI |
| **Defer (v2)** | WelcomeGate-as-default, Sidebar-always, multi-tab IA as primary |

### Artifact conflicts

| Artifact | Action |
|---|---|
| PRD | Rewrite MVP, vision wedge, UJs; move full-shell to v2; add floating FRs |
| UX DESIGN / EXPERIENCE | New floating-first Foundation + flows; full shell section marked v2 |
| Architecture | AD: tray plugin, window roles (`float` / `main`), feature flag |
| Epics | Add Epic F; mark Epic 1 default path as v2 |
| AGENTS.md | Default product = floating; full shell flag |
| sprint-status | Reprioritize next actions to Epic F |

### Technical impact (code)

| Area | Change |
|---|---|
| Dependencies | Add `tauri-plugin-tray` (and/or menu) + global shortcut plugin if not present |
| `lib.rs` | Create/hide `float` window; optional hide `main` unless v2 flag; tray menu |
| Frontend | `FloatingApp` / panel shell wrapping `EditorSurface` + Settings; gate current `App` |
| Flag | `localStorage` / env / Settings “Full editor (beta)” → show main vault window |
| CI / release | Same pipelines; marketing copy = menubar notes |

**No rollback** of TipTap, storage, updater, Windows chrome work.

---

## 3. Recommended Approach

**Selected: Hybrid — MVP Review + Direct Adjustment**

1. Redefine **v1 MVP** = menubar/tray + floating notes panel + shared editor/settings + updater.  
2. Keep full vault shell in repo as **v2**, default **off**, enable via flag.  
3. Add **Epic F** stories; do not delete Epic 1–5.

| Factor | Assessment |
|---|---|
| Effort | **Medium** (new tray/window shell; reuse editor) |
| Risk | **Medium** (positioning vs Mote/Raycast Notes; tray UX per OS) |
| Timeline | Faster demoable “notes always there” than polishing full vault GTM |
| Momentum | Preserves all editor investment |

**MVP impact:** Full-shell FRs (Sidebar, multi-tab, WelcomeGate, ⌘P-as-primary) move to **v2**. Floating + tray + one active note (+ optional recent) become **v1 in-scope**.

---

## 4. Detailed Change Proposals

### 4.1 PRD

**Vision / wedge**

```
OLD: Full-size companion beside Ghostty; floating deferred to v5
NEW: v1 — notes always available from menu bar / tray (floating panel).
     v2 — full vault editor (existing shell) behind flag / later release.
```

**Non-goals**

```
OLD: Not a floating capture panel in v1
NEW: Remove that line. Non-goal becomes: not a full Obsidian replacement in v1;
     not multi-window vault IDE as default.
```

**§6.1 In scope (v1)**

- Tray / menu bar presence + Show/Hide/New/Quit  
- Floating panel hosting `EditorSurface`  
- Global hotkey  
- Settings (theme/tint/updater/autostart) reachable from panel/tray  
- Vault path + note file persistence (may use last note / default notes folder)  
- Auto-updater  
- Feature flag entry to full editor (optional in v1 UI, off by default)

**§6.2 Out of scope (v1) / v2**

- Sidebar + multi-tab + WelcomeGate + ⌘P vault jump as **default** UX  
- Right Panel, Canvas, Terminal (still later)

**New UJ**

- **UJ-F1:** Jordan hits hotkey → floating panel → types note → dismisses; opens later from menu bar  
- **UJ-1/2** (Alex/Priya full vault): re-tag **v2**

**New FRs (illustrative IDs)**

- **FR-F1** Tray/menubar icon and menu  
- **FR-F2** Floating panel window show/hide  
- **FR-F3** Global shortcut  
- **FR-F4** Edit note in panel via shared EditorSurface + autosave  
- **FR-F5** Open Settings from tray/panel  
- **FR-F6** Enable full editor (v2 shell) via flag  

Keep FR-6/7/8/12/14 as shared. FR-2/4/5/9/11-full-shell → v2.

---

### 4.2 UX (DESIGN.md / EXPERIENCE.md)

**Foundation**

```
OLD: Single full-size vibrant window as the product
NEW: Default surface = compact floating panel from tray.
     Full shell = v2 mode when flag on.
```

**New IA (v1)**

| Surface | Purpose |
|---|---|
| Tray / menu bar | Always available; Show, New note, Settings, Quit |
| Floating panel | EditorSurface + minimal chrome (title/path, pin?, close/hide) |
| Settings | Existing SettingsView (panel or small window) |
| Full App (v2) | Current shell — documented as secondary |

**Flows:** UJ-F1 hotkey ↔ panel; pin/always-on-top [ASSUMPTION — confirm in UX update].  
**Do:** brand-first calm panel; platform shortcut chips.  
**Don’t:** ship Sidebar as first viewport.

---

### 4.3 Architecture

**New AD-13 — Dual presentation: Float (v1) + Full shell (v2 flag)**

- Window labels: `float` (default UX), `main` (full shell, created on demand or hidden at boot).  
- Tray via Tauri tray plugin; left-click/menu → show `float`.  
- Global shortcut registered in Rust.  
- Feature flag `snipnote-full-editor` (localStorage + optional env) gates mounting current `App` shell / showing `main`.  
- Both presentations share Zustand stores, `EditorSurface`, `SettingsView`, Rust storage/watcher/updater.  
- Floating window: compact size (e.g. ~420×520 [ASSUMPTION]), platform material reuse where sensible; may use decorations:false or Overlay-like chrome per UX.

**Structural seed adds:** tray setup in `lib.rs`, `FloatingShell.tsx`, flag helper.

**AD-9 note:** Full-shell Overlay rules still apply to `main`; `float` may use its own chrome decision in UX/arch update — do not blindly copy Overlay traffic-light insets into a tiny panel.

---

### 4.4 Epics

**Add Epic F: Floating Notes & Menu Bar (v1 Ship)**

- F.1 System tray / menu bar + menu actions  
- F.2 Floating panel window lifecycle (show/hide, focus, quit-to-tray [ASSUMPTION])  
- F.3 Global hotkey  
- F.4 Embed EditorSurface + note path / new note  
- F.5 Settings from tray/panel  
- F.6 Feature flag → open full v2 shell  

**Amend Epic 1 header**

```
OLD: Users can launch the branded vibrant full-size application…
NEW: (v2) Users can enable the full vault shell…
```

**Epic 2–3:** Mark **shared foundation** for v1+v2.  
**Epic 4:** Mark **v2-primary**.  
**Epic 5.9:** Remains **v1** (updater/autostart).

---

### 4.5 AGENTS.md / sprint-status

```
OLD: Default product = full-size vault editor
NEW: Default = floating + tray; full App shell is v2 behind flag; do not remove shell code
```

Sprint next actions → implement Epic F; pause “publish full-shell as primary GTM.”

---

### 4.6 Open decisions (non-blocking for proposal approval; resolve in UX/PRD Update)

1. Quit behavior: Quit app vs hide to tray?  
2. Default vault: existing last vault vs dedicated `~/Notes`?  
3. One note only vs recent-notes list in panel?  
4. Always-on-top default on or off?  
5. Hotkey default (`⌘⇧Space` / `Ctrl+Shift+Space`)?  

Record as `[ASSUMPTION]` in PRD Update if not answered before Finalize.

---

## 5. Implementation Handoff

**Scope: Major (planning + new epic)** — then Build.

### Order (fresh windows recommended)

| Step | Skill | Deliverable |
|---|---|---|
| 1 | `bmad-prd` Update | MVP flip + FR-F* + UJ-F1 |
| 2 | `bmad-ux` Update | Floating-first spines |
| 3 | `bmad-architecture` | AD-13 dual window + tray |
| 4 | `bmad-create-epics-and-stories` / edit epics | Epic F + v2 labels |
| 5 | Update `AGENTS.md` + sprint-status | Agent guardrails |
| 6 | `bmad-build` | Tray + float + flag |

### Success criteria

1. Cold install → tray icon, no mandatory full vault window  
2. Hotkey / tray → floating panel with working EditorSurface + save  
3. Settings + updater still reachable  
4. Flag enables today’s full shell without deleting it  
5. PRD/UX/Arch no longer call floating “v5 deferred”

### What not to do

- Do not delete Sidebar/TabBar/WelcomeGate code  
- Do not block v1 on Apple/Windows code signing  
- Do not rebuild TipTap stack  

---

## Approval

**Status:** Approved by Achuth on 2026-09-08.

**Handoff:** Major — PRD Update → UX Update → Architecture (AD-13) → Epic F stories → Build floating+tray; full shell remains v2 behind flag.
