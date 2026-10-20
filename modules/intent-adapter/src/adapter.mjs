// Grimoire v3 — Intent Adapter (Phase 1, build-agent directive).
//
// Position: the planning front door for a user intent. It is a THIN
// conforming step, never a second Planner and never an execution layer:
//
//   intent text (JSON envelope)
//     → E1  intent envelope check        (adapter-owned)
//     → provider.complete(intent)        (INJECTED — deterministic demo
//                                          provider is the Phase-1 default;
//                                          no network, no keys, no env)
//     → PR1 provider result shape check  (adapter-owned)
//     → C1  explicit command formulations (adapter-owned policy, below)
//     → P1  path policy                  (adapter-owned policy, below)
//     → R1  Planner contract validator   (INJECTED — the Planner entry's
//                                          own validatePlanRequest, passed
//                                          in by the composition root)
//     → frozen plan request → Planner.plan() by the composition root
//
// Refusal discipline: every violation returns { ok:false } with the precise
// rule id in the detail. Nothing is ever fixed, guessed, defaulted into
// conformance, or executed. The module touches no file system, opens no
// network, reads no environment, and imports nothing from another module.
//
// Rule vocabulary (INTENT_RULES, documented in docs/v3/36-intent-adapter.md):
//   E1  — the intent envelope is not exactly the declared intent contract.
//   PR1 — the provider result is not a plain object / valid JSON object.
//   C1  — an explicit command formulation appeared in a prose field:
//           C1a command substitution "$( … )";
//           C1b a Tier-1 system/shell command token at a command position
//               (start of the field, or right after ";", "&&", "||", "|",
//               "(" or a newline — whole-token, case-sensitive);
//           C1c an invocation marker anywhere in the field: a flag
//               ("-x"/"--x") or a URL argument after a Tier-1/Tier-2
//               token, an absolute-path argument after a Tier-1 token, or
//               a write/network subcommand after a Tier-2 token when the
//               token sits after a separator or a flag follows later in
//               the field; plus a path-like argument after a Tier-2 token
//               when that token is itself at a command position;
//           C1d a redirection (">"/">>") aimed at an absolute or "~/"
//               path. Bare metacharacters in natural prose are NOT
//               violations: "Add validation; update docs", "node upgrades
//               break types", "git log shows stale entries" and
//               "npm test passes" are accepted (Phase-1 amendment:
//               precision over pattern matching). Command mentions that
//               are not invocations belong in verification[], which is
//               exempt — 01 §5.3.
//   P1  — a changes[].file path is not a plain relative workspace path
//         (no absolute "/", no "~", no backslash, no "."/".." segment).
//   R1  — the assembled request failed the Planner's own contract
//         validator; the first violation's code + detail pass through
//         UNCHANGED (INVALID_REQUEST → E-INPUT, PLAN_INCOMPLETE → E-VALID).
//
// verification[] is deliberately EXEMPT from C1: 01 §5.3 says plans
// reference real commands, so command strings belong to exactly that
// field. This path never executes anything — execution remains behind
// the explicit bundle path, the GATE, and the approval contract.

export const INTENT_FIELDS = Object.freeze([
  "request",
  "tier",
  "changes",
  "verification",
  "risks",
  "trigger",
]);

/** The rule ids this adapter can name in a refusal detail. */
export const INTENT_RULES = Object.freeze(["E1", "PR1", "C1", "P1", "R1"]);

/** 01 §11.1 — the seven Core classes, built locally (02 §3 rule 3). */
export const CORE_ERROR_CLASSES = Object.freeze([
  "E-INPUT",
  "E-ENV",
  "E-DEP",
  "E-CONFLICT",
  "E-TOOL",
  "E-VALID",
  "E-UNKNOWN",
]);

/** Classes this module can raise (manifest `errors:` subset). */
export const INTENT_ERROR_CLASSES = Object.freeze(["E-INPUT", "E-VALID"]);

/** Build a structured error object (never a string, never a stack dump). */
export function makeError(klass, code, message, detail) {
  return {
    class: klass,
    code,
    message,
    detail: detail === undefined ? null : detail,
  };
}

export function isCoreErrorClass(value) {
  return CORE_ERROR_CLASSES.includes(value);
}

// ---------------------------------------------------------------------------
// C1 token vocabulary — closed, documented lists (docs/v3/36 §C1).
// Case-sensitive: prose sentences capitalize their first word, commands are
// lowercase. Whole-token matching only ("rmx" is not "rm").
// ---------------------------------------------------------------------------

/**
 * Tier-1 — unambiguous system/shell commands. Flagged in ANY command
 * position (start of field or after a separator): no English prose
 * sentence legitimately begins with, or continues after ";" with, one of
 * these tokens.
 */
