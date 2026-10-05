# Grimoire v3 — Executive Ruling Record — Policy/Approval (Task 12 ED-01…ED-12; Task 13 resolutions)

**Status:** Authoritative ruling record. Task 12 Phase 1 recorded the twelve Executive Decisions with honest UNRESOLVED markers; Task 13 Phase 2 re-evaluated every UNRESOLVED decision **in place** per the `09-migration-gaps.md` convention ("re-evaluated in place; history is noted, never erased"). Still a CONTRACT/RULING task: **no Policy/Approval engine implemented, no runtime behavior modified, no Planner/Agent/Composer/GATE change made.** The executive reviewer must approve these rulings before Contract authoring.
**Scope:** ED-01…ED-12 with the mandatory Safety and Determinism rulings; Task 13 resolves ED-02, ED-03, ED-08, ED-09, ED-11 (contract-exit set) and rules the dependencies ED-04b/c, ED-05, ED-06b, ED-07b.
**Convention:** numbered `docs/v3/` document, `Status` header, field-table records, explicit `UNRESOLVED` labels as in `09-migration-gaps.md`, advisory/binding separation as in `13-hotkey-decision-sheet.md`. History: `docs/v3/21-policy-approval-design.md` never existed (re-verified in Task 13 — §3); this record (22) is the current authoritative artifact.

---

## 1. Executive status

- Task 13 exit criteria **met**: ED-02, ED-03, ED-08, ED-09, ED-11 are no longer UNRESOLVED; dependencies ED-04b/c, ED-05, ED-06b, ED-07b are explicitly ruled (§5).
- **DECISIONS_STILL_UNRESOLVED: none** among ED-01…ED-12. Where source evidence was insufficient, the missing authority is identified per decision and the resolution is classified **PROPOSED** (executive ruling of this session) — never disguised as SOURCE-DERIVED (§4 rule).
- **ED-08/ED-09 result:** candidate **C2 — an optional, composition-root-injected approval component consulted exactly once at GATE — is selected**; an explicit, exhaustive change-set (**CS-13**) is authorized for later implementation; everything outside CS-13 remains frozen. CS-13 takes effect only on executive reviewer approval; this record implements nothing.
- Safety and Determinism rulings reaffirmed with the Task 13 formulations (§6, §7).
- Pending gates (process, not decisions): executive reviewer approval → Contract authoring task → implementation under CS-13.

## 2. Baseline

```text
BASELINE  bbc7ac461f2e9e5fa86705cd95c1e38746980b7d
          ("Add Grimoire v3 Plan Execution Composition" — branch main, synced for Task 13;
           HEAD unchanged; no commit, no push)
TESTS    node --test test/*.test.mjs → 228/228, 39 suites, 0 skipped (verified in both tasks)
PROTECTED PINS (unchanged, verified Task 13)
          docs/v3/01–04 SHA-256 (test/hkc-coverage.test.mjs CORE_PINS; test/rb-report-bus.test.mjs PINS)
          docs/v3/12 SHA-256 (REGISTRY_PIN / PINS)
          18 legacy source files (HKC-17); six module manifests (PE-01/PL-01)
GATE     frozen: RECEIVE → VALIDATE → PLAN → GATE → ORCHESTRATE → REPORT → COMPLETE;
          plan.review.required === true → APPROVAL_REQUIRED (E-INPUT, REFUSED @ GATE), agent zero-call
```

## 3. Evidence reviewed

### 3.1 Task 12 evidence (unchanged, carried forward)

| Source | What was taken from it |
|---|---|
| `docs/v3/01-core-specification.md` | §1.5, §0.1 (Waiver), §5.2 verbatim, §5.5, §5.6, §6.2, §11.1, §13.5–13.7 |
| `docs/v3/02-architecture-map.md` | §1 layer diagram (no Policy component; L1 services list), §2 component rules, §3 rules 1/3/4, §5 ("adds capability, never policy") |
| `docs/v3/03-extension-contract.md` | §2 manifest contract, §8 (new Core primitive = versioned Core change approved before ship) |
| `docs/v3/04-decision-rules.md` | §1 G0 ("ASK for explicit approval first; proceed only on yes"), §4.4 determinism, §4.5, §5 example |
| `docs/v3/05-acceptance-tests.md` | AC-05, AC-06, PL-05/PL-13, Group Q (PE-01/05/06/15/16/21, M4), composition release gate (228/228), Group Q known limitations |
| `docs/v3/12-hotkey-registry.md` | Precedent: `BLOCKED_*` "awaiting executive ruling"; ruling process exists (`13`) |
| `docs/v3/13-hotkey-decision-sheet.md` | Ruling-record documentation convention |
| `docs/v3/18-agent-orchestrator.md` | §2 (composition root injects), §4/§18 (Task 12 Policy/Approval engine named as future layer) |
| `docs/v3/19-planner.md` | §4/§18 ("acting on `review.required`"), §5 request contract, §13 determinism, §14 boundaries, §17 limitations (computed flag; no UI; stateless) |
| `docs/v3/20-plan-execution-composition.md` | §2/§3 (composition = wiring, no manifest), §4, §5 bundle contract, §6 lifecycle, §11 code table (14 codes; `APPROVAL_REQUIRED → E-INPUT`), §12 rules 1–15, §13 determinism, §14 security (no bypass; no registry/tool/runtime handle), §17 ("the gate withholds, it does not approve"), §18 |
| `docs/v3/17-report-bus.md` | The only digest in the system: `sha256` over rendered report bytes |
| `modules/planner/src/request.mjs`, `…/planner.mjs` | `TRIGGER_TYPES`; `review.required = tier === "T2" && trigger !== undefined`; `freezePlan()` freezes `plan.review` |
| `composition/plan-execution/src/composer.mjs` | Frozen GATE branch; config-validation belt; one report build per attempt |
| `modules/agent/src/*`, `composition/plan-execution/src/{bundle,errors}.mjs` | No approval field or approval vocabulary anywhere |
| `test/*.mjs` (all 10) | Pin tables, release-gate counts, PE/PL determinism source scans |

### 3.2 Task 13 evidence additions

