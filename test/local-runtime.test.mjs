// Grimoire v3 — Local Runtime integration suite (Task 16).
//
// LR coverage map (documented in docs/v3/05-acceptance-tests.md, Group S,
// and docs/v3/24-local-runtime.md):
//   I-01  ungated successful execution — planner → gate → agent → report
//   I-02  review required, no approval component → APPROVAL_REQUIRED (D0)
//   I-03  review required, valid approval → gate opens, agent executes
//   I-04  wrong plan binding → refusal, agent 0
//   I-05  wrong execution binding → refusal, agent 0
//   I-06  invalid verdict (malformed / non-affirmative) → fail closed
//   I-07  agent refusal propagates — never a silent success
//   I-08  report failure propagates — never a fabricated completion
//   I-09  repeated execution — deterministic, stateless, no cached verdict
//   I-10  full local trial — the real CLI process: file/stdin input, the
//         planner → GATE → agent → tool bus → hotkey runtime → report path,
//         and the process exit codes
//
// Every scenario wires the REAL Planner, Agent Orchestrator, Module
// Registry, Tool Bus, Hotkey Runtime, and Report Bus — `createLocalDependencies`
// is the runtime's own constructor, so these tests exercise exactly the
// wiring the CLI uses. The only injected pieces are counting probes
// (plan/run/build/verify) and the deliberately controlled faults: I-07's
// unknown hotkey key is real input through the real stack, and I-08's
// failing composer report bus is an injected test double. Approval
// components are always explicit injections (23 §2) — the runtime never
// supplies one on its own (I-02).
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  createLocalDependencies,
  runLocalRuntime,
  presentResult,
  exitCodeFor,
  main,
} from "../runtime/local-runtime.mjs";
import { planIdentity, executionIdentity } from "../composition/plan-execution/index.mjs";

const ROOT = process.cwd();
const ENTRY = path.join(ROOT, "runtime", "local-runtime.mjs");
const FIXTURE = path.join(ROOT, "test", "_fixtures", "composition_request.json");

const GATED_FIXTURE = path.join(ROOT, "test", "_fixtures", "local_runtime_gated.json");

const REQ = JSON.parse(readFileSync(FIXTURE, "utf8"));
const GATED = JSON.parse(readFileSync(GATED_FIXTURE, "utf8"));

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** stdout layout: line 1 = JSON header, remainder = Report Bus text. */
function parsePrinted(printed) {
  const newline = printed.indexOf("\n");
  assert.notStrictEqual(newline, -1, "printed output always carries the header line");
  return {
    header: JSON.parse(printed.slice(0, newline)),
    reportText: printed.slice(newline + 1),
  };
}

// Real wiring + counting probes. One rig = one fresh dependency set; the
// shared probes let a test observe plan/run/build/verify across consecutive
// executions without changing any behavior.
function makeRig() {
  const deps = createLocalDependencies();
  const counts = { plan: 0, run: 0, build: 0, verify: 0 };
  const wrapped = {
    planner: {
      plan(request) {
        counts.plan += 1;
        return deps.planner.plan(request);
      },
    },
    agent: {
      run(request) {
        counts.run += 1;
        return deps.agent.run(request);
      },
    },
    reportBus: {
      build(input) {
        counts.build += 1;
        return deps.reportBus.build(input);
      },
    },
  };
  // An explicitly injected approval component that counts its consultations
  // and delegates the verdict to the supplied function.
  const countingApproval = (verdictOf) => ({
    verify(plan, execution) {
      counts.verify += 1;
      return verdictOf(plan, execution);
    },
  });
  return { counts, wrapped, countingApproval };
}

const grantVerdict = (plan, execution) => ({
  granted: true,
  plan: planIdentity(plan),
  execution: executionIdentity(execution),
});
const denyVerdict = (plan, execution) => ({
  granted: false,
  plan: planIdentity(plan),
  execution: executionIdentity(execution),
});

const D0_DETAIL =
  "plan review is required before execution (migration) — the approval gate belongs to the policy/approval contract";

