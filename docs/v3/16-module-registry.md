# Grimoire v3 — Module Registry Contract

**Status:** Added Task 08 (L1 Core Service — Module Registry + Contract Validator)
**Scope:** The `REGISTER → VALIDATE → ENABLE → INVOKE` stages of `03` §3, their validation duties, failure semantics, capability resolution, determinism rules, testing contract (MR-01…MR-16), and the known unresolved items. Core `01`–`04`, `12`, and all 18 legacy source files are unchanged.

**Why this exists.** Through Task 07 the repository had two complete module manifests (`hotkeys`, `tool-bus`) and a Tool Bus, but **nothing enforced the VALIDATE stage**: an incomplete manifest could be accepted and nothing refused invocation. Acceptance test **AC-19 [M]** (`05` Group D) requires exactly that refusal. This module implements it.

---

## 1. Purpose and architectural position

The Module Registry is the "Module Registry · Contract Validator" line of the L1 Core Services (`02` §1):

```text
Core (L0)
  ↓ governed by
Core Services (L1):  Module Registry ← this document · Tool Bus (Task 07) · Report Bus · Contract Validator
  ↓ consumed by
Modules (L2):        hotkeys (Task 05/06) · tool-bus (Task 07) · module-registry (self, Task 08)
  ↓ read/execute by declaration only
Assets (L3)
```

It answers: which modules are registered, which are valid, which are enabled, which capabilities each provides, which capability a request resolves to, which tools each module declares and whether they are available, and whether a given invocation is inside the declared contract.

Dependency direction (`02` §3 rule 1): this service never imports a module, never touches Core files, never reads the L3 registry, and never executes module code — manifests are static data (`03` §2 rule M6). Lateral imports are forbidden, so `src/errors.mjs` builds the `01` §11.1 vocabulary locally (five raisable classes; `E-DEP` and `E-UNKNOWN` are never raisable here — no external service is called and no user code runs inside the registry).

Self-declaration: `modules/module-registry/manifest.yaml` is a manifest of its own schema and is validated by its own validator (tested — no circular trust).

## 2. Interface

`createModuleRegistry({ toolBus?, availableTools? })` returns a frozen object; malformed configuration throws `E_INPUT_INVALID_REGISTRY_CONFIG` at construction (no registry exists ⇒ nothing can be enabled or invoked, `01` §13.5):

| Method | Lifecycle stage | Semantics |
|---|---|---|
| `register(manifestText)` | REGISTER | accept a submission; unusable document (no string id) → `MANIFEST_INVALID`; existing id → `MODULE_DUPLICATE`. Schema violations do **not** block registration — VALIDATE is where they are named (`03` §3). |
| `validate(id)` | VALIDATE | run the four duties (§3) → `{ok, code, violations}` |
| `validateAll()` | VALIDATE | every module, registration order; one dirty module fails the aggregate |
| `enable(id)` | ENABLE | conflict check first (specific rule named), then validation; exposes `provides` |
| `disable(id)` | DISABLE | removes capability exposure; refuses when not enabled |
| `canInvoke(id, {phase, tools})` | INVOKE gate | `03` §3 L2: declared phases and tools only — refused *before* anything could run |
| `resolveCapability(providesId)` | ENABLE surface | registry-mediated contact (`02` §3 rule 3): exactly-one-enabled-provider, else fail |
| `has(id)` / `isEnabled(id)` | — | exact membership (string-keyed; no fuzzy/alias lookup) |
| `describe(id)` / `list()` | — | full descriptors with **live** violations; `list()` in registration order |
| `checkTool(token)` | — | the availability checker VALIDATE/INVOKE use (bus-first, then legacy list) |
| `buildRegistryReport(registry)` | REPORT-facing | deterministic `{text, sha256}` audit (§7) |

## 3. Validation behavior (the four VALIDATE duties, in `03` §3 order)

