// Grimoire v3 — Plan–Execution composition (the composition root between the
// Planner (Task 11) and the Agent Orchestrator (Task 10)).
//
// Position (02 §3 rules 1/3, 19 §2 "the composition root injects…"): this
// layer IS the composition root for the two L2 entries. Both contracts name
// that boundary — module-to-module wiring happens HERE, never inside a
// module — so the planner and the agent stay independently testable,
// register nothing new, and are never reached into:
//   Planner            : plan   (the only plan-production surface)
//   Agent Orchestrator : run    (the only execution surface)
//   Report Bus         : build  (the only report format)
//   Approval           : verify (optional; the only verdict surface)
//
// One bundle flows through a finite lifecycle, single pass, no loops:
//
//   bundle → VALIDATE (envelope only) → PLAN (planner.plan)
//          → GATE (01 §5.2 review gate; when review.required the optional
//             injected approval component is consulted exactly once, 23 §5)
//          → ORCHESTRATE (agent.run) → REPORT → COMPLETE
//
// Fail-closed contract (01 §13.5): every stage either advances or terminates
// with a named code; there is no retry, no fallback, no hidden recovery.
// No valid bundle → no plan; no plan → no execution; an unverifiable
// mandatory approval gate → no execution; no valid report → no successful
// completion. Downstream refusals and failures propagate with their own
// code, class, and structured error — never reinterpreted, never upgraded
// to success (UNAVAILABLE / BLOCKED / DISABLED / MISSING DEPENDENCY /
// INVALID CONTRACT never become success).
//
// Determinism: fixed stage order, fixed evidence/ledger order, fixed
// summary/row shapes, no timestamps/random/pids/machine paths/environment
// values. Identical bundle + identical injected state ⇒ identical result
// object and byte-identical report with the same sha256.

import { makeError, COMPOSITION_ERROR_CLASSES, CORE_ERROR_CLASSES } from "./errors.mjs";
import { validateBundle, normalizeBundle } from "./bundle.mjs";
import { planIdentity, executionIdentity, wellFormedVerdict } from "./approval.mjs";

/** The finite lifecycle (post-Task 11 composition contract). No other states exist. */
export const LIFECYCLE_STAGES = Object.freeze([
  "RECEIVE", "VALIDATE", "PLAN", "GATE", "ORCHESTRATE", "REPORT", "COMPLETE",
]);

/**
 * Every result code and its Core error class (01 §11.1), in stage order:
 * this layer's own codes first (VALIDATE), then the Planner's vocabulary
 * (PLAN), then the approval gate (GATE), then the Agent's vocabulary
 * (ORCHESTRATE). `null` = success. `"classified"` = the class is taken from
 * the underlying downstream refusal (always a Core class; the fallbacks
 * below apply only if an injected contract omits one).
 */
export const RESULT_CODES = Object.freeze({
  COMPLETED: null,
  INVALID_REQUEST: "E-INPUT",
  PLAN_INCOMPLETE: "E-VALID",
  REPORT_FAILED: "classified",
  APPROVAL_REQUIRED: "E-INPUT",
  MODULE_NOT_FOUND: "E-INPUT",
  MODULE_DISABLED: "E-ENV",
  CAPABILITY_UNAVAILABLE: "E-ENV",
  CAPABILITY_AMBIGUOUS: "E-CONFLICT",
  PHASE_NOT_DECLARED: "E-CONFLICT",
  MANIFEST_INVALID: "E-VALID",
  TOOL_REQUIRED: "E-TOOL",
  EXECUTION_REFUSED: "classified",
  EXECUTION_FAILED: "classified",
});

const RESULT_MESSAGE = Object.freeze({
  INVALID_REQUEST: "bundle failed the contract",
  PLAN_INCOMPLETE: "the planner attempt did not yield a usable plan",
  APPROVAL_REQUIRED: "the plan requires an approval this layer cannot grant",
  REPORT_FAILED: "the report step refused to emit",
  MODULE_NOT_FOUND: "module is not registered",
  MODULE_DISABLED: "module is not enabled",
  CAPABILITY_UNAVAILABLE: "capability is unavailable to this operation",
  CAPABILITY_AMBIGUOUS: "more than one enabled module provides the capability",
  PHASE_NOT_DECLARED: "phase is not declared by the module",
  MANIFEST_INVALID: "module manifest failed validation",
  TOOL_REQUIRED: "a declared tool is unavailable",
  EXECUTION_REFUSED: "the runtime refused execution",
  EXECUTION_FAILED: "execution failed",
});

// Terminal status per code (same vocabulary as the two downstream layers).
const STATUS_BY_CODE = Object.freeze({
  COMPLETED: "COMPLETED",
  REPORT_FAILED: "REPORT_FAILED",
  EXECUTION_FAILED: "FAILED",
});
const statusFor = (code) => STATUS_BY_CODE[code] ?? "REFUSED";

