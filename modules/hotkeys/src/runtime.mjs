// Grimoire v3 — L2 Hotkeys module: runtime executor (Task 06).
//
// Pipeline (directive §2/§4), always in this order, fail-closed at every step:
//
//   REGISTRY -> VALIDATE -> GATE -> RESOLVE -> EXECUTE -> CAPTURE -> REPORT
//
// Public API:
//   createRuntime({ registryText, root, availableTools?, handlers? })
//     .resolveHotkey(input)            pure — never executes a handler (§8)
//     .executeResolvedHotkey(res)      executes only an authorized resolution
//     .executeHotkey(input)            resolve + execute (the §4 contract)
//   buildRuntimeReport(results)        deterministic text + sha256 (§13)
//
// Invariants:
//   - only records that pass VALIDATE (loader, zero violations) and the
//     activation gate (gate.mjs, ACTIVE + VALIDATED only) can reach a handler
//   - no fallback dispatch: lookup is by the exact resolved command id;
//     a handler registered for any other command is never consulted
//   - UNIMPLEMENTED for an ACTIVE record without a handler — behavior is
//     never invented (§5/§9 of the directive)
//   - resolveHotkey is pure: handlers are looked up by identity, never run;
//     executeResolvedHotkey will only run a resolution issued by the same
//     runtime (WeakMap context + WeakSet provenance — a forged resolution
//     object is refused with E_VALID_UNAUTHORIZED_RESOLUTION)
//   - deterministic: no timestamps, no random ids, stable ordering (§10)
//
// Error vocabulary: Core classes only (01 §11.1) via errors.mjs makeError /
// classifyException. Each result code maps to exactly one Core class in
// RESULT_CODES; codes and their justification are documented in
// docs/v3/14-hotkey-runtime.md §5 (§11 of the directive).

import { createHash } from "node:crypto";
import { validateRegistryText } from "./loader.mjs";
import { gateRecord, ALLOW } from "./gate.mjs";
import { makeError, classifyException } from "./errors.mjs";
import { DEFAULT_HANDLERS, DEFAULT_AVAILABLE_TOOLS } from "./handlers.mjs";

/** The six execution classes (directive §6). */
export const EXECUTION_CLASSES = Object.freeze([
  "EXECUTABLE",
  "UNIMPLEMENTED",
  "REFUSED",
  "INVALID_INPUT",
  "TOOL_REQUIRED",
  "EXECUTION_ERROR",
]);

/**
 * Every result code the runtime can emit, mapped to the Core error class it
 * belongs to (null = success code, not an error). No code exists outside this
 * table; no Core class outside 01 §11.1 is used.
 */
export const RESULT_CODES = Object.freeze({
  // Success (no error class).
  OK_RESOLVED: null,
  OK_EXECUTED: null,
  // E-INPUT — the invocation itself is malformed or names nothing registered.
  E_INPUT_INVALID_INVOCATION: "E-INPUT",
  E_INPUT_MISSING_IDENTIFIER: "E-INPUT",
  E_INPUT_INVALID_KEY: "E-INPUT",
  E_INPUT_INVALID_COMMAND: "E-INPUT",
  E_INPUT_UNEXPECTED_FIELD: "E-INPUT",
  E_INPUT_KEY_COMMAND_MISMATCH: "E-INPUT",
  E_INPUT_INVALID_ARGS: "E-INPUT",
  E_INPUT_UNKNOWN_KEY: "E-INPUT",
  E_INPUT_UNKNOWN_COMMAND: "E-INPUT",
  E_INPUT_INVALID_RUNTIME_CONFIG: "E-INPUT",
  // E-VALID — validation failed somewhere; fail closed (manifest errors).
  E_VALID_REGISTRY_INVALID: "E-VALID",
  E_VALID_RECORD_REJECTED: "E-VALID",
  E_VALID_ACTIVE_NOT_VALIDATED: "E-VALID",
  E_VALID_UNKNOWN_STATUS: "E-VALID",
  E_VALID_UNAUTHORIZED_RESOLUTION: "E-VALID",
  E_VALID_HANDLER_SPEC: "E-VALID",
  // E-CONFLICT — the invocation conflicts with the registry's activation
  // ruling (12 §6): stop and present the conflict, never silently pick a side.
  E_CONFLICT_ADAPTER_REQUIRED: "E-CONFLICT",
  E_CONFLICT_BLOCKED_CONFLICT: "E-CONFLICT",
  E_CONFLICT_BLOCKED_AMBIGUOUS: "E-CONFLICT",
  E_CONFLICT_BLOCKED_INSUFFICIENT_INFO: "E-CONFLICT",
  E_CONFLICT_HISTORICAL_REMOVED: "E-CONFLICT",
  E_CONFLICT_METADATA_ONLY: "E-CONFLICT",
  E_CONFLICT_AMBIGUOUS_IDENTITY: "E-CONFLICT",
  // E-ENV — a required capability is absent from this runtime's environment.
  E_ENV_HANDLER_MISSING: "E-ENV",
  // E-TOOL — a declared tool is unavailable (03 §4 H5: blocked, E-TOOL).
  E_TOOL_UNAVAILABLE: "E-TOOL",
  // Tool Bus integration (Task 07): capability states translated at the
  // runtime boundary — documented in docs/v3/15-tool-bus.md §Runtime
  // integration. The six execution classes are unchanged.
  E_CONFLICT_DEPENDENCY_BLOCKED: "E-CONFLICT",
  E_CONFLICT_TOOL_DISABLED: "E-CONFLICT",
  E_VALID_CAPABILITY_INVALID: "E-VALID",
  // E-UNKNOWN — classifyException's own codes for handler failures
  // (E_UNKNOWN_EXCEPTION, E_ENV_MISSING_FILE, E_TOOL_READ_FAILED, …).
  E_UNKNOWN_EXCEPTION: "E-UNKNOWN",
  E_ENV_MISSING_FILE: "E-ENV",
  E_TOOL_READ_FAILED: "E-TOOL",
});

