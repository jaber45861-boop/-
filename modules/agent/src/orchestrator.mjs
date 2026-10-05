// Grimoire v3 — Agent Orchestrator (L2 implementation, Task 10).
//
// Position (02 §3, Task 10 directive §2): the first Agent-grade layer — a
// consumer of the existing public contracts, never a second source of truth:
//
//   request → VALIDATE → Module Registry → PREFLIGHT (Tool Bus)
//           → EXECUTE (Hotkey Runtime only) → REPORT (Report Bus) → COMPLETE
//
// The orchestrator is constructed FROM the four existing services (injected
// by the composition root; it imports nothing lateral — see index.mjs) and
// calls only their public surfaces:
//   Module Registry : has / isEnabled / describe / resolveCapability / canInvoke
//   Tool Bus        : check            (authoritative for tool state)
//   Hotkey Runtime  : executeHotkey    (the only handler path — never direct)
//   Report Bus      : build            (the only report format)
//
// Fail-closed contract (directive §5/§11): every stage either advances or
// terminates with a named code; there is no retry, no fallback, no "try
// something else", no hidden recovery. EXECUTE is reached only after the
// registry gate (registered → enabled → provides → unique provider →
// canInvoke) and the Tool Bus preflight all pass; handlers and providers
// are never invoked directly; a report is attached to EVERY terminal
// attempt (success or failure), and a failed report upgrades any success to
// REPORT_FAILED — "no valid report → no successful completion".
//
// Determinism: fixed stage order, fixed evidence order, fixed summary/row
// shapes, no timestamps/random/pids/machine paths/environment values.
// Identical request + identical injected state ⇒ identical result object
// and byte-identical report with the same sha256.

import { makeError, AGENT_ERROR_CLASSES } from "./errors.mjs";
import {
  EIGHT_LOOP_PHASES,
  EXECUTION_CAPABILITY,
  OPERATION_KINDS,
  validateRequest,
  normalizeRequest,
} from "./request.mjs";

/** The finite lifecycle (directive §4/§10). No other states exist. */
export const LIFECYCLE_STAGES = Object.freeze([
  "RECEIVE", "VALIDATE", "RESOLVE", "PREFLIGHT", "EXECUTE", "REPORT", "COMPLETE",
]);

/**
 * Every orchestrator result code and its Core error class (01 §11.1).
 * `null` = success (COMPLETED). `"classified"` = the class is taken from
 * the underlying runtime/report-bus refusal (always a Core class; the
 * fallbacks below apply only if an injected contract omits one).
 */
export const RESULT_CODES = Object.freeze({
  COMPLETED: null,
  INVALID_REQUEST: "E-INPUT",
  MODULE_NOT_FOUND: "E-INPUT",
  MODULE_DISABLED: "E-ENV",
  CAPABILITY_UNAVAILABLE: "E-ENV",
  CAPABILITY_AMBIGUOUS: "E-CONFLICT",
  PHASE_NOT_DECLARED: "E-CONFLICT",
  MANIFEST_INVALID: "E-VALID",
  TOOL_REQUIRED: "E-TOOL",
  EXECUTION_REFUSED: "classified",
  EXECUTION_FAILED: "classified",
  REPORT_FAILED: "classified",
});

const RESULT_MESSAGE = Object.freeze({
  INVALID_REQUEST: "request failed the contract",
  MODULE_NOT_FOUND: "module is not registered",
  MODULE_DISABLED: "module is not enabled",
  CAPABILITY_UNAVAILABLE: "capability is unavailable to this operation",
  CAPABILITY_AMBIGUOUS: "more than one enabled module provides the capability",
  PHASE_NOT_DECLARED: "phase is not declared by the module",
  MANIFEST_INVALID: "module manifest failed validation",
  TOOL_REQUIRED: "a declared tool is unavailable",
  EXECUTION_REFUSED: "the runtime refused execution",
  EXECUTION_FAILED: "execution failed",
  REPORT_FAILED: "the report step refused to emit",
});

// Terminal status per code (directive §10 failure map).
const STATUS_BY_CODE = Object.freeze({
  COMPLETED: "COMPLETED",
  REPORT_FAILED: "REPORT_FAILED",
  EXECUTION_FAILED: "FAILED",
});
const statusFor = (code) => STATUS_BY_CODE[code] ?? "REFUSED";

// Fallback classes for the "classified" codes when an injected contract
// omits an error object (never reached with the repository's real
// runtime/report bus, which always attach one).
const CLASSIFIED_FALLBACK = Object.freeze({
  EXECUTION_REFUSED: "E-ENV",
  EXECUTION_FAILED: "E-VALID",
  REPORT_FAILED: "E-VALID",
});

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configError(message, detail) {
  const error = new Error(message);
  error.code = "E_INPUT_INVALID_ORCHESTRATOR_CONFIG";
  error.grimoire = makeError("E-INPUT", "E_INPUT_INVALID_ORCHESTRATOR_CONFIG", message, detail === undefined ? null : detail);
  return error;
}

