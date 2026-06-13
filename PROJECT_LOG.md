# Incident Room — project log

A running diary of this hackathon build. Plain language. Updated as we go.

**Repo:** https://github.com/zayzyyazy/Incident-Room  
**Team:** Sara (zay) + reprobateboffin (generator bot / fake CRM data)  
**Product one-liner:** Find where a voice AI call *actually* failed — not just what it sounded like.

---

## Where we are right now

**Status (as of Fri 13 Jun 2026, ~15:00):** Phase 0–1 is **working**. Two agents run end-to-end on Maria and Klaus. Dashboard looks good. Pattern Analyst + Failure Synthesizer still TODO.

**Demo that works today:** Import Maria JSON → Run investigation → see L1 vs L2 split + Band room link.

---

## Timeline (newest first)

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
| Maria demo | Contradiction flag not firing | 🔶 Open — tuning |
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
- [ ] Tune Maria: CA → `appears_resolved` when agent confirms address at T05
- [ ] Stronger `contradiction.detected` for L1/L2 mismatch
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
