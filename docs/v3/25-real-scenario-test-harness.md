# Grimoire v3 — Real Scenario Test Harness (Task 17)

**Scope:** a harness ON TOP OF the Task 16 Local Runtime. It defines a
development scenario, runs it through the real contracts, observes the
result, asserts against declared expectations, and reports PASS/FAIL. It
adds no contract, no gate, no approval layer, and no Core behaviour. Task 17
measures runtime behaviour on five small scenarios; it proves nothing about
general autonomous engineering.

## 1. What is the Harness?

`test/scenario-harness.mjs` is a thin shell that can only DEFINE → RUN →
OBSERVE → ASSERT → REPORT:

```
scenario JSON (test/scenarios/RT-00X.json)
  → validate            fail closed on any unknown or missing field
  → setup               fresh workspace copied from test/scenarios/fixtures
  → execute             runLocalRuntime(bundle, {planner, agent, reportBus, approval})
                          real Planner → real GATE → real Agent
                            → real Registry / Tool Bus / Hotkey Runtime
                            → real Report Bus (planner + agent + composer)
  → observe             result, metrics, execution evidence, report, workspace
  → assert              against the scenario's declared expectations
  → report              STATUS PASS/FAIL + OUTCOME + failing assertions
  → cleanup             workspace tree removed, always
```

The harness never plans a task, never approves its own plan, never invokes a
tool or handler outside the Agent, never edits an Agent result, and never
turns a failure into a pass. Every dependency it supplies is either a counting
probe around a real contract or an explicitly declared controlled fault used
by a failure scenario. The approval gate, the approval contract (`23` §2), and
every existing module stay exactly as Task 16 left them.

Two lifecycle rules matter:

- **A scenario may not touch the repository.** Scenarios that work with files
  get a fresh directory outside the repository (`fs.mkdtempSync`) populated
  from the committed fixture; the scenario handler refuses any path that
  leaves it. The workspace tree is removed in a `finally` block, so even a
  failing scenario leaves nothing behind.
- **Approval is explicit per run.** A run declares `"approval": "none"`,
  `"grant"`, or `"deny"`. `none` injects nothing at all, so a review-gated
  bundle refuses at the GATE (D0) exactly as before. `grant`/`deny` build a
  component for that run only; it computes its bindings from the arguments the
  GATE hands it and is never stored or reused.

## 2. How do I run one scenario?

```bash
node test/scenario-harness.mjs RT-002
echo $?   # 0 when the scenario passes
```

Output is deterministic — one block per scenario, then one summary line, with
no timestamps and no random ids:

```
SCENARIO RT-002
STATUS PASS
OUTCOME PASS
RUN primary
RESULT ok=true code=COMPLETED status=COMPLETED stage=COMPLETE
METRICS planner=1 approval=0 agent=1 toolChecks=5 report=1
EXIT_CODE 0
REPORT_SHA256 5b699a46…
ASSERTIONS 20/20

SUMMARY scenarios=1 passed=1 failed=0 harnessFailures=0
```

Exit codes: `0` every scenario passed · `2` usage error or unknown scenario
id · `3` a scenario failed · `4` the harness itself failed (missing fixture,
setup error, internal fault). These are the harness's own codes and do not
change the Local Runtime's exit semantics (`24` §8).

## 3. How do I run all scenarios?

```bash
node test/scenario-harness.mjs --all
echo $?   # 0 when all six pass
```

The acceptance suite for the harness runs with everything else:

```bash
node --test test/scenario-harness.test.mjs   # Group T (T-01 … T-12)
node --test test/*.test.mjs                  # the whole repository suite
```

## 4. How do I add a scenario?

1. Create `test/scenarios/RT-00X.json` (ids match `RT-###`, load order is by
   id). Required: `id`, `name`, `description`, `input`, `expected`. Optional:
   `workspace`, `handler`, `approval`, `faults`, `variants`.
