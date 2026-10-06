# Grimoire v3 — Local Runtime (Task 16)

**Scope:** the smallest local CLI shell around the existing contracts —
`node runtime/local-runtime.mjs …`. It CONSUMES the Planner, Plan–Execution
Composition, approval GATE, Agent, Tool Bus, Hotkey Runtime, and Report Bus;
it redefines none of them and adds no web UI, server, database, or package
manager. This document answers only the nine local-run questions below.

## 1. Prerequisites

- Node.js 18 or newer (the suite runs on the built-in `node:test` runner).
- A checkout of this repository. There is no `package.json` and no install
  step — plain Node ESM only.
- The commands below run from the repository root. Repository paths are
  resolved from the runtime file itself, so the runtime also works from a
  subdirectory; the tests assume the repository root.

## 2. How to run the tests

```bash
node --test test/*.test.mjs               # the full suite
node --test test/local-runtime.test.mjs   # only Task 16's integration tests (I-01 … I-10)
```

Both must report `0 fail`, `0 skipped`, `0 todo` and exit 0.

## 3. How to run the Local Runtime

```bash
node runtime/local-runtime.mjs [--approval grant|deny] [--workspace <dir>] <input.json | ->
```

- `<input.json>` — path to a JSON bundle file.
- `-` — read the JSON bundle from stdin, e.g.
  `cat test/_fixtures/composition_request.json | node runtime/local-runtime.mjs -`
- `--approval grant|deny` — explicitly requested demo verdicts (§7).
  Omitted means no approval component exists.
- `--workspace <dir>` — an explicitly declared, writable native-write
  workspace directory (§3.1). **Contract-only in Task 20** — documented by
  the Task 19 ruling (`27`) and implemented no earlier than Task 21.

No interactive prompts; one command per run.

### 3.1 Native write workspace contract (`--workspace`)

This section documents the authorized opt-in interface only. **Task 20 is a
contract task: no CLI implementation exists yet** — the runtime's accepted
flags, input handling, and output are unchanged by this document, and no
implementation task may start before the Task 20 contract lands (`27` R7).

- **Default (no `--workspace`):** the Local Runtime behaves exactly as
  Task 16 left it. `G` remains unavailable / `UNIMPLEMENTED`, the default
  wiring stays byte-identical, and every exit code in §8 is unchanged.
- **Opt-in (with `--workspace <dir>`):** the directory is an explicit
  composition-root dependency. Given an explicitly valid workspace, `G`
  **may be wired** to `handler.save-files` (`14` §6.1). The flag is the
  caller's declaration, not a discovery mechanism: the workspace is never
  derived from the bundle, execution args, cwd, environment, pid, clock, or
  globals (`27` R3).
- **The Grimoire repository root is categorically not a writable
  native-write workspace.** A workspace that resolves to (or escapes to) the
  repository root, an absolute path outside the declared directory, a `..`
  traversal, or a symlink target outside the declared directory is refused
  — at construction, not per write.
- `--workspace` changes no exit code and adds no success path by itself:
  binding the handler does not bypass the approval GATE (`23`), and any
  native write failure is classified per `14` §5.1 — no write failure may
  ever produce `COMPLETED`.
- There is **no implicit root**: without the explicit declaration there is
  no workspace at all, and nothing in the runtime searches for one.

## 4. How to give it input

One JSON object with exactly the bundle shape the composition contract
already defines — the same format as `test/_fixtures/composition_request.json`:

```json
{
  "plan": {
    "task": "Add input validation to createUser",
    "tier": "T2",
    "changes": [{ "file": "src/api/users.ts", "why": "validate email and password in createUser()" }],
    "verification": ["node --test test/users.test.mjs"],
    "risks": ["existing callers may rely on permissive input"]
  },
  "execution": {
    "kind": "hotkey",
    "module": "hotkeys",
    "capability": "hotkeys:execute",
    "phase": "RUN",
    "target": { "key": "R" }
  }
}
```

- `plan` is the Planner's request (`task`, `tier`, `changes`, `verification`,
  `risks`, and an optional `trigger`: `intent-change` | `migration` |
  `architecture`).
- `execution` is the Agent's execution sub-request, supplied explicitly by
  the caller — the runtime never derives it from the task, changes, or
  verification.
- The bundle carries exactly `[plan, execution]`; any extra member
  (including `approval`) refuses with `INVALID_REQUEST` — approval is never
  bundle data (`23` §2).
