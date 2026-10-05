// Grimoire v3 — Report Bus catalogue + input validation (Task 09).
//
// Normative sources:
//   03 §5  — the structured result schema every module invocation MUST emit
//            to the Report Bus (module, command, status, phase_ledger,
//            artifacts, evidence, remaining_issues, assumptions) and rules
//            O1–O3 (status vocabulary, reproducible evidence, no parallel
//            report schemas).
//   01 §12 — the Completion Report definition (D9 phase ledger present;
//            D10 what changed / what was tested / remaining issues, empty
//            only if truly empty; 12.1 no filler issues).
//   01 §3  — the eight loop phases; §3.2 one-line phase-ledger format.
//   02 §1  — the Report Bus line: "artifacts, phase ledger, completion
//            report"; §4 SHIP emits the Completion Report via the Report
//            Bus; §3 rule 1 dependency direction.
//
// The catalogue is STATIC by contract: 03 §5 O3 forbids modules from
// inventing parallel report schemas, so report types and sections are Core
// contract data — not runtime registrations. Nothing here imports another
// module (02 §3 rule 3); callers supply already-validated rows.

import { REPORT_BUS_ERROR_CLASSES } from "./errors.mjs";

/** 01 §3 — the eight loop phases (local copy: lateral imports are forbidden).
 *  Exported so callers/tests can cross-check that this module's copy of the
 *  Core vocabulary matches the spec and other services' copies. */
export const EIGHT_LOOP_PHASES = Object.freeze([
  "UNDERSTAND", "PLAN", "BUILD", "RUN", "TEST", "DEBUG", "IMPROVE", "SHIP",
]);

/** 03 §5 — the only valid `status` values. */
export const REPORT_STATUSES = Object.freeze(["success", "blocked", "failed"]);

// Ledger line format — 01 §3.2 "<PHASE>: <reason>" shape (e.g. "PLAN: done
// (T1)", "DEBUG: skipped (no failures)"), single-line by definition. The
// token is NOT restricted to the eight loop phases: the committed Task 06
// runtime emits §5 results whose phase_ledger carries pipeline-stage lines
// ("RESOLVE: done (EXECUTABLE)", "EXECUTE: refused (…)" — 14 §4, which
// states these fields reuse the 03 §5 schema). The existing contract wins
// over inventing a narrower rule (directive §3); shape validation still
// refuses anything that is not "<token>: <non-empty reason>" on one line.
const LEDGER_RE = /^[A-Za-z0-9_-]+: \S[^\r\n]*$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isSingleLine = (value) => !/[\r\n]/.test(value);
const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => isNonEmptyString(item) && isSingleLine(item));

/**
 * The section catalogue, in canonical rendering order (02 §1: "artifacts,
 * phase ledger, completion report"; 03 §5 field set). Each section:
 *   id        — deterministic identity (kebab-case)
 *   title     — rendered heading text
 *   rowKind   — "object" | "ledger" | "text"
 *   fields     — required row fields, in emission order (object rows only)
 */
export const SECTION_CATALOG = Object.freeze([
  Object.freeze({
    id: "summary",
    title: "Summary",
    rowKind: "object",
    fields: Object.freeze(["name", "value"]),
  }),
  Object.freeze({
    id: "results",
    title: "Results",
    rowKind: "object",
    fields: Object.freeze([
      "module", "command", "status", "phase_ledger",
      "artifacts", "evidence", "remaining_issues", "assumptions",
    ]),
  }),
  Object.freeze({
    id: "phase-ledger",
    title: "Phase ledger",
    rowKind: "ledger",
    fields: Object.freeze([]),
  }),
  Object.freeze({
    id: "artifacts",
    title: "Artifacts",
    rowKind: "object",
    fields: Object.freeze(["id", "sha256"]),
  }),
  Object.freeze({
    id: "evidence",
    title: "Evidence",
    rowKind: "text",
    fields: Object.freeze([]),
  }),
  Object.freeze({
    id: "remaining-issues",
    title: "Remaining issues",
    rowKind: "text",
    fields: Object.freeze([]),
  }),
  Object.freeze({
    id: "assumptions",
    title: "Assumptions",
    rowKind: "text",
    fields: Object.freeze([]),
  }),
]);

