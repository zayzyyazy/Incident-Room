# Incident Room

**Find where a voice AI call failed — when the transcript says it was fine.**

Voice AI customer calls can *sound* successful while execution failed silently: tool never called, API timeout, wrong parameters, hallucinated confirmation before the backend responded. Most tools ask one model *"was this call good?"* from the **transcript only**. Execution traces (`function_calls`, side effects, errors) often exist but never reach the verdict.

Incident Room is a **cross-layer failure autopsy** for voice AI operators. Blind specialist agents each inspect one layer of evidence, post findings to a **Band** investigation room, and a **Failure Synthesizer** (Phase 2) states root cause and failure class from Band history only.

Built for the **Band of Agents Hackathon** ([lablab.ai](https://lablab.ai)). Born from real Pflegemittelbox / Leaping QA — where transcript analysis and execution traces live in the same system but the main analyzer only reads the transcript.

> **Product lock:** See [PRODUCT.md](./PRODUCT.md) before adding features. Primary question: **where did it fail?** Not: "what should CS do?"

---

## What we are / what we are not

| We are | We are not |
|--------|------------|
| Forensic QA across conversation vs execution vs pattern | Transcript summarizer |
| "Where did it fail?" (layer + class + evidence) | "What should CS do?" escalation inbox |
| Tool for voice AI builders / operators / QA | Tool for human ticket-queue agents |
| Customer-*facing* calls as the artifact | Customer-*support workflow* automation |
| Multi-agent investigation with Band audit trail | Single LLM call with a fancy UI |

---

## What exists today (Phase 0–1 + MVP dashboard)

| Component | Status |
|-----------|--------|
| Band integration (create room, post agent events) | Done |
| Conversation Analyst (L1) | Live |
| Outcome Investigator (L2) | Live |
| Pattern Analyst (L3) | Phase 2 |
| Failure Synthesizer (Band-only) | Phase 2 |
| Operations dashboard | MVP |
| Investigation room UI | MVP |
| Paste JSON import | MVP |
| Leaping normalize pipeline | Phase 5 |

---

## The failure question (core)

Each investigation classifies failures across layers:

| Layer | Example failure modes |
|-------|------------------------|
| **Conversation (L1)** | Wrong intent, misunderstood entity, hallucinated confirmation, ended before tool result, premature verbal closure |
| **Execution (L2)** | Tool not called, parameter drift, API timeout/latency, silent tool error, workflow continued after error, missing side effect |
| **Pattern (L3)** | Same failure mode on prior calls, regression, recurring customer/workflow hit |
| **Synthesis (Band)** | Which layer owns the failure, combined root cause, fix surface (integration, prompt, policy) |

---

## Architecture

```
Evidence bundle (JSON)
        |
        v
+-------------------+
|  Next.js          |
|  Orchestrator     |
+---------+---------+
          |
    +-----+-----+
    v           v
 Agent 01     Agent 02        ... Phase 2: 03, 04
 (L1 LLM)     (L2 LLM)
    |           |
    +-----+-----+
          v
   Band REST API
   (thought events in room)
          |
          v
   Dashboard mirrors feed
   (operator-facing autopsy UI)
```

- **Orchestrator + Band REST** — not four long-lived Band SDK daemons.
- One `BAND_API_KEY`. Each agent = separate LLM call, structured JSON, post to Band.
- **Dashboard** is the demo surface; Band is the collaboration/audit layer judges can verify.

---

## The four agents

### 1. Conversation Analyst (Live)

| | |
|---|---|
| **Question** | What did the **conversation layer** assert or imply? |
| **Access** | L1 only — transcript, segments, behavioral hints |
| **Cannot see** | HTTP codes, tool logs, API payloads, recurrence |
| **Output** | `conversation_analysis` |
| **Failure lens** | Intent misunderstanding, ambiguous resolution, hallucinated or premature resolution |
| **Model** | AI/ML API `gpt-4o-mini` (fallback: Featherless) |

### 2. Outcome Investigator (Live)

| | |
|---|---|
| **Question** | What did **execution** actually do? |
| **Access** | L2 — function_calls, side_effects, structured fields from MSG-01 |
| **Cannot see** | Full transcript narrative, pattern story |
| **Output** | `outcome_analysis` |
| **Failure lens** | `parameter_drift`, `silent_tool_error`, `backend_failure`, `noop_side_effect`, `workflow_continued_after_error` |
| **Special** | `contradicts_msg_id` when L1 implies resolution but L2 shows failure |
| **Model** | Featherless (fallback: AI/ML API `gpt-4o`) |

### 3. Pattern Analyst (Phase 2)

| | |
|---|---|
| **Question** | Is this failure **recurring** for this customer or workflow? |
| **Access** | L3 — prior calls, tickets, offline CRM fixture |
| **Cannot see** | Raw transcript, raw tool payloads |
| **Output** | `pattern_analysis` (planned) |
| **Failure lens** | Systemic recurrence, repeat API failures — not queue severity as primary |

### 4. Failure Synthesizer (Phase 2)

| | |
|---|---|
| **Question** | **Where did it fail, what is the root cause class, which layer owns the fix?** |
| **Access** | **Band thread only** — no evidence JSON |
| **Output** | `failure_synthesis` (planned) — layer, classes, cited MSG IDs, fix surface |
| **Must not** | CS playbooks or ticket routing as the primary answer |

**Example synthesis:**

> Conversation layer verbally confirmed at T05 before L2 scheduling returned 504. Class: `workflow_continued_after_error` + `backend_failure`. Fix surface: scheduling API integration + confirm-after-tool policy.

---

## Hero demo: Klaus

Fixture: `fixtures/hero-klaus-minimal.json`

- **L1:** Agent verbally confirms callback for Klaus Müller (German Pflegemittelbox-style call).
- **L2:** `create_callback_appointment` → **504 Gateway Timeout**, `appointment_created: false`, SMS skipped.

The transcript can look fine while execution failed — the core failure class.

---

## Quick start

### Prerequisites

- Node.js 18+
- [Band](https://band.ai) account + remote agent API key (hackathon promo: `BANDHACK26`)
- [AI/ML API](https://aimlapi.com/) and/or [Featherless](https://featherless.ai/) keys

### Setup

```bash
git clone https://github.com/zayzyyazy/Incident-Room.git
cd incident-room
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
BAND_API_KEY=your_band_key
BAND_REST_URL=https://app.band.ai/api/v1
AIMLAPI_KEY=your_aimlapi_key
FEATHERLESS_API_KEY=your_featherless_key
```

### Run

```bash
npm run dev
```

Open **http://localhost:3000**

1. **Dashboard** — incident list, import JSON, agent status
2. Open **Klaus** incident → **Run investigation**
3. Watch agent cards appear; evidence tabs on the left

---

## Dashboard (MVP)

### `/` — Operations desk

- Incident table: status, verdicts, run count
- **Import evidence JSON** — paste `VoiceIncidentEvidence`, validate, open room
- Agent roster (live vs Phase 2)

### `/incidents/[id]` — Investigation room

- **Left:** Evidence tabs (Conversation L1, Execution L2, Pattern L3 placeholder)
- **Right:** Agent feed — cards in order after investigation
- **Run investigation** — orchestrator + Band posts
- **Verdict strip** — cross-layer failure summary
- **History** — past runs with timestamps

Band posts use `/events` (`thought` type) because Band rejects self-mentions on `/messages`. Use the room ID in the verdict strip; filter **Event type → thought** in Band UI if needed.

---

## API reference

### Incidents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents` | Register `{ evidence }` or `{ rawJson: "..." }` |
| `GET` | `/api/incidents/[id]` | Get incident + investigation history |
| `POST` | `/api/incidents/[id]/investigate` | Run 2-agent investigation → Band |

### Dev (debugging)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/dev/band-spike` | Band connectivity test |
| `POST` | `/api/dev/test-agent` | Run one agent without Band |
| `POST` | `/api/dev/investigate-two` | Run two agents without incident store |

---

## Evidence schema

`VoiceIncidentEvidence` — see `src/lib/evidence/types.ts`

```json
{
  "incident_id": "PMB-2024-0847",
  "source_platform": "leaping",
  "title": "Klaus — callback confirmed, appointment not created",
  "layer1_conversation": { "transcript": "...", "segments": [] },
  "layer2_execution": { "function_calls": [], "side_effects": {} }
}
```

---

## Repository layout

```
incident-room/
├── PRODUCT.md                      # Product lock — read first
├── src/app/                        # Dashboard + incident room + API
├── src/components/                 # UI components
├── src/lib/agents/registry.ts      # Agent roster (extend here)
├── src/lib/band/                   # Band REST client
├── src/lib/orchestrator/           # Investigation pipeline
└── fixtures/hero-klaus-minimal.json
```

### Adding a new agent

1. Add prompt + runner in `src/lib/agents/`
2. Add Zod schema in `src/lib/band/message-types.ts`
3. Register in `src/lib/agents/registry.ts` (`enabled: true`, `order`)
4. Extend orchestrator + `context-filter.ts`
5. Feed UI picks it up via registry

---

## Band integration notes

- Response wrapper: `{ "data": { "id": "..." } }`
- `task_id` on create room must be a **UUID** or omitted
- Agent posts use `/events` with `message_type: "thought"` (no self-mention on `/messages`)
- Band session titles stay generic — dashboard shows proper incident titles

Docs: [Band Agent API](https://docs.thenvoi.com/api/agent-api)

---

## Roadmap

| Phase | Scope |
|-------|--------|
| 0–1 | Band spike, two agents, dev APIs |
| 1b | MVP dashboard |
| 2 | Pattern Analyst + Failure Synthesizer, full Klaus L3 |
| 3 | Clarification loops in Band |
| 4 | CRM fixture lookup (pattern layer) |
| 5 | Leaping normalize, dev tooling |
| 6 | Multi-incident seed, SSE, Vercel deploy |

---

## Hackathon pitch (30 seconds)

> Customer voice calls fail in ways transcripts hide. Incident Room runs blind agents on conversation, execution, and pattern layers — they post to a real Band room — and a synthesizer names **where it failed** and **what class of failure** it was. Built from voice AI QA where we had execution logs but the analyzer only read the transcript.

- **Problem class:** Voice AI pipeline failures invisible to transcript-only QA
- **Band role:** Investigation record — specialists post, synthesizer reads thread only
- **Differentiation:** Layer blindness + execution forensics, not generic call scoring
- **Demo:** Klaus — verbal callback confirmed, scheduling 504, no appointment created

---

## License

MIT
