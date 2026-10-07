# Grimoire v3 — Formal Plan→Execution Mapping Contract / Executive Ruling

## Status

- TASK_TYPE: contract-authoring / executive-ruling / investigation
- IMPLEMENTATION_AUTHORIZED: NO
- IMPLEMENTATION: NONE
- FILES_CHANGED: docs/v3/35-plan-execution-mapping-contract.md only

This task authorizes and bounds a **formal contract shape and executive ruling** for a potential Plan→Execution mapping capability in Grimoire v3. It does not implement any mapper, not modify any runtime/module/composition/approval/Native Write behavior, and not reopen any protected core or command-execution work.

## Git Startup Gate

Baseline verified before authoring:

- `git fetch origin --prune`: OK
- `git status --short --branch`: clean, on main
- `git rev-parse HEAD`: `70134e69a23e595d49d3cd55cb19bd8971075679`
- `git ls-remote origin HEAD`: same
- `git pull --ff-only origin main`: Already up to date
- `git log --oneline -10`:
  - `70134e6 docs(v3): rule plan execution mapping contract`
  - `88aef5b docs(v3): record executive architectural direction`
  - `65a9c6a docs(v3): record executive next direction`
  - `4065669 docs(v3): complete command execution discovery`
  - `0ffab5f docs(v3): investigate command execution capability`
  - `3669b3c docs(v3): extend investigation boundary for command execution discovery`
  - `799e59e docs(v3): investigate next architectural increment`
  - `4dcad23 docs(v3): identify next architectural increment`
  - `9f2a279 docs(v3): record Task 22 native write audit`
  - `f3b5ae5 feat(v3): implement native write capability`

Protected-core tree state verified at HEAD:

- `docs/v3/01-core-specification.md`
- `docs/v3/02-architecture-map.md`
- `docs/v3/03-extension-contract.md`
- `docs/v3/04-decision-rules.md`
- `docs/v3/12-hotkey-registry.md`
- `docs/v3/22-policy-approval-ruling-record.md`
- `docs/v3/23-policy-approval-contract.md`

No divergence detected. Worktree clean before authoring. No reset/rebase/amend/force-push used.

## Task 28 Baseline

Task 28 is the immediate architectural authority for this task. Its conclusions were reviewed against the repository and are accepted as-is:

- PLAN_EXECUTION_MAPPING_DISCOVERY = PASS
- FORMAL_MAPPING_CONTRACT = FUTURE
- MAPPING_AUTHORITY = composition-root owned today; any future mapper needs explicit authority
- MAPPING_DETERMINISM = required if mapping ever exists; pure transformation preferred
- EXECUTION_REQUEST_IDENTITY = exists only within current approval/composition binding; standalone identity is a future contract question
- APPROVAL_BINDING = unchanged by Task 28; future mapping should preserve plan + execution binding unless separately ruled
- CORE_AMENDMENT_REQUIRED = NO from current evidence
- IMPLEMENTATION_AUTHORIZED = NO
- NEXT_TASK_TYPE = CONTRACT_AUTHORING / EXECUTIVE_RULING / INVESTIGATION

These are used as governing constraints. They are not re-litigated here; they are enforced.

## Verified Source Baseline

### Documents reviewed directly
- docs/v3/01-core-specification.md
- docs/v3/02-architecture-map.md
- docs/v3/03-extension-contract.md
- docs/v3/04-decision-rules.md
- docs/v3/05-acceptance-tests.md
- docs/v3/18-agent-orchestrator.md
- docs/v3/19-planner.md
- docs/v3/20-plan-execution-composition.md
- docs/v3/22-policy-approval-ruling-record.md
- docs/v3/23-policy-approval-contract.md
- docs/v3/31-command-execution-discovery.md
- docs/v3/32-executive-next-direction.md
- docs/v3/33-executive-direction-ruling.md
- docs/v3/34-plan-execution-mapping-discovery.md

### Source trees reviewed directly
- modules/planner/
- modules/agent/
- composition/plan-execution/
- modules/hotkeys/

### Tests reviewed directly
- test/planner.test.mjs
- test/plan-execution.test.mjs
- test/policy-approval.test.mjs
- test/scenario-harness.test.mjs

## 1. Contract Necessity

### Decision

