# Incident Room — project log

A running diary of this hackathon build. Plain language. Updated as we go.

**Repo:** https://github.com/zayzyyazy/Incident-Room  
**Team:** Sara (zay) + reprobateboffin (generator bot / fake CRM data)  
**Product one-liner:** The customer was told it worked. Did it actually work?

---

## Where we are right now

**Status (Tue 17 Jun 2026):** **Demo-ready + media captured** — 12 README screenshots + `incident-room-demo.webm` in `docs/screenshots/`. Hero: `retell_call_clinic_44102`. Reply chat + Mongo chat sidebar still on `main`.

**Recording:** [docs/DEMO_RECORDING.md](./docs/DEMO_RECORDING.md) (manual screen record) · automated assets via `npm run capture-demo`

**Locked architecture (read `PRODUCT.md`):**
- **Room 1 — Cause Room:** What happened? → Cause Finding + evolution + recurrence hint
- **Room 2 — Localization Room (planned):** Where in stack? → suspect surfaces (not auto-fix)
- **Recurrence:** orchestrator handoff field, not a third room

**What runs today:**
- **`POST /api/dev/investigate-cause-room`** — 9 Band posts, Klaus fixture default
- **`POST /api/dev/investigate-two`** — legacy 2-agent pipeline
- Fixtures: Klaus, Maria, Anissa + fake CRM

**Next:** Run Cause Room on all fixtures, then UI feed showing opinion evolution across challenge rounds.

---

## Timeline (newest first)

### Tue 17 Jun 2026 — README media + capture pipeline

**Shipped:**
- **`npm run capture-demo`** — Playwright script for 12 cropped README screenshots + `incident-room-demo.webm` walkthrough (`retell_call_clinic_44102`)
- **`npm run install:browsers`** — uses official `playwright install chromium` into `.playwright-browsers/`
- **Desk** — `retell_call_clinic_44102` added to demo submission list (shows on Operations Desk)
- **README** — screenshot gallery synced to capture output filenames; video path documented
- **Fixture** — `fixtures/seeded/test-retell-clinic-44102.json` for auto-seed on empty store

