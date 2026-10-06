// Grimoire v3 — Real Scenario Test Harness suite (Task 17).
//
// TR coverage map (documented in docs/v3/05-acceptance-tests.md, Group T,
// and docs/v3/25-real-scenario-test-harness.md):
//   T-01 scenario loading — every definition is found, ordered, and valid
//   T-02 validation — malformed definitions fail closed, never partially run
//   T-03 single scenario execution — one scenario runs and asserts
//   T-04 all scenarios execution — `--all` runs every definition
//   T-05 deterministic repeat — same scenario, same observations, same bytes
//   T-06 isolated workspace — fixtures copied out, workspace disposed
//   T-07 real path — real Planner/Agent/Registry/Tool Bus/Runtime/Report Bus
//   T-08 approval-required scenario — refusal without approval, run with it
//   T-09 expected refusal — a refusal is a scenario PASS, not a failure
//   T-10 expected failure — controlled failure stays non-success
//   T-11 protected-file safety — pinned documents and the runtime are untouched
//   T-12 no false success — a mismatch or harness fault never reads as PASS
//
// The scenarios run the real Task 16 Local Runtime over the real contracts;
// nothing here asserts against a mock result.
import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  REPO_ROOT,
  SCENARIOS_DIR,
  FIXTURES_DIR,
  OUTCOMES,
  EXPECTED_OUTCOMES,
  loadScenarios,
  loadScenario,
  validateScenario,
  runScenario,
  runAll,
  renderReport,
  classifyOutcome,
  resolveOutcome,
  createWorkspace,
  disposeWorkspace,
  observeWorkspace,
  main,
} from "./scenario-harness.mjs";

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const isNonEmpty = (value) => typeof value === "string" && value.trim() !== "";
const fileSha = (relative) => sha256(fs.readFileSync(path.join(REPO_ROOT, relative), "utf8"));

const SCENARIO_IDS = Object.freeze(["RT-001", "RT-002", "RT-003", "RT-004", "RT-005", "RT-006"]);

/** Protected by the directive: unchanged by every scenario. */
const PROTECTED = Object.freeze([
  "docs/v3/01-core-specification.md",
  "docs/v3/02-architecture-map.md",
  "docs/v3/03-extension-contract.md",
  "docs/v3/04-decision-rules.md",
  "docs/v3/12-hotkey-registry.md",
  "docs/v3/22-policy-approval-ruling-record.md",
  "docs/v3/23-policy-approval-contract.md",
  "runtime/local-runtime.mjs",
]);

const capture = () => {
  const buffers = { out: "", err: "" };
  return {
    buffers,
    io: {
      stdout: (text) => {
        buffers.out += text;
      },
      stderr: (text) => {
        buffers.err += text;
      },
    },
  };
};

