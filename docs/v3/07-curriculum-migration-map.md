# Grimoire v3 — Curriculum Migration Map

**Status:** Task 03 Phase 4/6 — **populated with real source data** (non-vacuous).
**Source of record:** commit `ad5e26814170fb4dbb2b4fa4667e730b0f61c63a`. All rows cite verified `file:line` anchors (MIG-07).
**Governing rules:** source order preserved, numbering never altered, anomalies flagged `SOURCE-ANOMALY`, never repaired (P1–P5, `06` §4).

---

## 1. Counts (mapped / discovered — all non-vacuous)

| Class | mapped / discovered | Notes |
|---|---|---|
| Parts | **9 / 9** | `Part1`–`Part9` (Part4 = `Part4_AllLessons.md`) |
| Chapters | **20 / 20 declared** | Numbered 1–21; **Chapter 5 does not exist in source** (`SOURCE-ANOMALY` A1) |
| Projects | **76 / 76** | Numbers 0–75, each present exactly once across content files; index `Projects.md` has gaps/dup (A2, A3) |
| Interludes | **2 / 2** | Interlude 1 (debugging), Interlude 2 (hackathon) |
| Tracks | **3 / 3** | Kids menu, Beginner, Advanced programmer |
| URL references in curriculum | 174 unique | inventory in `06` §6 |

---

## 2. Parts (source order)

| Part | Source title (verbatim) | TOC | Content file | Status |
|---|---|---|---|---|
| 1 | Part 1: Intro & Setup | `Grimoire.md:17` | `Part1.md` (154 lines) | MAPPED |
| 2 | Part 2: Spells, Beginner Incantations | `Grimoire.md:28` | `Part2.md` (90) | MAPPED |
| 3 | Pt3 Conjuring, Prompt-gramming. Prompt -> Everything. | `Grimoire.md:38` ("Part 3: Conjuring…") | `Part3.md:1` (plain-text heading, no `#`) | MAPPED · SOURCE-ANOMALY (heading level; "Pt3" vs "Part 3") |
| 4 | Part 4: Forbidden Spells | `Grimoire.md:46` | `Part4_AllLessons.md:1` (29) | MAPPED · SOURCE-ANOMALY (TOC comments out Ch14/15 with `//` + damaged-pages narrative `Grimoire.md:52–53`) |
| 5 | Part 5: Flying Lessons: Taming Shoggoth | `Grimoire.md:56` | `Part5.md:1` (plain-text heading, no `#`) | MAPPED · SOURCE-ANOMALY (draft note `Part5.md:5`) |
| 6 | Part 6: Alchemy | `Grimoire.md:60` | `Part6.md:1` (8) | MAPPED |
| 7 | Part 7: Book of the Dead | `Grimoire.md:64` | `Part7.md:1` (269) | MAPPED |
| 8 | Part 8: Memory Palaces & Code Architecture | `Grimoire.md:68` | `Part8.md:1` ("Part 8: Memory Palaces" — omits "& Code Architecture") | MAPPED · title variant |
| 9 | Part 9: Book of Life | `Grimoire.md:73` | `Part9.md:1` (25) | MAPPED |

---

## 3. Chapters (source order; titles quoted from TOC — index/part-file variants preserved, not reconciled)

