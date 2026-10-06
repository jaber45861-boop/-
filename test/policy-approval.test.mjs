// Grimoire v3 — Policy/Approval suite (Group R; Change-Set CS-13).
//
// Group R coverage map (docs/v3/05-acceptance-tests.md, Group R; contract:
// docs/v3/23-policy-approval-contract.md §13):
//   R-01  configuration, optional component belt, surface, vocabularies
//   R-02  approval happy path — plan → approval → orchestrate → report
//   R-03  absent component = today's frozen refusal (byte-identical)
//   R-04  malformed-verdict matrix (D1)
//   R-05  non-affirmative verdict and evaluation order (D2 precedes D3)
//   R-06  binding, canonicalizability, mutation (D3 / D4 / D6)
//   R-07  component throws — deterministic detail, no exception leakage (D5)
//   R-08  fail-closed totality — every non-crossing path refuses
//   R-09  no self-approval — only the injected verdict reaches the decision
//   R-10  provenance model — injection authority, output, validation
//   R-11  canonicalization determinism — golden vectors V1–V3
//   R-12  verdict-schema mechanics — no coercion, own properties only
//   R-13  report semantics — verdict recorded, never a fourth report
//   R-14  end-to-end determinism — same bundle, same verdict, same bytes
//   R-15  invocation counts — exact observable invariants (never ≥)
// plus the formal case matrix POS-1…POS-3 / NEG-01…NEG-20 (five fields per
// row) and the R-M mutation fixtures (each asserted byte-different from the
// pristine bundle before use — fixture names are contract §8.14 detail).
//
// Record on R-07's third scenario: the contract (§3 step 3, "thenable — a
// Promise is not a plain object") and R-12 both classify a returned Promise
// as a MALFORMED verdict (D1). R-07's pass criteria call that same input
// "approval component threw" (D5). Where the authoritative contract and one
// acceptance line conflict, the contract governs (Task 15: "use the exact
// validation order defined by the contract"); the thenable case is asserted
// as D1 below and the conflict is recorded here rather than hidden.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  createPlanExecutionComposer,
  planIdentity,
  executionIdentity,
  APPROVAL_VERDICT_FIELDS,
  LIFECYCLE_STAGES,
  RESULT_CODES,
  validateBundle,
  normalizeBundle,
  BUNDLE_FIELDS,
  COMPOSITION_ERROR_CLASSES,
  CORE_ERROR_CLASSES,
} from "../composition/plan-execution/index.mjs";
import { createPlanner } from "../modules/planner/index.mjs";
import { createAgentOrchestrator } from "../modules/agent/index.mjs";
import { createModuleRegistry } from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import { createRuntime } from "../modules/hotkeys/src/runtime.mjs";
import { createReportBus } from "../modules/report-bus/index.mjs";

const ROOT = process.cwd();
const FIX = path.join(ROOT, "test/_fixtures/");
const COMPOSITION_DIR = path.join(ROOT, "composition/plan-execution");
const PRISTINE = readFileSync(path.join(FIX, "composition_request.json"), "utf8");
const REQ = JSON.parse(PRISTINE);
const EX = REQ.execution;
const TRIGGER = { ...REQ, plan: { ...REQ.plan, trigger: "migration" } };
const TIER3 = { ...REQ, plan: { ...REQ.plan, tier: "T3" } };
const REGISTRY_TEXT = readFileSync(path.join(ROOT, "docs/v3/12-hotkey-registry.md"), "utf8");

const MODULE_IDS = ["hotkeys", "tool-bus", "module-registry", "report-bus", "agent"];
const MANIFESTS = MODULE_IDS.map((id) => ({
  id,
  text: readFileSync(path.join(ROOT, `modules/${id}/manifest.yaml`), "utf8"),
}));

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// The frozen D0 detail — byte-identical to today's composer string (23 §6).
const D0_DETAIL =
  "plan review is required before execution (migration) — the approval gate belongs to the policy/approval contract";

// Fixed digest-shaped constants for schema-valid verdicts (23 §3).
const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_UPPER = "A".repeat(64);
const HEX_ZERO = "0".repeat(64);

// Golden vectors (23 §4.3) — full expected digests.
const V1_PLAN_DIGEST = "e3e8f2a0ed54599f992ae07e24f59a3e98d5edc7495dc48feb515693303b5e68";
const V2_EXEC_DIGEST = "25cf3de14674c0ffcbf047abff8a60a3fe4d425e12822d3f279a6333803088c4";
const V3_PLAN_DIGEST = "16df91fa6f3838c35e50d271c89d6f56fc805305a2418d1d18ce4d67091f650b";
const V1_CANONICAL =
  '{"tier":"T2","depth":"document","task":"demo","changes":[{"file":"a.ts","why":"A"},{"file":"b.ts","why":"B"}],"verification":["npm test"],"risks":["regression"],"review":{"required":true,"trigger":"migration"}}';
const V2_CANONICAL =
  '{"args":[],"capability":"hotkeys:execute","kind":"hotkey","module":"hotkeys","phase":"RUN","target":{"command":"run","key":"G"}}';
const V3_CANONICAL =
  '{"tier":"T2","depth":"document","task":"a\\"b\\\\c\\td","changes":[{"file":"a.ts","why":"A"}],"verification":["v"],"risks":["r"],"review":{"required":false,"trigger":null}}';

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, PRISTINE, `${name} must be byte-different from the pristine bundle`);
  return JSON.parse(text);
}

const without = (object, ...keys) =>
  Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

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

function makeRealAgent() {
  return createAgentOrchestrator({
    registry: makeRegistry(),
    runtime: makeRuntime(),
    toolBus: makeBus(),
    reportBus: createReportBus(),
  });
}

/**
 * One composition with every downstream call recorded (PE-15-style spies
 * plus the approval spy). `approval` is a verify(plan, execution) function;
 * the component key is present on the config iff the caller passed an
 * `approval` property (so `approval: undefined` is exercised explicitly).
 * Counts are per-rig and never reset mid-test — snapshot between calls.
 */
function makeApprovalRig(options = {}) {
  const { planner, agent, composerReportBus } = options;
  const counts = { plan: 0, run: 0, verify: 0, build: 0 };
  const verifyArgs = [];
  const inputs = [];
  const realPlanner = planner ?? createPlanner({ reportBus: createReportBus() });
  const realAgent = agent ?? makeRealAgent();
  const innerBus = composerReportBus ?? createReportBus();
  const config = {
    planner: {
      plan(request) {
        counts.plan += 1;
        return realPlanner.plan(request);
      },
    },
    agent: {
      run(request) {
        counts.run += 1;
        return realAgent.run(request);
      },
    },
    reportBus: {
      build(input) {
        counts.build += 1;
        inputs.push(input);
        return innerBus.build(input);
      },
    },
  };
  if ("approval" in options) config.approval = options.approval;
  if (typeof options.approval === "function") {
    const consult = options.approval;
    config.approval = {
      verify(plan, execution) {
        counts.verify += 1;
        verifyArgs.push([plan, execution]);
        return consult(plan, execution);
      },
    };
  } else if (options.approval && typeof options.approval === "object" && typeof options.approval.verify === "function") {
    // Full component object: preserve any extra properties it carries, so
    // tests can prove extra properties confer no authority (23 §2).
    const component = options.approval;
    config.approval = Object.assign({}, component, {
      verify(plan, execution) {
        counts.verify += 1;
        verifyArgs.push([plan, execution]);
        return component.verify(plan, execution);
      },
    });
  }
  const composer = createPlanExecutionComposer(config);
  return { composer, counts, verifyArgs, inputs };
}

const rowsOf = (input, id) => input.sections.find((section) => section.id === id).rows;

const clone = (bundle) => JSON.parse(JSON.stringify(bundle));

// --- verdict factories (never used by the composer itself) -----------------
const grantNow = (plan, execution) => ({
  granted: true,
  plan: planIdentity(plan),
  execution: executionIdentity(execution),
});
const malformed = () => null;
const nonAffirmative = () => ({ granted: false, plan: HEX_A, execution: HEX_B });
const wrongBinding = () => ({ granted: true, plan: HEX_A, execution: HEX_B });
const throwsBoom = () => {
  throw new Error("boom");
};
const mutatesExecution = (plan, execution) => {
  execution.target = { key: "G" };
  return { granted: true, plan: planIdentity(plan), execution: executionIdentity(execution) };
};

/** Every approval refusal carries exactly these five observable fields. */
function assertGateRefusal(result, detail, rig, { verify, run }) {
  assert.strictEqual(result.ok, false, JSON.stringify({ code: result.code, detail }));
  assert.strictEqual(result.code, "APPROVAL_REQUIRED");
  assert.strictEqual(result.status, "REFUSED");
  assert.strictEqual(result.stage, "GATE");
  assert.strictEqual(result.error.code, "APPROVAL_REQUIRED");
  assert.strictEqual(result.error.class, "E-INPUT");
  assert.ok(CORE_ERROR_CLASSES.includes(result.error.class));
  assert.ok(COMPOSITION_ERROR_CLASSES.includes(result.error.class));
  assert.strictEqual(result.error.detail, detail);
  assert.strictEqual(result.orchestration, null, "no orchestration past a refusal");
  if (rig) {
    assert.strictEqual(rig.counts.verify, verify, `approval.verify count (wanted ${verify})`);
    assert.strictEqual(rig.counts.run, run, `agent.run count (wanted ${run})`);
  }
  assert.notStrictEqual(result.report, null, "a refusal still reports");
  assert.strictEqual(result.report.sha256, sha256(result.report.text));
  assert.ok(result.report.text.includes("| Code | APPROVAL_REQUIRED |"));
  assert.ok(result.report.text.includes("| Status | REFUSED |"));
  assert.ok(result.report.text.includes("| Stage | GATE |"));
  assert.ok(result.report.text.includes(`APPROVAL_REQUIRED: ${detail}`));
  assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"));
}

const compositionSources = () => {
  const files = [path.join(COMPOSITION_DIR, "index.mjs")];
  for (const name of readdirSync(path.join(COMPOSITION_DIR, "src")).sort()) {
    if (name.endsWith(".mjs")) files.push(path.join(COMPOSITION_DIR, "src", name));
  }
  return files.map((file) => ({ rel: path.relative(ROOT, file), text: readFileSync(file, "utf8") }));
};

