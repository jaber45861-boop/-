# Task 23 — V3 Architectural Roadmap & Next Increment Investigation

## Status

- INVESTIGATION_STATUS: COMPLETE
- IMPLEMENTATION_AUTHORIZED: NO
- NEXT_TASK_AUTHORIZED: NO (no authoritative next implementation capability exists)
- Next authorized direction: a new investigation / executive-ruling task to close the remaining contract-authority gap before any further capability can ship
- Native Write state preserved verbatim: NATIVE_WRITE = SHIPPED, GROUP_U = PASS, RT-006 = PASS, SECURITY_AUDIT = PASS, WORKTREE = CLEAN, REMOTE = VERIFIED

## Current Architecture State

After Task 22, the repository contains a complete, audited, deterministic L0→L2 execution stack around a single operation kind (`hotkey` → `hotkeys:execute`).

Implemented and verified:
- L0 Core: `docs/v3/01-core-specification.md`, `02-architecture-map.md`, `03-extension-contract.md`, `04-decision-rules.md`
- L0/L1 acceptance specification: `docs/v3/05-acceptance-tests.md`
- L3 binding data: `docs/v3/12-hotkey-registry.md`
- L1 services: Tool Bus (`modules/tool-bus/`), Module Registry (`modules/module-registry/`), Report Bus (`modules/report-bus/`)
- L2 modules: Hotkeys (`modules/hotkeys/`), Agent Orchestrator (`modules/agent/`), Planner (`modules/planner/`)
- Composition root: `composition/plan-execution/`
- Consuming shell: `runtime/local-runtime.mjs`
- Real-scenario harness: `test/scenario-harness.mjs` with RT-001…RT-006
- One shipped write surface: Native Write (`handler.save-files`) behind explicit opt-in workspace wiring
- Policy/Approval contract is specified (`docs/v3/23-policy-approval-contract.md`, Group R) and implemented as the CS-13 injected GATE layer

Current authoritative numbers (per suite release gates and audit record):
- `node --test test/*.test.mjs` → 305 tests, 55 suites, 0 fail
- `node test/scenario-harness.mjs --all` → 6/6 scenarios pass
- `node test/scenario-harness.mjs RT-006` → pass
- `git diff --check` → clean
- Protected files `01–04`, `12`, `22`, `23`, and `modules/tool-bus/capabilities.json` are byte-pinned and unchanged

## Authoritative Sources

Primary architectural authority for this investigation:
- `docs/v3/01-core-specification.md`
- `docs/v3/02-architecture-map.md`
- `docs/v3/03-extension-contract.md`
- `docs/v3/04-decision-rules.md`
- `docs/v3/05-acceptance-tests.md`
- `docs/v3/12-hotkey-registry.md`
- `docs/v3/14-hotkey-runtime.md`
- `docs/v3/15-tool-bus.md`
- `docs/v3/16-module-registry.md`
- `docs/v3/17-report-bus.md`
- `docs/v3/18-agent-orchestrator.md`
- `docs/v3/19-planner.md`
- `docs/v3/20-plan-execution-composition.md`
- `docs/v3/22-policy-approval-ruling-record.md`
- `docs/v3/23-policy-approval-contract.md`
- `docs/v3/24-local-runtime.md`
- `docs/v3/25-real-scenario-test-harness.md`
- `docs/v3/26-native-write-capability.md`
- `docs/v3/27-native-write-capability-ruling.md`
- `docs/v3/28-native-write-audit.md`

Operational/authority sources:
- `README.md` document index
- `modules/hotkeys/manifest.yaml`
- `modules/hotkeys/src/handlers.mjs`
- `runtime/local-runtime.mjs`
- `test/policy-approval.test.mjs` (Group R + the NEG-20 boundary sets for Tasks 16–22)
- `test/scenario-harness.mjs` and `test/scenarios/` fixtures

External learning material (`Part5.md`, `Part8.md`, `RecommendedTools.md`, `README` questionnaires) was inspected and treated as non-authoritative context only.

## Implemented Components

