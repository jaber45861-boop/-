# Grimoire v3 — Native Write Capability: Discovery & Contract Gate (Task 18)

**Status:** Task 18 investigation/design artifact — **GATE: STOP · IMPLEMENTATION_AUTHORIZED = NO**
**Scope:** a source-driven answer to one question: *may Grimoire v3 execute its first real
file change through a capability that ships in this architecture, rather than through a
capability the test harness injects?* This document is DATA + EVIDENCE + PROPOSAL only.
No runtime code, no capability, no provider, no handler, no acceptance-test behavior is
added, changed, or weakened by Task 18.
**Classification:** **C — No Contract Authority Exists** (§0 below).
**Baseline (re-verified for this task):** commit `6d3c1cd3aa20ef36e688db655b093753063c4d96`
(`LOCAL_HEAD == origin/main == remote HEAD`); `node --test test/*.test.mjs` →
**291 tests · 49 suites · 291 pass · 0 fail · 0 skipped · 0 todo**, exit 0.

> **Native Write Capability ≠ autonomous development.** Nothing in this record proposes
> memory, long-term planning, autonomous loops, self-modification, background agents, UI,
> cloud execution, databases, credentials, or multi-agent delegation. Task 18 concerns one
> capability only, and this task ships none of it.

---

## 0. Decision gate — why the classification is C

| Class | Candidate evidence | Verdict |
|---|---|---|
| **A — Native Write Contract Exists** | Nothing in `01`–`05`, `12`, `14`–`20`, `22`–`25` declares a write capability, write handler, write provider, or write operation. The only `fs.write*` call in the whole repository is the test harness's own (`test/scenario-harness.mjs:392`). | **Rejected** |
| **B — Extension Contract clearly permits adding one** | `03` §7/§2 define *how a module registers*, but `03` §8 states it "does NOT license new Core behavior" and routes a new primitive to "a versioned Core change (13.6), **approved before the module ships**". No approval exists. `03` defines no extension point for tools/providers at all, and the three candidate points (handler / module / tool-bus capability) carry materially different — and partly nonexistent — requirements (§4, §5). | **Rejected** |
| **C — No Contract Authority Exists** | No declaration source for a write capability id (`modules/tool-bus/src/capabilities.mjs:4-6`, `15` §18 rule 1), no write semantics anywhere, no production write root (§8, §9), and every forward-looking sentence routes write behavior to a *future, approved* task that has not happened (`14` §5's condition is unmet, `14` §9 forbids it for `G`, `25` §10 defers it). | **ADOPTED** |
| **D — Contract Is Ambiguous** | The nearest thing to a conflict — `14` §5 ("add a documented handler in a future task") versus `14` §9 ("implementing them here would mean inventing behavior, which the directive forbids") — resolves rather than conflicts: §5 is conditioned on the handler being *documented*, and §9 is the same document's evaluation that `G`'s behavior is **not** documented at implementation granularity. The residual reading is recorded as `R1` (§15), not as a live ambiguity that changes the outcome. | Rejected (see `R1`) |

**Gate outcome:** per the directive's Critical Rule, a `C` result means **no Native Write
Capability is implemented**, no runtime capability and no synthetic tests are added to
prove one, and only this investigation/design artifact is committed.

---

## 1. Source Evidence

Findings, each anchored to a file and line/section (verified in this session; `rg` inventory
plus full reads of the cited documents).

- **F1 — The repository contains exactly one filesystem write, in the test harness.**
  `rg -n "writeFile|writeFileSync|fs\.write|appendFile" modules composition runtime test docs scripts`
  → `test/scenario-harness.mjs:392` (`fs.writeFileSync(resolved, after, "utf8")` inside the
  injected `scenario.workspace-save` handler). Production code paths
  (`modules/**`, `composition/**`, `runtime/**`) contain no write at all; the only
  `process.stdout/stderr.write` uses are report rendering (`runtime/local-runtime.mjs:208-209`).
- **F2 — Record `G` exists, is `ACTIVE`, and its source wording is a goal, not a contract.**
  `docs/v3/12-hotkey-registry.md` §2 row 17: `G` · `grimoire.key.G` · purpose
  "Save your files as you go! mini Git stage" · behavior "saves/stages current files" ·
  mode `CODE` · output "saved file snapshot" · **Tools cell `none`** · Adapter `—` ·
  `ACTIVE` / `VALIDATED`. Legacy source: `PatchNotes.md:125`
  ("-New G Hotkey! Save you files as you go! Its like a mini Git stage").
- **F3 — The shipped handler set is read-only, three handlers.**
  `modules/hotkeys/src/handlers.mjs:155` `DEFAULT_HANDLERS` = `handler.readme` (R),
  `handler.patch-notes` (PN), `handler.open-part` (PTn); header comment: "only behaviors
  documented in the registry and verifiable against this repository's files are implemented".
  `G` has no shipped handler.
- **F4 — `G` resolves to `UNIMPLEMENTED` by contract.**
  `docs/v3/14-hotkey-runtime.md` §7 table (`G … UNIMPLEMENTED … E_ENV_HANDLER_MISSING`),
  §3 step 7 ("absent → `UNIMPLEMENTED` (never invented, never substituted)"), §9:
  "`W/A/S/SS/D/G/H/C/Q` … implementing them here would mean inventing behavior, which the
  directive forbids."
- **F5 — The only execution surface is the hotkey handler.**
  `modules/agent/src/orchestrator.mjs:381` — "EXECUTE (Hotkey Runtime only — never a
  handler directly)"; the Tool Bus appears only as `check()` in PREFLIGHT (`:366`).
  The Agent supports one operation kind: `docs/v3/18-agent-orchestrator.md:286`
  "One operation kind only (`hotkey` → `hotkeys:execute`); other kinds are rejected by
  design until a future task defines them."
