// Grimoire v3 — Agent Orchestrator suite (Task 10).
//
// AO coverage map (documented in docs/v3/05-acceptance-tests.md, Group O,
// and docs/v3/18-agent-orchestrator.md §15 Tests):
//   AO-01  entry point, manifest validity, config, result-code table  — block 1
//   AO-02  valid request resolves (plan + phase contrast)
//   AO-03  enabled module resolves
//   AO-04  available capability resolves (ambiguity contrast)
//   AO-05  valid tool dependency reaches execution
//   AO-06  successful execution reaches REPORT and COMPLETE
//   AO-07  invalid request fails closed                                — block 2
//   AO-08  unknown module fails closed
//   AO-09  disabled module fails closed
//   AO-10  unknown / unpairable / ambiguous capability fails closed
//   AO-11  unavailable tool fails closed
//   AO-12  blocked tool fails closed
//   AO-13  missing dependency fails closed
//   AO-14  invalid capability fails closed
//   AO-15  runtime refusal propagates
//   AO-16  handler failure propagates
//   AO-17  report failure propagates (no fabricated completion)
//   AO-18  Agent → Module Registry (public contract only + belts)      — block 3
//   AO-19  Agent → Hotkey Runtime (single call, correct input)
//   AO-20  Agent → Tool Bus (per-tool checks, zero on early refusal)
//   AO-21  Agent → Report Bus (real completion input, real build)
//   AO-22  direct handler bypass impossible via the public surface     — block 4
//   AO-23  undeclared capability cannot execute
//   AO-24  unavailable tool cannot become success
//   AO-25  disabled module cannot execute
//   AO-26  determinism: identical results, identical report hashes
//   AO-M1…M10  ten fail-closed mutations (byte-different fixtures)
//
// Mutation fixtures are asserted byte-different from the pristine request
// (test/_fixtures/agent_request.json) before they are trusted; M10's
// corrupted report input is asserted byte-different AND content-different
// from the pristine report input captured on a successful run.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createAgentOrchestrator,
  RESULT_CODES,
  LIFECYCLE_STAGES,
  validateRequest,
  OPERATION_KINDS,
  EXECUTION_CAPABILITY,
  EIGHT_LOOP_PHASES,
  AGENT_ERROR_CLASSES,
  CORE_ERROR_CLASSES,
} from "../modules/agent/index.mjs";
import {
  createModuleRegistry,
  EIGHT_LOOP_PHASES as REGISTRY_PHASES,
} from "../modules/module-registry/index.mjs";
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
const AGENT_DIR = path.join(ROOT, "modules/agent");
const PRISTINE = readFileSync(path.join(FIX, "agent_request.json"), "utf8");
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

// Standard composition: all four injected contracts, hotkeys enabled.
// The registry is ALWAYS constructed against a healthy bus: a spy/fault bus
// is injected into the orchestrator only. Registry tool-duty runs at
// construction (register/enable validate requires.tools), so handing it the
// spy would inflate preflight counts and a fault bus would break registration
// before any orchestration could be tested.
function makeAgent({ enable = ["hotkeys"], toolBus = makeBus(), reportBus = createReportBus(), runtime = makeRuntime(), registry } = {}) {
  return createAgentOrchestrator({
    registry: registry ?? makeRegistry({ enable, bus: makeBus() }),
    runtime,
    toolBus,
    reportBus,
  });
}

const faultBus = (code) => ({ check: () => ({ ok: false, code }) });

function spyRuntime() {
  const real = makeRuntime();
  const calls = [];
  return {
    calls,
    real,
    runtime: {
      executeHotkey(input) {
        calls.push(input);
        return real.executeHotkey(input);
      },
    },
  };
}

