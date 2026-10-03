// Grimoire v3 — L2 Hotkeys module: deterministic registry loader.
// Consumes ONLY the L3 registry (docs/v3/12-hotkey-registry.md) as the record
// dataset. Legacy source files are opened for exactly one purpose: verifying
// source-reference anchors (existence / line range / non-blank) — duty 6 of the
// Task 05 directive. No legacy content is ever parsed into records (02 §3 rule:
// arrows point down; the module never reaches past L3 into the source layer).
//
// Duties implemented here (Task 05 directive, REGISTRY LOADER 1–10):
//   1  load the L3 registry
//   2  validate structure (sections, headers, column counts, declared counts)
//   3  validate required fields (03 §4 H1 set + status/key/command/source)
//   4  validate status values (7 activation + 5 validation, 12 §1.2/§1.3)
//   5  validate Core mode values (04 §2 nine modes + documented exemptions)
//   6  validate source references (file exists, line in range, line non-blank)
//   7  detect duplicate identities (command ids — H3)
//   8  detect duplicate active keys (ACTIVE records only — HKC-10)
//   9  detect malformed adapter references (existence / known status / not
//      falsely active / bijection with §4 declarations)
//  10  produce a structured validation result (the returned object)
//
// The loader NEVER silently repairs an invalid record: violations are recorded,
// raw values are kept, and validation fails closed (01 §13.5).

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Normative vocabularies (04 §2, 12 §1.2/§1.3) — fixed order for determinism.
// ---------------------------------------------------------------------------
export const NINE_MODES = Object.freeze([
  "ANSWER", "ASK", "RESEARCH", "PLAN", "CODE", "DEBUG", "TEST", "TEACH", "TOOL",
]);
export const ACTIVATION_STATUSES = Object.freeze([
  "ACTIVE",
  "ADAPTER_REQUIRED",
  "BLOCKED_CONFLICT",
  "BLOCKED_AMBIGUOUS",
  "BLOCKED_INSUFFICIENT_INFO",
  "HISTORICAL_REMOVED",
  "METADATA_ONLY",
]);
export const VALIDATION_STATUSES = Object.freeze([
  "VALIDATED",
  "PENDING_ADAPTER",
  "PENDING_RULING",
  "PENDING_EVIDENCE",
  "NOT_APPLICABLE",
]);
// 12 §1.2/§1.3: each activation status has exactly one valid validation status.
export const STATUS_TO_VALIDATION = Object.freeze({
  ACTIVE: "VALIDATED",
  ADAPTER_REQUIRED: "PENDING_ADAPTER",
  BLOCKED_CONFLICT: "PENDING_RULING",
  BLOCKED_AMBIGUOUS: "PENDING_RULING",
  BLOCKED_INSUFFICIENT_INFO: "PENDING_EVIDENCE",
  HISTORICAL_REMOVED: "NOT_APPLICABLE",
  METADATA_ONLY: "NOT_APPLICABLE",
});
// The only adapter activation status declared anywhere in the registry (12 §4).
export const KNOWN_ADAPTER_STATUS = "NOT_ACTIVATED (adapter pending)";

const ADAPTER_ID_RE = /^grimoire\.adapter\.[A-Za-z0-9]+$/;

// Exact expected headers — structure duty fails if the registry schema drifts.
const EXPECTED_HEADERS = Object.freeze({
  grimoire: [
    "#", "Key", "Command", "Name", "Purpose (source)", "Behavior", "Mode",
    "Output", "Tools", "Adapter", "Source", "Trigger", "Activation status",
    "Validation status", "Notes",
  ],
  external: [
    "#", "Key", "Tool", "Context (source)", "Source", "Contract classification",
    "Activation status", "Validation status", "Adapter",
  ],
  adapter: [
    "Adapter id", "Key (legacy identity)", "Core mode",
    "Adapter responsibility (isolated from Core)", "Expected input",
    "Expected output", "Failure behavior (`01` §11)", "Activation status",
  ],
  summary: ["Activation status", "Count", "Members"],
});

