# Incident Room — Evolution + multi-room plan (handoff for Chat)

**Purpose:** Single source of truth — how the idea evolved since Situation Room, what we're building now, and what we're trying to achieve. Use this to **expand agents**, stress-test collaboration, and refine **two Band rooms** without re-litigating the core insight.

**Repo:** https://github.com/zayzyyazy/Incident-Room  
**Hackathon:** Band of Agents 2026 · Track 1 · Deadline **19 Jun 2026, 3:00 PM UTC**  
**Updated:** 15 Jun 2026 — **LOCKED: Cause Room + Localization Room**

> **Status:** Room 1 implemented in code. See `PRODUCT.md` and `POST /api/dev/investigate-cause-room`.

---

## LOCKED ARCHITECTURE (15 Jun 2026)

### Room 1 — Cause Room ✅ in code

| Agent | Domain | Output |
|-------|--------|--------|
| Claim Tracer | Conversation only | Initial hypothesis + 2 challenge rounds |
| Backend Witness | Execution only | Initial hypothesis + 2 challenge rounds |
| Causal Judge | Bridge | Bridge hypotheses + **Cause Finding** |

**Rules:** 9 Band posts · 2 challenge rounds · final cause ≠ opening hypotheses · `evolution[]` in output

### Room 2 — Localization Room (planned)

Cause Finding + recurrence enrich + artifacts → ranked `suspect_surfaces` (not auto-fix)

---

## Part 1 — What we're trying to achieve

This is **not** another generic “AI agent evaluator” or a transcript summarizer.

She is building for a **real, growing problem:** companies deploy AI agents on **chat and voice**; when something goes wrong, operators must answer **what kind of failure was it** — API outage, tool not called, wrong tool params, hallucinated success, policy gap, etc. Transcript-only tools miss execution; log-only tools miss what the customer was told.

**The product insight (unchanged, good):**  
> The agent often **said** it worked. The **system** often **didn’t**. Operators need root cause + fix step, not a vibe score.

**What has NOT worked in planning (Sara’s frustration):**  
Sequential agents that “analyze their layer” and dump JSON into Band. That feels like **pipeline theater**, not collaboration. Sara wants agents whose **findings influence each other’s decisions** — pushback, challenged hypotheses, ruled-out causes — until **final cause and fix step** land.

**What Sara wants to explore now (new):**  
- **Two Band rooms**, not one long pipeline  
- **Room 1 — Call Analyzer:** figure out **what happened on this interaction** (conversation vs execution vs grounding)  
- **Room 2 — Mistake Evaluator:** figure out **what kind of mistake this is**, how serious/recurring it is, and **converge on final cause + fix**  
- Rooms **send structured output to each other** (handoff artifact, not shared raw evidence only)  
- **At least 3 agents per room** that **actually collaborate** (challenge / yield / support — not parallel reports)

**What Sara is NOT asking Chat to do:**  
- Talk her out of the core insight  
- Add more architecture docs without agent behavior  
- Optimize for agent count without pushback mechanics  

**What Sara IS asking Chat to help with:**  
- Expand/refine **agent roster per room** (names, jobs, post types)  
- Make collaboration **visible** — who challenges whom, what changes  
- Keep scope shippable in ~5 days (Klaus demo first)  
- One point at a time in conversation; brutal honesty; no bullet dumps unless asked  

**Friend’s work (reprobateboffin):** normalizer + JSON generator (+ optional booking bot) = **data supply only**. Not Band agents in the demo story unless explicitly added later.

---

## Part 2 — Evolution timeline (Situation Room → now)

| When | Stage | What it was | Why it changed |
|------|--------|-------------|----------------|
| Pre-hackathon | **Situation Room** | Enterprise compliance inbox (email/PDF, legal/policy agents, human approve) | Felt generic; not tied to Sara’s real work; “policy catches bad draft” is table stakes |
| 13 Jun | **Incident Room born** | Pflegemittelbox pain: transcript ≠ truth; **where did the voice call fail?** | Real domain insight; cross-layer failure |
| 13–14 Jun | **Built (code)** | 2 agents (CA + OI), linear orchestrator, Klaus/Maria/Anissa fixtures, CRM, handoff taxonomy, Band posts | Works as demo spine; **collaboration in-memory**, not Band-driven |
| 14–15 Jun | **Planning loops** | Audit chain (CA→OI→FS), assumption falsification, success overturn, CA pass 2 | Improved Band story; Sara still didn’t **feel** collaboration |
| 15 Jun | **Breakthrough** | Collaboration = **hypotheses challenged until root cause stabilizes** — not Q&A, not summary Recorder | PA wrong as “call analyzer”; better as **evaluator** in later phase |
| **Now** | **Multi-room direction** | **Call Analyzer room** → handoff → **Mistake Evaluator room** | Separates **what happened** from **what class of mistake / how to fix**; allows **3+3 agents** with clear pushback per phase |