const ALL_SECTION_IDS = Object.freeze(SECTION_CATALOG.map((section) => section.id));
const SECTION_MAP = new Map(SECTION_CATALOG.map((section) => [section.id, section]));

/**
 * The report-type catalogue (static — 03 §5 O3).
 *   completion — 01 §12 D9/D10: what changed (results), the phase ledger,
 *                what was tested (evidence), remaining issues (declared
 *                even when empty — 12.1: empty only if truly empty).
 *   result     — 03 §5: exactly one structured-result section, the schema
 *                an invocation emits; no other sections may appear.
 */
export const REPORT_TYPES = Object.freeze([
  Object.freeze({
    id: "completion",
    title: "Grimoire v3 — Completion Report",
    requiredSections: Object.freeze(["results", "phase-ledger", "evidence", "remaining-issues"]),
    allowedSections: ALL_SECTION_IDS,
  }),
  Object.freeze({
    id: "result",
    title: "Grimoire v3 — Structured Result",
    requiredSections: Object.freeze(["results"]),
    allowedSections: Object.freeze(["results"]),
  }),
]);

const TYPE_MAP = new Map(REPORT_TYPES.map((type) => [type.id, type]));
export const REPORT_TYPE_IDS = Object.freeze(REPORT_TYPES.map((type) => type.id));
export const SECTION_IDS = ALL_SECTION_IDS;

export function getReportType(id) {
  return typeof id === "string" ? TYPE_MAP.get(id) ?? null : null;
}

export function getSection(id) {
  return typeof id === "string" ? SECTION_MAP.get(id) ?? null : null;
}

// ---------------------------------------------------------------------------
// Row validation (values that are PRESENT but violate their contract are
// DEPENDENCY_ERROR — upstream supplied bad data; fields that are ABSENT are
// MISSING_REQUIRED_FIELD; structure/identity problems are INVALID_SECTION)
// ---------------------------------------------------------------------------

function pushValueViolation(violations, at, field, actual) {
  violations.push({
    code: "DEPENDENCY_ERROR",
    detail: `${at}.${field}: ${actual}`,
  });
}

function validateValue(section, field, value, at, violations) {
  const bad = (actual) => pushValueViolation(violations, at, field, actual);

  if (section.id === "summary") {
    if (field === "name") {
      if (!isNonEmptyString(value) || !isSingleLine(value)) bad(typeof value === "string" ? JSON.stringify(value) : typeof value);
      return;
    }
    const validType =
      (typeof value === "string" && isSingleLine(value))
      || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value));
    if (!validType) bad(typeof value === "object" && value !== null ? "object" : String(value));
    return;
  }

  if (section.id === "results") {
    if (field === "module" || field === "command") {
      if (!isNonEmptyString(value) || !isSingleLine(value)) bad(typeof value === "string" ? JSON.stringify(value) : typeof value);
      return;
    }
    if (field === "status") {
      if (!REPORT_STATUSES.includes(value)) bad(JSON.stringify(value));
      return;
    }
    if (field === "phase_ledger") {
      if (!Array.isArray(value)) {
        bad(`not an array (${typeof value})`);
        return;
      }
      for (const line of value) {
        if (typeof line !== "string" || !LEDGER_RE.test(line)) {
          bad(`ledger line ${JSON.stringify(line)}`);
        }
      }
      return;
    }
    // artifacts / evidence / remaining_issues / assumptions
    if (!isStringArray(value)) bad(`not an array of single-line non-empty strings (${Array.isArray(value) ? "invalid item" : typeof value})`);
    return;
  }

  if (section.id === "artifacts") {
    if (field === "id") {
      if (!isNonEmptyString(value) || !isSingleLine(value)) bad(typeof value === "string" ? JSON.stringify(value) : typeof value);
      return;
    }
    if (!SHA256_RE.test(String(value))) bad(JSON.stringify(String(value)));
  }
}

