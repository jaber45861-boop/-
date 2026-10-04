// Grimoire v3 — L2 Hotkeys module: loader, report, integration and integrity duties.
//
// HKC coverage map (documented in docs/v3/05-acceptance-tests.md, Group I):
//   HKC-01/02   record coverage, no silent disappearance
//   HKC-09      deterministic parse
//   HKC-10      zero duplicate ACTIVE keys
//   HKC-11/13   adapter declarations + bijection
//   HKC-12      source citation verification (84 anchors)
//   HKC-14      full path: registry → loader → validation → gate → report
//   HKC-15      report byte-stability (determinism)
//   HKC-17      integrity: Core 01–04, 18 source files, registry unchanged
// Gate duties HKC-03…HKC-08 and the HKC-16 mutation suite live in
// test/hkc-gate.test.mjs.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  validateRegistryText,
  ACTIVATION_STATUSES,
  VALIDATION_STATUSES,
  KNOWN_ADAPTER_STATUS,
} from "../modules/hotkeys/src/loader.mjs";
import { gateRecords } from "../modules/hotkeys/src/gate.mjs";
import { buildReport } from "../modules/hotkeys/src/report.mjs";

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, "docs/v3/12-hotkey-registry.md");
const ORIG = readFileSync(REGISTRY, "utf8");

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function validate(text) {
  return validateRegistryText(text, { root: ROOT });
}
const PRISTINE = validate(ORIG);