// ---------------------------------------------------------------------------
describe("Policy/Approval contract (R-01 … R-08)", () => {
  it("R-01: configuration, optional component belt, surface, vocabularies", async () => {
    const base = {
      planner: { plan: () => {} },
      agent: { run: () => {} },
      reportBus: { build: () => {} },
    };
    // Absent key and explicit `undefined` both construct (not injected).
    assert.strictEqual(typeof createPlanExecutionComposer(base).execute, "function");
    assert.strictEqual(typeof createPlanExecutionComposer({ ...base, approval: undefined }).execute, "function");
    // A conforming stub constructs.
    assert.strictEqual(
      typeof createPlanExecutionComposer({ ...base, approval: { verify: () => null } }).execute,
      "function"
    );
    // Every provided-but-non-conforming value throws the fixed config error.
    for (const bad of [null, {}, { verify: "no" }, { noVerify: true }, "verify", 42, () => {}]) {
      assert.throws(
        () => createPlanExecutionComposer({ ...base, approval: bad }),
        (error) => {
          assert.strictEqual(error.code, "E_INPUT_INVALID_COMPOSITION_CONFIG");
          assert.strictEqual(error.message, "approval must expose verify()");
          assert.strictEqual(error.grimoire.detail, "approval must expose verify()");
          assert.strictEqual(error.grimoire.code, "E_INPUT_INVALID_COMPOSITION_CONFIG");
          assert.strictEqual(error.grimoire.class, "E-INPUT");
          return true;
        },
        JSON.stringify(bad)
      );
    }
    // Absent vs explicit-undefined behave byte-identically on a gated bundle.
    const absent = makeApprovalRig();
    const explicit = makeApprovalRig({ approval: undefined });
    const rAbsent = absent.composer.execute(TRIGGER);
    const rExplicit = explicit.composer.execute(TRIGGER);
    assert.strictEqual(rAbsent.error.detail, D0_DETAIL);
    assert.deepStrictEqual(rExplicit, rAbsent, "undefined key ≡ absent key");
    assert.strictEqual(rExplicit.report.text, rAbsent.report.text, "byte-identical report");
    assert.strictEqual(absent.counts.verify, 0);
    assert.strictEqual(explicit.counts.verify, 0);

    // Surface: the entire new vocabulary is exported from the entry.
    const entry = await import("../composition/plan-execution/index.mjs");
    for (const name of [
      "createPlanExecutionComposer", "LIFECYCLE_STAGES", "RESULT_CODES",
      "validateBundle", "normalizeBundle", "BUNDLE_FIELDS",
      "COMPOSITION_ERROR_CLASSES", "CORE_ERROR_CLASSES", "makeError", "isCoreErrorClass",
      "planIdentity", "executionIdentity", "APPROVAL_VERDICT_FIELDS",
    ]) {
      assert.ok(name in entry, `entry must export ${name}`);
    }
    assert.deepStrictEqual([...APPROVAL_VERDICT_FIELDS], ["granted", "plan", "execution"]);
    assert.ok(Object.isFrozen(APPROVAL_VERDICT_FIELDS));
    assert.deepStrictEqual([...BUNDLE_FIELDS], ["plan", "execution"]);
    assert.strictEqual(Object.keys(RESULT_CODES).length, 14, "no new result code");
    assert.strictEqual(RESULT_CODES.APPROVAL_REQUIRED, "E-INPUT");
    assert.strictEqual(Object.keys(RESULT_CODES).filter((c) => c === "APPROVAL_REQUIRED").length, 1);
    assert.deepStrictEqual([...LIFECYCLE_STAGES], [
      "RECEIVE", "VALIDATE", "PLAN", "GATE", "ORCHESTRATE", "REPORT", "COMPLETE",
    ]);
    // Layout unchanged: no manifest, nothing new registers (PE-01 convention).
    const layout = readdirSync(COMPOSITION_DIR).sort();
    assert.deepStrictEqual(layout, ["index.mjs", "src"], "no manifest, no new registry entry");
    assert.ok(!layout.includes("manifest.yaml"));
    assert.ok(existsSync(path.join(COMPOSITION_DIR, "src", "approval.mjs")));
    // The bundle envelope still refuses an approval member outright.
    assert.ok(validateBundle(fixture("mut_approval_bundle_extra_field.json")).length > 0);
    assert.deepStrictEqual(validateBundle(REQ), []);
    assert.notStrictEqual(normalizeBundle(REQ), null);
  });

  it("R-02: approval happy path — plan → approval → orchestrate → report", () => {
    const rig = makeApprovalRig({ approval: grantNow });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.strictEqual(result.error, null);
    // Exact counts: planner 1 / approval.verify 1 / agent 1.
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 1, build: 1 });
    // verify() receives the plan artifact and execution sub-request by reference.
    assert.strictEqual(rig.verifyArgs.length, 1);
    assert.strictEqual(rig.verifyArgs[0][0], result.plan, "the exact gated plan artifact");
    assert.strictEqual(rig.verifyArgs[0][1], TRIGGER.execution, "the exact bundle execution member");
    // Ledger: the approval pass line, byte-exact.
    assert.deepStrictEqual(rowsOf(rig.inputs[0], "phase-ledger"), [
      "RECEIVE: done (bundle)",
      "VALIDATE: done (contract)",
      "PLAN: done (planner → COMPLETED)",
      "GATE: done (approval verified)",
      "ORCHESTRATE: done (agent → COMPLETED)",
      "REPORT: done (report-bus)",
      "COMPLETE: done",
    ]);
    // Evidence: the two approval lines, in order, right after the gate line.
    assert.deepStrictEqual(rowsOf(rig.inputs[0], "evidence"), [
      "validate(bundle) → ok (contract)",
      "planner.plan(...) → COMPLETED",
      "plan.review.required → true (migration)",
      "approval.verify(...) → affirmative",
      "approval.binding → verified",
      "agent.run(...) → COMPLETED",
    ]);
    // Three hash-valid reports; the composer report shows completion.
    for (const report of [result.planning.report, result.report, result.orchestration.report]) {
      assert.notStrictEqual(report, null);
      assert.strictEqual(report.sha256, sha256(report.text));
    }
    assert.ok(result.report.text.includes("| Status | COMPLETED |"));
    assert.ok(result.report.text.includes("GATE: done (approval verified)"));
  });

  it("R-03: absent component = today's frozen refusal (PE-05/M4 preserved)", () => {
    const rig = makeApprovalRig();
    const result = rig.composer.execute(TRIGGER);
    assertGateRefusal(result, D0_DETAIL, rig, { verify: 0, run: 0 });
    assert.strictEqual(rig.counts.plan, 1);
    assert.strictEqual(rig.counts.build, 1, "exactly one composer report build");
    // Evidence and ledger byte-identical to today: no approval line at all.
    assert.deepStrictEqual(rowsOf(rig.inputs[0], "evidence"), [
      "validate(bundle) → ok (contract)",
      "planner.plan(...) → COMPLETED",
      "plan.review.required → true (migration)",
    ]);
    assert.deepStrictEqual(rowsOf(rig.inputs[0], "phase-ledger"), [
      "RECEIVE: done (bundle)",
      "VALIDATE: done (contract)",
      "PLAN: done (planner → COMPLETED)",
      "GATE: refused (APPROVAL_REQUIRED)",
      "REPORT: done (report-bus)",
    ]);
    assert.ok(!result.report.text.includes("approval.verify"));
    assert.ok(!result.report.text.includes("approval.binding"));
    // Ungated passes with today's line, component or not.
    const ungated = makeApprovalRig();
    const ok = ungated.composer.execute(REQ);
    assert.strictEqual(ok.ok, true);
    assert.ok(ok.report.text.includes("GATE: done (review not required)"));
    assert.strictEqual(ungated.counts.verify, 0);
    assert.strictEqual(ungated.counts.run, 1);
  });

  it("R-04: malformed-verdict matrix — every shape is exactly D1", () => {
    const cases = [
      ["null", null],
      ["undefined", undefined],
      ["array", []],
      ["string", "granted"],
      ["number", 7],
      ["missing plan/execution", { granted: true }],
      ["missing execution", { granted: true, plan: HEX_A }],
      ["granted string", { granted: "true", plan: HEX_A, execution: HEX_B }],
      ["granted number", { granted: 1, plan: HEX_A, execution: HEX_B }],
      ["plan 63 chars", { granted: true, plan: "a".repeat(63), execution: HEX_B }],
      ["plan 65 chars", { granted: true, plan: "a".repeat(65), execution: HEX_B }],
      ["plan uppercase hex", { granted: true, plan: HEX_UPPER, execution: HEX_B }],
      ["plan non-hex", { granted: true, plan: "z".repeat(64), execution: HEX_B }],
      ["plan non-string", { granted: true, plan: 42, execution: HEX_B }],
      ["execution non-string", { granted: true, plan: HEX_A, execution: 99 }],
      ["fourth own property", { granted: true, plan: HEX_A, execution: HEX_B, origin: "user" }],
      ["non-plain prototype", Object.assign(Object.create({ inherited: true }), { granted: true, plan: HEX_A, execution: HEX_B })],
      ["getter throws", { get granted() { throw new Error("getter boom"); }, plan: HEX_A, execution: HEX_B }],
    ];
    for (const [label, verdict] of cases) {
      const rig = makeApprovalRig({ approval: () => verdict });
      const result = rig.composer.execute(TRIGGER);
      assertGateRefusal(result, "approval verdict malformed", rig, { verify: 1, run: 0 });
      assert.strictEqual(rig.counts.plan, 1, label);
      assert.ok(result.report.text.includes(`| Status | REFUSED |`), label);
    }
  });

  it("R-05: non-affirmative verdict and evaluation order (D2 precedes D3)", () => {
    // Well-formed but non-affirmative — even with deliberately wrong bindings.
    // Wrong bindings must still be schema-valid digests: an empty/short/upper
    // digest fails D1 (schema) before D2 is ever reached — that is R-04/R-12
    // territory. D2's order claim is about WELL-FORMED, non-affirmative verdicts.
    const cases = [
      ["schema-valid bindings", () => ({ granted: false, plan: HEX_A, execution: HEX_B })],
      ["wrong digests (zeros)", () => ({ granted: false, plan: HEX_ZERO, execution: HEX_ZERO })],
      ["wrong digests (ones)", () => ({ granted: false, plan: "1".repeat(64), execution: "2".repeat(64) })],
    ];
    for (const [label, verdict] of cases) {
      const rig = makeApprovalRig({ approval: verdict });
      const result = rig.composer.execute(TRIGGER);
      // D2 wins over D3: a non-affirmative verdict never reports a binding detail.
      assertGateRefusal(result, "approval verdict not affirmative", rig, { verify: 1, run: 0 });
      assert.ok(!result.report.text.includes("binding"), label);
    }
  });

  it("R-06: binding, canonicalizability, mutation (D3 / D4 / D6)", () => {
    const otherPlan = { review: { required: true, trigger: "migration" }, risks: ["r"], verification: ["v"], changes: [{ file: "x.ts", why: "X" }], task: "other", depth: "document", tier: "T2" };
    // (a) verdict bound to ANOTHER plan's identity.
    const a = makeApprovalRig({
      approval: (plan, execution) => ({ granted: true, plan: planIdentity(otherPlan), execution: executionIdentity(execution) }),
    });
    assertGateRefusal(a.composer.execute(TRIGGER), "approval verdict binding mismatch", a, { verify: 1, run: 0 });
    // (b) verdict bound to another EXECUTION's identity.
    const b = makeApprovalRig({
      approval: (plan, execution) => ({ granted: true, plan: planIdentity(plan), execution: executionIdentity({ ...execution, target: { key: "G" } }) }),
    });
    assertGateRefusal(b.composer.execute(TRIGGER), "approval verdict binding mismatch", b, { verify: 1, run: 0 });
    // (c) plan content altered by one byte after approval was issued.
    const tampered = clone(TRIGGER);
    tampered.plan.task = `${tampered.plan.task} `; // one byte added
    const c = makeApprovalRig({
      approval: (plan, execution) => ({
        granted: true,
        plan: planIdentity({ ...plan, task: plan.task.slice(0, -1) }), // identity of the approved bytes
        execution: executionIdentity(execution),
      }),
    });
    assertGateRefusal(c.composer.execute(tampered), "approval verdict binding mismatch", c, { verify: 1, run: 0 });
    // (d) execution sub-request swapped for a different valid envelope.
    const d = makeApprovalRig({
      approval: (plan, execution) => ({ granted: true, plan: planIdentity(plan), execution: executionIdentity(EX) }),
    });
    const swapped = clone(TRIGGER);
    swapped.execution = { ...EX, target: { key: "G" } };
    assertGateRefusal(d.composer.execute(swapped), "approval verdict binding mismatch", d, { verify: 1, run: 0 });
    // (e) execution containing NaN / undefined / a cyclic reference ⇒ D4.
    for (const [label, poison] of [
      ["NaN", { weird: NaN }],
      ["undefined", { weird: undefined }],
      ["function", { weird: () => 1 }],
    ]) {
      const bad = clone(TRIGGER);
      bad.execution = { ...EX, ...poison };
      const e = makeApprovalRig({ approval: wrongBinding });
      assertGateRefusal(e.composer.execute(bad), "approval binding input not canonicalizable", e, { verify: 1, run: 0 });
      assert.ok(label.length > 0);
    }
    const cyclic = clone(TRIGGER);
    cyclic.execution.self = cyclic.execution;
    const e2 = makeApprovalRig({ approval: wrongBinding });
    assertGateRefusal(e2.composer.execute(cyclic), "approval binding input not canonicalizable", e2, { verify: 1, run: 0 });
    // (f) a stub that MUTATES execution during verify ⇒ D6 (recompute vs pre-call).
    const f = makeApprovalRig({ approval: mutatesExecution });
    const result = f.composer.execute(clone(TRIGGER));
    assertGateRefusal(result, "approval component mutated its inputs", f, { verify: 1, run: 0 });
    // The mutation never leaks into the attached bundle echo.
    assert.deepStrictEqual(result.request.execution, EX, "the composer never adopts component mutations");
  });

  it("R-07: component throws — deterministic detail, no exception leakage", () => {
    // A thrown Error whose content varies per call.
    const throwing = makeApprovalRig({
      approval: () => {
        throw new Error(`boom-${Date.now()}`);
      },
    });
    const r1 = throwing.composer.execute(TRIGGER);
    assert.strictEqual(r1.error.detail, "approval component threw");
    // A thrown non-Error value.
    const throwingString = makeApprovalRig({
      approval: () => {
        throw "boom-string-value";
      },
    });
    const r2 = throwingString.composer.execute(TRIGGER);
    assert.strictEqual(r2.error.detail, "approval component threw");
    for (const [rig, result] of [[throwing, r1], [throwingString, r2]]) {
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, "APPROVAL_REQUIRED");
      assert.strictEqual(result.stage, "GATE");
      assert.strictEqual(rig.counts.verify, 1, "exactly one consultation even on a throw");
      assert.strictEqual(rig.counts.run, 0);
      assert.notStrictEqual(result.report, null);
      assert.strictEqual(result.report.sha256, sha256(result.report.text));
      // No exception message, stack, or timing appears anywhere in the output.
      assert.ok(!result.report.text.includes("boom"), "no thrown content in the report");
      assert.ok(!result.error.detail.includes("boom"));
      assert.ok(!JSON.stringify(result.error).includes("Error"));
    }
    // Third scenario (thenable return): the contract §3 step 3 classifies a
    // Promise as NOT a plain object ⇒ malformed (D1). R-12 pins the same;
    // R-07's written "approval component threw" expectation for this input
    // conflicts with the authoritative contract — the contract governs (see
    // the file header record).
    const thenable = makeApprovalRig({ approval: () => Promise.resolve({ granted: true, plan: HEX_A, execution: HEX_B }) });
    const r3 = thenable.composer.execute(TRIGGER);
    assertGateRefusal(r3, "approval verdict malformed", thenable, { verify: 1, run: 0 });
  });

  it("R-08: fail-closed totality — every non-crossing path refuses", () => {
    const outcomes = [
      ["D0", undefined, undefined, D0_DETAIL],
      ["D1", malformed, undefined, "approval verdict malformed"],
      ["D2", nonAffirmative, undefined, "approval verdict not affirmative"],
      ["D3", wrongBinding, undefined, "approval verdict binding mismatch"],
      ["D5", throwsBoom, undefined, "approval component threw"],
      ["D6", mutatesExecution, () => clone(TRIGGER), "approval component mutated its inputs"],
    ];
    for (const [id, approval, bundleOf, detail] of outcomes) {
      const rig = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const result = rig.composer.execute(bundleOf ? bundleOf() : TRIGGER);
      assert.strictEqual(result.ok, false, id);
      assert.strictEqual(result.code, "APPROVAL_REQUIRED", id);
      assert.notStrictEqual(result.status, "COMPLETED", id);
      assert.strictEqual(result.stage, "GATE", id);
      assert.strictEqual(result.error.detail, detail, id);
      assert.notStrictEqual(result.report, null, `${id} still reports`);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), id);
      assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"), id);
      assert.strictEqual(rig.counts.run, 0, `${id}: agent zero-call on refusal`);
      assert.strictEqual(rig.counts.build, 1, `${id}: exactly one composer build`);
    }
    // D4 (a bundle-side input that cannot be canonicalized).
    const d4Bundle = clone(TRIGGER);
    d4Bundle.execution = { ...EX, weird: NaN };
    const d4 = makeApprovalRig({ approval: wrongBinding });
    assertGateRefusal(d4.composer.execute(d4Bundle), "approval binding input not canonicalizable", d4, { verify: 1, run: 0 });
    // Cases with review.required === false are unaffected by the approval layer.
    for (const approval of [undefined, grantNow, malformed, throwsBoom]) {
      const rig = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const result = rig.composer.execute(REQ);
      assert.strictEqual(result.ok, true, "ungated bundles pass regardless of the component");
      assert.strictEqual(rig.counts.verify, 0, "component never consulted when ungated");
      assert.strictEqual(rig.counts.run, 1);
    }
  });
});

