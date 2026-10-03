# Grimoire v3 — Migration Gap Analysis

**Status:** Task 03 Phase 8 — re-evaluated against real source at commit `ad5e268`.
**Schema (directive):** ID · Source · Evidence · Description · Impact · Severity · Blocking status · Proposed resolution (AC-33).
**Rule applied:** a gap is closed ONLY when the actual source resolves it. Task 02 records were re-evaluated in place; history is noted, never erased.

---

## 1. Re-evaluation of GAP-001…GAP-012 (Task 02 records)

### GAP-001 — Legacy curriculum source absent → **RESOLVED**

| Field | Value |
|---|---|
| ID | GAP-001 |
| Source | Task 02 audit; re-evaluated 2026-10-02 against `git ls-files` |
| Evidence | Commit `ad5e268` contains `Part1.md`–`Part9.md`, `Part4_AllLessons.md`, `Projects.md`, `Interludes.md`, `Grimoire.md` (integrity: `11` §1) |
| Description | Curriculum files that were missing are now delivered and mapped (`07` §2–§4). |
| Impact | Phase 4 mapping executed: 9/9 parts, 20/20 declared chapters, 76/76 projects, 2/2 interludes. |
| Severity | was critical → now none |
| Blocking status | **NO — closed** |
| Proposed resolution | none needed; keep `07` tied to `ad5e268` |

### GAP-002 — Legacy hotkey definitions absent → **RESOLVED**

| Field | Value |
|---|---|
| ID | GAP-002 |
| Source | Task 02 audit; re-evaluated against source |
| Evidence | 43 Grimoire hotkey identities extracted with anchors (`08` §4); timeline (`08` §7) |
| Description | Hotkey definitions found across `Readme.md`, `Grimoire.md`, `Interludes.md`, `Part1.md`, `Part3.md`, `PatchNotes.md`, `ReplitDeployInstructions.md`. |
| Impact | Phase 5 executed; H1–H7 comparison run per row. |
| Severity | was critical → now none |
| Blocking status | **NO — closed** |
| Proposed resolution | none; residual metadata issues live in GAP-009/017 |

### GAP-003 — Projects/parts/chapters/interludes absent → **RESOLVED**

| Field | Value |
|---|---|
| ID | GAP-003 |
| Source | Task 02 audit; re-evaluated |
| Evidence | 76 numbered projects mapped with `file:line` anchors (`07` §4); structures in `07` §2–§3 |
| Description | All structural curriculum elements delivered and mapped. |
| Impact | Accounting tests MIG-02/MIG-04 now non-vacuous. |
| Severity | was critical → now none |
| Blocking status | **NO — closed** |
| Proposed resolution | none |

### GAP-004 — Supporting documentation absent → **RESOLVED**

| Field | Value |
|---|---|
| ID | GAP-004 |
| Source | Task 02 audit; re-evaluated |
| Evidence | `RecommendedTools.md` (46 links), `PatchNotes.md` (50 version entries), `GPTavern.md`, `Readme.md`, `ReplitDeployInstructions.md` (`06` §2) |
| Description | Recommended tools, patch notes, supporting docs delivered and inventoried. |
| Impact | Inventory §2 complete for all 13 required asset classes. |
| Severity | was critical → now none |
| Blocking status | **NO — closed** |
| Proposed resolution | none |

### GAP-005 — README token `اجنيت` semantics → **UNRESOLVED**

| Field | Value |
|---|---|
| ID | GAP-005 |
| Source | `README.md:1` (pre-existing line) |
| Evidence | Legacy `Readme.md` now found (`Readme.md:1` = "## README / Welcome to Grimoire!") — a DIFFERENT file from root `README.md`; token still unexplained |
| Description | It remains unknown whether `اجنيت` is legacy content, a title, or unrelated test content. |
| Impact | README-material migration kept verbatim; no interpretation applied. |
| Severity | low |
| Blocking status | **NO** |
| Proposed resolution | executive confirms the token's meaning |

### GAP-006 — No recoverable legacy git history → **RESOLVED (with note)**

| Field | Value |
|---|---|
| ID | GAP-006 |
| Source | Task 02 audit; re-evaluated after `git fetch` |
| Evidence | `main` now has `2ec129b → ef9df02 → ad5e268`; source recoverable byte-for-byte at `ad5e268` |
| Description | Source is now in git history. Note: no history predating the upload exists — content-level history was never in this repository. |
| Impact | MIG-06 preservation checks can run against commit bytes. |
| Severity | was high → low (historical absence remains a fact) |
| Blocking status | **NO — closed for recovery purposes** |
| Proposed resolution | none; accept that pre-upload authoring history is out of reach |

