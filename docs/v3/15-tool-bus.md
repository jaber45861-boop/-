# Grimoire v3 — Tool Bus Contract

**Status:** Added Task 07 (L1 Core Service — capability integration layer)
**Scope:** The Tool Bus contract (`modules/tool-bus/`), its capability model, resolution flow, validation, dependency handling, provider model, adapter interaction, failure semantics, determinism rules, security boundaries, testing contract (TB-01…TB-24), and extension rules. Core `01`–`04`, `12`, and all 18 legacy source files are unchanged.

**Why this exists.** Through Task 06, "tools" were a bare `availableTools` string array checked against registry/handler tokens. The Tool Bus turns that into an explicit boundary: capabilities are *declared*, *validated*, *resolvable*, *invocable*, *fail-closed*, *deterministic*, *auditable*, and *testable* — without implementing arbitrary hotkey behavior and without inventing any capability.

---

## 1. Purpose

The Tool Bus is the controlled boundary between Core Services and the capabilities/adapters that modules use:

```text
Core
  ↓
Core Services (L1)
  ↓
Tool Bus                     ← this document
  ↓
registered capabilities / providers (incl. adapters)
  ↓
Hotkey Runtime (L2)
```

It answers exactly eight questions, all machine-testable via the report (§14): which capabilities are registered, valid, available, blocked, disabled; which dependencies are missing; which providers exist; which hotkeys depend on unavailable capabilities.

It does **not**: redesign Core; modify `01`–`04` or `12`; activate any registry record; implement external adapters; execute search/browser/deployment behavior; or provide a substitute capability.

## 2. Position in architecture

Per `02` §1/§3 the bus is an L1 Core Service; dependency direction is strictly downward: L2 modules (e.g. `modules/hotkeys`) consume this service, and the bus never imports a module, never reads Core files, and never reads the L3 registry (`12`). Its manifest (`modules/tool-bus/manifest.yaml`, schema `03` §2) declares `phases: [RUN]`, `requires.tools: [files]`, `provides: [toolbus:capabilities]`, `outputs: [tool-bus-report]`, `errors: [E-INPUT, E-ENV, E-CONFLICT, E-TOOL, E-VALID, E-UNKNOWN]`, entry `modules/tool-bus/src/bus.mjs`.

Because lateral module-to-module imports are forbidden, `modules/tool-bus/src/errors.mjs` constructs the `01` §11.1 vocabulary locally (same seven Core classes, no second taxonomy). `E-DEP` is never raisable here: the bus calls no external API/service — it only resolves declarations and dispatches to in-process providers.

## 3. Contract

`createToolBus({ declarationText, providers?, root? })` returns a frozen object exposing the directive §Phase-2 contract (naming follows repository conventions):

| Method | Semantics |
|---|---|
| `register(capability)` | add a runtime capability; invalid shape → `CAPABILITY_INVALID` + violations; duplicate id → `CAPABILITY_DUPLICATE` |
| `registerProvider(provider)` | bind `{id, invoke, purpose?}`; malformed → `CAPABILITY_INVALID`; duplicate → `PROVIDER_DUPLICATE` |
| `validate(capability)` | pure registration check → `{ok, code, violations}` — never mutates |
| `has(id)` | exact membership; `false` whenever declarations are invalid |
| `resolve(id)` | lookup + validated descriptor, **no execution** |
| `check(id)` | preflight: validation → status gate → dependency gate (what the runtime asks) |
| `invoke(id, input)` | preflight → input validation → provider → structured output |
| `describe(id)` | full descriptor incl. provider binding state (`providerRegistered`) |
| `list()` | all validated capabilities, declaration order; `[]` when invalid |
| `listProviders()` | declared providers + bound state, id-sorted |
| `validation`, `root` | frozen validation result (`ok`, `violations`, `meta.sha256`, `meta.declared`) and the root scope |

Plus the module-level report builder `buildToolBusReport(bus, hotkeyRows?)` → `{text, sha256}` (§14). A malformed configuration (non-string `declarationText`, non-object `providers`, empty `root`) throws at construction — no bus exists, therefore nothing can execute (`01` §13.5).

## 4. Capability model

