// Grimoire v3 — Group U: Native Write Capability acceptance (Task 21).
//
// Coverage map (docs/v3/05-acceptance-tests.md, Group U; contracts:
// docs/v3/14-hotkey-runtime.md §5.1/§6.1/§6.1.1/§7.1, §24 §3.1, §25 §11,
// ruling docs/v3/27-native-write-capability-ruling.md §R1–§R7):
//   U-01  native G identity and handler binding (default vs opt-in)
//   U-02  single-file UTF-8 create
//   U-03  existing-file overwrite (full replacement, never append)
//   U-04  append rejected, file not mutated
//   U-05  mkdir / directory target rejected, nothing created
//   U-06  missing parent → E_ENV_MISSING_FILE, no directory created
//   U-07  workspace containment (outside never touched)
//   U-08  absolute path → E_INPUT_INVALID_ARGS, no write
//   U-09  traversal refusal, no outside mutation
//   U-10  symlink escape refusal (parent, final component, dangling)
//   U-11  approval / GATE integration — one verify(), args bound, no
//         second authorization point
//   U-12  failure classification matrix — no failure ever reaches COMPLETED
//
// Every full-pipeline case runs the REAL production wiring:
// runLocalRuntime(bundle, { workspace }) → real Planner → real GATE → real
// Agent → real Module Registry / Tool Bus / Hotkey Runtime → real Report
// Bus, with `handler.save-files` bound by the composition root exactly as
// the Local Runtime's `--workspace <dir>` binds it. No handler is injected
// in these tests; runtime-level cases (tool gate, unexpected throw) use the
// documented createRuntime seam directly.
import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  createLocalDependencies,
  runLocalRuntime,
  main,
} from "../runtime/local-runtime.mjs";
import { createRuntime } from "../modules/hotkeys/src/runtime.mjs";
import {
  DEFAULT_HANDLERS,
  defineHandler,
  createSaveFilesHandler,
} from "../modules/hotkeys/src/handlers.mjs";
import { planIdentity, executionIdentity } from "../composition/plan-execution/index.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_TEXT = fs.readFileSync(path.join(REPO_ROOT, "docs", "v3", "12-hotkey-registry.md"), "utf8");

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** Fresh isolated workspace outside the repository; always disposed. */
function withWorkspace(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grimoire-u-"));
  try {
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A real bundle: ungated by default; `gated` sets review.required (T2+trigger).
 *  The PLAN's changes[].file stays a well-formed relative name (plan shape is
 *  validated by the planner/composer); the ATTACK path rides only in
 *  execution.args.file, which is what the handler contract governs. */
function saveBundle(file, content, { gated = false, extraArgs = null } = {}) {
  const planFile = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(file) ? file : "note.md";
  const execution = {
    kind: "hotkey",
    module: "hotkeys",
    capability: "hotkeys:execute",
    phase: "RUN",
    target: { key: "G" },
    args: extraArgs === null ? { file, content } : extraArgs,
  };
  return {
    plan: {
      task: `Native save of ${file}`,
      tier: "T2",
      ...(gated ? { trigger: "migration" } : {}),
      changes: [{ file: planFile, why: "Group U native write acceptance" }],
      verification: ["read the file back and compare its bytes"],
      risks: ["the write must stay inside the declared workspace"],
    },
    execution,
  };
}

/** Full production run against a declared workspace (no injected handler). */
function runSave(workspace, file, content, options = {}) {
  return runLocalRuntime(saveBundle(file, content, options), { workspace });
}

function executionOf(result) {
  return result.orchestration !== null &&
    result.orchestration.execution !== null &&
    result.orchestration.execution !== undefined
    ? result.orchestration.execution
    : null;
}

/** Assert a terminal non-success with a built report that never claims completion. */
function assertNeverCompleted(result, label) {
  assert.strictEqual(result.ok, false, `${label}: never ok`);
  assert.notStrictEqual(result.status, "COMPLETED", `${label}: never COMPLETED status`);
  assert.notStrictEqual(result.code, "COMPLETED", `${label}: never COMPLETED code`);
  assert.notStrictEqual(result.report, null, `${label}: every terminal attempt carries a report`);
  assert.ok(
    !result.report.text.includes("| Status | COMPLETED |"),
    `${label}: report never renders the completion row`
  );
}

// ---------------------------------------------------------------------------
describe("Group U — U-01 native G identity and handler binding", () => {
  it("U-01: G → hotkey → hotkeys:execute → handler.save-files → files, no new token", () => {
    withWorkspace((workspace) => {
      const handler = createSaveFilesHandler({ workspace, repositoryRoot: REPO_ROOT });
      assert.strictEqual(handler.id, "handler.save-files");
      assert.strictEqual(handler.command, "grimoire.key.G");
      assert.deepStrictEqual([...handler.requiredTools], ["files"]);

      // (a) Default wiring: no workspace ⇒ no handler ⇒ G unchanged.
      const defaultRuntime = createRuntime({ registryText: REGISTRY_TEXT, root: REPO_ROOT });
      const before = defaultRuntime.resolveHotkey({ key: "G" });
      assert.strictEqual(before.classification, "UNIMPLEMENTED");
      assert.strictEqual(before.code, "E_ENV_HANDLER_MISSING");

      // (b) Opt-in wiring: composition root binds the factory's handler.
      const bound = createRuntime({
        registryText: REGISTRY_TEXT,
        root: REPO_ROOT,
        handlers: { ...DEFAULT_HANDLERS, "grimoire.key.G": handler },
      });
      const after = bound.resolveHotkey({ key: "G", args: { file: "id.md", content: "x\n" } });
      assert.strictEqual(after.classification, "EXECUTABLE");
      assert.strictEqual(after.code, "OK_RESOLVED");
      assert.strictEqual(after.trace.handler_id, "handler.save-files");

      // (c) The handler binding belt still refuses a mis-bound map key.
      assert.throws(
        () =>
          createRuntime({
            registryText: REGISTRY_TEXT,
            root: REPO_ROOT,
            handlers: { ...DEFAULT_HANDLERS, "grimoire.key.R": handler },
          }),
        (error) => error.code === "E_VALID_HANDLER_SPEC"
      );

      // (d) No new Tool Bus capability token exists — declarations byte-identical.
      const capsText = fs.readFileSync(path.join(REPO_ROOT, "modules", "tool-bus", "capabilities.json"), "utf8");
      assert.strictEqual(
        sha256(capsText),
        "41c967a1c6f914101357148939c2795ef091ba907595a1a677896dfaaedcbe7a"
      );
      assert.strictEqual(JSON.parse(capsText).declared, 11);

      // (e) Operation identity unchanged: the only capability that runs is
      // `hotkeys:execute`; a fabricated write capability never completes.
      const result = runSave(workspace, "op.md", "operation identity\n");
      assert.strictEqual(result.ok, true);
      const execution = executionOf(result);
      assert.ok(
        execution.evidence.some((line) => line.includes("execute: handler.save-files -> op.md")),
        "evidence names the handler layer"
      );
      const bad = saveBundle("op2.md", "x\n");
      bad.execution.capability = "hotkeys:save";
      const refused = runLocalRuntime(bad, { workspace });
      assert.notStrictEqual(refused.code, "COMPLETED", "no new operation identity exists");
      assertNeverCompleted(refused, "U-01 fabricated capability");
    });
  });

  it("U-01: the Local Runtime --workspace flag binds the handler; default stays unimplemented", () => {
    withWorkspace((workspace) => {
      const bundlePath = path.join(workspace, "bundle.json");
      const bundle = saveBundle("cli.md", "bound through the flag\n");
      fs.writeFileSync(bundlePath, JSON.stringify(bundle), "utf8");
      const capture = () => {
        const buffers = { out: "", err: "" };
        return {
          buffers,
          io: {
            stdout: (text) => { buffers.out += text; },
            stderr: (text) => { buffers.err += text; },
          },
        };
      };

      // Default invocation: G stays UNIMPLEMENTED, exit 4, nothing written.
      const dflt = capture();
      const defaultExit = main([bundlePath], dflt.io);
      assert.strictEqual(defaultExit, 4);
      const defaultHeader = JSON.parse(dflt.buffers.out.slice(0, dflt.buffers.out.indexOf("\n")));
      assert.strictEqual(defaultHeader.code, "EXECUTION_REFUSED");
      assert.ok(defaultHeader.error.detail.includes("E_ENV_HANDLER_MISSING"));
      assert.ok(!fs.existsSync(path.join(workspace, "cli.md")), "no flag ⇒ no write");

      // With --workspace: the composition root binds handler.save-files.
      const opt = capture();
      const optExit = main(["--workspace", workspace, bundlePath], opt.io);
      assert.strictEqual(optExit, 0);
      assert.strictEqual(fs.readFileSync(path.join(workspace, "cli.md"), "utf8"), "bound through the flag\n");

      // The repository root is categorically refused as a workspace (exit 2).
      const repo = capture();
      const repoExit = main(["--workspace", REPO_ROOT, bundlePath], repo.io);
      assert.strictEqual(repoExit, 2);
      assert.ok(repo.buffers.err.includes("INPUT ERROR"));
      assert.ok(repo.buffers.err.includes("repository root"));

      // A missing workspace is refused as input, never silently defaulted.
      const missing = capture();
      const missingExit = main(["--workspace", path.join(workspace, "nope"), bundlePath], missing.io);
      assert.strictEqual(missingExit, 2);
      assert.ok(missing.buffers.err.includes("does not exist"));
    });
  });
});

// ---------------------------------------------------------------------------
describe("Group U — U-02/U-03 create and overwrite", () => {
  it("U-02: one new UTF-8 text file with exact bytes, success report behavior", () => {
    withWorkspace((workspace) => {
      const content = "héllo — UTF-8 ✓ 日本語\nsecond line\n";
      const result = runSave(workspace, "created.md", content);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.code, "COMPLETED");
      const onDisk = fs.readFileSync(path.join(workspace, "created.md"), "utf8");
      assert.strictEqual(onDisk, content);
      const execution = executionOf(result);
      assert.strictEqual(execution.executed, true);
      assert.strictEqual(execution.code, "OK_EXECUTED");
      assert.strictEqual(execution.output.file, "created.md");
      assert.strictEqual(execution.output.bytes, Buffer.byteLength(content, "utf8"));
      assert.strictEqual(execution.output.sha256, sha256(content));
      assert.ok(result.report.text.includes("| Status | COMPLETED |"));
      assert.ok(
        execution.evidence.some((line) => line.includes(`execute: handler.save-files -> created.md (${Buffer.byteLength(content, "utf8")} bytes, sha256 ${sha256(content)})`))
      );
      // Exactly one file was created — no extras, no directories.
      assert.deepStrictEqual(fs.readdirSync(workspace), ["created.md"]);
    });
  });

  it("U-03: an existing file is fully overwritten, never appended", () => {
    withWorkspace((workspace) => {
      fs.writeFileSync(path.join(workspace, "target.md"), "old content\n", "utf8");
      const fresh = "brand new bytes\n";
      const result = runSave(workspace, "target.md", fresh);
      assert.strictEqual(result.ok, true);
      const onDisk = fs.readFileSync(path.join(workspace, "target.md"), "utf8");
      assert.strictEqual(onDisk, fresh);
      assert.ok(!onDisk.includes("old content"), "overwrite replaces, never merges");
      assert.strictEqual(executionOf(result).output.sha256, sha256(fresh));
      assert.deepStrictEqual(fs.readdirSync(workspace), ["target.md"]);
    });
  });
});

