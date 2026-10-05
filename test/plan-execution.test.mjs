// Grimoire v3 — Plan–Execution composition suite.
//
// PE coverage map (documented in docs/v3/05-acceptance-tests.md, Group Q,
// and docs/v3/20-plan-execution-composition.md §Tests):
//   PE-01  entry point, configuration, vocabularies, no new registry entry — block 1
//   PE-02  happy path: plan → gate → orchestrate → report → complete
//   PE-03  a planner refusal propagates; execution never runs
//   PE-04  an incomplete plan propagates as PLAN_INCOMPLETE
//   PE-05  the §5.2 approval gate refuses before any execution
//   PE-06  an invalid bundle fails closed before any attempt
//   PE-07  non-conforming downstream attempts fail closed (belts)  — block 2
//   PE-08  a malformed execution envelope propagates from the agent
//   PE-09  downstream registry gates propagate (unknown, disabled, phase)
//   PE-10  capability and tool refusals propagate (unavailable, blocked, missing)
//   PE-11  a downstream runtime refusal propagates (EXECUTION_REFUSED)
//   PE-12  a downstream handler failure propagates (EXECUTION_FAILED)
//   PE-13  a composer report failure never claims completion
//   PE-14  a planner report failure propagates through the plan stage
//   PE-15  wiring: one plan call, one run call, exact order          — block 3
//   PE-16  public surface is exactly execute(); sources honor the boundary
//   PE-17  composer → Report Bus — a real completion input, real build
//   PE-18  no fabricated completion — only a COMPLETED result reads as success — block 4
//   PE-19  determinism: identical bundles, identical results, identical hashes
//   PE-20  the report always mirrors the result — code, status, stage, issue
//   PE-21  no bypass: every downstream non-success stays non-success
//   PE-M1…M10  ten fail-closed mutations (byte-different fixtures)
//
// Mutation fixtures are asserted byte-different from the pristine bundle
// (test/_fixtures/composition_request.json) before they are trusted; M10's
// corrupted report input is asserted byte-different AND content-different
// from the pristine report input captured on a successful control run.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createPlanExecutionComposer,
  LIFECYCLE_STAGES,
  RESULT_CODES,
  validateBundle,
  normalizeBundle,
  BUNDLE_FIELDS,
  COMPOSITION_ERROR_CLASSES,
  CORE_ERROR_CLASSES,
} from "../composition/plan-execution/index.mjs";
import {
  createPlanner,
  RESULT_CODES as PLANNER_RESULT_CODES,
} from "../modules/planner/index.mjs";
import {
  createAgentOrchestrator,
  RESULT_CODES as AGENT_RESULT_CODES,
} from "../modules/agent/index.mjs";
import { createModuleRegistry } from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import { createRuntime } from "../modules/hotkeys/src/runtime.mjs";
import { defineHandler } from "../modules/hotkeys/src/handlers.mjs";
import { createReportBus } from "../modules/report-bus/index.mjs";

const ROOT = process.cwd();
const FIX = path.join(ROOT, "test/_fixtures/");
const COMPOSITION_DIR = path.join(ROOT, "composition/plan-execution");
const PRISTINE = readFileSync(path.join(FIX, "composition_request.json"), "utf8");
const REQ = JSON.parse(PRISTINE);
const REGISTRY_TEXT = readFileSync(path.join(ROOT, "docs/v3/12-hotkey-registry.md"), "utf8");

const MODULE_IDS = ["hotkeys", "tool-bus", "module-registry", "report-bus", "agent"];
const MANIFESTS = MODULE_IDS.map((id) => ({
  id,
  text: readFileSync(path.join(ROOT, `modules/${id}/manifest.yaml`), "utf8"),
}));

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, PRISTINE, `${name} must be byte-different from the pristine bundle`);
  return JSON.parse(text);
}

function makeBus() {
  return createToolBus({
    declarationText: loadCapabilityDeclarations(),
    providers: createDefaultProviders(),
    root: ROOT,
  });
}

function makeRegistry({ enable = ["hotkeys"], bus = makeBus() } = {}) {
  const registry = createModuleRegistry({ toolBus: bus });
  for (const manifest of MANIFESTS) {
    const registered = registry.register(manifest.text);
    assert.strictEqual(registered.ok, true, `${manifest.id}: ${JSON.stringify(registered)}`);
  }
  for (const id of enable) {
    const enabled = registry.enable(id);
    assert.strictEqual(enabled.ok, true, `${id}: ${JSON.stringify(enabled)}`);
  }
  return registry;
}

function makeRuntime(overrides = {}) {
  return createRuntime({ registryText: REGISTRY_TEXT, root: ROOT, ...overrides });
}

const faultBus = (code) => ({ check: () => ({ ok: false, code }) });

const failingReportBus = () => ({
  build: () => ({
    ok: false,
    code: "DEPENDENCY_ERROR",
    error: { class: "E-ENV", code: "DEPENDENCY_ERROR", message: "refused", detail: "corrupt row" },
    violations: [{ code: "DEPENDENCY_ERROR", detail: "corrupt row" }],
  }),
});

function spyReportBus() {
  const real = createReportBus();
  const inputs = [];
  return {
    inputs,
    reportBus: {
      build(input) {
        inputs.push(input);
        return real.build(input);
      },
    },
  };
}

// Standard composition: the planner and the agent are injected as the
// composition root wires them; the registry is ALWAYS built against a
// healthy bus (a fault bus is handed to the agent's preflight only).
function makeComposer({
  enable = ["hotkeys"],
  toolBus = makeBus(),
  composerReportBus = createReportBus(),
  plannerReportBus = createReportBus(),
  agentReportBus = createReportBus(),
  runtime = makeRuntime(),
} = {}) {
  const planner = createPlanner({ reportBus: plannerReportBus });
  const agent = createAgentOrchestrator({
    registry: makeRegistry({ enable, bus: makeBus() }),
    runtime,
    toolBus,
    reportBus: agentReportBus,
  });
  return createPlanExecutionComposer({ planner, agent, reportBus: composerReportBus });
}