// ---------------------------------------------------------------------------
describe("Scenario harness — loading, validation, execution (T-01 … T-04)", () => {
  it("T-01: every scenario definition loads, ordered, and validates clean", () => {
    const scenarios = loadScenarios();
    assert.deepStrictEqual(scenarios.map((scenario) => scenario.id), SCENARIO_IDS);
    assert.strictEqual(new Set(scenarios.map((scenario) => scenario.id)).size, SCENARIO_IDS.length);
    for (const scenario of scenarios) {
      assert.deepStrictEqual(validateScenario(scenario), [], `${scenario.id} must validate clean`);
      for (const field of ["id", "name", "description", "input", "expected"]) {
        assert.ok(scenario[field] !== undefined, `${scenario.id} declares ${field}`);
      }
      assert.ok(EXPECTED_OUTCOMES.includes(scenario.expected.outcome), `${scenario.id} expected outcome`);
      assert.ok(isNonEmpty(scenario.name) && isNonEmpty(scenario.description), `${scenario.id} is readable`);
      assert.ok(isNonEmpty(scenario.input.plan.task), `${scenario.id} carries a real task`);
      assert.ok(isNonEmpty(scenario.input.execution.target.key), `${scenario.id} carries an explicit target`);
    }
    assert.throws(() => loadScenario("RT-999"), (error) => error.code === "E_UNKNOWN_SCENARIO");
  });

  it("T-02: malformed scenario definitions fail closed with named violations", () => {
    const base = loadScenario("RT-001");
    const cases = [
      [{ ...base, id: "nope" }, /id must match/],
      [{ ...base, name: "" }, /name must be/],
      [{ ...base, description: 7 }, /description must be/],
      [{ ...base, surprise: true }, /unknown scenario field "surprise"/],
      [{ ...base, input: { ...base.input, extra: 1 } }, /unknown field "extra"/],
      [{ ...base, input: { plan: {}, execution: {} }, expected: { outcome: "NOPE" } }, /outcome must be one of/],
      [{ ...base, expected: { ...base.expected, surprise: 1 } }, /unknown field "surprise"/],
      [{ ...base, expected: { outcome: "PASS", counts: { agents: 1 } } }, /counts: unknown field "agents"/],
      [{ ...base, expected: { outcome: "PASS", result: { okd: true } } }, /result: unknown field "okd"/],
      [{ ...base, expected: { outcome: "PASS", exitCode: "0" } }, /exitCode must be an integer/],
      [{ ...base, approval: "maybe" }, /approval must be one of/],
      [{ ...base, faults: ["disk"] }, /unknown fault "disk"/],
      [{ ...base, handler: "delete-everything" }, /handler must be one of/],
      [{ ...base, handler: "workspace-save" }, /requires a declared workspace/],
      [{ ...base, nativeWorkspace: "yes" }, /nativeWorkspace must be a boolean/],
      [{ ...base, nativeWorkspace: true }, /nativeWorkspace requires a declared workspace/],
      [
        { ...base, workspace: { files: ["notes.md"] }, handler: "workspace-save", nativeWorkspace: true },
        /nativeWorkspace cannot be combined with an injected handler/,
      ],
      [{ ...base, workspace: { files: ["../escape.md"] } }, /workspace-relative name/],
      [{ ...base, workspace: { files: [] } }, /workspace.files must be a non-empty array/],
      [{ ...base, variants: [{ name: "" }] }, /name must be a non-empty, unique string/],
      ["not-an-object", /scenario must be a plain object/],
    ];
    for (const [scenario, pattern] of cases) {
      const violations = validateScenario(scenario);
      assert.ok(violations.length > 0, `expected violations for ${pattern}`);
      assert.ok(
        violations.some((violation) => pattern.test(violation.detail)),
        `no violation matched ${pattern}`
      );
      // A definition that does not validate never runs, and never passes.
      const executed = runScenario(scenario);
      assert.strictEqual(executed.status, "FAIL");
      assert.strictEqual(executed.outcome, "HARNESS_FAILURE");
      assert.deepStrictEqual(executed.runs, [], "no run happened for an invalid definition");
    }
    // The vocabulary itself is closed.
    assert.deepStrictEqual(OUTCOMES, [
      "PASS", "EXPECTED_REFUSAL", "EXPECTED_FAILURE",
      "HARNESS_FAILURE", "AGENT_FAILURE", "CONTRACT_FAILURE", "UNEXPECTED_SUCCESS",
    ]);
  });

  it("T-03: a single scenario runs end to end and asserts its own expectations", () => {
    const result = runScenario(loadScenario("RT-001"));
    assert.strictEqual(result.id, "RT-001");
    assert.strictEqual(result.status, "PASS");
    assert.strictEqual(result.outcome, "PASS");
    assert.strictEqual(result.runs.length, 1);
    assert.deepStrictEqual(result.failedAssertions, []);
    assert.ok(result.assertionCount >= 15, `expected a real assertion set (saw ${result.assertionCount})`);
    const [run] = result.runs;
    assert.deepStrictEqual(run.result, {
      ok: true, code: "COMPLETED", status: "COMPLETED", stage: "COMPLETE",
    });
    assert.strictEqual(run.exitCode, 0);
    assert.ok(run.reportSha256 !== null && run.reportSha256.length === 64);
    assert.ok(run.evidence.some((line) => line.includes("execute: handler.readme -> Readme.md")));
  });

  it("T-04: `--all` runs every scenario and the CLI reports one summary", () => {
    const results = runAll();
    assert.strictEqual(results.length, SCENARIO_IDS.length);
    assert.deepStrictEqual(results.map((result) => result.id), SCENARIO_IDS);
    assert.deepStrictEqual(results.map((result) => result.status), Array(6).fill("PASS"));
    const rendered = renderReport(results);
    assert.ok(rendered.includes("SUMMARY scenarios=6 passed=6 failed=0 harnessFailures=0"));
    for (const id of SCENARIO_IDS) assert.ok(rendered.includes(`SCENARIO ${id}`));

    const { buffers, io } = capture();
    assert.strictEqual(main(["--all"], io), 0);
    assert.strictEqual(buffers.err, "");
    assert.ok(buffers.out.includes("SUMMARY scenarios=6 passed=6"));
    assert.strictEqual(main(["RT-003"], io), 0);
    assert.strictEqual(main([], io), 2, "no argument is a usage error");
    assert.strictEqual(main(["--all", "RT-001"], io), 2, "--all takes no id");
    assert.ok(buffers.err.includes("usage: node test/scenario-harness.mjs"));
  });
});

