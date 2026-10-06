// Grimoire v3 — Real Scenario Test Harness (Task 17).
//
// Position: a thin HARNESS layer ON TOP OF the Task 16 Local Runtime and the
// contracts it already consumes. It is DEFINE → RUN → OBSERVE → ASSERT →
// REPORT and nothing else:
//
//   scenario JSON
//     → validate
//     → setup (isolated workspace materialized from committed fixtures)
//     → runLocalRuntime(bundle, {planner, agent, reportBus, approval})  ← Task 16
//          → real Planner → real GATE (composition) → real Agent
//            → real Module Registry / Tool Bus / Hotkey Runtime
//            → real Report Bus (planner + agent + composer)
//     → observe (result, metrics, execution evidence, report, workspace)
//     → assert (scenario-declared expectations)
//     → cleanup (workspace restored; fixtures never touched)
//
// What the harness deliberately does NOT do (directive §4):
//   it never plans a task, never approves its own plan, never invokes a tool
//   or handler outside the Agent, never edits an Agent result, and never
//   turns a failure into a pass. Every dependency it supplies is either a
//   counting probe around a real contract or an explicitly declared
//   controlled fault used by a failure scenario. The approval gate, the
//   approval contract (23 §2), and every existing module stay untouched.
//
// Scenario lifecycle (minimal, deterministic, no hidden state):
//   LOAD → VALIDATE → SETUP → EXECUTE → OBSERVE → ASSERT → REPORT → CLEANUP
//
// Isolation: scenarios that need files run against `test/scenarios/workspace`
// (created from `test/scenarios/fixtures`, emptied at cleanup) — never the
// repository root. The scenario handler resolves paths with a containment
// check, so no scenario can write outside its workspace.
//
// Determinism: fixed field order, fixed assertion order, no timestamps, no
// random ids, no wall-clock timing in any assertion; the same scenario
// always produces the same observations, metrics, and report bytes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runLocalRuntime, exitCodeFor } from "../runtime/local-runtime.mjs";
import { planIdentity, executionIdentity } from "../composition/plan-execution/index.mjs";
import { createPlanner } from "../modules/planner/index.mjs";
import { createAgentOrchestrator } from "../modules/agent/index.mjs";
import { createModuleRegistry } from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import { createRuntime } from "../modules/hotkeys/src/runtime.mjs";
import { DEFAULT_HANDLERS, defineHandler, createSaveFilesHandler } from "../modules/hotkeys/src/handlers.mjs";
import { createReportBus } from "../modules/report-bus/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");
export const SCENARIOS_DIR = path.join(HERE, "scenarios");
export const FIXTURES_DIR = path.join(SCENARIOS_DIR, "fixtures");

const REGISTRY_TEXT = fs.readFileSync(
  path.join(REPO_ROOT, "docs", "v3", "12-hotkey-registry.md"),
  "utf8"
);
const MODULE_IDS = Object.freeze(["hotkeys", "tool-bus", "module-registry", "report-bus", "agent"]);

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

// ---------------------------------------------------------------------------
// Scenario model (strict — an unknown or missing field fails closed)
// ---------------------------------------------------------------------------

/** Scenario outcomes; the first four are PASS-side, the rest FAIL-side. */
export const OUTCOMES = Object.freeze([
  "PASS",
  "EXPECTED_REFUSAL",
  "EXPECTED_FAILURE",
  "HARNESS_FAILURE",
  "AGENT_FAILURE",
  "CONTRACT_FAILURE",
  "UNEXPECTED_SUCCESS",
]);

/** Every outcome a scenario may declare as its expected classification. */
export const EXPECTED_OUTCOMES = Object.freeze([
  "PASS",
  "EXPECTED_REFUSAL",
  "EXPECTED_FAILURE",
]);

