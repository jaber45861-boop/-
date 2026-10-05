# Grimoire v3 — Report Bus Contract

**Status:** Added Task 09 (L1 Core Service — Report Bus)
**Scope:** The REPORT stage of `03` §3 and the structured-result schema of `03` §5: input contract, section model, deterministic serialization, hashing, validation, fail-closed behavior, integration with the three data-supplying modules, dependency direction, safety boundaries, testing contract (RB-01…RB-20, RB-M1…RB-M9), and the known limitations. Core `01`–`04`, `12`, and all 18 legacy source files are unchanged.

**Why this exists.** Through Task 08 the repository had a Tool Bus and a Module Registry, and every module report was hand-built by its own module — but **nothing enforced the REPORT stage**: `03` §3 requires every module invocation to emit a structured result to the Report Bus, and `02` §1 lists the Report Bus as the L1 service that owns "artifacts, phase ledger, completion report". This module implements exactly that stage: it turns caller-supplied, already-validated structured rows into byte-stable report artifacts with a SHA-256 of the exact bytes — fail-closed on any contract violation.

---

## 1. Purpose

The Report Bus is the deterministic, fail-closed reporting service of Grimoire v3. It answers: *given supplied structured data, what is the exact report artifact, and what is its hash?* It validates the supplied structure against the Core contract (`03` §5, `01` §12), refuses anything that does not match, and renders sectioned markdown whose bytes are stable across repeated calls, separate processes, and input permutations.

It must NOT invent missing runtime behavior, tool capabilities, hotkey behavior, adapters, or executive decisions. It reports what it is given; it never repairs, normalizes, or guesses (`01` §13.5).

## 2. Architectural position

```text
Core (L0)
  ↓ governed by
Core Services (L1):  Module Registry · Tool Bus · Report Bus ← this document · Contract Validator
  ↑ supplies validated rows (never imported by the bus)
Modules (L2):        hotkeys (Task 05/06) · tool-bus (Task 07) · module-registry (Task 08)
  ↓ read/execute by declaration only
Assets (L3)
```

The Report Bus sits on the REPORT arrow of `03` §3's lifecycle (`REGISTER → VALIDATE → ENABLE → INVOKE → REPORT`) and on the two REPORT arrows of `02` §4 (Tool Bus outputs and the SHIP Completion Report flow through it). It is a **consumer of supplied data**: rows arrive from the caller, not from a bus-discovered module.

## 3. Module identity

| Field | Value |
|---|---|
| id | `report-bus` |
| version | `1.0.0` |
| core | `>=3.0 <4.0` |
| name | Report Bus |
| location | `modules/report-bus/` |
| entry | `modules/report-bus/index.mjs` |
| layers | L1 Core Service (implements `03` §3 REPORT; consumes `03` §5 schema) |
| provides | `report-bus:build`, `report-bus:validate` |
| consumes | `[]` (rows are supplied by callers, never fetched) |

## 4. Manifest

`modules/report-bus/manifest.yaml` follows `03` §2's thirteen-field normative schema — the same dialect as the Hotkeys, Tool Bus, and Module Registry manifests (no second dialect). Notable declarations:

- `phases: [RUN, TEST, SHIP]` — reports are built while work runs and at SHIP (`02` §4: "SHIP: Completion Report via Report Bus").
- `requires.tools: []` — the bus reads and executes nothing; it needs no tool. (Empty is valid: `03` §2 M3 requires the key to be present, not non-empty.)
- `consumes: []`, `conflicts: []` — one-way dependency direction (§15).
- `outputs: [report-bus-report, completion-report]` — its own audit report and the Completion Reports it renders (`03` §2: "artifacts this module produces (Report Bus)").
- `errors: [E-INPUT, E-ENV, E-CONFLICT, E-VALID]` — exactly the raisable subset (§11); `E-DEP`/`E-UNKNOWN`/`E-TOOL` are never raisable (no external service, no unclassified path, no tool invocation).

The manifest is validated by the Task 08 Module Registry validator in RB-02 (no self-trust: an external validator checks it).

## 5. Public API

`createReportBus()` returns a frozen object; there is **no configuration and no registration API** — `03` §5 O3 forbids modules from inventing parallel report schemas, so the type and section catalogues are Core contract data, not runtime registrations.

