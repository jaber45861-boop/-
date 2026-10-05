// Grimoire v3 — Plan–Execution composition entrypoint.
// The composition root's public contract: re-exports only. Consumers import
// from here, never from this layer's internals (03 §2 entry-field
// discipline). This layer imports nothing but its own files: the Planner,
// the Agent Orchestrator, and the Report Bus are injected by the composition
// root, so neither downstream module is ever reached into, and neither is
// ever replaced by a second source of truth (02 §3 rules 1/3).
export {
  createPlanExecutionComposer,
  LIFECYCLE_STAGES,
  RESULT_CODES,
} from "./src/composer.mjs";
export {
  validateBundle,
  normalizeBundle,
  BUNDLE_FIELDS,
} from "./src/bundle.mjs";
export {
  CORE_ERROR_CLASSES,
  COMPOSITION_ERROR_CLASSES,
  makeError,
  isCoreErrorClass,
} from "./src/errors.mjs";
