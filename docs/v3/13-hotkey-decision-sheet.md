# Grimoire v3 — Executive Hotkey Decision Sheet (GAP-017 + GAP-009)

**Status:** Task 04 Phase 9 — advisory only.
**Scope:** the 10 GAP-017 hotkeys (5 conflicting + 5 ambiguous) and the 3 GAP-009 insufficient-information hotkeys, as registered `BLOCKED_*` in `12-hotkey-registry.md`.

> **RECOMMENDATIONS ARE NOT DECISIONS.** Nothing on this sheet activates, renames, merges, or reinterprets a hotkey. Every recommendation below is advisory input for the executive. A ruling takes effect only when recorded in a future task that updates the registry (`12`) — this file changes no status by itself. All 13 hotkeys remain `BLOCKED_*` and non-executable as of this task.

**How to rule:** for each item choose *Recommended default*, *Alternative*, or *Custom* (a custom ruling must state the behavior and cite evidence — the agent will not fill gaps). Record rulings in §Decision log; the applying task then updates `12` and re-runs HK-01…HK-10.

---

## Part A — GAP-017 · Conflicting hotkeys (registered `BLOCKED_CONFLICT`)

### A1 · `K` — command menu vs debug-row membership
1. **Legacy key:** `K` (command `grimoire.key.K`, `12` row 1)
2. **Legacy source reference:** `Readme.md:36`; `Readme.md:147`; `Grimoire.md:99`; `Readme.md:41`; `Interludes.md:70`
3. **Current classification:** `BLOCKED_CONFLICT` · mode recorded TOOL · validation `PENDING_RULING`
4. **Evidence:** `Readme.md:36` `"K" to open cmd menu`; `Readme.md:147` `K for cmd menu`; `Grimoire.md:99` `K for cmd menu` — vs `Readme.md:41` debug row `A S D F G H J K` while the parallel Interludes debug row (`Interludes.md:70`: `A, S, SS SoS, D, F, G, H, J`) omits K.
5. **Possible interpretation(s):** (a) K is only the command menu and the Readme debug-row listing is a source inconsistency; (b) K has an additional debug-context role that no source states.
6. **Recommended default:** (a) menu-only — three explicit menu citations against one bare row listing; mode TOOL (menu = declared micro-behavior, `08` §2).
7. **Alternative:** keep blocked until another source passage states a K debug behavior.
8. **Risk if activated as-is:** pressing K expecting a debug action opens the command menu — safe and reversible; *inventing* a debug behavior from the row listing alone would violate the no-invented-behavior rule, so (b) must not be implemented without a written behavior spec.
9. **What evidence would resolve it:** an executive ruling on whether `Readme.md:41` is authoritative; or any patch-note/older-Readme passage naming a K debug behavior.
10. **Activation impact:** ruling (a) → status moves `BLOCKED_CONFLICT` → `ADAPTER_REQUIRED` with a new `grimoire.adapter.K` declaration (menu open, TOOL) in a future task; ruling (b) → blocked until the debug behavior is documented.

### A2 · `KY` — recommended-tools key vs Y's tools role
1. **Legacy key:** `KY` (command `grimoire.key.KY`, `12` row 9)
2. **Legacy source reference:** `PatchNotes.md:197`; `PatchNotes.md:264`; `PatchNotes.md:65`; `PatchNotes.md:78`
3. **Current classification:** `BLOCKED_CONFLICT` · mode ANSWER · validation `PENDING_RULING`
4. **Evidence:** `PatchNotes.md:264` `- Fix duplicate google and tools hotkey. Tools is now Y.` (older); `PatchNotes.md:197` `Recommended Tools: Y->KY` (newer); `PatchNotes.md:65` `- Remove I and Y hotkeys.` (newest, v2.1); `PatchNotes.md:78` `…Use Pt9 or KY hotkeys to learn more.` — the tools key changed hands twice and two keys (KY, Y) are both documented as "tools".
5. **Possible interpretation(s):** (a) KY is the surviving recommended-tools key — the chronology Y→KY plus Y's removal settles it; (b) the conflict is real until a single current-version statement names the tools key.
6. **Recommended default:** (a) confirm KY as the recommended-tools key (mode ANSWER, content opener, `tools: none`) — every later citation agrees, and the competing key was explicitly removed.
7. **Alternative:** remain blocked until the executive accepts the chronology reading.
8. **Risk if activated:** opening the tools list when another key was expected — low impact, content-only.
9. **What evidence would resolve it:** executive confirmation that `:264 → :197 → :65` chronology is final; no further source evidence exists.
10. **Activation impact:** ruling (a) → `BLOCKED_CONFLICT` → `ACTIVE` (ANSWER mode, no adapter needed); ruling (b) → unchanged.

