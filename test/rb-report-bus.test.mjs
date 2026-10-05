// Grimoire v3 — Report Bus suite (Task 09).
//
// RB coverage map (documented in docs/v3/05-acceptance-tests.md, Group N,
// and docs/v3/17-report-bus.md §17 Test mapping):
//   RB-01  loads through the public entry point              — this file, block 1
//   RB-02  manifest is structurally valid under the module contract
//   RB-03  valid input produces a successful report
//   RB-04  report sections are deterministic identities
//   RB-05  section ordering is deterministic (order-independent)
//   RB-06  repeated builds produce byte-identical text        — block 2
//   RB-07  repeated builds produce identical SHA-256
//   RB-08  SHA-256 equals the exact report bytes
//   RB-13  no timestamp/random/environment data anywhere
//   RB-14  separate-process generation is byte-identical
//   RB-09  invalid input fails closed                        — block 3
//   RB-10  unknown report/section identity fails closed
//   RB-11  duplicate section identity fails closed
//   RB-12  missing required sections/fields fail closed
//   RB-15  Module Registry data consumed as supplied rows    — block 4
//   RB-16  Tool Bus data consumed as supplied rows
//   RB-17  Hotkey/runtime data consumed as supplied rows
//   RB-18  no L2 import or execution inside the Report Bus
//   RB-19  protected Core and registry files byte-identical  — block 5
//   RB-20  the rest of the repository suite stays green
//   RB-M1…M9  the nine fail-closed mutations (byte-different fixtures)
//
// Mutation fixtures are asserted byte-different from the pristine input
// (test/_fixtures/rb_report_input.json) before they are trusted; the
// reordered fixture (mut_rb_reordered.json) is the determinism control:
// byte-different input that must still produce a byte-identical report.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  createReportBus,
  RESULT_CODES,
  REPORT_TYPE_IDS,
  SECTION_IDS,
  EIGHT_LOOP_PHASES,
  REPORT_BUS_ERROR_CLASSES,
  CORE_ERROR_CLASSES,
} from "../modules/report-bus/index.mjs";
import {
  createModuleRegistry,
  buildRegistryReport,
  EIGHT_LOOP_PHASES as REGISTRY_PHASES,
} from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import {
  createRuntime,
  buildRuntimeReport,
} from "../modules/hotkeys/src/runtime.mjs";

const ROOT = process.cwd();
const FIX = path.join(ROOT, "test/_fixtures/");
const RB_DIR = path.join(ROOT, "modules/report-bus");
const PRISTINE = readFileSync(path.join(FIX, "rb_report_input.json"), "utf8");
const PRISTINE_INPUT = JSON.parse(PRISTINE);
const REGISTRY_TEXT = readFileSync(path.join(ROOT, "docs/v3/12-hotkey-registry.md"), "utf8");

// Protected pins (sha256) — Core 01–04 and the hotkey registry 12.
const PINS = Object.freeze({
  "docs/v3/01-core-specification.md": "9bc4b0c0bdfca652fc0f50e01ff07b4f677148fa20e756548b48d8534c786576",
  "docs/v3/02-architecture-map.md": "b6e25671124e41860e3271b4e387931053ce3c876364181052446a91b35d325a",
  "docs/v3/03-extension-contract.md": "fdc83a0e369823ef84783a98b978bce2fde0cb95b9d2d0d9a3a1ed24ae23e22b",
  "docs/v3/04-decision-rules.md": "4fc9c146e8a88b722a7c3f2b3aaab4b97ad8a91c358888a814f11bd7875057ec",
  "docs/v3/12-hotkey-registry.md": "c861b562caddc05d0df984797518496916def72114a8c36b4c83e8c3dd710139",
});

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, PRISTINE, `${name} must be byte-different from the pristine input`);
  return text;
}

const buildFixture = (bus, name) => bus.build(JSON.parse(fixture(name)));

function makeToolBus() {
  return createToolBus({
    declarationText: loadCapabilityDeclarations(),
    providers: createDefaultProviders(),
    root: ROOT,
  });
}

const REAL_MANIFESTS = ["hotkeys", "tool-bus", "module-registry", "report-bus"].map((id) => ({
  id,
  text: readFileSync(path.join(ROOT, `modules/${id}/manifest.yaml`), "utf8"),
}));

