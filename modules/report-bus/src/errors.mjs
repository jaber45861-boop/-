// Grimoire v3 — Report Bus error model (Task 09).
//
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This module builds the
// vocabulary locally instead of importing from another module: the dependency
// direction (02 §3 rule 1/3) allows this L1 Core Service to be consumed by
// modules, never the reverse, and lateral module-to-module imports are
// forbidden — so each side constructs the same vocabulary from the Core spec.

export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

// Classes the Report Bus itself can raise (manifest `errors:` subset).
// E-TOOL is never raisable: the bus invokes no tool and dispatches nothing
// (directive §10 — reporting only). E-DEP is never raisable: no external
// API/service is called. E-UNKNOWN is never raisable: every refusal path is
// a named, classified rule violation (no user code executes while building
// a report).
export const REPORT_BUS_ERROR_CLASSES = Object.freeze([
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