### A3 · `NM` — manual Netlify Drop (single-mention duplicate of ND)
1. **Legacy key:** `NM` (command `grimoire.key.NM`, `12` row 24)
2. **Legacy source reference:** `Part1.md:38`; contrasting `Part1.md:17`; `Part1.md:30`; `PatchNotes.md:124`; `Readme.md:43`
3. **Current classification:** `BLOCKED_CONFLICT` · mode recorded TOOL · validation `PENDING_RULING` (also GAP-015)
4. **Evidence:** `Part1.md:38` `Manual deploys are available via the NM hotkey using Netlify Drop` — the **only** NM mention in the source — vs ND documented three times: `Part1.md:17,30` `or use ND to manually deploy on https://app.netlify.com/drop`, `PatchNotes.md:124` `- New ND Hotkey: manual netlify deploy`, `Readme.md:43` export list `Z C V N ND L PDF`.
5. **Possible interpretation(s):** (a) NM is a typo/alias for ND; (b) NM is a distinct second key for the same behavior.
6. **Recommended default:** (a) alias of ND — one mention vs three, same behavior, same target.
7. **Alternative:** (b) distinct key — then both map to the same Netlify Drop behavior.
8. **Risk if activated:** registering both as separate commands creates duplicate bindings for one behavior; wrongly aliasing could mask a genuine second key (unlikely given the evidence, irreversible only in the sense that a later un-alias needs another ruling).
9. **What evidence would resolve it:** executive ruling (GAP-015 explicitly asks: "NM = typo for ND (likely), or a second distinct hotkey"); any additional NM mention would settle it (none exists).
10. **Activation impact:** alias ruling → `NM` record becomes `ADAPTER_REQUIRED` pointing at the existing `grimoire.adapter.ND` (no new adapter); distinct ruling → `ADAPTER_REQUIRED` with its own `grimoire.adapter.NM` (same responsibility); otherwise unchanged.

### A4 · `Y` — three roles across versions, removed at v2.1
1. **Legacy key:** `Y` (command `grimoire.key.Y`, `12` row 33)
2. **Legacy source reference:** `PatchNotes.md:264`; `PatchNotes.md:193`; `PatchNotes.md:131`; `PatchNotes.md:130`; `PatchNotes.md:197`; `PatchNotes.md:65`
3. **Current classification:** `BLOCKED_CONFLICT` · mode recorded `N/A — removed (historical)` · validation `PENDING_RULING`
4. **Evidence (chronological):** `:264` `Tools is now Y` → `:193` `- Y: Fill in gaps in my understanding, recursively ask more questions to check my understanding` → `:130` `-Y Hotkey moved, recursive question checking has been moved to Q…` → `:131` `-New Y Hotkey, high level plan, step up the anstraction ladder with Y? (Or step down and Expand with E)` → `:197` `Recommended Tools: Y->KY` → `:65` `- Remove I and Y hotkeys.` (v2.1)
5. **Possible interpretation(s):** (a) Y stays removed — every role has a successor (questions → Q, tools → KY) and removal is explicit; (b) reinstate Y with its last-documented role (high-level plan, `:131`), re-paired with E.
6. **Recommended default:** (a) stay removed — successors exist for two roles and removal is the newest statement; the record is preserved either way.
7. **Alternative:** (b) reinstate as high-level plan (PLAN mode) per `:131`.
8. **Risk if activated:** reactivating collides with KY (tools) and Q (questions); a plan-role revival also re-pairs with blocked E, doubling the undecided surface.
9. **What evidence would resolve it:** executive ruling on reactivation and, if reinstating, on which single role is authoritative.
10. **Activation impact:** ruling (a) → status moves `BLOCKED_CONFLICT` → `HISTORICAL_REMOVED` (record retained, history intact); ruling (b) → `ACTIVE`/`BLOCKED_*` per the chosen role's evidence, applied in a future task.