// Non-enumerable provenance channel: only resolutions issued by
// resolveHotkey() are registered, and each is bound to its issuing runtime.
const ISSUED = new WeakSet();
const CONTEXT = new WeakMap();

function states(partial) {
  return {
    validated: false,
    allowed: false,
    resolved: false,
    executable: false,
    executed: false,
    refused: false,
    invalid_input: false,
    unimplemented: false,
    tool_unavailable: false,
    execution_failed: false,
    ...partial,
  };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function echoInput(input) {
  return {
    key: isPlainObject(input) && typeof input.key === "string" ? input.key : null,
    command: isPlainObject(input) && typeof input.command === "string" ? input.command : null,
  };
}

// The registry's Command cells are written `grimoire.key.X` (markdown code
// spans); the loader preserves that raw cell text. The canonical command id
// (03 §4 H3) is the unquoted value — normalization happens ONLY here, in the
// runtime, so neither the loader nor the L3 registry is touched.
function normalizeCommand(command) {
  return typeof command === "string" ? command.replace(/^`+|`+$/g, "").trim() : command;
}

/**
 * Step 1 — input validation (§4.1). Allowed fields: key, command, args.
 * Anything else fails closed as INVALID_INPUT (E-INPUT).
 */
function validateInvocation(input) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      code: "E_INPUT_INVALID_INVOCATION",
      error: makeError("E-INPUT", "E_INPUT_INVALID_INVOCATION", "invocation must be a plain object", typeof input),
      echo: { key: null, command: null },
    };
  }
  for (const field of Object.keys(input)) {
    if (field !== "key" && field !== "command" && field !== "args") {
      return {
        ok: false,
        code: "E_INPUT_UNEXPECTED_FIELD",
        error: makeError("E-INPUT", "E_INPUT_UNEXPECTED_FIELD", "unexpected invocation field", field),
        echo: echoInput(input),
      };
    }
  }
  const hasKey = Object.prototype.hasOwnProperty.call(input, "key");
  const hasCommand = Object.prototype.hasOwnProperty.call(input, "command");
  if (!hasKey && !hasCommand) {
    return {
      ok: false,
      code: "E_INPUT_MISSING_IDENTIFIER",
      error: makeError("E-INPUT", "E_INPUT_MISSING_IDENTIFIER", "invocation needs a key or a command", null),
      echo: echoInput(input),
    };
  }
  if (hasKey && (typeof input.key !== "string" || input.key.trim() === "")) {
    return {
      ok: false,
      code: "E_INPUT_INVALID_KEY",
      error: makeError("E-INPUT", "E_INPUT_INVALID_KEY", "key must be a non-empty string", typeof input.key),
      echo: echoInput(input),
    };
  }
  if (hasCommand && (typeof input.command !== "string" || input.command.trim() === "")) {
    return {
      ok: false,
      code: "E_INPUT_INVALID_COMMAND",
      error: makeError("E-INPUT", "E_INPUT_INVALID_COMMAND", "command must be a non-empty string", typeof input.command),
      echo: echoInput(input),
    };
  }
  if (Object.prototype.hasOwnProperty.call(input, "args") && !isPlainObject(input.args)) {
    return {
      ok: false,
      code: "E_INPUT_INVALID_ARGS",
      error: makeError("E-INPUT", "E_INPUT_INVALID_ARGS", "args must be a plain object", typeof input.args),
      echo: echoInput(input),
    };
  }
  return {
    ok: true,
    key: hasKey ? input.key : null,
    command: hasCommand ? input.command : null,
    args: hasKey || hasCommand ? (input.args === undefined ? {} : input.args) : {},
    echo: echoInput(input),
  };
}

