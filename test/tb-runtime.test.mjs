// Grimoire v3 — Tool Bus ↔ Hotkey Runtime integration suite (Task 07).
//
//   TB-15  runtime receives TOOL_REQUIRED for an unavailable capability
//   TB-16  runtime receives the dependency-blocked result
//   TB-17  a no-tool hotkey executes without any Tool Bus dependency
//   TB-18  SoS stays TOOL_REQUIRED while the search provider is absent
//   TB-19  no fake fallback capability is ever invoked
//   +      invalid capability declarations refuse execution (VALIDATION_ERROR)
//
// The runtime asks the Tool Bus `check(capabilityId)` before executing a
// tool-dependent handler (directive §Hotkey Runtime Integration); handlers
// with no tools never consult the bus, so the bus is never an artificial
// blocker. Group I/HKR suites run without a bus and must stay untouched.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createToolBus, RESULT_CODES } from "../modules/tool-bus/src/bus.mjs";
import { loadCapabilityDeclarations, createDefaultProviders } from "../modules/tool-bus/src/capabilities.mjs";
import { createRuntime, EXECUTION_CLASSES, RESULT_CODES as RUNTIME_CODES } from "../modules/hotkeys/src/runtime.mjs";
import { hotkeyToolDependencies } from "../modules/hotkeys/src/dependencies.mjs";
import { defineHandler, DEFAULT_HANDLERS } from "../modules/hotkeys/src/handlers.mjs";

const ROOT = process.cwd();
const ORIG = readFileSync(path.join(ROOT, "docs/v3/12-hotkey-registry.md"), "utf8");
const DECLARATIONS = loadCapabilityDeclarations();

function makeBus() {
  return createToolBus({ declarationText: DECLARATIONS, providers: createDefaultProviders(), root: ROOT });
}

function makeRuntime(extras = {}) {
  return createRuntime({ registryText: ORIG, root: ROOT, ...extras });
}

// Wrap a handler with a call counter so "never executed" is observable.
function countedHandler(base, requiredTools = base.requiredTools) {
  const counter = { runs: 0 };
  const handler = defineHandler({
    id: base.id,
    command: base.command,
    requiredTools: [...requiredTools],
    validateArgs: base.validateArgs,
    run: (ctx) => {
      counter.runs += 1;
      return base.run(ctx);
    },
  });
  return { handler, counter };
}

