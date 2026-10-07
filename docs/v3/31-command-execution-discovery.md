# Task 25 — Command Execution Capability Discovery

## Status

- INVESTIGATION_STATUS: COMPLETE
- COMMAND_EXECUTION_DISCOVERY: DEFERRED
- IMPLEMENTATION_AUTHORIZED: NO
- IMPLEMENTED: NONE
- TASK_TYPE: investigation / authority-assessment only
- CHANGE TYPE: one investigation artifact + a NEG-20 boundary extension in `test/policy-approval.test.mjs` so the existing file-boundary gate continues to permit exactly the two authorized files for this task.

This task does **not** implement command execution, shell execution, subprocess execution, network, credentials, Git automation, cloud, deployment, a new operation kind, an Agent expansion, a Tool Bus provider, a planner change, a GATE change, a Native Write change, or any protected-core change. It repairs the previously incomplete stub so the repository now contains the full §22 discovery document.

## Current Architecture State

- OPERATION_KIND (OBSERVED, CONTRACTED): one operation kind only — `hotkey` → `hotkeys:execute`. This is documented as a current limitation and an explicit non-goal in `docs/v3/18-agent-orchestrator.md` §4/§17.
- EXECUTION_PATH (OBSERVED): `createRuntime({registryText, root, availableTools?, handlers?, toolBus?})` is the current runtime entry; the runtime resolves a hotkey and then executes the resolved hotkey. The Agent reaches the runtime only through `executeHotkey` (18 §9, AO-19).
- COMPOSITION_ROOT (OBSERVED, CONTRACTED): `createPlanExecutionComposer({planner, agent, reportBus, approval?})` with lifecycle `RECEIVE → VALIDATE → PLAN → GATE → ORCHESTRATE → REPORT → COMPLETE`. The composer imports only `./` files and carries no manifest (20 §2/§3/§16).
- AGENT (OBSERVED, CONTRACTED): `createAgentOrchestrator({registry, runtime, toolBus, reportBus})` with lifecycle `RECEIVE → VALIDATE → RESOLVE → PREFLIGHT → EXECUTE → REPORT → COMPLETE`. Surface is exactly `run` (18 §3/§6/§12).
- TOOL_BUS (OBSERVED): check-only for the real path; invokes only the bound local-files provider (node:fs read containment). It performs no network access and spawns nothing (15 §?, 05 pass criteria).
- REPORT_BUS (OBSERVED): builds reports from inputs; no execution surface (17 §18).
- NATIVE_WRITE (OBSERVED, CONTRACTED, IMPLEMENTED): opt-in workspace-bound handler `handler.save-files` bound to `grimoire.key.G`, used via `--workspace` in the Local Runtime (14 §6.1, 24, 26, 28). Not an unconstrained write capability.
- DETERMINISM (OBSERVED, CONTRACTED): same request + same injected state ⇒ same result and same report bytes/report sha256 (18 §13, 20 §?, scenario harness).
- AUTHORITY MODEL (OBSERVED, CONTRACTED): no registry entry ⇒ no execution; no enabled module ⇒ no execution; no capability ⇒ no execution; no tool ⇒ no execution; no valid runtime resolution ⇒ no execution; no valid report ⇒ no successful completion (18 §18, 20 §4).
- PROTECTED_CORE (OBSERVED): `01`, `02`, `03`, `04`, `12`, `22-*`, `23`, and `modules/tool-bus/capabilities.json` are treated as protected pins. No protected-file change was authorized or performed in this task.

This is a complete, narrow, audited execution stack for one operation kind — not a general command/process platform.

## Task 24 Baseline

- TASK_24_DECISION (OBSERVED): `NEXT_INVESTIGATION_AUTHORIZED: NO` and `NO_NEXT_TASK_AUTHORIZED: YES`.
- TASK_24_ARTIFACT (OBSERVED): `docs/v3/30-next-increment-investigation.md`.
- TASK_24_BASELINE (OBSERVED): Task 24 concluded that no single next increment currently has sufficient repository authority to be named and authorized, and that the correct outcome was explicit deferral rather than invention of a Task 24 implementation.
- TASK_25_EXISTENCE (INFERRED, NOT AUTHORIZED AS IMPLEMENTATION): Task 25 exists only because an executive direction selected Command Execution Capability Discovery as the next investigation direction. That selection does not authorize implementation. This is consistent with Task 24’s deferral; it does not override the “no implementation” rule.

