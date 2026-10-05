// Grimoire v3 — Planner suite (Task 11).
//
// PL coverage map (documented in docs/v3/05-acceptance-tests.md, Group P,
// and docs/v3/19-planner.md §Tests):
//   PL-01  entry point, manifest validity, config, result-code table  — block 1
//   PL-02  T0 → one-sentence intent, no plan document (AC-10 A, 01 §5.4)
//   PL-03  T1 → bullets answering all four questions (01 §5.1)
//   PL-04  T2 → written document with risk list (AC-10 B)
//   PL-05  §5.2 review gate: T2 trigger → review required; none → no gate
//   PL-06  order question: plan preserves the request's change order
//   PL-07  invalid envelopes fail closed at VALIDATE                  — block 2
//   PL-08  unknown tier fails closed
//   PL-09  T0 carrying a plan document fails closed (over-planning)
//   PL-10  T0 with more than one file fails closed (01 §3.1)
//   PL-11  T1 missing a required question fails closed
//   PL-12  T2 missing a required question fails closed (AC-10)
//   PL-13  approval trigger outside T2 fails closed (01 §5.2)
//   PL-14  report failure propagates (no fabricated completion)
//   PL-15  Planner → Report Bus (real completion input, real build)   — block 3
//   PL-16  Planner fits the Module Registry contract (PLAN-only gate)
//   PL-17  public surface + source boundary + one build per attempt
//   PL-18  no fabricated completion; refusals never plan              — block 4
//   PL-19  determinism: identical results, identical report hashes
//   PL-20  the report always mirrors the result (no divergence)
//   PL-M1…M10  ten fail-closed mutations (byte-different fixtures)
//
// Mutation fixtures are asserted byte-different from the pristine request
// (test/_fixtures/plan_request.json) before they are trusted; M10's
// corrupted report input is asserted byte-different AND content-different
// from the pristine report input captured on a successful control run.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createPlanner,
  RESULT_CODES,
  LIFECYCLE_STAGES,
  PLAN_LEDGER_BY_TIER,
  validatePlanRequest,
  normalizePlanRequest,
  TIERS,
  PLAN_QUESTIONS,
  DEPTH_BY_TIER,
  TRIGGER_TYPES,
  REQUEST_FIELDS,
  CHANGE_FIELDS,
  PLANNER_ERROR_CLASSES,
  CORE_ERROR_CLASSES,
} from "../modules/planner/index.mjs";
import { createModuleRegistry } from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import { createReportBus } from "../modules/report-bus/index.mjs";

const ROOT = process.cwd();
const FIX = path.join(ROOT, "test/_fixtures/");
const PLANNER_DIR = path.join(ROOT, "modules/planner");
const PRISTINE = readFileSync(path.join(FIX, "plan_request.json"), "utf8");
const REQ = JSON.parse(PRISTINE);

const MODULE_IDS = ["hotkeys", "tool-bus", "module-registry", "report-bus", "agent", "planner"];
const MANIFESTS = MODULE_IDS.map((id) => ({
  id,
  text: readFileSync(path.join(ROOT, `modules/${id}/manifest.yaml`), "utf8"),
}));

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, PRISTINE, `${name} must be byte-different from the pristine request`);
  return JSON.parse(text);
}

function makeBus() {
  return createToolBus({
    declarationText: loadCapabilityDeclarations(),
    providers: createDefaultProviders(),
    root: ROOT,
  });
}

function makeRegistry() {
  const registry = createModuleRegistry({ toolBus: makeBus() });
  for (const manifest of MANIFESTS) {
    const registered = registry.register(manifest.text);
    assert.strictEqual(registered.ok, true, `${manifest.id}: ${JSON.stringify(registered)}`);
  }
  return registry;
}

// Standard composition: the single injected contract (Report Bus).
function makePlanner({ reportBus = createReportBus() } = {}) {
  return createPlanner({ reportBus });
}

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

const T0_REQ = {
  task: "Fix the typo in the README heading.",
  tier: "T0",
  changes: [{ file: "README.md", why: "fix heading typo" }],
};