describe("Tool Bus ↔ Hotkey runtime (TB-15 … TB-19)", () => {
  it("TB-15: the runtime receives TOOL_REQUIRED when a required capability is unavailable", () => {
    const bus = makeBus();
    const { handler, counter } = countedHandler(DEFAULT_HANDLERS["grimoire.key.R"], ["search providers"]);
    const rt = makeRuntime({ toolBus: bus, handlers: { "grimoire.key.R": handler } });
    const res = rt.executeHotkey({ key: "R" });
    assert.strictEqual(res.classification, "TOOL_REQUIRED");
    assert.strictEqual(res.code, "E_TOOL_UNAVAILABLE");
    assert.strictEqual(res.error.class, "E-TOOL");
    assert.strictEqual(res.error.detail, "search providers");
    assert.strictEqual(res.status, "blocked");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.states.tool_unavailable, true);
    assert.strictEqual(res.states.resolved, true, "it resolved before failing on the tool");
    assert.deepStrictEqual(res.artifacts, []);
    assert.strictEqual(counter.runs, 0, "the handler never ran");
    // The six execution classes still hold.
    assert.ok(EXECUTION_CLASSES.includes(res.classification));
  });

  it("TB-16: the runtime receives the dependency-blocked result", () => {
    const bus = makeBus();
    // chain-tool is AVAILABLE but requires the BLOCKED `browser tool`
    // (adapter-backed): the dependency blocks the chain at the bus layer.
    const registered = bus.register({
      id: "chain-tool",
      version: "1.0.0",
      purpose: "Test-only capability whose dependency is an adapter-backed capability.",
      status: "AVAILABLE",
      input: { type: "object", required: [], properties: {} },
      output: { type: "object" },
      requires: ["browser tool"],
      provider: "local-files",
      errors: ["E-TOOL"],
    });
    assert.strictEqual(registered.ok, true);
    const { handler, counter } = countedHandler(DEFAULT_HANDLERS["grimoire.key.R"], ["chain-tool"]);
    const rt = makeRuntime({ toolBus: bus, handlers: { "grimoire.key.R": handler } });
    const res = rt.executeHotkey({ key: "R" });
    assert.strictEqual(res.classification, "TOOL_REQUIRED");
    assert.strictEqual(res.code, "E_CONFLICT_DEPENDENCY_BLOCKED");
    assert.strictEqual(res.error.class, "E-CONFLICT");
    assert.strictEqual(res.error.detail, "chain-tool");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(counter.runs, 0, "the handler never ran");
    // Distinct from plain TOOL_REQUIRED — the two outcomes are not collapsed.
    const plain = makeRuntime({ toolBus: makeBus() }).executeHotkey({ key: "SoS" });
    assert.strictEqual(plain.code, "E_TOOL_UNAVAILABLE");
    assert.notStrictEqual(res.code, plain.code);
    assert.ok(RUNTIME_CODES[res.code] === "E-CONFLICT");
    assert.ok(RUNTIME_CODES[plain.code] === "E-TOOL");
  });

  it("TB-17: a no-tool hotkey executes without a Tool Bus dependency", () => {
    // No toolBus wired at all: the runtime must not require one.
    const rt = makeRuntime();
    assert.strictEqual(rt.toolBus, null);
    const res = rt.executeHotkey({ key: "R" });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.classification, "EXECUTABLE");
    assert.strictEqual(res.executed, true);
    assert.strictEqual(res.output.file, "Readme.md");
    // And a bus-wired runtime does not become an artificial blocker either:
    // R's handler needs `files`, which is AVAILABLE on the default bus.
    const wired = makeRuntime({ toolBus: makeBus() });
    const wiredRes = wired.executeHotkey({ key: "R" });
    assert.strictEqual(wiredRes.ok, true, "an AVAILABLE capability never blocks execution");
    assert.strictEqual(wiredRes.executed, true);
  });

  it("TB-18: SoS remains TOOL_REQUIRED while the search provider is absent", () => {
    const bus = makeBus();
    const rt = makeRuntime({ toolBus: bus });
    const res = rt.executeHotkey({ key: "SoS" });
    assert.strictEqual(res.classification, "TOOL_REQUIRED");
    assert.strictEqual(res.code, "E_TOOL_UNAVAILABLE");
    assert.strictEqual(res.error.detail, "search providers");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.status, "blocked");
    // No search behavior is fabricated anywhere.
    assert.strictEqual(res.output, null);
    assert.deepStrictEqual(res.artifacts, []);
    // Deterministic dependency report over the 14 ACTIVE hotkeys.
    const rows = hotkeyToolDependencies(rt, bus);
    assert.strictEqual(rows.length, 14);
    const outcomes = rows.reduce((acc, row) => ((acc[row.outcome] = (acc[row.outcome] || 0) + 1), acc), {});
    assert.deepStrictEqual(outcomes, { READY: 13, TOOL_REQUIRED: 1 });
    const sos = rows.find((row) => row.key === "SoS");
    assert.strictEqual(sos.outcome, "TOOL_REQUIRED");
    assert.deepStrictEqual(sos.tools, [{ tool: "search providers", ok: false, code: "TOOL_UNAVAILABLE" }]);
    // The rows are deterministic across recomputation.
    assert.deepStrictEqual(hotkeyToolDependencies(rt, bus), rows);
  });

  it("TB-19: no fake fallback capability is ever invoked", () => {
    const spy = { runs: 0 };
    const bus = createToolBus({
      declarationText: DECLARATIONS,
      providers: {
        ...createDefaultProviders(),
        "local-files": {
          id: "local-files",
          purpose: "Spy binding over the declared local-files provider.",
          invoke: (input, context) => {
            spy.runs += 1;
            return createDefaultProviders()["local-files"].invoke(input, context);
          },
        },
      },
      root: ROOT,
    });
    // Near-miss identifiers never resolve and never substitute (exact match only).
    for (const id of ["fil", "FILES", "file", "files.", "files ", "search-provider", "browser"]) {
      assert.strictEqual(bus.has(id), false, id);
      assert.strictEqual(bus.resolve(id).code, "TOOL_NOT_FOUND", id);
      assert.strictEqual(bus.invoke(id, {}).code, "TOOL_NOT_FOUND", id);
    }
    // A runtime whose handler declares an unregistered tool cannot fall back
    // to the real `files` capability.
    const { handler, counter } = countedHandler(DEFAULT_HANDLERS["grimoire.key.R"], ["fil"]);
    const rt = makeRuntime({ toolBus: bus, handlers: { "grimoire.key.R": handler } });
    const res = rt.executeHotkey({ key: "R" });
    assert.strictEqual(res.classification, "TOOL_REQUIRED");
    assert.strictEqual(res.code, "E_TOOL_UNAVAILABLE");
    assert.strictEqual(res.error.detail, "fil");
    assert.strictEqual(counter.runs, 0);
    assert.strictEqual(spy.runs, 0, "no provider ran for any near-miss lookup");
    // Only the exact declared id executes — exactly once.
    const exact = bus.invoke("files", { file: "Readme.md" });
    assert.strictEqual(exact.ok, true);
    assert.strictEqual(spy.runs, 1);
  });

  it("invalid capability declarations refuse execution (VALIDATION_ERROR outcome)", () => {
    const broken = '{"version":"1.0.0","declared":1,"providers":[],"capabilities":[{"id":"only","version":"bad","purpose":"","status":"NOPE","input":{},"output":{},"requires":[],"provider":null,"errors":[]}]}';
    const bus = createToolBus({ declarationText: broken, providers: createDefaultProviders(), root: ROOT });
    assert.strictEqual(bus.validation.ok, false);
    const rt = makeRuntime({ toolBus: bus });
    const res = rt.executeHotkey({ key: "R" });
    assert.strictEqual(res.classification, "REFUSED");
    assert.strictEqual(res.code, "E_VALID_CAPABILITY_INVALID");
    assert.strictEqual(res.error.class, "E-VALID");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.ok, false);
    // The dependency report surfaces the validation failure, never READY.
    const rows = hotkeyToolDependencies(rt, bus);
    const rRow = rows.find((row) => row.key === "R");
    assert.strictEqual(rRow.outcome, "VALIDATION_ERROR");
    assert.deepStrictEqual(rRow.tools, [{ tool: "files", ok: false, code: "CAPABILITY_INVALID" }]);
    // Every code emitted by this integration is declared in both tables.
    assert.ok(res.code in RUNTIME_CODES);
    assert.ok("CAPABILITY_INVALID" in RESULT_CODES);
  });
});
