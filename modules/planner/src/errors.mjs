// Grimoire v3 — Planner error model (Task 11).
//
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This module builds the
// vocabulary locally instead of importing it from another module: the
// dependency direction (02 §3 rules 1/3) allows this L2 module to be
// composed with the L1 services, never to reach into them, and lateral
// module-to-module imports are forbidden — so each side constructs the same
// vocabulary from the Core spec (same discipline as the agent module's
// own error model).

export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

// Classes the Planner itself can raise (manifest `errors:` subset).
//   E-INPUT  — the request envelope failed the contract (INVALID_REQUEST)
//   E-VALID  — the plan does not answer the tier's required questions
//              (PLAN_INCOMPLETE) and the REPORT_FAILED fallback class
//   E-ENV    — the injected Report Bus refuses (classified REPORT_FAILED)
//   E-CONFLICT — declared so a refusing Report Bus that classifies a
//              conflict (e.g. DUPLICATE_SECTION) propagates truthfully
// E-DEP is never raisable (no external service), E-TOOL never (no tools),
// E-UNKNOWN never (nothing here is unclassifiable — every refusal is a
// named contract rule).
export const PLANNER_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-CONFLICT",
  "E-VALID",
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