// ---------------------------------------------------------------------------
describe("Policy/Approval provenance & determinism (R-09 … R-15)", () => {
  it("R-09: no self-approval — only the injected verdict reaches the decision", async () => {
    const sources = compositionSources();
    for (const { rel, text } of sources) {
      // PE-16 boundary scans remain green for every source, new file included.
      for (const [, spec] of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        assert.ok(spec.startsWith("./"), `${rel}: lateral import "${spec}"`);
      }
      assert.ok(!/child_process|\beval\s*\(|new Function|require\s*\(|import\s*\(/.test(text), `${rel}: no executor APIs`);
      assert.ok(!/handlers\.mjs|src\/handlers|node:fs|readFile/.test(text), `${rel}: no handler or file access`);
      assert.ok(!/modules\/(hotkeys|tool-bus|module-registry|report-bus|agent|planner)/.test(text), `${rel}: no module paths`);
      assert.ok(!/executeHotkey|\.check\(/.test(text), `${rel}: no direct runtime or tool-bus calls`);
    }
    const composerText = readFileSync(path.join(COMPOSITION_DIR, "src", "composer.mjs"), "utf8");
    // The composer constructs no verdict and holds no literal grant path.
    assert.ok(!/granted\s*:/.test(composerText), "composer contains no literal grant field");
    assert.ok(!/\{\s*granted/.test(composerText), "composer constructs no verdict object");
    for (const { rel, text } of sources) {
      assert.ok(!/granted\s*:\s*true/.test(text), `${rel}: no hardcoded affirmative literal`);
    }
    // Planner and agent sources mint no approval vocabulary at all.
    for (const dir of ["modules/planner", "modules/agent"]) {
      const files = readdirSync(path.join(ROOT, dir), { recursive: true })
        .filter((name) => String(name).endsWith(".mjs"));
      assert.ok(files.length > 0, `${dir} has sources to scan`);
      for (const name of files) {
        const text = readFileSync(path.join(ROOT, dir, String(name)), "utf8");
        assert.ok(!/granted/i.test(text), `${dir}/${name}: planner/agent mint no verdicts`);
        assert.ok(!/planIdentity|executionIdentity|APPROVAL_VERDICT/.test(text), `${dir}/${name}: no identity vocabulary`);
      }
    }
    // Behavioral: a plan artifact claiming approval changes nothing.
    const forgedArtifact = () => ({
      tier: "T2",
      depth: "document",
      task: "Add input validation to createUser",
      changes: REQ.plan.changes.map((change) => ({ ...change })),
      verification: [...REQ.plan.verification],
      risks: [...REQ.plan.risks],
      review: { required: true, trigger: "migration" },
      approval: { granted: true, plan: HEX_A, execution: HEX_B },
    });
    const stubPlanner = (artifact) => ({
      plan(request) {
        return {
          ok: true,
          code: "COMPLETED",
          status: "COMPLETED",
          stage: "COMPLETE",
          error: null,
          request: { task: request.task, tier: request.tier },
          plan: artifact(),
          report: { text: "stub report", sha256: "stub" },
        };
      },
    });
    const withComponent = makeApprovalRig({
      planner: stubPlanner(forgedArtifact),
      approval: wrongBinding,
    });
    // Unknown plan field ⇒ the artifact is not canonicalizable (D4), never an approval.
    assertGateRefusal(withComponent.composer.execute(TRIGGER), "approval binding input not canonicalizable", withComponent, { verify: 1, run: 0 });
    const noComponent = makeApprovalRig({ planner: stubPlanner(forgedArtifact) });
    assertGateRefusal(noComponent.composer.execute(TRIGGER), D0_DETAIL, noComponent, { verify: 0, run: 0 });
    // An orchestration result claiming approval can never reach GATE (agent not invoked).
    const claimingAgent = {
      run() {
        return { ok: true, code: "COMPLETED", approval: { granted: true } };
      },
    };
    const agentRig = makeApprovalRig({ agent: claimingAgent });
    assertGateRefusal(agentRig.composer.execute(TRIGGER), D0_DETAIL, agentRig, { verify: 0, run: 0 });
    assert.strictEqual(agentRig.counts.run, 0, "the agent's output never reaches the GATE");
  });

  it("R-10: provenance — injection authority, output, validation (no crypto claim)", () => {
    // (a) two DIFFERENT components, structurally identical verdicts ⇒
    // indistinguishable results: no origin metadata is consulted.
    const componentOne = (plan, execution) => ({ granted: true, plan: planIdentity(plan), execution: executionIdentity(execution) });
    const componentTwo = (plan, execution) => {
      const planDigest = planIdentity(plan);
      const executionDigest = executionIdentity(execution);
      return { granted: true, plan: planDigest, execution: executionDigest };
    };
    const one = makeApprovalRig({ approval: componentOne });
    const two = makeApprovalRig({ approval: componentTwo });
    const r1 = one.composer.execute(TRIGGER);
    const r2 = two.composer.execute(TRIGGER);
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r2.ok, true);
    assert.deepStrictEqual(r1, r2, "structurally identical verdicts are behaviorally indistinguishable");
    assert.strictEqual(r1.report.text, r2.report.text, "byte-identical report");
    assert.strictEqual(r1.report.sha256, r2.report.sha256, "equal sha256");
    // (b) no cryptographic provenance machinery anywhere on the approval path.
    const all = compositionSources().map((source) => source.text).join("\n");
    for (const banned of [
      /createSign/i, /createVerify/i, /createHmac/i, /node:crypto/, /createHash/,
      /\bcredential/i, /\bbearer\b/i, /\btoken\b/i, /\bnonce\b/i, /\bsign\s*\(/i,
      /forged/i, /forgery/i, /\borigin\b/i,
    ]) {
      assert.ok(!banned.test(all), `no provenance machinery (${banned}) on the approval path`);
    }
    // The only digest use is the dependency-free identity implementation —
    // no builtin hashing is imported into the composition layer.
    const approvalText = readFileSync(path.join(COMPOSITION_DIR, "src", "approval.mjs"), "utf8");
    assert.ok(!/node:crypto|createHash/.test(approvalText), "identity hashing is dependency-free (FIPS 180-4 in-layer)");
    // (c) exactly ONE boundary check exists: the construction belt (interface
    // conformance); everything else is contractual schema + binding
    // validation. The runtime makes no forged-object detection claim.
    assert.ok(!/forged|forgery/i.test(all), "the runtime claims no forged-object detection");
    const composerSource = readFileSync(path.join(COMPOSITION_DIR, "src", "composer.mjs"), "utf8");
    const beltCount = (composerSource.match(/approval must expose verify\(\)/g) ?? []).length;
    assert.strictEqual(beltCount, 2, "the fixed config detail appears exactly at the belt (message + detail)");
    // Construction belt (interface) vs run-time belt (schema): both refuse.
    assert.throws(
      () => createPlanExecutionComposer({ planner: { plan: () => {} }, agent: { run: () => {} }, reportBus: { build: () => {} }, approval: {} }),
      (error) => error.code === "E_INPUT_INVALID_COMPOSITION_CONFIG"
    );
    const runtimeBelt = makeApprovalRig({ approval: malformed });
    assertGateRefusal(runtimeBelt.composer.execute(TRIGGER), "approval verdict malformed", runtimeBelt, { verify: 1, run: 0 });
    // (d) GATE reads exactly the three own verdict properties — and writes none.
    const reads = [];
    const writes = [];
    const spyRig = makeApprovalRig({
      approval: (plan, execution) =>
        new Proxy(
          { granted: true, plan: planIdentity(plan), execution: executionIdentity(execution) },
          {
            get(target, key, receiver) {
              if (typeof key === "string") reads.push(key);
              return Reflect.get(target, key, receiver);
            },
            set(_target, key) { writes.push(String(key)); return true; },
            deleteProperty(_target, key) { writes.push(String(key)); return true; },
            defineProperty(_target, key) { writes.push(String(key)); return true; },
          }
        ),
    });
    const crossed = spyRig.composer.execute(TRIGGER);
    assert.strictEqual(crossed.ok, true, "a proxied, correct verdict crosses");
    assert.strictEqual(reads.length, 3, `GATE reads exactly three verdict properties (saw ${JSON.stringify(reads)})`);
    assert.deepStrictEqual([...reads].sort(), ["execution", "granted", "plan"]);
    assert.deepStrictEqual(writes, [], "the GATE never writes the verdict");
  });

  it("R-11: canonicalization determinism — golden vectors V1–V3", () => {
    // V1 — plan identity, input built with deliberately jumbled key order.
    const v1 = {
      review: { trigger: "migration", required: true },
      risks: ["regression"],
      verification: ["npm test"],
      changes: [{ why: "A", file: "a.ts" }, { why: "B", file: "b.ts" }],
      task: "demo",
      depth: "document",
      tier: "T2",
    };
    assert.strictEqual(planIdentity(v1), V1_PLAN_DIGEST, "V1 digest");
    assert.strictEqual(sha256(V1_CANONICAL), V1_PLAN_DIGEST, "V1 canonical bytes → digest");
    // V2 — execution identity, keys out of order at both levels.
    const v2 = { target: { key: "G", command: "run" }, phase: "RUN", module: "hotkeys", kind: "hotkey", capability: "hotkeys:execute", args: [] };
    assert.strictEqual(executionIdentity(v2), V2_EXEC_DIGEST, "V2 digest");
    assert.strictEqual(sha256(V2_CANONICAL), V2_EXEC_DIGEST, "V2 canonical bytes → digest");
    // V3 — string escaping of a"b\\c<TAB>d (ungated plan).
    const v3 = {
      review: { trigger: null, required: false },
      risks: ["r"],
      verification: ["v"],
      changes: [{ file: "a.ts", why: "A" }],
      task: "a\"b\\c\td",
      depth: "document",
      tier: "T2",
    };
    assert.strictEqual(planIdentity(v3), V3_PLAN_DIGEST, "V3 digest");
    assert.strictEqual(sha256(V3_CANONICAL), V3_PLAN_DIGEST, "V3 canonical bytes → digest");
    // Identity is independent of key-insertion order …
    const reordered = {
      tier: "T2", depth: "document", task: "demo",
      changes: [{ file: "a.ts", why: "A" }, { file: "b.ts", why: "B" }],
      verification: ["npm test"], risks: ["regression"],
      review: { required: true, trigger: "migration" },
    };
    assert.strictEqual(planIdentity(reordered), planIdentity(v1));
    assert.strictEqual(executionIdentity({ args: [], capability: "hotkeys:execute", kind: "hotkey", module: "hotkeys", phase: "RUN", target: { command: "run", key: "G" } }), V2_EXEC_DIGEST);
    // … and arrays are NEVER re-sorted (stored order is the contract's meaning).
    const swappedChanges = { ...reordered, changes: [...reordered.changes].reverse() };
    assert.notStrictEqual(planIdentity(swappedChanges), planIdentity(v1), "change order is preserved");
    const swappedVerification = { ...reordered, verification: ["b", "a"] };
    const swappedVerification2 = { ...reordered, verification: ["a", "b"] };
    assert.notStrictEqual(planIdentity(swappedVerification), planIdentity(swappedVerification2));
    // Non-canonicalizable inputs fail closed to null (the GATE's D4).
    assert.strictEqual(planIdentity(null), null);
    assert.strictEqual(planIdentity({ ...reordered, approval: {} }), null, "unknown plan field");
    assert.strictEqual(planIdentity(without(reordered, "risks")), null, "missing field");
    assert.strictEqual(planIdentity({ ...reordered, tier: 2 }), null, "rule N: no numbers");
    assert.strictEqual(planIdentity({ ...reordered, task: undefined }), null, "undefined value");
    assert.strictEqual(executionIdentity({ a: NaN }), null);
    assert.strictEqual(executionIdentity({ a: Infinity }), null);
    assert.strictEqual(executionIdentity({ a: undefined }), null);
    assert.strictEqual(executionIdentity("string root"), null, "non-object root");
    const cycle = { a: 1 };
    cycle.self = cycle;
    assert.strictEqual(executionIdentity(cycle), null, "cyclic reference");
    // Digests are always lowercase hex, exactly 64.
    for (const digest of [planIdentity(v1), executionIdentity(v2), planIdentity(v3)]) {
      assert.match(digest, /^[0-9a-f]{64}$/);
    }
    // The identity/canonical sources carry no volatile input (PE-19-style).
    for (const { rel, text } of compositionSources()) {
      assert.ok(!/Date\.now|new Date|Math\.random|process\.pid|process\.env|hrtime/.test(text), `${rel}: no volatile APIs`);
      assert.ok(!/node:crypto|createHash|require\s*\(|import\s*\(/.test(text), `${rel}: dependency-free hashing`);
    }
  });

  it("R-12: verdict-schema mechanics — no coercion, own properties only", () => {
    const cases = [
      ["uppercase hex", { granted: true, plan: HEX_UPPER, execution: HEX_B }],
      ["granted string", { granted: "true", plan: HEX_A, execution: HEX_B }],
      ["padded string", { granted: " true", plan: HEX_A, execution: HEX_B }],
      ["inherited granted", Object.assign(Object.create({ granted: true }), { plan: HEX_A, execution: HEX_B })],
      ["Promise verdict", Promise.resolve({ granted: true, plan: HEX_A, execution: HEX_B })],
      ["extra property", { granted: true, plan: HEX_A, execution: HEX_B, comment: "looks official" }],
      ["missing exactly one", { granted: true, plan: HEX_A }],
      ["non-hex digest", { granted: true, plan: "g".repeat(64), execution: HEX_B }],
      ["short digest", { granted: true, plan: "", execution: HEX_B }],
    ];
    for (const [label, verdict] of cases) {
      const rig = makeApprovalRig({ approval: () => verdict });
      const result = rig.composer.execute(TRIGGER);
      // No lowercasing, no trimming, no type coercion, no inherited reads:
      // exactly three own fields holds in both directions.
      assertGateRefusal(result, "approval verdict malformed", rig, { verify: 1, run: 0 });
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), label);
      assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"), label);
    }
  });

  it("R-13: report semantics — verdict recorded, never a fourth report", () => {
    const outcomes = [
      ["pass", grantNow, undefined, "GATE: done (approval verified)", ["approval.verify(...) → affirmative", "approval.binding → verified"]],
      ["D0", undefined, D0_DETAIL, "GATE: refused (APPROVAL_REQUIRED)", []],
      ["D1", malformed, "approval verdict malformed", "GATE: refused (APPROVAL_REQUIRED)", ["approval.verify(...) → malformed"]],
      ["D2", nonAffirmative, "approval verdict not affirmative", "GATE: refused (APPROVAL_REQUIRED)", ["approval.verify(...) → non-affirmative"]],
      ["D3", wrongBinding, "approval verdict binding mismatch", "GATE: refused (APPROVAL_REQUIRED)", ["approval.verify(...) → binding-mismatch"]],
      ["D5", throwsBoom, "approval component threw", "GATE: refused (APPROVAL_REQUIRED)", ["approval.verify(...) → threw"]],
      ["D6", mutatesExecution, "approval component mutated its inputs", "GATE: refused (APPROVAL_REQUIRED)", ["approval.binding → mutated"]],
    ];
    for (const [id, approval, detail, ledgerLine, approvalEvidence] of outcomes) {
      const rig = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const bundle = id === "D6" ? clone(TRIGGER) : TRIGGER;
      const result = rig.composer.execute(bundle);
      // Exactly one composer build per attempt — the component builds none.
      assert.strictEqual(rig.counts.build, 1, `${id}: one build per attempt`);
      assert.strictEqual(rig.inputs.length, 1, `${id}: one captured input`);
      const input = rig.inputs[0];
      assert.strictEqual(input.type, "completion");
      assert.deepStrictEqual(
        input.sections.map((section) => section.id),
        ["summary", "results", "phase-ledger", "evidence", "remaining-issues"],
        `${id}: five-section shape unchanged`
      );
      const ledger = rowsOf(input, "phase-ledger");
      assert.ok(ledger.includes(ledgerLine), `${id}: ledger line ${ledgerLine}`);
      const evidence = rowsOf(input, "evidence");
      const approvalLines = evidence.filter((line) => line.startsWith("approval."));
      assert.deepStrictEqual(approvalLines, approvalEvidence, `${id}: exact evidence lines`);
      // The gate line precedes the approval evidence lines.
      const gateIndex = evidence.findIndex((line) => line.startsWith("plan.review.required"));
      assert.ok(gateIndex >= 0, `${id}: the gate line exists`);
      for (const line of approvalLines) {
        assert.ok(evidence.indexOf(line) > gateIndex, `${id}: evidence appended after the gate line`);
      }
      if (detail === undefined) {
        // Success carries exactly three reports — planner, composer, agent.
        assert.strictEqual(result.ok, true, id);
        for (const report of [result.planning.report, result.report, result.orchestration.report]) {
          assert.notStrictEqual(report, null, `${id}: three reports`);
          assert.strictEqual(report.sha256, sha256(report.text));
        }
        assert.ok(result.report.text.includes("| Status | COMPLETED |"));
      } else {
        // Every refusal report mirrors code/status/stage/issue and never completes.
        assert.strictEqual(result.error.detail, detail, id);
        assert.ok(result.report.text.includes(`| Code | APPROVAL_REQUIRED |`), id);
        assert.ok(result.report.text.includes(`| Status | REFUSED |`), id);
        assert.ok(result.report.text.includes(`| Stage | GATE |`), id);
        assert.ok(result.report.text.includes(`APPROVAL_REQUIRED: ${detail}`), id);
        assert.ok(!result.report.text.includes("| Status | COMPLETED |"), id);
        assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"), id);
      }
    }
    // D4 evidence line (its bundle is constructed, not shared).
    const d4Bundle = clone(TRIGGER);
    d4Bundle.execution = { ...EX, weird: NaN };
    const d4 = makeApprovalRig({ approval: wrongBinding });
    d4.composer.execute(d4Bundle);
    assert.strictEqual(d4.counts.build, 1);
    assert.deepStrictEqual(
      rowsOf(d4.inputs[0], "evidence").filter((line) => line.startsWith("approval.")),
      ["approval.binding → not canonicalizable"]
    );
  });

  it("R-14: end-to-end determinism — same bundle, same verdict, same bytes", () => {
    const scenarios = [
      ["pass", grantNow, undefined],
      ["D0", undefined, undefined],
      ["D1", malformed, undefined],
      ["D2", nonAffirmative, undefined],
      ["D3", wrongBinding, undefined],
      ["D5", throwsBoom, undefined],
      ["D6", mutatesExecution, undefined],
    ];
    for (const [id, approval] of scenarios) {
      const first = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const second = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const r1 = first.composer.execute(id === "D6" ? clone(TRIGGER) : TRIGGER);
      const r2 = second.composer.execute(id === "D6" ? clone(TRIGGER) : TRIGGER);
      assert.deepStrictEqual(r1, r2, `${id}: identical results`);
      assert.strictEqual(r1.report.text, r2.report.text, `${id}: byte-identical report`);
      assert.strictEqual(r1.report.sha256, r2.report.sha256, `${id}: equal sha256`);
      // No volatile data in any report.
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r1.report.text), `${id}: no timestamps`);
      assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(r1.report.text), `${id}: no uuids`);
      assert.ok(!/\/(home|Users|tmp)\//.test(r1.report.text), `${id}: no machine paths`);
      assert.strictEqual(first.counts.verify, second.counts.verify, `${id}: equal consultation counts`);
    }
    // A refusal is just as deterministic as a success: D4 pair too.
    const d4Bundle = clone(TRIGGER);
    d4Bundle.execution = { ...EX, weird: NaN };
    const d4a = makeApprovalRig({ approval: wrongBinding });
    const d4b = makeApprovalRig({ approval: wrongBinding });
    const dr1 = d4a.composer.execute(clone(d4Bundle));
    const dr2 = d4b.composer.execute(clone(d4Bundle));
    assert.deepStrictEqual(dr1, dr2);
    assert.strictEqual(dr1.report.text, dr2.report.text);
    assert.strictEqual(dr1.report.sha256, dr2.report.sha256);
    // No time/randomness/PID/environment input exists in the approval path.
    for (const { rel, text } of compositionSources()) {
      assert.ok(!/Date\.now|new Date|Math\.random|process\.pid|process\.env|hrtime/.test(text), `${rel}: no hidden-state input`);
    }
  });

  it("R-15: invocation counts — exact observable invariants", () => {
    const badExecBundle = () => {
      const bundle = clone(TRIGGER);
      bundle.execution = { ...EX, weird: NaN };
      return bundle;
    };
    const rows = [
      ["invalid bundle", () => null, grantNow, { plan: 0, verify: 0, run: 0, build: 1 }],
      ["planner refusal", () => TIER3, grantNow, { plan: 1, verify: 0, run: 0, build: 1 }],
      ["triggerless, no component", () => REQ, undefined, { plan: 1, verify: 0, run: 1, build: 1 }],
      ["triggerless, component injected", () => REQ, grantNow, { plan: 1, verify: 0, run: 1, build: 1 }],
      ["gated success", () => TRIGGER, grantNow, { plan: 1, verify: 1, run: 1, build: 1 }],
      ["gated D0 absent", () => TRIGGER, undefined, { plan: 1, verify: 0, run: 0, build: 1 }],
      ["gated D1", () => TRIGGER, malformed, { plan: 1, verify: 1, run: 0, build: 1 }],
      ["gated D2", () => TRIGGER, nonAffirmative, { plan: 1, verify: 1, run: 0, build: 1 }],
      ["gated D3", () => TRIGGER, wrongBinding, { plan: 1, verify: 1, run: 0, build: 1 }],
      ["gated D4", badExecBundle, wrongBinding, { plan: 1, verify: 1, run: 0, build: 1 }],
      ["gated D5", () => TRIGGER, throwsBoom, { plan: 1, verify: 1, run: 0, build: 1 }],
      ["gated D6", () => clone(TRIGGER), mutatesExecution, { plan: 1, verify: 1, run: 0, build: 1 }],
    ];
    for (const [label, bundleOf, approval, expected] of rows) {
      const rig = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      rig.composer.execute(bundleOf());
      assert.deepStrictEqual(rig.counts, expected, label);
    }
    // Counts do not leak across consecutive execute() calls — exact deltas.
    const rig = makeApprovalRig({ approval: grantNow });
    const first = rig.composer.execute(TRIGGER);
    assert.strictEqual(first.ok, true);
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 1, build: 1 }, "call 1");
    const snapshot = { ...rig.counts };
    const second = rig.composer.execute(TRIGGER);
    assert.strictEqual(second.ok, true);
    assert.deepStrictEqual(
      Object.fromEntries(Object.entries(rig.counts).map(([key, value]) => [key, value - snapshot[key]])),
      { plan: 1, verify: 1, run: 1, build: 1 },
      "call 2 starts from zero — one fresh consultation, never a cached verdict"
    );
    assert.deepStrictEqual(second.report.text, first.report.text, "stateless: identical bytes across calls");
    // A refusal on a component that never affirms consults exactly once per
    // call and never runs the agent — also with no state carried across.
    const refusing = makeApprovalRig({ approval: wrongBinding });
    const snapshot2 = { ...refusing.counts };
    const third = refusing.composer.execute(TRIGGER);
    assert.strictEqual(third.ok, false);
    assert.deepStrictEqual(
      Object.fromEntries(Object.entries(refusing.counts).map(([key, value]) => [key, value - snapshot2[key]])),
      { plan: 1, verify: 1, run: 0, build: 1 },
      "refusing call consults afresh"
    );
    const snapshot3 = { ...refusing.counts };
    const fourth = refusing.composer.execute(TRIGGER);
    assert.strictEqual(fourth.ok, false);
    assert.deepStrictEqual(
      Object.fromEntries(Object.entries(refusing.counts).map(([key, value]) => [key, value - snapshot3[key]])),
      { plan: 1, verify: 1, run: 0, build: 1 },
      "no cached verdict satisfies the next attempt"
    );
  });
});

// ---------------------------------------------------------------------------
describe("Policy/Approval positive matrix (POS-1 … POS-3)", () => {
  it("POS-1: gated + injected + bound affirmative verdict ⇒ CROSS", () => {
    const rig = makeApprovalRig({ approval: grantNow });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.stage, "COMPLETE");
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 1, build: 1 });
    for (const report of [result.planning.report, result.report, result.orchestration.report]) {
      assert.notStrictEqual(report, null);
      assert.strictEqual(report.sha256, sha256(report.text));
    }
    assert.ok(result.report.text.includes("| Status | COMPLETED |"));
    assert.ok(result.report.text.includes("GATE: done (approval verified)"));
    const evidence = rowsOf(rig.inputs[0], "evidence");
    assert.ok(evidence.includes("approval.verify(...) → affirmative"));
    assert.ok(evidence.includes("approval.binding → verified"));
  });

  it("POS-2: triggerless + component ⇒ CROSS (ungated, approval count 0)", () => {
    const withComponent = makeApprovalRig({ approval: grantNow });
    const withoutComponent = makeApprovalRig();
    const r1 = withComponent.composer.execute(REQ);
    const r2 = withoutComponent.composer.execute(REQ);
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(withComponent.counts.verify, 0, "component never consulted when ungated");
    assert.strictEqual(withComponent.counts.run, 1);
    // Byte-identical to today's success: the component changes nothing here.
    assert.deepStrictEqual(r1, r2, "ungated results are identical with and without a component");
    assert.strictEqual(r1.report.text, r2.report.text, "byte-identical report");
    assert.strictEqual(r1.report.sha256, r2.report.sha256);
    assert.ok(r1.report.text.includes("GATE: done (review not required)"));
    assert.ok(!r1.report.text.includes("approval."));
  });

  it("POS-3: second consecutive execute() on the same composer ⇒ CROSS, counts reset", () => {
    const rig = makeApprovalRig({ approval: grantNow });
    const first = rig.composer.execute(TRIGGER);
    assert.strictEqual(first.ok, true);
    assert.deepStrictEqual(rig.counts, { plan: 1, verify: 1, run: 1, build: 1 });
    const second = rig.composer.execute(TRIGGER);
    assert.strictEqual(second.ok, true, "the fresh verdict crosses the second attempt too");
    assert.deepStrictEqual(rig.counts, { plan: 2, verify: 2, run: 2, build: 2 }, "one consult per call — stateless");
    // Identical bytes and sha256 as the first call — nothing carried over.
    assert.strictEqual(second.report.text, first.report.text);
    assert.strictEqual(second.report.sha256, first.report.sha256);
    assert.deepStrictEqual(second, first);
  });
});

