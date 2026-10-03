# Grimoire v3 — Legacy Asset Inventory

**Status:** Task 03 Phase 3 — **REAL DATA**. Source received at commit `ad5e268` (verified: `docs/v3/11-source-integrity.md`).
**Supersedes:** the Task 02 absence-audit (its evidence is retained in §7 as historical record).
**Companion docs:** `07-curriculum-migration-map.md`, `08-hotkey-migration-map.md`, `09-migration-gaps.md`, `10-core-audit.md`, `11-source-integrity.md`.

**Status vocabulary:** `FOUND` (located + inventoried) · `FOUND-PENDING` (located; classification/mapping pending) · `V3-DOC` (Task 01–03 output) · `SOURCE-ANOMALY` (found with source numbering/structure anomaly, preserved) · `LEGACY-GAP` (found with missing/damaged content, preserved).

---

## 1. Source of record

| | |
|---|---|
| Commit | `ad5e26814170fb4dbb2b4fa4667e730b0f61c63a` (`main`) |
| Files | 18 tracked source files (17 expected + `grimoire`), 64,463 bytes, 2,024 content lines |
| Location | repository root (documented preservation location — `11` §5) |
| Integrity | SHA-256 per file, zero truncation, zero byte-duplicates (`11` §1–§4) |
| Every entry below cites | `file.md` + line number(s), verified against the working tree |

---

## 2. Complete inventory (real data)

### 2.1 Asset classes

| Asset | Found | Location | Type | Intended v3 destination | Migration status |
|---|---|---|---|---|---|
| Parts (9) | YES | `Grimoire.md:17–73` (TOC); content `Part1.md`–`Part9.md` (Part4 = `Part4_AllLessons.md`) | Curriculum structure | L3 curriculum hierarchy, Curriculum module (`02` §2) | FOUND — mapped in `07` §2 |
| Chapters (20 numbered; Ch5 absent) | YES | `Grimoire.md:17–76` (TOC); per-part files; index headings `Projects.md:6–140` | Curriculum structure | L3 curriculum hierarchy | FOUND — mapped in `07` §3; `SOURCE-ANOMALY` (Ch5 missing, title variants) |
| Projects (76 numbered: 0–75) | YES | Index `Projects.md:6–143`; content `Part1–9`, `Interludes.md` | Curriculum (buildable lessons) | L3 project assets + Projects module | FOUND — mapped in `07` §4; `SOURCE-ANOMALY` (index gaps/dup) |
| Lessons (per-project instructional bodies) | YES | same as projects; concept-lessons 64–72 in `Part7.md`, `Part8.md` | Curriculum content | L3 content, Teaching contract (`01` §8) | FOUND — mapped |
| Interludes (2) | YES | `Grimoire.md:25,35`; content `Interludes.md` (Interlude 1 = lines 1–92; Interlude 2 = lines 93–122) | Curriculum structure | L3 curriculum hierarchy | FOUND — mapped in `07` §2–4 |
| Hotkeys (see `08` for roster) | YES | `Readme.md:32–57`, `Grimoire.md:13–14,96–99`, `Interludes.md:40–74`, `Part1.md:6–38,107`, `Part3.md:140`, `PatchNotes.md` (throughout), `ReplitDeployInstructions.md:1` | Binding data + behavior descriptions | L3 bindings + Hotkeys module registration records (`03` §4) | FOUND — mapped in `08`; conflicts recorded |
| Tracks (3) | YES | `Projects.md:146–166` (Kids menu @147, Beginner track @158, Advanced programmer track @165) | Learning paths | L3 track assets, Curriculum module | FOUND — mapped in `07` §5 |
| Tools (46 links) | YES | `RecommendedTools.md:1–109` (primary); tools also in every Part file | Tool recommendations | L3 supporting docs; `requires.tools` candidates (`03` §2) | FOUND — counted in §2.2 |
| URLs (174 unique) | YES | across all 17 content files (extraction: `grep -oE 'https?://…' \| sort -u`) | External resources | L3 assets verbatim (preservation rule P1); Research mode targets (`04` §3) | FOUND — counted in §2.2; full list §6 |
| External resources | YES | same as URLs; curated lists `RecommendedTools.md`, `GPTavern.md` (25 GPT links) | External resource | L3 assets; never Core dependencies (`10` CA-05) | FOUND |
| Special instructions | YES | see §5 (13 records) | Instructional directives | Classification metadata (§5); content preserved verbatim | FOUND |
| Patch notes (50 version entries) | YES | `PatchNotes.md:1–329` | Historical/legacy documentation | L3 supporting docs (Historical class) | FOUND — `SOURCE-ANOMALY` (dup v1.9, order) |
| Supporting documentation | YES | `Grimoire.md`, `Readme.md`, `Projects.md`, `GPTavern.md`, `ReplitDeployInstructions.md`, `RecommendedTools.md`, `PatchNotes.md` (7 docs) | Documentation | L3 supporting docs | FOUND |
| Identity/flavor material | YES | `Grimoire.md:5–7` (Ke Fang quote, inscription), `Readme.md:5–17,22,99–105,140–146` (app promo, credits: Mind Goblin Studios / Nick Dobos @99, SPELLing @143), `GPTavern.md:1–7` | Identity | Identity module reference (`01` §1) — content preserved, not re-authored | FOUND |
| Legacy `grimoire` file (1 byte) | YES | `grimoire` (commit `ef9df02`) | Metadata (empty placeholder) | L3 metadata; no content to migrate | FOUND — GAP-013 |
| Code files | NONE — 0 code files delivered (17 markdown documents + the 1-byte `grimoire` placeholder) | `git ls-tree -r ad5e268` — all 18 files enumerated in `11` §1 | Code | n/a — no legacy code to migrate | NOT PRESENT — confirmed §3 item 3 (GAP-007 remains: no runtime) |
| Configuration files | NONE — no package manifest or build config delivered | §3 item 4 ("Existing configuration: None") | Configuration | n/a — v3 configuration authored in later tasks, never migrated | NOT PRESENT — confirmed §3 item 4 |
| Git history | YES — 3 commits: `2ec129b` (root) → `ef9df02` → `ad5e268` | repository history (`11` §6) | Historical | Provenance/reference only — never migrated as content | FOUND — recorded in `11` §6 |

