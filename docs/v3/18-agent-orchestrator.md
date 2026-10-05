# Grimoire v3 — Agent Orchestrator Contract

**Status:** Added Task 10 (first L2 Agent-grade orchestration layer)
**Scope:** The deterministic execution contract between a request and the existing L1 authority: request shape, the finite lifecycle (RECEIVE → VALIDATE → RESOLVE → PREFLIGHT → EXECUTE → REPORT → COMPLETE), Module Registry / Tool Bus / Hotkey Runtime / Report Bus integration, error and refusal semantics, fail-closed rules, determinism, security boundaries, testing contract (AO-01…AO-26, AO-M1…AO-M10), and the known limitations. Core `01`–`04`, `12`, and all 18 legacy source files are unchanged.

**Why this exists.** Through Task 09 the repository had four authoritative services — Hotkey Runtime, Tool Bus, Module Registry, Report Bus — but **nothing coordinated them**: a caller had to know which module to name, whether it was enabled, which capability to pass, which tools to preflight, and where to send the result. This module is that coordinator. It answers exactly one question: *given a strict request and the injected contracts, does this operation run, and what is the report either way?* It orchestrates existing authority; it never becomes a second source of truth (directive §Executive principle).

---

## 1. Purpose

The Agent Orchestrator is the deterministic, fail-closed execution layer of Grimoire v3. It takes one request, walks it through the seven-stage lifecycle, and returns one frozen result carrying the report of that attempt.

It must NOT invent behavior: no new capabilities, no new tools, no handler logic, no fallback module, no retry, no planning, no memory, no LLM calls (`01` §13.5 — fail closed, never guess). Every decision it makes is a translation of an existing contract's answer into lifecycle state.

## 2. Architectural position

```text
L1 Core Specifications (01–04, 12)
        ↓
Hotkey Registry → Hotkey Runtime
        ↓
Tool Bus
        ↓
Module Registry
        ↓
Report Bus
        ↓
Agent Orchestrator (L2, this document)   ← consumes all four public surfaces
```

Operationally, one request flows:

```text
Request
→ Agent Orchestrator
→ Module Registry   (resolve: registered? enabled? provides? unique? invokable?)
→ Tool Bus          (preflight: every declared tool checkable?)
→ Hotkey Runtime    (execute: the only handler path)
→ Report Bus        (report: the only report format)
→ Validated Agent Result (frozen {ok, code, status, stage, error, request,
                          plan, preflight, execution, report})
```

The orchestrator sits **above** the four services and imports none of them: the composition root injects `{registry, runtime, toolBus, reportBus}` at construction (02 §3 rules 1/3 — L2 may be composed with L1, never reach into it; lateral module-to-module imports are forbidden, which `modules/agent/index.mjs` enforces by importing only `./` paths).

## 3. Scope

Implemented under `modules/agent/` using the established `03` §2 module layout:

| File | Role |
|---|---|
| `modules/agent/manifest.yaml` | `id: agent`, `version: 1.0.0`, `core: ">=3.0 <4.0"`, `phases: [RUN, TEST, SHIP]`, `requires.tools: []`, `provides: [agent:orchestrate]`, `consumes: [module-registry:resolve, toolbus:capabilities, hotkeys:execute, report-bus:build]`, six `errors`, `entry: modules/agent/index.mjs` |
| `modules/agent/index.mjs` | Public entry: re-exports the contract only; imports nothing but `./` |
| `modules/agent/src/errors.mjs` | The single Core taxonomy (01 §11.1) built locally; the six raisable Agent classes |
| `modules/agent/src/request.mjs` | Request envelope: `REQUEST_FIELDS`, `TARGET_FIELDS`, `OPERATION_KINDS`, `EXECUTION_CAPABILITY`, the eight loop phases, `validateRequest`, `normalizeRequest` |
| `modules/agent/src/orchestrator.mjs` | `LIFECYCLE_STAGES`, `RESULT_CODES`, `createAgentOrchestrator` — the finite lifecycle itself |