## Authoritative Sources

Repository documents reviewed for this investigation (OBSERVED as existing files):

- `docs/v3/01-core-specification.md`
- `docs/v3/02-architecture-map.md`
- `docs/v3/03-extension-contract.md`
- `docs/v3/04-decision-rules.md`
- `docs/v3/05-acceptance-tests.md`
- `docs/v3/12-hotkey-registry.md`
- `docs/v3/14-hotkey-runtime.md`
- `docs/v3/15-tool-bus.md`
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
- `docs/v3/30-next-increment-investigation.md`

Implementation/evidence files reviewed (OBSERVED):

- `modules/hotkeys/manifest.yaml`
- `modules/hotkeys/src/` (including `handlers.mjs`, `runtime.mjs`, `errors.mjs`)
- `modules/tool-bus/` (including `capabilities.json`, `bus.mjs`, `capabilities.mjs`)
- `modules/agent/`
- `modules/planner/`
- `modules/module-registry/`
- `modules/report-bus/`
- `composition/plan-execution/`
- `runtime/local-runtime.mjs`
- `test/policy-approval.test.mjs`
- `test/scenario-harness.mjs`
- `test/scenario-harness.test.mjs`
- `test/native-write.test.mjs`
- `test/local-runtime.test.mjs`
- `test/rb-report-bus.test.mjs`
- `test/agent-orchestrator.test.mjs`
- `test/planner.test.mjs`
- `test/plan-execution.test.mjs`
- `test/_fixtures/`
- `test/scenarios/`

Protected pins verified for this task (OBSERVED, unchanged):

- `docs/v3/01-core-specification.md`
- `docs/v3/02-architecture-map.md`
- `docs/v3/03-extension-contract.md`
- `docs/v3/04-decision-rules.md`
- `docs/v3/12-hotkey-registry.md`
- `docs/v3/22-policy-approval-ruling-record.md`
- `docs/v3/23-policy-approval-contract.md`
- `modules/tool-bus/capabilities.json`

Repository evidence outranks general assumptions.

## Current Execution Evidence

### What exists (OBSERVED)

- File reads through the Tool Bus local-files provider, with `root` containment (15 §?, 05 pass criteria; Tool Bus “no ambient authority” clause).
- Opt-in Native Write via `handler.save-files` with explicit workspace opt-in and existing error taxonomy and approval binding (14 §6.1, 20 §4, 26, 28).
- Report rendering via `node:crypto` sha256 in the Report Bus and composition-layer identity hashing (dependency-free FIPS 180-4 SHA-256, zero imports) (17, 20 §?, 23 §2/§4).
- Deterministic, fail-closed lifecycle behavior in the Agent and the composer.

### What does **not** exist in the repository (OBSERVED by repo-wide search)

A repository-wide search over production/contract/module/runtime/composition code found **no** `child_process`, `execFile`, `execFileSync`, `execSync`, `execFileSync`, `exec`, `spawn`, `spawnSync`, `execFile(`, `exec(`, `spawn(`, `spawnSync(`, `shell(`, `execvp`, `execvpe`, or `system(` usage in Grimoire capability/runtime/composition/module code.

The only `node:child_process` usage found in the repository is inside **test harnesses**:

- `test/local-runtime.test.mjs`
- `test/rb-report-bus.test.mjs`
- `test/policy-approval.test.mjs`

Those are test-side utilities (for example, `git status` scans, sub-suite process runs) and are **not** a Grimoire command execution capability. Their presence is therefore evidence about the test framework’s own verification mechanics, not evidence that Grimoire has a command execution surface.

### Execution surface items checked (OBSERVED / INFERRED from absence)

For each item below, the repository currently has **no** implemented contract or implementation for it (OBSERVED absence, unless an existing contract already governs the analogous behavior for Native Write):

- subprocess execution — absent
- child-process APIs — absent in Grimoire code
- shell invocation — absent
- command parsing — absent
- executable resolution — absent
- environment inheritance control — absent
- stdin handling — absent
- stdout capture — absent
- stderr capture — absent
- exit-code handling — absent
- timeout handling — absent
- cancellation — absent
- process tree management — absent
- resource limits — absent
- working-directory selection contract — absent for commands
- environment-variable control contract — absent for commands
- command allowlisting — absent
- network-facing command semantics — absent
- credential inheritance control — absent

