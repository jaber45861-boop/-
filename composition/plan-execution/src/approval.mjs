// Grimoire v3 — Plan–Execution approval vocabulary and identity helpers
// (Change-Set CS-13; contract: docs/v3/23-policy-approval-contract.md §2–§4).
//
// This file owns the composition layer's entire approval vocabulary:
//   APPROVAL_VERDICT_FIELDS  the exact three-field verdict schema (23 §3)
//   wellFormedVerdict        the D1 schema belt — mechanically testable,
//                            no coercion, own data properties only (23 §3)
//   planIdentity             SHA-256 of the canonical frozen-plan bytes
//                            (23 §4.1; canonical order per 19 §13)
//   executionIdentity        SHA-256 of the canonical execution sub-request
//                            bytes (23 §4.2; sorted keys, recursive)
//
// Determinism (23 §4/§4.4, 22 §7): both identity functions are pure
// functions of artifact content — no clock, no randomness, no PID, no
// environment state, no hidden mutable state, and no reliance on object
// key-insertion order (order comes from the contract). Identical content
// yields identical digests, byte-identical across processes and runs.
// Digests are lowercase hex over the UTF-8 bytes of the canonical string.
// Golden vectors V1–V3 (23 §4.3) pin the algorithm.
//
// Boundary (23 §2/§8.13, PE-16): SHA-256 is implemented here
// dependency-free (FIPS 180-4) with zero imports — no built-ins, no
// dynamic loading — so every import specifier in this layer stays `./`-
// only and the PE-16 scan is unchanged. Nothing here builds a report,
// registers anything, or holds state: an identity call is a pure
// computation over its argument.

/** 23 §3 — the verdict's exact three own data properties, in contract order. */
export const APPROVAL_VERDICT_FIELDS = Object.freeze(["granted", "plan", "execution"]);

/** 23 §3 — both binding digests: lowercase hex, exactly 64 characters. */
const HEX64 = /^[0-9a-f]{64}$/;

const isPlainObject = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const hasNoSymbols = (value) => Object.getOwnPropertySymbols(value).length === 0;

// ---------------------------------------------------------------------------
// Canonicalization (23 §4 shared rules)
// ---------------------------------------------------------------------------

/**
 * Plan canonical string (23 §4.1): exactly the seven approved fields in the
 * fixed order `tier, depth, task, changes, verification, risks, review`
 * (inside each change `{file, why}`; inside review `{required, trigger}`),
 * compact separators, JSON string encoding by ECMA-262 reference, arrays in
 * stored order, never sorted. Any unknown/missing field, non-string value,
 * or any number (rule N) ⇒ not canonicalizable (null).
 */
function canonicalPlanString(plan) {
  if (!isPlainObject(plan) || !hasNoSymbols(plan)) return null;
  const planKeys = Object.getOwnPropertyNames(plan);
  if (planKeys.length !== 7) return null;
  for (const field of ["tier", "depth", "task", "changes", "verification", "risks", "review"]) {
    if (!planKeys.includes(field)) return null;
  }
  const { tier, depth, task, changes, verification, risks, review } = plan;
  if (typeof tier !== "string" || typeof depth !== "string" || typeof task !== "string") return null;

  if (!Array.isArray(changes)) return null;
  const changeParts = [];
  for (const entry of changes) {
    if (!isPlainObject(entry) || !hasNoSymbols(entry)) return null;
    const entryKeys = Object.getOwnPropertyNames(entry);
    if (entryKeys.length !== 2 || !entryKeys.includes("file") || !entryKeys.includes("why")) return null;
    if (typeof entry.file !== "string" || typeof entry.why !== "string") return null;
    changeParts.push(`{"file":${JSON.stringify(entry.file)},"why":${JSON.stringify(entry.why)}}`);
  }

  if (!Array.isArray(verification) || !Array.isArray(risks)) return null;
  const stringParts = (values) => {
    const parts = [];
    for (const value of values) {
      if (typeof value !== "string") return null;
      parts.push(JSON.stringify(value));
    }
    return parts;
  };
  const verificationParts = stringParts(verification);
  if (verificationParts === null) return null;
  const riskParts = stringParts(risks);
  if (riskParts === null) return null;

  if (!isPlainObject(review) || !hasNoSymbols(review)) return null;
  const reviewKeys = Object.getOwnPropertyNames(review);
  if (reviewKeys.length !== 2 || !reviewKeys.includes("required") || !reviewKeys.includes("trigger")) return null;
  if (typeof review.required !== "boolean") return null;
  if (review.trigger !== null && typeof review.trigger !== "string") return null;
  const trigger = review.trigger === null ? "null" : JSON.stringify(review.trigger);

  return (
    `{"tier":${JSON.stringify(tier)},` +
    `"depth":${JSON.stringify(depth)},` +
    `"task":${JSON.stringify(task)},` +
    `"changes":[${changeParts.join(",")}],` +
    `"verification":[${verificationParts.join(",")}],` +
    `"risks":[${riskParts.join(",")}],` +
    `"review":{"required":${review.required},"trigger":${trigger}}}`
  );
}

