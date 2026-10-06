# Grimoire v3 — Native Write Security & Integrity Audit (Task 22)

**Status:** Task 22 audit artifact — **AUDIT_STATUS = PASS · FINDINGS = NONE**
**Scope:** audit-first post-implementation security and integrity audit of the Native Write
Capability shipped by Task 21 (`handler.save-files` and its composition-root wiring). This
document records the audit only. No production code was refactored, broadened, weakened, or
repaired; R1–R7 (`27`) were not reopened; no protected Core specification was modified.
**Classification vocabulary:** every observation below is classified exactly one of
`PASS` / `FINDING` / `CONTRACT_CONTRADICTION` / `PRE-EXISTING` / `OUT_OF_SCOPE`.
**Audit target (Task 21 commit):** `f3b5ae5f3f2aab119d5744779137f4e1031cc6b5`
(`LOCAL_HEAD == origin/main == remote HEAD` at audit start; `git pull --ff-only` reported
no divergence).
**Gates at audit end:** `node --test test/*.test.mjs` → **305 tests · 55 suites · 305 pass ·
0 fail · 0 skipped · 0 todo**, exit 0; `node test/scenario-harness.mjs --all` →
`SUMMARY scenarios=6 passed=6 failed=0 harnessFailures=0`, exit 0;
`node test/scenario-harness.mjs RT-006` → `passed=1 failed=0`, exit 0;
`git diff --check` → exit 0 (no whitespace errors).

---

## 1. Audit areas

| # | Area | Result |
|---|---|---|
| A | Capability identity | **PASS** |
| B | Input grammar | **PASS** |
| C | Path containment | **PASS** |
| D | Symlink / TOCTOU | **PASS** |
| E | Workspace boundary | **PASS** |
| F | Write semantics | **PASS** |
| G | Failure mapping | **PASS** |
| H | Approval / GATE | **PASS** |
| I | Tool Bus | **PASS** |
| J | Determinism and state | **PASS** |
| K | Local Runtime | **PASS** |
| L | Scenario harness | **PASS** |
| M | Test quality | **PASS** |
| N | Write surface | **PASS** |
| O | Protected integrity | **PASS** |
| P | Regression | **PASS** |
| — | Adversarial matrix | **35 / 35 PASS** |

---

## 2. Audit A — Capability identity (PASS)

The chain `G → grimoire.key.G → hotkey → hotkeys:execute → handler.save-files → files` is
intact and singular:

- The writer is defined exactly once, as `createSaveFilesHandler` in
  `modules/hotkeys/src/handlers.mjs`, returning `defineHandler({ id: "handler.save-files",
  command: "grimoire.key.G", requiredTools: ["files"], ... })`.
- Production references are exactly two: the definition site and the composition root
  (`runtime/local-runtime.mjs:185` binds it under `grimoire.key.G` only when `--workspace`
  is supplied). `handler.save-files` is absent from `DEFAULT_HANDLERS`, so the default
  wiring is byte-identical to Task 21's baseline (verified: default fixture exits 0; `G`
  without `--workspace` exits 4 with `E_ENV_HANDLER_MISSING`).
- `modules/tool-bus/capabilities.json` unchanged (hash below, `declared: 11`); no new
  capability token, no registry change, no alias, no alternate execution path. A fabricated
  capability `hotkeys:save` never completes (U-01(e), matrix identity assertions).
- The writer cannot be invoked through an unintended operation kind: only
  `kind: "hotkey"` + `capability: "hotkeys:execute"` reaches `resolveHotkey`.
- Manifest `version: "1.2.0"` satisfies R7/§R1's semver-bump-at-implementation requirement
  (`03` §2; ruling `27` R1/R7).

## 3. Audit B — Input grammar (PASS)