- **F6 — The Tool Bus never executes in the real path, and its capability ids are declared,
  not derived from code.** `modules/tool-bus/src/capabilities.mjs:4-6`: "Every capability id
  is either a tool token taken verbatim from the L3 registry's Tools columns or `files` …
  Nothing here invents capability behavior". `docs/v3/15-tool-bus.md` §10: "a capability
  exists only when a registry/manifest declaration supports it (directive §Do NOT INVENT
  CAPABILITIES)"; §11: 11 declared capabilities, `files` = *read* ("Read a repository
  document and return its content with a SHA-256 fingerprint"), one provider `local-files`.
- **F7 — The production runtime has no handlers option and no workspace.**
  `runtime/local-runtime.mjs:130` — `createRuntime({ registryText, root: ROOT })`, where
  `ROOT` is the repository root (`:64` "The repository root this runtime is checked into").
  A CLI run can therefore only ever reach `DEFAULT_HANDLERS` → `G` is `UNIMPLEMENTED`.
- **F8 — The isolated workspace exists only in the harness, and is declared test-only.**
  `docs/v3/25-real-scenario-test-harness.md` §5: "The Hotkey Runtime's own `root`
  deliberately stays the repository root … Writes are confined to the scenario workspace by
  the handler's containment check, not by a runtime root switch"; §10: "The shipped Grimoire
  modules implement only read behaviours … Shipping write behaviour as a Grimoire module is
  a future Core task, not this one." `test/scenario-harness.mjs:113`
  `SCENARIO_HANDLERS = ["workspace-save"]`, `:158` a writing handler requires a declared
  workspace.
- **F9 — Pinned acceptance expectations would have to move, with no rule allowing it.**
  `test/hkc-runtime.test.mjs:166` pins `{ EXECUTABLE: 3, UNIMPLEMENTED: 10, TOOL_REQUIRED: 1 }`;
  `:226-246` (HKR-04) asserts `G` itself is `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING`.
  `test/tb-bus.test.mjs:358-361` pins `| Capabilities | 11 |`, `| AVAILABLE | 1 |`,
  `| UNAVAILABLE | 2 |`, `| BLOCKED | 8 |` and the declarations sha256 line.
  `docs/v3/14-hotkey-runtime.md` §8 documents HKR-01's "exact split 3/10/1".