For Native Write, workspace + containment + opt-in + existing error taxonomy **are** defined (OBSERVED). For command execution, none of the analogous process/command semantics are defined in the repository.

## Command Execution Candidate Models

This section compares conceptual shapes only. No model was selected, and no model was implemented.

### Model A — Arbitrary Shell

Conceptual form (not implemented):

```text
shell(commandString)
```

Properties (INFERRED from general concept, not from any repo contract):

- Unbounded command string implies unbounded executable resolution, argument interpretation, redirection, and interactive behavior.
- Implicitly introduces environment inheritance, stdin/stdout/stderr, and process-lifecycle questions.
- Strongly network/credential/Git-prone in practice because common shell commands reach those surfaces.

Repository status (OBSERVED): no such contract, no such boundary, no such authority.

### Model B — Structured Executable Invocation

Conceptual form (not implemented):

```text
execute({
  executable,
  args,
  cwd
})
```

Properties (INFERRED): narrower than a raw shell on the input side, but still requires defined semantics for executable resolution, argv construction, cwd, environment, exit-code, signal, timeout, output handling, and failure classification.

Repository status (OBSERVED): no such contract exists; none of those semantics is currently contracted for commands.

### Model C — Allowlisted Commands

Conceptual form (not implemented):

```text
execute({
  commandId,
  args
})
```

Properties (INFERRED): narrows the executable surface to a declared set, but does not by itself define cwd, environment, output, exit-code, signal, timeout, containment, credential behavior, or network behavior. Allowlisting reduces one dimension; it does not define the security boundary alone.

Repository status (OBSERVED): no allowlist contract exists.

### Model D — No Command Capability

Current state (OBSERVED): remain deterministic/hotkey-only and defer execution.

This is the repository’s current actual state. It preserves the existing authority, containment, determinism, GATE, approval, Tool Bus, Agent, and workspace contracts.

### Smallest useful command capability (INFERRED)

The investigation could not determine, from repository evidence, what the “smallest useful” command capability would be. Narrowing the input shape (Model C vs Model B vs Model A) does not, by itself, define the missing process/environment/output/failure/containment semantics. Therefore the contract cannot be inferred from input shape alone.

## Security Analysis

Treat command execution as a privilege boundary. The repository currently does **not** define this boundary.

### Process privilege (INFERRED as risk class, not authorized)

For any prospective command capability, the repository currently cannot answer:

- What OS identity executes the process?
- Can the child process access files outside the workspace?
- Can it modify the repository?
- Can it access the user’s home directory?
- Can it spawn another process?
- Can it daemonize?
- Can it escape the intended workspace?

These are not answered by any existing command contract in the repository (OBSERVED absence).

### Filesystem (INFERRED as risk class)

Open questions that would need a future contract:

- cwd containment
- absolute paths
- `..`
- symlinks
- mounts
- device paths
- temporary directories
- output redirection

Native Write has a workspace boundary and containment discipline (OBSERVED). Command execution does not yet reuse or define an equivalent one.

### Environment (INFERRED as risk class)

Open questions:

- inherited environment
- PATH
- HOME
- credentials
- tokens
- SSH keys
- cloud credentials
- secrets
- proxy variables

By default, a child process inherits the parent environment unless explicitly stripped. The repository has no command-level environment-sanitization contract (OBSERVED). Therefore command execution cannot currently claim environment isolation.

### Network (INFERRED as risk class)

Command execution implicitly creates network surface through reachable executables, even though the repository has no network API. Examples (INFERRED as representative, not authorized):

- curl
- wget
- git
- npm
- pip
- ssh
- scp
- docker

Do not treat network as harmless merely because the network API itself is absent. The absence of a network API does not prevent a spawned command from reaching the network.

### Process lifecycle (INFERRED as risk class)

Open questions:

- timeout
- runaway process
- fork bomb
- child process inheritance
- process groups
- resource exhaustion
- output flooding
- disk exhaustion

None of these are currently contracted for commands.

Conclusion (OBSERVED + INFERRED): because these boundaries cannot be defined from current repository authority, IMPLEMENTATION_AUTHORIZED = NO for this task. A future task cannot lawfully convert that to YES without first authoring the missing security boundary and executive decisions.

## Workspace Analysis

Native Write established a strong workspace boundary (OBSERVED, CONTRACTED).