- A plan with `tier: "T2"` **and** a `trigger` sets `review.required =
  true`, so the approval gate applies. Two ready-made inputs:
  `test/_fixtures/composition_request.json` (ungated) and
  `test/_fixtures/local_runtime_gated.json` (gated, `trigger: "migration"`).

## 5. How to make a successful run

```bash
node runtime/local-runtime.mjs test/_fixtures/composition_request.json
echo $?    # 0
```

Success is exit code `0` with the header line
`"ok":true,"code":"COMPLETED"`. The run goes Planner → VALIDATE/PLAN →
GATE (`GATE: done (review not required)`) → Agent → Tool Bus → Hotkey
Runtime → Report and prints the five-section completion report. Nothing is
written to stderr.

## 6. How to test approval refusal

Give the runtime a review-required plan with no authorization:

```bash
node runtime/local-runtime.mjs test/_fixtures/local_runtime_gated.json
echo $?    # 3
```

Expected: exit code `3`, header `"code":"APPROVAL_REQUIRED","stage":"GATE"`
with detail `plan review is required before execution (migration) — the
approval gate belongs to the policy/approval contract` (D0), the agent
never runs, and the refusal report never reads `| Status | COMPLETED |`.
The runtime never creates an approval component on its own.

## 7. How to test approved execution

The same gated input with the explicitly requested demo verdict:

```bash
node runtime/local-runtime.mjs --approval grant test/_fixtures/local_runtime_gated.json
echo $?    # 0 — report ledger shows "GATE: done (approval verified)"

node runtime/local-runtime.mjs --approval deny test/_fixtures/local_runtime_gated.json
echo $?    # 3 — detail "approval verdict not affirmative"
```

`grant`/`deny` are disclosed **test doubles**: the flag is the explicit
authorization, the verdict is computed per call from the plan and execution
the GATE hands the component (nothing is stored or cached), and the GATE
still performs every check D0–D6 itself — a wrong binding or a malformed
verdict still refuses. Real approval wiring injects a component
programmatically through `runLocalRuntime(bundle, { approval })`; the
composer contract (`23` §2) is unchanged.

## 8. How to read the output

Stdout is deterministic and has two parts:

1. **Line 1** — one JSON header: `ok`, `code`, `status`, `stage`, `error`
   (`null` on success), `reportSha256`.
2. **Everything after the first line** — the Report Bus text verbatim
   (summary, results, phase ledger, evidence, remaining issues); empty when
   the report step itself refused. Its bytes hash to `reportSha256`.

Stderr carries only `INPUT ERROR: …` (usage or unparseable input; nothing
is printed on stdout) or `RUNTIME ERROR: …` (unexpected exception). A
successful run prints no diagnostics and no stack traces. Exit codes:

| Code | Meaning |
|---|---|
| `0` | `COMPLETED` — the only success |
| `1` | planner refusal (`PLAN_INCOMPLETE`) or an unexpected runtime error |
| `2` | invalid input (usage error, unreadable/unparseable JSON, `INVALID_REQUEST`) |
| `3` | approval refusal (`APPROVAL_REQUIRED` — the gate stayed closed) |
| `4` | agent refusal or failure (e.g. `EXECUTION_REFUSED`) |
| `5` | report failure (`REPORT_FAILED` — completion is never claimed) |

Task 20 changes none of these exit codes: `--workspace` (`24` §3.1) is a
documented contract only, and a refused or failed native write maps onto the
codes above, never onto a new exit code and never onto `0`/`COMPLETED`.

No timestamps, random ids, or machine paths appear anywhere in the output:
identical input renders byte-identically.

## 9. How to repeat the experiment

- Re-run the same command: byte-identical stdout and the same exit code.
  Each run builds a fresh wiring — no cached plan, verdict, or report, and
  no counts leak between runs (I-09).
- Vary one thing at a time: remove or add `"trigger": "migration"` for
  ungated vs. gated, switch `--approval grant|deny`, change the `target`
  key (an unknown key is a real agent refusal, exit `4`), or add an extra
  bundle field (exit `2`) — each maps to one refusal class from §8.
- The ten scenarios I-01…I-10 are executable in
  `test/local-runtime.test.mjs` and specified in
  `docs/v3/05-acceptance-tests.md` (Group S).
