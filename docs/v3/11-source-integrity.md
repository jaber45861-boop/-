# Grimoire v3 — Source Integrity

**Status:** Task 03 Phase 1 complete. Source **received and verified**.
**Authoritative source commit:** `ad5e26814170fb4dbb2b4fa4667e730b0f61c63a` (`main`, "Add files via upload"), parent `ef9df02` ("Create grimoire"), root `2ec129b` ("Create README.md").
**Verification date:** 2026-10-02. All hashes computed from the working tree after `git pull --ff-only`, cross-checked against `git status` (no modifications).

---

## 1. Files received (18)

Expected 17 files — **all 17 present**, plus 1 unexpected extra (`grimoire`).

| # | Filename | Path | Bytes | Lines (content) | SHA-256 | Readable | Complete | Duplicate |
|---|---|---|---|---|---|---|---|---|
| 1 | GPTavern.md | `GPTavern.md` | 3289 | 131 | `4b1998a7b4e0496c1f59667cabfdb32ce4177aadeb054dd5c40776f9c4a496f6` | YES | YES | no |
| 2 | Grimoire.md | `Grimoire.md` | 3002 | 104 | `25923ccd9f28457ef223fbc73511d3722aa0425cfa88a8cce05159761b1fedf6` | YES | YES | no |
| 3 | Interludes.md | `Interludes.md` | 5046 | 122 | `09f822822d36bbf47199c225d0a8298a47466e90265cb041a77c9e9dd2b34044` | YES | YES | no |
| 4 | Part1.md | `Part1.md` | 8064 | 154 | `57fd3a66aa2033fed53a6ea8950306d2534fae8b6157b85c379d2dea8a76cc9d` | YES | YES | no |
| 5 | Part2.md | `Part2.md` | 3168 | 90 | `5bdba963d153b6343d9deb6c983a4a79c4dbb2978a81b694f03e68e54fe73aba` | YES | YES | no |
| 6 | Part3.md | `Part3.md` | 5671 | 173 | `b2b7be41dac571ab5fd668d3eeca4b7a23de0cc8c546d2e1c626b9dd3e1bf261` | YES | YES | no |
| 7 | Part4_AllLessons.md | `Part4_AllLessons.md` | 768 | 29 | `10280b94c35b301ea3cdb208428a08c140fded3e4037785f8287ca2dd06101f1` | YES | YES (short but ends coherently) | no |
| 8 | Part5.md | `Part5.md` | 986 | 33 | `3cf6bbcaea2bed6b448dbafb984b7144215ddb1643d50f8479d3fb5365bebe11` | YES | YES (contains source "damaged" narrative — content, not truncation) | no |
| 9 | Part6.md | `Part6.md` | 593 | 8 | `df8ed47e1c4b31cf0aa346029e85423fdbe11c0c7552fbae16d0307f22fea9a0` | YES | YES (ends mid-document coherently) | no |
| 10 | Part7.md | `Part7.md` | 7180 | 269 | `5ff88ed6d43d13eec945f7646831cc0b1c0088049885174bdb8aac4a1e1ff290` | YES | YES structurally; §68/§69 have empty bodies (source-incomplete, see §2) | no |
| 11 | Part8.md | `Part8.md` | 4719 | 101 | `8dd3499a49bd374747842f00099678209a3ea3458f2e542e51d616add4ae259d` | YES | YES | no |
| 12 | Part9.md | `Part9.md` | 851 | 25 | `7d8cbbcb086a7842d78a85e4a26c32f71b223af4439df8a82e378c0eeea108c7` | YES | YES (source "damaged" narrative at end — content) | no |
| 13 | PatchNotes.md | `PatchNotes.md` | 9231 | 329 | `0e6df56d98ac18fafd324e815ccf7c82fef1ea4748969eaac65325c436b25a87` | YES | YES (ends at v1.0 release note) | no |
| 14 | Projects.md | `Projects.md` | 4892 | 185 | `562c8d98b54c922ccad6b84cdb790de241fe46ab49e18bc1527f392e698d7d7a` | YES | YES structurally; index has numbering gaps (see `07` SOURCE-ANOMALY records) | no |
| 15 | Readme.md | `Readme.md` | 4164 | 150 | `0bda8661f24db7df632d633bbc040b887e708043e69d2fee672aa701664caeeb` | YES | YES | no |
| 16 | RecommendedTools.md | `RecommendedTools.md` | 2289 | 109 | `2017c1faf0c2006c1400a568b5f4c65445a4b0bf96853457ccecaed70a799c09` | YES | YES | no |
| 17 | ReplitDeployInstructions.md | `ReplitDeployInstructions.md` | 549 | 11 | `b7e6e7f3a2e69f79927f0a7681902c225fdce72e035522baccf60a288c0000f5` | YES | YES | no (near-duplicate content of Part1 §Replit — see §4) |
| 18 | grimoire | `grimoire` | 1 | 1 | `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` (SHA-256 of a single `\n`) | YES | Unexpected extra — effectively empty, 1 byte, no content | no |