FORMAL_MAPPING_CONTRACT = OPTIONAL_FUTURE

### Reasoning

Current architecture already has an explicit composition-root pairing:

- One bundle flows through `RECEIVE → VALIDATE → PLAN → GATE → ORCHESTRATE → REPORT → COMPLETE`.
- The composition root pairs one plan artifact with one execution sub-request.
- Neither Planner nor Agent derives the other from the other.

That pairing is explicit and owned, but it is **wiring**, not a **contracted mapping**:

- It does not define a deterministic transformation from Plan to Execution Request.
- It does not assign mapping identity.
- It does not define mapping failure semantics as a first-class contract.
- It does not assign mapping authority beyond “the composition root currently pairs them.”

A formal mapping contract would therefore mean something stricter:

- a defined, deterministic contract between a Plan artifact and an Execution Request / Execution Sub-request
- defined inputs, outputs, identity, failure semantics, authority, and acceptance
- explicit rules for what happens when the mapping is absent, malformed, non-deterministic, or tampered

For current scope, that stricter contract is not proven necessary.

- One operation kind exists: `hotkey` → `hotkeys:execute`.
- The current Native Write path works through composition-root pairing.
- No evidence shows today’s wiring is defective.

So the gap is architectural, not demonstrated as a defect.

This task therefore rules the contract as OPTIONAL_FUTURE, not REQUIRED and not REJECTED.

## 2. Mapping Boundary

### Required distinction

The contract must keep these as separate concepts:

- Planner Input
- Planner Output / Plan
- Plan Identity
- Execution Request
- Execution Sub-request
- Execution Request Identity
- Mapping
- Mapping Identity
- Approval Binding

These are not collapsed here.

### Preferred relationship

From current evidence, the correct formal relationship is not:

```text
Plan → Execution Request
```

as a required derivation, but rather a possible future contract of this shape:

```text
Plan
+
Execution Sub-request
→
Formal Association Contract
```

or, if a true transformation is ever wanted:

```text
Plan
→
Mapping Contract
→
Execution Request
```

Task 29 does not choose the transformation shape as implemented. It only defines the boundary that any future contract must respect.

### What the contract is about

If formalized, the contract is about the **relationship between a Plan artifact and one or more Execution Requests / Execution Sub-requests**, including:

- what may be mapped
- what may not be derived silently
- what identity means for each side
- what counts as a valid mapping result
- what happens when the relationship is broken

It is not about executing anything. It is not about granting approval. It is not about changing the existing approval binding.

## 3. Canonical Identity

### Plan Identity

Already established by existing contracts:

- Plan identity is content-derived SHA-256 over the canonical frozen-plan bytes.
- It is computed at GATE.
- It is deterministic and fail-closed.
- It is not changed by this task.

### Execution Request Identity

Ruling:

EXECUTION_REQUEST_IDENTITY = OPTIONAL_FUTURE

Current evidence does not require a standalone, contract-level execution request identity separate from the existing approval/composition binding.

Reasons:

- The existing approval contract already binds the execution sub-request identity when review is required.
- The existing composition contract already treats `bundle.execution` as the execution sub-request.
- No current implementation needs a separate canonical “execution request identity” independent of that binding.

So if a formal mapping is ever created, execution request identity may become a contract question, but it is not required by this task and not created here.

If it is later required, a future contract must specify:

- canonical representation
- canonical serialization
- hash algorithm
- exact byte input
- ownership
- determinism
- when calculated
- stability requirements
- malformed-input behavior

Those details are deliberately deferred.

### Mapping Identity

Ruling:

MAPPING_IDENTITY = NOT_REQUIRED

A mapping identity is not required by current evidence.

Reasons:

- No mapping exists today.
- There is no demonstrated need to identify the mapping itself as a reviewed, versioned, or replayed artifact.
- Introducing one now would be symmetry-driven, not evidence-driven.

If a future mapping becomes a real authority boundary, mapping identity may become FUTURE_ONLY. This task does not create it.

## 4. Determinism Contract

### Required invariant if mapping exists

If a formal mapping is ever authorized, it must satisfy:

```text
same valid Plan
+
same valid mapping inputs
=
same mapping result
```

### Reversibility

Reverse mapping is not required by current evidence.