// ---------------------------------------------------------------------------
describe("Agent contract (AO-01 … AO-06)", () => {
  it("AO-01: entry point, manifest, configuration, and result-code table", async () => {
    const entry = await import("../modules/agent/index.mjs");
    for (const name of [
      "createAgentOrchestrator", "RESULT_CODES", "LIFECYCLE_STAGES",
      "validateRequest", "OPERATION_KINDS", "EXECUTION_CAPABILITY",
      "AGENT_ERROR_CLASSES", "CORE_ERROR_CLASSES", "EIGHT_LOOP_PHASES",
    ]) {
      assert.ok(name in entry, `entry must export ${name}`);
    }
    // The entry reaches only its own files — no node:, no lateral modules.
    const source = readFileSync(path.join(AGENT_DIR, "index.mjs"), "utf8");
    for (const [, spec] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(spec.startsWith("./"), `entry may only import its own files (saw "${spec}")`);
    }

    // Manifest under the established 03 §2 contract — all five real
    // manifests register and validate together.
    const registry = createModuleRegistry({ toolBus: makeBus() });
    for (const manifest of MANIFESTS) {
      assert.strictEqual(registry.register(manifest.text).ok, true, manifest.id);
    }
    const validation = registry.validateAll();
    assert.strictEqual(validation.ok, true, JSON.stringify(validation));
    const descriptor = registry.describe("agent").descriptor;
    assert.deepStrictEqual(descriptor.phases, ["RUN", "TEST", "SHIP"]);
    assert.deepStrictEqual(descriptor.requires, { tools: [] });
    assert.deepStrictEqual(descriptor.provides, ["agent:orchestrate"]);
    assert.deepStrictEqual(descriptor.consumes, [
      "module-registry:resolve", "toolbus:capabilities", "hotkeys:execute", "report-bus:build",
    ]);
    assert.deepStrictEqual(descriptor.entry, "modules/agent/index.mjs");
    assert.deepStrictEqual([...descriptor.errors].sort(), [...AGENT_ERROR_CLASSES].sort());
    for (const klass of AGENT_ERROR_CLASSES) assert.ok(CORE_ERROR_CLASSES.includes(klass), klass);
    assert.deepStrictEqual([...EIGHT_LOOP_PHASES], [...REGISTRY_PHASES]);

    // Configuration fails closed at construction (01 §13.5).
    const good = {
      registry: makeRegistry({}),
      runtime: makeRuntime(),
      toolBus: makeBus(),
      reportBus: createReportBus(),
    };
    for (const missing of ["registry", "runtime", "toolBus", "reportBus"]) {
      const partial = { ...good };
      delete partial[missing];
      assert.throws(() => createAgentOrchestrator(partial), (error) => error.code === "E_INPUT_INVALID_ORCHESTRATOR_CONFIG");
    }
    assert.throws(() => createAgentOrchestrator({}), (error) => error.code === "E_INPUT_INVALID_ORCHESTRATOR_CONFIG");

    // Result-code table: exactly twelve codes, one success, three classified.
    assert.deepStrictEqual(Object.keys(RESULT_CODES), [
      "COMPLETED", "INVALID_REQUEST", "MODULE_NOT_FOUND", "MODULE_DISABLED",
      "CAPABILITY_UNAVAILABLE", "CAPABILITY_AMBIGUOUS", "PHASE_NOT_DECLARED",
      "MANIFEST_INVALID", "TOOL_REQUIRED", "EXECUTION_REFUSED", "EXECUTION_FAILED",
      "REPORT_FAILED",
    ]);
    assert.strictEqual(RESULT_CODES.COMPLETED, null);
    const classified = Object.entries(RESULT_CODES)
      .filter(([, klass]) => klass === "classified")
      .map(([code]) => code);
    assert.deepStrictEqual(classified, ["EXECUTION_REFUSED", "EXECUTION_FAILED", "REPORT_FAILED"]);
    for (const [code, klass] of Object.entries(RESULT_CODES)) {
      if (klass === null) continue;
      if (klass === "classified") continue;
      assert.ok(AGENT_ERROR_CLASSES.includes(klass), `${code} → ${klass}`);
    }
    // Lifecycle vocabulary is exactly the directive's finite model.
    assert.deepStrictEqual([...LIFECYCLE_STAGES], ["RECEIVE", "VALIDATE", "RESOLVE", "PREFLIGHT", "EXECUTE", "REPORT", "COMPLETE"]);
    assert.deepStrictEqual(Object.keys(OPERATION_KINDS), ["hotkey"]);
    assert.strictEqual(EXECUTION_CAPABILITY, "hotkeys:execute");
  });

  it("AO-02: a valid request resolves into an exact execution plan", () => {
    const agent = makeAgent();
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(result.code, "COMPLETED");
    assert.deepStrictEqual(result.plan, {
      module: "hotkeys",
      capability: "hotkeys:execute",
      phase: "RUN",
      tools: ["files"],
    });
    const text = result.report.text;
    assert.ok(text.includes("registry.has(hotkeys) → true"));
    assert.ok(text.includes("registry.isEnabled(hotkeys) → true"));
    assert.ok(text.includes("describe(hotkeys).provides.includes(hotkeys:execute) → true"));
    assert.ok(text.includes("registry.resolveCapability(hotkeys:execute) → hotkeys"));
    assert.ok(text.includes("registry.canInvoke(hotkeys, RUN) → MR_OK"));
    // Phase contrast: DEBUG is one of the eight but not declared by hotkeys.
    const wrongPhase = agent.run({ ...REQ, phase: "DEBUG" });
    assert.strictEqual(wrongPhase.ok, false);
    assert.strictEqual(wrongPhase.code, "PHASE_NOT_DECLARED");
    assert.strictEqual(wrongPhase.stage, "RESOLVE");
    assert.strictEqual(wrongPhase.plan, null);
    assert.notStrictEqual(wrongPhase.report, null, "refusals are still reported");
  });

  it("AO-03: an enabled module resolves (enablement is observed, never assumed)", () => {
    const agent = makeAgent({ enable: ["hotkeys"] });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true);
    assert.ok(result.report.text.includes("registry.isEnabled(hotkeys) → true"));
    assert.ok(result.report.text.includes("PREFLIGHT: done (1 tool)"));
    // Same request against a registered-but-disabled module stops at RESOLVE.
    const disabled = makeAgent({ enable: [] });
    const refused = disabled.run(REQ);
    assert.strictEqual(refused.code, "MODULE_DISABLED");
    assert.strictEqual(refused.stage, "RESOLVE");
    assert.strictEqual(refused.plan, null);
  });

  it("AO-04: an available capability resolves; two providers are never guessed", () => {
    const agent = makeAgent({ enable: ["hotkeys"] });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true);
    assert.ok(result.report.text.includes("registry.resolveCapability(hotkeys:execute) → hotkeys"));
    // A second enabled module declaring the same capability ⇒ AMBIGUOUS.
    const registry = makeRegistry({ enable: ["hotkeys"] });
    const spoof = MANIFESTS.find((m) => m.id === "hotkeys").text
      .replace('id: "hotkeys"', 'id: "spoof-module"');
    assert.strictEqual(registry.register(spoof).ok, true);
    assert.strictEqual(registry.enable("spoof-module").ok, true);
    const ambiguous = createAgentOrchestrator({
      registry, runtime: makeRuntime(), toolBus: makeBus(), reportBus: createReportBus(),
    }).run(REQ);
    assert.strictEqual(ambiguous.ok, false);
    assert.strictEqual(ambiguous.code, "CAPABILITY_AMBIGUOUS");
    assert.strictEqual(ambiguous.error.class, "E-CONFLICT");
    assert.ok(ambiguous.error.detail.includes("spoof-module"));
    assert.strictEqual(ambiguous.plan, null);
  });

  it("AO-05: a valid tool dependency reaches execution through Tool Bus preflight", () => {
    const bus = makeBus();
    let checks = 0;
    const spyBus = {
      check(token) {
        checks += 1;
        return bus.check(token);
      },
    };
    const agent = makeAgent({ toolBus: spyBus });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    assert.strictEqual(checks, 1, "one declared tool (files) is checked exactly once");
    assert.deepStrictEqual(result.preflight, { ok: true, tools: [{ tool: "files", ok: true, code: "TB_OK" }] });
    assert.strictEqual(result.execution.executed, true);
    assert.ok(result.report.text.includes("toolBus.check(files) → TB_OK"));
  });

  it("AO-06: successful execution reaches REPORT and COMPLETE", () => {
    const agent = makeAgent();
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.strictEqual(result.error, null);
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
    const text = result.report.text;
    assert.match(text, /^# Grimoire v3 — Completion Report\n/);
    assert.ok(text.includes("| Status | COMPLETED |"));
    assert.ok(text.includes("| hotkeys | agent.orchestrate | success |"));
    assert.ok(text.includes("runtime.executeHotkey(...) → OK_EXECUTED (executed=true)"));
    assert.ok(text.includes("REPORT: done (report-bus)"));
    assert.ok(text.includes("COMPLETE: done"));
    assert.ok(text.includes("| none | — |"), "remaining issues are empty and declared so");
  });
});

