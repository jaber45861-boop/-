// Grimoire v3 — Report Bus (L1 Core Service implementation, Task 09).
//
// Position (02 §1/§3): L1 Core Service — the "Report Bus (artifacts, phase
// ledger, completion report)" line of the layer diagram. Dependency direction
// is strictly downward and strictly consumer-driven: this service never
// imports the Hotkeys module, the Tool Bus, or the Module Registry, never
// touches Core files, never executes handlers, never invokes tools, never
// activates adapters, and never mutates the L3 hotkey registry. Callers
// supply already-validated rows; the bus validates the supplied structure
// and renders it (directive §2/§9/§10).
//
// Contract:
//   createReportBus()              frozen bus (no configuration: the type and
//                                  section catalogues are Core contract data,
//                                  03 §5 O3 — not runtime registrations)
//   validate(input)                full validation → {ok, code, error,
//                                  violations}; no rendering
//   build(input)                   validate → render → {text, sha256}; any
//                                  violation ⇒ report is null (fail closed,
//                                  no partial emission)
//   listTypes()/describeType(id)   the report-type catalogue
//   listSections()/describeSection(id)  the section catalogue
//
// Fail-closed vocabulary (directive §7): VALID, INVALID_INPUT,
// UNKNOWN_REPORT_TYPE, DUPLICATE_SECTION, INVALID_SECTION,
// MISSING_REQUIRED_FIELD, DEPENDENCY_ERROR — each mapped to one Core error
// class (01 §11.1); the first violation in the deterministic validation order
// names the refusal code, and every violation is carried for diagnosis.
//
// Determinism: sections render in fixed catalogue order (identical section
// SETS produce identical bytes regardless of input order), rows preserve the
// caller's order, all set-like iteration is sorted, no timestamps/random/pids/
// machine paths/environment values appear anywhere. sha256 is computed over
// the exact emitted UTF-8 bytes — sha256(report.text) === report.sha256.

import { createHash } from "node:crypto";
import { makeError } from "./errors.mjs";
import {
  REPORT_TYPES,
  SECTION_CATALOG,
  getReportType,
  getSection,
  validateReportInput,
} from "./catalog.mjs";

/**
 * Every Report Bus result code and its Core error class (01 §11.1).
 * `null` = success (the directive's VALID state).
 */
export const RESULT_CODES = Object.freeze({
  VALID: null,
  INVALID_INPUT: "E-INPUT",
  UNKNOWN_REPORT_TYPE: "E-INPUT",
  DUPLICATE_SECTION: "E-CONFLICT",
  INVALID_SECTION: "E-VALID",
  MISSING_REQUIRED_FIELD: "E-VALID",
  DEPENDENCY_ERROR: "E-ENV",
});

const RESULT_MESSAGE = Object.freeze({
  INVALID_INPUT: "report input failed the envelope contract",
  UNKNOWN_REPORT_TYPE: "report type is not registered",
  DUPLICATE_SECTION: "section id appears more than once",
  INVALID_SECTION: "report section failed validation",
  MISSING_REQUIRED_FIELD: "a required section or field is absent",
  DEPENDENCY_ERROR: "supplied row data failed its upstream contract",
});

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function refusal(code, violations) {
  return {
    ok: false,
    code,
    error: makeError(
      RESULT_CODES[code],
      code,
      RESULT_MESSAGE[code],
      violations.length > 0 ? violations[0].detail : null
    ),
    violations,
  };
}

// ---------------------------------------------------------------------------
// Rendering (stable, human-readable markdown; cell values are single-line by
// validation, pipes are escaped so no row can break the table structure)
// ---------------------------------------------------------------------------

const cell = (value) => String(value).replace(/\|/g, "\\|");
const orDash = (value) =>
  value === null || value === undefined || value === "" ? "—" : cell(value);
const joinOrDash = (values) =>
  Array.isArray(values) && values.length > 0 ? cell(values.join(", ")) : "—";

const NONE_ROW_2 = "| none | — |";

