# Incident Room — project log

A running diary of this hackathon build. Plain language. Updated as we go.

**Repo:** https://github.com/zayzyyazy/Incident-Room  
**Team:** Sara (zay) + reprobateboffin (generator bot / fake CRM data)  
**Product one-liner:** Find where a voice AI call *actually* failed — not just what it sounded like.

---

## Where we are right now

**Status (as of Tue 16 Jun 2026, 20:18 UTC):** Phase 0–1 demo is still working, reply chat now recruits configured Band remote agents, Doer and Tool Executor read Band room assignment payloads first, failed chats persist as root incident JSON files, and previous Mongo-stored chats for `user-123` can be reopened from a ChatGPT-style sidebar.

**Demo that works today:**
- **Klaus** — direct action, scheduling 504, `path: direct action`
- **Maria** — direct action, CRM 403, contradiction + Band link
- **Anissa** (real Leaping) — handoff after birthday fail, `failure driven escalation`

---

## Timeline (newest first)

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

**Phase 2 — more agents**
- [ ] Pattern Analyst (prior calls, recurrence) — wire `fixtures/crm/customers.json`
- [ ] Failure Synthesizer — Band-only root cause + fix surface

**Phase 3**
- [ ] Clarification loops (OI → CA, max 2 re-runs)

**Demo polish**
- [x] Tune Maria: CA → `appears_resolved` when agent confirms address at T05
- [x] Stronger `contradiction.detected` for L1/L2 mismatch
- [ ] Pre-seed Maria + Klaus on home page (no import step for judges)

**Teammate (reprobateboffin)**
- [ ] Generator: 3–5 failure archetypes matching `VoiceIncidentEvidence` schema
- [ ] CRM rows keyed by phone / customer id
- [ ] Failure types: silent_backend_failure, parameter_drift, noop_confirmation, etc.

**Later / nice-to-have**
- [ ] Persist investigations to disk (not just evidence fixtures)
- [ ] SSE live feed, Vercel deploy

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