// The same composition with every downstream call recorded (wiring probes).
function makeSpiedComposer(options = {}) {
  const calls = { plan: [], run: [] };
  const plannerReportBus = options.plannerReportBus ?? createReportBus();
  const agentReportBus = options.agentReportBus ?? createReportBus();
  const realPlanner = createPlanner({ reportBus: plannerReportBus });
  const realAgent = createAgentOrchestrator({
    registry: makeRegistry({ enable: ["hotkeys"], bus: makeBus() }),
    runtime: options.runtime ?? makeRuntime(),
    toolBus: options.toolBus ?? makeBus(),
    reportBus: agentReportBus,
  });
  const planner = {
    plan(request) {
      calls.plan.push(request);
      return realPlanner.plan(request);
    },
  };
  const agent = {
    run(request) {
      calls.run.push(request);
      return realAgent.run(request);
    },
  };
  const composer = createPlanExecutionComposer({
    planner,
    agent,
    reportBus: options.composerReportBus ?? createReportBus(),
  });
  return { composer, calls };
}

const without = (object, ...keys) =>
  Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

const TIER3 = { ...REQ, plan: { ...REQ.plan, tier: "T3" } };
const NORISKS = { ...REQ, plan: without(REQ.plan, "risks") };
const TRIGGER = { ...REQ, plan: { ...REQ.plan, trigger: "migration" } };
const EX = REQ.execution;

