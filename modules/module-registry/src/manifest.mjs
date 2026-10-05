// Grimoire v3 — Module manifest parsing + validation (Task 08).
//
// Normative source: docs/v3/03-extension-contract.md §2 (field set + rules
// M1–M6) and §3 VALIDATE ("Check schema, version range, conflicts, tool
// availability"), plus 01 §13.5 (fail closed), 01 §13.6 (core version range)
// and 01 §3 (the eight loop phases). Nothing here invents a rule: every
// violation code names the contract rule it enforces.
//
// The parser is a strict YAML SUBSET — no external dependency (01 §4.11) —
// covering exactly what the manifest schema can express:
//   key: "scalar" | bare scalar | [] | ["a", "b"]
//   key:            (block)
//     - item
//   key:
//     subkey: [...] | scalar        (two levels, e.g. requires.tools)
// Anything outside that subset fails closed with `manifest_unsupported_syntax`
// rather than being guessed (M6: the manifest is static data; nothing is
// evaluated, nothing is repaired — 01 §13.5).

import { makeError } from "./errors.mjs";

/** 01 §3 — the eight loop phases, fixed order (M2: a subset, never new). */
export const EIGHT_LOOP_PHASES = Object.freeze([
  "UNDERSTAND", "PLAN", "BUILD", "RUN", "TEST", "DEBUG", "IMPROVE", "SHIP",
]);

/** 03 §2 — the normative field set, fixed order for deterministic reports. */
export const MANIFEST_FIELDS = Object.freeze([
  "id", "version", "core", "name", "purpose", "phases", "requires",
  "provides", "consumes", "conflicts", "outputs", "errors", "entry",
]);

/** 01 §11.1 — the seven Core error classes (M5 subset check). */
const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT", "E-ENV", "E-DEP", "E-CONFLICT", "E-TOOL", "E-VALID", "E-UNKNOWN",
]);

/** The running Core contract version (01: Grimoire v3 Core). */
export const CORE_CONTRACT_VERSION = Object.freeze({ major: 3, minor: 0 });

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/;
const CORE_RANGE_RE = /^>=(\d+)\.(\d+)(?:\.\d+)?\s+<(\d+)\.(\d+)(?:\.\d+)?$/;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripQuotes(raw) {
  const text = raw.trim();
  if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
    return text.slice(1, -1);
  }
  if (text.length >= 2 && text[0] === "'" && text[text.length - 1] === "'") {
    return text.slice(1, -1);
  }
  return text;
}

