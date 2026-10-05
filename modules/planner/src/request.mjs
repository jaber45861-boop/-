// Grimoire v3 — Planner request contract (Task 11).
//
// Normative sources:
//   01 §3    — PLAN produces "the ordered list of changes and the
//              verification strategy".
//   01 §3.1  — effort tiers: T0 = single file, PLAN output = one sentence;
//              T1 = short bullet list kept in the report; T2 = written plan
//              with a risk list and a test plan.
//   01 §3.2  — skip rules: `PLAN: skipped (T0 — one-line intent)`.
//   01 §5.1  — the plan answers exactly four questions: what files change
//              and why, what order, how we will know it works, what can go
//              wrong.
//   01 §5.2  — a T2 plan is shown to the user before BUILD when a trigger
//              applies (intent change / migration / architecture choice).
//   01 §5.3  — plans reference real files and real commands.
//   01 §5.4  — depth by tier: T0 one sentence, T1 bullets, T2 a document
//              (planning must not become ceremony).
//   AC-10    — T0 ships a one-sentence intent and NO plan document; T2
//              produces a written plan with all four questions + a risk
//              list BEFORE any build step.
//   Task 11 directive — strict request shape; invalid/incomplete/
//              ambiguous/unsupported requests fail closed.
//
// The envelope is strict: exactly the declared fields, no extras anywhere
// (extra fields are refused rather than ignored — a plan request is
// contract data, not a bag of options). Two refusal codes with a clean
// split:
//   INVALID_REQUEST (E-INPUT)  — envelope/type/format violations: the
//              request cannot be trusted as data.
//   PLAN_INCOMPLETE (E-VALID)  — depth-rule violations: the request is
//              well-formed but the plan it asks for does not answer the
//              questions the tier demands (or answers ones it must not).

export const TIERS = Object.freeze(["T0", "T1", "T2"]);

/** 01 §5.1 — the four questions, in order; mapped to request fields. */
export const PLAN_QUESTIONS = Object.freeze(["files", "order", "verification", "risks"]);

/** 01 §5.4 / §3.1 — required depth per tier. */
export const DEPTH_BY_TIER = Object.freeze({
  T0: "one-line",
  T1: "bullets",
  T2: "document",
});

/** 01 §5.2 — T2 approval triggers (none = BUILD proceeds without a gate). */
export const TRIGGER_TYPES = Object.freeze(["intent-change", "migration", "architecture"]);

export const REQUEST_FIELDS = Object.freeze(["task", "tier", "changes", "verification", "risks", "trigger"]);
export const CHANGE_FIELDS = Object.freeze(["file", "why"]);

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isSingleLine = (value) => typeof value === "string" && !/[\r\n]/.test(value);
// Report-safe: no pipe (would corrupt a markdown table row), no newline.
const isSafeString = (value) => isNonEmptyString(value) && isSingleLine(value) && !value.includes("|");
// Relative path shape: no spaces, no pipes, no leading slash, no "." / ".."
// segments, no empty segments — 01 §5.3's "real files" at format level
// (existence is not checked: this module touches no file system).
const PATH_RE = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const isPathLike = (value) =>
  isSafeString(value) &&
  PATH_RE.test(value) &&
  !value.split("/").some((segment) => segment === "." || segment === "..");

const checkStringList = (value, label, violations, v) => {
  if (!Array.isArray(value)) {
    v("INVALID_REQUEST", `${label} must be an array when present (${typeof value})`);
    return;
  }
  value.forEach((item, index) => {
    if (!isSafeString(item)) {
      v("INVALID_REQUEST", `${label}[${index}] must be a non-empty single-line string without "|": ${JSON.stringify(item)}`);
    }
  });
};

/**
 * Validate a plan request. Returns ALL violations in fixed order (envelope
 * → task → tier → changes → verification → risks → trigger → tier depth
 * rules); the first violation names the refusal. Each violation carries its
 * own code: INVALID_REQUEST for data-shape failures, PLAN_INCOMPLETE for
 * tier-depth failures (01 §5/§3.1, AC-10).
 */