const SCENARIO_FIELDS = Object.freeze([
  "id", "name", "description", "workspace", "handler", "nativeWorkspace", "faults", "approval", "input", "expected", "variants",
]);
const RUN_FIELDS = Object.freeze(["name", "approval", "faults", "input", "expected"]);
const EXPECTED_FIELDS = Object.freeze([
  "outcome", "exitCode", "result", "counts", "execution",
  "evidenceContains", "reportContains", "reportNotContains", "workspaceFiles",
]);
const RESULT_FIELDS = Object.freeze(["ok", "code", "status", "stage"]);
const COUNT_FIELDS = Object.freeze(["planner", "approval", "agent", "report", "toolChecks"]);
const EXECUTION_FIELDS = Object.freeze([
  "executed", "classification", "code", "outputFile", "outputSha256", "outputBytes",
]);
const APPROVAL_MODES = Object.freeze(["none", "grant", "deny"]);
const FAULT_KINDS = Object.freeze(["composer-report-bus"]);
const SCENARIO_HANDLERS = Object.freeze(["workspace-save"]);
const ID_RE = /^RT-\d{3}$/;

/**
 * Validate one scenario definition. Returns every violation in fixed order;
 * a non-empty list means the scenario never runs (fail closed, never
 * partially executed, never silently corrected).
 */
export function validateScenario(scenario) {
  const violations = [];
  const v = (detail) => violations.push({ code: "INVALID_SCENARIO", detail });
  if (!isPlainObject(scenario)) {
    v(`scenario must be a plain object (${typeof scenario})`);
    return violations;
  }
  for (const field of Object.keys(scenario).filter((key) => !SCENARIO_FIELDS.includes(key)).sort()) {
    v(`unknown scenario field "${field}"`);
  }
  if (!isNonEmptyString(scenario.id) || !ID_RE.test(scenario.id)) v(`id must match ${ID_RE.source}`);
  if (!isNonEmptyString(scenario.name)) v("name must be a non-empty string");
  if (!isNonEmptyString(scenario.description)) v("description must be a non-empty string");

  if (scenario.workspace !== undefined) {
    if (!isPlainObject(scenario.workspace)) v("workspace must be an object");
    else {
      for (const field of Object.keys(scenario.workspace).filter((key) => key !== "files").sort()) {
        v(`unknown workspace field "${field}"`);
      }
      const files = scenario.workspace.files;
      if (!Array.isArray(files) || files.length === 0) v("workspace.files must be a non-empty array");
      else {
        for (const name of files) {
          if (!isNonEmptyString(name) || path.isAbsolute(name) || name.split("/").includes("..")) {
            v(`workspace file "${String(name)}" must be a workspace-relative name`);
          }
        }
      }
    }
  }
  if (scenario.handler !== undefined) {
    if (!SCENARIO_HANDLERS.includes(scenario.handler)) {
      v(`handler must be one of ${JSON.stringify(SCENARIO_HANDLERS)}`);
    } else if (scenario.workspace === undefined) {
      // A writing handler without an isolated workspace would touch the
      // repository root — refused here, before anything runs.
      v("handler \"workspace-save\" requires a declared workspace");
    }
  }
  if (scenario.nativeWorkspace !== undefined) {
    if (typeof scenario.nativeWorkspace !== "boolean") {
      v("nativeWorkspace must be a boolean");
    } else if (scenario.nativeWorkspace) {
      // The native production path (25 §11): the harness acts as composition
      // root and binds the SHIPPED handler.save-files factory to the
      // scenario's declared workspace — never an injected scenario handler,
      // never a repository workspace.
      if (scenario.workspace === undefined) {
        v("nativeWorkspace requires a declared workspace");
      }
      if (scenario.handler !== undefined) {
        v("nativeWorkspace cannot be combined with an injected handler");
      }
    }
  }
  if (scenario.faults !== undefined) {
    if (!Array.isArray(scenario.faults)) v("faults must be an array");
    else for (const kind of scenario.faults) if (!FAULT_KINDS.includes(kind)) v(`unknown fault "${String(kind)}"`);
  }
  if (scenario.approval !== undefined && !APPROVAL_MODES.includes(scenario.approval)) {
    v(`approval must be one of ${JSON.stringify(APPROVAL_MODES)}`);
  }
  validateInput(scenario.input, v, "input");
  validateExpected(scenario.expected, v, "expected");
  if (scenario.variants !== undefined) {
    if (!Array.isArray(scenario.variants)) v("variants must be an array");
    else {
      const seen = new Set();
      for (const [index, variant] of scenario.variants.entries()) {
        const label = `variants[${index}]`;
        if (!isPlainObject(variant)) {
          v(`${label} must be an object`);
          continue;
        }
        for (const field of Object.keys(variant).filter((key) => !RUN_FIELDS.includes(key)).sort()) {
          v(`${label}: unknown field "${field}"`);
        }
        if (!isNonEmptyString(variant.name) || seen.has(variant.name)) {
          v(`${label}: name must be a non-empty, unique string`);
        }
        seen.add(variant.name);
        if (variant.approval !== undefined && !APPROVAL_MODES.includes(variant.approval)) {
          v(`${label}: approval must be one of ${JSON.stringify(APPROVAL_MODES)}`);
        }
        if (variant.faults !== undefined) {
          if (!Array.isArray(variant.faults)) v(`${label}: faults must be an array`);
          else for (const kind of variant.faults) if (!FAULT_KINDS.includes(kind)) v(`${label}: unknown fault "${String(kind)}"`);
        }
        validateInput(variant.input, v, `${label}.input`);
        validateExpected(variant.expected, v, `${label}.expected`);
      }
    }
  }
  return violations;
}