### GAP-007 — No runtime code → **UNRESOLVED**

| Field | Value |
|---|---|
| ID | GAP-007 |
| Source | working tree (`git ls-files`: 17 source md + docs, zero code files) |
| Evidence | no package manifest, no source code of any language |
| Description | Scenario/mutation acceptance tests (AC-05…AC-16, AC-19/20, AC-23/24) still cannot execute. |
| Impact | Task 03 validation limited to static tests; reported NOT RUN, never faked. |
| Severity | medium |
| Blocking status | **NO** (blocks runtime tests only) |
| Proposed resolution | build runtime in a future task, then run the [R]/[M] backlog |

### GAP-008 — Assumption: source will be delivered → **RESOLVED**

| Field | Value |
|---|---|
| ID | GAP-008 |
| Source | Task 02 `ASSUMPTION` |
| Evidence | Delivery occurred: commit `ad5e268`, 17 expected files present |
| Description | The assumption held true. |
| Impact | unblocked GAP-001…004, 006 |
| Severity | none |
| Blocking status | **NO — closed** |
| Proposed resolution | none |

### GAP-009 — Hotkey metadata may be insufficient → **UNRESOLVED (realized: 5 rows)**

| Field | Value |
|---|---|
| ID | GAP-009 |
| Source | `03` §4 H1 vs actual source documentation |
| Evidence | `F` purpose never stated (`Readme.md:41`, `Interludes.md:70`); `VV` only "New VV hotkey" (`PatchNotes.md:95`); `google` single mention (`PatchNotes.md:264`); `TT` purpose absent (`PatchNotes.md:73`); `i` identity ambiguous (`PatchNotes.md:143`) |
| Description | 5 hotkey rows cannot fill all 7 registration fields from source. |
| Impact | Those rows cannot reach COMPATIBLE without executive-supplied intent or runtime observation. |
| Severity | medium |
| Blocking status | **NO** (rows migrate as INSUFFICIENT/AMBIGUOUS; blocks their registration later) |
| Proposed resolution | executive documents intent for F, VV, google, TT, i — or authorizes observed-behavior inference; precise evidence requests delivered in `13-hotkey-decision-sheet.md` Parts B5/C (Task 04) — status stays UNRESOLVED until evidence or a ruling arrives |

### GAP-010 — Terminology conflicts untestable → **UNRESOLVED (realized: enumerated)**

| Field | Value |
|---|---|
| ID | GAP-010 |
| Source | cross-file comparison of source |
| Evidence | Ch8 "Stoneweaving" vs "Earthbending" (`Grimoire.md:32` vs `Part2.md:71`); Ch15 "201" vs "103" (`Grimoire.md:51` vs `Part4_AllLessons.md:20`); 12 project-title variants (`07` A9); hotkey overloads (GAP-017) |
| Description | Source uses multiple names/titles for the same entities. |
| Impact | All variants preserved; future display layers must choose (execution-time decision, not migration). |
| Severity | medium |
| Blocking status | **NO** |
| Proposed resolution | executive picks canonical display titles *for v3 UI only* — source text remains untouched |

### GAP-011 — URL inventory empty → **RESOLVED**

| Field | Value |
|---|---|
| ID | GAP-011 |
| Source | Task 02 audit; re-evaluated |
| Evidence | 174 unique URLs extracted deterministically (`06` §6; `scripts/migration-extract.sh urls`) |
| Description | URL preservation now testable. |
| Impact | URL-preservation check runs as part of MIG-06/07 scope. |
| Severity | was low → none |
| Blocking status | **NO — closed** |
| Proposed resolution | none; reachability checking is out of scope (offline migration) |

### GAP-012 — H2 mode-mapping risk (CA-01 watch) → **RESOLVED as conflict; residuals in GAP-017**