// ---------------------------------------------------------------------------
// Loader duties
// ---------------------------------------------------------------------------
describe("loader duties (HKC-01, 02, 09, 10, 11, 12, 13)", () => {
  it("HKC-01: registry loads exactly 48 records (43 Grimoire + 5 external), none dropped", () => {
    assert.strictEqual(PRISTINE.ok, true, "pristine registry must validate with zero violations");
    assert.strictEqual(PRISTINE.records.length, 48);
    assert.strictEqual(PRISTINE.records.filter((r) => r.section === "grimoire").length, 43);
    assert.strictEqual(PRISTINE.records.filter((r) => r.section === "external").length, 5);
    assert.strictEqual(PRISTINE.counts.loaded, 48);
    assert.strictEqual(PRISTINE.counts.accepted, 48);
    assert.strictEqual(PRISTINE.counts.rejected, 0);
    // Declared counts in §2/§3/§4 headings match the tables (structure duty):
    // any mismatch would have produced section_declared_count_mismatch above.
    assert.strictEqual(PRISTINE.violations.length, 0);
  });

  it("HKC-02: every record carries a non-empty activation + validation status from the normative enums", () => {
    assert.strictEqual(PRISTINE.records.length, 48);
    for (const record of PRISTINE.records) {
      assert.ok(record.key && record.key !== "—", "every record keeps its key");
      assert.ok(ACTIVATION_STATUSES.includes(record.activation_status),
        `${record.key} activation status must be one of the seven`);
      assert.ok(VALIDATION_STATUSES.includes(record.validation_status),
        `${record.key} validation status must be one of the five`);
      assert.notStrictEqual(record.activation_status.trim(), "");
      assert.notStrictEqual(record.validation_status.trim(), "");
    }
    const keys = new Set(PRISTINE.records.map((r) => r.key));
    assert.strictEqual(keys.size, 48, "no key may be dropped or silently duplicated");
  });

  it("HKC-09: parse is deterministic (double parse produces byte-equal results)", () => {
    const a = validate(ORIG);
    const b = validate(ORIG);
    assert.strictEqual(JSON.stringify(a.records), JSON.stringify(b.records));
    assert.strictEqual(JSON.stringify(a.violations), JSON.stringify(b.violations));
    assert.strictEqual(JSON.stringify([...a.adapters.entries()]), JSON.stringify([...b.adapters.entries()]));
    assert.strictEqual(a.meta.sha256, b.meta.sha256);
    assert.strictEqual(a.meta.sha256, sha256(ORIG));
  });

  it("HKC-10: zero duplicate ACTIVE keys in the pristine registry", () => {
    assert.strictEqual(PRISTINE.duplicate_detection.duplicate_active_keys.length, 0);
    assert.strictEqual(PRISTINE.duplicate_detection.duplicate_commands.length, 0);
    assert.ok(!PRISTINE.violations.some((v) => v.code === "duplicate_active_key"));
    assert.ok(!PRISTINE.violations.some((v) => v.code === "duplicate_identity"));
  });

  it("HKC-11: exactly 10 adapter declarations, every one NOT_ACTIVATED", () => {
    assert.strictEqual(PRISTINE.adapters.size, 10);
    for (const adapter of PRISTINE.adapters.values()) {
      assert.match(adapter.id, /^grimoire\.adapter\.[A-Za-z0-9]+$/);
      assert.strictEqual(adapter.activation_status, KNOWN_ADAPTER_STATUS);
    }
  });

  it("HKC-12: 84 source citations checked, zero source-reference violations", () => {
    assert.strictEqual(PRISTINE.citations_checked, 84);
    assert.strictEqual(PRISTINE.source_reference_violations.length, 0);
    assert.ok(!PRISTINE.violations.some((v) => v.code.startsWith("source_ref_")));
  });

  it("HKC-13: adapter bijection — each of the 10 declarations is referenced by exactly one record", () => {
    let totalReferences = 0;
    for (const adapter of PRISTINE.adapters.values()) {
      assert.strictEqual(adapter.references.length, 1,
        `${adapter.id} must be referenced exactly once (found ${adapter.references.length})`);
      totalReferences += adapter.references.length;
    }
    assert.strictEqual(totalReferences, 10);
    const required = PRISTINE.records.filter((r) => r.activation_status === "ADAPTER_REQUIRED");
    assert.strictEqual(required.length, 10);
    for (const record of required) {
      assert.ok(PRISTINE.adapters.has(record.adapter), `${record.key} → ${record.adapter} must resolve`);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: registry → loader → validation → activation gate → report
// ---------------------------------------------------------------------------
describe("integration path + report determinism (HKC-14, HKC-15)", () => {
  it("HKC-14: registry → loader → validation → gate → report executes end to end", () => {
    // Stage 1 + 2: load & validate.
    const parsed = validate(ORIG);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.records.length, 48);

    // Stage 3: only violation-free records are exposed to the activation gate.
    const exposed = parsed.records.filter((r) => r.violations.length === 0);
    const gate = gateRecords(exposed);
    assert.strictEqual(exposed.length, 48);
    assert.strictEqual(gate.allowedCount, 14);
    assert.strictEqual(gate.refusedCount, 34);

    // Stage 4: the report builder consumes loader + gate output.
    const report = buildReport(parsed, gate);
    assert.strictEqual(typeof report.text, "string");
    assert.ok(report.text.length > 1000);

    // All 10 numbered sections are present, each heading number 1…10 once.
    const numbers = new Set();
    for (const m of report.text.matchAll(/^## (\d+)\./gm)) numbers.add(Number(m[1]));
    assert.deepStrictEqual([...numbers].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Report states the verified counts.
    for (const needle of [
      "| Loaded records | 48 |",
      "| Accepted records | 48 |",
      "| Adapter declarations | 10 |",
      "| Citations checked | 84 |",
      "| Violations | 0 |",
      "| Ok | true |",
      "Allow: (14 ACTIVE records with VALIDATED status)",
    ]) {
      assert.ok(report.text.includes(needle), `report must state: ${needle}`);
    }

    // The report hash is the hash of its own bytes.
    assert.strictEqual(report.sha256, sha256(report.text));

    // Fail-closed composition: a record rejected by validation is never
    // exposed to the gate, so the ALLOW set shrinks instead of tolerating it.
    const mutated = validate(readFileSync(path.join(ROOT, "test/_fixtures/mut_active_invalid_mode.txt"), "utf8"));
    assert.strictEqual(mutated.ok, false);
    const mutatedExposed = mutated.records.filter((r) => r.violations.length === 0);
    assert.strictEqual(mutatedExposed.length, 47, "PTn is rejected by validation");
    const mutatedGate = gateRecords(mutatedExposed);
    assert.strictEqual(mutatedGate.allowedCount, 13, "PTn never reaches ALLOW — only 13 ACTIVE records remain");
    assert.strictEqual(mutatedGate.refusedCount, 34);
  });

  it("HKC-15: report is byte-stable — two builds produce identical text and sha256", () => {
    const one = buildReport(validate(ORIG), gateRecords(validate(ORIG).records));
    const two = buildReport(validate(ORIG), gateRecords(validate(ORIG).records));
    assert.strictEqual(one.text, two.text);
    assert.strictEqual(one.sha256, two.sha256);
    assert.strictEqual(one.sha256, sha256(one.text));
    // In-place rebuild of the same parsed object is also stable.
    const parsed = validate(ORIG);
    const again = buildReport(parsed, gateRecords(parsed.records));
    assert.strictEqual(again.text, one.text);
    assert.strictEqual(again.sha256, one.sha256);
  });
});

// ---------------------------------------------------------------------------
// Integrity: Core 01–04, the 18 source files, the authoritative registry
// ---------------------------------------------------------------------------
describe("integrity duties (HKC-17)", () => {
  // Pinned SHA-256 values: these files must never change (Task 05 do-not-modify).
  const CORE_PINS = {
    "docs/v3/01-core-specification.md": "9bc4b0c0bdfca652fc0f50e01ff07b4f677148fa20e756548b48d8534c786576",
    "docs/v3/02-architecture-map.md": "b6e25671124e41860e3271b4e387931053ce3c876364181052446a91b35d325a",
    "docs/v3/03-extension-contract.md": "fdc83a0e369823ef84783a98b978bce2fde0cb95b9d2d0d9a3a1ed24ae23e22b",
    "docs/v3/04-decision-rules.md": "4fc9c146e8a88b722a7c3f2b3aaab4b97ad8a91c358888a814f11bd7875057ec",
  };
  const REGISTRY_PIN = "c861b562caddc05d0df984797518496916def72114a8c36b4c83e8c3dd710139";

  const fileSha = (rel) => sha256(readFileSync(path.join(ROOT, rel), "utf8"));

  it("HKC-17: Core 01–04 are byte-unchanged (pinned SHA-256)", () => {
    for (const [rel, want] of Object.entries(CORE_PINS)) {
      assert.strictEqual(fileSha(rel), want, `${rel} must not change`);
    }
  });

  it("HKC-17: authoritative L3 registry is byte-unchanged (pinned SHA-256)", () => {
    assert.strictEqual(fileSha("docs/v3/12-hotkey-registry.md"), REGISTRY_PIN);
    assert.strictEqual(PRISTINE.meta.sha256, REGISTRY_PIN);
  });

  it("HKC-17: source integrity 18/18 — every file matches the 11 §1 truth table", () => {
    const integrity = readFileSync(path.join(ROOT, "docs/v3/11-source-integrity.md"), "utf8");
    const rows = [...integrity.matchAll(
      /^\| \d+ \| [^|\n]+ \| `([^`\n]+)` \| \d+ \| [^|\n]+ \| `([0-9a-f]{64})/gm,
    )];
    assert.strictEqual(rows.length, 18, "11 §1 must list the 18 source files");
    let matched = 0;
    for (const [, rel, want] of rows) {
      assert.strictEqual(fileSha(rel), want, `source file ${rel} changed`);
      matched += 1;
    }
    assert.strictEqual(matched, 18);
  });
});