// Record fields that must exist (cell present) for structural completeness —
// the H1 seven (03 §4) plus identity/status/traceability columns. Values may be
// `—` (H1: "required even if empty"; registry convention for adapter/source).
// `notes` is excluded: it is not a contract field.
const REQUIRED_PRESENT = Object.freeze({
  grimoire: [
    "index", "key", "command", "name", "purpose", "behavior", "mode",
    "output", "tools", "adapter", "source_raw", "trigger",
    "activation_status", "validation_status",
  ],
  external: [
    "index", "key", "tool", "context", "source_raw", "classification",
    "activation_status", "validation_status", "adapter",
  ],
});
// Fields that must carry a real value — a placeholder `—` is not an identity,
// a status, or a routing decision. (`name`/`notes`/`tools`/`adapter`/`mode`
// may be `—`; mode emptiness semantics are enforced by validateMode.)
const REQUIRED_NONEMPTY = Object.freeze({
  grimoire: ["key", "command", "activation_status", "validation_status"],
  external: ["key", "activation_status", "validation_status"],
});

const SOURCE_FILE_RE = /([A-Za-z0-9_.-]+\.md|grimoire):([0-9][0-9,]*(?:\s*[–—-]\s*[0-9]+)?)/;
const BARE_LINE_RE = /^:([0-9][0-9,]*(?:\s*[–—-]\s*[0-9]+)?)$/;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function md(value) {
  // Strip markdown emphasis/decoration for *reading* — this is deterministic
  // decoration-stripping, not data repair: the raw cell text is preserved in
  // `raw` where it matters (source evidence).
  return String(value).replace(/\*\*/g, "").trim();
}
function decorated(value) {
  return md(value).replace(/^`+|`+$/g, "");
}
function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function violation(code, scope, extra) {
  return { code, scope, section: null, record: null, field: null, message: code, ...extra };
}
function parseListSpec(spec) {
  // "14,96" | "38–39" | "6,15,27,36" -> [14,96] | [38,39] | ...
  const out = [];
  for (const part of String(spec).split(",")) {
    const p = part.trim();
    if (p === "") return null;
    const range = p.match(/^([0-9]+)\s*[–—-]\s*([0-9]+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a < 1 || b < a) return null;
      for (let n = a; n <= b; n += 1) out.push(n);
      continue;
    }
    if (!/^[0-9]+$/.test(p)) return null;
    const n = Number(p);
    if (n < 1) return null;
    out.push(n);
  }
  return out.length > 0 ? out : null;
}

// ---------------------------------------------------------------------------
// Section + table parsing (structure duty)
// ---------------------------------------------------------------------------
function sliceSection(lines, startPrefix, endPrefix) {
  const start = lines.findIndex((l) => l.startsWith(startPrefix));
  if (start === -1) return null;
  let end = lines.length;
  if (endPrefix) {
    const idx = lines.findIndex((l, i) => i > start && l.startsWith(endPrefix));
    if (idx !== -1) end = idx;
  }
  return lines.slice(start, end);
}

function parseTable(sectionLines, expectedHeader, sectionName) {
  // Returns { header, rows: [{ cells, raw }], violations }
  const violations = [];
  const tableLines = sectionLines.filter((l) => l.startsWith("|"));
  if (tableLines.length === 0) {
    violations.push(violation("section_missing_table", "registry", {
      section: sectionName, message: `section ${sectionName} has no table`,
    }));
    return { header: null, rows: [], violations };
  }
  const parsed = tableLines.map((raw) => ({
    raw,
    cells: (() => {
      const parts = raw.split("|");
      // "| a | b |" -> ["", " a ", " b ", ""] -> slice(1,-1)
      return parts.slice(1, -1).map((c) => c.trim());
    })(),
  }));
  const isSeparator = (cells) => cells.length > 0 && cells.every((c) => /^-+$/.test(c));
  const body = parsed.filter((row) => !isSeparator(row.cells));
  const header = body.shift();
  if (!header) {
    violations.push(violation("header_missing", "registry", {
      section: sectionName, message: `section ${sectionName} header missing`,
    }));
    return { header: null, rows: [], violations };
  }
  if (header.cells.length !== expectedHeader.length
      || header.cells.some((c, i) => c !== expectedHeader[i])) {
    violations.push(violation("header_mismatch", "registry", {
      section: sectionName,
      field: header.cells.join(" | "),
      message: `section ${sectionName} header does not match the registered schema`,
    }));
  }
  return { header: header.cells, rows: body, violations };
}

