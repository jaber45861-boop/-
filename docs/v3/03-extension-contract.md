# Grimoire v3 — Extension Contract

**Status:** Draft for executive review (Task 01)
**Scope:** The exact rules a future module MUST follow to add a capability to Grimoire v3. Nothing in this document is implemented now; it is normative for all future modules (Task 02+).

Companion documents: `01-core-specification.md` §13, `02-architecture-map.md` §3.

---

## 1. What a Module Is

A **module** is a self-contained capability package that registers with the Core to participate in the execution loop. Examples (future, not built here): Hotkeys, Learning, Curriculum, Deployment, Git, Image-to-code, Agents, Memory, Project management, Research, Code review, Architecture, Integrations.

**Anti-goals:** a module is NOT a fork of the Core, an alternate workflow, or a bundle of undeclared side effects.

---

## 2. The Module Manifest (required)

Every module MUST ship a manifest. All fields are mandatory unless marked optional. An incomplete manifest fails closed (13.5) — the module does not run.

```yaml
# manifest schema (illustrative — field set is normative)
id: "deploy"                    # unique, kebab-case, no collision with existing ids
version: "1.0.0"                # semver of the module
core: ">=3.0 <4.0"              # Core contract version range targeted (13.6)
name: "Deployment"              # human label
purpose: "Ship verified builds to an environment."  # one sentence: what and why
phases:                         # loop phases this module hooks (01 §3)
  - SHIP
requires:                       # tool requirements (01 §10.1); [] if none
  tools: ["terminal", "hosting-api"]
provides:                       # capabilities offered to the registry (02 §3 rule 3)
  - "deploy:release"
consumes:                       # capabilities requested; resolved via registry, never
  - "git:diff"                  #   by reaching into another module
conflicts: []                   # module ids that must not be simultaneously enabled
outputs:                        # artifacts this module produces (Report Bus)
  - "deploy-record"             #   (deployment id, environment, commit)
errors:                         # error classes it can raise (01 §11.1)
  - E-ENV
  - E-DEP
entry: "modules/deploy/index.ts" # implementation entrypoint
```

**Manifest rules:**

- M1. `purpose` MUST state observable behavior, not intent fluff ("Ship verified builds", not "Make deploys amazing").
- M2. `phases` MUST be a subset of the eight loop phases; a module MUST NOT add, remove, or reorder phases.
- M3. `requires.tools` MUST list every tool touched. Undeclared tool use is a contract violation, enforced by VALIDATE (AC-19, AC-20).
- M4. `provides` / `consumes` are the ONLY module-to-module contact surface (02 §3 rule 3).
- M5. `errors` MUST be a subset of the Core error classes; new failure modes require choosing the closest Core class.
- M6. The manifest MUST be static data — no logic evaluated at registration time.

---

## 3. Module Lifecycle

```
REGISTER → VALIDATE → ENABLE → INVOKE → REPORT → (DISABLE | UNREGISTER)
```

| Stage | Core does | Module must |
|---|---|---|
| **REGISTER** | Accept manifest into the registry | Submit complete manifest (§2) |
| **VALIDATE** | Check schema, version range, conflicts, tool availability | Fix reported violations; nothing runs until clean |
| **ENABLE** | Mark active; expose `provides` capabilities | Remain dormant until invoked |
| **INVOKE** | Route trigger through Decision Rules + loop | Execute only within its declared phases/tools |
| **REPORT** | Collect phase ledger + artifacts (Report Bus) | Emit structured results per §5; never write its own "Done" |
| **DISABLE/UNREGISTER** | Remove capability exposure | Leave no residual state outside its declared outputs |

**Lifecycle rules:**

- L1. Any stage failure stops the pipeline with a named rule violation (fail closed).
- L2. Invocation outside declared `phases` or `tools` is refused by the Core before it reaches the module.
- L3. A module MUST NOT bypass the loop: its work enters at a declared phase and exits through SHIP/Definition of Done (`01` §12).
- L4. Disabling a module never affects Core behavior or other modules (02 §3 rule 3).

---

## 4. Hotkey Registration Interface (normative, for the future Hotkey module)

The existing Grimoire hotkey set is NOT redesigned here. The Core stays ignorant of individual hotkeys; the future Hotkeys module registers each one through this interface:

