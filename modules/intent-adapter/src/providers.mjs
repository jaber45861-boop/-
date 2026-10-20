// Grimoire v3 — Intent Adapter providers (Phase 1, build-agent directive).
//
// The Provider interface is the ONLY way a model ever connects to Grimoire:
//
//   provider = { complete(intent) → plain plan-request object | JSON string }
//
// It receives the validated intent envelope and returns a CANDIDATE plan
// request. It never receives execution authority: its output still passes
// the adapter's E1/PR1/C1/P1 rules and the Planner's own contract validator
// (R1) before anything plans, and planning never executes. The adapter has
// no default provider of its own — the composition root injects one.
//
// Phase-1 directive (amendment 2): the deterministic demo provider below IS
// the default for the `--intent` CLI path. It is a DISCLOSED test double —
// pure, frozen, deterministic: no network, no model, no keys, no
// environment variables, no clock, no randomness, no state between calls.
// A real model provider plugs into the same interface in a later phase,
// after that phase's own contract exists.

/**
 * Build the deterministic demo provider. Assembly rules (fixed, documented
 * in docs/v3/36-intent-adapter.md §provider):
 *
 *   task       = intent.request            (verbatim — never rewritten)
 *   tier       = intent.tier, or "T0" ONLY when the tier field is absent
 *                (null/invalid values are passed through so the Planner
 *                 contract refuses them — no silent repair)
 *   changes    = intent.changes, or [] only when the field is absent
 *   verification / risks / trigger
 *              = copied only when present, so tier-depth rules see exactly
 *                what the intent declared (absent ≠ empty).
 */
export function createDemoProvider() {
  return Object.freeze({
    complete(intent) {
      const assembled = {
        task: intent.request,
        tier: intent.tier === undefined ? "T0" : intent.tier,
        changes: intent.changes === undefined ? [] : intent.changes,
      };
      if (intent.verification !== undefined) assembled.verification = intent.verification;
      if (intent.risks !== undefined) assembled.risks = intent.risks;
      if (intent.trigger !== undefined) assembled.trigger = intent.trigger;
      return Object.freeze(assembled);
    },
  });
}

/** The single Phase-1 default provider — disclosed, deterministic, pure. */
export const DEMO_INTENT_PROVIDER = createDemoProvider();