/** Registry-declared tools of a record (12 §2 "Tools" column). */
export function recordTools(record) {
  const raw = record && record.tools;
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "—" || trimmed.toLowerCase() === "none") return [];
  return trimmed
    .split(",")
    .map((tool) => tool.trim())
    .filter((tool) => tool !== "");
}

// Tool Bus translation (Task 07): the bus answers "is this capability
// usable?" before execution. Exact semantics per bus code — no collapsing:
//   TOOL_NOT_FOUND / TOOL_UNAVAILABLE / DEPENDENCY_MISSING -> TOOL_REQUIRED
//     with the long-standing E_TOOL_UNAVAILABLE code (03 §4 H5: blocked, E-TOOL)
//   TOOL_BLOCKED / DEPENDENCY_BLOCKED -> TOOL_REQUIRED + E_CONFLICT_DEPENDENCY_BLOCKED
//   TOOL_DISABLED -> TOOL_REQUIRED + E_CONFLICT_TOOL_DISABLED
//   CAPABILITY_INVALID -> REFUSED + E_VALID_CAPABILITY_INVALID (fail closed)
const BUS_REFUSAL_MAP = Object.freeze({
  TOOL_NOT_FOUND: { classification: "TOOL_REQUIRED", code: "E_TOOL_UNAVAILABLE", klass: "E-TOOL", message: "required tool is not available to this runtime" },
  TOOL_UNAVAILABLE: { classification: "TOOL_REQUIRED", code: "E_TOOL_UNAVAILABLE", klass: "E-TOOL", message: "required tool is not available to this runtime" },
  DEPENDENCY_MISSING: { classification: "TOOL_REQUIRED", code: "E_TOOL_UNAVAILABLE", klass: "E-TOOL", message: "required tool is not available to this runtime" },
  TOOL_BLOCKED: { classification: "TOOL_REQUIRED", code: "E_CONFLICT_DEPENDENCY_BLOCKED", klass: "E-CONFLICT", message: "required tool capability is blocked" },
  DEPENDENCY_BLOCKED: { classification: "TOOL_REQUIRED", code: "E_CONFLICT_DEPENDENCY_BLOCKED", klass: "E-CONFLICT", message: "required tool capability is blocked" },
  TOOL_DISABLED: { classification: "TOOL_REQUIRED", code: "E_CONFLICT_TOOL_DISABLED", klass: "E-CONFLICT", message: "required tool capability is disabled" },
  CAPABILITY_INVALID: { classification: "REFUSED", code: "E_VALID_CAPABILITY_INVALID", klass: "E-VALID", message: "required tool capability failed validation" },
});

/**
 * Gate a list of required tool tokens: Tool Bus first when wired (exact id
 * lookup, no fuzzy matching, no substitute), else the legacy availableTools
 * array. Returns null when everything is available, otherwise a structured
 * refusal — never executes anything.
 */
function gateTools(runtime, tokens) {
  for (const tool of tokens) {
    if (runtime.toolBus) {
      const check = runtime.toolBus.check(tool);
      if (!check.ok) {
        const mapped = BUS_REFUSAL_MAP[check.code] ?? BUS_REFUSAL_MAP.TOOL_NOT_FOUND;
        return { classification: mapped.classification, code: mapped.code, error: makeError(mapped.klass, mapped.code, mapped.message, tool) };
      }
      continue;
    }
    if (!runtime.availableTools.includes(tool)) {
      return {
        classification: "TOOL_REQUIRED",
        code: "E_TOOL_UNAVAILABLE",
        error: makeError("E-TOOL", "E_TOOL_UNAVAILABLE", "required tool is not available to this runtime", tool),
      };
    }
  }
  return null;
}

