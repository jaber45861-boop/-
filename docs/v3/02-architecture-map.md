# Grimoire v3 — Architecture Map

**Status:** Draft for executive review (Task 01)
**Purpose:** Show how Core, modules, and assets relate — and the dependency rules that keep the Core independent.

---

## 1. Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  L3 — ASSETS (data/content, no logic)                                   │
│   Curriculum texts · Hotkey bindings · Projects · Lessons · Waivers     │
└─────────────────────────────────────────────────────────────────────────┘
                 ▲ read/execute by declaration only
┌─────────────────────────────────────────────────────────────────────────┐
│  L2 — MODULES (capability packages, registered via extension contract)  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Hotkeys │ │Learning/│ │Deploy   │ │ Git      │ │ Image-to-code    │  │
│  │         │ │Curric.  │ │         │ │          │ │                  │  │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │ Memory  │ │Project  │ │Research  │ │Code     │ │ Architecture /   │  │
│  │         │ │Mgmt     │ │          │ │Review   │ │ Integrations     │  │
│  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────────────────────────────────────────────────┐   │
│  │ Agents  │ │ Debugger* · Testing*  (* Core behaviors, may be      │   │
│  │         │ │ wrapped by optional tooling modules later)          │   │
│  └─────────┘ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                 ▲ all contact through Core interfaces only
┌─────────────────────────────────────────────────────────────────────────┐
│  L1 — CORE SERVICES (interfaces the Core defines and owns)             │
│   Module Registry · Tool Bus (capability requests) · Report Bus        │
│   (artifacts, phase ledger, completion report) · Contract Validator    │
└─────────────────────────────────────────────────────────────────────────┘
                 ▲ governed by
┌─────────────────────────────────────────────────────────────────────────┐
│  L0 — CORE (the operating system; no feature logic)                    │
│   Identity · Mission · Execution Loop · Decision Rules                 │
│   Behavior Contracts (coding, planning, debugging, testing, teaching,  │
│   project context, tools) · Error Model · Completion Criteria          │
└─────────────────────────────────────────────────────────────────────────┘
```

**One-sentence rule:** everything above L0 is replaceable; L0 is not.

---

## 2. Component Map

The ten named areas of the system, their layer, and their relationship to the Core:

| Component | Layer | Role | Talks to Core via | May depend on | MUST NOT |
|---|---|---|---|---|---|
| **Core** | L0/L1 | Rules, loop, decision engine, registries | — (is the Core) | Nothing above it | Reference any concrete module, hotkey, or lesson |
| **Hotkeys** | L2 + L3 bindings | Maps triggers → registered commands | Module manifest + hotkey registration interface (`03` §4) | Core loop, Decision Rules, Tool Bus | Contain behavior logic that bypasses loop phases; edit Core files |
| **Skills** | L2 | Reusable task playbooks (how-to procedures) | Module manifest; invoked as BUILD/PLAN strategies | Core contracts, Tool Bus | Ship work that fails Definition of Done |
| **Tools** | L1 Tool Bus + L2 wrappers | External effects: terminal, files, search, browser, APIs | Declared tool requirements in manifests; output is Report Bus evidence | Core error model | Be invoked undeclared (`01` §10.1) or without verifying output (`01` §10.3) |
| **Memory** | L2 | Persisted preferences/context across sessions | Read/write via Core-declared shared artifacts | Report Bus | Override verified facts from the current session; store secrets |
| **Curriculum** | L3 content + L2 driver | Lesson sequence, project-based learning | Content assets registered as modules | Teaching contract (`01` §8), loop | Alter loop phases or completion criteria |
| **Projects** | L3 data + L2 driver | Concrete builds learners/users undertake | Project manifest → execution loop | Core loop, Testing contract | Define alternate completion criteria |
| **Debugger** | L2 (wraps `01` §6) | Tooling around the Debugging Contract | Hooks DEBUG phase; produces per-stage artifacts | Debugging Contract (`01` §6.1) | Skip stages, or rewrite wholesale while diagnosis is possible (`01` 6.2) |
| **Testing** | L2 (wraps `01` §7) | Test generators/runners/reporters | Hooks TEST phase; fills §7.1 answers | Testing contract (`01` §7) | Lower the tier minimums in `01` §7.2 |
| **Deployment** | L2 | Ship to environments | Hooks SHIP (post-Done); declares E-ENV/E-DEP errors | Completion criteria (`01` §12), error model | Mark Done before D1–D10 pass |

---

## 3. Dependency Rules (normative)

These rules ARE the architecture; violating one is an acceptance-test failure (`05-acceptance-tests.md` AC-03, AC-19, AC-20).

1. **Arrows point down only.** L3 → L2 → L1 → L0. The Core and Core Services never import from a module or asset.
2. **Modules touch Core only through interfaces:** register/manifest, loop-phase hooks, Decision Rules modes, Tool Bus capability requests, Report Bus events. No reaching into Core internals.
3. **No lateral coupling.** Module-to-module interaction happens only via Core-declared capabilities (a module *requests* a capability; the registry resolves it). One module MUST NOT edit another module's files, state, or bindings.
4. **Fail closed at the boundary.** Any undeclared dependency, unmet tool requirement, or manifest conflict prevents execution (13.5) — the Core refuses to guess.
5. **Assets are inert.** L3 content (curriculum text, hotkey bindings, project definitions) contains no executable behavior; behavior lives in the L2 module that declares it.
6. **Definition of Done is universal.** Every module's output passes D1–D10 (`01` §12). Modules add checks; they never subtract them.
7. **One loop, many callers.** All execution — interactive task, hotkey trigger, scheduled agent job — flows through the same UNDERSTAND→…→SHIP loop with the same tiering rules.

---

## 4. Request Flow (how a hotkey press becomes shipped work)

```
user trigger (hotkey / message / scheduled job)
        │
        ▼
Hotkeys module: manifest lookup → declared behavior + required tools
        │         (unresolved → fail closed, report which rule failed)
        ▼
Core Decision Rules (04): classify Task → mode + effort tier
        │
        ▼
Core Execution Loop (01 §3): UNDERSTAND → PLAN → BUILD → RUN → TEST → …
        │                         │              │
        │                         ▼              ▼
        │                    Tool Bus       Report Bus
        │                  (declared        (evidence, phase
        │                   tools only)      ledger, artifacts)
        ▼
Definition of Done D1–D10 (01 §12)
        │
        ├── pass  → SHIP: Completion Report via Report Bus
        └── fail  → owning phase (E-VALID → Debugging Contract, E-ENV → blocked report)
```

---

## 5. What Each Future Module Gets for Free

A module built to the Extension Contract inherits, without reimplementation:

- **Loop + tiering** — trivial/complex classification and skip rules already decide its planning depth.
- **Decision integration** — its capability is offered to the Decision Rules as a mode/strategy.
- **Error model** — E-classes, containment, loud degradation, blocked-task reporting.
- **Completion gate** — D1–D10 runs on its output automatically.
- **Tool discipline** — declaration, least-privilege, output verification.
- **Reporting** — phase ledger and Completion Report format.

This is the test of a good module: it adds *capability*, never *policy*.

---

## 6. Out-of-Scope Today

Debugger, Testing, Deployment, Git, and Learning exist in this map **as roles**, defined by which loop phase they hook and which contract they wrap. This task specifies the hooks; implementing the modules is future work per `03-extension-contract.md`.
