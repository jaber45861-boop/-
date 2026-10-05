اجنيت

# Grimoire v3 — Specification

Task 01 deliverable: the Core specification for Grimoire v3.

| # | Document | Contents |
|---|---|---|
| 1 | [Core Specification](docs/v3/01-core-specification.md) | All 13 core modules, execution loop, coding/planning/debugging/testing/teaching contracts, agent checklist, Definition of Done |
| 2 | [Architecture Map](docs/v3/02-architecture-map.md) | Layer diagram, component map, dependency rules, request flow |
| 3 | [Extension Contract](docs/v3/03-extension-contract.md) | Module manifest, lifecycle, hotkey registration interface, module checklist |
| 4 | [Decision Rules](docs/v3/04-decision-rules.md) | Gate procedure G0–G5, mode routing table, research and cross-cutting rules |
| 5 | [Acceptance Tests](docs/v3/05-acceptance-tests.md) | 35 tests (static, scenario, mutation, migration) + traceability matrix |
| 6 | [Legacy Asset Inventory](docs/v3/06-legacy-asset-inventory.md) | Real-data inventory (18 source files), instruction classification, preservation rules |
| 7 | [Curriculum Migration Map](docs/v3/07-curriculum-migration-map.md) | 9 parts · 20 chapters · 76 projects · 3 tracks mapped with source anchors + A1–A10 anomalies |
| 8 | [Hotkey Migration Map](docs/v3/08-hotkey-migration-map.md) | 43 Grimoire + 5 external hotkeys, H1–H7 comparison, version timeline |
| 9 | [Migration Gaps](docs/v3/09-migration-gaps.md) | GAP-001…021 re-evaluated against source, blocking flags |
| 10 | [Core Audit](docs/v3/10-core-audit.md) | CA-01…CA-07 evaluated against real legacy data; 0 blocking, 0 Core changes |
| 11 | [Source Integrity](docs/v3/11-source-integrity.md) | SHA-256, sizes, line counts, truncation/duplicate checks at commit `ad5e268` |
| 12 | [Hotkey Registry](docs/v3/12-hotkey-registry.md) | 48 registration records (43 Grimoire + 5 external), 7 activation statuses, 10 adapter declarations — registration ≠ activation |
| 13 | [Hotkey Decision Sheet](docs/v3/13-hotkey-decision-sheet.md) | Advisory rulings for the 13 blocked hotkeys (GAP-017 ×10, GAP-009 ×3) — recommendations are not decisions |
| 14 | [Hotkeys L2 module](modules/hotkeys/manifest.yaml) | Registry loader (10 duties) + ACTIVE-only activation gate + byte-stable report builder + fail-closed runtime executor (`executeHotkey`) — registration ≠ activation, execution only after the gate |
| 15 | [Hotkey module tests](test/) | HKC-01…HKC-17 + HKR-01…HKR-14 executable coverage, 10 + 10 fail-closed mutation suites (`node --test`, 58 tests) |
| 16 | [Hotkey Runtime Contract](docs/v3/14-hotkey-runtime.md) | `executeHotkey` pipeline, execution states + result-code table, handler contract, 14 ACTIVE resolution results, known limitations |
| 17 | [Tool Bus L1 module](modules/tool-bus/manifest.yaml) | 11 capability declarations (AVAILABLE/UNAVAILABLE/BLOCKED/DISABLED never collapsed) + deterministic fail-closed bus (`register/validate/has/resolve/check/invoke/describe/list`) + `local-files` provider + byte-stable report |
| 18 | [Tool Bus tests](test/tb-bus.test.mjs) | TB-01…TB-24 executable coverage (`tb-bus` + `tb-runtime`), 5 byte-different fail-closed capability mutations (`node --test`, 83 tests total) |
| 19 | [Tool Bus Contract](docs/v3/15-tool-bus.md) | Capability model, lifecycle, resolution flow, failure semantics (code → Core class), adapter interaction, runtime integration, determinism, security boundaries, extension rules |
| 20 | [Module Registry module](modules/module-registry/manifest.yaml) | L1 REGISTER → VALIDATE → ENABLE → INVOKE contract: 13-field manifest validation (`03` §2 M1–M6), the four VALIDATE duties (schema, core range, conflicts, tool availability via Tool Bus), symmetric conflict detection, registry-mediated capability resolution, fail-closed INVOKE gate, byte-stable report |
| 21 | [Module Registry tests](test/mr-registry.test.mjs) | MR-01…MR-16 executable coverage (AC-19 enforced by code), 5 byte-different manifest mutations (`node --test`, 102 tests total) |
| 22 | [Module Registry Contract](docs/v3/16-module-registry.md) | Interface, validation duties, execution flow, failure semantics (code → Core class), determinism, testing contract, protected dependencies, known unresolved items |
| 23 | [Report Bus L1 module](modules/report-bus/manifest.yaml) | Deterministic fail-closed REPORT stage (`03` §3/§5): static report-type + section catalogue, seven-state result vocabulary mapped to Core classes, caller-supplied rows only (no L2 import/execution), byte-stable sectioned rendering with SHA-256 over the exact bytes |
| 24 | [Report Bus tests](test/rb-report-bus.test.mjs) | RB-01…RB-20 executable coverage (REPORT stage enforced by code), 9 byte-different fail-closed mutations + 1 reorder control (`node --test`, 131 tests total) |
| 25 | [Report Bus Contract](docs/v3/17-report-bus.md) | Purpose, architectural position, input/section contracts, deterministic serialization and hashing, validation order, fail-closed table, three module integrations, dependency direction, safety boundaries, testing contract, limitations |
| 26 | [Agent Orchestrator L2 module](modules/agent/manifest.yaml) | Deterministic fail-closed orchestration contract (Task 10): seven-stage finite lifecycle RECEIVE → VALIDATE → RESOLVE → PREFLIGHT → EXECUTE → REPORT → COMPLETE consuming the public Module Registry / Tool Bus / Hotkey Runtime / Report Bus surfaces only, strict request envelope, twelve result codes mapped to Core classes, byte-stable report for every terminal attempt |
| 27 | [Agent Orchestrator tests](test/agent-orchestrator.test.mjs) | AO-01…AO-26 executable coverage (directive Task 10 enforced by code), 10 byte-different fail-closed mutations (`node --test`, 167 tests total) |
| 28 | [Agent Orchestrator Contract](docs/v3/18-agent-orchestrator.md) | Purpose, architectural position, scope, non-goals, request contract, lifecycle, four service integrations, error/refusal semantics, fail-closed rules, determinism, security boundaries, tests, mutation tests, known limitations, future Agent layers, acceptance mapping |
| 29 | [Planner L2 module](modules/planner/manifest.yaml) | Deterministic fail-closed plan production (Task 11): five-stage finite lifecycle RECEIVE → VALIDATE → PLAN → REPORT → COMPLETE implementing the four plan questions of `01` §5.1 at tier-exact depth (`01` §3.1/§3.2/§5.4), the `01` §5.2 review gate, INVALID_REQUEST/PLAN_INCOMPLETE refusal split, a Report Bus completion report for every terminal attempt |
| 30 | [Planner tests](test/planner.test.mjs) | PL-01…PL-20 executable coverage (AC-10 + `01` §5 enforced by code), 10 byte-different fail-closed mutations (`node --test`, 197 tests total) |
| 31 | [Planner Contract](docs/v3/19-planner.md) | Purpose, architectural position, scope, non-goals, request contract, lifecycle, four service integrations, error/refusal semantics, fail-closed rules, determinism, security boundaries, tests, mutation tests, known limitations, future Agent layers, acceptance mapping |
| — | [Migration extractor](scripts/migration-extract.sh) | Deterministic fact extraction (MIG-01…MIG-10) |

**Read order:** 01 → 02 → 03 → 04 → 05.