| Check | Result |
|---|---|
| `docs/v3/21-policy-approval-design.md` re-verified (working tree + `git ls-files` + HEAD) | **ABSENT — confirmed again.** Not reconstructed; not claimed to have existed. No ruling relies on it (Decision D-13-0, §5). |
| Repository state at Task 13 start | Clean except this record (intent-to-add from Task 12, preserved); HEAD = baseline `bbc7ac4`. |
| Trust model actually used by the system today | Every dependency (planner, agent, reportBus, registry, runtime, toolBus) is **injected by the composition root** and trusted to its contract; conformance belts (`PE-07`) reject non-conforming results; no in-repo UI, session, or user-interaction channel exists (`19 §17`). |
| Test-suite invariants that constrain any GATE change | `PE-01`: exactly 14 result codes, 7 lifecycle stages, `BUNDLE_FIELDS = [plan, execution]`, constructor throws `E_INPUT_INVALID_COMPOSITION_CONFIG` on bad deps, no manifest; `PE-05`/`PE-21`/`M4`: gated plan refuses, agent zero-call, never `COMPLETED`; `PE-15`: exact call order/counts; `PE-16`: surface exactly `execute`, `./`-only imports, one build per attempt; `PE-19`: determinism incl. source scan; `PE-02`/`PE-17`: three reports, five sections. |

## 4. Classification legend and integrity rule

| Label | Meaning |
|---|---|
| **SOURCE-DERIVED** | Stated in repository sources; the ruling quotes or directly restates it. |
| **DIRECTLY IMPLIED** | Entailed by stated repository rules without adding any new assumption. |
| **PROPOSED** | An executive decision of this session **not** entailed by source (the missing authority is the executive ruling itself); binding only after executive reviewer approval. |
| **UNRESOLVED** | Repository evidence insufficient **and** no legitimate executive ruling available; implementation must not assume an answer. |

**Integrity rule (Task 13):** **no PROPOSED item may silently become SOURCE-DERIVED.** Each decision below carries an explicit **History** line showing its Task 12 classification and its Task 13 classification. Promotions to SOURCE-DERIVED/DIRECTLY IMPLIED happen only if new source evidence appears — never by re-labeling.

---

## 5. Executive decisions ED-01 … ED-12

### ED-01 — Approval authority
- **Classification:** **SOURCE-DERIVED** (authority) · **History:** Task 12: SOURCE-DERIVED (+ UNRESOLVED sub ED-01b) → Task 13: SOURCE-DERIVED; ED-01b resolved as PROPOSED (scoped below).
- **Evidence:** `01 §5.2` "shown to the **user**"; `01 §1.5`/`§6.2` "**user** approval"; `01 §0.1` Waiver "approved by the **user** or the acceptance tests"; `04 §1` G0 "proceed only on **yes**"; `05` AC-06 (the ASK precedes any executing tool call).
- **Decision:** The **user** is the only legitimate approval authority. No role, credential, token, signature, database, or API exists or may be recognized as one. **ED-01b (in-repo channel): RESOLVED — PROPOSED:** approvals enter executable code **only** through the composition-root-injected approval component (ED-08/ED-11); any user-facing presentation of consent is outside this repository's contracts (no UI exists — `19 §17`) and is a host concern, recorded as a non-goal, not an open decision.
- **Rationale:** Every approval statement in `01`/`04`/`05` names the user; no other approver appears anywhere. The only trust boundary the architecture knows is composition-root injection (`02 §3`, `18 §2`, `19 §2`), so the in-repo channel must be that boundary.
- **Contract consequence:** approval originates outside every executing layer; the contract may define an injected approval component and its verdict, never a credential/identity system.
- **Compatibility consequence:** nothing existing changes; the ruling slots into the DI pattern already used for planner/agent/reportBus.
- **Security consequence:** authority separation is structural: layers that execute cannot confer authority; host-side UX gaps cannot be papered over by in-system approvals.
- **Test consequence:** Group R (new) must assert provenance: verdicts reach GATE only via the injected component (stub-component tests, PE-07 style).

### ED-02 — Approval representation and verification
- **Classification:** **PROPOSED** (representation/verification model — the source contains none; **missing authority = this executive ruling**) with **SOURCE-DERIVED/DIRECTLY IMPLIED** guardrails as marked per line.
- **Evidence:** No approval representation exists anywhere in `01`–`20`, manifests, or sources (Task 12 finding, re-confirmed §3.2). Constraints: `01 §13.5` fail closed; `20 §12` rule 6 + `20 §17` ("a gate this layer cannot verify never reads as satisfied"); `20 §14` DI/no-bypass; `20 §11` `APPROVAL_REQUIRED → E-INPUT` (pinned); the system's trust model is injection + conformance belts (§3.2).
- **Decision (all mandated sub-questions):**
  1. **Representation:** a **verdict object** produced *only* by the composition-root-injected approval component and consulted by the composer exactly once at GATE when `plan.review.required === true`. What the component uses internally to ground a verdict in the user's decision is host-internal and outside the repository's contracts. No signature, token, credential, identity, or stored record is part of the representation (explicitly ruled: **no cryptography**).
  2. **Verification:** construction-time belt — an injected component must be conforming (duck-typed like `planner.plan`/`agent.run`/`reportBus.build`), else `E_INPUT_INVALID_COMPOSITION_CONFIG`, same as every other dependency; run-time checks at GATE — verdict present, well-formed, **affirmative**, and bound to this bundle's plan and execution (ED-03/ED-04). Anything else is "not approved".
  3. **Provenance:** composition-root injection only (ED-01b). No executing layer — Planner, Agent, Composer, or the approval component itself — may generate or mint an approval (§6).
  4. **Tamper resistance:** **architectural, not cryptographic** — explicitly ruled. Resistance = single provenance channel + plan/execution binding (ED-03/ED-04) + deterministic evaluation (§7) + fail-closed belts + PE-16-style source scans forbidding a hardcoded grant path. The threat model is: forgery *by executing layers* and accidental non-affirmative outcomes. A malicious composition root is out of trust scope, exactly as it already is for planner/agent injection (recorded limitation, §9).
  5. **Malformed verdict** → refuse `APPROVAL_REQUIRED` (E-INPUT) with a distinguishing `detail`; never repair, never partially accept (`01 §13.5`).
  6. **Missing component / missing verdict** with `review.required === true` → refuse — byte-identical to today's behavior.
  7. **Invalid verdict** (non-affirmative, non-binding, or from a component that throws at GATE) → refuse; a throwing component is caught to a refusal, never to an assumption.