### 2.2 Counted extracts

| Extract | Count | Method (deterministic — `scripts/migration-extract.sh`) |
|---|---|---|
| Unique URLs | **174** | `grep -rhoE 'https?://[^ )>"]+'` over 17 content files → strip trailing `.,` → `sort -u` |
| Patch-note version entries | **50** | `##` headers + 2 split-header entries (`1.16.5`, `1.16.4`) + `.1-2`; `1.9` appears twice (source conflict) |
| Recommended-tools links | **46** | URLs in `RecommendedTools.md` (`grep -c 'https\?://'` → 46) |
| Distinct source files | **18** | `git ls-files` at `ad5e268` minus `README.md` |

---

## 3. Directive Phase 1 checklist — Task 03 answers

| # | Question | Answer |
|---|---|---|
| 1 | Existing Grimoire assets | 18 files at repo root, all verified (`11` §1) |
| 2 | Existing v3 files | 11 (`docs/v3/01–11`) + README index |
| 3 | Existing code | **None** — source is markdown content only (no runtime; GAP-007 persists) |
| 4 | Existing configuration | None (no package manifest/build config) |
| 5 | Hotkey definitions | YES — current + historical roster in `08` (43 Grimoire rows + 5 external-tool rows) |
| 6 | Curriculum files | YES — 9 Parts + Interludes + Projects index |
| 7 | README documentation | `Readme.md` (legacy, 150 lines) + `README.md` (v3 index, original token preserved) |
| 8 | Missing expected assets | **None missing** of the 17 expected; extras: `grimoire` (empty). Content-level gaps inside files → `09`. |