function validateInput(input, v, label) {
  if (!isPlainObject(input)) {
    v(`${label} must be a plain object`);
    return;
  }
  for (const field of Object.keys(input).filter((key) => key !== "plan" && key !== "execution").sort()) {
    v(`${label}: unknown field "${field}"`);
  }
  if (!isPlainObject(input.plan)) v(`${label}.plan must be an object`);
  if (!isPlainObject(input.execution)) v(`${label}.execution must be an object`);
}

function validateExpected(expected, v, label) {
  if (!isPlainObject(expected)) {
    v(`${label} must be an object`);
    return;
  }
  for (const field of Object.keys(expected).filter((key) => !EXPECTED_FIELDS.includes(key)).sort()) {
    v(`${label}: unknown field "${field}"`);
  }
  if (!EXPECTED_OUTCOMES.includes(expected.outcome)) {
    v(`${label}.outcome must be one of ${JSON.stringify(EXPECTED_OUTCOMES)}`);
  }
  if (expected.exitCode !== undefined && !Number.isInteger(expected.exitCode)) {
    v(`${label}.exitCode must be an integer`);
  }
  if (expected.result !== undefined) {
    if (!isPlainObject(expected.result)) v(`${label}.result must be an object`);
    else {
      for (const field of Object.keys(expected.result).filter((key) => !RESULT_FIELDS.includes(key)).sort()) {
        v(`${label}.result: unknown field "${field}"`);
      }
    }
  }
  if (expected.counts !== undefined) {
    if (!isPlainObject(expected.counts)) v(`${label}.counts must be an object`);
    else {
      for (const field of Object.keys(expected.counts).filter((key) => !COUNT_FIELDS.includes(key)).sort()) {
        v(`${label}.counts: unknown field "${field}"`);
      }
      for (const [field, value] of Object.entries(expected.counts)) {
        if (!Number.isInteger(value) || value < 0) v(`${label}.counts.${field} must be a non-negative integer`);
      }
    }
  }
  if (expected.execution !== undefined) {
    if (!isPlainObject(expected.execution)) v(`${label}.execution must be an object`);
    else {
      for (const field of Object.keys(expected.execution).filter((key) => !EXECUTION_FIELDS.includes(key)).sort()) {
        v(`${label}.execution: unknown field "${field}"`);
      }
    }
  }
  for (const field of ["evidenceContains", "reportContains", "reportNotContains"]) {
    const value = expected[field];
    if (value !== undefined && (!Array.isArray(value) || value.some((line) => !isNonEmptyString(line)))) {
      v(`${label}.${field} must be an array of non-empty strings`);
    }
  }
  if (expected.workspaceFiles !== undefined) {
    if (!isPlainObject(expected.workspaceFiles)) v(`${label}.workspaceFiles must be an object`);
    else {
      for (const [name, content] of Object.entries(expected.workspaceFiles)) {
        if (typeof content !== "string") v(`${label}.workspaceFiles.${name} must be a string`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// LOAD
// ---------------------------------------------------------------------------

/** Load every scenario definition, sorted by id. */
export function loadScenarios(dir = SCENARIOS_DIR) {
  const names = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  return names.map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")));
}

/** Load one scenario by id. Throws a named error for an unknown id. */
export function loadScenario(id, dir = SCENARIOS_DIR) {
  const found = loadScenarios(dir).find((scenario) => scenario.id === id);
  if (found === undefined) {
    const error = new Error(`unknown scenario id "${id}"`);
    error.code = "E_UNKNOWN_SCENARIO";
    throw error;
  }
  return found;
}

// ---------------------------------------------------------------------------
// SETUP / CLEANUP — isolated workspace, fixtures are read-only
// ---------------------------------------------------------------------------

/**
 * Create the scenario workspace: a fresh directory OUTSIDE the repository,
 * populated from the committed fixtures. Per-run isolation means parallel
 * test processes can never see each other's files, and the repository is
 * never a write target. Returns `{ root, files }`.
 */
export function createWorkspace(scenario) {
  if (scenario.workspace === undefined) return null;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "grimoire-scenario-"));
  const files = [];
  for (const name of scenario.workspace.files) {
    const source = path.join(FIXTURES_DIR, name);
    if (!fs.existsSync(source)) {
      fs.rmSync(root, { recursive: true, force: true });
      const error = new Error(`missing workspace fixture "${name}"`);
      error.code = "E_HARNESS_FIXTURE";
      throw error;
    }
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    files.push(name);
  }
  return { root, files };
}

/** Remove the workspace tree entirely — no scenario residue survives a run. */
export function disposeWorkspace(workspace) {
  if (workspace === null) return;
  fs.rmSync(workspace.root, { recursive: true, force: true });
}

/** Snapshot every workspace file as text (relative name → content), sorted. */
export function observeWorkspace(workspace) {
  if (workspace === null || !fs.existsSync(workspace.root)) return {};
  const out = {};
  const walk = (current, prefix) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const relative = prefix === "" ? name : `${prefix}/${name}`;
      if (fs.statSync(full).isDirectory()) walk(full, relative);
      else out[relative] = fs.readFileSync(full, "utf8");
    }
  };
  walk(workspace.root, "");
  return out;
}

// ---------------------------------------------------------------------------
// EXECUTE — explicit DI over the Task 16 runtime (real contracts)
// ---------------------------------------------------------------------------

/**
 * The one scenario-provided handler: an implementation of the ACTIVE
 * registry record `G` ("save your files as you go"), supplied through the
 * documented `createRuntime({handlers})` injection point. It appends one
 * line to a file in the ISOLATED workspace and returns the same
 * `{file, bytes, sha256}` shape the shipped document handlers use.
 *
 * Scope note: the Hotkey Runtime validates the registry snapshot against its
 * own `root`, so that root must stay the repository root (12 §2 Source
 * columns point at repository documents). The handler therefore writes only
 * inside `test/scenarios/workspace` and refuses every path that leaves it —
 * a scenario can never reach a protected document through it.
 */
function createWorkspaceSaveHandler(workspaceRoot) {
  const spec = defineHandler({
    id: "scenario.workspace-save",
    command: "grimoire.key.G",
    requiredTools: [],
    validateArgs: (args) => {
      if (!isPlainObject(args)) return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "args must be an object" };
      const keys = Object.keys(args).sort();
      if (keys.length !== 2 || keys[0] !== "entry" || keys[1] !== "file") {
        return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "workspace-save requires exactly args.file and args.entry" };
      }
      if (!isNonEmptyString(args.file) || path.isAbsolute(args.file) || args.file.split("/").includes("..")) {
        return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "args.file must be a workspace-relative name" };
      }
      if (!isNonEmptyString(args.entry) || /[\r\n]/.test(args.entry)) {
        return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "args.entry must be a single non-empty line" };
      }
      return { ok: true };
    },
    run: ({ args }) => {
      const resolved = path.resolve(workspaceRoot, args.file);
      if (resolved !== workspaceRoot && !resolved.startsWith(workspaceRoot + path.sep)) {
        const error = new Error("scenario handler refuses paths outside the scenario workspace");
        error.code = "EACCES";
        throw error;
      }
      const before = fs.readFileSync(resolved, "utf8");
      // Deterministic separator: the entry always starts on its own line,
      // whatever the existing file's last byte is.
      const separator = before.endsWith("\n") ? "" : "\n";
      const after = `${before}${separator}${args.entry}\n`;
      fs.writeFileSync(resolved, after, "utf8");
      return {
        file: args.file,
        bytes: Buffer.byteLength(after, "utf8"),
        lines: after.split("\n").length,
        sha256: sha256(after),
        content: after,
      };
    },
  });
  // The map key IS the command id (the runtime's handler binding belt).
  return { command: "grimoire.key.G", spec };
}

