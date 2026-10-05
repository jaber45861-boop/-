// Grimoire v3 — Module Registry (Core Service implementation, Task 08).
//
// Position (02 §1/§3): L1 Core Service — the "Module Registry · Contract
// Validator" line of the layer diagram. Dependency direction is strictly
// downward: consumers may use this service; this service never imports a
// module, never touches Core files, never reads the L3 hotkey registry, and
// never executes module code (M6: manifests are static data).
//
// Contract (03 §3 lifecycle — REGISTER → VALIDATE → ENABLE → INVOKE → REPORT):
//   register(manifestText)      accept a manifest submission (fail-closed)
//   validate(id)                full VALIDATE duties -> {ok, code, violations}
//   validateAll()               every registered module, registration order
//   enable(id)                  expose provides; only when clean + no conflict
//   disable(id)                 remove capability exposure
//   canInvoke(id, {phase, tools})  INVOKE gate (03 §3 L2): declared phases
//                               and tools only, checked before anything runs
//   resolveCapability(id)       registry-mediated contact (02 §3 rule 3)
//   has(id) / isEnabled(id)     exact membership (no fuzzy lookup)
//   describe(id) / list()       descriptors with live violations
//
// VALIDATE checks exactly the four duties of 03 §3 — schema (§2 M1–M6),
// core version range (01 §13.6), conflicts (01 §13.5), tool availability
// (03 §3; resolved through the Task 07 Tool Bus `check` contract when wired,
// else the legacy available-tools list — same duck-typed integration the
// hotkeys runtime uses). No other gate is invented.
//
// Fail-closed refusals: an incomplete manifest, a dirty validation, a
// conflict with an enabled module, an unmet tool, an invocation outside the
// declared phases/tools — each returns {ok:false, code, error:{class, code,
// message, detail}} with named violations where applicable. Never a silent
// fall-through, never a substitute module, never a side effect (no module is
// ever "run" by the registry — it gates, it does not execute).
//
// Determinism: no timestamps, no random/process ids, no machine paths, no
// environment-dependent ordering (registration order for list(), report rows
// sorted localeCompare("en")); identical manifests + tool state => identical
// results and byte-identical reports.
//
// Error vocabulary: Core classes only (01 §11.1) via ./errors.mjs. Codes and
// their classes are documented in docs/v3/16-module-registry.md §Failure
// semantics.

import { createHash } from "node:crypto";
import { makeError, CORE_ERROR_CLASSES } from "./errors.mjs";
import { parseManifest, validateManifest, validationError } from "./manifest.mjs";

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every Module Registry result code and its Core error class
 * (01 §11.1). `null` = success.
 */
export const RESULT_CODES = Object.freeze({
  MR_OK: null,
  MANIFEST_INVALID: "E-VALID",
  MODULE_DUPLICATE: "E-CONFLICT",
  MODULE_NOT_FOUND: "E-INPUT",
  INVALID_INVOCATION: "E-INPUT",
  CONFLICT_MODULE_ENABLED: "E-CONFLICT",
  MODULE_ALREADY_ENABLED: "E-CONFLICT",
  MODULE_NOT_ENABLED: "E-ENV",
  PHASE_NOT_DECLARED: "E-CONFLICT",
  TOOL_UNDECLARED: "E-CONFLICT",
  TOOL_UNAVAILABLE: "E-TOOL",
  CAPABILITY_UNRESOLVED: "E-ENV",
  CAPABILITY_AMBIGUOUS: "E-CONFLICT",
});

const RESULT_MESSAGE = Object.freeze({
  MANIFEST_INVALID: "module manifest failed validation",
  MODULE_DUPLICATE: "module id is already registered",
  MODULE_NOT_FOUND: "module is not registered",
  INVALID_INVOCATION: "malformed registry invocation",
  CONFLICT_MODULE_ENABLED: "module conflicts with an enabled module",
  MODULE_ALREADY_ENABLED: "module is already enabled",
  MODULE_NOT_ENABLED: "module is not enabled",
  PHASE_NOT_DECLARED: "phase is not declared by the module",
  TOOL_UNDECLARED: "tool is not declared in requires.tools",
  TOOL_UNAVAILABLE: "declared tool is not available",
  CAPABILITY_UNRESOLVED: "no enabled module provides this capability",
  CAPABILITY_AMBIGUOUS: "more than one enabled module provides this capability",
});