- **F10 — Protected pins.** `docs/v3/01`–`04` and `docs/v3/12` are byte-pinned
  (`test/policy-approval.test.mjs:1402-1408`, `test/hkc-coverage.test.mjs:193-209`), and
  `test/scenario-harness.test.mjs:52-61` keeps `docs/v3/01`–`04`, `12`, `22`, `23` and
  `runtime/local-runtime.mjs` byte-identical across every scenario run (T-11).

## 2. Existing Capability Model

Three distinct "capability" surfaces exist, and they are not interchangeable:

1. **Tool Bus capability** (`docs/v3/15-tool-bus.md` §4): nine declared fields
   `id version purpose status input output requires provider errors`, four statuses
   (`AVAILABLE`/`UNAVAILABLE`/`BLOCKED`/`DISABLED`), declarations in
   `modules/tool-bus/capabilities.json`, implementations in `createDefaultProviders()`.
   `AVAILABLE` requires a bound provider; ids come from the `12` §2 Tools columns or
   `files`.
2. **Module `provides` capability** (`docs/v3/16-module-registry.md`): e.g. the hotkeys
   module provides `hotkeys:validate`, `hotkeys:activation-gate`, `hotkeys:execute`
   (`modules/hotkeys/manifest.yaml`), resolved by `resolveCapability`.
3. **Hotkey handler** (`docs/v3/14-hotkey-runtime.md` §6): `{id, command, requiredTools,
   validateArgs, run}` bound to an L3 command id; `run({args, root, key, command})` is the
   only body reachable through `executeResolvedHotkey`.

The Agent reaches (2) at RESOLVE, the Tool Bus at PREFLIGHT (`check` only), and (3) at
EXECUTE. **A write that must actually happen can only happen in (3) today.**

## 3. Existing Write-Related Behavior

- **Production:** none (F1). Reads are served by `handler.readme`/`handler.patch-notes`/
  `handler.open-part` and by the `local-files` provider (containment-checked read,
  `modules/tool-bus/src/capabilities.mjs` `invoke`).
- **Registry intent:** record `G` is the only `ACTIVE` record whose documented purpose is
  saving files (F2); its Tools cell is `none`, so no tool token for writing exists anywhere
  in `12` §2.
- **Test-only:** the harness's `scenario.workspace-save` handler appends one line to a file
  inside a `fs.mkdtempSync` workspace, refuses absolute paths / `..` / anything resolving
  outside it, and returns the `{file, bytes, lines, sha256, content}` shape the shipped read
  handlers use (`test/scenario-harness.mjs:360-405`). It is bound through the documented
  `createRuntime({handlers})` injection point and exists only because the scenario declares
  a workspace (`validateScenario`, `:153-159`).

## 4. Contract Authority

| Question | What the source says | Consequence |
|---|---|---|
| May a module be added? | `03` §1, §2, §7 — yes, with a complete manifest, no Core edit beyond a registry entry, declared tools/phases/errors, refusal tests. | Process exists; **process ≠ permission for a specific behavior**. |
| Does `03` license this behavior? | `03` §8: "It does NOT license new Core behavior: if a module needs a new Core primitive, that is a versioned Core change (13.6), approved before the module ships." `25` §10 calls shipping write behavior "a future **Core** task". | The required approval does not exist → authority absent. |
| May a Tool Bus capability be added? | `15` §18 rule 1: only from "a `12` §2 Tools token, a manifest `requires.tools` entry, a `12` §4 adapter declaration, or an actual executable implementation"; rule 6 requires a named TB test and a declaration-sha256 update; §10 requires a supporting registry/manifest declaration. | No write token, no write manifest entry, no write adapter. The 4th clause is self-referential and would itself violate "Do NOT INVENT CAPABILITIES" — it grants no id, no semantics, no root. |
| May a handler be added? | `14` §5: "add a **documented** handler in a future task — or accept `UNIMPLEMENTED`"; `14` §1 non-goals forbid inventing behavior; `14` §9 names `G` among the records whose implementation "would mean inventing behavior, which the directive forbids". | Condition unmet: nothing documents *where*, *to what target*, *with which arguments*, or *with which failure semantics* a save writes. |
| May the registry change? | `12` is protected and integrity-pinned (F10); `12` §6 keeps `registration ≠ activation`. | Neither needed nor permitted; record `G` already exists. |
| Could a new module's capability be executed? | `18` §"Known limitations": one operation kind (`hotkey` → `hotkeys:execute`). | A non-hotkey write module would be unreachable through the real path. |

