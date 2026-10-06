// Grimoire v3 — L2 Hotkeys module: runtime handler registry (Task 06).
//
// Dependency direction (02 §3 rule 1): L3 registry (data) -> L2 runtime
// resolver -> L2 handler registry (this file) -> handler. The authoritative
// L3 registry (docs/v3/12-hotkey-registry.md) is NEVER modified to make
// runtime code easier (02 §3 rule 5: assets are inert; behavior lives in the
// L2 module that declares it).
//
// Handler contract (docs/v3/14-hotkey-runtime.md §6):
//   id            unique handler identity (traceability, §14 of the directive)
//   command       the L3 command id the handler is bound to; createRuntime
//                 rejects any map entry whose key does not equal this value,
//                 so a mis-bound (replaced) handler can never be constructed
//   requiredTools tools the handler needs at dispatch (01 §10.1 declare
//                 before use); unavailable tool -> TOOL_REQUIRED, never a run
//   validateArgs  pure argument check -> { ok, code?, message? }; a failed
//                 check is INVALID_INPUT, never a guessed execution
//   run           the execution body; only reachable through
//                 executeResolvedHotkey() after every gate has passed
//
// An ACTIVE record without a handler is UNIMPLEMENTED (E-ENV — the required
// capability is absent from this runtime's environment). Missing behavior is
// never invented here; only behaviors documented in the registry and
// verifiable against this repository's files are implemented.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { makeError } from "./errors.mjs";

// L3 command ids are `grimoire.key.<KEY>` (12 §2, 03 §4 H3); the charset
// accepts every id the authoritative registry actually contains, including
// the legacy `grimoire.key./backslash` (a METADATA_ONLY row).
const COMMAND_RE = /^grimoire\.key\.[A-Za-z0-9.\/-]+$/;

function specError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  error.grimoire = makeError("E-VALID", code, message, detail === undefined ? null : detail);
  return error;
}

/** Default argument check: the handler accepts no arguments. */
function acceptNoArgs(args) {
  if (Object.keys(args).length > 0) {
    return {
      ok: false,
      code: "E_INPUT_INVALID_ARGS",
      message: "this command accepts no arguments",
    };
  }
  return { ok: true };
}

/**
 * Validate and freeze a handler spec. A malformed spec fails closed with a
 * structured E-VALID error (01 §11.1, 01 §13.5): no handler enters the
 * registry half-declared.
 */
export function defineHandler(spec) {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    throw specError("E_VALID_HANDLER_SPEC", "handler spec must be a plain object");
  }
  const { id, command, requiredTools, validateArgs, run } = spec;
  if (typeof id !== "string" || id.trim() === "") {
    throw specError("E_VALID_HANDLER_SPEC", "handler id must be a non-empty string", String(id));
  }
  if (typeof command !== "string" || !COMMAND_RE.test(command)) {
    throw specError("E_VALID_HANDLER_SPEC", "handler command must match grimoire.key.<KEY>", String(command));
  }
  if (!Array.isArray(requiredTools) || requiredTools.some((t) => typeof t !== "string" || t.trim() === "")) {
    throw specError("E_VALID_HANDLER_SPEC", `handler ${id} requiredTools must be an array of non-empty strings`);
  }
  if (validateArgs !== undefined && typeof validateArgs !== "function") {
    throw specError("E_VALID_HANDLER_SPEC", `handler ${id} validateArgs must be a function`);
  }
  if (typeof run !== "function") {
    throw specError("E_VALID_HANDLER_SPEC", `handler ${id} run must be a function`);
  }
  return Object.freeze({
    id,
    command,
    requiredTools: Object.freeze([...requiredTools]),
    validateArgs: typeof validateArgs === "function" ? validateArgs : acceptNoArgs,
    run,
  });
}

// ---------------------------------------------------------------------------
// Document execution helpers (the "files" tool: 01 §10.1, manifest requires)
// ---------------------------------------------------------------------------

/**
 * Open a repository document: read, fingerprint, and return it. This is the
 * observable execution of "opens X" for a repository with no UI surface —
 * the content is returned as the result of the invocation (the trace layer
 * references the fingerprint, it does not copy source content again).
 * Read failures throw and are classified by executeResolvedHotkey via
 * classifyException (E-ENV for ENOENT, E-TOOL for access failures, …).
 */
