# Incident Room — Project Evolution Log

**Purpose:** Handoff document for strategic review. Historical record of idea evolution.

**As of:** Sun 15 Jun 2026 — **direction locked** (see below)  
**Submission deadline:** Band of Agents Hackathon — **19 Jun 2026, 3:00 PM UTC**  
**Repo:** https://github.com/zayzyyazy/Incident-Room  
**Sprint plan:** [SPRINT_PLAN.md](./SPRINT_PLAN.md) · **Product lock:** [PRODUCT.md](./PRODUCT.md)

---

## LOCKED DIRECTION (15 Jun 2026) — read this first

**Do not pivot domain.** Insight: agent said success, reality said failure (Pflegemittelbox).

**Pivot mechanic + story:**
- Headline: **The customer was told it worked. Did it actually work?**
- Not headline: "where did it fail?" / generic agent evaluator / audit pipeline
- Collaboration: **belief evolution** — **CA posts twice** and **withdraws success** after OI + PA
- Band flow: **CA → OI → PA → CA (revise) → Recorder**
- Final: **SUCCESS CLASSIFICATION OVERTURNED** + engineering owner
- Demo: Klaus only on video; **Video B** (human line + red banner + band.ai room)

**Judge test:** CA pass 1 vs pass 4 — different **incident type**, not "OI was right."

**Execution:** Code still Phase 0–1 (2-agent linear). Next = ship 5-post flow. **No more architecture brainstorming until Klaus runs.**

---

## 1. Executive summary (historical — pre-lock)

**Original ambition:** Win the Band of Agents Hackathon with a multi-agent system that feels impossible to fake — agents genuinely collaborating, not a linear pipeline with a Band log at the end.

**Current product name:** **Incident Room**  
**Current one-liner:** Find where an AI agent interaction *actually* failed — when the conversation layer says success but execution/logs prove otherwise.

**What works:** Strong niche insight (from real Pflegemittelbox QA work), working two-agent pipeline, compelling demo fixtures (Klaus, Maria, Anissa), Band integration, fake CRM, handoff taxonomy, dark operator UI.

**What does NOT feel solved:** **Multi-agent collaboration as an idea.** Teammate and friend correctly flagged that agents mostly run independently; only the planned Failure Synthesizer was intended to read Band. The team does not yet believe the collaboration story is strong enough to win against top submissions.

**Team stance now:** Open to pivoting domain framing, agent roles, and collaboration mechanics. **Not** married to current architecture if a better hackathon-winning direction exists. Priority is **wow demo + wow Band collaboration**, not preserving code.

---

## 2. Hackathon context (constraints for any strategist)