const SYSTEM_COMMANDS = Object.freeze([
  "rm", "rmdir", "sudo", "su", "doas", "chmod", "chown", "chgrp",
  "curl", "wget", "aria2c", "nc", "ncat", "netcat", "telnet",
  "ssh", "scp", "sftp", "ftp", "dd", "mkfs", "mkfifo",
  "mount", "umount", "shutdown", "reboot", "halt", "poweroff",
  "killall", "pkill", "useradd", "userdel", "usermod", "chpasswd",
  "passwd", "crontab", "systemctl", "base64", "mshta", "certutil",
  "wmic", "powershell", "bash", "sh", "zsh", "dash", "ksh", "fish",
  "nohup", "setsid", "eval", "sed", "awk",
]);

/**
 * Tier-2 — dev/package/container tools whose tokens also appear in normal
 * prose ("node upgrades break types", "git log shows stale entries").
 * Flagged only with an invocation marker (see C1c), and at start of field
 * only for a leading flag — a prose title like "git push hooks break CI"
 * stays valid.
 */
const DEV_TOOLS = Object.freeze([
  "node", "npm", "npx", "bun", "yarn", "pnpm", "git", "docker",
  "kubectl", "python", "python3", "pip", "pip3", "ruby", "perl",
  "php", "java", "cargo", "apt", "apt-get", "yum", "dnf", "apk",
]);

/**
 * Write/network subcommands that mark a Tier-2 token as an explicit
 * command AFTER a separator (start-of-field position never uses this
 * marker). Read-only subcommands (git log/diff/show/status, npm test, …)
 * are deliberately absent: they are plausible prose after a separator.
 */
const WRITE_SUBCOMMANDS = Object.freeze({
  git: ["push", "pull", "fetch", "commit", "reset", "clean", "rebase",
    "merge", "checkout", "stash", "rm", "mv", "add", "init",
    "cherry-pick", "revert", "restore", "switch", "clone", "gc",
    "am", "apply"],
  npm: ["install", "ci", "run", "publish", "pack", "exec", "dedupe",
    "link", "unlink", "add", "remove", "update"],
  npx: ["exec"],
  bun: ["install", "add", "remove", "run", "publish"],
  yarn: ["install", "add", "remove", "publish", "upgrade"],
  pnpm: ["install", "add", "remove", "publish", "update"],
  docker: ["build", "run", "push", "pull", "exec", "rm"],
  pip: ["install", "uninstall", "download"],
  pip3: ["install", "uninstall", "download"],
  kubectl: ["apply", "delete", "exec", "rollout"],
  apt: ["install", "remove", "update", "upgrade", "purge"],
  "apt-get": ["install", "remove", "update", "upgrade", "purge"],
  cargo: ["build", "install", "publish", "run"],
  yum: ["install", "remove", "update"],
  dnf: ["install", "remove", "update"],
  apk: ["add", "del", "update"],
  ruby: [],
  perl: [],
  php: [],
  java: [],
});

/** Command positions: start of field, or right after one of these. */
const SEPARATOR_SOURCE = "(?:&&|\\||\\(|;|\\n)";

const escapeForRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATH_LIKE_RE = /^(?:~\/|\.?\/)|\.(?:m?js|cjs|ts|tsx|jsx|py|sh|json|ya?ml|toml|lock|md)$/;
const URL_RE = /^https?:\/\//;
const FLAG_RE = /^-/;
const ABSOLUTE_PATH_RE = /^(?:~\/|\/)/;

/** A token sits at a command position: start of the field (only whitespace
 *  before it) or immediately after a separator (only whitespace between). */
const COMMAND_POSITION_END_RE = new RegExp(`(?:^|${SEPARATOR_SOURCE})\\s*$`);
const atCommandPosition = (value, index) => COMMAND_POSITION_END_RE.test(value.slice(0, index));

/** The whitespace-delimited argument that follows a token, or null. */
const argumentAfter = (value, endIndex) => {
  const match = value.slice(endIndex).match(/^\s+([^\s]+)/);
  return match === null ? null : match[1];
};

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isSingleLine = (value) => typeof value === "string" && !/[\r\n]/.test(value);

const messageOf = (error) =>
  error && typeof error.message === "string" && error.message !== "" ? error.message : String(error);

/** Report-safe single-line rendering for refusal details. */
const oneLine = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();

/**
 * Find every C1/C1d violation in ONE prose field.
 * Returns an array of precise findings (empty = clean). Deterministic:
 * fixed rule order, fixed regexes, no time/random input anywhere.
 */