**What we kept:** said vs did, voice/chat agents, Band, Klaus hero, Pflegemittelbox credibility  
**What we dropped from sprint pitch:** chat platform, DB platform, normalizer as hero, generic “evaluator” branding  
**What’s in code today:** still **Phase 0–1** (2-agent linear). Everything below is **target architecture**.

---

## Part 3 — Target architecture (two rooms)

```
Voice/chat evidence JSON
         │
         ▼
┌─────────────────────────────────────┐
│  ROOM 1 — CALL ANALYZER             │
│  ≥3 agents collaborate              │
│  Output: Incident Analysis Packet   │
│  (hypotheses + challenges + facts)  │
└─────────────────┬───────────────────┘
                  │ handoff (Band event or structured packet + new room)
                  ▼
┌─────────────────────────────────────┐
│  ROOM 2 — MISTAKE EVALUATOR         │
│  ≥3 agents collaborate              │
│  Input: Room 1 packet + CRM/history │
│  Output: Final cause + fix step     │
└─────────────────────────────────────┘
         │
         ▼
   Dashboard + demo video (both rooms visible)
```

**Why two rooms:**  
- **Analyzer agents** shouldn’t do recurrence math and **evaluator agents** shouldn’t re-read raw transcript — different epistemic jobs  
- Judges see **two collaboration beats** in Band, not one long scroll  
- Handoff between rooms = real **enterprise workflow** (triage room → root-cause room)

---

## Part 4 — Room 1: Call Analyzer (what happened this time)

**Room question:** *What happened on this call/chat — and what competing explanations exist?*

**Minimum 3 agents — must collaborate via challenge/yield/support on hypotheses.**

| Agent | Role | Owns | Cannot do |
|-------|------|------|-----------|
| **1. Conversation Analyst (CA)** | Conversation claims | What agent promised; customer belief; **hypothesis** (e.g. premature_success, verbal_closure) | Read tool logs |
| **2. Execution Investigator (OI)** | System reality | Tool calls, API status, errors; **hypothesis** (api_failure, tool_not_called, param_drift) | Re-tell transcript narrative |
| **3. Grounding Critic (GC)** | Cross-layer glue | **Was success claim grounded in any tool outcome?** Challenges CA vs OI (hallucination vs grounded-but-failed) | Full pattern history (that’s Room 2) |

**Collaboration mechanic (Room 1):**