Public surface (entry exports): `createAgentOrchestrator`, `RESULT_CODES`, `LIFECYCLE_STAGES`, `validateRequest`, `normalizeRequest`, `OPERATION_KINDS`, `REQUEST_FIELDS`, `TARGET_FIELDS`, `EXECUTION_CAPABILITY`, `EIGHT_LOOP_PHASES`, `CORE_ERROR_CLASSES`, `AGENT_ERROR_CLASSES`, `makeError`, `isCoreErrorClass`.

`createAgentOrchestrator({registry, runtime, toolBus, reportBus})` returns a frozen object whose surface is exactly `{ run(request) }`. All four dependencies are required; a missing one throws `E_INPUT_INVALID_ORCHESTRATOR_CONFIG` at construction — no orchestrator exists, therefore nothing can be orchestrated (01 §13.5).

Also added: `test/agent-orchestrator.test.mjs`, `test/_fixtures/agent_request.json` + ten `mut_agent_*.json` fixtures, this document, and Group O of `docs/v3/05-acceptance-tests.md`.

## 4. Non-goals

Task 10 does NOT provide and explicitly does not implement:

- autonomous planning (Task 11 Planner), policy/approval (Task 12), persistent agent memory
- autonomous retry, autonomous looping, "try something else" fallbacks, hidden recovery
- LLM reasoning or any external network execution
- recursive self-planning, self-modification, self-extension
- Git commit/push automation, UI, chat interface, background workers, scheduling
- a new tool system, a new capability vocabulary, direct handler or provider invocation
- any operation kind beyond `hotkey` (one kind, one execution capability)

## 5. Request contract

The envelope is strict — exactly the declared fields, no extras anywhere (extra fields are refused rather than ignored; a request is contract data, not a bag of options):

```text
kind       one of: hotkey                    (OPERATION_KINDS — the only kind)
module     non-empty single-line string      (must be registry-registered)
capability namespace:name token              (/^[a-z0-9-]+:[a-z0-9-]+$/)
phase      one of the eight loop phases      (01 §3)
target     plain object, exactly ONE of:
             key      non-empty single-line string
             command  non-empty single-line string
args       optional plain object
```

Rules that make the request unguessable (directive §5):

- `target` carrying **both** `key` and `command` is ambiguous by shape → refused; **neither** is incomplete → refused.
- `kind` ↔ `capability` binding: a `hotkey` operation executes `hotkeys:execute` (`EXECUTION_CAPABILITY`) and nothing else. The envelope check lives in VALIDATE; the binding itself is enforced in RESOLVE ("does the requested capability exist *for this operation kind*" is a resolution question, directive §6).
- Nothing normalizes or repairs acceptance: `validateRequest` returns ALL violations in fixed order, each `INVALID_REQUEST`; `normalizeRequest` produces only a sanitized display echo and never decides acceptance.

## 6. Lifecycle

Finite-state, single pass, no loops (directive §10):

```text
RECEIVE
  ↓
VALIDATE   ──X→ REFUSED   (INVALID_REQUEST)
  ↓
RESOLVE    ──X→ REFUSED   (MODULE_NOT_FOUND · MODULE_DISABLED · CAPABILITY_UNAVAILABLE
                           · CAPABILITY_AMBIGUOUS · PHASE_NOT_DECLARED · MANIFEST_INVALID)
  ↓
PREFLIGHT  ──X→ REFUSED   (TOOL_REQUIRED)
  ↓
EXECUTE    ──X→ REFUSED/FAILED (EXECUTION_REFUSED · EXECUTION_FAILED · TOOL_REQUIRED)
  ↓
REPORT     ──X→ REPORT_FAILED
  ↓
COMPLETE
```

Each stage either advances or terminates with a named code — there is no automatic retry, no fallback stage, no hidden recovery path. Contract shape per attempt:

```text
request → validated request → resolved execution plan → preflight result
        → execution result → report
```

`plan` (`{module, capability, phase, tools}`) exists only when RESOLVE succeeded; `preflight` exists only past PREFLIGHT; `execution` (the raw runtime result) exists only past EXECUTE; `report` exists for every terminal attempt except when the report step itself refuses.