/** Build one run's dependencies: the real contracts plus counting probes. */
function buildDependencies({ counts, handlerSpec, nativeWorkspaceRoot, faultComposerReport }) {
  const realToolBus = createToolBus({
    declarationText: loadCapabilityDeclarations(),
    providers: createDefaultProviders(),
    root: REPO_ROOT,
  });
  const toolBus = {
    check(capabilityId) {
      counts.toolChecks += 1;
      return realToolBus.check(capabilityId);
    },
  };
  const registry = createModuleRegistry({ toolBus });
  for (const id of MODULE_IDS) {
    const registered = registry.register(fs.readFileSync(path.join(REPO_ROOT, "modules", id, "manifest.yaml"), "utf8"));
    if (registered.ok !== true) {
      const error = new Error(`scenario harness: module ${id} failed to register`);
      error.code = "E_HARNESS_REGISTRY";
      throw error;
    }
  }
  const enabled = registry.enable("hotkeys");
  if (enabled.ok !== true) {
    const error = new Error("scenario harness: module hotkeys failed to enable");
    error.code = "E_HARNESS_REGISTRY";
    throw error;
  }
  const hotkeyRuntime = createRuntime({
    registryText: REGISTRY_TEXT,
    root: REPO_ROOT,
    handlers: nativeWorkspaceRoot !== null && nativeWorkspaceRoot !== undefined
      // Native production path (27 §R6, 25 §11): the SHIPPED factory bound to
      // the explicitly declared scenario workspace — no scenario-provided
      // handler is involved, and the repository root is refused by the
      // factory itself.
      ? { ...DEFAULT_HANDLERS, "grimoire.key.G": createSaveFilesHandler({ workspace: nativeWorkspaceRoot, repositoryRoot: REPO_ROOT }) }
      : handlerSpec === null
        ? DEFAULT_HANDLERS
        : { ...DEFAULT_HANDLERS, ...handlerSpec },
  });
  const plannerBus = createReportBus();
  const planner = {
    plan(request) {
      counts.planner += 1;
      return createPlanner({ reportBus: plannerBus }).plan(request);
    },
  };
  const agentBus = createReportBus();
  const orchestrator = createAgentOrchestrator({
    registry,
    runtime: hotkeyRuntime,
    toolBus,
    reportBus: agentBus,
  });
  const agent = {
    run(request) {
      counts.agent += 1;
      return orchestrator.run(request);
    },
  };
  const composerBus = createReportBus();
  const reportBus = faultComposerReport
    ? {
        build() {
          counts.report += 1;
          return {
            ok: false,
            code: "DEPENDENCY_ERROR",
            error: { class: "E-ENV", code: "DEPENDENCY_ERROR", message: "refused", detail: "scenario fault: composer report bus" },
            violations: [{ code: "DEPENDENCY_ERROR", detail: "scenario fault: composer report bus" }],
          };
        },
      }
    : {
        build(input) {
          counts.report += 1;
          return composerBus.build(input);
        },
      };
  return { planner, agent, reportBus };
}

