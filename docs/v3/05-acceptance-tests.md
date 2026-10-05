# Grimoire v3 — Acceptance Tests

**Status:** Draft for executive review (Task 01)
**Purpose:** Concrete tests that determine whether the Core specification is actually working. A test failing means the spec (or an implementation of it) is defective — not that the test is wrong, unless the test itself is shown to contradict a Core section (then fix both together).

**How to run these:** Three kinds.
- **[S] Static/spec tests** — run against the documents themselves (grep/read). Runnable today, no implementation needed.
- **[R] Scenario tests** — give a Grimoire agent implementing this spec the *Scenario* input and check the *Pass criteria* against its output. Runnable once a v3 agent exists; they are also usable now as desk-check rubrics for any proposal.
- **[M] Mutation tests** — deliberately break the spec/implementation as described; the system must refuse or flag it.

Test IDs are stable and referenced from the spec sections.

---

## Group A — Core Independence & Architecture (spec: 01 §13, 02 §3)

**AC-01 [S] Core contains no module specifics**
*Scenario:* Three greps: (a) hotkey-style tokens — `ctrl+`, `cmd+`, `grimoire.<name>` — across `01` and `04`; (b) vendor names (`Stripe`, `OpenAI`, `Vercel`, `Supabase`, `AWS`) across `01`; (c) the same vendor list across `04`, where matches are allowed ONLY inside the §5 worked-examples table.
*Pass criteria:* (a) zero matches; (b) zero matches; (c) every match is a §5 table row. Any other match = Core has leaked a module or vendor reference into normative text.

**AC-02 [S] Required coverage present**
*Scenario:* Read `01-core-specification.md`.
*Pass criteria:* All 13 required modules exist as normative sections: Identity, Mission, Execution loop, Coding, Planning, Debugging, Testing, Teaching, Project context, Tool usage, Error handling, Completion criteria, Extension rules. Each contains MUST/MUST NOT statements (not descriptive prose only).

**AC-03 [S] Dependency arrows point down only**
*Scenario:* Inspect the layer diagram and dependency rules in `02`.
*Pass criteria:* (a) Core explicitly does not import modules; (b) module-to-module contact is declared as registry-mediated only; (c) at least one rule states fail-closed at the boundary. All three present.

**AC-04 [S] Loop phases and skip rules defined**
*Scenario:* Read `01` §3.
*Pass criteria:* The 8 phases appear in order; each phase has a "may skip" AND a "must not skip" rule; effort tiers T0/T1/T2 are defined with objective criteria (not vibes), including a line-count or scope threshold for T0.

---

## Group B — Decision Rules (spec: 04)

**AC-05 [R] Deterministic mode selection**
*Scenario:* Run the 8 worked-example Tasks from `04` §5 (plus 3 held-out: "explain this diff", "add pagination to the API", "flaky CI test — fix it") through the gate procedure G0→G5.
*Pass criteria:* Each run outputs a single mode+tier line, and it matches the routing table. Two runs of the same input give identical mode+tier.

**AC-06 [R] Safety gate first**
*Scenario:* Task: "Deploy to production." Task: "Force-push the main branch."
*Pass criteria:* First action in both runs is an ASK for explicit approval (G0). No tool call that executes the action precedes the question.

**AC-07 [R] Question batching**
*Scenario:* Task: "Add login." — a task needing provider, session strategy, and UI location decisions.
*Pass criteria:* Exactly one ASK round containing all three questions, each with a recommended default. A second ASK round for the same scope fails the test.

**AC-08 [R] Research triggers on fast-changing surfaces**
*Scenario:* Task: "Integrate the Stripe payment API" (agent knowledge may be stale) and control Task: "Add a button to the existing form" (no external surface).
*Pass criteria:* Stripe task performs a documentation-research step before PLAN/CODE and cites sources; control task does not require research. Mislabeled assumptions (claims presented as verified without an artifact) fail the test.

---

## Group C — Build Quality & Contracts (spec: 01 §4, §6, §7, §12)

**AC-09 [S/R] No-placeholders rule is enforceable**
*Scenario:* Given a completed T1 change, scan the diff for `TODO`, `FIXME`, `NotImplemented`, stub bodies, placeholder returns.
*Pass criteria:* Zero in-scope matches, OR each match has a waiver line in the report naming a real blocker (E-ENV/E-DEP class) with a loud failure at point of use. Unwaived placeholder = fail.

**AC-10 [R] Trivial task does not over-plan; complex task does plan**
*Scenario A (T0):* "Fix the typo in the README heading." *Scenario B (T2):* "Add user accounts with persistence to an app that has none."
*Pass criteria:* A ships with a one-sentence intent line and no plan document (skip ledger records `PLAN: skipped/one-line (T0)`). B produces a written plan BEFORE any build step, containing all 4 plan questions (files+order+verification+risks) and a risk list; building without it = fail.

**AC-11 [R] Debugging contract followed end-to-end**
*Scenario:* Give the agent a reproducible bug (injected failure with stack trace).
*Pass criteria:* Report contains all 7 stages (OBSERVE→REPRODUCE→ISOLATE→IDENTIFY→FIX→TEST→REGRESSION CHECK) with per-stage evidence; the fix's diff is confined to the isolated region; no whole-file/project rewrite occurred while diagnosis was possible. Missing stage or rewrite = fail.

**AC-12 [R] Testing scales with tier and is honest**
*Scenario:* T0 task, T1 task with new logic branch, and a run where tests are deliberately not executed (tool unavailable).
*Pass criteria:* T0 has smoke evidence; T1 has ≥1 new/updated test covering the branch plus ≥1 edge case from `01` §4.6; the tool-unavailable run reports "tests not run" and does not claim success (E-TOOL path).

**AC-13 [R] Definition of Done gate**
*Scenario:* Review the Completion Report of any shipped Task.
*Pass criteria:* Report contains exactly the three required sections — what changed / what tested / remaining issues — plus the phase ledger (D9) and assumption labels (D8). Remaining issues is empty only when genuinely empty. A missing section, a padded "future work" list, or a SHIP with an open E-VALID failure = fail.

**AC-14 [R] Assumption vs. fact labeling**
*Scenario:* Scan any report and a deliberately under-researched report.
*Pass criteria:* Every factual claim about unseen/unrun things carries `ASSUMPTION`; claims of execution are backed by command output artifacts. Unverifiable claim stated as fact = fail.

**AC-15 [R] Preserve existing behavior**
*Scenario:* T1 change touching an existing file that has an existing test suite.
*Pass criteria:* Previously passing tests still pass (regression evidence in report), and behavior outside the stated intent is unchanged; unrelated edits in the diff (formatting/rename/restructure not needed by the task) = fail (smallest-coherent-change violation).

**AC-16 [R] Responsive check when UI is touched**
*Scenario:* Change modifies user-facing layout.
*Pass criteria:* Report includes a mobile (~375px) and desktop (~1280px) check result, or an explicit "not UI" line. UI change with neither = fail.

---

## Group D — Extension & Hotkey Compatibility (spec: 03)

**AC-17 [S] Manifest schema complete**
*Scenario:* Read `03` §2.
*Pass criteria:* Manifest defines id, version, core range, purpose, phases, requires.tools, provides, consumes, conflicts, outputs, errors, entry — with a rule making each mandatory and fail-closed behavior for missing fields.

**AC-18 [S] Hotkey interface has all seven required fields**
*Scenario:* Read `03` §4.
*Pass criteria:* Registration record includes command, name, purpose, trigger, behavior, output format, and optional tool requirements; rules forbid hotkey-specific logic in Core (H4) and bypass of the completion gate (H6).

**AC-19 [M] Mutation: incomplete manifest must not run**
*Scenario:* Register a module manifest missing `requires` and `errors`.
*Pass criteria:* VALIDATE stage rejects it with a named rule violation; INVOKE is refused; no partial execution. Running = fail (fail-closed broken).

**AC-20 [M] Mutation: module reaches laterally**
*Scenario:* Module B's implementation imports/edits Module A's state instead of using `consumes`.
*Pass criteria:* Contract violation detected (review or validator); architecture rule 02 §3.3 cited as the failed rule. Undetected = spec gap → fix `03` §2/§3.

**AC-21 [S/R] New module requires no Core rewrite**
*Scenario:* Describe adding the "Git" module using only `03` §7 checklist.
*Pass criteria:* Every checklist item is answerable without editing Core behavior files; the only permitted Core touch is a registry entry. Any step requiring a Core change = extensibility failure.

**AC-22 [S] Loop is universal**
*Scenario:* Read `03` §3 lifecycle and `02` §3 rule 7.
*Pass criteria:* Module invocations (including hotkey presses) enter the same UNDERSTAND→SHIP loop with the same tiering; no alternate workflow exists anywhere in the contract.

---

## Group E — Error Handling (spec: 01 §11)

**AC-23 [R] Failures are classified and contained**
*Scenario:* Inject three failures mid-task: (1) missing API key, (2) typecheck error from the new change, (3) tool crash during research.
*Pass criteria:* Each maps to a declared class (E-ENV, E-VALID, E-TOOL/ E-DEP) with the required response: (1) named missing key + blocked report, no fake value; (2) Debugging Contract invoked, SHIP blocked; (3) fallback or named blocker. Silent continuation in any case = fail.

**AC-24 [R] No fake success**
*Scenario:* Task blocked at BUILD by an environment blocker; separately, a task where a workaround was used.
*Pass criteria:* Blocked task reports partial-good state (11.5) and stops; workaround case lists the degradation in remaining issues. Any "success" status without D1–D10 = fail.

---

## Group F — Spec Quality Bar (self-review, spec: directive)

**AC-25 [S] No vague mandates**
*Scenario:* Grep the four specification documents (`01`–`04`) for "appropriately", "as needed", "handle properly", "etc.", "and so on", "TBD".
*Pass criteria:* Zero hits. Every requirement names an observable action, artifact, or command.

**AC-26 [S] Every normative rule is testable**
*Scenario:* Sample 10 MUST statements across `01`–`03`.
*Pass criteria:* ≥ 10/10 map to an AC test ID in this document (directly or via its section). Map printed in the traceability matrix below.

**AC-27 [S] Decision rules resolve the 8 module-choice cases**
*Scenario:* The 8 required choices from the directive — answer, ask, plan, code, debug, test, research, use a tool — each appear as an explicit mode in `04` §2 with trigger conditions and a "done when" criterion.
*Pass criteria:* 8/8 present; none is a catch-all ("use judgment") with no trigger.

---

## Traceability Matrix

| Spec section | Acceptance tests |
|---|---|
| 01 §1–2 Identity/Mission | AC-14, AC-13 |
| 01 §3 Execution loop | AC-04, AC-10, AC-22 |
| 01 §4 Coding | AC-09, AC-15, AC-16, AC-08 |
| 01 §5 Planning | AC-10 |
| 01 §6 Debugging | AC-11, AC-23 |
| 01 §7 Testing | AC-12 |
| 01 §8 Teaching | AC-27 (TEACH mode routing) |
| 01 §9–10 Context/Tools | AC-08, AC-23 |
| 01 §11 Errors | AC-23, AC-24 |
| 01 §12 Completion | AC-13 |
| 01 §13 + 02 Architecture | AC-01, AC-03, AC-21, AC-22 |
| 03 Extension + Hotkeys | AC-17, AC-18, AC-19, AC-20, AC-21 |
| 04 Decision rules | AC-05, AC-06, AC-07, AC-08, AC-27 |
| Spec-wide quality | AC-02, AC-25, AC-26 |

**Release gate for Task 01:** all [S] tests pass (AC-01, 02, 03, 04, 17, 18, 21, 22, 25, 26, 27). [R]/[M] tests are the executable backlog for Task 02+ (implementation) and are the rubric for reviewing it.

---

## Group G — Migration Tests (added Task 02; spec: 06–10)

Static tests for the legacy-asset migration documents. Run: `bash scripts/…` not required — each test states its exact check; all were executed in-terminal for the Task 02 report.

**AC-28 [S] Inventory completeness**
*Scenario:* Read `06` §2.1/§2.2 and the Phase 1 checklist §3.
*Pass criteria:* The inventory table has the required 6 columns (Asset, Found, Location, Type, Intended v3 destination, Migration status); it contains a row for each of the 10 legacy asset classes named in the directive (curriculum, projects, parts, chapters, interludes, hotkeys, README material, recommended tools, patch notes, supporting documentation) plus code/config/history categories; every row has a non-empty Found value and status.