export function findCommandFormulations(value) {
  const found = [];
  if (typeof value !== "string") return found;

  // C1a — command substitution has no prose use.
  if (value.includes("$(")) {
    found.push('C1a command substitution "$( … )"');
  }

  // C1b + C1c — Tier-1 system commands: always a violation at a command
  // position; elsewhere only with a hard invocation marker (flag, URL, or
  // absolute-path argument).
  const systemPattern = new RegExp(`\\b(?:${SYSTEM_COMMANDS.map(escapeForRegex).join("|")})\\b`, "g");
  for (const match of value.matchAll(systemPattern)) {
    const token = match[0];
    if (atCommandPosition(value, match.index)) {
      found.push(`C1b system command "${token}" at a command position`);
      continue;
    }
    const argument = argumentAfter(value, match.index + token.length);
    if (argument !== null && (FLAG_RE.test(argument) || URL_RE.test(argument) || ABSOLUTE_PATH_RE.test(argument))) {
      found.push(`C1c command invocation "${token} ${argument}"`);
    }
  }

  // C1c — Tier-2 dev tools: a flag or URL argument anywhere is an
  // invocation head ("node --inspect", "curl https://…"); a write/network
  // subcommand refuses only with a second signal — the tool token
  // after a separator ("…; git push origin main") or a flag later in the
  // field ("then git push --force …") — so a field that merely TALKS
  // about a command ("git push hooks break CI") stays prose; a path-like
  // argument counts only at a command position.
  const devPattern = new RegExp(`\\b(?:${DEV_TOOLS.map(escapeForRegex).join("|")})\\b`, "g");
  for (const match of value.matchAll(devPattern)) {
    const token = match[0];
    const argument = argumentAfter(value, match.index + token.length);
    if (argument === null) continue;
    if (FLAG_RE.test(argument) || URL_RE.test(argument)) {
      found.push(`C1c command invocation "${token} ${argument}"`);
      continue;
    }
    if ((WRITE_SUBCOMMANDS[token] ?? []).includes(argument)) {
      // After a separator ("…; git push origin main") or with a flag later
      // ("then git push --force …"). Start-of-field WITHOUT a flag stays
      // prose: "git push hooks break CI" talks ABOUT the command.
      const afterSeparator = /(?:&&|\||\(|;|\n)\s*$/.test(value.slice(0, match.index));
      const flagLater = /\s--?[A-Za-z0-9]/.test(
        value.slice(match.index + token.length + argument.length)
      );
      if (afterSeparator || flagLater) {
        found.push(`C1c command invocation "${token} ${argument}"`);
        continue;
      }
    }
    if (atCommandPosition(value, match.index) && PATH_LIKE_RE.test(argument)) {
      found.push(`C1c command invocation "${token} ${argument}"`);
    }
  }

  // C1d — redirection aimed at an absolute or home path.
  if (/(?:^|[\s;(&|])>{1,2}\s*(?:~\/|\/)/.test(value)) {
    found.push("C1d redirection to an absolute path");
  }

  return found;
}

/**
 * P1 — changes[].file policy: a plain relative workspace path.
 * Returns a precise detail, or null when the value is a string that
 * conforms (non-string values are the Planner contract validator's job).
 */
export function checkPathPolicy(file) {
  if (typeof file !== "string") return null;
  if (file === "") return 'P1 empty path ""';
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(file)) {
    return `P1 "${file}" is not a plain relative path (no absolute "/", no "~", no backslash, no spaces)`;
  }
  if (file.split("/").some((segment) => segment === "." || segment === "..")) {
    return `P1 "${file}" contains a traversal segment`;
  }
  return null;
}

/** E1 — the intent envelope is exactly the declared contract. */
function checkEnvelope(intent) {
  if (!isPlainObject(intent)) {
    return `E1 intent must be a plain object (${typeof intent})`;
  }
  const unexpected = Object.keys(intent)
    .filter((field) => !INTENT_FIELDS.includes(field))
    .sort();
  if (unexpected.length > 0) {
    return `E1 intent field "${unexpected[0]}" does not belong to the intent contract`;
  }
  if (!isNonEmptyString(intent.request)) {
    return `E1 intent.request must be a non-empty string (${JSON.stringify(intent.request)})`;
  }
  if (!isSingleLine(intent.request)) {
    return "E1 intent.request must be a single-line string";
  }
  return null;
}

/** PR1 — the provider result is usable contract data. */
function checkProviderResult(raw) {
  if (isPlainObject(raw)) return { ok: true, candidate: raw };
  if (typeof raw === "string") {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, detail: "PR1 provider output is not valid JSON" };
    }
    if (isPlainObject(parsed)) return { ok: true, candidate: parsed };
    return { ok: false, detail: `PR1 provider output JSON is not a plain object (${typeof parsed})` };
  }
  return { ok: false, detail: `PR1 provider output must be a plain object or a JSON object string (${typeof raw})` };
}