function declaredCount(sectionLines) {
  if (!sectionLines) return null;
  const heading = sectionLines.find((l) => l.startsWith("## "));
  if (!heading) return null;
  const m = heading.match(/\((\d+)/);
  return m ? Number(m[1]) : null;
}

/** Parse the registry text into structured sections. Never throws on bad data. */
export function parseRegistry(text) {
  const violations = [];
  const lines = String(text).split("\n");

  const meta = {
    version: null,
    source_commit: null,
    sha256: sha256(text),
  };
  const statusLine = lines.find((l) => l.startsWith("**Status:**"));
  if (statusLine) meta.version = statusLine.replace(/^\*\*Status:\*\*\s*/, "").trim();
  const sorLine = lines.find((l) => l.startsWith("**Source of record:**"));
  if (sorLine) {
    const m = sorLine.match(/legacy commit `([0-9a-f]{7,40})`/);
    if (m) meta.source_commit = m[1];
  }
  if (!meta.version) {
    violations.push(violation("registry_version_missing", "registry", {
      message: "registry Status line missing",
    }));
  }

  const bounds = {
    grimoire: sliceSection(lines, "## 2.", "## 3."),
    external: sliceSection(lines, "## 3.", "## 4."),
    adapter: sliceSection(lines, "## 4.", "## 5."),
    summary: sliceSection(lines, "## 5.", "## 6."),
  };
  for (const name of ["grimoire", "external", "adapter", "summary"]) {
    if (!bounds[name]) {
      violations.push(violation("section_missing", "registry", {
        section: name, message: `section ${name} heading missing`,
      }));
    }
  }

  const tables = {};
  for (const name of ["grimoire", "external", "adapter", "summary"]) {
    tables[name] = bounds[name]
      ? parseTable(bounds[name], EXPECTED_HEADERS[name], name)
      : { header: null, rows: [], violations: [] };
    violations.push(...tables[name].violations);
  }

  // Declared record counts from section headings (structure duty).
  const declared = {
    grimoire: declaredCount(bounds.grimoire),
    external: declaredCount(bounds.external),
    adapter: declaredCount(bounds.adapter),
  };

  return { meta, tables, declared, violations };
}

// ---------------------------------------------------------------------------
// Record construction + per-record validation duties (2–9)
// ---------------------------------------------------------------------------
function buildGrimoireRecord(cells, rowIndex, violations) {
  const section = "grimoire";
  const cell = (name) => {
    const i = EXPECTED_HEADERS.grimoire.indexOf(name);
    return i >= 0 && i < cells.length ? cells[i] : undefined;
  };
  const record = {
    section,
    row: rowIndex,
    index: cell("#") !== undefined ? md(cell("#")) : undefined,
    key: cell("Key") !== undefined ? decorated(cell("Key")) : undefined,
    command: cell("Command") !== undefined ? md(cell("Command")) : undefined,
    name: cell("Name") !== undefined ? md(cell("Name")) : undefined,
    purpose: cell("Purpose (source)") !== undefined ? md(cell("Purpose (source)")) : undefined,
    behavior: cell("Behavior") !== undefined ? md(cell("Behavior")) : undefined,
    mode: cell("Mode") !== undefined ? md(cell("Mode")) : undefined,
    output: cell("Output") !== undefined ? md(cell("Output")) : undefined,
    tools: cell("Tools") !== undefined ? md(cell("Tools")) : undefined,
    adapter: cell("Adapter") !== undefined ? decorated(cell("Adapter")) : undefined,
    source_raw: cell("Source") !== undefined ? md(cell("Source")) : undefined,
    trigger: cell("Trigger") !== undefined ? md(cell("Trigger")) : undefined,
    activation_status: cell("Activation status") !== undefined ? md(cell("Activation status")) : undefined,
    validation_status: cell("Validation status") !== undefined ? md(cell("Validation status")) : undefined,
    violations: [],
    citations: [],
  };
  if (cells.length !== EXPECTED_HEADERS.grimoire.length) {
    const v = violation("row_column_count", "record", {
      section, record: record.key ?? record.index ?? null,
      message: `row has ${cells.length} columns, expected ${EXPECTED_HEADERS.grimoire.length}`,
    });
    violations.push(v);
    record.violations.push(v.code);
  }
  return record;
}

function buildExternalRecord(cells, rowIndex, violations) {
  const section = "external";
  const cell = (name) => {
    const i = EXPECTED_HEADERS.external.indexOf(name);
    return i >= 0 && i < cells.length ? cells[i] : undefined;
  };
  return {
    section,
    row: rowIndex,
    index: cell("#") !== undefined ? md(cell("#")) : undefined,
    key: cell("Key") !== undefined ? decorated(cell("Key")) : undefined,
    command: null, // external records are not Grimoire commands (12 §3)
    name: null,
    tool: cell("Tool") !== undefined ? md(cell("Tool")) : undefined,
    context: cell("Context (source)") !== undefined ? md(cell("Context (source)")) : undefined,
    classification: cell("Contract classification") !== undefined ? md(cell("Contract classification")) : undefined,
    mode: null, // no mode routing for external records (12 §3)
    adapter: cell("Adapter") !== undefined ? decorated(cell("Adapter")) : undefined,
    source_raw: cell("Source") !== undefined ? md(cell("Source")) : undefined,
    trigger: null,
    activation_status: cell("Activation status") !== undefined ? md(cell("Activation status")) : undefined,
    validation_status: cell("Validation status") !== undefined ? md(cell("Validation status")) : undefined,
    violations: [],
    citations: [],
  };
  if (cells.length !== EXPECTED_HEADERS.external.length) {
    const v = violation("row_column_count", "record", {
      section, record: record.key ?? record.index ?? null,
      message: `row has ${cells.length} columns, expected ${EXPECTED_HEADERS.external.length}`,
    });
    violations.push(v);
    record.violations.push(v.code);
  }
  return record;
}

function validateRequiredFields(record, violations) {
  const rules = REQUIRED_PRESENT[record.section];
  for (const field of rules) {
    const value = record[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      const v = violation("missing_field", "record", {
        section: record.section, record: record.key ?? record.index, field,
        message: `required field ${field} missing or empty`,
      });
      violations.push(v);
      record.violations.push(v.code);
    }
  }
  for (const field of REQUIRED_NONEMPTY[record.section]) {
    const value = record[field];
    if (value === "—") {
      const v = violation("missing_field", "record", {
        section: record.section, record: record.key ?? record.index, field,
        message: `field ${field} must carry a real value, found placeholder`,
      });
      violations.push(v);
      record.violations.push(v.code);
    }
  }
}

function validateStatuses(record, violations) {
  const { activation_status: act, validation_status: val } = record;
  if (act !== undefined && !ACTIVATION_STATUSES.includes(act)) {
    const v = violation("invalid_activation_status", "record", {
      section: record.section, record: record.key, field: "activation_status",
      message: `activation status ${JSON.stringify(act)} is not one of the seven (12 §1.2)`,
    });
    violations.push(v);
    record.violations.push(v.code);
  }
  if (val !== undefined && !VALIDATION_STATUSES.includes(val)) {
    const v = violation("invalid_validation_status", "record", {
      section: record.section, record: record.key, field: "validation_status",
      message: `validation status ${JSON.stringify(val)} is not one of the five (12 §1.3)`,
    });
    violations.push(v);
    record.violations.push(v.code);
  }
  // Pairing only meaningful when both values are known enums.
  if (ACTIVATION_STATUSES.includes(act) && VALIDATION_STATUSES.includes(val)) {
    const expected = STATUS_TO_VALIDATION[act];
    if (val !== expected) {
      const v = violation("status_validation_mismatch", "record", {
        section: record.section, record: record.key, field: "validation_status",
        message: `activation ${act} requires validation status ${expected}, found ${val}`,
      });
      violations.push(v);
      record.violations.push(v.code);
    }
  }
}

function validateMode(record, violations) {
  if (record.mode === undefined) return;
  const inNine = NINE_MODES.includes(record.mode);
  const exempt = record.mode === "—" || /^N\/A\b/.test(record.mode) || /^UNKNOWN\b/.test(record.mode);
  if (inNine) return;
  if (record.activation_status === "ACTIVE" && !inNine) {
    const v = violation("invalid_mode", "record", {
      section: record.section, record: record.key, field: "mode",
      message: `ACTIVE record mode ${JSON.stringify(record.mode)} is not one of the nine Core modes (04 §2)`,
    });
    violations.push(v);
    record.violations.push(v.code);
    return;
  }
  if (!exempt) {
    const v = violation("invalid_mode", "record", {
      section: record.section, record: record.key, field: "mode",
      message: `mode ${JSON.stringify(record.mode)} is neither a Core mode (04 §2) nor a documented exemption`,
    });
    violations.push(v);
    record.violations.push(v.code);
  }
}

function extractCitations(sourceRaw, recordKey, violations, section) {
  // Returns [{ file, lines: [n,...], raw }] for every file:line citation in the
  // Source cell. Bare ":NN" continuations inherit the last file seen in the cell.
  const citations = [];
  if (sourceRaw === undefined) return citations;
  const text = String(sourceRaw);
  const addViolation = (code, message) => {
    violations.push(violation(code, "record", {
      section, record: recordKey, field: "source", message,
    }));
  };
  const tokens = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  // Also catch un-backticked citations (none exist today; harmless + stricter):
  // blank out backticked spans, then scan what remains.
  const outside = text.replace(/`[^`]+`/g, (m) => " ".repeat(m.length));
  for (const m of outside.matchAll(/([A-Za-z0-9_.-]+\.md|grimoire):([0-9][0-9,]*(?:\s*[–—-]\s*[0-9]+)?)/g)) {
    tokens.push(`${m[1]}:${m[2]}`);
  }
  let lastFile = null;
  for (const value of tokens) {
    const fileMatch = value.match(/^([A-Za-z0-9_.-]+\.md|grimoire):(.+)$/);
    const bareMatch = value.match(BARE_LINE_RE);
    if (fileMatch) {
      lastFile = fileMatch[1];
      const nums = parseListSpec(fileMatch[2]);
      if (nums === null) {
        addViolation("source_ref_malformed", `citation ${JSON.stringify(value)} is malformed`);
        continue;
      }
      citations.push({ file: lastFile, lines: nums, raw: value });
    } else if (bareMatch) {
      if (!lastFile) {
        addViolation("source_ref_malformed", `bare line citation ${JSON.stringify(value)} has no file in the cell`);
        continue;
      }
      const nums = parseListSpec(bareMatch[1]);
      if (nums === null) {
        addViolation("source_ref_malformed", `citation ${JSON.stringify(value)} is malformed`);
        continue;
      }
      citations.push({ file: lastFile, lines: nums, raw: value });
    }
    // Non-citation backticked tokens (e.g. `08` §4) are ignored.
  }
  return citations;
}

function contentLineCount(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function validateSourceRefs(record, violations, root, lineCache) {
  const capture = [];
  const parsed = extractCitations(record.source_raw, record.key, capture, record.section);
  record.citations = parsed.map((c) => `${c.file}:${c.lines.join(",")}`);
  for (const v of capture) {
    violations.push(v);
    record.violations.push(v.code);
  }
  if (parsed.length === 0 && record.source_raw !== undefined) {
    const v = violation("source_ref_missing", "record", {
      section: record.section, record: record.key, field: "source",
      message: "record carries no valid source citation (12 §6 traceability)",
    });
    violations.push(v);
    record.violations.push(v.code);
    return;
  }
  for (const citation of parsed) {
    const filePath = path.join(root, citation.file);
    if (!fs.existsSync(filePath)) {
      const v = violation("source_ref_missing_file", "record", {
        section: record.section, record: record.key, field: "source",
        message: `cited file ${citation.file} does not exist in the working tree`,
      });
      violations.push(v);
      record.violations.push(v.code);
      continue;
    }
    if (!lineCache.has(citation.file)) {
      lineCache.set(citation.file, contentLineCount(filePath));
    }
    const lines = lineCache.get(citation.file);
    for (const n of citation.lines) {
      if (n > lines.length) {
        const v = violation("source_ref_out_of_range", "record", {
          section: record.section, record: record.key, field: "source",
          message: `citation ${citation.raw} points past end of ${citation.file} (${lines.length} lines)`,
        });
        violations.push(v);
        record.violations.push(v.code);
        continue;
      }
      if (String(lines[n - 1]).trim() === "") {
        const v = violation("source_ref_blank_line", "record", {
          section: record.section, record: record.key, field: "source",
          message: `citation ${citation.raw} points at blank line ${n}`,
        });
        violations.push(v);
        record.violations.push(v.code);
      }
    }
  }
}

function parseAdapters(parsed, violations) {
  const adapters = new Map(); // id -> { id, key, mode, activation_status, references: [] }
  const rows = parsed.tables.adapter.rows;
  rows.forEach((row, i) => {
    const cells = row.cells;
    if (cells.length !== EXPECTED_HEADERS.adapter.length) {
      violations.push(violation("row_column_count", "record", {
        section: "adapter", record: decorated(cells[0] ?? ""),
        message: `adapter row has ${cells.length} columns, expected ${EXPECTED_HEADERS.adapter.length}`,
      }));
      return;
    }
    const id = decorated(cells[0]);
    const keyToken = String(cells[1]).match(/`([^`]+)`/);
    const key = keyToken ? keyToken[1] : null;
    const mode = md(cells[2]);
    const activationStatus = md(cells[7]);
    if (!ADAPTER_ID_RE.test(id)) {
      violations.push(violation("adapter_malformed_id", "registry", {
        section: "adapter", record: id, field: "adapter_id",
        message: `adapter id ${JSON.stringify(id)} is malformed`,
      }));
      return;
    }
    if (!NINE_MODES.includes(mode)) {
      violations.push(violation("invalid_mode", "registry", {
        section: "adapter", record: id, field: "mode",
        message: `adapter mode ${JSON.stringify(mode)} is not a Core mode (04 §2)`,
      }));
    }
    if (activationStatus !== KNOWN_ADAPTER_STATUS) {
      const code = /^ACTIVE/.test(activationStatus) ? "adapter_falsely_active" : "adapter_status_unknown";
      violations.push(violation(code, "registry", {
        section: "adapter", record: id, field: "activation_status",
        message: `adapter status ${JSON.stringify(activationStatus)} ${code === "adapter_falsely_active" ? "falsely marks the adapter active" : "is not a known adapter status"} (12 §4: ${KNOWN_ADAPTER_STATUS})`,
      }));
    }
    if (adapters.has(id)) {
      violations.push(violation("adapter_duplicate_declaration", "registry", {
        section: "adapter", record: id, field: "adapter_id",
        message: `adapter id ${id} declared more than once`,
      }));
      return;
    }
    adapters.set(id, {
      id, key, mode, activation_status: activationStatus, row: i, references: [],
    });
  });
  return adapters;
}

