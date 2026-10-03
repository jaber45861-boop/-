# Grimoire v3 — Core Audit (real legacy data)

**Status:** Task 03 Phase 9 — CA-01…CA-07 evaluated against actual source at commit `ad5e268`.
**Verdict: 0 blocking issues; 0 Core-change-required issues.** Core documents `01`–`04` were **not modified** in Task 03 (AC-35). Three issues classify `adapter-solvable`, four classify `non-blocking`.
**Supersedes:** the Task 02 conditional audit (its CA-01/CA-02 topics are re-evaluated below with real evidence).

Each issue records: issue · evidence · affected Core section · severity · classification (blocking / non-blocking / adapter-solvable / Core-change-required) · proposed change · backward-compatibility impact.

---

## CA-01 — Hotkey expressibility (can all legacy hotkeys satisfy H2?)

- **Issue:** Task 01 `03` §4/H2 requires every hotkey's `behavior.mode` to be one of the nine Core Decision modes. Could all 43 legacy identities comply?
- **Evidence (real):** every non-UNKNOWN row maps to a mode via the rules in `08` §2 — TEACH (P, PT, PTn, Pi, R, S, SS, Q), ANSWER (PN, KY), PLAN (A, D, E), CODE (W, G, C), DEBUG (H, F-row-inferred), TEST (T), RESEARCH (SoS), TOOL (K, KT, J, N, ND, NM, REPL, V, L, Z, XC, PDF, B). 10 operation hotkeys (deploy/export/menu class) require the mode-TOOL + declared micro-behavior **adapter**; 4 rows (F-purpose, VV, google, i) lack source metadata (H1 issue, not H2 — GAP-009); 5 conflicting + 5 ambiguous rows are source contradictions, not contract violations (GAP-017).
- **Affected Core section:** `03-extension-contract.md` §4 (H2); `04-decision-rules.md` §2 mode set.
- **Severity:** low.
- **Classification: adapter-solvable** (non-blocking).
- **Proposed change:** none to Core. Register operation hotkeys as mode TOOL with declared micro-behavior (the §4 schema already carries `behavior`, `purpose`, `requires` — no schema extension needed). Conflicting rows wait on executive rulings (GAP-015/017).
- **Backward-compatibility impact:** none — conforming hotkeys unaffected; adapters live in the Hotkeys module.

## CA-02 — Legacy TODO/incomplete material vs the Definition of Done

