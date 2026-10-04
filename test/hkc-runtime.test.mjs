// Grimoire v3 — L2 Hotkeys module: runtime executor suite (Task 06).
//
// HKR coverage map (documented in docs/v3/05-acceptance-tests.md, Group J,
// and docs/v3/14-hotkey-runtime.md §8):
//   HKR-01  A  all 14 ACTIVE records resolve          — this file, block 1
//   HKR-02  B  every non-ACTIVE record refused, zero executions
//   HKR-03  C  unknown key/command refused
//   HKR-04  D  ACTIVE record without a handler -> UNIMPLEMENTED
//   HKR-05  E  a real handler executes successfully   — block 2
//   HKR-06  F  unavailable tool -> TOOL_REQUIRED
//   HKR-07  G  throwing handler -> deterministic EXECUTION_ERROR
//   HKR-08  H  resolveHotkey never executes a handler (purity)
//   HKR-09  I  malformed input / invalid registry never reach execution
//   HKR-12     source traceability + structured result fields  — block 3
//   HKR-13     runtime report determinism, states never collapsed
//   HKR-14     conflicting keys refused, never silently resolved
//   HKR-10  J  determinism (same input -> identical output)     — block 4
//   HKR-11  K  the 10 required runtime mutations fail safely    — block 5
//
// Task 05 suites (test/hkc-gate.test.mjs, test/hkc-coverage.test.mjs) are
// untouched by this file and must keep passing.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createRuntime,
  buildRuntimeReport,
  EXECUTION_CLASSES,
  RESULT_CODES,
} from "../modules/hotkeys/src/runtime.mjs";
import { defineHandler, DEFAULT_HANDLERS } from "../modules/hotkeys/src/handlers.mjs";
import { validateRegistryText, NINE_MODES } from "../modules/hotkeys/src/loader.mjs";

const ROOT = process.cwd();
const ORIG = readFileSync(path.join(ROOT, "docs/v3/12-hotkey-registry.md"), "utf8");
const FIX = path.join(ROOT, "test/_fixtures/");

// The directive's canonical ACTIVE set (§5).
const ACTIVE_KEYS = ["PTn", "Pi", "R", "PN", "W", "A", "S", "SS", "D", "G", "H", "C", "SoS", "Q"];
const canonicalCommand = (key) => `grimoire.key.${key}`;

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function makeRuntime(overrides = {}) {
  return createRuntime({ registryText: ORIG, root: ROOT, ...overrides });
}

const PRISTINE = validateRegistryText(ORIG, { root: ROOT });

// The loader preserves the registry's markdown code spans on the Command
// cell; the canonical id is the unquoted value (runtime normalizes, tests
// strip here for the same reason).
const stripTicks = (value) => String(value).replace(/^`+|`+$/g, "");

// Wrap every Grimoire command in a counting spy: if the gate or the resolver
// ever leaks, at least one counter trips and the test fails.
function instrumentedGrimoireHandlers() {
  const handlers = {};
  const counters = new Map();
  for (const record of PRISTINE.records) {
    if (record.section !== "grimoire") continue;
    const command = stripTicks(record.command);
    const counter = { runs: 0 };
    handlers[command] = defineHandler({
      id: `spy.${record.key}`,
      command,
      requiredTools: ["files"],
      run: () => {
        counter.runs += 1;
        return { spy: record.key };
      },
    });
    counters.set(record.key, counter);
  }
  assert.strictEqual(Object.keys(handlers).length, 43);
  return { handlers, counters };
}

function totalRuns(counters) {
  let total = 0;
  for (const counter of counters.values()) total += counter.runs;
  return total;
}

// Count wrappers around the DEFAULT handler set (counters keyed by hotkey key).
function countedDefaultHandlers() {
  const handlers = {};
  const counters = new Map();
  for (const key of ["R", "PN", "PTn"]) {
    const base = DEFAULT_HANDLERS[canonicalCommand(key)];
    const counter = { runs: 0 };
    handlers[canonicalCommand(key)] = defineHandler({
      id: base.id,
      command: base.command,
      requiredTools: [...base.requiredTools],
      validateArgs: base.validateArgs,
      run: (ctx) => {
        counter.runs += 1;
        return base.run(ctx);
      },
    });
    counters.set(key, counter);
  }
  return { handlers, counters };
}

// Real mutations: line-targeted replacements that must (a) find their target
// and (b) produce text byte-different from the authoritative registry.
function mutateLine(text, linePrefix, find, replace, label) {
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.startsWith(linePrefix));
  assert.notStrictEqual(index, -1, `${label}: line ${linePrefix} not found`);
  assert.ok(lines[index].includes(find), `${label}: ${JSON.stringify(find)} not in target line`);
  lines[index] = lines[index].replace(find, replace);
  const mutated = lines.join("\n");
  assert.notStrictEqual(mutated, ORIG, `${label} must be byte-different from the registry`);
  return mutated;
}

function mutateOnce(text, find, replace, label) {
  const count = text.split(find).length - 1;
  assert.strictEqual(count, 1, `${label}: expected exactly 1 occurrence of ${JSON.stringify(find)}, found ${count}`);
  const mutated = text.replace(find, replace);
  assert.notStrictEqual(mutated, ORIG, `${label} must be byte-different from the registry`);
  return mutated;
}

