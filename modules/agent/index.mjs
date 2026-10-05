// Grimoire v3 — Agent Orchestrator entrypoint (Task 10).
// Declared as `entry` in modules/agent/manifest.yaml; re-exports the public
// contract only. Consumers import from here (03 §2 entry field), never from
// another module's internals (02 §3 rule 3). This module imports nothing
// but its own files: the four services (Module Registry, Tool Bus, Hotkey
// Runtime, Report Bus) are injected by the composition root, so the Agent
// layer never reaches into them and never becomes a second source of truth.
export {
  createAgentOrchestrator,
  RESULT_CODES,
  LIFECYCLE_STAGES,
} from "./src/orchestrator.mjs";
export {
  validateRequest,
  normalizeRequest,
  OPERATION_KINDS,
  REQUEST_FIELDS,
  TARGET_FIELDS,
  EXECUTION_CAPABILITY,
  EIGHT_LOOP_PHASES,
} from "./src/request.mjs";
export {
  CORE_ERROR_CLASSES,
  AGENT_ERROR_CLASSES,
  makeError,
  isCoreErrorClass,
} from "./src/errors.mjs";
