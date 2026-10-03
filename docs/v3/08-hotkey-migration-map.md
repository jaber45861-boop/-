# Grimoire v3 — Hotkey Migration Map

**Status:** Task 03 Phase 5 — **populated with real source data** (non-vacuous).
**Source of record:** commit `ad5e268`. No hotkey redesigned, renamed, or removed by this document (P1–P5, `06` §4). Task 01 contract = `03-extension-contract.md` §4 (H1–H7).
**v3 registration (Task 04):** records and statuses live in `12-hotkey-registry.md` (48 = 43 + 5); unresolved rulings are advisory in `13-hotkey-decision-sheet.md`. This map remains the classification source of record.

---

## 1. Counts (mapped / discovered)

| Metric | Count |
|---|---|
| Grimoire hotkey identities discovered in source | **43** (42 command identities + 1 trigger syntax) |
| Rows in §4 (incl. grouping + trigger) | **43 / 43 mapped** |
| External-tool hotkeys (curriculum content, §6) | **5 / 5 mapped** |
| Currently ACTIVE and fully compatible | see §5 tallies |
| Renames/removals documented in `PatchNotes.md` | 10 events (§7) |

**Decision-mode value set (AC-31):** the nine Core modes (`04` §2) **or** one of five explicit exemptions: `N/A — removed (historical)`, `N/A — external tool`, `N/A — aggregate`, `N/A — trigger syntax`, `UNKNOWN (GAP-009)`.

---

## 2. Mode-mapping rules (applied uniformly; behavior never altered)

| Source behavior class | → Core mode |
|---|---|
| Open/navigate Grimoire content (Projects, parts, interludes, Readme) | TEACH |
| Open reference info (patch notes, recommended tools) | ANSWER |
| Operation: deploy, export, print, browser, interpreter, menu | TOOL (+ declared micro-behavior → **adapter**, §5) |
| Plan/brainstorm/expand | PLAN |
| Produce/copy/save code | CODE |
| Debug instrumentation | DEBUG |
| Test generation | TEST |
| Search/query building | RESEARCH |
| Explain/check understanding | TEACH |

## 3. Status classes (one per row, worst-status wins)

`COMPATIBLE` (H1–H7 satisfiable as-is) · `ADAPTER-REQUIRED` (operation hotkey: mode TOOL + declared micro-behavior record — the CA-01 adapter) · `CONFLICT` (source contradicts itself about this hotkey) · `AMBIGUOUS` (identity/behavior overlap, unresolved) · `INSUFFICIENT-INFO` (H1 fields not derivable) · `HISTORICAL-REMOVED` (explicitly removed/renamed in source) · `N/A` (grouping/trigger/external rows).

---

## 4. Hotkey roster (source order by first reference; original spellings preserved exactly)