function versionLess(majorA, minorA, majorB, minorB) {
  if (majorA !== majorB) return majorA < majorB;
  return minorA < minorB;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a manifest document (strict YAML subset). Returns
 * `{ manifest, violations }`; `manifest` is null only when the document is
 * not a string. Violations are named (`manifest_unsupported_syntax`,
 * `unknown_field`, `duplicate_field`) and are carried into validation — the
 * parser never repairs, skips, or guesses a field.
 */
export function parseManifest(text) {
  const violations = [];
  const v = (code, detail) => violations.push({ code, detail });
  if (typeof text !== "string") {
    v("manifest_not_string", typeof text);
    return { manifest: null, violations };
  }

  const parseFlowArray = (raw, lineNo) => {
    if (!raw.endsWith("]")) {
      v("manifest_unsupported_syntax", `line ${lineNo}: unterminated flow sequence`);
      return [];
    }
    const inner = raw.slice(1, -1).trim();
    if (inner === "") return [];
    const items = [];
    let current = "";
    let quoted = null;
    for (const ch of inner) {
      if (quoted !== null) {
        current += ch;
        if (ch === quoted) quoted = null;
      } else if (ch === '"' || ch === "'") {
        quoted = ch;
        current += ch;
      } else if (ch === ",") {
        items.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    items.push(current.trim());
    const out = [];
    for (const item of items) {
      if (item === "" || item.includes("[") || item.includes("]")) {
        v("manifest_unsupported_syntax", `line ${lineNo}: malformed flow item`);
        continue;
      }
      out.push(stripQuotes(item));
    }
    return out;
  };

  const manifest = {};
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i += 1;
      continue;
    }
    if (/^\s/.test(line)) {
      v("manifest_unsupported_syntax", `line ${i + 1}: unexpected indentation`);
      i += 1;
      continue;
    }
    const match = line.match(KEY_RE);
    if (!match) {
      v("manifest_unsupported_syntax", `line ${i + 1}`);
      i += 1;
      continue;
    }
    const key = match[1];
    const rest = (match[2] ?? "").trim();
    if (Object.prototype.hasOwnProperty.call(manifest, key)) v("duplicate_field", key);
    if (!MANIFEST_FIELDS.includes(key)) v("unknown_field", key);

    if (rest === "") {
      // Block value: indented `- item` list or one-level nested mapping.
      i += 1;
      const items = [];
      const map = {};
      let mode = null;
      while (i < lines.length) {
        const line2 = lines[i];
        const trimmed2 = line2.trim();
        if (trimmed2 === "" || trimmed2.startsWith("#")) {
          i += 1;
          continue;
        }
        if (!/^\s/.test(line2)) break; // dedent ends the block
        const content = line2.replace(/^\s+/, "");
        if (content === "-" || content.startsWith("- ")) {
          if (mode === "map") {
            v("manifest_unsupported_syntax", `line ${i + 1}: mixed block value`);
            i += 1;
            continue;
          }
          mode = "array";
          items.push(stripQuotes(content === "-" ? "" : content.slice(2)));
          i += 1;
          continue;
        }
        const sub = content.match(KEY_RE);
        if (!sub) {
          v("manifest_unsupported_syntax", `line ${i + 1}`);
          i += 1;
          continue;
        }
        if (mode === "array") {
          v("manifest_unsupported_syntax", `line ${i + 1}: mixed block value`);
          i += 1;
          continue;
        }
        mode = "map";
        const subKey = sub[1];
        const subRest = (sub[2] ?? "").trim();
        if (subRest === "") {
          // Two-level block array (e.g. requires: → tools: → - item).
          i += 1;
          const subItems = [];
          while (i < lines.length) {
            const line3 = lines[i];
            const trimmed3 = line3.trim();
            if (trimmed3 === "" || trimmed3.startsWith("#")) {
              i += 1;
              continue;
            }
            if (!/^\s/.test(line3)) break;
            const content3 = line3.replace(/^\s+/, "");
            if (content3 === "-" || content3.startsWith("- ")) {
              subItems.push(stripQuotes(content3 === "-" ? "" : content3.slice(2)));
            } else {
              v("manifest_unsupported_syntax", `line ${i + 1}: deeper nesting than the schema allows`);
            }
            i += 1;
          }
          map[subKey] = subItems;
        } else if (subRest.startsWith("[")) {
          map[subKey] = parseFlowArray(subRest, i + 1);
          i += 1;
        } else {
          map[subKey] = stripQuotes(subRest);
          i += 1;
        }
      }
      manifest[key] = mode === "array" ? items : mode === "map" ? map : [];
      continue;
    }

    if (rest.startsWith("[")) {
      manifest[key] = parseFlowArray(rest, i + 1);
    } else {
      manifest[key] = stripQuotes(rest);
    }
    i += 1;
  }
  return { manifest, violations };
}

// ---------------------------------------------------------------------------
// Validation (03 §2 rules M1–M6, 03 §3 VALIDATE duties, 01 §13.5/§13.6)
// ---------------------------------------------------------------------------

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

function checkStringArray(manifest, field, violations) {
  const value = manifest[field];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    violations.push({ code: `invalid_${field}`, detail: typeof value });
    return;
  }
  for (const item of value) {
    if (!isNonEmptyString(item)) {
      violations.push({ code: `invalid_${field}`, detail: String(item) });
      return;
    }
  }
}

/**
 * Validate one parsed manifest. `context.enabledIds` feeds the conflicts
 * duty (excluding the module itself); `context.enabledConflictSources`
 * ({id, conflicts} of other enabled modules) enforces the symmetric reading
 * of 03 §2 — conflicts "must not be simultaneously enabled" holds in both
 * directions. `context.toolCheck(token) -> { ok, code }` feeds tool
 * availability (wired by the registry to the Tool Bus — Task 07 — or the
 * legacy tool list). Violations appear in deterministic order: schema fields
 * in MANIFEST_FIELDS order, then conflicts, then tool availability — the
 * exact duty order of 03 §3 ("schema, version range, conflicts, tool
 * availability").
 */