const T1_REQ = {
  task: "Rename the helper function",
  tier: "T1",
  changes: [{ file: "src/util.mjs", why: "clearer name than util1" }],
  verification: ["node --test"],
  risks: ["callers must update their imports"],
};

const without = (object, ...keys) =>
  Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

// ---------------------------------------------------------------------------
describe("Planner contract (PL-01 … PL-06)", () => {
  it("PL-01: entry point, manifest, configuration, and result-code table", async () => {
    const entry = await import("../modules/planner/index.mjs");
    for (const name of [
      "createPlanner", "RESULT_CODES", "LIFECYCLE_STAGES", "PLAN_LEDGER_BY_TIER",
      "validatePlanRequest", "normalizePlanRequest", "TIERS", "PLAN_QUESTIONS",
      "DEPTH_BY_TIER", "TRIGGER_TYPES", "REQUEST_FIELDS", "CHANGE_FIELDS",
      "PLANNER_ERROR_CLASSES", "CORE_ERROR_CLASSES", "makeError", "isCoreErrorClass",
    ]) {
      assert.ok(name in entry, `entry must export ${name}`);
    }
    // The entry reaches only its own files — no node:, no lateral modules.
    const source = readFileSync(path.join(PLANNER_DIR, "index.mjs"), "utf8");
    for (const [, spec] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(spec.startsWith("./"), `entry may only import its own files (saw "${spec}")`);
    }

    // Manifest under the established 03 §2 contract — all six real
    // manifests register and validate together.
    const registry = createModuleRegistry({ toolBus: makeBus() });
    for (const manifest of MANIFESTS) {
      assert.strictEqual(registry.register(manifest.text).ok, true, manifest.id);
    }
    const validation = registry.validateAll();
    assert.strictEqual(validation.ok, true, JSON.stringify(validation));
    const descriptor = registry.describe("planner").descriptor;
    assert.deepStrictEqual(descriptor.phases, ["PLAN"]);
    assert.deepStrictEqual(descriptor.requires, { tools: [] });
    assert.deepStrictEqual(descriptor.provides, ["planner:plan"]);
    assert.deepStrictEqual(descriptor.consumes, ["report-bus:build"]);
    assert.deepStrictEqual(descriptor.entry, "modules/planner/index.mjs");
    assert.deepStrictEqual([...descriptor.errors].sort(), [...PLANNER_ERROR_CLASSES].sort());
    for (const klass of PLANNER_ERROR_CLASSES) assert.ok(CORE_ERROR_CLASSES.includes(klass), klass);

    // Configuration fails closed at construction (01 §13.5).
    for (const bad of [{}, { reportBus: null }, { reportBus: {} }, { reportBus: { build: 1 } }]) {
      assert.throws(() => createPlanner(bad), (error) => error.code === "E_INPUT_INVALID_PLANNER_CONFIG");
    }

    // Result-code table: exactly four codes, one success, one classified.
    assert.deepStrictEqual(Object.keys(RESULT_CODES), [
      "COMPLETED", "INVALID_REQUEST", "PLAN_INCOMPLETE", "REPORT_FAILED",
    ]);
    assert.strictEqual(RESULT_CODES.COMPLETED, null);
    assert.strictEqual(RESULT_CODES.INVALID_REQUEST, "E-INPUT");
    assert.strictEqual(RESULT_CODES.PLAN_INCOMPLETE, "E-VALID");
    assert.strictEqual(RESULT_CODES.REPORT_FAILED, "classified");
    for (const [code, klass] of Object.entries(RESULT_CODES)) {
      if (klass === null || klass === "classified") continue;
      assert.ok(PLANNER_ERROR_CLASSES.includes(klass), `${code} → ${klass}`);
    }
    // Lifecycle vocabulary: the PLAN phase made finite (Task 11 directive).
    assert.deepStrictEqual([...LIFECYCLE_STAGES], ["RECEIVE", "VALIDATE", "PLAN", "REPORT", "COMPLETE"]);
    // Planning vocabulary comes from Core, not invention.
    assert.deepStrictEqual([...TIERS], ["T0", "T1", "T2"]);
    assert.deepStrictEqual([...PLAN_QUESTIONS], ["files", "order", "verification", "risks"]);
    assert.deepStrictEqual({ ...DEPTH_BY_TIER }, { T0: "one-line", T1: "bullets", T2: "document" });
    assert.deepStrictEqual([...TRIGGER_TYPES], ["intent-change", "migration", "architecture"]);
    assert.deepStrictEqual([...REQUEST_FIELDS], ["task", "tier", "changes", "verification", "risks", "trigger"]);
    assert.deepStrictEqual([...CHANGE_FIELDS], ["file", "why"]);
    assert.deepStrictEqual({ ...PLAN_LEDGER_BY_TIER }, {
      T0: "PLAN: skipped (T0 — one-line intent)",
      T1: "PLAN: done (T1 — bullets)",
      T2: "PLAN: done (T2 — document)",
    });
  });

  it("PL-02: a T0 task ships a one-sentence intent and no plan document (AC-10 A)", () => {
    const planner = makePlanner();
    const result = planner.plan(T0_REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.strictEqual(result.error, null);
    assert.deepStrictEqual(result.plan, {
      tier: "T0",
      depth: "one-line",
      task: "Fix the typo in the README heading.",
      changes: [{ file: "README.md", why: "fix heading typo" }],
      verification: [],
      risks: [],
      review: { required: false, trigger: null },
    });
    const text = result.report.text;
    // 01 §3.2 skip ledger format, verbatim (AC-10: `PLAN: skipped (T0 …)`).
    assert.ok(text.includes("PLAN: skipped (T0 — one-line intent)"), text);
    assert.ok(text.includes("| Status | COMPLETED |"));
    assert.ok(text.includes("| Tier | T0 |"));
    assert.ok(text.includes("| Depth | one-line |"));
    assert.ok(text.includes("COMPLETE: done"));
    assert.ok(text.includes("| none | — |"), "remaining issues are empty and declared so");
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
  });

  it("PL-03: a T1 task gets bullets answering all four questions (01 §5.1)", () => {
    const result = makePlanner().plan(T1_REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.plan.depth, "bullets");
    assert.deepStrictEqual(result.plan.changes, [{ file: "src/util.mjs", why: "clearer name than util1" }]);
    assert.deepStrictEqual(result.plan.verification, ["node --test"]);
    assert.deepStrictEqual(result.plan.risks, ["callers must update their imports"]);
    assert.deepStrictEqual(result.plan.review, { required: false, trigger: null });
    assert.ok(result.report.text.includes("PLAN: done (T1 — bullets)"));
    assert.ok(result.report.text.includes("| Depth | bullets |"));
  });

  it("PL-04: a T2 task gets a written document with a risk list (AC-10 B)", () => {
    const result = makePlanner().plan(REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.plan.depth, "document");
    // Q1 + Q2: the ordered change list is exactly what was requested.
    assert.deepStrictEqual(
      result.plan.changes.map((change) => change.file),
      ["src/api/users.ts", "test/users.test.mjs"]
    );
    // Q3 + Q4: verification strategy and at least one risk (AC-10).
    assert.strictEqual(result.plan.verification.length, 2);
    assert.ok(result.plan.risks.length >= 1);
    assert.ok(result.report.text.includes("PLAN: done (T2 — document)"));
    assert.ok(result.report.text.includes("| Depth | document |"));
    assert.ok(result.report.text.includes("review=required:intent-change"));
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
  });

  it("PL-05: the §5.2 review gate is exact — trigger ⇒ required, none ⇒ no gate", () => {
    const planner = makePlanner();
    for (const trigger of TRIGGER_TYPES) {
      const gated = planner.plan({ ...REQ, trigger });
      assert.strictEqual(gated.ok, true, trigger);
      assert.deepStrictEqual(gated.plan.review, { required: true, trigger });
      assert.ok(gated.report.text.includes(`review=required:${trigger}`));
    }
    const ungated = planner.plan(without(REQ, "trigger"));
    assert.strictEqual(ungated.ok, true, JSON.stringify(ungated));
    assert.deepStrictEqual(ungated.plan.review, { required: false, trigger: null });
    assert.ok(ungated.report.text.includes("review=none"));
    assert.ok(!ungated.report.text.includes("review=required"), "no approval gate is invented");
  });

  it("PL-06: the order question is the request's order — never re-sorted", () => {
    const request = {
      task: "Reorder imports",
      tier: "T1",
      changes: [
        { file: "zeta.mjs", why: "listed first on purpose" },
        { file: "alpha.mjs", why: "listed second on purpose" },
      ],
      verification: ["node --test"],
      risks: ["import order changes load timing"],
    };
    const plan = makePlanner().plan(request).plan;
    assert.deepStrictEqual(
      plan.changes.map((change) => change.file),
      ["zeta.mjs", "alpha.mjs"],
      "array order IS the change order (01 §5.1 question 2)"
    );
  });
});

// ---------------------------------------------------------------------------
describe("Planner fail-closed contract (PL-07 … PL-14)", () => {
  it("PL-07: invalid envelopes fail closed at VALIDATE, before any plan exists", () => {
    const spy = spyReportBus();
    const planner = makePlanner({ reportBus: spy.reportBus });
    const invalid = [
      null,
      "plan",
      [],
      42,
      {},
      { ...REQ, generated_at: "2026-10-05T12:00:00Z" },
      { ...REQ, task: "" },
      { ...REQ, task: "two\nlines" },
      { ...REQ, task: "has|pipe" },
      { ...REQ, tier: 7 },
      { ...REQ, changes: "src/api/users.ts" },
      { ...REQ, changes: [42] },
      { ...REQ, changes: ["src/api/users.ts"] },
      { ...REQ, changes: [{ file: "src/api/users.ts", why: "x", extra: "y" }] },
      { ...REQ, changes: [{ file: "a b.ts", why: "x" }] },
      { ...REQ, changes: [{ file: "../escape.ts", why: "x" }] },
      { ...REQ, verification: "node --test" },
      { ...REQ, verification: [""] },
      { ...REQ, risks: [42] },
      { ...REQ, trigger: "whenever" },
    ];
    for (const request of invalid) {
      const result = planner.plan(request);
      assert.strictEqual(result.ok, false, JSON.stringify(request));
      assert.strictEqual(result.code, "INVALID_REQUEST", JSON.stringify(request));
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "VALIDATE");
      assert.strictEqual(result.error.class, "E-INPUT");
      assert.strictEqual(result.error.code, "INVALID_REQUEST");
      assert.strictEqual(result.plan, null, "no plan exists for an invalid request");
      assert.notStrictEqual(result.report, null, "even a refused attempt is reported");
      assert.ok(validatePlanRequest(request).length > 0, "the validator itself refuses");
    }
    assert.strictEqual(spy.inputs.length, invalid.length, "one report per attempt, no hidden retries");
  });

  it("PL-08: an unknown tier fails closed", () => {
    const result = makePlanner().plan({ ...REQ, tier: "T3" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "INVALID_REQUEST");
    assert.strictEqual(result.stage, "VALIDATE");
    assert.match(result.error.detail, /tier must be one of: T0, T1, T2/);
    assert.strictEqual(result.plan, null);
    assert.notStrictEqual(result.report, null);
  });

  it("PL-09: a T0 request carrying a plan document fails closed (over-planning)", () => {
    const result = makePlanner().plan({ ...REQ, tier: "T0" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "PLAN_INCOMPLETE");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.stage, "VALIDATE");
    assert.strictEqual(result.error.class, "E-VALID");
    assert.match(result.error.detail, /one-sentence intent/);
    assert.strictEqual(result.plan, null);
    assert.ok(result.report.text.includes("| Code | PLAN_INCOMPLETE |"));
  });

  it("PL-10: a T0 request planning more than one file fails closed (01 §3.1)", () => {
    const result = makePlanner().plan({
      task: "Fix two typos",
      tier: "T0",
      changes: [
        { file: "a.md", why: "first typo" },
        { file: "b.md", why: "second typo" },
      ],
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "PLAN_INCOMPLETE");
    assert.match(result.error.detail, /exactly one file/);
    assert.strictEqual(result.plan, null);
  });

  it("PL-11: a T1 plan missing a required question fails closed", () => {
    const planner = makePlanner();
    const noVerification = planner.plan(without(T1_REQ, "verification"));
    assert.strictEqual(noVerification.ok, false);
    assert.strictEqual(noVerification.code, "PLAN_INCOMPLETE");
    assert.match(noVerification.error.detail, /question 3/);
    const noRisks = planner.plan(without(T1_REQ, "risks"));
    assert.strictEqual(noRisks.ok, false);
    assert.strictEqual(noRisks.code, "PLAN_INCOMPLETE");
    assert.match(noRisks.error.detail, /question 4/);
    for (const result of [noVerification, noRisks]) {
      assert.strictEqual(result.stage, "VALIDATE");
      assert.strictEqual(result.plan, null);
      assert.notStrictEqual(result.report, null);
    }
  });

  it("PL-12: a T2 plan missing a required question fails closed (AC-10)", () => {
    const planner = makePlanner();
    const noRisks = planner.plan(without(REQ, "risks"));
    assert.strictEqual(noRisks.ok, false);
    assert.strictEqual(noRisks.code, "PLAN_INCOMPLETE");
    assert.match(noRisks.error.detail, /question 4/);
    const noVerification = planner.plan(without(REQ, "verification"));
    assert.strictEqual(noVerification.ok, false);
    assert.strictEqual(noVerification.code, "PLAN_INCOMPLETE");
    assert.match(noVerification.error.detail, /question 3/);
    const emptyRisks = planner.plan({ ...REQ, risks: [] });
    assert.strictEqual(emptyRisks.ok, false);
    assert.strictEqual(emptyRisks.code, "PLAN_INCOMPLETE");
    assert.match(emptyRisks.error.detail, /question 4/);
    assert.strictEqual(noRisks.plan, null);
  });

  it("PL-13: an approval trigger outside T2 fails closed (01 §5.2)", () => {
    const planner = makePlanner();
    const atT0 = planner.plan({ ...T0_REQ, trigger: "migration" });
    assert.strictEqual(atT0.ok, false);
    assert.strictEqual(atT0.code, "PLAN_INCOMPLETE");
    assert.match(atT0.error.detail, /trigger requires tier T2/);
    const atT1 = planner.plan({ ...T1_REQ, trigger: "architecture" });
    assert.strictEqual(atT1.ok, false);
    assert.strictEqual(atT1.code, "PLAN_INCOMPLETE");
    assert.match(atT1.error.detail, /trigger requires tier T2/);
    assert.strictEqual(atT0.plan, null);
    assert.strictEqual(atT1.plan, null);
  });

  it("PL-14: a report failure propagates and never claims completion", () => {
    const planner = makePlanner({ reportBus: failingReportBus() });
    const result = planner.plan(REQ);
    assert.strictEqual(result.ok, false, "an attempted plan is NOT a completed one without a report");
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null);
    assert.strictEqual(result.error.class, "E-ENV", "the report bus's class is propagated");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), "the underlying attempt is preserved");
    assert.notStrictEqual(result.plan, null, "the composed attempt is preserved for diagnosis");
    // Report failure also wins over an earlier refusal (REPORT is terminal).
    const early = planner.plan({ ...REQ, tier: "T3" });
    assert.strictEqual(early.code, "REPORT_FAILED");
    assert.strictEqual(early.stage, "REPORT");
    assert.strictEqual(early.plan, null);
  });
});