- **Issue:** Core `01` §4.2 forbids placeholders in shipped Changes, and test AC-09 scans diffs for them. Legacy source is full of intentional placeholders — does migrating it violate the DoD?
- **Evidence (real):** `"No further instructions..."` + damaged narratives at `Part5.md:17,18,22,23,32,33`, `Part9.md:23,24`; empty bodies `Part7.md:266,269`; inline placeholders `Part7.md:205` (`<show mathmatic notation…>`), `Part8.md:36` (`<Compare sorting algorithms>`), `Part8.md:49` (`<Explain these>`), `Part7.md:82` (`explain pointers & references`); draft note `Part5.md:5`. All recorded as `LEGACY-GAP` (`07` §4, GAP-018) and **preserved byte-for-byte** (MIG-06/MIG-09).
- **Affected Core section:** `01-core-specification.md` §4.2 reading + `05` AC-09 execution.
- **Severity:** low (interpretation gap, already anticipated by Task 02's CA-02 note).
- **Classification: non-blocking.**
- **Proposed change:** none to Core. The mechanism already exists: §4.2 scopes placeholders to "the requested scope" of a Change; migrated legacy content is L3 *source data* annotated `LEGACY-GAP`, and any future Change *building* on it reports blockers via D10/waiver (§4.2(c)). If desired, AC-09 may later gain an explicit "source-verbatim legacy content" exemption clause — an acceptance-test edit requiring executive approval; **not made unilaterally**.
- **Backward-compatibility impact:** none as-is; a future AC-09 clause would be additive.

## CA-03 — Damaged/incomplete curriculum sections representable?

- **Issue:** Can missing chapters/lessons/bodies exist in the architecture without repair or rejection?
- **Evidence (real):** Chapter 5 absent entirely (A1); TOC comments out Ch14/15 with `//` + missing-pages narrative (`Grimoire.md:50–53`); index sections empty for projects 44–56 (`Projects.md:90–98`); 6 projects with empty/damaged bodies (GAP-018); 10 structural anomalies registered (`07` §6 A1–A10). All represented as rows with `SOURCE-ANOMALY`/`LEGACY-GAP` statuses — nothing repaired, nothing dropped (MIG-04/MIG-09).
- **Affected Core section:** none directly — Core has no content schema; completeness is a Curriculum-module concern (`03` §2) and migration-annotation concern (`06` §4 P3).
- **Severity:** low.
- **Classification: non-blocking.**
- **Proposed change:** none. The migration layer proves representability: incomplete = a status value, not an error.
- **Backward-compatibility impact:** none.

## CA-04 — Historical instructions vs current operational rules

- **Issue:** The source documents features that no longer exist (removed hotkeys, old access paths). Can historical instructions coexist with rules describing Grimoire's *current* behavior?
- **Evidence (real):** removals at `PatchNotes.md:65` (I, Y), `:73` (TT, U), `:279` (Z undo); renames RR→PN (`:98`), T→KT + Y→KY (`:196–197`), Q/B moves (`:129–130`); obsolete access instructions `@Grimoire` (`:88`), chatGPT-mobile tips (`Grimoire.md:104`), app-promo blocks (`Readme.md:5–17`). Classification metadata already separates them: class 12 "Historical/legacy" in `06` §5, full timeline in `08` §7, active-vs-removed status per `08` §4 row.
- **Affected Core section:** none — Core governs current behavior contracts; it never required all content to be current. `01` §9 (project context) and `01` §0.1 (verified fact vs assumption) provide the handling: historical text is data about the past, labeled as such.
- **Severity:** medium (if a future module read PatchNotes as current instructions, behavior would be wrong).
- **Classification: adapter-solvable** — the Hotkeys module must resolve "current" from active rows only; historical rows are `N/A — removed (historical)`.
- **Proposed change:** none to Core; the resolver rule belongs to the Hotkeys module's contract compliance (documented in `08` §5/§7).
- **Backward-compatibility impact:** none.

## CA-05 — External URLs/tools without becoming Core dependencies?

- **Issue:** 174 URLs and 46 tool recommendations — can they be represented without hard-wiring them into Core?
- **Evidence (real):** all URLs inventoried as L3 content (`06` §6) and per-row tool declarations in `08` §4 / `07` §4; Core remains vendor-free — AC-01b (zero vendor tokens in `01`) and AC-01c (vendor names only inside `04` §5 worked examples) still PASS after intake. Tools enter only as `requires.tools` strings (`03` §2) and RESEARCH-mode targets (`04` §3).
- **Affected Core section:** `01-core-specification.md` §10 (tool usage), `04` §3 (research) — both already parameterized, no named vendors.
- **Severity:** low.
- **Classification: non-blocking.**
- **Proposed change:** none.
- **Backward-compatibility impact:** none.

## CA-06 — Multiple versions of an instruction

- **Issue:** The same instruction exists in several versions (and sometimes contradictory ones) — can multiple versions coexist?
- **Evidence (real):** version `1.9` appears twice with different content (`PatchNotes.md:169` vs `:285`); ordering anomaly 1.17-after-1.8 (`:187`, `:207`); split headers (`:218–219`); Y carries three different behaviors across versions (`:193`, `:131`, `:264`); T carries three (`:301`, `:196`, `:132`); Z = undo then removed then export (`:287`, `:279`, `Part1.md:107`). Represented without reconciliation: `08` §4 keeps one row per identity with all roles listed, `08` §7 keeps the ordered event timeline, GAP-016/017 record the anomalies.
- **Affected Core section:** none — Core models Grimoire's *current* state plus honest history (M2); versioned content is data.
- **Severity:** medium (a naive module could conflate versions).
- **Classification: adapter-solvable** — version-scoped records in the migration/Hotkeys layer (already materialized as the §7 timeline).
- **Proposed change:** none to Core.
- **Backward-compatibility impact:** none.

## CA-07 — Executable instructions vs educational content

- **Issue:** The source interleaves executable directives ("Use the N hotkey…", deploy steps) inside educational prose. Can the system distinguish them without rewriting the lessons?
- **Evidence (real):** 13 special instructions classified with anchors (`06` §5.1 SI-01…SI-13); hotkey mentions inside lessons (`Part1.md:6,15,27,36`, `Part2.md:12,25,31`, `Part3.md:140`, `ReplitDeployInstructions.md:1`); 12-class instruction taxonomy (`06` §5) applied over all 17 files. Classification is metadata layered *beside* content — lesson text untouched (MIG-06).
- **Affected Core section:** Decision Rules `04` §2 already separates executable modes (CODE/TOOL/TEST…) from TEACH/ANSWER; teaching contract `01` §8.5 distinguishes learning-intent Tasks. Nothing in Core assumes instructions and lessons are separate files.
- **Severity:** low.
- **Classification: non-blocking** (the classification metadata produced in Phase 7 is the mechanism).
- **Proposed change:** none.
- **Backward-compatibility impact:** none.

---

## Summary table

| ID | Topic | Severity | Classification | Core change needed |
|---|---|---|---|---|
| CA-01 | hotkey expressibility (H2) | low | adapter-solvable | **no** |
| CA-02 | legacy TODO/incomplete vs DoD | low | non-blocking | **no** |
| CA-03 | damaged curriculum sections | low | non-blocking | **no** |
| CA-04 | historical vs current instructions | medium | adapter-solvable | **no** |
| CA-05 | external URLs/tools | low | non-blocking | **no** |
| CA-06 | multiple instruction versions | medium | adapter-solvable | **no** |
| CA-07 | executable vs educational content | low | non-blocking | **no** |
| — | blocking issues | — | **0** | — |
| — | Core-change-required issues | — | **0** | — |

**Conclusion:** real legacy data produced **zero concrete Core contradictions**. The Core's assumption surface held: skip rules cover content-only work, annotation layers cover damage/history/versions, and the mode set covers every documented hotkey behavior (with the declared TOOL adapter). Core documents `01`–`04` remain byte-unchanged through Task 03; the residual 10 conflicting/ambiguous hotkeys and 5 metadata-poor rows are executive decisions (GAP-009/015/017), not architecture defects.
