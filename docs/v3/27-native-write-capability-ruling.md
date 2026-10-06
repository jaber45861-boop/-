# Task 19 — Executive Ruling: Native Write Capability

**Status:** Task 19 decision record · decision-only · documentation artifact, no code
**Source of authority for this ruling:** `01`–`05`, `12`, `23`–`26` as read in this task;
`docs/v3/26-native-write-capability.md` is the Task 18 **investigation record** (evidence,
not authority). This document is the ruling it asked for.
**Scope:** resolve R1–R7. No capability, handler, provider, token, runtime option, RT-006,
or Group U is created by this task; existing behavior and tests are unchanged by it.

## Status

```text
EXECUTIVE_RULING_COMPLETE = YES

IMPLEMENTATION_AUTHORIZED = NO
```

`IMPLEMENTATION_AUTHORIZED = NO` because R7 concludes that an **explicit versioned contract
change is required before implementation** (runtime contract `14`, Local Runtime contract
`24`, harness contract `25`, acceptance specification `05`). Until those artifacts carry
this ruling, `14` §9 still reads as a prohibition on implementing `G`, and coding ahead of
them would be the "solve an unresolved contract by coding around it" failure the directive
forbids. The next authorized task is contract authoring (§Implementation Gate).

## Decision Summary

| Id | Ruling in one line |
|---|---|
| **R1 — Capability Identity** | One layered identity: hotkey `G` / `grimoire.key.G` (unchanged) is the trigger; the operation stays `hotkey` → `hotkeys:execute`; the write is a module-owned **handler `handler.save-files`** bound to `grimoire.key.G`; **no new Tool Bus capability id, no new `12` §2 token**; declared tool = the existing `files` (unchanged); identity stable and versioned via the hotkeys manifest semver + this ruling, never via Core. |
| **R2 — Write Semantics** | Exactly one operation — `save`: write `args.content` (UTF-8 text) over `args.file` (workspace-relative) as **create-or-overwrite of one file**; append, directory creation, rename/move/delete, binary mode and multi-file operations are **excluded**; empty content, directory targets and missing parents are **refused**; **no atomicity is promised**. |
| **R3 — Writable Production Root** | Writes land only inside an **explicitly declared workspace root** supplied by the composition root at wiring time; never from request data, cwd, environment, pid, clock, or globals; the Grimoire repository root is **categorically not a workspace**; absolute paths, `..`, and symlink escapes are **categorically refused**; **no workspace declared ⇒ `G` stays `UNIMPLEMENTED`** (fail closed, today's behavior preserved). |
| **R4 — Failure & Refusal Semantics** | Deterministic mapping onto existing categories only: input problems ⇒ `E_INPUT_INVALID_ARGS` refusal (E-INPUT); containment/permission/IO failures ⇒ `EXECUTION_ERROR` classified E-TOOL/E-ENV ⇒ Agent `EXECUTION_FAILED` (FAILED); missing handler ⇒ `E_ENV_HANDLER_MISSING` (blocked); missing tool ⇒ `E_TOOL_UNAVAILABLE` (blocked); report gate unchanged. **Exactly one new module-level code is authorized: `E_TOOL_WRITE_FAILED` (class `E-TOOL`)** — no new Core class, no `E_WRITE_*` family; no failure may ever read `COMPLETED`. |
| **R5 — Authorization / Approval** | The single existing GATE stays the only authorization: review status comes from the **plan** (`review.required`, Planner-produced), never from the capability; approval binds plan + the **whole execution sub-request including `args`** (`executionIdentity(bundle.execution)`), is consulted **exactly once** per gated attempt, and is never stored; the write implementation performs **zero** authorization; a write with required approval missing ⇒ `APPROVAL_REQUIRED` @ GATE, agent 0. |
| **R6 — Runtime / Composition Integration** | The write ships inside the **L2 hotkeys module** as a handler factory (not a new module, not a `grimoire.adapter.*`, not a Tool Bus provider, not runtime filesystem code); only the **composition root** may bind it, and only when it holds a declared workspace; Local Runtime exposes it **opt-in** (`--workspace <dir>`), default wiring unchanged; `createRuntime({ handlers })` remains the injection seam for fault injection; no planner, agent, composition, retry, memory, or policy change. |
| **R7 — Contract / Versioning Authority** | **No Core amendment** (`01` §10.1, `03` §4, `03` §2 M5 already cover file-write tools, hotkey registration, and error classes); **`12` is not upgraded** (G row and Tools cell stay `none`, pin intact); **no new capability token**; **HKR-01/HKR-04 do not change** (default wiring unchanged) — new HKR ids are added instead; contract artifacts `14`, `24`, `25`, `05` (Group U specification) and the NEG-20 boundary must land **before** implementation; **Group U becomes the acceptance authority** once authored. |

**Mapping of Task 18's `REQUIRED_DECISIONS` (its §15 `R1`–`R7`) to this ruling** — all
seven are resolved here: 18-`R1` (reconcile `14` §5 with §9) → **R7**; 18-`R2` (identity)
→ **R1**; 18-`R3` (writable root) → **R3**; 18-`R4` (approval rule for writes) → **R5**;
18-`R5` (filesystem semantics) → **R2**; 18-`R6` (which pinned expectations may move) →
**R7**; 18-`R7` (failure/atomicity wording) → **R4**.

---

## R1 — Capability Identity

### Decision

**Rule R1: native writing is identified by one layered model, and by nothing else.**

| Layer | Identity | Status after this ruling |
|---|---|---|
| **Hotkey identity** (L3 record) | key `G`, command `grimoire.key.G`, `12` §2 row 17 (`ACTIVE`, `VALIDATED`, Tools `none`, mode `CODE`) | **unchanged** — protected, integrity-pinned |
| **Operation identity** (Agent) | `kind: "hotkey"` → module `hotkeys` → capability `hotkeys:execute`, phase `RUN`, `target: {key: "G"}`, `args` carried in the envelope (`18` request contract) | **unchanged** — still the only operation kind (`18:286`) |
| **Tool / capability identity** (Tool Bus) | the existing `files` capability (`15` §11, provider `local-files`, status `AVAILABLE`) is the **only** tool the write declares, via `handler.requiredTools: ["files"]` exactly as `handler.readme` / `handler.patch-notes` / `handler.open-part` do | **unchanged** — `capabilities.json`, its declarations sha256 and its 11/1/2/8 counts stay byte-identical; **no new Tool Bus capability id is created** |
| **Handler identity** (L2 module) | `id: "handler.save-files"`, `command: "grimoire.key.G"` — name follows the existing `handler.<verb>-<noun>` convention (`14` §6) and is fixed **by this ruling**, not guessed | **new**, but only as shipped module code in a future implementation task |

Selected rules:

1. **No dedicated write capability token is required, and none may be registered.**
   `15` §18 rule 1 admits only a `12` §2 Tools token, a manifest `requires.tools` entry, a
   `12` §4 adapter declaration, or an executable implementation as a declaration source;
   `12` is protected with an integrity pin, and G's Tools cell is `none`. A new token would
   require editing protected `12`, which this ruling forbids.
2. **`files` is sufficient as the declared tool and is NOT repurposed.** Requiring it gates
   the write on file-tool availability (so `availableTools: []` still yields the existing
   `TOOL_REQUIRED` refusal, HKR-06 pattern) without claiming that `local-files` performs
   writes. `files` keeps its read-only purpose, provider, schema, and errors.
3. **The four identity layers are never conflated**: `G` (hotkey) ≠ `hotkeys:execute`
   (operation) ≠ `files` (tool capability) ≠ `handler.save-files` (implementation). Evidence
   lines, reports, and tests must name the layer they mean.
4. **Stability/versioning:** the identity is stable — exact strings, no alias, no case
   folding, no rename path (`15` §18 rule 4, `14` §3 step 3). It is versioned by (a) the
   hotkeys module manifest `version` (semver bump at implementation, `03` §2), (b) this
   ruling's contract version, and (c) the `14` contract document. **No Core version bump**
   is involved (`01` §13.6 range `>=3.0 <4.0` unchanged).

### Rationale (why this fits the Core architecture)

- `02` §3 rule 5: "assets are inert; behavior lives in the L2 module that declares it" —
  the write is L2 handler behavior bound to an existing L3 record, exactly the pattern of
  the three shipped read handlers.
- `03` §4 H3/H4: the command id is unique and unchanged; no Core file references a hotkey.
- `03` §2 M4 and `02` §3 rule 3: module-to-module contact stays `provides`/`consumes`; the
  Tool Bus keeps its `check`-only role, so declaring an *uninvokable* write capability would
  violate `15` §10 ("a capability exists only when a registry/manifest declaration supports
  it") — hence no capability row.
- `01` §13.2 (registration, not modification) and §13.5 (fail closed) are preserved.

### Security Boundary

A single declared tool (`files`, `AVAILABLE`) and a single bound handler; no adapter is
activated, no `grimoire.adapter.*` is fabricated, no fallback/substitute dispatch exists
(TB-19, HKR-11 mutation 10 stay meaningful). Exact-id lookup only.

### Must NOT be inferred from R1

- Not: "the `files` capability can now write" — it cannot and its declaration does not change.
- Not: "record G changed" — `12` is untouched (row, Tools cell, statuses, pin).
- Not: "a new Tool Bus capability exists" — `bus.list()` stays 11 and the declarations
  sha256 stays `41c967a1c6f914101357148939c2795ef091ba907595a1a677896dfaaedcbe7a`.
- Not: "the handler may be invoked directly" — only `executeResolvedHotkey` runs it.
- Not: any name other than `handler.save-files` (a rename is a new ruling).

### Downstream Obligation

Contract task: document this four-layer model and `handler.save-files` in `14` §6, and the
"no new capability id" fact in `15`'s Task-19 cross-reference. Implementation task: ship the
factory in `modules/hotkeys/src/handlers.mjs`, bind it only through a composition root that
holds a workspace, bump `modules/hotkeys/manifest.yaml` `version`.

### Acceptance Evidence (required later)

- **U-01** declaration valid: `defineHandler({id: "handler.save-files", command:
  "grimoire.key.G", requiredTools: ["files"], …})` constructs; mis-bound map key still throws
  `E_VALID_HANDLER_SPEC`.
- **U-02** registry validation unchanged: `12` pin `c861b562…`, HKC-17 18/18, Core pins.
- **U-03** wiring: bound only with a workspace; without it `G` ⇒ `UNIMPLEMENTED`
  (`E_ENV_HANDLER_MISSING`), i.e. the existing HKR-04 assertion still holds untouched.
- Capability-surface regression: `buildToolBusReport` still states
  `| Capabilities | 11 |`, `| AVAILABLE | 1 |`, `| UNAVAILABLE | 2 |`, `| BLOCKED | 8 |`
  (TB-14 unchanged).

---

## R2 — Write Semantics

### Decision

**Rule R2: "write" means exactly one operation — `save` — with a closed, minimal contract.**

```text
input : args = { file: string, content: string }   (exactly these two fields)
output: { file, bytes, lines, sha256, content }    (same shape as the shipped read handlers)
```

| Question | Ruling |
|---|---|
| create | **Yes** — a `file` that does not exist is created with exactly `content`. |
| overwrite | **Yes** — an existing regular file is replaced entirely with exactly `content`. |
| append | **No** — excluded from v1; no `mode` field exists, so an extra field is invalid input. |
| existing-file behavior | full replacement of the file's bytes; no merge, no backup, no partial edit. |
| missing-parent behavior | **refused** — no directory creation; the write fails (`ENOENT` ⇒ `E_ENV_MISSING_FILE`). |
| missing target | **success** by creation (that is the documented `create` case, not a failure). |
| empty content | **refused** (`E_INPUT_INVALID_ARGS`) — prevents accidental truncation to zero bytes. |
| binary vs text | **text only** — `content` must be a string; NUL (`U+0000`) in `content` is refused. |
| encoding | **UTF-8 only**; written bytes are exactly `content` encoded as UTF-8; no BOM added or stripped. |
| atomicity | **none promised** — one whole-file write; no temp-file/rename claim may appear in any report (`14`/`15` specify no write atomicity today). |
| directory creation | **excluded** (and a directory occupying `file` ⇒ write failure `EISDIR`). |
| rename / move / delete | **excluded** — separate operations, separately ruled; not part of this capability. |

Path grammar for `file` (shared with R3): non-empty, relative, `/`-separated, no leading
`/`, no `.`/`..`/empty segments, no `\` separator, no drive/colon prefix, no NUL or newline,
no trailing `/`.

**No filesystem operation other than this single whole-file write is authorized.** The
capability is not a general filesystem API: no globbing, no directory walk, no chmod, no
link/symlink creation, no multiple files per invocation.

### Rationale

- The registry documents `G` as "saves/stages current files" with output "saved file
  snapshot" (`12` §2 row 17; `PatchNotes.md:125`) — saving a file's content is the smallest
  behavior that matches that wording; appending log lines would not be "your files".
- `01` §4.1/§4.4 (build the smallest coherent change) and §4.6 (edge cases enumerated here)
  are satisfied by a closed, enumerable table rather than an open-ended API.
- Determinism (`14` §10, `15` §15): input → bytes is a pure function; `sha256` of the result
  is reproducible, which is what RT-002/RT-006 assertions compare.

### Security Boundary

Only one mutation, only inside R3's root, only for validated input. Excluding append,
rename, delete, and mkdir removes the destructive classes entirely (no repository-wide
deletion, no hidden expansion — `26` §9).

### Must NOT be inferred from R2

- Not: an append/patch/diff API, a `mode`/`flags` option, or multi-file writes.
- Not: directory creation "for convenience".
- Not: atomicity, durability, fsync, locking, or backup semantics — never claim them.
- Not: any encoding other than UTF-8; not binary blobs, not base64 modes.
- Not: a permission to touch the fixture `test/scenarios/fixtures/notes.md` (fixtures stay
  read-only, `25` §5).

### Downstream Obligation

Contract task: publish this table verbatim in `14` §6 (handler input/output) and reference
it from `26` §5's proposal. Implementation task: implement exactly this table; any new
operation (append, mkdir, delete) requires a new ruling.

### Acceptance Evidence (required later)

- **U-04** allowed relative write (existing and new file) → `ok`, `executed: true`.
- **U-05** exact resulting bytes: `sha256(file bytes)` equals `output.sha256` equals the
  scenario's pinned `workspaceFiles` content (byte-for-byte).
- Negative (must refuse as invalid input, pre-execution): empty `content`, NUL in `content`,
  extra field (e.g. `mode`), missing `file`, missing `content`, non-string `content`,
  directory target, path with trailing `/`, missing parent directory (failure, not success).

---

## R3 — Writable Production Root

### Decision

**Rule R3: writes are confined to an explicitly declared workspace root; nothing else is
writable, and with no workspace nothing is writable at all.**

1. **Selection:** the workspace root is supplied by the **composition root at wiring time**
   (Local Runtime flag `--workspace <dir>`; harness scenario `workspace`). It is constructor
   data like `registryText`, `root`, `handlers`, and the approval component.
2. **Never derived from:** request/`args` data, cwd, environment variables, pid, clock,
   randomness, globals, or any cached state (determinism rules of `14` §10, `23` §"no input
   except artifact content").
3. **Repository root refused categorically:** the checkout that contains
   `runtime/local-runtime.mjs` (resolved from the runtime file, never from cwd) MUST NOT be
   declared as the workspace; construction with it is refused. This keeps every protected
   pin and the repository itself outside write reach.
4. **Containment:** `file` must be relative (grammar in R2) and must resolve — through every
   component — inside the declared root. Verified on the *real* path of the parent
   directory, so a symlink that redirects outside the root cannot be used to escape.
5. **Categorical refusals:** absolute paths (`/…`, drive/colon), `..` traversal, symlink
   escape, and any resolution landing outside the root are refused (pre-execution input
   refusal where observable, containment refusal otherwise).
6. **Fail-closed default:** **no workspace declared ⇒ the `G` handler is not bound ⇒ `G`
   resolves to `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING` (E-ENV, status `blocked`)** — the
   default Local Runtime and default test wiring keep today's behavior byte-for-byte.
7. **Test isolation unchanged:** the harness keeps creating a fresh `fs.mkdtempSync`
   workspace per scenario outside the repository, disposing it in `finally`
   (`25` §1, §7; T-06/T-11).

### Rationale

- `01` §10.2 least privilege, smallest surface; §13.5 fail closed; `16` §"fail closed at the
  boundary" (`02` §3 rule 4): an unmet requirement (workspace) prevents execution instead of
  degrading to a broader root.
- Matches the existing read-side containment model (`15` §16: `path.resolve(root, …)` +
  escape refusal + `EACCES`) rather than inventing a second security model (`26` §9).
- Preserves the harness rule that "a writing behaviour can never be pointed at the
  repository" (`25` §7) by making it a property of the shipped contract, not only of tests.

### Security Boundary

`workspace` (declared) ⊃ target (validated relative path) ⊃ file (single write). Escape in
either direction (absolute, `..`, symlink, missing containment) is refused; the repository
root and everything outside the workspace are unreachable by construction.

### Must NOT be inferred from R3

- Not: "the repository is writable if you pass `root` as workspace" — explicitly refused.
- Not: "cwd or an environment variable can pick the workspace."
- Not: "the bundle/`args` may carry a workspace" — workspace is never bundle data (same rule
  as approval, `23` §2).
- Not: any default workspace, any implicit fallback root, or any "temporary" auto-creation
  of directories.
- Not: permission to read outside the root (this ruling covers writes only; reads keep the
  existing `local-files` behavior).

### Downstream Obligation

Contract task: state the six rules above in `14` §6/§2 (handler scope) and `24` §3–§8
(`--workspace <dir>`, opt-in, default absent ⇒ today's behavior). Implementation task:
implement composition-root binding + the repo-root refusal; Local Runtime must not pass a
workspace unless the flag is given.

### Acceptance Evidence (required later)

- **U-06** workspace containment: writes land only under the declared root.
- **U-07** `file = "../outside"` ⇒ refused, file absent outside, result not `COMPLETED`.
- **U-08** absolute path outside root (`/tmp/…`, `/etc/…`) ⇒ refused, nothing written.
- **Symlink escape** case ⇒ refused (new U-case inside the same group).
- **No-workspace case** ⇒ `G` is `UNIMPLEMENTED` (existing HKR-04 assertion, unchanged).
- **Repo-root workspace** ⇒ construction refused (new case).
- T-06/T-11 stay green: fixtures and protected files byte-identical after every scenario.

---

## R4 — Failure and Refusal Semantics

### Decision

**Rule R4: every failure maps onto an already-authorized category; exactly one new
module-level code is authorized; nothing ever reports success it did not produce.**

| Case | Stage | Code / class (existing unless marked) | Result status |
|---|---|---|---|
| malformed request (wrong shape, extra/missing arg fields, non-string content, empty content, bad path grammar, NUL/newline) | handler `validateArgs` (step 8) | `E_INPUT_INVALID_ARGS` · **E-INPUT** → `INVALID_INPUT` | runtime `failed` → Agent `EXECUTION_REFUSED` · `REFUSED` |
| path traversal (`..`), absolute path, symlink escape | `validateArgs` containment (step 8); write-time containment belt in `run` | pre-execution refusal `E_INPUT_INVALID_ARGS` · **E-INPUT**; if only detectable at write time, the containment throw maps like any write-path failure → **`E_TOOL_WRITE_FAILED` · E-TOOL** → `EXECUTION_ERROR` | `REFUSED` (primary) or `EXECUTION_FAILED` · `FAILED` (belt) |
| missing target file | — | **not a failure**: `create` (R2) | `COMPLETED` (when everything else passes) |
| missing parent directory | write call `ENOENT` | `E_ENV_MISSING_FILE` · **E-ENV** → `EXECUTION_ERROR` | Agent `EXECUTION_FAILED` · `FAILED` |
| permission failure (`EACCES`/`EPERM`), directory target (`EISDIR`), `ENOTDIR`, `ELOOP` | write call | **`E_TOOL_WRITE_FAILED` · E-TOOL — the ONE newly authorized code** → `EXECUTION_ERROR` | `EXECUTION_FAILED` · `FAILED` |
| existing target conflict | — | **not a failure**: overwrite is the documented semantics | `COMPLETED` |
| unsupported encoding/content mode | `validateArgs` | `E_INPUT_INVALID_ARGS` · E-INPUT | `REFUSED` |
| capability/tool unavailable (handler tool `files` not in `availableTools`) | runtime step 9 | `E_TOOL_UNAVAILABLE` · **E-TOOL** → classification `TOOL_REQUIRED` | runtime `blocked` → Agent code `TOOL_REQUIRED` · `REFUSED` (stage `EXECUTE`; PREFLIGHT variant identical, class E-TOOL) |
| handler unavailable (no workspace ⇒ not bound) | runtime step 7 | `E_ENV_HANDLER_MISSING` · **E-ENV** → `UNIMPLEMENTED` | `blocked` → Agent `EXECUTION_REFUSED` |
| unexpected implementation failure (anything unclassified) | runtime step 10 | `E_UNKNOWN_EXCEPTION` · **E-UNKNOWN** → `EXECUTION_ERROR` | `EXECUTION_FAILED` · `FAILED` |
| report cannot be built | REPORT | `REPORT_FAILED` (unchanged) | `REPORT_FAILED`, `report: null` |

Rules attached to the table:

1. **No new Core error class.** Everything stays inside `01` §11.1's seven classes
   (`03` §2 M5: choose the closest Core class).
2. **Exactly one new code, `E_TOOL_WRITE_FAILED` (class `E-TOOL`)**, is authorized, because
   the existing classifier's fs mapping is read-worded (`E_TOOL_READ_FAILED`, "could not be
   read" — `modules/hotkeys/src/errors.mjs` `classifyFsError`) and reporting a failed *write*
   as a failed *read* would violate `01` §1.2/§2 M2 honesty. It is a module-level code,
   documented in `14` §5 next to `E_TOOL_*`; the hotkeys manifest already declares `E-TOOL`,
   so no manifest `errors:` change is needed. **No other code may be added** — no
   `E_WRITE_*` family, no codes outside the existing vocabulary.
3. **Categorical separation is preserved:** `REFUSED` (E-INPUT refusal before execution) vs
   `FAILED` (execution attempted and failed) vs `blocked` (E-ENV/E-TOOL availability) vs
   `REPORT_FAILED` — never collapsed (`14` §4 state model, `18` status map).
4. **No false success:** `COMPLETED` requires `executed === true && ok === true` **and** a
   built report (`18` §9); a failed write therefore cannot render `| Status | COMPLETED |`.

### Rationale

- `01` §11.1 class table + §11.3 "no silent failure, no fake success"; `15` §18 rule 5
  precedent (a new code mapped into an existing class is the sanctioned pattern); `14` §5
  documents module codes the same way (`E_CONFLICT_*` were added by Task 06 for the same
  reason).
- Using the existing refusal classes keeps the Agent, Composer, Report Bus, and all
  existing negative matrices (`NEG-01…NEG-20`, HKR/TB refusals) meaningful without edits.

### Security Boundary

Failures stop at their stage: input refusal happens before any filesystem call; containment
refusal happens before any write; a failed write leaves a report that states the failure;
no retry, no fallback, no substitute target (TB-19 pattern).

### Must NOT be inferred from R4

- Not: permission to invent further codes, `E_WRITE_*` families, or a second error taxonomy.
- Not: "ENOENT on write is a refusal" — it is an environment failure (`FAILED`), never a
  success and never a silent no-op.
- Not: retry-on-failure, partial-write recovery, or rollback claims (no atomicity, R2).
- Not: that a `blocked` (UNIMPLEMENTED/TOOL_REQUIRED) result may be reported as completion.

### Downstream Obligation

Contract task: add the R4 table (minus implementation detail) to `14` §5/§6 and the single
new code row to `14` §5. Implementation task: classify with the existing classifier plus
`E_TOOL_WRITE_FAILED`, and add the negative/failure tests below. Any additional code = new
ruling.

### Acceptance Evidence (required later)

- **U-09** write failure propagation: injected `EACCES` ⇒ `EXECUTION_ERROR` ⇒ Agent
  `EXECUTION_FAILED`, class `E-TOOL`, code `E_TOOL_WRITE_FAILED`, report shows the failure.
- **U-10** no false success: every failure case above asserts `report` never contains
  `| Status | COMPLETED |` and `result.ok === false`.
- Failure-injection cases: permission failure, missing parent, directory target,
  unexpected throw ⇒ each classified per the table, byte-stable on rerun (HKR-07 pattern).
- Unavailable/absent cases stay covered by the **unchanged** HKR-06 and HKR-04 tests.

---

## R5 — Authorization / Approval Interaction

### Decision

**Rule R5: nothing changes in approval — the existing single GATE remains the only
authorization mechanism, and the write implementation is never part of it.**

1. **Not every native write is review-gated.** Review status is `plan.review.required`,
   produced by the Planner from tier + trigger (`01` §5.2 modeled in `19`), and evaluated at
   the GATE (`20` lifecycle `GATE` stage). A plan with `review.required === false` executes
   through GATE with "review not required" exactly as today (RT-002 primary).
2. **Review status is determined by the plan — never by the capability, the hotkey, the
   handler, or the arguments.** There is no "write requires approval" rule, and equally no
   "write skips approval" rule.
3. **`G` cannot bypass the GATE.** The runtime is reachable only through the Agent, which
   the Composer invokes only after `GATE` succeeds (`20`: RECEIVE → VALIDATE → PLAN → GATE →
   ORCHESTRATE → REPORT → COMPLETE; `24` §6 exit 3 proves the gate precedes execution).
4. **The write implementation performs no authorization check.** It neither consults,
   caches, grants, nor re-verifies approval. It performs *containment validation* (R3) —
   that is input validation, not authorization, and must never be described as a second
   approval. No hidden approval mechanism, no policy engine, no per-path approval list.
5. **Approval binds the plan and the entire execution sub-request, including `args`.** The
   GATE hashes `bundle.execution` whole (`executionIdentity(bundle.execution)` in
   `composition/plan-execution/src/composer.mjs`; `23` §4.2 canonicalization encodes every
   key recursively) — so the exact `file` and `content` of a write are inside the binding.
   A verdict computed over different args ⇒ `approval verdict binding mismatch` ⇒ refusal
   (D3), exactly as for any other field.
6. **Consultation count and lifetime unchanged:** exactly one `verify()` per gated attempt,
   no retry, no cache, identities checked before/after (`23` §5, `composer.mjs:386-417`);
   approval never enters the bundle (`23` §2), and workspace is likewise never bundle data.
7. **Write attempted while required approval is absent/invalid/throwing/non-affirmative** ⇒
   `APPROVAL_REQUIRED` @ GATE, `agent 0`, exit `3`, refusal report, never a completion row
   (existing NEG-01…NEG-12/R-matrix behavior, unchanged).

### Rationale

- `22` mandatory safety ruling: approval belongs to the GATE, not to the Planner, the Agent,
  or any tool; moving or duplicating it would re-open a ruled question.
- `01` §13.7 no hidden coupling and §4.7 security by default: the capability behaves like
  every other handler — it executes only what a gated, validated request asks for.
- Because approval already binds `args` (point 5), no new approval surface is needed for
  writes; adding one would be a second mechanism with no source authority.

### Security Boundary

Single gate, single consultation, content-bound verdict, zero capability-side discretion.
The write can fail or refuse, but it can never authorize.

### Must NOT be inferred from R5

- Not: "writes are always gated" and not "writes are never gated" — the plan decides.
- Not: "G, being ACTIVE, may execute without a gate" — activation (`12` §6) ≠ authorization.
- Not: "the handler may double-check approval" or "may refuse unapproved content" — that
  would be a second authorization mechanism, forbidden.
- Not: "approval covers only target key G but not args" — args are bound (point 5).
- Not: any persistence/reuse of a verdict across attempts.

### Downstream Obligation

Contract task: state points 1–7 in `27` (this document) and cross-reference from `26` §10.
Implementation task: add one acceptance case proving that mutating `args.content` after the
verdict yields `APPROVAL_REQUIRED` (binding mismatch) with `agent 0`; **no change** to
`composition/**`, `23`, `22`, `modules/planner/**`, or the Agent.

### Acceptance Evidence (required later)

- Gated write without approval ⇒ `APPROVAL_REQUIRED` @ GATE, agent 0, no completion row
  (existing RT-003 primary pattern, still green).
- Gated write with approval ⇒ exactly `counts.approval === 1`, agent 1, write executed
  (existing RT-003 approved leg, still green).
- New: post-verdict `args` mutation ⇒ D3 binding mismatch refusal.
- Unchanged: the full Group R matrix (R-01…R-15, POS/NEG, R-M1…R-M3) stays green.

---

## R6 — Runtime / Composition Integration

### Decision

**Rule R6: the write is L2 handler code bound by the composition root — nobody else gains
any new responsibility, and every existing lifecycle stays as it is.**

| Component | Responsibility after this ruling | Change |
|---|---|---|
| **Tool Bus** (`15`) | availability `check` only (module `requires.tools: ["files"]` at Agent PREFLIGHT); never executes writes; no new capability/provider | **none** |
| **Agent Orchestrator** (`18`) | RECEIVE → VALIDATE → RESOLVE → PREFLIGHT → EXECUTE (runtime only) → REPORT → COMPLETE; does not derive the execution request (caller supplies it), performs no approval, no retry, no memory | **none** |
| **Hotkey Runtime** (`14`) | resolves the record, gates tools/args, dispatches the handler; `createRuntime({registryText, root, availableTools?, handlers?, toolBus?})` signature and `root` semantics unchanged | **none to the dispatch contract** |
| **Handler registry** (`modules/hotkeys/src/handlers.mjs`) | ships the write implementation as a module-owned factory producing the `handler.save-files` spec for a declared workspace | new module code (implementation task) |
| **Composition root** (harness, Local Runtime, any future shell) | **the only place that binds the handler**, and only when it holds a declared workspace; wires `workspace` exactly like it wires `approval` and `handlers` today | wiring only |
| **Composition / GATE** (`20`, `23`) | unchanged lifecycle RECEIVE → VALIDATE → PLAN → GATE → ORCHESTRATE → REPORT → COMPLETE; still the only approval point | **none** |
| **Local Runtime** (`24`) | exposes the capability **opt-in** via `--workspace <dir>`; with the flag absent it binds nothing ⇒ byte-identical behavior to today (Group S stays green) | documented flag |
| **Planner** (`19`) | unchanged — produces plans and `review.required`; never aware of writes | **none** |
| **Test injection** (`createRuntime({handlers})`) | remains supported and unchanged as a **fault-injection / test seam**; harness rules for declared workspaces stay; the harness's own `workspace-save` implementation is retired in favor of the production factory when scenarios run the native path, while injection stays exercised by the existing harness validation tests and HKR-11 mutation 10 | harness wiring only |

Explicit architectural statements:

- **Module vs adapter vs runtime dependency:** a **module** behavior (inside the existing
  hotkeys module). It is not a `grimoire.adapter.*` — those gate `ADAPTER_REQUIRED` records
  and are `NOT_ACTIVATED` (`12` §4); `G` is `ACTIVE`, so it takes the handler path. It is
  not "runtime filesystem code": the runtime never touches the filesystem itself (`14` §1
  non-goals, `24` §1 consumes-only rule).
- **No approval into Agent or write implementation; no agent-derived execution request; no
  planner behavior; no retries, memory, policy engines, hidden state, or autonomous loops**
  (directive non-goals).
- **Default exposure:** production Local Runtime does **not** expose the capability unless
  the operator passes `--workspace`; there is no environment-driven or implicit default.

### Rationale

- `02` §1/§3: L1 services (Tool Bus, Module Registry, Report Bus) and L0 Core gain nothing;
  only the L2 module gains behavior, wired by a composition root — the pattern already used
  for `approval`, `handlers`, and `toolBus`.
- `18` explicitly states the composition root owns wiring; binding at the composition root
  keeps `createRuntime`'s documented signature intact and keeps the request envelope
  (`kind/module/capability/phase/target/args`) unchanged.
- Fail-closed default (no workspace ⇒ `UNIMPLEMENTED`) means every existing test that
  constructs a default runtime keeps passing without modification.

### Security Boundary

One binding point (composition root), one root source (declared workspace), one dispatch
path (Agent → runtime → handler). No ambient authority: nothing reads env/cwd to find a
root; no second entry point; injection remains an explicit test seam.

### Must NOT be inferred from R6

- Not: a new operation kind, a new `provides` capability, or a new module/manifest.
- Not: Tool Bus `invoke` of a write (the Agent never calls `invoke`).
- Not: passing `workspace` through the bundle, `args`, or any request field.
- Not: default-on capability in the Local Runtime or in `DEFAULT_HANDLERS`.
- Not: removing or weakening `createRuntime({handlers})` injection, the harness workspace
  rules, or any existing refusal.

### Downstream Obligation

Contract task: publish this responsibility table in `14` §6 (binding rule), `24` §3/§8
(flag), `25` §5/§10 (harness uses the production factory; injection retained as the test
seam). Implementation task: ship the factory, bind it at composition roots, add the flag,
convert the scenarios' native path, and leave `composition/**`, `modules/agent/**`,
`modules/planner/**`, `modules/tool-bus/**`, `modules/module-registry/**` untouched.

### Acceptance Evidence (required later)

- **U-11** real path: Planner → GATE → Agent → Tool Bus (`check`) → Hotkey Runtime →
  `handler.save-files` → Report, with counts `toolChecks` unchanged from the pinned value
  (re-measured only if the wiring genuinely changes it) and evidence naming
  `handler.save-files`.
- **U-12** RT-002 without `createRuntime({handlers: …write…})`: scenario declares a
  workspace, no `handler` field, native binding used, assertions otherwise intact.
- Group S (I-01…I-10) green with no Local Runtime test edits beyond the new opt-in flag
  documentation; harness validation tests (T-01…T-12) green.

---

## R7 — Contract / Versioning Authority

### Decision

**Rule R7: implementation requires an explicit, versioned contract change first. This
ruling supplies the decision authority; the contract artifacts below must carry it before
any code is written.**

**Reconciliation of `14` §5 with `14` §9 (Task 18 R1):** both stay truthful under one rule.
`14` §5's condition — "add a **documented** handler in a future task" — is satisfied by this
ruling, which documents identity, semantics, root, failures, and approval. `14` §9's
statement ("implementing them here would mean inventing behavior, which the directive
forbids") is resolved for `G` by amending `14` §9 to record that `G`'s behavior is now
executed under **this ruling** (`27`) with a workspace bound, while `W/A/S/SS/D/H/C/Q` and
`Pi` remain UNIMPLEMENTED with the original reason intact. The amendment is written into
the contract — never inferred from this document alone.

What must change **before implementation** (contract task, documentation only):

| Artifact | Required change | Protected? |
|---|---|---|
| `docs/v3/27-native-write-capability-ruling.md` | this ruling (committed by Task 19) | no |
| `docs/v3/14-hotkey-runtime.md` | §5: add `E_TOOL_WRITE_FAILED` row + note the R4 table; §6: add `handler.save-files` row, the `{file, content}` input/output, and the workspace binding rule; §7/§8: describe the *workspace-bound* runtime result for `G` (default split 3/10/1 unchanged); §9: record the `G` reconciliation above; §10: workspace participates in the determinism inputs | no |
| `docs/v3/24-local-runtime.md` | §3/§8: `--workspace <dir>` (opt-in; absent ⇒ today's behavior byte-identical); §5/§9: workspace effect on runs and refusal when absent | no |
| `docs/v3/25-real-scenario-test-harness.md` | §5/§10: harness binds the production factory for scenarios that declare a workspace; injection retained as the fault-injection seam; "shipping write behaviour is a future Core task" updated to cite `27` | no |
| `docs/v3/05-acceptance-tests.md` | **Group U specified** (U-01…U-12 per R1–R6 above), status `SPECIFIED — executable tests land with the implementation`; NEG-20 row extended with the Task-19/20/21 file lists as they land | no |
| `docs/v3/26-native-write-capability.md` | pointer: §15 R1–R7 resolved by `27`; status note (`IMPLEMENTATION_AUTHORIZED = NO` as of Task 19) | no |
| `test/policy-approval.test.mjs` | NEG-20 boundary extended with each task's **exhaustive** file list (Task 19's list only, for this task) | no |

What must **NOT** change ever for this feature:

| Artifact | Why |
|---|---|
| `docs/v3/01`–`04` (pinned `9bc4b0c0…`, `b6e25671…`, `fdc83a0e…`, `4fc9c146…`) | no Core amendment is required: `01` §10.1 already treats file write as a tool, `03` §4 already covers hotkey registration, `03` §2 M5 already covers error classes, `01` §13.2 forbids Core edits for capability addition |
| `docs/v3/12` (pin `c861b562…`) | G row, Tools cell `none`, statuses, adapter list, integrity pin — **no upgrade, no token, no row edit** |
| `docs/v3/22`, `docs/v3/23` | approval architecture is not modified; `23` §2/§4/§5 already bind and consult correctly |
| `docs/v3/15`, `18`, `19`, `20`, `16`, `17` | no new capability, operation kind, planner behavior, composition stage, registry duty, or report section |
| `runtime/local-runtime.mjs` behavior without `--workspace` | Group S pins must stay green; only the opt-in flag path is added (implementation task) |

**Direct answers to R7's questions:**

- *Authoritative artifact for the write capability:* **this ruling (`27`)** for the decision,
  carried into **`14`** as the runtime contract; `12` stays authoritative for the `G` record;
  **`05` Group U** becomes authoritative for acceptance once authored.
- *Must HKR-01 / HKR-04 change?* **No.** They describe the default (workspace-less) wiring,
  which this ruling keeps byte-identical; they must stay green untouched. Workspace-bound
  behavior is covered by **new HKR ids** added in the implementation task (naming continues
  the HKR series), plus U-cases. *(Task 18's R6 is answered here: no pinned expectation may
  move to fit an implementation; the only values allowed to change are observed outputs of
  the converted scenarios — e.g. RT-002/RT-003's evidence line `execute:
  scenario.workspace-save -> notes.md` must become the native handler id, and each change is
  justified as "the native path replaced the injected one", never as a weakened assertion;
  counts such as `toolChecks: 5` are re-measured only if the wiring genuinely changes them.)*
- *Must the existing G row be upgraded?* **No.**
- *Must a new capability token be registered?* **No** (R1).
- *Is a Core specification amendment required?* **No.**
- *Is an explicit versioned contract change required before implementation?* **Yes** — the
  contract task above; versioning = hotkeys manifest semver bump + `14`/`24`/`25`/`05`
  revision notes. Implementation before that landing is unauthorized.
- *Which acceptance group becomes authoritative?* **Group U** (new in `05`), with Group J
  (HKR) extended by new ids and Group T retained; **RT-006** is the real-trial proof.
- *Exact evidence required before declaring the capability complete:* see §Acceptance Gate.

### Rationale

- The repository's own pattern is contract-first: `23` carries
  `CONTRACT_READY_FOR_EXECUTIVE_APPROVAL` … "contract review required before implementation",
  and every prior task landed its contract document with (or before) its code.
- `01` §13.6 versioning and `03` §2 M6 (static manifests) are satisfied without a Core bump;
  `02` §3 rule 2 ("a registry/config entry is the only permitted Core touch point") is
  satisfied because there is no Core touch point at all.

### Security Boundary

Authorization to implement exists only after the contract text exists; the protected pins
and the acceptance boundary (NEG-20) keep that sequence enforceable — an implementation
landed before its contract either fails NEG-20 (unlisted file) or fails HKC-17/NEG-20 pins
(protected file edited).

### Must NOT be inferred from R7

- Not: permission to edit `01`–`04`, `12`, `22`, `23` "to make implementation possible".
- Not: that HKR-01/HKR-04, TB-14 counts, or any other pin may be adjusted to fit new code.
- Not: that Group U, RT-006, or any test may be created before the contract task lands.
- Not: that `15`/`18`/`19`/`20` need edits (they do not — that is the finding, not a gap).
- Not: that this ruling alone authorizes coding; it authorizes the contract task, and the
  contract task authorizes implementation (§Implementation Gate).

### Downstream Obligation

Two sequential tasks, both documentation-first (§Implementation Gate), then implementation.

### Acceptance Evidence (required later)

Contract task: suite green at the documented baseline (291/291, no behavior change),
`git diff` contains only the listed files, protected pins intact. Implementation task: the
full §Acceptance Gate list.

---

## Explicit Non-Decisions

This ruling intentionally does **not** authorize:

1. Any implementation: no handler code, no factory, no workspace code, no CLI flag
   (`IMPLEMENTATION_AUTHORIZED = NO`).
2. `RT-006` and **Group U** — specified later (Group U in the contract task; RT-006 with
   implementation). Neither exists now.
3. Append, patch, rename, move, delete, mkdir, chmod, symlink creation, globbing,
   multi-file writes, binary writes, or any general filesystem API.
4. Atomicity, durability, locking, backup, or rollback guarantees.
5. A new Tool Bus capability id, a new `12` §2 token, a new adapter, a new operation kind,
   a new module/manifest, or any `provides`/`consumes` change.
6. Any change to `01`–`04`, `12`, `22`, `23` — no Core amendment, no registry upgrade, no
   approval-rule change.
7. A second authorization mechanism, capability-side approval, per-path approval lists, or
   any Agent/Planner/Composer change.
8. Removing `createRuntime({ handlers })` injection or weakening any existing scenario,
   harness rule, or refusal.
9. Memory, long-term planning, autonomous loops, self-modification, background agents, UI,
   cloud execution, databases, credentials, auth servers, or multi-agent delegation.
10. Default-on write exposure anywhere (Local Runtime, `DEFAULT_HANDLERS`, or harness).

## Implementation Gate

Task 20+ may implement **only when every condition holds**:

1. **G1** — this ruling is committed (`EXECUTIVE_RULING_COMPLETE = YES`).
2. **G2** — the contract task lands the six artifact changes in R7's first table
   (`14`, `24`, `25`, `05` Group U specification, `26` pointer, `05` NEG-20 row), with the
   suite green and **zero code changes** (`modules/**`, `composition/**`, `runtime/**`,
   `test/**` behavior untouched).
3. **G3** — the implementation task publishes its **exhaustive file list** into NEG-20's
   boundary (same pattern as Task 16/17/18/19) before its code lands; any file outside the
   union still fails the gate.
4. **G4** — no protected file (`01`–`04`, `12`, `22`, `23`) is touched at any point;
   HKC-17/NEG-20/T-11 pins stay green.
5. **G5** — implementation follows R1–R6 exactly: factory in `handlers.mjs`, composition-root
   binding only, `--workspace` opt-in, semantics table of R2, root rules of R3, codes of R4,
   no approval surface (R5).
6. **G6** — no pinned expectation is edited to fit the code (R7): HKR-01/HKR-04/TB-14 stay
   byte-for-byte as assertions.

## Acceptance Gate

Native write may be declared **shipped** only with all of this evidence:

- **A1** `node --test test/*.test.mjs` green including **Group U** (U-01…U-12) and extended
  HKR ids; 0 fail / 0 skipped / 0 todo, exit 0.
- **A2** RT-001…RT-005 all PASS with RT-002/RT-003/RT-005 exercising the **native** path
  (no `handler` field, no injected write), assertions preserved except the documented
  handler-id evidence line; injection coverage retained as a separate fault-injection
  scenario/variant (Task 18 §17: old coverage is not deleted).
- **A3** **RT-006** native trial PASS on **three fresh workspaces**: same input ⇒ same
  result ⇒ byte-identical resulting file and same report semantics; exact expected bytes.
- **A4** negatives PASS: `../outside` refused, absolute outside-root refused, symlink escape
  refused, empty content/directory/missing-parent refused, permission failure ⇒
  `E_TOOL_WRITE_FAILED`/`EXECUTION_FAILED`, and **no failure renders
  `| Status | COMPLETED |`**.
- **A5** approval: gated-without-approval ⇒ `APPROVAL_REQUIRED`, agent 0; with approval ⇒
  one consultation; post-verdict `args` mutation ⇒ binding mismatch.
- **A6** manual terminal trial recorded: `node runtime/local-runtime.mjs --workspace <dir> …`
  writes the exact bytes (exit 0) and the same bundle **without** `--workspace` refuses
  (exit 4, `UNIMPLEMENTED`), with FILE/REPORT sha256 evidence and no machine paths in the
  report.
- **A7** security/regression: protected pins intact, NEG-20 green (boundary lists current),
  Groups Q/R/S/T green, full suite green, worktree clean, remote verified.

## Security Invariants

Implementation MUST preserve all of these; any violation fails the Acceptance Gate:

1. **One GATE, one authorization.** Approval is consulted only by the Composer, exactly once
   per gated attempt, and binds plan + full execution sub-request (including `args`).
   The write implementation never consults, stores, or grants approval.
2. **Workspace-only writes.** Nothing is writable outside the declared workspace; the
   Grimoire repository root and protected files are never a write target.
3. **Roots never come from request data.** No `args`, bundle field, cwd, environment
   variable, pid, clock, randomness, or global mutable state selects a root, path authority,
   or write identity.
4. **All escapes refused:** absolute paths, `..` traversal, symlink redirection, and any
   resolution outside the root — pre-execution where observable, otherwise containment
   refusal before bytes are written.
5. **Bounded operation set:** exactly one whole-file UTF-8 `save` (create-or-overwrite);
   no delete, rename, move, mkdir, chmod, append, glob, or multi-file mutation.
6. **Fail closed:** no workspace ⇒ `UNIMPLEMENTED`; invalid input ⇒ `REFUSED`; tool missing ⇒
   `TOOL_REQUIRED`; write failure ⇒ `FAILED`; report missing ⇒ `REPORT_FAILED`. Never a
   substitute handler, fallback capability, or silent no-op (TB-19, HKR-11/10 preserved).
7. **No false success:** `COMPLETED` only when bytes were written as requested, verified by
   the reported `sha256`, and a report was built.
8. **Determinism:** identical input + identical wiring ⇒ identical result object, identical
   file bytes, byte-identical report; no timestamps, random ids, or machine paths in output.
9. **No contract drift:** protected pins, registry pin, HKR/TB pins, and every existing
   assertion stay green; only the explicitly listed artifacts change.
10. **Not autonomous development:** one root-confined capability, no memory, no loop, no
    self-modification — `Native Write Capability ≠ autonomous development`.

## Compatibility Impact

Expected to change (later tasks, in this order — none changed by Task 19):

| Order | Artifact | Change | Task |
|---|---|---|---|
| 0 | `docs/v3/27-native-write-capability-ruling.md` | added (this ruling) | **Task 19** |
| 0 | `docs/v3/26-native-write-capability.md` | one pointer line (R1–R7 resolved here) | **Task 19** |
| 0 | `docs/v3/05-acceptance-tests.md` | NEG-20 row extended with Task-19 list | **Task 19** |
| 0 | `test/policy-approval.test.mjs` | NEG-20 `TASK19` set (four exact paths) | **Task 19** |
| 1 | `docs/v3/14-hotkey-runtime.md` | §5 code row, §6 handler+binding, §7/§8/§9 wording, §10 inputs | contract task |
| 1 | `docs/v3/24-local-runtime.md` | `--workspace` flag, default-unchanged statement | contract task |
| 1 | `docs/v3/25-real-scenario-test-harness.md` | §5/§10 production-factory + retained injection seam | contract task |
| 1 | `docs/v3/05-acceptance-tests.md` | **Group U specified**; NEG-20 rows for tasks 20/21 | contract task |
| 2 | `modules/hotkeys/src/handlers.mjs` | `handler.save-files` factory (R2/R3 semantics) | implementation |
| 2 | `modules/hotkeys/manifest.yaml` | semver bump only | implementation |
| 2 | `modules/hotkeys/src/errors.mjs` (+ `runtime.mjs` only if wiring demands) | `E_TOOL_WRITE_FAILED`; binding rule | implementation |
| 2 | `runtime/local-runtime.mjs` | opt-in `--workspace` wiring | implementation |
| 2 | `test/hkc-runtime.test.mjs` | **new HKR ids** for workspace-bound runs (HKR-01/HKR-04 untouched) | implementation |
| 2 | `test/scenario-harness.mjs`, `test/scenarios/RT-002/003/005.json` | native path (drop `handler`, keep assertions; evidence line = native handler id); bind the production factory when a scenario declares a workspace | implementation |
| 2 | `test/scenario-harness.test.mjs` (Group T) | only the assertion that names the injected id (`scenario.workspace-save` evidence line) is re-pointed; injection coverage is **retained** as a dedicated injection leg/variant, never deleted (Task 18 §17); harness rule tests (lines 112–113) stay untouched | implementation |
| 2 | `test/scenarios/RT-006.json` + `test/u-*.test.mjs` (Group U) + NEG-20 lists | new trial + executable acceptance | implementation |
| 2 | `docs/v3/26`, `05`, `25` status notes; `README.md` index (optional) | status updates | implementation |

Must not change: `docs/v3/01`–`04`, `12`, `22`, `23` (pins), `docs/v3/15`, `16`, `17`, `18`,
`19`, `20` (no contract reason), `composition/**`, `modules/agent/**`, `modules/planner/**`,
`modules/tool-bus/capabilities.json` (sha256 `41c967a1…`), `modules/module-registry/**`,
`modules/report-bus/**`, `test/scenarios/fixtures/notes.md`, and all legacy source files
(11 §1 hashes).

## Git Evidence

```text
HEAD:     1eb918ca0c91911953d1b075c29ecb28660c94c6  (Task 18, before Task 19 edits)
Commit:   see below (Task 19 commit, message "docs(v3): rule native write capability")
Remote:   https://github.com/jaber45861-boop/-  main  (verified equal to HEAD after push)
Worktree: clean after commit (git status --porcelain empty)
Baseline: node --test test/*.test.mjs → 291 tests · 49 suites · 291 pass · 0 fail ·
          0 skipped · 0 todo, exit 0 (before and after this task)
```