function validateAdapterReferences(record, violations, adapters) {
  const hasRef = record.adapter !== undefined && record.adapter !== null && record.adapter !== "" && record.adapter !== "—";
  const isRequired = record.activation_status === "ADAPTER_REQUIRED";
  if (isRequired && !hasRef) {
    const v = violation("adapter_ref_missing", "record", {
      section: record.section, record: record.key, field: "adapter",
      message: "ADAPTER_REQUIRED record carries no adapter reference — fail closed (12 §6)",
    });
    violations.push(v);
    record.violations.push(v.code);
    return;
  }
  if (!isRequired && hasRef) {
    const v = violation("adapter_ref_inconsistent", "record", {
      section: record.section, record: record.key, field: "adapter",
      message: `record with status ${record.activation_status} must not reference an adapter (12 §4 bijection)`,
    });
    violations.push(v);
    record.violations.push(v.code);
    return;
  }
  if (!hasRef) return;
  if (!ADAPTER_ID_RE.test(record.adapter)) {
    const v = violation("adapter_malformed_ref", "record", {
      section: record.section, record: record.key, field: "adapter",
      message: `adapter reference ${JSON.stringify(record.adapter)} is malformed`,
    });
    violations.push(v);
    record.violations.push(v.code);
    return;
  }
  const declaration = adapters.get(record.adapter);
  if (!declaration) {
    const v = violation("adapter_undeclared", "record", {
      section: record.section, record: record.key, field: "adapter",
      message: `adapter ${record.adapter} has no declaration in 12 §4`,
    });
    violations.push(v);
    record.violations.push(v.code);
    return;
  }
  declaration.references.push(record.key);
  if (declaration.key !== null && declaration.key !== record.key) {
    const v = violation("adapter_key_mismatch", "record", {
      section: record.section, record: record.key, field: "adapter",
      message: `adapter ${record.adapter} is declared for key ${declaration.key}, referenced by ${record.key}`,
    });
    violations.push(v);
    record.violations.push(v.code);
  }
}