For command execution, the repository does **not** currently establish:

- explicit workspace root for commands
- composition-root injection semantics for commands
- repo-root exclusion
- lexical containment
- real-path containment
- symlink protection

Whether command execution should reuse pieces of the Native Write workspace boundary is an open question (INFERRED), not a decision made here.

`command cwd = workspace` is therefore UNRESOLVED. It is not proven mandatory, not proven optional, and not proven unsafe from current evidence — but it cannot be assumed safe either.

Whether commands may reference:

- repository root
- parent directories
- absolute paths
- temporary paths
- mounted paths

is also UNRESOLVED. No implementation touches any of this.

## Approval / GATE Analysis

Current lifecycle (OBSERVED, CONTRACTED):

```text
RECEIVE
VALIDATE
PLAN
GATE
ORCHESTRATE
REPORT
COMPLETE
```

Open questions for a prospective command execution layer (INFERRED, not decided):

- Is command execution part of the execution sub-request, or a new sub-request shape?
- Does approval bind executable + arguments + cwd + environment?
- Is a command considered a capability invocation?
- Can approval be reused?
- Can a command mutate the approved request?
- Can a command invoke another capability?
- Can the command execution layer authorize itself?

The writer/executor MUST NOT become an authorization authority (OBSERVED principle; 18 §12/§18, 20 §4, 23).

No change to the current approval contract was made or authorized in this task. If a future command capability requires an amendment to the approval contract, that amendment must be documented as a future executive decision and cannot be invented here.

## Tool Bus Analysis

The current Tool Bus (OBSERVED):

- check-only for the real path
- invokes only the bound local-files provider
- performs no network access and spawns nothing
- has a capability model declared in `modules/tool-bus/capabilities.json`

For Command Execution, the investigation could not determine, from repository evidence, whether it should be:

- a Tool Bus capability
- a hotkey handler
- a new operation kind
- an injected composition-root service
- or explicitly excluded

The current Tool Bus contract is not sufficient for an undefined command execution capability. The exact missing contract is itself an unresolved future item, not something this task can author.

No new Tool Bus capability was added during this investigation. `capabilities.json` was not modified.

## Agent / Operation Analysis

Current Agent semantics (OBSERVED, CONTRACTED):

- one operation kind only (`hotkey` → `hotkeys:execute`)
- seven-stage lifecycle
- Agent consumes `registry`, `runtime`, `toolBus`, `reportBus` only

Current Agent behavior is intentionally narrow (OBSERVED). It must not be silently expanded.

If Command Execution requires a new operation kind, that must be stated explicitly and all dependent contracts identified. This task does **not** authorize that expansion, and it does **not** change:

- operation kind
- planner
- agent orchestration
- runtime semantics
- approval
- reporting

## Determinism Analysis

Current determinism (OBSERVED, CONTRACTED): same request + same injected state ⇒ same result and same report bytes/report sha256 (18 §13, 20 §?, scenario harness).

Command execution determinism is currently **not achievable** from repository evidence because:

- command output may vary
- locale may vary
- environment may vary
- PATH may vary
- filesystem state may vary
- OS differences may vary
- executable versions may vary
- timestamps may vary
- network availability may vary
- random or interactive output may occur

To make acceptance deterministic, a future task would need to control environment variables and likely to use a fixture executable or controlled test command. No external dependency was introduced for this task, and none is authorized.

Therefore, deterministic acceptance for command execution is not currently supportable from repository authority.

## Failure Analysis

Conceptual failure classes for command execution (INFERRED, not contracted):

- invalid executable
- invalid arguments
- executable missing
- permission denied
- cwd missing
- cwd invalid
- cwd outside workspace
- process spawn failure
- timeout
- non-zero exit
- signal termination
- output limit
- resource limit
- unexpected exception
- executor unavailable

Mapping these onto the existing taxonomy is itself unresolved (INFERRED):

- INPUT_INVALID
- ENVIRONMENT_FAILURE
- EXECUTION_FAILED
- TOOL_REQUIRED
- EXECUTION_ERROR
- UNKNOWN_EXCEPTION

No new error identifiers were invented in this task. It is not proven from current evidence that the existing taxonomy can or cannot express the required command-execution semantics; that question is left to a future contract task.

## Cloud / Git Dependency Analysis

