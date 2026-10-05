// Grimoire v3 — Module Registry suite (Task 08).
//
// MR coverage map (documented in docs/v3/05-acceptance-tests.md, Group L,
// and docs/v3/16-module-registry.md §Testing contract):
//   MR-01  registers the three real manifests              — this file, block 1
//   MR-02  duplicate module id fails closed
//   MR-03  invalid manifest documents fail closed
//   MR-04  unknown module refuses on every surface
//   MR-05  VALIDATE is clean on every real input (03 §3 duties)
//   MR-06  field rules M1–M6 name the exact violation       — block 2
//   MR-07  lifecycle enable/disable
//   MR-08  conflict with an enabled module fails closed
//   MR-09  capability resolution: resolved / unresolved / ambiguous
//   MR-10  INVOKE gate: declared phases and tools only
//   MR-11  unavailable tool dependency fails closed         — block 3
//   MR-12  configuration fails closed at construction
//   MR-13  deterministic results and byte-identical reports
//   MR-14  AC-19: incomplete manifest never runs            — block 4
//   MR-15/1..4  the four remaining manifest mutations
//   MR-16  exports, parser surface, error-class conformance
//
// Mutation fixtures are asserted byte-different from the pristine hotkeys
// manifest (modules/hotkeys/manifest.yaml) before they are trusted.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createModuleRegistry,
  buildRegistryReport,
  RESULT_CODES,
  DEFAULT_AVAILABLE_TOOLS,
  parseManifest,
  validateManifest,
  EIGHT_LOOP_PHASES,
  MANIFEST_FIELDS,
  CORE_CONTRACT_VERSION,
  CORE_ERROR_CLASSES,
  MODULE_ERROR_CLASSES,
  makeError,
  isCoreErrorClass,
} from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";

const ROOT = process.cwd();
const FIX = path.join(ROOT, "test/_fixtures/");
const REAL = {
  hotkeys: readFileSync(path.join(ROOT, "modules/hotkeys/manifest.yaml"), "utf8"),
  "tool-bus": readFileSync(path.join(ROOT, "modules/tool-bus/manifest.yaml"), "utf8"),
  "module-registry": readFileSync(path.join(ROOT, "modules/module-registry/manifest.yaml"), "utf8"),
};
const PRISTINE = REAL.hotkeys;

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function makeBus() {
  return createToolBus({ declarationText: loadCapabilityDeclarations(), providers: createDefaultProviders(), root: ROOT });
}

function makeRegistry(extras = {}) {
  return createModuleRegistry({ toolBus: makeBus(), ...extras });
}

function registerReal(registry, ids = ["hotkeys", "tool-bus", "module-registry"]) {
  for (const id of ids) {
    const result = registry.register(REAL[id]);
    assert.strictEqual(result.ok, true, `register(${id}) must succeed: ${JSON.stringify(result)}`);
  }
}

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, PRISTINE, `${name} must be byte-different from the pristine hotkeys manifest (real mutation)`);
  return text;
}

// A complete, valid synthetic manifest rendered to text; `overrides` replaces
// or deletes (undefined) fields to build one precise violation at a time.
function synthText(overrides = {}) {
  const base = {
    id: "synthetic-mod",
    version: "1.0.0",
    core: ">=3.0 <4.0",
    name: "Synthetic",
    purpose: "Synthetic module used only by the Module Registry test suite.",
    phases: ["RUN"],
    requires: { tools: ["files"] },
    provides: ["synthetic:cap"],
    consumes: [],
    conflicts: [],
    outputs: ["synthetic-report"],
    errors: ["E-VALID"],
    entry: "modules/synthetic/index.mjs",
    ...overrides,
  };
  const quote = (value) => (typeof value === "string" ? `"${value}"` : String(value));
  const lines = ["# synthetic manifest (test-only)", ""];
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${key}: []`);
      else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${quote(item)}`);
      }
    } else if (value !== null && typeof value === "object") {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        if (Array.isArray(subValue)) lines.push(`  ${subKey}: [${subValue.map(quote).join(", ")}]`);
        else lines.push(`  ${subKey}: ${quote(subValue)}`);
      }
    } else {
      lines.push(`${key}: ${quote(value)}`);
    }
  }
  return lines.join("\n") + "\n";
}

const hasViolation = (result, code) => result.violations.some((v) => v.code === code);