// Fallback classes for the "classified" codes when an injected contract
// omits a usable error object (never reached with the repository's real
// planner/agent/runtime/report bus, which always attach one).
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
  error.code = "E_INPUT_INVALID_COMPOSITION_CONFIG";
  error.grimoire = makeError("E-INPUT", "E_INPUT_INVALID_COMPOSITION_CONFIG", message, detail === undefined ? null : detail);
  return error;
}

/** Single-line rendering guard for report-bound details/evidence. */
const oneLine = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

function classOf(code, underlying) {
  if (RESULT_CODES[code] !== "classified") return RESULT_CODES[code];
  const klass = underlying && CORE_ERROR_CLASSES.includes(underlying.class) ? underlying.class : null;
  return klass ?? CLASSIFIED_FALLBACK[code];
}

const display = (value) => (typeof value === "string" && value !== "" ? value : "-");

/** A structured error may be carried through only if it is one of ours, verbatim. */
function isCarriedError(value, code) {
  return isPlainObject(value)
    && CORE_ERROR_CLASSES.includes(value.class)
    && value.code === code
    && typeof value.message === "string";
}

/**
 * A downstream attempt conforms only if it is shaped like the contract it
 * claims to follow: a boolean `ok` that agrees with its own `code`, and a
 * code this layer's vocabulary knows. Anything else fails closed — an
 * INVALID CONTRACT never reads as success.
 */
function conforms(attempt) {
  return isPlainObject(attempt)
    && typeof attempt.ok === "boolean"
    && typeof attempt.code === "string"
    && attempt.code !== ""
    && attempt.ok === (attempt.code === "COMPLETED")
    && Object.prototype.hasOwnProperty.call(RESULT_CODES, attempt.code);
}

// ---------------------------------------------------------------------------
// Report input (03 §5 rows + the Report Bus completion sections). Built for
// EVERY terminal attempt; consumed by the injected Report Bus only.
// ---------------------------------------------------------------------------