| Key (verbatim) | Name | Purpose (source) | Behavior | Source | v3 command | Decision mode | Required tools | Output | Conflicts | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| K | cmd menu | open command menu | opens hotkey/command menu | `Readme.md:36,147`; `Grimoire.md:99`; `PatchNotes.md:178` | `grimoire.key.K` | TOOL | none | command menu listing | **CONFLICT:** also listed in Readme debug row (`Readme.md:41`) but absent from Interludes debug row (`Interludes.md:70`) | CONFLICT |
| P | project ideas / traverse | view starter project ideas; traverse Grimoire.md | opens projects/lessons | `Readme.md:148`; `PatchNotes.md:115,133` | `grimoire.key.P` | TEACH | none | project/lesson content | **AMBIGUOUS vs PT** (P vs PT both described as opening Projects.md) | AMBIGUOUS |
| PT | open Projects.md | open Projects.md | opens index | `Grimoire.md:13` | `grimoire.key.PT` | TEACH | none | Projects.md content | AMBIGUOUS vs P | AMBIGUOUS |
| PTn | open parts | open parts for full instructions | opens Part n | `Grimoire.md:14,96`; `Projects.md:177`; `PatchNotes.md:78` | `grimoire.key.PTn` | TEACH | none | part content | source spans `PT1…PT9` (`Grimoire.md:14`, `Projects.md:177`, `PatchNotes.md:78`) incl. case variant `Pt9` (`PatchNotes.md:78`) | COMPATIBLE |
| Pi | open interludes | open interludes | opens Interlude n | `Grimoire.md:14,97`; `Projects.md:178` | `grimoire.key.Pi` | TEACH | none | interlude content | — | COMPATIBLE |
| R | Readme | open Readme.md | opens readme | `Grimoire.md:98`; `Projects.md:180` | `grimoire.key.R` | TEACH | none | readme content | — | COMPATIBLE |
| PN | patch notes | open patch notes | opens patch notes | `Readme.md:150`; `PatchNotes.md:98` | `grimoire.key.PN` | ANSWER | none | version history | renamed from RR at v2.0.3 (`PatchNotes.md:98`) | COMPATIBLE |
| KT | GP-Tavern | visit Tavern & meet more GPTs | opens GPTavern | `Readme.md:149`; `PatchNotes.md:196` | `grimoire.key.KT` | TOOL | external link | Tavern GPT list | renamed from T at v1.8 (`PatchNotes.md:196`) | ADAPTER-REQUIRED |
| KY | recommended tools | open recommended tools | opens tools list | `PatchNotes.md:78,197` | `grimoire.key.KY` | ANSWER | none | tools list | **CONFLICT:** tools key also assigned to Y (`PatchNotes.md:197` vs `:264`), Y later removed (`:65`) | CONFLICT |
| WASD | quick actions (grouping) | Readme "Quick actions" | aggregate notation for W/A/S/D | `Readme.md:38–39` | `grimoire.key.WASD` | N/A — aggregate | none | see rows W, A, S, D | grouping notation, not a chord | N/A — aggregate |
| W | — | "Go fast" | accelerates output | `Interludes.md:69`; `PatchNotes.md:138` | `grimoire.key.W` | CODE | none | faster code output | part of WASD group & debug row | COMPATIBLE |
| A | — | brainstorm & plan approaches | plan/variation generation | `Interludes.md:74`; `PatchNotes.md:96` | `grimoire.key.A` | PLAN | none | plan/approach options | in debug rows (`Readme.md:41`, `Interludes.md:70`); modified v2.0.3 | COMPATIBLE |
| S | — | ask for explanations | explanation of current output | `Readme.md:46` | `grimoire.key.S` | TEACH | none | explanation | in both debug rows | COMPATIBLE |
| SS | — | explanations, "Repeat if necessary!" | repeat/extend explanation | `Readme.md:46,48`; `Interludes.md:70` | `grimoire.key.SS` | TEACH | none | further explanation | — | COMPATIBLE |
| D | — | brainstorm counterpart of A | plan/variation generation | `Interludes.md:74`; `PatchNotes.md:139` | `grimoire.key.D` | PLAN | none | plan/approach options | in both debug rows | COMPATIBLE |
| F | — | UNKNOWN (debug row member only) | not documented beyond row membership | `Readme.md:41`; `Interludes.md:70` | `grimoire.key.F` | DEBUG | none | UNKNOWN | purpose never stated in source; mode inferred from debug-row membership only | INSUFFICIENT-INFO (GAP-009) |
| G | — | "Save your files as you go! mini Git stage" | saves/stages current files | `PatchNotes.md:125`; `Interludes.md:70` | `grimoire.key.G` | CODE | none | saved file snapshot | combined with SoS in "master 12 query search key" (`PatchNotes.md:127`) | COMPATIBLE |
| H | — | print debug lines everywhere; neon UI outlines | injects print/instrumentation | `Interludes.md:40,45,70` | `grimoire.key.H` | DEBUG | none | instrumented code / outlines | in both debug rows | COMPATIBLE |
| J | — | force code interpreter | forces code-interpreter path | `PatchNotes.md:286`; in debug rows (`Readme.md:41`, `Interludes.md:70`) | `grimoire.key.J` | TOOL | code interpreter | interpreter execution | — | ADAPTER-REQUIRED |
| C | — | Anti-lazy "shut up and code"; print full files | writes code without chatter; prints full files | `Interludes.md:68`; `PatchNotes.md:320,288,79` | `grimoire.key.C` | CODE | none | full code output | modified v1.9, v2.0.6 | COMPATIBLE |
| SoS | auto searches | write searches automatically (Perplexity, Phind, Stackoverflow, Google) | generates search queries | `Readme.md:50`; `PatchNotes.md:126`; `Interludes.md:70` | `grimoire.key.SoS` | RESEARCH | search providers | suggested searches | in both debug rows; combined with G (`PatchNotes.md:127`) | COMPATIBLE |
| N | Netlify auto deploy | 1-button instant site deploy (GPT action, Netlify partner) | auto-deploys current site | `Part1.md:6,15,27,36`; `PatchNotes.md:118`; `Readme.md:43` | `grimoire.key.N` | TOOL | Netlify GPT action | live site URL; must claim within 1 hour or deleted (`Part1.md:36`) | in Readme Export group | ADAPTER-REQUIRED |
| ND | manual netlify deploy | manual deploy via Netlify Drop | opens/guides drag-drop deploy | `Part1.md:17,30`; `PatchNotes.md:124`; `Readme.md:43` | `grimoire.key.ND` | TOOL | Netlify Drop (`https://app.netlify.com/drop`) | manual deploy flow | vs NM (below) | ADAPTER-REQUIRED |
| NM | — | "Manual deploys are available via the NM hotkey using Netlify Drop" | manual Netlify Drop deploy | `Part1.md:38` | `grimoire.key.NM` | TOOL | Netlify Drop | manual deploy flow | **CONFLICT:** same function as ND; only this one mention of NM; not repaired (A-register in `07`, GAP-015) | CONFLICT |
| REPL | — | export code directly to Replit (createRepl operation) | exports project to Replit | `Part1.md:16,29,65`; `ReplitDeployInstructions.md:1`; `PatchNotes.md:47` | `grimoire.key.REPL` | TOOL | Replit `createRepl` action | Replit project link | added v2.3 | ADAPTER-REQUIRED |
| V | — | codeblock printing | prints code in copyable sections | `PatchNotes.md:303,150`; `Readme.md:43` | `grimoire.key.V` | TOOL | none | sectioned code output | in Export group | ADAPTER-REQUIRED |
| L | — | automatically share on Twitter | posts/shared to Twitter | `PatchNotes.md:311`; tuning `PatchNotes.md:141` | `grimoire.key.L` | TOOL | Twitter/X | share action | in Export group | ADAPTER-REQUIRED |
| Z | — | Export (current docs) / undo (history) | current: export+unzip flow (`Part1.md:107`); v1.9 undo added (`:287`), v1.10 undo removed (`:279`) | `Readme.md:43`; `Part1.md:107`; `PatchNotes.md:287,279,140` | `grimoire.key.Z` | TOOL | none | export artifact | **AMBIGUOUS:** two documented purposes across versions; which is current not stated | AMBIGUOUS |
| XC | — | export an Xcode template | exports Xcode project template | `Part3.md:140`; `PatchNotes.md:208,142` | `grimoire.key.XC` | TOOL | Xcode export operation | Xcode template | tuning-listed as `XC` (`:142`) — the list contains **no plain "X" hotkey** (verified; an earlier draft row "X" was removed as unfounded) | ADAPTER-REQUIRED |
| PDF | — | PDF export | exports as PDF | `Readme.md:43`; `PatchNotes.md:220` | `grimoire.key.PDF` | TOOL | none | PDF artifact | in Export group; split-header version entry v1.16.5 | ADAPTER-REQUIRED |
| VV | — | UNKNOWN | "New VV hotkey" only; never removed | `PatchNotes.md:95` | `grimoire.key.VV` | UNKNOWN (GAP-009) | UNKNOWN | UNKNOWN | — | INSUFFICIENT-INFO (GAP-009) |
| Q | — | recursive question checking ("Have Grimoire ask you the Questions with Q") | Grimoire asks user questions | `PatchNotes.md:130,72` | `grimoire.key.Q` | TEACH | none | questions to user | moved from Y at v2.0; previously held browser role (browser moved to B, `:129`) | COMPATIBLE |
| Y | — | THREE roles across versions: 1) tools (`:264`), 2) fill-in-gaps understanding (`:193`), 3) high-level plan (`:131`) | see roles | `PatchNotes.md:193,264,131`; removed `:65` | `grimoire.key.Y` | N/A — removed (historical) | none | n/a | **CONFLICT:** three distinct behaviors at different versions; removed in v2.1 (`:65`) | CONFLICT (historical) |
| E | — | "step down and Expand" (abstraction ladder counterpart of Y) | expands/detail-fills plan | `PatchNotes.md:131` | `grimoire.key.E` | PLAN | none | expanded plan | never removed, but its partner Y removed in v2.1; current status unstated | AMBIGUOUS |
| T | — | THREE roles: 1) recommended tools (`:301`), 2) Tavern (`:196` implies prior T), 3) test cases (`:132`) | see roles | `PatchNotes.md:301,196,132` | `grimoire.key.T` | TEST | none | generated test cases (mode = last-documented role) | **CONFLICT:** overloads across versions (tools → tavern → tests) | CONFLICT |
| B | — | browser tool (moved from Q at v2.0) | opens/uses browser tool | `PatchNotes.md:129` | `grimoire.key.B` | TOOL | browser tool | browser results | renamed-in from Q role | ADAPTER-REQUIRED |
| I | import | recommend libraries, packages, resources, tools | suggests dependencies | `PatchNotes.md:191`; removed `:65` | `grimoire.key.I` | N/A — removed (historical) | none | n/a | removed in v2.1; tuning-list `-i` case ambiguity (row `i`) | HISTORICAL-REMOVED |
| U | intuition | "Help me build my intuition about" | explanatory intuition-building | `PatchNotes.md:192`; removed `:73` | `grimoire.key.U` | N/A — removed (historical) | none | n/a | removed in v2.0.7 | HISTORICAL-REMOVED |
| TT | — | UNKNOWN | "TT & U hotkeys removed" only mention | `PatchNotes.md:73` | `grimoire.key.TT` | N/A — removed (historical) | none | n/a | purpose never stated | HISTORICAL-REMOVED (purpose also INSUFFICIENT) |
| RR | release notes | open release notes | opened patch notes | `PatchNotes.md:302`; renamed `:98` | `grimoire.key.RR` | N/A — removed (historical) | none | n/a | renamed to PN at v2.0.3 | HISTORICAL-REMOVED |
| i | — | UNKNOWN — appears only as `-i` in v2.0 tuning list | unknown | `PatchNotes.md:143` | `grimoire.key.i` | UNKNOWN (GAP-009) | UNKNOWN | UNKNOWN | **AMBIGUOUS:** case-distinct from I (import, `:191`); same-list keys are uppercase except `i` | AMBIGUOUS |
| /backslash | force-trigger syntax | force-trigger hotkeys in ambiguous prompts | name-spacing syntax, not a command | `PatchNotes.md:135` | `grimoire.key./backslash` | N/A — trigger syntax | none | forced trigger | not a hotkey command; registered as trigger convention | N/A — trigger syntax |
| google | — | web-search hotkey (single mention: "Fix duplicate google and tools hotkey") | unknown | `PatchNotes.md:264` | `grimoire.key.google` | UNKNOWN (GAP-009) | UNKNOWN | UNKNOWN | verbatim source spelling is lowercase `google` (`PatchNotes.md:264`); listed capital-G "Google" appears only as an SoS provider (`PatchNotes.md:126`) — relationship unstated | INSUFFICIENT-INFO (GAP-009) |