| Component | STATUS | SOURCE | CONTRACT | TEST COVERAGE | KNOWN LIMITATION |
|---|---|---|---|---|---|
| Core specification | COMPLETE (draft-for-executive-review status per Task 01; normatively enforced through acceptance tests) | `01` | `01` §0–§13 | AC-01…AC-27 where applicable | Status label is historical; the text is the operative Core |
| Architecture map | COMPLETE | `02` | `02` §3 dependency rules | AC-03, AC-21, AC-22 | Debugger/Testing/Deployment/Git/Learning exist as roles, not built modules |
| Extension contract | COMPLETE | `03` | `03` §2 manifest, §3 lifecycle, §4 hotkey interface, §5 reports, §6 testing, §7 checklist | AC-17, AC-18, AC-19, AC-20, AC-21 | §8 forbids licensing new Core behavior without an approved versioned Core change |
| Decision rules | COMPLETE | `04` | G0→G5 procedure + mode routing | AC-05…AC-08, AC-27 | Routing is deterministic by text; classification is a separate contract (G5) |
| Acceptance tests | COMPLETE and growing | `05` | Group A–T + Group R (CS-13) + Group U (Native Write) | Executable suite through Group R/T/U | Later groups staged by their owning tasks |
| Hotkey registry | COMPLETE | `12` | `03` §4, H1–H7; activation statuses | HK-01…HK-10, HKC-01…HKC-17, HKR-01…HKR-14 | Registration ≠ activation; 10/14 ACTIVE hotkeys UNIMPLEMENTED in default wiring |
| Hotkey runtime | COMPLETE | `14` | `executeHotkey` pipeline, handler contract, result codes | HKR-01…HKR-14, mutations | Default wiring: only `R`, `PN`, `PTn` executable; `SoS` TOOL_REQUIRED; `G` UNIMPLEMENTED unless workspace-bound |
| Tool Bus | COMPLETE | `15` | capability model, lifecycle, failure semantics | TB-01…TB-24 | 1 real provider (`files`/`local-files`); `search providers` + `Netlify Drop` UNAVAILABLE; 8 adapter-backed capabilities BLOCKED |
| Module Registry | COMPLETE | `16` | REGISTER→VALIDATE→ENABLE→INVOKE | MR-01…MR-16 | Unresolved `consumes` has no normative VALIDATE gate; `entry` existence unchecked |
| Report Bus | COMPLETE | `17` | `03` §5 report types/sections | RB-01…RB-20, RB-M1…RB-M9 | Cannot verify D1–D10 on a supplied `success`; only two report types exist |
| Agent Orchestrator | COMPLETE | `18` | 7-stage lifecycle, request contract, 4 service integrations | AO-01…AO-26, AO-M1…AO-M10 | One operation kind only (`hotkey`→`hotkeys:execute`); no planner/memory/retry/approval internally |
| Planner | COMPLETE | `19` | tier-exact plan production, 4 questions, T2 review gate | PL-01…PL-20, PL-M1…PL-M10 | Tier asserted by caller; plan not wired to execution; no file existence check |
| Plan–Execution composition | COMPLETE | `20` | `{plan, execution}` bundle, GATE, propagation, 3-report invariant | PE-01…PE-21, PE-M1…PE-M10 | No plan→execution-request translation; approval is injected/CS-13 only |
| Policy/Approval contract | COMPLETE (CS-13) | `23` | verdict schema, canonicalization, invocation counts, refusal semantics | Group R: R-01…R-15 + POS/NEG matrix + R-M fixtures (41 tests) | Component is injected only; no policy artifact, persistence, crypto, expiry, revocation |
| Local Runtime | COMPLETE | `24` | CLI shell consuming contracts; `--workspace` opt-in for write | Task 16 tests + scenario harness | No server/UI/db; write only via opt-in workspace-bound handler |
| Real scenario harness | COMPLETE | `25` | DEFINE→RUN→OBSERVE→ASSERT→REPORT over Local Runtime | Group T + RT-001…RT-006 | Small scoped scenarios only; not a general autonomy proof |
| Native Write capability | SHIPPED + AUDITED | `26` discovery, `27` ruling, Task 21 implementation, `28` audit | R1–R7 + `14` §6.1 handler contract + `24` opt-in + `25` RT-006 path | Group U (U-01…U-12) + RT-006 + 35/35 adversarial matrix | Opt-in only; single file create-or-overwrite; no atomicity; default wiring unchanged |
| Scenario tests (acceptance groups) | ACTIVE | `05` + `test/` | per-group contracts | Full suite green | Later groups run only when their task shipped |