/** Gate refusal code for a record that reached the gate (12 §6 table). */
function gateRefusalCode(record) {
  switch (record.activation_status) {
    case "ACTIVE":
      return "E_VALID_ACTIVE_NOT_VALIDATED";
    case "ADAPTER_REQUIRED":
      return "E_CONFLICT_ADAPTER_REQUIRED";
    case "BLOCKED_CONFLICT":
      return "E_CONFLICT_BLOCKED_CONFLICT";
    case "BLOCKED_AMBIGUOUS":
      return "E_CONFLICT_BLOCKED_AMBIGUOUS";
    case "BLOCKED_INSUFFICIENT_INFO":
      return "E_CONFLICT_BLOCKED_INSUFFICIENT_INFO";
    case "HISTORICAL_REMOVED":
      return "E_CONFLICT_HISTORICAL_REMOVED";
    case "METADATA_ONLY":
      return "E_CONFLICT_METADATA_ONLY";
    default:
      // Defense in depth: the loader rejects unknown statuses, so validation
      // fails before the gate when this branch would matter.
      return "E_VALID_UNKNOWN_STATUS";
  }
}

function buildTrace(record, handler, classification, code) {
  if (!record) return null;
  return {
    key: record.key ?? null,
    command: record.command === null || record.command === undefined ? null : normalizeCommand(record.command),
    source: record.source_raw ?? null,
    registry_status: record.activation_status ?? null,
    validation_status: record.validation_status ?? null,
    core_mode: record.mode ?? null,
    handler_id: handler && handler.id ? handler.id : null,
    classification,
    code,
  };
}

// ---------------------------------------------------------------------------
// Resolution (pure — §8: resolveHotkey must NOT execute)
// ---------------------------------------------------------------------------