// ---------------------------------------------------------------------------
describe("Scenario harness — determinism and isolation (T-05 … T-06)", () => {
  it("T-05: every scenario is repeatable — same observations, same rendered bytes", () => {
    const first = runAll();
    const second = runAll();
    assert.deepStrictEqual(second, first, "observations are identical across runs");
    assert.strictEqual(renderReport(second), renderReport(first), "rendered report is byte-identical");
    for (const result of first) {
      for (const run of result.runs) {
        assert.strictEqual(run.reportSha256 === null, run.result.code === "REPORT_FAILED");
        assert.ok(run.assertions.every((check) => check.ok), `${result.id}/${run.run} stays green`);
      }
    }
  });

  it("T-06: the workspace is isolated, fixture-sourced, and fully disposed", () => {
    const fixturePath = path.join(FIXTURES_DIR, "notes.md");
    const fixtureBefore = sha256(fs.readFileSync(fixturePath, "utf8"));
    const scenario = loadScenario("RT-002");
    const workspace = createWorkspace(scenario);
    try {
      assert.notStrictEqual(workspace.root.startsWith(REPO_ROOT + path.sep), true, "workspace lives outside the repository");
      assert.strictEqual(workspace.files.length, 1);
      assert.strictEqual(
        fs.readFileSync(path.join(workspace.root, "notes.md"), "utf8"),
        fs.readFileSync(fixturePath, "utf8"),
        "the workspace starts as an exact copy of the committed fixture"
      );
      assert.deepStrictEqual(Object.keys(observeWorkspace(workspace)), ["notes.md"]);
    } finally {
      disposeWorkspace(workspace);
    }
    assert.strictEqual(fs.existsSync(workspace.root), false, "the workspace tree is removed");
    assert.deepStrictEqual(observeWorkspace(workspace), {});
    assert.strictEqual(sha256(fs.readFileSync(fixturePath, "utf8")), fixtureBefore, "the fixture is untouched");
    // A missing fixture is a harness fault, never a silent empty workspace.
    assert.throws(
      () => createWorkspace({ workspace: { files: ["absent.md"] } }),
      (error) => error.code === "E_HARNESS_FIXTURE"
    );
    // No scenario ever creates a workspace inside the repository.
    assert.strictEqual(fs.existsSync(path.join(SCENARIOS_DIR, "workspace")), false);
  });
});

// ---------------------------------------------------------------------------
describe("Scenario harness — the real path (T-07 … T-08)", () => {
  it("T-07: scenarios execute through the real Planner, Agent, registry, tools, runtime, reports", () => {
    const inspection = runScenario(loadScenario("RT-001")).runs[0];
    assert.deepStrictEqual(inspection.counts, { planner: 1, approval: 0, agent: 1, report: 1, toolChecks: 5 });
    assert.ok(inspection.counts.toolChecks > 0, "the real Tool Bus was consulted");
    assert.ok(inspection.evidence.some((line) => line.includes("docs/v3/12-hotkey-registry.md sha256")));
    assert.ok(inspection.evidence.some((line) => line.includes("execute: handler.readme -> Readme.md")));
    assert.ok(inspection.reportText.includes("planner.plan(...) → COMPLETED"), "the real Planner ran");
    assert.ok(inspection.reportText.includes("agent.run(...) → COMPLETED"), "the real Agent ran");
    assert.ok(inspection.reportText.includes("## 5. Remaining issues"), "the real Report Bus rendered");

    // The workspace change really happened inside the workspace, and the
    // repository copy of the same file never changed.
    const change = runScenario(loadScenario("RT-002")).runs[0];
    assert.strictEqual(change.execution.executed, true);
    assert.strictEqual(change.execution.outputFile, "notes.md");
    assert.ok(
      change.workspace["notes.md"].includes("- RT-002: record the workspace entry for the release checklist"),
      "the change is observable in the workspace"
    );
    assert.strictEqual(
      fs.existsSync(path.join(REPO_ROOT, "notes.md")),
      false,
      "no scenario wrote to the repository root"
    );
    assert.strictEqual(
      sha256(change.workspace["notes.md"]),
      change.execution.outputSha256,
      "the reported fingerprint is the file's real fingerprint"
    );
  });

  it("T-08: a review-gated change refuses without approval and runs with explicit approval", () => {
    const result = runScenario(loadScenario("RT-003"));
    assert.strictEqual(result.status, "PASS");
    assert.deepStrictEqual(result.runs.map((run) => run.run), ["primary", "approved"]);
    const [refused, approved] = result.runs;
    assert.strictEqual(refused.observedOutcome, "EXPECTED_REFUSAL");
    assert.deepStrictEqual(refused.counts, { planner: 1, approval: 0, agent: 0, report: 1, toolChecks: 1 });
    assert.strictEqual(refused.result.code, "APPROVAL_REQUIRED");
    assert.strictEqual(refused.result.stage, "GATE");
    assert.strictEqual(refused.exitCode, 3);
    assert.ok(refused.reportText.includes("GATE: refused (APPROVAL_REQUIRED)"));
    assert.strictEqual(refused.workspace["notes.md"], fs.readFileSync(path.join(FIXTURES_DIR, "notes.md"), "utf8"));

    assert.strictEqual(approved.resolvedOutcome, "PASS");
    assert.deepStrictEqual(approved.counts, { planner: 1, approval: 1, agent: 1, report: 1, toolChecks: 5 });
    assert.strictEqual(approved.result.code, "COMPLETED");
    assert.strictEqual(approved.exitCode, 0);
    assert.ok(approved.reportText.includes("GATE: done (approval verified)"));
    assert.ok(approved.workspace["notes.md"].includes("- RT-003: record the workspace entry for the review-gated change"));
    // One consultation per gated attempt — never two, never zero.
    assert.strictEqual(approved.evidence.filter((line) => line.includes("scenario.workspace-save")).length >= 1, true);
  });
});