| Member | Semantics |
|---|---|
| `build(input)` | validate → render → `{ok, code, error, violations, report}`; `report` is `{text, sha256}` on success and **`null` on any violation** (no partial emission) |
| `validate(input)` | the same verdict minus rendering: `{ok, code, error, violations}`; never has a `report` key |
| `listTypes()` / `describeType(id)` | the report-type catalogue (§7); unknown id → `UNKNOWN_REPORT_TYPE` refusal |
| `listSections()` / `describeSection(id)` | the section catalogue with row contracts (§7); unknown id → `INVALID_SECTION` refusal |

Module exports (`index.mjs`): `createReportBus`, `RESULT_CODES`, `REPORT_TYPES`, `SECTION_CATALOG`, `REPORT_TYPE_IDS`, `SECTION_IDS`, `REPORT_STATUSES`, `EIGHT_LOOP_PHASES`, `getReportType`, `getSection`, `validateReportInput`, `CORE_ERROR_CLASSES`, `REPORT_BUS_ERROR_CLASSES`, `makeError`, `isCoreErrorClass`.

## 6. Input contract

```js
{
  type: "completion" | "result",   // a registered report type (§7)
  sections: [                       // entries in ANY order; unique ids
    { id: "results", rows: [...] },
    ...
  ]
}
```

- The envelope has exactly two fields. Any other top-level field (e.g. `generated_at`) is `INVALID_INPUT` — volatile data never enters through the door.
- `type` must be a non-empty string naming a registered type, else `UNKNOWN_REPORT_TYPE`.
- `sections` must be an array, else `INVALID_INPUT`.
- Each entry is exactly `{id, rows}`: unknown fields are refused; `id` is a registered section identity; `rows` is an array.
- Section order in the input does not affect output bytes (§8); row order inside a section is the caller's emission order and is preserved exactly.

## 7. Section model and report types

**Sections** (canonical order — `02` §1's "artifacts, phase ledger, completion report" line and `03` §5's field set):

| id | Row kind | Row contract |
|---|---|---|
| `summary` | object | `name` (non-empty string), `value` (string/finite number/boolean) — the metric-table convention of every existing module report |
| `results` | object | the eight `03` §5 fields: `module`, `command`, `status` ∈ `{success, blocked, failed}`, `phase_ledger`, `artifacts`, `evidence`, `remaining_issues`, `assumptions` (the last four: arrays of single-line non-empty strings) |
| `phase-ledger` | ledger | single-line `"<token>: <reason>"` lines — the `01` §3.2 format (`PLAN: done (T1)`, `DEBUG: skipped (no failures)`) |
| `artifacts` | object | `id` (non-empty string), `sha256` (64 lowercase hex) |
| `evidence` | text | single-line non-empty strings — `03` §5 O2 (reproducible commands, paths, outputs) |
| `remaining-issues` | text | single-line non-empty strings; a present-but-empty section declares "truly empty" (`01` §12.1) |
| `assumptions` | text | single-line non-empty strings (`01` §1.2 labeled assumptions) |

The `phase-ledger` token is **not** restricted to the eight loop phases: the committed Task 06 runtime emits §5 results whose ledger carries pipeline-stage lines (`RESOLVE: done (EXECUTABLE)`, `EXECUTE: refused (…)`) and `14` §4 states those fields reuse the `03` §5 schema — the existing contract wins over inventing a narrower rule (`directive` §3). Shape validation still refuses anything that is not `"<token>: <non-empty reason>"` on one line.

**Report types:**

| id | Required sections | Allowed sections | Grounding |
|---|---|---|---|
| `completion` | `results`, `phase-ledger`, `evidence`, `remaining-issues` | all seven | `01` §12 D9 (phase ledger present) + D10 (what changed → results; what was tested → evidence; remaining issues declared even when empty), `03` §3 REPORT |
| `result` | `results` | `results` only | `03` §5: "Every module invocation MUST emit a structured result to the Report Bus" — the structured result and nothing else |

A required section absent → `MISSING_REQUIRED_FIELD`. A section that exists but its type does not allow → `INVALID_SECTION`.

## 8. Deterministic serialization

For identical validated input: `build(input).text === build(input).text`, across repeated calls, fresh bus instances, separate processes, and any permutation of the `sections` array.