function resolveHotkeyImpl(runtime, input) {
  const makeResolution = ({ classification, code, error, state, record = null, handler = null, args = null }) => {
    const resolution = {
      stage: "resolve",
      input: echoInput(input),
      classification,
      code,
      authorized: state.allowed,
      error,
      states: state,
      trace: buildTrace(record, handler, classification, code),
    };
    ISSUED.add(resolution);
    if (classification === "EXECUTABLE") {
      CONTEXT.set(resolution, { runtime, record, handler, args, root: runtime.root });
    }
    return resolution;
  };

  // 1. Input validation — malformed invocation never touches the registry.
  const invocation = validateInvocation(input);
  if (!invocation.ok) {
    return makeResolution({
      classification: "INVALID_INPUT",
      code: invocation.code,
      error: invocation.error,
      state: states({ invalid_input: true }),
    });
  }

  // 2. Registry validation — an invalid registry refuses every invocation.
  const validation = runtime.validation;
  if (!validation.ok) {
    return makeResolution({
      classification: "REFUSED",
      code: "E_VALID_REGISTRY_INVALID",
      error: makeError(
        "E-VALID",
        "E_VALID_REGISTRY_INVALID",
        "registry validation failed; no invocation may execute",
        `${validation.violations.length} violation(s)`
      ),
      state: states({ refused: true }),
    });
  }

  // 3. Resolution against the validated record set (exact ids only — no
  //    guessing, no purpose-string matching, no fallback). Key is checked
  //    before command when both are present (deterministic order).
  let record = null;
  if (invocation.key !== null) {
    if (!runtime.byKey.has(invocation.key)) {
      return makeResolution({
        classification: "REFUSED",
        code: "E_INPUT_UNKNOWN_KEY",
        error: makeError("E-INPUT", "E_INPUT_UNKNOWN_KEY", "key is not registered", invocation.key),
        state: states({ validated: true, refused: true }),
      });
    }
    record = runtime.byKey.get(invocation.key);
    if (record === null) {
      return makeResolution({
        classification: "REFUSED",
        code: "E_CONFLICT_AMBIGUOUS_IDENTITY",
        error: makeError("E-CONFLICT", "E_CONFLICT_AMBIGUOUS_IDENTITY", "multiple records share this key", invocation.key),
        state: states({ validated: true, refused: true }),
      });
    }
  }
  if (invocation.command !== null) {
    if (!runtime.byCommand.has(invocation.command)) {
      return makeResolution({
        classification: "REFUSED",
        code: "E_INPUT_UNKNOWN_COMMAND",
        error: makeError("E-INPUT", "E_INPUT_UNKNOWN_COMMAND", "command is not registered", invocation.command),
        state: states({ validated: true, refused: true }),
      });
    }
    const byCommand = runtime.byCommand.get(invocation.command);
    if (byCommand === null) {
      return makeResolution({
        classification: "REFUSED",
        code: "E_CONFLICT_AMBIGUOUS_IDENTITY",
        error: makeError("E-CONFLICT", "E_CONFLICT_AMBIGUOUS_IDENTITY", "multiple records share this command", invocation.command),
        state: states({ validated: true, refused: true }),
      });
    }
    if (record && byCommand !== record) {
      return makeResolution({
        classification: "INVALID_INPUT",
        code: "E_INPUT_KEY_COMMAND_MISMATCH",
        error: makeError(
          "E-INPUT",
          "E_INPUT_KEY_COMMAND_MISMATCH",
          "key and command resolve to different records",
          `${invocation.key} vs ${invocation.command}`
        ),
        state: states({ validated: true, invalid_input: true }),
      });
    }
    record = byCommand;
  }

  // 4. Record-level validation belt: a record rejected by the loader is
  //    never dispatched (01 §13.5).
  if (record.violations.length > 0) {
    return makeResolution({
      classification: "REFUSED",
      code: "E_VALID_RECORD_REJECTED",
      error: makeError(
        "E-VALID",
        "E_VALID_RECORD_REJECTED",
        "record failed registry validation; execution refused",
        record.violations.join(", ")
      ),
      state: states({ validated: true, refused: true }),
      record,
    });
  }

  // 5. Activation gate — only ACTIVE + VALIDATED passes (gate.mjs, 12 §6).
  const gate = gateRecord(record);
  if (gate.decision !== ALLOW) {
    const code = gateRefusalCode(record);
    return makeResolution({
      classification: "REFUSED",
      code,
      error: makeError("E-CONFLICT", code, "activation gate refused this record", gate.reason),
      state: states({ validated: true, refused: true }),
      record,
    });
  }

  // Gate passed: the record is validated, allowed, and resolved.
  const resolvedState = { validated: true, allowed: true, resolved: true };

  // 6. Registry-declared tools (12 §2 Tools column) before any dispatch.
  const recordToolRefusal = gateTools(runtime, recordTools(record));
  if (recordToolRefusal !== null) {
    return makeResolution({
      classification: recordToolRefusal.classification,
      code: recordToolRefusal.code,
      error: recordToolRefusal.error,
      state: recordToolRefusal.classification === "REFUSED"
        ? states({ ...resolvedState, refused: true })
        : states({ ...resolvedState, tool_unavailable: true }),
      record,
    });
  }

  // 7. Handler lookup — absent handler is UNIMPLEMENTED, never invented.
  const handler = runtime.handlers[normalizeCommand(record.command)] ?? null;
  if (!handler) {
    return makeResolution({
      classification: "UNIMPLEMENTED",
      code: "E_ENV_HANDLER_MISSING",
      error: makeError("E-ENV", "E_ENV_HANDLER_MISSING", "no runtime handler registered for this command", normalizeCommand(record.command)),
      state: states({ ...resolvedState, unimplemented: true }),
      record,
    });
  }

  // 8. Argument validation — the handler owns its argument schema.
  const argsCheck = handler.validateArgs(invocation.args);
  if (!isPlainObject(argsCheck) || argsCheck.ok !== true) {
    const code = argsCheck && typeof argsCheck.code === "string" ? argsCheck.code : "E_INPUT_INVALID_ARGS";
    const message = argsCheck && typeof argsCheck.message === "string"
      ? argsCheck.message
      : "invalid arguments for this command";
    return makeResolution({
      classification: "INVALID_INPUT",
      code,
      error: makeError("E-INPUT", code, message, normalizeCommand(record.command)),
      state: states({ ...resolvedState, invalid_input: true }),
      record,
      handler,
    });
  }

  // 9. Handler tool requirements (01 §10.1, 03 §4 H5).
  const handlerToolRefusal = gateTools(runtime, handler.requiredTools);
  if (handlerToolRefusal !== null) {
    return makeResolution({
      classification: handlerToolRefusal.classification,
      code: handlerToolRefusal.code,
      error: handlerToolRefusal.error,
      state: handlerToolRefusal.classification === "REFUSED"
        ? states({ ...resolvedState, refused: true })
        : states({ ...resolvedState, tool_unavailable: true }),
      record,
      handler,
    });
  }

  // 10. Authorized for execution (handler + args + tools all in place).
  return makeResolution({
    classification: "EXECUTABLE",
    code: "OK_RESOLVED",
    error: null,
    state: states({ ...resolvedState, executable: true }),
    record,
    handler,
    args: invocation.args,
  });
}

