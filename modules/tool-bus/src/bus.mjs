// Grimoire v3 — Tool Bus (Core Service implementation, Task 07).
//
// Position (02 §1/§3): L1 Core Service between Core/Modules and the
// capabilities/adapters they use. Dependency direction is strictly downward:
// L2 modules (e.g. hotkeys) may consume this service; this service never
// imports a module, never touches Core files, and never reads the L3 registry.
//
// Contract (directive §Phase 2):
//   register(capability)      add a runtime capability (fail-closed)
//   registerProvider(p)       bind a provider implementation
//   validate(capability)      full registration check -> {ok, code, violations}
//   has(id)                   exact membership (false when declarations invalid)
//   resolve(id)               lookup + validated descriptor (no execution)
//   check(id)                 preflight: validation -> status -> dependencies
//   invoke(id, input)         check -> input validation -> provider -> output
//   describe(id)              full descriptor incl. provider binding state
//   list()                    all validated capabilities (declaration order)
//
// Capability statuses: AVAILABLE | UNAVAILABLE | BLOCKED | DISABLED — never
// collapsed (a missing tool ≠ a disabled tool ≠ a blocked tool).
//
// Fail-closed invocation refusals (directive): unknown, invalid declarations,
// unavailable, blocked, disabled, missing/unavailable dependency, invalid
// input, missing provider, provider failure — each a deterministic structured
// result {ok:false, code, error:{class, code, message, detail}}; never a
// silent fall-through, never an undeclared substitute.
//
// Determinism: no timestamps, no random/process ids, no machine paths;
// identical declarations + providers + input => byte-identical results and
// reports. Report rows are sorted with localeCompare("en") — the repository
// convention used by the hotkeys report.
//
// Error vocabulary: Core classes only (01 §11.1) via ./errors.mjs. Codes and
// their classes are documented in docs/v3/15-tool-bus.md §Failure semantics.

import { createHash } from "node:crypto";
import { CORE_ERROR_CLASSES, makeError, classifyProviderError } from "./errors.mjs";

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const CAPABILITY_STATUSES = Object.freeze(["AVAILABLE", "UNAVAILABLE", "BLOCKED", "DISABLED"]);
const INPUT_TYPES = Object.freeze(["object", "none"]);
const VALUE_TYPES = Object.freeze(["string", "number", "boolean", "object", "array"]);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * Every Tool Bus result code and its Core error class.
 * "classified" = the class is decided per 01 §11.1 by classifyProviderError.
 */
export const RESULT_CODES = Object.freeze({
  TB_OK: null,
  CAPABILITY_INVALID: "E-VALID",
  CAPABILITY_DUPLICATE: "E-CONFLICT",
  PROVIDER_DUPLICATE: "E-CONFLICT",
  TOOL_NOT_FOUND: "E-INPUT",
  TOOL_UNAVAILABLE: "E-TOOL",
  TOOL_BLOCKED: "E-CONFLICT",
  TOOL_DISABLED: "E-CONFLICT",
  DEPENDENCY_MISSING: "E-ENV",
  DEPENDENCY_BLOCKED: "E-CONFLICT",
  INPUT_INVALID: "E-INPUT",
  PROVIDER_MISSING: "E-ENV",
  PROVIDER_FAILURE: "classified",
});

const STATUS_REFUSALS = Object.freeze({
  UNAVAILABLE: { code: "TOOL_UNAVAILABLE", klass: "E-TOOL", message: "capability is declared UNAVAILABLE" },
  BLOCKED: { code: "TOOL_BLOCKED", klass: "E-CONFLICT", message: "capability is declared BLOCKED" },
  DISABLED: { code: "TOOL_DISABLED", klass: "E-CONFLICT", message: "capability is declared DISABLED" },
});

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refusal(code, detail) {
  const klass = RESULT_CODES[code] === "classified" ? "E-UNKNOWN" : RESULT_CODES[code];
  const message = code === "TB_OK" ? "ok" : RESULT_MESSAGE[code] || code;
  return { ok: false, code, error: makeError(klass, code, message, detail === undefined ? null : detail) };
}