---

## 5. Compatibility tallies (report §4 source)

| Bucket | Count | Members |
|---|---|---|
| **Compatible** | 14 | PTn, Pi, R, PN, W, A, S, SS, D, G, H, C, SoS, Q |
| **Adapter-required** (operation → mode TOOL + declared micro-behavior record) | 10 | KT, J, N, ND, REPL, V, L, XC, PDF, B |
| **Conflicting** (source self-contradiction; executive resolution needed) | 5 | K, KY, NM, Y, T |
| **Ambiguous** (overlap/unstated; GAP-009 or conflict-adjacent) | 5 | P, PT, Z, E, i |
| **Insufficient info** (H1 fields underivable) | 3 | F, VV, google |
| **Historical/removed** | 4 | I, U, TT, RR |
| **N/A rows** (grouping/trigger) | 2 | WASD, /backslash |
| **External-tool rows** (§6) | 5 | — |
| **Total rows** | **48** (43 Grimoire + 5 external) |

Contract check: every row satisfies H1 except the 3 INSUFFICIENT rows (documented as GAP-009 instances); H2 satisfied for all non-UNKNOWN rows via the §2 mapping (CA-01 verdict in `10`); H3 unique command ids; H4 Core untouched (`01`/`04` greps still clean); H5 tools declared where known; H6 output behavior recorded or marked UNKNOWN; H7 bindings belong to L3.

