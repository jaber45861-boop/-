# Grimoire v3 — Hotkeys L2 Runtime Contract

**Status:** Added Task 06 (runtime executor for the L2 Hotkeys module)
**Scope:** The `executeHotkey` pipeline, its execution states and result codes, the handler contract, executable test coverage, and the known limitations of this runtime. Task 05's validation/gate/report contract is unchanged and documented in `05-acceptance-tests.md` Group I; this document adds the runtime layer on top of it.

**GAP-007 reconciliation.** `12` §6 states that no runtime exists (GAP-007). That was true through Task 05; Task 06 adds this L2 executor, which changes nothing about registration: the registry still activates nothing by itself, `registration ≠ activation` still holds, and the runtime executes only records that are `ACTIVE` + `VALIDATED` + violation-free + gate-allowed. Core `01`–`04`, `12`, and all 18 source files are unchanged.

---

## 1. Non-goals (directive §3)

This runtime does NOT: redesign Core; modify Core `01`–`04` or `12`; activate blocked / ambiguous / insufficient-information / historical-removed / metadata-only records; resolve conflicting keys silently; invent missing behavior (including `F`, `VV`, `google`, or any other insufficient row); implement external adapters; rename legacy hotkeys; normalize source content; create undocumented aliases; alter source files; or commit/push.

## 2. Pipeline and API (directive §2/§4)

```
REGISTRY -> VALIDATE -> GATE -> RESOLVE -> EXECUTE -> CAPTURE RESULT -> REPORT
```

```js
import { createRuntime, buildRuntimeReport } from "./modules/hotkeys/src/runtime.mjs";

const runtime = createRuntime({ registryText, root, availableTools?, handlers? });
runtime.resolveHotkey(input);            // pure resolution — never executes (§8)
runtime.executeResolvedHotkey(resolution); // executes only an issued, authorized resolution
runtime.executeHotkey(input);            // resolve + execute (the §4 contract)
buildRuntimeReport(results);             // deterministic { text, sha256 } (§13)
```

`input` is `{ key?, command?, args? }` and nothing else; a malformed shape is `INVALID_INPUT` before any registry access. A configuration error (non-string `registryText`, empty `root`, bad `availableTools`, malformed handler map) throws at `createRuntime` — no runtime exists, therefore nothing can execute (fail closed, `01` §13.5).

## 3. Resolution order (exact; fail-closed at each step)

1. **Input validation** — plain object; only `key`/`command`/`args`; at least one of key/command; non-empty strings; `args` a plain object. Failure → `INVALID_INPUT`.
2. **Registry validation** — `validation.ok` must be `true` (Task 05 loader, zero violations). Failure → `REFUSED` `E_VALID_REGISTRY_INVALID` for *every* invocation.
3. **Lookup** — exact ids only: key first, then command; never by purpose/behavior strings; never a fallback dispatch. Unknown → `REFUSED`; key vs command resolving to different records → `INVALID_INPUT`; a repeated key/command (conflict) → `REFUSED` `E_CONFLICT_AMBIGUOUS_IDENTITY` (never silently resolved).
4. **Record belt** — a record carrying any loader violation → `REFUSED` `E_VALID_RECORD_REJECTED`.
5. **Activation gate** — `gate.mjs` (`ACTIVE` + `VALIDATED` only, `12` §6). Refusal → `REFUSED` with the status's `E_CONFLICT_*` code; nothing downstream is consulted.
6. **Registry-declared tools** — the record's `12` §2 Tools cell must be provided by `availableTools` (e.g. `SoS` needs `search providers`) → else `TOOL_REQUIRED`.
7. **Handler lookup** — absent → `UNIMPLEMENTED` (never invented, never substituted).
8. **Argument validation** — the handler's own schema; failure → `INVALID_INPUT`.
9. **Handler tools** — `handler.requiredTools ⊆ availableTools` → else `TOOL_REQUIRED`.
10. **Execute** — `handler.run({ args, root, key, command })` inside try/catch; success → `EXECUTABLE` executed; a throw is classified by `errors.classifyException` → `EXECUTION_ERROR`.