export function validateManifest(manifest, context = {}) {
  const enabledIds = context.enabledIds ?? [];
  const enabledConflictSources = context.enabledConflictSources ?? [];
  const toolCheck = context.toolCheck ?? null;
  const violations = [];
  const v = (code, detail) => violations.push({ code, detail });

  if (!isPlainObject(manifest)) {
    v("manifest_not_object", typeof manifest);
    return violations;
  }

  // --- Schema + version range (per field, MANIFEST_FIELDS order) ----------
  for (const field of MANIFEST_FIELDS) {
    if (manifest[field] === undefined) v(`missing_${field}`, field);
  }

  const { id, version, core, name, purpose, phases, requires, errors, entry } = manifest;

  if (id !== undefined) {
    if (!isNonEmptyString(id)) v("invalid_id", typeof id);
    else if (!KEBAB_RE.test(id)) v("invalid_id", id);
  }
  if (version !== undefined) {
    if (!isNonEmptyString(version)) v("invalid_version", typeof version);
    else if (!SEMVER_RE.test(version)) v("invalid_version", version);
  }
  if (core !== undefined) {
    if (!isNonEmptyString(core)) {
      v("invalid_core_range", typeof core);
    } else {
      const range = core.match(CORE_RANGE_RE);
      if (!range) {
        v("invalid_core_range", core);
      } else {
        const minMajor = Number(range[1]);
        const minMinor = Number(range[2]);
        const maxMajor = Number(range[3]);
        const maxMinor = Number(range[4]);
        const tooNew = versionLess(CORE_CONTRACT_VERSION.major, CORE_CONTRACT_VERSION.minor, minMajor, minMinor);
        const tooOld = !versionLess(CORE_CONTRACT_VERSION.major, CORE_CONTRACT_VERSION.minor, maxMajor, maxMinor);
        if (tooNew || tooOld) {
          v("core_version_mismatch", `range ${core} does not accept Core ${CORE_CONTRACT_VERSION.major}.${CORE_CONTRACT_VERSION.minor}`);
        }
      }
    }
  }
  if (name !== undefined && !isNonEmptyString(name)) v("invalid_name", typeof name);
  if (purpose !== undefined && !isNonEmptyString(purpose)) v("invalid_purpose", typeof purpose);
  if (entry !== undefined && !isNonEmptyString(entry)) v("invalid_entry", typeof entry);

  if (phases !== undefined) {
    if (!Array.isArray(phases)) {
      v("invalid_phases", typeof phases);
    } else if (phases.length === 0) {
      // 03 §1: a module participates in the execution loop — hooking no
      // phase means it cannot.
      v("invalid_phases", "at least one loop phase is required");
    } else {
      for (const phase of phases) {
        if (!EIGHT_LOOP_PHASES.includes(phase)) v("invalid_phase", String(phase));
      }
    }
  }

  if (requires !== undefined) {
    if (!isPlainObject(requires)) {
      v("invalid_requires", typeof requires);
    } else if (requires.tools === undefined) {
      v("invalid_requires", "requires.tools is required (03 §2)");
    } else if (!Array.isArray(requires.tools)) {
      v("invalid_tools", typeof requires.tools);
    } else {
      for (const tool of requires.tools) {
        if (!isNonEmptyString(tool)) {
          v("invalid_tools", String(tool));
          break;
        }
      }
    }
  }

  checkStringArray(manifest, "provides", violations);
  checkStringArray(manifest, "consumes", violations);
  checkStringArray(manifest, "conflicts", violations);
  checkStringArray(manifest, "outputs", violations);

  if (errors !== undefined) {
    if (!Array.isArray(errors)) {
      v("invalid_errors", typeof errors);
    } else {
      for (const klass of errors) {
        if (!CORE_ERROR_CLASSES.includes(klass)) v("invalid_error_class", String(klass));
      }
    }
  }

  // --- Conflicts duty (03 §3): against modules currently enabled ----------
  // Both directions: 03 §2 defines conflicts as ids that "must not be
  // simultaneously enabled" — the rule does not depend on which of the two
  // manifests lists the other.
  if (Array.isArray(manifest.conflicts) && isNonEmptyString(id)) {
    for (const conflict of manifest.conflicts) {
      if (typeof conflict === "string" && enabledIds.includes(conflict)) {
        v("conflict_enabled", conflict);
      }
    }
  }
  if (isNonEmptyString(id)) {
    for (const source of enabledConflictSources) {
      if (Array.isArray(source.conflicts) && source.conflicts.includes(id)) {
        v("conflict_enabled", source.id);
      }
    }
  }

  // --- Tool availability duty (03 §3) via the injected checker ------------
  if (toolCheck !== null && isPlainObject(requires) && Array.isArray(requires.tools)) {
    for (const tool of requires.tools) {
      if (!isNonEmptyString(tool)) continue;
      const result = toolCheck(tool);
      if (!result.ok) {
        v("tool_unavailable", `${tool}: ${result.code}`);
      }
    }
  }

  return violations;
}

/** Structured E-VALID error for a failed validation (shared by registry). */
export function validationError(id, count) {
  return makeError("E-VALID", "MANIFEST_INVALID", "module manifest failed validation", `${id} (${count} violation${count === 1 ? "" : "s"})`);
}