Every capability has exactly nine declared fields — the descriptor adds `providerRegistered` and `invoke` (the provider id through which dispatch would occur, or `null`):

```text
id  version  purpose  status  input  output  requires  provider  errors
```

- `id` — exact string identity (may contain spaces/backticks; registry tool tokens are taken verbatim).
- `version` — `major.minor.patch`.
- `status` — one of exactly four, **never collapsed**:
  - `AVAILABLE` — declared *and* provider-bound; invocation allowed (subject to dependencies and input).
  - `UNAVAILABLE` — declared, but no implementation exists in this environment → refuses `TOOL_UNAVAILABLE`. A missing tool ≠ a disabled tool.
  - `BLOCKED` — an external, undeclared-here condition governs it (an inactive `12` §4 adapter) → refuses `TOOL_BLOCKED`. Blocked ≠ unavailable.
  - `DISABLED` — explicitly turned off while remaining declared → refuses `TOOL_DISABLED`. Not present in the pristine set; exercised by mutation TB-21.
- `input`/`output` — minimal schemas; `input.type ∈ {object, none}`, `required ⊆ properties`, property types ∈ `{string, number, boolean, object, array}`.
- `requires` — capability ids that must themselves be registered **and** `AVAILABLE` (§8).
- `provider` — declared provider id or `null`; declaration and binding are both required (§9).
- `errors` — the `01` §11.1 classes this capability can raise.

## 5. Lifecycle

```text
declarations file → parse → shape + cross validation (all-or-nothing)
      → provider binding (declared ∩ bound) → register/registerProvider at runtime
      → check/invoke per call → report
```

Validation is **all-or-nothing**: any violation (parse error, shape error, `capability_duplicate`, `provider_duplicate`, `declared_count_mismatch`, `available_requires_provider`, …) makes `validation.ok === false`, which turns `has()` false everywhere, `list()` into `[]`, and every `resolve/check/invoke/describe` into a `CAPABILITY_INVALID` (`E-VALID`) refusal — including for individually untouched capabilities (TB-24). The bus never silently repairs a declaration.

## 6. Resolution flow

```text
capability ID
      ↓  exact Map membership — no fuzzy, no case-folding, no alias, no fallback
registry lookup (validation.ok must be true)
      ↓
availability check (status gate: UNAVAILABLE/BLOCKED/DISABLED refuse)
      ↓
dependency check (each `requires` id registered + AVAILABLE)
      ↓
input validation (schema; failure → INPUT_INVALID before any provider call)
      ↓
provider resolution (declared id ∩ bound implementation; missing → PROVIDER_MISSING)
      ↓
invocation (throw → classified PROVIDER_FAILURE)
```

`resolve`/`describe`/`list` intentionally run only the lookup stage so they can always show a capability's *true state*; the availability/dependency gates run in `check` and `invoke`.

## 7. Validation

`validate(candidate)` and declaration loading share one shape check (`validateCapabilityShape`): non-empty string `id`, semver `version`, non-empty `purpose`, status ∈ the four, valid `input`/`output` schemas, `requires` an array of non-empty strings, `provider` a string or `null`, `errors` an array of Core class names. Cross-checks at load: duplicate ids (capability and provider), `available_requires_provider` (an `AVAILABLE` capability must declare a provider), and `declared` count vs. actual (`declared_count_mismatch`). Input validation at invoke time is separate (`INPUT_INVALID`, §12) and runs *before* the provider, so a provider never sees malformed input (TB-12).

## 8. Dependency handling

Each `requires` entry is evaluated at `check`/`invoke` time: not registered → `DEPENDENCY_MISSING` (`E-ENV`); registered but not `AVAILABLE` → `DEPENDENCY_BLOCKED` (`E-CONFLICT`). A capability therefore cannot execute on top of a missing or degraded dependency, and the report's §4 lists every such problem. Dependencies are capability ids on this bus only — the bus has no transitive cross-module dependency graph.

## 9. Provider model

