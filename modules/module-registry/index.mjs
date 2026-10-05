// Grimoire v3 — Module Registry entrypoint (Task 08).
// Declared as `entry` in modules/module-registry/manifest.yaml; re-exports
// the public contract only. Consumers import from here (03 §2 entry field),
// never from another module's internals (02 §3 rule 3).
export {
  createModuleRegistry,
  buildRegistryReport,
  RESULT_CODES,
  DEFAULT_AVAILABLE_TOOLS,
} from "./src/registry.mjs";
export {
  parseManifest,
  validateManifest,
  EIGHT_LOOP_PHASES,
  MANIFEST_FIELDS,
  CORE_CONTRACT_VERSION,
} from "./src/manifest.mjs";
export { CORE_ERROR_CLASSES, MODULE_ERROR_CLASSES, makeError, isCoreErrorClass } from "./src/errors.mjs";