function openDocument(root, relPath) {
  const content = fs.readFileSync(path.join(root, relPath), "utf8");
  return {
    file: relPath,
    bytes: Buffer.byteLength(content, "utf8"),
    lines: content.split("\n").length,
    sha256: createHash("sha256").update(content, "utf8").digest("hex"),
    content,
  };
}

/**
 * Resolve "opens Part n" against the actual repository file set, never by
 * guessing: files matching `Part<n>` + `.md` or a non-digit continuation
 * (the repository's real Part4 is `Part4_AllLessons.md`). Deterministic
 * (sorted, unique match in this repository). Zero matches -> ENOENT, which
 * executeResolvedHotkey classifies (E-ENV) instead of inventing a target.
 */
function resolvePartFile(root, part) {
  const prefix = `Part${part}`;
  const pattern = new RegExp(`^${prefix}(?:\\.md|[^0-9].*\\.md)$`);
  const matches = fs.readdirSync(root).filter((name) => pattern.test(name)).sort();
  if (matches.length === 0) {
    const error = new Error(`document for ${prefix} not found in environment`);
    error.code = "ENOENT";
    throw error;
  }
  return matches[0];
}

function validatePartArgs(args) {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "args must be an object" };
  }
  const keys = Object.keys(args);
  if (keys.length !== 1 || keys[0] !== "part") {
    return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "PTn requires exactly args.part (integer 1–9)" };
  }
  const part = args.part;
  if (!Number.isInteger(part) || part < 1 || part > 9) {
    return { ok: false, code: "E_INPUT_INVALID_ARGS", message: "PTn args.part must be an integer 1–9" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The native write handler (Task 19 ruling `27` §R1/§R2/§R3; contract 14 §6.1)
//
// `handler.save-files` is L2 hotkey-module code — NOT a Tool Bus provider,
// NOT a new module, NOT a `grimoire.adapter.*`, NOT runtime-global fs
// behavior, and NOT an authorization point (the single GATE decides; this
// handler performs argument validation and workspace containment only).
// It exists only through `createSaveFilesHandler`, which the composition
// root calls with an EXPLICITLY declared workspace (Local Runtime
// `--workspace <dir>`, harness scenario workspace). With no workspace no
// handler is bound, so `G` stays UNIMPLEMENTED exactly as before (14 §7.1).
// ---------------------------------------------------------------------------

/** Refuse a save request before any filesystem call (27 §R4 row 1: E-INPUT). */
function invalidSave(message) {
  return { ok: false, code: "E_INPUT_INVALID_ARGS", message };
}

/**
 * The pure argument check for `save`: exactly `{file, content}` and the
 * §6.1.1 path grammar, plus lexical containment against the declared
 * workspace — no filesystem call happens here (14 §6.1). A symlink escape
 * is not observable purely; it is caught by the real-path containment belt
 * inside `run` (27 §R4 row 2).
 */
function validateSaveArgs(workspaceReal) {
  return (args) => {
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      return invalidSave("save requires exactly args {file, content}");
    }
    const keys = Object.keys(args).sort();
    if (keys.length !== 2 || keys[0] !== "content" || keys[1] !== "file") {
      return invalidSave("save requires exactly args {file, content}");
    }
    const { file, content } = args;
    if (typeof file !== "string" || file === "") {
      return invalidSave("args.file must be a non-empty string");
    }
    if (file.includes("\u0000") || /[\r\n]/.test(file)) {
      return invalidSave("args.file must not contain NUL or newline characters");
    }
    if (file.startsWith("/") || file.includes(":") || file.includes("\\")) {
      return invalidSave("args.file must be a relative /-separated path (no drive, colon, backslash)");
    }
    if (file.endsWith("/")) {
      return invalidSave("args.file must not end with /");
    }
    const segments = file.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      return invalidSave("args.file must contain no empty, '.' or '..' segments");
    }
    if (typeof content !== "string") {
      return invalidSave("args.content must be a string");
    }
    if (content === "") {
      return invalidSave("args.content must be non-empty");
    }
    if (content.includes("\u0000")) {
      return invalidSave("args.content must not contain NUL characters");
    }
    const resolved = path.resolve(workspaceReal, file);
    if (resolved !== workspaceReal && !resolved.startsWith(workspaceReal + path.sep)) {
      return invalidSave("args.file resolves outside the declared workspace");
    }
    return { ok: true };
  };
}