// ---------------------------------------------------------------------------
describe("Agent fail-closed contract (AO-07 … AO-17)", () => {
  it("AO-07: invalid requests fail closed at VALIDATE, before anything runs", () => {
    const spy = spyRuntime();
    const agent = makeAgent({ runtime: spy.runtime });
    const invalid = [
      null,
      "request",
      [],
      42,
      {},
      { ...REQ, generated_at: "2026-10-05T12:00:00Z" },
      { ...REQ, kind: "chat" },
      { ...REQ, module: 7 },
      { ...REQ, module: "hotkeys\n" },
      { ...REQ, phase: "LAUNCH" },
      { ...REQ, target: { key: "R", command: "grimoire.key.R" } },
      { ...REQ, target: {} },
      { ...REQ, target: "R" },
      { ...REQ, target: { key: "R", args: {} } },
      { ...REQ, args: "nope" },
    ];
    for (const request of invalid) {
      const result = agent.run(request);
      assert.strictEqual(result.ok, false, JSON.stringify(request));
      assert.strictEqual(result.code, "INVALID_REQUEST", JSON.stringify(request));
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.stage, "VALIDATE");
      assert.strictEqual(result.plan, null);
      assert.strictEqual(result.preflight, null);
      assert.strictEqual(result.execution, null);
      assert.notStrictEqual(result.report, null, "even a refused attempt is reported");
      assert.strictEqual(result.error.class, "E-INPUT");
      assert.ok(validateRequest(request).length > 0, "the validator itself refuses");
    }
    assert.strictEqual(spy.calls.length, 0, "no invalid request ever reaches the runtime");
  });

  it("AO-08: an unknown module fails closed", () => {
    const spy = spyRuntime();
    const agent = makeAgent({ runtime: spy.runtime });
    const result = agent.run({ ...REQ, module: "ghost-module" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "MODULE_NOT_FOUND");
    assert.strictEqual(result.stage, "RESOLVE");
    assert.strictEqual(result.error.class, "E-INPUT");
    assert.strictEqual(result.error.detail, "ghost-module");
    assert.strictEqual(result.plan, null);
    assert.notStrictEqual(result.report, null);
    assert.ok(result.report.text.includes("registry.has(ghost-module) → false"));
    assert.strictEqual(spy.calls.length, 0);
  });

  it("AO-09: a disabled module fails closed", () => {
    const spy = spyRuntime();
    const agent = makeAgent({ enable: ["hotkeys"], runtime: spy.runtime });
    const result = agent.run({ ...REQ, module: "tool-bus", capability: "toolbus:capabilities" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "MODULE_DISABLED");
    assert.strictEqual(result.stage, "RESOLVE");
    assert.strictEqual(result.error.class, "E-ENV");
    assert.strictEqual(result.plan, null);
    assert.ok(result.report.text.includes("registry.isEnabled(tool-bus) → false"));
    assert.strictEqual(spy.calls.length, 0);
  });

  it("AO-10: unknown, unpairable, and ambiguous capabilities fail closed", () => {
    const spy = spyRuntime();
    const base = makeAgent({ enable: ["hotkeys"], runtime: spy.runtime });
    // Unknown: the named module does not provide it.
    const unknown = base.run({ ...REQ, capability: "ghost:capability" });
    assert.strictEqual(unknown.code, "CAPABILITY_UNAVAILABLE");
    assert.strictEqual(unknown.stage, "RESOLVE");
    assert.match(unknown.error.detail, /hotkeys does not provide ghost:capability/);
    // Unpairable: a real capability, but not the one a hotkey operation executes.
    const paired = makeAgent({ enable: ["hotkeys", "module-registry"], runtime: spy.runtime })
      .run({ ...REQ, module: "module-registry", capability: "module-registry:validate" });
    assert.strictEqual(paired.code, "CAPABILITY_UNAVAILABLE");
    assert.match(paired.error.detail, /operation hotkey executes hotkeys:execute only/);
    // Ambiguous: two enabled providers — never a guessed side.
    const registry = makeRegistry({ enable: ["hotkeys"] });
    const spoof = MANIFESTS.find((m) => m.id === "hotkeys").text
      .replace('id: "hotkeys"', 'id: "spoof-module"');
    registry.register(spoof);
    registry.enable("spoof-module");
    const ambiguous = createAgentOrchestrator({
      registry, runtime: spy.runtime, toolBus: makeBus(), reportBus: createReportBus(),
    }).run(REQ);
    assert.strictEqual(ambiguous.code, "CAPABILITY_AMBIGUOUS");
    assert.strictEqual(ambiguous.error.class, "E-CONFLICT");
    for (const result of [unknown, paired, ambiguous]) {
      assert.strictEqual(result.ok, false);
      assert.notStrictEqual(result.report, null);
      assert.strictEqual(result.plan, null);
    }
    assert.strictEqual(spy.calls.length, 0, "capability refusals never execute");
  });

  for (const [name, code, fault] of [
    ["AO-11: an unavailable tool fails closed", "TOOL_UNAVAILABLE", faultBus("TOOL_UNAVAILABLE")],
    ["AO-12: a blocked tool fails closed", "TOOL_BLOCKED", faultBus("TOOL_BLOCKED")],
    ["AO-13: a missing dependency fails closed", "DEPENDENCY_MISSING", faultBus("DEPENDENCY_MISSING")],
  ]) {
    it(name, () => {
      const spy = spyRuntime();
      const agent = makeAgent({ toolBus: fault, runtime: spy.runtime });
      const result = agent.run(REQ);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, "TOOL_REQUIRED");
      assert.strictEqual(result.stage, "PREFLIGHT");
      assert.strictEqual(result.status, "REFUSED");
      assert.strictEqual(result.error.class, "E-TOOL");
      assert.match(result.error.detail, new RegExp(`files: ${code}`));
      assert.strictEqual(result.preflight.ok, false);
      assert.strictEqual(result.execution, null);
      assert.notStrictEqual(result.report, null);
      assert.ok(result.report.text.includes(`toolBus.check(files) → ${code}`));
      assert.strictEqual(spy.calls.length, 0, "a refused tool never reaches execution");
    });
  }

  it("AO-14: an invalid capability token fails closed at VALIDATE", () => {
    const agent = makeAgent();
    const result = agent.run({ ...REQ, capability: "not-a-capability" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "INVALID_REQUEST");
    assert.strictEqual(result.stage, "VALIDATE");
    assert.match(result.error.detail, /namespace:name/);
    assert.notStrictEqual(result.report, null);
  });

  it("AO-15: a runtime refusal propagates as EXECUTION_REFUSED", () => {
    const agent = makeAgent();
    const result = agent.run({ ...REQ, target: { key: "GHOST" } });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "EXECUTION_REFUSED");
    assert.strictEqual(result.stage, "EXECUTE");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.error.class, "E-INPUT", "the runtime's class is propagated, not invented");
    assert.ok(result.error.detail.includes("E_INPUT_UNKNOWN_KEY"));
    assert.ok(result.execution, "the runtime result is attached for diagnosis");
    assert.strictEqual(result.execution.executed, false);
    assert.notStrictEqual(result.report, null);
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
  });

  it("AO-16: a handler failure propagates as EXECUTION_FAILED", () => {
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
    const agent = makeAgent({ runtime: throwing });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "EXECUTION_FAILED");
    assert.strictEqual(result.stage, "EXECUTE");
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual(result.error.class, "E-UNKNOWN", "classified from the runtime's handler failure");
    // The runtime classifies handler exceptions as E_UNKNOWN_EXCEPTION with
    // its own neutral message (the thrown message never leaks upward), so
    // the propagated detail is asserted against the runtime's real shape.
    assert.ok(result.error.detail.includes("E_UNKNOWN_EXCEPTION"), result.error.detail);
    assert.ok(result.error.detail.includes("unclassified failure"), result.error.detail);
    assert.strictEqual(result.execution.executed, false);
    assert.notStrictEqual(result.report, null);
    assert.ok(result.report.text.includes("EXECUTE: failed (EXECUTION_FAILED)"));
  });

  it("AO-17: a report failure propagates and never claims completion", () => {
    const failingReportBus = {
      build: () => ({
        ok: false,
        code: "DEPENDENCY_ERROR",
        error: { class: "E-ENV", code: "DEPENDENCY_ERROR", message: "refused", detail: "corrupt row" },
        violations: [{ code: "DEPENDENCY_ERROR", detail: "corrupt row" }],
      }),
    };
    const agent = makeAgent({ reportBus: failingReportBus });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, false, "an executed request is NOT a completed one without a report");
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null);
    assert.strictEqual(result.error.class, "E-ENV", "the report bus's class is propagated");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), "the underlying attempt is preserved");
    assert.strictEqual(result.execution.executed, true, "execution really happened — and still no completion");
    // Report failure also wins over an earlier refusal (REPORT is terminal).
    const early = agent.run({ ...REQ, module: "ghost-module" });
    assert.strictEqual(early.code, "REPORT_FAILED");
    assert.strictEqual(early.stage, "REPORT");
  });
});

