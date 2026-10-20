# Grimoire v3 — Intent Adapter (Phase 1 decision record)

**Status:** Phase 1 of the build-agent directive (authorized explicitly by
that directive and its two amendments) — **planning only**. Document
number `36` is a `docs/v3/` sequence number; it is not a claim that any
"Task 36" exists or is authorized.

**Scope:** one new L2 module (`modules/intent-adapter/`), one new runtime
flag (`--intent`), one acceptance group (Group V). No other contract,
module, or behavior changes. The pre-existing bundle path, the GATE, the
approval contract, and every protected file are untouched.

---

## 1. What this phase adds

```text
user intent (JSON envelope, natural-language request)
   ↓  E1 envelope check          (adapter)
   ↓  provider.complete(intent)  (INJECTED — demo provider is Phase-1 default)
   ↓  PR1 provider-result check  (adapter)
   ↓  C1 command-formulation policy (adapter — amendment 1, §4)
   ↓  P1 path policy             (adapter)
   ↓  R1 Planner contract validator (INJECTED from the Planner entry)
   ↓
planner.plan(request)            (REAL Planner + REAL Report Bus)
   ↓
printed plan report + exit code
```

The path stops at the plan. It never constructs the composer, the
registry, the tool bus, the hotkey runtime, the agent, or an approval
component — planning and execution are separated **by construction**, not
by convention.

## 2. Phase boundaries: what is deferred

In scope (Phase 1):

- Intent envelope → contract-valid Planner request, fail-closed.
- Injectable Provider interface with a disclosed deterministic demo
  provider as the CLI default (**amendment 2**: no network, no keys, no
  environment variables, no hidden fallback of any kind).
- The `--intent` CLI path, mutually exclusive with `--approval` and
  `--workspace`.
- Group V acceptance tests (V-01…V-14).

Explicitly deferred (each needs its own contract before any code):

- Real model providers (network, keys, rate limits) behind the same
  interface.