`validateSaveArgs(workspaceReal)` is pure and runs **before any filesystem call**. It
enforces exactly keys `{content, file}` (sorted length-2 check — extra members such as
`append: true` are refused), non-empty string `file`, no NUL, no CR/LF, no leading `/`, no
`:`/`\`, no trailing `/`, no empty/`.`/`..` segments, string non-empty `content` with no
NUL, then lexical `path.resolve` containment. Because validation precedes `run`, a
malformed input cannot partially mutate a file — verified by U-04…U-10 and matrix cases
3–6, 13–15, 17 (target files absent or byte-identical after refusal). Multiple-file,
mkdir-shaped, and append-shaped structures are refused at the exact-key check (matrix B1,
cases 15/17); percent-encoded traversal is **not** decoded and stays a literal in-workspace
name (matrix B2).

## 4. Audit C — Path containment (PASS)

Containment is semantic, not naive string prefix: lexical belt uses
`resolved === workspaceReal || resolved.startsWith(workspaceReal + path.sep)` and the
real-path belt uses `isInside(target, root)` with the same `path.sep` boundary. The
required prefix-collision pair `/workspace/file` vs `/workspace-other/file` is held by the
separator boundary (matrix case 7). Absolute POSIX, Windows drive/UNC (`C:\`, `C:/`,
`\\server\share`), `..`, repeated `..`, `.` components, empty segments, colons and
backslashes are all refused at grammar level before I/O (cases 3–6; U-07…U-09). Parent
resolution (`realpathSync(dirname)`) and final-component resolution (`lstat` + `realpath`)
are both re-checked against the workspace before the write (cases 8–10; U-10).

## 5. Audit D — Symlink / TOCTOU (PASS — reasoned, not assumed)

Sequence inspected: (1) lexical resolve → (2) `realpathSync(parent)` + containment →
(3) `lstatSync(final)`; symlink ⇒ `realpathSync` + containment → (4) `statSync`
(directory/non-file refused) → (5) `fs.writeFileSync(writePath, content)`.

A check-to-use gap exists in principle between (2) and (5). It is **not** a contract-
relevant vulnerability in this runtime model, for three demonstrated reasons:

1. `saveFilesRun` is fully synchronous — no `await`, no event-loop yield between check and
   use — so no other Grimoire code (agent, planner, handlers) can interleave. The only
   possible racer is an external OS process acting concurrently inside the workspace.
2. Exploiting the race requires the attacker to already hold write access inside the
   declared workspace (to swap a component for a symlink). A process with that access can
   already write wherever the workspace owner can write; the race grants no privilege the
   racer does not already possess. The workspace is construction-time forbidden from being
   inside, equal to, or containing the repository root, so the race cannot reach
   repository content through this path.
3. The contract (`27` §R2/R4, `14` §6.1) explicitly claims **no atomicity** and defines the
   real-path belt as the containment mechanism for symlinks *present at check time* — which
   it demonstrably enforces (cases 8–10, B3–B4, U-10).

Symlink behaviors tested: parent escape refused (E_TOOL_WRITE_FAILED, nothing outside);
final-component escape refused (outside target byte-identical); dangling symlink
conservatively refused (outside file never created); symlink to a target **inside** the
workspace followed safely (B3); dangling inside-workspace symlink conservatively refused
(B4). Classification: **PASS** — no race is reachable by any actor within the authorized
runtime model, and the contract does not claim concurrent-atomicity. No redesign performed.

## 6. Audit E — Workspace boundary (PASS)

All R3 rules hold, each refused at **both** the factory and the `--workspace` flag layer
(matrix cases 25–29): workspace must be explicitly supplied (no cwd/environment/bundle/pid
fallback — `resolveWorkspace` is the only entry), must exist, must be a directory, must
not equal the repository root, must not be inside it, must not contain it. Messages name
the exact violated rule ("repository root", "outside the Grimoire repository root",
"must not contain", "does not exist", "not a directory"); flag failures exit 2 with
`INPUT ERROR`, construction failures carry `E_INPUT_INVALID_RUNTIME_CONFIG` (E-INPUT).
Default behavior without `--workspace` is unchanged (case B5).

## 7. Audit F — Write semantics (PASS)

Exactly `save(file, content)`: one file, UTF-8, create-or-overwrite (cases 1, 2, 16;
U-02/U-03 verify exact bytes and sha256). Refused: append (case 17), mkdir/trailing slash
and directory target (cases 11, U-05), missing parent (case 12 — no directory created),
empty content (case 13), multi-file/binary-shaped extra args (B1), rename/move/delete have
no code path at all. The only mutation call in production modules is
`modules/hotkeys/src/handlers.mjs` `fs.writeFileSync` (Audit N). No hidden directory
creation (every failure asserts an empty workspace listing); no write occurs after a
refusal (sentinels byte-identical); no atomicity claim exists in code or contract.

## 8. Audit G — Failure mapping (PASS)

Verified end-to-end with exact codes:

- invalid input → `E_INPUT_INVALID_ARGS` → `EXECUTION_REFUSED` (E-INPUT) — matrix 3–6,
  13–15, 17; U-04/U-08/U-09;
- missing parent → ENOENT rethrown as-is → `E_ENV_MISSING_FILE` → `EXECUTION_FAILED`
  (E-ENV) — case 12, U-06;
- permission/I/O/directory/symlink-escape/ELOOP → `writeFailure` → `E_TOOL_WRITE_FAILED`
  → `EXECUTION_ERROR`/`EXECUTION_FAILED` (E-TOOL) — case 23, U-05(b), U-10, U-12;
- handler unavailable → `E_ENV_HANDLER_MISSING` (E-ENV) — case 21, U-12(4);
- tool unavailable → `E_TOOL_UNAVAILABLE` → `TOOL_REQUIRED`, handler never runs — case 22,
  U-12(5);
- unexpected exception → `E_UNKNOWN_EXCEPTION` (E-UNKNOWN) — case 24, U-12(6).

Catch ordering inspected block-by-block in `saveFilesRun`: the pre-classified
`E_TOOL_WRITE_FAILED` rethrow is checked **before** the ENOENT branch in the `lstat`
block; ENOENT rethrow branches exist at each fs call (parent, target, write); every other
error becomes `writeFailure` (never a fall-through to unknown).
`errors.mjs classifyException` passes through any error carrying a `grimoire` payload with
string code + Core class, so no broad catch converts a known classification into
`E_UNKNOWN_EXCEPTION`. **No observed path returns COMPLETED** — asserted by
`assertNeverCompleted` over every failure in U-12 and every matrix refusal.

## 9. Audit H — Approval / GATE (PASS)

`modules/hotkeys/src/handlers.mjs` contains **zero** approval logic — the only matches for
approval-related tokens are two comments explicitly stating the handler "is NOT an
authorization point (the single GATE decides)". The GATE is the sole authorization: plan
review status (`trigger`) determines gating; the verdict binds
`planIdentity(plan)` + `executionIdentity(execution)` where the canonical execution
encodes the full sub-request **including `args.file` and `args.content`** (sorted-key
canonical JSON of the nested `args` in `composition/plan-execution/src/approval.mjs`).
Binding proven for content (U-11(3), matrix 20) **and for file alone** (Task 22 ad-hoc
probe: verdict computed over `{file: "other.md", same content}` → `binding mismatch`,
no write, exactly one verify). No approval → GATE refusal, `orchestration === null`
(agent count zero); denial → no write; exactly one verification per gated attempt, no
cache, no retry, no second consult (U-11). No production path calls the writer outside
the authorized orchestration: `runLocalRuntime`/`main` always traverse planner → GATE →
agent → runtime. The only seam that reaches the handler without a bundle is the
**factory-level unit-test seam** (`createSaveFilesHandler` called directly in
`test/native-write.test.mjs`) — a test construction API, not a production bypass: no
production entrypoint exposes it, and those calls assert identity/gate properties without
claiming orchestration.

## 10. Audit I — Tool Bus (PASS)

`files` remains the declared tool; `capabilities.json` byte-identical (hash below,
`declared: 11`); no new capability token anywhere; Tool Bus remains check-only
(`toolBus.check` counting seam in the harness wraps the real check). The writer is not a
Tool Bus provider and never registers one. Capability validation is not bypassed: a
fabricated `hotkeys:save` capability never completes (U-01(e)), and both success
(`toolChecks` increments in RT-006) and unavailable-tool (`availableTools: []` →
`TOOL_REQUIRED`, handler never runs — case 22) paths go through the same belt.

## 11. Audit J — Determinism and state (PASS)

Scan of `modules/hotkeys/src/*`, `runtime/local-runtime.mjs`, `test/native-write.test.mjs`,
`test/scenario-harness.mjs` finds **no** `Date.now` / `new Date` / `Math.random` /
`performance.now` / `crypto.randomBytes` / pid / cwd reads, no module-level mutable state,
no cache, no retry state. Workspace is an explicit dependency only (factory argument).
RT-006 executed repeatedly: byte-identical output across reruns (matrix case 30; harness
rerun `passed=1 failed=0`).

## 12. Audit K — Local Runtime (PASS)

`--workspace <dir>` is explicit, validated pre-run by `resolveWorkspace` (exit 2,
`INPUT ERROR`, exact refusal messages), passed through composition-root wiring only
(`createLocalDependencies({ workspace })` binds the factory; otherwise `handlers:
undefined` — byte-identical default), never silently normalized to the repository root,
never read from environment/bundle/pid/clock. Omitted flag: default path unchanged
(case B5, U-01 second block: exit 4, `EXECUTION_REFUSED` + `E_ENV_HANDLER_MISSING`, no
write). Invalid workspace cases produce the documented exit-2 behavior (cases 25–29).

## 13. Audit L — Scenario harness (PASS)

RT-006 declares `"nativeWorkspace": true`; `buildDependencies` binds the **shipped**
`createSaveFilesHandler` factory to the scenario's isolated workspace — no
`createRuntime({ handlers })` injection is used for the native writer (the injected
`handlerSpec` seam is only evaluated on the non-native branch, still used by RT-002/003/005
as intended). The scenario workspace is harness-isolated and emptied after each run; the
committed fixture (`test/scenarios/fixtures/notes.md`) is copied into the workspace and
never modified — repository content cannot be deleted or mutated by cleanup (the factory
itself refuses any workspace equal to/inside/containing the repository root).

## 14. Audit M — Test quality (PASS)

All twelve Group U tests were read line-by-line against the contract they claim to prove:

- **U-07 (containment):** includes a positive control (nested write allowed) so the test
  cannot pass vacuously; all outside-targeting attempts are asserted
  `EXECUTION_REFUSED` + `E_INPUT_INVALID_ARGS`, and both the parent-of-workspace and the
  outside sentinel directory are asserted byte-identical afterward. The refusal belt that
  fires is the grammar belt — the contract-relevant invariant ("outside never touched")
  holds regardless of which belt refuses, and the real-path belt is separately proven by
  U-10/matrix 8–9. Not a false positive.
- **U-09 (traversal):** mixed forms (`./x`, `a/../b`, `sub/../../../x`) asserted refused
  **and** the would-be escape file asserted absent **and** workspace listing empty. Would
  fail if traversal were resolved-then-written. Not a false positive.
- **U-10 (symlink escape):** parent, final-component, and dangling cases each assert the
  refusal code/class **and** outside sentinel bytes/absence, plus a final sorted listing of
  the outside directory. Would fail if any symlink were followed through. Not a false
  positive.
- **U-11 (approval binding):** proves no-approval (agent count zero), denial (exactly one
  verify, no write), content tamper (binding mismatch, no retry), and valid approval
  (exactly one verify, write). The file half of the binding is not tampered *in the test*;
  the Task 22 ad-hoc probe above closes that gap against the same seam, so no false-positive
  coverage remains (test itself unchanged, per do-not-weaken/do-not-patch rule).
- **U-12 (failure mapping):** asserts the exact `{class, code, status}` triple per case
  plus the global never-COMPLETED invariant and an empty-workspace postcondition. The
  injected-throw and no-tool cases use the documented `createRuntime` seam, honestly
  labeled as runtime-level. Not a false positive.

Every other test asserts observable contract behavior (bytes on disk, evidence lines,
report status rows), not implementation details. **No test passes while its security
invariant is broken.**

## 15. Audit N — Write surface (PASS)

`rg` over `modules runtime composition agent planner tool-bus module-registry` for
`writeFileSync|writeFile|appendFile|mkdir|rename|unlink|rm(`: the only production mutation
site is `modules/hotkeys/src/handlers.mjs` `fs.writeFileSync` (plus its comment prose and
the factory's read-only `realpathSync`/`statSync`/`lstatSync` inspections). Test-only
writes (harness workspace-save seam, test setup/teardown) are not production capability.
No unexpected production mutation exists.

## 16. Audit O — Protected integrity (PASS)

All eight protected files match the Task 21 verified SHA-256 values exactly (no STOP):

| File | SHA-256 |
|---|---|
| `docs/v3/01-core-specification.md` | `9bc4b0c0bdfca652fc0f50e01ff07b4f677148fa20e756548b48d8534c786576` |
| `docs/v3/02-architecture-map.md` | `b6e25671124e41860e3271b4e387931053ce3c876364181052446a91b35d325a` |
| `docs/v3/03-extension-contract.md` | `fdc83a0e369823ef84783a98b978bce2fde0cb95b9d2d0d9a3a1ed24ae23e22b` |
| `docs/v3/04-decision-rules.md` | `4fc9c146e8a88b722a7c3f2b3aaab4b97ad8a91c358888a814f11bd7875057ec` |
| `docs/v3/12-hotkey-registry.md` | `c861b562caddc05d0df984797518496916def72114a8c36b4c83e8c3dd710139` |
| `docs/v3/22-policy-approval-ruling-record.md` | `28cc2c23cef2cccb5ed58317d16d29193f523127554d601acbaf772e1ff1301b` |
| `docs/v3/23-policy-approval-contract.md` | `0754d3bbce82b8bd78950acd223dc2e81b2cc837e5d8cc1e389de38c05a57b4a` |
| `modules/tool-bus/capabilities.json` | `41c967a1c6f914101357148939c2795ef091ba907595a1a677896dfaaedcbe7a` |

## 17. Audit P — Regression (PASS)

- `node --test test/*.test.mjs` → 305 tests / 55 suites / 0 fail, exit 0.
- `node test/scenario-harness.mjs --all` → `scenarios=6 passed=6 failed=0 harnessFailures=0`.
- `node test/scenario-harness.mjs RT-006` → `passed=1 failed=0`.
- `git diff --check` → exit 0.
- The pre-existing plain-`node --test` discovery quirk (scenario-harness.mjs CLI
  discovery, exit 2) is **PRE-EXISTING** and forborne per instructions; not touched.

---

## 18. Adversarial matrix (35 / 35 PASS)

The 30 required cases plus 5 extras were executed against real code
(temporary runner, deleted after execution; writes confined to `os.tmpdir()`):

1. normal relative file — PASS; 2. nested relative file — PASS; 3. absolute POSIX — PASS;
4. Windows-style absolute (`C:\`, `C:/`, UNC) — PASS; 5. `../` traversal — PASS;
6. repeated traversal — PASS; 7. workspace-prefix collision (`/ws` vs `/ws-other`) — PASS;
8. parent symlink outside — PASS; 9. final symlink outside — PASS; 10. dangling symlink —
PASS; 11. directory target — PASS; 12. missing parent — PASS; 13. empty content — PASS;
14. NUL content/path — PASS; 15. newline path (refused at bundle level *and* at handler
grammar) — PASS; 16. overwrite — PASS; 17. append attempt — PASS; 18. missing approval —
PASS; 19. denied approval — PASS; 20. tampered approved args — PASS; 21. unavailable
handler — PASS; 22. unavailable tool — PASS; 23. injected write error — PASS;
24. unexpected exception — PASS; 25. repository-root workspace (factory + flag) — PASS;
26. workspace inside repository — PASS; 27. workspace containing repository — PASS;
28. nonexistent workspace — PASS; 29. workspace that is a file — PASS;
30. repeated deterministic RT-006 — PASS.

Extras: B1 missing/extra/non-string members — PASS; B2 percent-encoded traversal not
decoded — PASS; B3 inside-workspace symlink followed safely — PASS; B4 inside-dangling
symlink conservatively refused — PASS; B5 default fixture unchanged, G-without-flag exit 4
— PASS.

## 19. Findings

**NONE.** No `FINDING`, no `CONTRACT_CONTRADICTION`, no unclassified defect. Two
observations were analyzed and explicitly classified PASS rather than suppressed:

- TOCTOU check-to-use gap (Audit D) — unreachable by any actor inside the runtime model;
  contract claims no atomicity.
- U-11 tampers only `content`, not `file`, in its binding test (Audit M) — the
  implementation binds both (proven by ad-hoc probe against the same seam); test coverage
  gap noted here as record, no test weakened or altered.

## 20. Files changed by this audit

- `docs/v3/28-native-write-audit.md` (this record — documentation-only artifact, per the
  Task 18 precedent of record-document + NEG-20 boundary extension).
- `test/policy-approval.test.mjs` (NEG-20 boundary extension authorizing exactly this
  artifact — same mechanism as Tasks 16–21; the gate still fails every other changed path).

No production file, no test behavior, no protected specification, no R1–R7 text changed.