- Sections render in **fixed catalogue order**, so input order is irrelevant to the bytes.
- Rows render in **supplied order** (emission order is meaningful — a ledger is chronological).
- All set-like iteration is sorted or catalogue-ordered; no `Object.keys` order leaks into output except where it is first sorted (unexpected-field reporting).
- Cell values are single-line by validation; `|` is escaped so no row can break the table structure.
- Output ends with exactly one trailing newline (the line-array convention of `bus.mjs`/`registry.mjs`).
- Excluded by construction (`RB-13` asserts both output and source): timestamps, random values, process ids, machine paths, environment values, memory addresses, generated UUIDs, durations.

## 9. Hashing

`report.sha256` is `SHA-256` over the **exact UTF-8 bytes of `report.text`** (`node:crypto`, lowercase hex) — `sha256(report.text) === report.sha256`, asserted byte-for-byte in RB-08 (including that flipping a single byte changes the digest). The hash is not embedded in the text (a report cannot contain its own digest); it travels beside it, like every prior `{text, sha256}` builder in the repository.

## 10. Validation

`validateReportInput(input)` runs in a fixed order; the **first violation names the refusal code**, and every violation is carried in the `violations` array (`{code, detail}`) in deterministic order:

1. **Envelope shape** — input not a plain object / `type` not a non-empty string / `sections` not an array → `INVALID_INPUT`.
2. **Envelope fields** — any field other than `type`/`sections` (sorted) → `INVALID_INPUT`.
3. **Type lookup** — unregistered `type` → `UNKNOWN_REPORT_TYPE`.
4. **Section entries, input order** — non-object entry, unexpected entry field, invalid `id`, duplicate `id`, unknown `id`, `id` not allowed for the type, `rows` not an array → the entry's own code; then each row in order:
   - row base shape wrong (object expected but got a primitive; string expected for text/ledger sections) → `DEPENDENCY_ERROR`
   - required field absent → `MISSING_REQUIRED_FIELD` (`<section>[<i>].<field>`)
   - present value violates its contract (status enum, non-array field, bad ledger line, bad sha256, wrong value type) → `DEPENDENCY_ERROR`
   - undeclared field in a row (sorted) → `INVALID_SECTION`
5. **Required sections of the type** — each absent id → `MISSING_REQUIRED_FIELD` (`section:<id>`).

The split is deliberate: **structure/identity → `INVALID_SECTION`, absent required content → `MISSING_REQUIRED_FIELD`, present-but-invalid upstream values → `DEPENDENCY_ERROR`** — the three are never collapsed.

## 11. Fail-closed behavior

One taxonomy (`01` §11.1 Core classes only, built locally — §15). Every refusal is `{ok:false, code, error:{class, code, message, detail}, violations}` and **`report: null`** — no partial report, no repaired input, no silent normalization:

| Code | Class | Trigger |
|---|---|---|
| `VALID` | — (success) | the input satisfies the contract |
| `INVALID_INPUT` | E-INPUT | envelope shape/field violations (checked first) |
| `UNKNOWN_REPORT_TYPE` | E-INPUT | `type` not registered (exact match, no fuzzy lookup) |
| `DUPLICATE_SECTION` | E-CONFLICT | one `id` twice — never merged, never silently deduplicated |
| `INVALID_SECTION` | E-VALID | section/row structure, unknown or disallowed id, undeclared row field |
| `MISSING_REQUIRED_FIELD` | E-VALID | a required section or a required §5 field is absent |
| `DEPENDENCY_ERROR` | E-ENV | supplied row data fails its upstream contract — the state the bus depends on is untrustworthy (the `tool-bus` `DEPENDENCY_*` → E-ENV precedent: dependency state blocks the operation) |

`validate()` reaches the identical verdict without ever rendering; `build()` and `validate()` never disagree (asserted for every mutation). `E-DEP` (no external API), `E-UNKNOWN` (no unclassified path), and `E-TOOL` (no tool invoked) are unreachable by construction.

## 12. Integration with Module Registry

The bus does **not** import `modules/module-registry/`. The caller (RB-15 does it literally) maps `registry.validateAll()` into §5 rows, and can pass `buildRegistryReport(registry).sha256` as an `artifacts` row — the registry's own report bytes enter as evidence-by-hash, exactly the "Report Bus evidence" pattern of `02` §2. The Report Bus validates the rows and renders them; it never asks the registry for state, and the registry's four manifests (including `report-bus` itself) validate cleanly through the Task 08 validator (RB-02).