| Field | Value |
|---|---|
| ID | GAP-012 |
| Source | Task 02 conditional watch |
| Evidence | Tested against all 43 rows: every non-UNKNOWN hotkey maps to one of the nine Core modes (`08` §2); operation hotkeys use mode TOOL + declared micro-behavior adapter (`08` §5) |
| Description | No hotkey violates H2 outright. Residual issues are source *conflicts* and *missing metadata*, not contract violations. |
| Impact | CA-01 verdict: adapter-solvable, non-blocking (`10` §CA-01). |
| Severity | was low → none as a contract risk |
| Blocking status | **NO — closed**; see GAP-015/017 for real residuals |
| Proposed resolution | none to Core |

---

## 2. New gaps (discovered during real mapping)

### GAP-013 — Unexpected 1-byte `grimoire` file

| Field | Value |
|---|---|
| ID | GAP-013 |
| Source | `grimoire` (commit `ef9df02`) |
| Evidence | 1 byte (`01ba4719…` = single newline); no content; not in the expected-17 list |
| Description | Empty placeholder file created alongside the source upload. |
| Impact | None — no content to migrate; kept for byte-fidelity. |
| Severity | low |
| Blocking status | **NO** |
| Proposed resolution | executive may delete it; migration keeps it until then |

### GAP-014 — Case-collision: `README.md` vs `Readme.md`

| Field | Value |
|---|---|
| ID | GAP-014 |
| Source | `git ls-files` |
| Evidence | both tracked; distinct hashes (`11` §1 rows 15 + README) |
| Description | Two case-variant filenames coexist; fine on Linux, collides on case-insensitive filesystems (macOS/Windows checkouts). |
| Impact | Migration docs always cite exact case; tooling must not normalize paths. |
| Severity | low |
| Blocking status | **NO** |
| Proposed resolution | executive decides whether v3 keeps both (no migration action taken) |

### GAP-015 — ND vs NM hotkey conflict

| Field | Value |
|---|---|
| ID | GAP-015 |
| Source | `Part1.md` |
| Evidence | `Part1.md:17,30` use **ND** for manual Netlify Drop; `Part1.md:38` says "**NM** hotkey using Netlify Drop"; `PatchNotes.md:124` documents only ND; `Readme.md:43` Export list has ND |
| Description | Two different key spellings claimed for the same behavior; source self-contradicts. Not repaired (P3). |
| Impact | Both rows preserved in `08`; ND/NM cannot both be registered as-is. |
| Severity | medium |
| Blocking status | **NO for migration** — blocks *hotkey registration* of this action pending executive ruling |
| Proposed resolution | executive rules: NM = typo for ND (likely), or a second distinct hotkey |

### GAP-016 — PatchNotes structural anomalies

| Field | Value |
|---|---|
| ID | GAP-016 |
| Source | `PatchNotes.md` |
| Evidence | version `1.9` twice (`:169` vs `:285`, different content); `1.17` listed after `1.8` (`:187`,`:207`) in descending file; split `##` headers for `1.16.5`/`1.16.4` (`:218–219`); `.1-2` unprefixed (`:204`) |
| Description | Version history has ordering/duplication/format anomalies. Preserved verbatim. |
| Impact | Timeline `08` §7 cites exact lines; no reordering performed. |
| Severity | low |
| Blocking status | **NO** |
| Proposed resolution | none (historical document; display layers may sort by parsed version) |

### GAP-017 — Conflicting/ambiguous hotkey identities await executive ruling

| Field | Value |
|---|---|
| ID | GAP-017 |
| Source | `08` §4/§5 |
| Evidence | CONFLICT: K (menu vs debug-row `Readme.md:41`/`Interludes.md:70`), KY (tools-key vs Y/T history `PatchNotes.md:197,264`), NM (GAP-015), Y (3 roles + removed `:131,193,264,65`), T (3 roles `:301,196,132`). AMBIGUOUS: P vs PT (`Grimoire.md:13` vs `Readme.md:148`), Z (undo history vs export `:287,279` + `Part1.md:107`), E status (`:131`), i identity (`:143`) |
| Description | 5 conflicting + 5 ambiguous identities cannot be registered until intent is resolved. |
| Impact | Hotkeys module activation blocked for these 10 rows; the other 33 rows are registrable. |
| Severity | high (for runtime), low (for migration) |
| Blocking status | **NO for migration** — blocks *registration* of the 10 rows |
| Proposed resolution | advisory recommendation sheet delivered in `13-hotkey-decision-sheet.md` (Task 04) — recommendations are NOT decisions; status stays UNRESOLVED and all 10 rows stay `BLOCKED_*` in `12-hotkey-registry.md` until the executive rules |

