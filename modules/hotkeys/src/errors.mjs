// Grimoire v3 — Hotkeys module error model.
// The ONLY taxonomy is 01 §11.1 (seven Core classes). This module declares a
// subset in its manifest; no second taxonomy exists.

export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

// Declared in modules/hotkeys/manifest.yaml (`errors:`) — every failure this
// module can raise maps into exactly one of these:
//   E-INPUT    invalid invocation (bad argument types/options, unknown key/
//              command) or malformed invocation fields
//   E-ENV      required input file absent from the environment (ENOENT), or
//              a required runtime handler absent (E_ENV_HANDLER_MISSING)
//   E-CONFLICT invocation conflicts with the registry's activation ruling
//              (12 §6): the runtime refuses and presents the conflict — it
//              never silently picks a side (added with the Task 06 runtime)
//   E-TOOL     file-read tool failed on an existing target (EISDIR/EACCES/…),
//              or a declared tool is unavailable (E_TOOL_UNAVAILABLE)
//   E-VALID    any registry/manifest validation failure, including an
//              unauthorized/forged resolution (fail closed)
//   E-UNKNOWN  unclassifiable exception (01 §11.1: classify before fixing)
// E-DEP is never raisable here: the module calls no external API/service.
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
 * Classify a filesystem exception from a read attempt.
 * ENOENT  -> E-ENV  (the environment lacks a required input file)
 * EISDIR/EACCES/EPERM/ELOOP/ENOTDIR -> E-TOOL (the read tool failed)
 * anything else -> E-UNKNOWN (classify before fixing — 01 §11.1)
 * `what` must be a relative label, never a machine-local path.
 */
export function classifyFsError(error, what) {
  const code = error && error.code;
  if (code === "ENOENT") {
    return makeError("E-ENV", "E_ENV_MISSING_FILE", `${what} not found in environment`, code);
  }
  if (code === "EISDIR" || code === "EACCES" || code === "EPERM" || code === "ELOOP" || code === "ENOTDIR") {
    return makeError("E-TOOL", "E_TOOL_READ_FAILED", `${what} could not be read`, code);
  }
  return makeError("E-UNKNOWN", "E_UNKNOWN_EXCEPTION", `${what} read failed`, code || String(error && error.name));
}

/**
 * Classify an exception escaping a handler run (01 §11.1). An error that
 * already carries a structured Grimoire error (the module classified it at
 * the throw site — e.g. the native write path's `E_TOOL_WRITE_FAILED`,
 * 27 §R4) is returned as classified; everything else falls through to the
 * fs mapping and the E-UNKNOWN fallback.
 */
export function classifyException(error) {
  const preClassified = error && typeof error.grimoire === "object" && error.grimoire !== null
    ? error.grimoire
    : null;
  if (preClassified !== null
      && typeof preClassified.code === "string"
      && isCoreErrorClass(preClassified.class)) {
    return preClassified;
  }
  const code = error && error.code;
  if (code === "ENOENT" || code === "EISDIR" || code === "EACCES" || code === "EPERM" || code === "ELOOP" || code === "ENOTDIR") {
    return classifyFsError(error, "input");
  }
  return makeError(
    "E-UNKNOWN",
    "E_UNKNOWN_EXCEPTION",
    "unclassified failure inside the hotkeys module",
    error && error.name ? String(error.name) : "unknown"
  );
}