## 4. Execution state model (directive §6/§13)

Six execution classes; every result carries exactly one:

| Class | Meaning | `status` (03 §5) |
|---|---|---|
| `EXECUTABLE` | ACTIVE record + implemented handler + tools + args; executes | `success` (only when `executed`) |
| `UNIMPLEMENTED` | ACTIVE record, no runtime handler (`E-ENV`) | `blocked` |
| `REFUSED` | registry/gate/identity prevents execution | `failed`* |
| `INVALID_INPUT` | the invocation itself is malformed | `failed` |
| `TOOL_REQUIRED` | a required tool is unavailable (`E-TOOL`) | `blocked` |
| `EXECUTION_ERROR` | handler exists but threw (classified error) | `failed`* |

\* `status` is derived from the error class per `03` §5: `E-ENV`/`E-TOOL` → `blocked`; no error → `success`; everything else → `failed`.

Every result also carries ten distinct state flags — `validated`, `allowed`, `resolved`, `executable`, `executed`, `refused`, `invalid_input`, `unimplemented`, `tool_unavailable`, `execution_failed` — so validation success is never reported as execution success, and none of these states is ever collapsed. `phase_ledger`, `evidence`, `artifacts`, `remaining_issues`, and `assumptions` reuse the `03` §5 report schema (no parallel schema).

## 5. Result codes (directive §11: existing Core vocabulary only)

No new Core error class is introduced; every code maps into one of the seven classes of `01` §11.1 via `RESULT_CODES`. `E-CONFLICT` was added to the module's declared `errors:` subset (manifest + `errors.mjs`) because gate refusals genuinely are request-vs-spec conflicts (`01` §11.1: stop, present the conflict, never silently pick a side) — the prior subset had no raisable conflict case before the runtime existed. Each code is observable outside L2 (it is the machine-readable field of every resolution/result and appears in `buildRuntimeReport`).

**Scope note (Task 05 artifact unchanged):** the validation report's §7 (`report.mjs`) renders the five classes the *validation path* itself can raise (`E-INPUT`, `E-ENV`, `E-TOOL`, `E-VALID`, `E-UNKNOWN`) and states that every violation code maps into classes declared in the manifest — still true, because those five remain declared and `E-CONFLICT` is raised exclusively by the runtime layer, never as a loader/gate violation code. Task 05's report bytes, and its pinned sha256 `a3e24c9c3a9867abb9fb94fdc1568198d5782c95561d035833a48a0e182adac9`, are therefore unchanged by v1.1.0 (re-verified).