### GAP-018 — Damaged/incomplete lesson content (preserved, not repaired)

| Field | Value |
|---|---|
| ID | GAP-018 |
| Source | multiple |
| Evidence | empty bodies: project 68 `Part7.md:266`, 69 `Part7.md:269`; verbatim markers `No further instructions...` at `Part5.md:17,22,32` and `Part9.md:23`; `It appears the pages have been damaged, and a portion of the book is missing` at `Grimoire.md:52`, `Projects.md:95`, `Part5.md:18,23,33`; `It appears the scrolls have been damaged, and the rest of the book is missing.` at `Part9.md:24`; unresolved placeholders `<show mathmatic notation for these loops>` `Part7.md:205`, `<Compare sorting algorithms>` `Part8.md:36`, `<Explain these>` `Part8.md:49`, `explain pointers & references` `Part7.md:82`; draft note `Move some numbers here and add Hivemind & claude artifacts` `Part5.md:5` |
| Description | 6 projects — rows 58, 59, 61, 68, 69, 75 — have missing/empty instructional bodies; 4 inline placeholders remain. All 6 flagged `LEGACY-GAP` in `07` §4, never filled in. |
| Impact | Curriculum module must render these as "content pending" rather than generate silent replacements (CA-02/CA-03). |
| Severity | medium |
| Blocking status | **NO** |
| Proposed resolution | executive authorizes content completion as a *separate writing task* (source remains authoritative until then) |

### GAP-019 — Numbering anomalies (preserved, flagged)

| Field | Value |
|---|---|
| ID | GAP-019 |
| Source | `Projects.md`, `Grimoire.md` |
| Evidence | Ch5 absent (A1); index misses 32 + duplicates 33 (`Projects.md:68–69` vs `Part3.md:129,134`); index misses 44–56 (`Projects.md:90–98` vs `Part4_AllLessons.md:10–26`); "All 75 projects" claim vs 76 numbers (`Projects.md:3`) |
| Description | Source numbering irregularities. All preserved; `SOURCE-ANOMALY` flags in `07` §6. |
| Impact | Any v3 UI displaying numbers shows source numbers, not normalized ones. |
| Severity | medium |
| Blocking status | **NO** |
| Proposed resolution | executive may commission a corrections document — amendments must be additive, never edits to source |

### GAP-020 — Title conflicts across TOC/index/lessons

| Field | Value |
|---|---|
| ID | GAP-020 |
| Source | cross-file |
| Evidence | Ch8 Stoneweaving/Earthbending; Ch15 201/103; Ch1/4/6/7/19/21 variants; 12 project title variants (`07` A7/A9) |
| Description | Same entity, different titles in different files. Preserved everywhere; content-file form used as primary label in `07` with index form noted. |
| Impact | Display-layer choice needed later; migration unchanged. |
| Severity | low |
| Blocking status | **NO** |
| Proposed resolution | executive picks canonical display titles for v3 UI (source untouched) |

### GAP-021 — Prerequisite/tool metadata largely unstated

| Field | Value |
|---|---|
| ID | GAP-021 |
| Source | `Projects.md`, `Part*.md` |
| Evidence | only 2 explicit prerequisites in all 76 projects (`Part1.md:90`, `Part7.md:37`); tools column is `UNKNOWN` for 20 projects (`07` §4) |
| Description | The source does not formalize prerequisites or per-project tool requirements. |
| Impact | Curriculum module cannot offer dependency-aware sequencing from source alone; tracks (`07` §5) are the only ordered guidance. |
| Severity | low |
| Blocking status | **NO** |
| Proposed resolution | none unless executive wants a prerequisite-authoring task (would be new content, flagged as such) |

---

## 3. Summary

| | Count |
|---|---|
| Total gap records | **21** (GAP-001…021) |
| Closed by real source | 7 (001, 002, 003, 004, 006, 008, 011) + 012 closed-as-non-conflict |
| Unresolved | 13 (005, 007, 009, 010, 013, 014, 015, 016, 017, 018, 019, 020, 021) |
| Blocking migration | **0** — no gap blocks the migration itself |
| Blocking *runtime registration* | GAP-015, GAP-017 (10 hotkey rows), GAP-009 (5 rows) |
| All unresolved gaps explicitly marked | yes (AC-34) |
| Newly discovered this task | 9 (GAP-013…021) |
