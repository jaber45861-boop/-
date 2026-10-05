// Grimoire v3 — Module Registry error model (Task 08).
//
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This module constructs
// structured errors locally instead of importing from another module: the
// dependency direction (02 §3 rule 1/3) allows this L1 service to be consumed
// by modules, never the reverse, and lateral module-to-module imports are
// forbidden — so each side builds the same vocabulary from the Core spec.

export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

// Classes the Module Registry itself can raise (manifest `errors:` subset).
// E-DEP is never raisable here: the registry calls no external API/service —
// it only parses static manifests, checks declarations, and dispatches to an
// optional in-process Tool Bus `check`. E-UNKNOWN is never raisable either:
// every refusal path is a named, classified rule violation (no user code
// executes inside the registry).
export const MODULE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-CONFLICT",
  "E-TOOL",
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