Identities live in the declaration file; implementations live in code (`createDefaultProviders()` or `registerProvider`). A provider executes only when its id is **declared and bound** — removing either side fails closed (TB-22). A bound provider receives `(input, { root, capability })` and returns its output; it never chooses its own capability. Provider exceptions are classified by `classifyProviderError` (§12): `ENOENT` → `E-ENV`/`E_ENV_MISSING_FILE`, filesystem-permission/dir errors → `E-TOOL`/`E_TOOL_READ_FAILED`, everything else → `E-UNKNOWN`/`E_UNKNOWN_EXCEPTION`. The pristine set has exactly one provider:

| Provider | Bound | Behavior |
|---|---|---|
| `local-files` | yes | reads a repository-relative document inside `root` (containment-checked, §16) and returns `{file, bytes, lines, sha256, content}` |

## 10. Adapter interaction

The ten `12` §4 adapter declarations remain authoritative and are **not duplicated**: `capabilities.json` only *references* their ids. Eight registry tool tokens (`browser tool`, `external link`, `code interpreter`, `Netlify GPT action`, `Netlify Drop (…)`, `Replit \`createRepl\` action`, `Twitter/X`, `Xcode export operation`) are declared `BLOCKED` with `provider: grimoire.adapter.<id>`; because no `grimoire.adapter.*` implementation is ever fabricated or bound, the status gate refuses `TOOL_BLOCKED` *before* provider lookup. `Netlify Drop` (record NM, no adapter declared) is `UNAVAILABLE`. Adapters `grimoire.adapter.V` and `grimoire.adapter.PDF` produce no capability rows because no registry Tools cell references them — a capability exists only when a registry/manifest declaration supports it (directive §Do NOT INVENT CAPABILITIES). Activating an adapter in a future task means binding a real provider through `registerProvider`; nothing else changes.

## 11. Capability inventory (pristine state)

11 capabilities, one per authoritative tool token plus `files` (declared by `modules/hotkeys/manifest.yaml` `requires.tools`). Declarations sha256: `41c967a1c6f914101357148939c2795ef091ba907595a1a677896dfaaedcbe7a`.

| Id | Status | Provider | Bound |
|---|---|---|---|
| `files` | AVAILABLE | `local-files` | yes |
| `search providers` | UNAVAILABLE | — | — |
| `browser tool` | BLOCKED | `grimoire.adapter.B` | no |
| `external link` | BLOCKED | `grimoire.adapter.KT` | no |
| `code interpreter` | BLOCKED | `grimoire.adapter.J` | no |
| `Netlify GPT action` | BLOCKED | `grimoire.adapter.N` | no |
| `Netlify Drop (\`https://app.netlify.com/drop\`)` | BLOCKED | `grimoire.adapter.ND` | no |
| `Replit \`createRepl\` action` | BLOCKED | `grimoire.adapter.REPL` | no |
| `Twitter/X` | BLOCKED | `grimoire.adapter.L` | no |
| `Xcode export operation` | BLOCKED | `grimoire.adapter.XC` | no |
| `Netlify Drop` | UNAVAILABLE | — | — |

Counts: AVAILABLE 1 · UNAVAILABLE 2 · BLOCKED 8 · DISABLED 0 · declared providers 1 (`local-files`, bound).

## 12. Failure semantics

Every refusal is a deterministic structured result `{ok: false, code, error: {class, code, message, detail}, capability, provider: null, output: null}` — never a silent fall-through, never an undeclared substitute. One taxonomy: `01` §11.1 Core classes only.