**MISSING_AUTHORITY summary:** no capability id, no write semantics, no write root, no
failure-code mapping for writes, no authorization to move the HKR/TB pins, no approval for a
Core-level change.

## 5. Proposed Native Capability (PROPOSAL — not authorized, not implemented)

Everything in this section is a **PROPOSAL** and carries no contract force.

- **Shape if ever authorized:** a handler bound to the existing `ACTIVE` record
  `G` (the only execution surface, F5), declared in `modules/hotkeys/src/handlers.mjs`
  alongside the three read handlers, reachable only through
  `Planner → GATE → Agent → Hotkey Runtime → handler`.
- **Identity:** **unassigned on purpose.** A capability/handler name must come from the
  contract or a recorded ruling, not from this task's preference (`12`/`03` §4 H3/H4 name
  rules). Candidate id sources to be decided in `R2`.
- **Tool Bus representation if also declared:** would require a `capabilities.json` row +
  a bound provider + a named TB test + a new declarations sha256 in `15` §11 — and would
  still only ever be `check()`ed, never invoked, because the Agent never calls `invoke`.
  Declaring an unreachable write capability would contradict `15` §10.
- **Registry representation:** none. Record `G` already exists with Tools `none`; adding a
  tool token to `12` would break the integrity pin (F10) and is forbidden.
- **Runtime representation:** the local runtime would need a writable root (today it passes
  the repository root only, F7). Supplying one is a change to
  `runtime/local-runtime.mjs`, which `24` documents as a consuming shell and T-11 keeps
  byte-stable — see blocker `B3`.
- **Approval interaction:** unchanged and non-negotiable —
  `Planner → review.required → Approval → GATE → Agent → Tool Bus (check) → handler`.
  Nothing in the write path may approve, and `23` defines no write-specific approval rule
  to follow, which is itself a decision (`R4`).
- **Testing if authorized:** Group U (`U-01…U-12` per the directive), plus an explicit,
  narrowly scoped NEG-20 boundary extension listing only the Task-18 files.

## 6. Registry Representation

None required, and none permitted: `docs/v3/12-hotkey-registry.md` §2 row 17 already
registers `G` as `ACTIVE`/`VALIDATED` with Tools `none`, and `12` is byte-pinned (F10).
Registration ≠ activation (`12` §1 note): the record's `ACTIVE` status is exactly why the
runtime reaches the "handler lookup" step and honestly reports `UNIMPLEMENTED`. **No
registry validation is loosened, no pin is changed, no row is rewritten.**

## 7. Tool Bus Representation

Current state: 11 declared capabilities, one provider (`local-files`, read), counts pinned
(F9). The bus is a *gate* in the real path (`check` at Agent PREFLIGHT; `gateTools` steps 6
and 9 in the runtime) — `15` §13. **`invoke` is never called by the Agent or the Local
Runtime**, so a write provider added to the bus would be dead code relative to RT-002's
path. The `declaration → registry → provider → tool bus → agent` chain the directive asks
for therefore cannot carry a write today: the chain ends at `check`.

## 8. Runtime Handler/Provider Boundary