| Code | Class | Trigger | Recovery |
|---|---|---|---|
| `OK_RESOLVED` / `OK_EXECUTED` | — (success) | authorized resolution / executed handler | none needed |
| `E_INPUT_INVALID_INVOCATION`, `E_INPUT_MISSING_IDENTIFIER`, `E_INPUT_INVALID_KEY`, `E_INPUT_INVALID_COMMAND`, `E_INPUT_UNEXPECTED_FIELD`, `E_INPUT_KEY_COMMAND_MISMATCH`, `E_INPUT_INVALID_ARGS` | E-INPUT | malformed invocation or arguments | fix the invocation; registry untouched |
| `E_INPUT_UNKNOWN_KEY`, `E_INPUT_UNKNOWN_COMMAND` | E-INPUT | well-formed id, nothing registered | use a registered id |
| `E_VALID_REGISTRY_INVALID` | E-VALID | loader `ok=false` (any registry violation) | fix the registry; runtime refuses everything meanwhile |
| `E_VALID_RECORD_REJECTED` | E-VALID | target record carries loader violations | same as above |
| `E_VALID_ACTIVE_NOT_VALIDATED`, `E_VALID_UNKNOWN_STATUS` | E-VALID | defense-in-depth gate branches (loader makes them unreachable) | fix validation status |
| `E_VALID_UNAUTHORIZED_RESOLUTION` | E-VALID | `executeResolvedHotkey` received a resolution this runtime never issued | only resolutions from `resolveHotkey` may be executed |
| `E_VALID_HANDLER_SPEC` | E-VALID | malformed handler or mis-bound map key (throws at construction) | rebuild with `defineHandler`, key = `handler.command` |
| `E_CONFLICT_ADAPTER_REQUIRED`, `E_CONFLICT_BLOCKED_CONFLICT`, `E_CONFLICT_BLOCKED_AMBIGUOUS`, `E_CONFLICT_BLOCKED_INSUFFICIENT_INFO`, `E_CONFLICT_HISTORICAL_REMOVED`, `E_CONFLICT_METADATA_ONLY` | E-CONFLICT | gate refusal per `12` §6 | executive ruling / adapter implementation (never the runtime) |
| `E_CONFLICT_AMBIGUOUS_IDENTITY` | E-CONFLICT | two records share the invoked key/command | fix the registry conflict; never auto-picked |
| `E_ENV_HANDLER_MISSING` | E-ENV | ACTIVE record, no handler in this runtime | add a documented handler in a future task — or accept `UNIMPLEMENTED` |
| `E_TOOL_UNAVAILABLE` | E-TOOL | declared tool (record or handler) not in `availableTools` | provide the tool; never a silent no-op (`03` §4 H5) |
| `E_UNKNOWN_EXCEPTION` (+ other `classifyException` codes: `E_ENV_MISSING_FILE`, `E_TOOL_READ_FAILED`, …) | E-UNKNOWN / E-ENV / E-TOOL | handler threw | classified per `01` §11.1; `EXECUTION_ERROR` result, no artifact |
| `E_INPUT_INVALID_RUNTIME_CONFIG` | E-INPUT | `createRuntime` called with malformed configuration (throws) | fix the configuration |
| `E_TOOL_WRITE_FAILED` | E-TOOL | **Task 19 R4 only (contract text; no code in Task 20):** a native write operation failed on the write path (permission, filesystem I/O, directory target) | fix the cause; `EXECUTION_ERROR`, no artifact, never `COMPLETED` |

### 5.1 Native write failure mapping (Task 19 ruling `27` §R4 — contract text only)

Exactly one module-level failure code is authorized by the Task 19 ruling:
`E_TOOL_WRITE_FAILED`, classified **E-TOOL**. It is **not** a new Core error class —
`01` §11.1's seven classes stay unchanged (`03` §2 M5: choose the closest Core class) —
and no `E_WRITE_*` family or any other write-specific code may ever be created.

| Condition | Result |
|---|---|
| malformed/invalid path or content | `E_INPUT_INVALID_ARGS` / E-INPUT refusal |
| missing parent | `E_ENV_MISSING_FILE` / E-ENV → `EXECUTION_FAILED` |
| permission / filesystem I/O / directory failure | `EXECUTION_ERROR` / E-TOOL |
| handler unavailable | `E_ENV_HANDLER_MISSING` |
| required tool unavailable | `E_TOOL_UNAVAILABLE` → `TOOL_REQUIRED` |
| unexpected exception | `E_UNKNOWN_EXCEPTION` |
| native write tool operation failure | `E_TOOL_WRITE_FAILED` / E-TOOL |

Binding notes:

- On the **native write path**, an fs failure raised by the write itself is reported with
  `E_TOOL_WRITE_FAILED` (E-TOOL); the read path keeps `E_TOOL_READ_FAILED` unchanged.
  Both surface at the result level as `EXECUTION_ERROR`, and at the Agent as
  `EXECUTION_FAILED` (`status: FAILED`).
- Existing report and completion semantics are preserved verbatim: every terminal attempt
  still carries a report, and a failed report still upgrades any success to
  `REPORT_FAILED` (`18` §9).
- **No write failure may ever produce `COMPLETED`.** `COMPLETED` still requires
  `executed === true && ok === true` **and** a built report; `REFUSED` / `FAILED` /
  `blocked` / `REPORT_FAILED` are never collapsed (`03` §5, §4 above).
- No failure code beyond the table is authorized (`27` §R4; Task 19 does not license a
  second error taxonomy — `15` §18 rule 5).

## 6. Handler contract (directive §9)