### A5 · `T` — tools → tavern → tests across versions
1. **Legacy key:** `T` (command `grimoire.key.T`, `12` row 35)
2. **Legacy source reference:** `PatchNotes.md:301`; `PatchNotes.md:196`; `PatchNotes.md:132`
3. **Current classification:** `BLOCKED_CONFLICT` · mode recorded TEST (last-documented role) · validation `PENDING_RULING`
4. **Evidence (chronological):** `:301` `- Added T hotkey for recommended tools` (oldest) → `:196` `Tavern : T->KT` (tavern role transferred to KT) → `:132` `-New T Hoktey, generate test cases and walk through them` (newest). T was never removed.
5. **Possible interpretation(s):** (a) T = test cases (last-documented, and no successor key holds the test role); (b) T = tools (superseded by KY); (c) T = tavern (transferred to KT).
6. **Recommended default:** (a) test cases — the most recent statement, unclaimed by any other key, already mapped TEST in `08`.
7. **Alternative:** remain blocked until the executive accepts last-wins chronology.
8. **Risk if activated:** generating test cases when the user expected tools/tavern — both alternatives are already served by KY and KT, so collisions are unlikely; impact is a wrong content generation, contained by the Completion Report.
9. **What evidence would resolve it:** executive ruling accepting last-documented-wins; a current-version statement naming T would settle it definitively (absent).
10. **Activation impact:** ruling (a) → `BLOCKED_CONFLICT` → `ACTIVE` (TEST mode, tools none, behavior from `:132`); otherwise unchanged.

---

## Part B — GAP-017 · Ambiguous hotkeys (registered `BLOCKED_AMBIGUOUS`)

### B1 · `P` — project ideas / traverse
1. **Legacy key:** `P` (command `grimoire.key.P`, `12` row 2)
2. **Legacy source reference:** `Readme.md:148`; `PatchNotes.md:115`; `PatchNotes.md:133`; contrast `Grimoire.md:13`
3. **Current classification:** `BLOCKED_AMBIGUOUS` · mode recorded TEACH · validation `PENDING_RULING`
4. **Evidence:** `Readme.md:148` `P for project ideas`; `PatchNotes.md:115` `Press P to get started!`; `PatchNotes.md:133` `-New P hotkeys and Child P hotkeys for traversing Grimoire.md` — vs PT's `Grimoire.md:13` `Use PT to open Projects.md to see all projects`.
5. **Why ambiguous:** P and PT are both documented as entry points into projects content; the source never states how P's behaviors (ideas, "get started", traverse) relate to PT's index-open, and the "Child P hotkeys" of `:133` are never enumerated anywhere.
6. **Possible interpretation(s):** (a) P = ideas/traverse and PT = index — two distinct commands with different behaviors; (b) P duplicates PT (same target).
7. **Recommended default:** (a) keep distinct — the documented behaviors differ (ideas/traverse vs index open) and distinct keys cannot collide (H3 satisfied).
8. **Alternative:** unify P under PT — would discard documented P behavior, so it requires an explicit executive statement to that effect.
9. **Risk if activated:** two near-overlapping project entry points may confuse; both are content-openers (TEACH), harm is navigational only. The un-enumerated "Child P hotkeys" must **not** be registered under any ruling — they have no source spec.
10. **What evidence would resolve it:** executive ruling on the P/PT split; source enumeration of the child-P keys would resolve that sub-question (none exists).
11. **Activation impact:** ruling (a) → P moves `BLOCKED_AMBIGUOUS` → `ACTIVE` (TEACH); ruling (b) → P becomes `HISTORICAL_REMOVED`-style record or merges under `grimoire.key.PT` per the ruling's wording.