| Chapter | TOC title (`Grimoire.md`) | Index heading (`Projects.md`) | Part-file heading | Status |
|---|---|---|---|---|
| 1 | Ancient Runes & Modern Scrolls, Starters (`:19`) | `:6` | `Part1.md:3` "…Classic & Modern Starters" | MAPPED · title variant |
| 2 | Teleportation, put websites online easy (`:20`) | `:13` | `Part1.md:34` | MAPPED |
| 3 | Wands, dev kit setup (`:21`) | `:18` | `Part1.md:86` | MAPPED |
| 4 | Divination: The Origin, Git 101 (`:22`) | `:22` "Divination: The Origin" | `Part1.md:113` "Divination: The Origin" | MAPPED · title variant |
| **5** | **ABSENT from source** | ABSENT | ABSENT | **SOURCE-ANOMALY A1** — numbering jumps 4 → 6 everywhere; preserved, not renumbered |
| 6 | Spells 101: Telekinesis, Interactive (`:30`) | `:33` | `Part2.md:3` "Telekinesis 101, Interactive" | MAPPED · title variant |
| 7 | Spells 102: Dark Arts, Data (`:31`) | `:40` | `Part2.md:50` "Dark Arts 101, Data" | MAPPED · title variant |
| 8 | Spells 103: Stoneweaving, Build your blog! (`:32`) | `:46` same | `Part2.md:71` "Earthbending 101, Build your blog!" | MAPPED · **CONFLICT** (Stoneweaving vs Earthbending) |
| 9 | Spells 201: Charms, Prompt Created Media (`:40`) | `:56` | `Part3.md:3` | MAPPED |
| 10 | Spells 202: Transfiguration, Prompt 1st Coding (`:41`) | `:65` | `Part3.md:63` plain-text heading | MAPPED · SOURCE-ANOMALY (no `##`) |
| 11 | Spells 203: Illusions, advanced front & backend (`:42`) | `:71` | `Part3.md:138` plain-text heading | MAPPED · SOURCE-ANOMALY (no `##`) |
| 12 | Potions: custom GPTs (`:43`) | `:76` | `Part3.md:161` | MAPPED |
| 13 | Curses, Cursor.sh 101 (`:48`) | `:84` | `Part4_AllLessons.md:3` | MAPPED |
| 14 | `//Chapter 14: Hexes, Cursor.sh 102` (`:50`, commented) | `:90` (no projects listed) | `Part4_AllLessons.md:9` (projects 44–52 present) | MAPPED · SOURCE-ANOMALY A3/A5 |
| 15 | `//Chapter 15: Necromancy: Cursor.sh 201` (`:51`, commented) | `:92` "…Cursor.sh 201" | `Part4_AllLessons.md:20` "…Cursor.sh 103" | MAPPED · **CONFLICT 201 vs 103** + A5 |
| 16 | Surfing Dragons: Agents, Code Interpreters & New Forms (`:58`) | `:100` | `Part5.md:3` | MAPPED |
| 17 | Wizard's gotta eat! (`:62`) | `:112` | `Part6.md:3` | MAPPED |
| 18 | Heresy 101: Coding basics re-imagined, post GPT-4 (`:66`) | `:121` | `Part7.md:22` | MAPPED |
| 19 | Underworld: Data Structures & algos 101 (`:70`) | `:131` | `Part8.md:4` "Underworld 101: Data Structures & algos" | MAPPED · title variant |
| 20 | Cathedrals: Code architecture (`:71`) | `:135` (heading `##`, others `###`) | `Part8.md:74` | MAPPED · SOURCE-ANOMALY (index heading level) |
| 21 | Summoning 101: Create life (`:75`) | `:140` "Summoning 101" | `Part9.md:3` plain text (no `#`) | MAPPED · title variant + heading-level anomaly |
| Interlude 1 | Herbology, Bug Squashing, debugging 101 (`:25`) | `:27` "Herbology, Bug Squashing" | `Interludes.md:1` (no "Interlude 1:" prefix in heading) | MAPPED · heading variant |
| Interlude 2 | Hackathon! (`:35`) | `:50` | `Interludes.md:93` | MAPPED |

---

## 4. Project accounting (all 76, source order preserved)

Columns per directive Phase 6. **Prerequisites** = only what source explicitly states (else `UNKNOWN`); **Tools** = only what the project body explicitly names (else `UNKNOWN`). Content title = lesson-file form; index variants flagged in Status (`A9` register §6).