/**
 * Build an approval component for one run, from that run's approval mode.
 * It is constructed per run and computes its bindings from the arguments the
 * GATE hands it — never stored, never reused, never cached. Mode `none`
 * returns `undefined`: nothing is injected, so a gated bundle refuses D0.
 */
function buildApproval(mode, counts) {
  if (mode === "none") return undefined;
  const granted = mode === "grant";
  return {
    verify(plan, execution) {
      counts.approval += 1;
      return {
        granted,
        plan: planIdentity(plan),
        execution: executionIdentity(execution),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// OBSERVE
// ---------------------------------------------------------------------------

function observeResult(result, counts, workspace) {
  const execution = result && isPlainObject(result.orchestration)
    ? result.orchestration.execution
    : null;
  const output = execution && isPlainObject(execution.output) ? execution.output : null;
  return {
    outcome: null, // resolved against the scenario's expectation in ASSERT
    exitCode: exitCodeFor(result),
    result: {
      ok: result.ok,
      code: result.code,
      status: result.status,
      stage: result.stage,
    },
    counts: { ...counts },
    execution: {
      executed: execution !== null && execution.executed === true,
      classification: execution !== null && typeof execution.classification === "string" ? execution.classification : null,
      code: execution !== null && typeof execution.code === "string" ? execution.code : null,
      outputFile: output !== null && typeof output.file === "string" ? output.file : null,
      outputSha256: output !== null && typeof output.sha256 === "string" ? output.sha256 : null,
      outputBytes: output !== null && typeof output.bytes === "number" ? output.bytes : null,
    },
    evidence: execution !== null && Array.isArray(execution.evidence) ? [...execution.evidence] : [],
    reportText: result.report !== null && isPlainObject(result.report) ? result.report.text : null,
    reportSha256: result.report !== null && isPlainObject(result.report) ? result.report.sha256 : null,
    workspace,
  };
}

/** Classify what actually happened (never what the scenario hoped for). */
export function classifyOutcome(result) {
  if (result.ok === true) return "PASS";
  if (result.status === "REFUSED") return "EXPECTED_REFUSAL";
  if (result.status === "FAILED" || result.code === "REPORT_FAILED") return "EXPECTED_FAILURE";
  return "CONTRACT_FAILURE";
}

/** Map (observed, expected) onto the reported outcome taxonomy. */
export function resolveOutcome(observed, expected) {
  if (observed === expected) return observed;
  if (observed === "PASS") return "UNEXPECTED_SUCCESS";
  if (expected === "PASS") return "AGENT_FAILURE";
  return "CONTRACT_FAILURE";
}

// ---------------------------------------------------------------------------
// ASSERT
// ---------------------------------------------------------------------------

function assertion(name, ok, expected, actual) {
  return { name, ok: ok === true, expected, actual };
}

function assertRun(observation, expected) {
  const checks = [];
  if (expected.exitCode !== undefined) {
    checks.push(assertion("exitCode", observation.exitCode === expected.exitCode, expected.exitCode, observation.exitCode));
  }
  if (expected.result !== undefined) {
    for (const field of RESULT_FIELDS) {
      if (expected.result[field] === undefined) continue;
      checks.push(assertion(
        `result.${field}`,
        observation.result[field] === expected.result[field],
        expected.result[field],
        observation.result[field]
      ));
    }
  }
  if (expected.counts !== undefined) {
    for (const field of COUNT_FIELDS) {
      if (expected.counts[field] === undefined) continue;
      checks.push(assertion(
        `counts.${field}`,
        observation.counts[field] === expected.counts[field],
        expected.counts[field],
        observation.counts[field]
      ));
    }
  }
  if (expected.execution !== undefined) {
    for (const field of EXECUTION_FIELDS) {
      if (expected.execution[field] === undefined) continue;
      checks.push(assertion(
        `execution.${field}`,
        observation.execution[field] === expected.execution[field],
        expected.execution[field],
        observation.execution[field]
      ));
    }
  }
  for (const [index, line] of (expected.evidenceContains ?? []).entries()) {
    checks.push(assertion(
      `evidenceContains[${index}]`,
      observation.evidence.some((observed) => observed.includes(line)),
      line,
      observation.evidence
    ));
  }
  for (const [index, line] of (expected.reportContains ?? []).entries()) {
    checks.push(assertion(
      `reportContains[${index}]`,
      observation.reportText !== null && observation.reportText.includes(line),
      line,
      observation.reportText === null ? null : "(report absent)"
    ));
  }
  for (const [index, line] of (expected.reportNotContains ?? []).entries()) {
    // An absent report trivially contains nothing — REPORT_FAILED scenarios
    // must still be able to assert "no success is claimed anywhere".
    checks.push(assertion(
      `reportNotContains[${index}]`,
      observation.reportText === null || !observation.reportText.includes(line),
      `absent: ${line}`,
      observation.reportText === null ? null : observation.reportText.includes(line)
    ));
  }
  if (expected.workspaceFiles !== undefined) {
    const names = Object.keys(observation.workspace).sort();
    const expectedNames = Object.keys(expected.workspaceFiles).sort();
    checks.push(assertion(
      "workspace.fileSet",
      names.length === expectedNames.length && names.every((name, index) => name === expectedNames[index]),
      expectedNames,
      names
    ));
    for (const name of expectedNames) {
      if (typeof expected.workspaceFiles[name] !== "string") continue;
      checks.push(assertion(
        `workspaceFiles.${name}`,
        observation.workspace[name] === expected.workspaceFiles[name],
        expected.workspaceFiles[name],
        observation.workspace[name] === undefined ? "(file absent)" : observation.workspace[name]
      ));
    }
  }
  // The outcome assertion is decided LAST: it depends on whether every other
  // declared expectation held. A run that matches its expected outcome but
  // fails a declared detail resolves to CONTRACT_FAILURE, never to a pass.
  const othersPass = checks.every((check) => check.ok);
  const resolved = othersPass
    ? resolveOutcome(observation.observedOutcome, expected.outcome)
    : observation.observedOutcome === expected.outcome
      // the right kind of outcome, but a declared detail did not hold
      ? "CONTRACT_FAILURE"
      : resolveOutcome(observation.observedOutcome, expected.outcome);
  checks.unshift(assertion("outcome", resolved === expected.outcome, expected.outcome, resolved));
  return { assertions: checks, resolvedOutcome: resolved };
}

// ---------------------------------------------------------------------------
// RUN — one scenario end to end
// ---------------------------------------------------------------------------

/**
 * Run one scenario through LOAD → VALIDATE → SETUP → EXECUTE → OBSERVE →
 * ASSERT → REPORT → CLEANUP. Never throws: a harness fault is REPORTED as
 * `HARNESS_FAILURE` so a broken harness can never read as a pass.
 */
export function runScenario(scenario) {
  const started = { id: scenario && typeof scenario.id === "string" ? scenario.id : "(unknown)" };
  const violations = validateScenario(scenario);
  if (violations.length > 0) {
    return finish(started, [], "HARNESS_FAILURE", "FAIL", { violations });
  }
  let workspace = null;
  try {
    workspace = createWorkspace(scenario);
    const handlerSpec = scenario.handler === undefined
      ? null
      : { "grimoire.key.G": createWorkspaceSaveHandler(workspace.root).spec };
    const nativeWorkspaceRoot = scenario.nativeWorkspace === true ? workspace.root : null;
    const runs = [
      {
        name: "primary",
        approval: scenario.approval ?? "none",
        faults: scenario.faults ?? [],
        input: scenario.input,
        expected: scenario.expected,
      },
      ...(scenario.variants ?? []).map((variant) => ({
        name: variant.name,
        approval: variant.approval ?? scenario.approval ?? "none",
        faults: variant.faults ?? scenario.faults ?? [],
        input: variant.input,
        expected: variant.expected,
      })),
    ];
    const observations = [];
      for (const run of runs) {
        const counts = { planner: 0, approval: 0, agent: 0, report: 0, toolChecks: 0 };
        const dependencies = buildDependencies({
          counts,
          handlerSpec,
          nativeWorkspaceRoot,
          faultComposerReport: run.faults.includes("composer-report-bus"),
        });
        // The Task 16 runtime executes the bundle; the harness only supplies
        // its dependencies (and, when absent, its approval) explicitly.
        const result = runLocalRuntime(run.input, {
          planner: dependencies.planner,
          agent: dependencies.agent,
          reportBus: dependencies.reportBus,
          approval: buildApproval(run.approval, counts),
        });
        const observation = observeResult(result, counts, observeWorkspace(workspace));
        observation.run = run.name;
        observation.expectedOutcome = run.expected.outcome;
        observation.observedOutcome = classifyOutcome(result);
        const evaluation = assertRun(observation, run.expected);
        observation.assertions = evaluation.assertions;
        observation.resolvedOutcome = evaluation.resolvedOutcome;
        observation.passed = observation.assertions.every((check) => check.ok);
        observations.push(observation);
      }
      return finish(started, observations, null);
    } catch (error) {
      return finish(started, [], "HARNESS_FAILURE", "FAIL", {
        message: error && typeof error.message === "string" ? error.message : String(error),
        code: error && typeof error.code === "string" ? error.code : null,
      });
    } finally {
    // CLEANUP always runs — a failed scenario leaves no residue either.
    disposeWorkspace(workspace);
  }
}

function finish(header, observations, harnessFailure, statusOverride, detail = null) {
  const status = statusOverride ?? (observations.every((observation) => observation.passed) ? "PASS" : "FAIL");
  return {
    ...header,
    status,
    outcome: harnessFailure ?? (observations[0] ? observations[0].resolvedOutcome : "HARNESS_FAILURE"),
    runs: observations,
    assertionCount: observations.reduce((total, observation) => total + observation.assertions.length, 0),
    failedAssertions: observations.flatMap((observation) =>
      observation.assertions.filter((check) => !check.ok).map((check) => ({ run: observation.run, ...check }))
    ),
    harnessFailure,
    detail,
  };
}

/** Run every scenario definition, in id order. */
export function runAll(dir = SCENARIOS_DIR) {
  return loadScenarios(dir).map((scenario) => runScenario(scenario));
}

// ---------------------------------------------------------------------------
// REPORT + CLI
// ---------------------------------------------------------------------------

const USAGE = 'usage: node test/scenario-harness.mjs <RT-xxx> | --all';

/** Deterministic CLI rendering: no timestamps, no random ids, fixed order. */
export function renderReport(results) {
  const lines = [];
  for (const result of results) {
    lines.push(`SCENARIO ${result.id}`);
    lines.push(`STATUS ${result.status}`);
    lines.push(`OUTCOME ${result.outcome}`);
    if (result.harnessFailure !== null) {
      lines.push(`HARNESS ${JSON.stringify(result.detail)}`);
    }
    for (const run of result.runs) {
      lines.push(`RUN ${run.run}`);
      lines.push(
        `RESULT ok=${run.result.ok} code=${run.result.code} status=${run.result.status} stage=${run.result.stage}`
      );
      lines.push(
        `METRICS planner=${run.counts.planner} approval=${run.counts.approval} agent=${run.counts.agent} toolChecks=${run.counts.toolChecks} report=${run.counts.report}`
      );
      lines.push(`EXIT_CODE ${run.exitCode}`);
      lines.push(`REPORT_SHA256 ${run.reportSha256 === null ? "none" : run.reportSha256}`);
      const failed = run.assertions.filter((check) => !check.ok);
      lines.push(`ASSERTIONS ${run.assertions.length - failed.length}/${run.assertions.length}`);
      for (const check of failed) {
        lines.push(`FAILED ${check.name} expected=${JSON.stringify(check.expected)} actual=${JSON.stringify(check.actual)}`);
      }
    }
    lines.push("");
  }
  const passed = results.filter((result) => result.status === "PASS").length;
  const harnessFailures = results.filter((result) => result.outcome === "HARNESS_FAILURE").length;
  lines.push(
    `SUMMARY scenarios=${results.length} passed=${passed} failed=${results.length - passed} harnessFailures=${harnessFailures}`
  );
  return lines.join("\n");
}

/**
 * CLI entry: `<RT-xxx>` runs one scenario, `--all` runs every definition.
 * Exit codes: 0 all pass · 2 usage/unknown id · 3 a scenario failed ·
 * 4 the harness itself failed (setup, fixtures, or internal fault).
 */
export function main(argv, io = {}) {
  const out = io.stdout ?? ((text) => process.stdout.write(text));
  const err = io.stderr ?? ((text) => process.stderr.write(text));
  // `loadScenario` / `loadScenarios` are injectable so the CLI's argument and
  // exit-code behavior is testable without touching the scenario directory.
  const loadOne = io.loadScenario ?? ((id) => loadScenario(id));
  const loadEvery = io.loadScenarios ?? (() => loadScenarios());
  const args = argv.filter((arg) => arg !== "--all");
  const wantsAll = args.length !== argv.length;
  if (argv.includes("--all") && argv.length !== 1) {
    err(`INPUT ERROR: --all takes no scenario id\n${USAGE}\n`);
    return 2;
  }
  if (argv.length === 0) {
    err(`INPUT ERROR: give a scenario id or --all\n${USAGE}\n`);
    return 2;
  }
  let results;
  if (wantsAll) {
    results = loadEvery().map((scenario) => runScenario(scenario));
  } else {
    try {
      results = [runScenario(loadOne(args[0]))];
    } catch (error) {
      err(`INPUT ERROR: ${error.message}\n${USAGE}\n`);
      return 2;
    }
  }
  out(`${renderReport(results)}\n`);
  if (results.some((result) => result.outcome === "HARNESS_FAILURE")) return 4;
  return results.every((result) => result.status === "PASS") ? 0 : 3;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.exitCode = main(process.argv.slice(2));
}