1. **CA** posts `hypothesis` + claims (Band post #1)  
2. **OI** posts `hypothesis` + **CHALLENGE/SUPPORT** on CA (#2) — must cite CA MSG ID  
3. **GC** posts challenges to **both** — e.g. “Tool WAS called → not pure hallucination” (#3)  
4. **Optional short replies** — CA or OI **YIELD/HOLD** on specific claims (#4–5) if time allows  
5. **Room 1 convergence** — one post (any agent or thin “Analyzer Clerk”): **Incident Analysis Packet** — surviving facts, ruled-out classes for this call, open disputes  

**Room 1 output (handoff artifact):**  
```json
{
  "type": "incident_analysis_packet",
  "room_id": "...",
  "customer_belief": "...",
  "ruled_out": ["pure_hallucination"],
  "surviving_hypotheses": ["api_failure", "premature_verbal_success"],
  "execution_facts": ["create_callback → 504"],
  "conversation_facts": ["agent confirmed callback at T12"],
  "cited_band_message_ids": ["..."]
}
```

**Klaus example (Room 1):**  
- CA: success communicated, customer believes callback booked  
- OI: 504, no appointment — **CHALLENGE** CA success  
- GC: tool invoked → **not hallucination**; failure is **grounded API**  
- Packet → Room 2  

---

## Part 5 — Room 2: Mistake Evaluator (what mistake, how bad, what fix)

**Room question:** *Given what Room 1 proved, what is the mistake class, is it recurring, and what is the final cause + fix step?*

**Agents here do NOT re-analyze raw transcript/tool dump.** They read **Room 1 packet** (+ CRM/history).

**Minimum 3 agents — collaborate on classification and priority.**

| Agent | Role | Owns |
|-------|------|------|
| **4. Primary Cause Advocate (PCA)** | Argues **primary** mistake class | e.g. `integration/api_failure` on scheduling |
| **5. Contributing Cause Advocate (CCA)** | Argues **contributing** factor | e.g. `policy/premature_confirmation_without_tool_success` |
| **6. Recurrence Evaluator (RE)** | **Not an analyzer** — evaluates weight | One-off vs 4× this month; escalates priority; **CHALLENGE** if PCA treats as isolated |

**Collaboration mechanic (Room 2):**

1. **PCA** reads packet → posts primary class + fix surface candidate (#1)  
2. **CCA** posts contributing class — **CHALLENGE** or **SUPPORT** PCA (#2)  
3. **RE** posts recurrence — **CHALLENGE** “one-off prompt tweak” narrative if history says otherwise (#3)  
4. **Convergence post** (#4) — **Root Cause Arbiter** (7th agent role OR merged into strongest survivor):  
   - `final_primary_cause`  
   - `contributing_factors[]`  
   - `ruled_out[]`  
   - `fix_step` + `fix_owner`  
   - `cites_room1_and_room2_message_ids[]`  

**Klaus example (Room 2):**  
- PCA: primary = scheduling API timeout  
- CCA: contributing = agent confirmed before backend succeeded  
- RE: 4× this month — **not** one-off debugging  
- Convergence: fix = scheduling API + confirm-after-tool; owner = backend + voice policy  

---

## Part 6 — Agent count summary

| Location | Agents | Band posts (Klaus target) |
|----------|--------|---------------------------|
| Room 1 — Call Analyzer | CA, OI, Grounding Critic (+ optional clerk) | 4–5 |
| Room 2 — Mistake Evaluator | PCA, CCA, Recurrence Evaluator (+ arbiter) | 4–5 |
| **Total distinct agent roles** | **6–7** | **8–10 posts** across **2 rooms** |

**Hackathon minimum (3 agents):** satisfied per room if each room has ≥3 collaborating agents.  
**Demo minimum (shippable):** Room 1 complete + Room 2 with 3 agents + convergence on **Klaus only**.

**Friend’s normalizer:** produces evidence JSON **before** Room 1 — not counted.

---

## Part 7 — Collaboration rules (non-negotiable for Chat to enforce)

1. **No agent re-reads raw evidence the other layer already owns** unless Room 2 explicitly reads **Room 1 packet only**.  
2. Every post after the first in a room must include **`response_to_message_id`** + **CHALLENGE | SUPPORT | YIELD | HOLD**.  
3. **Final cause** must list **`ruled_out`** classes (e.g. hallucination ruled out on Klaus).  
4. **Handoff between rooms** is a **structured packet**, not “everyone starts over on JSON.”  
5. **Judge test:** Can someone explain Room 1 vs Room 2 in one sentence each?  
   - Room 1: *“What happened — agent said success, API failed, not hallucination.”*  
   - Room 2: *“What mistake — recurring API + premature OK; fix scheduling + confirm-after-tool.”*

---

## Part 8 — Demo (Klaus) — Video B

**Human line:** *“Great, thanks for booking the callback.”*

1. Show **Room 1** in band.ai — 3 agents challenge; packet generated  
2. Show **handoff** — new room or thread event  
3. Show **Room 2** — recurrence changes weight; convergence  
4. UI: side-by-side or tabs **Analyzer | Evaluator**  
5. End: **final cause + fix owner** — not “success overturn” alone (can include that inside convergence)

---

## Part 9 — What’s built vs what’s planned

| Item | Status |
|------|--------|
| CA + OI (linear, in-memory handoff) | ✅ Built |
| Klaus / Maria / Anissa fixtures | ✅ Built |
| CRM (local) | ✅ Built (use for RE in Room 2) |
| Band post integration | ✅ Built |
| Two rooms + handoff packet | ❌ Planned |
| Grounding Critic, Room 2 advocates, arbiter | ❌ Planned |
| Challenge/yield message types | ❌ Planned |
| Multi-room demo video | ❌ Planned |

---

## Part 10 — Scope cuts (still apply)

- No chat-agent platform story in pitch  
- No database/normalizer as demo hero  
- No SSE unless both rooms run  
- CRM: commit for RE or inject hardcoded Klaus recurrence for demo  
- Maria/Anissa: app only, not video  

---

## Part 11 — Open questions for Chat (one at a time)

1. Are **6–7 agent roles** too many for 5 days? Minimum viable: 3+3 without clerk/arbiter as separate processes?  
2. Should Room 2 be a **new Band room** or same room with `phase: evaluator` metadata?  
3. Is **Grounding Critic** the right third analyzer, or split OI into Tool vs API agents?  
4. Should **Convergence** be an agent or deterministic merge when no unresolved CHALLENGE remains?  
5. Product name on slide: still **Incident Room** or **Call Analyzer → Mistake Evaluator** as subtitle?

---

## Part 12 — One-paragraph pitch (current)

> AI agents on voice and chat fail in ways transcripts hide — API errors, tool failures, or false success. **Incident Room** runs two Band investigation rooms. In the **Call Analyzer**, three agents compete over what happened and challenge each other’s hypotheses until the facts stabilize. That packet hands off to the **Mistake Evaluator**, where three more agents fight over mistake class, recurrence, and fix ownership until root cause and fix step converge. Collaboration isn’t summaries — it’s **pushback until the cause survives**.

---

## Part 13 — Related repo docs

| File | Contents |
|------|----------|
| [PRODUCT.md](./PRODUCT.md) | Product lock (may lag multi-room — update after Chat session) |
| [PROJECT_LOG.md](./PROJECT_LOG.md) | Build journal |
| [PROJECT_EVOLUTION_LOG.md](./PROJECT_EVOLUTION_LOG.md) | Longer history |
| [SPRINT_PLAN.md](./SPRINT_PLAN.md) | Previous single-room sprint (superseded by this doc for agent design) |

---

*Handoff complete. Chat: help Sara refine agents per room and collaboration posts — not whether the core insight is valid.*