// ---------------------------------------------------------------------------
describe("Group U — U-04/U-05/U-06 rejected write shapes", () => {
  it("U-04: append semantics are refused and the file is not mutated", () => {
    withWorkspace((workspace) => {
      const original = "base content\n";
      fs.writeFileSync(path.join(workspace, "append.md"), original, "utf8");
      const result = runSave(workspace, "append.md", "appended line\n", {
        extraArgs: { file: "append.md", content: "appended line\n", append: true },
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, "EXECUTION_REFUSED");
      assert.strictEqual(result.error.class, "E-INPUT");
      assert.ok(result.error.detail.includes("E_INPUT_INVALID_ARGS"));
      const execution = executionOf(result);
      assert.strictEqual(execution.code, "E_INPUT_INVALID_ARGS");
      assert.strictEqual(execution.classification, "INVALID_INPUT");
      assert.strictEqual(
        fs.readFileSync(path.join(workspace, "append.md"), "utf8"),
        original,
        "a refused append never mutates the file"
      );
      assertNeverCompleted(result, "U-04");
    });
  });

  it("U-05: directory creation is refused — nothing created, existing directory untouched", () => {
    withWorkspace((workspace) => {
      // (a) mkdir-shaped target (trailing slash) — input refusal, no directory.
      const mkdirAttempt = runSave(workspace, "newdir/", "x\n");
      assert.strictEqual(mkdirAttempt.code, "EXECUTION_REFUSED");
      assert.ok(mkdirAttempt.error.detail.includes("E_INPUT_INVALID_ARGS"));
      assert.ok(!fs.existsSync(path.join(workspace, "newdir")), "no directory is ever created");
      assertNeverCompleted(mkdirAttempt, "U-05 mkdir");

      // (b) existing directory as target — write-path failure, nothing written.
      fs.mkdirSync(path.join(workspace, "dir"));
      const dirAttempt = runSave(workspace, "dir", "x\n");
      assert.strictEqual(dirAttempt.code, "EXECUTION_FAILED");
      assert.strictEqual(dirAttempt.status, "FAILED");
      assert.strictEqual(dirAttempt.error.class, "E-TOOL");
      assert.ok(dirAttempt.error.detail.includes("E_TOOL_WRITE_FAILED"));
      assert.deepStrictEqual(fs.readdirSync(path.join(workspace, "dir")), [], "directory stays empty");
      assertNeverCompleted(dirAttempt, "U-05 directory target");
    });
  });

  it("U-06: missing parent → E_ENV_MISSING_FILE / EXECUTION_FAILED, no parent created", () => {
    withWorkspace((workspace) => {
      const result = runSave(workspace, "missing-parent/x.txt", "orphan\n");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, "EXECUTION_FAILED");
      assert.strictEqual(result.status, "FAILED");
      assert.strictEqual(result.error.class, "E-ENV");
      assert.ok(result.error.detail.includes("E_ENV_MISSING_FILE"));
      const execution = executionOf(result);
      assert.strictEqual(execution.classification, "EXECUTION_ERROR");
      assert.strictEqual(execution.code, "E_ENV_MISSING_FILE");
      assert.ok(!fs.existsSync(path.join(workspace, "missing-parent")), "no parent directory is created");
      assert.deepStrictEqual(fs.readdirSync(workspace), []);
      assertNeverCompleted(result, "U-06");
    });
  });
});

