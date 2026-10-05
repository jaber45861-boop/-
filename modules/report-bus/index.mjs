// Grimoire v3 — Report Bus entrypoint (Task 09).
// Declared as `entry` in modules/report-bus/manifest.yaml; re-exports
// the public contract only. Consumers import from here (03 §2 entry field),
// never from another module's internals (02 §3 rule 3), and the Report Bus
// itself imports nothing but node:crypto and its own files — callers supply
// the rows; no module is discovered, imported, or executed from here.
export { createReportBus, RESULT_CODES } from "./src/bus.mjs";
export {
  REPORT_TYPES,
  SECTION_CATALOG,
  REPORT_TYPE_IDS,
  SECTION_IDS,
  REPORT_STATUSES,
  EIGHT_LOOP_PHASES,
  getReportType,
  getSection,
  validateReportInput,
} from "./src/catalog.mjs";
export {
  CORE_ERROR_CLASSES,
  REPORT_BUS_ERROR_CLASSES,
  makeError,
  isCoreErrorClass,
} from "./src/errors.mjs";
