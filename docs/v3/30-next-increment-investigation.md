# Task 24 — Next Architectural Increment Discovery

## Status

- INVESTIGATION_STATUS: COMPLETE
- IMPLEMENTATION_AUTHORIZED: NO
- NEXT_INVESTIGATION_AUTHORIZED: NO
- NO_NEXT_TASK_AUTHORIZED: YES (no candidate currently has sufficient repository authority to name and authorize a single next increment)

## Current Architecture State

After Task 23, Grimoire v3 is a deterministic L0→L2 stack for one operation kind:

- Operation kind: `hotkey` → `hotkeys:execute` only (`docs/v3/18-agent-orchestrator.md` §4/§17)
- Shipped write capability: `handler.save-files`, bound to `grimoire.key.G`, opt-in via `--workspace` (`docs/v3/14-hotkey-runtime.md` §6.1; `docs/v3/24-local-runtime.md`)
- Audited: Task 22 passed; Native Write audit findings none (`docs/v3/28-native-write-audit.md`)
- Execution path: Planner → Plan–Execution Composition (GATE) → Agent → Module Registry / Tool Bus / Hotkey Runtime / Report Bus (`docs/v3/20-plan-execution-composition.md`)
- Policy/Approval gate exists as an injected CS-13 layer (`docs/v3/23-policy-approval-contract.md`)
- Real-scenario harness runs RT-001…RT-006 over the Local Runtime
- Suite baseline: `305 tests / 55 suites`; `6/6` scenarios; RT-006 pass
- Protected Core/registry integrity pins still green

This is a complete, audited, narrow execution stack — not a general agent platform.

## Authoritative Sources

Primary:
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
- `docs/v3/29-next-architectural-increment.md`

Implementation/evidence:
- `modules/hotkeys/manifest.yaml`
- `modules/hotkeys/src/handlers.mjs`
- `modules/hotkeys/src/runtime.mjs`
- `modules/hotkeys/src/errors.mjs`
- `runtime/local-runtime.mjs`
- `test/policy-approval.test.mjs`
- `test/scenario-harness.mjs`
- `test/scenario-harness.test.mjs`
- `test/native-write.test.mjs`
- `test/scenarios/`
- `README.md` document index

## Task 23 Baseline

Task 23 explicitly concluded:
- NO_NEXT_TASK_AUTHORIZED
- No authoritative next implementation capability exists
- The next authorized direction is an investigation/ruling/contract-authoring task, not a Task 24 implementation
- Do not invent Task 24 implementation scope

Task 24 inherits that baseline. It does not override it.

## Candidate Increments

Candidates investigated (from repository-named future work, not invented):

1. ADAPTER_REQUIRED capability activation
2. blocked hotkey activation (conflict / ambiguous / insufficient)
3. UNIMPLEMENTED ACTIVE hotkey activation: `W`, `A`, `S`, `SS`, `D`, `H`, `C`, `Q`, `Pi`
4. expansion of Native Write
5. new operation kind
6. plan → execution translation
7. persistent memory / session state
8. deployment / cloud workspace capability
9. Git / local repository operations
10. command / shell execution capability
11. testing / debugger capability
12. documentation-only architectural consolidation
13. task 23-recommended next investigation/ruling/contract-authoring task itself

## Candidate Evaluation Matrix