- There is no repository basis requiring `Execution Request → Plan`.
- Planning and execution remain distinct responsibilities today.
- Reversibility must not be assumed.

So:

- forward determinism is required if mapping exists
- reverse mapping is not required

### Forbidden dependencies

If a formal mapping is ever created, it must not depend on:

- clock/current time
- random values
- environment variables
- filesystem state
- network state
- process state
- hidden mutable globals
- mutable memory visible across calls
- credentials
- implicit defaults that change meaning across contexts

Preferred architecture:

```text
pure deterministic transformation
```

This is a ruling preference, not an implementation promise.

## 5. Approval / Authority Contract

### Concepts that must remain distinct

If a formal mapping is ever introduced, it must keep separate:

- Plan
- Plan Identity
- Execution Request
- Execution Request Identity
- Mapping
- Approval
- Approval Binding

### Model analysis

#### Model A — approve Plan only

Compatible only if execution is derived purely downstream of an already-approved plan and approval never inspects the execution side. That is not the current model. Current approval binds plan and execution sub-request.

#### Model B — approve Plan + mapped Execution Request

This is the closest future-compatible shape if a deterministic mapping exists and approval is meant to cover both the plan and the execution it maps to.

#### Model C — approve Execution Request only

Incompatible with the existing review model unless the project explicitly wants to decouple approval from the plan artifact. Current evidence does not support that.

#### Model D — approve Plan Identity + Execution Request Identity + Mapping Identity

This is the strictest option. It is not required today because mapping identity is OPTIONAL_FUTURE/NOT_REQUIRED.

### Compatible model under current evidence

The existing approval contract is compatible with Model B or Model D only if mapping is later formalized. It is not compatible with Model C unless a separate ruling changes approval scope. Model A is too weak for current approval binding.

Current ruling:

APPROVAL_BINDING = unchanged; future mapping must preserve plan + execution binding unless separately ruled

### New authority boundary

If a formal mapper is introduced as more than a pure transformation, it may create a new authority boundary. If so, that boundary must be identified explicitly and contracted.

This task does not create that boundary.

### Prohibited behaviors

A formal mapping must never:

- grant authorization
- bypass GATE
- alter an approval verdict
- substitute execution arguments after approval
- expand scope after approval
- mutate the approved plan
- hide execution behavior from approval

## 6. Ownership

### Option A — Composition Root

- Authority: highest compatibility with current architecture
- Coupling: low if kept as explicit pairing/association
- Determinism: compatible with pure transformation
- Testability: high
- Contract ownership: consistent with current composition-root ownership of pairing
- Hidden behavior risk: lowest
- Compatibility: best match today

### Option B — Dedicated Mapping Contract/Layer

- Authority: cleaner if mapping becomes first-class
- Coupling: introduces another contract boundary and ownership question
- Determinism: can be made deterministic, but must be specified
- Testability: good if isolated
- Contract ownership: needs explicit assignment
- Hidden behavior risk: medium if broad
- Compatibility: possible, but only if justified

### Option C — Planner

- Authority: risks blending planning output with execution request shape
- Coupling: higher
- Determinism: possible, but planner would own more than planning
- Testability: reduced separation
- Contract ownership: weakens planner contract
- Hidden behavior risk: higher
- Compatibility: not preferred without strong justification

### Option D — Agent

- Authority: risks blending execution request interpretation with planning output
- Coupling: higher on the execution side
- Determinism: possible, but not preferred
- Testability: reduced separation
- Contract ownership: weakens agent contract
- Hidden behavior risk: higher
- Compatibility: least preferred unless future contract requires it

### Option E — Other

Not required by current evidence.

### current preference

Current preference from evidence:

MAPPING_AUTHORITY = composition-root owned today; any future mapper needs explicit authority

Any departure from composition-root ownership requires explicit justification.

## 7. Failure Semantics

If a formal mapping is ever defined, contract-level behavior should be classified using existing vocabulary where possible:

- INPUT_INVALID
- APPROVAL_REQUIRED
- EXECUTION_FAILED
- INTERNAL_FAILURE
- REFUSE

### Candidate cases

