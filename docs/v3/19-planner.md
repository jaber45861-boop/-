# Grimoire v3 — Planner Contract

**Status:** Added Task 11 (L2 Planner — the PLAN phase made executable)
**Scope:** The deterministic, fail-closed plan-production contract: strict request shape, tier-scaled plan depth, the four questions of `01` §5.1, the `01` §5.2 review gate, the finite lifecycle (RECEIVE → VALIDATE → PLAN → REPORT → COMPLETE), Report Bus integration, error/refusal semantics, determinism, security boundaries, testing contract (PL-01…PL-20, PL-M1…PL-M10), and the known limitations. Core `01`–`04`, `12`, and all 18 legacy source files are unchanged.

**Why this exists.** Through Task 10 the repository could *execute* a well-formed request safely, but nothing could *produce* the request's plan: `01` §5 defines planning behavior normatively (the four questions, tier-scaled depth, the T2 review gate) and `04` §2 routes work through the PLAN mode, yet no module made those rules executable. This module is that missing PLAN phase: it turns a strict plan request into the ordered change plan the Core demands — deterministic, tier-exact, fail-closed — and reports every attempt through the Report Bus. It orchestrates existing authority; it never executes, never builds, and never claims the task shipped (`01` §5.6).

---

## 1. Purpose

The Planner is the deterministic, fail-closed plan-production service of Grimoire v3. It answers: *given a strict request for a task's plan, what is the exact plan artifact for that tier, and what is the report either way?*

It validates the request against the Core planning contract (`01` §3/§3.1/§3.2/§5, `04` §2 G5 + mode-routing row 4), refuses anything that does not match, and composes the plan as the pure intersection of the request and the tier's rules. It must NOT invent behavior: no execution, no file-system probing, no tier guessing, no LLM calls, no plan repair (`01` §13.5 — fail closed, never guess).

## 2. Architectural position

```text
L1 Core Specifications (01–04, 12)
        ↓
L1 Services:  Module Registry · Tool Bus · Report Bus
        ↑ consumed by (public surface only)
L2 Modules:   hotkeys · tool-bus · module-registry · agent (Task 10)
              planner (Task 11, this document)  ← consumes ONLY report-bus:build
```

Operationally, one planning attempt flows:

```text
Plan request
→ Planner (RECEIVE → VALIDATE → PLAN)
→ Report Bus (REPORT — completion report for every terminal attempt)
→ COMPLETE → frozen {ok, code, status, stage, error, request, plan, report}
```

The planner sits beside the Agent Orchestrator, not above it: the orchestrator *runs* defined operations (Task 10), the planner *produces* the plan document (`01` §3: "the ordered list of changes and the verification strategy"). The two share no code path (lateral module imports are forbidden, `02` §3 rule 3); future composition belongs to a later task. The composition root injects `{reportBus}`; the module imports nothing but its own files.

## 3. Scope

Implemented under `modules/planner/` using the established `03` §2 module layout:

| File | Role |
|---|---|
| `modules/planner/manifest.yaml` | `id: planner`, `version: 1.0.0`, `core: ">=3.0 <4.0"`, `phases: [PLAN]`, `requires.tools: []`, `provides: [planner:plan]`, `consumes: [report-bus:build]`, `conflicts: []`, `outputs: [planner-plan-report]`, four `errors`, `entry: modules/planner/index.mjs` |
| `modules/planner/index.mjs` | Public entry: re-exports the contract only; imports nothing but `./` |
| `modules/planner/src/errors.mjs` | The single Core taxonomy (01 §11.1) built locally; the four raisable Planner classes |
| `modules/planner/src/request.mjs` | Request envelope: `TIERS`, `PLAN_QUESTIONS`, `DEPTH_BY_TIER`, `TRIGGER_TYPES`, `validatePlanRequest`, `normalizePlanRequest` |
| `modules/planner/src/planner.mjs` | `LIFECYCLE_STAGES`, `RESULT_CODES`, `PLAN_LEDGER_BY_TIER`, `createPlanner` — the finite lifecycle itself |