// ---------------------------------------------------------------------------
// Block 1 — contract duties (MR-01 … MR-05)
// ---------------------------------------------------------------------------
describe("Module Registry contract (MR-01 … MR-05)", () => {
  it("MR-01: registers the three real manifests with full descriptors", () => {
    const registry = makeRegistry();
    registerReal(registry);
    assert.strictEqual(registry.has("hotkeys"), true);
    assert.strictEqual(registry.has("tool-bus"), true);
    assert.strictEqual(registry.has("module-registry"), true);
    assert.strictEqual(registry.has("nope"), false);
    assert.deepStrictEqual(registry.list().map((m) => m.id), ["hotkeys", "tool-bus", "module-registry"]);
    const described = registry.describe("hotkeys");
    assert.strictEqual(described.ok, true);
    assert.deepStrictEqual(Object.keys(described.descriptor).sort(), [
      "conflicts", "consumes", "core", "enabled", "entry", "errors", "id",
      "name", "outputs", "phases", "provides", "purpose", "requires",
      "version", "violations",
    ]);
    assert.deepStrictEqual(described.descriptor.phases, ["RUN", "TEST", "SHIP"]);
    assert.deepStrictEqual(described.descriptor.requires, { tools: ["files"] });
    assert.strictEqual(described.descriptor.enabled, false, "registered is not enabled");
    assert.deepStrictEqual(described.descriptor.violations, []);
    const self = registry.describe("module-registry");
    assert.strictEqual(self.ok, true, "the registry validates its own manifest");
    assert.deepStrictEqual(self.descriptor.violations, [], "self-manifest is clean");
  });

  it("MR-02: duplicate module ids fail closed", () => {
    const registry = makeRegistry();
    registerReal(registry, ["hotkeys"]);
    const before = registry.describe("hotkeys");
    const duplicate = registry.register(REAL["hotkeys"]);
    assert.strictEqual(duplicate.ok, false);
    assert.strictEqual(duplicate.code, "MODULE_DUPLICATE");
    assert.strictEqual(duplicate.error.class, "E-CONFLICT");
    assert.strictEqual(duplicate.id, "hotkeys");
    // Original untouched; a different module's id collision behaves the same.
    assert.deepStrictEqual(registry.describe("hotkeys"), before);
    assert.strictEqual(registry.list().length, 1);
    // A second registry with a different first module still refuses the same id.
    const other = makeRegistry();
    other.register(REAL["tool-bus"]);
    assert.strictEqual(other.register(REAL["hotkeys"]).code, "MR_OK", "no collision across registries");
    assert.strictEqual(other.register(REAL["hotkeys"]).code, "MODULE_DUPLICATE");
  });

  it("MR-03: invalid manifest documents fail closed at register", () => {
    const registry = makeRegistry();
    const notString = registry.register(42);
    assert.strictEqual(notString.ok, false);
    assert.strictEqual(notString.code, "INVALID_INVOCATION");
    assert.strictEqual(notString.error.class, "E-INPUT");
    const garbage = registry.register("this is not a manifest at all\n");
    assert.strictEqual(garbage.ok, false);
    assert.strictEqual(garbage.code, "MANIFEST_INVALID");
    assert.strictEqual(garbage.error.class, "E-VALID");
    assert.ok(garbage.violations.length > 0, "unparseable document carries named violations");
    const noId = registry.register('name: "No Id"\nversion: "1.0.0"\n');
    assert.strictEqual(noId.ok, false);
    assert.strictEqual(noId.code, "MANIFEST_INVALID");
    const arrayId = registry.register("id: []\n");
    assert.strictEqual(arrayId.ok, false);
    assert.strictEqual(arrayId.code, "MANIFEST_INVALID", "id must be a usable string key");
    assert.strictEqual(registry.list().length, 0, "nothing was registered");
    assert.strictEqual(registry.has("hotkeys"), false);
  });

  it("MR-04: unknown module refuses on every surface", () => {
    const registry = makeRegistry();
    for (const result of [
      registry.validate("ghost"),
      registry.enable("ghost"),
      registry.disable("ghost"),
      registry.canInvoke("ghost", { phase: "RUN" }),
      registry.describe("ghost"),
    ]) {
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, "MODULE_NOT_FOUND");
      assert.strictEqual(result.error.class, "E-INPUT");
    }
    assert.strictEqual(registry.isEnabled("ghost"), false);
    assert.strictEqual(registry.validate(null).code, "MODULE_NOT_FOUND");
    assert.strictEqual(registry.canInvoke("ghost", "not-an-object").code, "INVALID_INVOCATION", "input shape checked first");
  });

  it("MR-05: VALIDATE is clean on every real input and repeats identically", () => {
    const registry = makeRegistry();
    registerReal(registry);
    const first = registry.validateAll();
    assert.strictEqual(first.ok, true, JSON.stringify(first));
    assert.strictEqual(first.modules.length, 3);
    for (const module of first.modules) {
      assert.strictEqual(module.ok, true, module.id);
      assert.strictEqual(module.code, "MR_OK");
      assert.deepStrictEqual(module.violations, []);
    }
    const second = registry.validateAll();
    assert.deepStrictEqual(second, first, "validation is deterministic");
    // Every real manifest satisfies the four 03 §3 duties explicitly.
    for (const id of ["hotkeys", "tool-bus", "module-registry"]) {
      const result = registry.validate(id);
      assert.strictEqual(result.ok, true, id);
      assert.strictEqual(result.code, "MR_OK");
    }
  });

});