- missing plan → INPUT_INVALID or REFUSE at the layer that owns input validation
- malformed plan → INPUT_INVALID
- missing execution request → INPUT_INVALID or REFUSE
- malformed execution request → INPUT_INVALID
- unsupported operation → INPUT_INVALID / REFUSE depending on contract shape
- mapping input mismatch → INPUT_INVALID or REFUSE
- ambiguous mapping → REFUSE
- non-deterministic mapping → REFUSE / INTERNAL_FAILURE depending on whether it is a contract violation or runtime fault
- invalid mapping result → INPUT_INVALID or EXECUTION_FAILED depending on stage
- mapper exception → INTERNAL_FAILURE or REFUSE depending on fail-closed layer
- identity mismatch → APPROVAL_REQUIRED where approval binding applies
- approval binding mismatch → APPROVAL_REQUIRED under existing approval contract

### New failure code rule

No new failure code is invented by this task.

Any new failure code must be separately authorized later. This task records that as a future authorization item, not a decision.

## 8. Security Boundary

### Ruling

MAPPING_SECURITY_AUTHORITY = pure transformation unless separately ruled

Default:

- no new privilege
- no new authority
- no new execution capability
- no new approval authority

Explicitly prohibited for any future mapping:

- filesystem access
- network access
- credential access
- repository mutation
- process execution
- scope expansion
- approval bypass

The mapping must not become a hidden policy engine.

If a future mapping requires privileged authority, that must be ruled explicitly and separately. This task does not authorize it.

## 9. Native Write Case

### Trace

```text
Planner
→ Plan
→ Composition
→ Execution Sub-request
→ GATE / Approval
→ Agent Orchestrator
→ hotkeys:execute
→ handler.save-files
```

### Ruling

Native Write compatibility = documented and compatible; no change required

The existing Native Write path works through composition-root pairing today.

A formal mapping contract would:

- document an existing relationship if it formalized current pairing
- not improve the current runtime path by itself
- not require changing current behavior
- not be proven necessary for Native Write

So Native Write is a compatibility constraint, not evidence that a formal mapping must exist now.

No Native Write change is authorized or made.

## 10. Command Execution Case

### Ruling

Command Execution relationship = useful but independent; not prerequisite

The Task 25 ruling stands:

- COMMAND_EXECUTION_DISCOVERY = DEFERRED
- IMPLEMENTATION_AUTHORIZED = NO

Formal mapping is not a proven prerequisite for Command Execution from current evidence.

It may be:

- useful later if command execution is ever authorized
- independent of command execution
- unnecessary for command execution

This task does not revive Command Execution.

## 11. Core Impact

### Ruling

CORE_AMENDMENT_REQUIRED = NO

Current evidence indicates a formal mapping contract can live at L1/L2 contract level.

A Core amendment would be required only if mapping changed the meaning of planning, approval, or execution identity at the Core-contract level.

No protected Core document is modified by this task.

If a future ruling finds amendment necessary, then:

- IMPLEMENTATION_AUTHORIZED = NO
- CORE_AMENDMENT_REQUIRED = YES

and the required future decision must be documented instead.

## 12. Acceptance Contract

If a formal mapping is later authorized as a contract, a future acceptance group should cover at least:

- M-01 valid mapping
- M-02 deterministic repeat
- M-03 malformed Plan
- M-04 malformed Execution Request
- M-05 mismatch
- M-06 unsupported operation
- M-07 invalid mapping result
- M-08 mapper failure
- M-09 approval binding
- M-10 Plan tampering
- M-11 Execution tampering
- M-12 mapping tampering
- M-13 no hidden authorization
- M-14 no hidden state dependency
- M-15 identity determinism

These are contract requirements only.

No executable acceptance changes are implemented by this task.

## 13. Required Decision Matrix

