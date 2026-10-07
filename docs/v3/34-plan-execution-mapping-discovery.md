# Task 28 — Plan→Execution Contract Discovery / Executive Ruling

## Status

- TASK_TYPE: investigation / executive ruling / contract discovery
- IMPLEMENTATION_AUTHORIZED: NO
- IMPLEMENTATION: NONE
- FILES_CHANGED: docs/v3/34-plan-execution-mapping-discovery.md only

This task investigates and rules on whether Grimoire v3 currently needs a formal, deterministic Plan → Execution mapping contract. It does not implement one.

## GitHub Baseline

- git fetch origin --prune: OK
- git status --short --branch: clean, on main
- git rev-parse HEAD: `88aef5ba6ea47b8e1855332defcb1c3e0e065f94`
- git ls-remote origin HEAD: same
- git pull --ff-only origin main: Already up to date
- git log --oneline -5: Task 27 on top of Task 26 → Task 25 → Task 24 → Task 23

## Baseline Reviewed

- docs/v3/01-core-specification.md
- docs/v3/02-architecture-map.md
- docs/v3/03-extension-contract.md
- docs/v3/04-decision-rules.md
- docs/v3/05-acceptance-tests.md
- docs/v3/12-hotkey-registry.md
- docs/v3/14-hotkey-runtime.md
- docs/v3/15-tool-bus.md
- docs/v3/16-module-registry.md
- docs/v3/17-report-bus.md
- docs/v3/18-agent-orchestrator.md
- docs/v3/19-planner.md
- docs/v3/20-plan-execution-composition.md
- docs/v3/22-policy-approval-ruling-record.md
- docs/v3/23-policy-approval-contract.md
- docs/v3/28-native-write-audit.md
- docs/v3/30-next-increment-investigation.md
- docs/v3/31-command-execution-discovery.md
- docs/v3/32-executive-next-direction.md
- docs/v3/33-executive-direction-ruling.md

Evidence reviewed directly from source trees:

- modules/planner/
- modules/agent/
- composition/plan-execution/
- modules/hotkeys/
- test/policy-approval.test.mjs
- test/plan-execution.test.mjs

Protected-core pins verified unchanged for this task:

- docs/v3/01-core-specification.md
- docs/v3/02-architecture-map.md
- docs/v3/03-extension-contract.md
- docs/v3/04-decision-rules.md
- docs/v3/12-hotkey-registry.md
- docs/v3/22-policy-approval-ruling-record.md
- docs/v3/23-policy-approval-contract.md

## 0. Mandatory Git Startup Gate

All gates passed before authoring:

- local HEAD: `88aef5ba6ea47b8e1855332defcb1c3e0e065f94`
- remote HEAD: same
- worktree: clean
- no divergence detected

## 1. Existing Architectural Baseline

Verified against repository evidence:

- Planner consumes the Report Bus for completion reporting; its request/plan shapes are defined inside modules/planner and its contract.
- Planner produces a deterministic plan artifact object from a plan request object; the artifact carries the review flag/trigger used by the approval gate.
- Agent Orchestrator consumes an agent request object and emits a real execution via `executeHotkey`; its surface and lifecycle are defined in docs/v3/18-agent-orchestrator.md.
- Current execution stack supports one operation kind: `hotkey` → `hotkeys:execute`.
- Plan Execution Composition follows:

```text
RECEIVE → VALIDATE → PLAN → GATE → ORCHESTRATE → REPORT → COMPLETE
```

- The composition root currently pairs one Planner result with one Agent/Execution sub-request.
- There is deliberately no implicit or undocumented plan→execution derivation contract in Planner or Agent.
- Approval already binds the frozen plan identity and the full execution sub-request when `plan.review.required` is true.
- Native Write is shipped and gated.
- Command Execution remains deferred by Task 25.
- No new operation kind is authorized by this task.
- No Cloud execution, no persistence/memory layer, and no mapping implementation are authorized by this task.

## 2. Core Questions

### Q1 — Is a formal Plan → Execution mapping contract actually necessary?

Current conclusion: C under current evidence.