// ---------------------------------------------------------------------------
// Execution (§8: only an already-authorized resolution may execute)
// ---------------------------------------------------------------------------

function statusFor({ executed, error }) {
  if (executed) return "success";
  if (error && (error.class === "E-ENV" || error.class === "E-TOOL")) return "blocked";
  return "failed";
}

function buildEvidence(runtime, { classification, code, record, handler, trace, error, output }) {
  const validation = runtime.validation;
  const evidence = [
    `registry: docs/v3/12-hotkey-registry.md sha256 ${validation.meta.sha256} (${validation.counts.loaded} records, ${validation.ok ? "validated" : "validation FAILED"})`,
  ];
  if (trace) {
    evidence.push(
      `resolve: ${trace.key} -> ${trace.command} (${trace.registry_status}/${trace.validation_status}, mode ${trace.core_mode}, source ${trace.source})`
    );
  }
  if (output) {
    evidence.push(`execute: ${handler.id} -> ${output.file} (${output.bytes} bytes, sha256 ${output.sha256})`);
  } else if (classification === "EXECUTION_ERROR" && handler) {
    evidence.push(`execute: ${handler.id} failed (${code})`);
  } else if (classification === "TOOL_REQUIRED" && error) {
    evidence.push(`tools: missing ${JSON.stringify(error.detail)} (${code})`);
  } else if (classification === "UNIMPLEMENTED" && trace) {
    evidence.push(`handler: none for ${trace.command} (${code})`);
  } else if (classification === "REFUSED" || classification === "INVALID_INPUT") {
    evidence.push(`refused: ${code}`);
  } else if (classification === "EXECUTABLE") {
    evidence.push(`execute: ${handler.id} ready (${code})`);
  }
  return evidence;
}

function buildPhaseLedger({ classification, code, states: state }) {
  const rejected = classification === "REFUSED" || (classification === "INVALID_INPUT" && !state.resolved);
  const resolveEntry = rejected
    ? `RESOLVE: refused (${code})`
    : `RESOLVE: done (${classification})`;
  let executeEntry;
  if (state.executed) {
    executeEntry = "EXECUTE: done (EXECUTABLE)";
  } else if (classification === "EXECUTION_ERROR") {
    executeEntry = `EXECUTE: failed (${code})`;
  } else if (classification === "INVALID_INPUT" && state.resolved) {
    executeEntry = `EXECUTE: refused (${code})`;
  } else {
    executeEntry = `EXECUTE: skipped (${classification})`;
  }
  return [resolveEntry, executeEntry];
}

function makeExecuteResult(runtime, {
  input,
  classification,
  code,
  error,
  state,
  record = null,
  handler = null,
  output = null,
}) {
  const trace = buildTrace(record, handler, classification, code);
  const executed = state.executed === true;
  const status = statusFor({ executed, error });
  const command = trace && trace.command ? trace.command : input.command;
  return {
    stage: "execute",
    module: "hotkeys",
    command,
    status,
    ok: executed,
    classification,
    code,
    executed,
    error,
    input,
    states: state,
    trace,
    output,
    phase_ledger: buildPhaseLedger({ classification, code, states: state }),
    artifacts: executed && command ? [`hotkey-runtime-result:${command}`] : [],
    evidence: buildEvidence(runtime, { classification, code, record, handler, trace, error, output }),
    remaining_issues: error
      ? [`${error.code}: ${error.message}${error.detail === null || error.detail === undefined ? "" : ` — ${error.detail}`}`]
      : [],
    assumptions: [],
  };
}

function unauthorizedResult(runtime, resolution) {
  const input = isPlainObject(resolution) && isPlainObject(resolution.input)
    ? echoInput(resolution.input)
    : { key: null, command: null };
  const error = makeError(
    "E-VALID",
    "E_VALID_UNAUTHORIZED_RESOLUTION",
    "resolution was not issued by this runtime; execution refused",
    null
  );
  return makeExecuteResult(runtime, {
    input,
    classification: "REFUSED",
    code: "E_VALID_UNAUTHORIZED_RESOLUTION",
    error,
    state: states({ refused: true }),
  });
}