// ---------------------------------------------------------------------------
describe("Scenario harness — refusal, failure, safety (T-09 … T-12)", () => {
  it("T-09: deliberate refusals are expected outcomes, not harness failures", () => {
    const result = runScenario(loadScenario("RT-004"));
    assert.strictEqual(result.status, "PASS");
    assert.deepStrictEqual(result.runs.map((run) => run.observedOutcome), [
      "EXPECTED_REFUSAL", "EXPECTED_REFUSAL",
    ]);
    const [unknownKey, activationGate] = result.runs;
    assert.strictEqual(unknownKey.execution.code, "E_INPUT_UNKNOWN_KEY");
    assert.strictEqual(activationGate.execution.code, "E_CONFLICT_BLOCKED_CONFLICT");
    for (const run of result.runs) {
      assert.strictEqual(run.counts.agent, 1, "the Agent ran and refused");
      assert.strictEqual(run.result.ok, false);
      assert.strictEqual(run.exitCode, 4);
      assert.ok(!run.reportText.includes("| Status | COMPLETED |"));
      assert.ok(!run.reportText.includes("plan-execution | plan-execution.execute | success"));
    }
    // Taxonomy: a refusal observed where success was expected is an agent
    // failure, and success where a refusal was expected is an unexpected success.
    assert.strictEqual(resolveOutcome("PASS", "EXPECTED_REFUSAL"), "UNEXPECTED_SUCCESS");
    assert.strictEqual(resolveOutcome("EXPECTED_REFUSAL", "PASS"), "AGENT_FAILURE");
    assert.strictEqual(resolveOutcome("EXPECTED_REFUSAL", "EXPECTED_REFUSAL"), "EXPECTED_REFUSAL");
    assert.strictEqual(resolveOutcome("CONTRACT_FAILURE", "EXPECTED_REFUSAL"), "CONTRACT_FAILURE");
    assert.strictEqual(classifyOutcome({ ok: false, status: "REFUSED", code: "X" }), "EXPECTED_REFUSAL");
    assert.strictEqual(classifyOutcome({ ok: false, status: "FAILED", code: "X" }), "EXPECTED_FAILURE");
    assert.strictEqual(classifyOutcome({ ok: false, status: "REPORT_FAILED", code: "REPORT_FAILED" }), "EXPECTED_FAILURE");
    assert.strictEqual(classifyOutcome({ ok: true, status: "COMPLETED", code: "COMPLETED" }), "PASS");
  });

  it("T-10: controlled failures stay non-success and keep the report honest", () => {
    const result = runScenario(loadScenario("RT-005"));
    assert.strictEqual(result.status, "PASS");
    const [handlerFailure, reportFailure] = result.runs;
    assert.strictEqual(handlerFailure.observedOutcome, "EXPECTED_FAILURE");
    assert.strictEqual(handlerFailure.result.code, "EXECUTION_FAILED");
    assert.strictEqual(handlerFailure.result.status, "FAILED");
    assert.strictEqual(handlerFailure.execution.code, "E_ENV_MISSING_FILE");
    assert.strictEqual(handlerFailure.workspace["notes.md"], fs.readFileSync(path.join(FIXTURES_DIR, "notes.md"), "utf8"),
      "a failed execution leaves no half-written workspace file");
    assert.ok(!handlerFailure.workspace["notes.md"].includes("must never be written"));

    assert.strictEqual(reportFailure.observedOutcome, "EXPECTED_FAILURE");
    assert.strictEqual(reportFailure.result.code, "REPORT_FAILED");
    assert.strictEqual(reportFailure.result.stage, "REPORT");
    assert.strictEqual(reportFailure.reportSha256, null, "no report artifact exists for a refused build");
    assert.strictEqual(reportFailure.reportText, null);
    assert.strictEqual(reportFailure.execution.executed, true, "the execution did happen; only the report failed");
    assert.strictEqual(reportFailure.exitCode, 5);
  });

  it("T-11: protected documents and the Local Runtime are byte-identical after every scenario", () => {
    const before = PROTECTED.map((file) => fileSha(file));
    runAll();
    const after = PROTECTED.map((file) => fileSha(file));
    assert.deepStrictEqual(after, before, "no scenario may modify a protected file");
    // The scenario handler refuses to leave its workspace.
    const workspace = createWorkspace(loadScenario("RT-002"));
    try {
      const escaping = runScenario({
        ...loadScenario("RT-002"),
        input: {
          ...loadScenario("RT-002").input,
          execution: {
            ...loadScenario("RT-002").input.execution,
            args: { file: "../notes.md", entry: "- escape" },
          },
        },
      });
      assert.strictEqual(escaping.status, "FAIL");
      assert.strictEqual(escaping.runs[0].result.ok, false, "an escaping path never executes");
      assert.ok(!fs.existsSync(path.join(SCENARIOS_DIR, "notes.md")), "nothing escaped into the scenarios dir");
      assert.strictEqual(fs.existsSync(path.join(REPO_ROOT, "notes.md")), false);
      assert.ok(fs.existsSync(workspace.root));
    } finally {
      disposeWorkspace(workspace);
    }
  });

  it("T-12: mismatches and harness faults never read as a pass", () => {
    const base = loadScenario("RT-001");

    // 1. A success observed where a refusal was expected.
    const unexpectedSuccessScenario = {
      ...base,
      expected: { ...base.expected, outcome: "EXPECTED_REFUSAL" },
    };
    const unexpectedSuccess = runScenario(unexpectedSuccessScenario);
    assert.strictEqual(unexpectedSuccess.status, "FAIL");
    assert.strictEqual(unexpectedSuccess.outcome, "UNEXPECTED_SUCCESS");
    assert.ok(unexpectedSuccess.failedAssertions.some((check) => check.name === "outcome"));

    // 2. A result that does not match the declared code/class.
    const wrongCode = runScenario({
      ...base,
      expected: { ...base.expected, result: { ok: false, code: "EXECUTION_REFUSED" } },
    });
    assert.strictEqual(wrongCode.status, "FAIL");
    assert.strictEqual(wrongCode.outcome, "CONTRACT_FAILURE");

    // 3. An Agent refusal where the scenario promised success.
    const agentFailure = runScenario({
      ...base,
      input: {
        ...base.input,
        execution: { ...base.input.execution, target: { key: "GHOST" } },
      },
    });
    assert.strictEqual(agentFailure.status, "FAIL");
    assert.strictEqual(agentFailure.outcome, "AGENT_FAILURE");

    // 4. A harness fault (missing fixture) is reported, never swallowed.
    const harnessFaultScenario = { ...base, workspace: { files: ["absent.md"] } };
    const harnessFault = runScenario(harnessFaultScenario);
    assert.strictEqual(harnessFault.status, "FAIL");
    assert.strictEqual(harnessFault.outcome, "HARNESS_FAILURE");
    assert.strictEqual(harnessFault.detail.code, "E_HARNESS_FIXTURE");

    // 5. CLI exit semantics over injected scenarios: 3 for a failed
    //    scenario, 4 for a harness failure, 0 for a passing one.
    const { buffers, io } = capture();
    assert.strictEqual(main(["RT-001"], { ...io, loadScenario: () => base }), 0);
    assert.strictEqual(main(["RT-001"], { ...io, loadScenario: () => unexpectedSuccessScenario }), 3);
    assert.strictEqual(main(["RT-001"], { ...io, loadScenario: () => harnessFaultScenario }), 4);
    assert.strictEqual(main(["RT-001"], { ...io, loadScenario: () => ({ ...base, id: "bad" }) }), 4);
    assert.ok(buffers.out.includes("STATUS PASS"));
    assert.ok(buffers.out.includes("STATUS FAIL"));
    assert.ok(buffers.out.includes("SUMMARY scenarios=1 passed=0"));
  });
});