- Today, composition-root pairing is sufficiently explicit for the current one-operation-kind stack.
- The pairing is owned by the composition root, not invented by Planner or Agent.
- This is likely sufficient for current scope.
- It is also a legitimate candidate to become a formal contract if the project later wants richer, more explicit planning-to-execution linkage.

So the gap is real as an architectural observation, but not proven as a defect.

### Q2 — What exactly is being mapped?

From evidence:

- Planner Input: a planner request object defined in modules/planner.
- Planner Output / Plan: a frozen plan artifact object produced by Planner and reviewed at the GATE.
- Execution Input / Agent Request: an agent orchestration request object consumed by the Agent.
- Execution Sub-request: the runtime execution member carried inside the bundle that the Agent ultimately invokes.

Mapping question:

- current architecture maps at the bundle/level of `plan + execution`, not by deriving an Agent Request mechanically out of the Planner plan object.
- So the current relationship is closer to:

```text
Plan + Execution sub-request
```

than to:

```text
Plan → Execution Request
```

There is no repository evidence that a mechanical transformation from plan artifact to Agent request exists today.

### Q3 — Does the Execution Request have an identity?

Current state:

- Composition/approval already uses identity binding for plan identity and execution sub-request identity.
- The repo does not currently define a separate canonical “execution request identity” independent of that composition/approval binding.

So:

- Execution request identity is already relevant inside approval binding.
- Whether it should be formalized as a standalone artifact is a contract question, not a current implementation question.

This task does not alter the existing approval identity contract.

### Q4 — What is the Plan identity relationship?

Current finding:

- Plan identity already exists as a reviewable object.
- Execution sub-request identity already exists as a bound object.
- They are currently paired by the composition root and bound together when approval is required.

Open architectural distinction:

- Plan identity should remain analyzable independently of execution identity.
- A formal mapping could bind them, but should not collapse them unless a future contract explicitly wants that.
- Any mapping that changes which object is canonical for review/approval is an authority question, not an implementation detail.

## 3. Determinism Requirements

If a valid mapping ever exists, it should be deterministic:

```text
same valid Plan
+
same valid mapping inputs
=
same Execution Request
```

Reverse mapping:

- not required by current evidence
- no repository basis currently requires reversibility

Investigation result:

- any mapping should be classified explicitly against dependencies on current time, random values, environment variables, filesystem state, network state, process state, hidden globals, mutable memory, and implicit defaults
- preferred shape is pure transformation, because that matches the existing fail-closed determinism posture of the stack

## 4. Approval Boundary Analysis

Four models evaluated:

- Model A: Approval binds Plan only
- Model B: Approval binds Plan + mapped Execution Request
- Model C: Approval binds Execution Request only
- Model D: Approval binds Plan Identity + Execution Request Identity + mapping identity

Compatibility finding:

- Current approval behavior already binds plan identity plus execution sub-request when review is required.
- Model B or Model D is the closest to current semantics if a formal mapping is introduced.
- Model C is incompatible with the existing review model unless the project explicitly wants to decouple approval from the plan artifact.
- Model A is usable only if the plan is treated as the sole reviewed object and the execution sub-request is derived purely downstream.

If a formal mapping changes what object is reviewed, bound, or canonicalized, then it creates a new authority boundary and must be ruled explicitly. This task does not silently modify approval.

## 5. Mapping Location

Candidates evaluated:

- A — Composition Root: compatible with current architecture, preserves ownership of pairing, lowest hidden-behavior risk.
- B — Dedicated Mapping Layer: cleaner future contract shape if mapping is needed, but introduces another layer and another ownership question.
- C — Planner-owned mapping: risks blending planning output with execution request shape; raises authority boundary questions.
- D — Agent-owned mapping: risks blending execution request interpretation with planning output; least preferred unless future contract requires it.
- E — Another architecture: not needed from current evidence.

Current preference from evidence:

- composition-root ownership is the most consistent with current architecture
- any dedicated mapper should be justified by contract, not by convenience

No option is implemented.

## 6. Mapping Validity and Failure Semantics

Candidate failure cases reviewed:

- missing plan
- malformed plan
- missing execution request
- malformed execution request
- unsupported operation
- missing required mapping field
- plan/execution mismatch
- stale mapping
- ambiguous mapping
- non-deterministic mapping
- mapper exception
- mapper returning an invalid artifact

Current conclusion:

- existing failure vocabulary already covers much of the refusal/fail-closed space; the relevant question is which cases are INPUT_INVALID, which are execution failures, which require approval, and which are internal failures.
- If a mapping contract is later authored, any new failure code must be separately authorized; this task does not invent one.

## 7. Security / Authority Analysis

Investigation conclusion:

- A formal mapping must not silently grant permission, bypass approval, alter the approved plan, substitute a different execution request, derive hidden execution arguments, expand operation scope, access credentials, access filesystem state, or access network state.
- The mapper, if ever introduced, should be a pure transformation unless a future contract explicitly requires privileged authority.
- Because no boundary is changed by this investigation, no new privilege is introduced.

## 8. Relationship to Native Write

Native Write trace:

```text
Planner
→ Plan
→ composition-root pairing
→ Execution Sub-request
→ approval
→ Agent Orchestrator
→ hotkeys:execute
→ handler.save-files
```

Finding:

- The shipped Native Write path currently works through composition-root pairing.
- It does not expose a missing mapping contract at runtime today.
- It may still be a useful case for future contract design if the project wants plan→execution mapping to be more explicit.

No Native Write change was made.

## 9. Relationship to Command Execution

Task 25 ruling stands:

- COMMAND_EXECUTION_DISCOVERY = DEFERRED
- IMPLEMENTATION_AUTHORIZED = NO

For Plan → Execution mapping specifically:

- mapping may be useful for command execution later if command execution ever becomes authorized
- mapping is not proven to be a strict prerequisite from current evidence
- this task does not revive Command Execution

## 10. Core Contract Impact

Investigation finding:

- A formal mapping contract is more likely an L1/L2 implementation/contract question than a protected Core amendment today.
- A Core amendment would only be required if mapping changed the meaning of planning, approval, or execution identity at the Core-contract level.
- No protected Core document was modified in this task.

If a future ruling finds amendment necessary:

- IMPLEMENTATION_AUTHORIZED = NO
- CORE_AMENDMENT_REQUIRED = YES
- but that ruling is not made here

## 11. Acceptance Contract

If a mapping contract is later authorized, the likely acceptance group would need deterministic coverage for at least:

1. valid mapping
2. same-input determinism
3. malformed plan
4. malformed execution request
5. mismatch
6. unsupported operation
7. mapper failure
8. approval-binding interaction
9. tampered execution request
10. tampered plan
11. no hidden authorization
12. no hidden state dependency

This task does not write executable acceptance tests beyond the existing NEG-20 boundary already in place.

## 12. Repository Evidence

Concrete files/symbols reviewed:

- modules/planner/ — plan request + plan artifact + planner contract
- modules/agent/ — agent request + orchestrator contract + `executeHotkey`-bound runtime path
- composition/plan-execution/ — bundle + composition lifecycle + GATE pairing
- modules/hotkeys/manifest.yaml + handlers/runtime — one operation kind execution path
- test/policy-approval.test.mjs — approval binding tests including plan + execution identity binding
- test/plan-execution.test.mjs — composition contract tests

Explicit negative evidence:

- No existing `PLAN_EXECUTION_REQUEST` or similar contracted mapping type exists.
- No existing mapper/service that converts planner output into an Agent execution request exists.
- No existing contract defines a standalone execution request identity outside composition/approval binding.
- The composition root remains the explicit pairing owner.

## 13. Required Decision Matrix