// ---------------------------------------------------------------------------
describe("Composition contract (PE-01 … PE-06)", () => {
  it("PE-01: entry point, configuration, vocabularies, no new registry entry", async () => {
    const entry = await import("../composition/plan-execution/index.mjs");
    for (const name of [
      "createPlanExecutionComposer", "LIFECYCLE_STAGES", "RESULT_CODES",
      "validateBundle", "normalizeBundle", "BUNDLE_FIELDS",
      "COMPOSITION_ERROR_CLASSES", "CORE_ERROR_CLASSES", "makeError", "isCoreErrorClass",
    ]) {
      assert.ok(name in entry, `entry must export ${name}`);
    }
    // The entry reaches only its own files — no node:, no lateral modules.
    const source = readFileSync(path.join(COMPOSITION_DIR, "index.mjs"), "utf8");
    for (const [, spec] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(spec.startsWith("./"), `entry may only import its own files (saw "${spec}")`);
    }

    // This layer registers NOTHING: it is the composition root, not a
    // module — no manifest, no capability, no registry declaration.
    const layout = readdirSync(COMPOSITION_DIR).sort();
    assert.deepStrictEqual(layout, ["index.mjs", "src"], "no manifest, no new registry entry");
    assert.ok(!layout.includes("manifest.yaml"));

    // Configuration fails closed at construction (01 §13.5).
    const good = {
      planner: { plan: () => {} },
      agent: { run: () => {} },
      reportBus: { build: () => {} },
    };
    for (const missing of ["planner", "agent", "reportBus"]) {
      const partial = { ...good };
      delete partial[missing];
      assert.throws(() => createPlanExecutionComposer(partial), (error) => error.code === "E_INPUT_INVALID_COMPOSITION_CONFIG");
    }
    assert.throws(() => createPlanExecutionComposer({}), (error) => error.code === "E_INPUT_INVALID_COMPOSITION_CONFIG");
    assert.throws(
      () => createPlanExecutionComposer({ planner: { plan: 1 }, agent: good.agent, reportBus: good.reportBus }),
      (error) => error.code === "E_INPUT_INVALID_COMPOSITION_CONFIG"
    );

    // Result-code table: exactly fourteen codes, one success, three
    // classified — the union of the two downstream vocabularies plus the
    // approval gate, in lifecycle order, each class identical to the
    // upstream contract it came from (no second taxonomy).
    assert.deepStrictEqual(Object.keys(RESULT_CODES), [
      "COMPLETED", "INVALID_REQUEST", "PLAN_INCOMPLETE", "REPORT_FAILED",
      "APPROVAL_REQUIRED", "MODULE_NOT_FOUND", "MODULE_DISABLED",
      "CAPABILITY_UNAVAILABLE", "CAPABILITY_AMBIGUOUS", "PHASE_NOT_DECLARED",
      "MANIFEST_INVALID", "TOOL_REQUIRED", "EXECUTION_REFUSED", "EXECUTION_FAILED",
    ]);
    assert.strictEqual(RESULT_CODES.COMPLETED, null);
    assert.deepStrictEqual(
      Object.entries(RESULT_CODES).filter(([, klass]) => klass === "classified").map(([code]) => code),
      ["REPORT_FAILED", "EXECUTION_REFUSED", "EXECUTION_FAILED"]
    );
    assert.strictEqual(RESULT_CODES.APPROVAL_REQUIRED, "E-INPUT");
    for (const [code, klass] of Object.entries(AGENT_RESULT_CODES)) {
      assert.strictEqual(RESULT_CODES[code], klass, `agent code ${code} keeps its class`);
    }
    for (const [code, klass] of Object.entries(PLANNER_RESULT_CODES)) {
      assert.strictEqual(RESULT_CODES[code], klass, `planner code ${code} keeps its class`);
    }
    for (const [code, klass] of Object.entries(RESULT_CODES)) {
      if (klass === null || klass === "classified") continue;
      assert.ok(COMPOSITION_ERROR_CLASSES.includes(klass), `${code} → ${klass}`);
      assert.ok(CORE_ERROR_CLASSES.includes(klass), `${code} → ${klass}`);
    }
    // Lifecycle vocabulary: PLAN → GATE → ORCHESTRATE, report-gated.
    assert.deepStrictEqual([...LIFECYCLE_STAGES], [
      "RECEIVE", "VALIDATE", "PLAN", "GATE", "ORCHESTRATE", "REPORT", "COMPLETE",
    ]);
    assert.deepStrictEqual([...BUNDLE_FIELDS], ["plan", "execution"]);
  });

  it("PE-02: happy path — plan → gate → orchestrate → report → complete", () => {
    const composer = makeComposer();
    const result = composer.execute(REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.strictEqual(result.error, null);
    // The bundle echo is present and structured.
    assert.strictEqual(result.request.plan.task, REQ.plan.task);
    assert.strictEqual(result.request.execution.kind, "hotkey");
    // The plan artifact is the planner's own composition (01 §3.1/§5.1).
    assert.strictEqual(result.plan.tier, "T2");
    assert.strictEqual(result.plan.depth, "document");
    assert.strictEqual(result.plan.changes.length, 2);
    assert.deepStrictEqual(result.plan.review, { required: false, trigger: null });
    // Both downstream attempts are attached and COMPLETED.
    assert.strictEqual(result.planning.ok, true);
    assert.strictEqual(result.planning.code, "COMPLETED");
    assert.strictEqual(result.orchestration.ok, true);
    assert.strictEqual(result.orchestration.code, "COMPLETED");
    assert.strictEqual(result.orchestration.execution.executed, true);
    // Three reports: planner attempt, composer attempt, agent attempt.
    for (const report of [result.planning.report, result.report, result.orchestration.report]) {
      assert.notStrictEqual(report, null);
      assert.strictEqual(report.sha256, sha256(report.text));
    }
    const text = result.report.text;
    assert.ok(text.includes("| Status | COMPLETED |"));
    assert.ok(text.includes("| plan-execution | plan-execution.execute | success |"));
    assert.ok(text.includes("PLAN: done (planner → COMPLETED)"));
    assert.ok(text.includes("GATE: done (review not required)"));
    assert.ok(text.includes("ORCHESTRATE: done (agent → COMPLETED)"));
    assert.ok(text.includes("| Task | Add input validation to createUser |"));
    assert.ok(text.includes("| Tier | T2 |"));
    assert.ok(text.includes("| Depth | document |"));
    assert.ok(text.includes("| Execution | hotkey hotkeys:execute |"));
    assert.ok(text.includes("| none | — |"), "remaining issues are empty and declared so");
  });

  it("PE-03: a planner refusal propagates; execution never runs", () => {
    const { composer, calls } = makeSpiedComposer();
    const result = composer.execute(TIER3);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "INVALID_REQUEST");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "PLAN");
    assert.strictEqual(result.error.class, "E-INPUT");
    assert.ok(result.error.detail.includes("tier must be one of"), result.error.detail);
    // The planner's attempt is carried verbatim; no plan, no execution.
    assert.strictEqual(result.planning.code, "INVALID_REQUEST");
    assert.strictEqual(result.plan, null);
    assert.strictEqual(result.orchestration, null);
    assert.strictEqual(calls.plan.length, 1);
    assert.strictEqual(calls.run.length, 0, "no plan → no execution");
    assert.notStrictEqual(result.planning.report, null);
    assert.notStrictEqual(result.report, null);
    assert.ok(result.report.text.includes("| Status | REFUSED |"));
    assert.ok(result.report.text.includes("INVALID_REQUEST: tier must be one of"));
  });

  it("PE-04: an incomplete plan propagates as PLAN_INCOMPLETE", () => {
    const { composer, calls } = makeSpiedComposer();
    const result = composer.execute(NORISKS);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "PLAN_INCOMPLETE");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "PLAN");
    assert.strictEqual(result.error.class, "E-VALID");
    assert.strictEqual(result.planning.code, "PLAN_INCOMPLETE");
    assert.strictEqual(result.plan, null);
    assert.strictEqual(result.orchestration, null);
    assert.strictEqual(calls.run.length, 0, "no plan → no execution");
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
  });

  it("PE-05: the §5.2 approval gate refuses before any execution", () => {
    const { composer, calls } = makeSpiedComposer();
    const result = composer.execute(TRIGGER);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "APPROVAL_REQUIRED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "GATE");
    assert.strictEqual(result.error.class, "E-INPUT");
    assert.ok(result.error.detail.includes("(migration)"), result.error.detail);
    assert.ok(result.error.detail.includes("approval"), result.error.detail);
    // The plan itself is real and attached — only the gate withholds it.
    assert.strictEqual(result.planning.ok, true);
    assert.strictEqual(result.plan.tier, "T2");
    assert.deepStrictEqual(result.plan.review, { required: true, trigger: "migration" });
    assert.strictEqual(result.orchestration, null);
    assert.strictEqual(calls.plan.length, 1);
    assert.strictEqual(calls.run.length, 0, "a gated plan never reaches execution");
    assert.notStrictEqual(result.report, null);
    assert.ok(result.report.text.includes("| Stage | GATE |"));
    assert.ok(result.report.text.includes("APPROVAL_REQUIRED: "));
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("PE-06: an invalid bundle fails closed before any attempt", () => {
    const badBundles = [
      null,
      "bundle",
      [],
      {},
      { plan: REQ.plan },
      { execution: REQ.execution },
      { plan: REQ.plan, execution: REQ.execution, generated_at: "2026-10-05T12:00:00Z" },
      { plan: null, execution: REQ.execution },
      { plan: REQ.plan, execution: null },
    ];
    for (const bundle of badBundles) {
      const { composer, calls } = makeSpiedComposer();
      const result = composer.execute(bundle);
      assert.strictEqual(result.ok, false, JSON.stringify(bundle));
      assert.strictEqual(result.code, "INVALID_REQUEST");
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "VALIDATE");
      assert.strictEqual(result.error.class, "E-INPUT");
      assert.strictEqual(result.planning, null, "no attempt ran");
      assert.strictEqual(result.plan, null);
      assert.strictEqual(result.orchestration, null);
      assert.strictEqual(calls.plan.length, 0, "the bundle refuses before the planner");
      assert.strictEqual(calls.run.length, 0, "the bundle refuses before the agent");
      assert.notStrictEqual(result.report, null, "a refused bundle is still reported");
      assert.strictEqual(result.report.sha256, sha256(result.report.text));
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
      assert.ok(validateBundle(bundle).length > 0, "the validator itself refuses the bundle");
    }
    // …and the valid bundle is accepted by the envelope check alone.
    assert.deepStrictEqual(validateBundle(REQ), []);
    assert.strictEqual(normalizeBundle(null), null);
    assert.notStrictEqual(normalizeBundle(REQ), null);
  });
});