Totals: **18 files, 64,463 bytes, 2,024 content lines** (line counts via `grep -c ''`; 12 of the files lack a final newline — typical of GitHub web upload — so `wc -l` under-reports by 1 for those. Cross-check: `git pull` reported exactly **2,024 insertions** for these 18 files ✓).

---

## 2. Truncation / corruption scan

Method: read every file end-to-end; print last 60 bytes of each file; compare with narrative structure.

- **No file ends mid-token or mid-sentence.** All 17 content files terminate on complete sentences/URLs/headings (tails captured 2026-10-02).
- **"Damaged" text is source content, not truncation.** The phrases *"It appears the pages have been damaged, and a portion of the book is missing"* (Grimoire.md, Projects.md, Part5.md) and *"…the rest of the book is missing"* (Part9.md) are the source's in-world narrative framing. They are preserved verbatim and flagged `LEGACY-GAP` where they mark missing lesson bodies (project 58, 59, 61, 75).
- **Source-incomplete sections (not truncation):** Part7.md project 68 (`:266`) and project 69 (`:269`) have headings but empty bodies; Part5.md contains an editorial draft note *"Move some numbers here and add Hivemind & claude artifacts"* (line 5); Part7/Part8 contain unresolved placeholders (`<show mathmatic notation for these loops>`, `<Compare sorting algorithms>`, `<Explain these>`, `explain pointers & references`). All recorded as `LEGACY-GAP`, preserved verbatim.
- **Stop condition 2 (truncated/corrupted files): NOT TRIGGERED.**
- **Stop condition 3 (wrong version): NOT TRIGGERED** — commit `ad5e268` is the tip of `main`, matching the executive's delivery ("extracted and committed").

---

## 3. Readability & encoding

All 18 files are plain UTF-8 markdown readable without transformation. Non-ASCII present (emoji in GPTavern/Interludes, `→` glyphs, Arabic-script token in the separate root `README.md`) — all read cleanly. No binary files, no null bytes (`grimoire` is a single newline).

---

## 4. Duplicate status

**Byte-level:** all 18 SHA-256 hashes distinct → **zero byte-identical duplicates**.

**Content-level near-duplicates (both preserved, neither deleted):**

| Overlap | Locations | Note |
|---|---|---|
| Replit deploy walkthrough | `Part1.md` lines 66–76 ≈ `ReplitDeployInstructions.md` lines 2–10 | Near-verbatim; `ReplitDeployInstructions.md` is the standalone form ("trigger the createRepl operation"). Preserved both (no merge — P2). |
| GPTavern members list | `GPTavern.md` (full) vs `Readme.md` lines 121–131 (Exec func, Gif-PT) | Readme shows a subset. |
| App promo block | `Readme.md` lines 4–17 ≈ `PatchNotes.md` v2.7 block | Near-verbatim. |
| Beginner getting-started text | `Grimoire.md` "Getting Started" ≈ `Projects.md` "Getting Started" | Near-verbatim with small differences (preserved). |

**Case-collision note:** root `README.md` (Task 01 index + original token) and legacy `Readme.md` are **distinct tracked files with distinct hashes**. No collision on this Linux filesystem; would collide on case-insensitive filesystems → recorded as GAP-014.

**File named `grimoire` (1 byte):** unexpected extra file from commit `ef9df02`; empty placeholder. Preserved; classified Metadata. Recorded as GAP-013.

**Stop condition 4 (major duplication/conflict): NOT TRIGGERED** — overlaps are partial and intentional-looking; no competing full versions of any file.

---

## 5. Preservation location (Phase 2)

The source lives at the **repository root**, committed verbatim at `ad5e268`. Per the directive's carve-out ("If the repository already contains the source … document that location instead of unnecessarily duplicating it"), **no `legacy/` copy was created** — a second copy would create drift risk between original and duplicate. Byte-for-byte recovery is guaranteed two ways:

1. `git show ad5e268:<filename>` (exact committed bytes), and
2. the SHA-256 table in §1 (verified against working tree; `git status` shows zero modifications to source files).

*(Decision surfaced for executive review — see final report §11; if a physical `legacy/` copy is wanted anyway, it is a one-command follow-up.)*

---

## 6. Source commit traceability

| Field | Value |
|---|---|
| Source commit SHA | `ad5e26814170fb4dbb2b4fa4667e730b0f61c63a` |
| Branch | `main` |
| Verification | `git ls-remote origin` → same SHA at `HEAD` and `refs/heads/main` at time of intake |
| Migration outputs traced to | this SHA (recorded in `07`, `08`, and the repeatability test MIG-10) |