/** A write-path failure: the ONE newly authorized module code (27 §R4). */
function writeFailure(message, detail) {
  const error = new Error(message);
  error.code = "E_TOOL_WRITE_FAILED";
  error.grimoire = makeError("E-TOOL", "E_TOOL_WRITE_FAILED", message, detail === undefined ? null : detail);
  return error;
}

/** Real-path containment with a separator boundary (/workspace ≠ /workspace-other). */
const isInside = (target, root) => target === root || target.startsWith(root + path.sep);

/**
 * The one `save` operation (27 §R2): create-or-overwrite of exactly one
 * UTF-8 text file inside the declared workspace. No append, no mkdir, no
 * rename/move/delete, no binary mode, no multi-file — and no atomicity
 * claim. Failure mapping (27 §R4, 14 §5.1):
 *   ENOENT (missing parent)  → thrown as-is → E_ENV_MISSING_FILE · E-ENV
 *   containment / EISDIR /
 *   EACCES / EPERM / ELOOP … → E_TOOL_WRITE_FAILED · E-TOOL
 *   anything else            → E_UNKNOWN_EXCEPTION (classifyException)
 */
function saveFilesRun(workspaceReal) {
  return ({ args }) => {
    const target = path.resolve(workspaceReal, args.file);
    // Real-path containment of the parent directory (27 §R3.4): a symlink
    // anywhere along the parent chain that redirects outside is refused.
    let realParent;
    try {
      realParent = fs.realpathSync(path.dirname(target));
    } catch (error) {
      if (error && error.code === "ENOENT") throw error; // missing parent → E_ENV_MISSING_FILE
      throw writeFailure("workspace parent path could not be resolved", error && error.code ? String(error.code) : "unknown");
    }
    if (!isInside(realParent, workspaceReal)) {
      throw writeFailure("target escapes the declared workspace", "containment");
    }
    let writePath = path.join(realParent, path.basename(target));
    let existed = true;
    try {
      const stat = fs.lstatSync(writePath);
      if (stat.isSymbolicLink()) {
        let real;
        try {
          real = fs.realpathSync(writePath);
        } catch (error) {
          throw writeFailure("symlink target could not be resolved inside the workspace", error && error.code ? String(error.code) : "unknown");
        }
        if (!isInside(real, workspaceReal)) {
          throw writeFailure("symlink escapes the declared workspace", "containment");
        }
        writePath = real;
      }
    } catch (error) {
      if (error && error.code === "E_TOOL_WRITE_FAILED") throw error;
      if (error && error.code === "ENOENT") existed = false;
      else throw writeFailure("workspace target could not be inspected", error && error.code ? String(error.code) : "unknown");
    }
    if (existed) {
      let stat;
      try {
        stat = fs.statSync(writePath);
      } catch (error) {
        if (error && error.code === "ENOENT") stat = null;
        else throw writeFailure("workspace target could not be inspected", error && error.code ? String(error.code) : "unknown");
      }
      if (stat !== null && stat.isDirectory()) {
        throw writeFailure("target is a directory", "EISDIR"); // directory target → E_TOOL_WRITE_FAILED
      }
      if (stat !== null && !stat.isFile()) {
        throw writeFailure("target is not a regular file", "unsupported target type");
      }
    }
    try {
      fs.writeFileSync(writePath, args.content, { encoding: "utf8" });
    } catch (error) {
      if (error && error.code === "ENOENT") throw error;
      throw writeFailure("native write failed", error && error.code ? String(error.code) : "unknown");
    }
    return {
      file: args.file,
      bytes: Buffer.byteLength(args.content, "utf8"),
      lines: args.content.split("\n").length,
      sha256: createHash("sha256").update(args.content, "utf8").digest("hex"),
      content: args.content,
    };
  };
}