- Any file write from an intent (Phase 1.x capability #1 of the roadmap).
- Command execution — even `install`/`build`/`test` (roadmap step 2).
- Templates, previews, deployment, servers, monitoring (roadmap steps 3–6).
- Autonomous loops, memory, long-term planning, multi-agent anything.

## 3. How a model connects without execution authority

The model (today: the demo provider; tomorrow: a real LLM) sits **behind
one function**: `provider.complete(intent) → candidate`. It has no other
handle on the system:

- It receives the validated intent envelope and returns candidate data.
- It holds no credentials (the adapter reads no environment), opens no
  network socket, and touches no file (the module imports nothing but its
  own files — enforced by V-09's source scan).
- Its output is untrusted input: it must survive E1/PR1/C1/P1 **and** the
  Planner's own contract validator (R1) before a plan exists. Malformed,
  incomplete, extra-fielded, command-bearing, or path-escaping output is
  **refused with the rule id in the detail** — never repaired, never
  guessed into shape (V-04…V-07, V-12).
- A proposal is not an execution: nothing downstream of the adapter in
  this path runs tools or writes files (V-09, V-14).

## 4. The command-formulation rule (amendment 1 — precise statement)

Rejecting on bare metacharacters would break natural prose (`;` appears
in normal sentences). The adapter therefore refuses **only explicit
command formulations in prose fields** (`task`, `changes[].why`,
`risks[]`) plus structures outside the plan contract. `verification[]` is
**exempt by design** — `01` §5.3 says plans reference real commands, so
command strings belong to exactly that field; this path executes nothing.

Rule ids (exported as `INTENT_RULES`):

| Rule | Refuses | Examples refused |
|---|---|---|
| **E1** | intent envelope violations | extra fields (`execute`, `approval`), non-object, empty/multiline `request` |
| **PR1** | unusable provider result | invalid JSON, non-object JSON, non-object value, thrown provider |
| **C1a** | command substitution | `Cost is $(rm -rf /) dollars` |
| **C1b** | Tier-1 system/shell token at a command position (start of field, or right after `;` `&&` `\|\|` `\|` `(` newline; whole-token, case-sensitive) | `sudo chmod 777 /etc`; `quick fix; rm -rf /var/tmp/app` |
| **C1c** | invocation markers anywhere: a flag (`-x`/`--x`) or URL after a Tier-1/Tier-2 token; an absolute-path argument after a Tier-1 token; a write/network subcommand after a Tier-2 token **when the token sits after a separator or a flag follows later**; a path-like argument after a Tier-2 token at a command position | `node --inspect …`; `curl https://…`; `then git push --force …`; `…; git push origin main` |
| **C1d** | redirection aimed at an absolute or `~/` path | `output > /etc/passwd` |
| **P1** | `changes[].file` outside plain relative shape | `../x.md`, `/etc/passwd`, `~/s.txt`, `src\win.md`, spaces |
| **R1** | the assembled request failing the Planner contract — first violation passes through **verbatim** (`INVALID_REQUEST`→E-INPUT, `PLAN_INCOMPLETE`→E-VALID) | unknown tier, missing risks, extra plan fields |

Closed token lists live in `modules/intent-adapter/src/adapter.mjs` and
are part of this document's contract (§V-05/V-06 pin both directions).

**Accepted by design (precision over pattern matching):** `Add
validation; update docs` · `node upgrades break types` · `git log shows
stale entries` · `npm test passes` · `git push hooks break CI` ·
`reduce > 50% of the duplication`. A mention is not an invocation.

**Known precision trade-off (documented, deliberate):** prose that both
names a write subcommand **and** contains a flag-looking token later
(`npm install --fast packages…`), or continues after `;` with a Tier-1
token, is treated as a command. Such content belongs in
`verification[]`, which is exempt.

## 5. Execution flow — where approval still lives

The existing chain is unchanged; the adapter is a new **front door into
its first stage only**:

```text
intent → adapter → Planner ─(plan exists)─→ …the plan waits…
                                      ↓ only via the explicit bundle path
                          Plan-Execution Composition
                                      ↓
                          GATE (review.required) → Approval (D0–D6)
                                      ↓ granted
                          Agent → Tool Bus → Hotkey Runtime → Report Bus
```

- **No second GATE, no second approval layer.** The adapter never sees an
  approval verdict and cannot mint one: `approval`-shaped intent fields
  are refused by E1, `approval`-shaped provider output is refused by R1
  (V-12/V-14), and the CLI rejects `--intent` combined with `--approval`
  (V-10).
- A `T2 + trigger` intent produces a plan with `review.required = true`
  — and stops there (V-14). Nothing on this path can orchestrate.

**Operations that require user approval (unchanged, listed for
clarity):** every gated execution (any plan with `review.required`),
every native file write (declared `--workspace` + the GATE), and — in
future phases, each behind its own contract — dependency installs,
command runs, deploys. Phase 1 reaches none of them.

## 6. Registry / Tool Bus representation

- Manifest per `03` §2, exact field set: phase `PLAN` only, `tools: []`,
  `provides: ["intent-adapter:propose"]`, `consumes: ["planner:plan"]`,
  `errors: [E-INPUT, E-VALID]` (V-01 registers it `MR_OK` through the
  real Module Registry with zero violations).
- **Not registered/enabled by the composition root in Phase 1** — same
  precedent as the Planner itself (manifest exists; the root wires the
  entry directly). Registry reports, capability resolution, and every
  existing MR/Group assertion are byte-unchanged.
- No new Tool Bus capability token, no new hotkey, no `12` change, no
  Core change, no protected file touched.

## 7. Workspace / filesystem semantics

The planning unit has **no filesystem at all** (no `node:fs` import —
V-09). P1 enforces the *shape* of declared paths (relative, no traversal,
no absolute, no home expansion) so that a later write phase inherits
clean targets; actual workspace containment remains the existing native
write contract (`27` R3, `24` §3.1), which this path never reaches.

## 8. Determinism & statelessness

Pure functions end to end: fixed rule lists, fixed order, no clock, no
randomness, no process/environment input, no caches or counters, fresh
objects frozen per call. Same intent ⇒ byte-identical proposal, plan,
report, and stdout (V-08, run-twice smoke in §10).

## 9. Tests

Group V (`test/intent-adapter.test.mjs`, V-01…V-14): manifest validity ·
constructor fail-closed · happy path through the REAL Planner · malformed
/ incomplete provider output · C1 refusal matrix · **C1 precision
(amendment 1)** · P1 matrix · determinism · no-write/no-exec/no-env scan
· CLI exit codes (0/1/2, stdin, usage) · bundle-path byte-compatibility ·
E1 envelope · throwing provider · gated-plan-still-stops. Full matrix
runs under `node --test test/*.test.mjs`.

## 10. Verification performed for this phase

- `node --test test/intent-adapter.test.mjs` → 14/14 (recorded in the
  final report).
- Full suite `node --test test/*.test.mjs` → baseline 305 + Group V, 0
  fail, exit 0 (recorded in the final report).
- CLI smoke: success (exit 0), C1 refusal (exit 2), path refusal
  (exit 2), stdin (exit 0), `--intent`+`--approval` (exit 2), bundle
  regression (exit 0) — commands and outputs in the final report.
- NEG-20 boundary extended by exactly the Phase-1 file list (§11).

## 11. File list (exhaustive — mirrored in NEG-20's `PHASE1` set)

| File | Change |
|---|---|
| `modules/intent-adapter/manifest.yaml` | new |
| `modules/intent-adapter/index.mjs` | new |
| `modules/intent-adapter/src/adapter.mjs` | new |
| `modules/intent-adapter/src/providers.mjs` | new |
| `runtime/local-runtime.mjs` | modified — `--intent` path only; bundle path byte-compatible |
| `test/intent-adapter.test.mjs` | new (Group V) |
| `test/_fixtures/intent_valid.json` | new |
| `test/_fixtures/intent_command_injection.json` | new |
| `test/_fixtures/intent_path_escape.json` | new |
| `docs/v3/36-intent-adapter.md` | new (this file) |
| `docs/v3/05-acceptance-tests.md` | modified — Group V + NEG-20 row |
| `docs/v3/24-local-runtime.md` | modified — §3.2 documents `--intent` |
| `test/policy-approval.test.mjs` | modified — NEG-20 boundary only |

## 12. Non-goals / limits

**Native capability ≠ autonomous development.** Phase 1 proves one
thing: a natural-language intent can become a *contract-valid plan*
through the real Planner with fail-closed refusals at every boundary and
zero execution authority. It does not plan-and-do, does not write, does
not execute, does not install, does not deploy, and does not reason
beyond the deterministic demo provider. Each roadmap capability after
this one requires its own contract, ruling, and acceptance group before
any implementation.