// ---------------------------------------------------------------------------
describe("Group U — U-07/U-08/U-09/U-10 workspace containment", () => {
  it("U-07: writes land only under the declared workspace; outside is unreachable", () => {
    withWorkspace((workspace) => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), "grimoire-u07-outside-"));
      try {
        fs.writeFileSync(path.join(outside, "sentinel.txt"), "sentinel\n", "utf8");
        // Positive control: a nested target with an existing parent is allowed.
        fs.mkdirSync(path.join(workspace, "sub"));
        const ok = runSave(workspace, "sub/ok.txt", "inside\n");
        assert.strictEqual(ok.ok, true);
        assert.strictEqual(fs.readFileSync(path.join(workspace, "sub", "ok.txt"), "utf8"), "inside\n");
        // Outside-targeting attempts are refused before any I/O.
        for (const attempt of ["../u07-escape.txt", "sub/../../u07-escape.txt", "../u07-outside-sibling/x.txt"]) {
          const refused = runSave(workspace, attempt, "escape\n");
          assert.strictEqual(refused.code, "EXECUTION_REFUSED", attempt);
          assert.ok(refused.error.detail.includes("E_INPUT_INVALID_ARGS"), attempt);
          assertNeverCompleted(refused, `U-07 ${attempt}`);
        }
        assert.ok(!fs.existsSync(path.join(path.dirname(workspace), "u07-escape.txt")));
        assert.ok(!fs.existsSync(path.join(outside, "x.txt")), "outside directory untouched");
        assert.deepStrictEqual(fs.readdirSync(outside), ["sentinel.txt"], "outside sentinel unchanged");
        assert.strictEqual(fs.readFileSync(path.join(outside, "sentinel.txt"), "utf8"), "sentinel\n");
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  it("U-08: absolute paths → E_INPUT_INVALID_ARGS, no write occurs", () => {
    withWorkspace((workspace) => {
      const absoluteTarget = path.join(os.tmpdir(), "u08-absolute-target.txt");
      fs.rmSync(absoluteTarget, { force: true });
      for (const attempt of [absoluteTarget, "/etc/u08-absolute-target.txt"]) {
        const result = runSave(workspace, attempt, "absolute\n");
        assert.strictEqual(result.code, "EXECUTION_REFUSED", attempt);
        assert.strictEqual(result.error.class, "E-INPUT", attempt);
        assert.ok(result.error.detail.includes("E_INPUT_INVALID_ARGS"), attempt);
        assert.strictEqual(executionOf(result).code, "E_INPUT_INVALID_ARGS", attempt);
        assertNeverCompleted(result, `U-08 ${attempt}`);
      }
      assert.ok(!fs.existsSync(absoluteTarget), "absolute target never created");
      assert.deepStrictEqual(fs.readdirSync(workspace), [], "workspace untouched");
    });
  });

  it("U-09: traversal forms are refused and nothing escapes the workspace", () => {
    withWorkspace((workspace) => {
      const escaped = path.join(path.dirname(workspace), "u09-escape.txt");
      fs.rmSync(escaped, { force: true });
      for (const attempt of ["../u09-escape.txt", "./u09-escape.txt", "sub/../../../u09-escape.txt", "a/../b.txt"]) {
        const result = runSave(workspace, attempt, "traversal\n");
        assert.strictEqual(result.code, "EXECUTION_REFUSED", attempt);
        assert.ok(result.error.detail.includes("E_INPUT_INVALID_ARGS"), attempt);
        assertNeverCompleted(result, `U-09 ${attempt}`);
      }
      assert.ok(!fs.existsSync(escaped), "no file escaped the workspace");
      assert.deepStrictEqual(fs.readdirSync(workspace), [], "workspace untouched");
    });
  });

  it("U-10: symlink escapes (parent, final component, dangling) are refused", () => {
    withWorkspace((workspace) => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), "grimoire-u10-outside-"));
      try {
        // (a) Parent component is a symlink pointing outside.
        fs.symlinkSync(outside, path.join(workspace, "lnk"));
        const parentEscape = runSave(workspace, "lnk/evil.txt", "escape\n");
        assert.strictEqual(parentEscape.code, "EXECUTION_FAILED");
        assert.strictEqual(parentEscape.status, "FAILED");
        assert.strictEqual(parentEscape.error.class, "E-TOOL");
        assert.ok(parentEscape.error.detail.includes("E_TOOL_WRITE_FAILED"));
        assert.ok(!fs.existsSync(path.join(outside, "evil.txt")), "nothing lands outside");
        assertNeverCompleted(parentEscape, "U-10 parent symlink");

        // (b) Final component is a symlink whose target is outside.
        fs.writeFileSync(path.join(outside, "target.txt"), "sentinel\n", "utf8");
        fs.symlinkSync(path.join(outside, "target.txt"), path.join(workspace, "lnfile"));
        const fileEscape = runSave(workspace, "lnfile", "overwrite through link\n");
        assert.strictEqual(fileEscape.code, "EXECUTION_FAILED");
        assert.ok(fileEscape.error.detail.includes("E_TOOL_WRITE_FAILED"));
        assert.strictEqual(
          fs.readFileSync(path.join(outside, "target.txt"), "utf8"),
          "sentinel\n",
          "outside target unchanged"
        );
        assertNeverCompleted(fileEscape, "U-10 file symlink");

        // (c) Dangling symlink pointing outside — never followed for creation.
        fs.symlinkSync(path.join(outside, "never.txt"), path.join(workspace, "dangling"));
        const dangling = runSave(workspace, "dangling", "create through dangling link\n");
        assert.strictEqual(dangling.code, "EXECUTION_FAILED");
        assert.ok(dangling.error.detail.includes("E_TOOL_WRITE_FAILED"));
        assert.ok(!fs.existsSync(path.join(outside, "never.txt")), "dangling escape never creates");
        assertNeverCompleted(dangling, "U-10 dangling symlink");

        assert.deepStrictEqual(fs.readdirSync(outside).sort(), ["target.txt"], "outside only has its own file");
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });
  });
});

