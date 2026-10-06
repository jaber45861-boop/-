// Grimoire v3 — Local Runtime (Task 16).
//
// Position: the smallest production-quality LOCAL shell around the existing
// public contracts — a thin orchestration layer, never a second business
// layer. It CONSUMES the contracts and redefines none of them:
//
//   input (JSON bundle)
//     → construct dependencies (explicit DI, one fresh wiring per execution)
//     → createPlanner            (modules/planner)
//     → createAgentOrchestrator  (modules/agent → registry/tool-bus/hotkeys)
//     → createPlanExecutionComposer (composition/plan-execution)
//     → composer.execute(bundle) (the lifecycle AND the approval gate live
//                                  ONLY in composition/plan-execution/src/
//                                  composer.mjs — no second gate exists here)
//     → deterministic printed result
//     → meaningful process exit code
//
// Approval (23 §1/§2): the composition root constructs and injects the
// approval component. This runtime NEVER creates one on its own: a gated
// bundle (plan.review.required === true) with no authorized component
// refuses D0 exactly as before. The only CLI-granted components are the
// explicitly requested demo verdicts below (`--approval grant|deny`), which
// are disclosed test doubles — they compute genuine bindings per call from
// their actual arguments (no cache, no stored verdict, no side channels),
// so the GATE still performs every check D0–D6 itself. Programmatic callers
// inject their own component via `runLocalRuntime(bundle, { approval })`.
//
// Statelessness: no module-level mutable state, no caches, no counters, no
// timestamp/random/pid/environment-dependent behavior anywhere in this
// file. Same input + same injected wiring ⇒ byte-identical output and the
// same exit code, run after run.
//
// CLI (plain Node ESM — no package.json, framework, or server):
//   node runtime/local-runtime.mjs [--approval grant|deny] [--workspace <dir>] <input.json | ->
//
// `--workspace <dir>` (Task 21, 24 §3.1) is the EXPLICIT composition-root
// declaration of a writable native-write workspace: only with it is
// `handler.save-files` bound to `G`. Without the flag nothing is bound and
// default behavior stays byte-identical (`G` remains UNIMPLEMENTED). The
// repository root (resolved from this file, never from cwd) is categorically
// refused as a workspace — at the flag and again at handler construction.
//
// Exit codes (also documented in docs/v3/24-local-runtime.md):
//   0  COMPLETED — a real success, the only success
//   1  planner refusal (PLAN_INCOMPLETE) or an unexpected runtime error
//   2  invalid input (usage error, unreadable/unparseable JSON, INVALID_REQUEST)
//   3  approval refusal (APPROVAL_REQUIRED — gate closed)
//   4  agent refusal or failure (orchestration never silently succeeds)
//   5  report failure (REPORT_FAILED — completion is never claimed)

import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createPlanExecutionComposer,
  planIdentity,
  executionIdentity,
} from "../composition/plan-execution/index.mjs";
import { createPlanner } from "../modules/planner/index.mjs";
import { createAgentOrchestrator } from "../modules/agent/index.mjs";
import { createModuleRegistry } from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import { createRuntime } from "../modules/hotkeys/src/runtime.mjs";
import { DEFAULT_HANDLERS, createSaveFilesHandler } from "../modules/hotkeys/src/handlers.mjs";
import { createReportBus } from "../modules/report-bus/index.mjs";

/** The repository root this runtime is checked into (never a cwd lookup). */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The same five manifests the composition tests register; one enabled module. */
const MODULE_IDS = Object.freeze(["hotkeys", "tool-bus", "module-registry", "report-bus", "agent"]);
const ENABLED_IDS = Object.freeze(["hotkeys"]);

const USAGE =
  'usage: node runtime/local-runtime.mjs [--approval grant|deny] [--workspace <dir>] <input.json | ->';

/**
 * Disclosed demo verdicts — TEST DOUBLES, usable only when explicitly
 * requested with `--approval grant` / `--approval deny`. They build the
 * three-field verdict from the arguments the GATE hands them, using the
 * composition layer's own exported identity functions (23 §4), so both
 * sides of every comparison share one algorithm. They store nothing and
 * are consulted only when the composer consults them (exactly once per
 * gated attempt — 23 §5).
 */
const DEMO_APPROVAL = Object.freeze({
  grant: Object.freeze({
    verify: (plan, execution) => ({
      granted: true,
      plan: planIdentity(plan),
      execution: executionIdentity(execution),
    }),
  }),
  deny: Object.freeze({
    verify: (plan, execution) => ({
      granted: false,
      plan: planIdentity(plan),
      execution: executionIdentity(execution),
    }),
  }),
});