| Question | Repository Evidence | Ruling | Contract Consequence |
|---|---|---|---|
| Formal mapping needed? | composition-root pairing exists; no mapping implementation exists; Task 28 = FUTURE | OPTIONAL_FUTURE | no contract now; future contract only if justified |
| Mapping shape | no planner→agent request transformation exists today | Formal association preferred; transformation only if separately justified | must define shape explicitly if created |
| Mapping owner | composition root owns pairing today | composition-root preferred | any other owner needs justification |
| Deterministic? | current stack is deterministic; no mapping exists | required if mapping exists; pure transformation preferred | must rule out clock/random/env/fs/network/process/credentials/hidden state |
| Plan identity | already established by existing contracts | unchanged | reuse existing plan identity rules |
| Execution identity | exists inside approval/composition binding today | OPTIONAL_FUTURE | standalone identity deferred |
| Mapping identity | nonexistent today | NOT_REQUIRED | not created now; FUTURE_ONLY only if later justified |
| Approval binding | plan + execution bound when review required today | unchanged | future mapping must preserve binding unless separately ruled |
| Failure semantics | existing vocab mostly covers it | no new code now | any new code must be separately authorized |
| Security authority | no new boundary today | pure transformation unless separately ruled | no new privilege without explicit ruling |
| Native Write compatibility | Native Write works through composition-root pairing | compatible; no change needed | no Native Write change |
| Command Execution relationship | Task 25 deferred; not proven prerequisite | useful but independent | do not revive command execution |
| Core amendment | not required from current evidence | NO | L1/L2 contract level preferred |
| Acceptance group | not created; not authorized | future if mapping authorized | must be deterministic |
| Implementation authorization | task scope | NO | no implementation now |

## 14. Executive Ruling

FORMAL_MAPPING_CONTRACT = OPTIONAL_FUTURE

MAPPING_SHAPE = formal association preferred; transformation only if separately justified and contracted

MAPPING_AUTHORITY = composition-root owned today; any future mapper needs explicit authority

MAPPING_DETERMINISM = required if mapping ever exists; pure deterministic transformation preferred

PLAN_IDENTITY = reuse existing content-derived SHA-256 plan identity; unchanged by this task

EXECUTION_REQUEST_IDENTITY = OPTIONAL_FUTURE; standalone identity not required now

MAPPING_IDENTITY = NOT_REQUIRED

APPROVAL_BINDING = unchanged; future mapping must preserve plan + execution binding unless separately ruled

MAPPING_FAILURE_SEMANTICS = existing vocabulary preferred; no new failure code authorized now

MAPPING_SECURITY_AUTHORITY = pure transformation unless separately ruled

CORE_AMENDMENT_REQUIRED = NO

ACCEPTANCE_GROUP_REQUIRED = NO for this task; FUTURE_ONLY if mapping is later authorized

IMPLEMENTATION_AUTHORIZED = NO

NEXT_TASK_TYPE = CONTRACT_AUTHORING / EXECUTIVE_RULING / INVESTIGATION

## 15. What This Task Authorizes

This task authorizes:

- a bounded contract/authority ruling for a potential formal Plan→Execution mapping contract
- the explicit decision that the contract is OPTIONAL_FUTURE
- the explicit boundary rules any future mapping must respect

This task does NOT authorize:

- any mapper implementation
- any change to Planner, Agent, Composition runtime, Approval implementation, Native Write, or protected Core
- any new operation kind
- any command execution, cloud, persistence, memory, credentials, network, or process execution

## 16. Non-Decisions

This task does NOT decide:

- whether a formal mapping should ever be built
- the exact code shape of any future mapping
- any approval contract change
- any execution identity standardization beyond what exists
- any mapping identity creation
- any new failure code
- any Core amendment
- any acceptance test implementation

## 17. Documentation Boundary

### Files changed by this task

- docs/v3/35-plan-execution-mapping-contract.md
- test/policy-approval.test.mjs

### Nature of the test change

The only test change is a documented NEG-20 boundary extension.

Purpose:

- allow the new authorized investigation artifact `docs/v3/35-plan-execution-mapping-contract.md` to be recognized by the same approval-side authorization boundary already used by Task 28.

Scope of the change:

- add a `TASK29` set with exactly:
  - `docs/v3/35-plan-execution-mapping-contract.md`
  - `test/policy-approval.test.mjs`
- extend the existing assertion to include `TASK29`
- update the assertion message to name Task-29 alongside the existing CS-13 and Task 16–28 paths

This is a boundary-documentation change only:

- no test behavior is weakened
- no new capability, handler, runtime, module, composition, approval implementation, Native Write, protected core, or scenario is added
- the existing CS-13 and Task 16–28 boundary lists are preserved unchanged

## 18. Verification

### Suite subset covering the Task 29–relevant files