## Explicitly Unimplemented Work

### Explicitly authorized future work (repository-authoritative)

The repository explicitly names future work in several contracts, but always as *future tasks*, never as an already-authorized next implementation:

- `02` §6: module implementations (Debugger, Testing, Deployment, Git, Learning, etc.) are future work
- `03` §8: new Core behavior requires a versioned Core change approved before the module ships
- `15` §18 rule 1: new capabilities come only from registry Tools tokens, manifest `requires.tools`, adapter declarations, or executable implementations — not invented
- `18` §17/§18; `19` §17/§18; `20` §17/§18: future agent layers explicitly listed as NOT provided (memory, retry/loops, plan→execution mapping, tier classification automation, LLM reasoning, policy artifact, persistence, etc.)
- `14` §9; `25` §10; `26` §5/§13/§15: native write was explicitly future work until Task 19 ruling + Task 20 contracts + Task 21 implementation; that chain is now complete
- `12` §4: 10 adapters remain `NOT_ACTIVATED`; adapter activation is a future task
- `12` §2/§3: many hotkeys remain BLOCKED_* or ADAPTER_REQUIRED

So the repository repeatedly points at *future* work, but it does **not** point at a single *next* capability and authorize it.

### Proposed / advisory future work (not authoritative for v3 implementation)

- `13-hotkey-decision-sheet.md`: advisory rulings for blocked hotkeys — recommendations, not decisions
- Legacy learning/curriculum material: broad topics (agents, code interpreters, algorithms, architecture) — context only
- General "what to build next" ideas that appear in learning material, README questionnaires, or adapter/skill wish-lists: not contract authority

### Historical / superseded / non-authoritative

- Task 18's `PROPOSAL` section in `26` is a historical investigation artifact; its proposal lost force once Task 19/20/21 resolved the Native Write chain
- Any "next capability" that is not grounded in a contract, ruling, or acceptance authority is non-authoritative by Task 23 decision rule 1–3

## Candidate Increments

Candidates considered from repository text and current architecture:

| Candidate | Contract Authority | Architectural Value | Dependency Readiness | Security Risk | Implementation Size | Priority |
|---|---|---|---|---|---|---|
| Activate one of the 10 remaining `ADAPTER_REQUIRED` adapters | None yet; adapter activation requires its own contract/decision per `12` §4 | Adapter-specific; not a Core architectural increment by itself | Needs adapter-specific authority; not granted generically | Depends on adapter; must not bypass GATE/registry | Small-to-medium per adapter | NONE as a v3 roadmap default |
| Activate one of the 13 blocked hotkeys (conflict/ambiguous/insufficient) | None — blocked records await executive ruling/evidence (`12` §6, `13`) | Resolves a registration question, not necessarily a production capability | Needs per-key ruling or evidence first; not ready to implement blindly | Could be unsafe if behavior is invented | Varies | NONE without a ruling/evidence task |
| Implement one of the 10 UNIMPLEMENTED ACTIVE hotkeys (`W/A/S/SS/D/H/C/Q/Pi`) | Not currently authorized — `14` §9 and the directive forbid inventing behavior; `26` §13 names them as invention-prone absent documented semantics | Conversational/behavioural; would not close a structural architectural gap by itself | Needs documented behavior contract per hotkey first | Moderate if behavior is invented or repo-root write is implied | Medium | NONE without per-hotkey contract + ruling |
| Expand the write surface beyond Native Write (append/mkdir/rename/delete/multi-file) | None — `27` R2 explicitly excludes those; `26` §12 forbids inventing failure/atomicity semantics | Would broaden the capability beyond its ruled contract | Would require new ruling + new contract text + new acceptance | High if unconstrained; explicitly restricted by current rulings | Medium | NONE — would reopen the Native Write contract or invent beyond it |
| Add a new operation kind beyond `hotkey` | None — `18` states one kind only until a future task defines others | Larger architectural change (new operation routing) | Needs contract + ruling + acceptance | High if done without authority | Large | NONE without explicit authority |
| Plan→execution request translation (plan content → execution envelope) | Not defined — `20` §4/§17/§18 explicitly list it as a future layer and forbid inventing it | Would connect Planner output to Agent input, a real architectural linkage gap | Needs a contract defining the mapping; not currently present | Moderate if done without contract | Medium-large | NOT authorized yet; it is a real candidate *after* authority is established |
| Persistent agent memory / session state | Not defined for v3 — repeatedly listed as future-only (`18`, `19`, `20`) | Would introduce stateful agent behavior | Needs new contract + security model; hidden state is restricted by Task 23 rule 9 | High if introduced without explicit authority | Large | NONE without explicit authority |
| Deployment / Git / testing / debugger modules | Named as future roles but not authorized as the next task | Would extend v3 horizontally | Each needs its own manifest + contract + tests | Depends on module | Large | NONE as the single next step without an authorizing task |
| Continue sequencing the existing roadmap by authoring the next missing contract/ruling that would unlock a real next capability | High — this is the repository's own sequencing pattern (discover → rule → contract → implement → audit) | Closes the gap between "future work is named" and "a next capability is authorized" | Ready now — investigation-only | Low (no production code) | Small (documentation) | **Selected direction** |