/** Deep-freeze a validated candidate (ownership copy — caller state untouched). */
function freezeCandidate(candidate) {
  const copy = { ...candidate };
  if (Array.isArray(copy.changes)) {
    copy.changes = Object.freeze(copy.changes.map((change) => Object.freeze({ ...change })));
  }
  if (Array.isArray(copy.verification)) {
    copy.verification = Object.freeze([...copy.verification]);
  }
  if (Array.isArray(copy.risks)) {
    copy.risks = Object.freeze([...copy.risks]);
  }
  return Object.freeze(copy);
}

function configError(message, detail) {
  const error = new Error(message);
  error.code = "E_INPUT_INVALID_INTENT_ADAPTER_CONFIG";
  error.grimoire = makeError("E-INPUT", "E_INPUT_INVALID_INTENT_ADAPTER_CONFIG", message, detail === undefined ? null : detail);
  return error;
}

/**
 * Construct the adapter. Both dependencies are INJECTED by the composition
 * root — there is no other construction path, no default provider inside
 * this function, and no environment lookup (02 §3 rule 3: no lateral
 * coupling, no environment magic).
 *
 *   provider        — must expose complete(intent) (see providers.mjs for
 *                     the deterministic Phase-1 demo provider).
 *   validateRequest — the Planner contract validator (validatePlanRequest
 *                     from the Planner entry), injected by the root.
 */
export function createIntentAdapter({ provider, validateRequest } = {}) {
  if (!isPlainObject(provider) || typeof provider.complete !== "function") {
    throw configError("provider must expose complete()", "provider.complete");
  }
  if (typeof validateRequest !== "function") {
    throw configError(
      "validateRequest must be the injected Planner contract validator",
      "validateRequest"
    );
  }

  const adapter = Object.freeze({
    /**
     * Propose one plan request from one intent. Always returns a frozen
     * object: { ok, request } on success, or
     * { ok:false, code, status:"REFUSED", stage:"ADAPT", error, request:null }
     * on refusal — never a thrown contract error, never a fixed-up result.
     */
    propose(intent) {
      const refuse = (code, klass, detail) =>
        Object.freeze({
          ok: false,
          code,
          status: "REFUSED",
          stage: "ADAPT",
          error: makeError(klass, code, "intent proposal refused", detail),
          request: null,
        });

      const envelope = checkEnvelope(intent);
      if (envelope !== null) return refuse("INVALID_REQUEST", "E-INPUT", envelope);

      let raw;
      try {
        raw = provider.complete(intent);
      } catch (error) {
        return refuse("INVALID_REQUEST", "E-INPUT", `PR1 provider threw: ${oneLine(messageOf(error))}`);
      }

      const checked = checkProviderResult(raw);
      if (!checked.ok) return refuse("INVALID_REQUEST", "E-INPUT", checked.detail);
      const candidate = checked.candidate;

      // C1 — prose fields only; verification[] is exempt by 01 §5.3.
      const prose = [];
      if (typeof candidate.task === "string") prose.push(["task", candidate.task]);
      if (Array.isArray(candidate.changes)) {
        candidate.changes.forEach((change, index) => {
          if (isPlainObject(change) && typeof change.why === "string") {
            prose.push([`changes[${index}].why`, change.why]);
          }
        });
      }
      if (Array.isArray(candidate.risks)) {
        candidate.risks.forEach((risk, index) => {
          if (typeof risk === "string") prose.push([`risks[${index}]`, risk]);
        });
      }
      for (const [label, text] of prose) {
        const findings = findCommandFormulations(text);
        if (findings.length > 0) {
          return refuse("INVALID_REQUEST", "E-INPUT", `${label}: ${findings[0]}`);
        }
      }

      // P1 — path policy on every declared change target.
      let pathRefusal = null;
      if (Array.isArray(candidate.changes)) {
        candidate.changes.forEach((change, index) => {
          if (!isPlainObject(change)) return;
          const violation = checkPathPolicy(change.file);
          if (violation !== null && pathRefusal === null) {
            pathRefusal = `changes[${index}].file ${violation}`;
          }
        });
      }
      if (pathRefusal !== null) return refuse("INVALID_REQUEST", "E-INPUT", pathRefusal);

      // R1 — the Planner's own contract validator; first violation passes
      // through unchanged (never repaired, never re-worded).
      const violations = validateRequest(candidate);
      if (Array.isArray(violations) && violations.length > 0) {
        const first = violations[0];
        const klass = first.code === "PLAN_INCOMPLETE" ? "E-VALID" : "E-INPUT";
        const code = first.code === "PLAN_INCOMPLETE" ? "PLAN_INCOMPLETE" : "INVALID_REQUEST";
        return refuse(code, klass, oneLine(first.detail));
      }

      return Object.freeze({ ok: true, request: freezeCandidate(candidate) });
    },
  });

  return adapter;
}
