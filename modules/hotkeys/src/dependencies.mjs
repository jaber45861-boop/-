// Grimoire v3 — Hotkeys module: Tool Bus dependency report (Task 07).
//
// Direction check (02 §3 rule 1): L2 (hotkeys) consumes L1 (Tool Bus) — this
// file imports the bus only as a duck-typed dependency (anything exposing
// check(capabilityId)), and the bus never imports this module.
//
// For every ACTIVE hotkey record (directive §Tool Requirements from Hotkeys):
//   1. read its declared tools (12 §2 Tools column)
//   2. union the handler's declared tools when a runtime handler exists
//      (execution genuinely depends on them — e.g. `files` for document keys)
//   3. resolve each capability on the Tool Bus (exact id, no fuzzy matching)
//   4. record the deterministic outcome per row
//
// Outcomes (never collapsed; per-tool bus codes stay in the row):
//   READY               every declared capability is AVAILABLE (or none)
//   TOOL_REQUIRED       at least one capability is missing/unavailable/disabled
//   DEPENDENCY_BLOCKED  at least one capability is BLOCKED (or blocks on a dep)
//   VALIDATION_ERROR    at least one capability declaration failed validation
// Precedence: VALIDATION_ERROR > DEPENDENCY_BLOCKED > TOOL_REQUIRED > READY.

import { DEFAULT_HANDLERS } from "./handlers.mjs";
import { recordTools } from "./runtime.mjs";

const BLOCKED_CODES = new Set(["TOOL_BLOCKED", "DEPENDENCY_BLOCKED"]);

const stripTicks = (value) => String(value).replace(/^`+|`+$/g, "");

function outcomeFor(checks) {
  const codes = checks.map((c) => c.code);
  if (codes.includes("CAPABILITY_INVALID")) return "VALIDATION_ERROR";
  if (codes.some((code) => BLOCKED_CODES.has(code))) return "DEPENDENCY_BLOCKED";
  if (codes.some((code) => code !== "TB_OK")) return "TOOL_REQUIRED";
  return "READY";
}

/**
 * Deterministic per-record dependency rows for the ACTIVE set, in registry
 * order. Same runtime + same bus => byte-identical rows.
 */
export function hotkeyToolDependencies(runtime, toolBus) {
  const rows = [];
  const active = runtime.validation.records.filter((record) => record.activation_status === "ACTIVE");
  for (const record of active) {
    const command = stripTicks(record.command);
    const handler = DEFAULT_HANDLERS[command] ?? null;
    const tokens = [...new Set([...recordTools(record), ...(handler ? handler.requiredTools : [])])];
    const tools = tokens.map((tool) => {
      const check = toolBus.check(tool);
      return { tool, ok: check.ok === true, code: check.code };
    });
    rows.push({ key: record.key, command, mode: record.mode, tools, outcome: outcomeFor(tools) });
  }
  return rows;
}