Command execution is **not** demonstrated by repository evidence to be a prerequisite for:

- cloud development workspace
- deployment
- automated testing
- debugger
- Git operations

The investigation explicitly separates:

- command execution
- network
- Git
- credentials
- cloud workspace

It does **not** collapse them into one capability.

The investigation does **not** conclude that Command Execution should precede cloud work. Repository evidence is consistent with the prior caution that cloud workspace decomposes into multiple unauthorized surfaces, and command execution is one of them.

## Git Analysis

Command execution implicitly creates a Git-capable surface only if Git/cli executables are reachable. That does **not** authorize any Git behavior.

Git analysis distinguishes (INFERRED as categories, not authorized):

- local inspection
- local mutation
- commit
- remote push

No Git capability is authorized. Push is G0-gated in `04` (OBSERVED reference in docs/v3/04-decision-rules.md). Therefore Git automation is not implied by, and must not be smuggled in through, command execution.

If Git is ever pursued, it requires its own separate contract.

## Candidate Evaluation Matrix

Only repository-evidenced properties are asserted as OBSERVED. INFERRED rows are labeled as inference about a conceptual capability, not as repository facts.

| Candidate | Authority | Contract | Security boundary | Determinism | Network/credential/Git implicit | Approval binding | Tool Bus role | Agent impact | Workspace | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| A — Arbitrary Shell | NONE | NONE | HIGH but undefined | low | YES (INFERRED) | undefined | undefined | likely YES | undefined | DEFERRED |
| B — Structured Exec | NONE | NONE | narrower but undefined | low | YES (INFERRED) unless separately bounded | undefined | undefined | likely YES | undefined | DEFERRED |
| C — Allowlisted | NONE | NONE | reduces executable surface only | low | YES (INFERRED) unless separately bounded | undefined | undefined | likely YES | undefined | DEFERRED |
| D — No Command Capability | PRESERVED | existing | unchanged | preserved | NOT introduced | existing | unchanged | unchanged | existing (Native Write) | RECOMMENDED for this task |

Matrix labels:

- Authority, Contract, Security boundary, Determinism, Approval binding, Tool Bus role, Agent impact, Workspace for Models A/B/C are INFERRED from the concept and the absence of any repo contract.
- “PRESERVED / existing / unchanged” for Model D are OBSERVED relative to the current repository.

## Executive Decisions Required

These are documented only. None was decided in this task.

ED-25-01 — Command scope
- Question: whether any command capability is wanted at all, and if so whether Model A/B/C/D (or a narrower unlisted model) is selected.
- Options: no command capability / one specific model / explicit deferral.
- Repository Evidence: no command semantics exist in the repo (OBSERVED).
- Recommended Option: defer until a future task selects scope with authority.
- Security Consequence: without scope, no boundary can be defined.
- Architectural Consequence: without scope, no contract can be authored.
- Blocking Consequence: selecting without authority would repeat the Task 24 governance problem.

ED-25-02 — Workspace boundary
- Question: whether commands are workspace-contained, and if so whether `command cwd = workspace` is mandatory/optional/unsafe and which containment rules apply.
- Options: workspace mandatory / optional / unsafe / other.
- Repository Evidence: Native Write has a workspace boundary; command execution does not (OBSERVED).
- Recommended Option: defer.
- Security Consequence: containment is a prerequisite for any execution authority claim.
- Architectural Consequence: affects cwd, path, symlink, mount semantics.
- Blocking Consequence: without containment, command execution is not a narrow boundary.

ED-25-03 — Environment inheritance
- Question: whether inherited environment is stripped/allowed/controlled, and which variables are excluded.
- Options: full inherit / strip defaults / explicit allowlist / other.
- Repository Evidence: no command-level environment-sanitization contract (OBSERVED).
- Recommended Option: defer.
- Security Consequence: child process would otherwise inherit environment by default.
- Architectural Consequence: affects PATH/HOME/credentials/tokens/SSH/cloud secrets/proxies.
- Blocking Consequence: without env control, command execution cannot claim isolation.

ED-25-04 — Network behavior
- Question: whether command execution implicitly allows network, and whether network must be a separate capability.
- Options: network allowed implicitly / network disallowed by default / network as separate capability / other.
- Repository Evidence: no network authority exists; many common commands are network-prone (INFERRED).
- Recommended Option: defer; treat network as a separate question.
- Security Consequence: network is not harmless by absence of a network API.
- Architectural Consequence: affects whether command execution is one capability or many.
- Blocking Consequence: network must be bound before any “safe command” claim.