// ---------------------------------------------------------------------------
describe("Agent integrations (AO-18 … AO-21)", () => {
  it("AO-18: Agent → Module Registry uses only the public contract (with belts)", () => {
    const real = makeRegistry({ enable: ["hotkeys"] });
    const accessed = new Set();
    const proxied = new Proxy(real, {
      get(target, property, receiver) {
        if (typeof property === "string") accessed.add(property);
        return Reflect.get(target, property, receiver);
      },
    });
    const spy = spyRuntime();
    const agent = createAgentOrchestrator({
      registry: proxied, runtime: spy.runtime, toolBus: makeBus(), reportBus: createReportBus(),
    });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    const allowed = new Set(["has", "isEnabled", "describe", "resolveCapability", "canInvoke"]);
    for (const property of accessed) {
      assert.ok(allowed.has(property), `orchestrator touched non-contract property "${property}"`);
    }
    assert.ok(spy.calls.length === 1);

    // Belt translations: a registry that refuses in an unexpected place is
    // still mapped to the orchestrator's vocabulary, never swallowed.
    for (const [canInvokeCode, expected] of [
      ["MANIFEST_INVALID", "MANIFEST_INVALID"],
      ["TOOL_UNAVAILABLE", "TOOL_REQUIRED"],
      ["INVALID_INVOCATION", "INVALID_REQUEST"],
      ["MODULE_NOT_ENABLED", "MODULE_DISABLED"],
    ]) {
      const fake = {
        has: () => true,
        isEnabled: () => true,
        describe: () => ({ ok: true, descriptor: { provides: ["hotkeys:execute"], requires: { tools: ["files"] } } }),
        resolveCapability: () => ({ ok: true, module: "hotkeys", modules: ["hotkeys"] }),
        canInvoke: () => ({ ok: false, code: canInvokeCode, error: { class: "E-VALID", code: canInvokeCode, message: "m", detail: "belt" } }),
      };
      const belted = createAgentOrchestrator({
        registry: fake, runtime: spy.runtime, toolBus: makeBus(), reportBus: createReportBus(),
      }).run(REQ);
      assert.strictEqual(belted.ok, false, canInvokeCode);
      assert.strictEqual(belted.code, expected, canInvokeCode);
      assert.strictEqual(belted.stage, "RESOLVE");
      assert.strictEqual(belted.plan, null);
    }
    assert.strictEqual(spy.calls.length, 1, "belt refusals never execute");
  });

  it("AO-19: Agent → Hotkey Runtime — one call, exact input, none on refusal", () => {
    const happy = spyRuntime();
    const withArgs = spyRuntime();
    const refusals = spyRuntime();
    const agentHappy = makeAgent({ runtime: happy.runtime });
    const agentArgs = makeAgent({ runtime: withArgs.runtime });
    const agentRefused = makeAgent({ runtime: refusals.runtime });

    const result = agentHappy.run(REQ);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(happy.calls.length, 1);
    assert.deepStrictEqual(happy.calls[0], { key: "R" }, "the exact target reaches the runtime — no transformation");

    const argsRun = agentArgs.run({ ...REQ, args: {} });
    assert.strictEqual(argsRun.ok, true, JSON.stringify(argsRun));
    assert.strictEqual(withArgs.calls.length, 1);
    assert.deepStrictEqual(withArgs.calls[0], { key: "R", args: {} }, "args pass through untouched");

    for (const request of [
      { ...REQ, module: "ghost-module" },
      { ...REQ, capability: "ghost:capability" },
      null,
    ]) {
      agentRefused.run(request);
    }
    assert.strictEqual(refusals.calls.length, 0, "no gate refusal ever invokes the runtime");
  });

  it("AO-20: Agent → Tool Bus — one check per declared tool, zero when resolution fails", () => {
    const bus = makeBus();
    const calls = [];
    const spyBus = {
      check(token) {
        calls.push(token);
        return bus.check(token);
      },
    };
    const agent = makeAgent({ toolBus: spyBus });
    agent.run(REQ);
    assert.deepStrictEqual(calls, ["files"]);
    calls.length = 0;
    agent.run({ ...REQ, module: "ghost-module" });
    assert.deepStrictEqual(calls, [], "resolution failure needs no tool checks");
    agent.run(null);
    assert.deepStrictEqual(calls, [], "invalid request needs no tool checks");
    // The Tool Bus stays authoritative: its refusal is never reinterpreted.
    const faulted = makeAgent({ toolBus: { ...spyBus, check: () => ({ ok: false, code: "TOOL_BLOCKED" }) } });
    const refused = faulted.run(REQ);
    assert.strictEqual(refused.code, "TOOL_REQUIRED");
    assert.strictEqual(refused.ok, false);
  });

  it("AO-21: Agent → Report Bus — a real completion input, built by the real bus", () => {
    const realBus = createReportBus();
    let captured = null;
    const spyBus = {
      build(input) {
        captured = input;
        return realBus.build(input);
      },
    };
    const agent = makeAgent({ reportBus: spyBus });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, true);
    assert.notStrictEqual(captured, null);
    assert.strictEqual(captured.type, "completion");
    assert.deepStrictEqual(
      captured.sections.map((section) => section.id),
      ["summary", "results", "phase-ledger", "evidence", "remaining-issues"]
    );
    const row = captured.sections.find((s) => s.id === "results").rows[0];
    assert.strictEqual(row.module, "hotkeys");
    assert.strictEqual(row.command, "agent.orchestrate");
    assert.strictEqual(row.status, "success");
    assert.deepStrictEqual(row.assumptions, []);
    assert.strictEqual(captured.sections.find((s) => s.id === "remaining-issues").rows.length, 0);
    // The input the orchestrator produced is contract-valid on its own.
    const rebuilt = realBus.build(captured);
    assert.strictEqual(rebuilt.ok, true, JSON.stringify(rebuilt.violations));
    assert.strictEqual(result.report.sha256, sha256(result.report.text));
  });
});

