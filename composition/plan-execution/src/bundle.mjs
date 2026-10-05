// Grimoire v3 — Plan–Execution bundle contract.
//
// A bundle is the composition root's request: exactly two sub-envelopes,
// `plan` (the Planner's request, 19 §5) and `execution` (the Agent
// Orchestrator's request, 18 §5). The envelope rules here are the same
// strict ones both downstream contracts already use: exactly the declared
// fields, no extras anywhere, both members present and shaped.
//
// The CONTENT of each sub-envelope belongs to the layer that owns it — the
// planner validates the plan request, the agent validates the execution
// request — and is never re-validated here (each contract validates exactly
// once, at its own gate). This envelope check exists so that a malformed
// bundle fails closed before ANY downstream attempt runs: no valid bundle →
// no plan, no plan → no execution (01 §13.5).

/** The bundle envelope's declared fields, in fixed order. */
export const BUNDLE_FIELDS = Object.freeze(["plan", "execution"]);

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate the bundle envelope. Returns ALL violations in fixed order
 * (envelope fields → plan → execution); the first violation names the
 * refusal. Every violation is `INVALID_REQUEST` — one code, many named
 * details (the composition VALIDATE stage fails as a unit).
 */
export function validateBundle(input) {
  const violations = [];
  const v = (detail) => violations.push({ code: "INVALID_REQUEST", detail });

  if (!isPlainObject(input)) {
    v(`bundle must be a plain object (${typeof input})`);
    return violations;
  }

  const unexpected = Object.keys(input)
    .filter((field) => !BUNDLE_FIELDS.includes(field))
    .sort();
  for (const field of unexpected) v(`unexpected bundle field "${field}"`);

  if (!isPlainObject(input.plan)) {
    v(`plan must be a plain object (${typeof input.plan})`);
  }
  if (!isPlainObject(input.execution)) {
    v(`execution must be a plain object (${typeof input.execution})`);
  }

  return violations;
}

/**
 * Sanitized display echo of a received bundle. The two sub-envelopes are
 * echoed structurally (own enumerable keys copied, nothing evaluated);
 * display strings shown in this layer's report are taken from each
 * sub-attempt's own normalized echo (planner/agent `result.request`), never
 * raw input. Used only for display; acceptance is decided solely by
 * validateBundle plus the two downstream contracts.
 */
export function normalizeBundle(input) {
  if (!isPlainObject(input)) return null;
  return Object.freeze({
    plan: isPlainObject(input.plan) ? Object.freeze({ ...input.plan }) : null,
    execution: isPlainObject(input.execution)
      ? Object.freeze({ ...input.execution })
      : null,
  });
}