Public surface (entry exports): `createPlanner`, `RESULT_CODES`, `LIFECYCLE_STAGES`, `PLAN_LEDGER_BY_TIER`, `validatePlanRequest`, `normalizePlanRequest`, `TIERS`, `PLAN_QUESTIONS`, `DEPTH_BY_TIER`, `TRIGGER_TYPES`, `REQUEST_FIELDS`, `CHANGE_FIELDS`, `PLANNER_ERROR_CLASSES`, `CORE_ERROR_CLASSES`, `makeError`, `isCoreErrorClass`.

`createPlanner({reportBus})` returns a frozen object whose surface is exactly `{ plan(request) }`. The Report Bus is required; a missing/non-conforming one throws `E_INPUT_INVALID_PLANNER_CONFIG` at construction — no planner exists, therefore nothing can be planned (`01` §13.5).

Also added: `test/planner.test.mjs`, `test/_fixtures/plan_request.json` + ten `mut_plan_*.json` fixtures, this document, and Group P of `docs/v3/05-acceptance-tests.md`.

## 4. Non-goals

Task 11 does NOT provide and explicitly does not implement:

- execution of any kind — no runtime, handlers, tools, providers, or file access (the plan is an artifact, not a build; `01` §5.6)
- bridging the plan to the Agent Orchestrator (composition is a future task; no lateral imports)
- tier *classification* (G5 is the Decision Rules' gate; the caller asserts the tier and the planner enforces depth against it)
- LLM reasoning, autonomous retry/loops, self-modification, plan-updating across sessions (`01` §5.5 is runtime behavior over time)
- Task 12 Policy/Approval engine, persistent memory, UI, chat, scheduling, Git operations
- checking that referenced files exist (no file system — format-level `01` §5.3 only)

## 5. Request contract

The envelope is strict — exactly the declared fields, no extras anywhere:

```text
task          non-empty single-line string (no "|" — report-safe)
tier          T0 | T1 | T2
changes       array of exactly {file, why}:
                file  relative path shape (no spaces, "|", "." / ".." segments)
                why   non-empty single-line string (no "|")
              — array order IS the change order (§5.1 question 2)
verification  T1/T2: non-empty array of non-empty single-line strings; T0: forbidden
risks         T1/T2: non-empty array of non-empty single-line strings; T0: forbidden
trigger       T2 only, optional: intent-change | migration | architecture (01 §5.2)
```

Two refusal codes with a clean split:

- `INVALID_REQUEST` (E-INPUT) — envelope/type/format violations: the request cannot be trusted as data.
- `PLAN_INCOMPLETE` (E-VALID) — tier-depth violations: well-formed data whose plan would not answer the questions the tier demands (or would answer ones it must not).

Tier depth rules (`01` §5.4/§3.1/§5.2, AC-10):

| Tier | Required | Forbidden | Plan depth |
|---|---|---|---|
| T0 | exactly 1 change (single file) | verification, risks, trigger | `one-line` (skip ledger `PLAN: skipped (T0 — one-line intent)`) |
| T1 | all four questions non-empty | trigger | `bullets` |
| T2 | all four questions non-empty (risk list mandatory, AC-10) | — | `document` (+ review gate when a trigger is present) |

`validatePlanRequest` returns ALL violations in fixed order (envelope → task → tier → changes → verification → risks → trigger → tier-depth rules); the first violation names the refusal. `normalizePlanRequest` is a sanitized display echo only and never decides acceptance.

## 6. Lifecycle

Finite-state, single pass, no loops:

```text
RECEIVE
  ↓
VALIDATE   ──X→ REFUSED   (INVALID_REQUEST · PLAN_INCOMPLETE)
  ↓
PLAN       (pure composition of validated input — cannot fail)
  ↓
REPORT     ──X→ REPORT_FAILED
  ↓
COMPLETE
```

Contract shape per attempt:

```text
request → validated request → composed plan → report
```

`plan` exists only past VALIDATE; a report is attempted for every terminal attempt (success or refusal) and attached unless the report step itself refuses. `status` vocabulary: `COMPLETED` (only with `code: COMPLETED`), `REFUSED`, `REPORT_FAILED`.

## 7. Module Registry integration

The planner consumes no registry capability at runtime (`consumes: [report-bus:build]` only). It *fits* the registry contract: its manifest registers and validates with the other five (`validateAll` green), `resolveCapability("planner:plan")` resolves to `planner` when enabled, and the INVOKE gate holds it to its declared phase — `canInvoke(planner, {phase: "PLAN", tools: []})` → `MR_OK`, while `phase: "RUN"` refuses `PHASE_NOT_DECLARED` (E-CONFLICT). This is proven in test wiring (PL-16); the module itself never imports the registry (`02` §3 rule 3).

## 8. Tool Bus integration

None — `requires.tools: []` and no tool is ever checked or fabricated. There is no capability whose availability could be guessed; the plan artifact requires no external effect.

## 9. Hotkey Runtime integration

None — the planner executes nothing and never calls handlers, the runtime, or any provider. Producing a plan is not building (`01` §5.6): a `COMPLETED` planner result means the PLAN phase produced its artifact, never that the task shipped.

## 10. Report Bus integration

Every terminal attempt builds one `completion` input for the injected Report Bus (`reportBus.build`), with exactly five sections: `summary` (Module, Capability, Task, Tier, Depth, Phase=PLAN, Code, Status, Stage), `results` (one row: `module: planner`, `command: planner.plan`, `status: success | blocked | failed`, phase-ledger, evidence, remaining issues, assumptions `[]`), `phase-ledger`, `evidence`, `remaining-issues`.

The report makes the required facts determinable: request echo (summary), the composed plan's shape (Depth + the `plan(tier=…, depth=…, changes=…, verification=…, risks=…, review=…)` evidence line), validation outcome (ledger `VALIDATE: refused/ done`), refusal reason (remaining issues `CODE: detail`), and final status (Code/Status/Stage rows).

If `build` refuses, the attempt upgrades to `REPORT_FAILED`, `report: null`, with the underlying attempt preserved (`attempt <CODE>: <bus code>: <bus detail>`) — **no valid report → no successful completion**. A report failure also wins over an earlier refusal: REPORT is terminal.

Exactly one build is attempted per `plan()` call (PL-17) — no hidden retry, no second report surface.

## 11. Error/refusal semantics

One taxonomy only — `01` §11.1 Core classes; no second taxonomy. `RESULT_CODES` (exactly four):

| Code | Class | Stage | Status |
|---|---|---|---|
| `COMPLETED` | — (success) | COMPLETE | COMPLETED |
| `INVALID_REQUEST` | E-INPUT | VALIDATE | REFUSED |
| `PLAN_INCOMPLETE` | E-VALID | VALIDATE | REFUSED |
| `REPORT_FAILED` | classified* | REPORT | REPORT_FAILED |

\* propagated from the Report Bus's refusal (always a Core class; fallback `E-VALID` if an injected contract omits one). The manifest declares exactly the four raisable classes: `E-INPUT`, `E-ENV`, `E-CONFLICT`, `E-VALID` (no `E-DEP` — no external service; no `E-TOOL` — no tools; no `E-UNKNOWN` — every refusal here is a named contract rule).

Every result carries a structured `error` `{class, code, message, detail}` (never a string, never a stack) — or `null` for `COMPLETED`.

## 12. Fail-closed rules

1. Unexpected envelope field → refuse (`generated_at`, any extra key) — PL-07/M2.
2. Unknown/invalid tier → refuse — PL-08/M1.
3. Malformed task (empty, multi-line, `"|"`) → refuse — PL-07/M9.
4. Malformed change entries (wrong shape, extra field, non-path file) → refuse — PL-07/M7.
5. T0 carrying a document (verification/risks/trigger) → refuse (no over-planning, AC-10 A) — PL-09/M3.
6. T0 with ≠ 1 file → refuse (`01` §3.1) — PL-10.
7. T1/T2 missing any of the four questions → refuse (`01` §5.1, AC-10 B) — PL-11/12/M4/M5/M8.
8. Trigger outside T2 → refuse (`01` §5.2) — PL-13/M6.
9. Report failure → `REPORT_FAILED`, no report artifact, never `COMPLETED` — PL-14/M10.
10. A refusal never composes a plan (`plan === null` at VALIDATE) — PL-18.
11. The report always mirrors the result (code/status/stage/issue identical) — PL-20.
12. No execution surface exists at all (source scan: no executors, no `fs`, no lateral paths) — PL-17.
13. No mutation of registries or Core documents; no Core modification (pins verified outside the suite).

## 13. Determinism

Same request + same injected state ⇒ same resolution, same lifecycle result, same report bytes, same report hash (PL-19 builds twice and asserts `deepStrictEqual`, byte-identical text, and equal `sha256` — for a success and for a refusal).

Mechanisms: fixed stage order; fixed plan key order (`tier, depth, task, changes, verification, risks, review`); fixed evidence/ledger append order; fixed summary/row shapes; array order preserved verbatim for the order question (PL-06); no `Date.now`, `Math.random`, pids, `process.env`, machine paths, or unordered iteration affecting output (source-scanned in PL-19). Report `sha256` covers the exact rendered bytes.

## 14. Security boundaries

- **Entry purity:** `modules/planner/index.mjs` and `src/*.mjs` import only `./` specifiers — no `node:` builtins, no lateral module paths, no `fs`, no `child_process`, no `eval`/`Function`/dynamic `require` (PL-17 source scan).
- **Surface:** the planner object is frozen and exposes exactly `plan`; one Report Bus build per attempt.
- **Report safety:** every report-bound string is single-line and pipe-free by validation (a request cannot corrupt a report row).
- **Authority:** reports only through `build`; the planner reads/writes nothing else — it has no side effects of any kind.
- **Core protection:** `01`–`04` and `12` are byte-pinned; the 18 legacy files remain 18/18 (HKC-17). Task 11 changed none of them — no Core contradiction was found, so no Core edit was needed.

## 15. Tests

`test/planner.test.mjs` — 30 tests, 5 suites; IDs map one-to-one to named tests (Group P):

| ID | Named test |
|---|---|
| PL-01 | entry point, manifest, configuration, and result-code table |
| PL-02 | a T0 task ships a one-sentence intent and no plan document (AC-10 A) |
| PL-03 | a T1 task gets bullets answering all four questions (01 §5.1) |
| PL-04 | a T2 task gets a written document with a risk list (AC-10 B) |
| PL-05 | the §5.2 review gate is exact — trigger ⇒ required, none ⇒ no gate |
| PL-06 | the order question is the request's order — never re-sorted |
| PL-07 | invalid envelopes fail closed at VALIDATE, before any plan exists |
| PL-08 | an unknown tier fails closed |
| PL-09 | a T0 request carrying a plan document fails closed (over-planning) |
| PL-10 | a T0 request planning more than one file fails closed (01 §3.1) |
| PL-11 | a T1 plan missing a required question fails closed |
| PL-12 | a T2 plan missing a required question fails closed (AC-10) |
| PL-13 | an approval trigger outside T2 fails closed (01 §5.2) |
| PL-14 | a report failure propagates and never claims completion |
| PL-15 | Planner → Report Bus — a real completion input, built by the real bus |
| PL-16 | the manifest honors the Module Registry contract (PLAN-only gate) |
| PL-17 | the public surface is exactly plan(); sources honor the boundary |
| PL-18 | no fabricated completion — only a COMPLETED result reads as success |
| PL-19 | identical requests against identical state produce identical results |
| PL-20 | the report always mirrors the result — code, status, stage, issue |

Coverage buckets: happy path/AC-10 (PL-02…06), fail-closed (PL-07…14), integration (PL-15…17), security + determinism (PL-18…20).

## 16. Mutation tests

Ten byte-different fixtures under `test/_fixtures/`, each asserted `fixture !== pristine` before use (PL-M1…M9 against `plan_request.json`; PL-M10 additionally content-different from the pristine report input captured on a control run):

| Fixture | Mutation | Expected fail-closed result |
|---|---|---|
| `mut_plan_unknown_tier.json` | `tier: "T3"` | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_plan_extra_field.json` | envelope field `generated_at` added | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_plan_t0_overplan.json` | full document at `tier: "T0"` | `PLAN_INCOMPLETE` (E-VALID, REFUSED @ VALIDATE) |
| `mut_plan_missing_risks.json` | `risks` removed (T2) | `PLAN_INCOMPLETE` (question 4) |
| `mut_plan_missing_verification.json` | `verification` removed (T1) | `PLAN_INCOMPLETE` (question 3) |
| `mut_plan_trigger_t1.json` | `trigger` kept at `tier: "T1"` | `PLAN_INCOMPLETE` (trigger requires T2) |
| `mut_plan_bad_path.json` | `file: "src/api/users file.ts"` (space) | `INVALID_REQUEST` (relative path rule) |
| `mut_plan_empty_changes.json` | `changes: []` | `PLAN_INCOMPLETE` (question 1) |
| `mut_plan_multiline_task.json` | newline inside `task` | `INVALID_REQUEST` (single-line rule) |
| `mut_plan_report_input.json` | corrupted completion input (`status: "kinda-done"`, missing row fields) fed through the real Report Bus | `REPORT_FAILED` (report `null`, attempt preserved) |

Every mutation also asserts: `ok === false`, exact `code`/`status`/`stage`, a Core-class error in the manifest's set, `plan === null` (VALIDATE-stage mutations), a present and hash-valid report (except M10, where `report === null`), the validator itself refusing the fixture, and **no mutation may ever read as `| Status | COMPLETED |`**.

## 17. Known limitations

- The tier is **asserted by the caller, not computed**: G5 classification (`04` §2) is the Decision Rules' gate, a different contract. The planner enforces depth against the asserted tier and refuses everything out of tier.
- `01` §5.3 "real files" is enforced at **format level** (relative path shape, no `..`, no spaces/pipes) — existence is not checked because the module touches no file system (`02` §3 boundary).
- The planner is **stateless**: `01` §5.5 (plan updated when it changes during BUILD) is time-dependent behavior that belongs to a session runner, not this contract.
- `01` §5.2's "shown to the user" is modeled as a computed `review.required`/`trigger` flag — there is no UI surface to display it (flag consumption is a future task).
- The plan is not wired into the Agent Orchestrator (no lateral imports); composition is a future task.
- One report type (`completion`), one capability (`planner:plan`), synchronous `plan()` — by design for this milestone.

## 18. Future Agent layers

Belonging to later tasks, explicitly NOT provided here: feeding `result.plan` into the Task 10 orchestrator as execution requests, Task 12 Policy/Approval engine (acting on `review.required`), session-level plan updating (`01` §5.5), tier classification (G5 automation), LLM-assisted planning, memory. This document defines the PLAN contract that makes those safe: *no valid request → no plan; no valid report → no successful completion; a plan is never a build.*

## 19. Acceptance mapping

| Specification source | Where satisfied |
|---|---|
| `01` §3 PLAN phase (ordered changes + verification strategy) | §5 request `changes`/`verification`; PL-03/04 |
| `01` §3.1 tiers (T0 single file / T1 bullets / T2 document) | §5 depth table; PL-02/03/04/10 |
| `01` §3.2 skip ledger `PLAN: skipped (T0 — one-line intent)` | `PLAN_LEDGER_BY_TIER`; PL-02 |
| `01` §5.1 four questions | `PLAN_QUESTIONS`; PL-03/04, PL-11/12, M4/M5/M8 |
| `01` §5.2 T2 review gate | `TRIGGER_TYPES` + `plan.review`; PL-05/13, M6 |
| `01` §5.3 real files/commands | path/command format rules; PL-07, M7 |
| `01` §5.4 no ceremony | T0 forbidden fields; PL-09, M3 |
| `01` §5.6 plan ≠ build | §9/§14 boundaries; PL-18 |
| `04` §2 G5 + mode-routing row 4 (PLAN entry/exit) | §2/§5 of this document; PL-01 (phases `[PLAN]`), PL-16 |
| AC-10 [R] (T0 one-liner, T2 document with all four + risk list) | PL-02, PL-04, M3/M4 |
| `02` §3 dependency rules | §7/§14; PL-17 source scan |
| `03` §2 manifest contract | §3 manifest row; PL-01 (six manifests validate) |
| Task 11 directive (strict request, fail-closed, deterministic, no commit) | §5/§11/§12/§13; PL-07…20, M1…M10; Group P release gate |