function moduleSources() {
  const files = [path.join(RB_DIR, "index.mjs")];
  for (const name of readdirSync(path.join(RB_DIR, "src")).sort()) {
    if (name.endsWith(".mjs")) files.push(path.join(RB_DIR, "src", name));
  }
  return files.map((file) => ({ file: path.relative(ROOT, file), text: readFileSync(file, "utf8") }));
}

const ROW = {
  module: "hotkeys",
  command: "grimoire.key.R",
  status: "success",
  phase_ledger: ["RUN: done (T1)"],
  artifacts: ["hotkey-runtime-result:grimoire.key.R"],
  evidence: ["executeHotkey(R) → OK_EXECUTED"],
  remaining_issues: [],
  assumptions: [],
};

// ---------------------------------------------------------------------------
describe("Report Bus contract (RB-01 … RB-05)", () => {
  it("RB-01: loads through the public entry point", async () => {
    const entry = await import("../modules/report-bus/index.mjs");
    for (const name of [
      "createReportBus", "RESULT_CODES", "REPORT_TYPES", "SECTION_CATALOG",
      "REPORT_TYPE_IDS", "SECTION_IDS", "validateReportInput",
      "CORE_ERROR_CLASSES", "REPORT_BUS_ERROR_CLASSES", "makeError", "isCoreErrorClass",
    ]) {
      assert.ok(name in entry, `entry must export ${name}`);
    }
    const bus = entry.createReportBus();
    assert.ok(Object.isFrozen(bus), "bus is frozen");
    for (const method of ["build", "validate", "listTypes", "describeType", "listSections", "describeSection"]) {
      assert.strictEqual(typeof bus[method], "function", method);
    }
    // The entry file (the declared manifest entry) reaches only node: and its own files.
    const source = readFileSync(path.join(RB_DIR, "index.mjs"), "utf8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    assert.ok(specifiers.length >= 3);
    for (const spec of specifiers) assert.ok(spec.startsWith("node:") || spec.startsWith("./"), spec);
  });

  it("RB-02: manifest is structurally valid under the established module contract", () => {
    const registry = createModuleRegistry({ toolBus: makeToolBus() });
    for (const manifest of REAL_MANIFESTS) {
      const registered = registry.register(manifest.text);
      assert.strictEqual(registered.ok, true, `${manifest.id}: ${JSON.stringify(registered)}`);
    }
    const validation = registry.validate("report-bus");
    assert.strictEqual(validation.ok, true, JSON.stringify(validation.violations));
    assert.deepStrictEqual(validation.violations, []);
    assert.strictEqual(registry.validateAll().ok, true, "all four real manifests validate together");

    const descriptor = registry.describe("report-bus").descriptor;
    assert.strictEqual(descriptor.id, "report-bus");
    assert.deepStrictEqual(descriptor.phases, ["RUN", "TEST", "SHIP"]);
    assert.deepStrictEqual(descriptor.requires, { tools: [] });
    assert.deepStrictEqual(descriptor.consumes, [], "one-way dependency direction: consumes nothing");
    assert.deepStrictEqual(descriptor.conflicts, []);
    assert.deepStrictEqual(descriptor.entry, "modules/report-bus/index.mjs");
    for (const phase of descriptor.phases) assert.ok(EIGHT_LOOP_PHASES.includes(phase));
    // Local copy of the Core vocabulary matches the Module Registry's copy.
    assert.deepStrictEqual([...EIGHT_LOOP_PHASES], [...REGISTRY_PHASES]);
    // Declared errors == raisable subset ⊆ Core seven; every result code maps inside both.
    assert.deepStrictEqual([...descriptor.errors].sort(), [...REPORT_BUS_ERROR_CLASSES].sort());
    const classes = Object.values(RESULT_CODES).filter((klass) => klass !== null);
    assert.ok(classes.length === 6, "six failure codes, one success state");
    for (const klass of classes) {
      assert.ok(REPORT_BUS_ERROR_CLASSES.includes(klass), `${klass} must be declared`);
      assert.ok(CORE_ERROR_CLASSES.includes(klass), `${klass} must be a Core class`);
    }
    assert.strictEqual(RESULT_CODES.VALID, null);
  });

  it("RB-03: valid report input produces a successful report", () => {
    const bus = createReportBus();
    const built = bus.build(PRISTINE_INPUT);
    assert.strictEqual(built.ok, true);
    assert.strictEqual(built.code, "VALID");
    assert.strictEqual(built.error, null);
    assert.deepStrictEqual(built.violations, []);
    assert.strictEqual(typeof built.report.text, "string");
    assert.match(built.report.text, /^# Grimoire v3 — Completion Report\n/);
    assert.match(built.report.sha256, /^[0-9a-f]{64}$/);
    // The 03 §5 structured-result type builds through the same contract.
    const firstRow = PRISTINE_INPUT.sections.find((s) => s.id === "results").rows[0];
    const single = bus.build({ type: "result", sections: [{ id: "results", rows: [firstRow] }] });
    assert.strictEqual(single.ok, true, JSON.stringify(single.violations));
    assert.match(single.report.text, /^# Grimoire v3 — Structured Result\n/);
    // validate() reaches the same verdict without rendering anything.
    const verdict = bus.validate(PRISTINE_INPUT);
    assert.strictEqual(verdict.ok, true);
    assert.strictEqual(verdict.code, "VALID");
    assert.ok(!("report" in verdict), "validate never renders");
  });

  it("RB-04: report sections are deterministic identities", () => {
    assert.deepStrictEqual(
      [...SECTION_IDS],
      ["summary", "results", "phase-ledger", "artifacts", "evidence", "remaining-issues", "assumptions"]
    );
    assert.deepStrictEqual([...REPORT_TYPE_IDS], ["completion", "result"]);
    const bus = createReportBus();
    const completion = bus.describeType("completion").type;
    assert.deepStrictEqual(completion.requiredSections, ["results", "phase-ledger", "evidence", "remaining-issues"]);
    assert.deepStrictEqual(completion.allowedSections, [...SECTION_IDS]);
    const result = bus.describeType("result").type;
    assert.deepStrictEqual(result.requiredSections, ["results"]);
    assert.deepStrictEqual(result.allowedSections, ["results"]);
    // Same input twice → deeply equal reports.
    const a = bus.build(PRISTINE_INPUT);
    const b = bus.build(JSON.parse(PRISTINE));
    assert.deepStrictEqual(a.report, b.report);
    // Every present section renders under its canonical numbered heading.
    const headings = [...a.report.text.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1]);
    assert.deepStrictEqual(headings, ["Summary", "Results", "Phase ledger", "Artifacts", "Evidence", "Remaining issues", "Assumptions"]);
    // The section catalogue exposes its row contracts.
    const sections = bus.listSections();
    assert.strictEqual(sections.length, 7);
    const results = bus.describeSection("results").section;
    assert.strictEqual(results.rowKind, "object");
    assert.deepStrictEqual(results.fields, [
      "module", "command", "status", "phase_ledger",
      "artifacts", "evidence", "remaining_issues", "assumptions",
    ]);
    assert.strictEqual(bus.describeSection("phase-ledger").section.rowKind, "ledger");
    assert.strictEqual(bus.describeSection("evidence").section.rowKind, "text");
  });

  it("RB-05: section ordering is deterministic regardless of input order", () => {
    const bus = createReportBus();
    const base = bus.build(PRISTINE_INPUT);
    // Control fixture: sections reversed (byte-different input).
    const reordered = buildFixture(bus, "mut_rb_reordered.json");
    assert.strictEqual(reordered.ok, true, JSON.stringify(reordered.violations));
    assert.strictEqual(reordered.report.text, base.report.text, "byte-identical across section order");
    assert.strictEqual(reordered.report.sha256, base.report.sha256);
    // A third permutation built inline.
    const perm = bus.build({ type: "completion", sections: [...PRISTINE_INPUT.sections].reverse() });
    assert.strictEqual(perm.report.text, base.report.text);
    const headings = [...reordered.report.text.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1]);
    assert.deepStrictEqual(headings, ["Summary", "Results", "Phase ledger", "Artifacts", "Evidence", "Remaining issues", "Assumptions"]);
    // Row order inside a section is preserved exactly as supplied.
    const commands = [...base.report.text.matchAll(/\| (tool-bus|hotkeys) \| ([^|]+) \|/g)].map((m) => m[2].trim());
    assert.deepStrictEqual(commands, ["grimoire.key.R", "toolbus.check"]);
  });
});

// ---------------------------------------------------------------------------
describe("Report Bus determinism (RB-06 … RB-08, RB-13, RB-14)", () => {
  it("RB-06: repeated builds produce byte-identical text", () => {
    const bus = createReportBus();
    const first = bus.build(PRISTINE_INPUT);
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(bus.build(PRISTINE_INPUT).report.text, first.report.text);
    }
    // Fresh instances carry no hidden state either.
    assert.strictEqual(createReportBus().build(JSON.parse(PRISTINE)).report.text, first.report.text);
    const single = { type: "result", sections: [{ id: "results", rows: [ROW] }] };
    assert.strictEqual(
      createReportBus().build(single).report.text,
      bus.build(single).report.text
    );
  });

  it("RB-07: repeated builds produce identical SHA-256", () => {
    const bus = createReportBus();
    const shas = new Set();
    for (let i = 0; i < 3; i++) shas.add(bus.build(PRISTINE_INPUT).report.sha256);
    shas.add(createReportBus().build(JSON.parse(PRISTINE)).report.sha256);
    shas.add(bus.build({ type: "completion", sections: [...PRISTINE_INPUT.sections].reverse() }).report.sha256);
    assert.strictEqual(shas.size, 1, "one input state → one hash");
  });

  it("RB-08: SHA-256 equals the exact report bytes", () => {
    const bus = createReportBus();
    const inputs = [
      PRISTINE_INPUT,
      { type: "result", sections: [{ id: "results", rows: [ROW] }] },
    ];
    for (const input of inputs) {
      const { report } = bus.build(input);
      assert.strictEqual(report.sha256, sha256(report.text));
      // Every byte is covered: flipping the final byte changes the digest.
      const flipped = report.text.slice(0, -1) + (report.text.endsWith("x") ? "y" : "x");
      assert.notStrictEqual(sha256(flipped), report.sha256);
    }
  });

  it("RB-13: no timestamp/random/environment data appears in output or source", () => {
    const text = createReportBus().build(PRISTINE_INPUT).report.text;
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), "no ISO timestamps");
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text), "no uuids");
    assert.ok(!/\bPID\b|\bpid\b/.test(text), "no process ids");
    assert.ok(!/\/(home|Users|tmp)\//.test(text), "no machine-specific paths");
    assert.ok(!/\bundefined\b|\bNaN\b/.test(text), "no undefined/NaN leakage");
    assert.ok(!/generated|timestamp|elapsed|duration/i.test(text), "no volatile field names");
    // Source level: no volatile/environment APIs anywhere in the module.
    for (const source of moduleSources()) {
      assert.ok(
        !/Date\.now|Math\.random|process\.(pid|env|hrtime)|new Date\(/.test(source.text),
        `${source.file} must not consult volatile data`
      );
    }
  });

  it("RB-14: a separate process generates a byte-identical report", () => {
    const script = `
      import { readFileSync } from "node:fs";
      import { pathToFileURL } from "node:url";
      const { createReportBus } = await import(pathToFileURL(process.argv[2]).href);
      const input = JSON.parse(readFileSync(process.argv[1], "utf8"));
      const result = createReportBus().build(input);
      process.stdout.write(JSON.stringify({
        ok: result.ok,
        text: result.ok ? result.report.text : null,
        sha256: result.ok ? result.report.sha256 : null,
      }));
    `;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, path.join(FIX, "rb_report_input.json"), path.join(RB_DIR, "index.mjs")],
      { cwd: ROOT, encoding: "utf8" }
    );
    assert.strictEqual(child.status, 0, child.stderr);
    const out = JSON.parse(child.stdout);
    const local = createReportBus().build(PRISTINE_INPUT);
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.text, local.report.text, "cross-process text is byte-identical");
    assert.strictEqual(out.sha256, local.report.sha256, "cross-process hash is identical");
  });
});