const RESULT_MESSAGE = Object.freeze({
  CAPABILITY_INVALID: "capability declaration failed validation",
  CAPABILITY_DUPLICATE: "capability id is already registered",
  PROVIDER_DUPLICATE: "provider id is already registered",
  TOOL_NOT_FOUND: "capability is not registered",
  TOOL_UNAVAILABLE: "capability is declared UNAVAILABLE",
  TOOL_BLOCKED: "capability is declared BLOCKED",
  TOOL_DISABLED: "capability is declared DISABLED",
  DEPENDENCY_MISSING: "required dependency is not registered",
  DEPENDENCY_BLOCKED: "required dependency is not AVAILABLE",
  INPUT_INVALID: "input failed the capability schema",
  PROVIDER_MISSING: "provider is not registered for this capability",
  PROVIDER_FAILURE: "provider threw during execution",
});

// ---------------------------------------------------------------------------
// Capability schema validation (duty: CAPABILITY_INVALID with exact violations)
// ---------------------------------------------------------------------------

function validateCapabilityShape(candidate) {
  const violations = [];
  const v = (code, detail) => violations.push({ code, detail });
  if (!isPlainObject(candidate)) {
    v("capability_not_object", typeof candidate);
    return violations;
  }
  const { id, version, purpose, status, input, output, requires, provider, errors } = candidate;
  if (id === undefined) v("missing_id");
  else if (typeof id !== "string" || id.trim() === "") v("invalid_id", typeof id);
  if (version === undefined) v("missing_version");
  else if (typeof version !== "string" || !SEMVER_RE.test(version)) v("invalid_version", String(version));
  if (purpose === undefined) v("missing_purpose");
  else if (typeof purpose !== "string" || purpose.trim() === "") v("invalid_purpose", typeof purpose);
  if (!CAPABILITY_STATUSES.includes(status)) v("invalid_status", String(status));
  if (!isPlainObject(input) || !INPUT_TYPES.includes(input.type)) {
    v("invalid_input", JSON.stringify(input === undefined ? null : input));
  } else {
    if (!Array.isArray(input.required) || input.required.some((f) => typeof f !== "string" || f === "")) {
      v("invalid_input", "required must be an array of non-empty strings");
    }
    if (!isPlainObject(input.properties)
        || Object.values(input.properties).some((t) => !VALUE_TYPES.includes(t))) {
      v("invalid_input", "properties must map field names to value types");
    }
  }
  if (!isPlainObject(output)) v("invalid_output", typeof output);
  if (!Array.isArray(requires) || requires.some((r) => typeof r !== "string" || r.trim() === "")) {
    v("invalid_requires", JSON.stringify(requires === undefined ? null : requires));
  }
  if (provider !== null && (typeof provider !== "string" || provider.trim() === "")) {
    v("invalid_provider", typeof provider);
  }
  if (!Array.isArray(errors) || errors.length === 0) v("missing_errors", JSON.stringify(errors));
  else if (errors.some((e) => !CORE_ERROR_CLASSES.includes(e))) v("invalid_errors", JSON.stringify(errors));
  // An AVAILABLE capability must declare the provider that makes it so —
  // "available with no implementation" is a declaration contradiction.
  if (status === "AVAILABLE" && (provider === null || provider === undefined)) {
    v("available_requires_provider", String(id));
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Input validation (TB-12: rejected before any provider runs)
// ---------------------------------------------------------------------------

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (isPlainObject(value)) return "object";
  return typeof value;
}

function validateInput(schema, input) {
  const value = input === undefined ? {} : input;
  if (schema.type === "none") {
    if (isPlainObject(value) && Object.keys(value).length === 0) return { ok: true };
    return { ok: false, message: "capability accepts no input" };
  }
  if (!isPlainObject(value)) return { ok: false, message: "input must be a plain object" };
  for (const field of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      return { ok: false, message: `missing required field: ${field}` };
    }
  }
  for (const [field, fieldValue] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(schema.properties, field)) {
      return { ok: false, message: `unexpected field: ${field}` };
    }
    const want = schema.properties[field];
    if (typeOf(fieldValue) !== want) {
      return { ok: false, message: `field ${field} must be ${want}` };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Declaration document loading (modules/tool-bus/capabilities.json)
// ---------------------------------------------------------------------------

function parseDeclarations(text) {
  const violations = [];
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    violations.push({ code: "declaration_parse_error", detail: error && error.name ? String(error.name) : "SyntaxError" });
    return { parsed: null, violations };
  }
  if (!isPlainObject(parsed)) {
    violations.push({ code: "declaration_not_object", detail: typeof parsed });
    return { parsed: null, violations };
  }
  if (typeof parsed.version !== "string" || !SEMVER_RE.test(parsed.version)) {
    violations.push({ code: "declaration_invalid_version", detail: String(parsed.version) });
  }
  if (!Array.isArray(parsed.capabilities)) {
    violations.push({ code: "capabilities_not_array", detail: typeof parsed.capabilities });
    return { parsed: null, violations };
  }
  if (!Array.isArray(parsed.providers)) {
    violations.push({ code: "providers_not_array", detail: typeof parsed.providers });
    return { parsed: null, violations };
  }
  if (typeof parsed.declared !== "number" || !Number.isInteger(parsed.declared) || parsed.declared < 0) {
    violations.push({ code: "declared_invalid", detail: String(parsed.declared) });
  } else if (parsed.declared !== parsed.capabilities.length) {
    violations.push({
      code: "declared_count_mismatch",
      detail: `declared ${parsed.declared}, held ${parsed.capabilities.length}`,
    });
  }
  return { parsed, violations };
}

function providerDeclarationViolations(providers) {
  const violations = [];
  const seen = new Set();
  providers.forEach((provider, index) => {
    if (!isPlainObject(provider) || typeof provider.id !== "string" || provider.id.trim() === ""
        || typeof provider.purpose !== "string" || provider.purpose.trim() === "") {
      violations.push({ code: "provider_declaration_invalid", detail: `index ${index}` });
      return;
    }
    if (seen.has(provider.id)) {
      violations.push({ code: "provider_duplicate", detail: provider.id });
    }
    seen.add(provider.id);
  });
  return violations;
}

// ---------------------------------------------------------------------------
// The bus
// ---------------------------------------------------------------------------

function configError(message) {
  const error = new Error(message);
  error.code = "E_INPUT_INVALID_BUS_CONFIG";
  error.grimoire = makeError("E-INPUT", "E_INPUT_INVALID_BUS_CONFIG", message, null);
  return error;
}

/**
 * @param {{ declarationText: string, providers?: object, root?: string }} options
 *   `providers` maps provider id -> { id, invoke(input, ctx), purpose? }.
 *   A provider executes only if its id is ALSO declared in the capability
 *   declaration file (declaration AND implementation, both required).
 */
export function createToolBus({ declarationText, providers = {}, root = null } = {}) {
  if (typeof declarationText !== "string") {
    throw configError("declarationText must be a string");
  }
  if (!isPlainObject(providers)) {
    throw configError("providers must be a plain object keyed by provider id");
  }
  if (root !== null && (typeof root !== "string" || root.trim() === "")) {
    throw configError("root must be a non-empty string or null");
  }

  // Declarations + validation.
  const { parsed, violations: parseViolations } = parseDeclarations(declarationText);
  const violations = [...parseViolations];
  const capabilities = new Map(); // declaration order preserved
  const declaredProviders = new Map(); // JSON-declared provider identities
  if (parsed) {
    parsed.providers.forEach((provider) => {
      if (isPlainObject(provider) && typeof provider.id === "string" && provider.id.trim() !== "") {
        if (declaredProviders.has(provider.id)) {
          violations.push({ code: "provider_duplicate", detail: provider.id });
        } else {
          declaredProviders.set(provider.id, provider);
        }
      }
    });
    violations.push(...providerDeclarationViolations(parsed.providers));
    parsed.capabilities.forEach((capability) => {
      const shape = validateCapabilityShape(capability);
      violations.push(...shape.map((x) => ({
        ...x,
        detail: `${isPlainObject(capability) ? String(capability.id) : "?"}: ${x.detail}`,
      })));
      if (isPlainObject(capability) && typeof capability.id === "string" && capability.id.trim() !== "") {
        if (capabilities.has(capability.id)) {
          violations.push({ code: "capability_duplicate", detail: capability.id });
        } else {
          capabilities.set(capability.id, capability);
        }
      }
    });
  }
  const validation = Object.freeze({
    ok: violations.length === 0,
    violations: Object.freeze(violations),
    meta: Object.freeze({ sha256: sha256(declarationText), declared: parsed ? parsed.declared ?? null : null }),
  });

  // Provider registry = declared identities (JSON) ∩ bound implementations
  // (options.providers), extended by registerProvider (which declares+binds).
  const declaredProviderIds = new Set(declaredProviders.keys());
  const providerRegistry = new Map(); // id -> { id, invoke, purpose }
  for (const [id, bound] of Object.entries(providers)) {
    if (declaredProviderIds.has(id) && isPlainObject(bound) && typeof bound.invoke === "function") {
      providerRegistry.set(id, { id, invoke: bound.invoke, purpose: bound.purpose ?? declaredProviders.get(id).purpose });
    }
  }

  const lookup = (id) => {
    if (!validation.ok) return refusal("CAPABILITY_INVALID", "declarations failed validation");
    if (typeof id !== "string" || id.trim() === "" || !capabilities.has(id)) {
      return refusal("TOOL_NOT_FOUND", typeof id === "string" ? id : String(id));
    }
    return { ok: true, capability: capabilities.get(id) };
  };

  // Gate: availability + dependency checks — run before check/invoke only,
  // so resolve/describe/list can always show a capability's true state.
  const gate = (capability) => {
    const statusRefusal = STATUS_REFUSALS[capability.status];
    if (statusRefusal) {
      return { ok: false, code: statusRefusal.code, error: makeError(statusRefusal.klass, statusRefusal.code, statusRefusal.message, capability.id) };
    }
    for (const dep of capability.requires) {
      if (!capabilities.has(dep)) {
        return refusal("DEPENDENCY_MISSING", dep);
      }
      if (capabilities.get(dep).status !== "AVAILABLE") {
        return refusal("DEPENDENCY_BLOCKED", dep);
      }
    }
    return { ok: true, capability };
  };

  const preflight = (id) => {
    const found = lookup(id);
    if (!found.ok) return found;
    return gate(found.capability);
  };

  const descriptor = (capability) => ({
    id: capability.id,
    version: capability.version,
    purpose: capability.purpose,
    status: capability.status,
    input: capability.input,
    output: capability.output,
    requires: [...capability.requires],
    provider: capability.provider ?? null,
    providerRegistered: capability.provider !== null && capability.provider !== undefined
      && providerRegistry.has(capability.provider),
    errors: [...capability.errors],
    invoke: capability.provider ?? null,
  });

  const bus = Object.freeze({
    root,
    validation,
    register(candidate) {
      const shape = validateCapabilityShape(candidate);
      if (shape.length > 0) {
        const result = refusal("CAPABILITY_INVALID", shape.map((x) => `${x.code}: ${x.detail}`).join("; "));
        return Object.freeze({ ...result, violations: Object.freeze(shape) });
      }
      if (capabilities.has(candidate.id)) return refusal("CAPABILITY_DUPLICATE", candidate.id);
      capabilities.set(candidate.id, Object.freeze({ ...candidate, requires: [...candidate.requires] }));
      return Object.freeze({ ok: true, code: "TB_OK", error: null, capability: candidate.id });
    },
    registerProvider(provider) {
      if (!isPlainObject(provider) || typeof provider.id !== "string" || provider.id.trim() === ""
          || typeof provider.invoke !== "function") {
        return refusal("CAPABILITY_INVALID", "provider must be { id: string, invoke: function }");
      }
      if (providerRegistry.has(provider.id)) return refusal("PROVIDER_DUPLICATE", provider.id);
      declaredProviderIds.add(provider.id);
      providerRegistry.set(provider.id, {
        id: provider.id,
        invoke: provider.invoke,
        purpose: typeof provider.purpose === "string" ? provider.purpose : "",
      });
      return Object.freeze({ ok: true, code: "TB_OK", error: null, provider: provider.id });
    },
    validate(candidate) {
      const shape = validateCapabilityShape(candidate);
      let duplicate = false;
      if (shape.length === 0 && capabilities.has(candidate.id)) duplicate = true;
      return {
        ok: shape.length === 0 && !duplicate,
        code: shape.length > 0 ? "CAPABILITY_INVALID" : duplicate ? "CAPABILITY_DUPLICATE" : "TB_OK",
        violations: Object.freeze(shape),
      };
    },
    has(id) {
      return validation.ok && typeof id === "string" && capabilities.has(id);
    },
    resolve(id) {
      const found = lookup(id);
      if (!found.ok) return Object.freeze({ ok: false, code: found.code, error: found.error, resolution: null });
      return Object.freeze({ ok: true, code: "TB_OK", error: null, resolution: descriptor(found.capability) });
    },
    check(id) {
      const base = preflight(id);
      if (!base.ok) return Object.freeze({ ok: false, code: base.code, error: base.error, capability: typeof id === "string" ? id : null });
      return Object.freeze({ ok: true, code: "TB_OK", error: null, capability: base.capability.id });
    },
    describe(id) {
      const found = lookup(id);
      if (!found.ok) return Object.freeze({ ok: false, code: found.code, error: found.error, descriptor: null });
      return Object.freeze({ ok: true, code: "TB_OK", error: null, descriptor: descriptor(found.capability) });
    },
    list() {
      if (!validation.ok) return [];
      return [...capabilities.values()].map(descriptor);
    },
    listProviders() {
      const rows = new Map();
      for (const id of declaredProviderIds) {
        const declared = declaredProviders.get(id);
        rows.set(id, {
          id,
          purpose: declared && typeof declared.purpose === "string" ? declared.purpose : "",
          bound: providerRegistry.has(id),
        });
      }
      for (const [id, entry] of providerRegistry) {
        if (!rows.has(id)) rows.set(id, { id, purpose: entry.purpose ?? "", bound: true });
      }
      return sortedById([...rows.values()]);
    },
    invoke(id, input) {
      const base = preflight(id);
      if (!base.ok) {
        return Object.freeze({ ok: false, code: base.code, error: base.error, capability: typeof id === "string" ? id : null, provider: null, output: null });
      }
      const capability = base.capability;
      const inputCheck = validateInput(capability.input, input);
      if (!inputCheck.ok) {
        return Object.freeze({
          ...refusal("INPUT_INVALID", `${capability.id}: ${inputCheck.message}`),
          capability: capability.id,
          provider: null,
          output: null,
        });
      }
      const provider = capability.provider === null || capability.provider === undefined
        ? null
        : providerRegistry.get(capability.provider) ?? null;
      if (!provider) {
        return Object.freeze({
          ...refusal("PROVIDER_MISSING", capability.provider ?? capability.id),
          capability: capability.id,
          provider: capability.provider ?? null,
          output: null,
        });
      }
      let output;
      try {
        output = provider.invoke(input === undefined ? {} : input, { root, capability: capability.id });
      } catch (exception) {
        const classified = classifyProviderError(exception, capability.id);
        return Object.freeze({
          ok: false,
          code: "PROVIDER_FAILURE",
          error: classified,
          capability: capability.id,
          provider: provider.id,
          output: null,
        });
      }
      return Object.freeze({
        ok: true,
        code: "TB_OK",
        error: null,
        capability: capability.id,
        provider: provider.id,
        output,
      });
    },
  });
  return bus;
}

// ---------------------------------------------------------------------------
// Deterministic Tool Bus report (directive §REPORTING)
// ---------------------------------------------------------------------------

const sortedById = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

/**
 * Build the Tool Bus report. `hotkeyRows` (optional, computed by the L2
 * consumer — the bus never imports a module) answers question 8: which
 * hotkeys depend on unavailable capabilities.
 * Returns { text, sha256 } — byte-identical across rebuilds of equal state.
 */
export function buildToolBusReport(bus, hotkeyRows = []) {
  const lines = [
    "# Grimoire v3 — Tool Bus Report",
    "",
    "## 1. Summary",
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Declarations sha256 | ${bus.validation.meta.sha256} |`,
    `| Valid | ${bus.validation.ok} |`,
    `| Violations | ${bus.validation.violations.length} |`,
  ];
  const all = bus.list();
  const byStatus = { AVAILABLE: 0, UNAVAILABLE: 0, BLOCKED: 0, DISABLED: 0 };
  for (const capability of all) byStatus[capability.status] += 1;
  lines.push(`| Capabilities | ${all.length} |`);
  for (const status of CAPABILITY_STATUSES) lines.push(`| ${status} | ${byStatus[status]} |`);
  const declared = new Set(all.map((c) => c.provider).filter((p) => p !== null));
  const bound = all.filter((c) => c.providerRegistered).length;
  lines.push(`| Capabilities with registered provider | ${bound} |`);
  lines.push(`| Distinct declared providers | ${declared.size} |`);
  lines.push("", "## 2. Capabilities", "", "| Id | Version | Status | Provider | Provider registered | Requires |", "|---|---|---|---|---|---|");
  for (const capability of sortedById(all)) {
    lines.push(
      `| ${capability.id} | ${capability.version} | ${capability.status} | ${capability.provider ?? "—"} | ${capability.providerRegistered ? "yes" : "no"} | ${capability.requires.length ? capability.requires.join(", ") : "—"} |`
    );
  }
  if (all.length === 0) lines.push("| none | — | — | — | — | — |");
  lines.push("", "## 3. Providers", "", "| Id | Purpose | Bound |", "|---|---|---|");
  const providerRows = [];
  for (const capability of all) {
    if (capability.provider !== null) providerRows.push(capability.provider);
  }
  const referenced = [...new Set(providerRows)];
  const providerInfo = new Map(bus.listProviders().map((p) => [p.id, p]));
  const providerIds = sortedById([...new Set([...providerInfo.keys(), ...referenced])].map((id) => ({ id })));
  if (providerIds.length === 0) {
    lines.push("| none | — | — |");
  }
  for (const { id } of providerIds) {
    const info = providerInfo.get(id);
    const bound = info ? info.bound : false;
    const purpose = info && info.purpose ? info.purpose : "—";
    lines.push(`| ${id} | ${purpose} | ${bound ? "yes" : "no"} |`);
  }
  lines.push("", "## 4. Missing dependencies", "", "| Capability | Problem | Detail |", "|---|---|---|");
  const problems = [];
  for (const capability of sortedById(all)) {
    for (const dep of capability.requires) {
      if (!bus.has(dep)) problems.push({ id: capability.id, problem: "DEPENDENCY_MISSING", detail: dep });
      else {
        const resolved = bus.resolve(dep);
        if (resolved.ok && resolved.resolution.status !== "AVAILABLE") {
          problems.push({ id: capability.id, problem: "DEPENDENCY_BLOCKED", detail: `${dep} is ${resolved.resolution.status}` });
        }
      }
    }
    if (capability.status === "AVAILABLE" && !capability.providerRegistered) {
      problems.push({ id: capability.id, problem: "PROVIDER_MISSING", detail: capability.provider ?? "—" });
    }
  }
  if (problems.length === 0) lines.push("| none | — | — |");
  for (const problem of problems) lines.push(`| ${problem.id} | ${problem.problem} | ${problem.detail} |`);
  if (hotkeyRows.length > 0) {
    lines.push("", "## 5. Hotkey dependencies", "", "| Key | Command | Tools | Outcome |", "|---|---|---|---|");
    for (const row of hotkeyRows) {
      const tools = row.tools.map((t) => `${t.tool} (${t.code})`).join(", ");
      lines.push(`| ${row.key} | ${row.command} | ${tools || "—"} | ${row.outcome} |`);
    }
  }
  lines.push("");
  const text = lines.join("\n");
  return { text, sha256: sha256(text) };
}