// ---------------------------------------------------------------------------
describe("Planner integrations (PL-15 … PL-17)", () => {
  it("PL-15: Planner → Report Bus — a real completion input, built by the real bus", () => {
    const spy = spyReportBus();
    const planner = makePlanner({ reportBus: spy.reportBus });
    const success = planner.plan(REQ);
    assert.strictEqual(success.ok, true);
    assert.strictEqual(spy.inputs.length, 1);
    const captured = spy.inputs[0];
    assert.strictEqual(captured.type, "completion");
    assert.deepStrictEqual(
      captured.sections.map((section) => section.id),
      ["summary", "results", "phase-ledger", "evidence", "remaining-issues"]
    );
    const row = captured.sections.find((s) => s.id === "results").rows[0];
    assert.strictEqual(row.module, "planner");
    assert.strictEqual(row.command, "planner.plan");
    assert.strictEqual(row.status, "success");
    assert.deepStrictEqual(row.assumptions, []);
    assert.deepStrictEqual(row.remaining_issues, []);
    const summary = captured.sections.find((s) => s.id === "summary").rows;
    assert.deepStrictEqual(summary.find((r) => r.name === "Code"), { name: "Code", value: "COMPLETED" });
    assert.deepStrictEqual(summary.find((r) => r.name === "Phase"), { name: "Phase", value: "PLAN" });
    // The input the orchestrator produced is contract-valid on its own.
    const rebuilt = createReportBus().build(captured);
    assert.strictEqual(rebuilt.ok, true, JSON.stringify(rebuilt.violations));
    assert.strictEqual(success.report.sha256, sha256(success.report.text));
    // A refused attempt reports through the same single format.
    planner.plan({ ...REQ, tier: "T3" });
    const refusalRow = spy.inputs[1].sections.find((s) => s.id === "results").rows[0];
    assert.strictEqual(refusalRow.status, "failed");
    assert.strictEqual(refusalRow.remaining_issues.length, 1);
  });

  it("PL-16: the manifest honors the Module Registry contract (PLAN-only gate)", () => {
    const registry = makeRegistry();
    const validation = registry.validateAll();
    assert.strictEqual(validation.ok, true, JSON.stringify(validation));
    assert.strictEqual(registry.enable("planner").ok, true);
    const resolved = registry.resolveCapability("planner:plan");
    assert.strictEqual(resolved.ok, true, JSON.stringify(resolved));
    assert.strictEqual(resolved.module, "planner");
    // The planner declares the PLAN phase — the INVOKE gate holds it there.
    const invoked = registry.canInvoke("planner", { phase: "PLAN", tools: [] });
    assert.strictEqual(invoked.ok, true, JSON.stringify(invoked));
    assert.strictEqual(invoked.code, "MR_OK");
    const wrongPhase = registry.canInvoke("planner", { phase: "RUN" });
    assert.strictEqual(wrongPhase.ok, false);
    assert.strictEqual(wrongPhase.code, "PHASE_NOT_DECLARED");
    assert.strictEqual(wrongPhase.error.class, "E-CONFLICT");
    assert.strictEqual(wrongPhase.error.detail, "RUN not in [PLAN]");
  });

  it("PL-17: the public surface is exactly plan(); sources honor the boundary", () => {
    const planner = makePlanner();
    assert.deepStrictEqual(Object.keys(planner), ["plan"], "the public surface is exactly plan()");
    assert.ok(Object.isFrozen(planner));
    assert.strictEqual(typeof planner.plan, "function");
    // Source-level: the planner imports only its own files and touches no
    // executors, file system, or other module (02 §3 rules 1/3).
    const files = [path.join(PLANNER_DIR, "index.mjs")];
    for (const name of readdirSync(path.join(PLANNER_DIR, "src")).sort()) {
      if (name.endsWith(".mjs")) files.push(path.join(PLANNER_DIR, "src", name));
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
      assert.ok(!/modules\/(hotkeys|tool-bus|module-registry|report-bus|agent)/.test(text), `${rel}: no module paths`);
    }
    // Exactly one report build per attempt — success and every refusal —
    // so there is no hidden retry or second report surface.
    const spy = spyReportBus();
    const counted = makePlanner({ reportBus: spy.reportBus });
    counted.plan(REQ);
    counted.plan(null);
    counted.plan({ ...REQ, tier: "T3" });
    counted.plan({ ...REQ, tier: "T0" });
    assert.strictEqual(spy.inputs.length, 4);
  });
});