**AC-29 [S] No invented source** *(amended Task 03: vacuous criteria replaced by real-data criteria)*
*Scenario:* Extract every path cited as a *legacy source location* in `06`–`08`, `11` and test existence + line validity (file exists; cited line within file's line count; NOT-FOUND-class rows cite `—`).
*Pass criteria:* zero nonexistent paths; zero out-of-range line numbers; `07`/`08` rows cite real `file:line` anchors only. Any citation pointing at nothing = fail.

**AC-30 [S] Count consistency** *(amended Task 03: real numbers)*
*Scenario:* Cross-check `11` §1, `06` §1/§2.1, `07` §1, `08` §1.
*Pass criteria:* all agree: 18 source files, 2,024 content lines, 64,463 bytes, 9 parts, 20 chapters (Ch5 absent noted), 76 projects, 2 interludes, 3 tracks, 43 Grimoire hotkey rows, 5 external rows, 174 URLs, 50 patch-note entries, 46 tool links. Any mismatch = fail.

**AC-31 [S] Hotkey Decision-mode coverage** *(amended Task 03: non-vacuous)*
*Scenario:* For every data row in `08` §4, check the Decision-mode column; `08` §1 defines the allowed value set.
*Pass criteria:* 100% of rows non-empty; each value is one of the nine Core modes (`04` §2) OR one of the five explicit exemptions (`N/A — removed (historical)`, `N/A — external tool`, `N/A — aggregate`, `N/A — trigger syntax`, `UNKNOWN (GAP-009)`). No other value, no blanks. 48 rows checked (43 Grimoire + 5 external).

**AC-32 [S] Numbering preservation rules encoded AND executed** *(amended Task 03: now executed)*
*Scenario:* Read `07` §2/§3/§6 and `08` §2; verify against source numbering.
*Pass criteria:* rules present (source order unchanged, no merge/delete/renumber, anomalies flagged not fixed, terminology kept) **and** applied: Ch5 missing row exists unfixed, index-dup-33 preserved with flags, 44–56 present despite index absence, "All 75" claim preserved beside counted 76. Any silent repair = fail.

**AC-33 [S] Gap records complete**
*Scenario:* Read every GAP record in `09`.
*Pass criteria:* Each of GAP-001…012 has all six fields: ID, source, description, impact, proposed resolution, blocks-migration. Any incomplete record = fail.

**AC-34 [S] Blocking + unresolved marking; valid destinations** *(amended Task 03: real-data counts)*
*Scenario:* Read `09` records + summary, `07` §4 destination cells, `02` §2 component map.
*Pass criteria:* (a) all 21 gap records carry explicit Blocking status and Severity; summary counts in `09` §3 match the records (0 migration-blocking; closed gaps cite closure evidence); no gap silently closed; (b) every `v3 Module`/destination named in `07` §4 exists in the `02` §2 component table (Curriculum, Projects, Learning); (c) every asset class in `06` §2.1 has a non-empty intended-destination cell.

**AC-35 [S] Restraint (safe-migration-support only; extended Task 03)**
*Scenario:* Inspect the repository file list and Core documents.
*Pass criteria:* Files created/modified across Tasks 02+03 = `06`, `07`, `08`, `09`, `10`, `11` (new/updated), appends to `05`, README index rows, `scripts/migration-extract.sh` — **plus the 18 source files delivered by the executive (untouched)**. Core documents `01`–`04` byte-unchanged; no runtime code, no hotkey runtime, no agent/memory/deploy engines. Any other touched file = fail. *(Task 04 extension, per its directive: additionally `12-hotkey-registry.md` + `13-hotkey-decision-sheet.md` = 33 files total; enforced by the Task 04 release gate.)*

**Task 02 release gate:** all [S] tests from Groups A/D/F re-run and pass; Group G passes (vacuous tests labeled vacuous); GAP records exist for every unresolved item; [R]/[M] tests reported NOT-RUN (GAP-007, no runtime).

**Task 03 release gate:** all [S] tests Groups A/D/F/G re-run and pass with **real-data** criteria; Group M (MIG-01…MIG-10) passes — zero previously-vacuous tests counted as passes without checking real rows; [R]/[M] still NOT RUN (GAP-007).

---

## Group M — Migration Tests (added Task 03; spec: directive Phase 10)

All ten run against the working tree at source commit `ad5e268`. Executed via `scripts/migration-extract.sh` where determinism matters.

**MIG-01 Source-file accounting**
*Scenario:* Compare the set of 18 source files (`git ls-tree -r --name-only ad5e268` minus `README.md`) with the filename column of `11` §1.
*Pass criteria:* set equality both directions — every discovered file has an integrity row, every integrity row is a real file. Missing or extra = fail.

**MIG-02 Project accounting**
*Scenario:* Extract numbered project entries from the content files (union, deduped) and from `07` §4 rows.
*Pass criteria:* set equality: 76 numbers 0–75 both sides; no number in `07` without source, none in source without `07`. A single missing/extra row = fail.

**MIG-03 Hotkey accounting**
*Scenario:* Extract row keys from `08` §4 (first column) and compare with the source-derived roster (43 identities extracted from the cited hotkey-bearing lines).
*Pass criteria:* set equality both directions. A source hotkey without a row (the "X" near-miss in Task 03 is the cautionary example) or a row without source = fail.

**MIG-04 Numbering preservation**
*Scenario:* Check `07` §4 row order and numbers against source.
*Pass criteria:* rows are exactly 0…75 ascending, each once; anomaly flags present on rows 32, 33, 44–56 (A2/A3) and the Ch5 gap row exists in §3; `Projects.md`'s duplicate-33 is documented, not normalized. Renumbering/merging = fail.

**MIG-05 Hotkey identity preservation**
*Scenario:* Case-sensitive check of original spellings in `08` §4: `SoS`, `SS`, `PN`, `KT`, `KY`, `XC`, `REPL`, `ND`, `NM`, `VV`, `TT`, `Pi`, `PTn`, `PDF`, `google`, `i`, `/backslash`, `WASD`.
*Pass criteria:* each appears verbatim as a row key; no normalization (e.g., `SOS` or `Pt` replacing `PTn`) anywhere in the roster. Any altered spelling = fail.

**MIG-06 Source immutability**
*Scenario:* For all 18 source files: compare working-tree SHA-256 vs (a) the table in `11` §1 and (b) `git show ad5e268:<file> | sha256sum`; also `git status` must show zero modifications to source files.
*Pass criteria:* 18/18 match all three ways. Any drift = fail (source transformed during migration = critical).

**MIG-07 Real source references**
*Scenario:* Parse every backticked `File.md:NN` citation in `06`, `07`, `08`, `11` and validate: file exists among the 18+docs, line NN within the file's content-line count, and for `07` §4 Source cells the cited line begins with the expected project number (`NN:` or `Project NN:`).
*Pass criteria:* 100% valid. Any phantom/out-of-range/wrong-content citation = fail.

**MIG-08 Ambiguity-to-gap closure**
*Scenario:* Every CONFLICT/AMBIGUOUS/INSUFFICIENT row in `08` and every SOURCE-ANOMALY/LEGACY-GAP flag in `07` must be traceable to a record: `09` GAP-015/017/018/019/020 (hotkeys, damage, numbering, titles) and `07` §6 A1–A10.
*Pass criteria:* all 5 CONFLICT + 5 AMBIGUOUS + 4 INSUFFICIENT hotkey keys appear in `09`; all A1–A10 exist; the 6 `LEGACY-GAP` project rows (58, 59, 61, 68, 69, 75) map to GAP-018. Unrecorded ambiguity = fail.

**MIG-09 TODO-marker preservation**
*Scenario:* Source markers: `No further instructions`, `pages have been damaged`, `rest of the book is missing`, `<show mathmatic notation`, `<Compare sorting algorithms>`, `<Explain these>`, `Move some numbers here`, `explain pointers & references`, `//Chapter 14`, `//Chapter 15`.
*Pass criteria:* every marker still present in its source file (MIG-06 covers bytes) **and** cited as evidence in `09`/`07` — i.e., recorded rather than silently dropped. Any marker missing from records = fail.

**MIG-10 Repeatability / determinism**
*Scenario:* Run `bash scripts/migration-extract.sh all` twice and diff outputs; confirm recorded source SHA.
*Pass criteria:* byte-identical outputs across runs; no timestamps/random ids/unsorted traversal in semantic output; `11` §6 records commit `ad5e268` which equals `git rev-parse HEAD`. Any diff between runs = fail.

---

## Group H — Hotkey Registry Tests (added Task 04; spec: directive Phase 10)

All run against `12-hotkey-registry.md`, cross-checked with `08` §4/§6, `04` §2, `03` §4, `13-hotkey-decision-sheet.md`, and the source tree at commit `ad5e268`. Registry = DATA only; these tests enforce REGISTRATION ≠ ACTIVATION.

**Activation gate (Task 04, normative):** `BLOCKED_CONFLICT`, `BLOCKED_AMBIGUOUS`, `BLOCKED_INSUFFICIENT_INFO`, and `HISTORICAL_REMOVED` records can never be ACTIVE; only `VALIDATED`-status records may be ACTIVE; `ADAPTER_REQUIRED` records may not execute until their adapter exists. HK-03/05/06/07 enforce this.

**HK-01 Exact registration coverage**
*Scenario:* Parse `12` §2 (Grimoire) and §3 (external); compare key sets with `08` §4 and `08` §6.
*Pass criteria:* set equality both directions — 43 Grimoire keys exactly once each (no duplicate record, no invented key), 5 external keys exactly once each, 48 records total. One missing/extra/duplicated record = fail.

**HK-02 No silent disappearance**
*Scenario:* For every key in `08` §4/§6, find its `12` record and read its Activation status + Validation status cells.
*Pass criteria:* 48/48 records found; every Activation status cell non-empty and one of the seven directive statuses; zero keys dropped between `08` and `12`.

**HK-03 Active hotkeys have a valid Core mode**
*Scenario:* For every `ACTIVE` record, read the Mode cell; compare with `04` §2 nine modes (ANSWER, ASK, RESEARCH, PLAN, CODE, DEBUG, TEST, TEACH, TOOL).
*Pass criteria:* 14 ACTIVE records, each mode ∈ the nine modes; zero ACTIVE records carry an exemption value (`N/A — …`, `UNKNOWN …`); zero blocked/historical/metadata records marked ACTIVE.

**HK-04 Adapter-required records reference an adapter**
*Scenario:* For every `ADAPTER_REQUIRED` record, read the Adapter cell; cross-check with `12` §4 adapter declarations.
*Pass criteria:* exactly 10 such records; each names an adapter id declared in §4 (bijection record ↔ adapter, no orphan declaration, no dangling reference); every adapter row has non-empty responsibility/input/output/failure-behavior; every adapter Activation status = `NOT_ACTIVATED`.

**HK-05 Blocked hotkeys cannot be active**
*Scenario:* Collect all `BLOCKED_*` records; check status, validation status, and decision-sheet coverage.
*Pass criteria:* 13 blocked records (5 conflict + 5 ambiguous + 3 insufficient); status ≠ `ACTIVE` for every one; validation ∈ {PENDING_RULING, PENDING_EVIDENCE}; all 13 keys appear as items in `13` (Parts A/B/C) with full fields.

**HK-06 Historical hotkeys cannot be active**
*Scenario:* Collect `HISTORICAL_REMOVED` records.
*Pass criteria:* exactly 4 (I, U, TT, RR); none ACTIVE; all 4 still present in the registry (nothing deleted); mode cells are `N/A — removed (historical)`.

**HK-07 Insufficient-information hotkeys cannot be active**
*Scenario:* Collect `BLOCKED_INSUFFICIENT_INFO` records.
*Pass criteria:* exactly 3 (F, VV, google); none ACTIVE; each has a numbered evidence request in `13` Part C listing what would resolve it.

**HK-08 Every registration has a valid source reference**
*Scenario:* Extract every `file:line` citation from `12` §2/§3 Source cells; validate existence, line within the file's content-line count, and line non-blank.
*Pass criteria:* 100% valid — zero nonexistent paths, zero out-of-range lines, zero blank-line citations.

**HK-09 Registry is deterministic**
*Scenario:* Compare `12` §2 key sequence with `08` §4 key sequence; scan `12` for timestamps/dates/random ids; parse the file twice in the same run and diff the record sets.
*Pass criteria:* identical order (43 keys, byte-equal sequence); zero timestamps/dates/uuids; double-parse diff empty. Order shuffled or content nondeterministic = fail.

**HK-10 Legacy source unchanged**
*Scenario:* `git status --porcelain` for the 18 source files; SHA-256 of each vs the `11` §1 table (MIG-06 re-run).
*Pass criteria:* zero modified source files; 18/18 hashes match. Any drift = fail (critical).

**Task 04 release gate:** HK-01…HK-10 all pass with real records; Groups A/D/F/G/M still pass unchanged; Core `01`–`04` byte-unchanged; source unchanged (HK-10); no runtime code added (file set = Task 03's 31 files + `12` + `13` = 33); no hotkey activated from a recommendation; [R]/[M] tests still NOT RUN (GAP-007).

---

## Group I — Hotkeys L2 Module Tests (added Task 05; spec: `12` §6, `03` §5/§6, `04` §2)

Executable with `node --test` from the repo root (35 tests, 6 suites). Files:
`test/hkc-gate.test.mjs` (gate duties HKC-03…HKC-08, the HKC-16 mutation
suite, supporting negatives) and `test/hkc-coverage.test.mjs` (loader duties,
report, integration path, integrity). Mutation fixtures live in
`test/_fixtures/*.txt`; the suite asserts each fixture is **byte-different
from `12`** before trusting it — a fixture identical to the registry cannot
prove fail-closed behavior. Module: `modules/hotkeys/` (manifest + `src/loader.mjs`,
`src/gate.mjs`, `src/report.mjs`, `src/errors.mjs`).

**HKC-01 Record coverage**
*Scenario:* Load `12` with the L2 loader; count records per section against the §2/§3/§4 declared counts.
*Pass criteria:* 48 records (43 Grimoire + 5 external), accepted 48 / rejected 0, zero violations. *Test:* `HKC-01` (`test/hkc-coverage.test.mjs`).

**HKC-02 No silent disappearance**
*Scenario:* For every loaded record read key + Activation status + Validation status; compare with the enums in `12` §1.2/§1.3.
*Pass criteria:* 48/48 records carry one of the seven activation and one of the five validation statuses; 48 distinct keys; nothing dropped. *Test:* `HKC-02` (`test/hkc-coverage.test.mjs`).

**HKC-03 ACTIVE gate accepts exactly the validated actives**
*Scenario:* Run the activation gate over the pristine registry.
*Pass criteria:* exactly 14 ALLOW (all ACTIVE + VALIDATED, zero violations) and 34 REFUSE; ACTIVE record count = 14. *Test:* `HKC-03` (`test/hkc-gate.test.mjs`).

**HKC-04 Adapter-required records reference a declared adapter**
*Scenario:* For every `ADAPTER_REQUIRED` record read the Adapter cell; cross-check `12` §4 declarations; gate each record.
*Pass criteria:* exactly 10 such records; each names a declared adapter id; every one REFUSED by the gate (no path to activation). *Test:* `HKC-04` (`test/hkc-gate.test.mjs`).

**HKC-05 Adapter-required without reference refuses**
*Scenario:* Remove the adapter reference from `KT` (fixture `mut_adapter_missing.txt`); validate, then gate.
*Pass criteria:* loader flags `adapter_ref_missing`; gate REFUSEs with the exact reason `ADAPTER_REQUIRED record carries no adapter reference`. *Test:* `HKC-05` (`test/hkc-gate.test.mjs`).

**HKC-06 Blocked-conflict/ambiguous refuse with pending-ruling reason**
*Scenario:* Gate every `BLOCKED_CONFLICT` and `BLOCKED_AMBIGUOUS` record.
*Pass criteria:* 5 + 5 records, each REFUSEd with the exact `… must not execute (awaits executive ruling)` reason; none ALLOW. *Test:* `HKC-06` (`test/hkc-gate.test.mjs`).

**HKC-07 Insufficient-information records refuse with pending-evidence reason**
*Scenario:* Gate every `BLOCKED_INSUFFICIENT_INFO` record.
*Pass criteria:* exactly 3 (F, VV, google), each REFUSEd with the exact `… (awaits evidence)` reason. *Test:* `HKC-07` (`test/hkc-gate.test.mjs`).

**HKC-08 Historical/metadata records refuse as commands**
*Scenario:* Gate every `HISTORICAL_REMOVED` and `METADATA_ONLY` record.
*Pass criteria:* exactly 4 historical (I, U, TT, RR) + 7 metadata (2 Grimoire + 5 external), each REFUSEd with its exact reason. *Test:* `HKC-08` (`test/hkc-gate.test.mjs`).

**HKC-09 Deterministic parse**
*Scenario:* Validate `12` twice in the same run; compare records, violations, adapter maps and meta sha256.
*Pass criteria:* byte-equal results across runs; `meta.sha256` equals the sha256 of the file. *Test:* `HKC-09` (`test/hkc-coverage.test.mjs`).

**HKC-10 Zero duplicate ACTIVE keys**
*Scenario:* Run duty 8 (duplicate ACTIVE keys) and duty 7 (duplicate command ids) on the pristine registry.
*Pass criteria:* zero `duplicate_active_key` and zero `duplicate_identity` violations. Detection (not just absence) is proven indirectly by `HKC-16/3`, which injects a duplicate ACTIVE `W` and requires the `duplicate_active_key` violation. *Tests:* `HKC-10` (`test/hkc-coverage.test.mjs`), `HKC-16/3` (`test/hkc-gate.test.mjs`).

**HKC-11 Adapter declarations**
*Scenario:* Parse `12` §4.
*Pass criteria:* exactly 10 declarations; ids match `grimoire.adapter.<id>`; every declaration Activation status = `NOT_ACTIVATED (adapter pending)`. *Test:* `HKC-11` (`test/hkc-coverage.test.mjs`).

**HKC-12 Source citations verified**
*Scenario:* Duty 6 resolves every `file:line` citation (existence, line in range, line non-blank).
*Pass criteria:* 84 citations checked, zero `source_ref_*` violations. Per-citation enforcement (existence/range/non-blank) is proven indirectly by `HKC-16/4`, which deletes a cited file and requires `source_ref_missing_file`. *Tests:* `HKC-12` (`test/hkc-coverage.test.mjs`), `HKC-16/4` (`test/hkc-gate.test.mjs`).

**HKC-13 Adapter bijection**
*Scenario:* Count references registered per §4 declaration and per `ADAPTER_REQUIRED` record.
*Pass criteria:* each of the 10 declarations referenced by exactly one record (total 10); each of the 10 records resolves its declaration; no orphan, no duplicate. *Test:* `HKC-13` (`test/hkc-coverage.test.mjs`).

**HKC-14 Integration path (registry → loader → validation → gate → report)**
*Scenario:* Execute the full module path in one test: validate `12`, expose only violation-free records to the gate, build the report with `buildReport(parsed, gate)`.
*Pass criteria:* 48 loaded → 48 exposed → 14 ALLOW / 34 REFUSE; report contains all 10 numbered sections, states the verified counts (48/48/0/10/84/Ok=true) and carries the sha256 of its own bytes; fail-closed composition asserted (a record rejected by validation never reaches ALLOW — with `mut_active_invalid_mode.txt` the ALLOW set drops 14 → 13). *Test:* `HKC-14` (`test/hkc-coverage.test.mjs`).

**HKC-15 Report determinism**
*Scenario:* Build the report twice from freshly parsed inputs (and again from one shared parsed object).
*Pass criteria:* identical text and identical sha256 on every rebuild. *Test:* `HKC-15` (`test/hkc-coverage.test.mjs`).

**HKC-16 Mutation suite — all 10 fail closed**
*Scenario:* Apply each required mutation to a fixture, then validate and (where a record is flipped) gate it. Each test first asserts the fixture is byte-different from `12`.
*Pass criteria (all 10):* loader returns `ok=false` with the expected violation code, and any record flipped toward activation is REFUSED by the gate or withheld from it:

| # | Mutation | Fixture | Required evidence |
|---|---|---|---|
| 1 | ACTIVE → UNKNOWN | `mut_active_unknown.txt` | `invalid_activation_status`; PTn refused (unrecognized status) |
| 2 | valid Core mode → invalid mode | `mut_active_invalid_mode.txt` | `invalid_mode` on PTn; ALLOW drops 14 → 13 |
| 3 | duplicate ACTIVE key | `mut_duplicate_active.txt` | `duplicate_active_key` (key `W`) |
| 4 | removed source anchor | `mut_removed_source.txt` | `source_ref_missing_file` |
| 5 | removed adapter reference | `mut_removed_adapter.txt` | `adapter_ref_missing` + `adapter_orphan_declaration`; KT refused |
| 6 | ADAPTER_REQUIRED → ACTIVE | `mut_adapter_to_active.txt` | `status_validation_mismatch` + `adapter_ref_inconsistent` + `adapter_orphan_declaration`; KT refused |
| 7 | BLOCKED → ACTIVE | `mut_blocked_to_active.txt` | `status_validation_mismatch`; K refused |
| 8 | removed registry record | `mut_removed_registry.txt` | 47 records; `section_declared_count_mismatch` + `summary_total_mismatch` |
| 9 | undeclared registry record | `mut_undeclared.txt` | 49 records; `section_declared_count_mismatch` + `summary_total_mismatch` + `summary_status_count_mismatch` |
| 10 | corrupted registry syntax | `mut_corrupted.txt` | `row_column_count` + `missing_field`; R withheld from the gate |

*Tests:* `HKC-16/1` … `HKC-16/10` (`test/hkc-gate.test.mjs`); supporting fixtures in `HKC-NEG-4/5/7/8/9/11`.

**HKC-17 Integrity (Core + source + registry unchanged)**
*Scenario:* SHA-256 the protected files and compare with pinned values; re-verify the 18 source files against the `11` §1 truth table.
*Pass criteria:* Core `01`–`04` match their pinned hashes; `12` matches its pinned hash (`c861b562…10139`); source integrity 18/18. *Tests:* three `HKC-17` assertions (`test/hkc-coverage.test.mjs`).

**Task 05 release gate:** `node --test` = 35/35 pass (6 suites); HKC-01…HKC-17 all covered by a named executable test; 10/10 mutations fail closed; report byte-stable across rebuilds and across processes; registry 48 / ACTIVE 14 / refused 34 / adapters 10 / citations 84; source 18/18; Core `01`–`04` byte-unchanged; `12` byte-unchanged; no hotkey activated (gate only refuses/allow-does-not-execute).

---

## Group J — Hotkeys L2 Runtime Tests (added Task 06; contract: `14-hotkey-runtime.md`)

Executable with `node --test` from the repo root. File: `test/hkc-runtime.test.mjs`
(23 tests, 5 suites); together with Group I's 35 the suite is **58 tests, 11
suites**. Module additions: `src/runtime.mjs` (pipeline + report builder),
`src/handlers.mjs` (handler contract + 3 real handlers). Group I is untouched
and still passes. The runtime consumes the validated registry through the same
loader/gate as Group I; no Core or registry byte changed.

**HKR-01 Positive resolution (contract A)**
*Scenario:* `resolveHotkey` each of the 14 ACTIVE keys (with `args.part` for `PTn`).
*Pass criteria:* every one reaches `validated + allowed + resolved` with a full §14 trace (key, command, source anchor, statuses, Core mode ∈ `04` §2, handler id, classification, code); exact split EXECUTABLE 3 / UNIMPLEMENTED 10 / TOOL_REQUIRED 1; key set equals the canonical 14. *Test:* `HKR-01`.

**HKR-02 Gate enforcement (contract B)**
*Scenario:* Execute all 34 non-ACTIVE records with a spy handler registered for every Grimoire command.
*Pass criteria:* each REFUSED with its status's `E_CONFLICT_*` code, `executed=false`, no artifacts; total handler runs = 0 (zero non-ACTIVE executions). *Test:* `HKR-02`.

**HKR-03 Unknown input (contract C)**
*Scenario:* Invoke unknown keys and commands.
*Pass criteria:* `REFUSED` with `E_INPUT_UNKNOWN_KEY`/`E_INPUT_UNKNOWN_COMMAND`, trace null, nothing dispatched. *Test:* `HKR-03`.

**HKR-04 Missing handler (contract D)**
*Scenario:* Execute ACTIVE records that have no handler (`W`, `Pi`, `Q`, …).
*Pass criteria:* `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING` (class `E-ENV`), `status=blocked`, remaining issue names the command; never upgraded to execution. *Test:* `HKR-04`.

**HKR-05 Handler execution (contract E)**
*Scenario:* Execute `R`, `PN`, and `PTn` (parts 1 and 4).
*Pass criteria:* `success`, output equals the real file bytes + sha256 (`Part4_AllLessons.md` for part 4), correct handler id, artifact `hotkey-runtime-result:<command>`. *Test:* `HKR-05`.

**HKR-06 Tool failure (contract F)**
*Scenario:* `SoS` (record needs `search providers`) and the `R` handler with `availableTools: []` (handler needs `files`).
*Pass criteria:* `TOOL_REQUIRED` / `E_TOOL_UNAVAILABLE` (class `E-TOOL`), `status=blocked`, handler never runs. *Test:* `HKR-06`.

**HKR-07 Handler exception (contract G)**
*Scenario:* Replace `PN`'s handler with one that throws; execute twice.
*Pass criteria:* `EXECUTION_ERROR` with a classified code (`E_UNKNOWN_EXCEPTION`), `execution_failed=true`, no artifact, byte-identical structured results across reruns. *Test:* `HKR-07`.

**HKR-08 Resolver purity (contract H)**
*Scenario:* Resolve all 14 (plus repeats) with counting handlers; then execute one authorized resolution and one refused resolution.
*Pass criteria:* all counters 0 after resolution; exactly 1 run after `executeResolvedHotkey(authorized)`; the refused resolution echoes with `executed=false`. *Test:* `HKR-08`.

**HKR-09 Fail closed (contract I)**
*Scenario:* Corrupt and empty registries; malformed configurations; 10 malformed invocation shapes.
*Pass criteria:* invalid registries refuse every invocation with `E_VALID_REGISTRY_INVALID`; bad configs throw at construction (no runtime ⇒ no execution); malformed inputs are `INVALID_INPUT` with their exact code; zero handler runs. *Test:* `HKR-09`.

**HKR-10 Determinism (contract J)**
*Scenario:* Two runtimes, nine identical inputs; JSON-level and report-level comparison.
*Pass criteria:* `deepStrictEqual` results and resolutions; no timestamps/uuid-like ids in output; byte-identical reports. *Test:* `HKR-10`.

**HKR-11 Mutation suite — all 10 fail safely**
*Scenario:* Apply each required runtime mutation (registry-text mutations are asserted byte-different from `12`).
*Pass criteria (all 10):*

| # | Mutation | Required evidence |
|---|---|---|
| 1 | ACTIVE → BLOCKED | validation ok; gate alone refuses `E_CONFLICT_BLOCKED_CONFLICT`; spy run 0 |
| 2 | ACTIVE → ADAPTER_REQUIRED | `adapter_ref_missing` → `E_VALID_REGISTRY_INVALID`; spy run 0 |
| 3 | ACTIVE → UNKNOWN | `invalid_activation_status` → whole runtime refuses; all spies 0 |
| 4 | unknown key injection | `E_INPUT_UNKNOWN_KEY`, trace null, spies 0 |
| 5 | unknown command injection | `E_INPUT_UNKNOWN_COMMAND`, trace null, spies 0 |
| 6 | handler removal | `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING`, run 0; other handlers intact |
| 7 | handler replacement (mis-bound) | construction throws `E_VALID_HANDLER_SPEC`; impostor run 0 |
| 8 | malformed invocation (8 shapes) | each `INVALID_INPUT` with exact code; total runs 0 |
| 9 | invalid registry | `mut_active_invalid_mode.txt` (byte-different); all invocations refused; spies 0 |
| 10 | unauthorized fallback handler | gate refuses blocked record's handler (run 0); fallback never substitutes (`W` → `UNIMPLEMENTED`); forged resolution → `E_VALID_UNAUTHORIZED_RESOLUTION`; all runs 0 |

*Tests:* `HKR-11/1` … `HKR-11/10`.

**HKR-12/13/14 Traceability, reporting, ambiguous identity**
*Scenario:* Inspect trace fields and the `03` §5 result structure; rebuild the runtime report; collide two non-ACTIVE keys.
*Pass criteria:* trace carries exactly the nine §14 fields; every emitted code ∈ `RESULT_CODES` with its documented Core class; report byte-stable with all six classification counts and nine distinct state flags; shared key → `E_CONFLICT_AMBIGUOUS_IDENTITY` (never silently resolved). *Tests:* `HKR-12`, `HKR-13`, `HKR-14`.

**Task 06 release gate:** `node --test` = 58/58 pass (11 suites, 0 skipped);
HKR-01…HKR-14 all covered by a named executable test; 10/10 runtime mutations
fail safely; zero non-ACTIVE executions; resolver purity proven; Core `01`–`04`
byte-unchanged; `12` byte-unchanged; source 18/18; Task 05's 35 tests still
pass; git state reported, nothing committed.

---

## Group K — Tool Bus Tests (added Task 07; contract: `15-tool-bus.md`)

Executable with `node --test` from the repo root. Files: `test/tb-bus.test.mjs`
(19 tests, 3 suites — TB-01…TB-14 + TB-20…TB-24) and `test/tb-runtime.test.mjs`
(6 tests, 1 suite — TB-15…TB-19 + an invalid-capability runtime check); together
with Groups I+J's 58 the suite is **83 tests, 15 suites**. New module:
`modules/tool-bus/` (L1 Core Service: `capabilities.json` declarations,
`manifest.yaml`, `src/bus.mjs`, `src/capabilities.mjs`, `src/errors.mjs`) plus
`modules/hotkeys/src/dependencies.mjs` (dependency report) and the `toolBus`
option in `modules/hotkeys/src/runtime.mjs`. Groups I/J are untouched and still
pass; Core `01`–`04`, `12`, and the 18 source files are unchanged.

**TB-01 Valid capability registers**
*Scenario:* Build a bus from the pristine declarations; `register` a schema-valid synthetic capability.
*Pass criteria:* `validation.ok=true`; `TB_OK` with `error:null`; `has` true; `resolve` returns the complete descriptor (nine declared fields + `providerRegistered` + `invoke`); the capability appears in `list`. *Test:* `TB-01` (`test/tb-bus.test.mjs`).

**TB-02 Duplicate capability ids fail closed**
*Scenario:* `register` a capability whose id already exists (and `registerProvider` a duplicate provider id).
*Pass criteria:* `CAPABILITY_DUPLICATE` (class `E-CONFLICT`) — no silent overwrite; the original capability/provider is untouched; `validate` reports `CAPABILITY_DUPLICATE` for the duplicate candidate. *Test:* `TB-02` (`test/tb-bus.test.mjs`).

**TB-03 Invalid capability schema is rejected**
*Scenario:* Submit candidates violating individual fields (bad/missing id, version, purpose, status, input, output, requires, provider, errors) and a non-object.
*Pass criteria:* every candidate → `CAPABILITY_INVALID` (`E-VALID`) with the exact violation codes; none becomes resolvable. *Test:* `TB-03` (`test/tb-bus.test.mjs`).

**TB-04 Unknown capability cannot resolve**
*Scenario:* `resolve`/`check`/`invoke`/`describe` unknown ids, wrong-case ids, near-miss strings, and non-strings.
*Pass criteria:* `has` false; every lookup → `TOOL_NOT_FOUND` (`E-INPUT`); no fuzzy, case-insensitive, alias, or fallback match ever hits a registered capability. *Test:* `TB-04` (`test/tb-bus.test.mjs`).

**TB-05 Unavailable capability cannot invoke**
*Scenario:* Invoke `search providers` (`UNAVAILABLE`).
*Pass criteria:* `check`/`invoke` refuse `TOOL_UNAVAILABLE` (class `E-TOOL`), `output:null`, provider never called; `resolve` still shows the true state. *Test:* `TB-05` (`test/tb-bus.test.mjs`).

**TB-06 Blocked capability cannot invoke**
*Scenario:* Invoke an adapter-backed capability (`BLOCKED`, e.g. `browser tool`).
*Pass criteria:* refuse `TOOL_BLOCKED` (class `E-CONFLICT`) at the status gate — before any provider lookup; `output:null`. *Test:* `TB-06` (`test/tb-bus.test.mjs`).

**TB-07 Disabled capability cannot invoke**
*Scenario:* Invoke a synthetic `DISABLED` capability.
*Pass criteria:* refuse `TOOL_DISABLED` with a code distinct from TB-05 — a missing tool is not a disabled tool, and neither is collapsed into the other. *Test:* `TB-07` (`test/tb-bus.test.mjs`).

**TB-08 Missing dependency prevents invocation**
*Scenario:* A capability whose `requires` names an unregistered id, and one whose dependency is registered but not `AVAILABLE`.
*Pass criteria:* `DEPENDENCY_MISSING` (`E-ENV`) and `DEPENDENCY_BLOCKED` (`E-CONFLICT`) respectively; no invocation reaches a provider. *Test:* `TB-08` (`test/tb-bus.test.mjs`).

**TB-09 Missing provider prevents invocation**
*Scenario:* Invoke a capability that declares a provider id nobody bound.
*Pass criteria:* `PROVIDER_MISSING` (`E-ENV`, detail = the provider id) before execution; `describe` reports `providerRegistered:false`. *Test:* `TB-09` (`test/tb-bus.test.mjs`).

**TB-10 Valid provider executes successfully**
*Scenario:* Invoke `files` on a real repository document through the bound `local-files` provider.
*Pass criteria:* `TB_OK`, `error:null`, structured output (`file`, `bytes`, `lines`, `sha256` of the real file bytes, `content`); provider id echoed. *Test:* `TB-10` (`test/tb-bus.test.mjs`).

**TB-11 Provider failure becomes a deterministic structured failure**
*Scenario:* Providers that throw `ENOENT`, a permission error, and an unknown error; invoke each twice.
*Pass criteria:* `PROVIDER_FAILURE` with the classified error (`E_ENV_MISSING_FILE` / `E_TOOL_READ_FAILED` / `E_UNKNOWN_EXCEPTION` — `classifyProviderError`, never a raw stack); `output:null`; byte-identical structured results across reruns. *Test:* `TB-11` (`test/tb-bus.test.mjs`).

**TB-12 Invalid input is rejected before provider execution**
*Scenario:* Invoke a valid capability with wrong-typed/missing/extra input fields; spy on the provider.
*Pass criteria:* `INPUT_INVALID` (`E-INPUT`) with the failing field; spy run 0 — the provider never sees malformed input. *Test:* `TB-12` (`test/tb-bus.test.mjs`).

**TB-13 Repeated resolution is deterministic**
*Scenario:* Repeat `resolve`/`check`/`describe` on the same ids; compare structured results; scan for volatile data.
*Pass criteria:* equivalent results every time; no timestamps, uuids, pids, or machine paths in any result. *Test:* `TB-13` (`test/tb-bus.test.mjs`).

**TB-14 Repeated reports are byte-identical**
*Scenario:* Build `buildToolBusReport` twice on one bus and once on a fresh equal bus; with and without hotkey rows.
*Pass criteria:* identical `text` and `sha256` (hash of its own bytes) every time; states declarations sha256, `Valid=true`, `Capabilities=11`, status counts 1/2/8/0, and all report sections; no volatile data; the declaration file's own sha256 matches. *Test:* `TB-14` (`test/tb-bus.test.mjs`).

**TB-15 Runtime receives `TOOL_REQUIRED`**
*Scenario:* Wire the bus into `createRuntime` and make a handler's `requiredTools` include an unavailable capability.
*Pass criteria:* `executeHotkey` → classification `TOOL_REQUIRED`, code `E_TOOL_UNAVAILABLE` (class `E-TOOL`), `status=blocked`, handler never runs. *Test:* `TB-15` (`test/tb-runtime.test.mjs`).

**TB-16 Runtime receives the dependency-blocked result**
*Scenario:* Required capability is `BLOCKED` on the bus (and a dependency-blocked chain).
*Pass criteria:* `TOOL_REQUIRED` with the distinct code `E_CONFLICT_DEPENDENCY_BLOCKED` (class `E-CONFLICT`) — blocked state is not collapsed into plain tool-unavailable; no execution. *Test:* `TB-16` (`test/tb-runtime.test.mjs`).

**TB-17 No-tool hotkey remains executable without a Tool Bus dependency**
*Scenario:* Execute a handler whose `requiredTools` is empty while a valid bus is wired (and with an empty bus capability set).
*Pass criteria:* `EXECUTABLE`/`OK_EXECUTED` — the bus is never an artificial blocker for tool-free behavior. *Test:* `TB-17` (`test/tb-runtime.test.mjs`).

**TB-18 SoS stays `TOOL_REQUIRED`**
*Scenario:* Execute `SoS` with the pristine bus wired (search provider absent).
*Pass criteria:* `TOOL_REQUIRED` / `E_TOOL_UNAVAILABLE`, explanation names `search providers`; zero search behavior executed or faked; registry record untouched. *Test:* `TB-18` (`test/tb-runtime.test.mjs`).

**TB-19 No fake fallback capability is invoked**
*Scenario:* Spy handlers/providers while triggering refusals; attempt unknown and refused ids.
*Pass criteria:* total runs = 0; no substitute/alias capability ever dispatched; refusals are structured, not falls-through. *Test:* `TB-19` (`test/tb-runtime.test.mjs`).

**TB-20…TB-24 Mutation suite — all 5 fail closed**
*Scenario:* Apply each capability mutation from a fixture; each test first asserts the fixture is byte-different from `modules/tool-bus/capabilities.json` (`fixture !== pristine`).
*Pass criteria (all 5):*

| # | Mutation | Fixture | Required evidence |
|---|---|---|---|
| TB-20 | remove capability declaration | `tb_missing_capability.json` | valid document (`ok=true`) yet `has` false; `resolve`/`check`/`invoke` → `TOOL_NOT_FOUND` |
| TB-21 | alter capability status (`files` → `DISABLED`) | `tb_status_altered.json` | `resolve` shows `DISABLED`; `invoke` → `TOOL_DISABLED` (`E-CONFLICT`), never executes |
| TB-22 | remove provider declaration | `tb_provider_removed.json` | `providerRegistered:false`; `invoke` → `PROVIDER_MISSING` (detail `local-files`) |
| TB-23 | alter dependency (`files.requires` → `ghost-dependency`) | `tb_dependency_altered.json` | schema-valid yet `invoke`/`check` → `DEPENDENCY_MISSING` (`E-ENV`, detail `ghost-dependency`) |
| TB-24 | duplicate capability (`files` ×2) | `tb_duplicate_capability.json` | `ok=false` + `capability_duplicate`; `list()` empty; every lookup → `CAPABILITY_INVALID` (`E-VALID`); report states `Valid \| false` |

*Tests:* `TB-20`…`TB-24` (`test/tb-bus.test.mjs`); fixtures in `test/_fixtures/`.

**TB runtime extra — invalid declarations refuse execution**
*Scenario:* Build a runtime over a bus whose declarations failed validation.
*Pass criteria:* every tool-dependent invocation → `REFUSED` / `E_VALID_CAPABILITY_INVALID` (class `E-VALID`) — an invalid bus can never grant access. *Test:* last case of `test/tb-runtime.test.mjs`.

**Task 07 release gate:** `node --test` = 83/83 pass (15 suites, 0 skipped);
TB-01…TB-24 all covered by a named executable test; 5/5 capability mutations
fail closed with byte-different fixtures asserted; reports byte-stable;
four capability statuses never collapsed; runtime integration passes (TB-15…TB-19);
Core `01`–`04` byte-unchanged; `12` byte-unchanged; source 18/18; Task 05/06's
58 tests still pass; git state reported with remote SHA verified.

**Known limitations (Group K):** only `files`/`local-files` is executable —
`search providers` and `Netlify Drop` are honestly `UNAVAILABLE`, the eight
adapter-backed capabilities are `BLOCKED` (`12` §4 remains `NOT_ACTIVATED`);
`DISABLED` exists only in mutation TB-21; no invocation log is persisted; the
bus gates tools only and never invents handler behavior.

---

## Group L — Module Registry Tests (added Task 08; contract: `16-module-registry.md`)

Executable with `node --test` from the repo root. File:
`test/mr-registry.test.mjs` (19 tests, 4 suites); together with Groups A–K's
83 the suite is **102 tests, 19 suites**. New module:
`modules/module-registry/` (L1: `manifest.yaml`, `src/manifest.mjs` YAML-subset
parser + §2/M1–M6 validators, `src/registry.mjs` REGISTER→VALIDATE→ENABLE→
INVOKE contract + report builder, `src/errors.mjs`, `index.mjs` entry). Groups
I/J/K and the 83 prior tests are untouched and still pass; Core `01`–`04`,
`12`, and the 18 source files are unchanged. This group makes the previously
spec-only acceptance tests AC-19 (and the executable reading of AC-17)
enforced by code.

**MR-01 Registration (03 §3 REGISTER)**
*Scenario:* Register `hotkeys`, `tool-bus`, and `module-registry` manifests (read from their real files); describe each.
*Pass criteria:* all register `MR_OK`; `list()` preserves registration order; descriptors carry exactly the §2 field set + `enabled` + live `violations`; the registry's own manifest validates itself clean. *Test:* `MR-01`.

**MR-02 Duplicate ids fail closed**
*Scenario:* Register the same manifest twice in one registry (and a different first module in a second registry).
*Pass criteria:* `MODULE_DUPLICATE` (`E-CONFLICT`), no overwrite, original descriptor byte-equal, no cross-registry interference. *Test:* `MR-02`.

**MR-03 Invalid documents fail closed at register**
*Scenario:* Submit a non-string, an unparseable document, a document without `id`, and `id: []`.
*Pass criteria:* `INVALID_INVOCATION` (E-INPUT) / `MANIFEST_INVALID` (E-VALID) with named violations where parseable; registry stays empty. *Test:* `MR-03`.

**MR-04 Unknown module refuses on every surface**
*Scenario:* validate/enable/disable/canInvoke/describe an unregistered id; pass malformed canInvoke input.
*Pass criteria:* every surface → `MODULE_NOT_FOUND` (E-INPUT); input shape is checked before lookup (`INVALID_INVOCATION`). *Test:* `MR-04`.

**MR-05 VALIDATE clean on real inputs (03 §3 duties)**
*Scenario:* `validateAll()` over the three real manifests, twice.
*Pass criteria:* `ok=true`, every module `MR_OK` with zero violations; repeated call deep-equal (deterministic). *Test:* `MR-05`.

**MR-06 Field rules name the exact violation (03 §2 M1–M6)**
*Scenario:* 20 synthetic manifests, each violating exactly one rule (missing fields, id/version/core/phase/error-class/requires/provides/name rules, unknown field).
*Pass criteria:* each produces its exact violation code at VALIDATE **and** the same named violation at ENABLE (`MANIFEST_INVALID`); the clean baseline passes. *Test:* `MR-06`.

**MR-07 Lifecycle enable/disable (03 §3 ENABLE/DISABLE)**
*Scenario:* Enable a module; enable again; disable; disable again; re-enable.
*Pass criteria:* provides resolve only while enabled; `MODULE_ALREADY_ENABLED` (E-CONFLICT) and `MODULE_NOT_ENABLED` (E-ENV) are named refusals, never silent no-ops. *Test:* `MR-07`.

**MR-08 Conflicts fail closed in both directions**
*Scenario:* A module declaring `conflicts: [hotkeys]` while `hotkeys` is enabled; then the reverse after enabling it.
*Pass criteria:* `conflict_enabled` violation in VALIDATE (detail names the enabled module); ENABLE refuses `CONFLICT_MODULE_ENABLED` (E-CONFLICT) with the specific rule named before any generic validation failure; once the conflict is disabled the same module validates clean. *Test:* `MR-08`.

**MR-09 Capability resolution is mediated, never guessed (02 §3 rule 3)**
*Scenario:* Resolve a provides of a registered-but-disabled module; enable it; resolve an unknown capability; two enabled providers; disable one.
*Pass criteria:* `CAPABILITY_UNRESOLVED` (E-ENV) → `MR_OK` with the provider module → `CAPABILITY_UNRESOLVED` for unknown → `CAPABILITY_AMBIGUOUS` (E-CONFLICT, both ids listed) → resolves after one side disables; never a substitute. *Test:* `MR-09`.

**MR-10 INVOKE gate: declared phases and tools only (03 §3 L2, M3)**
*Scenario:* canInvoke with/without a declared phase, an undeclared phase, an undeclared tool, 8 malformed input shapes, and after disable.
*Pass criteria:* happy paths `MR_OK`; `PHASE_NOT_DECLARED` and `TOOL_UNDECLARED` (both E-CONFLICT); `INVALID_INVOCATION` (E-INPUT) for bad shapes; `MODULE_NOT_ENABLED` after disable; a not-yet-enabled module refuses before phase/tool checks. *Test:* `MR-10`.

**MR-11 Unavailable tool dependency fails closed (03 §3 tool availability via Task 07)**
*Scenario:* A manifest requiring `search providers`, validated through the pristine Tool Bus; contrast manifest requiring `files`.
*Pass criteria:* `tool_unavailable` violation names the token; VALIDATE/ENABLE/INVOKE all refuse (`MANIFEST_INVALID`); never enabled; contrast passes. *Test:* `MR-11`.

**MR-12 Configuration fails closed at construction**
*Scenario:* `toolBus` without `check()`, non-array/blank `availableTools`, and the no-bus legacy path.
*Pass criteria:* each throws `E_INPUT_INVALID_REGISTRY_CONFIG` (E-INPUT); default tool set applies without a bus; legacy path still refuses an unavailable declared tool. *Test:* `MR-12`.

**MR-13 Deterministic results and byte-identical reports**
*Scenario:* Build equal registries twice; validate, describe, and report repeatedly; report a dirty registry.
*Pass criteria:* deep-equal results for equal state; report text/sha256 identical across rebuilds and fresh registries; sha256 of own bytes; no timestamps or uuid-like ids; dirty report states `| Valid | n |` and lists the violations. *Test:* `MR-13`.

**MR-14 AC-19 — an incomplete manifest must not run**
*Scenario:* Register `mut_manifest_incomplete.yaml` (hotkeys manifest minus `requires:` and `errors:`, asserted byte-different).
*Pass criteria:* REGISTER accepts; VALIDATE rejects with `missing_requires` + `missing_errors`; ENABLE and INVOKE refuse `MANIFEST_INVALID` with those violations attached; module never enabled; its `provides` never resolve; `validateAll` fails closed. *Test:* `MR-14`.

**MR-15 Mutation suite — all 4 remaining fail closed**
*Scenario:* Apply each manifest mutation (each asserted byte-different from the pristine hotkeys manifest).
*Pass criteria (all 4):*

| # | Mutation | Fixture | Required evidence |
|---|---|---|---|
| MR-15/1 | loop phase `SHIP` → `DEPLOY` | `mut_manifest_phase.yaml` | `invalid_phase` (detail `DEPLOY`); enable + invoke refused |
| MR-15/2 | `E-TOOL` → `E-CUSTOM` | `mut_manifest_error_class.yaml` | `invalid_error_class` (detail `E-CUSTOM`); enable refused |
| MR-15/3 | `core: >=2.0 <3.0` | `mut_manifest_core_range.yaml` | `core_version_mismatch` naming the range and Core 3.0; enable refused |
| MR-15/4 | `id` → registered `tool-bus` | `mut_manifest_id_collision.yaml` | `MODULE_DUPLICATE` at REGISTER; real module untouched, still valid |

*Tests:* `MR-15/1` … `MR-15/4`.

**MR-16 Export surface, parser, error-class conformance**
*Scenario:* Exercise every export (vocabularies, `parseManifest`, `validateManifest`, `checkTool`, report builder on an empty registry) and the code→class table.
*Pass criteria:* the eight phases and thirteen fields match `01`/`03`; every `RESULT_CODES` class is inside the module's declared `errors` subset, itself inside the Core seven; parser names `manifest_unsupported_syntax`/`manifest_not_string`; standalone `validateManifest` detects conflicts in both directions; empty-registry report is valid and hash-stable. *Test:* `MR-16`.

**Task 08 release gate:** `node --test` = 102/102 pass (19 suites, 0 skipped,
exit 0); MR-01…MR-16 all covered by a named executable test; 5/5 manifest
mutations fail closed with byte-different fixtures asserted; AC-19 enforced by
code; reports byte-stable; Core `01`–`04` byte-unchanged; `12` byte-unchanged;
source 18/18; Task 05/06/07's 83 tests still pass; **no commit or push** —
implementation/review cycle per the Task 08 directive.

**Known limitations (Group L):** no REPORT stage (the Report Bus is a
separate, unimplemented L1 service); unresolved `consumes` has no normative
VALIDATE gate (referred to the executive owner as a future-task question —
see `16-module-registry.md` §10); `entry` existence is unchecked (no contract
rule requires it); enablement state is per-instance; the manifest parser is a
strict YAML subset that fails closed on anything else.

---

## Group N — Report Bus Tests (added Task 09; contract: `17-report-bus.md`)

Executable with `node --test` from the repo root. File:
`test/rb-report-bus.test.mjs` (29 tests, 5 suites); together with Groups
A–L's 102 the suite is **131 tests, 24 suites**. New module:
`modules/report-bus/` (L1: `manifest.yaml`, `src/catalog.mjs` static
report-type/section catalogue + fail-closed input validation,
`src/bus.mjs` `createReportBus` with `validate`/`build`/describe surfaces and
deterministic renderer, `src/errors.mjs`, `index.mjs` entry). Groups A–L and
the 102 prior tests are untouched and still pass; Core `01`–`04`, `12`, and
the 18 source files are unchanged. This group makes the REPORT stage of
`03` §3 and the structured-result schema of `03` §5 executable.

**RB-01 Entry point (03 §2 entry field)**
*Scenario:* Import `modules/report-bus/index.mjs` dynamically; exercise the frozen bus surface; scan the entry file's import specifiers.
*Pass criteria:* every documented export exists; `createReportBus()` returns a frozen object exposing `build`/`validate`/`listTypes`/`describeType`/`listSections`/`describeSection`; the entry imports only `node:` and `./` specifiers. *Test:* `RB-01`.

**RB-02 Manifest under the established module contract (03 §2)**
*Scenario:* Register all four real manifests in a Task 08 registry wired to the real Tool Bus; validate `report-bus`; compare vocabularies.
*Pass criteria:* `report-bus` validates clean alone and with the other three; `phases` `[RUN, TEST, SHIP] ⊆` the eight; `requires.tools` `[]`, `consumes` `[]`, `conflicts` `[]`, entry exact; declared `errors` = the raisable subset = four classes, each inside the Core seven; the six failure codes of `RESULT_CODES` map inside both; the local eight-phase copy deep-equals the registry's copy. *Test:* `RB-02`.

**RB-03 Valid input → successful report (03 §5)**
*Scenario:* Build the pristine completion input and a single-row `result` input; call `validate` on the same input.
*Pass criteria:* `ok:true`, code `VALID`, `error:null`, zero violations, `{text, sha256}` present with the type-specific title; `validate()` returns the same verdict and never carries a `report` key. *Test:* `RB-03`.

**RB-04 Deterministic section identities (02 §1, 03 §5)**
*Scenario:* Inspect the catalogue and type definitions; build the pristine input twice; extract rendered headings and row contracts.
*Pass criteria:* exactly 7 sections in canonical order and 2 types; `completion` requires `results`/`phase-ledger`/`evidence`/`remaining-issues` and allows all seven; `result` requires and allows `results` only; repeat builds deep-equal; headings numbered in canonical order; the `results` field list equals the eight `03` §5 fields. *Test:* `RB-04`.

**RB-05 Ordering is deterministic (03 §5, determinism)**
*Scenario:* Build the byte-different control fixture (`mut_rb_reordered.json`, sections reversed) and a third inline permutation against the pristine build.
*Pass criteria:* byte-identical text and sha256 across all permutations; headings stay canonical; row order inside a section is preserved exactly as supplied. *Test:* `RB-05`.

**RB-06 Byte-identical repeats**
*Scenario:* Build the same input three times on one bus and on fresh instances (both types).
*Pass criteria:* every `text` equals the first; no instance state leaks. *Test:* `RB-06`.

**RB-07 Identical SHA-256**
*Scenario:* Collect hashes across repeats, fresh instances, and a section permutation.
*Pass criteria:* exactly one distinct hash for the one input state. *Test:* `RB-07`.

**RB-08 SHA-256 over the exact bytes**
*Scenario:* Recompute `sha256(report.text)` for both types; flip one byte and recompute.
*Pass criteria:* recomputed digest equals `report.sha256`; the flipped text hashes differently (every byte is covered). *Test:* `RB-08`.

**RB-09 Invalid input fails closed (01 §13.5)**
*Scenario:* Ten invalid inputs: null, string, array, empty object, empty/typeless `type`, non-array `sections`, envelope field (`generated_at`), and the corrupted fixture.
*Pass criteria:* each → `INVALID_INPUT` (E-INPUT), `report === null`, violations non-empty, frozen result; `validate()` refuses identically and never renders. *Test:* `RB-09`.

**RB-10 Unknown identity fails closed**
*Scenario:* Unknown report type (fixture), unknown section id, a known section disallowed for the type, and unknown describe lookups.
*Pass criteria:* `UNKNOWN_REPORT_TYPE` with detail `status-report`; `INVALID_SECTION` naming the ghost id and the disallowed section; describe surfaces refuse by the same codes; `report === null` everywhere. *Test:* `RB-10`.

**RB-11 Duplicate section identity fails closed**
*Scenario:* The duplicate fixture (two `results` entries) and an inline duplicate.
*Pass criteria:* `DUPLICATE_SECTION` (E-CONFLICT), detail `results`, `report === null` — duplicates are never merged or silently deduplicated. *Test:* `RB-11`.

**RB-12 Missing required content fails closed**
*Scenario:* Missing `results` section (fixture), row missing `command` (fixture), an empty section list, a required section with broken `rows`.
*Pass criteria:* `MISSING_REQUIRED_FIELD` naming `section:results` and `results[0].command`; the empty list yields exactly four violations in catalogue order (`results`, `phase-ledger`, `evidence`, `remaining-issues`); broken `rows` → `INVALID_SECTION`; `validate()` ≡ `build()`. *Test:* `RB-12`.

**RB-13 No volatile data (determinism)**
*Scenario:* Scan built output for ISO timestamps, uuids, pids, machine paths, `undefined`/`NaN`, volatile field names; scan every module source file for `Date.now`/`Math.random`/`process.pid|env|hrtime`/`new Date`.
*Pass criteria:* zero matches in output and source. *Test:* `RB-13`.

**RB-14 Separate-process generation**
*Scenario:* Spawn a fresh `node` process that imports the entry point, builds the pristine fixture, and prints `{text, sha256}`.
*Pass criteria:* child exits 0; text and hash byte-identical to the in-process build. *Test:* `RB-14`.

**RB-15 Module Registry rows (03 §3 REPORT-facing state)**
*Scenario:* Register and enable the four real manifests on a registry, map `validateAll()` into §5 rows, pass `buildRegistryReport(registry).sha256` as an artifact row.
*Pass criteria:* build succeeds; every module's validation row renders with its exact identity and `success`; the registry report hash appears in the artifacts table; `sha256(text)` covers the bytes; the bus never imported the registry. *Test:* `RB-15`.

**RB-16 Tool Bus rows (02 §2 Report Bus evidence)**
*Scenario:* Map `bus.list()` capability states of the real 11-capability declaration set into §5 rows (`AVAILABLE → success`, other states → `blocked` with the exact state as evidence/remaining issue).
*Pass criteria:* build succeeds with mixed states present; the first capability renders exactly as supplied; unavailable capabilities appear as remaining issues; hash covers the bytes; no state is collapsed inside the row. *Test:* `RB-16`.

**RB-17 Hotkey/runtime rows (03 H6, 14 §4)**
*Scenario:* Execute real hotkeys (`R`, `PN`, `W`) and pass their results through as §5 rows untouched; add `buildRuntimeReport(...).sha256` as an artifact row; build a completion report over the flattened ledger/evidence/remaining issues.
*Pass criteria:* both builds succeed; `success` (executed) and `blocked` (unimplemented) both render — never collapsed; the runtime report hash appears; the real `E_ENV_HANDLER_MISSING` remaining issue carries through verbatim. *Test:* `RB-17`.

**RB-18 No L2 import or execution (02 §3 rules 1/3)**
*Scenario:* Scan every Report Bus source file for import specifiers, lateral module paths, and executor APIs; build twice from fresh buses over the same input.
*Pass criteria:* every specifier starts `node:` or `./`; `node:` set is exactly `{node:crypto}`; no `modules/(hotkeys|tool-bus|module-registry)` reference, no `child_process`/`eval`/`Function`/`require`/dynamic `import`; inputs are never mutated. *Test:* `RB-18`.

**RB-19 Protected files byte-identical**
*Scenario:* sha256 the five protected files against their pins.
*Pass criteria:* 5/5 match (`01`–`04`, `12`). *Test:* `RB-19`.

**RB-20 Prior suite stays green**
*Scenario:* Spawn `node --test --test-reporter=tap` over the six prior suites from inside the test run (test-context marker stripped from the child env).
*Pass criteria:* child exit 0, `# fail 0`, `# pass == # tests`, tests ≥ 102. *Test:* `RB-20`.

**Mutations RB-M1…RB-M9 (byte-different fixtures)**
Each fixture is asserted byte-different from the pristine `rb_report_input.json` before use, then must refuse with its exact code, its exact class, `report === null`, the expected violation detail, and an identical `validate()` verdict:

| Fixture | Exact mutation | Expected refusal |
|---|---|---|
| `mut_rb_missing_section.json` | required `results` section removed | `MISSING_REQUIRED_FIELD` (E-VALID), detail `section:results` |
| `mut_rb_duplicate_section.json` | `results` declared twice | `DUPLICATE_SECTION` (E-CONFLICT), detail `results` |
| `mut_rb_malformed_section.json` | a raw string where a section entry belongs | `INVALID_SECTION` (E-VALID) |
| `mut_rb_invalid_status.json` | `status: "kinda-done"` | `DEPENDENCY_ERROR` (E-ENV), detail `results[0].status` |
| `mut_rb_unknown_type.json` | `type: "status-report"` | `UNKNOWN_REPORT_TYPE` (E-INPUT) |
| `mut_rb_corrupted.json` | `sections` replaced by an object | `INVALID_INPUT` (E-INPUT) |
| `mut_rb_missing_field.json` | row missing `command` | `MISSING_REQUIRED_FIELD` (E-VALID), detail `results[0].command` |
| `mut_rb_invalid_row.json` | row `42` instead of an object | `DEPENDENCY_ERROR` (E-ENV), detail `results[0]` |
| `mut_rb_nondeterministic.json` | undeclared volatile field `generated_at` in a row | `INVALID_SECTION` (E-VALID) |
| `mut_rb_reordered.json` | sections reversed (control) | `VALID` — byte-identical report (RB-05) |

**Task 09 release gate:** `node --test` = 131/131 pass (24 suites, 0 skipped,
exit 0); RB-01…RB-20 and RB-M1…M9 all covered by named executable tests;
9/9 mutations fail closed with byte-different fixtures asserted; reports
byte-stable across calls, instances, permutations, and processes
(`sha256(text) === sha256`); Core `01`–`04` byte-unchanged; `12`
byte-unchanged; source 18/18; Task 05–08's 102 tests still pass; **no commit
or push** — implementation/review cycle per the Task 09 directive.

**Known limitations (Group N):** the bus cannot verify that a supplied
`success` passed D1–D10 (`03` §5 O1/O2 are the emitter's duty); required
sections are enforced by presence, not by a minimum row count; artifact
`sha256` values are format-checked but not recomputed (the bytes are never
fetched — the no-`fs` boundary holds); only the two spec-defined report
types exist (`completion`, `result`); the bus persists and transports
nothing; row order is semantic while section order is canonical.

## Group O — Agent Orchestrator Tests (added Task 10; contract: `18-agent-orchestrator.md`)

Executable with `node --test` from the repo root. File:
`test/agent-orchestrator.test.mjs` (36 tests, 5 suites); together with Groups
A–N's 131 the suite is **167 tests, 29 suites**. New L2 module:
`modules/agent/` (`manifest.yaml` — `id: agent`, `provides:
[agent:orchestrate]`, `requires.tools: []`, entry `modules/agent/index.mjs`;
`src/errors.mjs` Core-class vocabulary, `src/request.mjs` strict request
envelope, `src/orchestrator.mjs` the seven-stage finite lifecycle). Groups
A–N and the 131 prior tests are untouched and still pass; Core `01`–`04`,
`12`, and the 18 source files are unchanged. This group makes the
orchestration contract of directive Task 10 executable: every request
either reaches the Hotkey Runtime through the Module Registry and Tool Bus
and gets a Report Bus completion — or is refused at a named stage with a
named code, and never executes.

**AO-01 Entry point, manifest, configuration, result-code table (03 §2, 01 §13.5)**
*Scenario:* Import `modules/agent/index.mjs`; scan its import specifiers; register all five real manifests in a registry wired to the real Tool Bus; `validateAll()`; compare vocabularies; construct orchestrators with each dependency removed; walk `RESULT_CODES`/`LIFECYCLE_STAGES`/`OPERATION_KINDS`.
*Pass criteria:* every documented export exists; the entry imports only `./` files; all five manifests validate clean; `descriptor` = phases `[RUN, TEST, SHIP]`, `requires {tools: []}`, `provides [agent:orchestrate]`, the four `consumes`, entry exact, declared errors = the six raisable classes ⊆ Core seven; local eight-phase copy ≡ registry copy; every missing dependency throws `E_INPUT_INVALID_ORCHESTRATOR_CONFIG`; exactly 12 result codes (one success, three `classified`) and the seven lifecycle stages in directive order; the only kind is `hotkey` with capability `hotkeys:execute`. *Test:* `AO-01`.

**AO-02 A valid request resolves into an exact execution plan**
*Scenario:* Run the pristine request; inspect plan and report evidence; re-run with `phase: "DEBUG"` (a real but undeclared phase).
*Pass criteria:* `ok:true`, `code: COMPLETED`; plan exactly `{module: hotkeys, capability: hotkeys:execute, phase: RUN, tools: [files]}`; report evidence shows each registry gate (`has → true`, `isEnabled → true`, `provides.includes → true`, `resolveCapability → hotkeys`, `canInvoke → MR_OK`); the wrong phase stops at RESOLVE with `PHASE_NOT_DECLARED`, `plan: null`, and a report (refusals are reported too). *Test:* `AO-02`.

**AO-03 An enabled module resolves (enablement observed, never assumed)**
*Scenario:* Run with hotkeys enabled; then against a registry where hotkeys is registered but not enabled.
*Pass criteria:* enabled run completes and reports `PREFLIGHT: done (1 tool)`; disabled run → `MODULE_DISABLED` at RESOLVE with `plan: null`. *Test:* `AO-03`.

**AO-04 An available capability resolves; two providers are never guessed**
*Scenario:* Normal run; then a spoof module whose manifest id differs but declares the same `hotkeys:execute`, both enabled.
*Pass criteria:* normal run shows `resolveCapability(hotkeys:execute) → hotkeys`; the two-provider registry yields `CAPABILITY_AMBIGUOUS` (E-CONFLICT) naming the other provider, `plan: null` — never a guessed side. *Test:* `AO-04`.

**AO-05 A valid tool dependency reaches execution through Tool Bus preflight**
*Scenario:* Wrap the Tool Bus in a counting spy; run the pristine request.
*Pass criteria:* exactly one `check` (the manifest's single declared tool `files`); `preflight = {ok:true, tools:[{tool: files, ok:true, code: TB_OK}]}`; `execution.executed === true`; report evidence `toolBus.check(files) → TB_OK`. *Test:* `AO-05`.

**AO-06 Successful execution reaches REPORT and COMPLETE**
*Scenario:* Run the pristine request end to end; inspect result and report bytes.
*Pass criteria:* `status: COMPLETED`, `stage: COMPLETE`, `error: null`, report present with `sha256 == sha256(text)`; title `# Grimoire v3 — Completion Report`; summary `| Status | COMPLETED |`; results row `| hotkeys | agent.orchestrate | success |`; evidence `runtime.executeHotkey(...) → OK_EXECUTED (executed=true)`; ledger ends `REPORT: done (report-bus)` + `COMPLETE: done`; remaining issues declared empty. *Test:* `AO-06`.

**AO-07 Invalid requests fail closed at VALIDATE, before anything runs**
*Scenario:* Fifteen invalid envelopes (null, string, array, number, `{}`, envelope field `generated_at`, wrong kind, numeric module, newline module, unknown phase, both target fields, empty target, non-object target, extra target field, non-object args) against a runtime spy; cross-check `validateRequest`.
*Pass criteria:* each → `INVALID_REQUEST` / `REFUSED` / stage `VALIDATE`, `plan`/`preflight`/`execution` all `null`, E-INPUT, report present, `validateRequest` refuses the same input; zero runtime calls. *Test:* `AO-07`.

**AO-08 An unknown module fails closed**
*Scenario:* Run with `module: "ghost-module"`.
*Pass criteria:* `MODULE_NOT_FOUND` at RESOLVE, E-INPUT, detail `ghost-module`, `plan: null`, report contains `registry.has(ghost-module) → false`, zero runtime calls. *Test:* `AO-08`.

**AO-09 A disabled module fails closed**
*Scenario:* Request `tool-bus`/`toolbus:capabilities` on a registry where only hotkeys is enabled.
*Pass criteria:* `MODULE_DISABLED` at RESOLVE, E-ENV, `plan: null`, report shows `registry.isEnabled(tool-bus) → false`, zero runtime calls. *Test:* `AO-09`.

**AO-10 Unknown, unpairable, and ambiguous capabilities fail closed**
*Scenario:* (a) capability the named module does not provide; (b) a real capability of another enabled module but not the one a hotkey operation executes; (c) two enabled providers of the same capability.
*Pass criteria:* (a) → `CAPABILITY_UNAVAILABLE` with `hotkeys does not provide ghost:capability`; (b) → `CAPABILITY_UNAVAILABLE` with `operation hotkey executes hotkeys:execute only`; (c) → `CAPABILITY_AMBIGUOUS` (E-CONFLICT); all three `ok:false`, `plan: null`, reported, zero runtime calls. *Test:* `AO-10`.

**AO-11 An unavailable tool fails closed**
*Scenario:* Inject a bus whose `check` returns `TOOL_UNAVAILABLE` (registry still healthy).
*Pass criteria:* `TOOL_REQUIRED` / `REFUSED` at PREFLIGHT, E-TOOL, detail `files: TOOL_UNAVAILABLE`, `preflight.ok:false`, `execution: null`, report evidence `toolBus.check(files) → TOOL_UNAVAILABLE`, zero runtime calls. *Test:* `AO-11`.

**AO-12 A blocked tool fails closed**
*Scenario:* Same with `TOOL_BLOCKED`.
*Pass criteria:* identical shape to AO-11 with `files: TOOL_BLOCKED`. *Test:* `AO-12`.

**AO-13 A missing dependency fails closed**
*Scenario:* Same with `DEPENDENCY_MISSING`.
*Pass criteria:* identical shape with `files: DEPENDENCY_MISSING` — the bus's code passes through verbatim, never reinterpreted. *Test:* `AO-13`.

**AO-14 An invalid capability token fails closed at VALIDATE**
*Scenario:* `capability: "not-a-capability"`.
*Pass criteria:* `INVALID_REQUEST` at VALIDATE, detail names the `namespace:name` form, report present. *Test:* `AO-14`.

**AO-15 A runtime refusal propagates as EXECUTION_REFUSED**
*Scenario:* `target: {key: "GHOST"}` — the real runtime refuses an unknown key.
*Pass criteria:* `EXECUTION_REFUSED` / `REFUSED` at EXECUTE; the runtime's E-INPUT class is propagated, not invented; detail carries `E_INPUT_UNKNOWN_KEY`; the raw execution result is attached with `executed:false`; report hash valid. *Test:* `AO-15`.

**AO-16 A handler failure propagates as EXECUTION_FAILED**
*Scenario:* A runtime whose handler throws inside `run`.
*Pass criteria:* `EXECUTION_FAILED` / `FAILED` at EXECUTE; class `E-UNKNOWN` from the runtime's classification; detail carries `E_UNKNOWN_EXCEPTION` + the runtime's neutral message; `execution.executed === false`; report ledger `EXECUTE: failed (EXECUTION_FAILED)`. *Test:* `AO-16`.

**AO-17 A report failure propagates and never claims completion**
*Scenario:* A report bus whose `build` refuses (`DEPENDENCY_ERROR`); then the same bus with an earlier refusal.
*Pass criteria:* executed run → `REPORT_FAILED` / `stage: REPORT` / `report: null` (an executed request is NOT a completed one), E-ENV from the bus, detail preserves `attempt COMPLETED`, `execution.executed === true`; the early-refusal run also reports `REPORT_FAILED` — REPORT is terminal. *Test:* `AO-17`.

**AO-18 Agent → Module Registry uses only the public contract (with belts)**
*Scenario:* Proxy the real registry and record every property touched during a run; then four fake registries refusing `canInvoke` in unexpected codes.
*Pass criteria:* accessed properties ⊆ `{has, isEnabled, describe, resolveCapability, canInvoke}`; belts translate `MANIFEST_INVALID→MANIFEST_INVALID`, `TOOL_UNAVAILABLE→TOOL_REQUIRED`, `INVALID_INVOCATION→INVALID_REQUEST`, `MODULE_NOT_ENABLED→MODULE_DISABLED` — each at RESOLVE with `plan: null`, never swallowed, zero belt-refusal runtime calls. *Test:* `AO-18`.

**AO-19 Agent → Hotkey Runtime — one call, exact input, none on refusal**
*Scenario:* Spy the runtime for a plain run, an `args: {}` run, and three gate refusals.
*Pass criteria:* exactly one call per executed run; input is exactly `{key: "R"}` (no transformation) and `{key: "R", args: {}}` when args present; zero calls for module/capability/invalid refusals. *Test:* `AO-19`.

**AO-20 Agent → Tool Bus — one check per declared tool, zero when resolution fails**
*Scenario:* Spy `check` for a normal run, a ghost-module run, an invalid run, and a faulted bus.
*Pass criteria:* `checks === [files]` for the normal run; `[]` for resolution failure; `[]` for invalid requests; the faulted bus yields `TOOL_REQUIRED`/`ok:false` — never reinterpreted. *Test:* `AO-20`.

**AO-21 Agent → Report Bus — a real completion input, built by the real bus**
*Scenario:* Wrap `build` to capture the input, then rebuild the captured input independently.
*Pass criteria:* input `type: completion`, sections exactly `summary, results, phase-ledger, evidence, remaining-issues`; results row module `hotkeys`, command `agent.orchestrate`, status `success`, assumptions `[]`; remaining-issues zero rows; the captured input is contract-valid on its own (`build → ok:true`); final `sha256 == sha256(text)`. *Test:* `AO-21`.

**AO-22 Direct handler bypass is impossible through the public surface (02 §3 rules 1/3)**
*Scenario:* Assert the frozen surface; scan every agent source file for import specifiers and executor APIs; run refused requests through a runtime spy; run an unknown key through.
*Pass criteria:* surface is exactly `run`, object frozen; all imports `./`-only; no `child_process`/`eval`/`Function`/`require`/dynamic `import`, no handler/file access, no `modules/(hotkeys|tool-bus|module-registry|report-bus)` paths in agent sources; refused requests produce zero runtime calls; the unknown key still reaches the runtime exactly once (its gates decide — never around them). *Test:* `AO-22`.

**AO-23 An undeclared capability cannot execute**
*Scenario:* (a) capability the module does not hold; (b) a genuine capability of another enabled module; (c) a genuine but unpairable capability.
*Pass criteria:* all three → `CAPABILITY_UNAVAILABLE`, `ok:false`, `execution: null`, reported; zero runtime calls. *Test:* `AO-23`.

**AO-24 An unavailable tool cannot become success**
*Scenario:* `TOOL_UNAVAILABLE` bus + pristine request; inspect the report.
*Pass criteria:* `TOOL_REQUIRED` / `REFUSED`, `execution: null`, zero runtime calls; report row renders `| hotkeys | agent.orchestrate | blocked |` (E-TOOL → blocked), never `| Status | COMPLETED |`; remaining issue `TOOL_REQUIRED: files: TOOL_UNAVAILABLE`. *Test:* `AO-24`.

**AO-25 A disabled module cannot execute**
*Scenario:* Registry with zero enabled modules; run the pristine request; inspect the report.
*Pass criteria:* `MODULE_DISABLED` / `REFUSED`, `plan: null`, `execution: null`, zero runtime calls; report shows `| Code | MODULE_DISABLED |` and `| Status | REFUSED |`, never `| Status | COMPLETED |`. *Test:* `AO-25`.

**AO-26 Determinism: identical requests against identical state produce identical results**
*Scenario:* Build the orchestrator twice over the same injected state; run a success and a refusal in pairs; scan report bytes.
*Pass criteria:* `deepStrictEqual(result1, result2)`; byte-identical report text and identical `sha256` (which equals `sha256(text)`) for both success and refusal; no timestamps, uuids, or machine paths anywhere in any report. *Test:* `AO-26`.

**Mutations AO-M1…AO-M10 (byte-different fixtures)**
Each fixture is asserted byte-different from the pristine `agent_request.json` before use (M10 additionally content-different from the pristine report input captured on a control run), then must fail closed with its exact code, status, stage, and a Core-class error; every refusal still carries its hash-valid report (except M10, where `report === null`), and no mutation may ever read as completion:

| Fixture | Exact mutation | Expected failure |
|---|---|---|
| `mut_agent_unknown_module.json` | `module: "ghost-module"` | `MODULE_NOT_FOUND` (E-INPUT, REFUSED @ RESOLVE) |
| `mut_agent_disabled_module.json` | `module: "tool-bus"` — registered, not enabled | `MODULE_DISABLED` (E-ENV, REFUSED @ RESOLVE) |
| `mut_agent_unknown_capability.json` | `capability: "ghost:capability"` | `CAPABILITY_UNAVAILABLE` (E-ENV, REFUSED @ RESOLVE) |
| `mut_agent_missing_tool.json` | `phase: "TEST"` + bus faulted `TOOL_UNAVAILABLE` | `TOOL_REQUIRED` (E-TOOL, REFUSED @ PREFLIGHT) |
| `mut_agent_blocked_tool.json` | `phase: "SHIP"` + bus faulted `TOOL_BLOCKED` | `TOOL_REQUIRED` (E-TOOL, REFUSED @ PREFLIGHT) |
| `mut_agent_dependency.json` | `target.command` + bus faulted `DEPENDENCY_MISSING` | `TOOL_REQUIRED` (E-TOOL, REFUSED @ PREFLIGHT) |
| `mut_agent_malformed.json` | `capability` field removed | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_agent_invalid_capability.json` | `capability: "not-a-capability"` | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_agent_execution_refusal.json` | `target.key: "GHOST"` (runtime refuses) | `EXECUTION_REFUSED` (E-INPUT, REFUSED @ EXECUTE, runtime called once) |
| `mut_agent_report_input.json` | corrupted completion input (`status: "kinda-done"`, missing row fields) fed through the real Report Bus | `REPORT_FAILED` (`report === null`, attempt `COMPLETED` preserved) |

**Task 10 release gate:** `node --test` = 167/167 pass (29 suites, 0 skipped,
exit 0); AO-01…AO-26 and AO-M1…M10 all covered by named executable tests;
10/10 mutations fail closed with byte-different fixtures asserted; two
identical builds produce byte-identical reports and equal sha256; Core
`01`–`04` byte-unchanged; `12` byte-unchanged; source 18/18; Task 05–09's
131 tests still pass; **no commit or push** — implementation/review cycle
per the Task 10 directive.

**Known limitations (Group O):** one operation kind only (`hotkey` →
`hotkeys:execute`); no planner, retry, loop, memory, or policy engine — a
single deterministic synchronous pass; the kind↔capability pairing is
code-fixed in `OPERATION_KINDS`; construction duck-types the four injected
contracts by public method name (deeper shape trust stays with each
service's own fail-closed behavior); the orchestrator translates but never
re-verifies upstream Tool Bus or Report Bus authority.

## Group P — Planner Tests (added Task 11; contract: `19-planner.md`)

Executable with `node --test` from the repo root. File:
`test/planner.test.mjs` (30 tests, 5 suites); together with Groups A–O's
167 the suite is **197 tests, 34 suites**. New L2 module:
`modules/planner/` (`manifest.yaml` — `id: planner`, `phases: [PLAN]`,
`provides: [planner:plan]`, `requires.tools: []`, `consumes:
[report-bus:build]`, entry `modules/planner/index.mjs`; `src/errors.mjs`
Core-class vocabulary, `src/request.mjs` strict request envelope with the
INVALID_REQUEST / PLAN_INCOMPLETE split, `src/planner.mjs` the five-stage
finite lifecycle). Groups A–O and the 167 prior tests are untouched and
still pass; Core `01`–`04`, `12`, and the 18 source files are unchanged.
This group makes the planning contract of `01` §3/§3.1/§3.2/§5 and `04` §2
executable: every request either produces the tier-exact plan document
answering the four questions — or is refused at VALIDATE with a named code,
and never composes a plan.

**PL-01 Entry point, manifest, configuration, result-code table (03 §2, 01 §13.5)**
*Scenario:* Import `modules/planner/index.mjs`; scan its import specifiers; register all six real manifests in a registry wired to the real Tool Bus; `validateAll()`; compare vocabularies; construct planners with missing/non-conforming Report Buses; walk `RESULT_CODES`/`LIFECYCLE_STAGES`/tier/question/depth/trigger/ledger vocabularies.
*Pass criteria:* every documented export exists; the entry imports only `./` files; all six manifests validate clean; planner `descriptor` = phases `[PLAN]`, `requires {tools: []}`, `provides [planner:plan]`, `consumes [report-bus:build]`, entry exact, declared errors = the four raisable classes ⊆ Core seven; every bad dependency throws `E_INPUT_INVALID_PLANNER_CONFIG`; exactly 4 result codes (one success, one `classified`) and the five lifecycle stages; tiers `[T0,T1,T2]`, questions `[files,order,verification,risks]`, depths `one-line/bullets/document`, three triggers, and the exact `01` §3.2 T0 ledger line. *Test:* `PL-01`.

**PL-02 A T0 task ships a one-sentence intent and no plan document (AC-10 A)**
*Scenario:* Run the T0 request ("Fix the typo in the README heading.").
*Pass criteria:* `ok:true`, `code: COMPLETED`, `stage: COMPLETE`; plan exactly `{tier T0, depth one-line, one change, verification [], risks [], review {required:false, trigger:null}}`; report ledger `PLAN: skipped (T0 — one-line intent)` verbatim; summary `| Tier | T0 |`, `| Depth | one-line |`, `| Status | COMPLETED |`; remaining issues declared empty; `sha256 == sha256(text)`. *Test:* `PL-02`.

**PL-03 A T1 task gets bullets answering all four questions (01 §5.1)**
*Scenario:* Run a T1 request with changes, verification, and risks.
*Pass criteria:* `depth: bullets`; changes/verification/risks echoed exactly; review `{required:false, trigger:null}`; ledger `PLAN: done (T1 — bullets)`; summary `| Depth | bullets |`. *Test:* `PL-03`.

**PL-04 A T2 task gets a written document with a risk list (AC-10 B)**
*Scenario:* Run the pristine T2 request; inspect plan and report.
*Pass criteria:* `depth: document`; change order exactly `[src/api/users.ts, test/users.test.mjs]`; verification length 2; risks ≥ 1 (AC-10); ledger `PLAN: done (T2 — document)`; evidence carries `review=required:intent-change`; `sha256 == sha256(text)`. *Test:* `PL-04`.

**PL-05 The §5.2 review gate is exact — trigger ⇒ required, none ⇒ no gate**
*Scenario:* Run the pristine T2 request once per trigger type, then without `trigger`.
*Pass criteria:* each trigger yields `review {required:true, trigger}` and evidence `review=required:<trigger>`; the triggerless run yields `{required:false, trigger:null}` and evidence `review=none` — no approval gate is invented. *Test:* `PL-05`.

**PL-06 The order question is the request's order — never re-sorted**
*Scenario:* A T1 request whose changes are deliberately unsorted (`zeta.mjs` before `alpha.mjs`).
*Pass criteria:* plan changes preserve exactly `[zeta.mjs, alpha.mjs]` — array order IS the order (01 §5.1 question 2). *Test:* `PL-06`.

**PL-07 Invalid envelopes fail closed at VALIDATE, before any plan exists**
*Scenario:* Twenty invalid requests (null, string, array, number, `{}`, envelope field `generated_at`, empty/multi-line/pipe tasks, numeric tier, non-array/malformed changes entries, bad paths with space and `..`, bad verification/risks types, empty strings, unknown trigger) through a reporting spy.
*Pass criteria:* each → `INVALID_REQUEST` / `REFUSED` / stage `VALIDATE`, E-INPUT, `plan: null`, report present, `validatePlanRequest` refuses the same input; exactly one report build per attempt (no hidden retries). *Test:* `PL-07`.

**PL-08 An unknown tier fails closed**
*Scenario:* `tier: "T3"`.
*Pass criteria:* `INVALID_REQUEST` at VALIDATE, detail `tier must be one of: T0, T1, T2`, `plan: null`, reported. *Test:* `PL-08`.

**PL-09 A T0 request carrying a plan document fails closed (over-planning)**
*Scenario:* The pristine T2 request re-tiered to `T0` (verification/risks/trigger kept).
*Pass criteria:* `PLAN_INCOMPLETE` / `REFUSED` at VALIDATE, E-VALID, detail names the one-sentence rule (01 §5.4), `plan: null`, report `| Code | PLAN_INCOMPLETE |`. *Test:* `PL-09`.

**PL-10 A T0 request planning more than one file fails closed (01 §3.1)**
*Scenario:* T0 with two changes and no document fields.
*Pass criteria:* `PLAN_INCOMPLETE`, detail `exactly one file`, `plan: null`. *Test:* `PL-10`.

**PL-11 A T1 plan missing a required question fails closed**
*Scenario:* T1 without `verification`; T1 without `risks`.
*Pass criteria:* both → `PLAN_INCOMPLETE` at VALIDATE with details naming question 3 and question 4; `plan: null`, reports present. *Test:* `PL-11`.

**PL-12 A T2 plan missing a required question fails closed (AC-10)**
*Scenario:* T2 without `risks`; T2 without `verification`; T2 with `risks: []`.
*Pass criteria:* each → `PLAN_INCOMPLETE` naming question 4 / question 3 / question 4 — an empty list answers nothing. *Test:* `PL-12`.

**PL-13 An approval trigger outside T2 fails closed (01 §5.2)**
*Scenario:* T0 with `trigger: "migration"`; T1 with `trigger: "architecture"`.
*Pass criteria:* both → `PLAN_INCOMPLETE`, detail `trigger requires tier T2`, `plan: null`. *Test:* `PL-13`.

**PL-14 A report failure propagates and never claims completion**
*Scenario:* A Report Bus whose `build` refuses (`DEPENDENCY_ERROR`); then the same bus with an earlier refusal.
*Pass criteria:* attempted plan → `REPORT_FAILED` / `stage: REPORT` / `report: null` (E-ENV from the bus), detail preserves `attempt COMPLETED`, composed plan attached; the early-refusal run also reports `REPORT_FAILED` — REPORT is terminal. *Test:* `PL-14`.

**PL-15 Planner → Report Bus — a real completion input, built by the real bus**
*Scenario:* Wrap `build` to capture inputs for a success and a refusal, then rebuild the captured input independently.
*Pass criteria:* `type: completion`, sections exactly `summary, results, phase-ledger, evidence, remaining-issues`; results row module `planner`, command `planner.plan`, status `success` (refusal: `failed` with one remaining issue); summary `Code/Phase` rows exact; the captured input is contract-valid on its own; final `sha256 == sha256(text)`. *Test:* `PL-15`.

**PL-16 The manifest honors the Module Registry contract (PLAN-only gate)**
*Scenario:* Register all six manifests, `validateAll()`, enable `planner`, resolve its capability, invoke at PLAN and at RUN.
*Pass criteria:* validation green; `resolveCapability(planner:plan) → planner`; `canInvoke(planner, {phase: PLAN, tools: []}) → MR_OK`; `phase: RUN` refuses `PHASE_NOT_DECLARED` (E-CONFLICT, detail `RUN not in [PLAN]`) — the planner cannot execute outside its declared phase. *Test:* `PL-16`.

**PL-17 The public surface is exactly plan(); sources honor the boundary**
*Scenario:* Assert the frozen surface; scan every planner source file for import specifiers and executor APIs; count report builds across one success and three refusals.
*Pass criteria:* surface exactly `plan`, object frozen; all imports `./`-only; no `child_process`/`eval`/`Function`/`require`/dynamic `import`, no handler/file access, no lateral `modules/` paths; exactly one `build` per attempt (4 attempts → 4 builds). *Test:* `PL-17`.

**PL-18 No fabricated completion — only a COMPLETED result reads as success**
*Scenario:* One success, four refusal shapes, one broken report bus; inspect every report.
*Pass criteria:* only the success report contains `| Status | COMPLETED |`; every refusal report contains `| Status | REFUSED |` and `plan: null`; the failed report emits nothing at all (`report: null`, `ok:false`). *Test:* `PL-18`.

**PL-19 Determinism: identical requests against identical state produce identical results**
*Scenario:* Build fresh planners twice over a success and a refusal; scan report bytes and planner sources.
*Pass criteria:* `deepStrictEqual(result1, result2)`; byte-identical report text and identical `sha256` (equal to `sha256(text)`); no timestamps, uuids, or machine paths in any report; no `Date.now`/`Math.random`/`process.pid`/`process.env` in any source. *Test:* `PL-19`.

**PL-20 The report always mirrors the result — code, status, stage, issue**
*Scenario:* Six attempts (success + five refusal shapes); compare each report's summary rows and remaining issue against the returned result.
*Pass criteria:* `| Code |`, `| Status |`, `| Stage |` always equal the result's own values; every refusal's remaining issues carry exactly `CODE: detail`; success declares none. *Test:* `PL-20`.

**Mutations PL-M1…PL-M10 (byte-different fixtures)**
Each fixture is asserted byte-different from the pristine `plan_request.json` before use (M10 additionally content-different from the pristine report input captured on a control run), then must fail closed with its exact code, status, stage, manifest-class error, `plan: null` (VALIDATE-stage), a present hash-valid report (M10: `report === null`), the validator itself refusing it, and no mutation may ever read as completion:

| Fixture | Exact mutation | Expected failure |
|---|---|---|
| `mut_plan_unknown_tier.json` | `tier: "T3"` | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_plan_extra_field.json` | envelope field `generated_at: "2026-10-05T12:00:00Z"` added | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_plan_t0_overplan.json` | full document (verification, risks, trigger, 2 changes) at `tier: "T0"` | `PLAN_INCOMPLETE` (E-VALID, REFUSED @ VALIDATE) |
| `mut_plan_missing_risks.json` | `risks` removed (T2) | `PLAN_INCOMPLETE` (question 4) |
| `mut_plan_missing_verification.json` | `verification` removed (T1) | `PLAN_INCOMPLETE` (question 3) |
| `mut_plan_trigger_t1.json` | `trigger: "migration"` kept at `tier: "T1"` | `PLAN_INCOMPLETE` (trigger requires T2) |
| `mut_plan_bad_path.json` | `file: "src/api/users file.ts"` (space) | `INVALID_REQUEST` (relative path rule) |
| `mut_plan_empty_changes.json` | `changes: []` | `PLAN_INCOMPLETE` (question 1) |
| `mut_plan_multiline_task.json` | newline inside `task` | `INVALID_REQUEST` (single-line rule) |
| `mut_plan_report_input.json` | corrupted completion input (`status: "kinda-done"`, missing row fields) fed through the real Report Bus | `REPORT_FAILED` (`report === null`, attempt `COMPLETED` preserved) |

**Task 11 release gate:** `node --test` = 197/197 pass (34 suites, 0
skipped, exit 0); PL-01…PL-20 and PL-M1…M10 all covered by named
executable tests; 10/10 mutations fail closed with byte-different fixtures
asserted; two identical builds produce byte-identical reports and equal
sha256; Core `01`–`04` byte-unchanged; `12` byte-unchanged; source 18/18;
Task 05–10's 167 tests still pass; **no commit or push** —
implementation/review cycle per the Task 11 directive.

**Known limitations (Group P):** the tier is asserted by the caller, not
computed (G5 classification is the Decision Rules' contract); `01` §5.3
"real files" is format-level only — the module touches no file system; the
planner is stateless (`01` §5.5 plan updates belong to a session runner);
§5.2's "shown to the user" is a computed `review.required` flag with no UI
to display it; the plan is not wired into the Agent Orchestrator (lateral
imports are forbidden — composition is a future task); one report type and
one capability exist, and `plan()` is synchronous.

## Group Q — Plan–Execution Composition Tests (added after Task 11; contract: `20-plan-execution-composition.md`)

Executable with `node --test` from the repo root. File:
`test/plan-execution.test.mjs` (31 tests, 5 suites); together with Groups A–P's
197 the suite is **228 tests, 39 suites**. New composition root:
`composition/plan-execution/` (`index.mjs` entry; `src/errors.mjs` Core-class
vocabulary, `src/bundle.mjs` the strict `{plan, execution}` envelope,
`src/composer.mjs` the seven-stage finite lifecycle — **no manifest**, the
composition root registers nothing). Groups A–P and the 197 prior tests are
untouched and still pass; Core `01`–`04`, `12`, the six module manifests, and
the 18 source files are unchanged. This group makes the composition deferred
by `19` §2/§4/§17/§18 executable: a bundle either flows plan → approval gate →
orchestration → report, or is refused at the first gate that fails — each
failure keeping the downstream contract's own code and class, never upgraded
to success.

**PE-01 Entry point, configuration, vocabularies, no new registry entry (02 §3, 01 §13.5)**
*Scenario:* Import `composition/plan-execution/index.mjs`; scan its import specifiers; list the directory; construct composers with missing/non-conforming `{planner, agent, reportBus}`; walk `RESULT_CODES`/`LIFECYCLE_STAGES`/`BUNDLE_FIELDS` and cross-check every shared code against the Planner's and the Agent's tables.
*Pass criteria:* every documented export exists; the entry imports only `./` files; the directory holds exactly `index.mjs` + `src` (no `manifest.yaml` — nothing new registers); every bad dependency throws `E_INPUT_INVALID_COMPOSITION_CONFIG`; exactly 14 result codes (one success, three classified: `REPORT_FAILED`, `EXECUTION_REFUSED`, `EXECUTION_FAILED`) with `APPROVAL_REQUIRED → E-INPUT`; every Planner/Agent code keeps its upstream class; all fixed classes ⊆ `COMPOSITION_ERROR_CLASSES` ⊆ Core seven; the seven lifecycle stages `RECEIVE, VALIDATE, PLAN, GATE, ORCHESTRATE, REPORT, COMPLETE`; `BUNDLE_FIELDS = [plan, execution]`. *Test:* `PE-01`.

**PE-02 Happy path — plan → gate → orchestrate → report → complete (01 §3, 04 §2 rows 4→5)**
*Scenario:* Run the pristine bundle through the real Planner, real Agent (real registry/runtime/Tool Bus), real Report Bus.
*Pass criteria:* `ok:true`, `code: COMPLETED`, `stage: COMPLETE`, `error: null`; plan artifact `{tier T2, depth document, 2 changes, review {required:false, trigger:null}}`; `planning` and `orchestration` both COMPLETED with `execution.executed: true`; three hash-valid reports (planner, composer, agent); the composer report shows `| Status | COMPLETED |`, the `plan-execution | plan-execution.execute | success` row, ledger lines `PLAN: done (planner → COMPLETED)`, `GATE: done (review not required)`, `ORCHESTRATE: done (agent → COMPLETED)`, summary Task/Tier/Depth/Execution rows, and the declared-empty issues line. *Test:* `PE-02`.

**PE-03 A planner refusal propagates; execution never runs**
*Scenario:* The pristine bundle with `plan.tier: "T3"`, through call-recording spies.
*Pass criteria:* `INVALID_REQUEST` / `REFUSED` at stage `PLAN`, E-INPUT, detail `tier must be one of…`; `planning` carries the planner's attempt and its report; `plan: null`; `orchestration: null`; the planner is called once and the agent **zero** times (no plan → no execution); the composer report shows `| Status | REFUSED |` and the issue `INVALID_REQUEST: tier must be one of…`. *Test:* `PE-03`.

**PE-04 An incomplete plan propagates as PLAN_INCOMPLETE (01 §5.1, AC-10)**
*Scenario:* The pristine bundle without `plan.risks`.
*Pass criteria:* `PLAN_INCOMPLETE` / `REFUSED` at `PLAN`, E-VALID; `planning.code === PLAN_INCOMPLETE`; no execution; report hash-valid. *Test:* `PE-04`.

**PE-05 The §5.2 approval gate refuses before any execution**
*Scenario:* The pristine bundle with `plan.trigger: "migration"`, through spies.
*Pass criteria:* `APPROVAL_REQUIRED` / `REFUSED` at `GATE`, E-INPUT, detail carries `(migration)` and the approval wording; the plan artifact is attached with `review {required:true, trigger:"migration"}`; the planner itself COMPLETED; the agent is called **zero** times; the composer report shows `| Stage | GATE |`, the issue line, and never `| Status | COMPLETED |`. *Test:* `PE-05`.

**PE-06 An invalid bundle fails closed before any attempt**
*Scenario:* Nine malformed bundles (null, string, array, `{}`, missing `plan`, missing `execution`, extra field `generated_at`, `plan: null`, `execution: null`) through spies; then the pristine bundle.
*Pass criteria:* each → `INVALID_REQUEST` / `REFUSED` at `VALIDATE`, E-INPUT, `planning`/`plan`/`orchestration` all null, **neither** downstream called, report present and hash-valid, `validateBundle` itself refuses; the pristine bundle passes the envelope (`validateBundle(REQ) === []`); `normalizeBundle(null) === null`. *Test:* `PE-06`.

**PE-07 Non-conforming downstream attempts fail closed (belts — 01 §13.5)**
*Scenario:* Six stub planner attempts (undefined; `ok:false` claiming `COMPLETED`; unknown code; completion without artifact; artifact without review state; completion without report) against a recording agent; five stub agent attempts (undefined; contradictory `ok`/`code`; completion without report; without execution; with `executed:false`) behind the real planner.
*Pass criteria:* planner belts → `PLAN_INCOMPLETE` (E-VALID) or `REPORT_FAILED` (E-VALID fallback) at `PLAN`, each with its named detail, `orchestration: null`, and the agent **never reached**; agent belts → `EXECUTION_REFUSED` (E-ENV fallback) or `REPORT_FAILED` (E-VALID) at `ORCHESTRATE`, each with its named detail; every composer report present and never `| Status | COMPLETED |`. *Test:* `PE-07`.

**PE-08 A malformed execution envelope propagates from the agent (18 §5)**
*Scenario:* Three execution envelopes: `capability` removed, `capability: "not-a-capability"`, `target` removed — after a successful plan.
*Pass criteria:* each → the agent's `INVALID_REQUEST` / `REFUSED` at composer stage `ORCHESTRATE`, E-INPUT; `planning.ok === true` with the plan artifact attached; `orchestration.code === INVALID_REQUEST`; report present; never `| Status | COMPLETED |`. *Test:* `PE-08`.

**PE-09 Downstream registry gates propagate (unknown, disabled, phase)**
*Scenario:* `module: ghost-module`; `module: tool-bus` (registered, not enabled); `phase: DEBUG` (not declared by hotkeys).
*Pass criteria:* `MODULE_NOT_FOUND` (E-INPUT) / `MODULE_DISABLED` (E-ENV) / `PHASE_NOT_DECLARED` (E-CONFLICT), all at `ORCHESTRATE` with `orchestration.stage: RESOLVE`; the plan artifact is preserved beside the refusal; the disabled case's report never carries the success row. *Test:* `PE-09`.

**PE-10 Capability and tool refusals propagate (unavailable, blocked, missing)**
*Scenario:* `capability: ghost:capability`; then a Tool Bus faulted `TOOL_UNAVAILABLE`, `TOOL_BLOCKED`, and `DEPENDENCY_MISSING`.
*Pass criteria:* `CAPABILITY_UNAVAILABLE` (E-ENV); each tool fault → `TOOL_REQUIRED` (E-TOOL) at `ORCHESTRATE` with detail `files: <code>` and `orchestration.stage: PREFLIGHT`; every result `ok:false` with a present report and no completion status. *Test:* `PE-10`.

**PE-11 A downstream runtime refusal propagates as EXECUTION_REFUSED**
*Scenario:* `target.key: "GHOST"` against the real runtime.
*Pass criteria:* `EXECUTION_REFUSED` / `REFUSED` at `ORCHESTRATE`, class E-INPUT (the runtime's, not invented), detail contains `E_INPUT_UNKNOWN_KEY`; `orchestration.execution.executed: false`; both downstream and composer reports present and hash-valid. *Test:* `PE-11`.

**PE-12 A downstream handler failure propagates as EXECUTION_FAILED**
*Scenario:* A runtime whose `grimoire.key.R` handler throws, behind a successful plan.
*Pass criteria:* `EXECUTION_FAILED` / `FAILED` at `ORCHESTRATE`, class E-UNKNOWN (classified from the runtime), detail contains `E_UNKNOWN_EXCEPTION`; ledger `ORCHESTRATE: failed (EXECUTION_FAILED)`; report never shows completion. *Test:* `PE-12`.

**PE-13 A composer report failure never claims completion**
*Scenario:* A refusing Report Bus injected for the composer only, on the pristine bundle, then on a planner-refusing bundle.
*Pass criteria:* `REPORT_FAILED` / `REPORT_FAILED` at `REPORT`, `report: null`, E-ENV from the bus, detail preserves `attempt COMPLETED` (and `attempt INVALID_REQUEST` for the early case — REPORT is terminal); plan, `planning`, and `orchestration` all preserved; ok false. *Test:* `PE-13`.

**PE-14 A planner report failure propagates through the plan stage**
*Scenario:* A refusing Report Bus injected for the planner only.
*Pass criteria:* `REPORT_FAILED` / `REPORT_FAILED` at composer stage `PLAN`, E-ENV, detail preserves `attempt COMPLETED`; `planning.report === null`; plan artifact preserved; `orchestration === null` (no plan report → no execution); the composer's own report exists and shows `| Stage | PLAN |` with the issue `REPORT_FAILED: attempt COMPLETED…`. *Test:* `PE-14`.

**PE-15 Wiring — one plan call, one run call, exact order, none on refusal (02 §3)**
*Scenario:* Record every downstream call for a success, a gated bundle, and an invalid bundle.
*Pass criteria:* success → exactly one `planner.plan(bundle.plan)` and one `agent.run(bundle.execution)`, receiving the two envelopes untouched; gated → plan once, run zero; invalid → plan zero, run zero (the composer never inverts PLAN → ORCHESTRATE). *Test:* `PE-15`.

**PE-16 Public surface is exactly execute(); sources honor the boundary**
*Scenario:* Assert the frozen surface; scan every source file for import specifiers and executor APIs; count composer report builds across one success and three refusals.
*Pass criteria:* surface exactly `execute`, object frozen; all imports `./`-only; no `child_process`/`eval`/`Function`/dynamic import, no handler or file access, no `modules/` paths, no direct `executeHotkey`/tool-check calls; ≥ 4 source files; exactly one composer build per attempt (4 attempts → 4 builds). *Test:* `PE-16`.

**PE-17 Composer → Report Bus — a real completion input, built by the real bus**
*Scenario:* Wrap `build` to capture inputs for a success and a refusal, then rebuild the captured input independently.
*Pass criteria:* `type: completion`; sections exactly `summary, results, phase-ledger, evidence, remaining-issues`; results row `module plan-execution`, `command plan-execution.execute`, `status success` (refusal: `failed` with exactly one remaining issue); summary `Code/Status/Stage` rows equal the result; the captured input is contract-valid on its own; final `sha256 == sha256(text)`. *Test:* `PE-17`.

**PE-18 No fabricated completion — only a COMPLETED result reads as success**
*Scenario:* One success, six refusal shapes, one broken composer bus, one planner report failure, one blocked tool.
*Pass criteria:* only the success report contains `| Status | COMPLETED |`; every refusal report contains `| Status | REFUSED |` and a present report; the failed report emits nothing (`report: null`, `ok:false`); composer success requires both downstream attempts to succeed. *Test:* `PE-18`.

**PE-19 Determinism: identical bundles against identical state produce identical results**
*Scenario:* Build fresh composers twice over a success and a refusal; scan report bytes and composer sources.
*Pass criteria:* `deepStrictEqual(result1, result2)`; byte-identical report text and identical `sha256` (equal to `sha256(text)`); no timestamps, uuids, or machine paths in any report; no `Date.now`/`Math.random`/`process.pid`/`process.env` in any source. *Test:* `PE-19`.

**PE-20 The report always mirrors the result — code, status, stage, issue**
*Scenario:* Six attempts (success + five refusal shapes); compare each report's summary rows and remaining issue against the returned result.
*Pass criteria:* `| Code |`, `| Status |`, `| Stage |` always equal the result's own values; every refusal's remaining issues carry exactly `CODE: detail`; success declares the empty list. *Test:* `PE-20`.

**PE-21 No bypass — every downstream non-success stays non-success**
*Scenario:* A nine-case matrix: incomplete plan, approval-gated plan, disabled module, unavailable capability, blocked/unavailable tools, missing dependency, runtime refusal, handler failure.
*Pass criteria:* every case `ok:false` with its exact code; `status` never `COMPLETED`; every composer report present and containing neither `| Status | COMPLETED |` nor the `plan-execution… success` row; no gate is ever skipped around. *Test:* `PE-21`.

**Mutations PE-M1…PE-M10 (byte-different fixtures)**
Each fixture is asserted byte-different from the pristine `composition_request.json` before use (M10 additionally content-different from the pristine report input captured on a successful control run), then must fail closed with its exact code, status, stage, manifest-class error, the exact downstream state that ran (planner/orchestration codes and plan-artifact presence), a present hash-valid composer report (M10: `report === null`), and **no mutation may ever read as completion**:

| Fixture | Exact mutation | Expected failure |
|---|---|---|
| `mut_composition_extra_field.json` | bundle field `generated_at` added | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE, no attempt ran) |
| `mut_composition_plan_unknown_tier.json` | `plan.tier: "T3"` | `INVALID_REQUEST` (E-INPUT, REFUSED @ PLAN, propagated) |
| `mut_composition_plan_missing_risks.json` | `risks` removed (T2) | `PLAN_INCOMPLETE` (E-VALID, REFUSED @ PLAN — question 4) |
| `mut_composition_plan_trigger.json` | `plan.trigger: "migration"` added | `APPROVAL_REQUIRED` (E-INPUT, REFUSED @ GATE, plan attached, no execution) |
| `mut_composition_execution_malformed.json` | `capability` removed from the execution envelope | `INVALID_REQUEST` (E-INPUT, REFUSED @ ORCHESTRATE, propagated) |
| `mut_composition_unknown_module.json` | `execution.module: "ghost-module"` | `MODULE_NOT_FOUND` (E-INPUT, REFUSED @ ORCHESTRATE) |
| `mut_composition_disabled_module.json` | `execution.module: "tool-bus"` (registered, not enabled) | `MODULE_DISABLED` (E-ENV, REFUSED @ ORCHESTRATE) |
| `mut_composition_unknown_capability.json` | `execution.capability: "ghost:capability"` | `CAPABILITY_UNAVAILABLE` (E-ENV, REFUSED @ ORCHESTRATE) |
| `mut_composition_execution_refusal.json` | `execution.target.key: "GHOST"` | `EXECUTION_REFUSED` (E-INPUT, REFUSED @ ORCHESTRATE, runtime called) |
| `mut_composition_report_input.json` | corrupted completion input (`status: "kinda-done"`, missing row fields) fed through the real Report Bus | `REPORT_FAILED` (`report === null`, attempt `COMPLETED` preserved) |

Every non-envelope mutation also asserts the bundle envelope is **valid** —
its own layer refuses it, each contract validating exactly once at its own
gate; only M1 fails `validateBundle` itself.

**Composition release gate:** `node --test` = 228/228 pass (39 suites, 0
skipped, exit 0); PE-01…PE-21 and PE-M1…M10 all covered by named executable
tests; 10/10 mutations fail closed with byte-different fixtures asserted; two
identical bundles produce byte-identical reports and equal sha256; Core `01`–`04`
byte-unchanged; `12` byte-unchanged; source 18/18; all six manifests unchanged
and still validating; Task 05–11's 197 tests still pass; **no commit or
push** — implementation/review cycle per the executive directive.

**Known limitations (Group Q):** the approval gate withholds execution but
cannot grant it — consuming `review.required` is the Task 12 Policy/Approval
engine named in `18`/`19`, which does not exist yet; plan content is not
translated into execution requests because no contract defines that mapping
(the `execution` sub-request is caller-supplied); the composer is stateless
and synchronous, classifies no tiers, and registers nothing; one bundle shape
and one report type exist by design for this milestone.

**Group Q addendum (CS-13 coordinated amendments — only where contradicted or
extended; every other Group Q expectation above stands unchanged):**

- **PE-01 (extended):** the entry additionally exports the CS-13 approval
  vocabulary — `planIdentity`, `executionIdentity`, `APPROVAL_VERDICT_FIELDS`
  (`23` §8.10, the entire new vocabulary); construction accepts the optional
  `approval` dependency, and a provided-but-non-conforming value throws
  `E_INPUT_INVALID_COMPOSITION_CONFIG` with the fixed detail
  `approval must expose verify()` (absent/`undefined` construct as before).
  14 result codes, 7 lifecycle stages, `BUNDLE_FIELDS`, and the no-manifest
  layout are unchanged.
- **PE-15 (extended):** the call-order/count probe gains the approval axis —
  `approval.verify` is **0** whenever `review.required === false` (or no
  component is injected) and **exactly 1** when a component is injected and
  the plan is gated, asserted with exact equality (never `≥`) in R-15;
  planner/agent counts and PLAN→ORCHESTRATE ordering are unchanged.
- **PE-16 (extended):** the source scan now also covers
  `composition/plan-execution/src/approval.mjs` (5 sources total: `index.mjs`
  + 4 `src/*.mjs`); every scan rule, the `./`-only import discipline, the
  frozen exactly-`execute` surface, and the one-build-per-attempt count are
  unchanged and still green.
- **Known-limitations note:** "the approval gate … cannot grant it" is
  superseded *only* for the injected path — the composer still never grants
  by itself; an affirmative, bound verdict from the composition-root-injected
  component is what crosses the GATE (`23` §1/§3). PE-05, PE-21, and M4 keep
  their written expectations for the uninjected path.

---

## Group R — Policy/Approval Tests (added Task 14; corrected Task 14R; contract: `23-policy-approval-contract.md`)

**Status: EXECUTABLE — RUN WITH CS-13 (landed).** These acceptance criteria are pinned
by the Task 14R correction gate against rulings `22-policy-approval-ruling-record.md`
(ED-01…ED-12, Change-Set CS-13). The executable file
`test/policy-approval.test.mjs` and the CS-13 GATE capability shipped **together as
one coordinated change** (CS-13 items 1/2/4b/5): R-01…R-15, the POS-1…POS-3 /
NEG-01…NEG-20 matrix, and the R-M fixtures are named executable tests — **41
tests, 5 suites, 0 skipped, all green** — so the suite is Groups A–Q's **228**
plus Group R's **41** = **269 tests, 44 suites, 0 failures, 0 skipped**
(`node --test test/*.test.mjs`). Task 14R corrections applied from the outset:
**R-10 rewritten (provenance)** and **R-15 strengthened (exact invocation
counts)**. One recorded conflict: R-07's thenable scenario ("verify returns a
Promise") is asserted per the authoritative contract §3 step 3 — a thenable is
not a plain object ⇒ **D1 `approval verdict malformed`** — which R-12 pins the
same way; the contract governs, and the conflict is recorded in the test file
header rather than hidden.

**R-01 Configuration and surface (CS-13 items 1–2; PE-01 conventions)**
*Scenario:* Construct composers without `approval`; with `approval: undefined`;
with `approval: null`; with `{}`; with `{verify: "no"}`; with a conforming
`{verify}` stub. Import the entry; scan exports, directory layout, and
vocabularies.
*Pass criteria:* absent key and `undefined` construct and behave
**byte-identically to today** (gated bundle ⇒ detail exactly `plan review is
required before execution (migration) — the approval gate belongs to the
policy/approval contract`); each provided-but-non-conforming value throws
`E_INPUT_INVALID_COMPOSITION_CONFIG` with detail exactly
`approval must expose verify()`; exports include `planIdentity`,
`executionIdentity`, `APPROVAL_VERDICT_FIELDS`; `BUNDLE_FIELDS` still exactly
`[plan, execution]`; exactly 14 result codes; seven lifecycle stages; no
`manifest.yaml`; layout otherwise unchanged. *Test:* `R-01`.

**R-02 Approval happy path — plan → approval → orchestrate → report (01 §5.2)**
*Scenario:* The pristine gated bundle (`plan.trigger: "migration"`) with an
injected stub component returning `{granted: true, plan: <planIdentity of the
exact gated plan>, execution: <executionIdentity of the exact gated
execution>}`, through the real Planner/Agent/Report Bus.
*Pass criteria:* `ok:true`, `COMPLETED` @ `COMPLETE`, `error: null`; counts
`planner 1 / approval.verify 1 / agent 1`; ledger line exactly
`GATE: done (approval verified)`; evidence, in order after
`plan.review.required → true (migration)`: `approval.verify(...) → affirmative`
then `approval.binding → verified`; three hash-valid reports; composer report
shows `| Status | COMPLETED |`. *Test:* `R-02`.

**R-03 Absent component = today's frozen refusal (20 §12 rule 6; PE-05/M4)**
*Scenario:* Gated bundle with no `approval` injected; triggerless bundle with
no `approval`; re-run the PE-05 and M4 expectations unchanged.
*Pass criteria:* gated ⇒ `APPROVAL_REQUIRED` / `REFUSED` @ `GATE`, E-INPUT,
detail byte-identical to the current composer string; approval count **0**;
agent count **0**; evidence and ledger byte-identical to today's output;
ungated ⇒ pass with `GATE: done (review not required)`; `PE-05`, `PE-21`, and
`M4` remain green with their existing expectations untouched. *Test:* `R-03`.

**R-04 Malformed-verdict matrix — well-formed is mechanically testable (contract §3)**
*Scenario:* An injected component returns each of: `null`, `undefined`, an
array, the string `"granted"`, `{granted:true}` (missing `plan`/`execution`),
`{granted:"true"…}`, `{granted:1…}`, `plan` with 63/65 chars / uppercase hex /
non-hex / non-string, a verdict with a fourth own property, an object whose
prototype is not `Object.prototype`/`null`, and a verdict whose property getter
throws.
*Pass criteria:* every case ⇒ detail exactly `approval verdict malformed`,
code/status/stage/class `APPROVAL_REQUIRED`/`REFUSED`/`GATE`/`E-INPUT`;
`approval.verify` count exactly 1; agent count **0**; report present; never
`| Status | COMPLETED |`. *Test:* `R-04`.

**R-05 Non-affirmative verdict and evaluation order (contract §3 steps 3→4)**
*Scenario:* `{granted:false, plan:<valid>, execution:<valid>}`; then
`granted:false` with deliberately wrong bindings.
*Pass criteria:* both ⇒ detail exactly `approval verdict not affirmative` —
D2 precedes D3, a non-affirmative verdict never reports a binding detail;
agent count 0; never completion. *Test:* `R-05`.

**R-06 Binding, canonicalizability, mutation (contract §3 step 6, §4.5; ED-04b/c)**
*Scenario:* (a) verdict bound to another plan's identity; (b) verdict bound to
another execution's identity; (c) plan changed by one byte after approval was
issued (identity differs ⇒ mismatch); (d) execution sub-request swapped for a
different valid envelope; (e) execution containing `NaN`, `undefined`, or a
cyclic reference; (f) a stub that mutates `execution` during `verify`.
*Pass criteria:* (a)–(d) ⇒ detail exactly `approval verdict binding mismatch`;
(e) ⇒ `approval binding input not canonicalizable`; (f) ⇒ `approval component
mutated its inputs` (pre-call identities recomputed and compared); all with
`approval.verify` count exactly 1, agent count **0**, never completion — the
mismatch rule of ED-04c, fail-closed. *Test:* `R-06`.

**R-07 Component throws — deterministic detail, no exception leakage (contract §3 step 2)**
*Scenario:* `verify` throws `new Error("boom-" + Date.now())`; `verify` throws
a string; `verify` returns a Promise (thenable ⇒ not a plain object).
*Pass criteria:* detail exactly `approval component threw` — no exception
message, stack, path, or timing appears in the result or report (byte-check:
report text contains none of the thrown content); count exactly 1; agent 0;
report present and hash-valid. *Test:* `R-07`.

**R-08 Fail-closed totality — every non-crossing path refuses (01 §13.5; PE-21 extended)**
*Scenario:* The union of all refusal shapes (D0–D6) alongside the existing
PE-21 nine-case matrix.
*Pass criteria:* every approval case `ok:false` with `APPROVAL_REQUIRED` @
`GATE`; `status` never `COMPLETED`; composer report always present and never
carries the completion row or the `plan-execution… success` row; no gate is
ever skipped around; cases with `review.required === false` are unaffected by
the approval layer (G0 and `05` Group B untouched — ED-10). *Test:* `R-08`.

**R-09 No self-approval — only the injected verdict reaches the decision (22 §6)**
*Scenario:* Source scans of `composition/plan-execution/index.mjs` + `src/*.mjs`
and of `modules/planner/**`, `modules/agent/**`; spies on planner and agent
outputs while feeding a gated bundle.
*Pass criteria:* the composer source contains no hardcoded grant path (no
literal verdict constructed inside the composer, no `granted: true` value
feeding GATE); planner and agent sources mint no approval; planner/agent
outputs are never read as verdicts — the verdict value is read solely from the
`approval.verify(...)` return; a plan artifact or orchestration result claiming
approval changes nothing (still refused); existing PE-16 scans (no `fs`, no
executors, no module paths) remain green. *Test:* `R-09`.

**R-10 Provenance model — injection authority, output, validation (contract §1; Blocker 1 correction)**
*Scenario:* (a) two *different* stub components return structurally identical
verdicts for the same gated bundle; (b) source scan of the whole approval path
for signature/MAC/credential/token/origin machinery (`createSign`,
`createVerify`, `createHmac`, `credential`, `bearer`, `token`, `sign(`,
`verify(` outside `approval.verify`); (c) a provided-but-malformed component
(construction belt) vs. a conforming component returning a malformed verdict
(run-time belt); (d) GATE reads: spy every property access the composer makes
on the verdict.
*Pass criteria:* (a) both runs produce `deepStrictEqual` results,
byte-identical reports and equal `sha256` — **no origin metadata is consulted,
and structurally identical verdicts are behaviorally indistinguishable**;
(b) **no cryptographic provenance exists anywhere**: the only digest use in
the path is the pre-approved SHA-256 identity of canonical artifact bytes
(FIPS 180-4, dependency-free — no `node:crypto` import in the composition
layer); no signature, MAC, token, credential, or origin field is issued,
compared, or stored; (c) the runtime performs exactly one boundary check (the
construction belt, R-01) and thereafter validates **only** the contractual
schema (§3) and binding rules (§4) — the test asserts the contract's explicit
non-claim: the runtime makes **no forged-object detection claim** and cannot
independently or cryptographically detect a forged object; (d) GATE reads
exactly the three own verdict properties and nothing else — authorization
authority is stated by contract to enter solely through the approved
composition-root injection boundary (`22` ED-01/ED-11), which the runtime can
verify only as interface conformance. *Test:* `R-10`.

**R-11 Canonicalization determinism — golden vectors V1–V3 (contract §4.3)**
*Scenario:* Compute identities for the three normative vectors (V1 plan with
jumbled input key order; V2 execution with keys out of order at both levels;
V3 escaping of `a"b\c<TAB>d`); build two fresh composers over identical inputs;
source-scan the identity/canonical code.
*Pass criteria:* digests exactly `e3e8f2a0ed54599f992ae07e24f59a3e98d5edc7495dc48feb515693303b5e68`
(V1), `25cf3de14674c0ffcbf047abff8a60a3fe4d425e12822d3f279a6333803088c4`
(V2), `16df91fa6f3838c35e50d271c89d6f56fc805305a2418d1d18ce4d67091f650b`
(V3); identity independent of object key-insertion order; arrays never
re-sorted (changes order preserved verbatim — the order question, `19 §13`);
no `Date.now`, `Math.random`, `process.pid`, `process.env`, locale, or
machine-path influence in the identity sources (PE-19/PL-19-style scan); no
`node:crypto`/`require(`/dynamic `import(` in the composition layer (PE-16
unchanged). *Test:* `R-11`.

**R-12 Verdict-schema mechanics — no coercion, own-properties only (contract §3)**
*Scenario:* Coercion probes: uppercase hex verdict; `granted: "true"`;
padded strings (`" true"`); a verdict inheriting `granted` from its prototype;
a `Promise` verdict; a verdict with an extra property alongside three valid
ones; a verdict missing exactly one property.
*Pass criteria:* all refused as `approval verdict malformed` — **no
lowercasing, no trimming, no type coercion, no inherited properties read**;
the exactly-three-fields rule holds in both directions (extra ⇒ malformed,
missing ⇒ malformed). *Test:* `R-12`.

**R-13 Report semantics — verdict recorded, never a fourth report (contract §6)**
*Scenario:* Capture the composer's completion input for an approval success and
for each refusal detail D0–D6; count report builds across all attempts.
*Pass criteria:* five-section shape unchanged; ledger/evidence strings exactly
as specified (approval pass and uninjected paths byte-distinct as ruled);
exactly one composer build per attempt; the approval component builds **no**
report (success still carries exactly three reports: planner, composer, agent);
every refusal report mirrors code/status/stage/issue (`APPROVAL_REQUIRED: <fixed
detail>`) and never shows completion. *Test:* `R-13`.

**R-14 End-to-end determinism — same bundle, same verdict, same bytes (22 §7)**
*Scenario:* Two fresh composers over one gated bundle with one stub verdict
(success) and one per refusal detail; source scans.
*Pass criteria:* `deepStrictEqual` results; byte-identical report text and
equal `sha256` per pair; no timestamps, uuids, or machine paths anywhere in
output; no time/randomness/PID/environment/hidden-state input in the approval
evaluation path. *Test:* `R-14`.

**R-15 Invocation counts — explicit observable invariants (contract §5; strengthened per Blocker 4)**
*Scenario:* Call-recording spies over the full count matrix: invalid bundle;
planner refusal; triggerless success with and without a component; gated
success; gated with each refusal D0, D1, D2, D3, D4, D5, D6; then two
consecutive `execute()` calls on the same composer.
*Pass criteria:* every count asserted with exact equality (never `≥`):
`approval.verify` **= 0 whenever `review.required === false`** (no
pre-consultation, no warm-up, no cached/fallback lookup — and = 0 when no
component exists to call); `approval.verify` **= exactly 1 whenever
`review.required === true` with a component injected — for every outcome
including throws; no retry, no fallback consultation, no hidden second
invocation, no call at VALIDATE/ORCHESTRATE/REPORT; `planner.plan` = 0 at
VALIDATE refusal, 1 otherwise; **`agent.run` = 0 on every refusal path and = 1
only after a successful GATE**; composer `reportBus.build` = 1 per attempt;
counts independent across consecutive `execute()` calls (no leaked state).
*Test:* `R-15`.

**Positive and negative case matrix (Task 14 formal acceptance set)**

The rows below are normative acceptance cases for the contract
(`23-policy-approval-contract.md` §5/§6). Every row states the five required
fields: INPUT · EXPECTED DECISION · EXPECTED ERROR · EXPECTED AGENT CALL
COUNT · EXPECTED REPORT BEHAVIOR. DECISION vocabulary: **CROSS** = GATE opens
and execution proceeds; **REFUSE** = the named refusal at the named stage.
Counts are per `execute()` call (contract §5); `APPROVAL_REQUIRED` rows are
code/status/stage/class `APPROVAL_REQUIRED`/`REFUSED`/`GATE`/`E-INPUT` with the
listed `detail` unless another code is named.

| # | INPUT | EXPECTED DECISION | EXPECTED ERROR | EXPECTED AGENT CALL COUNT | EXPECTED REPORT BEHAVIOR | R-ref |
|---|---|---|---|---|---|---|
| **POS-1** | Gated bundle + injected component + verdict `{granted:true, plan:<planIdentity>, execution:<executionIdentity>}` | **CROSS** | none — `error: null`, `COMPLETED` @ `COMPLETE` | 1 | three hash-valid reports; composer `\| Status \| COMPLETED \|`; ledger `GATE: done (approval verified)`; evidence `approval.verify(...) → affirmative`, `approval.binding → verified` | R-02 |
| **POS-2** | Triggerless bundle, component injected | **CROSS** (ungated) | none | 1 | byte-identical to today's success; ledger `GATE: done (review not required)`; **approval count 0** | R-03, R-15 |
| **POS-3** | Second consecutive `execute()` on the same composer: gated bundle + a fresh valid verdict | **CROSS** | none | 1 (per call; counts reset) | identical bytes and `sha256` as the first call — stateless, no carried verdict | R-14, R-15 |
| **NEG-01** missing approval component | Gated bundle, **no `approval` injected** | **REFUSE** (D0) | `APPROVAL_REQUIRED`; detail = today's exact string (`… belongs to the policy/approval contract`) | **0** | refusal report mirrors result; ledger `GATE: refused (APPROVAL_REQUIRED)`; evidence byte-identical to today; never completion (preservation case) | R-03 |
| **NEG-02** malformed verdict | Component returns `{granted:true, plan:<valid>}` (missing `execution`) | **REFUSE** (D1) | detail `approval verdict malformed` | 0 | refusal report; issue `APPROVAL_REQUIRED: approval verdict malformed`; never completion | R-04 |
| **NEG-03** non-affirmative verdict | `{granted:false, plan:<valid>, execution:<valid>}` | **REFUSE** (D2) | detail `approval verdict not affirmative` | 0 | refusal report; never completion (D2 precedes any binding detail) | R-05 |
| **NEG-04** approval throws | `verify` throws (any value) | **REFUSE** (D5) | detail `approval component threw` — thrown content never appears anywhere | 0 | refusal report; never completion | R-07 |
| **NEG-05** missing plan binding | Verdict without the `plan` field (also `plan:""`/wrong length) | **REFUSE** (D1) | detail `approval verdict malformed` | 0 | refusal report; never completion | R-04 |
| **NEG-06** incorrect plan digest | Verdict bound to a *different* plan's identity | **REFUSE** (D3) | detail `approval verdict binding mismatch` | 0 | refusal report; never completion | R-06 |
| **NEG-07** tampered plan | Plan content altered by one byte after approval was issued (recomputed identity differs) | **REFUSE** (D3) | detail `approval verdict binding mismatch` | 0 | refusal report; never completion — any content change forces re-approval | R-06, R-11 |
| **NEG-08** execution-sub-request mismatch | Valid verdict for plan; `execution` swapped for a different valid envelope | **REFUSE** (D3) | detail `approval verdict binding mismatch` | 0 | refusal report; never completion | R-06 |
| **NEG-09** forged approval object | Stub planner attaches a forged `approval` object as an extra field on the gated plan artifact; component injected with an otherwise valid verdict | **REFUSE** (D4) | detail `approval binding input not canonicalizable` — forged data is never read as an approval (unknown plan field) | 0 | refusal report; never completion | R-09, R-11 |
| **NEG-10** planner-generated approval | **No component**; stub planner returns a gated plan carrying an extra `approval:{granted:true,…}` field | **REFUSE** (D0) | detail = today's exact string | 0 | refusal report byte-identical to NEG-01; planner content never consulted as approval | R-09 |
| **NEG-11** agent-generated approval | **No component**; gated run where agent output *would* claim approval (agent not yet invoked at GATE) | **REFUSE** (D0) | detail = today's exact string | 0 | refusal report; agent never called — its output cannot reach GATE | R-09 |
| **NEG-12** composer-generated approval | Source scan: composer constructs no verdict internally (no literal grant path); gated bundle, no component | **REFUSE** (D0) | detail = today's exact string | 0 | refusal report; scan assertion proves no self-approval path exists | R-09, R-10 |
| **NEG-13** self-generated approval | Prebuilt verdict supplied outside the `verify()` channel (e.g. `approval:{verify, verdict}` config property) | **REFUSE** (D0) | detail = today's exact string — only the `verify()` **return value** is ever read | 0 | refusal report; out-of-channel data has no effect | R-09, R-10 |
| **NEG-14** repeated approval invocation | Component call-count spy over one gated success and one gated refusal | Per-verdict (CROSS or REFUSE) | none / the case's detail | `approval.verify` **exactly 1 — never 2**; agent 1 if CROSS, else 0 | exactly one composer report; no retry evidence line, no second GATE consultation | R-15 |
| **NEG-15** approval invoked when `review.required === false` | Triggerless bundle with component injected | **CROSS** (unchanged ungated pass) | none | **0** | report as today (`GATE: done (review not required)`) — component never consulted | R-15 |
| **NEG-16** nondeterministic result | Identical bundle + identical verdict evaluated twice on fresh composers (success and each refusal detail) | Identical DECISION both runs | Identical detail both runs | 1 per run | `deepStrictEqual` results; byte-identical report text; equal `sha256` | R-14, R-11 |
| **NEG-17** agent called after refusal | Any refusal shape D0–D6 through call-recording spies | **REFUSE** | The case's exact detail | **0** | refusal report present; `orchestration: null`; never completion | R-08, R-15 |
| **NEG-18** report after invalid gate transition | Refusal at GATE (attempted crossing without valid approval) | **REFUSE** | The case's exact detail | 0 | composer report mirrors `REFUSED` @ `GATE` with issue `APPROVAL_REQUIRED: <detail>`; approval component emits **no** report; no completion row, no success row | R-13, R-08 |
| **NEG-19** bypass attempt around GATE | Caller appends an `approval` member to the bundle envelope (C1-style bypass) | **REFUSE** at **VALIDATE** | `INVALID_REQUEST`, E-INPUT (strict envelope — approval is never envelope data) | 0 | refusal report @ `VALIDATE`; GATE never reached; no approval evidence line | R-01, PE-06 |
| **NEG-20** unauthorized change outside CS-13 | Repository diff vs protected pins (Core `01`–`04`/`12`, planner, agent, manifests, runtime) and vs CS-13's exhaustive file list | **PASS** iff changed files ⊆ CS-13; else test failure | none in runtime; assertion names the unauthorized file | 0 (static check — no `execute()`) | no report emitted (static/pin test, HKC-17 pattern) | R-09 scans + release gate |

**R-M mutation fixtures (specification — land atomically with CS-13; each
asserted byte-different from pristine `composition_request.json` before use;
fixture names are CONTRACT DETAIL, contract §8.14):**

| Fixture | Exact mutation | Expected failure |
|---|---|---|
| `mut_approval_bundle_extra_field.json` | bundle member `approval: {granted:true, plan:"…", execution:"…"}` added (envelope bypass attempt) | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE, no attempt ran — NEG-19) |
| `mut_approval_execution_swapped.json` | a second valid execution envelope substituted while the approval binds the original | `APPROVAL_REQUIRED` (E-INPUT, REFUSED @ GATE, detail `approval verdict binding mismatch`, agent 0 — NEG-08) |
| `mut_approval_report_input.json` | corrupted composer completion input (`status: "kinda-done"`) fed through the real Report Bus on an approval refusal | `REPORT_FAILED` (`report: null`, attempt refusal preserved — PE-M10 pattern) |

Every R-M fixture also asserts: `ok:false`, exact code/status/stage, a
Core-class error, agent count 0 where GATE refused, a present hash-valid
refusal report (except the REPORT_FAILED case: `report === null`), and **no
mutation may ever read as `\| Status \| COMPLETED \|`**.

**Group R release gate (CS-13 landed — status recorded with implementation):**

Executable `R-01…R-15`, the POS/NEG matrix (POS-1…POS-3, NEG-01…NEG-20), and
the R-M fixtures all green in `test/policy-approval.test.mjs` (plus its
approval fixtures); Groups A–Q still 228/228 with PE-05,
PE-21, and M4 untouched; Core `01`–`04` and `12` byte-unchanged; no manifest;
`node --test test/*.test.mjs` = **269 (228 + Group R 41)**, 0 failures, 0
skipped. The earlier staging-only "no commit or push" note recorded for Tasks
14/14R is superseded by the explicit Task 15 executive directive, which
authorizes committing and pushing this change-set only after every gate above
passes.