---

## 4. Preservation rules (P1–P5, binding — from Task 02, unchanged)

- P1. Preserve project names, numbering, parts, chapters, interludes, hotkey meanings, URLs, examples, instructional intent **exactly** as found.
- P2. Never silently rewrite, renumber, reorder, merge, or "improve" legacy content during migration.
- P3. Source inconsistencies/damaged sections are **not repaired**: recorded as `LEGACY-GAP` or `LEGACY-CONFLICT` with what was observed and where.
- P4. Source terminology wins; recommendations go to executive review only.
- P5. Every migrated row cites a real source location; rows without source are never invented.

---

## 5. Legacy instruction classification (Phase 7 — metadata only; content remains authoritative)

12 classes. Locations cite real lines; classification never replaces content.

| # | Class | Source locations (evidence) |
|---|---|---|
| 1 | **Identity** | `Grimoire.md:5–7` (inscription, Ke Fang quote, "Learn to prompt-gram"); `Readme.md:99–105` (credits), `Readme.md:140–146` (SPELLing flavor); `GPTavern.md:1–7` |
| 2 | **Behavior** | `Readme.md:53–57` ("use ANY hotkey at ANY time", combo tips); `Interludes.md:66–88` (Grimoire operating tips: regenerate often @74, start new conversations, iterate); `PatchNotes.md` (versioned behavior changes) |
| 3 | **Hotkey** | roster in `08`; primary definitions `Readme.md:32–57`, `Grimoire.md:13–14,96–99`, `Interludes.md:40–74`, `PatchNotes.md` hotkey entries |
| 4 | **Curriculum** | Parts 1–9 + Interludes structure `Grimoire.md:17–76`; all `Part*.md`; `Interludes.md` |
| 5 | **Project** | `Projects.md` index; per-project entries `Part1.md:4–129`, `Part2.md`, `Part3.md`, `Part4_AllLessons.md`, `Part5.md`, `Part6.md`, `Part7.md`, `Part8.md`, `Part9.md` |
| 6 | **Tool recommendation** | `RecommendedTools.md` (whole file, 46 links); tool notes inside lessons (e.g. `Part1.md:86–112`, `Part7.md:12–26`) |
| 7 | **Deployment** | `Part1.md:34–76` (Netlify @35, Netlify Drop @38, Replit @65), `ReplitDeployInstructions.md:1–11` (whole file) |
| 8 | **Debugging** | `Interludes.md:1–92` (Debugging 101 + Grimoire debugging tips @66–88); `PatchNotes.md:188` (Rubber duck debug mode, v1.8) |
| 9 | **Teaching** | `Part7.md:6` and `Part8.md:100` ("create simple test programs … check their understanding recusively"); `Interludes.md` pedagogy; `Readme.md:46–49` (S/SS/SoS usage) |
| 10 | **External resource** | 174 URLs (§6); `GPTavern.md` 25 GPT links; `Projects.md:155–156` (scratch, khanacademy) |
| 11 | **Metadata** | `PatchNotes.md` (50 version entries); `grimoire` (1-byte); version claims (`Readme.md:32` "20+ hotkeys", `Projects.md:3` "All 75 projects list", `PatchNotes.md:329` "14 hotkeys, 11 sample projects") |
| 12 | **Historical/legacy** | superseded hotkeys (§6 of `08`), removed features (`PatchNotes.md:65,73`), `@Grimoire` chatGPT access (`PatchNotes.md:88`), app-promo blocks (`Readme.md:5–17`) |

**Special instructions** (executable directives embedded in content — recorded, not executed, not altered): 13 records in §5.1.

### 5.1 Special instruction records