- **Rationale:** this is the minimum model that answers all seven sub-questions without inventing identities, storage, clocks, or crypto, and while reusing the exact trust pattern the repository already applies to every injected dependency (conformance belts, fail-closed, source scans).
- **Contract consequence:** the contract must specify: injected-component interface (method count one), verdict well-formedness belt, GATE consultation order (once, only when gated, before any ORCHESTRATE call), refusal detail strings, no-new-result-code rule (14 pinned by PE-01), no report from the approval component (§3.2 invariants).
- **Compatibility consequence:** with no component injected, behavior is identical to today → PE-05, PE-21, M4 stay green unchanged; `BUNDLE_FIELDS`, result codes, stages untouched.
- **Security consequence:** provenance separation prevents executing-layer self-approval; cryptographic non-resistance is stated, not hidden (§9 records the trust-boundary limitation explicitly).
- **Test consequence:** Group R must cover: affirmative path crosses GATE; each of malformed/missing/invalid/throwing refuses with exact code/status/stage; component absent = today's refusal; component called exactly once, only when gated; source scan proves no hardcoded grant.

### ED-03 — Plan identity and approval binding
- **Classification:** **PROPOSED** (scheme explicitly ruled now; **missing authority = this executive ruling**; digest machinery precedent is SOURCE-DERIVED via `17`/PL-19/PE-19) · **History:** Task 12: UNRESOLVED → Task 13: RESOLVED (PROPOSED).
- **Evidence:** plan shape fixed `tier, depth, task, changes, verification, risks, review` with pinned key order (`19 §5`, `19 §13`); plan frozen (`freezePlan`); the repo already renders exact bytes and hashes them for reports (`17`, `sha256(text)` in PE-19/PL-19); no plan identity field exists (Task 12 finding). Task 13 explicitly permits ruling a digest: "Do not assume digest/hash identity **without an explicit ruling**."
- **Decision (all mandated sub-questions):**
  1. **What uniquely identifies the plan:** a **content-derived plan identity** — `sha256` over the canonical serialization of the frozen plan artifact (fixed key order `tier, depth, task, changes, verification, risks, review`; deterministic encoding rules to be pinned byte-exactly in Contract authoring).
  2. **Content-derived:** **yes** — identity is a pure function of plan content (deterministic; §7).
  3. **Stable:** **yes** — identical plan content ⇒ identical identity across runs (fixed key order, frozen structure, deterministic `sha256`).
  4. **Plan content changes:** identity changes ⇒ an approval bound to the old identity is **no longer valid** ⇒ GATE refuses until the user approves the *changed* plan (re-approval; consistent with `01 §5.5`'s "the stale plan is never quietly abandoned").
  5. **Replay against another plan:** impossible to succeed — verification recomputes the identity of the plan actually gated and compares; any other plan ⇒ mismatch ⇒ refuse.
- **Rationale:** compared against the alternative **structural full-equality binding** (approval carries the whole plan; deep-compare): rejected because it transports the full artifact per approval and buys nothing — both schemes are deterministic and fail-closed; the digest scheme reuses the repository's existing, tested byte-hash convention (`sha256` over exact bytes) rather than introducing new machinery. The scheme is chosen here as an explicit ruling precisely so no implementation "assumes" hashing (Task 13 constraint satisfied).
- **Contract consequence:** binding = comparison of recomputed identity vs the identity the approval was granted for; canonical serialization rules must be byte-exact and test-vector-pinned in the contract; identity computation must sit in the approval component's duty (each layer holds its own gate) with the composer checking verdict conformance only.
- **Compatibility consequence:** plan artifact shape unchanged (no new field added to the plan — identity is computed, not stored); planner untouched; `19 §13` key order already fixes canonical order.
- **Security consequence:** content-binding gives tamper-evidence (any edit invalidates approval) and replay-proofing without signatures; collision assumptions are `sha256`-level, recorded as the accepted level (§9).
- **Test consequence:** Group R needs golden identity vectors (fixed plan fixture ⇒ fixed identity) and negative cases: single-byte plan change ⇒ different identity ⇒ refusal; approval issued for plan A used with plan B ⇒ refusal.

### ED-04 — Approval ↔ execution scope (incl. 04b/04c)
- **Classification:** attachment **DIRECTLY IMPLIED** (Task 12, retained); **ED-04b coverage and ED-04c mismatch: PROPOSED** (new ruling) · **History:** Task 12: DIRECTLY IMPLIED + UNRESOLVED (b/c) → Task 13: RESOLVED (attachment DIRECTLY IMPLIED; b/c PROPOSED).
- **Evidence:** GATE reads only `plan.review` (`20 §6`); the execution sub-request is caller-supplied and untranslated (`20 §4/§17`) but **present in the bundle at GATE time** (`BUNDLE_FIELDS = [plan, execution]`); `01 §5.2` gates the plan before BUILD; no mismatch rule exists anywhere.
- **Decision:**
  - **ED-04b:** approval covers **both** the plan and the execution sub-request as presented in the bundle at GATE — because the GATE authorizes exactly the plan→execution transition, the approval's binding (ED-03 scheme applied to each) must match **both** members of the bundle.
  - **ED-04c (mismatch behavior, now explicitly ruled):** if either member differs from what the approval was granted for (plan edited, execution swapped, or either absent/extra), the verdict is **non-binding** ⇒ refuse `APPROVAL_REQUIRED`. No partial coverage, no re-scoping, no silent acceptance.
- **Rationale:** covering only the plan would let a caller swap the execution sub-request after approval — a hole the GATE exists to prevent; binding both costs nothing (both are in hand at GATE) and keeps mismatch handling a pure deterministic comparison.
- **Contract consequence:** verdict well-formedness includes bindings for both members; contract must state mismatch ⇒ `APPROVAL_REQUIRED` (E-INPUT), detail distinguishing binding mismatch.
- **Compatibility consequence:** none — bundle shape unchanged; refusal path unchanged.
- **Security consequence:** closes the swap-the-execution gap; mismatch never degrades to "close enough" (fail-closed).
- **Test consequence:** Group R: approval bound to plan+execution passes; same approval with mutated plan ⇒ refusal; with mutated execution ⇒ refusal; both-mutated ⇒ refusal.

### ED-05 — Expiration / revocation
- **Classification:** **PROPOSED** (explicit exclusion ruling; grounded DIRECTLY IMPLIED by statelessness/determinism) · **History:** Task 12: UNRESOLVED (+ DIRECTLY IMPLIED no-mechanism constraint) → Task 13: RESOLVED (PROPOSED: excluded).
- **Evidence:** no clock/timestamp/persistence/revocation exists (`20 §13`, `19 §13`, `20 §17`, `19 §17`); Task 13 determination: approval evaluation is a pure function of (bundle, injected verdict) evaluated once at GATE — **persistence and time are not required** for any of the mandated behaviors (missing/invalid/mismatch already handled at evaluation time).
- **Decision:** Approval has **no expiration and no revocation**. Its validity is scoped to the single `execute()` attempt in which it is evaluated: evaluated once at GATE, consumed there, never stored, never re-checked, never aged. Revocation as an in-repo concept does not exist; a host that must revoke user consent does so by declining to inject/affirm a verdict (host-internal, outside repo contracts).
- **Rationale:** expiry would require a clock (banned by §7), revocation would require stored state (banned by ED-07 ruling below); neither buys security because a bound approval (ED-03/ED-04) is only meaningful for one bundle in one attempt anyway.
- **Contract consequence:** contract must contain no TTL, timestamp, lease, epoch, revocation list, or re-validation step; GATE consults the verdict once.
- **Compatibility consequence:** determinism machinery unchanged (PE-19 source scan stays green: no `Date.now` etc.).
- **Security consequence:** no time-of-check/time-of-use surface introduced; also no decay path — recorded as intentional (an approval either exists for this attempt or it does not).
- **Test consequence:** Group R determinism test covers: same bundle + same injected verdict across two builds ⇒ identical results/bytes/hashes (no time-dependent output anywhere in the approval path).

### ED-06 — Policy identity / version (incl. ED-06b)
- **Classification:** non-existence **SOURCE-DERIVED**; decision not to create an artifact **PROPOSED** · **History:** Task 12: SOURCE-DERIVED (none exists) + UNRESOLVED (06b) → Task 13: RESOLVED (no artifact shall be created; version questions N/A).
- **Evidence:** no policy artifact, schema, manifest field, or data structure exists in any source/manifest (re-confirmed); "Policy/Approval" appears only as the future capability's *name* (`18 §4/§18`, `19 §4/§18`, `20 §4/§17/§18`, `05` Group Q); Task 13: "Do not create a policy artifact merely because the engine is called Policy/Approval."
- **Decision (sub-questions):**
  1. **Identity:** N/A — no policy artifact exists or is created; the name "Policy/Approval" denotes the **capability** (approval verification consumed at GATE), not a data object.
  2. **Version:** N/A for an artifact. The only normative "policy" text governing approval remains Core `01 §5.2` (byte-pinned; Core versioning via `01 §13.6` / `03 §8` if ever amended — ED-12 contingency unchanged).
  3. **Immutable revision:** N/A — nothing to revise.
  4. **Mutation authority:** N/A — nothing to mutate; any future proposal for an actual policy artifact (e.g., rules parameterizing when review is required) is a **new explicit decision** taking the `03 §2`/`01 §13.6` or `03 §8` path, never a side effect of this engine.
- **Rationale:** creating an artifact would manufacture structure the source does not have and would drag in versioning/identity/mutation questions with no user; the capability is fully expressible as behavior (verdict verification) without data.
- **Contract consequence:** contract defines behavior and vocabulary only; no `policy.yaml`/policy object/manifest entry for a policy artifact; module naming must not imply an artifact exists.
- **Compatibility consequence:** if placement B (ruled out anyway, ED-11) had been chosen, a manifest would exist — it would register a *capability*, not a policy artifact; with placement A no manifest at all.
- **Security consequence:** no policy store ⇒ nothing to corrupt, roll back, or mutate by privilege.
- **Test consequence:** no test asserts a policy artifact; PE-01's "no manifest" assertion stays true under CS-13.

### ED-07 — Persistence (incl. ED-07b)
- **Classification:** stateless-today **DIRECTLY IMPLIED**; future-storage prohibition **PROPOSED** · **History:** Task 12: DIRECTLY IMPLIED + UNRESOLVED (07b) → Task 13: RESOLVED (PROPOSED: must not persist).
- **Evidence:** composer/planner stateless (`20 §17`, `19 §17`); no `fs` anywhere (PE-16/PL-17 scans); verdicts are consumed once at GATE (ED-02/ED-05); `02 §2` Memory role exists but nothing routes approvals into it.
- **Decision:** The approved representation is **not persistent**. It is per-attempt input through the injected component, evaluated once, never written to any file, database, cache, log-of-record, or cross-attempt store. No database or external storage assumption may appear in the contract.
- **Rationale:** every mandated behavior (verification, binding, mismatch, fail-closed) is computable statelessly; adding storage would break the determinism input list (§7) and create a new attack surface for zero functional gain (ED-05 determined no lifecycle needs it).
- **Contract consequence:** contract contains no storage interface, no persistence section, no state carried between `execute()` calls.
- **Compatibility consequence:** PE-19/PL-19 mechanism bans unchanged; stateless claims in `20 §17`/`19 §17` remain true.
- **Security consequence:** nothing at rest ⇒ nothing to leak, replay across sessions, or escalate; replay within scope is already defeated by binding (ED-03).
- **Test consequence:** Group R source scan: no `fs`/`node:` imports in the approval path (same class as PE-16/PL-17 scans).

### ED-08 — GATE decision → authorization mechanism (with ED-09)
- **Classification:** mechanism selection **PROPOSED** (**missing authority = this executive ruling + Task 13 mandate**); guardrails **SOURCE-DERIVED/DIRECTLY IMPLIED**; **History:** Task 12: UNRESOLVED → Task 13: **RESOLVED (PROPOSED — candidate C2 selected)**.
- **Evidence:** frozen GATE (`composer.mjs`, `20 §6/§11/§12` rule 6); planner computes `review.required` from `trigger` only (`planner.mjs`, PL-05/PL-13); test invariants §3.2; injection trust model §3.2; safety ruling §6 (no in-system approval generation).
- **Decision — the minimum contract change so that `plan.review.required === true` proceeds ONLY when a valid approval exists:**

  > Add **one optional injected approval component** (name/shape fixed in Contract authoring) to `createPlanExecutionComposer({planner, agent, reportBus, approval})`. At GATE, when and only when `plan.review.required === true`: consult the component **exactly once**; proceed to ORCHESTRATE **only** on a well-formed, affirmative verdict bound to the bundle's plan **and** execution (ED-03/ED-04). If the component is absent, non-conforming, throws, returns malformed/non-affirmative/non-binding output — or if `review.required === false` is unchanged — behavior is exactly as today: pass when `false`, refuse `APPROVAL_REQUIRED` (E-INPUT, REFUSED @ GATE, agent zero-call) when `true` without approval.

  **Explicit comparison of candidates:**

  | Candidate | Mechanism | Changed files/contracts | Security properties | Compatibility impact | Test impact | Migration impact | Architecture verdict |
  |---|---|---|---|---|---|---|---|
  | **C1 — bundle-level `approval` field** | Approval is data inside the envelope; composer validates it itself | `src/bundle.mjs` (`BUNDLE_FIELDS`, `validateBundle`, `normalizeBundle`), `src/composer.mjs`, `index.mjs`, `20 §5/§6/`§11; `05` PE-01, PE-06, fixtures | Plain caller-supplied data = forgeable provenance; composer becomes both data owner and grantor; mixes trusted verdict into untrusted envelope | Breaks strict-envelope invariant (`20 §5`); PE-06's "extra field refused" rule needs an exception; `normalizeBundle` changes | High churn: PE-01 `BUNDLE_FIELDS`, PE-06 nine-case matrix, PE-15, plus new tests | Every caller sees a new optional envelope member; envelope asymmetry (missing vs extra) | **REJECT** — weakens provenance separation and the "each contract holds at its own gate" split; larger blast radius than needed |
  | **C2 — injected approval component at GATE (SELECTED)** | Optional 4th DI dependency; consulted once at GATE only when gated; verdict + binding checked; fail-closed default | `src/composer.mjs` (GATE branch + config belt), `index.mjs` (vocabulary export), `20` (§2/§3/§4/§6/§11 detail/§12 rule 6/§13/§14/§15/§16/§17/§18), `05` Group Q addendum + **new Group R**, `test/plan-execution.test.mjs` (additive) + new fixtures. **Not** planner, agent, bundle envelope, result codes, stages, Report Bus, Core, manifests | Provenance separation preserved; self-approval impossible (only injected channel; PE-16-style source scan forbids hardcoded grant); fail-closed identical; deterministic pure function of (bundle, verdict); binding covers plan+execution | Refusal path **byte-identical** when component absent → PE-05, PE-21, M4 stay green untouched; 14 codes / 7 stages / `BUNDLE_FIELDS` / three-report invariant all preserved | Mostly additive: PE-01 gains optional-dep belt; PE-15 gains "verifier called once, gated only, before ORCHESTRATE"; PE-16 scan extended; Group R (success/failure/belts/determinism/no-self-approval) | None — optional dependency; existing constructions and callers unchanged; stateless | **PRESERVES** — DI over construction (`20 §14`), composition-root wiring (`02 §3`), no registry/tool/runtime handle, no lateral imports, each layer holds its own gate |
  | **C3 — planner-level approval input** | Planner receives approval and computes `review.required=false` on approval | `modules/planner/**` (**protected here**), `19 §5/§17`, PL-05/PL-13, planner fixtures/tests | Violates §6 mandatory safety ruling: **Planner output would become the approval**; GATE cannot distinguish "no trigger" from "approved" (evidence lost); approval decided at PLAN, not at GATE | Breaks PL-05 "trigger ⇒ required" pin and the planner's non-approval role (`19 §17`) | Breaks/requires rewriting PL-05, PL-13, planner suite | Planner request envelope changes for all callers | **REJECT** — safety-ruling violation + wrong side of the plan→execution boundary |
  | **C4 — caller omits `trigger`** | Suppress the gate by never declaring a trigger | none | Not an approval mechanism: no user decision, silent §5.2 dishonesty | "Works" only by discarding the gate | none | none | **REJECT** — repurposes the existing caller-asserted-tier trust limitation (`19 §17`) as a bypass; forbidden by `01 §5.2` |
  | **C5 — pre-GATE rewrite of `plan.review`** | Rewrite `required: false` after approval | `src/composer.mjs` (or caller) | Direct bypass: any writer can flip the gate; contradicts "the gate withholds" (`20 §17`) | Mutates frozen GATE semantics silently | Invalidates PE-05/M4 | none | **REJECT** — this *is* the silent mutation Task 13 forbids; plan is frozen (`freezePlan`) |

  **Preserved properties under C2 (each mandatory):**
  - *Fail-closed:* absent/throwing/malformed/non-affirmative/non-binding ⇒ refuse — rules 1/6 of `20 §12` unchanged in effect.
  - *Agent zero-call on refusal:* refusal still returns before `agent.run` (same code path position as today).
  - *Deterministic:* verdict consultation is a pure function of (bundle, injected component) — §7 admissible inputs; exactly-once call rule prevents retry nondeterminism.
  - *No self-approval:* verdicts only from injection; source scan forbids hardcoded `true`; planner/agent outputs never read as approvals (§6).
  - *No bypass:* GATE remains the only crossing; no pre-rewrite, no trigger omission, no extra envelope path (C1/C4/C5 rejected).
  - *Report Bus semantics:* verdict appears as composer evidence/ledger lines only (`GATE: done (approval verified)` / `GATE: refused (APPROVAL_REQUIRED)`); still exactly one build per attempt; no report from the approval component; refusal still mirrors result (PE-20).
  - *Core error classes:* `APPROVAL_REQUIRED` stays E-INPUT; **no new result code** (PE-01 pins 14); detail strings differentiate cases.

- **Rationale:** C2 is the minimum change that creates the crossing condition while keeping every pinned invariant green-by-default (uninjected = today's behavior), reusing the repository's own trust pattern, and satisfying all seven mandated preservation properties; every alternative breaks either a safety ruling, a pinned test invariant, or provenance separation (table).
- **Contract consequence:** authorizes exactly **Change-Set CS-13** (see ED-09). The contract must specify the component interface, verdict well-formedness, once-only consultation, binding checks, detail vocabulary, construction belt, and the Group R matrix.
- **Compatibility consequence:** refusal semantics, lifecycle stage names, result-code count, bundle shape, report counts all unchanged; only additive surface (optional dependency + new vocabulary export).
- **Security consequence:** provenance, binding, determinism, and source-scan enforcement compose to make self-approval structurally unavailable; residual trust in the injected component is the same trust already placed in planner/agent (recorded limitation §9).
- **Test consequence:** existing 228 stay green **unchanged** (verified by run below; Group Q expectations preserved); Group R adds approval-path coverage; PE-15/PE-16/PE-01 gain additive assertions when CS-13 is implemented (specified in Contract authoring, not now).

### ED-09 — Existing GATE semantics / change authorization
- **Classification:** freeze **SOURCE-DERIVED**; the narrow grant **PROPOSED** · **History:** Task 12: SOURCE-DERIVED ("No under Task 12") → Task 13: **RESOLVED — "No, except Change-Set CS-13" (grant PROPOSED)**.
- **Evidence:** `20 §6/§11/§12` rule 6; `05` PE-05/PE-21/M4 + composition release gate ("no gate is ever skipped around"); Task 13 mandate: "determine whether an approved change-set is explicitly authorized that can introduce the minimum required GATE capability without silently mutating the existing contract."
- **Decision:** **Yes — an explicitly authorized, exhaustive change-set exists: CS-13.** It is the *only* authorized route by which the GATE may gain the approval capability; every file/rule outside CS-13 stays frozen exactly as ED-09's Task 12 entry stated. CS-13 (complete enumeration):

  **Change-Set CS-13**
  1. `composition/plan-execution/src/composer.mjs` — optional `approval` dependency (config-validation belt at construction); GATE branch consults it exactly once when `review.required === true`; refusal/`COMPLETED` outcomes unchanged otherwise.
  2. `composition/plan-execution/index.mjs` — re-export the new approval vocabulary only.
  3. `docs/v3/20-plan-execution-composition.md` — coordinated amendments: §2 flow annotation, §3 surface list, §4 (the engine now exists as injected layer), §6 GATE note, §11 (no new code; detail wording), §12 rule 6 (verified-approval exception, fail-closed retained), §13 (determinism inputs), §14 (explicit amendment: the approval component handle joins the DI list; no-bypass text updated), §15/§16 test tables, §17/§18 limitations.
  4. `docs/v3/05-acceptance-tests.md` — Group Q addendum **only where contradicted or extended** (PE-01 optional-dep/vocabulary, PE-15 call-order, PE-16 scan scope) + **new Group R** (approval tests). PE-05/PE-21/M4 expectations for the *uninjected* path remain as written.
  5. `test/plan-execution.test.mjs` — additive assertions; new approval fixtures under `test/_fixtures/`.
  6. This record (`docs/v3/22-…`) — status/decision-log updates as rulings advance.

  **Explicitly OUTSIDE CS-13 (frozen):** Core `01`–`04` and `12` (byte-pins; ED-12 contingency only via `03 §8`); `modules/planner/**`; `modules/agent/**`; `modules/hotkeys|tool-bus|module-registry|report-bus/**`; the bundle envelope (`BUNDLE_FIELDS`); the result-code table (14) and stage names (7); Report Bus contracts; the six manifests; runtime/GATE implementation *in this task* (CS-13 is authorization, not implementation).
- **Rationale:** this is the "minimum required GATE capability without silent mutation": one optional dependency + one consultation branch, everything else enumerated and pinned; authorization is explicit rather than implicit, and the record of what remains frozen is exhaustive.
- **Contract consequence:** Contract authoring may only write what CS-13 covers; any need outside it returns to this record as a new ruling.
- **Compatibility consequence:** uninjected behavior byte-identical; prior release gate (228/228, Core byte-unchanged, no manifest) remains satisfiable by construction.
- **Security consequence:** making the grant explicit and exhaustive prevents scope creep masquerading as "coordinated change"; no-bypass text is amended deliberately (§14), not silently.
- **Test consequence:** CS-13 implementation must prove: full suite green (228 + Group R), PE-05/PE-21/M4 untouched and green, new belts for the component. **This task changes no test** — verified below.

### ED-10 — Approval scope: Core §5.2 vs Decision Rules G0
- **Classification:** **SOURCE-DERIVED** · **History:** Task 12: SOURCE-DERIVED → Task 13: unchanged (reaffirmed).
- **Evidence:** `19 §18`/`20 §18` scope Task 12 to "acting on `review.required`"; `04 §1` G0 "Safety beats every other gate"; `04 §4.5`; `05` AC-06 (ASK first, before any executing tool call).
- **Decision:** Task 12 governs **only** Core §5.2 plan-review approval. G0 safety approval remains Decision Rules ASK-mode behavior and is **not** merged, pre-satisfied, or reordered by any approval component; a contract must state so explicitly.
- **Rationale:** merging would contradict `04 §1`/`§4.5` and make AC-06 unsatisfiable (an artifact produced after PLAN cannot be "the first action").
- **Contract consequence:** contract scope clause excludes G0; no approval component may be invoked from Decision Rules.
- **Compatibility consequence:** Group B tests unchanged.
- **Security consequence:** destructive-action approval stays interactive and first-in-order — the strongest safety property in the repo is untouched.
- **Test consequence:** AC-06/Group B remain green; Group R must not add tests implying G0 coverage.

### ED-11 — Placement
- **Classification:** **PROPOSED** (choice among architecturally permissible options; **missing authority = this executive ruling**) · **History:** Task 12: UNRESOLVED (constraint SOURCE-DERIVED; lean PROPOSED A; C rejected) → Task 13: **RESOLVED — A (composition root), PROPOSED**.
- **Evidence:** `02 §3` rules 1/3 (no lateral coupling; composition-root wiring); `18 §2`/`19 §2` (composition root injects); `20 §3` ("composition is wiring, not a registered capability")/`§14` (no registry handle in composer); `02 §5` ("a good module adds capability, never policy"); `02 §1` (no Policy component, no L1 policy service); `03 §2` (manifest = phase/tool/error declarations); §3.2 test invariants (PE-01: no manifest, six modules).
- **Decision:** Policy/Approval belongs at the **composition root — option A**: an injected service constructed and supplied by the composition root, consumed only inside the composer's GATE. It carries **no manifest**, registers nothing, resolves no capability, and builds no report. (B rejected: see rationale; C remains rejected as unsupported.)
- **Rationale:** with ED-08 = C2, the consumption point is fixed at the composer's GATE via DI, and the composition root is the only legal wiring point. Against the evaluation criteria: *no lateral coupling* — satisfied by both A and B under DI, so it does not decide; *composition-root wiring* — A is exactly `20 §3`'s "wiring, not a registered capability" precedent; *manifest conventions* — B would require declaring loop `phases`, tools, and INVOKE-gate semantics for a component that hooks **no loop phase** (GATE is a composition stage) and is never invoked through the registry (composer holds no registry handle) → the manifest would be false ceremony (`01 §5.4`) and would break PE-01's six-module/no-manifest assertions for no runtime benefit; *error declaration* — A's refusals are the composer's existing `APPROVAL_REQUIRED`/E-INPUT (no second taxonomy); *Report Bus* — A adds no report surface, preserving the three-report invariant (PE-02); *`02 §5`* — a named **Policy module** would push policy into L2, precisely what "adds capability, never policy" warns against, while a composition service keeps policy at the layer that owns the gate.
- **Contract consequence:** contract defines the component interface + composition-root wiring responsibility; no `manifest.yaml`, no registry entry, no `validateAll` change (PE-01 stays true).
- **Compatibility consequence:** six modules remain six; nothing registers; index export surface grows only by the approval vocabulary.
- **Security consequence:** single wiring point keeps provenance auditable; no new capability-resolution path that could be hijacked.
- **Test consequence:** PE-01's "no manifest / directory layout / six modules" assertions remain valid; Group R constructs the component the same way tests construct composers (DI stubs).

### ED-12 — Core wording (§5.2)
- **Classification:** **DIRECTLY IMPLIED** (+ recorded contingency) · **History:** Task 12: DIRECTLY IMPLIED → Task 13: unchanged (reaffirmed).
- **Evidence:** `01 §5.2` fixes the three triggers, names the user, fixes the default; the engine's role acts on `review.required` below Core (`19 §18`, `20 §18`); nothing contradicts §5.2 (verified: design doc absent, no implementation drafted).
- **Decision:** **No amendment required.** `01`–`04`/`12` stay byte-identical. Contingency (recorded, not enacted): a future need for Core text is a versioned Core change per `03 §8`/`01 §13.6` with pin updates (`CORE_PINS`, `PINS`) and a `05` review — never unilateral.
- **Rationale:** ED-02/ED-03/ED-08 as ruled all operate below Core wording; the flag-consuming engine does not require Core to describe representations.
- **Contract consequence:** contract cites §5.2; never edits it.
- **Compatibility consequence:** pins stay valid (verified below).
- **Security consequence:** the user-approval norm stays in the highest-authority document, unparsed and unpinned by any implementation detail.
- **Test consequence:** HKC-17/pin tests green (verified below).

---

## 6. Mandatory Safety ruling (Task 12 ruling, Task 13 reaffirmation)

**RULED (SOURCE-DERIVED authority / DIRECTLY IMPLIED prohibition):**
1. **No executing layer may generate its own approval.**
2. **No Planner output may automatically become approval** — `plan`, `plan.review`, or any planner-attached artifact is a *requirement flag*, never consent (kills candidate C3).
3. **No Agent output may automatically become approval.**
4. **No Composer output may automatically become approval** — the composer only *reads* a verdict; it never synthesizes one (source-scan enforced when CS-13 lands).
5. **No Policy/Approval component may self-authorize** — its verdicts must originate from the user (ED-01) through composition-root injection; the component cannot bootstrap authority from its own prior verdicts, from plan content, or from execution content.
6. **Any uncertainty must fail closed** — absent, malformed, non-affirmative, non-binding, or throwing outcomes all refuse with `APPROVAL_REQUIRED` (E-INPUT), agent zero-call, exactly as today.

Default behavior remains fail-closed; the GATE's refusal path is unchanged by every ruling in this record.

## 7. Mandatory Determinism ruling (Task 12 ruling, Task 13 reaffirmation)

**RULED (SOURCE-DERIVED):** approval evaluation is deterministic — same bundle + same injected verdict ⇒ same permit/deny, same lifecycle result, same report bytes, same `sha256` (`04 §4.4`/AC-05, `19 §13`, `20 §13`, PL-19/PE-19).

**Admissible inputs (explicit, exhaustive):** bundle content (plan artifact incl. `review`, execution request); the injected approval component's verdict as returned (dependency behavior, same class as planner/agent output); fixed contract constants/vocabularies.

**Inadmissible (explicit):** **current time**; randomness; PID; **environment state**; **hidden mutable state**; filesystem/network/persistence read-back; unordered iteration affecting output. *(Task 13 list, matched exactly; the Task 12 list additionally bans UUIDs/machine paths — retained.)*

**Consequence:** no ruling in this record admits any inadmissible input; any future ruling that would (e.g., a hypothetical expiry) must amend this section explicitly first (ED-05 closed against it).

---

## 8. Decision summary & unresolved list

| ED | Subject | Task 12 classification | Task 13 classification (current) | Decision |
|---|---|---|---|---|
| ED-01 | Approval authority | SOURCE-DERIVED (+UNRESOLVED b) | SOURCE-DERIVED; ED-01b PROPOSED (scoped) | User only; in-repo channel = composition-root injection; UX = host non-goal |
| ED-01b | Approval transport channel | UNRESOLVED | **RESOLVED — PROPOSED** | Injection only; user-facing UX out of repo contracts |
| ED-02 | Representation & verification | UNRESOLVED | **RESOLVED — PROPOSED** | Injected verdict model; 7 sub-questions ruled; no cryptography; fail-closed belts |
| ED-03 | Plan identity / binding | UNRESOLVED | **RESOLVED — PROPOSED** | Content-derived `sha256` over canonical frozen-plan bytes (explicitly ruled); change ⇒ re-approval; replay impossible |
| ED-04 | Scope attachment | DIRECTLY IMPLIED | DIRECTLY IMPLIED (retained) | Approval attaches to the plan at GATE |
| ED-04b | Execution coverage | UNRESOLVED | **RESOLVED — PROPOSED** | Binding covers plan **and** execution sub-request |
| ED-04c | Mismatch behavior | UNRESOLVED (not ruled) | **RESOLVED — PROPOSED** | Any divergence ⇒ refuse `APPROVAL_REQUIRED` |
| ED-05 | Expiration / revocation | UNRESOLVED | **RESOLVED — PROPOSED** | None — no clock, no TTL, no revocation; validity = one attempt |
| ED-06 | Policy artifact existence | SOURCE-DERIVED (none) | SOURCE-DERIVED (retained) | No artifact exists |
| ED-06b | Policy identity/version/revision/mutation | UNRESOLVED | **RESOLVED — SOURCE-DERIVED (N/A) + PROPOSED (do not create)** | Capability, not artifact; all four sub-questions N/A; future artifact = new decision via `03 §2`/`13.6`/`03 §8` |
| ED-07 | Persistence (current path) | DIRECTLY IMPLIED | DIRECTLY IMPLIED (retained) | Existing path stateless |
| ED-07b | Storage permission | UNRESOLVED | **RESOLVED — PROPOSED** | Must not persist; no DB/storage in contract |
| ED-08 | GATE authorization mechanism | UNRESOLVED | **RESOLVED — PROPOSED (C2 selected)** | Optional injected approval component; once at GATE; fail-closed default |
| ED-09 | Change frozen GATE? | SOURCE-DERIVED (No) | Freeze SOURCE-DERIVED + **grant PROPOSED (CS-13)** | Only Change-Set CS-13 authorized; exhaustive list; rest frozen |
| ED-10 | §5.2 vs G0 scope | SOURCE-DERIVED | SOURCE-DERIVED (retained) | §5.2 only; G0 untouched |
| ED-11 | Placement | UNRESOLVED | **RESOLVED — PROPOSED (A)** | Composition-root injected service; no manifest; no registry entry |
| ED-12 | Core §5.2 wording | DIRECTLY IMPLIED | DIRECTLY IMPLIED (retained) | No amendment; contingency = `03 §8` controlled change |

**Explicitly unresolved:** **none** among ED-01…ED-12 after Task 13.

**Missing authority, identified honestly (why each closed item is PROPOSED, not SOURCE-DERIVED):** the repository contains no representation, identity scheme, mechanism, placement statement, expiry rule, or storage rule for approval (all confirmed absent — §3). The authority supplying these decisions is **the executive ruling of Task 13 itself**, pending executive reviewer approval. They must not later be re-labeled SOURCE-DERIVED without new source evidence (§4 integrity rule).

**Deliberately NOT ruled (contract-authoring latitude, not unresolved decisions):** exact field names/shapes of the component interface and verdict object; byte-exact canonical-serialization encoding rules (scheme fixed: sha256 + fixed key order); exact refusal `detail` strings; Group R test naming. None of these may deviate from the rulings above.

**Out-of-scope recorded limitations (not decisions):** host-side consent UX (no UI exists in-repo); malicious-composition-root threat model (same trust as planner/agent injection); `sha256` collision assumption (report-hashing precedent).

## 9. Security / safety consequences (consolidated)

- Fail-closed GATE behavior byte-preserved for every path except an affirmative, bound, injected verdict — and the component can only be supplied through the composition root.
- Self-approval is structurally unavailable to Planner, Agent, Composer, and the approval component (§6), enforceable by source scan (PE-16 pattern) when CS-13 lands.
- Provenance/binding/determinism compose into tamper-evidence without cryptography — recorded openly: the model is **trusted-composition**, not adversarial-caller; a malicious composition root is out of trust scope exactly as for planner/agent (unchanged pre-existing boundary).
- G0 destructive-action approval untouched (ED-10) — AC-06 remains satisfiable.
- No credentials, tokens, signatures, identities, storage, clocks, or randomness introduced (ED-01/02/05/07, §7) — nothing to steal, replay across attempts, race, or expire; replay within an attempt is defeated by plan+execution binding.
- Single error taxonomy preserved (`APPROVAL_REQUIRED`/E-INPUT; 14 codes pinned); refusal reports mirror results (PE-20).
- Pre-existing trust boundary unchanged: `tier`/`trigger` remain caller-asserted (`19 §17`) — rulings neither widen nor narrow it.

## 10. Compatibility consequences (consolidated)

- Files changed by Task 13: exactly one — this record. Protected files byte-identical (verified below); `modules/**`, `composition/**`, `test/**` untouched; no Planner/Agent/GATE runtime change; suite 228/228 unchanged.
- Doc numbering: `21-policy-approval-design.md` verified absent a second time and **never reconstructed**; its path stays vacant (Decision D-13-0 below); 22 remains authoritative.
- CS-13 enumerates every future change; uninjected behavior guarantees prior release-gate criteria remain satisfiable (PE-05/PE-21/M4 green, Core byte-unchanged, six manifests, no new registry entry).
- Ruling-process precedent (`13`'s `BLOCKED_*`) untouched.

## 11. Prerequisites → Contract authoring (updated exit path)

**Decision D-13-0 (design artifact):** PROPOSED — `docs/v3/21-policy-approval-design.md` is **not required**; verified absent twice; no historical continuity is manufactured. The path stays vacant; future Policy/Approval documents take the next free number (22 taken by this record). This supersedes Task 12 prerequisite #1 ("locate or author 21") — recorded as an explicit decision, per Task 13's instruction.

**Contract authoring may begin only after:**
1. Executive reviewer approves the rulings in this record (process gate — PROPOSED items become adopted rulings; classifications do not change).
2. Contract document authored strictly within: ED-02 verdict model, ED-03 identity scheme, ED-04b/c coverage+mismatch, ED-05/ED-07b stateless-no-clock constraints, ED-08/ED-09 = C2 + CS-13 only, ED-11 = placement A, ED-10 G0 exclusion, ED-12 Core untouched, §6 safety, §7 determinism.
3. Group R acceptance tests specified (and, at implementation, full suite 228 + Group R green; PE-05/PE-21/M4 unchanged; source scans extended; identity golden vectors pinned).
4. CS-13 implemented as one coordinated change with `20` + `05` amended together — never piecemeal, never silent.
5. Core/`12` pins, six manifests, planner/agent sources remain byte-identical unless the `03 §8` contingency is separately invoked.
6. No commit/push unless explicitly requested (Freebuff Changes panel owns delivery).

---

**Recorded by:** Task 12 Executive Ruling Session (Phase 1) and Task 13 Contract-Blocker Resolution (Phase 2), both documentation-only, baseline `bbc7ac461f2e9e5fa86705cd95c1e38746980b7d`.
**Standing rules of this record:** where source evidence is insufficient and no legitimate executive ruling is available, a decision stays **UNRESOLVED** — no certainty is manufactured; PROPOSED never silently becomes SOURCE-DERIVED; history is noted, never erased.