The handler registry (`modules/hotkeys/src/handlers.mjs`) is strictly separate from the L3 registry: `L3 record -> resolver -> handler registry -> handler`. The L3 registry is never modified to make runtime code easier.

- `id` — unique handler identity (appears in `trace.handler_id`).
- `command` — the L3 command id; `createRuntime` rejects any map entry whose key ≠ `handler.command`, so a replaced/mis-bound handler can never be constructed into a runtime.
- `requiredTools` — checked against `availableTools` before any run (declare before use, `01` §10.1).
- `validateArgs(args)` — pure; returns `{ ok, code?, message? }`; default rejects any argument.
- `run({ args, root, key, command })` — the execution body; reachable only through `executeResolvedHotkey`.

Default handlers in this task:

| Handler id | Command | Behavior | Tools |
|---|---|---|---|
| `handler.readme` | `grimoire.key.R` | opens `Readme.md` (returns file + fingerprint + content) | `files` |
| `handler.patch-notes` | `grimoire.key.PN` | opens `PatchNotes.md` | `files` |
| `handler.open-part` | `grimoire.key.PTn` | opens `Part n` (`args.part` 1–9); resolves the real file set — `Part4` → `Part4_AllLessons.md` — never guesses | `files` |

### 6.1 `handler.save-files` — the native write handler (Task 19 ruling `27` §R1/§R6; **SPECIFIED, NOT IMPLEMENTED**)

Contract-only in Task 20: no handler code exists yet (`modules/hotkeys/src/handlers.mjs`
still ships exactly the three default handlers above), and no workspace wiring exists yet.
This subsection records the binding rules an implementation (Task 21) must satisfy.

| Field | Contract value |
|---|---|
| `id` | `handler.save-files` (fixed by `27` §R1; renaming is a new ruling) |
| `command` | `grimoire.key.G` (map key must equal it — `E_VALID_HANDLER_SPEC` belt above) |
| `requiredTools` | `["files"]` — the existing `files` capability, **unchanged and not repurposed**; it gates availability only, it never performs the write (`27` §R1) |
| `validateArgs(args)` | pure; exactly `{file: string, content: string}`; `file` per the §6.1.1 grammar; `content` non-empty UTF-8 text with no `U+0000`; any extra field, empty content, or bad path ⇒ `E_INPUT_INVALID_ARGS` (E-INPUT), before any filesystem call |
| `run(...)` | one `save`: **create-or-overwrite of exactly one UTF-8 text file**; returns `{file, bytes, lines, sha256, content}` like the read handlers |
| workspace | **injected composition dependency**, resolved strictly inside the declared workspace root; containment belt refuses anything that resolves outside it |

What this handler is **NOT** (Task 19 R1/R6):

- NOT a Tool Bus provider and NOT a new capability id — `capabilities.json` stays byte-
  identical (11 declarations, sha256 `41c967a1…`); the Tool Bus only `check`s availability;
- NOT a new module, NOT a new manifest, NOT a new operation kind (`18`: `hotkey` →
  `hotkeys:execute` only);
- NOT a `grimoire.adapter.*` — adapters gate `ADAPTER_REQUIRED` records and remain
  `NOT_ACTIVATED` (`12` §4); `G` is `ACTIVE`, so it takes the handler path;
- NOT runtime-global filesystem behavior — the runtime itself still writes nothing;
- NOT an authorization point: the handler performs containment validation only and never
  consults, grants, or caches approval (`27` §R5); the single GATE stays the only
  authorization, and approval already binds the full execution sub-request **including
  `args`** (`executionIdentity(bundle.execution)`).

**Binding rule (composition-root owned).** Only the composition root may bind this handler,
and only when it holds an **explicitly declared writable workspace**. The workspace comes
exclusively from composition-root wiring (constructor/flag data, exactly like `registryText`,
`root`, `handlers`, and the approval component). It must **never** come from:

```text
execution args · bundle data · cwd · environment · pid · clock/randomness · globals
```

and it must never be the Grimoire repository root (the checkout containing
`runtime/local-runtime.mjs`) — that is categorically not a writable workspace
(`27` §R3).

