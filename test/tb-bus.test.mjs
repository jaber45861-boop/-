// Grimoire v3 — Tool Bus suite (Task 07).
//
// TB coverage map (documented in docs/v3/05-acceptance-tests.md, Group K,
// and docs/v3/15-tool-bus.md §Testing contract):
//   TB-01  valid capability registers            — this file, block 1
//   TB-02  duplicate capability ids fail closed
//   TB-03  invalid capability schema rejected
//   TB-04  unknown capability cannot resolve
//   TB-05  unavailable capability cannot invoke
//   TB-06  blocked capability cannot invoke
//   TB-07  disabled capability cannot invoke
//   TB-08  missing dependency prevents invocation        — block 2
//   TB-09  missing provider prevents invocation
//   TB-10  valid provider executes successfully
//   TB-11  provider failure -> deterministic structured failure
//   TB-12  invalid input rejected before provider execution
//   TB-13  repeated resolution deterministic
//   TB-14  repeated reports byte-identical
//   TB-20…TB-24 the five capability mutations            — block 3
// TB-15…TB-19 (Hotkey Runtime integration) live in test/tb-runtime.test.mjs.
//
// Every mutation fixture is asserted byte-different from the authoritative
// declarations (modules/tool-bus/capabilities.json) before it is trusted.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createToolBus,
  buildToolBusReport,
  CAPABILITY_STATUSES,
  RESULT_CODES,
} from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  capabilityDeclarationsSha256,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import { CORE_ERROR_CLASSES } from "../modules/tool-bus/src/errors.mjs";

const ROOT = process.cwd();
const FIX = path.join(ROOT, "test/_fixtures/");
const PRISTINE = loadCapabilityDeclarations();

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function makeBus(declarationText = PRISTINE, providers = createDefaultProviders()) {
  return createToolBus({ declarationText, providers, root: ROOT });
}

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, PRISTINE, `${name} must be byte-different from the declarations (real mutation)`);
  return text;
}

// A minimal, schema-valid synthetic capability (never part of the default set).
function syntheticCapability(overrides = {}) {
  return {
    id: "synthetic.tool",
    version: "1.0.0",
    purpose: "Synthetic capability used only by the Tool Bus test suite.",
    status: "AVAILABLE",
    input: { type: "object", required: [], properties: {} },
    output: { type: "object" },
    requires: [],
    provider: "local-files",
    errors: ["E-TOOL"],
    ...overrides,
  };
}

const CAPABILITY_KEYS = ["id", "version", "purpose", "status", "input", "output", "requires", "provider", "errors"];