function validateSummary(parsed, records, violations) {
  const rows = parsed.tables.summary.rows;
  if (rows.length !== 8) {
    violations.push(violation("summary_row_count", "registry", {
      section: "summary",
      message: `summary table has ${rows.length} rows, expected 8 (7 statuses + total)`,
    }));
    return;
  }
  const declared = new Map();
  let total = null;
  for (const row of rows) {
    if (row.cells.length !== 3) {
      violations.push(violation("row_column_count", "registry", {
        section: "summary", message: `summary row has ${row.cells.length} columns, expected 3`,
      }));
      continue;
    }
    const name = decorated(row.cells[0]);
    const count = Number(md(row.cells[1]));
    if (name === "Total records") { total = count; continue; }
    if (declared.has(name)) {
      violations.push(violation("summary_duplicate_status", "registry", {
        section: "summary", record: name, message: `status ${name} appears twice in the summary`,
      }));
      continue;
    }
    declared.set(name, count);
  }
  for (const status of ACTIVATION_STATUSES) {
    if (!declared.has(status)) {
      violations.push(violation("summary_missing_status", "registry", {
        section: "summary", record: status, message: `status ${status} missing from summary (12 §1.2)`,
      }));
    }
  }
  for (const [status] of declared) {
    if (!ACTIVATION_STATUSES.includes(status)) {
      violations.push(violation("summary_unknown_status", "registry", {
        section: "summary", record: status, message: `summary lists unknown status ${JSON.stringify(status)}`,
      }));
    }
  }
  const actual = new Map(ACTIVATION_STATUSES.map((s) => [s, 0]));
  for (const record of records) {
    if (actual.has(record.activation_status)) actual.set(record.activation_status, actual.get(record.activation_status) + 1);
  }
  for (const status of ACTIVATION_STATUSES) {
    const want = declared.has(status) ? declared.get(status) : null;
    const got = actual.get(status);
    if (want !== null && want !== got) {
      violations.push(violation("summary_status_count_mismatch", "registry", {
        section: "summary", record: status, message: `summary declares ${status}=${want}, registry holds ${got}`,
      }));
    }
  }
  if (total !== null && total !== records.length) {
    violations.push(violation("summary_total_mismatch", "registry", {
      section: "summary",
      message: `summary declares total=${total}, registry holds ${records.length}`,
    }));
  }
}