const runCli = (args, options = {}) =>
  spawnSync(process.execPath, [ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input: options.input,
  });

// ---------------------------------------------------------------------------
describe("Local runtime integration (I-01 … I-10)", () => {
  it("I-01: ungated successful execution — real planner → gate → agent → report, exit 0", () => {
    const rig = makeRig();
    // A component is injected but the plan does not require review: it must
    // never be consulted (approval.verify = 0).
    const result = runLocalRuntime(REQ, {
      ...rig.wrapped,
      approval: rig.countingApproval(grantVerdict),
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.strictEqual(result.error, null);
    assert.deepStrictEqual(rig.counts, { plan: 1, run: 1, build: 1, verify: 0 });
    // Three hash-valid reports: planner, agent, composer.
    assert.notStrictEqual(result.planning.report, null);
    assert.notStrictEqual(result.orchestration.report, null);
    assert.notStrictEqual(result.report, null);
    for (const report of [result.planning.report, result.orchestration.report, result.report]) {
      assert.strictEqual(report.sha256, sha256(report.text));
    }
    assert.ok(result.report.text.includes("| Status | COMPLETED |"));
    assert.ok(result.report.text.includes("GATE: done (review not required)"));
    assert.ok(result.report.text.includes("ORCHESTRATE: done (agent → COMPLETED)"));
    // The agent really executed through the tool bus and hotkey runtime.
    assert.strictEqual(result.orchestration.execution.executed, true);
    assert.strictEqual(exitCodeFor(result), 0);
    const { header, reportText } = parsePrinted(presentResult(result));
    assert.strictEqual(header.code, "COMPLETED");
    assert.strictEqual(header.reportSha256, sha256(reportText));
  });

  it("I-02: review required without an approval component → APPROVAL_REQUIRED (D0), agent 0", () => {
    const rig = makeRig();
    // No `approval` option at all — the runtime must not invent one.
    const result = runLocalRuntime(GATED, rig.wrapped);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "APPROVAL_REQUIRED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "GATE");
    assert.strictEqual(result.error.class, "E-INPUT");
    assert.strictEqual(result.error.detail, D0_DETAIL);
    assert.deepStrictEqual(rig.counts, { plan: 1, run: 0, build: 1, verify: 0 });
    assert.notStrictEqual(result.planning, null, "the plan was produced before the gate");
    assert.strictEqual(result.orchestration, null, "the agent never ran");
    assert.notStrictEqual(result.report, null, "a refusal still reports");
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    const evidence = result.report.text.split("## 4. Evidence")[1] ?? "";
    assert.ok(!evidence.includes("approval.verify"), "D0 consults nothing");
    assert.strictEqual(exitCodeFor(result), 3);
  });

  it("I-03: review required with valid approval → verify 1, bindings correct, agent executes", () => {
    const rig = makeRig();
    const result = runLocalRuntime(GATED, {
      ...rig.wrapped,
      approval: rig.countingApproval(grantVerdict),
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 1, build: 1 });
    assert.ok(result.report.text.includes("GATE: done (approval verified)"));
    assert.ok(result.report.text.includes("approval.verify(...) → affirmative"));
    assert.ok(result.report.text.includes("approval.binding → verified"));
    assert.strictEqual(result.orchestration.execution.executed, true);
    assert.strictEqual(exitCodeFor(result), 0);
  });

  it("I-04: wrong plan binding → APPROVAL_REQUIRED (D3), verify 1, agent 0", () => {
    const rig = makeRig();
    const result = runLocalRuntime(GATED, {
      ...rig.wrapped,
      approval: rig.countingApproval((plan, execution) => ({
        granted: true,
        plan: "a".repeat(64),
        execution: executionIdentity(execution),
      })),
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "APPROVAL_REQUIRED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "GATE");
    assert.strictEqual(result.error.detail, "approval verdict binding mismatch");
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 0, build: 1 });
    assert.strictEqual(result.orchestration, null);
    assert.notStrictEqual(result.report, null);
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    assert.strictEqual(exitCodeFor(result), 3);
  });

  it("I-05: wrong execution binding → APPROVAL_REQUIRED (D3), verify 1, agent 0", () => {
    const rig = makeRig();
    const result = runLocalRuntime(GATED, {
      ...rig.wrapped,
      approval: rig.countingApproval((plan, execution) => ({
        granted: true,
        plan: planIdentity(plan),
        execution: "b".repeat(64),
      })),
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "APPROVAL_REQUIRED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "GATE");
    assert.strictEqual(result.error.detail, "approval verdict binding mismatch");
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 0, build: 1 });
    assert.strictEqual(result.orchestration, null);
    assert.notStrictEqual(result.report, null);
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    assert.strictEqual(exitCodeFor(result), 3);
  });

  it("I-06: invalid verdict fails closed — malformed and non-affirmative never execute", () => {
    const cases = [
      {
        name: "missing execution binding",
        verdict: (plan, execution) => ({ granted: true, plan: planIdentity(plan) }),
        detail: "approval verdict malformed",
      },
      {
        name: "granted is not a boolean",
        verdict: (plan, execution) => ({
          granted: "true",
          plan: planIdentity(plan),
          execution: executionIdentity(execution),
        }),
        detail: "approval verdict malformed",
      },
      {
        name: "well-formed but non-affirmative",
        verdict: denyVerdict,
        detail: "approval verdict not affirmative",
      },
    ];
    for (const testCase of cases) {
      const rig = makeRig();
      const result = runLocalRuntime(GATED, {
        ...rig.wrapped,
        approval: rig.countingApproval(testCase.verdict),
      });
      assert.strictEqual(result.ok, false, testCase.name);
      assert.strictEqual(result.code, "APPROVAL_REQUIRED", testCase.name);
      assert.strictEqual(result.status, "REFUSED", testCase.name);
      assert.strictEqual(result.stage, "GATE", testCase.name);
      assert.strictEqual(result.error.detail, testCase.detail, testCase.name);
      assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 0, build: 1 }, testCase.name);
      assert.strictEqual(result.orchestration, null, testCase.name);
      assert.notStrictEqual(result.report, null, testCase.name);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), testCase.name);
      assert.strictEqual(exitCodeFor(result), 3, testCase.name);
    }
  });

  it("I-07: agent refusal propagates through the real stack — never a silent success", () => {
    const rig = makeRig();
    // A real input the real runtime refuses: unknown hotkey key.
    const result = runLocalRuntime(
      { ...REQ, execution: { ...REQ.execution, target: { key: "GHOST" } } },
      rig.wrapped
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "EXECUTION_REFUSED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "ORCHESTRATE");
    assert.ok(result.error.detail.includes("E_INPUT_UNKNOWN_KEY"), result.error.detail);
    assert.deepStrictEqual(rig.counts, { plan: 1, run: 1, build: 1, verify: 0 });
    // The downstream attempt is consumed verbatim and still reports.
    assert.notStrictEqual(result.orchestration, null);
    assert.strictEqual(result.orchestration.execution.executed, false);
    assert.notStrictEqual(result.orchestration.report, null);
    assert.strictEqual(result.orchestration.report.sha256, sha256(result.orchestration.report.text));
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
    assert.ok(result.report.text.includes("ORCHESTRATE: refused (EXECUTION_REFUSED)"));
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"));
    assert.strictEqual(exitCodeFor(result), 4);
  });

  it("I-08: report failure propagates — the failure never becomes a fabricated success", () => {
    const deps = createLocalDependencies();
    const counts = { run: 0, build: 0 };
    const agent = {
      run(request) {
        counts.run += 1;
        return deps.agent.run(request);
      },
    };
    // Controlled fault: the composer's report bus refuses every input.
    const failingReportBus = {
      build() {
        counts.build += 1;
        return {
          ok: false,
          code: "DEPENDENCY_ERROR",
          error: { class: "E-ENV", code: "DEPENDENCY_ERROR", message: "refused", detail: "corrupt row" },
          violations: [{ code: "DEPENDENCY_ERROR", detail: "corrupt row" }],
        };
      },
    };
    const result = runLocalRuntime(REQ, {
      planner: deps.planner,
      agent,
      reportBus: failingReportBus,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null, "no report artifact exists for a refused build");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), result.error.detail);
    assert.deepStrictEqual(counts, { run: 1, build: 1 });
    // The underlying attempt is preserved; completion is not claimed.
    assert.notStrictEqual(result.orchestration, null);
    assert.strictEqual(exitCodeFor(result), 5);
    const printed = presentResult(result);
    const { header, reportText } = parsePrinted(printed);
    assert.strictEqual(header.code, "REPORT_FAILED");
    assert.strictEqual(header.reportSha256, null);
    assert.strictEqual(reportText, "");
    assert.ok(!printed.includes("| Status | COMPLETED |"));
  });

  it("I-09: repeated execution — deterministic, stateless, no cached verdict, no count leakage", () => {
    // (a) The same input twice on fresh rigs → identical results, byte-identical output.
    const first = makeRig();
    const resultOne = runLocalRuntime(REQ, {
      ...first.wrapped,
      approval: first.countingApproval(grantVerdict),
    });
    const second = makeRig();
    const resultTwo = runLocalRuntime(REQ, {
      ...second.wrapped,
      approval: second.countingApproval(grantVerdict),
    });
    assert.deepStrictEqual(resultOne, resultTwo);
    assert.strictEqual(presentResult(resultOne), presentResult(resultTwo));
    assert.deepStrictEqual(first.counts, { plan: 1, run: 1, build: 1, verify: 0 });
    assert.deepStrictEqual(second.counts, { plan: 1, run: 1, build: 1, verify: 0 });

    // (b) Grant → deny → grant on ONE wiring: a denied verdict is never
    // stale-cached from the previous grant, counts reset per execution,
    // and the two granted runs render byte-identically.
    const rig = makeRig();
    const grantedA = runLocalRuntime(GATED, {
      ...rig.wrapped,
      approval: rig.countingApproval(grantVerdict),
    });
    assert.strictEqual(grantedA.ok, true);
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 1, build: 1 });
    const denied = runLocalRuntime(GATED, {
      ...rig.wrapped,
      approval: rig.countingApproval(denyVerdict),
    });
    assert.strictEqual(denied.ok, false);
    assert.strictEqual(denied.code, "APPROVAL_REQUIRED");
    assert.strictEqual(denied.error.detail, "approval verdict not affirmative");
    assert.deepStrictEqual(rig.counts, { plan: 2, verify: 2, run: 1, build: 2 });
    const grantedB = runLocalRuntime(GATED, {
      ...rig.wrapped,
      approval: rig.countingApproval(grantVerdict),
    });
    assert.strictEqual(grantedB.ok, true);
    assert.deepStrictEqual(rig.counts, { plan: 3, verify: 3, run: 2, build: 3 });
    assert.strictEqual(grantedA.report.sha256, grantedB.report.sha256);
    assert.strictEqual(grantedA.report.text, grantedB.report.text);

    // (c) The real CLI process twice on the same input file → byte-identical
    // stdout and the same exit code.
    const runOne = runCli([FIXTURE]);
    const runTwo = runCli([FIXTURE]);
    assert.strictEqual(runOne.status, 0);
    assert.strictEqual(runTwo.status, 0);
    assert.strictEqual(runOne.stdout, runTwo.stdout);
    assert.strictEqual(runOne.stderr, "");

    // (d) Source scan: the runtime carries no clock, randomness, process
    // identity, environment reads, or module-level mutable state.
    const source = readFileSync(ENTRY, "utf8");
    for (const banned of [
      "Math.random",
      "process.env",
      "process.pid",
      "Date.now",
      "new Date",
      "globalThis",
      "setTimeout",
      "node:crypto",
    ]) {
      assert.ok(!source.includes(banned), `runtime source must not contain ${banned}`);
    }
  });

  it("I-10: full local trial — the real CLI process end to end, with exit semantics", () => {
    // (a) File input through the whole path: planner → GATE (review not
    // required) → agent → tool bus → hotkey runtime → report → process.
    const fileRun = runCli([FIXTURE]);
    assert.strictEqual(fileRun.status, 0, fileRun.stderr);
    assert.strictEqual(fileRun.stderr, "", "success prints no diagnostics");
    const file = parsePrinted(fileRun.stdout);
    assert.strictEqual(file.header.ok, true);
    assert.strictEqual(file.header.code, "COMPLETED");
    assert.strictEqual(file.header.status, "COMPLETED");
    assert.strictEqual(file.header.stage, "COMPLETE");
    assert.strictEqual(file.header.error, null);
    assert.strictEqual(file.header.reportSha256, sha256(file.reportText));
    for (const stage of [
      "RECEIVE: done (bundle)",
      "VALIDATE: done (contract)",
      "PLAN: done (planner → COMPLETED)",
      "GATE: done (review not required)",
      "ORCHESTRATE: done (agent → COMPLETED)",
      "REPORT: done (report-bus)",
      "COMPLETE: done",
    ]) {
      assert.ok(file.reportText.includes(stage), `report carries ${stage}`);
    }

    // (b) The gated fixture file without an authorization flag → refusal, exit 3.
    const refusedRun = runCli([GATED_FIXTURE]);
    assert.strictEqual(refusedRun.status, 3);
    const refused = parsePrinted(refusedRun.stdout);
    assert.strictEqual(refused.header.ok, false);
    assert.strictEqual(refused.header.code, "APPROVAL_REQUIRED");
    assert.strictEqual(refused.header.stage, "GATE");
    assert.strictEqual(refused.header.error.detail, D0_DETAIL);

    // (c) The same gated fixture with the explicitly requested demo approval →
    // the gate opens and the process succeeds.
    const approvedRun = runCli(["--approval", "grant", GATED_FIXTURE]);
    assert.strictEqual(approvedRun.status, 0, approvedRun.stderr);
    const approved = parsePrinted(approvedRun.stdout);
    assert.strictEqual(approved.header.ok, true);
    assert.strictEqual(approved.header.code, "COMPLETED");
    assert.ok(approved.reportText.includes("GATE: done (approval verified)"));

    // (d) The demo denial from the same flag, gated bundle on stdin → refusal, exit 3.
    const deniedRun = runCli(["--approval", "deny", "-"], { input: JSON.stringify(GATED) });
    assert.strictEqual(deniedRun.status, 3);
    const denied = parsePrinted(deniedRun.stdout);
    assert.strictEqual(denied.header.code, "APPROVAL_REQUIRED");
    assert.strictEqual(denied.header.error.detail, "approval verdict not affirmative");

    // (e) Invalid bundle on stdin → INVALID_REQUEST, exit 2.
    const invalidRun = runCli(["-"], {
      input: JSON.stringify({ plan: {}, execution: {}, approval: {} }),
    });
    assert.strictEqual(invalidRun.status, 2);
    const invalid = parsePrinted(invalidRun.stdout);
    assert.strictEqual(invalid.header.code, "INVALID_REQUEST");
    assert.strictEqual(invalid.header.stage, "VALIDATE");

    // (f) Usage and unparseable-input errors → exit 2 with a stderr message
    // and no success output (checked in process through the injected io).
    let stdout = "";
    let stderr = "";
    const io = {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    };
    assert.strictEqual(main([], io), 2);
    assert.ok(stderr.includes("usage: node runtime/local-runtime.mjs"));
    assert.strictEqual(stdout, "");
    // Unparseable stdin input → exit 2, INPUT ERROR on stderr, nothing on stdout.
    const badJson = runCli(["-"], { input: "not json" });
    assert.strictEqual(badJson.status, 2);
    assert.ok(badJson.stderr.includes("INPUT ERROR"));
    assert.strictEqual(badJson.stdout, "");
  });
});