// ---------------------------------------------------------------------------
describe("Policy/Approval negative matrix (NEG-01 … NEG-20)", () => {
  // Shared stub-planner factory: a gated plan artifact carrying a forged
  // `approval` member as an extra field (NEG-09/NEG-10).
  const forgedArtifact = () => ({
    tier: "T2",
    depth: "document",
    task: "Add input validation to createUser",
    changes: REQ.plan.changes.map((change) => ({ ...change })),
    verification: [...REQ.plan.verification],
    risks: [...REQ.plan.risks],
    review: { required: true, trigger: "migration" },
    approval: { granted: true, plan: HEX_A, execution: HEX_B },
  });
  const stubPlanner = () => ({
    plan(request) {
      return {
        ok: true,
        code: "COMPLETED",
        status: "COMPLETED",
        stage: "COMPLETE",
        error: null,
        request: { task: request.task, tier: request.tier },
        plan: forgedArtifact(),
        report: { text: "stub report", sha256: "stub" },
      };
    },
  });

  it("NEG-01: missing approval component ⇒ D0, today's exact string", () => {
    const rig = makeApprovalRig();
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, D0_DETAIL);
    assert.strictEqual(rig.counts.verify, 0, "no component ⇒ zero consultations");
    assert.strictEqual(rig.counts.run, 0);
    assert.strictEqual(rig.counts.build, 1);
    assert.ok(result.report.text.includes("GATE: refused (APPROVAL_REQUIRED)"));
    assert.ok(!result.report.text.includes("approval.verify"), "evidence byte-identical to today");
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    assert.strictEqual(result.orchestration, null);
  });

  it("NEG-02: malformed verdict (missing execution) ⇒ D1", () => {
    const rig = makeApprovalRig({ approval: () => ({ granted: true, plan: HEX_A }) });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, "approval verdict malformed");
    assert.ok(result.report.text.includes("APPROVAL_REQUIRED: approval verdict malformed"));
    assert.strictEqual(rig.counts.run, 0);
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("NEG-03: non-affirmative verdict ⇒ D2 (never a binding detail)", () => {
    const rig = makeApprovalRig({ approval: nonAffirmative });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, "approval verdict not affirmative");
    assert.ok(!result.report.text.includes("binding"), "D2 precedes D3");
    assert.strictEqual(rig.counts.run, 0);
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("NEG-04: approval throws ⇒ D5, thrown content never appears", () => {
    const rig = makeApprovalRig({
      approval: () => {
        throw new Error(`boom-${Date.now()}-stack`);
      },
    });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, "approval component threw");
    assert.ok(!result.report.text.includes("boom"));
    assert.ok(!result.report.text.includes("stack"));
    assert.ok(!JSON.stringify(result.error).includes("boom"));
    assert.strictEqual(rig.counts.verify, 1, "a throw is not retried");
    assert.strictEqual(rig.counts.run, 0);
  });

  it("NEG-05: missing plan binding ⇒ D1 (absent, empty, wrong length)", () => {
    const verdicts = [
      ["missing plan", () => ({ granted: true, execution: HEX_B })],
      ["empty plan", () => ({ granted: true, plan: "", execution: HEX_B })],
      ["wrong length", () => ({ granted: true, plan: HEX_A.slice(0, 63), execution: HEX_B })],
    ];
    for (const [label, verdict] of verdicts) {
      const rig = makeApprovalRig({ approval: verdict });
      const result = rig.composer.execute(TRIGGER);
      assert.strictEqual(result.error.detail, "approval verdict malformed", label);
      assert.strictEqual(rig.counts.run, 0, label);
    }
  });

  it("NEG-06: verdict bound to a different plan's identity ⇒ D3", () => {
    const otherPlan = { review: { required: false, trigger: null }, risks: [], verification: [], changes: [], task: "another plan", depth: "document", tier: "T2" };
    const rig = makeApprovalRig({
      approval: (plan, execution) => ({ granted: true, plan: planIdentity(otherPlan), execution: executionIdentity(execution) }),
    });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, "approval verdict binding mismatch");
    assert.strictEqual(rig.counts.verify, 1);
    assert.strictEqual(rig.counts.run, 0);
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("NEG-07: tampered plan (one byte after approval) ⇒ D3 — re-approval required", () => {
    const bundle = clone(TRIGGER);
    bundle.plan.task = `${bundle.plan.task}!`; // one byte altered post-approval
    const rig = makeApprovalRig({
      approval: (plan, execution) => ({
        granted: true,
        plan: planIdentity({ ...plan, task: plan.task.slice(0, -1) }), // approval was for the original bytes
        execution: executionIdentity(execution),
      }),
    });
    const result = rig.composer.execute(bundle);
    assert.strictEqual(result.error.detail, "approval verdict binding mismatch");
    assert.strictEqual(rig.counts.run, 0, "any content change forces re-approval");
  });

  it("NEG-08: execution sub-request swapped ⇒ D3", () => {
    const rig = makeApprovalRig({
      approval: (plan, execution) => ({ granted: true, plan: planIdentity(plan), execution: executionIdentity(EX) }),
    });
    const result = rig.composer.execute(fixture("mut_approval_execution_swapped.json"));
    assert.strictEqual(result.error.detail, "approval verdict binding mismatch");
    assert.strictEqual(rig.counts.run, 0);
    assert.strictEqual(rig.counts.verify, 1);
  });

  it("NEG-09: forged approval field on the plan artifact ⇒ D4 (never read as approval)", () => {
    const rig = makeApprovalRig({ planner: stubPlanner(), approval: wrongBinding });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, "approval binding input not canonicalizable");
    assert.strictEqual(rig.counts.verify, 1, "the component is still consulted exactly once");
    assert.strictEqual(rig.counts.run, 0);
    assert.strictEqual(result.planning.ok, true, "the planner attempt itself completed");
    assert.notStrictEqual(result.plan, null, "the forged artifact is attached, not believed");
    assert.strictEqual(result.plan.approval.granted, true, "the forged field rides along, unread");
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("NEG-10: planner-generated approval with no component ⇒ D0 (report byte-identical to NEG-01)", () => {
    const neg01 = makeApprovalRig();
    const neg01Result = neg01.composer.execute(TRIGGER);
    const rig = makeApprovalRig({ planner: stubPlanner() });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, D0_DETAIL);
    assert.strictEqual(rig.counts.verify, 0, "planner content is never consulted as approval");
    assert.strictEqual(rig.counts.run, 0);
    assert.strictEqual(result.report.text, neg01Result.report.text, "refusal report byte-identical to NEG-01");
  });

  it("NEG-11: agent-generated approval ⇒ D0 (agent never invoked at GATE)", () => {
    const claimingAgent = {
      run() {
        return { ok: true, code: "COMPLETED", approval: { granted: true, plan: HEX_A, execution: HEX_B } };
      },
    };
    const rig = makeApprovalRig({ agent: claimingAgent });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, D0_DETAIL);
    assert.strictEqual(rig.counts.run, 0, "the agent is never called — its output cannot reach GATE");
    assert.strictEqual(result.orchestration, null);
    assert.strictEqual(rig.counts.verify, 0);
  });

  it("NEG-12: composer-generated approval ⇒ D0 (source scan: no literal grant path)", () => {
    // Source scan: the composer constructs no verdict and holds no grant literal.
    const composerText = readFileSync(path.join(COMPOSITION_DIR, "src", "composer.mjs"), "utf8");
    assert.ok(!/granted\s*:/.test(composerText), "composer constructs no verdict");
    assert.ok(!/\{\s*granted/.test(composerText), "no verdict literal in the composer");
    const all = compositionSources().map((source) => source.text).join("\n");
    assert.ok(!/granted\s*:\s*true/.test(all), "no hardcoded affirmative anywhere in the layer");
    // Behavioral: with no component there is no self-approval path.
    const rig = makeApprovalRig();
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, D0_DETAIL);
    assert.strictEqual(rig.counts.verify, 0);
    assert.strictEqual(rig.counts.run, 0);
  });

  it("NEG-13: prebuilt verdict outside the verify() channel ⇒ D0 (no effect)", () => {
    // A prebuilt verdict object — even one shaped like a component — is never
    // injected, so it is never consulted and cannot grant.
    const outOfChannel = {
      verify() {
        outOfChannel.calls += 1;
        return { granted: true, plan: HEX_A, execution: HEX_B };
      },
      verdict: { granted: true, plan: HEX_A, execution: HEX_B },
      calls: 0,
    };
    const rig = makeApprovalRig(); // `outOfChannel` deliberately NOT wired as approval
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.error.detail, D0_DETAIL, "only a wired verify() return can ever be read");
    assert.strictEqual(outOfChannel.calls, 0, "the out-of-channel component is never invoked");
    assert.strictEqual(rig.counts.verify, 0);
    assert.strictEqual(rig.counts.run, 0);
    // Companion check: when such a component IS injected, its extra `verdict`
    // property confers nothing — only the verify() RETURN value is read.
    const injected = makeApprovalRig({
      approval: { verify: () => undefined, verdict: { granted: true, plan: HEX_A, execution: HEX_B } },
    });
    const injectedResult = injected.composer.execute(TRIGGER);
    assert.strictEqual(injectedResult.error.detail, "approval verdict malformed", "the out-of-band property is ignored");
    assert.strictEqual(injected.counts.verify, 1, "exactly one consultation");
    assert.strictEqual(injected.counts.run, 0);
  });

  it("NEG-14: repeated approval invocation — exactly one consultation, never two", () => {
    const success = makeApprovalRig({ approval: grantNow });
    const successResult = success.composer.execute(TRIGGER);
    assert.strictEqual(successResult.ok, true);
    assert.strictEqual(success.counts.verify, 1, "gated success consults exactly once");
    assert.strictEqual(success.counts.run, 1);
    assert.strictEqual(success.counts.build, 1, "exactly one composer report");
    const successEvidence = rowsOf(success.inputs[0], "evidence").filter((line) => line.startsWith("approval."));
    assert.strictEqual(successEvidence.length, 2, "affirmative + verified — no retry lines");

    const refusal = makeApprovalRig({ approval: wrongBinding });
    const refusalResult = refusal.composer.execute(TRIGGER);
    assert.strictEqual(refusalResult.ok, false);
    assert.strictEqual(refusal.counts.verify, 1, "a refusal is not retried");
    assert.strictEqual(refusal.counts.run, 0);
    assert.strictEqual(refusal.counts.build, 1, "exactly one composer report");
    const refusalEvidence = rowsOf(refusal.inputs[0], "evidence").filter((line) => line.startsWith("approval."));
    assert.deepStrictEqual(refusalEvidence, ["approval.verify(...) → binding-mismatch"], "one consultation, one line — no second GATE consultation");
  });

  it("NEG-15: approval invoked when review.required === false ⇒ 0 (CROSS unchanged)", () => {
    const rig = makeApprovalRig({ approval: grantNow });
    const result = rig.composer.execute(REQ);
    assert.strictEqual(result.ok, true, "unchanged ungated pass");
    assert.strictEqual(rig.counts.verify, 0, "component never consulted");
    assert.strictEqual(rig.counts.run, 1);
    assert.ok(result.report.text.includes("GATE: done (review not required)"));
    assert.ok(!result.report.text.includes("approval."), "report as today");
  });

  it("NEG-16: nondeterministic result attempt — identical decisions across fresh composers", () => {
    const scenarios = [
      ["pass", grantNow, undefined],
      ["D0", undefined, undefined],
      ["D1", malformed, undefined],
      ["D2", nonAffirmative, undefined],
      ["D3", wrongBinding, undefined],
      ["D5", throwsBoom, undefined],
      ["D6", mutatesExecution, undefined],
    ];
    for (const [id, approval] of scenarios) {
      const first = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const second = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const r1 = first.composer.execute(id === "D6" ? clone(TRIGGER) : TRIGGER);
      const r2 = second.composer.execute(id === "D6" ? clone(TRIGGER) : TRIGGER);
      assert.strictEqual(r1.ok, r2.ok, `${id}: identical decision`);
      assert.strictEqual(r1.code, r2.code, `${id}: identical code`);
      assert.strictEqual(r1.error?.detail ?? null, r2.error?.detail ?? null, `${id}: identical detail`);
      assert.strictEqual(first.counts.verify, second.counts.verify, `${id}: 1 consultation per run`);
      assert.strictEqual(first.counts.verify, approval === undefined ? 0 : 1, `${id}: exact count`);
      assert.deepStrictEqual(r1, r2, `${id}: deepStrictEqual results`);
      assert.strictEqual(r1.report.text, r2.report.text, `${id}: byte-identical report`);
      assert.strictEqual(r1.report.sha256, r2.report.sha256, `${id}: equal sha256`);
    }
    // D4 pair (bundle-side input).
    const bad = () => {
      const bundle = clone(TRIGGER);
      bundle.execution = { ...EX, weird: NaN };
      return bundle;
    };
    const d4a = makeApprovalRig({ approval: wrongBinding });
    const d4b = makeApprovalRig({ approval: wrongBinding });
    const dr1 = d4a.composer.execute(bad());
    const dr2 = d4b.composer.execute(bad());
    assert.deepStrictEqual(dr1, dr2);
    assert.strictEqual(dr1.report.text, dr2.report.text);
    assert.strictEqual(dr1.report.sha256, dr2.report.sha256);
  });

  it("NEG-17: agent called after any refusal D0–D6 ⇒ impossible (run 0)", () => {
    const outcomes = [
      ["D0", undefined, undefined],
      ["D1", malformed, undefined],
      ["D2", nonAffirmative, undefined],
      ["D3", wrongBinding, undefined],
      ["D5", throwsBoom, undefined],
      ["D6", mutatesExecution, undefined],
    ];
    for (const [id, approval] of outcomes) {
      const rig = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const result = rig.composer.execute(id === "D6" ? clone(TRIGGER) : TRIGGER);
      assert.strictEqual(result.ok, false, id);
      assert.strictEqual(rig.counts.run, 0, `${id}: agent never called after a refusal`);
      assert.strictEqual(result.orchestration, null, id);
      assert.notStrictEqual(result.report, null, id);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), id);
    }
    const d4Bundle = clone(TRIGGER);
    d4Bundle.execution = { ...EX, weird: NaN };
    const d4 = makeApprovalRig({ approval: wrongBinding });
    const d4Result = d4.composer.execute(d4Bundle);
    assert.strictEqual(d4Result.ok, false);
    assert.strictEqual(d4.counts.run, 0, "D4: agent never called after a refusal");
    assert.strictEqual(d4Result.orchestration, null);
  });

  it("NEG-18: report after an invalid gate transition — mirrored, one report, no completion", () => {
    const details = [
      ["D0", undefined, D0_DETAIL],
      ["D1", malformed, "approval verdict malformed"],
      ["D2", nonAffirmative, "approval verdict not affirmative"],
      ["D3", wrongBinding, "approval verdict binding mismatch"],
      ["D5", throwsBoom, "approval component threw"],
      ["D6", mutatesExecution, "approval component mutated its inputs"],
    ];
    for (const [id, approval, detail] of details) {
      const rig = approval === undefined ? makeApprovalRig() : makeApprovalRig({ approval });
      const result = rig.composer.execute(id === "D6" ? clone(TRIGGER) : TRIGGER);
      assert.strictEqual(result.status, "REFUSED", id);
      assert.strictEqual(result.stage, "GATE", id);
      assert.ok(result.report.text.includes(`APPROVAL_REQUIRED: ${detail}`), id);
      assert.ok(result.report.text.includes("| Status | REFUSED |"), id);
      // The approval component emits NO report: exactly the composer's own build.
      assert.strictEqual(rig.counts.build, 1, id);
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), id);
      assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"), id);
    }
    const d4Bundle = clone(TRIGGER);
    d4Bundle.execution = { ...EX, weird: NaN };
    const d4 = makeApprovalRig({ approval: wrongBinding });
    const d4Result = d4.composer.execute(d4Bundle);
    assert.ok(d4Result.report.text.includes("APPROVAL_REQUIRED: approval binding input not canonicalizable"));
    assert.strictEqual(d4.counts.build, 1, "D4: one report, from the composer only");
  });

  it("NEG-19: bundle-level approval member bypasses nothing — refused at VALIDATE", () => {
    const input = fixture("mut_approval_bundle_extra_field.json");
    assert.ok(validateBundle(input).length > 0, "the envelope itself refuses the approval member");
    const rig = makeApprovalRig({ approval: grantNow });
    const result = rig.composer.execute(input);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "INVALID_REQUEST");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "VALIDATE");
    assert.strictEqual(result.error.class, "E-INPUT");
    assert.ok(result.error.detail.includes('unexpected bundle field "approval"'), result.error.detail);
    assert.strictEqual(rig.counts.plan, 0, "no attempt ran");
    assert.strictEqual(rig.counts.verify, 0, "GATE never reached — approval is never envelope data");
    assert.strictEqual(rig.counts.run, 0);
    assert.strictEqual(rig.counts.build, 1);
    assert.strictEqual(result.planning, null);
    assert.strictEqual(result.plan, null);
    assert.strictEqual(result.orchestration, null);
    const ledger = rowsOf(rig.inputs[0], "phase-ledger");
    assert.ok(!ledger.some((line) => line.startsWith("GATE:")), "no GATE transition happened");
    const evidence = rowsOf(rig.inputs[0], "evidence");
    assert.ok(!evidence.some((line) => line.startsWith("approval.")), "no approval evidence line");
    assert.notStrictEqual(result.report, null);
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("NEG-20: no unauthorized change outside CS-13 — pins and file boundary", () => {
    // Protected documents byte-match their pins (Core 01–04 and registry 12).
    const PINS = {
      "docs/v3/01-core-specification.md": "9bc4b0c0bdfca652fc0f50e01ff07b4f677148fa20e756548b48d8534c786576",
      "docs/v3/02-architecture-map.md": "b6e25671124e41860e3271b4e387931053ce3c876364181052446a91b35d325a",
      "docs/v3/03-extension-contract.md": "fdc83a0e369823ef84783a98b978bce2fde0cb95b9d2d0d9a3a1ed24ae23e22b",
      "docs/v3/04-decision-rules.md": "4fc9c146e8a88b722a7c3f2b3aaab4b97ad8a91c358888a814f11bd7875057ec",
      "docs/v3/12-hotkey-registry.md": "c861b562caddc05d0df984797518496916def72114a8c36b4c83e8c3dd710139",
    };
    for (const [rel, want] of Object.entries(PINS)) {
      assert.strictEqual(sha256(readFileSync(path.join(ROOT, rel), "utf8")), want, `${rel} must not change`);
    }
    // The deliberately vacant design-doc path was never manufactured (D-13-0).
    assert.ok(!existsSync(path.join(ROOT, "docs/v3/21-policy-approval-design.md")));
    // CS-13's exhaustive file list: every changed path must be a member.
    const CS13 = new Set([
      "docs/v3/05-acceptance-tests.md",
      "docs/v3/20-plan-execution-composition.md",
      "docs/v3/22-policy-approval-ruling-record.md",
      "docs/v3/23-policy-approval-contract.md",
      "composition/plan-execution/index.mjs",
      "composition/plan-execution/src/approval.mjs",
      "composition/plan-execution/src/composer.mjs",
      "test/policy-approval.test.mjs",
      "test/plan-execution.test.mjs",
      "test/_fixtures/mut_approval_bundle_extra_field.json",
      "test/_fixtures/mut_approval_execution_swapped.json",
      "test/_fixtures/mut_approval_report_input.json",
    ]);
    // Task-16 boundary extension (documented): the Local Runtime work is
    // authorized by the Task 16 directive, not by CS-13, so its exhaustive
    // four-file list joins the boundary below. Every OTHER changed path
    // still fails this gate exactly as before.
    const TASK16 = new Set([
      "runtime/local-runtime.mjs",
      "test/local-runtime.test.mjs",
      "docs/v3/24-local-runtime.md",
      "test/_fixtures/local_runtime_gated.json",
    ]);
    // Task-17 boundary extension (documented, same reasoning): the Real
    // Scenario Test Harness is authorized by the Task 17 directive; its
    // exhaustive nine-file list joins the boundary. No Core file, module,
    // contract, or Local Runtime file is added here.
    const TASK17 = new Set([
      "test/scenario-harness.mjs",
      "test/scenario-harness.test.mjs",
      "test/scenarios/RT-001.json",
      "test/scenarios/RT-002.json",
      "test/scenarios/RT-003.json",
      "test/scenarios/RT-004.json",
      "test/scenarios/RT-005.json",
      "test/scenarios/fixtures/notes.md",
      "docs/v3/25-real-scenario-test-harness.md",
    ]);
    // Task-18 boundary extension (documented, same reasoning): the Native
    // Write Capability contract gate is an investigation-only task — it ships
    // ONE design artifact and this boundary line. No capability, provider,
    // handler, runtime, module, or acceptance-test behavior is added, so the
    // exhaustive two-file list below is the entire authorized surface. Every
    // OTHER changed path (including any runtime/module/test file) still fails
    // this gate exactly as before.
    const TASK18 = new Set([
      "docs/v3/26-native-write-capability.md",
      "test/policy-approval.test.mjs",
    ]);
    // Task-19 boundary extension (documented, same reasoning): the Executive
    // Ruling on the Native Write Capability is decision-only — it ships ONE
    // ruling document plus the two pointer/boundary edits that name it. No
    // capability, handler, provider, token, runtime option, RT-006, or Group U
    // is added, so this exhaustive four-file list is the entire authorized
    // surface. Every OTHER changed path (any module, runtime, composition, or
    // test-behavior file) still fails this gate exactly as before.
    const TASK19 = new Set([
      "docs/v3/27-native-write-capability-ruling.md",
      "docs/v3/26-native-write-capability.md",
      "docs/v3/05-acceptance-tests.md",
      "test/policy-approval.test.mjs",
    ]);
    // Task-20 boundary extension (documented, same reasoning): the Native
    // Write Contract Authoring task is contract-only — it amends the hotkey
    // runtime contract, documents the Local Runtime opt-in flag and the
    // scenario-harness paths, specifies Group U, and extends this boundary
    // line. No handler, write code, runtime option, registry entry, token,
    // capability, RT-006, or Group U executable test is added, so this
    // exhaustive five-file list is the entire authorized surface. Every
    // OTHER changed path (any module, runtime, composition, handler, or
    // test-behavior file) still fails this gate exactly as before.
    const TASK20 = new Set([
      "docs/v3/14-hotkey-runtime.md",
      "docs/v3/24-local-runtime.md",
      "docs/v3/25-real-scenario-test-harness.md",
      "docs/v3/05-acceptance-tests.md",
      "test/policy-approval.test.mjs",
    ]);
    // Task-21 boundary extension (documented, same reasoning): the Native
    // Write Capability Implementation is authorized by the Task 19 ruling
    // (`27` R1–R7) and the Task 20 contracts. It ships the handler.save-files
    // factory + write-path classification in the hotkeys module, the hotkeys
    // manifest semver bump, the Local Runtime --workspace flag, the RT-006
    // production-path scenario, the executable Group U suite, and the
    // contract-document synchronizations those imply. No Planner, Agent,
    // Tool Bus, Module Registry, Composition, report, or protected contract
    // file is added, so this exhaustive fourteen-file list is the entire
    // authorized surface. Every OTHER changed path still fails this gate
    // exactly as before.
    const TASK21 = new Set([
      "modules/hotkeys/src/handlers.mjs",
      "modules/hotkeys/src/errors.mjs",
      "modules/hotkeys/src/runtime.mjs",
      "modules/hotkeys/manifest.yaml",
      "runtime/local-runtime.mjs",
      "test/scenario-harness.mjs",
      "test/scenario-harness.test.mjs",
      "test/scenarios/RT-006.json",
      "test/native-write.test.mjs",
      "test/policy-approval.test.mjs",
      "docs/v3/05-acceptance-tests.md",
      "docs/v3/14-hotkey-runtime.md",
      "docs/v3/24-local-runtime.md",
      "docs/v3/25-real-scenario-test-harness.md",
    ]);
    // Task-22 boundary extension (documented, same reasoning): the Native
    // Write Security & Integrity Audit is audit-only — it ships ONE audit
    // record document plus this boundary line. No production code, test
    // behavior, contract text, or protected file is added, changed, or
    // weakened, so this exhaustive two-file list is the entire authorized
    // surface. Every OTHER changed path still fails this gate exactly as
    // before.
    const TASK22 = new Set([
      "docs/v3/28-native-write-audit.md",
      "test/policy-approval.test.mjs",
    ]);
    // -uall: list every untracked file individually (a plain listing would
    // collapse a brand-new directory to `runtime/` and check no file in it).
    const porcelain = execFileSync("git", ["status", "--porcelain", "-uall"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const changed = porcelain
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.replace(/^\?\? /, "   ").slice(3).trim());
    for (const file of changed) {
      assert.ok(
        CS13.has(file) || TASK16.has(file) || TASK17.has(file) || TASK18.has(file) || TASK19.has(file) || TASK20.has(file) || TASK21.has(file) || TASK22.has(file),
        `unauthorized change outside CS-13/Task-16/Task-17/Task-18/Task-19/Task-20/Task-21/Task-22: ${file}`
      );
    }
    // Nothing registers: no manifest anywhere in the composition root.
    assert.ok(!existsSync(path.join(COMPOSITION_DIR, "manifest.yaml")));
  });
});