// ---------------------------------------------------------------------------
// Public: full validation (duties 1–10)
// ---------------------------------------------------------------------------
/**
 * @param {string} text registry file contents
 * @param {{ root: string }} options repo root used to resolve source citations
 * @returns structured validation result (duty 10)
 */
export function validateRegistryText(text, { root }) {
  const violations = [];
  const parsed = parseRegistry(text);
  violations.push(...parsed.violations);

  const records = [];
  parsed.tables.grimoire.rows.forEach((row, i) => {
    records.push(buildGrimoireRecord(row.cells, i, violations));
  });
  parsed.tables.external.rows.forEach((row, i) => {
    records.push(buildExternalRecord(row.cells, i, violations));
  });

  const adapters = parseAdapters(parsed, violations);

  // Declared-vs-actual counts (structure duty).
  const grimoireCount = records.filter((r) => r.section === "grimoire").length;
  const externalCount = records.filter((r) => r.section === "external").length;
  if (parsed.declared.grimoire !== null && parsed.declared.grimoire !== grimoireCount) {
    violations.push(violation("section_declared_count_mismatch", "registry", {
      section: "grimoire",
      message: `section declares ${parsed.declared.grimoire} records, table holds ${grimoireCount}`,
    }));
  }
  if (parsed.declared.external !== null && parsed.declared.external !== externalCount) {
    violations.push(violation("section_declared_count_mismatch", "registry", {
      section: "external",
      message: `section declares ${parsed.declared.external} records, table holds ${externalCount}`,
    }));
  }
  if (parsed.declared.adapter !== null && parsed.declared.adapter !== adapters.size) {
    violations.push(violation("section_declared_count_mismatch", "registry", {
      section: "adapter",
      message: `section declares ${parsed.declared.adapter} adapters, table holds ${adapters.size}`,
    }));
  }

  const lineCache = new Map();
  for (const record of records) {
    validateRequiredFields(record, violations);
    validateStatuses(record, violations);
    validateMode(record, violations);
    validateAdapterReferences(record, violations, adapters);
    validateSourceRefs(record, violations, root, lineCache);
  }

  // Bijection: every §4 declaration must be referenced by exactly one record.
  for (const adapter of adapters.values()) {
    if (adapter.references.length === 0) {
      violations.push(violation("adapter_orphan_declaration", "registry", {
        section: "adapter", record: adapter.id, field: "adapter_id",
        message: `adapter ${adapter.id} is declared but referenced by no record (12 §4 bijection)`,
      }));
    } else if (adapter.references.length > 1) {
      violations.push(violation("adapter_duplicate_reference", "registry", {
        section: "adapter", record: adapter.id, field: "adapter_id",
        message: `adapter ${adapter.id} is referenced by ${adapter.references.length} records`,
      }));
    }
  }

  // Duplicate identities (duty 7): command ids must be unique (H3).
  const duplicateCommands = [];
  const byCommand = new Map();
  for (const record of records) {
    if (record.command === undefined || record.command === null || record.command === "" || record.command === "—") continue;
    if (!byCommand.has(record.command)) byCommand.set(record.command, []);
    byCommand.get(record.command).push(record);
  }
  for (const [command, group] of [...byCommand.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (group.length > 1) {
      duplicateCommands.push({ value: command, records: group.map((r) => r.key) });
      for (const record of group) {
        const v = violation("duplicate_identity", "record", {
          section: record.section, record: record.key, field: "command",
          message: `command id ${command} used by ${group.length} records (H3)`,
        });
        violations.push(v);
        record.violations.push(v.code);
      }
    }
  }

  // Duplicate active keys (duty 8): two ACTIVE records sharing a key (HKC-10).
  const duplicateActiveKeys = [];
  const byKey = new Map();
  for (const record of records) {
    if (record.activation_status !== "ACTIVE") continue;
    if (record.key === undefined || record.key === null || record.key === "") continue;
    if (!byKey.has(record.key)) byKey.set(record.key, []);
    byKey.get(record.key).push(record);
  }
  for (const [key, group] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (group.length > 1) {
      duplicateActiveKeys.push({ value: key, records: group.map((r) => r.key) });
      for (const record of group) {
        const v = violation("duplicate_active_key", "record", {
          section: record.section, record: record.key, field: "key",
          message: `ACTIVE key ${key} used by ${group.length} records`,
        });
        violations.push(v);
        record.violations.push(v.code);
      }
    }
  }

  validateSummary(parsed, records, violations);

  // Bucket split for the report (directive: schema vs source-ref vs duplicates).
  const schemaViolations = violations.filter((v) => !v.code.startsWith("source_ref_") && !["duplicate_identity", "duplicate_active_key"].includes(v.code));
  const sourceRefViolations = violations.filter((v) => v.code.startsWith("source_ref_"));
  const duplicateViolations = violations.filter((v) => ["duplicate_identity", "duplicate_active_key"].includes(v.code));

  const counts = {
    loaded: records.length,
    accepted: records.filter((r) => r.violations.length === 0).length,
    rejected: records.filter((r) => r.violations.length > 0).length,
  };

  // Rejection reasons: every violation grouped by code, first-encounter order.
  const rejectionReasons = [];
  const reasonIndex = new Map();
  for (const v of violations) {
    if (!reasonIndex.has(v.code)) {
      const entry = { code: v.code, scope: v.scope, count: 0, records: [] };
      reasonIndex.set(v.code, entry);
      rejectionReasons.push(entry);
    }
    const entry = reasonIndex.get(v.code);
    entry.count += 1;
    if (v.record && !entry.records.includes(v.record)) entry.records.push(v.record);
  }

  return {
    ok: violations.length === 0,
    meta: parsed.meta,
    records,
    adapters,
    counts,
    violations,
    schema_violations: schemaViolations,
    source_reference_violations: sourceRefViolations,
    duplicate_detection: { duplicate_commands: duplicateCommands, duplicate_active_keys: duplicateActiveKeys },
    duplicate_violations: duplicateViolations,
    rejection_reasons: rejectionReasons,
    citations_checked: records.reduce((sum, r) => sum + (r.citations ? r.citations.length : 0), 0),
  };
}