function executeResolvedHotkeyImpl(runtime, resolution) {
  if (!isPlainObject(resolution) || !ISSUED.has(resolution)) {
    return unauthorizedResult(runtime, resolution);
  }
  if (resolution.classification === "EXECUTABLE") {
    const context = CONTEXT.get(resolution);
    if (!context || context.runtime !== runtime) {
      return unauthorizedResult(runtime, resolution);
    }
    return runHandler(runtime, context);
  }
  // A resolution that never reached EXECUTABLE is echoed as a non-executed
  // result: no handler runs, and the original classification is preserved.
  const trace = isPlainObject(resolution.trace) ? resolution.trace : null;
  return makeExecuteResult(runtime, {
    input: echoInput(resolution.input),
    classification: resolution.classification,
    code: resolution.code,
    error: resolution.error,
    state: states({ ...resolution.states, executed: false }),
    record: contextRecord(resolution),
    handler: trace && typeof trace.handler_id === "string" ? { id: trace.handler_id } : null,
    output: null,
  });
}

// The record identity of a non-executable resolution is rebuilt from its
// own trace (only the resolution issuer could have produced it).
function contextRecord(resolution) {
  const trace = isPlainObject(resolution.trace) ? resolution.trace : null;
  if (!trace || trace.key === null) return null;
  return {
    key: trace.key,
    command: trace.command,
    source_raw: trace.source,
    activation_status: trace.registry_status,
    validation_status: trace.validation_status,
    mode: trace.core_mode,
    violations: [],
  };
}

function runHandler(runtime, context) {
  const { record, handler, args, root } = context;
  let output;
  try {
    output = handler.run({ args, root, key: record.key, command: normalizeCommand(record.command) });
  } catch (exception) {
    const classified = classifyException(exception);
    return makeExecuteResult(runtime, {
      input: { key: record.key, command: record.command },
      classification: "EXECUTION_ERROR",
      code: classified.code,
      error: classified,
      state: states({
        validated: true,
        allowed: true,
        resolved: true,
        executable: true,
        execution_failed: true,
      }),
      record,
      handler,
      output: null,
    });
  }
  return makeExecuteResult(runtime, {
    input: { key: record.key, command: record.command },
    classification: "EXECUTABLE",
    code: "OK_EXECUTED",
    error: null,
    state: states({
      validated: true,
      allowed: true,
      resolved: true,
      executable: true,
      executed: true,
    }),
    record,
    handler,
    output,
  });
}

// ---------------------------------------------------------------------------
// Runtime construction (fail-closed configuration: 01 §13.5)
// ---------------------------------------------------------------------------

function configError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  const klass = RESULT_CODES[code] || "E-VALID";
  error.grimoire = makeError(klass, code, message, detail === undefined ? null : detail);
  return error;
}

/**
 * Build a runtime over one validated registry snapshot.
 * A malformed configuration throws E_INPUT_INVALID_RUNTIME_CONFIG /
 * E_VALID_HANDLER_SPEC — no runtime exists, therefore nothing can execute.
 * An invalid-but-parseable registry produces a runtime whose validation.ok
 * is false: every invocation is refused with E_VALID_REGISTRY_INVALID.
 */