/** Single-line rendering guard: evidence/details never carry newlines into
 *  the report contract (they are OUR lines, not upstream data repair). */
const oneLine = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

function classOf(code, underlying) {
  if (RESULT_CODES[code] !== "classified") return RESULT_CODES[code];
  const klass = underlying && AGENT_ERROR_CLASSES.includes(underlying.class) ? underlying.class : null;
  return klass ?? CLASSIFIED_FALLBACK[code];
}

// ---------------------------------------------------------------------------
// Report input (03 §5 rows + the Report Bus completion sections). Built for
// EVERY terminal attempt; consumed by the injected Report Bus only.
// ---------------------------------------------------------------------------

const display = (value) => (typeof value === "string" && value !== "" ? value : "-");

function buildReportInput(state) {
  const { echo, code, status, stage, ledger, evidence, issues, execution } = state;
  const module = echo && typeof echo.module === "string" && echo.module !== "" ? echo.module : "agent";
  const rowStatus = status === "COMPLETED" ? "success" : (state.errorClass === "E-ENV" || state.errorClass === "E-TOOL") ? "blocked" : "failed";
  return {
    type: "completion",
    sections: [
      {
        id: "summary",
        rows: [
          { name: "Kind", value: display(echo?.kind) },
          { name: "Module", value: display(echo?.module) },
          { name: "Target", value: display(echo?.targetLabel) },
          { name: "Capability", value: display(echo?.capability) },
          { name: "Phase", value: display(echo?.phase) },
          { name: "Code", value: code },
          { name: "Status", value: status },
          { name: "Stage", value: stage },
        ],
      },
      {
        id: "results",
        rows: [{
          module,
          command: "agent.orchestrate",
          status: rowStatus,
          phase_ledger: [...ledger],
          artifacts: execution && Array.isArray(execution.artifacts) ? [...execution.artifacts] : [],
          evidence: [...evidence],
          remaining_issues: [...issues],
          assumptions: [],
        }],
      },
      { id: "phase-ledger", rows: [...ledger] },
      { id: "evidence", rows: [...evidence] },
      { id: "remaining-issues", rows: [...issues] },
    ],
  };
}

// ---------------------------------------------------------------------------
// The orchestrator
// ---------------------------------------------------------------------------

const REGISTRY_METHODS = ["has", "isEnabled", "describe", "resolveCapability", "canInvoke"];

/**
 * Create the Agent Orchestrator from the four existing public contracts.
 * All four are required: malformed configuration throws at construction —
 * no orchestrator exists, therefore nothing can be orchestrated (01 §13.5).
 * The composition root owns wiring (including binding the runtime to the
 * hotkeys module); this layer discovers nothing on its own.
 */