| Candidate | Authority | Contract | Identity | Runtime fit | Operation kind | Tool Bus | Agent/GATE | Security boundary | Determinism | Failure mapping | Persistence | Credentials | Network | Git | Tests/scenarios | Protected Core impact | Sequencing | Scope without invention | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. ADAPTER_REQUIRED activation | LOW | NO (per-adapter) | adapter-specific | partial | may be TOOL | may be invoke/dependency | no change unless adapter changes behavior | undefined per adapter | possible per adapter | undefined per adapter | none inherent | none inherent | possibly | possibly | possible per adapter | none if adapter-only | medium | only if adapter contract exists | DEFERRED — no generic authority |
| 2. blocked hotkey activation | LOW | NO (per-key) | key-specific | yes (runtime already routes) | no | maybe | no change unless behavior invented | undefined for blocked meaning | possible if behavior defined | undefined | none | none | none | none | possible per key | none if only ruling/evidence | medium | only if behavior defined | DEFERRED — needs ruling/evidence first |
| 3. UNIMPLEMENTED ACTIVE hotkey activation | LOW | NO (per-hotkey) | key-specific | yes | no | maybe | no change if behavior is defined | undefined for conversational behaviors | possible if behavior defined | undefined | none | none | none | none | possible per key | none if only handler + contract | medium | only if behavior is documented, not invented | DEFERRED — `14` §9 forbids invention |
| 4. Native Write expansion | NONE | would reopen `27` R2/R4 | would be new semantics | yes but ruled out | no | maybe | no change if same path | would broaden attack surface | possible | would need new table | none | none | none | none | possible | possibly if semantics change | low — ruled out by `27` | NO — would reopen ruled contract |
| 5. new operation kind | NONE | NO | would be new routing | NO — Agent only accepts one kind | YES | YES | YES — Agent contract | new surface | possible | undefined | none | none | none | none | possible but large | NO unless authorized | low | NO — not authorized |
| 6. plan → execution translation | LOW | NO (not defined) | mapping undefined | NO — neither `18` nor `19` defines mapping | no | no | no if caller-supplied | undefined | possible | undefined | none | none | none | none | possible | NO unless mapping defined | medium | NO — not defined, forbidden to invent |
| 7. persistent memory/session state | NONE | NO | N/A | NO — introduces state | no | no | no | HIGH if hidden state | possible | undefined | YES — introduces state | none | none | none | possible | NO unless authorized | medium | NO — hidden state is restricted |
| 8. deployment/cloud workspace | NONE | NO | undefined | NO — many new surfaces | possibly | YES | YES if it changes execution | HIGH | possible | undefined | YES — remote state | YES — would need credentials | YES | possibly | possible but large | NO unless authorized | medium | NO — premature per Task 22/23 |
| 9. Git/local repository operations | NONE | NO | undefined | NO — new execution + mutation | possibly | YES | YES if execution changes | HIGH | possible | undefined | YES — repo mutation | none | none | YES | possible | NO unless authorized | medium | NO — not authorized |
| 10. command/shell execution | NONE | NO | undefined | NO — new execution surface | possibly | YES | YES if execution changes | HIGH | possible | undefined | YES — process exec | none | YES | possibly | possible | NO unless authorized | medium | NO — not authorized |
| 11. testing/debugger capability | LOW | NO (as module roles) | undefined | possible as module roles | no | maybe | no | undefined | possible | undefined | none | none | none | none | possible | NO unless authorized | medium | DEFERRED — roles exist, module not built |
| 12. documentation-only architectural consolidation | HIGH (allowed) | existing | N/A | N/A | no | no | no | LOW | HIGH | N/A | none | none | none | none | possible | NO | medium | YES — valid investigation-only work |
| 13. next investigation/ruling/contract-authoring task | HIGH (authority-preserving) | NO until ruled | NO until ruled | NO until ruled | no | no | no | LOW for investigation | N/A | N/A | none | none | none | none | possible | NO | HIGH | YES — this is the recommended next step |

## Dependency Analysis

Key dependency relationships, assessed against current architecture:

- Command execution capability cannot be justified as a single atomic next step because it introduces process execution, determinism, failure classification, and containment questions that are wider than any one ruled capability.
- Cloud workspace is not one capability. It decomposes into at least: workspace contract, command execution, network, credentials, Git, remote persistence, deployment. None of those is currently authorized; several are explicitly out of scope for this repository right now.
- Git operations depend on commit and possibly push. Push is a G0-safety action in `04` and is not currently part of any authorized Grimoire capability. That alone blocks Git automation as a next increment.
- Plan → execution translation is blocked by absence of a contract defining the mapping. `20` §4/§17/§18 explicitly list it as a future layer and forbid inventing it. So it cannot be the next authorized implementation.
- New operation kind is blocked by `18` §4/§17: one kind only until a future task defines others. Agent semantics and acceptance would both need new authority.
- Persistent memory/session state is blocked by the hidden-state restriction and by absence of any contract defining what state is legitimate, where it lives, and how it degrades.
- Adapter/blocked-hotkey/UNIMPLEMENTED-ACTIVE activation are not generically blockable, but they are also not generically authorized. Each requires its own per-item contract/ruling/evidence before implementation.
- Native Write expansion is blocked by `27` R2/R4 and the Task 23 rule against reopening Tasks 18–22.

So the repository's named future work is real, but it is fragmented into many undeamed, undercontrated, underauthorized pieces. None has currently sufficient authority to become the single next increment.

## Security / Authority Analysis

Authority:
- No existing authoritative next capability exists (`29` Q4 explicit).
- Registry rows, TODOs, comments, and future-facing descriptions are not implementation authority (`29` Q2 classification; decision rule 1–3).