// ---------------------------------------------------------------------------
describe("Composition fail-closed contract (PE-07 … PE-14)", () => {
  it("PE-07: non-conforming downstream attempts fail closed (belts)", () => {
    const realBus = createReportBus();
    const reachedExecution = [];
    const stubAgent = {
      run(request) {
        reachedExecution.push(request);
        return { ok: true, code: "COMPLETED" };
      },
    };
    const goodPlanAttempt = {
      ok: true,
      code: "COMPLETED",
      status: "COMPLETED",
      stage: "COMPLETE",
      error: null,
      request: { task: "stub task", tier: "T2", changes: null, verification: null, risks: null, trigger: null },
      plan: { tier: "T2", depth: "document", review: { required: false, trigger: null } },
      report: { text: "stub report", sha256: "stub" },
    };

    // A planner attempt is trusted only when it is shaped like the contract
    // it claims to follow: coherent ok/code, a plan artifact, the §5.2
    // review-gate state, and a report behind its completion claim.
    const plannerCases = [
      [undefined, "PLAN_INCOMPLETE", "E-VALID", "did not follow the contract"],
      [{ ok: false, code: "COMPLETED" }, "PLAN_INCOMPLETE", "E-VALID", "did not follow the contract"],
      [{ ok: false, code: "NOT_A_CODE" }, "PLAN_INCOMPLETE", "E-VALID", "did not follow the contract"],
      [{ ...goodPlanAttempt, plan: null }, "PLAN_INCOMPLETE", "E-VALID", "without a plan artifact"],
      [{ ...goodPlanAttempt, plan: { tier: "T2", depth: "document" } }, "PLAN_INCOMPLETE", "E-VALID", "review-gate state"],
      [{ ...goodPlanAttempt, report: null }, "REPORT_FAILED", "E-VALID", "without a report"],
    ];
    for (const [attempt, code, klass, detail] of plannerCases) {
      const composer = createPlanExecutionComposer({
        planner: { plan: () => attempt },
        agent: stubAgent,
        reportBus: realBus,
      });
      const result = composer.execute(REQ);
      assert.strictEqual(result.ok, false, code);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.strictEqual(result.stage, "PLAN");
      assert.strictEqual(result.error.class, klass);
      assert.match(result.error.detail, new RegExp(detail));
      assert.strictEqual(result.orchestration, null);
      assert.notStrictEqual(result.report, null);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    }
    assert.strictEqual(reachedExecution.length, 0, "no belt-broken plan ever reaches execution");

    // An orchestration attempt is trusted only with a coherent ok/code, a
    // report behind its completion claim, and the execution it claims to run.
    const agentCases = [
      [undefined, "EXECUTION_REFUSED", "E-ENV", "did not follow the contract"],
      [{ ok: false, code: "COMPLETED" }, "EXECUTION_REFUSED", "E-ENV", "did not follow the contract"],
      [{ ok: true, code: "COMPLETED" }, "REPORT_FAILED", "E-VALID", "without a report"],
      [{ ok: true, code: "COMPLETED", report: { text: "t", sha256: "s" } }, "EXECUTION_REFUSED", "E-ENV", "without an execution"],
      [{ ok: true, code: "COMPLETED", report: { text: "t", sha256: "s" }, execution: { executed: false } }, "EXECUTION_REFUSED", "E-ENV", "without an execution"],
    ];
    for (const [attempt, code, klass, detail] of agentCases) {
      const composer = createPlanExecutionComposer({
        planner: createPlanner({ reportBus: createReportBus() }),
        agent: { run: () => attempt },
        reportBus: realBus,
      });
      const result = composer.execute(REQ);
      assert.strictEqual(result.ok, false, code);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.strictEqual(result.stage, "ORCHESTRATE");
      assert.strictEqual(result.error.class, klass);
      assert.match(result.error.detail, new RegExp(detail));
      assert.notStrictEqual(result.report, null);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    }
  });
  it("PE-08: a malformed execution envelope propagates from the agent", () => {
    for (const execution of [
      without(EX, "capability"),
      { ...EX, capability: "not-a-capability" },
      without(EX, "target"),
    ]) {
      const result = makeComposer().execute({ ...REQ, execution });
      assert.strictEqual(result.ok, false, JSON.stringify(execution));
      assert.strictEqual(result.code, "INVALID_REQUEST");
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "ORCHESTRATE");
      assert.strictEqual(result.error.class, "E-INPUT");
      assert.strictEqual(result.planning.ok, true, "the plan side succeeded first");
      assert.strictEqual(result.plan.tier, "T2");
      assert.strictEqual(result.orchestration.code, "INVALID_REQUEST");
      assert.notStrictEqual(result.report, null);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    }
  });

  it("PE-09: downstream registry gates propagate (unknown, disabled, phase)", () => {
    const cases = [
      [{ ...EX, module: "ghost-module" }, "MODULE_NOT_FOUND", "E-INPUT"],
      [{ ...EX, module: "tool-bus" }, "MODULE_DISABLED", "E-ENV"],
      [{ ...EX, phase: "DEBUG" }, "PHASE_NOT_DECLARED", "E-CONFLICT"],
    ];
    for (const [execution, code, klass] of cases) {
      const result = makeComposer().execute({ ...REQ, execution });
      assert.strictEqual(result.ok, false, code);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "ORCHESTRATE");
      assert.strictEqual(result.error.class, klass);
      assert.strictEqual(result.orchestration.code, code);
      assert.strictEqual(result.orchestration.stage, "RESOLVE");
      assert.notStrictEqual(result.plan, null, "the plan artifact is preserved beside the refusal");
      assert.strictEqual(result.planning.ok, true);
      assert.notStrictEqual(result.report, null);
      assert.ok(result.report.text.includes(`${code}: `));
    }
    // A disabled module cannot become success: the composer result is the
    // refusal, not the plan that preceded it.
    const disabled = makeComposer().execute({ ...REQ, execution: { ...EX, module: "tool-bus" } });
    assert.strictEqual(disabled.ok, false);
    assert.ok(!disabled.report.text.includes("| plan-execution | plan-execution.execute | success |"));
  });

  it("PE-10: capability and tool refusals propagate (unavailable, blocked, missing)", () => {
    // Capability unavailable to the operation.
    const capability = makeComposer().execute({ ...REQ, execution: { ...EX, capability: "ghost:capability" } });
    assert.strictEqual(capability.code, "CAPABILITY_UNAVAILABLE");
    assert.strictEqual(capability.status, "REFUSED");
    assert.strictEqual(capability.stage, "ORCHESTRATE");
    assert.strictEqual(capability.error.class, "E-ENV");

    // Tool states: unavailable, blocked, and a missing dependency all stay
    // TOOL_REQUIRED through the composition — never success.
    for (const code of ["TOOL_UNAVAILABLE", "TOOL_BLOCKED", "DEPENDENCY_MISSING"]) {
      const result = makeComposer({ toolBus: faultBus(code) }).execute(REQ);
      assert.strictEqual(result.ok, false, code);
      assert.strictEqual(result.code, "TOOL_REQUIRED", JSON.stringify(result));
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "ORCHESTRATE");
      assert.strictEqual(result.error.class, "E-TOOL");
      assert.ok(result.error.detail.includes(`files: ${code}`), result.error.detail);
      assert.strictEqual(result.orchestration.stage, "PREFLIGHT");
      assert.strictEqual(result.orchestration.ok, false);
      assert.notStrictEqual(result.report, null);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    }
  });

  it("PE-11: a downstream runtime refusal propagates as EXECUTION_REFUSED", () => {
    const result = makeComposer().execute({ ...REQ, execution: { ...EX, target: { key: "GHOST" } } });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "EXECUTION_REFUSED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "ORCHESTRATE");
    assert.strictEqual(result.error.class, "E-INPUT", "the runtime's class is propagated, not invented");
    assert.ok(result.error.detail.includes("E_INPUT_UNKNOWN_KEY"));
    assert.strictEqual(result.orchestration.stage, "EXECUTE");
    assert.strictEqual(result.orchestration.execution.executed, false);
    assert.notStrictEqual(result.orchestration.report, null);
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
  });

  it("PE-12: a downstream handler failure propagates as EXECUTION_FAILED", () => {
    const throwing = makeRuntime({
      handlers: {
        "grimoire.key.R": defineHandler({
          id: "test.throwing-handler",
          command: "grimoire.key.R",
          requiredTools: [],
          validateArgs: () => ({ ok: true }),
          run: () => {
            throw new Error("handler exploded");
          },
        }),
      },
    });
    const result = makeComposer({ runtime: throwing }).execute(REQ);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "EXECUTION_FAILED");
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual(result.stage, "ORCHESTRATE");
    assert.strictEqual(result.error.class, "E-UNKNOWN", "classified from the runtime's handler failure");
    assert.ok(result.error.detail.includes("E_UNKNOWN_EXCEPTION"), result.error.detail);
    assert.strictEqual(result.orchestration.stage, "EXECUTE");
    assert.strictEqual(result.orchestration.execution.executed, false);
    assert.notStrictEqual(result.report, null);
    assert.ok(result.report.text.includes("ORCHESTRATE: failed (EXECUTION_FAILED)"));
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("PE-13: a composer report failure never claims completion", () => {
    const broken = makeComposer({ composerReportBus: failingReportBus() }).execute(REQ);
    assert.strictEqual(broken.ok, false, "an executed bundle is NOT a completed one without a report");
    assert.strictEqual(broken.code, "REPORT_FAILED");
    assert.strictEqual(broken.status, "REPORT_FAILED");
    assert.strictEqual(broken.stage, "REPORT");
    assert.strictEqual(broken.report, null);
    assert.strictEqual(broken.error.class, "E-ENV", "the report bus's class is propagated");
    assert.ok(broken.error.detail.includes("attempt COMPLETED"), "the underlying attempt is preserved");
    assert.notStrictEqual(broken.plan, null, "the plan is preserved for diagnosis");
    assert.strictEqual(broken.planning.ok, true);
    assert.strictEqual(broken.orchestration.ok, true);
    // Report failure also wins over an earlier refusal (REPORT is terminal).
    const early = makeComposer({ composerReportBus: failingReportBus() }).execute(TIER3);
    assert.strictEqual(early.code, "REPORT_FAILED");
    assert.strictEqual(early.stage, "REPORT");
    assert.strictEqual(early.plan, null);
    assert.strictEqual(early.planning.code, "INVALID_REQUEST");
  });

  it("PE-14: a planner report failure propagates through the plan stage", () => {
    const result = makeComposer({ plannerReportBus: failingReportBus() }).execute(REQ);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "PLAN", "the terminal state occurred at the composer's PLAN stage");
    assert.strictEqual(result.error.class, "E-ENV");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), result.error.detail);
    assert.strictEqual(result.planning.report, null, "the planner emitted no report");
    assert.notStrictEqual(result.plan, null, "the composed plan is preserved — completion is not claimed");
    assert.strictEqual(result.orchestration, null, "no plan report → no execution");
    // The composer's own report still exists and mirrors the refusal.
    assert.notStrictEqual(result.report, null);
    assert.ok(result.report.text.includes("| Status | REPORT_FAILED |"));
    assert.ok(result.report.text.includes("| Stage | PLAN |"));
    assert.ok(result.report.text.includes("REPORT_FAILED: attempt COMPLETED"));
  });
});

