// Grimoire v3 — L2 Hotkeys module: activation-gate duties + fail-closed mutation suite.
//
// HKC coverage map (documented in docs/v3/05-acceptance-tests.md, Group I):
//   HKC-03 … HKC-08  gate duties              — this file, describe block 1
//   HKC-16           the 10 required          — this file, describe block 2
//                    mutations all fail closed
//   supporting negative fixtures              — this file, describe block 3
//   HKC-01/02/09/10/11/12/13/14/15/17         — test/hkc-coverage.test.mjs
//
// Every fixture is asserted byte-different from the authoritative registry
// before it is trusted as a mutation: a fixture identical to the registry can
// never prove fail-closed behavior.
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  resolveActivation,
  gateRecord,
  gateRecords,
  gateTestStatus,
  REASON,
  REFUSE,
  ALLOW,
} from "../modules/hotkeys/src/gate.mjs";
import { validateRegistryText } from "../modules/hotkeys/src/loader.mjs";

const ROOT = process.cwd();
const ORIG = readFileSync(ROOT + "/docs/v3/12-hotkey-registry.md", "utf8");
const FIX = ROOT + "/test/_fixtures/";

function validate(text) {
  return validateRegistryText(text, { root: ROOT });
}

// Load a mutation fixture; fail the test if it is not a real mutation.
function fixture(name) {
  const text = readFileSync(FIX + name, "utf8");
  assert.notStrictEqual(text, ORIG, `${name} must be byte-different from the registry (real mutation)`);
  return { text, result: validate(text) };
}

const codes = (result) => new Set(result.violations.map((v) => v.code));
const hasCode = (result, code) => result.violations.some((v) => v.code === code);
const statusCount = (result, status) =>
  result.records.filter((r) => r.activation_status === status).length;
const refusedDecision = (record) => gateRecord(record).decision === REFUSE;

const PRISTINE = validate(ORIG);