// ---------------------------------------------------------------------------
// Block 2 — validation rules, lifecycle, resolution, INVOKE gate (MR-06 … MR-10)
// ---------------------------------------------------------------------------
 describe("Module Registry validation & gates (MR-06 … MR-10)", () => {
  it("MR-06: every field rule names its exact violation (03 §2 M1–M6)", () => {
    const cases = [
      { overrides: { purpose: undefined }, code: "missing_purpose" },
      { overrides: { entry: undefined }, code: "missing_entry" },
      { overrides: { phases: undefined }, code: "missing_phases" },
      { overrides: { requires: undefined }, code: "missing_requires" },
      { overrides: { errors: undefined }, code: "missing_errors" },
      { overrides: { provides: undefined }, code: "missing_provides" },
      { overrides: { id: "Hot Keys" }, code: "invalid_id" },
      { overrides: { id: "UPPER" }, code: "invalid_id" },
      { overrides: { version: "1.0" }, code: "invalid_version" },
      { overrides: { core: "3.0" }, code: "invalid_core_range" },
      { overrides: { core: ">=4.0 <5.0" }, code: "core_version_mismatch" },
      { overrides: { phases: ["DEPLOY"] }, code: "invalid_phase" },
      { overrides: { phases: [] }, code: "invalid_phases" },
      { overrides: { errors: ["E-CUSTOM"] }, code: "invalid_error_class" },
      { overrides: { requires: {} }, code: "invalid_requires" },
      { overrides: { requires: "files" }, code: "invalid_requires" },
      { overrides: { requires: { tools: "files" } }, code: "invalid_tools" },
      { overrides: { provides: "synthetic:cap" }, code: "invalid_provides" },
      { overrides: { name: "" }, code: "invalid_name" },
      { overrides: { extra: "not in the schema" }, code: "unknown_field" },
    ];
    for (const { overrides, code } of cases) {
      const registry = makeRegistry();
      const registered = registry.register(synthText(overrides));
      assert.strictEqual(registered.ok, true, `${code}: register accepts the submission`);
      const result = registry.validate(registered.id);
      assert.strictEqual(result.ok, false, code);
      assert.strictEqual(result.code, "MANIFEST_INVALID", code);
      assert.ok(hasViolation(result, code), `${code} must appear in ${JSON.stringify(result.violations)}`);
      const enabled = registry.enable(registered.id);
      assert.strictEqual(enabled.ok, false, code);
      assert.strictEqual(enabled.code, "MANIFEST_INVALID", code);
      assert.ok(enabled.violations.some((v) => v.code === code), code);
    }
    // The clean baseline for the same helper passes.
    const clean = makeRegistry();
    assert.strictEqual(clean.register(synthText()).ok, true);
    assert.strictEqual(clean.validate("synthetic-mod").ok, true);
  });

  it("MR-07: enable/disable follows the 03 §3 lifecycle exactly", () => {
    const registry = makeRegistry();
    registerReal(registry);
    assert.strictEqual(registry.isEnabled("hotkeys"), false);
    // provides are exposed only by enabled modules (03 §3 ENABLE)
    assert.strictEqual(registry.resolveCapability("hotkeys:execute").code, "CAPABILITY_UNRESOLVED");
    assert.strictEqual(registry.enable("hotkeys").code, "MR_OK");
    assert.strictEqual(registry.isEnabled("hotkeys"), true);
    assert.strictEqual(registry.resolveCapability("hotkeys:execute").module, "hotkeys");
    // Second enable is a named refusal, not a silent no-op.
    const again = registry.enable("hotkeys");
    assert.strictEqual(again.ok, false);
    assert.strictEqual(again.code, "MODULE_ALREADY_ENABLED");
    assert.strictEqual(again.error.class, "E-CONFLICT");
    // Disable removes exposure; disabling twice is a named refusal.
    assert.strictEqual(registry.disable("hotkeys").code, "MR_OK");
    assert.strictEqual(registry.isEnabled("hotkeys"), false);
    assert.strictEqual(registry.resolveCapability("hotkeys:execute").code, "CAPABILITY_UNRESOLVED");
    const disableAgain = registry.disable("hotkeys");
    assert.strictEqual(disableAgain.code, "MODULE_NOT_ENABLED");
    assert.strictEqual(disableAgain.error.class, "E-ENV");
    // Re-enable after disable works (deterministic, state-driven).
    assert.strictEqual(registry.enable("hotkeys").code, "MR_OK");
    assert.strictEqual(registry.describe("hotkeys").descriptor.enabled, true);
  });

  it("MR-08: a conflict with an enabled module fails closed by name", () => {
    const registry = makeRegistry();
    registerReal(registry, ["hotkeys"]);
    registry.enable("hotkeys");
    const registered = registry.register(synthText({ id: "conflict-mod", conflicts: ["hotkeys"] }));
    assert.strictEqual(registered.ok, true);
    const validation = registry.validate("conflict-mod");
    assert.strictEqual(validation.ok, false);
    assert.ok(hasViolation(validation, "conflict_enabled"));
    assert.strictEqual(validation.violations.find((v) => v.code === "conflict_enabled").detail, "hotkeys");
    // enable names the SPECIFIC rule (conflict first, generic second) —
    // 01 §13.5: the user is told which rule failed.
    const enabled = registry.enable("conflict-mod");
    assert.strictEqual(enabled.ok, false);
    assert.strictEqual(enabled.code, "CONFLICT_MODULE_ENABLED");
    assert.strictEqual(enabled.error.class, "E-CONFLICT");
    assert.strictEqual(registry.isEnabled("conflict-mod"), false);
    // Conflict state is live: once hotkeys is disabled the same module validates clean.
    registry.disable("hotkeys");
    assert.strictEqual(registry.validate("conflict-mod").ok, true);
    assert.strictEqual(registry.enable("conflict-mod").code, "MR_OK");
    // The conflict still refuses the OTHER direction once conflict-mod is enabled.
    const reenable = registry.enable("hotkeys");
    assert.strictEqual(reenable.code, "CONFLICT_MODULE_ENABLED", "hotkeys now conflicts with enabled conflict-mod");
  });

  it("MR-09: capability resolution is mediated, never guessed", () => {
    const registry = makeRegistry();
    registerReal(registry);
    // Unresolved while the provider is registered but not enabled.
    assert.strictEqual(registry.resolveCapability("toolbus:capabilities").code, "CAPABILITY_UNRESOLVED");
    registry.enable("tool-bus");
    const resolved = registry.resolveCapability("toolbus:capabilities");
    assert.strictEqual(resolved.ok, true);
    assert.strictEqual(resolved.code, "MR_OK");
    assert.strictEqual(resolved.module, "tool-bus");
    // Unknown capability: E-ENV, never a substitute.
    const unresolved = registry.resolveCapability("no:such:capability");
    assert.strictEqual(unresolved.code, "CAPABILITY_UNRESOLVED");
    assert.strictEqual(unresolved.error.class, "E-ENV");
    assert.strictEqual(unresolved.module, null);
    // Two enabled providers: AMBIGUOUS — never silently pick a side.
    registry.register(synthText({ id: "twin-one", provides: ["shared:cap"] }));
    registry.register(synthText({ id: "twin-two", provides: ["shared:cap"] }));
    registry.enable("twin-one");
    registry.enable("twin-two");
    const ambiguous = registry.resolveCapability("shared:cap");
    assert.strictEqual(ambiguous.ok, false);
    assert.strictEqual(ambiguous.code, "CAPABILITY_AMBIGUOUS");
    assert.strictEqual(ambiguous.error.class, "E-CONFLICT");
    assert.deepStrictEqual(ambiguous.modules, ["twin-one", "twin-two"]);
    // Disable one side and it resolves — state-driven, deterministic.
    registry.disable("twin-two");
    assert.strictEqual(registry.resolveCapability("shared:cap").module, "twin-one");
  });

  it("MR-10: the INVOKE gate allows declared phases/tools only", () => {
    const registry = makeRegistry();
    registerReal(registry);
    // Not enabled yet -> named refusal.
    const notEnabled = registry.canInvoke("hotkeys", { phase: "RUN" });
    assert.strictEqual(notEnabled.code, "MODULE_NOT_ENABLED");
    assert.strictEqual(notEnabled.error.class, "E-ENV");
    registry.enable("hotkeys");
    // Happy paths: declared phase, no phase, declared tool.
    assert.strictEqual(registry.canInvoke("hotkeys", { phase: "RUN", tools: ["files"] }).code, "MR_OK");
    assert.strictEqual(registry.canInvoke("hotkeys", {}).code, "MR_OK");
    // Undeclared phase (hotkeys declares RUN, TEST, SHIP).
    const phase = registry.canInvoke("hotkeys", { phase: "BUILD" });
    assert.strictEqual(phase.code, "PHASE_NOT_DECLARED");
    assert.strictEqual(phase.error.class, "E-CONFLICT");
    // Undeclared tool (M3: undeclared tool use is a contract violation).
    const tool = registry.canInvoke("hotkeys", { tools: ["browser tool"] });
    assert.strictEqual(tool.code, "TOOL_UNDECLARED");
    assert.strictEqual(tool.error.class, "E-CONFLICT");
    // Malformed invocations (shape checked before anything else).
    for (const bad of ["RUN", [], 42, null, { phase: "" }, { tools: "files" }, { tools: [""] }, { unexpected: true }]) {
      const result = registry.canInvoke("hotkeys", bad);
      assert.strictEqual(result.code, "INVALID_INVOCATION", JSON.stringify(bad));
      assert.strictEqual(result.error.class, "E-INPUT");
    }
    // Disabled after enable -> refusal again.
    registry.disable("hotkeys");
    assert.strictEqual(registry.canInvoke("hotkeys", { phase: "RUN" }).code, "MODULE_NOT_ENABLED");
  });
});