// ---------------------------------------------------------------------------
describe("Agent security & determinism (AO-22 … AO-26)", () => {
  it("AO-22: direct handler bypass is impossible through the public surface", () => {
    const agent = makeAgent();
    assert.deepStrictEqual(Object.keys(agent), ["run"], "the public surface is exactly run()");
    assert.ok(Object.isFrozen(agent));
    assert.strictEqual(typeof agent.run, "function");
    // Source-level: the agent imports only its own files, touches no
    // handlers, dispatchers, executors, or file system.
    const files = [path.join(AGENT_DIR, "index.mjs")];
    for (const name of readdirSync(path.join(AGENT_DIR, "src")).sort()) {
      if (name.endsWith(".mjs")) files.push(path.join(AGENT_DIR, "src", name));
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
      assert.ok(!/modules\/(hotkeys|tool-bus|module-registry|report-bus)/.test(text), `${rel}: no module paths`);
    }
    // Behavioral: refused requests never reach the runtime at all (the only
    // execution surface), so no handler can be reached around the gates.
    const spy = spyRuntime();
    const gated = makeAgent({ runtime: spy.runtime });
    gated.run(null);
    gated.run({ ...REQ, module: "ghost-module" });
    gated.run({ ...REQ, capability: "ghost:capability" });
    assert.strictEqual(spy.calls.length, 0);
    // And when the runtime IS reached, it is reached whole — its own gates
    // decide (unknown key stays a runtime refusal, never a silent success).
    gated.run({ ...REQ, target: { key: "GHOST" } });
    assert.strictEqual(spy.calls.length, 1);
    assert.strictEqual(spy.calls[0].key, "GHOST");
  });

  it("AO-23: an undeclared capability cannot execute", () => {
    const spy = spyRuntime();
    // (a) a capability the named module does not hold
    const agent = makeAgent({ enable: ["hotkeys"], runtime: spy.runtime });
    const a = agent.run({ ...REQ, capability: "ghost:capability" });
    // (b) a genuine capability of another (enabled) module
    const b = makeAgent({ enable: ["hotkeys", "module-registry"], runtime: spy.runtime })
      .run({ ...REQ, module: "module-registry", capability: "module-registry:validate" });
    // (c) a genuine capability of an enabled module, still unpairable
    const c = makeAgent({ enable: ["hotkeys", "tool-bus"], runtime: spy.runtime })
      .run({ ...REQ, module: "tool-bus", capability: "toolbus:capabilities" });
    assert.strictEqual(a.code, "CAPABILITY_UNAVAILABLE");
    assert.strictEqual(b.code, "CAPABILITY_UNAVAILABLE");
    assert.strictEqual(c.code, "CAPABILITY_UNAVAILABLE");
    for (const result of [a, b, c]) {
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.execution, null);
      assert.notStrictEqual(result.report, null);
    }
    assert.strictEqual(spy.calls.length, 0, "no undeclared capability ever executed");
  });

  it("AO-24: an unavailable tool cannot become success", () => {
    const spy = spyRuntime();
    const agent = makeAgent({ toolBus: faultBus("TOOL_UNAVAILABLE"), runtime: spy.runtime });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "TOOL_REQUIRED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.execution, null);
    assert.strictEqual(spy.calls.length, 0);
    const text = result.report.text;
    assert.ok(text.includes("| hotkeys | agent.orchestrate | blocked |"), "E-TOOL-class rows render blocked");
    assert.ok(!text.includes("| Status | COMPLETED |"), "the report never claims completion");
    assert.ok(text.includes("TOOL_REQUIRED: files: TOOL_UNAVAILABLE"));
  });

  it("AO-25: a disabled module cannot execute", () => {
    const spy = spyRuntime();
    const agent = makeAgent({ enable: [], runtime: spy.runtime });
    const result = agent.run(REQ);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "MODULE_DISABLED");
    assert.strictEqual(result.status, "REFUSED");
    assert.strictEqual(result.plan, null);
    assert.strictEqual(result.execution, null);
    assert.strictEqual(spy.calls.length, 0, "enablement is never implied");
    assert.ok(result.report.text.includes("| Code | MODULE_DISABLED |"));
    assert.ok(result.report.text.includes("| Status | REFUSED |"));
    assert.ok(!result.report.text.includes("| Status | COMPLETED |"));
  });

  it("AO-26: identical requests against identical state produce identical results", () => {
    const deps = {
      registry: makeRegistry({ enable: ["hotkeys"] }),
      runtime: makeRuntime(),
      toolBus: makeBus(),
      reportBus: createReportBus(),
    };
    const one = createAgentOrchestrator(deps).run(REQ);
    const two = createAgentOrchestrator(deps).run(REQ);
    assert.deepStrictEqual(one, two, "two runs are identical result-for-result");
    assert.strictEqual(one.report.text, two.report.text, "byte-identical report text");
    assert.strictEqual(one.report.sha256, two.report.sha256, "identical report hash");
    assert.strictEqual(one.report.sha256, sha256(one.report.text));
    // A refusal is just as deterministic as a success.
    const refusedRequest = { ...REQ, module: "ghost-module" };
    const r1 = createAgentOrchestrator(deps).run(refusedRequest);
    const r2 = createAgentOrchestrator(deps).run(refusedRequest);
    assert.deepStrictEqual(r1, r2);
    assert.strictEqual(r1.report.sha256, r2.report.sha256);
    // No volatile data in any report.
    for (const report of [one.report, r1.report]) {
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(report.text), "no timestamps");
      assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(report.text), "no uuids");
      assert.ok(!/\/(home|Users|tmp)\//.test(report.text), "no machine paths");
    }
  });
});