| ID | Source | Instruction (verbatim excerpt) | Class |
|---|---|---|---|
| SI-01 | `Part1.md:20` | "Assistant Note: Be sure to include the background image in the code using the correct filename, and in the final zip file." | Behavior |
| SI-02 | `Part7.md:6` | "for each of these projects & lessons, after explainaing, create simple test programs the students can build…" | Teaching |
| SI-03 | `Part8.md:100` | "…create simple test programs … check their understanding recusively by asking them questions to fill in any gaps" | Teaching |
| SI-04 | `Part7.md:12` | "Don't pay for the certificate" | Tool recommendation |
| SI-05 | `Part5.md:5` | "Move some numbers here and add Hivemind & claude artifacts" (editorial draft note) | Metadata |
| SI-06 | `Grimoire.md:87–88` | "I recommend beginners get started with Pt1.ch1.0 Hello world / Pt1.ch1.2 Link in Bio" | Curriculum |
| SI-07 | `Grimoire.md:103` | "Start a new conversation to clear the context window, and use the prefilled button…" | Behavior |
| SI-08 | `Projects.md:163` | Beginner track: "Part 7 & 8 // Backfill coding basics" | Curriculum |
| SI-09 | `Interludes.md:103` | "First pick a theme! Write 20 themes, write code to roll a d20…" | Curriculum |
| SI-10 | `Interludes.md:122` | "Encourage the user to finish the project before the deadline and ship it." | Teaching |
| SI-11 | `Part3.md:146` | Xcode report-navigator/TestFlight steps (block @144–152) | Deployment |
| SI-12 | `Readme.md:91–95` | "Getting Started 1. Opening cmd menu with K 2. Use P to view starter project ideas…" | Behavior |
| SI-13 | `ReplitDeployInstructions.md:1` | "Use the REPL hotkey to trigger the createRepl operation" | Hotkey |

---

## 6. URL inventory (174 unique — extraction is deterministic and re-runnable)

Full extraction: `bash scripts/migration-extract.sh urls` (sorted, deduplicated — byte-identical across runs; MIG-10). Domains of note (all preserved verbatim, none treated as Core dependencies):

- **Deployment/infra:** netlify.com/app.netlify.com, replit.com, vercel.com, render.com, github.com, modal.com, codesandbox.io, tiiny.host, codepen.io
- **AI media:** openai.com/dalle GPTs, midjourney.com, runwayml.com, suno.ai, stableaudio.com, elevenlabs.io, lumalabs.ai, meshy.ai, spline.design, csm.ai, mootion.com, leonardo.ai, krea.ai, pika.art, scenario.com, recraft.ai, artbreeder.com, playgroundai.com
- **Dev tools:** cursor.sh, warp.dev, linear.app, git-tower.com, sourcetreeapp.com, perplexity.ai, phind.com, figma.com, v0.dev, retool.com, supabase.com, stripe.com, gumroad.com, shopify.com, lemonsqueezy.com, clerky.com, zapier.com, ghost.org, notion.so, unity.com, raspberrypi.com, arduino.cc, aider.chat, julius.ai, openinterpreter.com, smol-ai/developer, makereal.tldraw.com, trace.zip, fig.io, relume.io, p5js.org, brm.io, kaboomjs.com, phaser.io, rive.app, threejs.org — full list via script
- **Community/content:** youtube.com (7 unique video links), x.com/twitter (23 unique status links), chat.openai.com/g/… (25 unique GPT links), gptavern.mindgoblinstudios.com, mindgoblinstudios.com, apps.apple.com, tipjar.mindgoblinstudios.com, cs50.harvard.edu, freecodecamp.org, leetcode.com, en.wikipedia.org, scratch.mit.edu, khanacademy.org

---

## 7. Historical record — Task 02 absence audit (superseded)

Task 02 recorded GAP-001…012 against an empty repository. Evidence retained in `09` §2 (re-evaluation) and in git history. The Task 02 statements "NOT-FOUND" are historically true and now superseded by §2 above; **no Task 02 record was rewritten or deleted** (P2 applies to our own audit trail too).