const messageOf = (error) =>
  error && typeof error.message === "string" && error.message !== "" ? error.message : String(error);

/**
 * Validate an explicitly declared native-write workspace (27 §R3, 24 §3.1).
 * Returns `{ ok: true, dir }` with the real path, or `{ ok: false, reason }`.
 * Refused: a value that does not exist, is not a directory, IS the Grimoire
 * repository root, lies inside it, or contains it (so no path reachable
 * through the workspace can ever touch the checkout). No implicit fallback:
 * an absent flag never reaches this function.
 */
export function resolveWorkspace(value, repositoryRoot = ROOT) {
  let real;
  try {
    real = realpathSync(path.resolve(value));
  } catch {
    return { ok: false, reason: `workspace "${value}" does not exist` };
  }
  let stat;
  try {
    stat = statSync(real);
  } catch {
    return { ok: false, reason: `workspace "${value}" does not exist` };
  }
  if (!stat.isDirectory()) {
    return { ok: false, reason: `workspace "${value}" is not a directory` };
  }
  const repositoryReal = realpathSync(path.resolve(repositoryRoot));
  if (real === repositoryReal) {
    return { ok: false, reason: "workspace must not be the Grimoire repository root" };
  }
  if (real.startsWith(repositoryReal + path.sep)) {
    return { ok: false, reason: "workspace must be outside the Grimoire repository root" };
  }
  if (repositoryReal.startsWith(real + path.sep)) {
    return { ok: false, reason: "workspace must not contain the Grimoire repository root" };
  }
  return { ok: true, dir: real };
}

/**
 * Construct the real dependencies — explicit wiring, no singletons, no
 * service locator, no environment magic, no side-effect imports. One call
 * = one fresh wiring (fresh registry, fresh report buses); nothing is
 * shared between executions. `options.workspace` is the explicit
 * native-write workspace declaration (27 §R3): only when it is present is
 * `handler.save-files` bound to `grimoire.key.G`; when it is absent the
 * construction is byte-identical to the Task 16 default (no handler bound,
 * `G` stays UNIMPLEMENTED).
 */
export function createLocalDependencies(options = {}) {
  const workspace = options.workspace;
  const registryText = readFileSync(path.join(ROOT, "docs", "v3", "12-hotkey-registry.md"), "utf8");
  const toolBus = createToolBus({
    declarationText: loadCapabilityDeclarations(),
    providers: createDefaultProviders(),
    root: ROOT,
  });
  const registry = createModuleRegistry({ toolBus });
  for (const id of MODULE_IDS) {
    const manifest = readFileSync(path.join(ROOT, "modules", id, "manifest.yaml"), "utf8");
    const registered = registry.register(manifest);
    if (!registered.ok) {
      throw new Error(`module ${id} failed to register: ${JSON.stringify(registered)}`);
    }
  }
  for (const id of ENABLED_IDS) {
    const enabled = registry.enable(id);
    if (!enabled.ok) {
      throw new Error(`module ${id} failed to enable: ${JSON.stringify(enabled)}`);
    }
  }
  const hotkeyRuntime = createRuntime({
    registryText,
    root: ROOT,
    handlers: workspace === undefined || workspace === null
      ? undefined
      : { ...DEFAULT_HANDLERS, "grimoire.key.G": createSaveFilesHandler({ workspace, repositoryRoot: ROOT }) },
  });
  const planner = createPlanner({ reportBus: createReportBus() });
  const agent = createAgentOrchestrator({
    registry,
    runtime: hotkeyRuntime,
    toolBus,
    reportBus: createReportBus(),
  });
  return Object.freeze({ planner, agent, reportBus: createReportBus() });
}

/**
 * Run one bundle through the existing contracts and return the composer's
 * frozen result, verbatim. Every dependency is injectable for tests; the
 * defaults construct the real wiring. `approval` follows contract 23 §2:
 * absent / undefined means NOT injected — a gated bundle then refuses D0,
 * and this function never fills the slot on its own.
 */
export function runLocalRuntime(bundle, options = {}) {
  const dependencies = createLocalDependencies({ workspace: options.workspace });
  const composer = createPlanExecutionComposer({
    planner: options.planner ?? dependencies.planner,
    agent: options.agent ?? dependencies.agent,
    reportBus: options.reportBus ?? dependencies.reportBus,
    approval: options.approval,
  });
  return composer.execute(bundle);
}