function refusal(code, detail) {
  return {
    ok: false,
    code,
    error: makeError(RESULT_CODES[code], code, RESULT_MESSAGE[code], detail === undefined ? null : detail),
  };
}

function configError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  error.grimoire = makeError("E-INPUT", code, message, detail === undefined ? null : detail);
  return error;
}

/** Tools this repository's environment provides when no Tool Bus is wired
 *  (mirrors the hotkeys module's DEFAULT_AVAILABLE_TOOLS: the `files` tool
 *  declared by the module manifests and AVAILABLE on the Task 07 bus). */
export const DEFAULT_AVAILABLE_TOOLS = Object.freeze(["files"]);

/**
 * Create the Module Registry. Configuration errors throw at construction —
 * no registry exists, therefore nothing can be enabled or invoked (01 §13.5).
 *
 * `toolBus` (optional) must expose `check(capabilityId)` — the exact Task 07
 * contract; it is consulted bus-first for tool availability. `availableTools`
 * (optional) is the legacy fallback array used when no bus is wired.
 */
export function createModuleRegistry({ toolBus = null, availableTools = undefined } = {}) {
  if (toolBus !== null && toolBus !== undefined
      && (typeof toolBus !== "object" || typeof toolBus.check !== "function")) {
    throw configError("E_INPUT_INVALID_REGISTRY_CONFIG", "toolBus must expose check(capabilityId)");
  }
  let tools = DEFAULT_AVAILABLE_TOOLS;
  if (availableTools !== undefined) {
    if (!Array.isArray(availableTools)
        || availableTools.some((t) => typeof t !== "string" || t.trim() === "")) {
      throw configError("E_INPUT_INVALID_REGISTRY_CONFIG", "availableTools must be an array of non-empty strings");
    }
    tools = Object.freeze([...availableTools]);
  }

  const checkTool = (token) => {
    if (toolBus) return toolBus.check(token);
    return { ok: tools.includes(token), code: tools.includes(token) ? "MR_OK" : "TOOL_UNAVAILABLE" };
  };

  const records = new Map(); // id -> { id, text, manifest, parseViolations, enabled }
  const enabledRecords = (exceptId) =>
    [...records.values()].filter((r) => r.enabled && r.id !== exceptId);

  const validationContext = (id) => ({
    enabledIds: enabledRecords(id).map((r) => r.id),
    enabledConflictSources: enabledRecords(id)
      .filter((r) => Array.isArray(r.manifest.conflicts))
      .map((r) => ({ id: r.id, conflicts: r.manifest.conflicts })),
    toolCheck: checkTool,
  });

  const violationsOf = (record) => [
    ...record.parseViolations,
    ...validateManifest(record.manifest, validationContext(record.id)),
  ];

  const descriptorOf = (record) => ({
    id: record.id,
    version: record.manifest.version ?? null,
    core: record.manifest.core ?? null,
    name: record.manifest.name ?? null,
    purpose: record.manifest.purpose ?? null,
    phases: Array.isArray(record.manifest.phases) ? [...record.manifest.phases] : null,
    requires: isPlainObject(record.manifest.requires)
      ? { tools: Array.isArray(record.manifest.requires.tools) ? [...record.manifest.requires.tools] : null }
      : null,
    provides: Array.isArray(record.manifest.provides) ? [...record.manifest.provides] : null,
    consumes: Array.isArray(record.manifest.consumes) ? [...record.manifest.consumes] : null,
    conflicts: Array.isArray(record.manifest.conflicts) ? [...record.manifest.conflicts] : null,
    outputs: Array.isArray(record.manifest.outputs) ? [...record.manifest.outputs] : null,
    errors: Array.isArray(record.manifest.errors) ? [...record.manifest.errors] : null,
    entry: record.manifest.entry ?? null,
    enabled: record.enabled,
    violations: violationsOf(record),
  });

  const registry = Object.freeze({
    register(manifestText) {
      if (typeof manifestText !== "string") {
        return Object.freeze({ ...refusal("INVALID_INVOCATION", typeof manifestText), id: null, violations: [] });
      }
      const { manifest, violations } = parseManifest(manifestText);
      if (manifest === null || !isPlainObject(manifest)
          || typeof manifest.id !== "string" || manifest.id.trim() === "") {
        // Nothing to key the submission on — the document itself is invalid.
        return Object.freeze({
          ...refusal("MANIFEST_INVALID", "manifest must declare a usable id"),
          id: null,
          violations: Object.freeze(violations),
        });
      }
      const id = manifest.id;
      if (records.has(id)) {
        return Object.freeze({ ...refusal("MODULE_DUPLICATE", id), id, violations: [] });
      }
      records.set(id, { id, text: manifestText, manifest, parseViolations: violations, enabled: false });
      // Per 03 §3: REGISTER accepts the submission; VALIDATE (not REGISTER)
      // is where schema violations are named — nothing runs until clean.
      return Object.freeze({ ok: true, code: "MR_OK", error: null, id, violations: Object.freeze(violations) });
    },

    validate(id) {
      const record = typeof id === "string" ? records.get(id) : undefined;
      if (!record) {
        return Object.freeze({ ...refusal("MODULE_NOT_FOUND", typeof id === "string" ? id : String(id)), violations: [] });
      }
      const violations = violationsOf(record);
      if (violations.length > 0) {
        return Object.freeze({
          ok: false,
          code: "MANIFEST_INVALID",
          error: validationError(id, violations.length),
          violations: Object.freeze(violations),
        });
      }
      return Object.freeze({ ok: true, code: "MR_OK", error: null, violations: Object.freeze([]) });
    },

    validateAll() {
      const modules = [];
      let ok = true;
      for (const record of records.values()) {
        const result = registry.validate(record.id);
        if (!result.ok) ok = false;
        modules.push(Object.freeze({
          id: record.id,
          ok: result.ok,
          code: result.code,
          violations: result.violations,
        }));
      }
      return Object.freeze({ ok, modules: Object.freeze(modules) });
    },

    enable(id) {
      const record = typeof id === "string" ? records.get(id) : undefined;
      if (!record) {
        return Object.freeze({ ...refusal("MODULE_NOT_FOUND", typeof id === "string" ? id : String(id)), violations: [] });
      }
      if (record.enabled) {
        return Object.freeze({ ...refusal("MODULE_ALREADY_ENABLED", id), violations: [] });
      }
      // 01 §13.5: conflicts with an enabled module — named first so the
      // user is told the specific rule that failed, not a generic one.
      // Both directions (03 §2: "must not be simultaneously enabled").
      const conflicts = Array.isArray(record.manifest.conflicts) ? record.manifest.conflicts : [];
      for (const conflict of conflicts) {
        if (records.has(conflict) && records.get(conflict).enabled) {
          return Object.freeze({ ...refusal("CONFLICT_MODULE_ENABLED", `${id} conflicts with enabled ${conflict}`), violations: [] });
        }
      }
      for (const other of enabledRecords(id)) {
        if (Array.isArray(other.manifest.conflicts) && other.manifest.conflicts.includes(id)) {
          return Object.freeze({ ...refusal("CONFLICT_MODULE_ENABLED", `${id} conflicts with enabled ${other.id}`), violations: [] });
        }
      }
      const validation = registry.validate(id);
      if (!validation.ok) {
        return Object.freeze({ ...refusal("MANIFEST_INVALID", id), violations: validation.violations });
      }
      record.enabled = true;
      return Object.freeze({ ok: true, code: "MR_OK", error: null, violations: Object.freeze([]) });
    },

    disable(id) {
      const record = typeof id === "string" ? records.get(id) : undefined;
      if (!record) {
        return Object.freeze({ ...refusal("MODULE_NOT_FOUND", typeof id === "string" ? id : String(id)), violations: [] });
      }
      if (!record.enabled) {
        return Object.freeze({ ...refusal("MODULE_NOT_ENABLED", id), violations: [] });
      }
      record.enabled = false;
      return Object.freeze({ ok: true, code: "MR_OK", error: null, violations: Object.freeze([]) });
    },

    canInvoke(id, input) {
      if (!isPlainObject(input)) {
        return Object.freeze({ ...refusal("INVALID_INVOCATION", `input must be an object, got ${typeof input}`), violations: [] });
      }
      for (const key of Object.keys(input)) {
        if (key !== "phase" && key !== "tools") {
          return Object.freeze({ ...refusal("INVALID_INVOCATION", `unexpected field: ${key}`), violations: [] });
        }
      }
      const { phase, tools } = input;
      if (phase !== undefined && (typeof phase !== "string" || phase.trim() === "")) {
        return Object.freeze({ ...refusal("INVALID_INVOCATION", "phase must be a non-empty string"), violations: [] });
      }
      if (tools !== undefined
          && (!Array.isArray(tools) || tools.some((t) => typeof t !== "string" || t.trim() === ""))) {
        return Object.freeze({ ...refusal("INVALID_INVOCATION", "tools must be an array of non-empty strings"), violations: [] });
      }
      const record = typeof id === "string" ? records.get(id) : undefined;
      if (!record) {
        return Object.freeze({ ...refusal("MODULE_NOT_FOUND", typeof id === "string" ? id : String(id)), violations: [] });
      }
      // AC-19: an invalid manifest never reaches enable/invoke — refused
      // before any capability could be exposed or any work could start.
      const validation = registry.validate(id);
      if (!validation.ok) {
        return Object.freeze({ ...refusal("MANIFEST_INVALID", id), violations: validation.violations });
      }
      if (!record.enabled) {
        return Object.freeze({ ...refusal("MODULE_NOT_ENABLED", id), violations: [] });
      }
      if (phase !== undefined) {
        const declared = Array.isArray(record.manifest.phases) ? record.manifest.phases : [];
        if (!declared.includes(phase)) {
          return Object.freeze({ ...refusal("PHASE_NOT_DECLARED", `${phase} not in [${declared.join(", ")}]`), violations: [] });
        }
      }
      const declaredTools = isPlainObject(record.manifest.requires) && Array.isArray(record.manifest.requires.tools)
        ? record.manifest.requires.tools
        : [];
      for (const tool of tools ?? []) {
        if (!declaredTools.includes(tool)) {
          return Object.freeze({ ...refusal("TOOL_UNDECLARED", `${tool} is not in requires.tools`), violations: [] });
        }
      }
      // Defense-in-depth belt (03 §3 L2): declared tools must be available
      // at invocation time too. Unreachable while tool state is consistent
      // with VALIDATE — same belt-and-suspenders pattern as the runtime's
      // defense-in-depth gate branches.
      for (const tool of declaredTools) {
        const result = checkTool(tool);
        if (!result.ok) {
          return Object.freeze({ ...refusal("TOOL_UNAVAILABLE", `${tool}: ${result.code}`), violations: [] });
        }
      }
      return Object.freeze({ ok: true, code: "MR_OK", error: null, violations: Object.freeze([]) });
    },

    resolveCapability(providesId) {
      if (typeof providesId !== "string" || providesId.trim() === "") {
        return Object.freeze({ ...refusal("INVALID_INVOCATION", typeof providesId), module: null, modules: [] });
      }
      const providers = [];
      for (const record of records.values()) {
        if (record.enabled && Array.isArray(record.manifest.provides)
            && record.manifest.provides.includes(providesId)) {
          providers.push(record.id);
        }
      }
      if (providers.length === 0) {
        return Object.freeze({ ...refusal("CAPABILITY_UNRESOLVED", providesId), module: null, modules: [] });
      }
      if (providers.length > 1) {
        // E-CONFLICT: never silently pick a side (01 §11.1).
        return Object.freeze({ ...refusal("CAPABILITY_AMBIGUOUS", providers.join(", ")), module: null, modules: Object.freeze(providers) });
      }
      return Object.freeze({ ok: true, code: "MR_OK", error: null, module: providers[0], modules: Object.freeze(providers) });
    },

    has(id) {
      return typeof id === "string" && records.has(id);
    },

    isEnabled(id) {
      return typeof id === "string" && records.get(id)?.enabled === true;
    },

    describe(id) {
      const record = typeof id === "string" ? records.get(id) : undefined;
      if (!record) {
        return Object.freeze({ ...refusal("MODULE_NOT_FOUND", typeof id === "string" ? id : String(id)), descriptor: null });
      }
      return Object.freeze({ ok: true, code: "MR_OK", error: null, descriptor: descriptorOf(record) });
    },

    list() {
      return [...records.values()].map(descriptorOf);
    },

    /** Tool availability through the wired checker (bus-first, then the
     *  legacy list) — the same source VALIDATE and canInvoke use. */
    checkTool(token) {
      if (typeof token !== "string" || token.trim() === "") {
        return { ok: false, code: "INVALID_INVOCATION" };
      }
      return checkTool(token);
    },
  });
  return registry;
}