2. `input` is a real bundle — exactly `{plan, execution}` (the composition
   contract's envelope). `plan` is a Planner request; `execution` is an Agent
   request with an explicit `target` and optional `args`. A plan with
   `tier: "T2"` and a `trigger` sets `review.required = true`.
3. `expected` must declare `outcome` (`PASS`, `EXPECTED_REFUSAL`, or
   `EXPECTED_FAILURE`) and may declare `exitCode`, `result`, `counts`,
   `execution`, `evidenceContains`, `reportContains`, `reportNotContains`,
   and `workspaceFiles`. Unknown fields are refused — a typo fails closed
   instead of silently passing.
4. Extra legs go in `variants: [{name, approval?, faults?, input, expected}]`.
   Each variant is an independent execution in the same scenario; one scenario
   never depends on another.
5. Measure the real values once (`node test/scenario-harness.mjs RT-00X`
   prints METRICS and the actual report fingerprint) and pin them, as the six
   shipped scenarios do.

## 5. How do fixtures work?

`test/scenarios/fixtures/notes.md` is committed and read-only. A scenario
declares `"workspace": { "files": ["notes.md"] }`; at SETUP the harness copies
those files into a fresh temporary directory and passes it to the Hotkey
Runtime's handler scope. A missing fixture is a harness fault
(`E_HARNESS_FIXTURE`), never a silent empty workspace. The fixture's bytes are
asserted unchanged after every run (T-06).

The Hotkey Runtime's own `root` deliberately stays the repository root,
because the registry validates its `Source` references against it. Writes are
confined to the scenario workspace by the handler's containment check, not by
a runtime root switch.

## 6. How do assertions work?

Each declared expectation becomes one named assertion (`outcome`, `exitCode`,
`result.*`, `counts.*`, `execution.*`, `evidenceContains[i]`,
`reportContains[i]`, `reportNotContains[i]`, `workspace.fileSet`,
`workspaceFiles.<name>`). A run passes only when every assertion holds.

`workspaceFiles` is a strict assertion: the workspace must contain exactly the
declared files with exactly the declared bytes, so a leftover file, a missing
write, or a half-written file all fail. `reportNotContains` is what keeps a
refusal honest — RT-004 and RT-005 assert that neither the completion status
nor the success row ever appears.

The harness reports one of seven outcomes:

| Outcome | Meaning | Scenario status |
|---|---|---|
| `PASS` | the run completed and every assertion held | PASS |
| `EXPECTED_REFUSAL` | the system refused safely, as the scenario declared | PASS |
| `EXPECTED_FAILURE` | the system failed, as the scenario declared | PASS |
| `AGENT_FAILURE` | the Agent refused/failed where success was declared | FAIL |
| `CONTRACT_FAILURE` | the outcome matched but a declared detail did not hold | FAIL |
| `UNEXPECTED_SUCCESS` | the run succeeded where a refusal/failure was declared | FAIL |
| `HARNESS_FAILURE` | the harness itself could not run the definition | FAIL |

## 7. How is the workspace isolated?

- The workspace is created per scenario run with `fs.mkdtempSync` under the
  OS temp directory — outside the repository, unique per process, so parallel
  test runs can never collide.
- The scenario handler resolves `args.file` against that workspace root and
  refuses absolute paths, `..` segments, and anything resolving outside it.
- Cleanup removes the whole tree in a `finally` block, on success and on
  failure alike.
- A handler may only be declared by a scenario that also declares a
  workspace, so a writing behaviour can never be pointed at the repository.
- `T-06` and `T-11` assert all of this, including that `docs/v3/01`–`04`,
  `docs/v3/12`, `22`, `23`, and `runtime/local-runtime.mjs` are byte-identical
  after every scenario has run.

## 8. What does PASS mean?

`STATUS PASS` means exactly this: for every run of the scenario, the observed
outcome matched the declared outcome **and** every declared assertion held —
including call counts, the result code/status/stage, the exit code, execution
evidence, report content, and the final workspace bytes. Nothing else is
implied; the harness measures runtime behaviour, not intelligence.

## 9. What does EXPECTED_REFUSAL mean?

It means the system correctly **refused**: `status: "REFUSED"` with a named
code (`APPROVAL_REQUIRED`, `EXECUTION_REFUSED`, …), the Agent either never ran
(gate refusals) or ran and was refused, and no success is claimed anywhere.
RT-004 is exactly this: an unknown hotkey key and a conflicted registry record
both pass because refusing is the correct behaviour. A refusal is not a
harness failure.

## 10. What are Task 17's limits?

- Five small scenarios on one execution surface (hotkeys). They do not show
  that Grimoire can develop software autonomously, and they prove nothing
  about LLM-driven planning, multi-file editing, memory, or long-running loops
  — none of that exists in this repository yet.
- Before Task 21 the shipped Grimoire modules implemented only read behaviours (`R`, `PN`,
  `PTn`), so a change that WRITES needed a supplied behaviour: RT-002/RT-003/RT-005
  supply one through the documented `createRuntime({handlers})` injection
  point, bound to the ACTIVE registry record `G` ("save your files"). The
  Agent, gate, registry, and reports are real; the scenario-provided handler is
  the only scenario-specific piece. Task 21 shipped write behaviour as Grimoire
  module code (`handler.save-files`, `14` §6.1); the injected leg described above
  remains independently testable alongside the native path (§11).
- RT-005's report-failure leg uses one declared harness fault
  (`faults: ["composer-report-bus"]`) to reach a state the repository cannot
  reach from real input. Every other leg runs the unmodified contracts.
- The harness verifies behaviour and contracts. It does not verify product
  value, performance, or safety outside the repository's own scope.

## 11. Future native-write coverage — two handler paths

**Specified by Task 20; implemented by Task 21.** The harness keeps two distinct,
independently testable paths to a `G` handler:

1. **Production / native capability path.** The trial uses the production
   factory/path with an **explicitly declared workspace** — the composition
   root's opt-in `--workspace <dir>` dependency (`24` §3.1) wired to
   `handler.save-files` (`14` §6.1). Nothing is injected for the handler
   itself; the handler reaches the run the same way it reaches any other
   bound hotkey handler, through composition-root binding only. The workspace
   follows every isolation rule in §7 — it is a fresh directory outside the
   repository, and the repository root is categorically never a workspace.
2. **Injected fault-injection path (unchanged).** The existing
   `createRuntime({handlers})` seam stays exactly as it is: RT-002/RT-003/
   RT-005 keep supplying their scenario handler through injection, with
   unchanged behaviour and assertions. This leg exists to inject controlled
   faults and read-only substitutes; it is not replaced or retired when the
   native path arrives.

The real native-write trial is **RT-006** — specified in Group U (`05`) and
`test/scenarios/RT-006.json`, **shipped in Task 21**. It runs the production
path (create, overwrite, gated refusal, gated approval) while the injected
leg keeps RT-002/RT-003/RT-005 unchanged; `node test/scenario-harness.mjs
--all` runs all six scenarios.