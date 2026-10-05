// Grimoire v3 — Planner (L2 implementation, Task 11).
//
// Position (02 §3, 01 §3/§5): the PLAN phase made executable — a consumer
// of the Report Bus only, executing nothing:
//
//   request → VALIDATE (envelope + tier depth rules) → PLAN (pure
//   composition of the four answers at the tier's depth) → REPORT (Report
//   Bus) → COMPLETE
//
// The planner is constructed FROM the Report Bus (injected by the
// composition root; it imports nothing lateral — see index.mjs) and calls
// only its public surface:
//   Report Bus : build   (the only report format)
//
// Fail-closed contract (Task 11 directive, 01 §13.5): every stage either
// advances or terminates with a named code; no retry, no fallback, no
// guessing. The plan is composed only after the request passes BOTH the
// envelope rules and the tier's depth rules; a report is attached to EVERY
// terminal attempt (success or refusal), and a failed report upgrades any
// success to REPORT_FAILED — "no valid report → no successful completion".
// Planning never substitutes for building (01 §5.6): a COMPLETED planner
// result means the PLAN phase produced its artifact, never that the task
// itself shipped.
//
// Determinism: fixed stage order, fixed evidence/ledger order, fixed plan
// key order, fixed summary/row shapes, no timestamps/random/pids/machine
// paths/environment values. Identical request + identical injected state ⇒
// identical result object and byte-identical report with the same sha256.

import { makeError, PLANNER_ERROR_CLASSES } from "./errors.mjs";
import {
  TIERS,
  DEPTH_BY_TIER,
  validatePlanRequest,
  normalizePlanRequest,
} from "./request.mjs";

/** The finite lifecycle (01 §3 PLAN phase; Task 11 directive). No other states exist. */
export const LIFECYCLE_STAGES = Object.freeze([
  "RECEIVE", "VALIDATE", "PLAN", "REPORT", "COMPLETE",
]);

/**
 * Every planner result code and its Core error class (01 §11.1).
 * `null` = success (COMPLETED). `"classified"` = the class is taken from
 * the underlying Report Bus refusal (always a Core class; the fallback
 * below applies only if an injected contract omits one).
 */
export const RESULT_CODES = Object.freeze({
  COMPLETED: null,
  INVALID_REQUEST: "E-INPUT",
  PLAN_INCOMPLETE: "E-VALID",
  REPORT_FAILED: "classified",
});

const RESULT_MESSAGE = Object.freeze({
  INVALID_REQUEST: "plan request failed the contract",
  PLAN_INCOMPLETE: "plan does not answer the questions its tier demands",
  REPORT_FAILED: "the report step refused to emit",
});

// Terminal status per code (Task 11 directive failure map).
const STATUS_BY_CODE = Object.freeze({
  COMPLETED: "COMPLETED",
  REPORT_FAILED: "REPORT_FAILED",
});
const statusFor = (code) => STATUS_BY_CODE[code] ?? "REFUSED";

const CLASSIFIED_FALLBACK = Object.freeze({ REPORT_FAILED: "E-VALID" });

/** 01 §3.2 — the phase-ledger line per tier (T0 uses the skip format). */
export const PLAN_LEDGER_BY_TIER = Object.freeze({
  T0: "PLAN: skipped (T0 — one-line intent)",
  T1: "PLAN: done (T1 — bullets)",
  T2: "PLAN: done (T2 — document)",
});

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configError(message, detail) {
  const error = new Error(message);
  error.code = "E_INPUT_INVALID_PLANNER_CONFIG";
  error.grimoire = makeError("E-INPUT", "E_INPUT_INVALID_PLANNER_CONFIG", message, detail === undefined ? null : detail);
  return error;
}

/** Single-line rendering guard for report-bound details/evidence. */
const oneLine = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

function classOf(code, underlying) {
  if (RESULT_CODES[code] !== "classified") return RESULT_CODES[code];
  const klass = underlying && PLANNER_ERROR_CLASSES.includes(underlying.class) ? underlying.class : null;
  return klass ?? CLASSIFIED_FALLBACK[code];
}

const display = (value) => (typeof value === "string" && value !== "" ? value : "-");

// ---------------------------------------------------------------------------
// Report input (03 §5 rows + the Report Bus completion sections). Built for
// EVERY terminal attempt; consumed by the injected Report Bus only.
// ---------------------------------------------------------------------------