Security questions for the broader candidate space:
- Command execution: would add process execution and a new failure/escape surface; containment rule absent.
- Network: would add network access; no current network authority or credential model.
- Credentials: would add authority not currently present; no credential model in repository.
- Git mutation/push: would modify repository state and introduce push, which is G0-gated.
- Persistent state: would introduce state; currently no authorized persistence model.
- Cloud workspace: compounds all of the above.
- New operation kind: would add new routing and new execution semantics.
- Plan→execution mapping: would invent a capability mapping that is not defined.
- Native Write expansion: would broaden filesystem mutation beyond ruled contract.

Conclusion:
- Any candidate that introduces process execution, network, credentials, repository push, or hidden persistent state currently lacks a defined security boundary in this repository.
- Therefore, for this task, IMPLEMENTATION_AUTHORIZED remains NO and NEXT_INVESTIGATION_AUTHORIZED remains NO for any implementation-facing candidate.

## Executive Decisions Required

No single executive decision currently exists that authorizes one specific next increment. At minimum, any future candidate would require its own explicit decisions of the form:

ED-01
Question: Which candidate, if any, becomes the next authorized increment?
Options: one specific candidate vs explicit deferral
Current Evidence: repository names many future items; none has full contract + ruling + acceptance authority
Recommended Option: deferral of implementation; authorize a next investigation/ruling/contract-authoring task only if a specific candidate is selected and justified
Reason: no current authoritative single next capability
Blocking Consequence: selecting without authority violates Task 23/24 governance

ED-02
Question: Does the next increment require a new operation kind?
Options: no / yes with new authority
Current Evidence: `18` says one kind only until a future task defines others
Recommended Option: no for now
Reason: new kind needs Agent contract + acceptance authority
Blocking Consequence: authorizing a kind-less extension could create unsupported routing

ED-03
Question: Does the next increment require process execution, network, credentials, or repository push?
Options: no / yes with explicit security boundary
Current Evidence: none authorized; no credential/network/push model
Recommended Option: no for now
Reason: each introduces a new privilege/attack surface
Blocking Consequence: authorizing without boundary weakens GATE/security posture

ED-04
Question: Does the next increment introduce persistent or hidden state?
Options: no / yes with explicit state contract
Current Evidence: no authorized persistence model; hidden state restricted
Recommended Option: no for now
Reason: hidden state must be explicitly justified and authorized
Blocking Consequence: state without contract is unauthorized architecture

ED-05
Question: Does the next increment modify protected Core files?
Options: no / yes with separately authorized contract amendment
Current Evidence: PROTECTED_CORE_CHANGES_AUTHORIZED = NO for this task
Recommended Option: no
Reason: protected Core must not change without separate authority
Blocking Consequence: any protected-file change requires a separate authority decision

ED-06
Question: Does the next increment expand Native Write beyond ruled semantics?
Options: no
Current Evidence: `27` R2/R4; Task 23 forbids reopening Tasks 18–22
Recommended Option: no
Reason: expansion would reopen ruled contract
Blocking Consequence: any expansion requires a new ruling + contract

ED-07
Question: Does the next increment require a new Tool Bus capability/provider/invoke path?
Options: no / yes with per-capability contract + acceptance
Current Evidence: Tool Bus is check-only for the real path; new capabilities need their own rules
Recommended Option: not until a specific capability is authorized
Reason: no generic authority to add a capability
Blocking Consequence: adding capabilities speculatively violates `15` §18 rule 1

## Contract Requirements

For any future implementation candidate, minimum future contract artifacts would include:
- Identity: deterministic, unambiguous capability/handler/operation identity
- Inputs: exact schema
- Outputs: exact shape
- Success semantics: deterministic definition
- Failure semantics: exact mapping onto existing Core classes; no new taxonomy unless separately authorized
- Security boundary: containment, privilege, and failure containment rules
- Containment: explicit writable/execution/root boundary if applicable
- Approval behavior: whether GATE semantics change (they should not unless ruled)
- Tool Bus behavior: whether new capability/provider/invoke is required
- Runtime wiring: composition-root responsibility, opt-in vs default
- Determinism: whether acceptance can be deterministic
- Acceptance tests: a named acceptance group in `05`
- Real scenarios: deterministic scenario proof if applicable
- Versioning: manifest/contract versioning where relevant
- Protected-file impact: explicit statement; none unless separately authorized

Where an existing contract already covers an item, reference it rather than inventing a duplicate.

## Acceptance Requirements

Any future implementation would need:
- A named acceptance group in `docs/v3/05-acceptance-tests.md`
- Deterministic tests, including refusal/failure/mutation coverage where applicable
- A deterministic real scenario (or equivalent) if it exercises execution/writes/tool paths
- NEG-20 boundary extension on the same exact mechanism used by Tasks 16–23

No such acceptance set currently exists for any single next increment, which is itself a reason for deferral.

## Sequencing Recommendation