export function createAgentOrchestrator({ registry, runtime, toolBus, reportBus } = {}) {
  for (const [name, value, method] of [
    ["registry", registry, "has"],
    ["registry", registry, "isEnabled"],
    ["registry", registry, "describe"],
    ["registry", registry, "resolveCapability"],
    ["registry", registry, "canInvoke"],
    ["runtime", runtime, "executeHotkey"],
    ["toolBus", toolBus, "check"],
    ["reportBus", reportBus, "build"],
  ]) {
    if (!isPlainObject(value) || typeof value[method] !== "function") {
      throw configError(`${name} must expose ${method}()`, `${name}.${method}`);
    }
  }

  const orchestrator = Object.freeze({
    /**
     * Run one orchestration attempt through the finite lifecycle.
     * Always returns a frozen result; a report is attempted for every
     * terminal attempt and attached unless the report step itself refuses.
     */
    run(request) {
      const ledger = [];
      const evidence = [];
      const echo = normalizeRequest(request);
      const targetLabel = echo && echo.target
        ? (echo.target.key !== null && echo.target.key !== undefined ? `key:${echo.target.key}` : echo.target.command !== null && echo.target.command !== undefined ? `command:${echo.target.command}` : null)
        : null;
      const echoForReport = echo ? { ...echo, targetLabel } : null;

      let plan = null;
      let preflight = null;
      let execution = null;

      const finish = (stage, code, detail, underlying) => {
        const error = code === "COMPLETED"
          ? null
          : makeError(
              classOf(code, underlying),
              code,
              RESULT_MESSAGE[code],
              oneLine(detail === undefined ? null : detail) || null
            );
        const result = {
          ok: code === "COMPLETED",
          code,
          status: statusFor(code),
          stage,
          error,
          request: echo,
          plan,
          preflight,
          execution,
          report: null,
        };
        // REPORT stage: every terminal attempt carries a report (§9). This
        // line only ever becomes visible if the build succeeds — a refused
        // build emits nothing at all, so the claim cannot outlive the truth.
        ledger.push("REPORT: done (report-bus)");
        if (stage === "COMPLETE") ledger.push("COMPLETE: done");
        const reportInput = buildReportInput({
          echo: echoForReport,
          code,
          status: statusFor(code),
          stage,
          errorClass: error ? error.class : null,
          ledger,
          evidence,
          issues: code === "COMPLETED" ? [] : [`${code}: ${oneLine(detail ?? RESULT_MESSAGE[code])}`],
          execution,
        });
        const report = reportBus.build(reportInput);
        if (report.ok) {
          result.report = Object.freeze(report.report);
        } else {
          // No valid report → no successful completion (directive §9/§11.10).
          const busError = isPlainObject(report.error) ? report.error : null;
          result.code = "REPORT_FAILED";
          result.status = "REPORT_FAILED";
          result.stage = "REPORT";
          result.ok = false;
          result.error = makeError(
            classOf("REPORT_FAILED", busError),
            "REPORT_FAILED",
            RESULT_MESSAGE.REPORT_FAILED,
            `attempt ${code}: ${busError ? `${oneLine(busError.code)}: ${oneLine(busError.detail ?? busError.message)}` : "report step failed"}`
          );
          result.report = null;
        }
        return Object.freeze(result);
      };

      // --- RECEIVE --------------------------------------------------------
      ledger.push("RECEIVE: done (request)");

      // --- VALIDATE -------------------------------------------------------
      const violations = validateRequest(request);
      if (violations.length > 0) {
        evidence.push(`validate(request) → INVALID_REQUEST: ${violations[0].detail}`);
        ledger.push("VALIDATE: refused (INVALID_REQUEST)");
        return finish("VALIDATE", "INVALID_REQUEST", violations[0].detail);
      }
      ledger.push("VALIDATE: done (contract)");
      const req = {
        kind: request.kind,
        module: request.module,
        capability: request.capability,
        phase: request.phase,
        target: request.target,
        args: request.args,
      };

      // --- RESOLVE (public registry contract only, directive §6) ----------
      const stageResolve = (code, detail, underlying) => {
        evidence.push(`resolve(${req.module}, ${req.capability}) → ${code}`);
        ledger.push(`RESOLVE: refused (${code})`);
        return finish("RESOLVE", code, detail, underlying);
      };

      if (registry.has(req.module) !== true) {
        evidence.push(`registry.has(${req.module}) → false`);
        return stageResolve("MODULE_NOT_FOUND", req.module);
      }
      evidence.push(`registry.has(${req.module}) → true`);
      if (registry.isEnabled(req.module) !== true) {
        evidence.push(`registry.isEnabled(${req.module}) → false`);
        return stageResolve("MODULE_DISABLED", req.module);
      }
      evidence.push(`registry.isEnabled(${req.module}) → true`);

      const described = registry.describe(req.module);
      if (!isPlainObject(described) || described.ok !== true || !isPlainObject(described.descriptor)) {
        return stageResolve("MODULE_NOT_FOUND", req.module);
      }
      const descriptor = described.descriptor;
      const provides = Array.isArray(descriptor.provides) ? descriptor.provides : [];
      if (!provides.includes(req.capability)) {
        evidence.push(`describe(${req.module}).provides.includes(${req.capability}) → false`);
        return stageResolve("CAPABILITY_UNAVAILABLE", `${req.module} does not provide ${req.capability}`);
      }
      evidence.push(`describe(${req.module}).provides.includes(${req.capability}) → true`);

      // kind ↔ capability pairing (belt: validateRequest already enforces it).
      const expected = OPERATION_KINDS[req.kind].capability;
      if (req.capability !== expected) {
        return stageResolve("CAPABILITY_UNAVAILABLE", `operation ${req.kind} executes ${expected} only`);
      }

      const resolved = registry.resolveCapability(req.capability);
      if (!isPlainObject(resolved) || resolved.ok !== true) {
        const code = resolved && resolved.code === "CAPABILITY_AMBIGUOUS" ? "CAPABILITY_AMBIGUOUS" : "CAPABILITY_UNAVAILABLE";
        return stageResolve(code, resolved?.error?.detail ?? req.capability, resolved?.error);
      }
      if (resolved.module !== req.module) {
        // Defensive: never substitute a different provider (directive §6).
        return stageResolve("CAPABILITY_UNAVAILABLE", `${req.capability} resolves to ${resolved.module}, not ${req.module}`);
      }
      evidence.push(`registry.resolveCapability(${req.capability}) → ${resolved.module}`);

      // canInvoke: lifecycle + phase gate (tools are the Tool Bus's job at
      // PREFLIGHT — tools: [] keeps the stages cleanly separated).
      const invoked = registry.canInvoke(req.module, { phase: req.phase, tools: [] });
      if (!isPlainObject(invoked) || invoked.ok !== true) {
        const code = invoked?.code;
        const map = {
          MANIFEST_INVALID: "MANIFEST_INVALID",
          MODULE_NOT_FOUND: "MODULE_NOT_FOUND",
          INVALID_INVOCATION: "INVALID_REQUEST",
          MODULE_NOT_ENABLED: "MODULE_DISABLED",
          PHASE_NOT_DECLARED: "PHASE_NOT_DECLARED",
          TOOL_UNDECLARED: "TOOL_REQUIRED",
          TOOL_UNAVAILABLE: "TOOL_REQUIRED",
        };
        const translated = map[code] ?? "MANIFEST_INVALID";
        evidence.push(`registry.canInvoke(${req.module}, ${req.phase}) → ${code}`);
        return stageResolve(translated, invoked?.error?.detail ?? code, invoked?.error);
      }
      evidence.push(`registry.canInvoke(${req.module}, ${req.phase}) → MR_OK`);

      plan = Object.freeze({
        module: req.module,
        capability: req.capability,
        phase: req.phase,
        tools: Object.freeze([...(Array.isArray(descriptor.requires?.tools) ? descriptor.requires.tools : [])]),
      });
      ledger.push(`RESOLVE: done (${plan.module} → ${plan.capability})`);

      // --- PREFLIGHT (Tool Bus authoritative, directive §7) ---------------
      const checks = [];
      for (const tool of plan.tools) {
        const checked = toolBus.check(tool);
        checks.push(Object.freeze({ tool, ok: checked.ok === true, code: checked.code }));
        evidence.push(`toolBus.check(${tool}) → ${checked.code}`);
        if (checked.ok !== true) {
          preflight = Object.freeze({ ok: false, tools: Object.freeze(checks) });
          ledger.push("PREFLIGHT: refused (TOOL_REQUIRED)");
          return finish("PREFLIGHT", "TOOL_REQUIRED", `${tool}: ${checked.code}`);
        }
      }
      preflight = Object.freeze({ ok: true, tools: Object.freeze(checks) });
      ledger.push(`PREFLIGHT: done (${checks.length} tool${checks.length === 1 ? "" : "s"})`);

      // --- EXECUTE (Hotkey Runtime only — never a handler directly) -------
      const execInput = { ...req.target };
      if (req.args !== undefined && req.args !== null) execInput.args = req.args;
      execution = runtime.executeHotkey(execInput);
      const classification = isPlainObject(execution) ? execution.classification : undefined;
      const execError = isPlainObject(execution) && isPlainObject(execution.error) ? execution.error : null;

      if (!isPlainObject(execution) || execution.executed !== true || execution.ok !== true) {
        if (classification === "TOOL_REQUIRED") {
          evidence.push(`runtime.executeHotkey(...) → ${execution?.code} (TOOL_REQUIRED)`);
          ledger.push("EXECUTE: refused (TOOL_REQUIRED)");
          return finish("EXECUTE", "TOOL_REQUIRED", execution?.code);
        }
        if (classification === "EXECUTION_ERROR") {
          evidence.push(`runtime.executeHotkey(...) → ${execution?.code} (EXECUTION_ERROR)`);
          ledger.push("EXECUTE: failed (EXECUTION_FAILED)");
          return finish("EXECUTE", "EXECUTION_FAILED", `${execution?.code}: ${execError?.message ?? "handler failed"}`, execError);
        }
        evidence.push(`runtime.executeHotkey(...) → ${execution?.code ?? "REFUSED"} (${classification ?? "REFUSED"})`);
        ledger.push(`EXECUTE: refused (${execution?.code ?? "EXECUTION_REFUSED"})`);
        return finish("EXECUTE", "EXECUTION_REFUSED", `${execution?.code ?? "refused"}: ${execError?.message ?? classification ?? "refused"}`, execError);
      }
      evidence.push(`runtime.executeHotkey(...) → ${execution.code} (executed=true)`);
      ledger.push(`EXECUTE: done (${execution.code})`);

      // --- REPORT + COMPLETE (report gate: no report → no completion) ----
      return finish("COMPLETE", "COMPLETED", null);
    },
  });

  return orchestrator;
}