// ---------------------------------------------------------------------------
describe("Group U — U-11 approval / GATE integration", () => {
  it("U-11: no approval refuses at GATE with no write; approval verifies exactly once", () => {
    withWorkspace((workspace) => {
      const target = path.join(workspace, "gated.md");

      // (1) No approval component at all → D0, agent never runs, no write.
      const noApproval = runLocalRuntime(saveBundle("gated.md", "never\n", { gated: true }), { workspace });
      assert.strictEqual(noApproval.code, "APPROVAL_REQUIRED");
      assert.strictEqual(noApproval.status, "REFUSED");
      assert.strictEqual(noApproval.stage, "GATE");
      assert.strictEqual(noApproval.orchestration, null, "agent execution count is zero");
      assert.ok(!fs.existsSync(target), "no write without approval");
      assertNeverCompleted(noApproval, "U-11 no approval");

      // (2) Explicit denial → exactly one verify(), still no write.
      const counts = { verify: 0 };
      const denied = runLocalRuntime(saveBundle("gated.md", "denied\n", { gated: true }), {
        workspace,
        approval: {
          verify(plan, execution) {
            counts.verify += 1;
            return { granted: false, plan: planIdentity(plan), execution: executionIdentity(execution) };
          },
        },
      });
      assert.strictEqual(counts.verify, 1, "exactly one verification per gated attempt");
      assert.strictEqual(denied.code, "APPROVAL_REQUIRED");
      assert.strictEqual(denied.orchestration, null);
      assert.ok(!fs.existsSync(target), "no write after denial");
      assertNeverCompleted(denied, "U-11 denial");

      // (3) Verdict bound to DIFFERENT write arguments → binding mismatch
      //     (the approval binds plan + full execution sub-request INCLUDING
      //     args), so path and content are inside the approval binding.
      const counts2 = { verify: 0 };
      const tampered = runLocalRuntime(saveBundle("gated.md", "tampered\n", { gated: true }), {
        workspace,
        approval: {
          verify(plan, execution) {
            counts2.verify += 1;
            return {
              granted: true,
              plan: planIdentity(plan),
              execution: executionIdentity({ ...execution, args: { file: "gated.md", content: "other\n" } }),
            };
          },
        },
      });
      assert.strictEqual(counts2.verify, 1, "no retry, no second consult");
      assert.strictEqual(tampered.code, "APPROVAL_REQUIRED");
      assert.ok(tampered.error.detail.includes("binding mismatch"), tampered.error.detail);
      assert.ok(!fs.existsSync(target), "a mismatched verdict never writes");
      assertNeverCompleted(tampered, "U-11 binding mismatch");

      // (4) Valid approval → exactly ONE verification, then the native write.
      const counts3 = { verify: 0 };
      const approved = runLocalRuntime(saveBundle("gated.md", "approved at the gate\n", { gated: true }), {
        workspace,
        approval: {
          verify(plan, execution) {
            counts3.verify += 1;
            return { granted: true, plan: planIdentity(plan), execution: executionIdentity(execution) };
          },
        },
      });
      assert.strictEqual(counts3.verify, 1, "exactly one verify() — never two, never zero");
      assert.strictEqual(approved.ok, true);
      assert.strictEqual(approved.code, "COMPLETED");
      assert.strictEqual(fs.readFileSync(target, "utf8"), "approved at the gate\n");
      assert.ok(approved.report.text.includes("GATE: done (approval verified)"));
    });
  });
});