## Dependency Analysis

Strongest candidate direction: **establish the next authorized architectural increment through the same governance chain already used by Tasks 18–22**, rather than jump straight to implementation of any named-but-unauthorized capability.

For any later implementation candidate to become valid, it would first need:
- Prerequisites: an explicit executive decision or evidence ruling that selects and defines the candidate
- Missing contracts: a contract artifact that defines the capability's identity, semantics, failure mapping, and acceptance — grounded in `03`/`14`/`15`/`23` as applicable
- Required executive decisions: yes, for anything not already ruled (per `26` §15 and the `03` §8 rule)
- Required acceptance group: a named, deterministic acceptance set in `05` before implementation behavior is asserted
- Required security boundary: explicit containment/authority rules; any write or state change must be contract-defined, not invented (Task 23 rules 7–9)
- Required runtime wiring: only through existing composition-root injection and existing contracts; no Core changes unless authorized
- Required scenario: a real-scenario or equivalent deterministic acceptance path, not a synthetic behavior proof standing alone
- Required protected-file changes: none for an investigation-only task; any protected-file change would itself require explicit authority and would be reported

Therefore, the next authorized kind of task is **investigation / sequencing**, possibly followed by **executive ruling** and **contract authoring**, before any implementation.

## Security / Authority Analysis

Q7 verification against the protected-core list:

- `docs/v3/01-core-specification.md` — must not change for this task: PASS (no edit)
- `docs/v3/03-extension-contract.md` — must not change for this task: PASS (no edit)
- `docs/v3/04-decision-rules.md` — must not change for this task: PASS (no edit)
- `docs/v3/12-hotkey-registry.md` — must not change for this task: PASS (no edit)
- `modules/tool-bus/capabilities.json` — must not change for this task: PASS (no edit)

Also preserved without edit:
- `docs/v3/02`, `docs/v3/22`, `docs/v3/23` — protected by Task 22 audit pins and by NEG-20 boundary sets
- modules, runtime, composition, handler code, test behavior, Native Write contract — unchanged

No candidate selected here requires silently amending a Core contract. Any future candidate that does would have to say so explicitly and stop for contract authority (Task 23 rules 4–6).

## Decision

Q1–Q8 answer summary:

- Q1: Inventory above. The repository is a complete, audited, deterministic L0–L2 stack for one operation kind, with one shipped and audited write capability behind explicit opt-in.
- Q2: Repository-authoritative future work is repeatedly named (module roles, adapters, blocked hotkeys, UNIMPLEMENTED ACTIVE hotkeys, plan→execution mapping, memory, new operation kinds), but none is issued as the single next authorized implementation.
- Q3: The most important remaining architectural limitation is not a missing runtime feature but a missing *authorization/sequencing* artifact: the repository has not declared the next capability with contract + ruling + acceptance authority. Implementing anything else first would violate the repository's own decision chain.
- Q4: No authoritative next capability exists.
- Q5: See candidate table. The only candidate with high sequencing value and low risk is the investigation/sequencing task itself; all implementation candidates are currently NONE pending authority.
- Q6: The strongest direction is a new investigation/ruling/contract-authoring task that either selects an authorized next capability or explicitly defers it. Any later implementation still needs the full gate chain.
- Q7: PASS — no protected Core file is modified by this task or by the recommended next direction.
- Q8: `NO_NEXT_TASK_AUTHORIZED` for implementation. The next authorized direction is a new investigation/ruling task, not a Task 24 implementation.

