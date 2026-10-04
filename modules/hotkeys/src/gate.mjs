// Grimoire v3 — L2 Hotkeys module: activation gate.
// Gate rule (normative): ONLY records with Activation status == ACTIVE may pass
// the gate. Every other status is refuse with an explicit, deterministic reason:
//
//   ACTIVE            -> ALLOW (HKC-03/04)
//   ADAPTER_REQUIRED  -> REFUSE adapter missing/undeclared (HKC-05)
//   BLOCKED_*         -> REFUSE pending ruling/evidence (HKC-06/07)
//   HISTORICAL_REMOVED-> REFUSE never exposed as a command (HKC-08)
//   METADATA_ONLY     -> REFUSE informational row, not a command (HKC-08)
//
// The gate is pure and side-effect free: it never writes, never mutates the
// registry, and never executes a hotkey. It is called by the module's RUN phase
// after LOAD+VALIDATE and before any emit of the report.

export const ALLOW = Symbol.for("hotkeys.allow");
export const REFUSE = Symbol.for("hotkeys.refuse");

export const REASON = Object.freeze({
  // ACTIVE
  ACTIVE_VALIDATED: "ACTIVE record with VALIDATED status is directly usable",
  ACTIVE_NOT_VALIDATED: "ACTIVE record lacks VALIDATED status",
  // ADAPTER_REQUIRED
  ADAPTER_REQUIRED_OK: "ADAPTER_REQUIRED record references an existing adapter declaration",
  ADAPTER_REQUIRED_MISSING_REF: "ADAPTER_REQUIRED record carries no adapter reference",
  ADAPTER_REQUIRED_UNDECLARED: "ADAPTER_REQUIRED record references undeclared adapter",
  // BLOCKED_*
  BLOCKED_CONFLICT: "BLOCKED_CONFLICT must not execute (awaits executive ruling)",
  BLOCKED_AMBIGUOUS: "BLOCKED_AMBIGUOUS must not execute (awaits executive ruling)",
  BLOCKED_INSUFFICIENT_INFO: "BLOCKED_INSUFFICIENT_INFO must not execute (awaits evidence)",
  // Historical / metadata
  HISTORICAL_REMOVED: "HISTORICAL_REMOVED is retained only for history",
  METADATA_ONLY: "METADATA_ONLY is informational, not a command",
});

export function resolveActivation(record) {
  const status = record && record.activation_status;
  // ACTIVE is only valid when the companion validation status is VALIDATED.
  if (status === "ACTIVE") {
    return record.validation_status === "VALIDATED" ? ALLOW : REFUSE;
  }
  return REFUSE;
}

export function gateReason(record) {
  const status = record && record.activation_status;
  if (status === "ACTIVE") return REASON.ACTIVE_NOT_VALIDATED;
  if (status === "ADAPTER_REQUIRED") {
    const adapter = record && record.adapter;
    if (adapter === undefined || adapter === null || adapter === "" || adapter === "—") {
      return REASON.ADAPTER_REQUIRED_MISSING_REF;
    }
    return REASON.ADAPTER_REQUIRED_OK;
  }
  if (status === "BLOCKED_CONFLICT") return REASON.BLOCKED_CONFLICT;
  if (status === "BLOCKED_AMBIGUOUS") return REASON.BLOCKED_AMBIGUOUS;
  if (status === "BLOCKED_INSUFFICIENT_INFO") return REASON.BLOCKED_INSUFFICIENT_INFO;
  if (status === "HISTORICAL_REMOVED") return REASON.HISTORICAL_REMOVED;
  if (status === "METADATA_ONLY") return REASON.METADATA_ONLY;
  return "activation status " + JSON.stringify(status) + " is not a recognized activation status";
}

/** Gate a single record. Returns { decision, reason } (decision === ALLOW or REFUSE). */
export function gateRecord(record) {
  const decision = resolveActivation(record);
  return { decision, reason: gateReason(record) };
}

/** Gate a collection of records. Never throws; returns a stable summary object. */
export function gateRecords(records) {
  const allow = [];
  const refuse = [];
  for (const record of records || []) {
    const { decision, reason } = gateRecord(record);
    if (decision === ALLOW) allow.push(record);
    else refuse.push({ record, reason });
  }
  return { allow, refuse, allowedCount: allow.length, refusedCount: refuse.length };
}

/** Test-only: does the gate accept a record with a specific status? */
export function gateTestStatus(status) {
  // Deterministic lookup by status name; no random/ad-hoc behavior.
  const samples = {
    ACTIVE: ALLOW,
    ADAPTER_REQUIRED: REFUSE,
    BLOCKED_CONFLICT: REFUSE,
    BLOCKED_AMBIGUOUS: REFUSE,
    BLOCKED_INSUFFICIENT_INFO: REFUSE,
    HISTORICAL_REMOVED: REFUSE,
    METADATA_ONLY: REFUSE,
  };
  return samples[status];
}