1. **Schema** — `03` §2's thirteen fields are all mandatory; violations name the field or rule: `missing_<field>`, `invalid_id` (strict kebab-case), `invalid_version` (semver), `invalid_core_range`/`core_version_mismatch`, `invalid_name/purpose/entry`, `phases ⊆ 01 §3's eight` (`invalid_phases`, `invalid_phase`; a module that hooks no phase cannot participate in the loop, `03` §1), `requires.tools` present (`invalid_requires`/`invalid_tools`), `provides/consumes/conflicts/outputs` string arrays, `errors ⊆ 01 §11.1's seven` (`invalid_error_class`, M5), `unknown_field`/`duplicate_field`/`manifest_unsupported_syntax` (field set is normative, M6).
2. **Version range** — `core` must match the documented `>=X.Y <A.B` form and must accept the running Core (3.0): `core_version_mismatch` (`01` §13.6).
3. **Conflicts** — `03` §2 defines conflicts as ids that "must not be simultaneously enabled", so the check runs in **both** directions against currently enabled modules → `conflict_enabled`.
4. **Tool availability** — each `requires.tools` token is checked through the injected checker → `tool_unavailable`. When a Tool Bus is wired (Task 07), `toolBus.check(token)` is used — the exact same contract the hotkeys runtime consumes; otherwise the legacy `availableTools` list (default `["files"]`, mirroring the hotkeys module's documented default).

The parser is a strict YAML **subset** (comments, quoted/bare scalars, block/flow arrays, one nested mapping for `requires`) with zero external dependencies (`01` §4.11); anything outside it is `manifest_unsupported_syntax` — never guessed, never repaired.

## 4. Execution flow (how the gate runs)

```text
manifestText → register → records map (submission accepted)
      ↓
validate(id): parse violations + four duties → {ok, violations}
      ↓ must be clean ("nothing runs until clean", 03 §3)
enable(id): conflicts (both directions) → validation → mark enabled, expose provides
      ↓
resolveCapability(cap): 0 enabled providers → UNRESOLVED · 1 → that module · ≥2 → AMBIGUOUS
canInvoke(id, {phase, tools}): input shape → known? → valid? → enabled?
      → phase declared? → requested tools declared (M3)? → declared tools available (belt)
      ↓ all pass
invocation proceeds elsewhere (this registry never executes anything itself)
```

## 5. Failure semantics

One taxonomy (`01` §11.1 Core classes only). Every refusal is `{ok:false, code, error:{class, code, message, detail}}` (+ `violations` where the VALIDATE stage named them) — never a silent fall-through, never a substitute module:

| Code | Class | Stage | Trigger |
|---|---|---|---|
| `MR_OK` | — (success) | any | the stage passed |
| `MANIFEST_INVALID` | E-VALID | VALIDATE/ENABLE/INVOKE | schema/range/conflict/tool duty failed; unusable document at register; AC-19 refusal |
| `MODULE_DUPLICATE` | E-CONFLICT | REGISTER | id already registered (never overwrites) |
| `MODULE_NOT_FOUND` | E-INPUT | every surface | exact id not registered |
| `INVALID_INVOCATION` | E-INPUT | register/canInvoke/resolve | malformed input shape (checked first) |
| `CONFLICT_MODULE_ENABLED` | E-CONFLICT | ENABLE | conflict with an enabled module, either direction — named **before** the generic validation failure so the specific rule is reported (`01` §13.5) |
| `MODULE_ALREADY_ENABLED` | E-CONFLICT | ENABLE | repeated enable (refused, not a silent no-op) |
| `MODULE_NOT_ENABLED` | E-ENV | DISABLE/INVOKE | lifecycle state does not allow the operation |
| `PHASE_NOT_DECLARED` | E-CONFLICT | INVOKE | invocation outside declared phases (`03` §3 L2) |
| `TOOL_UNDECLARED` | E-CONFLICT | INVOKE | requested tool not in `requires.tools` (M3: undeclared tool use) |
| `TOOL_UNAVAILABLE` | E-TOOL | INVOKE (belt) | declared tool lost availability — defense-in-depth; unreachable while tool state is consistent with VALIDATE (same pattern as the runtime's defense-in-depth branches) |
| `CAPABILITY_UNRESOLVED` | E-ENV | resolve | no enabled module provides the capability |
| `CAPABILITY_AMBIGUOUS` | E-CONFLICT | resolve | ≥2 enabled providers — never silently picks a side |

## 6. Determinism

Same manifests + same enablement + same tool state ⇒ identical validation results, identical refusal codes, byte-identical reports. No timestamps, no random/pid values, no machine paths in outputs (manifest `entry` values are repository-relative by schema), registration order for `list()`/`validateAll()`, report rows sorted `localeCompare(b, "en", {numeric: true})` (the convention of `report.mjs`/`bus.mjs`). One registry instance = one set of submissions; no hidden global state.

## 7. Report

`buildRegistryReport(registry)` → `{text, sha256}` (sha256 of its own bytes), five sections: **1 Summary** (registered/valid/invalid/enabled/violations), **2 Modules** (id, version, core, enabled, phases, tools, provides, consumes, violations), **3 Violations** (module → code → detail), **4 Capabilities** (capability → enabled providers → RESOLVED/UNRESOLVED/AMBIGUOUS), **5 Declared tools** (tool → available yes/no → declaring modules). A dirty registry states `| Valid | n |` and lists its violations rather than pretending success.

## 8. Testing contract (MR-01…MR-16)

Executable with `node --test` from the repo root. File: `test/mr-registry.test.mjs` (19 tests, 4 suites). Full suite after Task 08: **102 tests, 19 suites** (the prior 83 untouched and green).

| Id | Scenario → pass criteria |
|---|---|
| MR-01 | the three real manifests register; descriptors complete; self-manifest validates itself |
| MR-02 | duplicate id → `MODULE_DUPLICATE`; original intact; independent registries unaffected |
| MR-03 | non-string / unparseable / id-less / non-string-id documents → named refusals; nothing registered |
| MR-04 | unknown id → `MODULE_NOT_FOUND` on validate/enable/disable/canInvoke/describe; bad input shape checked first |
| MR-05 | `validateAll` clean on all real inputs; repeated calls deep-equal |
| MR-06 | 20 field-rule cases each produce their exact violation at validate **and** enable; clean baseline passes |
| MR-07 | enable exposes provides; double-enable/double-disable refused; disable removes exposure; re-enable works |
| MR-08 | conflict with an enabled module: `conflict_enabled` in validate, `CONFLICT_MODULE_ENABLED` at enable, both directions, live state |
| MR-09 | resolve: UNRESOLVED → RESOLVED when enabled → AMBIGUOUS with two providers (never picks a side) → RESOLVED after disabling one |
| MR-10 | canInvoke: happy paths; `PHASE_NOT_DECLARED`; `TOOL_UNDECLARED`; 8 malformed input shapes → `INVALID_INVOCATION`; `MODULE_NOT_ENABLED` after disable |
| MR-11 | unavailable tool (`search providers` via pristine bus) → `tool_unavailable` → validate/enable/invoke all refuse; never enabled; contrast case passes |
| MR-12 | bad `toolBus`/`availableTools` config throws at construction; legacy default path still fails closed on a missing tool |
| MR-13 | equal state ⇒ deep-equal results; reports byte-identical across rebuilds and fresh registries; sha256 of own bytes; no timestamps/uuids; dirty report states the failure |
| MR-14 | **AC-19**: incomplete manifest accepted at REGISTER, `missing_requires` + `missing_errors` at VALIDATE, refused at ENABLE and INVOKE, never enabled, provides never resolvable |
| MR-15/1…4 | four byte-different mutations: non-loop phase, non-Core error class, incompatible core range, colliding id — each refuses with its exact code |
| MR-16 | export surface, parser (real/garbage/non-string), standalone `validateManifest`, both conflict directions, empty-registry report, `RESULT_CODES ⊆` declared classes `⊆` Core seven |

**Mutations:** 5 fixtures in `test/_fixtures/mut_manifest_*.yaml`, each asserted byte-different from the pristine `modules/hotkeys/manifest.yaml` before it is trusted; 5/5 fail closed.

## 9. Protected dependencies and preserved behavior

- Core `01`–`04` and `12-hotkey-registry.md`: byte-unchanged (pins re-verified); 18 legacy source files unchanged (HKC-17).
- Task 05/06/07 modules and tests: untouched and green (83/83 still pass).
- The only existing files modified by Task 08: `docs/v3/05-acceptance-tests.md` (Group L **appended**, Groups A–K untouched) and `README.md` (index rows 20–22 added).

## 10. Known limitations and unresolved items

- **No REPORT stage.** `03` §3's REPORT stage (the Report Bus: collecting `03` §5 structured results into a Completion Report) is a separate L1 service and is **not** implemented here; the registry only exposes REPORT-facing state.
- **Unresolved `consumes` has no normative gate.** `03` §3's VALIDATE duties do not include resolving `consumes`, so the registry reports resolution state (`resolveCapability`) but does not refuse on an unmet consume. Whether an unmet consume should block ENABLE is referred to the executive owner as a future-task question — it does not block Task 08 (§10 of the Task 08 report).
- **`entry` existence is not checked** — no contract rule requires it (and `modules/hotkeys/manifest.yaml` points at a not-yet-created `index.mjs`, pre-existing Task 05 state, untouched here).
- **No enablement persistence** — enable/disable state lives on the instance; re-creating a registry starts from registrations only.
- **The parser is a YAML subset** by design; a manifest using unsupported YAML features fails closed with `manifest_unsupported_syntax` rather than being partially honored.