Recommended sequencing behavior (not an implementation authorization):
1. Continue with an explicit investigation/ruling/contract-authoring task that either selects one specific candidate and justifies it with authority, or explicitly defers.
2. Do not jump to implementation of any candidate from this document.
3. Do not fragment into multiple simultaneous new-capability efforts; the current architecture is narrow and audited, so scope should stay narrow until a single next capability is clearly authorized.

This document itself is that deferral.

## Rejected / Deferred Candidates

Rejected for this task (not for all time, but not authorized now):
- Native Write expansion
- new operation kind
- plan → execution translation
- persistent memory/session state
- deployment/cloud workspace implementation
- Git/local repository operations
- command/shell execution capability
- any broad “cloud development environment” implementation

Deferred (still named in repository, but not authorized as the single next increment):
- ADAPTER_REQUIRED activation (per-adapter, needs per-adapter authority)
- blocked hotkeys (needs per-key ruling/evidence)
- UNIMPLEMENTED ACTIVE hotkeys (needs per-hotkey documented behavior, not invention)
- testing/debugger as a built module (roles exist, module not authorized yet)
- any other specific capability not yet ruled/contracted/accepted

## Implementation Gate

For Task 24:
- IMPLEMENTATION_AUTHORIZED = NO
- No production code
- No new capability
- No new operation kind
- No shell execution / network / credentials / Git automation / cloud workspace / deployment / persistent memory
- No Native Write expansion
- No protected Core changes
- No NEG-20 weakening
- No reopening of Tasks 18–22

For any later task to convert IMPLEMENTATION_AUTHORIZED from NO to YES, it must have, at minimum:
- an explicit authoritative decision identifying the specific capability
- a complete semantic contract (identity/inputs/outputs/success/failure/security/containment/approval/Tool Bus/runtime wiring/versioning/protected-file impact)
- a named deterministic acceptance group
- a deterministic real-scenario proof if execution/writes/tools are involved
- explicit protection of existing GATE and Native Write contract
- an explicit NEG-20 boundary extension if files beyond the investigation artifact are touched

## Decision

NEXT_INVESTIGATION_AUTHORIZED: NO

NO_NEXT_TASK_AUTHORIZED: YES

Reason: the repository has many named-but-underauthorized future items, but no single one currently has sufficient authority (contract + ruling + acceptance + security boundary) to be named as the next authorized increment. The correct architectural outcome is explicit deferral, not invention of a Task 24 implementation.

What is missing:
- a specific candidate selected by authority, not by attractiveness
- per-candidate contract/ruling/evidence where needed
- a deterministic acceptance strategy for any chosen candidate
- an explicit security boundary for any candidate that adds execution, network, credentials, push, or state

## Recommended Next Task

Recommended next direction:
- Another investigation/ruling/contract-authoring task that either:
  - selects exactly one candidate and identifies the missing decisions/contracts/acceptance required before implementation, or
  - explicitly defers and explains what executive authority is missing

Not authorized:
- no implementation task
- no capability
- no operation kind
- no Tool Bus provider
- no handler
- no runtime change

## Explicit Non-Decisions

This task does NOT decide:
- which adapter, blocked hotkey, or UNIMPLEMENTED ACTIVE hotkey should be activated
- whether plan→execution translation, memory, a new operation kind, deployment, Git, or command execution should ever be built
- any Native Write expansion
- any protected Core change
- any change to GATE, Agent, Planner, Tool Bus, Report Bus, Module Registry, or Native Write
- any future contract text or handler code

## Evidence

- `docs/v3/29-next-architectural-increment.md` read completely; its NO_NEXT_TASK_AUTHORIZED conclusion inherited
- Task 23-listed authoritative sources read in the prior task and used as the evidence base here
- Current suite baseline verified: 305 tests / 55 suites; 6/6 scenarios; RT-006 pass
- NEG-20 boundary sets for Tasks 16–23 reviewed; Task 24 boundary extension added with the same pattern
- `git status --short --branch`, `git diff --check`, `git diff --stat` reviewed

## Git Evidence

Intended change for Task 24:
- `docs/v3/30-next-increment-investigation.md`
- `test/policy-approval.test.mjs` (NEG-20 boundary extension only — Task-24 two-file set)

Verification run:
- `node --test test/policy-approval.test.mjs`
- `node --test test/*.test.mjs`
- `node test/scenario-harness.mjs --all`
- `git diff --check`
- `git status --short --branch`
- `git diff --stat`
- `git diff -- test/policy-approval.test.mjs docs/v3/30-next-increment-investigation.md`

Deliverable type:
- investigation/authority-assessment only
- no implementation, no capability, no contract, no reopening
