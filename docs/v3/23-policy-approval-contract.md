# Grimoire v3 — Policy/Approval Contract (Task 14; corrected per Task 14R)

**Status:** Task 14 formal contract — Task 13 rulings **APPROVED** for contract authoring (executive status), Task 14R corrections incorporated — **CONTRACT_READY_FOR_EXECUTIVE_APPROVAL** (see §12); contract review required before implementation. Documentation only: no runtime code, no CS-13 implementation, no test-file change.
**Authoritative basis:** `docs/v3/22-policy-approval-ruling-record.md` — ED-01…ED-12, Change-Set CS-13, §6 Safety ruling, §7 Determinism ruling. This contract changes **no** approved ruling; where a ruling left latitude, the minimum deterministic choice is recorded as CONTRACT DETAIL (§8).
**Normative language:** MUST / MUST NOT / SHOULD / MAY per RFC 2119 (`01` header convention). All observable behavior specified here is normative and mechanically testable (Group R, `05`).
**Scope:** the approval capability crossing the frozen GATE of the Plan–Execution composer (`20`): component contract, verdict schema, canonicalization/identity, invocation counts, refusal/report semantics. Everything else is out of scope (§7).

## 0. Document provenance (recorded honestly)

At Task 14R start the repository contained **no** Task 14 contract artifact: no `docs/v3/23+` file, no Group R section in `05`, and no `R-*` policy/approval acceptance IDs anywhere (verified by directory listing, `git ls-files`, and full-text search; the only `R-10` hits were `HKR-10`/`MR-10`). Consistent with this repository's rule (Task 13 D-13-0: *never reconstruct or claim absent artifacts*), nothing historical is claimed: this contract is authored **complete with the four review corrections applied from the outset**. Acceptance IDs `R-10` (provenance — corrected per Blocker 1) and `R-15` (invocation counts — strengthened per Blocker 4) exist here with their corrected text; there is no prior text to preserve.

**Task 14 (contract authoring) record:** the next available document number from the repository listing was **23** (21 deliberately vacant, 22 = ruling record); `docs/v3/21-policy-approval-design.md` remains uncreated — repository convention does not require it (the ruling record `22` plus this contract are the authoritative pair) and the reason is recorded as D-13-0 (`22` §11), as Task 14 directs.

---

## 1. Authority and provenance model (Blocker 1)

Three distinct concepts — never conflated:

| Concept | Definition | What it is NOT |
|---|---|---|
| **Composition-root injection authority** | Authorization authority enters the system **only** through the approved composition-root injection boundary: the composition root constructs and injects the approval component into the composer (`22` ED-01/ED-11; `02 §3`; `20 §2/§14`). The *act of approved wiring* is what confers authority on the component. | Not a runtime-checkable token, signature, or credential. The runtime can check only the construction belt (§2): the component is present and conforms to the interface. |
| **Approval component output (verdict)** | The synchronous value returned by `approval.verify(...)`. It is **data** — untrusted until validated (§3 schema, §4 binding). | Not self-authenticating. Carries no origin metadata, no authority of its own, nothing beyond its three fields. |
| **Verdict validation (GATE duty)** | The GATE validates the returned verdict **against the contractual schema and binding rules only**: well-formed (§3), affirmative (§3), bound to the exact plan and execution identities (§4). Deterministic, mechanical, fail-closed (§6). | Not forensic analysis. Not provenance investigation. Not forgery detection. |

**Explicit non-claim (Blocker 1):** the runtime does **NOT** and **CANNOT** cryptographically or independently detect a "forged object". No cryptographic provenance is introduced: no signature, MAC, token, credential, nonce, or origin field exists anywhere in this contract (§7). What the contract guarantees is exactly three things: (a) authority entered through the approved composition-root injection boundary; (b) a verdict counts only if it satisfies the schema and binding rules; (c) everything else fails closed (§6). The trust model is identical to the one already granted to the injected planner, agent, and report bus (`22` §9): a component supplied in bad faith by the composition root is out of trust scope, exactly as a bad-faith planner would be. Forging a verdict *from inside an executing layer* is structurally unavailable — executing layers have no path that reaches the GATE's verdict slot (Safety ruling `22` §6; enforced by R-09/R-10).

## 2. Component contract (placement A, `22` ED-11; CS-13 item 1)

