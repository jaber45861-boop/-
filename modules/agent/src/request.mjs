// Grimoire v3 — Agent Orchestrator request contract (Task 10).
//
// Normative sources:
//   01 §3  — the eight loop phases (local copy: lateral imports are
//            forbidden, so the Core vocabulary is built here — cross-checked
//            against the Module Registry's copy by the test suite).
//   03 §5  — capability tokens follow the committed provides convention
//            (`namespace:name`, kebab-case halves) used by every real
//            manifest (hotkeys:execute, toolbus:capabilities,
//            module-registry:resolve, report-bus:build).
//   Task 10 directive §5 — the request must identify the operation without
//            guessing; invalid/incomplete/ambiguous/unsupported requests
//            fail closed.
//
// The envelope is strict: exactly the declared fields, no extras anywhere
// (extra fields are refused rather than ignored — a request is contract
// data, not a bag of options). Nothing here guesses a target: a hotkey
// request must pair key XOR command (a request carrying both is ambiguous
// by shape and is refused).

// 01 §3 — the eight loop phases.
export const EIGHT_LOOP_PHASES = Object.freeze([
  "UNDERSTAND", "PLAN", "BUILD", "RUN", "TEST", "DEBUG", "IMPROVE", "SHIP",
]);

/**
 * The capability tokens a hotkey operation may execute — sourced from the
 * hotkeys module's committed manifest provides (Task 05), never invented
 * here. A request whose `kind` is "hotkey" must pair with this capability;
 * other kinds are unsupported (§18 non-goals: no new operation surfaces in
 * Task 10).
 */
export const EXECUTION_CAPABILITY = Object.freeze("hotkeys:execute");

/** Supported operation kinds → the capability that kind executes. */
export const OPERATION_KINDS = Object.freeze({
  hotkey: Object.freeze({ capability: "hotkeys:execute" }),
});

export const REQUEST_FIELDS = Object.freeze(["kind", "module", "capability", "phase", "target", "args"]);
export const TARGET_FIELDS = Object.freeze(["key", "command"]);

const CAPABILITY_RE = /^[a-z0-9-]+:[a-z0-9-]+$/;

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isSingleLine = (value) => typeof value === "string" && !/[\r\n]/.test(value);

/**
 * Validate the request envelope. Returns ALL violations in fixed order
 * (envelope fields → kind → module → capability format → kind↔capability
 * binding → phase → target → args); the first violation names the
 * refusal. Every violation is `INVALID_REQUEST` — one code, many named
 * details (the orchestrator's VALIDATE stage fails as a unit).
 */
export function validateRequest(input) {
  const violations = [];
  const v = (detail) => violations.push({ code: "INVALID_REQUEST", detail });

  if (!isPlainObject(input)) {
    v(`request must be a plain object (${typeof input})`);
    return violations;
  }

  const unexpected = Object.keys(input)
    .filter((field) => !REQUEST_FIELDS.includes(field))
    .sort();
  for (const field of unexpected) v(`unexpected request field "${field}"`);

  const { kind, module, capability, phase, target, args } = input;

  const kindValid = isNonEmptyString(kind) && Object.prototype.hasOwnProperty.call(OPERATION_KINDS, kind);
  if (!kindValid) {
    v(`kind must be one of: ${Object.keys(OPERATION_KINDS).join(", ")} (${typeof kind === "string" ? JSON.stringify(kind) : typeof kind})`);
  }

  if (!isNonEmptyString(module) || !isSingleLine(module)) {
    v(`module must be a non-empty single-line string (${typeof module})`);
  }

  const capabilityValid = isNonEmptyString(capability) && CAPABILITY_RE.test(capability);
  if (!capabilityValid) {
    v(`capability must match "namespace:name" (${typeof capability === "string" ? JSON.stringify(capability) : typeof capability})`);
  }

// The kind↔capability pairing is enforced in the RESOLVE stage (directive
// §6: "does requested capability exist?" — a capability that does not
// exist *for this operation kind* is a resolution failure, not a shape
// failure); VALIDATE owns the envelope only.

  if (!isNonEmptyString(phase) || !EIGHT_LOOP_PHASES.includes(phase)) {
    v(`phase must be one of the eight loop phases (${typeof phase === "string" ? JSON.stringify(phase) : typeof phase})`);
  }

  if (!isPlainObject(target)) {
    v(`target must be a plain object (${typeof target})`);
  } else {
    const targetUnexpected = Object.keys(target)
      .filter((field) => !TARGET_FIELDS.includes(field))
      .sort();
    for (const field of targetUnexpected) v(`unexpected target field "${field}"`);
    const hasKey = Object.prototype.hasOwnProperty.call(target, "key");
    const hasCommand = Object.prototype.hasOwnProperty.call(target, "command");
    if (hasKey === hasCommand) {
      // neither (incomplete) or both (ambiguous) — fail closed either way
      v("target must carry exactly one of key or command");
    }
    if (hasKey && (!isNonEmptyString(target.key) || !isSingleLine(target.key))) {
      v(`target.key must be a non-empty single-line string (${typeof target.key})`);
    }
    if (hasCommand && (!isNonEmptyString(target.command) || !isSingleLine(target.command))) {
      v(`target.command must be a non-empty single-line string (${typeof target.command})`);
    }
  }

  if (args !== undefined && !isPlainObject(args)) {
    v(`args must be a plain object when present (${typeof args})`);
  }

  return violations;
}

/**
 * Best-effort normalized echo of a received request for reporting. Strings
 * are single-line-sanitized (a malformed request must still be reportable —
 * it must never corrupt the report itself); non-strings become null. Used
 * only for display in the result/report; acceptance is decided solely by
 * validateRequest.
 */
export function normalizeRequest(input) {
  if (!isPlainObject(input)) return null;
  const str = (value) => (isSingleLine(value) && typeof value === "string" ? value : null);
  const rawTarget = isPlainObject(input.target) ? input.target : null;
  return {
    kind: str(input.kind),
    module: str(input.module),
    capability: str(input.capability),
    phase: str(input.phase),
    target: rawTarget
      ? { key: str(rawTarget.key), command: str(rawTarget.command) }
      : null,
    args: isPlainObject(input.args) ? input.args : null,
  };
}