`status` vocabulary: `COMPLETED` (only with `code: COMPLETED`), `REFUSED` (default), `FAILED` (execution failure), `REPORT_FAILED`.

## 7. Module Registry integration

Resolution consumes only the five public registry methods, in order — never internals (directive §6, AO-18 proxies the registry and asserts no other property is touched):

```text
registry.has(module)                        false → MODULE_NOT_FOUND
registry.isEnabled(module)                  false → MODULE_DISABLED
registry.describe(module).provides
  .includes(capability)                     false → CAPABILITY_UNAVAILABLE
kind ↔ capability pairing                   mismatch → CAPABILITY_UNAVAILABLE
registry.resolveCapability(capability)      refusal → CAPABILITY_UNAVAILABLE / CAPABILITY_AMBIGUOUS
  resolved.module !== requested module      → CAPABILITY_UNAVAILABLE (never substitute)
registry.canInvoke(module, {phase, tools:[]}) refusal → translated (belt below)
```

Any negative answer stops execution. No fallback to an undeclared module, no implicit activation, no capability fabrication, no silent substitution.

The `canInvoke` belt translates unexpected registry codes into the orchestrator's vocabulary without swallowing them: `MANIFEST_INVALID → MANIFEST_INVALID`, `MODULE_NOT_FOUND → MODULE_NOT_FOUND`, `INVALID_INVOCATION → INVALID_REQUEST`, `MODULE_NOT_ENABLED → MODULE_DISABLED`, `PHASE_NOT_DECLARED → PHASE_NOT_DECLARED`, `TOOL_UNDECLARED | TOOL_UNAVAILABLE → TOOL_REQUIRED`, anything else → `MANIFEST_INVALID`. Tools are deliberately excluded from `canInvoke` (`tools: []`) so the stages stay separated: registry owns lifecycle/phase, Tool Bus owns tools at PREFLIGHT.

The orchestrator never mutates the registry (directive §11.17).

## 8. Tool Bus integration