## 13. Integration with Tool Bus

The bus does **not** import `modules/tool-bus/`. The caller maps `bus.list()` capability states into §5 rows (RB-16): `AVAILABLE → success`, `UNAVAILABLE|BLOCKED|DISABLED → blocked` (the `03` §5 status/`E-TOOL`-class correspondence) — the four capability states are summarized, never collapsed inside the bus, because the row keeps the exact state as evidence and remaining issues. The Report Bus itself needs no tool: it performs no `check`, no `invoke`.

## 14. Integration with Hotkeys

The bus does **not** import `modules/hotkeys/`, never resolves or executes a hotkey, and never touches the L3 registry. The Task 06 runtime already emits `03` §5 results (`14` §4), so its results pass through **untouched** (RB-17 builds from `runtime.executeHotkey(...)` rows directly): `status` (success/blocked/failed by error class), `phase_ledger` (`RESOLVE:`/`EXECUTE:` lines), `artifacts`, `evidence`, `remaining_issues` (`E_ENV_HANDLER_MISSING: …` flows through verbatim). `buildRuntimeReport(results).sha256` enters as an `artifacts` row the same way as §12. `03` §3 H6 — hotkey execution produces a standard Completion Report through the Report Bus — is satisfied by this path without the bus knowing what a hotkey is.

## 15. Dependency direction

`02` §3 rules 1 and 3: arrows point down; no lateral coupling. The bus's complete import set is `node:crypto` plus its own three `src/` files (asserted in RB-18: every specifier starts with `node:` or `./`, `node:` set is exactly `{node:crypto}`, no `modules/(hotkeys|tool-bus|module-registry)` path appears anywhere in its source). The `01` §11.1 vocabulary (`src/errors.mjs`) and the eight loop phases (`src/catalog.mjs`) are built locally from the Core spec — the same pattern the Module Registry documented for itself — and RB-02 asserts the local copy equals the registry's copy. `consumes: []`: the bus resolves no capabilities, so it cannot become a hidden service locator.

## 16. Security and safety boundaries

- **Reporting only** (Task 09 §10): no hotkey execution, no tool invocation, no handler dispatch, no adapter activation, no registry mutation, no Core-file writes.
- **No execution surface**: no `child_process`, no `eval`/`Function`/`require`/dynamic `import`, no `fs` — building a report reads nothing and runs nothing (RB-18). Inputs are never mutated (RB-18).
- **No volatile or environment data** in output or source: no `Date.now`, `Math.random`, `process.pid`, `process.env`, `process.hrtime`, `new Date` (RB-13).
- **No schema extension**: only registered types/sections/fields are accepted; undeclared fields are refused, so no caller can smuggle unbounded or nondeterministic content into a report (RB-M9).
- **Markdown injection is contained structurally**: cells are single-line by contract and `|` is escaped, so no row can forge a table row or heading.

## 17. Test mapping

Executable with `node --test` from the repo root. File: `test/rb-report-bus.test.mjs` (29 tests, 5 suites). Full suite after Task 09: **131 tests, 24 suites** (the prior 102 untouched and green).