// ---------------------------------------------------------------------------
describe("Report Bus fail-closed contract (RB-09 … RB-12)", () => {
  it("RB-09: invalid input fails closed with no report", () => {
    const bus = createReportBus();
    const cases = [
      null,
      "not an object",
      [],
      {},
      { type: "", sections: [] },
      { type: 42, sections: [] },
      { type: "completion" },
      { type: "completion", sections: "rows" },
      { type: "completion", sections: [], generated_at: "2026-10-05T12:00:00Z" },
      JSON.parse(fixture("mut_rb_corrupted.json")),
    ];
    for (const input of cases) {
      const built = bus.build(input);
      assert.strictEqual(built.ok, false, JSON.stringify(input));
      assert.strictEqual(built.code, "INVALID_INPUT", JSON.stringify(input));
      assert.strictEqual(built.report, null, "no report is ever emitted for invalid input");
      assert.strictEqual(built.error.class, "E-INPUT");
      assert.ok(built.violations.length > 0);
      assert.ok(Object.isFrozen(built));
      const verdict = bus.validate(input);
      assert.strictEqual(verdict.ok, false);
      assert.strictEqual(verdict.code, "INVALID_INPUT");
      assert.ok(!("report" in verdict), "validate never renders a partial report");
    }
  });

  it("RB-10: unknown report/section identity fails closed", () => {
    const bus = createReportBus();
    const unknownType = buildFixture(bus, "mut_rb_unknown_type.json");
    assert.strictEqual(unknownType.code, "UNKNOWN_REPORT_TYPE");
    assert.strictEqual(unknownType.error.class, "E-INPUT");
    assert.strictEqual(unknownType.error.detail, "status-report");
    assert.strictEqual(unknownType.report, null);
    // Unknown section id.
    const ghost = bus.build({ type: "result", sections: [{ id: "ghost", rows: [] }] });
    assert.strictEqual(ghost.code, "INVALID_SECTION");
    assert.match(ghost.violations[0].detail, /unknown section "ghost"/);
    assert.strictEqual(ghost.report, null);
    // A known section the report type does not allow.
    const notAllowed = bus.build({ type: "result", sections: [{ id: "evidence", rows: ["x"] }] });
    assert.strictEqual(notAllowed.code, "INVALID_SECTION");
    assert.match(notAllowed.violations[0].detail, /not allowed for report type "result"/);
    // The describe surfaces refuse by the same names.
    assert.strictEqual(bus.describeType("bogus").code, "UNKNOWN_REPORT_TYPE");
    assert.strictEqual(bus.describeType(null).ok, false);
    assert.strictEqual(bus.describeSection("bogus").code, "INVALID_SECTION");
  });

  it("RB-11: duplicate section identity fails closed", () => {
    const bus = createReportBus();
    const dup = buildFixture(bus, "mut_rb_duplicate_section.json");
    assert.strictEqual(dup.code, "DUPLICATE_SECTION");
    assert.strictEqual(dup.error.class, "E-CONFLICT");
    assert.strictEqual(dup.error.detail, "results");
    assert.strictEqual(dup.report, null, "duplicates are never merged or silently deduplicated");
    const inline = bus.build({
      type: "result",
      sections: [{ id: "results", rows: [ROW] }, { id: "results", rows: [ROW] }],
    });
    assert.strictEqual(inline.code, "DUPLICATE_SECTION");
    assert.strictEqual(inline.report, null);
  });

  it("RB-12: missing required sections and fields fail closed", () => {
    const bus = createReportBus();
    const noSection = buildFixture(bus, "mut_rb_missing_section.json");
    assert.strictEqual(noSection.code, "MISSING_REQUIRED_FIELD");
    assert.strictEqual(noSection.error.class, "E-VALID");
    assert.ok(noSection.violations.some((v) => v.code === "MISSING_REQUIRED_FIELD" && v.detail === "section:results"));
    assert.strictEqual(noSection.report, null);
    const noField = buildFixture(bus, "mut_rb_missing_field.json");
    assert.strictEqual(noField.code, "MISSING_REQUIRED_FIELD");
    assert.ok(noField.violations.some((v) => v.detail === "results[0].command"));
    assert.strictEqual(noField.report, null);
    // An empty section list cannot satisfy the completion contract (D9/D10).
    const empty = bus.build({ type: "completion", sections: [] });
    assert.strictEqual(empty.code, "MISSING_REQUIRED_FIELD");
    assert.strictEqual(empty.violations.length, 4);
    assert.deepStrictEqual(
      empty.violations.map((v) => v.detail),
      ["section:results", "section:phase-ledger", "section:evidence", "section:remaining-issues"]
    );
    assert.deepStrictEqual(bus.validate({ type: "completion", sections: [] }).violations, empty.violations);
    // A required section present but structurally broken is INVALID_SECTION, not a pass.
    const brokenRows = bus.build({ type: "completion", sections: [{ id: "results" }] });
    assert.strictEqual(brokenRows.code, "INVALID_SECTION");
    assert.strictEqual(brokenRows.report, null);
  });
});

