// Grimoire v3 — Agent Orchestrator error model (Task 10).
//
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This module builds the
// vocabulary locally instead of importing from another module: the dependency
// direction (02 §3 rule 1/3) allows this L2 module to be composed with the
// L1 services, never to reach into them, and lateral module-to-module
// imports are forbidden — so each side constructs the same vocabulary from
// the Core spec.

export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

// Classes the Agent Orchestrator itself can raise (manifest `errors:`
// subset). E-DEP is never raisable: the orchestrator calls no external
// API/service — it coordinates in-process contracts only. The three
// "classified" result codes (EXECUTION_REFUSED, EXECUTION_FAILED,
// REPORT_FAILED) propagate the class of the underlying runtime/report-bus
// refusal, which is always one of these six (the hotkeys runtime and the
// Report Bus both declare no E-DEP either — verified by their own
// errors.mjs modules).
export const AGENT_ERROR_CLASSES = Object.freeze([
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