At PREFLIGHT, for each tool in `plan.tools` (sourced from the registered manifest's `requires.tools` — the Agent manifest declares none of its own):

```text
toolBus.check(tool) → { ok, code }
  ok !== true → PREFLIGHT refusal: TOOL_REQUIRED (E-TOOL),
                detail "tool: CODE", e.g. "files: TOOL_UNAVAILABLE"
```

The Tool Bus remains authoritative for capability availability, dependency state, tool status, provider availability, input validation, and invocation eligibility. Its refusal codes (`TOOL_NOT_FOUND`, `TOOL_UNAVAILABLE`, `DEPENDENCY_MISSING`, `TOOL_BLOCKED`, `TOOL_DISABLED`, `CAPABILITY_INVALID`) pass through verbatim as evidence — the orchestrator never reinterprets an unavailable tool as available and duplicates no Tool Bus policy (directive §7). Zero checks happen when VALIDATE or RESOLVE already refused (AO-20).

## 9. Hotkey Runtime integration

The only execution path is `runtime.executeHotkey(input)` where `input = { ...target }` plus `args` when present — the target reaches the runtime untouched (AO-19 asserts the exact object, one call, zero calls on any refusal). Handlers are never called directly; the runtime's own gates (activation, tool duty, argument validation, unknown key) decide.

Result consumption (the Agent may consume, never bypass):

```text
executed === true && ok === true            → EXECUTE done → REPORT
classification TOOL_REQUIRED                → TOOL_REQUIRED (refused)
classification EXECUTION_ERROR              → EXECUTION_FAILED (failed)
anything else (e.g. REFUSED, unknown key)   → EXECUTION_REFUSED (refused)
```

The runtime's own `error.class`/`code` are propagated, not reinvented: a refusal stays `E-INPUT` with the runtime's code in the detail; a handler exception surfaces as the runtime's classified `E_UNKNOWN_EXCEPTION` failure. Legacy consumers see no change — the runtime itself is untouched.

## 10. Report Bus integration

Every terminal attempt builds one `completion` input for the injected Report Bus (`reportBus.build`), with exactly five sections in canonical order: `summary` (Kind/Module/Target/Capability/Phase/Code/Status/Stage), `results` (one row: `module` = the requested module, `command` = `agent.orchestrate`, `status` = `success` | `blocked` for E-ENV/E-TOOL classes | `failed`, plus the attempt's phase-ledger, runtime artifacts, evidence, remaining issues), `phase-ledger`, `evidence`, `remaining-issues`.

The report makes the required facts determinable (directive §9): request echo (summary), resolved target (summary + plan), validation/resolution/preflight/execution outcomes (ledger + evidence), refusal reason (remaining issues: `CODE: detail`), final status (summary Code/Status rows).

If `build` refuses, the attempt upgrades to `REPORT_FAILED`, `report: null`, with the underlying attempt preserved in the detail (`attempt <CODE>: <bus code>: <bus detail>`) — **no valid report → no successful completion** (directive §11.10). A report failure also wins over an earlier refusal: REPORT is terminal.

No timestamps, random IDs, pids, machine paths, or environment values are added anywhere (AO-26 scans for them).

## 11. Error/refusal semantics

One taxonomy only — 01 §11.1 Core classes; no second taxonomy is created. `RESULT_CODES` (exactly twelve):

| Code | Class | Stage | Status |
|---|---|---|---|
| `COMPLETED` | — (success) | COMPLETE | COMPLETED |
| `INVALID_REQUEST` | E-INPUT | VALIDATE | REFUSED |
| `MODULE_NOT_FOUND` | E-INPUT | RESOLVE | REFUSED |
| `MODULE_DISABLED` | E-ENV | RESOLVE | REFUSED |
| `CAPABILITY_UNAVAILABLE` | E-ENV | RESOLVE | REFUSED |
| `CAPABILITY_AMBIGUOUS` | E-CONFLICT | RESOLVE | REFUSED |
| `PHASE_NOT_DECLARED` | E-CONFLICT | RESOLVE | REFUSED |
| `MANIFEST_INVALID` | E-VALID | RESOLVE | REFUSED |
| `TOOL_REQUIRED` | E-TOOL | PREFLIGHT/EXECUTE | REFUSED |
| `EXECUTION_REFUSED` | classified* | EXECUTE | REFUSED |
| `EXECUTION_FAILED` | classified* | EXECUTE | FAILED |
| `REPORT_FAILED` | classified* | REPORT | REPORT_FAILED |

\* the class is propagated from the underlying runtime/report-bus refusal (always a Core class; fixed fallbacks apply only if an injected contract omits the error object). The module's manifest declares the six raisable classes (no `E-DEP` — this layer calls no external service).

Every result carries a structured `error` object `{class, code, message, detail}` (never a string, never a stack) — or `null` for `COMPLETED`.

## 12. Fail-closed rules

Implemented exactly as mandated (directive §11); each rule is enforced by a named test:

1. Unknown module → refuse (AO-08) · 2. Unknown capability → refuse (AO-10/14) · 3. Disabled module → refuse (AO-09) · 4. Missing dependency → refuse (AO-13) · 5. Missing tool → refuse (AO-11) · 6. Blocked tool → refuse (AO-12) · 7. Invalid request → refuse (AO-07) · 8. Runtime refusal → propagate (AO-15) · 9. Handler failure → execution failure (AO-16) · 10. Report failure → report failure (AO-17) · 11. No undeclared capability executes (AO-23) · 12. No unregistered module executes (AO-08) · 13. No direct handler invocation (AO-22) · 14. No direct provider invocation (AO-22) · 15. No fabricated success (AO-17/24: an executed run without a report is not a completion) · 16. No silent fallback (AO-04/10: two providers ⇒ AMBIGUOUS, never a guessed side) · 17. No mutation of the authoritative registries (AO-18) · 18. No modification of Core specifications (§14 pins).

## 13. Determinism

Same request + same injected state ⇒ same resolution, same lifecycle result, same report bytes, same report hash (AO-26 builds twice and asserts `deepStrictEqual`, byte-identical text, and equal `sha256` — for a success and for a refusal).

Mechanisms: fixed stage order; fixed evidence and ledger append order; fixed summary/row shapes; the Report Bus's canonical section order; no `Date.now`, `Math.random`, pids, `process.env`, machine paths, or unordered iteration affecting output. Report `sha256` covers the exact rendered bytes.

## 14. Security boundaries

- **Entry purity:** `modules/agent/index.mjs` and `src/*.mjs` import only `./` specifiers — no `node:` builtins, no lateral module paths, no `fs`, no `child_process`, no `eval`/`Function`/dynamic `require` (AO-22 source scan).
- **Surface:** the orchestrator object is frozen and exposes exactly `run`; refused requests never reach the runtime (AO-22 behavioral probes).
- **Authority:** handlers are reached only through `executeHotkey`; tools only through `check`; reports only through `build`; registries are read-only.
- **Core protection:** `01`–`04` and `12` are byte-pinned (sha256, verified in-suite by AO-adjacent gates and `sha256sum -c`); the 18 legacy source files remain 18/18 (HKC-17). Task 10 changed none of them — no Core contradiction was found, so no Core edit was needed (directive §15).

## 15. Tests

`test/agent-orchestrator.test.mjs` — 36 tests, 5 suites; IDs map one-to-one to named tests (Group O):

| ID | Named test |
|---|---|
| AO-01 | entry point, manifest, configuration, and result-code table |
| AO-02 | a valid request resolves into an exact execution plan |
| AO-03 | an enabled module resolves (enablement observed, never assumed) |
| AO-04 | an available capability resolves; two providers are never guessed |
| AO-05 | a valid tool dependency reaches execution through Tool Bus preflight |
| AO-06 | successful execution reaches REPORT and COMPLETE |
| AO-07 | invalid requests fail closed at VALIDATE, before anything runs |
| AO-08 | an unknown module fails closed |
| AO-09 | a disabled module fails closed |
| AO-10 | unknown, unpairable, and ambiguous capabilities fail closed |
| AO-11 | an unavailable tool fails closed |
| AO-12 | a blocked tool fails closed |
| AO-13 | a missing dependency fails closed |
| AO-14 | an invalid capability token fails closed at VALIDATE |
| AO-15 | a runtime refusal propagates as EXECUTION_REFUSED |
| AO-16 | a handler failure propagates as EXECUTION_FAILED |
| AO-17 | a report failure propagates and never claims completion |
| AO-18 | Agent → Module Registry uses only the public contract (with belts) |
| AO-19 | Agent → Hotkey Runtime — one call, exact input, none on refusal |
| AO-20 | Agent → Tool Bus — one check per declared tool, zero when resolution fails |
| AO-21 | Agent → Report Bus — a real completion input, built by the real bus |
| AO-22 | direct handler bypass is impossible through the public surface |
| AO-23 | an undeclared capability cannot execute |
| AO-24 | an unavailable tool cannot become success |
| AO-25 | a disabled module cannot execute |
| AO-26 | identical requests against identical state produce identical results |

Coverage buckets per directive §13: happy path (AO-02…06), fail-closed (AO-07…17), integration (AO-18…21), security (AO-22…25), determinism (AO-26).

## 16. Mutation tests

Ten byte-different fixtures under `test/_fixtures/`, each asserted `fixture !== pristine` before use (AO-M1…M9 against `agent_request.json`; AO-M10 additionally content-different from the pristine report input captured on a control run):

| Fixture | Mutation | Expected fail-closed result |
|---|---|---|
| `mut_agent_unknown_module.json` | `module: "ghost-module"` | `MODULE_NOT_FOUND` (REFUSED @ RESOLVE) |
| `mut_agent_disabled_module.json` | `module: "tool-bus"` (registered, not enabled) | `MODULE_DISABLED` (REFUSED @ RESOLVE) |
| `mut_agent_unknown_capability.json` | `capability: "ghost:capability"` | `CAPABILITY_UNAVAILABLE` (REFUSED @ RESOLVE) |
| `mut_agent_missing_tool.json` | `phase: "TEST"` + Tool Bus faulted `TOOL_UNAVAILABLE` | `TOOL_REQUIRED` (REFUSED @ PREFLIGHT) |
| `mut_agent_blocked_tool.json` | `phase: "SHIP"` + Tool Bus faulted `TOOL_BLOCKED` | `TOOL_REQUIRED` (REFUSED @ PREFLIGHT) |
| `mut_agent_dependency.json` | `target.command` + Tool Bus faulted `DEPENDENCY_MISSING` | `TOOL_REQUIRED` (REFUSED @ PREFLIGHT) |
| `mut_agent_malformed.json` | `capability` field removed | `INVALID_REQUEST` (REFUSED @ VALIDATE) |
| `mut_agent_invalid_capability.json` | `capability: "not-a-capability"` | `INVALID_REQUEST` (REFUSED @ VALIDATE) |
| `mut_agent_execution_refusal.json` | `target.key: "GHOST"` | `EXECUTION_REFUSED` (REFUSED @ EXECUTE, runtime called once) |
| `mut_agent_report_input.json` | corrupted completion input (`status: "kinda-done"`, missing row fields) fed through the real Report Bus | `REPORT_FAILED` (report `null`, attempt preserved) |

Every mutation also asserts: `ok === false`, exact `code`/`status`/`stage`, a Core-class error, a present and hash-valid report (except the REPORT_FAILED case, where `report === null`), and **no mutation may ever read as `| Status | COMPLETED |`**.

## 17. Known limitations

- One operation kind only (`hotkey` → `hotkeys:execute`); other kinds are rejected by design until a future task defines them.
- No planner, no retry, no loop, no memory, no policy/approval — a single deterministic pass (directive §18).
- `run` is synchronous; long-running or async execution is out of contract for Task 10.
- The kind↔capability pairing belt is hard-coded to the one kind; adding a kind requires editing `OPERATION_KINDS` (a deliberate code change, not a runtime extension).
- Injected contracts are validated at construction by duck-typing their public method names; deeper shape trust is delegated to each service's own fail-closed behavior (belted in RESOLVE, propagated in EXECUTE/REPORT).
- The orchestrator translates but does not re-verify Tool Bus states or Report Bus rows — upstream authority remains upstream (directive §7/§9).

## 18. Future Agent layers

Belonging to later tasks, explicitly NOT provided here: Task 11 Planner (task decomposition), Task 12 Policy/Approval engine, persistent agent memory, LLM reasoning, autonomous retry/loops, self-modification, autonomous Git operations. This document defines the execution contract that makes future autonomy safe: *no registry entry → no execution; no enabled module → no execution; no capability → no execution; no tool → no execution; no valid runtime resolution → no execution; no valid report → no successful completion.*

## 19. Acceptance mapping

| Directive section | Where satisfied |
|---|---|
| §3 Scope (`modules/agent/`, test, doc, Group O, README rows) | §3 of this document; `test/agent-orchestrator.test.mjs`; Group O; README 26–28 |
| §4 Lifecycle contract | §6; `LIFECYCLE_STAGES`; AO-01/02/06 |
| §5 Request contract + nine codes | §5/§11; `validateRequest`; AO-07…17 |
| §6 Resolution rules | §7; AO-08/09/10/18/23 |
| §7 Tool Bus integration | §8; AO-05/11/12/13/20/24 |
| §8 Hotkey Runtime integration | §9; AO-15/16/19/22 |
| §9 Report Bus integration + byte determinism | §10/§13; AO-21/17/26 |
| §10 Finite-state execution model | §6; AO-02 (plan) + every refusal's exact stage |
| §11 Eighteen fail-closed requirements | §12 (each rule → test) |
| §12 Determinism | §13; AO-26 |
| §13/§14 Tests + ten mutations | §15/§16; AO-01…26, AO-M1…M10 |
| §15 Integrity gates | §14; five sha256 pins + source 18/18 verified outside the AO suite |
| §16 Regression (`node --test`) | Group O release gate: 167/167, 29 suites, exit 0 |
| §17/§18 Documentation + non-goals | §1–§4, §17, §18 of this document |