export function validatePlanRequest(input) {
  const violations = [];
  const v = (code, detail) => violations.push({ code, detail });

  if (!isPlainObject(input)) {
    v("INVALID_REQUEST", `request must be a plain object (${typeof input})`);
    return violations;
  }

  const unexpected = Object.keys(input)
    .filter((field) => !REQUEST_FIELDS.includes(field))
    .sort();
  for (const field of unexpected) v("INVALID_REQUEST", `unexpected request field "${field}"`);

  const { task, tier, changes, verification, risks, trigger } = input;

  if (!isSafeString(task)) {
    v("INVALID_REQUEST", `task must be a non-empty single-line string without "|": ${JSON.stringify(task)}`);
  }

  const tierValid = isNonEmptyString(tier) && TIERS.includes(tier);
  if (!tierValid) {
    v("INVALID_REQUEST", `tier must be one of: ${TIERS.join(", ")}: ${JSON.stringify(tier)}`);
  }

  // --- Q1 + Q2: what files change, in what order (array order IS order) --
  if (!Array.isArray(changes)) {
    v("INVALID_REQUEST", `changes must be an array (${typeof changes})`);
  } else {
    changes.forEach((change, index) => {
      if (!isPlainObject(change)) {
        v("INVALID_REQUEST", `changes[${index}] must be an object (${typeof change})`);
        return;
      }
      for (const field of Object.keys(change).filter((f) => !CHANGE_FIELDS.includes(f)).sort()) {
        v("INVALID_REQUEST", `unexpected changes[${index}] field "${field}"`);
      }
      if (!isPathLike(change.file)) {
        v("INVALID_REQUEST", `changes[${index}].file must be a relative path (no spaces, "|", ".."): ${JSON.stringify(change.file)}`);
      }
      if (!isSafeString(change.why)) {
        v("INVALID_REQUEST", `changes[${index}].why must be a non-empty single-line string without "|": ${JSON.stringify(change.why)}`);
      }
      if (Object.keys(change).length !== CHANGE_FIELDS.length) {
        v("INVALID_REQUEST", `changes[${index}] must carry exactly: ${CHANGE_FIELDS.join(", ")}`);
      }
    });
    if (changes.length === 0) {
      v("PLAN_INCOMPLETE", "plan must answer: what files change (01 §5.1 question 1)");
    }
  }

  // --- Q3/Q4/Q-gate: shape only here; depth rules come after ------------
  if (verification !== undefined) checkStringList(verification, "verification", violations, v);
  if (risks !== undefined) checkStringList(risks, "risks", violations, v);
  if (trigger !== undefined && (!isNonEmptyString(trigger) || !TRIGGER_TYPES.includes(trigger))) {
    v("INVALID_REQUEST", `trigger must be one of: ${TRIGGER_TYPES.join(", ")}: ${JSON.stringify(trigger)}`);
  }

  // Shape failures win: the data cannot be judged against depth rules.
  if (violations.some((violation) => violation.code === "INVALID_REQUEST")) return violations;

  // --- Tier depth rules (01 §5.4, §5.1, §5.2, §3.1; AC-10) --------------
  if (tier === "T0") {
    // One sentence, one file, no document (01 §3.1/§5.4; AC-10 scenario A).
    if (verification !== undefined) v("PLAN_INCOMPLETE", "tier T0 accepts only a one-sentence intent — verification is not part of it (01 §5.4)");
    if (risks !== undefined) v("PLAN_INCOMPLETE", "tier T0 accepts only a one-sentence intent — risks are not part of it (01 §5.4)");
    if (trigger !== undefined) v("PLAN_INCOMPLETE", "trigger requires tier T2 (01 §5.2)");
    if (Array.isArray(changes) && changes.length !== 1) {
      v("PLAN_INCOMPLETE", `tier T0 plans exactly one file (01 §3.1) — got ${changes.length}`);
    }
  } else {
    // T1 and T2 both answer all four questions (01 §5.1); T2 additionally
    // carries the risk list AC-10 requires (already checked as Q4).
    if (!Array.isArray(verification) || verification.length === 0) {
      v("PLAN_INCOMPLETE", "plan must answer: how will we know it works (01 §5.1 question 3)");
    }
    if (!Array.isArray(risks) || risks.length === 0) {
      v("PLAN_INCOMPLETE", "plan must answer: what can go wrong (01 §5.1 question 4)");
    }
    if (tier === "T1" && trigger !== undefined) {
      v("PLAN_INCOMPLETE", "trigger requires tier T2 (01 §5.2)");
    }
  }

  return violations;
}

/**
 * Best-effort sanitized echo of a received request for reporting. Strings
 * are single-line-sanitized (a malformed request must still be reportable);
 * non-strings become null. Display only — acceptance is decided solely by
 * validatePlanRequest.
 */
export function normalizePlanRequest(input) {
  if (!isPlainObject(input)) return null;
  const str = (value) => (typeof value === "string" && isSingleLine(value) && value.trim() !== "" ? value : null);
  const changes = Array.isArray(input.changes)
    ? input.changes.map((change) =>
        isPlainObject(change)
          ? { file: str(change.file), why: str(change.why) }
          : null
      )
    : null;
  const list = (value) =>
    Array.isArray(value) && value.every((item) => typeof item === "string" && isSingleLine(item))
      ? [...value]
      : null;
  return {
    task: str(input.task),
    tier: str(input.tier),
    changes,
    verification: list(input.verification),
    risks: list(input.risks),
    trigger: str(input.trigger),
  };
}