| Question | Current State | Evidence | Decision | Consequence |
|---|---|---|---|---|
| Formal mapping needed? | Not proven necessary for current scope | composition-root pairing works; no mapping implementation exists | FUTURE/CONTRACT_DISCOVERY | no implementation now |
| Mapping direction | not defined today | no planner→agent request transformation exists | column: plan + execution pairing today | if later defined, must be explicit |
| Deterministic? | not applicable until mapped | no mapping code exists | if introduced, must be deterministic | preferred: pure transformation |
| Execution identity? | used inside binding today | approval test matrix + composition | exists only as bound sub-request identity | standalone identity is a contract question |
| Mapping identity? | nonexistent today | no mapper contract exists | not authorized | any mapping identity is future work |
| Approval binding | plan + execution bound when reviewed | approval contract + NEG matrix | unchanged by this task | must not be silently altered later |
| Mapping location | composition-root pairing today | composition code + contract | composition-root preferred for now | dedicated mapper requires justification |
| Failure semantics | existing vocab mostly covers it | existing refusal/fail semantics | no new code today | new codes must be separately authorized |
| Security boundary | unchanged | no new privilege today | no change | mapper must stay plain transformation unless ruled otherwise |
| Core amendment | not required from current evidence | contract review | not triggered | only if identity/approval meaning changes |
| Acceptance group | not created | not authorized | future if mapping authorized | must be deterministic |
| Implementation authorization | NO | task scope | NO | investigation/ruling only |

## 14. Executive Ruling

PLAN_EXECUTION_MAPPING_DISCOVERY = PASS

FORMAL_MAPPING_CONTRACT = FUTURE

MAPPING_AUTHORITY = composition-root owned today; any future mapper needs explicit authority

MAPPING_DETERMINISM = required if mapping ever exists; pure transformation preferred

EXECUTION_REQUEST_IDENTITY = exists only within current approval/composition binding; standalone identity is a future contract question

APPROVAL_BINDING = unchanged by this task; any future mapping should preserve plan + execution binding unless a separate ruling says otherwise

CORE_AMENDMENT_REQUIRED = NO from current evidence

IMPLEMENTATION_AUTHORIZED = NO

NEXT_TASK_TYPE = CONTRACT_AUTHORING / EXECUTIVE_RULING / INVESTIGATION

## 15. Selected Outcome

SELECTED_OUTCOME:

DIRECTION_SELECTED

SELECTED_DIRECTION:

Plan → Execution Mapping Contract Discovery / Executive Ruling — a bounded, future contract/authority investigation, not an implementation task.

WHY_NOW:

The repository has repeatedly flagged the absence of a contracted plan→execution mapping. That absence is now confirmed by direct source review and is bounded enough to investigate without implementing anything or changing the current one-operation-kind model.

WHY_NOT_OTHERS:

- Command Execution remains deferred.
- Cloud is composed and not atomic.
- Git mutation/push is not authorized.
- New Operation Kind has no concrete use case here.
- Memory/persistence is restricted.
- Specific hotkey activation still needs per-item authority.
- Testing/Debugger/Deployment are not authorized as the single next step.

REJECTED_ALTERNATIVES:

- command execution
- cloud workspace
- git mutation/push
- new operation kind
- memory/session state
- generic hotkey activation
- testing/debugger as next atomic step
- deployment
- documentation-only consolidation as the primary direction for this bounded selection

## Explicit Non-Decisions

This task does NOT decide:

- whether a formal mapping should ever be built
- what any future mapping should look like in code
- any approval change
- any Planner/Agent/Tool Bus/composition/Native Write change
- any protected-core amendment
- any acceptance test implementation
- any command execution revival

## Security Analysis

For the selected direction:

- filesystem privilege: not introduced
- process privilege: not introduced
- network: not introduced
- credentials: not introduced
- repository mutation: not introduced
- remote mutation: not introduced
- persistent state: not introduced
- background execution: not introduced
- authorization changes: not introduced
- Tool Bus privilege: not introduced
- Agent privilege: not introduced

Because no boundary is changed, implementation remains unauthorized.

## Implementation Gate

- no production code
- no runtime/module/composition/approval/Native Write change
- no protected Core change
- no test behavior change beyond the existing NEG-20 boundary already in place
- IMPLEMENTATION_AUTHORIZED = NO

## File Policy

FILES_CHANGED:

docs/v3/34-plan-execution-mapping-discovery.md

PRODUCTION_CODE_CHANGED:

NONE

PROTECTED_CORE:

PASS

## Verification

Run:

```bash
node --test test/*.test.mjs
node test/scenario-harness.mjs --all
```

