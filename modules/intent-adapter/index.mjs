// Grimoire v3 — Intent Adapter entrypoint (Phase 1, build-agent directive).
// Declared as `entry` in modules/intent-adapter/manifest.yaml; re-exports the
// public contract only. Consumers import from here (03 §2 entry field), never
// from another module's internals (02 §3 rule 3). This module imports nothing
// from any other module: the Planner contract validator and the Provider are
// both injected by the composition root, exactly like the Report Bus is
// injected into the Planner (02 §3 rule 3 — no lateral coupling).
export {
  createIntentAdapter,
  INTENT_FIELDS,
  INTENT_RULES,
  CORE_ERROR_CLASSES,
  INTENT_ERROR_CLASSES,
  makeError,
  isCoreErrorClass,
} from "./src/adapter.mjs";
export { createDemoProvider, DEMO_INTENT_PROVIDER } from "./src/providers.mjs";