---

## 6. External-tool hotkeys (curriculum content — NOT Grimoire commands; preserved, not registered as `grimoire.key.*`)

| Key | Tool | Context | Source | v3 decision | Status |
|---|---|---|---|---|---|
| Cmd + K | Cursor.sh | AI commands; terminal variant; projects 41/43/48 | `Part4_AllLessons.md:5,7,14` | N/A — external tool | MAPPED |
| Cmd + Shift + L | Cursor.sh | Sidechat (project 42) | `Part4_AllLessons.md:6` | N/A — external tool | MAPPED |
| cmd + 9 | Xcode | report navigator in TestFlight flow | `Part3.md:146` | N/A — external tool | MAPPED |
| cmd + / | generic IDE | comment toggle protip | `Part7.md:65` | N/A — external tool | MAPPED |
| arrow keys / WASD | Pong project | game paddle input | `Part1.md:9` | N/A — external tool | MAPPED (not a Grimoire hotkey; gameplay control) |

---

## 7. Version timeline of hotkey changes (verbatim events; CA-06 evidence — nothing reconciled)

| Version | Event | Source |
|---|---|---|
| v1.0 | "inlcudes 14 hotkeys, 11 sample projects" (claim; keys not enumerated) | `PatchNotes.md:329` |
| v1.3 | Added C (shut up and code) | `PatchNotes.md:320` |
| v1.4 | Added L (share on Twitter) | `PatchNotes.md:311` |
| v1.6 | Added T (recommended tools), RR (release notes), V (codeblock printing) | `PatchNotes.md:301–303` |
| v1.8 | Added I, U, Y; Tavern T→KT; Recommended Tools Y→KY; added Tavern menu hotkey | `PatchNotes.md:191–197` |
| v1.9 | Added J (force code interpreter); Added Z (undo); Modified C (print full files) | `PatchNotes.md:286–288` |
| v1.10 | **Removed Z undo** ("whoops that was already used") | `PatchNotes.md:279` |
| v1.13 | "Fix duplicate google and tools hotkey. Tools is now Y." | `PatchNotes.md:264` |
| v1.16.5 | Added PDF | `PatchNotes.md:219–220` |
| v1.17 | Added Xcode export (XC) | `PatchNotes.md:207–208` |
| v2.0 | Added N (Netlify GPT action), ND, G, revamped SoS; B moved from Q; Q ← recursive checking from Y; Y ← high-level plan; E expand; T ← test cases; P + child P; /backslash force-trigger; tuning W, D, Z, L, XC, i, P | `PatchNotes.md:107–144` |
| v2.0.3 | Added VV; modified A; **RR → PN** | `PatchNotes.md:95–98` |
| v2.0.6 | Updates to C; mentions PT9/KY | `PatchNotes.md:78–79` |
| v2.0.7 | Updates to Q; **TT & U removed** | `PatchNotes.md:70–73` |
| v2.1 | **Removed I and Y** | `PatchNotes.md:61–65` |
| v2.3 | Added REPL | `PatchNotes.md:44–47` |
| v2.6 | Hotkey menu & chapter changes for GPT-4o | `PatchNotes.md:28–30` |

**Source-order anomalies preserved:** `## 1.17` (`:207`) listed *after* `## 1.8` (`:187`) in a descending-version file; version `1.9` appears **twice** with different content (`PatchNotes.md:169` "New Store intro" vs `:285` "Added J hotkey"); `1.16.5`/`1.16.4` use split `##` headers (`:218–219`); `.1-2` header has no version prefix (`:204`). All preserved verbatim (GAP-016).