// ---------------------------------------------------------------------------
// Deterministic Module Registry report (03 §3 REPORT-facing state, directive
// §REPORTING-style auditability: registered / valid / enabled / violations /
// capabilities / tool availability, without volatile data)
// ---------------------------------------------------------------------------

const sortedById = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
const orDash = (value) => (value === null || value === undefined || value === "" ? "—" : value);
const joinOrDash = (values) => (Array.isArray(values) && values.length > 0 ? values.join(", ") : "—");

/**
 * Build the Module Registry report. Returns { text, sha256 } — sha256 of its
 * own bytes; byte-identical across rebuilds of equal registry state.
 */
export function buildRegistryReport(registry) {
  const all = registry.list();
  const validation = registry.validateAll();
  const enabled = all.filter((m) => m.enabled);
  const violationCount = validation.modules.reduce((sum, m) => sum + m.violations.length, 0);

  const lines = [
    "# Grimoire v3 — Module Registry Report",
    "",
    "## 1. Summary",
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Registered | ${all.length} |`,
    `| Valid | ${validation.modules.filter((m) => m.ok).length} |`,
    `| Invalid | ${validation.modules.filter((m) => !m.ok).length} |`,
    `| Enabled | ${enabled.length} |`,
    `| Violations | ${violationCount} |`,
    "",
    "## 2. Modules",
    "",
    "| Id | Version | Core | Enabled | Phases | Tools | Provides | Consumes | Violations |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  if (all.length === 0) lines.push("| none | — | — | — | — | — | — | — | — |");
  for (const module of sortedById(all)) {
    const phases = joinOrDash(module.phases);
    const tools = joinOrDash(module.requires?.tools);
    const provides = joinOrDash(module.provides);
    const consumes = joinOrDash(module.consumes);
    lines.push(
      `| ${module.id} | ${orDash(module.version)} | ${orDash(module.core)} | ${module.enabled ? "yes" : "no"} | ${phases} | ${tools} | ${provides} | ${consumes} | ${module.violations.length} |`
    );
  }

  lines.push("", "## 3. Violations", "", "| Module | Code | Detail |", "|---|---|---|");
  const violationRows = [];
  for (const module of sortedById(all)) {
    for (const violation of module.violations) {
      violationRows.push({ id: module.id, code: violation.code, detail: String(violation.detail ?? "—") });
    }
  }
  if (violationRows.length === 0) lines.push("| none | — | — |");
  for (const row of violationRows) lines.push(`| ${row.id} | ${row.code} | ${row.detail} |`);

  lines.push("", "## 4. Capabilities", "", "| Capability | Enabled providers | State |", "|---|---|---|");
  const capabilityMap = new Map();
  for (const module of sortedById(all)) {
    for (const capability of module.provides ?? []) {
      if (!capabilityMap.has(capability)) capabilityMap.set(capability, []);
      if (module.enabled) capabilityMap.get(capability).push(module.id);
    }
  }
  if (capabilityMap.size === 0) lines.push("| none | — | — |");
  for (const capability of sortedById([...capabilityMap].map(([id, providers]) => ({ id, providers })))) {
    const state = capability.providers.length === 1
      ? "RESOLVED"
      : capability.providers.length > 1
        ? "AMBIGUOUS"
        : "UNRESOLVED";
    lines.push(`| ${capability.id} | ${capability.providers.join(", ") || "—"} | ${state} |`);
  }

  lines.push("", "## 5. Declared tools", "", "| Tool | Available | Modules |", "|---|---|---|");
  const toolMap = new Map();
  for (const module of sortedById(all)) {
    for (const tool of module.requires?.tools ?? []) {
      if (!toolMap.has(tool)) toolMap.set(tool, []);
      toolMap.get(tool).push(module.id);
    }
  }
  if (toolMap.size === 0) lines.push("| none | — | — |");
  for (const tool of sortedById([...toolMap].map(([id, modules]) => ({ id, modules })))) {
    const available = registry.checkTool(tool.id).ok;
    lines.push(`| ${tool.id} | ${available ? "yes" : "no"} | ${tool.modules.join(", ")} |`);
  }
  lines.push("");
  const text = lines.join("\n");
  return { text, sha256: sha256(text) };
}