### B2 · `PT` — open Projects.md
1. **Legacy key:** `PT` (command `grimoire.key.PT`, `12` row 3)
2. **Legacy source reference:** `Grimoire.md:13`; contrast `Readme.md:148`, `PatchNotes.md:133`
3. **Current classification:** `BLOCKED_AMBIGUOUS` · mode recorded TEACH · validation `PENDING_RULING`
4. **Evidence:** `Grimoire.md:13` `Use PT to open Projects.md to see all projects` — single explicit citation; P's project-entry citations listed under B1.
5. **Why ambiguous:** mirror of B1 — the source does not state the division of labor between P and PT.
6. **Possible interpretation(s):** (a) PT = the Projects.md index opener, distinct from P; (b) PT duplicates P.
7. **Recommended default:** (a) distinct — PT has one crisp documented behavior (open the index).
8. **Alternative:** unify under P (drops PT's sole documented citation — needs explicit executive statement).
9. **Risk if activated:** navigational overlap with P only; content-opening, TEACH mode, no tools.
10. **What evidence would resolve it:** the same executive ruling as B1 (one ruling should cover the pair).
11. **Activation impact:** ruling (a) → `ACTIVE` (TEACH); ruling (b) → record folds per the ruling's wording.

### B3 · `Z` — export (current) vs undo (historical)
1. **Legacy key:** `Z` (command `grimoire.key.Z`, `12` row 28)
2. **Legacy source reference:** `Readme.md:43`; `Part1.md:107`; `PatchNotes.md:287`; `PatchNotes.md:279`; `PatchNotes.md:140`
3. **Current classification:** `BLOCKED_AMBIGUOUS` · mode recorded TOOL · validation `PENDING_RULING`
4. **Evidence (chronological):** `:287` `- Added Z hotkey for undo` (v1.9) → `:279` `- Remove z undo, whoops that was already used` (v1.10) → current docs: `Readme.md:43` export list `Z C V N ND L PDF`, `Part1.md:107` `-Press Z` inside the export/unzip flow, `:140` `-Z` in the v1.10 tuning list.
5. **Why ambiguous:** the source never restates Z's meaning after undo's removal — `08` records "which is current not stated", even though every surviving citation is export-side.
6. **Possible interpretation(s):** (a) Z = export — the only behavior that survives `:279`; (b) Z = undo — explicitly contradicted by `:279`.
7. **Recommended default:** (a) export — undo was removed by the source itself; all live citations are export-group.
8. **Alternative:** remain blocked until a post-v1.10 statement names Z explicitly.
9. **Risk if activated:** users of the historical undo binding get an export artifact instead — contained (export produces a file; nothing destructive); expecting undo to still work is already false per `:279`.
10. **What evidence would resolve it:** executive ruling accepting the chronology; any post-v1.10 patch note naming Z would settle it (the tuning-list entry `:140` names it without a role).
11. **Activation impact:** ruling (a) → `BLOCKED_AMBIGUOUS` → `ADAPTER_REQUIRED` with `grimoire.adapter.Z` (export is an operation: TOOL + declared micro-behavior, `08` §2) in a future task; ruling (b) would require new undo evidence — not available.

### B4 · `E` — step-down Expand, partner Y removed
1. **Legacy key:** `E` (command `grimoire.key.E`, `12` row 34)
2. **Legacy source reference:** `PatchNotes.md:131`; contrast `PatchNotes.md:65`
3. **Current classification:** `BLOCKED_AMBIGUOUS` · mode recorded PLAN · validation `PENDING_RULING`
4. **Evidence:** `PatchNotes.md:131` `-New Y Hotkey, high level plan, step up the anstraction ladder with Y? (Or step down and Expand with E)` — E's only mention; `:65` `- Remove I and Y hotkeys.` removed its partner; E itself was never removed and never mentioned again.
5. **Why ambiguous:** E's documented behavior is defined relative to Y's abstraction ladder; with Y removed, the source never states whether E remains live, orphaned, or implicitly retired.
6. **Possible interpretation(s):** (a) E is orphaned but still live — expand/detail-fill works standalone (PLAN); (b) E was implicitly retired with Y's era.
7. **Recommended default:** remain blocked — no source statement of current status; (a) is plausible but unconfirmed.
8. **Alternative:** reclassify to `HISTORICAL_REMOVED` by executive decision (record kept).
9. **Risk if activated:** a plan-ladder key with no partner could confuse plan-mode flows; behavior itself (`:131` text) is documented, so activating under (a) invents nothing — the uncertainty is status, not behavior.
10. **What evidence would resolve it:** executive ruling on E's status; any post-`:65` mention of E (none exists).
11. **Activation impact:** ruling (a) → `ACTIVE` (PLAN, behavior from `:131`); ruling (b) → `HISTORICAL_REMOVED`.

### B5 · `i` — lowercase tuning-list entry, case-collision with `I`
1. **Legacy key:** `i` (command `grimoire.key.i`, `12` row 41)
2. **Legacy source reference:** `PatchNotes.md:143`; contrast `PatchNotes.md:191`; `PatchNotes.md:65`
3. **Current classification:** `BLOCKED_AMBIGUOUS` · mode recorded `UNKNOWN (GAP-009)` · validation `PENDING_RULING`
4. **Evidence:** `:143` `-i` (v2.0 tuning list — every other entry in the list is uppercase); `:191` `- I: Import. Recommend libraries, packages, resources, tools`; `:65` `- Remove I and Y hotkeys.`
5. **Why ambiguous:** `i` is case-distinct from `I` yet appears only as a bare tuning-list token; it may be a typo for `I` or a genuinely distinct key with unstated purpose. Nothing states which.
6. **Possible interpretation(s):** (a) case-typo of `I`; (b) a distinct lowercase key whose purpose the source never gives.
7. **Recommended default:** remain blocked — merging `i` into `I` would be a silent inference; splitting it out would invent a purpose.
8. **Alternative:** executive rules (a) — record folds into `grimoire.key.I`'s historical entry; or rules (b) — then it reclassifies as `BLOCKED_INSUFFICIENT_INFO` awaiting a purpose.
9. **Risk if activated:** a lowercase key executes an unknown action, or silently aliases an import command that the source removed.
10. **What evidence would resolve it:** executive ruling; patch-note context defining the v2.0 tuning-list conventions (uppercase-vs-lowercase semantics).
11. **Activation impact:** ruling (a) → merged into `I`'s `HISTORICAL_REMOVED` record; ruling (b) → status becomes `BLOCKED_INSUFFICIENT_INFO` with an evidence request (Part C style); no activation under either.

---

## Part C — GAP-009 · Insufficient information (registered `BLOCKED_INSUFFICIENT_INFO`)

Each record below includes the Phase 6 evidence request: exactly what must exist before status can change. Missing behavior is never inferred.

### C1 · `F` — debug-row member, purpose never stated
1. **Legacy key:** `F` (command `grimoire.key.F`, `12` row 16)
2. **Legacy source reference:** `Readme.md:41`; `Interludes.md:70`
3. **Current classification:** `BLOCKED_INSUFFICIENT_INFO` · mode recorded DEBUG (inferred from row membership only) · validation `PENDING_EVIDENCE`
4. **Evidence:** appears exactly twice, both as bare members of debug rows: `Readme.md:41` `A S D F G H J K` and `Interludes.md:70` `-Debug hotkey row: A, S, SS SoS, D, F, G, H, J`. No verb, no output, no patch-note mention, no tuning-list entry, no removal note.
5. **Possible interpretation(s):** (a) F performs some debug instrumentation function (row context); (b) F is a source typo. The source supports neither with a stated behavior.
6. **Recommended default:** remain blocked — row membership is context, not a behavior spec.
7. **Alternative:** executive authorizes observed-behavior inference **and** supplies the intended behavior in writing (GAP-009's proposed resolution).
8. **Risk if activated:** an unknown key performs an undocumented action in debug contexts — exactly the "invent behavior" failure the directive prohibits.
9. **What evidence would resolve it (request):** (i) any source section stating F's verb + expected output; (ii) historical Readme/patch-note versions naming F; (iii) a tuning-list entry for F (none exists in `PatchNotes.md`); (iv) explicit executive/user intent defining the behavior; (v) expected-output documentation for the trigger.
10. **Activation impact:** none until evidence (i)–(v) or an executive behavior spec arrives; then status moves with the provided spec — otherwise `BLOCKED_INSUFFICIENT_INFO` persists.

### C2 · `VV` — "New VV hotkey" only
1. **Legacy key:** `VV` (command `grimoire.key.VV`, `12` row 31)
2. **Legacy source reference:** `PatchNotes.md:95`
3. **Current classification:** `BLOCKED_INSUFFICIENT_INFO` · mode `UNKNOWN (GAP-009)` · validation `PENDING_EVIDENCE`
4. **Evidence:** `PatchNotes.md:95` `- New VV hotkey` — the entire source record. Never described, never used elsewhere, never removed.
5. **Possible interpretation(s):** none defensible — the source gives no verb, output, or domain for VV.
6. **Recommended default:** remain blocked.
7. **Alternative:** executive supplies the intended behavior (authorizes with a written spec).
8. **Risk if activated:** pure invention of behavior from a name fragment.
9. **What evidence would resolve it (request):** (i) surrounding patch-note entries of the same version describing VV's effect; (ii) any usage example in Readme/parts; (iii) a tuning-list or removal note (absent); (iv) historical usage; (v) explicit user/executive intent with expected output.
10. **Activation impact:** none until evidence or an executive spec arrives.

### C3 · `google` — single lowercase mention
1. **Legacy key:** `google` (command `grimoire.key.google`, `12` row 43; verbatim source spelling)
2. **Legacy source reference:** `PatchNotes.md:264`; context `PatchNotes.md:126`
3. **Current classification:** `BLOCKED_INSUFFICIENT_INFO` · mode `UNKNOWN (GAP-009)` · validation `PENDING_EVIDENCE`
4. **Evidence:** `:264` `- Fix duplicate google and tools hotkey. Tools is now Y.` — states the google hotkey existed and was "fixed" as a duplicate, but never says what it did or where it went; `:126` `-New revamped SoS hotkey, now featuring Perplexity, Phind, Stackoverflow and Google.` — capital-G Google appears only as an SoS provider, relationship between the two mentions unstated.
5. **Possible interpretation(s):** (a) the google hotkey was merged/absorbed into SoS (provider list includes Google); (b) it was removed by the "fix"; (c) it remained a distinct web-search key, undocumented after `:264`.
6. **Recommended default:** remain blocked; interpretation (a) is the likeliest reading but is **not** asserted as fact.
7. **Alternative:** executive rules (a) — record folds into a historical note under `grimoire.key.SoS`; rules (c) — requires a behavior spec first.
8. **Risk if activated:** a duplicate web-search key colliding with SoS, or an unknown action.
9. **What evidence would resolve it (request):** (i) patch-note text **before** `:264` describing the google hotkey's original behavior; (ii) the meaning of "duplicate" at `:264` (duplicate of SoS?); (iii) SoS history around `:126`; (iv) any Readme mention of a google key; (v) explicit executive intent.
10. **Activation impact:** none until evidence or an executive ruling arrives; folding under (a) makes it historical, not active.

---

## Decision log (to be completed by the executive)

| Item | Key | Ruling (default / alternative / custom) | Date |
|---|---|---|---|
| A1 | K | | |
| A2 | KY | | |
| A3 | NM | | |
| A4 | Y | | |
| A5 | T | | |
| B1 | P | | |
| B2 | PT | | |
| B3 | Z | | |
| B4 | E | | |
| B5 | i | | |
| C1 | F | | |
| C2 | VV | | |
| C3 | google | | |

**Until a ruling is recorded here and applied to `12-hotkey-registry.md` in a future task, all 13 hotkeys remain `BLOCKED_*` and cannot become ACTIVE (activation gate, `05` Group H).**