- Handler contract (`14` §6): `run({args, root, key, command})` where `root` is the
  **repository root** in every production wiring (`runtime/local-runtime.mjs:130`) and in
  the harness's runtime construction (`test/scenario-harness.mjs` `createRuntime({…
  root: REPO_ROOT …})`). The harness's injected handler ignores that root and closes over
  its workspace instead — possible only because the harness builds the handler itself.
- Consequence: a *native* handler would receive the repository root and would have to be
  pointed somewhere else by a mechanism no contract defines. Reading `root` as the write
  target would mutate the checked-out repository from a hotkey invocation, which no rule
  authorizes and which the harness rules explicitly prevent for scenarios (`25` §1/§7).
- **No runtime direct filesystem write** is introduced outside the Tool Bus/handler
  boundary: the directive's rule ("runtime direct filesystem write" forbidden) is preserved
  trivially, because Task 18 ships no write at all.

## 9. Workspace/Path Security (models extracted, none invented)

**Existing model 1 — repository-root containment (read).**
`modules/tool-bus/src/capabilities.mjs` `local-files.invoke`: requires a non-empty `root`,
`path.resolve(root, input.file)`, refuses anything not equal to or inside
`root + path.sep` (`EACCES`), missing file → `ENOENT`; `15` §16 documents it as
"no absolute or `..` traversal out of the repository".

**Existing model 2 — scenario-workspace containment (test-only).**
`25` §7: workspace created with `fs.mkdtempSync` outside the repository, handler refuses
absolute paths, `..` segments, and anything resolving outside it; a writing handler may only
be declared by a scenario that declares a workspace; cleanup always runs; `T-06`/`T-11`
prove fixtures and protected files are untouched.

**Gap (why this is a blocker, not a detail):** neither model defines *where a production
write is allowed to land*. Model 1's root is the repository (writing there = mutating the
checkout); model 2's root lives in the test harness, which the directive forbids a
production capability from depending on. A third boundary — a writable workspace root for
real runs — exists in no contract, and inventing it is exactly the "do not invent security
model" prohibition.

**Explicitly not introduced:** absolute-path acceptance outside a root, `..` traversal,
symlink escape, unbounded mutation, repository-wide deletion, hidden path expansion — all
remain refused by the existing models where they apply, and Task 18 adds no path handling
whatsoever.

## 10. Approval Interaction

Unchanged. `23` §2 keeps approval out of the bundle; the GATE (`composition/plan-execution`)
consults the injected component before ORCHESTRATE; the Agent runs only after the gate.
Task 18 adds no approval surface, no approval bypass, and no write-side verdict: the write
capability — if it is ever authorized — sits strictly *after* the GATE, and can never
approve itself, be approved by the runtime, or be reached by skipping the gate. `23` and
`22` are untouched.

## 11. Report Evidence

The evidence and report shapes a native write would have to use already exist and need no
new vocabulary: execution evidence lines
(`execute: <handler-id> -> <file>`, `runtime.executeHotkey(...) → OK_EXECUTED (executed=true)`,
`toolBus.check(<tool>) → TB_OK`), the `03` §5 completion report through the Report Bus, and
`{file, bytes, lines, sha256, content}` output that RT-002 already asserts
(`execution.outputFile`, `outputSha256`). Task 18 emits no report of its own beyond this
document; no status is claimed as `COMPLETED` for a write that never ran.

## 12. Failure Semantics

For any future implementation, only existing vocabulary applies (directive §16):

| Case | Existing mechanism | Never |
|---|---|---|
| target escapes the allowed root | provider/handler throws `EACCES` → `classifyException` / `classifyProviderError` → `E-TOOL` refusal (`15` §12, `14` §5) | silent success |
| invalid arguments | handler `validateArgs` → `INVALID_INPUT` (`E-INPUT`), pre-execution | guessed execution |
| missing handler | `UNIMPLEMENTED` / `E_ENV_HANDLER_MISSING` (`E-ENV`) | substituted fallback (TB-19/HKR-11 patterns) |
| handler throws | `EXECUTION_ERROR`, classified, no artifact → Agent `EXECUTION_FAILED` (`status: FAILED`) | `COMPLETED` without bytes |
| report cannot be built | Agent upgrades to `REPORT_FAILED` | completion claim |

No `E_WRITE_*` code, no new Core class, no atomicity claim: `01`–`04`, `14`, `15` specify
no atomicity for writes, so a future implementation MUST NOT assert atomicity until a
contract defines it (§12 of the directive). Failure never reads as
`| Status | COMPLETED |`.

## 13. Test Strategy

**Executed in Task 18:** baseline and post-artifact full suite (`node --test test/*.test.mjs`)
must stay at **291/291, 0 skipped, 0 todo** — regression is the acceptance criterion of a
`C` result. Groups Q/R/S/T and the five RT scenarios are re-run unmodified.

**Group U: deliberately not added.** The directive forbids tests that the
implementation/contract does not support; there is no native capability to exercise, so
`U-01…U-12` would be synthetic proof of nonexistent behavior. They are specified here only
as the acceptance set for a future authorized implementation:

| Id | What it would prove |
|---|---|
| U-01 | capability/handler declaration valid under `03` §2 / `14` §6 |
| U-02 | registry validation unchanged and still green (no pin touched) |
| U-03 | provider/handler wiring — declared *and* bound, else fail closed |
| U-04/U-05 | allowed relative write; exact resulting bytes (`sha256` of the file) |
| U-06/U-07/U-08 | workspace containment; `../outside` refused; absolute outside-root refused |
| U-09/U-10 | write failure propagates as `EXECUTION_FAILED`/`E-TOOL`; never a false `COMPLETED` |
| U-11 | real Planner → GATE → Agent → Tool Bus (`check`) → runtime → capability path |
| U-12 | RT-002 without `createRuntime({handlers: …write…})` |

**Negative/failure cases** are already proven for the injected path by `T-11`
(`../notes.md` never executes, nothing escapes) and by HKR/TB refusal matrices; they stay.

**Pins that an implementation would have to renegotiate (not silently edited):** HKR-01's
`3/10/1` split, HKR-04's `G ∈ UNIMPLEMENTED`, `15` §11's capability inventory/counts,
`14` §7's table, `25` §10's statement, and RT-002's
`evidenceContains: ["execute: scenario.workspace-save -> notes.md"]`.

## 14. Explicit Non-Goals

- No memory, long-term planning, autonomous loop, self-modification, background agent,
  web/desktop UI, cloud execution, database, credentials, auth server, or multi-agent
  delegation (directive §22).
- No modification of `runtime/local-runtime.mjs`, no redesign of the harness, no new
  operation kind, no adapter activation, no capability row, no provider, no handler.
- No protected file touched (`01`–`04`, `12`, `22`, `23` byte-identical; re-verified).
- No acceptance test weakened, no assertion deleted, no fallback added; the only test edit
  is the NEG-20 boundary extension required by §20 for the Task-18 files themselves (§below).
- **Native Write Capability ≠ autonomous development** — even if later authorized, one
  root-confined write capability would not make Grimoire an autonomous engineer.

## 15. Open Decisions (REQUIRED_DECISIONS)

| Id | Decision that must be recorded by an authorized owner before any implementation |
|---|---|
| `R1` | Reconcile `14` §5 ("add a documented handler in a future task") with `14` §9 (naming `G` as invention) — either ruling must be written into the contract, not inferred. |
| `R2` | The capability/handler **identity** and where it comes from (`12` §2 token, manifest `requires.tools`, or a new declaration) — names are never guessed. |
| `R3` | The **writable root**: what root a production write is confined to, given the runtime's root is the repository (`F7`) and the harness workspace is test-only (`F8`). |
| `R4` | Whether a write (especially destructive or repo-wide) needs a Core approval rule in `23`/`22`, or whether the existing GATE is sufficient. |
| `R5` | Filesystem semantics: create / overwrite / append / missing file / existing file / directory target / invalid path, all deterministic and contract-written. |
| `R6` | Which pinned expectations may move (HKR-01/HKR-04, `15` §11 counts, RT-002 evidence) and under whose authority — none may be edited to fit an implementation. |
| `R7` | Failure/atomicity wording: which existing codes cover a failing write, and whether any atomicity guarantee is ever promised (none today). |

---

## Appendix A — Required directive field blocks

### SOURCE_FINDINGS
`F1`–`F10` (§1): one harness-only write; `G` ACTIVE with Tools `none` and goal-level source
wording; three read-only shipped handlers; `G` → `UNIMPLEMENTED` by contract; execution only
through the hotkey handler; Tool Bus `check`-only with declaration-derived ids; local runtime
wires `root = repository root` and no handlers; isolated workspace exists only in the test
harness; HKR/TB pins fixed at current state; protected pins on `01`–`04`, `12`, `22`, `23`,
`runtime/local-runtime.mjs`.

### MISSING_AUTHORITY
1. No capability id for writing in any Tools column, manifest, or adapter declaration.
2. No write semantics (create/overwrite/append/path rules) anywhere in `01`–`05`, `12`,
   `14`–`20`, `22`–`25`.
3. No writable root for production execution (`F7` vs `F8`).
4. No failure-code mapping for write operations beyond the generic classifier, and no
   atomicity rule.
5. No authorization to move HKR-01/HKR-04/`15` §11/RT-002 pins.
6. No approved versioned Core change (`03` §8) despite `25` §10 routing write behavior to
   "a future Core task".

### REQUIRED_DECISIONS
`R1`–`R7` (§15).

### PROPOSAL (`PROPOSED_EXTENSION`)
A root-confined save behavior bound to record `G`, declared in the L2 handler registry and
reached only through Planner → GATE → Agent → Runtime, with a contract-defined workspace
root, contract-defined filesystem semantics, existing error vocabulary only, Group U
acceptance tests, and a one-time, narrowly scoped NEG-20 boundary extension — **all of it
 contingent on `R1`–`R7` being ruled first.** Nothing in it is implemented now.

### SECURITY_BOUNDARY
Extracted, not invented (§9): repository-root containment for the existing read provider
(`path.resolve(root, …)` + escape refusal + `EACCES`), and scenario-workspace containment for
the harness (absolute/`..`/outside refusal, workspace-only handlers, `T-06`/`T-11` proofs).
The missing third boundary (a production write root) is blocker `B3`. Task 18 introduces no
path handling, no deletion, no symlink logic, and no permission model.

### IMPLEMENTATION_BLOCKERS
- **B1 — No contract authority.** Classification `C` (§0): `03` §8 requires an approved
  versioned Core change; no approval exists.
- **B2 — No capability identity.** `15` §18 rule 1 + `capabilities.mjs:4-6`: ids come from
  registry Tools tokens or `files`; no write token exists, and `12` is pinned.
- **B3 — No writable root.** Production wiring passes the repository root; the only
  workspace is test harness-owned and must not be depended on by production code.
- **B4 — No documented semantics.** `14` §5 admits only *documented* handlers; `14` §9
  states implementing `G` would be inventing behavior.
- **B5 — Pinned expectations conflict.** HKR-01 `3/10/1`, HKR-04's `G`, `15` §11 counts,
  RT-002's evidence line — all would break, and no rule authorizes changing them.
- **B6 — Unreachable as a module capability.** One operation kind only (`18:286`); a
  non-hotkey write module cannot be executed by the real Agent path.
- **B7 — Dead as a Tool Bus capability.** The real path only `check()`s; a declared write
  provider would never be invoked, contradicting `15` §10.

## Appendix B — Task 18 change record

| File | Why it is in scope |
|---|---|
| `docs/v3/26-native-write-capability.md` | this artifact (directive §4/§5, No-Authority path) |
| `test/policy-approval.test.mjs` | NEG-20 boundary extended by exactly the two Task-18 files above (directive §20) — no assertion changed, `unexpected file → test failure` still holds for everything else |

Verification: `node --test test/*.test.mjs` → 291 tests · 49 suites · 291 pass · 0 fail ·
0 skipped · 0 todo · exit 0, both before this artifact and after it.