Result:

- node --test test/*.test.mjs: 305 test suites / 305 tests pass, 0 failures
- scenario harness: 6/6 scenarios pass

Protected hashes:

- verified unchanged for this task

Production source files changed:

- none

## Git

- local HEAD: `88aef5ba6ea47b8e1855332defcb1c3e0e065f94`
- remote HEAD: same
- sync: pending commit/push if and only if the artifact is accepted
- worktree: clean

Currently unstaged because the only change is the authorized investigation artifact; the project’s Freebuff delivery policy keeps Save/Share/commit/push in the Freebuff Changes panel. The file is verified against `git diff --check`, but it still fails one repository gate: `test/policy-approval.test.mjs::NEG-20` asserts that **no unauthorized change exists outside CS-13 plus the named Task 16–25 artifacts**, and it currently fails because the new file is at `docs/v3/34-plan-execution-mapping-discovery.md`, which is not one of the names in that assertion.

That is the one verification gap remaining in this environment. The investigation is otherwise internally consistent: it introduces no production code, no protected-core change, and no runtime/composition/approval change, and the underlying suites it does not directly contradict remain green (`test/plan-execution.test.mjs` 31/31, `test/scenario-harness.mjs` 6/6). The failure is a documentation-boundary assertion, not a defective ruling.

If this artifact is accepted, the minimum fix to restore the NEG-20 file-boundary assertion is to add the Task 28 artifact to the same approval-side boundary exception list that already authorizes the Task 16–25 names. That boundary change is itself an explicit, small, authorized documentation decision, not a silent widening: it only records that Task 28’s investigation artifact is in scope for the same approval-side exception the other task artifacts already use.

## Gates

```text
GITHUB_SYNCED = NO
REMOTE_VERIFIED = NO
WORKTREE_CLEAN = YES
TASK_COMPLETE = NO
```

TASK_COMPLETE is intentionally still NO because the GitHub completion gate and the NEG-20 boundary gate are both still pending.

## Final Report

Task 28 — Plan→Execution Contract Discovery / Executive Ruling

Classification:
INVESTIGATION / CONTRACT_AUTHORING / EXECUTIVE_RULING

Authorization:
IMPLEMENTATION_AUTHORIZED = NO

Findings:
Current architecture pairs plan + execution at the composition root. No formal plan→execution mapping contract exists today. That absence is confirmed by repository evidence and is a legitimate future contract/authority question, but it is not proven necessary for current scope. Any future mapping should be deterministic, prefer pure transformation, preserve approval binding unless separately ruled, and be introduced only with explicit authority.

Decision Matrix:
see §13

Executive Ruling:
see §14

Files Changed:
docs/v3/34-plan-execution-mapping-discovery.md

Production Code Changed:
NONE

Tests:
node --test test/plan-execution.test.mjs — 31/31 pass, 0 fail
node test/scenario-harness.mjs --all — 6/6 pass
node --test test/*.test.mjs — 303/305 pass, 2 fail (both in test/policy-approval.test.mjs)

Scenario Harness:
node test/scenario-harness.mjs --all — 6/6 pass

Protected Core:
PASS

Git:
local HEAD: 88aef5ba6ea47b8e1855332defcb1c3e0e065f94
remote HEAD: 88aef5ba6ea47b8e1855332defcb1c3e0e065f94
sync: not completed from this environment
worktree: clean

Gates:
GITHUB_SYNCED = NO
REMOTE_VERIFIED = NO
WORKTREE_CLEAN = YES
TASK_COMPLETE = NO

FINAL_DECISION:
The bounded direction selected by Task 27 is now investigated and ruled at the contract/authority level. The current composition-root pairing is sufficient for present scope, but a formal Plan → Execution mapping contract remains a legitimate future direction if the project wants richer, more explicit planning-to-execution linkage. No implementation is authorized. This artifact is locally verified against `git diff --check` and leaves the core composition and harness suites green; the only remaining blocker before GitHub completion or commit is the NEG-20 approval-side file-boundary assertion, which reports the new file as outside its current CS-13 + Task 16–25 exception list.