### Event
- **Band of Agents Hackathon 2026** on [lablab.ai](https://lablab.ai/ai-hackathons/band-of-agents-hackathon)
- **Challenge:** ≥3 specialized agents collaborating **through Band** across planning, execution, review, decision-making, or task handoff
- Band must be the **coordination layer** — not notification-only, not thin wrapper
- **Submission requires:** project description, video, slides, public GitHub, **working demo URL**

### Tracks (team should pick one primary)
| Track | Fit for Incident Room |
|-------|------------------------|
| **Track 1: Internal Enterprise Workflows** | **Best fit** — lablab explicitly lists *"customer support escalation"* and cross-team ops |
| Track 2: Multi-Agent Software Development | Poor fit (DevBand etc. own this) |
| Track 3: Regulated & High-Stakes Workflows | Secondary fit if framed as auditable investigation / traceability |

### Judging criteria (paraphrased from lablab)
1. **Application of technology** — Band as coordination: handoffs, shared context, role specialization, task state
2. **Presentation** — problem, agent roles, Band’s role, context flow, value — easy to understand in video
3. **Business value** — real enterprise workflow, reduces manual coordination, improves decisions
4. **Originality** — beyond chatbot / single agent / linear automation; agents **review outputs, escalate, coordinate across frameworks**

### Partner credits in stack
- **AIMLAPI** → Conversation Analyst (gpt-4o-mini)
- **Featherless** → Outcome Investigator
- **Band Pro** — promo `BANDHACK26`

---

## 3. Origin story — how this project started (conversation arc)

### Phase A — Situation Room (rejected)
The hackathon began with an existing PDF plan: **"Situation Room"** — enterprise compliance inbox (email/PDF intake, legal/policy agents, human approve/reject, EU compliance angle, "Legal Bomb" rejection loop).

**Why it was abandoned:**
- Felt like generic **smart inbox / IDP** — table stakes in 2026
- Not aligned with builder’s real recent work (Pflegemittelbox QA, Marie tooling, creative pipelines)
- "Policy catches bad draft" is not a headline wow moment anymore
- Team gut check: would not be exciting to build for 48 hours

### Phase B — Incident Room born from Pflegemittelbox pain
**Core lived experience** (from building Pflegemittelbox QA locally — single-agent, unstable, transcript-only):

> Transcripts alone are not enough to understand AI voice failures.

Repeated real patterns:
- Conversation *sounds* successful; customer confirms; transcript implies task completed
- Underlying system state differs: mutated insurance number in function call, backend 504, CRM 403, tool never called, hallucinated confirmation before API responded
- Meaningful observability requires **cross-layer** analysis: conversation vs execution vs customer history

This became the **unfair insight** — not "evaluate if call was good" but **"where did the stack fail?"**

### Phase C — Situation Room vs Incident Room comparison
Team doc compared two hackathon options. **Incident Room won** because:
- Grounded in real domain work (Pflegemittelbox / Leaping)
- Clear demo villain: **silent backend failure** while agent sounds helpful
- Maps to hackathon example: customer support **escalation / investigation**
- Information asymmetry between agents (blind layers) is structurally interesting

### Phase D — Product lock (13 Jun 2026)
Explicit decision in `PRODUCT.md`:

**Primary question:** *Where did this voice AI call fail?*  
**Answer format:** layer + failure class + evidence (MSG IDs in Band)

**Forbidden as primary output:** CS escalation playbooks, "what should CS do now?", transcript summary without execution cross-check

**Four locked agent roles (conceptual):**
| Agent | Question |
|-------|----------|
| Conversation Analyst | What did the **conversation layer** assert or imply? |
| Outcome Investigator | What did **execution** actually do? |
| Pattern Analyst | Is this failure **recurring**? |
| Failure Synthesizer | **Where** did it fail, class, fix surface — **Band only** |

### Phase E — Idea expansion (mid conversation, ~12 Jun)
After talking with teammate (**reprobateboffin**), scope broadened in **planning** (not fully built):

- Not only voice — **any agentic workflow** (chat, calls) where tools/functions run
- Raw platform exports → **normalizer** → canonical `VoiceIncidentEvidence` JSON (rename mentally to `AgentFailureEvidence`)
- **Database** of failed interaction JSONs (friend’s generator + friend’s separate booking chatbot feeds data — side project, not core)
- **No** pre-label "success/fail assessment agent" — would steal synthesis job

**Still NOT built:** full normalizer pipeline, chat fixtures from friend’s bot, Pattern Analyst agent, Failure Synthesizer agent

### Phase F — Collaboration crisis (current)
Friend reviewed project and said: **agents run separately; only the last one truly collaborates.** Team agrees.

User’s deeper requirement (evolved through conversation):
- Collaboration must be **meaningful** — not forced Q&A
- **Output of agent N must become input to agent N+1** — each agent should consume peers’ **analysis/opinions**, not just restate raw transcript
- Wants **pushback**, agents asking each other, **no single agent** owning final truth alone
- Willing to pivot if collaboration idea isn’t tight enough

---

## 4. The unfair insight (keep or lose?)

**The magic trick judges should get in 5 seconds:**

> The agent **told the customer it worked**. The **tool log proves it didn’t**.

Examples in fixtures:
| Case | ID | L1 (conversation) | L2 (execution) | Special |
|------|-----|-------------------|----------------|---------|
| **Klaus** | PMB-2024-0847 | Verbal callback confirmed | `create_callback_appointment` 504 | CRM recurrence, direct action |
| **Maria** | SYN-2024-0002 | Agent says address updated | CRM write 403 | direct action |
| **Anissa** | LEAP-2026-0613-anissa | Customer thinks colleagues will fix | Birthday mismatch → email handoff only | **failure_driven_escalation** |

**Competitive landscape finding:** Reviewed peer repos — **none** focus on this cross-layer forensic gap. Crowded lanes: compliance veto (Decision Desk), vendor approval (Gatekeeper), AML (Compliance Guardian), SDLC (DevBand).

**Strategist question:** Is this insight still the winning core, with better collaboration wrapped around it? Or does the insight need reframing?

---

## 5. What was actually built (implementation snapshot)

### Stack
- Next.js 14, TypeScript, Tailwind, App Router
- Band REST API (`createRoom`, `postMessage` via `/events`, `message_type: thought`)
- LLM router: AIMLAPI + Featherless

### Live today (2 agents + orchestrator)
```
Evidence JSON → Orchestrator → CA (L1 only) → post Band
                              → OI (L2 + CRM + CA analysis IN MEMORY) → post Band
                              → UI mirrors feed
```

**Critical architectural honesty:**
- Orchestrator passes `conversationAnalysis` to OI via **in-memory object** (`forAgent02(evidence, conversationAnalysis, crmLink)`)
- OI does **not** fetch prior posts from Band history
- Agents do **not** @mention each other in post bodies meaningfully yet
- **Failure Synthesizer not built**
- **Pattern Analyst not built** (CRM tab shows lookup preview only)

### Key files
| Path | Role |
|------|------|
| `src/lib/orchestrator/run-two-agent-investigation.ts` | Linear two-agent orchestrator |
| `src/lib/orchestrator/context-filter.ts` | Blind layer filtering + in-memory CA→OI handoff |
| `src/lib/agents/conversation-analyst.ts` | L1 agent |
| `src/lib/agents/outcome-investigator.ts` | L2 agent |
| `src/lib/orchestrator/handoff-classifier.ts` | direct_action vs handoff_to_colleagues + failure_driven_escalation |
| `src/lib/orchestrator/contradiction.ts` | L1/L2 mismatch → contradicts_msg_id |
| `src/lib/band/client.ts` | Band integration |
| `src/lib/crm/*` | Fake CRM (local, partially uncommitted) |
| `PRODUCT.md` | Product lock |
| `fixtures/` | Klaus, Maria, Anissa evidence + CRM seed |

### Demo fixtures
- `fixtures/hero-klaus-minimal.json`
- `fixtures/seeded/test-maria-crm-failure.json`
- `fixtures/seeded/test-anissa-handoff-failure.json`
- `fixtures/crm/customers.json`

### UI
- Home incident table, import JSON, incident detail
- Evidence tabs: Conversation / Execution / Pattern (Pattern = CRM preview)
- Agent feed, verdict strip, cross-layer contradiction line
- `/crm` dashboard for fake customer records

### Git status note
Last push included handoff taxonomy + Anissa. **CRM work may still be local uncommitted.** FS/PA not shipped.

---

## 6. Collaboration variants explored (idea level, not built)

The team explored 5 collaboration models. User feedback on each:

| Variant | Name | User reaction |
|---------|------|---------------|
| 1 | **Certification gate** (CA proposes success, OI vetoes) | Too similar to Decision Desk; didn’t feel like “using each other’s output” |
| 2 | **Red team / Blue team** | Sounded collaborative but needs evidence provider; defend/prosecute framing awkward |
| 3 | **Socratic loop** (OI asks CA questions in Band) | **Felt amazing** — but user worried it’s “answers from transcript” not peer analysis |
| 4 | **Incident commander** (Lead posts open questions) | Liked, but feels like **one boss agent** |
| 5 | **Peer jury with dissent** | **Felt amazing** — no single decider; FS records disagreement |

### Narrowed to two finalists (before latest optimization)
- **Option A:** Socratic loop (+ Record Keeper for MSG index)
- **Option B:** Peer jury with dissent

User then chose to **optimize Option A** because Option B felt “too forced” unless responses are truly meaningful.

### Latest proposed model — **Assumption audit loop** (not built)

**Core rule:** Each agent publishes **structured analysis with testable fields**. Next agent’s input = **prior agent’s JSON from Band**, not orchestrator memory.

| Step | Agent | Post type | Input from Band |
|------|-------|-----------|-----------------|
| 1 | Record Keeper | `EVIDENCE_INDEX` | — |
| 2 | Conversation Analyst | `Interpretation` — customer_belief, agent_commitments, **`if_true_then_backend[]`** | index |
| 3 | Outcome Investigator | `ExecutionAudit` — VERIFIED/FALSIFIED each implication | **CA Interpretation** |
| 4 | Conversation Analyst (2nd) | `RevisedInterpretation` — accept/dispute OI’s broken_assumptions | **OI ExecutionAudit** |
| 5 | Pattern Analyst | `PatternChallenge` — challenges CA/OI framing with CRM recurrence | OI + CA revised |
| 6 | Investigation Recorder | `Record` — consensus + dissent + fix surface | full thread |

**Why this was proposed:** OI audits **CA’s logical implications**, CA **revises opinion** from OI output, PA **attacks their joint story** — opinion-on-opinion, not transcript lookup.

**Status:** Concept only. **Not implemented.** Team still feels it needs tightening before build.

---

## 7. Competitor projects reviewed (idea comparison, not build quality)

| Repo | Idea | Collaboration mechanic |
|------|------|------------------------|
| [band-decision-desk](https://github.com/Nikoble1926/band-decision-desk) | Regulated trade approval | **VETO loop** A→B→A→B→A, real Band screenshot |
| [Gatekeeper-vendor-risk](https://github.com/Decodexai/Gatekeeper-vendor-risk) | Vendor onboarding | 5 agents, @mentions, escalations, memory events |
| [compliance-guardian](https://github.com/Sule-Bashir/compliance-guardian) | AML transaction review | 3 agents + human review, **live deployed demo** |
| [ai-software-deliver (DevBand)](https://github.com/Varun988/ai-software-deliver) | SDLC multi-agent | Plan→code→test→**review→revision**→docs |
| [balai](https://github.com/jinchuntan/balai) | HOA communal decisions | Human approval gates; Band stub |
| [Aether-Flow-Swarm](https://github.com/Faheem-ud-darain/Aether-Flow-Swarm) | Project scoping + compliance | Pipeline; Band = notifications |
| [threedee-world-magic / Aether Labs](https://github.com/saif123471/threedee-world-magic) | E-commerce agent orchestration | Linear n8n; admits A2A not implemented |

**Pattern:** Winners-in-waiting build **decision tools with visible conflict** — veto, escalate, revise, block.

**Our lane:** Forensic **investigation** not approval — but hackathon judges may score **visible pushback** higher than silent cross-layer analysis unless we make pushback obvious in Band.

---

## 8. Team structure

| Role | Scope |
|------|--------|
| **Primary builder** | Next.js, agents, Band, UI, product |
| **Data generator** | `VoiceIncidentEvidence` JSON from raw exports; fake CRM fixtures |

**Division of labor intent:**
- Primary: investigation product + Band collaboration
- Generator: normalizer/adapters + fixture factory at volume

**Risk:** Depending on external generator for demo data — keep 5–8 fixtures in-repo regardless.

---

## 9. Canonical data model (current)

**`VoiceIncidentEvidence`** — platform-agnostic JSON:
- `source_platform`: leaping | vapi | retell | bland | synthetic
- `layer1_conversation`: segments, behavioral_hints
- `layer2_execution`: function_calls, errors, side_effects
- `layer3_pattern` (optional in evidence; PA may enrich from CRM)

**Fake CRM:** JSON file lookup by phone, customer_id, email, vnr_last4 — not Zendesk.

**Planned rename (idea level):** `AgentFailureEvidence` with `channel: voice | chat`

---

## 10. What the team believes wins (hypothesis)

1. **One unforgettable demo beat** — Klaus or Anissa in 20 seconds
2. **Band room as hero** — not just pretty dashboard; screenshot of agents pushing back
3. **Cross-layer contradiction** — unique vs competitors
4. **≥4 agents** with visible specialization
5. **Live deploy URL** + 60–90s video
6. **Meaningful collaboration** — peer outputs as inputs, not parallel homework

## 11. What the team believes is NOT working yet

1. **Collaboration is still conceptual** — implementation is pipeline
2. **Pitch drift risk** — "AI agent evaluator" sounds generic; "database" is not the hero
3. **FS as only Band-reader** — too little too late
4. **Forced Q&A** without opinion-on-opinion feels fake
5. **Certification/veto clone** of Decision Desk — user rejected as primary frame
6. **Boss agent** (Incident Commander) — user rejected
7. **Submission gaps:** no FS, no PA, no deploy, no video, CRM maybe uncommitted

---

## 12. Open strategic questions (for Claude / next review)

1. **Keep the forensic niche** (said vs did) or reframe as a **decision gate** ("may we mark this interaction successful?") to match judge-friendly veto loops without losing uniqueness?

2. **Best collaboration primitive** for this domain:
   - Assumption audit loop (CA implications → OI falsify → CA revise)?
   - Socratic QUESTION/ANSWER ( capped at 1–2)?
   - Peer jury CONFIRM/CHALLENGE/DISSENT?
   - Hybrid?

3. **Minimum agent set** that feels like 4–6 agents collaborating without padding roles?

4. **Is Record Keeper necessary** or does it dilute collaboration?

5. **Track 1 vs Track 3** — which story scores higher given competitor saturation in Track 3?

6. **Should Failure Synthesizer exist at all** or should "Investigation Recorder" only merge without analyzing raw logs?

7. **Chat + voice in one demo** — required for "cross-framework" or distraction this week?

8. **Full pivot acceptable?** Team says yes if wow + collaboration + win probability increase.

---

## 13. Non-negotiables (soft — challenge if wrong)

These are team inclinations, **not** hard rules for the strategist:

- Band must be structurally necessary (not notification dump)
- Demo must show **cross-layer failure** (conversation vs execution)
- Avoid becoming generic CS ticket router
- Prefer agents consuming **each other’s structured outputs**
- Prefer **collective** conclusion over single oracle agent
- ~5 days remain — scope must be ruthless

---

## 14. Suggested assets for strategist to read

| Asset | Path / URL |
|-------|------------|
| Product lock | `PRODUCT.md` |
| Build diary | `PROJECT_LOG.md` |
| README | `README.md` |
| Klaus fixture | `fixtures/hero-klaus-minimal.json` |
| Anissa fixture | `fixtures/seeded/test-anissa-handoff-failure.json` |
| Orchestrator (honest collab gap) | `src/lib/orchestrator/run-two-agent-investigation.ts` |
| Hackathon page | https://lablab.ai/ai-hackathons/band-of-agents-hackathon |

---

## 15. Timeline compressed

| When | Milestone |
|------|-----------|
| Pre-hackathon | Situation Room PDF plan |
| Chat start | Uniqueness + collaboration concerns; Situation Room rejected |
| Insight | Pflegemittelbox → cross-layer failure autopsy |
| 13 Jun | Incident Room scaffold, 2 agents, Klaus/Maria, PRODUCT lock |
| 13–14 Jun | Anissa, handoff taxonomy, contradiction tuning, fake CRM |
| 12 Jun (conversation) | Broaden to chat+voice agent failures; database/normalizer plan |
| 12 Jun (conversation) | Competitor review; collaboration variants; assumption audit loop proposed |
| **Now** | **Strategic pause — optimize collaboration idea before building FS/PA** |
| 19 Jun | Submission deadline |

---

## 16. One-paragraph pitch (current)

Voice and chat AI agents fail in ways transcripts hide: the agent confirms success while tools timeout, CRM rejects writes, or parameters mutate. **Incident Room** runs blind specialist agents on conversation, execution, and customer pattern. They should collaborate in a **Band investigation room** — challenging each other’s interpretations until the team produces a cross-layer failure diagnosis with engineering fix surface. The team has a working two-agent prototype and compelling demo data, but believes **the collaboration model must be redesigned** so each agent’s structured output becomes the next agent’s input — meaningful pushback, not a pipeline — before building the remaining agents and submission assets.

---

## 17. Explicit ask to next reviewer (Claude)

Please use hackathon judging criteria + competitor patterns above to:

1. **Recommend one collaboration architecture** (or two max) that maximizes wow and Band score for this niche
2. **Say whether to keep, narrow, or pivot** the forensic "said vs did" domain
3. **Define agent roster + Band message types + handoff rules** so output→input is enforced
4. **Propose 90-second demo script** beat-by-beat
5. **Cut scope ruthlessly** for 5 days to submission

The team is **not** asking for code yet — asking for a **tightened winning direction**.

---

*End of evolution log.*