```yaml
# one hotkey registration record
command: "grimoire.test"        # unique command id (kebab/dot-case)
name: "Run Tests"               # human-readable label
purpose: "Execute the project test suite and summarize failures."  # why it exists
trigger:                        # how it fires — exactly one form
  key: "ctrl+shift+t"           #   key chord | slash-command | menu id | voice phrase
behavior:                       # what happens — MUST reference loop phases + mode
  mode: "TEST"                  #   a Decision Rules mode (04), never bespoke logic
  phases: ["RUN", "TEST"]       #   where it enters/exits the loop
  args: ["suite?"]              #   optional arguments, validated before use
output:                         # format of the result shown to the user
  format: "summary"             #   summary | diff | report | artifact-link
  includes: ["pass-fail-counts", "failing-test-names", "command-run"]
requires:                       # optional tool requirements (01 §10.1)
  tools: ["terminal"]
```

**Hotkey rules:**

- H1. All seven fields (`command`, `name`, `purpose`, `trigger`, `behavior`, `output`, and `requires` — required even if empty) MUST be present; missing fields fail validation.
- H2. `behavior.mode` MUST be one of the Core Decision Rules modes — a hotkey cannot define new control flow.
- H3. `command` values MUST be unique across registered hotkeys; collisions fail registration.
- H4. The Core contains ZERO hotkey-specific logic: no key chords, command names, or output formats in Core files (test AC-01: grep Core for known hotkey tokens returns zero).
- H5. If `requires.tools` includes an unavailable tool, the hotkey is registered but reports a blocked state when triggered (E-TOOL), it does not silently no-op.
- H6. Hotkey execution produces a standard Completion Report through the Report Bus (§5), same as any Task — pressing a hotkey is not a shortcut around D1–D10.
- H7. Bindings (trigger data) belong in L3 assets (02 §1), so rebinding never requires touching module code.

---

## 5. Output & Reporting Contract

Every module invocation MUST emit a structured result to the Report Bus:

```yaml
module: "deploy"
command: "deploy.release"
status: success | blocked | failed      # blocked = E-ENV/E-TOOL-class; failed = E-VALID
phase_ledger:                           # same ledger format as 01 §3.2
  - "PLAN: done (T1)"
  - "DEBUG: skipped (no failures)"
artifacts: ["deploy-record:prod#42"]
evidence:                               # verified facts only (01 §1.2)
  - "command: `bun test` → 14 passed"
remaining_issues: []                    # empty ONLY if truly empty (01 §12.1)
assumptions: []                         # labeled assumptions, if any
```

Rules:

- O1. `status` is never `success` unless Definition of Done passed for the invoked scope.
- O2. Evidence lines must be reproducible commands, file paths, or outputs — not prose claims.
- O3. Reports reuse the Core formats; modules MUST NOT invent parallel report schemas.

---

## 6. Testing Requirements for Modules

Optional: [[hotkey-mode-coverage]]

A module is shippable only when (mirrors `01` §7, tiered by module complexity):

- T1-equivalent module (single capability): manifest validation test + one happy-path invocation test + one failure-path test (missing tool or conflicting module → fails closed).
- T2-equivalent module (multi-phase): above, plus regression run proving Core loop behavior unchanged, plus one test per declared `errors` class.
- Every module MUST include a **refusal test**: triggering it without a valid manifest or with an unmet `requires` produces a named rule violation, not a partial run.

---

## 7. Checklist: Adding a Module Without Rewriting the Core

A future module is conformant iff all boxes pass:

- [ ] Manifest complete per §2 (all required fields).
- [ ] No Core file edited except a registry/config entry (02 §3 rule 2).
- [ ] No lateral reach into another module; only `provides`/`consumes`.
- [ ] All tool usage declared and verified (01 §10).
- [ ] Work routed through the standard loop + tiering (01 §3).
- [ ] Output passes Definition of Done D1–D10 (01 §12).
- [ ] Structured report emitted per §5.
- [ ] Refusal/failure tests per §6 exist and pass.
- [ ] Core independence grep (AC-01) still returns zero module-specific tokens in Core.

---

## 8. Explicit Non-Goals of This Contract

- It does NOT define the internal APIs of any specific module.
- It does NOT mandate a programming language, file layout, or registry storage format — the Core only requires the manifest fields and lifecycle semantics above.
- It does NOT license new Core behavior: if a module needs a new Core primitive, that is a versioned Core change (13.6), approved before the module ships.