| # | Title (content file, verbatim) | Source | Index ref | Part | Chapter | Prerequisites | Tools (explicit) | Core phase | Status |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Hello World | `Part1.md:4` ("Project 0:") | `Projects.md:7` | 1 | 1 | UNKNOWN | Netlify (hotkey N) | BUILD | MAPPED |
| 1 | Pong | `Part1.md:8` | `Projects.md:8` | 1 | 1 | UNKNOWN | Netlify (N) | BUILD | MAPPED |
| 2 | Link in bio site | `Part1.md:12` | `Projects.md:10` | 1 | 1 | UNKNOWN | Netlify (N), Replit (REPL), Netlify Drop (ND), Dalle (opt.) | BUILD | MAPPED |
| 3 | Pic to Code | `Part1.md:24` | `Projects.md:11` "Sketch to Code" | 1 | 1 | UNKNOWN | Netlify (N), Replit (REPL), Netlify Drop (ND), Dalle | BUILD | MAPPED · title variant (A9) |
| 4 | Netlify 1 letter hotkey deploy: Netlify Auto deploy, Drag & Drop Deploy: Netlify Drop | `Part1.md:35` | `Projects.md:14` | 1 | 2 | UNKNOWN | Netlify (N), Netlify Drop (ND/NM) | TOOL | MAPPED · title variant (A9) |
| 5 | Replit deploys | `Part1.md:63` | `Projects.md:15` | 1 | 2 | UNKNOWN | Replit (REPL) | TOOL | MAPPED |
| 6 | Advanced options | `Part1.md:79` | `Projects.md:16` ": Vercel, Render" | 1 | 2 | UNKNOWN | Vercel, Render | TOOL | MAPPED · title variant (A9) |
| 7 | Phone setup | `Part1.md:87` | `Projects.md:19` ": Replit + Github" | 1 | 3 | **Project 5** (`Part1.md:90`) | Replit, GitHub | TOOL | MAPPED · title variant (A9) |
| 8 | Full Pro | `Part1.md:96` | `Projects.md:20` ": Cursor.sh, Warp, GitTower, GH Copilot" | 1 | 3 | UNKNOWN | Cursor.sh, Warp, GitTower/SourceTree, GH Copilot | TOOL | MAPPED · title variant (A9) |
| 9 | Git 101 | `Part1.md:114` | `Projects.md:23` "& CLI" | 1 | 4 | UNKNOWN | git, Git Tower/SourceTree | TEACH | MAPPED · title variant (A9) |
| 10 | Linear | `Part1.md:150` | `Projects.md:24` | 1 | 4 | UNKNOWN | Linear | TOOL | MAPPED |
| 11 | Debugging 101, how to think like a code wizard | `Interludes.md:2` | `Projects.md:28` | 1 | Int 1 | UNKNOWN | git stash, git bisect | DEBUG | MAPPED |
| 12 | Code in Motion: P5.js | `Part2.md:4` | `Projects.md:34` | 2 | 6 | UNKNOWN | p5.js, Netlify (N/ND) | BUILD | MAPPED |
| 13 | Ballpit physics: Matter.js | `Part2.md:15` | `Projects.md:35` | 2 | 6 | UNKNOWN | Matter.js, p5.js, Netlify (N/ND) | BUILD | MAPPED |
| 14 | Games 101: ASCII text adventure game | `Part2.md:28` | `Projects.md:36` | 2 | 6 | UNKNOWN | Netlify (N/ND) | BUILD | MAPPED |
| 15 | Basic game engine: Kaboom.js, phaser.js | `Part2.md:34` | `Projects.md:37` | 2 | 6 | UNKNOWN | Kaboom.js, phaser.js, Dalle | BUILD | MAPPED |
| 16 | Game animation: Rive | `Part2.md:41` | `Projects.md:38` | 2 | 6 | UNKNOWN | Rive, Dalle | BUILD | MAPPED |
| 17 | Calculator App | `Part2.md:51` | `Projects.md:41` | 2 | 7 | UNKNOWN | UNKNOWN | BUILD | MAPPED |
| 18 | Todo list, CRUD | `Part2.md:54` | `Projects.md:42` | 2 | 7 | UNKNOWN | database (unspecified) | BUILD | MAPPED |
| 19 | Habit tracker | `Part2.md:59` | `Projects.md:43` | 2 | 7 | UNKNOWN | database (unspecified) | BUILD | MAPPED |
| 20 | Chess | `Part2.md:64` | `Projects.md:44` | 2 | 7 | UNKNOWN | UNKNOWN | BUILD | MAPPED |
| 21 | Create a blog, you have a few options. | `Part2.md:74` | `Projects.md:47` "Blog" | 2 | 8 | UNKNOWN | .md files, Notion + Express, Ghost | BUILD | MAPPED · title variant (A9) |
| 22 | Random Theme | `Interludes.md:94` | `Projects.md:51` "Themed. 48 hours" | 2 | Int 2 | UNKNOWN | Dalle, d20 roll code | BUILD | MAPPED · title variant (A9) |
| 23 | Images & Graphic Design: Dalle GPT, Midjourney & Canva GPT | `Part3.md:4` | `Projects.md:57` (no "GPT") | 3 | 9 | UNKNOWN | Dalle GPT, Midjourney, Canva GPT | BUILD | MAPPED · title variant (A9) |
| 24 | Images via Code: Prompt -> SVG | `Part3.md:9` | `Projects.md:58` | 3 | 9 | UNKNOWN | SVG, p5.js/matter.js (opt.) | BUILD | MAPPED |
| 25 | Images via sketch: Leonardo Live Canvas & Krea | `Part3.md:16` | `Projects.md:59` | 3 | 9 | UNKNOWN | Leonardo, Krea | BUILD | MAPPED |
| 26 | Video: RunwayML, Capcut | `Part3.md:28` | `Projects.md:60` | 3 | 9 | UNKNOWN | RunwayML, Capcut, Dalle (opt.) | BUILD | MAPPED |
| 27 | Audio: Songs Voices, & Sound Board: Suno, Stable Audio, ElevenLabs | `Part3.md:36` | `Projects.md:61` | 3 | 9 | UNKNOWN | Suno, Stable Audio, ElevenLabs | BUILD | MAPPED |
| 28 | 3d Scene: LumaLabs Genie, Meshy, Spline, Mootion | `Part3.md:44` | `Projects.md:62` | 3 | 9 | UNKNOWN | LumaLabs, Meshy, Spline, Mootion | BUILD | MAPPED |
| 29 | 3d Game: Games 102: Three.js, Meshy, LumaLabs Genie | `Part3.md:55` | `Projects.md:63` | 3 | 9 | UNKNOWN | Three.js, Meshy, LumaLabs | BUILD | MAPPED |
| 30 | Draw code: TLDraw | `Part3.md:64` | `Projects.md:66` | 3 | 10 | UNKNOWN | makereal.tldraw.com | BUILD | MAPPED |
| 31 | Design & Wireframe: Figma, Relume | `Part3.md:123` | `Projects.md:67` | 3 | 10 | UNKNOWN | Figma, Relume | BUILD | MAPPED |
| 32 | Rapid UI prototypes: v0.dev | `Part3.md:129` | `Projects.md:68` — **labeled "33"** | 3 | 10 | UNKNOWN | v0.dev, Vercel | BUILD | **SOURCE-ANOMALY A2** — index omits 32; content says 32 |
| 33 | Backend API: Retool | `Part3.md:134` | `Projects.md:69` — **also labeled "33"** | 3 | 10 | UNKNOWN | Retool | BUILD | **SOURCE-ANOMALY A2** — duplicate "33" in index; preserved |
| 34 | iOS App: SwiftUI, Trace.zip | `Part3.md:139` | `Projects.md:72` | 3 | 11 | UNKNOWN | SwiftUI, Trace.zip, XC hotkey/Xcode | BUILD | MAPPED |
| 35 | Games 103: Unity Game | `Part3.md:153` | `Projects.md:73` | 3 | 11 | UNKNOWN | Unity | BUILD | MAPPED |
| 36 | Backend: Supabase | `Part3.md:156` | `Projects.md:74` | 3 | 11 | UNKNOWN | Supabase | BUILD | MAPPED |
| 37 | custom GPT Actions: Evolution Chamber | `Part3.md:162` | `Projects.md:77` | 3 | 12 | UNKNOWN | Evolution Chamber GPT | BUILD | MAPPED |
| 38 | custom GPT backend server: Express, Replit | `Part3.md:166` | `Projects.md:78` | 3 | 12 | UNKNOWN | Express, Replit | BUILD | MAPPED |
| 39 | Zapier Actions | `Part3.md:170` | `Projects.md:79` | 3 | 12 | UNKNOWN | Zapier | BUILD | MAPPED |
| 40 | File > New Ai project | `Part4_AllLessons.md:4` | `Projects.md:85` | 4 | 13 | UNKNOWN | Cursor.sh | TOOL | MAPPED |
| 41 | Cmd + K | `Part4_AllLessons.md:5` | `Projects.md:86` | 4 | 13 | UNKNOWN | Cursor.sh | TOOL | MAPPED (external-tool hotkey — `08` §6) |
| 42 | Sidechat, Cmd + Shift + L | `Part4_AllLessons.md:6` | `Projects.md:87` | 4 | 13 | UNKNOWN | Cursor.sh | TOOL | MAPPED (external-tool hotkey — `08` §6) |
| 43 | Cmd + K in terminal | `Part4_AllLessons.md:7` | `Projects.md:88` | 4 | 13 | UNKNOWN | Cursor.sh | TOOL | MAPPED (external-tool hotkey — `08` §6) |
| 44 | Sidechat pt2, @codebase, adv srch, manual RAG, .cursorIgnore | `Part4_AllLessons.md:10` | **ABSENT from index** | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 45 | @ references: code, files, folders | `Part4_AllLessons.md:11` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 46 | @ references: Docs | `Part4_AllLessons.md:12` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 47 | Multi snippet Prompts | `Part4_AllLessons.md:13` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 48 | Cmd+ K Advanced usage | `Part4_AllLessons.md:14` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 49 | Code Review | `Part4_AllLessons.md:15` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | CODE | MAPPED · SOURCE-ANOMALY A3 |
| 50 | /Edit | `Part4_AllLessons.md:16` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 51 | Code Interpreter IDE mode | `Part4_AllLessons.md:17` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 52 | Image to code | `Part4_AllLessons.md:18` | ABSENT | 4 | 14 | UNKNOWN | Cursor.sh | CODE | MAPPED · SOURCE-ANOMALY A3 |
| 53 | Prompt Libraries. Markdown. Applying Transforms | `Part4_AllLessons.md:23` | ABSENT | 4 | 15 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 54 | Rules for Ai & Recursive LLM debugging | `Part4_AllLessons.md:24` | ABSENT | 4 | 15 | UNKNOWN | Cursor.sh | DEBUG | MAPPED · SOURCE-ANOMALY A3 |
| 55 | Notes for Ai, RaG libs | `Part4_AllLessons.md:25` | ABSENT | 4 | 15 | UNKNOWN | Cursor.sh | TOOL | MAPPED · SOURCE-ANOMALY A3 |
| 56 | Self writing Api integrations | `Part4_AllLessons.md:26` | ABSENT | 4 | 15 | UNKNOWN | Cursor.sh | CODE | MAPPED · SOURCE-ANOMALY A3 |
| 57 | BabyAgi | `Part5.md:8` | `Projects.md:101` "babyAgi" | 5 | 16 | UNKNOWN | BabyAGI replit templates | CODE | MAPPED · title variant (A9) |
| 58 | Smol-dev | `Part5.md:15` | `Projects.md:103` | 5 | 16 | UNKNOWN | github.com/smol-ai/developer | CODE | **LEGACY-GAP** — "No further instructions… pages damaged" `Part5.md:17–18` |
| 59 | Aider.chat | `Part5.md:20` | `Projects.md:104` | 5 | 16 | UNKNOWN | aider.chat | CODE | **LEGACY-GAP** — damaged marker `Part5.md:22–24` |
| 60 | Julius.ai | `Part5.md:25` | `Projects.md:106` | 5 | 16 | UNKNOWN | julius.ai | TOOL | MAPPED |
| 61 | Open Interpreter | `Part5.md:30` | `Projects.md:107` | 5 | 16 | UNKNOWN | openinterpreter.com | CODE | **LEGACY-GAP** — damaged marker `Part5.md:32–33` |
| 62 | 1st Dollar: Stripe Payment Links | `Part6.md:4` | `Projects.md:113` "Stripe Links" | 6 | 17 | UNKNOWN | Stripe Payment Links, Buy Me a Coffee, Dalle | BUILD | MAPPED · title variant (A9) |
| 63 | Business: Gumroad, Shopify, Stripe Atlas | `Part6.md:7` | `Projects.md:114` | 6 | 17 | UNKNOWN | Gumroad, Shopify, Stripe Atlas (body adds LemonSqueezy, Clerky) | TOOL | MAPPED |
| 64 | CLI 101 | `Part7.md:23` | `Projects.md:122` | 7 | 18 | recommends **Project 9** (`Part7.md:37`) | warp.dev, fig.io, Cursor terminal | TEACH | MAPPED |
| 65 | How to learn any coding language | `Part7.md:40` | `Projects.md:123` | 7 | 18 | UNKNOWN | UNKNOWN | TEACH | MAPPED |
| 66 | Variables, operators, assignment & basic data types | `Part7.md:52` | `Projects.md:124` | 7 | 18 | UNKNOWN | UNKNOWN | TEACH | MAPPED |
| 67 | Scope & flow. If's, Enums, Loops, Arrays, Recursion. | `Part7.md:105` | `Projects.md:125` (no final period) | 7 | 18 | UNKNOWN | UNKNOWN | TEACH | MAPPED |
| 68 | Imperative coding. Classes, Objects, Functions, Methods, Properties. Inheritance, Polymorphism, Encapsulation, Abstraction. Protocol based coding. Interfaces, delegates, generics | `Part7.md:266` | `Projects.md:126` | 7 | 18 | UNKNOWN | UNKNOWN | TEACH | **LEGACY-GAP** — heading exists, body empty |
| 69 | Libraries, modules, packages & apis | `Part7.md:269` | `Projects.md:127` | 7 | 18 | UNKNOWN | UNKNOWN | TEACH | **LEGACY-GAP** — heading exists, body empty (file ends) |
| 70 | Algorithms, Search, Binary Search, Sorting, Merge Sort. Big O, little o, and aysmptotic notation. | `Part8.md:5` | `Projects.md:132` (no final period) | 8 | 19 | UNKNOWN | YouTube playlists (links in body) | TEACH | MAPPED |
| 71 | Data structures: Queues, Stacks. Sets. Linked Lists. Hash Tables, Dictionaries. Graphs. BFS, DFS. Trees, Binary Search Trees. Tries. | `Part8.md:57` | `Projects.md:133` | 8 | 19 | UNKNOWN | Blind 75, LeetCode, Tech Interview Handbook | TEACH | MAPPED |
| 72 | Code architecture, design patterns, different styles, functional programming tiramisu recipie | `Part8.md:75` | `Projects.md:136` "Design patterns, different styles…" | 8 | 20 | UNKNOWN | UNKNOWN | TEACH | MAPPED · title variant (A9) |
| 73 | 3d printing from prompts | `Part9.md:4` | `Projects.md:141` | 9 | 21 | UNKNOWN | LumaLabs, Meshy, CSM, Bambu Lab, Anycubic, lowpoly3d | BUILD | MAPPED |
| 74 | Robot: Raspberry pi, arduino | `Part9.md:16` | `Projects.md:142` | 9 | 21 | UNKNOWN | Raspberry Pi, Arduino | BUILD | MAPPED |
| 75 | Attach openAI api to robot | `Part9.md:21` | `Projects.md:143` | 9 | 21 | UNKNOWN | UNKNOWN | BUILD | **LEGACY-GAP** — "No further instructions… rest of the book is missing" `Part9.md:23–24` |