| Code | Class | Trigger | Recovery |
|---|---|---|---|
| `TB_OK` | — (success) | check passed / provider executed | none needed |
| `CAPABILITY_INVALID` | E-VALID | declaration shape/duplicate violation, or declarations document invalid | fix the declarations; every lookup refuses meanwhile |
| `CAPABILITY_DUPLICATE` / `PROVIDER_DUPLICATE` | E-CONFLICT | `register`/`registerProvider` on an existing id | pick a distinct id; never auto-renamed |
| `TOOL_NOT_FOUND` | E-INPUT | exact id not registered (or declarations invalid at lookup) | use a registered id; no fuzzy/alias search |
| `TOOL_UNAVAILABLE` | E-TOOL | status `UNAVAILABLE` | provide an implementation; never a silent no-op (`03` §4 H5) |
| `TOOL_BLOCKED` | E-CONFLICT | status `BLOCKED` (inactive adapter) | executive ruling / adapter activation |
| `TOOL_DISABLED` | E-CONFLICT | status `DISABLED` | re-enable by declaration, not at call time |
| `DEPENDENCY_MISSING` | E-ENV | `requires` id not registered | register the dependency |
| `DEPENDENCY_BLOCKED` | E-CONFLICT | `requires` id not `AVAILABLE` | make the dependency available first |
| `INPUT_INVALID` | E-INPUT | input fails the capability schema (pre-provider) | fix the call input |
| `PROVIDER_MISSING` | E-ENV | declared provider not bound | bind via `registerProvider` or correct the declaration |
| `PROVIDER_FAILURE` | classified | provider threw (`E-ENV`/`E-TOOL`/`E-UNKNOWN` per `classifyProviderError`) | fix per the classified cause; no artifact returned |

All nine directive-required error names are present: `TOOL_NOT_FOUND`, `TOOL_UNAVAILABLE`, `TOOL_BLOCKED`, `TOOL_DISABLED`, `DEPENDENCY_MISSING`, `CAPABILITY_INVALID`, `INPUT_INVALID`, `PROVIDER_MISSING`, `PROVIDER_FAILURE` (plus `DEPENDENCY_BLOCKED`, `CAPABILITY_DUPLICATE`, `PROVIDER_DUPLICATE`).

## 13. Hotkey runtime integration

The runtime asks the bus one question — *are the required capabilities available?* — and only where necessary:

- `createRuntime({ …, toolBus? })` accepts an optional bus; anything not exposing `check(capabilityId)` throws `E_INPUT_INVALID_RUNTIME_CONFIG` (fail closed at construction). Without a bus, the legacy `availableTools` path is byte-for-byte unchanged (Groups I/J stay green).
- `gateTools` runs at resolution step 6 (record's `12` §2 Tools cell) and step 9 (handler `requiredTools`) with **exact id** checks — no substitute capability is ever consulted (TB-19). A handler that requires no tools never consults the bus, so the bus is never an artificial blocker (TB-17).
- Bus refusals map onto the existing runtime vocabulary (three new codes, all in already-declared classes; no new Core class):

| Bus code | Runtime classification | Runtime code | Class |
|---|---|---|---|
| `TOOL_NOT_FOUND` / `TOOL_UNAVAILABLE` / `DEPENDENCY_MISSING` | `TOOL_REQUIRED` | `E_TOOL_UNAVAILABLE` | E-TOOL |
| `TOOL_BLOCKED` / `DEPENDENCY_BLOCKED` | `TOOL_REQUIRED` | `E_CONFLICT_DEPENDENCY_BLOCKED` | E-CONFLICT |
| `TOOL_DISABLED` | `TOOL_REQUIRED` | `E_CONFLICT_TOOL_DISABLED` | E-CONFLICT |
| `CAPABILITY_INVALID` | `REFUSED` | `E_VALID_CAPABILITY_INVALID` | E-VALID |

`modules/hotkeys/src/dependencies.mjs` derives the deterministic dependency report: for each of the 14 ACTIVE records it unions the record's Tools cell with the handler's `requiredTools` and resolves each token on the bus. Row outcomes — `READY` / `TOOL_REQUIRED` / `DEPENDENCY_BLOCKED` / `VALIDATION_ERROR` — keep the per-tool bus codes; precedence is `VALIDATION_ERROR > DEPENDENCY_BLOCKED > TOOL_REQUIRED > READY`. Pristine split: 13 `READY`, 1 `TOOL_REQUIRED` (`SoS` → `search providers`). `SoS` stays `TOOL_REQUIRED` with an honest explanation; no search execution is fabricated (TB-18). The registry status of every record is untouched: `registration ≠ activation` still holds.

## 14. Reporting

`buildToolBusReport(bus, hotkeyRows?)` → `{text, sha256}` (sha256 of its own bytes). Five sections: **1 Summary** (declarations sha256, valid, violations, capability/status counts, provider counts), **2 Capabilities** (id, version, status, provider, provider-registered, requires — id-sorted), **3 Providers** (declared ∪ referenced, bound state), **4 Missing dependencies** (`DEPENDENCY_MISSING` / `DEPENDENCY_BLOCKED` / `PROVIDER_MISSING` problems), **5 Hotkey dependencies** (the caller-supplied rows — the bus never imports a module, so the L2 consumer computes them and passes them in). No volatile data; identical state → byte-identical report (TB-14).

## 15. Determinism

Same declarations + providers + input + root ⇒ equivalent resolution, validation result, error class, and report bytes. The bus contains no timestamps, no random/process ids, no machine-specific paths in outputs, and no unordered iteration: capability maps preserve declaration order; report rows sort with `localeCompare("en", {numeric: true})` (the repository convention from the hotkeys report); frozen results cannot drift between calls (TB-13/TB-14). One bus instance = one declaration snapshot; re-reading declarations means building a new bus.

## 16. Security boundaries

- **Root containment:** `local-files` resolves `path.resolve(root, input.file)` and refuses anything escaping `root` (`EACCES` → classified `E-TOOL/E_TOOL_READ_FAILED`); a missing file is `E-ENV/E_ENV_MISSING_FILE`. No absolute or `..` traversal out of the repository.
- **No execution without gates:** `invoke` always runs validation → status → dependencies → input first; refusals carry `output: null` — no half-executed results.
- **No fabricated capabilities:** adapter providers (`grimoire.adapter.*`) are never bound by default; `BLOCKED` capabilities cannot reach a provider.
- **No ambient authority:** the bus performs no network access, spawns nothing, and reads nothing outside `root` through its provider; error details carry relative labels, never machine-local paths.
- **Fail-closed configuration:** malformed declarations or configuration throw/refuse before any dispatch (`01` §13.5).

## 17. Testing contract (TB-01…TB-24)

Executable with `node --test` from the repo root. Files: `test/tb-bus.test.mjs` (19 tests, 3 suites — TB-01…TB-14, TB-20…TB-24) and `test/tb-runtime.test.mjs` (6 tests, 1 suite — TB-15…TB-19 + an invalid-capability runtime check). Full suite after Task 07: **83 tests, 15 suites** (58 prior tests untouched and green).

| Id | Contract | Scenario → pass criteria |
|---|---|---|
| TB-01 | register | valid capability registers → `TB_OK`, `has` true, `resolve` returns the full descriptor, appears in `list` |
| TB-02 | duplicate | duplicate id → `CAPABILITY_DUPLICATE` fail-closed, original untouched |
| TB-03 | schema | invalid capability → `CAPABILITY_INVALID` with exact violations, never registered |
| TB-04 | unknown | unknown id → `has` false, `resolve` `TOOL_NOT_FOUND`, no alias/fuzzy hit |
| TB-05 | unavailable | `UNAVAILABLE` → `check`/`invoke` refuse `TOOL_UNAVAILABLE` (E-TOOL), `output: null` |
| TB-06 | blocked | `BLOCKED` → refuse `TOOL_BLOCKED` (E-CONFLICT) |
| TB-07 | disabled | `DISABLED` → refuse `TOOL_DISABLED`; distinct code from TB-05 (missing ≠ disabled) |
| TB-08 | dependency | `requires` unregistered → `DEPENDENCY_MISSING` (E-ENV); registered-but-not-AVAILABLE → `DEPENDENCY_BLOCKED` |
| TB-09 | provider | declared provider not bound → `PROVIDER_MISSING` (E-ENV) before any execution |
| TB-10 | success | bound provider executes → `TB_OK` with structured output |
| TB-11 | failure | provider throws → `PROVIDER_FAILURE` with classified error (`E-ENV`/`E-TOOL`/`E-UNKNOWN`), rerun byte-identical |
| TB-12 | input | invalid input → `INPUT_INVALID` before provider (spy never runs) |
| TB-13 | determinism | repeated `resolve`/`check` → equivalent structured results |
| TB-14 | report | repeated reports byte-identical, sha256 of own bytes, states all counts/sections, no volatile data |
| TB-15 | runtime | handler requiring an unavailable capability → `TOOL_REQUIRED` / `E_TOOL_UNAVAILABLE`, handler never runs |
| TB-16 | runtime | `BLOCKED` capability in the chain → `TOOL_REQUIRED` / `E_CONFLICT_DEPENDENCY_BLOCKED` |
| TB-17 | runtime | no-tool hotkey executes with a bus wired — bus is not an artificial blocker |
| TB-18 | runtime | `SoS` stays `TOOL_REQUIRED` while the search provider is absent; no search faked |
| TB-19 | runtime | refusals never dispatch a substitute/fallback capability (spy run 0) |
| TB-20…24 | mutations | the five byte-different mutation fixtures below, each fail-closed |

**TB-20…TB-24 — the five capability mutations** (each fixture asserted byte-different from `capabilities.json` before trust):

| # | Fixture | Mutation | Fail-closed evidence |
|---|---|---|---|
| TB-20 | `tb_missing_capability.json` | remove `search providers` | `validation.ok` true (valid document) but `has` false, `resolve`/`check`/`invoke` → `TOOL_NOT_FOUND` |
| TB-21 | `tb_status_altered.json` | `files` → `DISABLED` | `resolve` shows `DISABLED`; `invoke` → `TOOL_DISABLED` (E-CONFLICT), never executes |
| TB-22 | `tb_provider_removed.json` | remove the provider declaration | still `AVAILABLE`-declared but `providerRegistered` false; `invoke` → `PROVIDER_MISSING` |
| TB-23 | `tb_dependency_altered.json` | `files.requires` → `["ghost-dependency"]` | schema-valid but `invoke`/`check` → `DEPENDENCY_MISSING` (E-ENV, detail `ghost-dependency`) |
| TB-24 | `tb_duplicate_capability.json` | duplicate `files` | `validation.ok` false, `capability_duplicate` violation, `list()` empty, every lookup → `CAPABILITY_INVALID`, report states `Valid \| false` |

**Task 07 release gate:** `node --test` = 83/83 pass (15 suites, 0 skipped); TB-01…TB-24 all covered by a named executable test; 5/5 mutations fail closed with byte-different fixtures asserted; reports byte-stable across rebuilds; capability states never collapsed (4 distinct statuses observable); Core `01`–`04` byte-unchanged; `12` byte-unchanged; source 18/18; Groups I/J (58 tests) still pass; git state reported with remote SHA verified.

## 18. Extension rules

1. A capability may be added only from an authoritative source: a `12` §2 Tools token, a manifest `requires.tools` entry, a `12` §4 adapter declaration, or an actual executable implementation (directive §Do NOT INVENT CAPABILITIES).
2. Declare all nine fields honestly; `status` must reflect reality — never mark `AVAILABLE` without a bound provider (`available_requires_provider` enforces this).
3. Bind providers only through `registerProvider` (in-process code) — never fabricate `grimoire.adapter.*` implementations; adapter activation is an executive/adapter task, not a bus task.
4. Exact ids only: no aliases, no case normalization, no fuzzy matching, no fallback dispatch — if a token must change, change the authoritative registry (protected) via its own process, not the bus.
5. New failure modes get a code mapped into an existing `01` §11.1 class; a second error taxonomy is forbidden.
6. Every new capability/status/dependency path needs a named TB test and, if it alters declarations, the declaration sha256 in §11 must be updated.

## 19. Known limitations

- **One real provider.** Only `files`/`local-files` executes anything. `search providers` and `Netlify Drop` are `UNAVAILABLE`; the eight adapter-backed capabilities are `BLOCKED` — all honest refusals, not workarounds.
- **No adapter is activated.** Binding any `grimoire.adapter.*` provider is out of scope for Task 07 (they remain `NOT_ACTIVATED` in `12` §4).
- **`DISABLED` is unused in the pristine set** — exercised only by mutation TB-21; no registry record maps to it.
- **No invocation log/persistence:** results are returned to the caller; only `buildToolBusReport` serializes state, deterministically.
- **10 of 14 ACTIVE hotkeys remain `UNIMPLEMENTED`** (unchanged from Task 06, `14` §9) — the bus gates tools, it does not invent handler behavior.
- **One declaration snapshot per bus instance**; no hot reload.