// ---------------------------------------------------------------------------
// Block 1 — resolution duties (HKR-01 … HKR-04)
// ---------------------------------------------------------------------------
describe("runtime resolution duties (HKR-01 … HKR-04)", () => {
  it("HKR-01: all 14 ACTIVE records resolve past validation and the gate (contract A)", () => {
    const rt = makeRuntime();
    const observed = {};
    for (const key of ACTIVE_KEYS) {
      const input = key === "PTn" ? { key, args: { part: 1 } } : { key };
      const res = rt.resolveHotkey(input);
      assert.strictEqual(res.stage, "resolve", key);
      assert.strictEqual(res.states.validated, true, key);
      assert.strictEqual(res.states.allowed, true, key);
      assert.strictEqual(res.states.resolved, true, key);
      assert.strictEqual(res.authorized, true, key);
      assert.ok(
        ["EXECUTABLE", "UNIMPLEMENTED", "TOOL_REQUIRED"].includes(res.classification),
        `${key} resolved to ${res.classification}`
      );
      assert.ok(EXECUTION_CLASSES.includes(res.classification), key);
      // Traceability (§14): identity, source anchor, registry status, Core
      // mode, handler identity, classification, final result code.
      assert.strictEqual(res.trace.key, key, key);
      assert.strictEqual(res.trace.command, canonicalCommand(key), key);
      assert.ok(typeof res.trace.source === "string" && res.trace.source.includes(":"), `${key} source anchor`);
      assert.strictEqual(res.trace.registry_status, "ACTIVE", key);
      assert.strictEqual(res.trace.validation_status, "VALIDATED", key);
      assert.ok(NINE_MODES.includes(res.trace.core_mode), `${key} mode ${res.trace.core_mode}`);
      assert.strictEqual(res.trace.classification, res.classification, key);
      assert.strictEqual(res.trace.code, res.code, key);
      observed[res.classification] = (observed[res.classification] || 0) + 1;
    }
    // The exact split of this repository: 3 implemented, 10 without handler,
    // 1 blocked on an unavailable tool.
    assert.deepStrictEqual(observed, { EXECUTABLE: 3, UNIMPLEMENTED: 10, TOOL_REQUIRED: 1 });
    // The key set equals the directive's canonical 14 and the registry's.
    const registryActive = PRISTINE.records
      .filter((r) => r.activation_status === "ACTIVE")
      .map((r) => r.key)
      .sort();
    assert.deepStrictEqual([...ACTIVE_KEYS].sort(), registryActive);
  });

  it("HKR-02: every non-ACTIVE record is REFUSED with zero handler executions (contract B)", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    const rt = makeRuntime({ handlers });
    const nonActive = PRISTINE.records.filter((r) => r.activation_status !== "ACTIVE");
    assert.strictEqual(nonActive.length, 34);
    const expectedCode = {
      ADAPTER_REQUIRED: "E_CONFLICT_ADAPTER_REQUIRED",
      BLOCKED_CONFLICT: "E_CONFLICT_BLOCKED_CONFLICT",
      BLOCKED_AMBIGUOUS: "E_CONFLICT_BLOCKED_AMBIGUOUS",
      BLOCKED_INSUFFICIENT_INFO: "E_CONFLICT_BLOCKED_INSUFFICIENT_INFO",
      HISTORICAL_REMOVED: "E_CONFLICT_HISTORICAL_REMOVED",
      METADATA_ONLY: "E_CONFLICT_METADATA_ONLY",
    };
    for (const record of nonActive) {
      const res = rt.executeHotkey({ key: record.key });
      assert.strictEqual(res.classification, "REFUSED", `${record.key} must be REFUSED`);
      assert.strictEqual(res.code, expectedCode[record.activation_status], record.key);
      assert.strictEqual(res.error.class, "E-CONFLICT", record.key);
      assert.strictEqual(res.executed, false, record.key);
      assert.strictEqual(res.ok, false, record.key);
      assert.strictEqual(res.states.refused, true, record.key);
      assert.strictEqual(res.states.allowed, false, record.key);
      assert.strictEqual(res.output, null, record.key);
      assert.deepStrictEqual(res.artifacts, [], record.key);
    }
    assert.strictEqual(totalRuns(counters), 0, "no handler may ever run for a non-ACTIVE record");
  });

  it("HKR-03: unknown key and unknown command are refused (contract C)", () => {
    const rt = makeRuntime();
    const cases = [
      [{ key: "XX" }, "E_INPUT_UNKNOWN_KEY"],
      [{ key: "frobnicate" }, "E_INPUT_UNKNOWN_KEY"],
      [{ command: "grimoire.key.XX" }, "E_INPUT_UNKNOWN_COMMAND"],
      [{ command: "not.a.command" }, "E_INPUT_UNKNOWN_COMMAND"],
    ];
    for (const [input, code] of cases) {
      const res = rt.executeHotkey(input);
      assert.strictEqual(res.classification, "REFUSED", code);
      assert.strictEqual(res.code, code);
      assert.strictEqual(res.error.class, "E-INPUT");
      assert.strictEqual(res.executed, false);
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.trace, null, "no record was resolved");
      assert.strictEqual(res.states.validated, true, "the registry itself was validated");
      assert.strictEqual(res.states.allowed, false);
      assert.strictEqual(res.states.resolved, false);
      assert.deepStrictEqual(res.artifacts, []);
    }
  });

  it("HKR-04: an ACTIVE record without a handler returns UNIMPLEMENTED (contract D)", () => {
    const rt = makeRuntime(); // default handler set: R, PN, PTn only
    for (const key of ["W", "Pi", "Q", "H", "C", "A", "S", "SS", "D", "G"]) {
      const res = rt.executeHotkey({ key });
      assert.strictEqual(res.classification, "UNIMPLEMENTED", key);
      assert.strictEqual(res.code, "E_ENV_HANDLER_MISSING", key);
      assert.strictEqual(res.error.class, "E-ENV", key);
      assert.strictEqual(res.error.detail, canonicalCommand(key), key);
      assert.strictEqual(res.states.unimplemented, true, key);
      assert.strictEqual(res.states.resolved, true, "the record itself resolved");
      assert.strictEqual(res.states.executed, false, key);
      assert.strictEqual(res.executed, false, key);
      assert.strictEqual(res.ok, false, key);
      assert.strictEqual(res.status, "blocked", key);
      assert.strictEqual(res.output, null, key);
      assert.deepStrictEqual(res.artifacts, [], key);
      assert.ok(res.remaining_issues[0].includes(canonicalCommand(key)), key);
      assert.strictEqual(res.trace.handler_id, null, key);
    }
    // UNIMPLEMENTED is never silently upgraded: no evidence of execution.
    const res = rt.executeHotkey({ key: "W" });
    assert.ok(res.evidence.some((line) => line.startsWith("handler: none for")));
  });
});
// ---------------------------------------------------------------------------
// Block 2 — execution duties (HKR-05 … HKR-08)
// ---------------------------------------------------------------------------
describe("runtime execution duties (HKR-05 … HKR-08)", () => {
  it("HKR-05: real handlers execute and return the opened document (contract E)", () => {
    const rt = makeRuntime();
    const readme = rt.executeHotkey({ key: "R" });
    assert.strictEqual(readme.classification, "EXECUTABLE");
    assert.strictEqual(readme.code, "OK_EXECUTED");
    assert.strictEqual(readme.ok, true);
    assert.strictEqual(readme.status, "success");
    assert.strictEqual(readme.executed, true);
    assert.deepStrictEqual(
      [readme.states.validated, readme.states.allowed, readme.states.resolved, readme.states.executable, readme.states.executed],
      [true, true, true, true, true]
    );
    const actual = readFileSync(path.join(ROOT, "Readme.md"), "utf8");
    assert.strictEqual(readme.output.file, "Readme.md");
    assert.strictEqual(readme.output.content, actual, "the handler really read the document");
    assert.strictEqual(readme.output.bytes, Buffer.byteLength(actual, "utf8"));
    assert.strictEqual(readme.output.sha256, sha256(actual));
    assert.strictEqual(readme.trace.handler_id, "handler.readme");
    assert.deepStrictEqual(readme.artifacts, ["hotkey-runtime-result:grimoire.key.R"]);
    assert.deepStrictEqual(readme.remaining_issues, []);
    // Command invocation resolves the same record.
    const pn = rt.executeHotkey({ command: "grimoire.key.PN" });
    assert.strictEqual(pn.ok, true);
    assert.strictEqual(pn.output.file, "PatchNotes.md");
    // PTn resolves the real repository file for part n — including the
    // non-obvious Part4 — by inspecting the file set, never by guessing.
    const part1 = rt.executeHotkey({ key: "PTn", args: { part: 1 } });
    assert.strictEqual(part1.ok, true);
    assert.strictEqual(part1.output.file, "Part1.md");
    const part4 = rt.executeHotkey({ key: "PTn", args: { part: 4 } });
    assert.strictEqual(part4.ok, true);
    assert.strictEqual(part4.output.file, "Part4_AllLessons.md");
  });

  it("HKR-06: an unavailable tool returns TOOL_REQUIRED — registry tool and handler tool (contract F)", () => {
    const rt = makeRuntime();
    // (a) registry-declared tool: SoS requires "search providers" (12 §2),
    // which this runtime does not provide.
    const sos = rt.executeHotkey({ key: "SoS" });
    assert.strictEqual(sos.classification, "TOOL_REQUIRED");
    assert.strictEqual(sos.code, "E_TOOL_UNAVAILABLE");
    assert.strictEqual(sos.error.class, "E-TOOL");
    assert.strictEqual(sos.error.detail, "search providers");
    assert.strictEqual(sos.states.tool_unavailable, true);
    assert.strictEqual(sos.states.resolved, true, "it resolved before failing on tools");
    assert.strictEqual(sos.states.executed, false);
    assert.strictEqual(sos.executed, false);
    assert.strictEqual(sos.status, "blocked");
    assert.deepStrictEqual(sos.artifacts, []);
    // (b) handler-declared tool: the same real R handler, but a runtime
    // without the manifest's "files" tool.
    const counter = { runs: 0 };
    const base = DEFAULT_HANDLERS["grimoire.key.R"];
    const bare = makeRuntime({
      availableTools: [],
      handlers: {
        "grimoire.key.R": defineHandler({
          id: base.id,
          command: base.command,
          requiredTools: [...base.requiredTools],
          validateArgs: base.validateArgs,
          run: (ctx) => {
            counter.runs += 1;
            return base.run(ctx);
          },
        }),
      },
    });
    const res = bare.executeHotkey({ key: "R" });
    assert.strictEqual(res.classification, "TOOL_REQUIRED");
    assert.strictEqual(res.code, "E_TOOL_UNAVAILABLE");
    assert.strictEqual(res.error.detail, "files");
    assert.strictEqual(counter.runs, 0, "no execution without the required tool");
  });

  it("HKR-07: a throwing handler becomes a deterministic EXECUTION_ERROR (contract G)", () => {
    const handlers = { ...DEFAULT_HANDLERS };
    handlers["grimoire.key.PN"] = defineHandler({
      id: "handler.throwing",
      command: "grimoire.key.PN",
      requiredTools: ["files"],
      run: () => {
        throw new Error("synthetic handler failure");
      },
    });
    const rt = makeRuntime({ handlers });
    const first = rt.executeHotkey({ key: "PN" });
    assert.strictEqual(first.classification, "EXECUTION_ERROR");
    assert.strictEqual(first.code, "E_UNKNOWN_EXCEPTION");
    assert.strictEqual(first.error.class, "E-UNKNOWN");
    assert.strictEqual(first.executed, false);
    assert.strictEqual(first.ok, false);
    assert.strictEqual(first.status, "failed");
    assert.strictEqual(first.states.executable, true, "it was executable; execution itself failed");
    assert.strictEqual(first.states.execution_failed, true);
    assert.strictEqual(first.states.executed, false);
    assert.deepStrictEqual(first.artifacts, [], "a failed execution emits no artifact");
    assert.ok(first.remaining_issues[0].includes("E_UNKNOWN_EXCEPTION"));
    assert.ok(first.evidence.some((line) => line.includes("handler.throwing failed")));
    // Deterministic: the same failure produces the same structured output.
    const second = rt.executeHotkey({ key: "PN" });
    assert.deepStrictEqual(second, first);
  });

  it("HKR-08: resolveHotkey never executes a handler — purity (contract H)", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    const rt = makeRuntime({ handlers });
    for (const key of ACTIVE_KEYS) {
      const input = key === "PTn" ? { key, args: { part: 1 } } : { key };
      const res = rt.resolveHotkey(input);
      assert.strictEqual(res.stage, "resolve");
      assert.strictEqual(res.states.executed, false, key);
      assert.ok(!("output" in res), `${key}: a resolution carries no execution output`);
    }
    assert.strictEqual(totalRuns(counters), 0, "resolution is pure");
    // Repeated resolution stays pure.
    rt.resolveHotkey({ key: "R" });
    rt.resolveHotkey({ key: "R" });
    assert.strictEqual(counters.get("R").runs, 0);
    // Only executeResolvedHotkey runs — and only for an authorized resolution.
    const resolution = rt.resolveHotkey({ key: "R" });
    const executed = rt.executeResolvedHotkey(resolution);
    assert.strictEqual(executed.executed, true);
    assert.strictEqual(counters.get("R").runs, 1);
    // A refused resolution passed to executeResolvedHotkey still never runs.
    const refused = rt.resolveHotkey({ key: "K" });
    const echoed = rt.executeResolvedHotkey(refused);
    assert.strictEqual(echoed.classification, "REFUSED");
    assert.strictEqual(echoed.executed, false);
    assert.strictEqual(counters.get("K").runs, 0, "the blocked record's handler never ran");
    assert.strictEqual(totalRuns(counters), 1, "exactly one handler execution in the whole test");
  });
});
// ---------------------------------------------------------------------------
// Block 3 — fail-closed, traceability and reporting duties (HKR-09, HKR-12 … HKR-14)
// ---------------------------------------------------------------------------
describe("runtime fail-closed + reporting duties (HKR-09, HKR-12 … HKR-14)", () => {
  it("HKR-09: malformed input and an invalid registry never reach execution (contract I)", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    // (a) invalid registry: Task 05's proven corruption fixture (asserted
    // byte-different from the authoritative registry before use).
    const corrupted = readFileSync(FIX + "mut_corrupted.txt", "utf8");
    assert.notStrictEqual(corrupted, ORIG);
    const broken = createRuntime({ registryText: corrupted, root: ROOT, handlers });
    assert.strictEqual(broken.validation.ok, false);
    for (const input of [{ key: "R" }, { key: "PTn", args: { part: 1 } }, { command: "grimoire.key.PN" }]) {
      const res = broken.executeHotkey(input);
      assert.strictEqual(res.classification, "REFUSED", "invalid registry refuses everything");
      assert.strictEqual(res.code, "E_VALID_REGISTRY_INVALID");
      assert.strictEqual(res.error.class, "E-VALID");
      assert.strictEqual(res.executed, false);
      assert.strictEqual(res.states.validated, false);
      assert.deepStrictEqual(res.artifacts, []);
    }
    // (b) empty registry text is also an invalid registry, fail-closed.
    const empty = createRuntime({ registryText: "", root: ROOT, handlers });
    assert.strictEqual(empty.validation.ok, false);
    assert.strictEqual(empty.executeHotkey({ key: "R" }).code, "E_VALID_REGISTRY_INVALID");
    // (c) malformed configuration throws at construction: no runtime exists,
    // therefore nothing can execute (13.5).
    assert.throws(() => createRuntime({ registryText: 42, root: ROOT }), (e) => e.code === "E_INPUT_INVALID_RUNTIME_CONFIG");
    assert.throws(() => createRuntime({ registryText: ORIG, root: "" }), (e) => e.code === "E_INPUT_INVALID_RUNTIME_CONFIG");
    assert.throws(() => createRuntime({ registryText: ORIG, root: ROOT, availableTools: "files" }), (e) => e.code === "E_INPUT_INVALID_RUNTIME_CONFIG");
    assert.throws(() => createRuntime({ registryText: ORIG, root: ROOT, handlers: [] }), (e) => e.code === "E_VALID_HANDLER_SPEC");
    // (d) malformed invocations are INVALID_INPUT and never dispatch.
    const rt = makeRuntime({ handlers });
    const malformed = [
      [null, "E_INPUT_INVALID_INVOCATION"],
      ["R", "E_INPUT_INVALID_INVOCATION"],
      [[{ key: "R" }], "E_INPUT_INVALID_INVOCATION"],
      [{}, "E_INPUT_MISSING_IDENTIFIER"],
      [{ key: 42 }, "E_INPUT_INVALID_KEY"],
      [{ command: "" }, "E_INPUT_INVALID_COMMAND"],
      [{ key: "R", bogus: 1 }, "E_INPUT_UNEXPECTED_FIELD"],
      [{ key: "R", command: "grimoire.key.PN" }, "E_INPUT_KEY_COMMAND_MISMATCH"],
      [{ key: "PTn", args: "part=1" }, "E_INPUT_INVALID_ARGS"],
      [{ key: "PTn", args: { part: 99 } }, "E_INPUT_INVALID_ARGS"],
    ];
    for (const [input, code] of malformed) {
      const res = rt.executeHotkey(input);
      assert.strictEqual(res.classification, "INVALID_INPUT", code);
      assert.strictEqual(res.code, code);
      assert.strictEqual(res.error.class, "E-INPUT");
      assert.strictEqual(res.executed, false);
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.states.invalid_input, true);
      assert.deepStrictEqual(res.artifacts, []);
    }
    assert.strictEqual(totalRuns(counters), 0, "nothing executed anywhere in this test");
  });

  it("HKR-12: resolutions retain full source traceability; results carry the 03 §5 structure", () => {
    const rt = makeRuntime();
    const resolution = rt.resolveHotkey({ key: "R" });
    assert.deepStrictEqual(Object.keys(resolution.trace), [
      "key", "command", "source", "registry_status", "validation_status",
      "core_mode", "handler_id", "classification", "code",
    ]);
    assert.ok(resolution.trace.source.includes("Grimoire.md:98"), "source anchor from 12 §2");
    assert.ok(resolution.trace.source.includes("Projects.md:180"), "source anchor from 12 §2");
    const executed = rt.executeHotkey({ key: "R" });
    // 03 §5 structured result — reused field names, no parallel schema.
    assert.strictEqual(executed.module, "hotkeys");
    assert.strictEqual(executed.command, "grimoire.key.R");
    assert.strictEqual(executed.status, "success");
    assert.deepStrictEqual(executed.phase_ledger, ["RESOLVE: done (EXECUTABLE)", "EXECUTE: done (EXECUTABLE)"]);
    assert.ok(executed.evidence[0].includes(`registry: docs/v3/12-hotkey-registry.md sha256 ${sha256(ORIG)}`));
    assert.ok(executed.evidence.some((line) => line.includes("resolve: R -> grimoire.key.R")));
    assert.ok(executed.evidence.some((line) => line.includes("execute: handler.readme -> Readme.md")));
    assert.deepStrictEqual(executed.assumptions, []);
    assert.deepStrictEqual(executed.remaining_issues, []);
    // Validation success is never reported as execution success: W resolved
    // against a fully valid registry but did not execute.
    const unimplemented = rt.executeHotkey({ key: "W" });
    assert.strictEqual(unimplemented.states.validated, true);
    assert.strictEqual(unimplemented.ok, false);
    assert.strictEqual(unimplemented.status, "blocked");
    // Every emitted code is in the documented table, and its error class
    // matches the table's Core class.
    const batch = [
      executed,
      unimplemented,
      rt.executeHotkey({ key: "SoS" }),
      rt.executeHotkey({ key: "K" }),
      rt.executeHotkey({}),
    ];
    for (const result of batch) {
      assert.ok(result.code in RESULT_CODES, `undeclared code ${result.code}`);
      if (result.error) {
        assert.strictEqual(result.error.class, RESULT_CODES[result.code], result.code);
      } else {
        assert.strictEqual(RESULT_CODES[result.code], null, `${result.code} must be a success code`);
      }
      assert.ok(EXECUTION_CLASSES.includes(result.classification));
    }
  });

  it("HKR-13: the runtime report is deterministic and never collapses the nine states", () => {
    const rt = makeRuntime();
    const results = [
      rt.executeHotkey({ key: "R" }),        // executed
      rt.executeHotkey({ key: "PN" }),       // executed
      rt.executeHotkey({ key: "W" }),        // unimplemented
      rt.executeHotkey({ key: "K" }),        // refused
      rt.executeHotkey({}),                   // invalid input
      rt.executeHotkey({ key: "SoS" }),       // tool unavailable
    ];
    const one = buildRuntimeReport(results);
    const two = buildRuntimeReport(results);
    assert.strictEqual(one.text, two.text, "byte-stable on rebuild");
    assert.strictEqual(one.sha256, two.sha256);
    assert.strictEqual(one.sha256, sha256(one.text), "sha256 of its own bytes");
    for (const needle of [
      "| Invocations | 6 |",
      "| Executed | 2 |",
      "| EXECUTABLE | 2 |",
      "| UNIMPLEMENTED | 1 |",
      "| REFUSED | 1 |",
      "| INVALID_INPUT | 1 |",
      "| TOOL_REQUIRED | 1 |",
      "| EXECUTION_ERROR | 0 |",
      "E_ENV_HANDLER_MISSING",
      "E_CONFLICT_BLOCKED_CONFLICT",
      "E_TOOL_UNAVAILABLE",
      "E_INPUT_MISSING_IDENTIFIER",
      "handler.readme",
    ]) {
      assert.ok(one.text.includes(needle), `report must state: ${needle}`);
    }
    // The nine states stay distinct across results — validated, allowed,
    // resolved, executable, executed, refused, unimplemented, tool
    // unavailable, execution failed are never collapsed into one flag.
    const trueFlags = (result) => Object.keys(result.states).filter((flag) => result.states[flag]);
    assert.deepStrictEqual(trueFlags(results[0]), ["validated", "allowed", "resolved", "executable", "executed"]);
    assert.deepStrictEqual(trueFlags(results[2]), ["validated", "allowed", "resolved", "unimplemented"]);
    assert.deepStrictEqual(trueFlags(results[3]), ["validated", "refused"]);
    assert.deepStrictEqual(trueFlags(results[4]), ["invalid_input"]);
    assert.deepStrictEqual(trueFlags(results[5]), ["validated", "allowed", "resolved", "tool_unavailable"]);
  });

  it("HKR-14: conflicting keys are refused, never silently resolved", () => {
    // Rename the METADATA_ONLY `WASD` row's key to `F`: two records now
    // share one key and neither is ACTIVE, so the loader's duplicate duties
    // (ACTIVE keys only) do not flag it — only the runtime lookup must refuse.
    const mutated = mutateLine(ORIG, "| 10 | `WASD` |", "| `WASD` |", "| `F` |", "key collision");
    const rt = createRuntime({ registryText: mutated, root: ROOT });
    assert.strictEqual(rt.validation.ok, true, "this collision is invisible to the loader duties");
    const res = rt.executeHotkey({ key: "F" });
    assert.strictEqual(res.classification, "REFUSED");
    assert.strictEqual(res.code, "E_CONFLICT_AMBIGUOUS_IDENTITY");
    assert.strictEqual(res.error.class, "E-CONFLICT");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.ok, false);
    // The collision blocks only the shared key — other records still gate.
    assert.strictEqual(rt.executeHotkey({ key: "K" }).code, "E_CONFLICT_BLOCKED_CONFLICT");
    assert.strictEqual(rt.executeHotkey({ key: "XX" }).code, "E_INPUT_UNKNOWN_KEY");
  });
});
// ---------------------------------------------------------------------------
// Block 4 — determinism (HKR-10, contract J)
// ---------------------------------------------------------------------------
describe("runtime determinism (HKR-10)", () => {
  it("HKR-10: identical registry + input + handlers + tools produce identical output (contract J)", () => {
    const inputs = [
      { key: "R" },
      { key: "W" },
      { key: "K" },
      { key: "XX" },
      {},
      { key: "PTn", args: { part: 4 } },
      { key: "SoS" },
      { key: "PTn", args: { part: 99 } },
      { command: "grimoire.key.PN" },
    ];
    const a = makeRuntime();
    const b = makeRuntime();
    const runA = inputs.map((input) => a.executeHotkey(input));
    const runB = inputs.map((input) => b.executeHotkey(input));
    assert.deepStrictEqual(runA, runB, "equivalent outputs across runtimes");
    assert.strictEqual(JSON.stringify(runA), JSON.stringify(runB));
    const resolutionA = inputs.map((input) => a.resolveHotkey(input));
    const resolutionB = inputs.map((input) => b.resolveHotkey(input));
    assert.deepStrictEqual(resolutionA, resolutionB);
    // No timestamps and no random ids anywhere in the structured output.
    const text = JSON.stringify(runA);
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(text), "no timestamps");
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/.test(text), "no uuid-like ids");
    // The runtime report is byte-stable over the same results.
    const reportA = buildRuntimeReport(runA);
    const reportB = buildRuntimeReport(runB);
    assert.strictEqual(reportA.text, reportB.text);
    assert.strictEqual(reportA.sha256, reportB.sha256);
  });
});
// ---------------------------------------------------------------------------
// Block 5 — HKR-11: the 10 required runtime mutations, every one failing safely
// ---------------------------------------------------------------------------
describe("HKR-11 — the 10 required runtime mutations all fail safely", () => {
  it("HKR-11/1: ACTIVE → BLOCKED fails safely (validation passes, the gate alone refuses)", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    // PTn: ACTIVE/VALIDATED → BLOCKED_CONFLICT/PENDING_RULING, with the §5
    // summary counts kept consistent so ONLY the activation ruling changed.
    let mutated = mutateLine(ORIG, "| 4 | `PTn` |", "**ACTIVE** | VALIDATED", "BLOCKED_CONFLICT | PENDING_RULING", "PTn status flip");
    mutated = mutateOnce(mutated, "| `ACTIVE` | **14** |", "| `ACTIVE` | **13** |", "summary ACTIVE count");
    mutated = mutateOnce(mutated, "| `BLOCKED_CONFLICT` | **5** |", "| `BLOCKED_CONFLICT` | **6** |", "summary BLOCKED count");
    const rt = createRuntime({ registryText: mutated, root: ROOT, handlers });
    assert.strictEqual(rt.validation.ok, true, "the mutation is a clean status change, not a schema error");
    const res = rt.executeHotkey({ key: "PTn", args: { part: 1 } });
    assert.strictEqual(res.classification, "REFUSED");
    assert.strictEqual(res.code, "E_CONFLICT_BLOCKED_CONFLICT");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.states.allowed, false);
    assert.strictEqual(counters.get("PTn").runs, 0, "the blocked record's handler never ran");
  });

  it("HKR-11/2: ACTIVE → ADAPTER_REQUIRED fails safely (loader rejects, runtime refuses)", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    // PTn: ACTIVE → ADAPTER_REQUIRED with no adapter reference: §4 declares
    // no adapter for it, so validation fails closed.
    let mutated = mutateLine(ORIG, "| 4 | `PTn` |", "**ACTIVE** | VALIDATED", "ADAPTER_REQUIRED | PENDING_ADAPTER", "PTn adapter flip");
    mutated = mutateOnce(mutated, "| `ACTIVE` | **14** |", "| `ACTIVE` | **13** |", "summary ACTIVE count");
    mutated = mutateOnce(mutated, "| `ADAPTER_REQUIRED` | **10** |", "| `ADAPTER_REQUIRED` | **11** |", "summary adapter count");
    const rt = createRuntime({ registryText: mutated, root: ROOT, handlers });
    assert.strictEqual(rt.validation.ok, false);
    assert.ok(rt.validation.violations.some((v) => v.code === "adapter_ref_missing"));
    const res = rt.executeHotkey({ key: "PTn", args: { part: 1 } });
    assert.strictEqual(res.classification, "REFUSED");
    assert.strictEqual(res.code, "E_VALID_REGISTRY_INVALID");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(counters.get("PTn").runs, 0);
  });

  it("HKR-11/3: ACTIVE → UNKNOWN fails safely (loader rejects, the whole runtime refuses)", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    const mutated = mutateLine(ORIG, "| 4 | `PTn` |", "**ACTIVE** | VALIDATED", "UNKNOWN | VALIDATED", "PTn unknown status");
    const rt = createRuntime({ registryText: mutated, root: ROOT, handlers });
    assert.strictEqual(rt.validation.ok, false);
    assert.ok(rt.validation.violations.some((v) => v.code === "invalid_activation_status"));
    const ptn = rt.executeHotkey({ key: "PTn", args: { part: 1 } });
    assert.strictEqual(ptn.classification, "REFUSED");
    assert.strictEqual(ptn.code, "E_VALID_REGISTRY_INVALID");
    assert.strictEqual(ptn.executed, false);
    // An invalid registry refuses EVERY invocation, not just the mutated one.
    const r = rt.executeHotkey({ key: "R" });
    assert.strictEqual(r.code, "E_VALID_REGISTRY_INVALID");
    assert.strictEqual(r.executed, false);
    assert.strictEqual(totalRuns(counters), 0);
  });

  it("HKR-11/4: unknown key injection fails safely", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    const rt = makeRuntime({ handlers });
    for (const key of ["XX", "PTn2", "ENTER"]) {
      const res = rt.executeHotkey({ key });
      assert.strictEqual(res.classification, "REFUSED", key);
      assert.strictEqual(res.code, "E_INPUT_UNKNOWN_KEY", key);
      assert.strictEqual(res.executed, false, key);
      assert.strictEqual(res.trace, null, key);
    }
    assert.strictEqual(totalRuns(counters), 0);
  });

  it("HKR-11/5: unknown command injection fails safely", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    const rt = makeRuntime({ handlers });
    for (const command of ["grimoire.key.XX", "grimoire.key.R.backup", "grimoire.exec.sh"]) {
      const res = rt.executeHotkey({ command });
      assert.strictEqual(res.classification, "REFUSED", command);
      assert.strictEqual(res.code, "E_INPUT_UNKNOWN_COMMAND", command);
      assert.strictEqual(res.executed, false, command);
      assert.strictEqual(res.trace, null, command);
    }
    assert.strictEqual(totalRuns(counters), 0);
  });
  it("HKR-11/6: handler removal turns an executable record into UNIMPLEMENTED, with no execution", () => {
    const { handlers, counters } = countedDefaultHandlers();
    delete handlers["grimoire.key.R"];
    const rt = makeRuntime({ handlers });
    const res = rt.executeHotkey({ key: "R" });
    assert.strictEqual(res.classification, "UNIMPLEMENTED");
    assert.strictEqual(res.code, "E_ENV_HANDLER_MISSING");
    assert.strictEqual(res.executed, false);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, "blocked");
    assert.strictEqual(counters.get("R").runs, 0, "the removed handler never ran");
    assert.strictEqual(totalRuns(counters), 0);
    // Other handlers still work — removal is not a registry change.
    assert.strictEqual(rt.executeHotkey({ key: "PN" }).ok, true);
    assert.strictEqual(counters.get("PN").runs, 1);
  });

  it("HKR-11/7: a mis-bound (replaced) handler fails at construction — never runnable", () => {
    const impostor = { runs: 0 };
    // Keyed under R but bound to PN's command: the classic replacement
    // attack on the dispatch map.
    const misbound = defineHandler({
      id: "handler.impostor",
      command: "grimoire.key.PN",
      requiredTools: ["files"],
      run: () => {
        impostor.runs += 1;
        return { fake: true };
      },
    });
    assert.throws(
      () => makeRuntime({ handlers: { ...DEFAULT_HANDLERS, "grimoire.key.R": misbound } }),
      (e) => e.code === "E_VALID_HANDLER_SPEC"
    );
    // A structurally valid but spec-malformed handler is also rejected.
    assert.throws(
      () => defineHandler({ id: "", command: "grimoire.key.R", requiredTools: [], run: () => ({}) }),
      (e) => e.code === "E_VALID_HANDLER_SPEC"
    );
    assert.throws(
      () => defineHandler({ id: "x", command: "sudo.rm", requiredTools: [], run: () => ({}) }),
      (e) => e.code === "E_VALID_HANDLER_SPEC"
    );
    assert.strictEqual(impostor.runs, 0, "the impostor never became runnable");
  });

  it("HKR-11/8: malformed invocations fail safely across eight shapes", () => {
    const { handlers, counters } = countedDefaultHandlers();
    const rt = makeRuntime({ handlers });
    const shapes = [
      [null, "E_INPUT_INVALID_INVOCATION"],
      ["R", "E_INPUT_INVALID_INVOCATION"],
      [{}, "E_INPUT_MISSING_IDENTIFIER"],
      [{ key: 42 }, "E_INPUT_INVALID_KEY"],
      [{ command: "" }, "E_INPUT_INVALID_COMMAND"],
      [{ key: "R", bogus: 1 }, "E_INPUT_UNEXPECTED_FIELD"],
      [{ key: "R", command: "grimoire.key.PN" }, "E_INPUT_KEY_COMMAND_MISMATCH"],
      [{ key: "PTn", args: { part: 99 } }, "E_INPUT_INVALID_ARGS"],
    ];
    for (const [input, code] of shapes) {
      const res = rt.executeHotkey(input);
      assert.strictEqual(res.classification, "INVALID_INPUT", code);
      assert.strictEqual(res.code, code);
      assert.strictEqual(res.executed, false);
      assert.strictEqual(res.ok, false);
      assert.deepStrictEqual(res.artifacts, []);
      assert.deepStrictEqual(res.output ?? null, null);
    }
    assert.strictEqual(totalRuns(counters), 0, "malformed input never dispatches");
  });

  it("HKR-11/9: an invalid registry fails safely for every invocation", () => {
    const { handlers, counters } = countedDefaultHandlers();
    // A second proven Task 05 fixture (byte-different from the registry):
    // PTn carries an invalid Core mode, so validation fails.
    const fixture = readFileSync(FIX + "mut_active_invalid_mode.txt", "utf8");
    assert.notStrictEqual(fixture, ORIG);
    const rt = createRuntime({ registryText: fixture, root: ROOT, handlers });
    assert.strictEqual(rt.validation.ok, false);
    for (const input of [{ key: "PTn", args: { part: 1 } }, { key: "R" }, { command: "grimoire.key.PN" }]) {
      const res = rt.executeHotkey(input);
      assert.strictEqual(res.classification, "REFUSED");
      assert.strictEqual(res.code, "E_VALID_REGISTRY_INVALID");
      assert.strictEqual(res.executed, false);
      assert.strictEqual(res.ok, false);
      assert.deepStrictEqual(res.artifacts, []);
    }
    assert.strictEqual(totalRuns(counters), 0);
  });

  it("HKR-11/10: unauthorized fallback handlers never run", () => {
    const { handlers, counters } = instrumentedGrimoireHandlers();
    // (a) a "fallback" handler nobody resolved — there is no wildcard
    // dispatch in this runtime, so it must stay unreachable.
    const fallback = { runs: 0 };
    handlers["grimoire.key.FALLBACK"] = defineHandler({
      id: "handler.fallback",
      command: "grimoire.key.FALLBACK",
      requiredTools: [],
      run: () => {
        fallback.runs += 1;
        return { fallback: true };
      },
    });
    // (c-precondition) remove W's handler so the record is ACTIVE but
    // handler-less while the fallback is present.
    delete handlers["grimoire.key.W"];
    const rt = makeRuntime({ handlers });
    // (b) a handler registered for a BLOCKED record's command: the gate must
    // refuse before dispatch ever consults it.
    const blocked = PRISTINE.records.find((r) => r.activation_status === "BLOCKED_CONFLICT");
    assert.ok(blocked);
    const gateRes = rt.executeHotkey({ key: blocked.key });
    assert.strictEqual(gateRes.classification, "REFUSED");
    assert.strictEqual(gateRes.code, "E_CONFLICT_BLOCKED_CONFLICT");
    assert.strictEqual(counters.get(blocked.key).runs, 0, "the blocked record's handler never ran");
    // (c) an ACTIVE record without its own handler stays UNIMPLEMENTED —
    // the fallback is never substituted for missing behavior.
    const w = rt.executeHotkey({ key: "W" });
    assert.strictEqual(w.classification, "UNIMPLEMENTED");
    assert.strictEqual(w.code, "E_ENV_HANDLER_MISSING");
    // (d) a forged resolution object (never issued by this runtime) is
    // refused before any dispatch decision.
    const forged = rt.executeResolvedHotkey({
      stage: "resolve",
      classification: "EXECUTABLE",
      input: { key: "R", command: null },
      states: {},
      trace: null,
    });
    assert.strictEqual(forged.classification, "REFUSED");
    assert.strictEqual(forged.code, "E_VALID_UNAUTHORIZED_RESOLUTION");
    assert.strictEqual(forged.error.class, "E-VALID");
    assert.strictEqual(forged.executed, false);
    assert.strictEqual(forged.ok, false);
    assert.strictEqual(fallback.runs, 0, "the fallback never ran");
    assert.strictEqual(totalRuns(counters), 0, "no instrumented handler ran in this test");
  });
});