function validateRow(section, row, index, violations) {
  const at = `${section.id}[${index}]`;

  if (section.rowKind === "text") {
    if (typeof row !== "string" || row.trim() === "" || !isSingleLine(row)) {
      violations.push({ code: "DEPENDENCY_ERROR", detail: `${at}: expected a single-line non-empty string` });
    }
    return;
  }

  if (section.rowKind === "ledger") {
    if (typeof row !== "string" || !LEDGER_RE.test(row)) {
      violations.push({ code: "DEPENDENCY_ERROR", detail: `${at}: ${JSON.stringify(row)} is not a "<PHASE>: <reason>" ledger line` });
    }
    return;
  }

  if (!isPlainObject(row)) {
    violations.push({ code: "DEPENDENCY_ERROR", detail: `${at}: expected an object row (${typeof row})` });
    return;
  }

  for (const field of section.fields) {
    if (row[field] === undefined) {
      violations.push({ code: "MISSING_REQUIRED_FIELD", detail: `${at}.${field}` });
    }
  }
  for (const field of section.fields) {
    if (row[field] !== undefined) validateValue(section, field, row[field], at, violations);
  }
  const unexpected = Object.keys(row)
    .filter((key) => !section.fields.includes(key))
    .sort();
  for (const key of unexpected) {
    violations.push({ code: "INVALID_SECTION", detail: `${at}: unexpected field "${key}"` });
  }
}

// ---------------------------------------------------------------------------
// Input validation (deterministic order, first violation names the refusal
// code): envelope shape → envelope fields → type lookup → section entries in
// input order → required sections of the type)
// ---------------------------------------------------------------------------

export function validateReportInput(input) {
  const violations = [];
  const v = (code, detail) => violations.push({ code, detail });

  if (!isPlainObject(input)) {
    v("INVALID_INPUT", `input must be a plain object (${typeof input})`);
    return violations;
  }
  const { type, sections } = input;
  if (typeof type !== "string" || type.trim() === "") {
    v("INVALID_INPUT", `type must be a non-empty string (${typeof type})`);
    return violations;
  }
  if (!Array.isArray(sections)) {
    v("INVALID_INPUT", `sections must be an array (${typeof sections})`);
    return violations;
  }
  const envelopeFields = Object.keys(input).filter((key) => key !== "type" && key !== "sections").sort();
  for (const key of envelopeFields) {
    v("INVALID_INPUT", `unexpected field "${key}"`);
  }
  if (violations.length > 0) return violations;

  const typeDef = TYPE_MAP.get(type);
  if (!typeDef) {
    v("UNKNOWN_REPORT_TYPE", type);
    return violations;
  }

  const seen = new Set();
  for (const entry of sections) {
    if (!isPlainObject(entry)) {
      v("INVALID_SECTION", `section entry must be an object (${typeof entry})`);
      continue;
    }
    const entryFields = Object.keys(entry).filter((key) => key !== "id" && key !== "rows").sort();
    if (entryFields.length > 0) {
      v("INVALID_SECTION", `unexpected field "${entryFields[0]}"`);
      continue;
    }
    const { id, rows } = entry;
    if (typeof id !== "string" || id.trim() === "") {
      v("INVALID_SECTION", `section id must be a non-empty string (${typeof id})`);
      continue;
    }
    if (seen.has(id)) {
      v("DUPLICATE_SECTION", id);
      continue;
    }
    seen.add(id);
    const section = SECTION_MAP.get(id);
    if (!section) {
      v("INVALID_SECTION", `unknown section "${id}"`);
      continue;
    }
    if (!typeDef.allowedSections.includes(id)) {
      v("INVALID_SECTION", `section "${id}" is not allowed for report type "${typeDef.id}"`);
      continue;
    }
    if (!Array.isArray(rows)) {
      v("INVALID_SECTION", `${id}: rows must be an array (${typeof rows})`);
      continue;
    }
    rows.forEach((row, index) => validateRow(section, row, index, violations));
  }

  for (const required of typeDef.requiredSections) {
    if (!seen.has(required)) v("MISSING_REQUIRED_FIELD", `section:${required}`);
  }
  return violations;
}