- **Injection:** composition-root dependency, config key `approval`, optional. Shape: a plain object exposing exactly one consulted method: **`verify(plan, execution)`** (synchronous, returns the verdict §3). Other properties on the component have **no effect and confer no authority** (nothing outside the three verdict fields is authoritative).
- **Construction belt:** if the config object carries an own property `approval` whose value is not `undefined` and is either not a plain object or has no function `verify`, construction throws `E_INPUT_INVALID_COMPOSITION_CONFIG` with fixed detail **`approval must expose verify()`** (same class/code as every other bad dependency; `PE-01` convention). `approval: undefined` and an absent key both mean *not injected*.
- **Absent component:** the composer behaves **byte-identically to today** — `review.required === true` ⇒ refusal with the exact existing detail (§6-D0); `false` ⇒ pass. (Preserves `PE-05`, `PE-21`, `M4` untouched.)
- **Invocation:** exactly when and as specified in §5. Arguments: the bundle's plan artifact and execution sub-request members, by reference, unmodified (§4.5 anti-mutation rule).
- **No side channels:** the component builds **no report** (the composer's three-report invariant stands, `PE-02`), registers nothing, resolves no capability, holds no registry/tool/runtime handle; the composer imports it only via composition-root DI — no lateral imports (`PE-16`).
- **Canonicalization helpers:** the identity functions of §4 are owned by the composition layer and exported from `composition/plan-execution/index.mjs` as **`planIdentity(plan)`**, **`executionIdentity(execution)`**, **`APPROVAL_VERDICT_FIELDS`** (CS-13 item 2 — the entire new vocabulary). The GATE uses them directly; components/tests use the same functions so both sides of every comparison share one algorithm. **Implementation constraint discovered by 14R:** SHA-256 here is implemented **dependency-free inside `composition/plan-execution/src/`** (FIPS 180-4; zero imports — no `node:crypto`, no dynamic import, no `require`), because `PE-16` asserts that **every** `from "…"` specifier in `index.mjs` and all `src/*.mjs` starts with `./` (verified in `test/plan-execution.test.mjs`). This keeps the `PE-16` scan byte-unchanged — CS-13 need not widen the import rule. Digest correctness is pinned by vectors V1–V3 (§4.3).

## 3. Exact approval verdict schema (Blocker 3)

A verdict is a **plain object** (prototype is `Object.prototype` or `null`) with **exactly three own data properties — no more, no fewer**:

| # | Field | Type | Allowed values | Represents |
|---|---|---|---|---|
| 1 | `granted` | boolean | `true` (affirmative) \| `false` (well-formed, non-affirmative) | **Affirmative decision** |
| 2 | `plan` | string | `^[0-9a-f]{64}$` (lowercase hex, exactly 64) | **Plan identity binding** = `planIdentity(bundle.plan)` (§4.1) |
| 3 | `execution` | string | `^[0-9a-f]{64}$` (lowercase hex, exactly 64) | **Execution-sub-request binding** = `executionIdentity(bundle.execution)` (§4.2) |

**Nothing else is authoritative.** No timestamps, ids, actors, comments, versions, counters, or any other metadata may appear or be consulted — an extra own property makes the verdict malformed (below), and no inherited/prototype property is ever read (own properties only; a property access that throws ⇒ malformed).

**Mechanically testable rules (ordered decision procedure — the definition of "well-formed"):**
1. **Component absent** (not injected) while `review.required === true` ⇒ refusal **D0** (unchanged today's detail), verdict never evaluated, invocation count 0.
2. **Component threw** (or `verify` returned without throwing but evaluation raised) ⇒ refusal **D5**.
3. **Schema well-formed?** non-object (null/array/primitive/thenable — a Promise is not a plain object), non-plain prototype, missing any of the three own properties, `granted` not exactly `boolean`, `plan`/`execution` failing the hex pattern (wrong length, uppercase, non-hex, non-string), any own property beyond the three ⇒ refusal **D1**. **No coercion of any kind:** no lowercasing of hex, no `"true"` → `true`, no trimming.
4. **Affirmative?** `granted !== true` ⇒ refusal **D2** (well-formed but non-affirmative).
5. **Binding inputs canonicalizable?** (§4 eligibility) not canonicalizable ⇒ refusal **D4**.
6. **Binding equal?** `verdict.plan === planIdentity(plan)` and `verdict.execution === executionIdentity(execution)` — both computed **before** the `verify` call and required **identical** after it returns (§4.5) — any inequality ⇒ refusal **D3**. (Strict string equality of lowercase hex; no normalization.)
7. All pass ⇒ **GATE opens** (§6).

**Affirmative semantics:** `review.required === true` proceeds **only** when all of: component injected at the composition root; `verify` invoked exactly once and returned (not thrown); verdict well-formed per 3; `granted === true`; both bindings equal. Anything less ⇒ refuse. A `granted: true` verdict that fails schema or binding is **not** affirmative.

## 4. Canonicalization contract (Blocker 2)

Task 13 ruling implemented: **identity = SHA-256 of the canonical artifact bytes**, lowercase hex digest (FIPS 180-4; computed by the dependency-free composition-layer implementation of §2 — **not** `node:crypto`, keeping the `PE-16` `./`-only scan green; report hashes by the Report Bus via its own `node:crypto` are a separate, existing mechanism). Shared rules for both identities:

- **No input except artifact content.** Forbidden in every identity computation: **clock/current time, randomness, PID, environment state, hidden mutable state** — and no reliance on object key-insertion order (order comes from this contract, never from how an object was built), no filesystem/network/locale/timezone influence, no iteration over unordered structures. (`22` §7 admissible inputs.)
- **String encoding:** strings are serialized exactly per ECMA-262 `JSON.stringify` semantics: `"` → `\"`, `\` → `\\`, control chars < 0x20 → `\b \t \n \f \r` or lowercase `\u00xx`; all other code points written literally; lone surrogates escaped `\udxxx` (well-formed stringify). **No Unicode normalization is ever applied** (CONTRACT DETAIL). The SHA-256 input bytes are the **UTF-8 encoding of the resulting canonical string**; digest printed as **lowercase hex**.
- **Booleans** `true`/`false`; **null** → `null`; **empty array** → `[]`; **empty string** → `""`. **Absent field, `undefined`, or a function/symbol value ⇒ not canonicalizable ⇒ refusal D4** (never silently omitted — this is deliberately stricter than `JSON.stringify`'s property omission).
- **Numbers:** none exist in the plan schema (§4.1 rule N); in execution data (§4.2) numbers are serialized per ECMA-262 `Number::toString(10)` (shortest round-trip, identical to JSON number formatting; `-0` → `0`); **non-finite (`NaN`, `±Infinity`) ⇒ not canonicalizable ⇒ D4**.
- **Collections:** arrays serialize **in stored order, never sorted** (the order is the contract's meaning — `19 §13` order question, `PL-06`).
- **Separators:** compact form, no whitespace: `,` and `:` only.

### 4.1 Plan identity — `planIdentity(plan) = sha256(utf8(canonicalPlan))`

- **Exact fields included:** **exactly** `tier`, `depth`, `task`, `changes`, `verification`, `risks`, `review` — no others.
- **Field ordering (fixed, independent of insertion order):** `tier, depth, task, changes, verification, risks, review`; inside each change `{file, why}`; inside review `{required, trigger}`. (Canonical order = `19 §13` plan key order, as ruled in `22` ED-03.)
- **Value representation:** all strings/booleans/null per the shared rules; `changes`/`verification`/`risks` are arrays of strings in stored order; `review.trigger` is a string or `null`.
- **Rule N (numbers):** the plan schema contains no numeric type; **any number encountered ⇒ non-canonicalizable ⇒ D4** (no numeric formatting rule is needed — minimum deterministic choice, CONTRACT DETAIL).
- **Unknown fields:** any own property on the plan (or on a change entry, or on `review`) outside the listed set ⇒ **non-canonicalizable ⇒ D4**. Missing required field or `undefined` value ⇒ same. (Planner-produced plans always carry all seven — `19 §5` — so D4 on a plan is unreachable in practice and exists as a belt.)
- **Immutability/freeze boundary:** identity is computed **once per attempt, at GATE**, over the plan artifact carried in the attempt — the planner-frozen object (`freezePlan`, `19`). Freezing guarantees the content cannot change during the attempt; the identity is computed from the artifact's own property values in canonical order; **no copy, snapshot, or re-derivation from the request is taken**, and freeze-status itself is not re-checked (content is all that is hashed; the frozen guarantee is the planner's contract, `19`).
- **Exact SHA-256 input bytes:** UTF-8 bytes of the canonical string defined above — nothing else (no BOM, no trailing newline, no key-order fallback to insertion order).

### 4.2 Execution identity — `executionIdentity(execution) = sha256(utf8(canonicalExecution))`

- **Input:** `bundle.execution` **exactly as presented at GATE** (the raw sub-request; agent-side validation happens later at ORCHESTRATE — `20 §5`; the approval binds what was presented, `22` ED-04b).
- **Canonical form (generic, total):** recursive canonical JSON with **object keys sorted lexicographically by UTF-16 code units** (ECMA-262 default string comparison — `Array.prototype.sort()` on the key strings), then serialized compactly; arrays in stored order; strings/booleans/null/numbers per the shared rules; nested objects (e.g. `target`) sorted at every level.
- **Eligibility (⇒ D4 if violated):** the value must be JSON data — plain objects/arrays/finite numbers/strings/booleans/null only. `undefined`, functions, symbols, `NaN`, `±Infinity`, cyclic references, or a non-object root ⇒ **not canonicalizable ⇒ D4**.
- **CONTRACT DETAIL justification:** the execution envelope's own field order is not guaranteed at GATE (the agent validates `REQUEST_FIELDS` only at ORCHESTRATE — `18 §5`, and extras are still possible pre-validation), so a fixed field order cannot be derived; sorted keys is the **minimum deterministic choice** valid for arbitrary presented data. (`REQUEST_FIELDS = [kind, module, capability, phase, target, args]`, `TARGET_FIELDS = [key, command]` — noted for reference; the canonical order is sorted, not declaration order.)

### 4.3 Golden vectors (normative — implementations MUST reproduce byte-for-byte)

**V1 — plan identity** (input built with deliberately jumbled key insertion order; output depends only on canonical order):

```text
canonical: {"tier":"T2","depth":"document","task":"demo","changes":[{"file":"a.ts","why":"A"},{"file":"b.ts","why":"B"}],"verification":["npm test"],"risks":["regression"],"review":{"required":true,"trigger":"migration"}}
sha256:    e3e8f2a0ed54599f992ae07e24f59a3e98d5edc7495dc48feb515693303b5e68
```

**V2 — execution identity** (input keys out of order at both levels):

```text
canonical: {"args":[],"capability":"hotkeys:execute","kind":"hotkey","module":"hotkeys","phase":"RUN","target":{"command":"run","key":"G"}}
sha256:    25cf3de14674c0ffcbf047abff8a60a3fe4d425e12822d3f279a6333803088c4
```

**V3 — string escaping** (plan task `a"b\c<TAB>d`, ungated plan):

```text
canonical: {"tier":"T2","depth":"document","task":"a\"b\\c\td","changes":[{"file":"a.ts","why":"A"}],"verification":["v"],"risks":["r"],"review":{"required":false,"trigger":null}}
sha256:    16df91fa6f3838c35e50d271c89d6f56fc805305a2418d1d18ce4d67091f650b
```

### 4.4 Determinism statement

Both identity functions are pure functions of artifact content: same content ⇒ same digest, byte-identical across processes, runs, machines, and implementation instances. Golden vectors V1–V3 pin the algorithm.

The same purity extends to the **entire approval evaluation**: schema checks (§3), the fixed decision order (D5→D1→D2→D4→D3), invocation counts (§5), and every detail/ledger/evidence string (§6) are fixed functions of (bundle, verdict) and injected-component behavior — with **no clock/current time, no randomness, no PID, no environment state, no hidden mutable state** (`22` §7 admissible inputs; Task 14 determinism mandate).

### 4.5 Anti-mutation rule (binding integrity)

The GATE computes **both identities before** calling `verify` and **recomputes both after** `verify` returns; the recomputed values must equal the pre-call values. A component that mutates `plan` or `execution` during the call ⇒ refusal **D6** (`plan` is frozen anyway; `execution` is not, hence this check). The verdict is compared against the **pre-call** identities.

## 5. Invocation-count invariants (Blocker 4 — observable acceptance invariants)

Counted **per `execute()` call**; counts are exact (asserted with `strictEqual`, never `≥`), observable via call-recording spies (R-15):

| Scenario | `planner.plan` | `approval.verify` | `agent.run` |
|---|---|---|---|
| Invalid bundle (refused at VALIDATE) | 0 | **0** | **0** |
| Planner refusal / incomplete plan (refused at PLAN) | 1 | **0** | **0** |
| `review.required === false` (GATE passes, component injected) | 1 | **0** | **1** |
| `review.required === false` (component absent) | 1 | **0** | **1** |
| `review.required === true`, component injected, verdict valid | 1 | **1** | **1** |
| `review.required === true`, component injected, any refusal (D1–D6/D5) | 1 | **1** | **0** |
| `review.required === true`, component absent (D0) | 1 | **0** | **0** |

- When `review.required === false` the approval component is **never consulted**: count **0** — no pre-consultation, no warm-up call, no cached/ambient lookup (clarifying case: with no component injected there is nothing to invoke, so gated refusals D0 also count **0**).
- When `review.required === true` **with a component injected**: count **exactly 1** — no retry after any outcome (including D5 throw), **no fallback consultation**, no second/hidden invocation anywhere else in the lifecycle (never at VALIDATE, ORCHESTRATE, REPORT, or after a refusal).
- **On every refusal path, `agent.run` count MUST equal 0. `agent.run` count equals 1 only after a successful GATE** (and is then subject to the agent's own contract).
- `reportBus.build` for the composer: exactly 1 per attempt (existing `PE-16` rule; the approval component builds none).
- Counts do not leak across calls: two consecutive `execute()` calls each start from zero (stateless — `22` ED-07).
- **Single execute-attempt semantics:** an approval verdict is valid for **exactly the one `execute()` call in which it is consulted** — consumed there, never stored, never reused, never re-checked, never carried across attempts. A later `execute()` with a gated bundle consults the component afresh (one new call for that attempt); nothing persists that could make a prior verdict satisfy it (no expiry needed because nothing lives — `22` ED-05/ED-07).

## 6. Refusal semantics and report integration (fail-closed; existing Core constraints)

Every approval-related non-crossing outcome is **`APPROVAL_REQUIRED` / `REFUSED` / stage `GATE` / class `E-INPUT`** (code table pinned at 14 — `PE-01`; no new result code, no new stage, no new error class). Only the `detail` distinguishes them — **fixed exact strings, no variable content** (never exception messages, stacks, paths, or timings):

| Id | Condition | Exact `error.detail` |
|---|---|---|
| **D0** | `review.required === true`, component absent | `plan review is required before execution${trigger} — the approval gate belongs to the policy/approval contract` — **unchanged current string**, where `${trigger}` is the existing ` (migration)`-style suffix (byte-identical to today; preserves `PE-05`/`M4`) |
| **D1** | verdict malformed (§3 step 3) | `approval verdict malformed` |
| **D2** | `granted !== true` (§3 step 4) | `approval verdict not affirmative` |
| **D3** | binding inequality (§3 step 6) | `approval verdict binding mismatch` |
| **D4** | binding input not canonicalizable (§4) | `approval binding input not canonicalizable` |
| **D5** | component threw (§3 step 2) | `approval component threw` |
| **D6** | component mutated its inputs (§4.5) | `approval component mutated its inputs` |

**Order of evaluation is fixed** (D5 → D1 → D2 → D4 → D3): e.g. a non-affirmative verdict with a bad binding reports D2, never D3.

**Report semantics (existing Report Bus rules unchanged):**
- Ledger lines (exact): refusal (all cases) `GATE: refused (APPROVAL_REQUIRED)` (unchanged); approval pass `GATE: done (approval verified)`; ungated pass `GATE: done (review not required)` (unchanged).
- Evidence lines (exact, appended after the existing `plan.review.required → …` line) — **only when a component is injected** (the absent/uninjected path keeps today's evidence byte-identical):
  - pass: `approval.verify(...) → affirmative` then `approval.binding → verified`
  - D1: `approval.verify(...) → malformed` · D2: `approval.verify(...) → non-affirmative` · D3: `approval.verify(...) → binding-mismatch` · D5: `approval.verify(...) → threw`
  - D4: `approval.binding → not canonicalizable` · D6: `approval.binding → mutated`
- Exactly one composer report build per attempt; success still carries exactly three reports (planner, composer, agent); refusal reports mirror code/status/stage/issue (`PE-20`) and never read `COMPLETED` (`PE-18`); `report === null` only when the report step itself refuses (`PE-13`).
- `BUNDLE_FIELDS = [plan, execution]` unchanged; lifecycle stages unchanged; result codes unchanged (14).

## 7. Explicit non-goals (forbidden introductions — `22` rulings + Task 14R)

This contract introduces **none** of: persistence/storage/databases · expiry/clocks/TTLs · revocation lists · cryptographic signatures/MACs/tokens/credentials/identities/roles · external APIs or network calls · a Policy artifact (data or manifest) · new execution authority (the GATE remains the only crossing; a verdict executes nothing) · new result codes, stages, error classes, bundle fields, manifests, registry entries · G0 involvement (`22` ED-10) · any change to Core `01–04`/`12`, the planner, the agent, the Report Bus, or the runtime.

## 8. Contract-detail decisions (minimum deterministic choices; each marked CONTRACT DETAIL — no new authority)

1. Config key `approval`; method name/shape `verify(plan, execution)`; synchronous; verdict returned, not thrown — CONVENTION: single-method DI matching `plan`/`run`/`build`.
2. Config error detail fixed: `approval must expose verify()`; own-property `approval` present-and-not-undefined is the "provided" test.
3. Verdict field names `granted`, `plan`, `execution`; exactly-three-fields rule; hex pattern lowercase-only; plain-object prototype rule; own-property reads; thenables malformed — MINIMUM: rejects every ambiguous/mixed input fail-closed.
4. Six fixed refusal detail strings + fixed evaluation order (D5→D1→D2→D4→D3) — REQUIRED so observable `error.detail` is unique per outcome.
5. Canonical encoder: ECMA-262 `JSON.stringify` string/number semantics by reference, compact separators, no Unicode normalization, well-formed lone-surrogate escaping — MINIMUM: one spec-referenced behavior, no bespoke escaping.
6. Plan field order = `19 §13` order (ruled); **numbers forbidden in plan canonicalization** (schema has none) — MINIMUM choice avoiding a numeric-format rule for plans.
7. Execution canonical order = **lexicographic (UTF-16) key sort, recursive** — MINIMUM choice because no fixed field order is derivable pre-validation (§4.2).
8. Eligibility ⇒ D4 for non-JSON data (deliberately stricter than `JSON.stringify` omission) — MINIMUM fail-closed choice.
9. Evidence/ledger exact strings (§6) — REQUIRED for byte-identical determinism (`PE-19` class).
10. Identity exported as `planIdentity` / `executionIdentity` / `APPROVAL_VERDICT_FIELDS` from `composition/plan-execution/index.mjs` — CONVENTION: composition vocabulary re-export (CS-13 item 2).
11. Anti-mutation double-computation with fixed detail D6 — MINIMUM rule closing the mutation hole deterministically (§4.5).
12. Golden vectors V1–V3 pin the algorithm — REQUIRED (test-vector authority for implementations).
13. Identity hashing = self-contained FIPS 180-4 SHA-256 inside the composition layer, zero imports — MINIMUM choice: `PE-16`'s `./`-only import rule stays byte-unchanged instead of being amended for `node:crypto` (CS-13 not widened; no new boundary exception).
14. Group R mutation fixture names `mut_approval_bundle_extra_field.json`, `mut_approval_execution_swapped.json`, `mut_approval_report_input.json` (byte-different from pristine `composition_request.json`; land with CS-13) — CONVENTION: follows the `mut_*` fixture naming of Groups P/Q; necessary so mutation tests (requirement 22) have an unambiguous artifact set; no authority created.

**Discipline for every CONTRACT DETAIL above (Task 14):** each choice (a) is necessary only to make observable behavior precise or implementable, (b) alters **no** approved ruling (`22`), (c) creates **no** new authority, actor, data, or surface, and (d) is an implementation convention — never a new architectural requirement, and it MUST NOT be promoted to one. The latitude exercised matches Task 14's enumerated list exactly: object field names (items 1/3), encoding representation (item 5), canonicalization serialization (items 5–8), verdict detail fields (item 3), error detail strings (items 2/4/9), Group R fixture naming (item 14).

## 9. Mapping to ED-01 … ED-12 (no ruling changed)

| ED | Ruling (unchanged) | Where this contract implements it |
|---|---|---|
| ED-01 / ED-01b | User is sole authority; in-repo channel = composition-root injection | §1 authority boundary; §2 injection; consent itself is host-internal |
| ED-02 | Injected verdict model; 7 sub-questions; no cryptography; fail-closed belts | §1 (representation/provenance/tamper model), §2 (verification belt), §3 (malformed/missing/invalid), §6 (fail-closed details) — Blocker 1 correction lands here: GATE validates schema + binding only, no forged-object detection claim |
| ED-03 | Content-derived SHA-256 over canonical frozen-plan bytes; change ⇒ re-approval; replay impossible | §4.1–§4.5 + V1–V3 — Blocker 2 correction: full canonicalization contract |
| ED-04 / 04b / 04c | Approval attaches at GATE; binds plan **and** execution; divergence ⇒ refuse | §3 fields 2–3; §4.2; D3 |
| ED-05 | No expiry/revocation/clock; validity = one attempt | §4 forbidden inputs; §5 per-call counts; §7 |
| ED-06 / 06b | No policy artifact; N/A identity/version/mutation | §7 (no Policy artifact) |
| ED-07 / 07b | Stateless; no storage | §5 (no cross-call state); §7 |
| ED-08 | C2: optional injected component consulted once at GATE; fail-closed default | §2, §3, §5, §6 — Blocker 4 correction: §5 invocation counts |
| ED-09 | Only CS-13 authorized; rest frozen | §10 matrix; §7 |
| ED-10 | §5.2 only; G0 untouched | §7 (G0 involvement excluded) |
| ED-11 | Placement A: composition-root service, no manifest | §2 (DI, no registration, no report) |
| ED-12 | Core unchanged; `03 §8` contingency only | §7 (Core untouched) |

## 10. CS-13 compatibility matrix

| CS-13 item (`22` ED-09) | Contract sections | Status after 14R | Change needed |
|---|---|---|---|
| 1. `composition/plan-execution/src/composer.mjs` — optional `approval` dep + GATE consultation | §2, §3, §5, §6 | **Compatible, unchanged authorization** — spec now precise enough to implement | Deferred to CS-13 implementation (NOT done here) |
| 2. `composition/plan-execution/index.mjs` — approval vocabulary export | §2, §8.10 (`planIdentity`, `executionIdentity`, `APPROVAL_VERDICT_FIELDS`) | Compatible | Deferred |
| 2a. Boundary constraint found by 14R: identity hashing must live inside a `./`-only, no-builtin layer (`PE-16`) | §2, §4, §8.13 | **Resolved:** dependency-free FIPS 180-4 implementation; `PE-16` scan unchanged | None — no CS-13 widening required |
| 3. `docs/v3/20-plan-execution-composition.md` amendments (§2/3/4/6/11 detail/12 rule 6/13/14/15/16/17/18) | §1–§6 supply the amended text | Compatible — CS-13's authorization boundary untouched | Deferred; contract is the source text |
| 4a. `05` **Group Q addendum** | §6 (only where contradicted: PE-15/PE-16 extensions) | Compatible | Deferred to CS-13 (atomic with code) |
| 4b. `05` **Group R** | §13 index; R-01…R-15 | **Staged now by executive order (14R)** as specification text only; executable tests land with CS-13 | 14R deliverable (done); no partial GATE change |
| 5. `test/plan-execution.test.mjs` + fixtures | R-01…R-15 | Compatible | Deferred (tests unchanged this task) |
| 6. `docs/v3/22` status updates | — | Not needed: **no ruling changed**; `22` byte-unchanged (verified) | None |
| Frozen outside CS-13: Core `01–04`/`12`, planner, agent, bundle envelope, 14 codes, 7 stages, Report Bus, manifests, runtime | §7 | **Untouched** — contract requires nothing outside CS-13 | None |

## 11. Remaining ambiguities

**Blocking (could make two conforming implementations behave differently): NONE.** Every observable surface is uniquely determined: component shape/args, invocation counts (§5 table), ordered verdict decision procedure (§3), canonical bytes (§4 + V1–V3), exact detail/ledger/evidence strings (§6), code/status/stage/class (§6), config error (§2), exports (§2).

**Non-blocking recorded assumptions/limits (do not affect conforming in-repo behavior):**
1. Host-side consent UX — how a user's "yes" grounds a component verdict — is outside the repository's contracts (no UI exists; `22` ED-01b); components are stubbed in tests.
2. Malicious-composition-root threat — out of trust scope, identical to planner/agent injection (`22` §9).
3. SHA-256 collision resistance accepted at the repository's existing report-hashing level (`22` ED-03).
4. Serialization semantics pinned **by reference** to ECMA-262 `JSON.stringify`/`Number::toString` behavior (stable, spec-defined; vectors V1–V3 pin the observable outcome).
5. Process note: the original Task 14 contract artifact never existed in-repo (§0) — resolved by complete authoring, not reconstruction.

## 12. Status

**CONTRACT_READY_FOR_EXECUTIVE_APPROVAL.** Observable behavior is uniquely determined (§11: zero blocking ambiguities); the four blockers are closed (Blocker 1 → §1/R-10; Blocker 2 → §4/V1–V3; Blocker 3 → §3; Blocker 4 → §5/R-15); no approved ruling changed; nothing implemented.

## 13. Acceptance index — Group R (`docs/v3/05-acceptance-tests.md`)

R-01 configuration/surface · R-02 approval happy path · R-03 absent-component refusal (today's behavior) · R-04 malformed-verdict matrix · R-05 non-affirmative · R-06 binding + mutation mismatch · R-07 component throws · R-08 fail-closed totality · R-09 no self-approval (source scans) · **R-10 provenance model (corrected)** · R-11 canonicalization determinism (V1–V3) · R-12 verdict-schema mechanics (no coercion) · R-13 report semantics · R-14 end-to-end determinism · **R-15 invocation counts (strengthened)**.

Group R is **specification-staged** (executable tests land atomically with CS-13); until then the suite remains 228/228 (Groups A–Q) — recorded in `05` per the GAP-007 NOT-RUN precedent. Group R also carries the **formal positive/negative case matrix POS-1…POS-3 / NEG-01…NEG-20** (five fields per row: INPUT, EXPECTED DECISION, EXPECTED ERROR, EXPECTED AGENT CALL COUNT, EXPECTED REPORT BEHAVIOR) and the **R-M mutation-fixture block** — the acceptance and mutation-test deliverables of Task 14 (requirements 21–22).

## 14. Task 14 requirement coverage index (24 requirements → where defined)

| # | Requirement | Where |
|---|---|---|
| 1 | Component boundary | §1 (injection authority / output / validation split); §2 (interface, no side channels) |
| 2 | Construction/injection contract | §2 (config key `approval`, construction belt, optional dependency) |
| 3 | Approval request input | §2 — `verify(plan, execution)`: the bundle's two members, by reference, unmodified |
| 4 | Approval verdict output | §3 (three-field schema; returned, never thrown) |
| 5 | Exact affirmative semantics | §3 (affirmative-semantics paragraph; ordered steps 1–7) |
| 6 | Exact refusal semantics | §6 (D0–D6, fixed detail strings, fixed evaluation order) |
| 7 | Plan canonicalization requirements | §4.1 + shared rules §4 |
| 8 | SHA-256 binding requirements | §4 intro, §4.3 (V1–V3), §8.12–8.13 |
| 9 | Execution-sub-request binding | §4.2; §3 field 3; D3 |
| 10 | Single execute-attempt semantics | §5 (single-attempt bullet; per-call counts) |
| 11 | Missing component behavior | §2 (absent component); §6 D0 |
| 12 | Throwing component behavior | §3 step 2; §6 D5 |
| 13 | Malformed verdict behavior | §3 step 3; §6 D1 |
| 14 | Digest mismatch behavior | §3 step 6; §6 D3 |
| 15 | Scope mismatch behavior | §3 field 3 vs §4.2 (execution divergence ⇒ D3); §9 ED-04b/c |
| 16 | Determinism rules | §4 (forbidden inputs); §4.4 (whole evaluation); §7; `22` §7 |
| 17 | GATE invocation count | §5 table + bullets (0 / exactly 1) |
| 18 | Agent invocation count on each path | §5 table + refusal bullet (0 on every refusal; 1 only after GATE) |
| 19 | Report Bus consequences | §6 report semantics (ledger/evidence, one build, three reports, mirroring) |
| 20 | Error taxonomy | §6 (`APPROVAL_REQUIRED` / E-INPUT / stage `GATE`; 14 codes, 7 classes, unchanged) |
| 21 | Acceptance tests | §13 + `05` Group R R-01…R-15 + POS/NEG matrix |
| 22 | Mutation tests | `05` Group R NEG-01…NEG-20 + R-M fixture block (§8.14 names) |
| 23 | Compatibility requirements | §6 (pinned invariants), §10 matrix, §7 non-goals |
| 24 | CS-13 implementation boundaries | §10 (exhaustive authorized list + frozen list) |

## 15. Approved binding rulings — compliance (Task 14 executive approval: APPROVED)

| Approved ruling | Satisfied at |
|---|---|
| Affirmative verdict from a composition-root-injected approval component | §1, §2 |
| Consulted exactly once at GATE; only when `review.required === true` | §3 step 1, §5 |
| Missing component preserves today's refusal behavior | §2, §6 D0, R-03 |
| Missing / malformed / invalid / non-affirmative / unbound / throwing ⇒ refusal | §3, §6 D1–D6 |
| Approval binds to plan **and** execution sub-request | §3 fields 2–3, §4.2 |
| Plan identity = SHA-256 over canonical frozen-plan bytes | §4, §4.1 |
| Any plan-content change requires a new approval | §4.1 (identity is content-derived), §9 ED-03 |
| Valid for one `execute()` attempt; no expiry; no revocation; no clock | §5 single-attempt bullet, §4 forbidden inputs, §7 |
| No persistence; no database/storage; no independent Policy artifact | §7, §9 ED-06/ED-07 |
| No Planner / Agent / Composer / Policy-Approval self-approval | §1 non-claim + `22` §6; R-09, R-10 |
| Task 12 governs Core §5.2 plan-review approval only; Decision Rules G0 separate | §7 (G0 excluded), §9 ED-10 |
| Placement = composition-root injected service | §2, §9 ED-11 |
| ED-08 mechanism = C2 | §2, §9 ED-08 |
| ED-09 coordinated change-set CS-13 = authorized implementation boundary | §10 |
| Fail-closed behavior remains mandatory | §3, §6 |
| Agent-zero-call refusal behavior remains mandatory | §5 |
| Determinism remains mandatory | §4, §4.4 |
| Core error-class constraints remain mandatory | §6 |