// ---------------------------------------------------------------------------
// 1. Gate duties (HKC-03 … HKC-08)
// ---------------------------------------------------------------------------
describe("activation gate duties (HKC-03 … HKC-08)", () => {
  it("gate vocabulary: all seven statuses resolve deterministically (ALLOW only for ACTIVE)", () => {
    for (const status of ["ACTIVE", "ADAPTER_REQUIRED", "BLOCKED_CONFLICT", "BLOCKED_AMBIGUOUS", "BLOCKED_INSUFFICIENT_INFO", "HISTORICAL_REMOVED", "METADATA_ONLY"]) {
      assert.strictEqual(resolveActivation({ activation_status: status, validation_status: "VALIDATED" }), status === "ACTIVE" ? ALLOW : REFUSE);
      assert.strictEqual(gateTestStatus(status), status === "ACTIVE" ? ALLOW : REFUSE);
    }
    assert.strictEqual(gateRecord({ activation_status: "ACTIVE", validation_status: "VALIDATED" }).decision, ALLOW);
    assert.strictEqual(gateRecord({ activation_status: "ACTIVE", validation_status: "PENDING_ADAPTER" }).decision, REFUSE);
  });

  it("HKC-03: gate allows exactly the 14 ACTIVE VALIDATED records and refuses the other 34", () => {
    const gate = gateRecords(PRISTINE.records);
    assert.strictEqual(PRISTINE.ok, true);
    assert.strictEqual(PRISTINE.records.length, 48);
    assert.strictEqual(statusCount(PRISTINE, "ACTIVE"), 14);
    assert.strictEqual(gate.allowedCount, 14);
    assert.strictEqual(gate.refusedCount, 34);
    for (const record of gate.allow) {
      assert.strictEqual(record.activation_status, "ACTIVE");
      assert.strictEqual(record.validation_status, "VALIDATED");
      assert.strictEqual(record.violations.length, 0);
    }
  });

  it("HKC-04: all 10 ADAPTER_REQUIRED records reference a declared §4 adapter and are refused", () => {
    const required = PRISTINE.records.filter((r) => r.activation_status === "ADAPTER_REQUIRED");
    assert.strictEqual(required.length, 10);
    for (const record of required) {
      assert.ok(record.adapter && record.adapter !== "—", `${record.key} must reference an adapter`);
      assert.ok(PRISTINE.adapters.has(record.adapter), `${record.adapter} must be declared in §4`);
      const { decision } = gateRecord(record);
      assert.strictEqual(decision, REFUSE);
    }
  });

  it("HKC-05: ADAPTER_REQUIRED without adapter reference refuses with explicit reason", () => {
    const { result } = fixture("mut_adapter_missing.txt");
    assert.ok(hasCode(result, "adapter_ref_missing"), "loader must flag the missing reference");
    const kt = result.records.find((r) => r.key === "KT");
    assert.ok(kt);
    const { decision, reason } = gateRecord(kt);
    assert.strictEqual(decision, REFUSE);
    assert.strictEqual(reason, REASON.ADAPTER_REQUIRED_MISSING_REF);
  });

  it("HKC-06: BLOCKED_CONFLICT (5) and BLOCKED_AMBIGUOUS (5) refuse with pending-ruling reason", () => {
    assert.strictEqual(statusCount(PRISTINE, "BLOCKED_CONFLICT"), 5);
    assert.strictEqual(statusCount(PRISTINE, "BLOCKED_AMBIGUOUS"), 5);
    for (const record of PRISTINE.records) {
      if (record.activation_status === "BLOCKED_CONFLICT") {
        const { decision, reason } = gateRecord(record);
        assert.strictEqual(decision, REFUSE);
        assert.strictEqual(reason, REASON.BLOCKED_CONFLICT);
      }
      if (record.activation_status === "BLOCKED_AMBIGUOUS") {
        const { decision, reason } = gateRecord(record);
        assert.strictEqual(decision, REFUSE);
        assert.strictEqual(reason, REASON.BLOCKED_AMBIGUOUS);
      }
    }
  });

  it("HKC-07: BLOCKED_INSUFFICIENT_INFO (3) refuses with pending-evidence reason", () => {
    const insufficient = PRISTINE.records.filter((r) => r.activation_status === "BLOCKED_INSUFFICIENT_INFO");
    assert.strictEqual(insufficient.length, 3);
    for (const record of insufficient) {
      const { decision, reason } = gateRecord(record);
      assert.strictEqual(decision, REFUSE);
      assert.strictEqual(reason, REASON.BLOCKED_INSUFFICIENT_INFO);
    }
  });

  it("HKC-08: HISTORICAL_REMOVED (4) and METADATA_ONLY (7) refuse as commands", () => {
    const historical = PRISTINE.records.filter((r) => r.activation_status === "HISTORICAL_REMOVED");
    const metadata = PRISTINE.records.filter((r) => r.activation_status === "METADATA_ONLY");
    assert.strictEqual(historical.length, 4);
    assert.strictEqual(metadata.length, 7);
    for (const record of historical) {
      const { decision, reason } = gateRecord(record);
      assert.strictEqual(decision, REFUSE);
      assert.strictEqual(reason, REASON.HISTORICAL_REMOVED);
    }
    for (const record of metadata) {
      const { decision, reason } = gateRecord(record);
      assert.strictEqual(decision, REFUSE);
      assert.strictEqual(reason, REASON.METADATA_ONLY);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. HKC-16 — the 10 required mutations, every one failing closed
// ---------------------------------------------------------------------------
describe("HKC-16 — the 10 required mutations all fail closed", () => {
  it("HKC-16/1: ACTIVE → UNKNOWN fails closed (loader + gate)", () => {
    const { result } = fixture("mut_active_unknown.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "invalid_activation_status"), "must flag the unknown status");
    const ptn = result.records.find((r) => r.key === "PTn");
    assert.strictEqual(ptn.activation_status, "UNKNOWN");
    assert.ok(refusedDecision(ptn), "flipped record must be refused by the gate");
    assert.match(gateRecord(ptn).reason, /not a recognized activation status/);
  });

  it("HKC-16/2: valid Core mode → invalid mode fails closed (ACTIVE record)", () => {
    const { result } = fixture("mut_active_invalid_mode.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "invalid_mode" && v.record === "PTn"));
    const ptn = result.records.find((r) => r.key === "PTn");
    assert.strictEqual(ptn.mode, "HYPERMODE");
    // Validation rejection keeps it away from the gate: only violation-free
    // records are exposed, so the activatable ACTIVE set drops from 14 to 13.
    const exposed = gateRecords(result.records.filter((r) => r.violations.length === 0));
    assert.strictEqual(exposed.allowedCount, 13);
  });

  it("HKC-16/3: duplicate ACTIVE key fails closed", () => {
    const { result } = fixture("mut_duplicate_active.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "duplicate_active_key"));
    assert.strictEqual(result.duplicate_detection.duplicate_active_keys.length, 1);
    assert.strictEqual(result.duplicate_detection.duplicate_active_keys[0].value, "W");
  });

  it("HKC-16/4: removed source anchor fails closed", () => {
    const { result } = fixture("mut_removed_source.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "source_ref_missing_file"));
    const u = result.records.find((r) => r.key === "U");
    assert.ok(u.violations.includes("source_ref_missing_file"));
  });

  it("HKC-16/5: removed adapter reference fails closed", () => {
    const { result } = fixture("mut_removed_adapter.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "adapter_ref_missing"), "record reference removal is flagged");
    assert.ok(hasCode(result, "adapter_orphan_declaration"), "unreferenced §4 declaration is flagged (bijection)");
    const kt = result.records.find((r) => r.key === "KT");
    const { decision, reason } = gateRecord(kt);
    assert.strictEqual(decision, REFUSE);
    assert.strictEqual(reason, REASON.ADAPTER_REQUIRED_MISSING_REF);
  });

  it("HKC-16/6: ADAPTER_REQUIRED → ACTIVE fails closed (loader + gate)", () => {
    const { result } = fixture("mut_adapter_to_active.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "status_validation_mismatch"), "ACTIVE requires VALIDATED");
    assert.ok(hasCode(result, "adapter_ref_inconsistent"), "ACTIVE record must not reference an adapter");
    assert.ok(hasCode(result, "adapter_orphan_declaration"), "declaration loses its only reference");
    const kt = result.records.find((r) => r.key === "KT");
    assert.strictEqual(kt.activation_status, "ACTIVE");
    const { decision, reason } = gateRecord(kt);
    assert.strictEqual(decision, REFUSE);
    assert.strictEqual(reason, REASON.ACTIVE_NOT_VALIDATED);
  });

  it("HKC-16/7: BLOCKED → ACTIVE fails closed (loader + gate)", () => {
    const { result } = fixture("mut_blocked_to_active.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "status_validation_mismatch"), "ACTIVE requires VALIDATED, found PENDING_RULING");
    const k = result.records.find((r) => r.key === "K");
    assert.strictEqual(k.activation_status, "ACTIVE");
    const { decision, reason } = gateRecord(k);
    assert.strictEqual(decision, REFUSE);
    assert.strictEqual(reason, REASON.ACTIVE_NOT_VALIDATED);
    // Remaining blocked records keep their own refuse reasons.
    const ky = result.records.find((r) => r.key === "KY");
    assert.strictEqual(gateRecord(ky).reason, REASON.BLOCKED_CONFLICT);
  });

  it("HKC-16/8: removed registry record fails closed", () => {
    const { result } = fixture("mut_removed_registry.txt");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.records.length, 47, "the record is gone from the parsed set");
    assert.ok(hasCode(result, "section_declared_count_mismatch"));
    assert.ok(hasCode(result, "summary_total_mismatch"));
  });

  it("HKC-16/9: undeclared registry record fails closed", () => {
    const { result } = fixture("mut_undeclared.txt");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.records.length, 49, "an undeclared record was added");
    assert.ok(hasCode(result, "section_declared_count_mismatch"), "§2 heading declares 43, table holds 44");
    assert.ok(hasCode(result, "summary_total_mismatch"), "§5 summary declares 48, registry holds 49");
    assert.ok(hasCode(result, "summary_status_count_mismatch"));
  });

  it("HKC-16/10: corrupted registry syntax fails closed", () => {
    const { result } = fixture("mut_corrupted.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "row_column_count"), "broken row is caught structurally");
    assert.ok(hasCode(result, "missing_field"), "absent contract fields are caught");
    const r = result.records.find((rec) => rec.key === "R");
    assert.ok(r.violations.includes("row_column_count"));
    const exposed = gateRecords(result.records.filter((rec) => rec.violations.length === 0));
    assert.strictEqual(exposed.allowedCount, 13, "corrupted ACTIVE record is not exposed to the gate");
  });
});

// ---------------------------------------------------------------------------
// 3. Supporting negative fixtures (beyond the required 10)
// ---------------------------------------------------------------------------
describe("negative duties — supporting mutation fixtures", () => {
  it("HKC-NEG-4: missing source file is flagged", () => {
    const { result } = fixture("mut_missing_source.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "source_ref_missing_file"));
  });

  it("HKC-NEG-5: non-ACTIVE record with invalid mode is flagged", () => {
    const { result } = fixture("mut_invalid_mode.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "invalid_mode" && v.record === "F"));
  });

  it("HKC-NEG-7: summary total mismatch is flagged", () => {
    const { result } = fixture("mut_summary_total.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "summary_total_mismatch"));
  });

  it("HKC-NEG-8: adapter falsely ACTIVE is flagged", () => {
    const { result } = fixture("mut_adapter_false_active.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "adapter_falsely_active"));
  });

  it("HKC-NEG-9: declared count mismatch is detected", () => {
    const { result } = fixture("mut_declared_count.txt");
    assert.strictEqual(result.ok, false);
    assert.ok(hasCode(result, "section_declared_count_mismatch"));
  });

  it("HKC-NEG-11: duplicated external record fails closed via structure/summary duties", () => {
    const { result } = fixture("mut_duplicate_external.txt");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.records.length, 49);
    assert.ok(hasCode(result, "section_declared_count_mismatch"));
    assert.ok(hasCode(result, "summary_total_mismatch"));
    assert.ok(hasCode(result, "summary_status_count_mismatch"));
  });
});