/**
 * Execution canonical string (23 §4.2): generic recursive canonical JSON —
 * object keys sorted lexicographically by UTF-16 code units (the default
 * string comparison), compact separators, arrays in stored order; strings,
 * booleans, null, and finite numbers (ECMA-262 number-to-string, `-0` → `0`)
 * only. Any other value — undefined, function, symbol, bigint, NaN,
 * ±Infinity, a non-plain object, a cyclic reference, or a non-object root —
 * ⇒ not canonicalizable (null).
 */
function canonicalExecutionString(value) {
  if (value === null || typeof value !== "object") return null;
  if (!Array.isArray(value) && !isPlainObject(value)) return null;
  const path = new Set();
  const encode = (item) => {
    if (item === null) return "null";
    const type = typeof item;
    if (type === "string") return JSON.stringify(item);
    if (type === "boolean") return item ? "true" : "false";
    if (type === "number") return Number.isFinite(item) ? String(item) : null;
    if (type !== "object") return null;
    if (path.has(item)) return null;
    path.add(item);
    let out = null;
    if (Array.isArray(item)) {
      const parts = [];
      out = "[";
      for (const element of item) {
        const encoded = encode(element);
        if (encoded === null) { out = null; break; }
        parts.push(encoded);
      }
      if (out !== null) out = `[${parts.join(",")}]`;
    } else if (isPlainObject(item)) {
      const keys = Object.keys(item).sort();
      const parts = [];
      out = "{";
      for (const key of keys) {
        const encoded = encode(item[key]);
        if (encoded === null) { out = null; break; }
        parts.push(`${JSON.stringify(key)}:${encoded}`);
      }
      if (out !== null) out = `{${parts.join(",")}}`;
    }
    path.delete(item);
    return out;
  };
  return encode(value);
}

// ---------------------------------------------------------------------------
// UTF-8 + SHA-256 (FIPS 180-4), dependency-free
// ---------------------------------------------------------------------------

/** UTF-8 bytes of a string (no BOM, no trailing bytes). */
function utf8Bytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        code = 0xfffd; // unreachable: the canonical encoders never emit lone surrogates
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd; // unreachable: same guarantee
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/** FIPS 180-4 round constants (K). */
const K256 = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr32 = (value, bits) => ((value >>> bits) | (value << (32 - bits))) >>> 0;