| Id | Scenario → pass criteria |
|---|---|
| RB-01 | entry point loads; exports present; frozen bus with the full method set; entry imports only `node:`/relative |
| RB-02 | manifest validates through the Task 08 registry (all four manifests together); phases/tools/consumes/entry exact; declared errors = raisable subset ⊆ Core seven; 6 failure codes map inside both; local phase list matches the registry's |
| RB-03 | pristine input → `VALID` with `{text, sha256}`; the `result` type builds too; `validate()` agrees and never renders |
| RB-04 | catalogue identities exact (7 sections, 2 types); required/allowed sets per type; repeat builds deeply equal; canonical numbered headings; row-contract exposure |
| RB-05 | control fixture (sections reversed) → byte-identical text and hash; third inline permutation identical; canonical heading order; row order preserved |
| RB-06 | 3 repeated builds + fresh instances → byte-identical text (both types) |
| RB-07 | repeated builds + fresh instances + permutation → one single hash |
| RB-08 | `sha256(text)` recomputed equals `report.sha256`; flipping one byte changes it |
| RB-09 | 10 invalid inputs → `INVALID_INPUT`, `report === null`, `E-INPUT`, violations present, `validate()` identical verdict |
| RB-10 | unknown type / unknown section / disallowed section → exact codes and details; describe surfaces refuse by the same names |
| RB-11 | duplicate `results` (fixture + inline) → `DUPLICATE_SECTION`, `E-CONFLICT`, detail `results`, never merged |
| RB-12 | missing section, missing row field, empty section list (4 named violations in catalogue order), broken `rows` → exact codes; `validate()` ≡ `build()` |
| RB-13 | no ISO timestamps/uuids/pids/machine paths/undefined/volatile field names in output; no volatile APIs in any source file |
| RB-14 | separate `node` process builds the fixture → text and hash byte-identical to in-process |
| RB-15 | real registry (4 manifests registered + enabled) → validateAll rows + registry report sha as artifact → renders; success rows per module; hash covers bytes |
| RB-16 | real Tool Bus (11 capabilities, mixed states) → rows with exact supplied states; unavailable capabilities present as remaining issues; hash covers bytes |
| RB-17 | runtime `executeHotkey` results pass through untouched (§5 schema, `14` §4); success + blocked both rendered; runtime report sha as artifact; real `E_ENV_HANDLER_MISSING` issue carried through |
| RB-18 | source scan: no lateral imports, no executor APIs, no module paths, `node:` = `{node:crypto}`; builds never mutate input |
| RB-19 | sha256 pins of Core `01`–`04` and `12` byte-identical (5/5) |
| RB-20 | the six prior suites run in a subprocess: exit 0, `# fail 0`, pass = tests, ≥ 102 |
| RB-M1…M9 | nine byte-different fixtures, each → its exact code + class + `report === null` + violations containing the code (+ expected detail); `validate()` refuses identically |

**Mutations:** 10 fixtures derived from the pristine `test/_fixtures/rb_report_input.json`, each asserted byte-different before use; `mut_rb_reordered.json` is the determinism control (valid input → byte-identical report); the other 9 fail closed with exact codes (`MISSING_REQUIRED_FIELD` ×2, `DUPLICATE_SECTION`, `INVALID_SECTION` ×2, `DEPENDENCY_ERROR` ×2, `UNKNOWN_REPORT_TYPE`, `INVALID_INPUT`).

## 18. Limitations

- **Truth is the caller's claim.** `03` §5 O1 ("status is never `success` unless Definition of Done passed") and O2 (evidence must be reproducible) cannot be verified by a data-shape validator — the bus refuses *structurally* invalid status/evidence, but it cannot prove a supplied `success` is honest. Enforcement stays with the emitting module and the D1–D10 gate (`01` §12).
- **Presence, not cardinality, is enforced for required sections.** A required section may be present with zero rows (an explicit empty `remaining-issues` is exactly what `01` §12.1 asks for); the bus does not refuse an empty `results` list, because no contract sets a minimum count.
- **No cross-artifact hash verification.** An `artifacts` row's `sha256` is format-checked (64 hex) but not recomputed — the bus is never given the artifact bytes, and fetching them would break the no-`fs`, no-import boundary (§15/§16).
- **Two report types, by contract.** `completion` and `result` are the only types `01`/`02`/`03` define (`Completion Report`, "structured result"). New types require a spec change (`13.6`-style versioned Core change), not code here.
- **No persistence or transport.** The bus returns `{text, sha256}`; writing, sending, or scheduling reports is out of scope (no `fs`, no network — by design).
- **Row order is semantic.** Sections are order-independent; rows are not — two inputs whose rows differ in order are different inputs with different bytes (deliberate: a ledger's chronology survives).

## 19. Future work

- A `consumes`-resolution gate for the Module Registry's referred open question (`16` §10) remains an executive decision — unrelated to this service, which resolves nothing.
- If a future spec defines additional report types (e.g. a blocked-report shape for `02` §4's "fail → E-ENV → blocked report"), they are added to the static catalogue with the same required/allowed discipline — never as runtime registration.
- Optional artifact-hash verification could be added as a *caller-supplied* check function (dependency-injected like the registry's `toolCheck`) without breaking the import boundary, if a future task needs it.
- If multiple reports must be aggregated (a session-level bundle), that is a new type under this contract, not a change to the section model.