// ---------------------------------------------------------------------------
// Block 3 — tool dependencies, configuration, determinism (MR-11 … MR-13)
// ---------------------------------------------------------------------------
describe("Module Registry integration (MR-11 … MR-13)", () => {
  it("MR-11: an unavailable tool dependency fails closed through the Tool Bus", () => {
    const registry = makeRegistry(); // pristine Task 07 bus wired
    const registered = registry.register(synthText({ id: "blocked-tool", requires: { tools: ["search providers"] } }));
    assert.strictEqual(registered.ok, true, "submission accepted — VALIDATE is where it is named");
    const validation = registry.validate("blocked-tool");
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.code, "MANIFEST_INVALID");
    const violation = validation.violations.find((v) => v.code === "tool_unavailable");
    assert.ok(violation, JSON.stringify(validation.violations));
    assert.ok(violation.detail.startsWith("search providers: "), violation.detail);
    const enabled = registry.enable("blocked-tool");
    assert.strictEqual(enabled.ok, false);
    assert.strictEqual(enabled.code, "MANIFEST_INVALID");
    const invoked = registry.canInvoke("blocked-tool", { phase: "RUN" });
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "MANIFEST_INVALID");
    assert.strictEqual(registry.isEnabled("blocked-tool"), false, "never enabled — nothing could run");
    // Contrast: the same manifest passes when the tool IS available.
    const available = makeRegistry();
    available.register(synthText({ id: "available-tool", requires: { tools: ["files"] } }));
    assert.strictEqual(available.validate("available-tool").ok, true);
  });

  it("MR-12: configuration fails closed at construction", () => {
    assert.throws(
      () => createModuleRegistry({ toolBus: {} }),
      (error) => error.code === "E_INPUT_INVALID_REGISTRY_CONFIG"
        && error.grimoire.class === "E-INPUT"
        && typeof error.grimoire.message === "string",
      "toolBus without check() must throw"
    );
    assert.throws(
      () => createModuleRegistry({ availableTools: "files" }),
      (error) => error.code === "E_INPUT_INVALID_REGISTRY_CONFIG",
      "availableTools must be an array"
    );
    assert.throws(
      () => createModuleRegistry({ availableTools: [""] }),
      (error) => error.code === "E_INPUT_INVALID_REGISTRY_CONFIG",
      "availableTools entries must be non-empty strings"
    );
    // No bus, no list: the documented default tool set (files) applies.
    assert.deepStrictEqual([...DEFAULT_AVAILABLE_TOOLS], ["files"]);
    const legacy = createModuleRegistry();
    assert.strictEqual(legacy.checkTool("files").ok, true);
    assert.strictEqual(legacy.checkTool("browser tool").ok, false);
    assert.strictEqual(legacy.checkTool("browser tool").code, "TOOL_UNAVAILABLE");
    assert.strictEqual(legacy.checkTool("").code, "INVALID_INVOCATION");
    legacy.register(synthText({ id: "legacy-mod", requires: { tools: ["browser tool"] } }));
    assert.strictEqual(legacy.validate("legacy-mod").ok, false, "legacy path still fails closed on a missing tool");
    assert.ok(legacy.validate("legacy-mod").violations.some((v) => v.code === "tool_unavailable"));
  });

  it("MR-13: results and reports are deterministic with no volatile data", () => {
    const buildAll = () => {
      const registry = makeRegistry();
      registerReal(registry);
      registry.enable("hotkeys");
      registry.enable("tool-bus");
      return registry;
    };
    const one = buildAll();
    const two = buildAll();
    assert.deepStrictEqual(one.validateAll(), two.validateAll(), "equal state => equal validation");
    assert.deepStrictEqual(one.list(), two.list(), "equal state => equal descriptors");
    const reportA = buildRegistryReport(one);
    const reportB = buildRegistryReport(one);
    const reportC = buildRegistryReport(two);
    assert.strictEqual(reportA.text, reportB.text, "repeated reports byte-identical");
    assert.strictEqual(reportA.sha256, reportB.sha256);
    assert.strictEqual(reportA.text, reportC.text, "fresh equal registry => same bytes");
    assert.strictEqual(reportA.sha256, sha256(reportA.text), "sha256 of its own bytes");
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/.test(reportA.text), "no uuid-like ids");
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(reportA.text), "no timestamps");
    for (const needle of [
      "# Grimoire v3 — Module Registry Report",
      "| Registered | 3 |",
      "| Valid | 3 |",
      "| Enabled | 2 |",
      "| Violations | 0 |",
      "## 2. Modules",
      "## 3. Violations",
      "## 4. Capabilities",
      "| toolbus:capabilities | tool-bus | RESOLVED |",
      "| module-registry:validate | — | UNRESOLVED |",
      "## 5. Declared tools",
      "| files | yes | hotkeys, module-registry, tool-bus |",
    ]) {
      assert.ok(reportA.text.includes(needle), `report must state: ${needle}`);
    }
    // The report of a dirty registry states the failure instead of pretending.
    const dirty = makeRegistry();
    dirty.register(fixture("mut_manifest_incomplete.yaml"));
    const dirtyReport = buildRegistryReport(dirty);
    assert.ok(dirtyReport.text.includes("| Valid | 0 |"));
    assert.ok(dirtyReport.text.includes("missing_requires"));
    assert.ok(dirtyReport.text.includes("missing_errors"));
    assert.strictEqual(dirtyReport.sha256, sha256(dirtyReport.text));
  });
});

