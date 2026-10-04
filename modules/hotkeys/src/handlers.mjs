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
// The default handler set (Task 06): three documented document-open
// behaviors. Every other ACTIVE record stays UNIMPLEMENTED until a real,
// documented behavior exists — see docs/v3/14-hotkey-runtime.md §9.
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