// ---------------------------------------------------------------------------
describe("Composition integrations (PE-15 … PE-17)", () => {
  it("PE-15: wiring — one plan call, one run call, exact order, none on refusal", () => {
    const { composer, calls } = makeSpiedComposer();
    const result = composer.execute(REQ);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(calls.plan.length, 1, "exactly one planner attempt");
    assert.strictEqual(calls.run.length, 1, "exactly one orchestration attempt");
    assert.deepStrictEqual(calls.plan[0], REQ.plan, "the planner receives the plan envelope untouched");
    assert.deepStrictEqual(calls.run[0], REQ.execution, "the agent receives the execution envelope untouched");
    // The planner always runs first; downstream never inverts the order.
    const gated = makeSpiedComposer();
    gated.composer.execute(TRIGGER);
    assert.strictEqual(gated.calls.plan.length, 1);
    assert.strictEqual(gated.calls.run.length, 0);
    const invalid = makeSpiedComposer();
    invalid.composer.execute(null);
    assert.strictEqual(invalid.calls.plan.length, 0, "an invalid bundle reaches neither layer");
    assert.strictEqual(invalid.calls.run.length, 0);
  });

  it("PE-16: public surface is exactly execute(); sources honor the boundary", () => {
    const composer = makeComposer();
    assert.deepStrictEqual(Object.keys(composer), ["execute"], "the public surface is exactly execute()");
    assert.ok(Object.isFrozen(composer));
    assert.strictEqual(typeof composer.execute, "function");
    // Source-level: the composition root imports only its own files, touches
    // no executors, file system, handlers, or another module's paths.
    const files = [path.join(COMPOSITION_DIR, "index.mjs")];
    for (const name of readdirSync(path.join(COMPOSITION_DIR, "src")).sort()) {
      if (name.endsWith(".mjs")) files.push(path.join(COMPOSITION_DIR, "src", name));
    }
    assert.ok(files.length >= 4);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = path.relative(ROOT, file);
      for (const [, spec] of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        assert.ok(spec.startsWith("./"), `${rel}: lateral import "${spec}"`);
      }
      assert.ok(!/child_process|\beval\s*\(|new Function|require\s*\(|import\s*\(/.test(text), `${rel}: no executor APIs`);
      assert.ok(!/handlers\.mjs|src\/handlers|node:fs|readFile/.test(text), `${rel}: no handler or file access`);
      assert.ok(!/modules\/(hotkeys|tool-bus|module-registry|report-bus|agent|planner)/.test(text), `${rel}: no module paths`);
      assert.ok(!/executeHotkey|\.check\(/.test(text), `${rel}: no direct runtime or tool-bus calls`);
    }
    // Exactly one composer report build per attempt — success and every
    // refusal — so there is no hidden retry or second report surface.
    const spy = spyReportBus();
    const counted = makeComposer({ composerReportBus: spy.reportBus });
    counted.execute(REQ);
    counted.execute(null);
    counted.execute(TIER3);
    counted.execute(TRIGGER);
    assert.strictEqual(spy.inputs.length, 4);
  });

  it("PE-17: composer → Report Bus — a real completion input, built by the real bus", () => {
    const spy = spyReportBus();
    const composer = makeComposer({ composerReportBus: spy.reportBus });
    const success = composer.execute(REQ);
    assert.strictEqual(success.ok, true);
    assert.strictEqual(spy.inputs.length, 1);
    const captured = spy.inputs[0];
    assert.strictEqual(captured.type, "completion");
    assert.deepStrictEqual(
      captured.sections.map((section) => section.id),
      ["summary", "results", "phase-ledger", "evidence", "remaining-issues"]
    );
    const row = captured.sections.find((s) => s.id === "results").rows[0];
    assert.strictEqual(row.module, "plan-execution");
    assert.strictEqual(row.command, "plan-execution.execute");
    assert.strictEqual(row.status, "success");
    assert.deepStrictEqual(row.assumptions, []);
    assert.deepStrictEqual(row.remaining_issues, []);
    const summary = captured.sections.find((s) => s.id === "summary").rows;
    assert.deepStrictEqual(summary.find((r) => r.name === "Code"), { name: "Code", value: "COMPLETED" });
    assert.deepStrictEqual(summary.find((r) => r.name === "Status"), { name: "Status", value: "COMPLETED" });
    assert.deepStrictEqual(summary.find((r) => r.name === "Stage"), { name: "Stage", value: "COMPLETE" });
    // The input the composer produced is contract-valid on its own.
    const rebuilt = createReportBus().build(captured);
    assert.strictEqual(rebuilt.ok, true, JSON.stringify(rebuilt.violations));
    assert.strictEqual(success.report.sha256, sha256(success.report.text));
    // A refused attempt reports through the same single format.
    composer.execute(TIER3);
    const refusalRow = spy.inputs[1].sections.find((s) => s.id === "results").rows[0];
    assert.strictEqual(refusalRow.status, "failed");
    assert.strictEqual(refusalRow.remaining_issues.length, 1);
    assert.strictEqual(refusalRow.remaining_issues[0].startsWith("INVALID_REQUEST: "), true);
  });
});

// ---------------------------------------------------------------------------
describe("Composition security & determinism (PE-18 … PE-21)", () => {
  it("PE-18: no fabricated completion — only a COMPLETED result reads as success", () => {
    const composer = makeComposer();
    const success = composer.execute(REQ);
    assert.ok(success.report.text.includes("| Status | COMPLETED |"));
    for (const [bundle, code] of [
      [null, "INVALID_REQUEST"],
      [TIER3, "INVALID_REQUEST"],
      [NORISKS, "PLAN_INCOMPLETE"],
      [TRIGGER, "APPROVAL_REQUIRED"],
      [{ ...REQ, execution: { ...EX, module: "ghost-module" } }, "MODULE_NOT_FOUND"],
      [{ ...REQ, execution: { ...EX, target: { key: "GHOST" } } }, "EXECUTION_REFUSED"],
    ]) {
      const refused = composer.execute(bundle);
      assert.strictEqual(refused.ok, false, code);
      assert.strictEqual(refused.code, code);
      assert.notStrictEqual(refused.report, null, "a refusal is still reported");
      assert.ok(!refused.report.text.includes("| Status | COMPLETED |"));
      assert.ok(refused.report.text.includes("| Status | REFUSED |"));
    }
    // A failed report emits NOTHING — the claim cannot outlive the truth.
    const broken = makeComposer({ composerReportBus: failingReportBus() }).execute(REQ);
    assert.strictEqual(broken.report, null);
    assert.strictEqual(broken.ok, false);
    // The composer succeeds only when BOTH downstream attempts do.
    assert.strictEqual(makeComposer({ plannerReportBus: failingReportBus() }).execute(REQ).ok, false);
    assert.strictEqual(makeComposer({ toolBus: faultBus("TOOL_BLOCKED") }).execute(REQ).ok, false);
  });

  it("PE-19: identical bundles against identical state produce identical results", () => {
    const one = makeComposer().execute(REQ);
    const two = makeComposer().execute(REQ);
    assert.deepStrictEqual(one, two, "two runs are identical result-for-result");
    assert.strictEqual(one.report.text, two.report.text, "byte-identical report text");
    assert.strictEqual(one.report.sha256, two.report.sha256, "identical report hash");
    assert.strictEqual(one.report.sha256, sha256(one.report.text));
    // A refusal is just as deterministic as a success.
    const r1 = makeComposer().execute(TRIGGER);
    const r2 = makeComposer().execute(TRIGGER);
    assert.deepStrictEqual(r1, r2);
    assert.strictEqual(r1.report.sha256, r2.report.sha256);
    // No volatile data in any report, and none in any composer source.
    for (const report of [one.report, r1.report]) {
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(report.text), "no timestamps");
      assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(report.text), "no uuids");
      assert.ok(!/\/(home|Users|tmp)\//.test(report.text), "no machine paths");
    }
    const sources = [path.join(COMPOSITION_DIR, "index.mjs")];
    for (const name of readdirSync(path.join(COMPOSITION_DIR, "src")).sort()) {
      sources.push(path.join(COMPOSITION_DIR, "src", name));
    }
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      assert.ok(!/Date\.now|new Date|Math\.random|process\.pid|process\.env|hrtime/.test(text), `${file}: no volatile APIs`);
    }
  });

  it("PE-20: the report always mirrors the result — code, status, stage, issue", () => {
    const composer = makeComposer();
    const attempts = [
      REQ,
      null,
      TIER3,
      TRIGGER,
      { ...REQ, execution: { ...EX, module: "ghost-module" } },
      { ...REQ, execution: { ...EX, target: { key: "GHOST" } } },
    ];
    for (const bundle of attempts) {
      const result = composer.execute(bundle);
      assert.notStrictEqual(result.report, null, JSON.stringify(result.code));
      const text = result.report.text;
      assert.ok(text.includes(`| Code | ${result.code} |`), result.code);
      assert.ok(text.includes(`| Status | ${result.status} |`), result.status);
      assert.ok(text.includes(`| Stage | ${result.stage} |`), result.stage);
      if (result.ok) {
        assert.ok(text.includes("| none | — |"), "success declares an empty issue list");
      } else {
        assert.ok(text.includes(`${result.code}: ${result.error.detail}`), "the refusal reason is in remaining issues");
      }
    }
  });

  it("PE-21: no bypass — every downstream non-success stays non-success", () => {
    const cases = [
      ["PLAN_INCOMPLETE", NORISKS, {}],
      ["APPROVAL_REQUIRED", TRIGGER, {}],
      ["MODULE_DISABLED", { ...REQ, execution: { ...EX, module: "tool-bus" } }, {}],
      ["CAPABILITY_UNAVAILABLE", { ...REQ, execution: { ...EX, capability: "ghost:capability" } }, {}],
      ["TOOL_REQUIRED", REQ, { toolBus: faultBus("TOOL_BLOCKED") }],
      ["TOOL_REQUIRED", REQ, { toolBus: faultBus("TOOL_UNAVAILABLE") }],
      ["TOOL_REQUIRED", REQ, { toolBus: faultBus("DEPENDENCY_MISSING") }],
      ["EXECUTION_REFUSED", { ...REQ, execution: { ...EX, target: { key: "GHOST" } } }, {}],
      ["EXECUTION_FAILED", REQ, {
        runtime: makeRuntime({
          handlers: {
            "grimoire.key.R": defineHandler({
              id: "test.throwing-handler",
              command: "grimoire.key.R",
              requiredTools: [],
              validateArgs: () => ({ ok: true }),
              run: () => {
                throw new Error("handler exploded");
              },
            }),
          },
        }),
      }],
    ];
    for (const [code, bundle, options] of cases) {
      const result = makeComposer(options).execute(bundle);
      assert.strictEqual(result.ok, false, code);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.notStrictEqual(result.status, "COMPLETED", code);
      assert.notStrictEqual(result.report, null, `${code} still reports`);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), code);
      assert.ok(!result.report.text.includes("| plan-execution | plan-execution.execute | success |"), code);
    }
  });
});