**Availability rule (default preserved).** With no workspace declared, this handler is
**not bound**, so `G` resolves exactly as today: `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING`,
`status: blocked`. With a valid declared workspace, `G → handler.save-files` is
contractually available. The default runtime, the default test wiring, HKR-01's split
(3/10/1), and HKR-04's key list are therefore unchanged by this contract.

**No GATE bypass.** The handler is reachable only through `executeResolvedHotkey` inside
the Hotkey Runtime, which the Agent calls at EXECUTE — and the Composer invokes the Agent
only after `GATE` succeeds (`20` lifecycle). `registration ≠ activation ≠ authorization`
(`12` §1, `27` §R5).

### 6.1.1 Path grammar and semantics (Task 19 ruling `27` §R2/§R3)

- `file`: non-empty, relative, `/`-separated, no leading `/`, no `.`/`..`/empty segments,
  no `\`, no drive/colon prefix, no NUL or newline, no trailing `/`.
- Included: **create** (missing target), **overwrite** (existing regular file), one UTF-8
  text file, exact resulting bytes.
- Excluded: **append**, **mkdir** (missing parent ⇒ failure), **rename**, **move**,
  **delete**, binary mode, multi-file operations, directory targets, globbing.
- **No atomicity is promised** — no temp-file/rename/durability claim may appear anywhere.
- Refusals: absolute path, `..` traversal, symlink escape, any resolution outside the
  workspace — `27` §R3 invariants.

## 7. ACTIVE resolution results (the 14, directive §5)

All 14 resolve past validation + gate (`trace` fully populated). Executable split: 3 / 10 / 1.

| Key | Command | Mode | Resolution | Code |
|---|---|---|---|---|
| `PTn` | `grimoire.key.PTn` | TEACH | `EXECUTABLE` (with valid `args.part`) | `OK_EXECUTED` |
| `Pi` | `grimoire.key.Pi` | TEACH | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `R` | `grimoire.key.R` | TEACH | `EXECUTABLE` | `OK_EXECUTED` |
| `PN` | `grimoire.key.PN` | ANSWER | `EXECUTABLE` | `OK_EXECUTED` |
| `W` | `grimoire.key.W` | CODE | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `A` | `grimoire.key.A` | PLAN | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `S` | `grimoire.key.S` | TEACH | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `SS` | `grimoire.key.SS` | TEACH | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `D` | `grimoire.key.D` | PLAN | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `G` | `grimoire.key.G` | CODE | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `H` | `grimoire.key.H` | DEBUG | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `C` | `grimoire.key.C` | CODE | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |
| `SoS` | `grimoire.key.SoS` | RESEARCH | `TOOL_REQUIRED` (record needs `search providers`) | `E_TOOL_UNAVAILABLE` |
| `Q` | `grimoire.key.Q` | TEACH | `UNIMPLEMENTED` | `E_ENV_HANDLER_MISSING` |

`UNIMPLEMENTED`/`TOOL_REQUIRED` are runtime results, not registry changes: the registry status of every one of the 14 stays exactly as pinned by Task 05.

### 7.1 `G` reconciliation — default state vs opt-in state (Task 19 ruling `27` §R7)

The table above stays **byte-for-byte as the default-wiring table**: it describes a runtime
constructed without a declared workspace.

| State | Binding | `G` result |
|---|---|---|
| **Default** — no workspace declared (Local Runtime without `--workspace`, default test wiring, HKR-01/HKR-04 construction) | no write handler bound | `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING`, `status: blocked` — **byte-identical to today** |
| **Opt-in** — composition root explicitly supplies a valid declared workspace | `G → handler.save-files` (§6.1) | contractually `EXECUTABLE`, subject to args validation, tool gate, and the GATE; covered by **new HKR ids added in Task 21** |

What this reconciliation does **not** change: HKR-01's exact split (3/10/1), HKR-04's key
list (which still contains `G` for the default wiring), `docs/v3/12-hotkey-registry.md`
(row, Tools cell `none`, statuses, integrity pin `c861b562…`), and the GATE — the opt-in
handler is reached only through the Agent after the Composer's `GATE` succeeds (`27` §R5;
no bypass, no second authorization). Registry status is untouched; `registration ≠
activation` still holds.

## 8. Test coverage and mutation coverage

Executable with `node --test` from the repo root. File: `test/hkc-runtime.test.mjs` (23 tests). Together with Task 05's 35 tests: **58 tests, 11 suites**.

| Id | Contract | Scenario → pass criteria |
|---|---|---|
| HKR-01 | A | Resolve each of the 14 ACTIVE keys → `validated/allowed/resolved`, classification ∈ {EXECUTABLE, UNIMPLEMENTED, TOOL_REQUIRED}, full trace (key, command, source anchor, statuses, mode ∈ `04` §2, handler id, classification, code); exact split 3/10/1; key set equals the canonical 14 |
| HKR-02 | B | Execute all 34 non-ACTIVE records with a spy handler registered for **every** Grimoire command → each `REFUSED` with its status's `E_CONFLICT_*` code, zero handler runs, no artifacts |
| HKR-03 | C | Unknown key/command → `REFUSED` (`E_INPUT_UNKNOWN_*`), trace `null`, no execution |
| HKR-04 | D | ACTIVE records without handlers (`W`, `Pi`, `Q`, `H`, `C`, `A`, `S`, `SS`, `D`, `G`) → `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING`, `status: blocked`, remaining issue names the command |
| HKR-05 | E | `R`, `PN`, `PTn` execute: output equals the real file bytes + sha256 (`Part4_AllLessons.md` resolved for part 4), artifact `hotkey-runtime-result:<command>` |
| HKR-06 | F | `SoS` → `TOOL_REQUIRED` (record tool `search providers`); same for the `R` handler when `availableTools: []` (handler tool `files`) — handler never runs |
| HKR-07 | G | Throwing handler → `EXECUTION_ERROR` / `E_UNKNOWN_EXCEPTION`, `execution_failed`, no artifact; identical structured result on rerun |
| HKR-08 | H | Resolving all 14 (twice more for `R`) leaves every counter at 0; only `executeResolvedHotkey(authorized)` runs — exactly 1; a refused resolution echoes without running |
| HKR-09 | I | Corrupt + empty registries → every invocation `E_VALID_REGISTRY_INVALID`; malformed configs throw at construction; 10 malformed invocation shapes → `INVALID_INPUT`; zero executions |
| HKR-10 | J | Two runtimes, identical inputs → `deepStrictEqual` results and resolutions, no timestamps/uuids in output, byte-identical reports |
| HKR-11/1…10 | K | The 10 required runtime mutations below |
| HKR-12 | — | Trace retains exactly the nine §14 fields; results carry the `03` §5 structure; every emitted code ∈ `RESULT_CODES` with matching class |
| HKR-13 | — | Report byte-stable + sha256 of own bytes; all six classification counts stated; the nine states stay distinct across results |
| HKR-14 | — | Two non-ACTIVE records sharing a key (invisible to loader duties) → `E_CONFLICT_AMBIGUOUS_IDENTITY`, never silently picked |

**Task 19/20 note (no test text changed):** HKR-01 and HKR-04 are **unchanged** — they
exercise the default (workspace-less) wiring, which this contract keeps byte-identical.
Workspace-bound `G` behavior is additive: **new HKR ids** (continuing the HKR series) are
specified for Task 21 together with executable Group U (`05` Group U), and no existing
assertion may be edited to fit an implementation (`27` §R7, Implementation Gate G6).

**HKR-11 — the 10 required runtime mutations, all fail safely:**

| # | Mutation | Outcome |
|---|---|---|
| 1 | ACTIVE → BLOCKED (`PTn`, summary kept consistent) | validation stays ok — the **gate alone** refuses: `E_CONFLICT_BLOCKED_CONFLICT`, spy run 0 |
| 2 | ACTIVE → ADAPTER_REQUIRED (`PTn`) | loader flags `adapter_ref_missing` → `E_VALID_REGISTRY_INVALID`, spy run 0 |
| 3 | ACTIVE → UNKNOWN (`PTn`) | loader flags `invalid_activation_status` → whole runtime refuses, all spies 0 |
| 4 | unknown key injection | `REFUSED` `E_INPUT_UNKNOWN_KEY`, trace `null`, spies 0 |
| 5 | unknown command injection | `REFUSED` `E_INPUT_UNKNOWN_COMMAND`, trace `null`, spies 0 |
| 6 | handler removal (`R`) | `UNIMPLEMENTED` `E_ENV_HANDLER_MISSING`; other handlers unaffected, run 0 → then PN runs exactly 1 |
| 7 | handler replacement (key `R`, bound to `PN`) | `createRuntime` throws `E_VALID_HANDLER_SPEC`; impostor run 0; malformed specs also rejected |
| 8 | malformed invocation (8 shapes) | each `INVALID_INPUT` with its exact code; total handler runs 0 |
| 9 | invalid registry (`mut_active_invalid_mode.txt`, asserted byte-different) | every invocation `E_VALID_REGISTRY_INVALID`; spies 0 |
| 10 | unauthorized fallback handler (extra handler + handler on a BLOCKED command + forged resolution) | gate refuses first (spy 0), `W` stays `UNIMPLEMENTED` (fallback never substituted), forged resolution → `E_VALID_UNAUTHORIZED_RESOLUTION`; all runs 0 |

## 9. Known limitations (directive §17)

- **10 of 14 ACTIVE records are `UNIMPLEMENTED` in the default wiring.** `W/A/S/SS/D/G/H/C/Q` are conversational prompt-behaviors and `Pi`'s "Interlude n" numbering is ambiguous in source (the first interlude is unnumbered); implementing them here would mean inventing behavior, which the directive forbids. They remain ACTIVE in the registry and report `E_ENV_HANDLER_MISSING` at trigger time. **`G` reconciliation (Task 19 `27` §R7):** `G`'s behavior is now *documented* — identity, `{file, content}` save semantics, workspace root, failure mapping, and approval interaction are fixed by `27` §R1–§R6 and §6.1 above — so the "inventing behavior" objection no longer applies to `G` **once a composition root binds `handler.save-files` with a declared workspace** (Task 21). Until that lands, and always in the default wiring, `G` stays in this list with the reason stated here; `W/A/S/SS/D/H/C/Q` and `Pi` are unchanged.
- **`SoS` is `TOOL_REQUIRED`.** Its record declares the `search providers` tool, which this runtime does not provide; no search behavior is executed or faked.
- **No external adapters** are implemented; `ADAPTER_REQUIRED` records are refused exactly as Task 05's gate requires.
- **Handlers return the opened document** (content + fingerprint) because this repository has no UI surface; there is no completion-report loop for hotkey-triggered *tasks* here — `03` §5/H6 remain normative for future task-level integration.
- **No persisted invocation log**: results are returned to the caller; only `buildRuntimeReport` serializes them, deterministically.
- The runtime consumes one registry snapshot per `createRuntime` call; re-reading the registry means building a new runtime.

## 10. Determinism rules (directive §10)

Same registry + input + handler set + tool availability ⇒ equivalent output. The runtime contains no timestamps, no random ids, no unordered iteration (lookup maps preserve registry order; report rows follow caller order; classification counts follow `EXECUTION_CLASSES` order). Handler outputs are derived from pinned repository files, which are themselves hash-verified by `11` §1 / HKC-17.

**Native write inputs (Task 19 ruling `27` §R6/§10; contract text only).** Native write
behavior depends solely on (a) the explicitly declared execution inputs — `target.key` and
`args = {file, content}` — and (b) the injected composition dependencies: the handler map
and the **workspace**, which is an explicit composition-root dependency supplied at wiring
time. Excluded from every determinism input: clock/time, randomness, process id,
environment-derived workspace, cwd-derived workspace, global mutable state, and any hidden
filesystem-root discovery (no scanning for a plausible root). Same registry + same inputs
+ same declared workspace ⇒ same result object, same resulting bytes, byte-identical
report (`27` Security Invariants 3, 8).
