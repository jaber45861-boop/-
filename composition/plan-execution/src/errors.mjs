// Grimoire v3 — Plan–Execution composition error model.
//
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This layer builds the
// vocabulary locally instead of importing it from another module: the
// composition root may be composed with the L2 entries it wires (02 §3 rule
// 3 names the composition root as the wiring boundary), but it still never
// reaches into another module's internals — so each side constructs the same
// vocabulary from the Core spec (same discipline as the planner's and the
// agent's own error models).

export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

// Classes this layer itself can raise, plus every class its two downstream
// contracts can propagate through it (the planner's four ⊆ the agent's six):
//   E-INPUT     — the bundle envelope failed the contract (INVALID_REQUEST)
//                 and the §5.2 approval gate withholds a required decision
//                 (APPROVAL_REQUIRED)
//   E-ENV       — a disabled/unavailable downstream module or a refusing
//                 report step (classified REPORT_FAILED)
//   E-CONFLICT  — an ambiguous capability or an undeclared phase
//   E-TOOL      — a declared tool unavailable at downstream preflight
//   E-VALID     — an incomplete plan (PLAN_INCOMPLETE), an invalid manifest,
//                 and the REPORT_FAILED fallback class
//   E-UNKNOWN   — a downstream handler exception propagates classified
// E-DEP is never raisable here (this layer calls no external service).
export const COMPOSITION_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

/** Build a structured error object (never a string, never a stack dump). */
export function makeError(klass, code, message, detail) {
  return {
    class: klass,
    code,
    message,
    detail: detail === undefined ? null : detail,
  };
}

export function isCoreErrorClass(value) {
  return CORE_ERROR_CLASSES.includes(value);
}