// ---------------------------------------------------------------------------
// Block 4 — AC-19 + manifest mutations + export surface (MR-14 … MR-16)
// ---------------------------------------------------------------------------
describe("Module Registry mutations (MR-14 … MR-16)", () => {
  it("MR-14: AC-19 — an incomplete manifest is rejected and never runs", () => {
    const registry = makeRegistry();
    registerReal(registry, ["tool-bus"]);
    registry.enable("tool-bus");
    const registered = registry.register(fixture("mut_manifest_incomplete.yaml"));
    assert.strictEqual(registered.ok, true, "REGISTER accepts the submission (03 §3)");
    // VALIDATE names the exact missing rules (03 §2 mandatory fields).
    const validation = registry.validate("hotkeys");
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.code, "MANIFEST_INVALID");
    assert.ok(hasViolation(validation, "missing_requires"), JSON.stringify(validation.violations));
    assert.ok(hasViolation(validation, "missing_errors"));
    // ENABLE refuses with the named violations attached.
    const enabled = registry.enable("hotkeys");
    assert.strictEqual(enabled.ok, false);
    assert.strictEqual(enabled.code, "MANIFEST_INVALID");
    assert.ok(enabled.violations.some((v) => v.code === "missing_requires"));
    // INVOKE is refused before anything could run (no partial execution).
    const invoked = registry.canInvoke("hotkeys", { phase: "RUN", tools: ["files"] });
    assert.strictEqual(invoked.ok, false);
    assert.strictEqual(invoked.code, "MANIFEST_INVALID");
    assert.strictEqual(registry.isEnabled("hotkeys"), false);
    // Nothing about the broken module ever got exposed.
    const described = registry.describe("hotkeys");
    assert.strictEqual(described.descriptor.enabled, false);
    assert.deepStrictEqual(described.descriptor.provides, ["hotkeys:validate", "hotkeys:activation-gate", "hotkeys:execute"]);
    assert.strictEqual(
      registry.resolveCapability("hotkeys:execute").code,
      "CAPABILITY_UNRESOLVED",
      "its provides are never resolvable while it cannot be enabled"
    );
    const all = registry.validateAll();
    assert.strictEqual(all.ok, false, "one dirty module fails the aggregate");
    assert.strictEqual(all.modules.find((m) => m.id === "hotkeys").ok, false);
  });

  it("MR-15/1: a non-loop phase fails validation (fixture byte-different)", () => {
    const registry = makeRegistry();
    const registered = registry.register(fixture("mut_manifest_phase.yaml"));
    assert.strictEqual(registered.ok, true);
    const validation = registry.validate(registered.id);
    assert.strictEqual(validation.ok, false);
    const violation = validation.violations.find((v) => v.code === "invalid_phase");
    assert.ok(violation, JSON.stringify(validation.violations));
    assert.strictEqual(violation.detail, "DEPLOY");
    assert.strictEqual(registry.enable(registered.id).code, "MANIFEST_INVALID");
    assert.strictEqual(registry.canInvoke(registered.id, { phase: "DEPLOY" }).code, "MANIFEST_INVALID");
  });

  it("MR-15/2: a non-Core error class fails validation (fixture byte-different)", () => {
    const registry = makeRegistry();
    const registered = registry.register(fixture("mut_manifest_error_class.yaml"));
    assert.strictEqual(registered.ok, true);
    const validation = registry.validate(registered.id);
    assert.strictEqual(validation.ok, false);
    const violation = validation.violations.find((v) => v.code === "invalid_error_class");
    assert.ok(violation, JSON.stringify(validation.violations));
    assert.strictEqual(violation.detail, "E-CUSTOM");
    assert.strictEqual(registry.enable(registered.id).code, "MANIFEST_INVALID");
  });

  it("MR-15/3: a core range that rejects the running Core fails validation (fixture byte-different)", () => {
    const registry = makeRegistry();
    const registered = registry.register(fixture("mut_manifest_core_range.yaml"));
    assert.strictEqual(registered.ok, true);
    const validation = registry.validate(registered.id);
    assert.strictEqual(validation.ok, false);
    const violation = validation.violations.find((v) => v.code === "core_version_mismatch");
    assert.ok(violation, JSON.stringify(validation.violations));
    assert.ok(violation.detail.includes(">=2.0 <3.0"), violation.detail);
    assert.ok(violation.detail.includes("Core 3.0"), violation.detail);
    assert.strictEqual(registry.enable(registered.id).code, "MANIFEST_INVALID");
  });

  it("MR-15/4: a colliding module id fails registration (fixture byte-different)", () => {
    const registry = makeRegistry();
    registerReal(registry, ["tool-bus"]);
    const registered = registry.register(fixture("mut_manifest_id_collision.yaml"));
    assert.strictEqual(registered.ok, false);
    assert.strictEqual(registered.code, "MODULE_DUPLICATE");
    assert.strictEqual(registered.error.class, "E-CONFLICT");
    assert.strictEqual(registered.id, "tool-bus");
    // The real tool-bus module is untouched and still the only occupant.
    assert.strictEqual(registry.list().length, 1);
    assert.strictEqual(registry.validate("tool-bus").ok, true);
  });

  it("MR-16: export surface, parser, and error-class conformance", () => {
    // Every exported API is reachable and behaves deterministically.
    assert.deepStrictEqual([...EIGHT_LOOP_PHASES], [
      "UNDERSTAND", "PLAN", "BUILD", "RUN", "TEST", "DEBUG", "IMPROVE", "SHIP",
    ]);
    assert.deepStrictEqual([...MANIFEST_FIELDS], [
      "id", "version", "core", "name", "purpose", "phases", "requires",
      "provides", "consumes", "conflicts", "outputs", "errors", "entry",
    ]);
    assert.deepStrictEqual({ ...CORE_CONTRACT_VERSION }, { major: 3, minor: 0 });
    // Result codes: every non-success code maps to a class the module declares
    // (03 §2 rule M5), and that subset is inside the Core seven (01 §11.1).
    for (const klass of MODULE_ERROR_CLASSES) assert.ok(CORE_ERROR_CLASSES.includes(klass), klass);
    // The error-model helpers are part of the exported surface: deterministic.
    const structured = makeError("E-VALID", "MR_TEST", "a structured error", "detail-value");
    assert.deepStrictEqual(structured, {
      class: "E-VALID",
      code: "MR_TEST",
      message: "a structured error",
      detail: "detail-value",
    });
    assert.deepStrictEqual(makeError("E-ENV", "MR_TEST", "msg"), {
      class: "E-ENV",
      code: "MR_TEST",
      message: "msg",
      detail: null,
    });
    assert.strictEqual(isCoreErrorClass("E-VALID"), true);
    assert.strictEqual(isCoreErrorClass("E-DEP"), true);
    assert.strictEqual(isCoreErrorClass("E-NOPE"), false);
    assert.strictEqual(isCoreErrorClass(null), false);
    for (const [code, klass] of Object.entries(RESULT_CODES)) {
      if (klass === null) {
        assert.strictEqual(code, "MR_OK");
        continue;
      }
      assert.ok(MODULE_ERROR_CLASSES.includes(klass), `${code} -> ${klass} must be a declared class`);
      assert.ok(CORE_ERROR_CLASSES.includes(klass), `${code} -> ${klass} must be a Core class`);
    }
    // Parser: real text, unsupported syntax, non-string input.
    const parsed = parseManifest(REAL.hotkeys);
    assert.strictEqual(parsed.manifest.id, "hotkeys");
    assert.deepStrictEqual(parsed.violations, []);
    const garbage = parseManifest("\tthis:is:broken\nnot a mapping line\n");
    assert.ok(garbage.violations.some((v) => v.code === "manifest_unsupported_syntax"));
    const notString = parseManifest(42);
    assert.strictEqual(notString.manifest, null);
    assert.ok(notString.violations.some((v) => v.code === "manifest_not_string"));
    // validateManifest is usable standalone (pure function over a parsed doc).
    const clean = validateManifest(parsed.manifest, { enabledIds: [], toolCheck: () => ({ ok: true, code: "MR_OK" }) });
    assert.deepStrictEqual(clean, []);
    // Conflicts duty in both directions, standalone:
    const forward = validateManifest(parseManifest(synthText({ conflicts: ["hotkeys"] })).manifest, {
      enabledIds: ["hotkeys"],
      enabledConflictSources: [],
      toolCheck: () => ({ ok: true, code: "MR_OK" }),
    });
    assert.ok(forward.some((v) => v.code === "conflict_enabled" && v.detail === "hotkeys"), "own conflicts vs enabled module");
    const reverse = validateManifest(parsed.manifest, {
      enabledIds: [],
      enabledConflictSources: [{ id: "conflict-mod", conflicts: ["hotkeys"] }],
      toolCheck: () => ({ ok: true, code: "MR_OK" }),
    });
    assert.ok(reverse.some((v) => v.code === "conflict_enabled" && v.detail === "conflict-mod"), "enabled module's conflict vs this one");
    // The registry's report builder refuses nothing but is total: empty registry.
    const empty = createModuleRegistry();
    const emptyReport = buildRegistryReport(empty);
    assert.ok(emptyReport.text.includes("| Registered | 0 |"));
    assert.ok(emptyReport.text.includes("| none |"));
    assert.strictEqual(emptyReport.sha256, sha256(emptyReport.text));
  });
});