// ---------------------------------------------------------------------------
describe("Composition mutations (PE-M1 … PE-M10)", () => {
  const MUTATIONS = Object.freeze([
    // [id, fixture, code, class, stage, detail fragment, planning code|null, orchestration code|null, has plan]
    ["PE-M1", "mut_composition_extra_field.json", "INVALID_REQUEST", "E-INPUT", "VALIDATE", 'unexpected bundle field "generated_at"', null, null, false],
    ["PE-M2", "mut_composition_plan_unknown_tier.json", "INVALID_REQUEST", "E-INPUT", "PLAN", "tier must be one of", "INVALID_REQUEST", null, false],
    ["PE-M3", "mut_composition_plan_missing_risks.json", "PLAN_INCOMPLETE", "E-VALID", "PLAN", "question 4", "PLAN_INCOMPLETE", null, false],
    ["PE-M4", "mut_composition_plan_trigger.json", "APPROVAL_REQUIRED", "E-INPUT", "GATE", "(migration)", "COMPLETED", null, true],
    ["PE-M5", "mut_composition_execution_malformed.json", "INVALID_REQUEST", "E-INPUT", "ORCHESTRATE", "capability must match", "COMPLETED", "INVALID_REQUEST", true],
    ["PE-M6", "mut_composition_unknown_module.json", "MODULE_NOT_FOUND", "E-INPUT", "ORCHESTRATE", "ghost-module", "COMPLETED", "MODULE_NOT_FOUND", true],
    ["PE-M7", "mut_composition_disabled_module.json", "MODULE_DISABLED", "E-ENV", "ORCHESTRATE", "tool-bus", "COMPLETED", "MODULE_DISABLED", true],
    ["PE-M8", "mut_composition_unknown_capability.json", "CAPABILITY_UNAVAILABLE", "E-ENV", "ORCHESTRATE", "ghost:capability", "COMPLETED", "CAPABILITY_UNAVAILABLE", true],
    ["PE-M9", "mut_composition_execution_refusal.json", "EXECUTION_REFUSED", "E-INPUT", "ORCHESTRATE", "E_INPUT_UNKNOWN_KEY", "COMPLETED", "EXECUTION_REFUSED", true],
  ]);

  for (const [id, file, code, klass, stage, detail, planningCode, orchestrationCode, hasPlan] of MUTATIONS) {
    it(`${id}: ${file} fails closed with ${code}`, () => {
      const input = fixture(file); // asserted byte-different from pristine
      const result = makeComposer().execute(input);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.strictEqual(result.status, code === "EXECUTION_FAILED" ? "FAILED" : "REFUSED");
      assert.strictEqual(result.stage, stage);
      assert.strictEqual(result.error.code, code);
      assert.strictEqual(result.error.class, klass);
      assert.ok(COMPOSITION_ERROR_CLASSES.includes(result.error.class), result.error.class);
      assert.ok(CORE_ERROR_CLASSES.includes(result.error.class));
      assert.match(result.error.detail, new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      // Downstream state: exactly what ran, and nothing more.
      if (planningCode === null) {
        assert.strictEqual(result.planning, null, "no planner attempt ran");
      } else {
        assert.strictEqual(result.planning.code, planningCode);
      }
      if (orchestrationCode === null) {
        assert.strictEqual(result.orchestration, null, "no orchestration ran");
      } else {
        assert.strictEqual(result.orchestration.code, orchestrationCode);
      }
      if (hasPlan) {
        assert.notStrictEqual(result.plan, null, "the plan artifact is preserved");
      } else {
        assert.strictEqual(result.plan, null, "a refused mutation never yields a plan artifact");
      }
      // Reports: the composer always reports; a refusal never reads as completion.
      assert.notStrictEqual(result.report, null, "every refusal still produces its report");
      assert.strictEqual(result.report.sha256, sha256(result.report.text));
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), "no mutation may ever read as completion");
      // The bundle envelope is the ONLY rule this layer checks itself:
      // every other mutation passes the bundle and is refused downstream.
      const envelope = validateBundle(input);
      if (file === "mut_composition_extra_field.json") {
        assert.ok(envelope.length > 0, "the bundle validator itself refuses the extra field");
      } else {
        assert.deepStrictEqual(envelope, [], "the bundle envelope is valid — its own layer refuses");
      }
    });
  }

  it("PE-M10: a corrupted report input fails closed with REPORT_FAILED", () => {
    const fixtureText = readFileSync(FIX + "mut_composition_report_input.json", "utf8");
    assert.notStrictEqual(fixtureText, PRISTINE, "byte-different from the pristine bundle");
    // Capture the pristine report input from a successful control run.
    const realBus = createReportBus();
    let captured = null;
    const control = makeComposer({
      composerReportBus: {
        build(input) {
          captured = input;
          return realBus.build(input);
        },
      },
    });
    const controlRun = control.execute(JSON.parse(PRISTINE));
    assert.strictEqual(controlRun.ok, true);
    assert.notStrictEqual(captured, null);
    // The mutation is a real mutation of the pristine report input:
    // byte-different AND content-different.
    assert.notStrictEqual(fixtureText, JSON.stringify(captured, null, 2));
    assert.notDeepStrictEqual(JSON.parse(fixtureText), captured);
    // Feed the corrupted document through the report boundary: the real bus
    // refuses it, and the composer must not claim completion.
    const corrupted = makeComposer({
      composerReportBus: { build: () => realBus.build(JSON.parse(fixtureText)) },
    });
    const result = corrupted.execute(JSON.parse(PRISTINE));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null, "no report artifact is emitted for corrupted input");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), "the underlying attempt is preserved");
    assert.notStrictEqual(result.plan, null, "the composed plan is preserved — completion is not claimed");
    // Both downstream attempts had already succeeded and keep their reports.
    assert.strictEqual(result.planning.ok, true);
    assert.notStrictEqual(result.planning.report, null);
    assert.strictEqual(result.orchestration.ok, true);
    assert.notStrictEqual(result.orchestration.report, null);
  });
});