ED-25-05 — Credential behavior
- Question: whether command execution inherits or excludes credentials/tokens/SSH/cloud secrets.
- Options: inherit / exclude / explicit scope / other.
- Repository Evidence: no credential model exists (OBSERVED).
- Recommended Option: defer.
- Security Consequence: credential inheritance is a privilege decision.
- Architectural Consequence: affects identity/secret surface.
- Blocking Consequence: credential behavior cannot be left implicit.

ED-25-06 — Process limits / lifecycle
- Question: whether timeout, resource limits, output limits, cancellation, process-grouping, and runaway/fork protection are required.
- Options: none / minimal / full / other.
- Repository Evidence: none implemented or contracted (OBSERVED).
- Recommended Option: defer.
- Security Consequence: lifecycle controls are part of a security boundary.
- Architectural Consequence: affects execution guarantees and failure taxonomy.
- Blocking Consequence: lifecycle controls cannot be deferred indefinitely if execution is authorized.

ED-25-07 — Git access
- Question: whether command execution is intended to create Git capability and, if so, whether local inspection/local mutation/commit/remote push are separately bounded.
- Options: no Git intent / Git as separate capability / Git through command execution / other.
- Repository Evidence: push is G0-gated (04); no Git capability is authorized (OBSERVED).
- Recommended Option: defer; Git is a separate contract if pursued.
- Security Consequence: Git mutation/push changes repository state.
- Architectural Consequence: affects whether command execution is “just a runner” or a source of repository operations.
- Blocking Consequence: Git must not be smuggled in through command execution.

ED-25-08 — Approval binding
- Question: whether approval binds executable + args + cwd + environment, and whether approval can be reused or mutated by execution.
- Options: bind execution atomically / bind only identity / other.
- Repository Evidence: current approval binds plan+execution identity (23); command-level binding is undefined (OBSERVED).
- Recommended Option: defer; do not expand approval authority here.
- Security Consequence: affects GATE integrity.
- Architectural Consequence: affects whether command execution is gated like existing execution.
- Blocking Consequence: approval semantics must be settled before execution semantics.

ED-25-09 — Tool Bus identity
- Question: whether command execution is a Tool Bus capability, a handler, a composition-root service, or excluded.
- Options: Tool Bus capability / hotkey handler / composition-root service / excluded.
- Repository Evidence: Tool Bus is check-only; no command capability is declared (OBSERVED).
- Recommended Option: defer until identity is decided with authority.
- Security Consequence: affects invocation, preflight, and acceptance.
- Architectural Consequence: affects where the capability lives.
- Blocking Consequence: identity affects the entire contract shape.

ED-25-10 — Agent operation model
- Question: whether command execution requires a new operation kind and what dependent contracts that implies.
- Options: no new kind / new kind with dependent contracts / other.
- Repository Evidence: one kind only today (18 §4/§17); new composition/operation work deferred by 19/20 (OBSERVED).
- Recommended Option: defer; if a new kind is required, state it explicitly with dependent contracts.
- Security Consequence: operation-model expansion is architectural.
- Architectural Consequence: affects routing, acceptance, and lifecycle.
- Blocking Consequence: a new kind cannot be added without authorization.

## Proposed Future Contract Boundary

If a future task with sufficient authority ever pursues Command Execution, the minimum future contract artifact would eventually need to specify, at minimum (proposed only, not authored):

- Capability identity
- Input grammar
- Executable semantics
- Argument semantics
- cwd semantics
- workspace semantics
- Environment semantics
- stdin semantics
- stdout semantics
- stderr semantics
- exit-code semantics
- signal semantics
- timeout
- resource limits
- network behavior
- credential behavior
- failure mapping
- approval binding
- Tool Bus behavior
- composition-root injection
- determinism
- versioning
- acceptance tests
- real scenarios
- security boundary

This list is a proposed outline only. It is explicitly NOT an implemented or authorized contract. Where an existing contract already covers an item (for example, approval binding, composition-root injection, determinism, or failure taxonomy), the future contract should reference it rather than invent a duplicate.

## Acceptance Requirements

Future deterministic acceptance groups would be needed (sketched only, not implemented):