/**
 * Deterministic stdout rendering: ONE single-line JSON header, then the
 * Report Bus text verbatim (empty when the report step refused). No
 * timestamps, no random ids, no machine paths — identical results render
 * byte-identically.
 */
export function presentResult(result) {
  const header = {
    ok: result.ok,
    code: result.code,
    status: result.status,
    stage: result.stage,
    error: result.error,
    reportSha256: result.report === null ? null : result.report.sha256,
  };
  const reportText = result.report === null ? "" : result.report.text;
  return `${JSON.stringify(header)}\n${reportText}`;
}

/** Meaningful process status: COMPLETED → 0; every non-success → 2–5 (or 1). */
export const EXIT_CODES = Object.freeze({
  COMPLETED: 0,
  PLAN_INCOMPLETE: 1,
  INVALID_REQUEST: 2,
  APPROVAL_REQUIRED: 3,
  MODULE_NOT_FOUND: 4,
  MODULE_DISABLED: 4,
  CAPABILITY_UNAVAILABLE: 4,
  CAPABILITY_AMBIGUOUS: 4,
  PHASE_NOT_DECLARED: 4,
  MANIFEST_INVALID: 4,
  TOOL_REQUIRED: 4,
  EXECUTION_REFUSED: 4,
  EXECUTION_FAILED: 4,
  REPORT_FAILED: 5,
});

export function exitCodeFor(result) {
  const code = result && typeof result.code === "string" ? result.code : null;
  return Object.prototype.hasOwnProperty.call(EXIT_CODES, code) ? EXIT_CODES[code] : 1;
}

/**
 * CLI entry: parse argv, read the bundle (file path, or `-` for stdin),
 * run it, print, and return the exit code. `io` exists so the argument
 * and input-error paths are testable in process; the defaults are the
 * real streams and file system. No interactive prompts.
 */
export function main(argv, io = {}) {
  const out = io.stdout ?? ((text) => process.stdout.write(text));
  const err = io.stderr ?? ((text) => process.stderr.write(text));
  const readFile = io.readFile ?? ((file) => readFileSync(file, "utf8"));
  const readStdin = io.readStdin ?? (() => readFileSync(0, "utf8"));

  const usageError = (reason) => {
    err(`INPUT ERROR: ${reason}\n${USAGE}\n`);
    return 2;
  };

  let inputPath = null;
  let approvalMode = null;
  let workspaceFlag = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--approval") {
      if (approvalMode !== null) return usageError("--approval given more than once");
      const value = argv[index + 1];
      if (value !== "grant" && value !== "deny") {
        return usageError('--approval requires "grant" or "deny"');
      }
      approvalMode = value;
      index += 1;
    } else if (arg === "--workspace") {
      if (workspaceFlag !== null) return usageError("--workspace given more than once");
      const value = argv[index + 1];
      if (value === undefined || value === "" || value.startsWith("--")) {
        return usageError("--workspace requires a directory");
      }
      workspaceFlag = value;
      index += 1;
    } else if (arg === "-") {
      if (inputPath !== null) return usageError("exactly one input source is allowed");
      inputPath = "-";
    } else if (arg.startsWith("-")) {
      return usageError(`unknown option "${arg}"`);
    } else {
      if (inputPath !== null) return usageError("exactly one input source is allowed");
      inputPath = arg;
    }
  }
  if (inputPath === null) return usageError("missing input (a JSON bundle file, or - for stdin)");

  // An explicit workspace is validated as INPUT before anything runs
  // (invalid input → exit 2; no implicit workspace ever exists).
  let workspaceDir = null;
  if (workspaceFlag !== null) {
    const checked = resolveWorkspace(workspaceFlag, ROOT);
    if (!checked.ok) return usageError(checked.reason);
    workspaceDir = checked.dir;
  }

  let bundle;
  try {
    const text = inputPath === "-" ? readStdin() : readFile(inputPath);
    bundle = JSON.parse(text);
  } catch (error) {
    err(`INPUT ERROR: cannot read input "${inputPath}": ${messageOf(error)}\n`);
    return 2;
  }

  try {
    const options = {};
    if (approvalMode !== null) options.approval = DEMO_APPROVAL[approvalMode];
    if (workspaceDir !== null) options.workspace = workspaceDir;
    const result = runLocalRuntime(bundle, options);
    out(presentResult(result));
    return exitCodeFor(result);
  } catch (error) {
    err(`RUNTIME ERROR: ${messageOf(error)}\n`);
    return 1;
  }
}

/** True only when this file is the process entry (`node runtime/local-runtime.mjs`). */
function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.exitCode = main(process.argv.slice(2));
}
