// Grimoire v3 — Planner entrypoint (Task 11).
// Declared as `entry` in modules/planner/manifest.yaml; re-exports the public
// contract only. Consumers import from here (03 §2 entry field), never from
// another module's internals (02 §3 rule 3). This module imports nothing but
// its own files: the Report Bus is injected by the composition root, so the
// Planner layer never reaches into it and never becomes a second source of
// truth.
export {
  createPlanner,
  RESULT_CODES,
  LIFECYCLE_STAGES,
  PLAN_LEDGER_BY_TIER,
} from "./src/planner.mjs";
export {
  validatePlanRequest,
  normalizePlanRequest,
  TIERS,
  PLAN_QUESTIONS,
  DEPTH_BY_TIER,
  TRIGGER_TYPES,
  REQUEST_FIELDS,
  CHANGE_FIELDS,
} from "./src/request.mjs";
export {
  CORE_ERROR_CLASSES,
  PLANNER_ERROR_CLASSES,
  makeError,
  isCoreErrorClass,
} from "./src/errors.mjs";