// ---------------------------------------------------------------------------
// Block 1 — contract duties (TB-01 … TB-07)
// ---------------------------------------------------------------------------
describe("Tool Bus contract (TB-01 … TB-07)", () => {
  it("TB-01: a valid capability registers successfully", () => {
    const bus = makeBus();
    assert.strictEqual(bus.validation.ok, true);
    const registered = bus.register(syntheticCapability());
    assert.strictEqual(registered.ok, true);
    assert.strictEqual(registered.code, "TB_OK");
    assert.strictEqual(registered.error, null);
    assert.strictEqual(bus.has("synthetic.tool"), true);
    const resolved = bus.resolve("synthetic.tool");
    assert.strictEqual(resolved.ok, true);
    assert.deepStrictEqual(Object.keys(resolved.resolution).sort(), [...CAPABILITY_KEYS, "providerRegistered", "invoke"].sort());
    assert.strictEqual(resolved.resolution.status, "AVAILABLE");
    assert.strictEqual(bus.list().some((c) => c.id === "synthetic.tool"), true);
  });

  it("TB-02: duplicate capability ids fail closed", () => {
    const bus = makeBus();
    const before = bus.list().length;
    const duplicate = bus.register(syntheticCapability({ id: "files" }));
    assert.strictEqual(duplicate.ok, false);
    assert.strictEqual(duplicate.code, "CAPABILITY_DUPLICATE");
    assert.strictEqual(duplicate.error.class, "E-CONFLICT");
    assert.strictEqual(bus.list().length, before, "the duplicate must not be added");
    assert.strictEqual(bus.resolve("files").resolution.purpose.includes("repository document"), true, "original kept");
    // Duplicate detection also fires through validate().
    const validated = bus.validate(syntheticCapability({ id: "files" }));
    assert.strictEqual(validated.ok, false);
    assert.strictEqual(validated.code, "CAPABILITY_DUPLICATE");
  });

  it("TB-03: an invalid capability schema is rejected", () => {
    const bus = makeBus();
    const cases = [
      [syntheticCapability({ status: "KINDA_AVAILABLE" }), "invalid_status"],
      [syntheticCapability({ purpose: "" }), "invalid_purpose"],
      [syntheticCapability({ version: "one" }), "invalid_version"],
      [syntheticCapability({ requires: "files" }), "invalid_requires"],
      [syntheticCapability({ errors: ["E-MADE-UP"] }), "invalid_errors"],
      [syntheticCapability({ input: { type: "folder" } }), "invalid_input"],
      [{ id: "nope" }, "missing_version"],
    ];
    for (const [candidate, expected] of cases) {
      const result = bus.register(candidate);
      assert.strictEqual(result.ok, false, expected);
      assert.strictEqual(result.code, "CAPABILITY_INVALID", expected);
      assert.strictEqual(result.error.class, "E-VALID", expected);
      assert.ok(result.violations.some((v) => v.code === expected), `${expected} must be reported`);
      const checked = bus.validate(candidate);
      assert.strictEqual(checked.ok, false, expected);
      assert.ok(checked.violations.some((v) => v.code === expected), expected);
      assert.strictEqual(bus.has(candidate.id), false, `${candidate.id} must not be registered`);
    }
    // AVAILABLE without a provider is a declaration contradiction.
    const noProvider = bus.register(syntheticCapability({ provider: null }));
    assert.strictEqual(noProvider.ok, false);
    assert.ok(noProvider.violations.some((v) => v.code === "available_requires_provider"));
  });

  it("TB-04: an unknown capability cannot resolve", () => {
    const bus = makeBus();
    for (const id of ["does-not-exist", "files ", "Files", ""]) {
      const resolved = bus.resolve(id);
      assert.strictEqual(resolved.ok, false, JSON.stringify(id));
      assert.strictEqual(resolved.code, "TOOL_NOT_FOUND");
      assert.strictEqual(resolved.error.class, "E-INPUT");
      assert.strictEqual(resolved.resolution, null);
      assert.strictEqual(bus.has(id), false);
      const described = bus.describe(id);
      assert.strictEqual(described.ok, false);
      assert.strictEqual(described.code, "TOOL_NOT_FOUND");
    }
  });

  it("TB-05: an unavailable capability cannot invoke", () => {
    const bus = makeBus();
    const invoked = bus.invoke("search providers", {});
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "TOOL_UNAVAILABLE");
    assert.strictEqual(invoked.error.class, "E-TOOL");
    assert.strictEqual(invoked.error.detail, "search providers");
    assert.strictEqual(invoked.output, null);
    // Resolution still shows the true state — queries are not gated.
    const resolved = bus.resolve("search providers");
    assert.strictEqual(resolved.ok, true);
    assert.strictEqual(resolved.resolution.status, "UNAVAILABLE");
    assert.strictEqual(bus.check("search providers").code, "TOOL_UNAVAILABLE");
  });

  it("TB-06: a blocked capability cannot invoke", () => {
    const bus = makeBus();
    const invoked = bus.invoke("browser tool", {});
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "TOOL_BLOCKED");
    assert.strictEqual(invoked.error.class, "E-CONFLICT");
    assert.strictEqual(invoked.output, null);
    assert.strictEqual(bus.resolve("browser tool").resolution.status, "BLOCKED");
    // Every adapter-backed (BLOCKED) capability behaves identically.
    for (const id of ["external link", "code interpreter", "Netlify GPT action", "Twitter/X", "Xcode export operation"]) {
      assert.strictEqual(bus.invoke(id, {}).code, "TOOL_BLOCKED", id);
    }
  });

  it("TB-07: a disabled capability cannot invoke — a missing tool is not a disabled tool", () => {
    const bus = makeBus();
    const registered = bus.register(syntheticCapability({ id: "disabled.tool", status: "DISABLED" }));
    assert.strictEqual(registered.ok, true, "DISABLED is a legal declared state");
    const invoked = bus.invoke("disabled.tool", {});
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "TOOL_DISABLED");
    assert.strictEqual(invoked.error.class, "E-CONFLICT");
    assert.strictEqual(invoked.output, null);
    // The four states stay distinct (directive §Capability model).
    assert.deepStrictEqual([...CAPABILITY_STATUSES], ["AVAILABLE", "UNAVAILABLE", "BLOCKED", "DISABLED"]);
    assert.notStrictEqual(bus.invoke("disabled.tool", {}).code, bus.invoke("search providers", {}).code);
    assert.notStrictEqual(bus.invoke("disabled.tool", {}).code, bus.invoke("browser tool", {}).code);
  });
});
// ---------------------------------------------------------------------------
// Block 2 — execution duties (TB-08 … TB-14)
// ---------------------------------------------------------------------------
describe("Tool Bus execution duties (TB-08 … TB-14)", () => {
  it("TB-08: a missing dependency prevents invocation", () => {
    const bus = makeBus();
    bus.register(syntheticCapability({ id: "needs.ghost", requires: ["ghost.capability"] }));
    const ghost = bus.invoke("needs.ghost", {});
    assert.strictEqual(ghost.ok, false);
    assert.strictEqual(ghost.code, "DEPENDENCY_MISSING");
    assert.strictEqual(ghost.error.class, "E-ENV");
    assert.strictEqual(ghost.error.detail, "ghost.capability");
    assert.strictEqual(ghost.output, null);
    assert.strictEqual(bus.check("needs.ghost").code, "DEPENDENCY_MISSING");
    // A dependency that exists but is not AVAILABLE blocks equally (TB-16 source).
    bus.register(syntheticCapability({ id: "needs.blocked", requires: ["browser tool"] }));
    const blocked = bus.invoke("needs.blocked", {});
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.code, "DEPENDENCY_BLOCKED");
    assert.strictEqual(blocked.error.class, "E-CONFLICT");
    assert.strictEqual(blocked.error.detail, "browser tool");
  });

  it("TB-09: a missing provider prevents invocation", () => {
    const bus = makeBus();
    bus.register(syntheticCapability({ id: "needs.provider", provider: "ghost.provider" }));
    const invoked = bus.invoke("needs.provider", {});
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "PROVIDER_MISSING");
    assert.strictEqual(invoked.error.class, "E-ENV");
    assert.strictEqual(invoked.error.detail, "ghost.provider");
    assert.strictEqual(invoked.output, null);
    // Availability alone does not imply executability — the declaration and
    // the implementation must BOTH exist (TB-22 exercises the declaration side).
    assert.strictEqual(bus.check("needs.provider").ok, true, "check reports state, invoke enforces it");
    assert.strictEqual(bus.describe("needs.provider").descriptor.providerRegistered, false);
  });

  it("TB-10: a valid provider executes successfully", () => {
    const bus = makeBus();
    const invoked = bus.invoke("files", { file: "Readme.md" });
    assert.strictEqual(invoked.ok, true);
    assert.strictEqual(invoked.code, "TB_OK");
    assert.strictEqual(invoked.error, null);
    assert.strictEqual(invoked.provider, "local-files");
    const actual = readFileSync(path.join(ROOT, "Readme.md"), "utf8");
    assert.strictEqual(invoked.output.file, "Readme.md");
    assert.strictEqual(invoked.output.content, actual, "the provider really read the document");
    assert.strictEqual(invoked.output.sha256, sha256(actual));
    assert.strictEqual(invoked.output.bytes, Buffer.byteLength(actual, "utf8"));
  });

  it("TB-11: a provider failure becomes a deterministic structured failure", () => {
    const bus = makeBus();
    const registered = bus.registerProvider({
      id: "throwing.provider",
      purpose: "Test-only provider that always throws.",
      invoke: () => {
        throw new Error("provider exploded");
      },
    });
    assert.strictEqual(registered.ok, true);
    bus.register(syntheticCapability({ id: "throws.tool", provider: "throwing.provider" }));
    const first = bus.invoke("throws.tool", {});
    assert.strictEqual(first.ok, false);
    assert.strictEqual(first.code, "PROVIDER_FAILURE");
    assert.ok(CORE_ERROR_CLASSES.includes(first.error.class), "classified into a Core class");
    assert.strictEqual(first.error.code, "E_UNKNOWN_EXCEPTION");
    assert.strictEqual(first.output, null);
    // Deterministic: the same failure produces the same structured result.
    const second = bus.invoke("throws.tool", {});
    assert.deepStrictEqual(second, first);
    // Classified failures: fs-shaped errors keep their class (01 §11.1).
    const missing = bus.invoke("files", { file: "no-such-file.md" });
    assert.strictEqual(missing.ok, false);
    assert.strictEqual(missing.code, "PROVIDER_FAILURE");
    assert.strictEqual(missing.error.class, "E-ENV");
    assert.strictEqual(missing.error.code, "E_ENV_MISSING_FILE");
    const escaped = bus.invoke("files", { file: "../outside.md" });
    assert.strictEqual(escaped.code, "PROVIDER_FAILURE");
    assert.strictEqual(escaped.error.class, "E-TOOL", "path escape is refused by the provider");
  });

  it("TB-12: invalid input is rejected before any provider execution", () => {
    const bus = makeBus();
    const spy = { runs: 0 };
    const registered = bus.registerProvider({
      id: "spy.provider",
      purpose: "Test-only provider that counts invocations.",
      invoke: (input) => {
        spy.runs += 1;
        return { echoed: input };
      },
    });
    assert.strictEqual(registered.ok, true);
    bus.register(syntheticCapability({
      id: "spy.input",
      provider: "spy.provider",
      input: { type: "object", required: ["target"], properties: { target: "string", count: "number" } },
    }));
    const badCases = [
      {}, // missing required field
      { target: 42 }, // wrong type
      { target: "x", bogus: 1 }, // unexpected field
      "not-an-object", // wrong shape
    ];
    for (const input of badCases) {
      const invoked = bus.invoke("spy.input", input);
      assert.strictEqual(invoked.ok, false, JSON.stringify(input));
      assert.strictEqual(invoked.code, "INPUT_INVALID", JSON.stringify(input));
      assert.strictEqual(invoked.error.class, "E-INPUT");
      assert.strictEqual(invoked.output, null);
    }
    assert.strictEqual(spy.runs, 0, "the provider never ran on invalid input");
    // A valid input executes exactly once.
    const ok = bus.invoke("spy.input", { target: "docs", count: 2 });
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(spy.runs, 1);
    // The default `files` capability enforces its own schema too.
    assert.strictEqual(bus.invoke("files", {}).code, "INPUT_INVALID");
    assert.strictEqual(bus.invoke("files", { file: 7 }).code, "INPUT_INVALID");
  });

  it("TB-13: repeated resolution is deterministic", () => {
    const busA = makeBus();
    const busB = makeBus();
    const first = busA.resolve("files");
    for (let i = 0; i < 3; i += 1) {
      assert.deepStrictEqual(busA.resolve("files"), first, "same bus, same resolution");
    }
    assert.deepStrictEqual(busB.resolve("files"), first, "fresh bus, same resolution");
    assert.deepStrictEqual(busA.list(), busB.list());
    assert.deepStrictEqual(
      ["files", "search providers", "browser tool", "nope"].map((id) => busA.check(id).code),
      ["files", "search providers", "browser tool", "nope"].map((id) => busB.check(id).code)
    );
    assert.deepStrictEqual(busA.listProviders(), busB.listProviders());
    // No volatile data anywhere in a resolution.
    const text = JSON.stringify(first);
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(text), "no timestamps");
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/.test(text), "no uuid-like ids");
  });

  it("TB-14: repeated reports are byte-identical", () => {
    const bus = makeBus();
    const one = buildToolBusReport(bus);
    const two = buildToolBusReport(bus);
    assert.strictEqual(one.text, two.text);
    assert.strictEqual(one.sha256, two.sha256);
    assert.strictEqual(one.sha256, sha256(one.text), "sha256 of its own bytes");
    // Fresh bus, same declarations -> same bytes.
    const three = buildToolBusReport(makeBus());
    assert.strictEqual(three.text, one.text);
    assert.strictEqual(three.sha256, one.sha256);
    // Report answers the eight reporting questions without volatile data.
    for (const needle of [
      `| Declarations sha256 | ${sha256(PRISTINE)} |`,
      "| Valid | true |",
      "| Capabilities | 11 |",
      "| AVAILABLE | 1 |",
      "| UNAVAILABLE | 2 |",
      "| BLOCKED | 8 |",
      "| DISABLED | 0 |",
      "## 2. Capabilities",
      "## 3. Providers",
      "## 4. Missing dependencies",
      "local-files",
      "grimoire.adapter.B",
      "search providers",
    ]) {
      assert.ok(one.text.includes(needle), `report must state: ${needle}`);
    }
    // With hotkey rows: byte-stable too, and the unavailable dependency shows.
    const rows = [
      { key: "SoS", command: "grimoire.key.SoS", tools: [{ tool: "search providers", ok: false, code: "TOOL_UNAVAILABLE" }], outcome: "TOOL_REQUIRED" },
    ];
    const withRowsA = buildToolBusReport(bus, rows);
    const withRowsB = buildToolBusReport(bus, rows);
    assert.strictEqual(withRowsA.text, withRowsB.text);
    assert.strictEqual(withRowsA.sha256, withRowsB.sha256);
    assert.ok(withRowsA.text.includes("## 5. Hotkey dependencies"));
    assert.ok(withRowsA.text.includes("| SoS | grimoire.key.SoS | search providers (TOOL_UNAVAILABLE) | TOOL_REQUIRED |"));
    // The declaration file itself is stable.
    assert.strictEqual(capabilityDeclarationsSha256(), sha256(PRISTINE));
  });
});
// ---------------------------------------------------------------------------
// Block 3 — TB-20 … TB-24: the five capability mutations, all fail closed
// ---------------------------------------------------------------------------
describe("Tool Bus mutations (TB-20 … TB-24)", () => {
  it("TB-20: remove a capability declaration -> resolution refuses (TOOL_NOT_FOUND)", () => {
    const mutated = fixture("tb_missing_capability.json");
    const bus = makeBus(mutated);
    assert.strictEqual(bus.validation.ok, true, "removal alone is a valid document");
    // Contrast: the pristine declarations resolve it, the mutation does not.
    assert.strictEqual(makeBus().has("search providers"), true);
    assert.strictEqual(bus.has("search providers"), false);
    const resolved = bus.resolve("search providers");
    assert.strictEqual(resolved.ok, false);
    assert.strictEqual(resolved.code, "TOOL_NOT_FOUND");
    const invoked = bus.invoke("search providers", {});
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "TOOL_NOT_FOUND");
    assert.strictEqual(invoked.output, null);
    // SoS's dependency is now genuinely unsatisfiable at the bus layer.
    assert.strictEqual(bus.check("search providers").code, "TOOL_NOT_FOUND");
  });

  it("TB-21: alter a capability status -> invocation refuses (TOOL_DISABLED)", () => {
    const mutated = fixture("tb_status_altered.json");
    const bus = makeBus(mutated);
    assert.strictEqual(bus.validation.ok, true, "DISABLED is a legal status — only behavior changes");
    assert.strictEqual(bus.resolve("files").resolution.status, "DISABLED");
    const invoked = bus.invoke("files", { file: "Readme.md" });
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "TOOL_DISABLED");
    assert.strictEqual(invoked.error.class, "E-CONFLICT");
    assert.strictEqual(invoked.output, null, "a disabled capability never executes");
    assert.strictEqual(bus.check("files").code, "TOOL_DISABLED");
  });

  it("TB-22: remove the provider declaration -> invocation refuses (PROVIDER_MISSING)", () => {
    const mutated = fixture("tb_provider_removed.json");
    const bus = makeBus(mutated);
    assert.strictEqual(bus.validation.ok, true, "capability/provider cross-validation happens at invocation");
    assert.strictEqual(bus.resolve("files").resolution.status, "AVAILABLE", "still declared available");
    assert.strictEqual(bus.describe("files").descriptor.providerRegistered, false);
    const invoked = bus.invoke("files", { file: "Readme.md" });
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "PROVIDER_MISSING");
    assert.strictEqual(invoked.error.detail, "local-files");
    assert.strictEqual(invoked.output, null, "declaration AND implementation are both required");
  });

  it("TB-23: alter a dependency -> invocation refuses (DEPENDENCY_MISSING)", () => {
    const mutated = fixture("tb_dependency_altered.json");
    const bus = makeBus(mutated);
    assert.strictEqual(bus.validation.ok, true, "the altered requires array is schema-valid");
    const invoked = bus.invoke("files", { file: "Readme.md" });
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "DEPENDENCY_MISSING");
    assert.strictEqual(invoked.error.class, "E-ENV");
    assert.strictEqual(invoked.error.detail, "ghost-dependency");
    assert.strictEqual(invoked.output, null);
    assert.strictEqual(bus.check("files").code, "DEPENDENCY_MISSING");
  });

  it("TB-24: duplicate a capability -> validation fails, every lookup refuses", () => {
    const mutated = fixture("tb_duplicate_capability.json");
    const bus = makeBus(mutated);
    assert.strictEqual(bus.validation.ok, false);
    assert.ok(bus.validation.violations.some((v) => v.code === "capability_duplicate"));
    // An invalid declaration document refuses everything (fail closed),
    // including capabilities that are individually untouched.
    assert.strictEqual(bus.list().length, 0);
    for (const id of ["files", "search providers"]) {
      assert.strictEqual(bus.has(id), false, id);
      const resolved = bus.resolve(id);
      assert.strictEqual(resolved.ok, false, id);
      assert.strictEqual(resolved.code, "CAPABILITY_INVALID", id);
      assert.strictEqual(resolved.error.class, "E-VALID", id);
      assert.strictEqual(bus.invoke(id, {}).code, "CAPABILITY_INVALID", id);
      assert.strictEqual(bus.describe(id).code, "CAPABILITY_INVALID", id);
    }
    // The report states the failure instead of pretending success.
    const report = buildToolBusReport(bus);
    assert.ok(report.text.includes("| Valid | false |"));
    assert.ok(report.text.includes("| Violations | 1 |"));
  });
});