function buildReportInput(state) {
  const { echo, code, status, stage, ledger, evidence, issues, plan } = state;
  const rowStatus = status === "COMPLETED" ? "success" : (state.errorClass === "E-ENV" || state.errorClass === "E-TOOL") ? "blocked" : "failed";
  return {
    type: "completion",
    sections: [
      {
        id: "summary",
        rows: [
          { name: "Module", value: "planner" },
          { name: "Capability", value: "planner:plan" },
          { name: "Task", value: display(echo?.task) },
          { name: "Tier", value: display(echo?.tier) },
          { name: "Depth", value: plan ? plan.depth : "-" },
          { name: "Phase", value: "PLAN" },
          { name: "Code", value: code },
          { name: "Status", value: status },
          { name: "Stage", value: stage },
        ],
      },
      {
        id: "results",
        rows: [{
          module: "planner",
          command: "planner.plan",
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
// The planner
// ---------------------------------------------------------------------------

function freezePlan(plan) {
  for (const change of plan.changes) Object.freeze(change);
  Object.freeze(plan.changes);
  Object.freeze(plan.verification);
  Object.freeze(plan.risks);
  Object.freeze(plan.review);
  return Object.freeze(plan);
}

/** Compose the plan — pure function of a VALIDATED request (no I/O). */
function composePlan(request) {
  const tier = request.tier;
  return freezePlan({
    tier,
    depth: DEPTH_BY_TIER[tier],
    task: request.task,
    changes: request.changes.map((change) => ({ file: change.file, why: change.why })),
    verification: tier === "T0" ? [] : [...request.verification],
    risks: tier === "T0" ? [] : [...request.risks],
    review: {
      required: tier === "T2" && request.trigger !== undefined,
      trigger: tier === "T2" && request.trigger !== undefined ? request.trigger : null,
    },
  });
}

/**
 * Create the Planner from the one existing public contract it consumes.
 * The dependency is required: malformed configuration throws at
 * construction — no planner exists, therefore nothing can be planned
 * (01 §13.5). The composition root owns wiring; this layer discovers
 * nothing on its own.
 */
export function createPlanner({ reportBus } = {}) {
  if (!isPlainObject(reportBus) || typeof reportBus.build !== "function") {
    throw configError("reportBus must expose build()", "reportBus.build");
  }

  const planner = Object.freeze({
    /**
     * Run one planning attempt through the finite lifecycle.
     * Always returns a frozen result; a report is attempted for every
     * terminal attempt and attached unless the report step itself refuses.
     */
    plan(request) {
      const ledger = [];
      const evidence = [];
      const echo = normalizePlanRequest(request);

      let plan = null;

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
          report: null,
        };
        // REPORT stage: every terminal attempt carries a report (§9 of the
        // Task 10 contract, kept by this layer). This line only ever
        // becomes visible if the build succeeds — a refused build emits
        // nothing at all, so the claim cannot outlive the truth.
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
          issues: code === "COMPLETED" ? [] : [`${code}: ${oneLine(detail ?? RESULT_MESSAGE[code])}`],
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
      ledger.push("RECEIVE: done (request)");

      // --- VALIDATE (envelope + tier depth rules, Task 11 directive) ------
      const violations = validatePlanRequest(request);
      if (violations.length > 0) {
        const first = violations[0];
        evidence.push(`validate(request) → ${first.code}: ${first.detail}`);
        ledger.push(`VALIDATE: refused (${first.code})`);
        return finish("VALIDATE", first.code, first.detail);
      }
      ledger.push("VALIDATE: done (contract)");

      // --- PLAN (pure composition — cannot fail once validated) ----------
      plan = composePlan(request);
      evidence.push(
        `plan(tier=${plan.tier}, depth=${plan.depth}, changes=${plan.changes.length}, ` +
        `verification=${plan.verification.length}, risks=${plan.risks.length}, ` +
        `review=${plan.review.required ? `required:${plan.review.trigger}` : "none"})`
      );
      evidence.push("validate(request) → ok (contract)");
      ledger.push(PLAN_LEDGER_BY_TIER[plan.tier]);

      // --- REPORT + COMPLETE (report gate: no report → no completion) ----
      return finish("COMPLETE", "COMPLETED", null);
    },
  });

  return planner;
}