// ---------------------------------------------------------------------------
describe("Planner security & determinism (PL-18 … PL-20)", () => {
  it("PL-18: no fabricated completion — only a COMPLETED result reads as success", () => {
    const planner = makePlanner();
    const success = planner.plan(REQ);
    assert.ok(success.report.text.includes("| Status | COMPLETED |"));
    for (const [request, code] of [
      [null, "INVALID_REQUEST"],
      [{ ...REQ, tier: "T3" }, "INVALID_REQUEST"],
      [{ ...REQ, tier: "T0" }, "PLAN_INCOMPLETE"],
      [without(REQ, "risks"), "PLAN_INCOMPLETE"],
    ]) {
      const refused = planner.plan(request);
      assert.strictEqual(refused.ok, false);
      assert.strictEqual(refused.code, code);
      assert.strictEqual(refused.plan, null, "a refusal never produces a plan");
      assert.ok(refused.report, "a refusal is still reported");
      assert.ok(!refused.report.text.includes("| Status | COMPLETED |"));
      assert.ok(refused.report.text.includes("| Status | REFUSED |"));
    }
    // A failed report emits NOTHING — the claim cannot outlive the truth.
    const broken = makePlanner({ reportBus: failingReportBus() }).plan(REQ);
    assert.strictEqual(broken.report, null);
    assert.strictEqual(broken.ok, false);
  });

  it("PL-19: identical requests against identical state produce identical results", () => {
    const one = makePlanner().plan(REQ);
    const two = makePlanner().plan(REQ);
    assert.deepStrictEqual(one, two, "two runs are identical result-for-result");
    assert.strictEqual(one.report.text, two.report.text, "byte-identical report text");
    assert.strictEqual(one.report.sha256, two.report.sha256, "identical report hash");
    assert.strictEqual(one.report.sha256, sha256(one.report.text));
    // A refusal is just as deterministic as a success.
    const refusedRequest = { ...REQ, tier: "T3" };
    const r1 = makePlanner().plan(refusedRequest);
    const r2 = makePlanner().plan(refusedRequest);
    assert.deepStrictEqual(r1, r2);
    assert.strictEqual(r1.report.sha256, r2.report.sha256);
    // No volatile data in any report, and none in any planner source.
    for (const report of [one.report, r1.report]) {
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(report.text), "no timestamps");
      assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(report.text), "no uuids");
      assert.ok(!/\/(home|Users|tmp)\//.test(report.text), "no machine paths");
    }
    const sources = [path.join(PLANNER_DIR, "index.mjs")];
    for (const name of readdirSync(path.join(PLANNER_DIR, "src")).sort()) {
      if (name.endsWith(".mjs")) sources.push(path.join(PLANNER_DIR, "src", name));
    }
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      assert.ok(!/Date\.now|new Date|Math\.random|process\.pid|process\.env|hrtime/.test(text), `${file}: no volatile APIs`);
    }
  });

  it("PL-20: the report always mirrors the result — code, status, stage, issue", () => {
    const planner = makePlanner();
    const attempts = [
      REQ,
      null,
      { ...REQ, tier: "T3" },
      { ...REQ, tier: "T0" },
      without(REQ, "verification"),
      without(T1_REQ, "risks"),
    ];
    for (const request of attempts) {
      const result = planner.plan(request);
      const text = result.report.text;
      assert.ok(text.includes(`| Code | ${result.code} |`), result.code);
      assert.ok(text.includes(`| Status | ${result.status} |`), result.status);
      assert.ok(text.includes(`| Stage | ${result.stage} |`), result.stage);
      if (result.ok) {
        assert.ok(!text.includes("Remaining issues\n\n| 1"), "no issues on success");
      } else {
        assert.ok(text.includes(`${result.code}: ${result.error.detail}`), "the refusal reason is in remaining issues");
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe("Planner mutations (PL-M1 … PL-M10)", () => {
  const MUTATIONS = Object.freeze([
    ["PL-M1", "mut_plan_unknown_tier.json", "INVALID_REQUEST", "E-INPUT", "tier must be one of"],
    ["PL-M2", "mut_plan_extra_field.json", "INVALID_REQUEST", "E-INPUT", 'unexpected request field "generated_at"'],
    ["PL-M3", "mut_plan_t0_overplan.json", "PLAN_INCOMPLETE", "E-VALID", "one-sentence intent"],
    ["PL-M4", "mut_plan_missing_risks.json", "PLAN_INCOMPLETE", "E-VALID", "question 4"],
    ["PL-M5", "mut_plan_missing_verification.json", "PLAN_INCOMPLETE", "E-VALID", "question 3"],
    ["PL-M6", "mut_plan_trigger_t1.json", "PLAN_INCOMPLETE", "E-VALID", "trigger requires tier T2"],
    ["PL-M7", "mut_plan_bad_path.json", "INVALID_REQUEST", "E-INPUT", "relative path"],
    ["PL-M8", "mut_plan_empty_changes.json", "PLAN_INCOMPLETE", "E-VALID", "question 1"],
    ["PL-M9", "mut_plan_multiline_task.json", "INVALID_REQUEST", "E-INPUT", "single-line string"],
  ]);

  for (const [id, file, code, klass, detail] of MUTATIONS) {
    it(`${id}: ${file} fails closed with ${code}`, () => {
      const input = fixture(file); // asserted byte-different from pristine
      const result = makePlanner().plan(input);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "VALIDATE");
      assert.strictEqual(result.error.code, code);
      assert.strictEqual(result.error.class, klass);
      assert.ok(PLANNER_ERROR_CLASSES.includes(result.error.class), result.error.class);
      assert.ok(CORE_ERROR_CLASSES.includes(result.error.class));
      assert.match(result.error.detail, new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.strictEqual(result.plan, null, "a refused mutation never produces a plan");
      assert.notStrictEqual(result.report, null, "every refusal still produces its report");
      assert.strictEqual(result.report.sha256, sha256(result.report.text));
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), "no mutation may ever read as completion");
      assert.ok(validatePlanRequest(input).length > 0, "the validator itself refuses the mutation");
      assert.ok(normalizePlanRequest(input) !== null || typeof input !== "object", "echo stays reportable");
    });
  }

  it("PL-M10: a corrupted report input fails closed with REPORT_FAILED", () => {
    const fixtureText = readFileSync(FIX + "mut_plan_report_input.json", "utf8");
    assert.notStrictEqual(fixtureText, PRISTINE, "byte-different from the pristine request");
    // Capture the pristine report input from a successful control run.
    const realBus = createReportBus();
    let captured = null;
    const control = makePlanner({
      reportBus: {
        build(input) {
          captured = input;
          return realBus.build(input);
        },
      },
    });
    const controlRun = control.plan(JSON.parse(PRISTINE));
    assert.strictEqual(controlRun.ok, true);
    assert.notStrictEqual(captured, null);
    // The mutation is a real mutation of the pristine report input:
    // byte-different AND content-different.
    assert.notStrictEqual(fixtureText, JSON.stringify(captured, null, 2));
    assert.notDeepStrictEqual(JSON.parse(fixtureText), captured);
    // Feed the corrupted document through the report boundary: the real bus
    // refuses it, and the planner must not claim completion.
    const corrupted = makePlanner({
      reportBus: { build: () => realBus.build(JSON.parse(fixtureText)) },
    });
    const result = corrupted.plan(JSON.parse(PRISTINE));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null, "no report artifact is emitted for corrupted input");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), "the underlying attempt is preserved");
    assert.notStrictEqual(result.plan, null, "the composed plan is preserved — completion is not claimed");
  });
});