/**
 * Composition-root factory (27 §R3, 14 §6.1): build `handler.save-files`
 * bound to one EXPLICITLY declared workspace. Construction refuses an
 * invalid workspace configuration — missing, non-directory, or any path
 * that equals, contains, or is contained by the Grimoire repository root —
 * so no implicit, environment-, cwd-, or repo-derived workspace can exist.
 * Returns a handler ready for the `createRuntime({ handlers })` map keyed
 * by `grimoire.key.G`.
 */
export function createSaveFilesHandler({ workspace, repositoryRoot } = {}) {
  const configFailure = (message, detail) => {
    const error = new Error(message);
    error.code = "E_INPUT_INVALID_RUNTIME_CONFIG";
    error.grimoire = makeError("E-INPUT", "E_INPUT_INVALID_RUNTIME_CONFIG", message, detail === undefined ? null : detail);
    return error;
  };
  if (typeof workspace !== "string" || workspace.trim() === "") {
    throw configFailure("workspace must be a non-empty explicit composition-root declaration", typeof workspace);
  }
  if (typeof repositoryRoot !== "string" || repositoryRoot.trim() === "") {
    throw configFailure("repositoryRoot must be a non-empty string", typeof repositoryRoot);
  }
  let workspaceReal;
  try {
    workspaceReal = fs.realpathSync(path.resolve(workspace));
  } catch {
    throw configFailure("workspace must exist", workspace);
  }
  let workspaceStat;
  try {
    workspaceStat = fs.statSync(workspaceReal);
  } catch {
    throw configFailure("workspace must exist", workspace);
  }
  if (!workspaceStat.isDirectory()) {
    throw configFailure("workspace must be a directory", workspace);
  }
  const repositoryReal = fs.realpathSync(path.resolve(repositoryRoot));
  // The Grimoire repository root is categorically not a writable workspace
  // (27 §R3.3): equal, inside, or containing — all refused at construction.
  if (workspaceReal === repositoryReal) {
    throw configFailure("the Grimoire repository root is not a writable native-write workspace");
  }
  if (workspaceReal.startsWith(repositoryReal + path.sep)) {
    throw configFailure("workspace must be outside the Grimoire repository root");
  }
  if (repositoryReal.startsWith(workspaceReal + path.sep)) {
    throw configFailure("workspace must not contain the Grimoire repository root");
  }
  return defineHandler({
    id: "handler.save-files",
    command: "grimoire.key.G",
    requiredTools: ["files"],
    validateArgs: validateSaveArgs(workspaceReal),
    run: saveFilesRun(workspaceReal),
  });
}

// ---------------------------------------------------------------------------
// The default handler set (Task 06): three documented document-open
// behaviors. Every other ACTIVE record stays UNIMPLEMENTED until a real,
// documented behavior exists — see docs/v3/14-hotkey-runtime.md §9.
// `handler.save-files` is deliberately NOT in this set: it exists only via
// createSaveFilesHandler with an explicit workspace (14 §6.1 availability
// rule), so the default wiring stays byte-identical.
// ---------------------------------------------------------------------------

/** Tools this runtime provides by default (manifest `requires.tools`). */
export const DEFAULT_AVAILABLE_TOOLS = Object.freeze(["files"]);

export const DEFAULT_HANDLERS = Object.freeze({
  // `R` — "open Readme.md" (12 §2 row 6: TEACH, output "readme content").
  "grimoire.key.R": defineHandler({
    id: "handler.readme",
    command: "grimoire.key.R",
    requiredTools: ["files"],
    run: ({ root }) => openDocument(root, "Readme.md"),
  }),

  // `PN` — "open patch notes" (12 §2 row 7: ANSWER, output "version history").
  "grimoire.key.PN": defineHandler({
    id: "handler.patch-notes",
    command: "grimoire.key.PN",
    requiredTools: ["files"],
    run: ({ root }) => openDocument(root, "PatchNotes.md"),
  }),

  // `PTn` — "opens Part n" (12 §2 row 4: TEACH, output "part content").
  // args = { part: 1…9 }; missing/invalid args -> INVALID_INPUT (§6 D).
  "grimoire.key.PTn": defineHandler({
    id: "handler.open-part",
    command: "grimoire.key.PTn",
    requiredTools: ["files"],
    validateArgs: validatePartArgs,
    run: ({ root, args }) => openDocument(root, resolvePartFile(root, args.part)),
  }),
});