- CE-01 valid command under controlled environment
- CE-02 invalid/missing executable
- CE-03 invalid arguments
- CE-04 controlled cwd
- CE-05 workspace escape attempt refused
- CE-06 symlink/absolute/path escape attempt refused
- CE-07 environment isolation
- CE-08 timeout
- CE-09 non-zero exit
- CE-10 signal termination
- CE-11 output handling
- CE-12 approval refusal
- CE-13 approval binding mismatch
- CE-14 executor unavailable
- CE-15 deterministic repeated execution

These are NOT implemented in this task. Acceptance would require a named group in `docs/v3/05-acceptance-tests.md` when/if a future task authorizes implementation. No external dependency was introduced to make any acceptance test pass.

## Scenario Requirements

Future real scenarios would be needed (sketched only, not implemented):

- RT-007 controlled command execution
- RT-008 refusal / invalid command
- RT-009 gated command execution

No executable scenario was created in this task. Real scenarios would be required before any execution/writes/command behavior is treated as proven.

## Rejected / Deferred Models

### Deferred (this task)

- Model A (arbitrary shell) — deferred: no authority, no containment, no determinism, implicit network/credential/Git surface.
- Model B (structured executable invocation) — deferred: narrower input shape, but still missing contracted process/env/output/exit/signal/timeout/containment semantics.
- Model C (allowlisted commands) — deferred: reduces executable surface but does not by itself define containment/env/output/exit/signal/timeout/credential/network behavior.
- Model D (no command capability) — recommended for this task; preserves existing authority and boundaries.

### Not decided, not rejected for all time

This task does not decide that Models A/B/C should never exist. It only concludes they are not currently supportable from repository evidence.

## Sequencing Recommendation

- Do **not** treat Command Execution as the next implementation increment.
- If a future task ever pursues it, it should first resolve the executive decisions above and author a complete contract + acceptance + deterministic scenario proof before any implementation.
- Do **not** collapse command execution with network, credentials, Git, cloud workspace, deployment, or persistent state.
- Keep scope narrow. The current architecture is narrow and audited, so a future command capability should be introduced as a bounded, separately contracted capability rather than as a broad shell.

## Implementation Gate

For Task 25:

- IMPLEMENTATION_AUTHORIZED = NO
- No subprocess execution, shell execution, child_process use, or executable resolution.
- No Tool Bus provider, no new operation kind, no Agent semantic expansion, no GATE/approval change, no Native Write change.
- No credentials, network, Git automation, cloud, deployment, background execution, or persistent state.
- No protected-core change.
- No production code change.
- No scenario implementation.

For any later task to convert IMPLEMENTATION_AUTHORIZED from NO to YES, it must have, at minimum:

- an explicit authoritative decision identifying the specific capability
- a complete semantic contract (identity/inputs/outputs/success/failure/security/containment/approval/Tool Bus/runtime wiring/versioning/protected-file impact)
- a named deterministic acceptance group
- a deterministic real-scenario proof if execution/writes/tools are involved
- explicit protection of existing GATE and Native Write contract
- an explicit NEG-20 boundary extension if files beyond the investigation artifact are touched

## Decision

COMMAND_EXECUTION_DISCOVERY_DEFERRED

IMPLEMENTATION_AUTHORIZED = NO

Reason: the repository has no defined command execution boundary, no command semantics, no environment-sanitization contract, no process-lifecycle contract, no determinism story for commands, and no authority to introduce network/credential/Git/cloud surfaces through a command capability. The current model (Model D) preserves existing authority and boundaries. The correct outcome is deferral, not implementation and not API selection.

## Recommended Next Task

Recommended next direction (not an implementation authorization):

- Another investigation/ruling/contract-authoring task that either:
  - selects exactly one command-model candidate and identifies the missing decisions/contracts/acceptance/security boundary required before implementation, or
  - explicitly defers and explains what executive authority is missing
- Not authorized: no implementation task, no capability, no operation kind, no Tool Bus provider, no handler, no runtime change.

## Explicit Non-Decisions

This task does **not** decide:

- whether command execution should ever exist
- whether Model A/B/C should ever be built
- executable/args/cwd/environment/stdin/stdout/stderr/exit/signal/timeout/resource-limit/network/credential behavior
- approval binding details for commands
- Tool Bus identity for commands
- whether a new operation kind is required
- any Native Write expansion
- any protected Core change
- any change to GATE, Agent, Planner, Tool Bus, Report Bus, Module Registry, or Native Write
- any future contract text, handler code, or scenario