/** SHA-256 digest bytes of a byte array (FIPS 180-4). */
function sha256Bytes(message) {
  const length = message.length;
  const zeros = (56 - ((length + 1) % 64) + 64) % 64;
  const total = length + 1 + zeros + 8;
  const padded = new Uint8Array(total);
  padded.set(message);
  padded[length] = 0x80;
  const bitLenLo = ((length % 0x20000000) * 8) >>> 0;
  const bitLenHi = Math.floor(length / 0x20000000) >>> 0;
  padded[total - 8] = (bitLenHi >>> 24) & 0xff;
  padded[total - 7] = (bitLenHi >>> 16) & 0xff;
  padded[total - 6] = (bitLenHi >>> 8) & 0xff;
  padded[total - 5] = bitLenHi & 0xff;
  padded[total - 4] = (bitLenLo >>> 24) & 0xff;
  padded[total - 3] = (bitLenLo >>> 16) & 0xff;
  padded[total - 2] = (bitLenLo >>> 8) & 0xff;
  padded[total - 1] = bitLenLo & 0xff;

  const w = new Array(64);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = (rotr32(w15, 7) ^ rotr32(w15, 18) ^ (w15 >>> 3)) >>> 0;
      const s1 = (rotr32(w2, 17) ^ rotr32(w2, 19) ^ (w2 >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];
    for (let i = 0; i < 64; i += 1) {
      const bigS1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (hh + bigS1 + ch + K256[i] + w[i]) >>> 0;
      const bigS0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (bigS0 + majority) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const digest = [];
  for (const word of h) {
    digest.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return digest;
}

/** Lowercase hex digest of a byte array. */
function toHex(bytes) {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function digestOf(canonical) {
  if (canonical === null) return null;
  return toHex(sha256Bytes(utf8Bytes(canonical)));
}

// ---------------------------------------------------------------------------
// Public identities (23 §4.1/§4.2)
// ---------------------------------------------------------------------------

/**
 * `planIdentity(plan) = sha256(utf8(canonicalPlan))` (23 §4.1).
 * Returns the lowercase hex digest, or null when the plan is not
 * canonicalizable (the GATE maps null to refusal D4).
 */
export function planIdentity(plan) {
  try {
    return digestOf(canonicalPlanString(plan));
  } catch {
    return null;
  }
}

/**
 * `executionIdentity(execution) = sha256(utf8(canonicalExecution))` (23 §4.2).
 * Returns the lowercase hex digest, or null when the execution sub-request
 * is not canonicalizable (the GATE maps null to refusal D4).
 */
export function executionIdentity(execution) {
  try {
    return digestOf(canonicalExecutionString(execution));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verdict schema belt (23 §3 step 3 — refusal D1)
// ---------------------------------------------------------------------------

/**
 * The D1 schema belt: a verdict is well-formed iff it is a plain object
 * (prototype `Object.prototype` or null; a Promise/thenable is not one),
 * carrying exactly the three own data properties `granted`, `plan`,
 * `execution` — no more, no fewer — with `granted` exactly boolean and both
 * digests matching `^[0-9a-f]{64}$`. Own properties only; no coercion of any
 * kind (no lowercasing, no trimming, no type juggling); a property access
 * that throws ⇒ not well-formed. Returns the normalized own values on
 * success and null on any violation.
 */
export function wellFormedVerdict(value) {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    if (Object.getOwnPropertySymbols(value).length > 0) return null;
    const keys = Object.getOwnPropertyNames(value);
    if (keys.length !== APPROVAL_VERDICT_FIELDS.length) return null;
    for (const field of APPROVAL_VERDICT_FIELDS) {
      if (!keys.includes(field)) return null;
    }
    const granted = value.granted;
    const planDigest = value.plan;
    const executionDigest = value.execution;
    for (const field of APPROVAL_VERDICT_FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor === undefined || !("value" in descriptor)) return null;
    }
    if (typeof granted !== "boolean") return null;
    if (typeof planDigest !== "string" || !HEX64.test(planDigest)) return null;
    if (typeof executionDigest !== "string" || !HEX64.test(executionDigest)) return null;
    return { granted, plan: planDigest, execution: executionDigest };
  } catch {
    return null;
  }
}