**Run locally (agent env can't launch Chromium):**
```bash
npm run install:browsers && npm run dev
npm run capture-demo
```

**Captured (17 Jun):** all 12 PNGs + `incident-room-demo.webm` in `docs/screenshots/`.

---

### Mon 16 Jun 2026 — Demo finalization (earned investigation bay)

**Shipped:**
- **Investigation Bay** — crew bar only shows **recruited** agents (lights up on join); stage slots per crewmate; theory strip + dialogue dock (balanced text)
- **Call outcome** framing in live UI + PDF (`CALL OUTCOME`, not NOT JUSTIFIED headline)
- **CRM** — 13 seed customers + `/api/crm/reseed` + Reload button
- **Agents tab** — visual party grid (crewmates)
- **Fix:** `getAgentDefinition` runtime error in live theater
- **Docs:** `docs/DEMO_RECORDING.md`, README + desk hero incident hint

**Hero demo path:** Desk → `retell_call_clinic_44102` → Theories (half screen) + Band (half screen) → Reports PDF

---

### Sun 15 Jun 2026 — Localhost + Band UX + cross-room lock

**Shipped:**
- **localhost Investigate** → Cause Room (9 posts, evolution in UI)
- **Band room titles:** `{incident_id} · {title}` (no more "New Session")
- **Band posts:** human-readable English prose (JSON kept in metadata)
- **Architecture lock:** Cause Finding v1 → Localization; optional **Cause Revision Request** (HOLD/REVISE) — not for Klaus unless artifacts support it

**Try it:** `npm run dev` → http://localhost:3000 → Klaus → **Run Cause Room**

---

### Sun 15 Jun 2026 — Cause Room shipped in code 🔥

**Decision:** Lock **Cause Room → Localization Room** two-room model. Room 1 agents renamed and rebuilt:

| Agent | Domain | Belief |
|-------|--------|--------|
| **Claim Tracer** | Conversation only | Customer harm starts with what agent caused customer to believe |
| **Backend Witness** | Execution only | Tool/API/state is ground truth |
| **Causal Judge** | Bridge | Neither domain alone explains incident; introduces bridge hypotheses |

**Collaboration rules locked:**
- Hard evidence walls enforced in orchestrator context filters
- **2 challenge rounds** — CT + BW CHALLENGE / SUPPORT / YIELD with `opinion_changed`
- Final cause must differ from all opening hypotheses
- Cause Finding includes `evolution[]` + `recurrence_hint_request`

**Shipped in repo:**
- `src/lib/cause-room/` — types, prompts, agents, context filters
- `src/lib/orchestrator/run-cause-room-investigation.ts` — 9-post Band sequence
- `src/app/api/dev/investigate-cause-room/route.ts`
- Updated: `PRODUCT.md`, `SPRINT_PLAN.md`, agent registry

**Klaus expected arc:** hallucinated success vs API failure → **premature confirmation after failed scheduling API**

**Not built yet:** Localization Room, UI evolution feed, main dashboard wired to Cause Room

---

### Sun 15 Jun 2026 — Product pivot: belief evolution / success overturn (superseded by Cause Room lock)

**Decision:** Stop optimizing audit-chain architecture on paper. **Do not pivot domain** (said vs did is the insight). **Pivot mechanic + story:**

| Old | New |
|-----|-----|
| "Where did the call fail?" (headline) | "Customer told it worked — did it?" |
| CA → OI → FS pipeline | CA → OI → PA → **CA revises** → Recorder |
| Collaboration = Band fetch / FALSIFIED badge | Collaboration = **CA changes its mind** in Band |
| Failure Synthesizer summarizes | **Recorder:** success overturned + fix owner |

**Why:** Competitor review (Decision Desk, SafeHands, AEGIS, etc.) — judges remember **decisions and belief change**, not "multiple agents analyzed a call." SafeHands owns one-shot contradiction; we need **CA pass 2** + overturn banner (Video B).

**Judge retell test:** "AI marked success; execution proved callback never booked; pattern showed repeats; analyst withdrew success."

**Banned until Klaus runs:** new architecture docs, cross-platform, chat-agent platform pitch.

**Updated:** `PRODUCT.md`, `PROJECT_LOG.md`, `README.md`, `PROJECT_EVOLUTION_LOG.md`, `SPRINT_PLAN.md`

**Later same day — multi-room direction:** See **[EVOLUTION_AND_MULTIROOM_PLAN.md](./EVOLUTION_AND_MULTIROOM_PLAN.md)** — Room 1 Call Analyzer (CA+OI+Grounding Critic) → handoff packet → Room 2 Mistake Evaluator (3 advocates + convergence). Handoff doc for Chat to expand agents.

---

### Sat 14 Jun 2026 — late night — Fake CRM + Pattern tab live 🔥

**What happened:** Built fake CRM end-to-end. Sara tested Klaus — Pattern tab pulled customer from CRM, OI ran with `crm_context`, investigation COMPLETE.

**Shipped:**
- `/crm` dashboard — name, phone, email, birth date, address, VNR last-4
- Lookup by phone / customer_id / email / VNR from call evidence
- Pattern · L3 tab shows matched customer (Klaus demo: prior calls, open ticket, address)
- OI gets CRM context on investigate (birth date vs `check_birthday` cases)
- Seed data: Klaus, Maria, Anissa in `fixtures/crm/customers.json`

**Klaus re-test (`PMB-2024-0847`):**
- Pattern tab: **Klaus Müller** matched on `customer_id`
- CA appears resolved + OI outcome failed + cross-layer silent backend failure
- "Third scheduling failure in two weeks" visible from CRM notes field

**Ops note:** Multiple `next dev` processes broke localhost (404 on pages, API still 200). Fix: `pkill -f "next dev"`, `rm -rf .next`, one `npm run dev`.

**TODO soon:** Remove "notes" from CRM UI — notes should be customer profile only, not call summaries (currently seed data mixes both).

**Next tonight/tomorrow:** Failure Synthesizer v1, then push CRM code to GitHub for friend.

---
### Tue 16 Jun 2026 — 20:25 — Direct handoff payloads removed

**What happened:** Removed meaningful `intent`, transcript, and `decision` data from the route calls into Doer and Tool Executor.
**Problem (if any):** Even after Band-first reads, the route still passed enough direct state for the agents to work without reading the Band handoff.
**Fix / result:** `runDoer` now receives only room/user scaffolding and `runToolExecutor` receives no decision; their actual task inputs come from `handoff_to_doer` and `tool_executor_assignment` in the Band room.

---

### Tue 16 Jun 2026 — 20:18 — Band room handoffs are primary inputs

**What happened:** Strengthened ReplyChat’s Band-of-agents workflow so Doer and Tool Executor read complete room handoff payloads before using direct state.
**Problem (if any):** The previous flow posted handoffs to Band, but direct LangGraph inputs still carried enough data to look like Band was only an audit log.
**Fix / result:** Supervisor now posts a full `handoff_to_doer` payload into Band, Doer reads it first, Doer posts `tool_executor_assignment`, and Tool Executor reads that first before running tools.

---

### Tue 16 Jun 2026 — 19:57 — Chat sidebar scoped to user-123

**What happened:** Scoped the ReplyChat sidebar and chat history APIs to the single app user `user-123`.
**Problem (if any):** The sidebar listed stored chats without a fixed user filter, while this demo app is meant to behave as one user.
**Fix / result:** Chat storage now saves as `user-123`, history list/load/delete filter by that user, and the support tools still map `user-123` to the demo fixture customer for order/refund lookups.

---

### Tue 16 Jun 2026 — 19:51 — Previous chats sidebar

**What happened:** Added a previous-chats sidebar to ReplyChat.
**Problem (if any):** Chat messages were stored in Mongo, but there was no UI to browse old chat sessions.
**Fix / result:** Added `/api/chat-history` to list stored chat summaries and rebuilt `/chat/[chatId]` with a sidebar for opening previous chats or starting a new one.

---

### Tue 16 Jun 2026 — 17:47 — Failed chats persist as dashboard JSON

**What happened:** Failed ReplyChat sessions now write a full incident evidence JSON file at the repo root.
**Problem (if any):** Failed chats were registered in memory, but they were not durable JSON inputs like the other incident review examples.
**Fix / result:** Added root `failed-chat-*.json` persistence, made the incident store load those files, and verified a saved failed chat appears in the dashboard incident list format.

---

### Tue 16 Jun 2026 — 17:39 — Faulty place-order demo path

**What happened:** Added a new `place_order` intent and a `placeOrder` tool for ReplyChat.
**Problem (if any):** We needed a clean way to use our own chat agent transcript as incident evidence, with a backend failure that the customer cannot see.
**Fix / result:** `placeOrder` now tells the customer the order was placed while recording `orderPlaced: false`, `sideEffectCreated: false`, and `status: error`; the chat becomes incident evidence automatically and starts the two-agent investigation best-effort.

---

### Tue 16 Jun 2026 — 17:13 — Reply chat uses Band remote-agent handoffs

**What happened:** Added the configured Supervisor, Doer, and Tool Executor Band remote agents to each reply chat room and sent their assignments/handoffs as Band messages/events.
**Problem (if any):** The app was posting workflow traces to Band, but the LangGraph agents still mostly shared state directly instead of reading the handoff from the Band room.
**Fix / result:** Added Band role config from `.env`, room participant recruitment, per-agent API key posting, Band room payload parsing, and kept local execution as the safe fallback so chat behavior stays the same.

---

### Mon 15 Jun 2026 — 18:39 — Reply chat now feeds investigations

**What happened:** Reworked reply chat so Customer, Supervisor, Doer, Tool Executor, Assistant, and End Analyzer all post their handoffs/results through Band.
**Problem (if any):** Chat replies were not producing the same evidence shape as incident investigations, and tool calls were static mocks.
**Fix / result:** Added CSV-backed order/refund/human-handoff tools, saved workflow traces in chat history, generated `VoiceIncidentEvidence` from chats, and registered ended refund/handoff/problem chats on the dashboard.

---

### Fri 13 Jun 2026 — ~night — Full UI test pass 🎉🎉

**What happened:** Ran investigations in the dashboard on Klaus + Anissa (Maria same pattern). Everything we built showed up correctly in the UI and Band.

**Klaus (`PMB-2024-0847`):**
- CA: **appears resolved** (callback scheduled verbally)
- OI: **outcome failed** — 504 on `create_callback_appointment`, SMS skipped
- Cross-layer: *"Transcript suggests resolution but execution failed — silent backend failure"*
- Path: **direct action** (no colleague handoff)

**Anissa (`LEAP-2026-0613-anissa`) — real Leaping import:**
- CA: **appears resolved** (customer thinks colleagues will fix missing items)
- OI: **outcome failed** — `check_birthday` mismatch, email handoff only
- Badges: **path: handoff to colleagues** + **handoff: failure driven escalation** 🔴
- Cross-layer + contradiction line both fire correctly
- This is the key insight: `send_email` succeeding ≠ customer outcome achieved

**Feeling:** YES. This is not just Maria/Klaus toys — real Pflegemittelbox call shape works. The handoff taxonomy makes the demo story honest.

**Next:** Failure Synthesizer (Phase 2) when ready tonight.

---

### Fri 13 Jun 2026 — evening — L1/L2 contradiction tuning (items 1 & 2)

**What happened:** Tuned Conversation Analyst prompt + added deterministic fallbacks so the demo story hits harder.

**Changes:**
- CA prompt: explicit agent completion ("I've updated…") → `appears_resolved`
- Code fallback: `premature_closure` hints + agent completion phrases → force `appears_resolved`
- OI fallback: if execution failed + verbal closure → always set `contradicts_msg_id` in Band

**Test results (API):**
- Maria: CA `appears_resolved`, OI `outcome_failed`, contradiction **detected** ✅
- Klaus: same ✅

**Next:** Failure Synthesizer (Phase 2) tonight if energy allows.

---

### Fri 13 Jun 2026 — late evening — Handoff vs direct action taxonomy

**Problem:** Marie "forwarding to colleagues" is NOT the same as Marie solving directly — and handoff can be **by design** OR **because something failed first**.

**Fix:**
- OI prompt + deterministic `handoff-classifier` on `function_calls`
- New fields: `resolution_mode`, `handoff_reason`, `handoff_detail_en`
- UI shows path + handoff reason on OI card and cross-layer strip
- Saved real Leaping case: `test-anissa-handoff-failure.json` → `failure_driven_escalation` ✅
- Maria still → `direct_action` + `not_applicable` ✅

**Note:** Platform-agnostic — works on any evidence JSON with tool calls, not Leaping-only.

---

### Fri 13 Jun 2026 — ~14:58 — Maria investigation runs successfully 🎉

**What happened:** Clicked "Run investigation" on Maria (`SYN-2024-0002`). Status went to **COMPLETE**. Both agents posted to Band.

**What we saw:**
- **Conversation Analyst:** call *appears unresolved* from transcript alone
- **Outcome Investigator:** execution **failed** — CRM 403, confirmation email skipped
- Cross-layer line: *"Execution failed while conversation layer shows appears unresolved"*
- Two full runs in history (first ~14:55, second ~14:58)

**Feeling:** This is the core demo moment. L1 sounds OK-ish; L2 proves the backend died.

**Small polish later:** Agent said "I've updated your address" at T05 — we could tune CA to `appears_resolved` so the contradiction hits harder.

---

### Fri 13 Jun 2026 — ~14:30–14:50 — "Incident not found" bug (fixed)

**Problem:** Maria's evidence showed fine in the UI (transcript + execution 403), but **Run investigation** threw a red banner: **Incident not found**.

**Why it happened:** Incidents lived in **memory only**. Next.js dev server hot-reload wiped the store. The page still had old data cached in the browser; the API had nothing.

**Fix:** Store now **reloads from fixture files on disk** if an ID isn't in memory (`fixtures/` + `fixtures/seeded/`). Maria survives restarts.

**Lesson:** In-memory is fine for a spike; for a demo you need disk or a real DB.

---

### Fri 13 Jun 2026 — afternoon — Maria fixture + first UI test

**Added:** `fixtures/seeded/test-maria-crm-failure.json` — address update verbally OK, CRM write 403.

**Also added (for later):** `fixtures/crm/customers.json` — Klaus + Maria CRM rows (not wired in code yet).

**Tested:** Pasted JSON in dashboard → evidence tabs looked correct (Conversation T05, Execution 403).

**Teammate thread:** reprobateboffin building generator for more fake transcripts + JSON + fake CRM.

---

### Fri 13 Jun 2026 — 10:28 — Product reframe (important decision)

**Changed:** README + `PRODUCT.md` rewritten.

**Before vibe:** "What should customer service do?"  
**After vibe:** **"Where did this voice AI call fail?"** — layer + failure class + evidence.

**Why:** Matches the real Pflegemittelbox gap (transcript analysis misses `function_calls` / execution failures). Stronger hackathon story.

**Agents renamed conceptually:** Agent 4 = Failure Synthesizer (root cause + fix surface), not "Service Commander."

**Git:** `Reframe product: voice AI failure autopsy, not CS escalation.`

---

### Fri 13 Jun 2026 — 10:16 — Initial commit (Phase 0–1 + MVP dashboard)

**Shipped in one push:**

| Area | What |
|------|------|
| **Stack** | Next.js 14, TypeScript, Tailwind |
| **Band** | Client, room create, post via `/events` (thought type) |
| **Agent 1** | Conversation Analyst — transcript only (AIMLAPI gpt-4o-mini) |
| **Agent 2** | Outcome Investigator — execution + tool failures (Featherless) |
| **Orchestrator** | Two-agent flow: room → CA → Band → OI → Band |
| **APIs** | `/api/incidents`, investigate, dev spikes |
| **UI** | Home table, import panel, incident detail with evidence tabs + agent feed |
| **Hero fixture** | Klaus — verbal callback OK, scheduling 504 fail (`PMB-2024-0847`) |

**Band lessons (pain we already solved):**
- Non-UUID `task_id` → 422. Fix: omit or use UUID only.
- Room id `undefined` → Band wraps responses in `{ data: ... }`. Fixed parsing.
- `cannot_mention_self` on `/messages` → use `/events` with `message_type: "thought"`.

**Git:** `Initial commit: Incident Room Phase 0-1 with MVP dashboard`

---

## Problems we hit (honest list)

| When | Problem | Status |
|------|---------|--------|
| Band spike | 422 on task_id, undefined room id | ✅ Fixed |
| Band messages | cannot_mention_self | ✅ Fixed — use /events |
| Maria demo | Incident not found after reload | ✅ Fixed — disk fallback |
| Maria demo | Contradiction flag not firing | ✅ Fixed — CA resolved + OI contradicts |
| Pattern tab | Empty "Phase 2" placeholder | ⏳ Expected — PA not built |
| Store | Imports lost on dev restart | ✅ Mitigated — fixtures on disk |
| Env | Need `.env.local` keys (Band, AIMLAPI, Featherless) | ✅ Working locally |

---

## Wins / accomplishments

- [x] Band integration actually posts to a real room you can open in the dashboard
- [x] Two-agent investigation pipeline end-to-end
- [x] Dark "signal room" UI with evidence tabs (L1 / L2 / Pattern placeholder)
- [x] Klaus hero scenario working
- [x] Maria second scenario working after store fix
- [x] Anissa real Leaping case — failure-driven handoff taxonomy in UI
- [x] Handoff vs direct action distinction (capability vs failure-driven)
- [x] Fake CRM dashboard + lookup wired to Pattern tab + OI context
- [x] Klaus CRM match demo (prior calls + open ticket in Pattern tab)
- [x] Three demo archetypes: Klaus, Maria, Anissa
- [x] Reply chat can create investigation-ready evidence and dashboard incidents
- [x] Clear product lock in `PRODUCT.md`
- [x] GitHub repo live

---

## Breaks & context (human stuff)

_Use this section when you step away — coffee, sleep, teammate sync, hackathon chaos._

| When | Note |
|------|------|
| 13 Jun ~15:00 | Asked about a living doc to track everything → this file |
| — | _(add your breaks here)_ |

---

## What's next (backlog)

**Sprint — belief evolution (priority order)**
- [ ] Schemas: interpretation, execution_audit, pattern_assessment, ca_revision, success_verdict
- [ ] Rename `run-two-agent-investigation.ts` → `run-investigation.ts`
- [ ] OI reads CA from Band (`getRoomHistory`) — remove in-memory CA handoff
- [ ] PA posts recurrence (reads CA + OI from Band); CRM as PA input only
- [ ] **CA pass 2** — withdraw success; reads OI + PA from Band
- [ ] **Recorder** — SUCCESS OVERTURNED + engineering owner + cites MSG IDs
- [ ] Klaus guardrails: `enforceKlausAssertions` + `finalizeExecutionAudit` (504)
- [ ] UI P1: **SUCCESS CLASSIFICATION OVERTURNED** banner + CA pass 1 vs 2 visible
- [ ] Pre-seed Klaus; Vercel deploy; **90s video** (UI + band.ai room)

**Cut / defer**
- [ ] ~~Clarification loops~~ — cut
- [ ] ~~SSE~~ — cut unless sprint ahead
- [ ] ~~Chat / normalizer / DB platform~~ — cut from pitch and build
- [ ] CRM: commit + wire for PA, **or** remove Pattern tab

**Teammate (reprobateboffin)**
- [ ] Optional fixtures; Sara owns Klaus demo path

**Already done (keep)**
- [x] Two-agent pipeline + Band posts
- [x] Klaus / Maria / Anissa fixtures + handoff taxonomy
- [x] Contradiction + CRM (local)

---

## How to run (reminder)

```bash
cd ~/Projects/incident-room
npm run dev
# → http://localhost:3000
# Maria: /incidents/SYN-2024-0002
# Klaus:  /incidents/PMB-2024-0847
```

---

## Log update rules (for humans + AI)

When something meaningful happens, add a dated entry under **Timeline** (newest first):

- Fixed a bug → say what broke and why
- Shipped a feature → one sentence what it does
- Took a break / blocked → note it under **Breaks & context**
- Big decision → also add to a future "Decisions" bullet if needed

Keep language simple. Future-you at 2am should understand this in 30 seconds.