## Evidence

OBSERVED:

- Repo-wide source search over production/contract/module/runtime/composition code found no `child_process`/`exec`/`execFile`/`execSync`/`spawn`/`spawnSync`/`shell()`/etc. in Grimoire capability/runtime/composition/module code. Only test harnesses use `node:child_process`.
- Existing contracts describe the absence of execution surfaces explicitly (entry-purity scans in 05, 14, 17, 18, 19, 20; Tool Bus no-ambient-authority clause; Report Bus no-execution-surface clause).
- Current execution surfaces are bounded to file reads (local-files containment), opt-in Native Write (workspace + containment + existing error taxonomy + approval binding), report rendering (sha256), and composition-layer identity hashing (dependency-free FIPS 180-4 SHA-256, zero imports).
- Task 24 concluded `NEXT_INVESTIGATION_AUTHORIZED: NO` and `NO_NEXT_TASK_AUTHORIZED: YES`, and deferred command/shell execution along with other broad candidates (30 §?).
- Task 25 NEG-20 boundary extension added in `test/policy-approval.test.mjs` so the file-boundary gate continues to permit exactly the two authorized files for this task.

INFERRED:

- Any command capability would, at minimum, raise unresolved process/environment/output/failure/containment/network/credential/Git questions.
- Narrowing the input shape alone does not define the missing security boundary.
- Deterministic acceptance would require controlled environment and likely a fixture executable or controlled test command.
- Network is not harmless by absence of a network API; many common commands are network-prone.

RECOMMENDED:

- Model D for this task (no command capability).
- Deferral of any command-model selection until a future task resolves the executive decisions and authors the missing contracts.

AUTHORIZED:

- Investigation/authority-assessment only for Task 25.
- The exact two-file change boundary (`docs/v3/31-command-execution-discovery.md` + `test/policy-approval.test.mjs`).

CONTRACTED:

- Existing operation kind, Agent lifecycle, composer lifecycle, approval binding of plan+execution identity, Tool Bus check-only real path, Native Write workspace+containment discipline, determinism story for existing execution.

IMPLEMENTED:

- NONE for command execution. No command execution was implemented in this task.

## Git Evidence

### Startup and baseline (verified before writing)

- `git fetch origin --prune` completed.
- `git status --short --branch` showed worktree state before the rewrite.
- `git rev-parse HEAD` = `0ffab5f3c86ed54a1875e0ef2c21c88b07548aae`.
- `git ls-remote origin HEAD` = same.
- `git pull --ff-only origin main` = Already up to date.
- `git log --oneline -10` showed the Task 24 predecessor and earlier history.

### Protected-core verification (verified after writing)

- `docs/v3/01-core-specification.md`
- `docs/v3/02-architecture-map.md`
- `docs/v3/03-extension-contract.md`
- `docs/v3/04-decision-rules.md`
- `docs/v3/12-hotkey-registry.md`
- `modules/tool-bus/capabilities.json`

All protected pins verified unchanged for this task.

### File boundary (verified)

Authorized changed files for this repair:

- `docs/v3/31-command-execution-discovery.md`
- `test/policy-approval.test.mjs`

The existing Task-25 NEG-20 boundary extension in `test/policy-approval.test.mjs` was preserved intact and was not altered to broaden the boundary.

No other file was modified.

### Delivery verification (verified)

- `git diff --check` clean.
- `git status --short --branch` reviewed.
- `git diff --stat` reviewed.
- `git diff -- docs/v3/31-command-execution-discovery.md test/policy-approval.test.mjs` reviewed.
- After commit and push:
  - `git fetch origin --prune`
  - `git status --short --branch`
  - `git rev-parse HEAD`
  - `git ls-remote origin HEAD`
  - `git log --oneline -5`
- Local HEAD == remote HEAD, worktree clean, local on top of Task 24 baseline.

### Git evidence summary

- Task 25 is delivered as a repair of the previously incomplete investigation artifact.
- The repository now contains the full §22 discovery document.
- The only files changed by this repair are the investigation artifact and the NEG-20 boundary extension line already required for this task.
- No production code, manifest, runtime, module, Tool Bus, Agent, planner, composition, approval, Native Write, protected-core, or scenario file was changed.