// ---------------------------------------------------------------------------
describe("Group U — U-12 failure classification, never COMPLETED", () => {
  it("U-12: every failure case maps to its exact class/code and never completes", () => {
    withWorkspace((workspace) => {
      const observed = [];

      // 1. Invalid input (append attempt) → E_INPUT_INVALID_ARGS · E-INPUT · REFUSED.
      const invalid = runSave(workspace, "u12.md", "x\n", {
        extraArgs: { file: "u12.md", content: "x\n", append: true },
      });
      assert.strictEqual(invalid.code, "EXECUTION_REFUSED");
      assert.strictEqual(invalid.status, "REFUSED");
      assert.strictEqual(invalid.error.class, "E-INPUT");
      assert.ok(invalid.error.detail.includes("E_INPUT_INVALID_ARGS"));
      observed.push(["invalid input", invalid]);

      // 2. Missing parent → E_ENV_MISSING_FILE · E-ENV · EXECUTION_FAILED.
      const missing = runSave(workspace, "nope/u12.md", "x\n");
      assert.strictEqual(missing.code, "EXECUTION_FAILED");
      assert.strictEqual(missing.error.class, "E-ENV");
      assert.ok(missing.error.detail.includes("E_ENV_MISSING_FILE"));
      observed.push(["missing parent", missing]);

      // 3. Directory target → E_TOOL_WRITE_FAILED · E-TOOL · EXECUTION_FAILED.
      fs.mkdirSync(path.join(workspace, "adir"));
      const directory = runSave(workspace, "adir", "x\n");
      assert.strictEqual(directory.code, "EXECUTION_FAILED");
      assert.strictEqual(directory.status, "FAILED");
      assert.strictEqual(directory.error.class, "E-TOOL");
      assert.ok(directory.error.detail.includes("E_TOOL_WRITE_FAILED"));
      assert.strictEqual(executionOf(directory).code, "E_TOOL_WRITE_FAILED");
      observed.push(["directory target", directory]);

      // 4. Handler unavailable (no workspace) → E_ENV_HANDLER_MISSING · E-ENV.
      const unavailableHandler = runLocalRuntime(saveBundle("u12.md", "x\n"));
      assert.strictEqual(unavailableHandler.code, "EXECUTION_REFUSED");
      assert.strictEqual(unavailableHandler.error.class, "E-ENV");
      assert.ok(unavailableHandler.error.detail.includes("E_ENV_HANDLER_MISSING"));
      observed.push(["handler unavailable", unavailableHandler]);

      // 7a. Write operation failure — symlink cycle on the target → E_TOOL_WRITE_FAILED.
      fs.symlinkSync("u12-loop.md", path.join(workspace, "u12-loop.md"));
      const loop = runSave(workspace, "u12-loop.md", "x\n");
      assert.strictEqual(loop.code, "EXECUTION_FAILED");
      assert.strictEqual(loop.error.class, "E-TOOL");
      assert.ok(loop.error.detail.includes("E_TOOL_WRITE_FAILED"), loop.error.detail);
      observed.push(["write operation failure (ELOOP)", loop]);

      // The COMPLETED invariant, asserted over every observed failure.
      for (const [label, result] of observed) {
        assertNeverCompleted(result, `U-12 ${label}`);
      }
      // Nothing was ever created by a failure.
      assert.ok(!fs.existsSync(path.join(workspace, "u12.md")), "no failed case writes its target");
      assert.ok(!fs.existsSync(path.join(workspace, "nope")), "no failed case creates directories");
      assert.deepStrictEqual(fs.readdirSync(workspace).sort(), ["adir", "u12-loop.md"]);
    });
  });

  it("U-12: tool unavailable → TOOL_REQUIRED; unexpected throw → E_UNKNOWN_EXCEPTION", () => {
    withWorkspace((workspace) => {
      // 5. Required tool unavailable → runtime TOOL_REQUIRED · E_TOOL_UNAVAILABLE;
      //    the handler never runs (declared tool `files` gates availability).
      const noTools = createRuntime({
        registryText: REGISTRY_TEXT,
        root: REPO_ROOT,
        availableTools: [],
        handlers: { ...DEFAULT_HANDLERS, "grimoire.key.G": createSaveFilesHandler({ workspace, repositoryRoot: REPO_ROOT }) },
      });
      const toolGate = noTools.resolveHotkey({ key: "G", args: { file: "u12-tool.md", content: "x\n" } });
      assert.strictEqual(toolGate.classification, "TOOL_REQUIRED");
      assert.strictEqual(toolGate.code, "E_TOOL_UNAVAILABLE");
      assert.ok(!fs.existsSync(path.join(workspace, "u12-tool.md")), "a tool-gated handler never runs");

      // 6. Unexpected implementation failure → E_UNKNOWN_EXCEPTION · E-UNKNOWN.
      const boom = createRuntime({
        registryText: REGISTRY_TEXT,
        root: REPO_ROOT,
        handlers: {
          ...DEFAULT_HANDLERS,
          "grimoire.key.G": defineHandler({
            id: "handler.boom",
            command: "grimoire.key.G",
            requiredTools: ["files"],
            validateArgs: () => ({ ok: true }),
            run: () => {
              throw new Error("unexpected implementation failure");
            },
          }),
        },
      });
      const threw = boom.executeHotkey({ key: "G", args: { file: "u12-throw.md", content: "x\n" } });
      assert.strictEqual(threw.classification, "EXECUTION_ERROR");
      assert.strictEqual(threw.code, "E_UNKNOWN_EXCEPTION");
      assert.strictEqual(threw.error.class, "E-UNKNOWN");
      assert.strictEqual(threw.executed, false);
      assert.ok(!fs.existsSync(path.join(workspace, "u12-throw.md")));
    });
  });
});