**Accounting check:** rows = 76; numbers 0–75 each exactly once; every row has a real `file:line` source (MIG-02/MIG-04/MIG-07).

---

## 5. Tracks (source order, verbatim members)

| Track | Members (verbatim) | Source | Status |
|---|---|---|---|
| Kids menu | Part 1 → Chapters 1 → Chapter 2 project 4 → Chapter 3 project 7 → Interlude 1 → Part 2 → Chapter 6 → `https://scratch.mit.edu/` → `https://www.khanacademy.org/computing/` | `Projects.md:147–156` | MAPPED |
| Beginner track | Part 1 → Interlude 1 → Part 2, 3 → Interlude 2 → Part 7 & 8 // Backfill coding basics | `Projects.md:158–163` | MAPPED (SI-08) |
| Advanced programmer, learning prompting track | Part 4, 3, 5, 8 | `Projects.md:165–166` | MAPPED |

---

## 6. SOURCE-ANOMALY register (observed, preserved, NOT repaired)

| ID | Anomaly | Evidence | Handling |
|---|---|---|---|
| A1 | Chapter 5 does not exist; numbering jumps 4 → 6 | `Grimoire.md:22→30`, `Projects.md:22→33`, `Part1.md:113`→`Part2.md:3` | preserved; gap row in §3 |
| A2 | Index labels "Rapid UI prototypes: v0.dev" as **33** (content says 32) and repeats 33 for Retool; 32 absent from index | `Projects.md:68–69` vs `Part3.md:129,134` | both index entries preserved verbatim; content numbering kept; flagged on rows 32/33 |
| A3 | Index omits projects 44–56 entirely (Ch14/Ch15 sections empty) while `Part4_AllLessons.md` contains them; TOC marks both chapters with `//` + damaged-pages narrative | `Projects.md:90–98`, `Grimoire.md:50–53`, `Part4_AllLessons.md:10–26` | preserved; rows 44–56 flagged |
| A4 | Header claims "All 75 projects list" but source contains 76 numbered projects (0–75) | `Projects.md:3` vs count | claim preserved verbatim; counted 76 |
| A5 | TOC comments out Ch14/15 (`//`) and narrates missing pages | `Grimoire.md:50–53` | preserved verbatim |
| A6 | Ch15 title "Necromancy: Cursor.sh **201**" (TOC, index) vs "Cursor.sh **103**" (lesson file) | `Grimoire.md:51`, `Projects.md:92`, `Part4_AllLessons.md:20` | both preserved; conflict recorded |
| A7 | Chapter title variants across TOC/index/lesson files (Ch1, 4, 6, 7, 8, 19, 21) | see §3 | all variants preserved |
| A8 | Heading-level inconsistencies: `Projects.md` Ch20 uses `##` vs `###`; `Part3.md:63,138` Ch10/11, `Part9.md:3` Ch21, `Part3.md:1`, `Part5.md:1` lack markdown heading markers | see §3 | preserved |
| A9 | Project title variants index vs content: #3, 4, 6, 7, 8, 9, 21, 22, 23, 57, 62, 72 (plus trivial period diffs on 67, 70) | per-row in §4 | both forms preserved; content form primary, index form noted |
| A10 | Interlude 1 heading lacks "Interlude 1:" prefix (Interlude 2 has its prefix) | `Interludes.md:1` vs `:93` | preserved |

---

## 7. Migration rules reaffirmed (non-vacuous as of this task)

1. Row order = source order; no re-sorting (MIG-04 checks the 0–75 sequence).
2. No project merged, deleted, split, or renumbered; anomalies carry `SOURCE-ANOMALY`, never a silent fix.
3. `UNKNOWN` = source does not state it; never inferred.
4. Source commit for all rows: `ad5e268`.