function renderRows(section, rows, lines) {
  if (rows.length === 0) {
    if (section.id === "results") {
      lines.push(`| none | — | — | — | — | — | — | — |`);
    } else {
      lines.push(NONE_ROW_2);
    }
    return;
  }

  if (section.id === "summary") {
    lines.push("| Name | Value |", "|---|---|");
    for (const row of rows) lines.push(`| ${cell(row.name)} | ${cell(row.value)} |`);
    return;
  }

  if (section.id === "results") {
    lines.push(
      "| Module | Command | Status | Phase ledger | Artifacts | Evidence | Remaining issues | Assumptions |",
      "|---|---|---|---|---|---|---|---|"
    );
    for (const row of rows) {
      lines.push(
        `| ${cell(row.module)} | ${cell(row.command)} | ${cell(row.status)} | ${joinOrDash(row.phase_ledger)} | ${joinOrDash(row.artifacts)} | ${joinOrDash(row.evidence)} | ${joinOrDash(row.remaining_issues)} | ${joinOrDash(row.assumptions)} |`
      );
    }
    return;
  }

  if (section.id === "artifacts") {
    lines.push("| Id | Sha256 |", "|---|---|");
    for (const row of rows) lines.push(`| ${cell(row.id)} | ${cell(row.sha256)} |`);
    return;
  }

  // phase-ledger / evidence / remaining-issues / assumptions — numbered items
  lines.push("| # | Item |", "|---|---|");
  rows.forEach((row, index) => lines.push(`| ${index + 1} | ${cell(row)} |`));
}

function renderReport(input) {
  const typeDef = getReportType(input.type);
  const present = SECTION_CATALOG.filter((section) =>
    input.sections.some((entry) => entry.id === section.id)
  );
  const totalRows = present.reduce((sum, section) => {
    const entry = input.sections.find((candidate) => candidate.id === section.id);
    return sum + entry.rows.length;
  }, 0);

  const lines = [
    `# ${typeDef.title}`,
    "",
    `Report type: \`${typeDef.id}\``,
    `Sections: ${present.length}`,
    `Rows: ${totalRows}`,
    "",
  ];
  let number = 0;
  for (const section of present) {
    number += 1;
    const entry = input.sections.find((candidate) => candidate.id === section.id);
    lines.push(`## ${number}. ${section.title}`, "");
    renderRows(section, entry.rows, lines);
    lines.push("");
  }
  const text = lines.join("\n");
  return { text, sha256: sha256(text) };
}

// ---------------------------------------------------------------------------
// The bus
// ---------------------------------------------------------------------------

/**
 * Create the Report Bus. No configuration: the report-type and section
 * catalogues are static contract data (03 §5 O3 — modules must not invent
 * parallel report schemas), so there is nothing a caller may register.
 */
export function createReportBus() {
  const evaluate = (input) => {
    const violations = validateReportInput(input);
    if (violations.length > 0) {
      const code = violations[0].code;
      return { ok: false, code, error: makeError(RESULT_CODES[code], code, RESULT_MESSAGE[code], violations[0].detail), violations: Object.freeze(violations) };
    }
    return { ok: true, code: "VALID", error: null, violations: Object.freeze([]) };
  };

  return Object.freeze({
    /** Validate only — same verdict build() would reach, no rendering. */
    validate(input) {
      return Object.freeze(evaluate(input));
    },

    /** Validate, then render. Any violation ⇒ report is null (no partial output). */
    build(input) {
      const verdict = evaluate(input);
      if (!verdict.ok) {
        return Object.freeze({ ...verdict, report: null });
      }
      return Object.freeze({ ...verdict, report: Object.freeze(renderReport(input)) });
    },

    listTypes() {
      return REPORT_TYPES.map((type) => ({
        id: type.id,
        title: type.title,
        requiredSections: [...type.requiredSections],
        allowedSections: [...type.allowedSections],
      }));
    },

    describeType(id) {
      const type = getReportType(id);
      if (!type) {
        return Object.freeze(refusal("UNKNOWN_REPORT_TYPE", [{ code: "UNKNOWN_REPORT_TYPE", detail: typeof id === "string" ? id : typeof id }]));
      }
      return Object.freeze({
        ok: true,
        code: "VALID",
        error: null,
        type: Object.freeze({
          id: type.id,
          title: type.title,
          requiredSections: [...type.requiredSections],
          allowedSections: [...type.allowedSections],
        }),
      });
    },

    listSections() {
      return SECTION_CATALOG.map((section) => ({
        id: section.id,
        title: section.title,
        rowKind: section.rowKind,
        fields: [...section.fields],
      }));
    },

    describeSection(id) {
      const section = getSection(id);
      if (!section) {
        return Object.freeze(refusal("INVALID_SECTION", [{ code: "INVALID_SECTION", detail: `unknown section "${String(id)}"` }]));
      }
      return Object.freeze({
        ok: true,
        code: "VALID",
        error: null,
        section: Object.freeze({
          id: section.id,
          title: section.title,
          rowKind: section.rowKind,
          fields: [...section.fields],
        }),
      });
    },
  });
}