// ---------------------------------------------------------------------------
describe("Report Bus integration (RB-15 … RB-18)", () => {
  it("RB-15: Module Registry data is consumed as caller-supplied rows", () => {
    const registry = createModuleRegistry({ toolBus: makeToolBus() });
    for (const manifest of REAL_MANIFESTS) {
      assert.strictEqual(registry.register(manifest.text).ok, true, manifest.id);
    }
    for (const id of ["hotkeys", "tool-bus", "module-registry", "report-bus"]) {
      const enabled = registry.enable(id);
      assert.strictEqual(enabled.ok, true, `${id}: ${JSON.stringify(enabled)}`);
    }
    const validation = registry.validateAll();
    assert.strictEqual(validation.ok, true);
    const rows = validation.modules.map((m) => ({
      module: "module-registry",
      command: `module-registry.validate.${m.id}`,
      status: m.ok ? "success" : "failed",
      phase_ledger: ["VALIDATE: done (03 §3 duties)"],
      artifacts: [],
      evidence: [`validate(${m.id}) → ${m.ok ? "MR_OK" : m.code}`],
      remaining_issues: m.violations.map((violation) => `${m.id}: ${violation.code}`),
      assumptions: [],
    }));
    const registryReport = buildRegistryReport(registry);
    const built = createReportBus().build({
      type: "completion",
      sections: [
        { id: "summary", rows: [{ name: "Registered", value: validation.modules.length }] },
        { id: "results", rows },
        { id: "phase-ledger", rows: ["VALIDATE: done (03 §3 duties)"] },
        { id: "artifacts", rows: [{ id: "module-registry-report", sha256: registryReport.sha256 }] },
        { id: "evidence", rows: [`buildRegistryReport(registry) → sha256 ${registryReport.sha256}`] },
        { id: "remaining-issues", rows: [] },
      ],
    });
    assert.strictEqual(built.ok, true, JSON.stringify(built.violations));
    assert.ok(built.report.text.includes("| module-registry | module-registry.validate.hotkeys | success |"));
    assert.ok(built.report.text.includes("| module-registry | module-registry.validate.report-bus | success |"));
    assert.ok(built.report.text.includes(registryReport.sha256), "registry report flows in as an artifact row");
    assert.strictEqual(built.report.sha256, sha256(built.report.text));
    // The rows were supplied by this caller; the bus imported nothing (RB-18 proves it).
  });

  it("RB-16: Tool Bus data is consumed as caller-supplied rows", () => {
    const toolBus = makeToolBus();
    const capabilities = toolBus.list();
    assert.ok(capabilities.length >= 11, "the real declaration set is in play");
    const rows = capabilities.map((capability) => ({
      module: "tool-bus",
      command: `toolbus.check.${capability.id}`,
      status: capability.status === "AVAILABLE" ? "success" : "blocked",
      phase_ledger: ["CHECK: done (capability state)"],
      artifacts: [],
      evidence: [`check(${capability.id}) → ${capability.status}`],
      remaining_issues: capability.status === "AVAILABLE" ? [] : [`${capability.id} is ${capability.status}`],
      assumptions: [],
    }));
    const built = createReportBus().build({
      type: "completion",
      sections: [
        { id: "summary", rows: [{ name: "Capabilities", value: capabilities.length }] },
        { id: "results", rows },
        { id: "phase-ledger", rows: ["CHECK: done (capability state)"] },
        { id: "evidence", rows: [`bus.list() → ${capabilities.length} capabilities`] },
        {
          id: "remaining-issues",
          rows: capabilities.filter((c) => c.status !== "AVAILABLE").map((c) => `${c.id} is ${c.status}`),
        },
      ],
    });
    assert.strictEqual(built.ok, true, JSON.stringify(built.violations));
    const available = capabilities.filter((c) => c.status === "AVAILABLE");
    assert.ok(available.length > 0 && available.length < capabilities.length, "the real mix includes unavailable capabilities");
    const first = capabilities[0];
    const expectedStatus = first.status === "AVAILABLE" ? "success" : "blocked";
    assert.ok(
      built.report.text.includes(`| tool-bus | toolbus.check.${first.id} | ${expectedStatus} |`),
      "capability state is rendered exactly as supplied"
    );
    // Distinct states are never collapsed (4 states → 2 §5 statuses, mapped in the row contract).
    const states = new Set(capabilities.map((c) => c.status));
    assert.ok(states.size >= 2);
    assert.strictEqual(built.report.sha256, sha256(built.report.text));
  });

  it("RB-17: Hotkey/runtime data is consumed as caller-supplied rows", () => {
    const runtime = createRuntime({ registryText: REGISTRY_TEXT, root: ROOT });
    const results = ["R", "PN", "W"].map((key) => runtime.executeHotkey({ key }));
    const FIVE = [
      "module", "command", "status", "phase_ledger",
      "artifacts", "evidence", "remaining_issues", "assumptions",
    ];
    // The Task 06 runtime already emits 03 §5 results (14 §4) — pass them through untouched.
    const rows = results.map((r) => Object.fromEntries(FIVE.map((field) => [field, r[field]])));
    const bus = createReportBus();
    const direct = bus.build({ type: "result", sections: [{ id: "results", rows }] });
    assert.strictEqual(direct.ok, true, JSON.stringify(direct.violations));
    assert.ok(direct.report.text.includes("grimoire.key.R"));
    assert.ok(direct.report.text.includes("| success |"), "executed hotkey renders success");
    assert.ok(direct.report.text.includes("| blocked |"), "unimplemented hotkey renders blocked — never collapsed");
    // Runtime report bytes flow in as an artifact row of a completion report.
    const runtimeReport = buildRuntimeReport(results);
    const completion = bus.build({
      type: "completion",
      sections: [
        { id: "results", rows },
        { id: "phase-ledger", rows: results.flatMap((r) => r.phase_ledger) },
        { id: "artifacts", rows: [{ id: "hotkeys-runtime-report", sha256: runtimeReport.sha256 }] },
        { id: "evidence", rows: results.flatMap((r) => r.evidence) },
        { id: "remaining-issues", rows: results.flatMap((r) => r.remaining_issues) },
      ],
    });
    assert.strictEqual(completion.ok, true, JSON.stringify(completion.violations));
    assert.ok(completion.report.text.includes(runtimeReport.sha256));
    assert.ok(completion.report.text.includes("E_ENV_HANDLER_MISSING"), "real remaining issue carried through");
    assert.strictEqual(completion.report.sha256, sha256(completion.report.text));
  });

  it("RB-18: the Report Bus imports and executes no L2 behavior", () => {
    const sources = moduleSources();
    assert.ok(sources.length >= 4, "index + three src files are scanned");
    const lateral = /modules\/(hotkeys|tool-bus|module-registry)/;
    const executor = /child_process|\beval\s*\(|new Function|require\s*\(|import\s*\(/;
    const nodeImports = new Set();
    for (const source of sources) {
      const specifiers = [...source.text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const spec of specifiers) {
        assert.ok(spec.startsWith("node:") || spec.startsWith("./"), `${source.file}: lateral import "${spec}"`);
        if (spec.startsWith("node:")) nodeImports.add(spec);
      }
      assert.ok(!lateral.test(source.text), `${source.file} must not reference another module's path`);
      assert.ok(!executor.test(source.text), `${source.file} must not execute external code`);
      assert.ok(!/handler|dispatch|invoke\(/.test(source.text.replace(/^.*$/gm, (line) => (line.trim().startsWith("//") ? "" : line))), `${source.file} must not dispatch behavior`);
    }
    // Only node:crypto — no fs, no child_process: building a report reads and runs nothing.
    assert.deepStrictEqual([...nodeImports].sort(), ["node:crypto"]);
    // A build performs no execution: building twice from fresh buses leaves both inputs untouched.
    const input = JSON.parse(PRISTINE);
    const before = JSON.stringify(input);
    createReportBus().build(input);
    createReportBus().build(input);
    assert.strictEqual(JSON.stringify(input), before, "inputs are never mutated");
  });
});

// ---------------------------------------------------------------------------
describe("Report Bus integrity, suite & mutations (RB-19 … RB-20, RB-M1 … RB-M9)", () => {
  it("RB-19: protected Core and registry files remain byte-identical", () => {
    for (const [file, pin] of Object.entries(PINS)) {
      assert.strictEqual(sha256(readFileSync(path.join(ROOT, file), "utf8")), pin, `${file} changed`);
    }
    assert.strictEqual(Object.keys(PINS).length, 5, "all five protected files checked");
  });

  it("RB-20: the rest of the repository test suite stays green", () => {
    const files = readdirSync(path.join(ROOT, "test"))
      .filter((name) => name.endsWith(".test.mjs") && name !== "rb-report-bus.test.mjs")
      .sort()
      .map((name) => path.join("test", name));
    assert.ok(files.length >= 6, `expected the six prior suites, found ${files.length}`);
    // Run the prior suites with an explicit TAP reporter and without the
    // parent runner's test-context marker, so the summary lines this test
    // parses are produced identically inside and outside a test run.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000,
      env,
    });
    const output = `${child.stdout ?? ""}${child.stderr ?? ""}`;
    assert.strictEqual(child.status, 0, output.slice(-3000));
    const tests = Number(output.match(/^# tests (\d+)$/m)?.[1]);
    const pass = Number(output.match(/^# pass (\d+)$/m)?.[1]);
    const fail = Number(output.match(/^# fail (\d+)$/m)?.[1]);
    assert.strictEqual(fail, 0, "no failures in the prior suite");
    assert.strictEqual(pass, tests, "every prior test passes");
    assert.ok(tests >= 102, `prior suite must stay intact (saw ${tests})`);
  });

  const MUTATIONS = Object.freeze([
    ["RB-M1", "mut_rb_missing_section.json", "MISSING_REQUIRED_FIELD", "E-VALID", "section:results"],
    ["RB-M2", "mut_rb_duplicate_section.json", "DUPLICATE_SECTION", "E-CONFLICT", "results"],
    ["RB-M3", "mut_rb_malformed_section.json", "INVALID_SECTION", "E-VALID", null],
    ["RB-M4", "mut_rb_invalid_status.json", "DEPENDENCY_ERROR", "E-ENV", "results[0].status"],
    ["RB-M5", "mut_rb_unknown_type.json", "UNKNOWN_REPORT_TYPE", "E-INPUT", "status-report"],
    ["RB-M6", "mut_rb_corrupted.json", "INVALID_INPUT", "E-INPUT", null],
    ["RB-M7", "mut_rb_missing_field.json", "MISSING_REQUIRED_FIELD", "E-VALID", "results[0].command"],
    ["RB-M8", "mut_rb_invalid_row.json", "DEPENDENCY_ERROR", "E-ENV", "results[0]"],
    ["RB-M9", "mut_rb_nondeterministic.json", "INVALID_SECTION", "E-VALID", "generated_at"],
  ]);

  for (const [id, file, code, klass, detail] of MUTATIONS) {
    it(`${id}: ${file} fails closed with ${code}`, () => {
      const bus = createReportBus();
      const text = fixture(file); // asserted byte-different from pristine
      const input = JSON.parse(text);
      const built = bus.build(input);
      assert.strictEqual(built.ok, false);
      assert.strictEqual(built.code, code, JSON.stringify(built.violations));
      assert.strictEqual(built.error.class, klass);
      assert.strictEqual(built.error.code, code);
      assert.strictEqual(built.report, null, "no report, no partial emission");
      assert.ok(built.violations.length > 0);
      assert.ok(built.violations.some((v) => v.code === code), JSON.stringify(built.violations));
      if (detail) {
        assert.ok(
          built.violations.some((v) => String(v.detail).includes(detail)),
          JSON.stringify(built.violations)
        );
      }
      // validate() refuses with exactly the same code — never a silent pass.
      const verdict = bus.validate(input);
      assert.strictEqual(verdict.ok, false);
      assert.strictEqual(verdict.code, code);
      assert.ok(!("report" in verdict));
    });
  }
});