// ---------------------------------------------------------------------------
describe("Agent mutations (AO-M1 … AO-M10)", () => {
  const MUTATIONS = Object.freeze([
    ["AO-M1", "mut_agent_unknown_module.json", "MODULE_NOT_FOUND", "REFUSED", "RESOLVE", null],
    ["AO-M2", "mut_agent_disabled_module.json", "MODULE_DISABLED", "REFUSED", "RESOLVE", null],
    ["AO-M3", "mut_agent_unknown_capability.json", "CAPABILITY_UNAVAILABLE", "REFUSED", "RESOLVE", null],
    ["AO-M4", "mut_agent_missing_tool.json", "TOOL_REQUIRED", "REFUSED", "PREFLIGHT", "TOOL_UNAVAILABLE"],
    ["AO-M5", "mut_agent_blocked_tool.json", "TOOL_REQUIRED", "REFUSED", "PREFLIGHT", "TOOL_BLOCKED"],
    ["AO-M6", "mut_agent_dependency.json", "TOOL_REQUIRED", "REFUSED", "PREFLIGHT", "DEPENDENCY_MISSING"],
    ["AO-M7", "mut_agent_malformed.json", "INVALID_REQUEST", "REFUSED", "VALIDATE", null],
    ["AO-M8", "mut_agent_invalid_capability.json", "INVALID_REQUEST", "REFUSED", "VALIDATE", null],
    ["AO-M9", "mut_agent_execution_refusal.json", "EXECUTION_REFUSED", "REFUSED", "EXECUTE", null],
  ]);

  for (const [id, file, code, status, stage, fault] of MUTATIONS) {
    it(`${id}: ${file} fails closed with ${code}`, () => {
      const input = fixture(file); // asserted byte-different from pristine
      const spy = spyRuntime();
      const agent = makeAgent({
        toolBus: fault ? faultBus(fault) : makeBus(),
        runtime: spy.runtime,
      });
      const result = agent.run(input);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, code, JSON.stringify(result));
      assert.strictEqual(result.status, status);
      assert.strictEqual(result.stage, stage);
      assert.strictEqual(result.error.code, code);
      assert.ok(AGENT_ERROR_CLASSES.includes(result.error.class), result.error.class);
      assert.ok(CORE_ERROR_CLASSES.includes(result.error.class));
      assert.notStrictEqual(result.report, null, "every refusal still produces its report");
      assert.strictEqual(result.report.sha256, sha256(result.report.text));
      assert.ok(!result.report.text.includes("| Status | COMPLETED |"), "no mutation may ever read as completion");
      // Execution expectations per stage reached.
      if (stage === "VALIDATE" || stage === "RESOLVE" || stage === "PREFLIGHT") {
        assert.strictEqual(result.execution, null);
        assert.strictEqual(spy.calls.length, 0, "must never reach the runtime");
      }
      if (stage === "EXECUTE") {
        assert.strictEqual(spy.calls.length, 1);
        assert.strictEqual(result.execution.executed, false);
      }
      if (fault) {
        assert.ok(result.report.text.includes(`toolBus.check(files) → ${fault}`));
      }
    });
  }

  it("AO-M10: a corrupted report input fails closed with REPORT_FAILED", () => {
    const fixtureText = readFileSync(FIX + "mut_agent_report_input.json", "utf8");
    assert.notStrictEqual(typeof fixtureText, "undefined");
    // Capture the pristine report input from a successful control run.
    const realBus = createReportBus();
    let captured = null;
    const control = makeAgent({
      reportBus: {
        build(input) {
          captured = input;
          return realBus.build(input);
        },
      },
    });
    const controlRun = control.run(JSON.parse(PRISTINE));
    assert.strictEqual(controlRun.ok, true);
    assert.notStrictEqual(captured, null);
    // The mutation is a real mutation of the pristine report input:
    // byte-different AND content-different.
    assert.notStrictEqual(fixtureText, JSON.stringify(captured, null, 2));
    assert.notDeepStrictEqual(JSON.parse(fixtureText), captured);
    // Feed the corrupted document through the report boundary: the real bus
    // refuses it, and the orchestrator must not claim completion.
    const corrupted = makeAgent({
      reportBus: { build: () => realBus.build(JSON.parse(fixtureText)) },
    });
    const result = corrupted.run(JSON.parse(PRISTINE));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "REPORT_FAILED");
    assert.strictEqual(result.status, "REPORT_FAILED");
    assert.strictEqual(result.stage, "REPORT");
    assert.strictEqual(result.report, null, "no report artifact is emitted for corrupted input");
    assert.ok(result.error.detail.includes("attempt COMPLETED"), "the underlying attempt is preserved");
    assert.strictEqual(result.execution.executed, true, "execution happened — and still no completion");
  });
});