Explicit decision:
- An implementation Task 24 is **not** authorized by current repository evidence.
- The repository's own governance pattern says the next move is to determine, from evidence and rulings, what the next increment should be — and to do that as an explicit task, not by inventing one.

## Recommended Next Task

Recommended next direction (not implemented in Task 23):

- Task type: **INVESTIGATION / EXECUTIVE RULING** (sequencing task first; contract authoring only after a ruling authorizes a specific capability)
- Why now: the stack is complete and audited for its current scope; continuing to implement without an authorized next capability would invent scope (forbidden); the repository still contains named-but-unauthorized future work that needs a governance decision before it becomes a task
- Source of authority: `01`–`05`, `12`, `14`, `18`–`20`, `22`–`28`, plus the NEG-20 boundary discipline already established in `test/policy-approval.test.mjs`
- Prerequisites: none beyond completing this investigation record
- Expected files: one new investigation/ruling artifact of the same investigation-only kind as `26`, `27`, `28`, and this document; a corresponding NEG-20 boundary extension if the task touches files beyond that artifact
- Expected acceptance group: the new task's own deterministic acceptance set, authored with the same discipline as Groups R/U and the NEG-20 boundary sets
- Security gate: must not modify protected Core files; must not invent a capability; must not reopen Native Write contract; must not weaken NEG-20
- Implementation gate: no implementation in the sequencing task; any later implementation only after contract + ruling + acceptance authority exist

## Explicit Non-Decisions

This task explicitly does **not** decide:
- which blocked hotkey, adapter, or UNIMPLEMENTED ACTIVE hotkey should be activated next
- whether plan→execution translation, memory, a new operation kind, or another module should be built
- whether any existing blocked/ambiguous/insufficient-hotkey status should change
- the content of any future contract, ruling, or handler
- any change to Native Write behavior, `12`, `01`–`04`, `22`, `23`, or `capabilities.json`

## Implementation Gate

For Task 23 itself:
- No implementation
- No production code change
- No capability invention
- No Native Write contract reopen
- No protected Core file change
- No test behavior change except the NEG-20 boundary extension required to authorize this document itself
- Native Write untouched
- Existing tests must stay green

For the recommended next task:
- It must first be an authorized investigation/ruling/contract step
- It must not become an implementation task unless and until the repository evidence actually authorizes one

## Evidence

- `git rev-parse HEAD` at session start: `9f2a27940e46ae53ec1540614e041d6f23e24574`
- `git pull --ff-only origin main` reported `Already up to date`
- Module/contract/docs read in full or in the required windows:
  - `01`, `02`, `03`, `04`, `05` (full where practical; `05` read in windows)
  - `12`, `14`, `23`, `24`, `25` (read in windows)
  - `26`, `27`, `28` (read in windows)
  - `15`, `16`, `18`, `19`, `20` (read in windows)
- NEG-20 boundary sets in `test/policy-approval.test.mjs` read for Tasks 16–22, and the Task 23 extension added with the same mechanism
- Repository text search run for roadmap/future/unimplemented/planned/next/capability/hotkey/tool/task patterns; results classified per Q2

## Git Evidence

Intended change for Task 23:
- `docs/v3/29-next-architectural-increment.md` (new investigation record)
- `test/policy-approval.test.mjs` (NEG-20 boundary extension only — Task-23 set added with the same pattern as Tasks 16–22)

Verification performed:
- `node --test test/*.test.mjs`
- `node test/scenario-harness.mjs --all`
- `node test/scenario-harness.mjs RT-006`
- `git diff --check`
- `git status --short --branch`
- `git diff --stat`
- `git diff`

The artifact is decision/investigation only; it does not implement, reopen, or weaken anything.