export function createRuntime({ registryText, root, availableTools, handlers, toolBus } = {}) {
  if (typeof registryText !== "string") {
    throw configError("E_INPUT_INVALID_RUNTIME_CONFIG", "registryText must be a string", typeof registryText);
  }
  if (typeof root !== "string" || root.trim() === "") {
    throw configError("E_INPUT_INVALID_RUNTIME_CONFIG", "root must be a non-empty string", typeof root);
  }
  const tools = availableTools === undefined ? DEFAULT_AVAILABLE_TOOLS : availableTools;
  if (!Array.isArray(tools) || tools.some((t) => typeof t !== "string" || t.trim() === "")) {
    throw configError("E_INPUT_INVALID_RUNTIME_CONFIG", "availableTools must be an array of non-empty strings");
  }
  const handlerMap = handlers === undefined ? DEFAULT_HANDLERS : handlers;
  if (!isPlainObject(handlerMap)) {
    throw configError("E_VALID_HANDLER_SPEC", "handlers must be a plain object keyed by command id");
  }
  if (toolBus !== undefined && toolBus !== null
      && (typeof toolBus !== "object" || typeof toolBus.check !== "function")) {
    throw configError("E_INPUT_INVALID_RUNTIME_CONFIG", "toolBus must expose check(capabilityId)");
  }

  // Handler binding: the map key IS the dispatch key, so a handler whose
  // `command` does not match its key (a replaced/mis-bound handler) can
  // never enter a runtime. Fail closed at construction (13.5).
  const handlersByCommand = Object.create(null);
  for (const [key, handler] of Object.entries(handlerMap)) {
    if (!isPlainObject(handler)) {
      throw configError("E_VALID_HANDLER_SPEC", "handler entry must be an object", key);
    }
    if (handler.command !== key) {
      throw configError(
        "E_VALID_HANDLER_SPEC",
        "handler map key must equal handler.command (mis-bound handler)",
        `${key} binds ${String(handler.command)}`
      );
    }
    if (typeof handler.id !== "string" || typeof handler.run !== "function"
        || typeof handler.validateArgs !== "function" || !Array.isArray(handler.requiredTools)) {
      throw configError("E_VALID_HANDLER_SPEC", "handler entry is malformed (build it with defineHandler)", key);
    }
    handlersByCommand[key] = handler;
  }

  // Lookup maps over the validated record set. A repeated key or command is
  // stored as `null` (ambiguous): lookup then refuses with
  // E_CONFLICT_AMBIGUOUS_IDENTITY instead of silently resolving the conflict
  // (directive §3: never silently resolve conflicting keys).
  const validation = validateRegistryText(registryText, { root });
  const byKey = new Map();
  const byCommand = new Map();
  const index = (map, id, record) => {
    if (typeof id !== "string" || id === "") return;
    if (!map.has(id)) map.set(id, record);
    else map.set(id, null);
  };
  for (const record of validation.records) {
    index(byKey, record.key, record);
    index(byCommand, normalizeCommand(record.command), record);
  }

  const runtime = Object.freeze({
    root,
    validation,
    availableTools: Object.freeze([...tools]),
    toolBus: toolBus ?? null,
    handlers: Object.freeze(handlersByCommand),
    byKey,
    byCommand,
    resolveHotkey(input) {
      return resolveHotkeyImpl(runtime, input);
    },
    executeResolvedHotkey(resolution) {
      return executeResolvedHotkeyImpl(runtime, resolution);
    },
    executeHotkey(input) {
      return executeResolvedHotkeyImpl(runtime, resolveHotkeyImpl(runtime, input));
    },
  });
  return runtime;
}

// ---------------------------------------------------------------------------
// Runtime report (§13: deterministic; states are never collapsed)
// ---------------------------------------------------------------------------

const REPORT_CLASSIFICATION_ORDER = Object.freeze([...EXECUTION_CLASSES]);

/**
 * Deterministic report over a caller-supplied (stable-ordered) result list.
 * Same results in -> byte-identical text and sha256 out. Contains no
 * timestamps, no random ids, no unordered iteration.
 */
export function buildRuntimeReport(results) {
  const list = Array.isArray(results) ? results : [];
  const lines = [
    "# Grimoire v3 — Hotkeys L2 Runtime Report",
    "",
    "## 1. Summary",
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Invocations | ${list.length} |`,
    `| Executed | ${list.filter((r) => r && r.executed === true).length} |`,
  ];
  for (const classification of REPORT_CLASSIFICATION_ORDER) {
    lines.push(`| ${classification} | ${list.filter((r) => r && r.classification === classification).length} |`);
  }
  lines.push("", "## 2. Results", "", "| # | Input | Command | Classification | Code | Status | Executed | Handler |", "|---|---|---|---|---|---|---|---|");
  list.forEach((result, i) => {
    const input = result && isPlainObject(result.input) ? result.input : { key: null, command: null };
    const inputCell = input.key !== null
      ? `key=${input.key}`
      : input.command !== null
        ? `command=${input.command}`
        : "—";
    const trace = result && isPlainObject(result.trace) ? result.trace : null;
    const commandCell = trace && trace.command ? trace.command : (result && result.command ? result.command : "—");
    const handlerCell = trace && trace.handler_id ? trace.handler_id : "—";
    lines.push(
      `| ${i + 1} | ${inputCell} | ${commandCell} | ${result && result.classification ? result.classification : "—"} | ${result && result.code ? result.code : "—"} | ${result && result.status ? result.status : "—"} | ${result && result.executed ? "yes" : "no"} | ${handlerCell} |`
    );
  });
  lines.push("");
  const text = lines.join("\n");
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  return { text, sha256 };
}