function buildReportInput(state) {
  const { echo, code, status, stage, ledger, evidence, issues, planning, orchestration, plan } = state;
  const request = planning && isPlainObject(planning.request) ? planning.request : null;
  const execEcho = orchestration && isPlainObject(orchestration.request) ? orchestration.request : null;
  const executionLabel = execEcho
    ? `${oneLine(execEcho.kind)} ${oneLine(execEcho.capability)}`
    : "";
  const rowStatus = status === "COMPLETED" ? "success" : (state.errorClass === "E-ENV" || state.errorClass === "E-TOOL") ? "blocked" : "failed";
  return {
    type: "completion",
    sections: [
      {
        id: "summary",
        rows: [
          { name: "Module", value: "plan-execution" },
          { name: "Task", value: display(request ? oneLine(request.task) : "") },
          { name: "Tier", value: display(request ? oneLine(request.tier) : "") },
          { name: "Depth", value: display(plan && typeof plan.depth === "string" ? plan.depth : "") },
          { name: "Execution", value: display(executionLabel) },
          { name: "Code", value: code },
          { name: "Status", value: status },
          { name: "Stage", value: stage },
        ],
      },
      {
        id: "results",
        rows: [{
          module: "plan-execution",
          command: "plan-execution.execute",
          status: rowStatus,
          phase_ledger: [...ledger],
          artifacts: [],
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
// The composer
// ---------------------------------------------------------------------------

/**
 * Create the Plan–Execution composer from the existing public contracts.
 * The three downstream dependencies are required: malformed configuration
 * throws at construction — no composer exists, therefore nothing is
 * composed (01 §13.5). The optional `approval` dependency (CS-13,
 * contract 23 §2) is the composition root's approval component: when its
 * own property is present and not undefined it must be a plain object
 * exposing a function `verify`, or construction throws the same
 * configuration error as every other bad dependency. The composition root
 * owns wiring; this layer constructs neither downstream module and
 * discovers nothing on its own.
 */
export function createPlanExecutionComposer(options = {}) {
  const { planner, agent, reportBus, approval } = options;
  for (const [name, value, method] of [
    ["planner", planner, "plan"],
    ["agent", agent, "run"],
    ["reportBus", reportBus, "build"],
  ]) {
    if (!isPlainObject(value) || typeof value[method] !== "function") {
      throw configError(`${name} must expose ${method}()`, `${name}.${method}`);
    }
  }
  // Construction belt (23 §2): provided = own property present and not
  // undefined; absent and `undefined` both mean *not injected*.
  const approvalInjected =
    Object.prototype.hasOwnProperty.call(Object(options), "approval") && approval !== undefined;
  if (approvalInjected && (!isPlainObject(approval) || typeof approval.verify !== "function")) {
    throw configError("approval must expose verify()", "approval must expose verify()");
  }

  const composer = Object.freeze({
    /**
     * Run one bundle through the finite lifecycle.
     * Always returns a frozen result; a report is attempted for every
     * terminal attempt and attached unless the report step itself refuses.
     */
    execute(bundle) {
      const ledger = [];
      const evidence = [];
      const echo = normalizeBundle(bundle);

      let plan = null;
      let planning = null;
      let orchestration = null;

      const finish = (stage, code, detail, underlying, carried) => {
        const error = code === "COMPLETED"
          ? null
          : isCarriedError(carried, code)
            ? carried
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
          planning,
          orchestration,
          report: null,
        };
        // REPORT stage: every terminal attempt carries a report. This line
        // only ever becomes visible if the build succeeds — a refused build
        // emits nothing at all, so the claim cannot outlive the truth.
        ledger.push("REPORT: done (report-bus)");
        if (stage === "COMPLETE") ledger.push("COMPLETE: done");
        const reportInput = buildReportInput({
          echo,
          code,
          status: statusFor(code),
          stage,
          errorClass: error ? error.class : null,
          ledger,
          evidence,
          issues: code === "COMPLETED" ? [] : [`${code}: ${oneLine(error.detail ?? RESULT_MESSAGE[code])}`],
          planning,
          orchestration,
          plan,
        });
        const report = reportBus.build(reportInput);
        if (report.ok) {
          result.report = Object.freeze(report.report);
        } else {
          // No valid report → no successful completion (01 §13.5).
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
      ledger.push("RECEIVE: done (bundle)");

      // --- VALIDATE (bundle envelope only — sub-contracts own their content)
      const violations = validateBundle(bundle);
      if (violations.length > 0) {
        evidence.push(`validate(bundle) → INVALID_REQUEST: ${violations[0].detail}`);
        ledger.push("VALIDATE: refused (INVALID_REQUEST)");
        return finish("VALIDATE", "INVALID_REQUEST", violations[0].detail);
      }
      evidence.push("validate(bundle) → ok (contract)");
      ledger.push("VALIDATE: done (contract)");

      // --- PLAN (the planner's attempt, consumed verbatim) -----------------
      const planned = planner.plan(bundle.plan);
      if (!conforms(planned)) {
        evidence.push("planner.plan(...) → INVALID_CONTRACT");
        ledger.push("PLAN: refused (PLAN_INCOMPLETE)");
        return finish("PLAN", "PLAN_INCOMPLETE", "planner attempt did not follow the contract");
      }
      planning = Object.freeze(planned);
      plan = isPlainObject(planning.plan) ? planning.plan : null;
      evidence.push(`planner.plan(...) → ${planning.code}`);
      if (planning.ok !== true) {
        // Propagate the planner's own refusal — same code, same class, same
        // structured error; a refusal never becomes a plan.
        ledger.push(`PLAN: refused (${planning.code})`);
        return finish(
          "PLAN",
          planning.code,
          planning.error ? planning.error.detail : RESULT_MESSAGE[planning.code],
          planning.error,
          planning.error
        );
      }
      // Belts: a "completed" plan attempt must carry the artifact and its
      // §5.2 review-gate state, or this layer cannot trust what it gates on.
      if (plan === null) {
        evidence.push("plan.artifact → missing");
        ledger.push("PLAN: refused (PLAN_INCOMPLETE)");
        return finish("PLAN", "PLAN_INCOMPLETE", "planner completed without a plan artifact");
      }
      if (!isPlainObject(plan.review) || typeof plan.review.required !== "boolean") {
        evidence.push("plan.artifact → review state missing");
        ledger.push("PLAN: refused (PLAN_INCOMPLETE)");
        return finish("PLAN", "PLAN_INCOMPLETE", "plan artifact does not carry its review-gate state");
      }
      if (!isPlainObject(planning.report)) {
        // No valid report → no successful completion (01 §13.5) — a claim
        // of completion without one is a failed report attempt, never a pass.
        evidence.push("planner.report → missing");
        ledger.push("PLAN: refused (REPORT_FAILED)");
        return finish("PLAN", "REPORT_FAILED", "planner attempt claimed completion without a report");
      }
      ledger.push("PLAN: done (planner → COMPLETED)");

      // --- GATE (01 §5.2 — an unverifiable mandatory gate never passes) ----
      if (plan.review.required === true) {
        const trigger = typeof plan.review.trigger === "string" && plan.review.trigger !== ""
          ? ` (${oneLine(plan.review.trigger)})`
          : "";
        evidence.push(`plan.review.required → true${trigger}`);
        // One refusal builder: fixed APPROVAL_REQUIRED/E-INPUT/REFUSED@GATE
        // (23 §6), with the outcome's exact evidence lines appended after
        // the `plan.review.required` line — only ever reached from here.
        const refuseGate = (detail, lines) => {
          for (const line of lines) evidence.push(line);
          ledger.push("GATE: refused (APPROVAL_REQUIRED)");
          return finish("GATE", "APPROVAL_REQUIRED", detail);
        };
        // D0 — no injected component: today's byte-identical refusal, zero
        // consultations, zero approval evidence (23 §2/§6 D0).
        if (!approvalInjected) {
          return refuseGate(
            `plan review is required before execution${trigger} — the approval gate belongs to the policy/approval contract`,
            []
          );
        }
        // Both identities are computed BEFORE the single consultation and
        // must be identical AFTER it returns (23 §4.5): null = not
        // canonicalizable (D4). Exactly one verify() call per gated
        // attempt — no retry, no fallback, no cache (23 §5).
        const planBefore = planIdentity(plan);
        const executionBefore = executionIdentity(bundle.execution);
        let verdict = null;
        let componentThrew = false;
        try {
          verdict = approval.verify(plan, bundle.execution);
        } catch {
          componentThrew = true;
        }
        if (componentThrew) {
          return refuseGate("approval component threw", ["approval.verify(...) → threw"]);
        }
        const verdictRead = wellFormedVerdict(verdict);
        if (verdictRead === null) {
          return refuseGate("approval verdict malformed", ["approval.verify(...) → malformed"]);
        }
        if (verdictRead.granted !== true) {
          return refuseGate("approval verdict not affirmative", ["approval.verify(...) → non-affirmative"]);
        }
        if (planBefore === null || executionBefore === null) {
          return refuseGate("approval binding input not canonicalizable", ["approval.binding → not canonicalizable"]);
        }
        if (planIdentity(plan) !== planBefore || executionIdentity(bundle.execution) !== executionBefore) {
          return refuseGate("approval component mutated its inputs", ["approval.binding → mutated"]);
        }
        if (verdictRead.plan !== planBefore || verdictRead.execution !== executionBefore) {
          return refuseGate("approval verdict binding mismatch", ["approval.verify(...) → binding-mismatch"]);
        }
        evidence.push("approval.verify(...) → affirmative");
        evidence.push("approval.binding → verified");
        ledger.push("GATE: done (approval verified)");
      } else {
        evidence.push("plan.review.required → false");
        ledger.push("GATE: done (review not required)");
      }

      // --- ORCHESTRATE (the agent's attempt, consumed verbatim) -----------
      const orchestrated = agent.run(bundle.execution);
      if (!conforms(orchestrated)) {
        evidence.push("agent.run(...) → INVALID_CONTRACT");
        ledger.push("ORCHESTRATE: refused (EXECUTION_REFUSED)");
        return finish("ORCHESTRATE", "EXECUTION_REFUSED", "orchestration attempt did not follow the contract");
      }
      orchestration = Object.freeze(orchestrated);
      evidence.push(`agent.run(...) → ${orchestration.code}`);
      if (orchestration.ok !== true) {
        // Propagate the agent's own refusal/failure — same code, same class,
        // same structured error; no downstream non-success becomes success.
        const line = statusFor(orchestration.code) === "FAILED" ? "failed" : "refused";
        ledger.push(`ORCHESTRATE: ${line} (${orchestration.code})`);
        return finish(
          "ORCHESTRATE",
          orchestration.code,
          orchestration.error ? orchestration.error.detail : RESULT_MESSAGE[orchestration.code],
          orchestration.error,
          orchestration.error
        );
      }
      // Belts: a "completed" orchestration attempt must carry its report
      // (the repo-wide report gate) and the execution it claims to have run,
      // or this layer must not inherit its success.
      if (!isPlainObject(orchestration.report)) {
        evidence.push("agent.report → missing");
        ledger.push("ORCHESTRATE: refused (REPORT_FAILED)");
        return finish("ORCHESTRATE", "REPORT_FAILED", "orchestration attempt claimed completion without a report");
      }
      if (!isPlainObject(orchestration.execution) || orchestration.execution.executed !== true) {
        evidence.push("agent.execution → missing");
        ledger.push("ORCHESTRATE: refused (EXECUTION_REFUSED)");
        return finish("ORCHESTRATE", "EXECUTION_REFUSED", "orchestration attempt claimed completion without an execution");
      }
      ledger.push("ORCHESTRATE: done (agent → COMPLETED)");

      // --- REPORT + COMPLETE (report gate: no report → no completion) ----
      return finish("COMPLETE", "COMPLETED", null);
    },
  });

  return composer;
}
