// Grimoire v3 — Tool Bus capability declarations + default providers (Task 07).
//
// The declaration file (modules/tool-bus/capabilities.json) is the single
// authoritative capability dataset. Every capability id is either a tool token
// taken verbatim from the L3 registry's Tools columns or `files`, which the
// module manifest already declares (requires.tools). Nothing here invents
// capability behavior: unavailable/blocked capabilities are declared with no
// implementation, and their state is exposed honestly (directive §4).
//
// Providers are code: implementations live in this file, identities live in
// the declaration file. A provider executes only when its id is declared AND
// bound (bus rule), so removing either side fails closed (TB-22).

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Raw text of the authoritative capability declarations. */
export function loadCapabilityDeclarations() {
  return fs.readFileSync(new URL("../capabilities.json", import.meta.url), "utf8");
}

/** sha256 of the declaration file bytes (for integrity assertions). */
export function capabilityDeclarationsSha256() {
  return createHash("sha256").update(loadCapabilityDeclarations(), "utf8").digest("hex");
}

/**
 * Default provider bindings: id -> { id, invoke, purpose }.
 * Only providers with a real implementation appear here. Adapter providers
 * (grimoire.adapter.*) are intentionally absent — the 12 §4 declarations are
 * NOT_ACTIVATED and the bus never fabricates them.
 */
export function createDefaultProviders() {
  return {
    "local-files": {
      id: "local-files",
      purpose: "Reads a repository-relative document and returns its content with a SHA-256 fingerprint.",
      invoke: (input, context) => {
        const root = context.root;
        if (typeof root !== "string" || root.trim() === "") {
          const error = new Error("runtime root is not configured");
          error.code = "EACCES";
          throw error;
        }
        const resolved = path.resolve(root, input.file);
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
          const error = new Error("file resolves outside the repository root");
          error.code = "EACCES";
          throw error;
        }
        const content = fs.readFileSync(resolved, "utf8");
        return {
          file: input.file,
          bytes: Buffer.byteLength(content, "utf8"),
          lines: content.split("\n").length,
          sha256: createHash("sha256").update(content, "utf8").digest("hex"),
          content,
        };
      },
    },
  };
}
