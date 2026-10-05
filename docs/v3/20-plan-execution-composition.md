# Grimoire v3 — Plan–Execution Composition Contract

**Status:** Added after Task 11 (the Planner ↔ Agent Orchestrator composition explicitly deferred by `19` §2/§4/§17/§18 and Group P's known limitations)
**Scope:** The composition-root contract between the two existing L2 entries: the strict `{plan, execution}` bundle, the seven-stage finite lifecycle (RECEIVE → VALIDATE → PLAN → GATE → ORCHESTRATE → REPORT → COMPLETE), the `01` §5.2 approval gate, propagation of the Planner's and the Agent's result vocabularies with their own classes, Report Bus integration for every terminal attempt, error/refusal semantics, fail-closed rules, determinism, security boundaries, testing contract (PE-01…PE-21, PE-M1…PE-M10), and the known limitations. Core `01`–`04`, `12`, all six module manifests, and all 18 legacy source files are unchanged.

**Why this exists.** Through Task 11 the repository could both *produce* a plan (Planner, `19`) and *execute* a request (Agent Orchestrator, `18`) — but the two shared no code path: `19` §2 says "future composition belongs to a later task", §4 and §17 say "the plan is not wired into the Agent Orchestrator (no lateral imports)", and §18 names the missing piece ("feeding `result.plan` into the Task 10 orchestrator as execution requests"). Both contracts also name the only place where such wiring is legal: **the composition root** (`18` §2 and `19` §2 — "the composition root injects …"; `02` §3 rule 3 forbids lateral module-to-module imports). This layer *is* that composition root: it makes the Planner usable by callers of the Agent Orchestrator's contract — one bundle flows PLAN → GATE → ORCHESTRATE, a plan gates the execution it precedes (`01` §3, `04` §2 rows 4→5), and every stage fails closed. It orchestrates existing authority; it never becomes a second source of truth, never redesigns either module, and registers nothing.

---

## 1. Purpose

The Plan–Execution composer is the deterministic, fail-closed composition root of Grimoire v3. It answers: *given a plan request and an execution request as one bundle, does the plan pass its contract and the approval gate, and does the orchestration then run — and what is the report either way?*

It validates the bundle envelope, delegates each sub-request to the layer that owns its contract (the Planner for `plan`, the Agent for `execution`), enforces the `01` §5.2 review gate between them, and reports every terminal attempt through the Report Bus. It must NOT invent behavior: no plan→request translation the contracts do not define, no approval granting, no execution around a gate, no retry, no LLM calls, no second taxonomy (`01` §13.5 — fail closed, never guess).

## 2. Architectural position

```text
L1 Core Specifications (01–04, 12)
        ↓
L1 Services:  Module Registry · Tool Bus · Report Bus
        ↑ consumed by (public surface only)
L2 Modules:   agent (Task 10)  ·  planner (Task 11)
        ↑ both injected into
Composition root (this document): composition/plan-execution/
        ↑ consumes ONLY {planner.plan, agent.run, reportBus.build}
```

Operationally, one bundle flows:

```text
Bundle {plan, execution}
→ Composer (RECEIVE → VALIDATE)
→ Planner            (PLAN    — planner.plan; its own report attaches)
→ Approval gate      (GATE    — 01 §5.2 review.required must be false)
→ Agent Orchestrator (ORCHESTRATE — agent.run; its own report attaches)
→ Report Bus         (REPORT  — the composer's completion report)
→ COMPLETE → frozen {ok, code, status, stage, error, request, plan,
                     planning, orchestration, report}
```

The composer sits **above** both L2 entries and imports none of them: the composition root injects `{planner, agent, reportBus}` at construction. The planner and the agent stay where `02` §3 rule 3 put them — laterally unreachable, independently testable, unchanged (`composition/plan-execution/` imports only `./` files and carries **no manifest**: composition is wiring, not a registered capability).

## 3. Scope

Implemented under `composition/plan-execution/`:

| File | Role |
|---|---|
| `composition/plan-execution/index.mjs` | Public entry: re-exports the contract only; imports nothing but `./` |
| `composition/plan-execution/src/errors.mjs` | The single Core taxonomy (01 §11.1) built locally; the six propagatable/raisable classes |
| `composition/plan-execution/src/bundle.mjs` | Bundle envelope: `BUNDLE_FIELDS`, `validateBundle`, `normalizeBundle` |
| `composition/plan-execution/src/composer.mjs` | `LIFECYCLE_STAGES`, `RESULT_CODES`, `createPlanExecutionComposer` — the finite lifecycle itself |

Public surface (entry exports): `createPlanExecutionComposer`, `LIFECYCLE_STAGES`, `RESULT_CODES`, `validateBundle`, `normalizeBundle`, `BUNDLE_FIELDS`, `COMPOSITION_ERROR_CLASSES`, `CORE_ERROR_CLASSES`, `makeError`, `isCoreErrorClass`.

`createPlanExecutionComposer({planner, agent, reportBus})` returns a frozen object whose surface is exactly `{ execute(bundle) }`. All three dependencies are required and duck-typed on the one method each owns (`plan`, `run`, `build`); a missing/non-conforming one throws `E_INPUT_INVALID_COMPOSITION_CONFIG` at construction — no composer exists, therefore nothing is composed (`01` §13.5).

Also added: `test/plan-execution.test.mjs`, `test/_fixtures/composition_request.json` + ten `mut_composition_*.json` fixtures, this document, and Group Q of `docs/v3/05-acceptance-tests.md`.

## 4. Non-goals

This milestone does NOT provide and explicitly does not implement:

- the **Task 12 Policy/Approval engine** named in `18` §4/§18 and `19` §4/§18 — consuming `review.required` (granting an approval) is that contract's job; this layer only *withholds* execution while the gate stands
- **translating plan content into execution requests**: neither `18` nor `19` defines a plan→`{kind, module, capability, phase, target}` mapping, so the execution sub-request is supplied by the caller alongside the plan; inventing a mapping would fabricate capability (`01` §13.5)
- redesign of the Planner or the Agent, memory, retry/loops, persistence, an LLM, UI, scheduling, Git operations
- a new capability, a new manifest, a registry declaration, a new tool, or a new report type
- tier classification (G5), session-level plan updating (`01` §5.5), or checking that referenced files exist (no file system)

## 5. Bundle contract

The envelope is strict — exactly the declared fields, no extras anywhere:

```text
bundle     plain object, exactly:
  plan       plain object  (the Planner's request — content owned by 19 §5)
  execution  plain object  (the Agent's request — content owned by 18 §5)
```

Two refusal levels, each validated exactly once, at the layer that owns it:

- **Bundle envelope** (this layer): a non-object bundle, an extra field, or a missing/non-object member → `INVALID_REQUEST` at VALIDATE, before *any* downstream attempt runs.
- **Sub-envelope content**: the plan request is validated only by `validatePlanRequest` (inside `planner.plan`), the execution request only by `validateRequest` (inside `agent.run`). The composer never re-validates and never repairs them — each contract holds at its own gate.

`normalizeBundle` is a sanitized structural echo only (presence of the two members) and never decides acceptance; display strings in this layer's report come from each sub-attempt's own normalized echo (`planner`/`agent` `result.request`), never raw input.

## 6. Lifecycle

Finite-state, single pass, no loops:

```text
RECEIVE
  ↓
VALIDATE   ──X→ REFUSED   (INVALID_REQUEST — bundle envelope)
  ↓
PLAN       ──X→ REFUSED/REPORT_FAILED  (INVALID_REQUEST · PLAN_INCOMPLETE
             · REPORT_FAILED — propagated from the planner, plus the
             plan-artifact belts)
  ↓
GATE       ──X→ REFUSED   (APPROVAL_REQUIRED — 01 §5.2 review gate)
  ↓
ORCHESTRATE ─X→ REFUSED/FAILED  (the agent's twelve codes, propagated)
  ↓
REPORT     ──X→ REPORT_FAILED
  ↓
COMPLETE
```

Contract shape per attempt:

```text
bundle → validated envelope → planner attempt → plan artifact + gate
       → agent attempt → composer report
```

- `planning` (the planner's full result) exists only past PLAN; `plan` (the artifact) exists only when the planner's attempt carried one; `orchestration` (the agent's full result) exists only past ORCHESTRATE; `report` (the composer's own report) exists for every terminal attempt except when the report step itself refuses.
- `stage` is **the composer's own stage where the terminal state occurred**; the underlying attempt's stage lives inside `planning.stage` / `orchestration.stage` (e.g. a planner report failure surfaces as code `REPORT_FAILED` at composer stage `PLAN`).
- `status` vocabulary: `COMPLETED` (only with `code: COMPLETED`), `REFUSED`, `FAILED` (orchestration failure), `REPORT_FAILED`.

## 7. Module Registry integration

None directly. The composer registers nothing, resolves nothing, and never touches the registry: it consumes `planner.plan` and `agent.run`, and the registry gates remain exactly where Task 08/10 put them — inside the agent's RESOLVE stage. Because composition adds no manifest, `validateAll()` still sees the same six modules (PE-01 asserts the directory carries no `manifest.yaml`).

## 8. Tool Bus integration

None directly — the composer checks no tool. Tool availability stays the Tool Bus's authority inside the agent's PREFLIGHT stage; a tool refusal surfaces here as the propagated `TOOL_REQUIRED` (E-TOOL) at ORCHESTRATE (PE-10).

## 9. Hotkey Runtime integration

None directly — the composer never executes anything. The runtime remains the agent's only handler path; a runtime refusal surfaces as propagated `EXECUTION_REFUSED`, a handler exception as propagated `EXECUTION_FAILED` (PE-11/PE-12).

## 10. Report Bus integration

Every terminal attempt builds one `completion` input for the injected Report Bus (`reportBus.build`), with exactly five sections: `summary` (Module=plan-execution, Task, Tier, Depth, Execution, Code, Status, Stage), `results` (one row: `module: plan-execution`, `command: plan-execution.execute`, `status: success | blocked | failed`, phase-ledger, empty artifacts, evidence, remaining issues, assumptions `[]`), `phase-ledger`, `evidence`, `remaining-issues`.

A successful bundle therefore carries **three** reports — the planner's attempt, the composer's attempt, and the agent's attempt — each hash-valid over its own bytes; a refusal carries at least the composer's report plus whichever downstream attempt ran (PE-02, PE-17).

If `build` refuses, the attempt upgrades to `REPORT_FAILED`, `report: null`, with the underlying attempt preserved (`attempt <CODE>: <bus code>: <bus detail>`) — **no valid report → no successful completion**. A report failure also wins over an earlier refusal: REPORT is terminal (PE-13). Exactly one build is attempted per `execute()` call (PE-16) — no hidden retry, no second report surface.

The composer also enforces the report gate *upstream*: a downstream attempt that claims `COMPLETED` without attaching its own report is refused (`REPORT_FAILED`) rather than believed (PE-07).

## 11. Error/refusal semantics

One taxonomy only — `01` §11.1 Core classes; no second taxonomy. `RESULT_CODES` (exactly fourteen — the two downstream vocabularies in lifecycle order plus the gate):

| Code | Class | Raised | Status |
|---|---|---|---|
| `COMPLETED` | — (success) | COMPLETE | COMPLETED |
| `INVALID_REQUEST` | E-INPUT | VALIDATE (bundle) · ORCHESTRATE (propagated from the agent) | REFUSED |
| `PLAN_INCOMPLETE` | E-VALID | PLAN (propagated from the planner, or a plan-artifact belt) | REFUSED |
| `REPORT_FAILED` | classified\* | PLAN/ORCHESTRATE (propagated, incl. the missing-report belts) · REPORT (own) | REPORT_FAILED |
| `APPROVAL_REQUIRED` | E-INPUT | GATE (own) | REFUSED |
| `MODULE_NOT_FOUND` | E-INPUT | ORCHESTRATE (propagated) | REFUSED |
| `MODULE_DISABLED` | E-ENV | ORCHESTRATE (propagated) | REFUSED |
| `CAPABILITY_UNAVAILABLE` | E-ENV | ORCHESTRATE (propagated) | REFUSED |
| `CAPABILITY_AMBIGUOUS` | E-CONFLICT | ORCHESTRATE (propagated) | REFUSED |
| `PHASE_NOT_DECLARED` | E-CONFLICT | ORCHESTRATE (propagated) | REFUSED |
| `MANIFEST_INVALID` | E-VALID | ORCHESTRATE (propagated) | REFUSED |
| `TOOL_REQUIRED` | E-TOOL | ORCHESTRATE (propagated) | REFUSED |
| `EXECUTION_REFUSED` | classified\* | ORCHESTRATE (propagated, plus the non-conforming-attempt belt) | REFUSED |
| `EXECUTION_FAILED` | classified\* | ORCHESTRATE (propagated) | FAILED |

\* propagated class from the underlying runtime/report-bus refusal (always a Core class; fixed fallbacks `EXECUTION_REFUSED → E-ENV`, `EXECUTION_FAILED → E-VALID`, `REPORT_FAILED → E-VALID` apply only if an injected contract omits a usable error object). Every shared code keeps **exactly** the class its upstream contract assigns (PE-01), and a well-formed downstream error object is carried through **verbatim** — same `{class, code, message, detail}`, never re-derived.

Every result carries a structured `error {class, code, message, detail}` (never a string, never a stack) — or `null` for `COMPLETED`.

## 12. Fail-closed rules

1. Non-object/extra-field/incomplete bundle → refuse at VALIDATE before any attempt — PE-06/M1.
2. Planner refusal (invalid envelope, tier depth) → propagate; no execution — PE-03/PE-04, M2/M3.
3. A non-conforming planner attempt (incoherent `ok`/`code`, unknown code) → refuse `PLAN_INCOMPLETE` — PE-07.
4. A "completed" plan without an artifact, or without its `review` gate state → refuse `PLAN_INCOMPLETE` — PE-07.
5. A "completed" plan or orchestration without its report → refuse `REPORT_FAILED` — PE-07 ("no valid report → no successful completion").
6. `plan.review.required === true` → refuse `APPROVAL_REQUIRED`; execution never runs — PE-05/M4 (`01` §5.2).
7. A non-conforming orchestration attempt (incoherent `ok`/`code`, or completion without an execution) → refuse, never success — PE-07.
8. Downstream registry refusals (unknown/disabled module, unavailable/ambiguous capability, undeclared phase, invalid manifest) → propagate — PE-09, M6/M7/M8.
9. Tool unavailable / blocked / dependency missing → propagate `TOOL_REQUIRED` (E-TOOL) — PE-10.
10. Invalid capability token or malformed execution envelope → propagate `INVALID_REQUEST` — PE-08, M5.
11. Runtime refusal → propagate `EXECUTION_REFUSED`; handler failure → propagate `EXECUTION_FAILED` — PE-11/PE-12, M9.
12. Composer report failure → `REPORT_FAILED`, `report: null`, never `COMPLETED`, wins over earlier codes — PE-13/M10.
13. Planner report failure → propagate `REPORT_FAILED` at stage PLAN; no execution — PE-14.
14. Every refusal's report mirrors the result (code/status/stage/issue identical) — PE-20; only a `COMPLETED` result reads as success — PE-18.
15. No mutation of registries, Core documents, or either module; no Core modification (pins verified outside the suite).

## 13. Determinism

Same bundle + same injected state ⇒ same resolution, same lifecycle result, same report bytes, same report hash (PE-19 builds twice and asserts `deepStrictEqual`, byte-identical text, and equal `sha256` — for a success and for a refusal).

Mechanisms: fixed stage order; fixed evidence/ledger append order; fixed summary/row shapes; no `Date.now`, `Math.random`, pids, `process.env`, machine paths, or unordered iteration affecting output (source-scanned in PE-19). Report `sha256` covers the exact rendered bytes; Task/Tier/Depth/Execution display values are single-line-guarded before rendering.

## 14. Security boundaries

- **Entry purity:** `composition/plan-execution/index.mjs` and `src/*.mjs` import only `./` specifiers — no `node:` builtins, no lateral module paths, no `fs`, no `child_process`, no `eval`/`Function`/dynamic import (PE-16 source scan).
- **Surface:** the composer is frozen and exposes exactly `execute`; exactly one report build per attempt.
- **DI over construction:** the composer builds neither downstream module — the composition root wires real Planner/Agent instances; each layer stays independently testable (PE-07 exercises the belts against stub contracts without touching the real modules).
- **No bypass:** the composer holds no registry, tool-bus, or runtime handle at all — source scan asserts no `executeHotkey`/tool-check calls; every gate stays where its authority lives (PE-09/PE-10/PE-21).
- **Core protection:** `01`–`04` and `12` are byte-pinned; the 18 legacy files remain 18/18 (HKC-17). This milestone changed none of them, and no manifest — no Core contradiction was found, so no Core edit was needed.

## 15. Tests

`test/plan-execution.test.mjs` — 31 tests, 5 suites; IDs map one-to-one to named tests (Group Q):

| ID | Named test |
|---|---|
| PE-01 | entry point, configuration, vocabularies, no new registry entry |
| PE-02 | happy path — plan → gate → orchestrate → report → complete |
| PE-03 | a planner refusal propagates; execution never runs |
| PE-04 | an incomplete plan propagates as PLAN_INCOMPLETE |
| PE-05 | the §5.2 approval gate refuses before any execution |
| PE-06 | an invalid bundle fails closed before any attempt |
| PE-07 | non-conforming downstream attempts fail closed (belts) |
| PE-08 | a malformed execution envelope propagates from the agent |
| PE-09 | downstream registry gates propagate (unknown, disabled, phase) |
| PE-10 | capability and tool refusals propagate (unavailable, blocked, missing) |
| PE-11 | a downstream runtime refusal propagates as EXECUTION_REFUSED |
| PE-12 | a downstream handler failure propagates as EXECUTION_FAILED |
| PE-13 | a composer report failure never claims completion |
| PE-14 | a planner report failure propagates through the plan stage |
| PE-15 | wiring — one plan call, one run call, exact order, none on refusal |
| PE-16 | public surface is exactly execute(); sources honor the boundary |
| PE-17 | composer → Report Bus — a real completion input, built by the real bus |
| PE-18 | no fabricated completion — only a COMPLETED result reads as success |
| PE-19 | determinism: identical bundles, identical results, identical hashes |
| PE-20 | the report always mirrors the result — code, status, stage, issue |
| PE-21 | no bypass — every downstream non-success stays non-success |

Coverage buckets: happy path (PE-02), fail-closed (PE-03…PE-14), integration (PE-15…PE-17), security + determinism (PE-18…PE-21).

## 16. Mutation tests

Ten byte-different fixtures under `test/_fixtures/`, each asserted byte-different from the pristine bundle `composition_request.json` before use (M10 additionally content-different from the pristine report input captured on a control run):

| Fixture | Exact mutation | Expected failure |
|---|---|---|
| `mut_composition_extra_field.json` | bundle field `generated_at: "2026-10-05T12:00:00Z"` added | `INVALID_REQUEST` (E-INPUT, REFUSED @ VALIDATE) |
| `mut_composition_plan_unknown_tier.json` | `plan.tier: "T3"` | `INVALID_REQUEST` (E-INPUT, REFUSED @ PLAN — propagated) |
| `mut_composition_plan_missing_risks.json` | `risks` removed (T2) | `PLAN_INCOMPLETE` (E-VALID, REFUSED @ PLAN — question 4) |
| `mut_composition_plan_trigger.json` | `plan.trigger: "migration"` added | `APPROVAL_REQUIRED` (E-INPUT, REFUSED @ GATE) |
| `mut_composition_execution_malformed.json` | `capability` removed from the execution envelope | `INVALID_REQUEST` (E-INPUT, REFUSED @ ORCHESTRATE — propagated) |
| `mut_composition_unknown_module.json` | `execution.module: "ghost-module"` | `MODULE_NOT_FOUND` (E-INPUT, REFUSED @ ORCHESTRATE) |
| `mut_composition_disabled_module.json` | `execution.module: "tool-bus"` (registered, not enabled) | `MODULE_DISABLED` (E-ENV, REFUSED @ ORCHESTRATE) |
| `mut_composition_unknown_capability.json` | `execution.capability: "ghost:capability"` | `CAPABILITY_UNAVAILABLE` (E-ENV, REFUSED @ ORCHESTRATE) |
| `mut_composition_execution_refusal.json` | `execution.target.key: "GHOST"` | `EXECUTION_REFUSED` (E-INPUT, REFUSED @ ORCHESTRATE, runtime called) |
| `mut_composition_report_input.json` | corrupted completion input (`status: "kinda-done"`, missing row fields) fed through the real Report Bus | `REPORT_FAILED` (`report === null`, attempt `COMPLETED` preserved) |

Every mutation also asserts: `ok === false`, exact `code`/`status`/`stage`, a Core-class error in this layer's set, the exact downstream state that ran (planner/orchestration codes, plan-artifact presence), a present and hash-valid composer report (M10: `report === null`), and **no mutation may ever read as `| Status | COMPLETED |`**. Each non-envelope mutation additionally proves the bundle envelope is valid — its own layer refuses it, exactly once, at its own gate.

## 17. Known limitations

- **The approval gate withholds, it does not approve:** any plan with `review.required` is refused; granting an approval is the Task 12 Policy/Approval engine named in `18`/`19`, which does not exist yet. A gate this layer cannot verify never reads as satisfied.
- **No plan→execution-request translation:** the `execution` sub-request is caller-supplied alongside the `plan`; neither contract defines how plan content maps to `{kind, module, capability, phase, target}`, and inventing one would fabricate capability. What is wired is the ordering and gating the Core demands: plan first, execution only behind a valid, ungated plan.
- The composer is **stateless** — no session, no plan updating across attempts (`01` §5.5 belongs to a session runner).
- The tier is still asserted by the caller (G5 classification is the Decision Rules' contract); the composer merely relays it.
- One bundle shape, one report type, synchronous `execute()` — by design for this milestone; no async, retry, or loop exists anywhere in the lifecycle.

## 18. Future layers

Belonging to later tasks, explicitly NOT provided here: the Task 12 Policy/Approval engine acting on `review.required`, a contract that maps plan content into execution requests, session-level plan updating (`01` §5.5), tier classification (G5 automation), LLM-assisted planning, memory. This document defines the composition that makes those safe: *no valid bundle → no plan; no valid plan → no execution; an unverifiable approval gate → no execution; no valid report → no successful completion; a plan is never a build (`01` §5.6).*

## 19. Acceptance mapping

| Specification source | Where satisfied |
|---|---|
| `01` §3 loop order (PLAN before BUILD/RUN) and `04` §2 rows 4→5 | §2/§6 lifecycle; PE-02, PE-15 |
| `01` §5.2 T2 review gate before BUILD | §6 GATE stage, §11; PE-05, M4 |
| `01` §5.6 plan ≠ build | §4 non-goals, §14; PE-05 (a gated plan never executes), PE-18 |
| `01` §11.1 single error taxonomy | §11; PE-01 (classes identical to upstream), PE-07 |
| `01` §13.5 fail closed | §12 rules 1–15; PE-03…PE-14, M1…M10 |
| `01` §13.7 no hidden coupling | §2/§14; PE-16 source scan |
| `02` §3 rules 1/3 (no lateral imports; composition root wires) | §2/§3/§14; PE-01, PE-16 |
| `03` §5 result schema + status vocabulary | §10 report contract; PE-17 |
| `18` §5/§11 agent request + result vocabulary | §11 propagation (identical classes); PE-08…PE-12, M5…M9 |
| `19` §5/§11 planner request + result vocabulary | §11 propagation (identical classes); PE-03/PE-04, M2/M3 |
| Report gate ("no valid report → no successful completion") | §10/§12 rules 5/12/13; PE-07, PE-13, PE-14, M10 |
| Task directive (smallest contract-correct composition, no redesign, no policy, no registry changes, no commit) | §3/§4/§7; PE-01 (no manifest), Group Q release gate |