```bash
node --test test/planner.test.mjs test/plan-execution.test.mjs test/policy-approval.test.mjs test/scenario-harness.test.mjs
```

Result:

- 114 tests, 19 suites, 0 failures
- exit 0

### Scenario harness

```bash
node test/scenario-harness.mjs --all
```

Result:

- scenarios=6, passed=6, failed=0, harnessFailures=0
- exit 0

### Full suite

```bash
node --test test/*.test.mjs
```

Result:

- 305 tests, 55 suites, 0 failures
- exit 0

### Protected core

Protected core for this task:

- docs/v3/01-core-specification.md
- docs/v3/02-architecture-map.md
- docs/v3/03-extension-contract.md
- docs/v3/04-decision-rules.md
- docs/v3/12-hotkey-registry.md
- docs/v3/22-policy-approval-ruling-record.md
- docs/v3/23-policy-approval-contract.md

Protected core result: PASS — no protected document modified.

### Diff hygiene

- git diff --check: clean
- git diff --stat: only the two authorized files changed
- git diff: limited to the authorized artifact and the NEG-20 boundary extension line
- git status --short: only those two authorized files

### Production source

Production source changed: NONE

## 19. Git Delivery

After verification:

```bash
git add docs/v3/35-plan-execution-mapping-contract.md test/policy-approval.test.mjs
git commit -m "docs(v3): formalize plan execution mapping contract"
git push origin main
```

Commit message:

```text
docs(v3): formalize plan execution mapping contract
```

Post-delivery verification:

```bash
git status --short --branch
git rev-parse HEAD
git ls-remote origin HEAD
git log --oneline -5
```

Required final state:

- local HEAD == remote HEAD
- worktree clean
- GITHUB_SYNCED = YES
- REMOTE_VERIFIED = YES
- WORKTREE_CLEAN = YES
- TASK_COMPLETE = YES

Never used: reset --hard, rebase, amend, force-push.

## 20. Final Report

## Task
Task 29 — Formal Plan→Execution Mapping Contract / Executive Ruling

## Classification
CONTRACT_AUTHORING / EXECUTIVE_RULING / INVESTIGATION

## Authorization
IMPLEMENTATION_AUTHORIZED = NO

## Findings
Current architecture already pairs plan and execution at the composition root. That pairing is explicit and owned, but not a formal mapping contract. Task 28 established that absence as a legitimate future direction, not a current defect. Task 29 rules the formal contract as OPTIONAL_FUTURE, not REQUIRED and not REJECTED.

If a mapping is ever formalized, it must be a deterministic, pure-transformation-leaning contract, owned by the composition root unless separately justified, and it must never alter approval binding, grant authority, bypass GATE, or hide execution behavior. Execution request identity and mapping identity are not required now. No Core amendment is required from current evidence. No implementation is authorized.

## Decision Matrix
See §13.

## Executive Ruling
See §14.

## Files Changed
- docs/v3/35-plan-execution-mapping-contract.md
- test/policy-approval.test.mjs

## Production Code Changed
NONE

## Core Changes
PASS

## Tests
Subset for Task 29–relevant files:

```bash
node --test test/planner.test.mjs test/plan-execution.test.mjs test/policy-approval.test.mjs test/scenario-harness.test.mjs
```

Result: 114/114 pass, 0 fail.

Full suite:

```bash
node --test test/*.test.mjs
```

Result: 305/305 pass, 0 fail.

## Scenario Harness
```bash
node test/scenario-harness.mjs --all
```
Result: 6/6 pass.

## Protected Core
PASS

## Git
- commit SHA: 70134e69a23e595d49d3cd55cb19bd8971075679 before delivery; replaced by the Task 29 commit after delivery
- local HEAD: 70134e69a23e595d49d3cd55cb19bd8971075679 before delivery
- remote HEAD: same before delivery
- sync: not completed before Git delivery step
- worktree: clean before Git delivery step

## Gates
Before Git delivery:
- GITHUB_SYNCED = NO
- REMOTE_VERIFIED = NO
- WORKTREE_CLEAN = YES
- TASK_COMPLETE = NO

After Git delivery:
- GITHUB_SYNCED = YES
- REMOTE_VERIFIED = YES
- WORKTREE_CLEAN = YES
- TASK_COMPLETE = YES