// ---------------------------------------------------------------------------
describe("Policy/Approval mutations (R-M1 … R-M3)", () => {
  it("R-M1: mut_approval_bundle_extra_field.json fails closed at VALIDATE", () => {
    const input = fixture("mut_approval_bundle_extra_field.json"); // byte-different, asserted
    assert.ok(validateBundle(input).length > 0, "the envelope refuses the bypass attempt");
    const rig = makeApprovalRig({ approval: grantNow });
    const result = rig.composer.execute(input);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "INVALID_REQUEST");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "VALIDATE");
    assert.ok(CORE_ERROR_CLASSES.includes(result.error.class));
    assert.ok(COMPOSITION_ERROR_CLASSES.includes(result.error.class));
    assert.strictEqual(rig.counts.plan, 0, "no attempt ran");
    assert.strictEqual(rig.counts.verify, 0, "approval is never envelope data");
    assert.strictEqual(rig.counts.run, 0);
    assert.strictEqual(rig.counts.build, 1);
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("R-M2: mut_approval_execution_swapped.json ⇒ D3 binding mismatch, agent 0", () => {
    const input = fixture("mut_approval_execution_swapped.json"); // byte-different, asserted
    assert.deepStrictEqual(validateBundle(input), [], "envelope valid — its own layer accepts it");
    // The approval binds the ORIGINAL execution envelope; the bundle carries a swap.
    const rig = makeApprovalRig({
      approval: (plan, execution) => ({ granted: true, plan: planIdentity(plan), execution: executionIdentity(EX) }),
    });
    const result = rig.composer.execute(input);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "APPROVAL_REQUIRED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "GATE");
    assert.strictEqual(result.error.class, "E-INPUT");
    assert.strictEqual(result.error.detail, "approval verdict binding mismatch");
    assert.strictEqual(rig.counts.verify, 1);
    assert.strictEqual(rig.counts.run, 0, "a swapped execution never executes");
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
    assert.ok(!result.report.text.includes("plan-execution | plan-execution.execute | success"));
  });

  it("R-M3: mut_approval_report_input.json fails closed with REPORT_FAILED", () => {
    const fixtureText = readFileSync(FIX + "mut_approval_report_input.json", "utf8");
    assert.notStrictEqual(fixtureText, PRISTINE, "byte-different from the pristine bundle");
    const corrupted = JSON.parse(fixtureText);
    // Capture the pristine approval-refusal report input from a control run.
    const realBus = createReportBus();
    let captured = null;
    const control = makeApprovalRig({
      composerReportBus: {
        build(input) {
          captured = input;
          return realBus.build(input);
        },
      },
    });
    const controlRun = control.composer.execute(TRIGGER);
    assert.strictEqual(controlRun.ok, false);
    assert.strictEqual(controlRun.code, "APPROVAL_REQUIRED");
    assert.notStrictEqual(captured, null);
    // A real mutation of the pristine control input: byte-different AND content-different.
    assert.notStrictEqual(fixtureText, JSON.stringify(captured, null, 2));
    assert.notDeepStrictEqual(corrupted, captured);
    assert.strictEqual(
      corrupted.sections.find((section) => section.id === "summary").rows.find((row) => row.name === "Status").value,
      "kinda-done"
    );
    // Feed the corrupted document through the report boundary: the real bus
    // refuses it, and the composer must not claim completion.
    const rig = makeApprovalRig({
      composerReportBus: { build: () => realBus.build(corrupted) },
    });
    const result = rig.composer.execute(TRIGGER);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null, "no report artifact is emitted for corrupted input");
    assert.ok(CORE_ERROR_CLASSES.includes(result.error.class));
    assert.ok(result.error.detail.includes("attempt APPROVAL_REQUIRED"), "the underlying attempt is preserved");
    assert.strictEqual(rig.counts.build, 1);
    assert.strictEqual(rig.counts.run, 0, "the underlying GATE refusal never reached the agent");
    assert.strictEqual(rig.counts.verify, 0, "no component injected on this attempt");
    assert.notStrictEqual(result.plan, null, "the composed plan is preserved — completion is not claimed");
    assert.strictEqual(result.planning.ok, true);
    assert.notStrictEqual(result.planning.report, null);
    assert.strictEqual(result.orchestration, null);
  });
});
