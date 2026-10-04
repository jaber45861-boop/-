// Grimoire v3 — Tool Bus error model (Task 07).
//
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This module constructs
// structured errors locally instead of importing from another module: the
// dependency direction (02 §3 rule 1/3) allows L2 modules to consume this L1
// service, never the reverse, and lateral module-to-module imports are
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

// Classes the Tool Bus itself can raise (manifest `errors:` subset).
// E-DEP is never raisable here: the bus calls no external API/service; it
// only resolves declarations and dispatches to in-process providers.
export const MODULE_ERROR_CLASSES = Object.freeze([
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

/**
 * Classify a provider exception (01 §11.1: classify before fixing).
 * ENOENT  -> E-ENV  (environment lacks a required input file)
 * EISDIR/EACCES/EPERM/ELOOP/ENOTDIR -> E-TOOL (the read tool failed)
 * everything else -> E-UNKNOWN.
 * `what` must be a relative label, never a machine-local path.
 */
export function classifyProviderError(error, what) {
  const code = error && error.code;
  if (code === "ENOENT") {
    return makeError("E-ENV", "E_ENV_MISSING_FILE", `${what} not found in environment`, code);
  }
  if (code === "EISDIR" || code === "EACCES" || code === "EPERM" || code === "ELOOP" || code === "ENOTDIR") {
    return makeError("E-TOOL", "E_TOOL_READ_FAILED", `${what} could not be read`, code);
  }
  return makeError(
    "E-UNKNOWN",
    "E_UNKNOWN_EXCEPTION",
    `${what} provider failed`,
    error && error.name ? String(error.name) : "unknown"
  );
}
