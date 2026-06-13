# Incident Room

**Cross-layer voice incident investigation for customer support.**

Voice AI calls can look successful in the transcript while execution failed silently — tool timeouts, missing side effects, parameter drift. Incident Room runs **blind specialist agents** on different evidence layers, posts findings to a **Band** collaboration room, and (Phase 2+) lets a **Service Commander** decide escalation from Band history only.

Built for the **Band of Agents Hackathon** (lablab.ai). Inspired by real QA work on Pflegemittelbox / Leaping voice calls where transcript-only analysis misses execution failures.

---

## What exists today (Phase 0–1 + MVP dashboard)

| Layer | Status |
|-------|--------|
| Band integration (create room, post agent events) | Done |
| Conversation Analyst (L1) | Live |
| Outcome Investigator (L2) | Live |
| Customer Impact Analyst (L3) | Phase 2 |
| Service Commander (Band-only) | Phase 2 |
| Operations dashboard | MVP |
| Investigation room UI | MVP |
| Paste JSON import | MVP |
| Real Leaping normalize pipeline | Phase 5 |

---

## The problem

Many voice QA tools ask one model: *"Was this call good?"* using the **transcript only**.

Execution data (`function_calls`, API errors, side effects) often exists but is **not fed to the verdict model**. The call can **sound** resolved while the backend never created the appointment, sent the SMS, or updated CRM.

Incident Room splits investigation across agents with **enforced information asymmetry** — each agent only sees its layer — and uses **Band** as the shared audit trail.

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
   (human-facing war room)
```

- **Orchestrator + Band REST** — not four long-lived Band SDK daemons.
- One `BAND_API_KEY`. Each agent = separate LLM call, structured JSON, post to Band.
- **Dashboard** is the demo surface; Band is the collaboration/audit layer judges can verify.

---

## The four agents (product spec)

### 1. Conversation Analyst (Live)

| | |
|---|---|
| **Question** | What did the call *look like* to the customer? |
| **Access** | Layer 1 only — transcript, segments, behavioral hints |
| **Cannot see** | HTTP codes, tool logs, CRM, churn |
| **Output** | `conversation_analysis` with `conversation_verdict` |
| **Verdicts** | `appears_resolved` / `appears_unresolved` / `ambiguous` |
| **Model** | AI/ML API `gpt-4o-mini` (fallback: Featherless) |

### 2. Outcome Investigator (Live)

| | |
|---|---|
| **Question** | Did the intended outcome *actually happen*? |
| **Access** | Layer 2 — function_calls, side effects, structured MSG-01 fields |
| **Cannot see** | Full transcript prose, business/churn narrative |
| **Output** | `outcome_analysis` with `execution_verdict` |
| **Verdicts** | `outcome_achieved` / `outcome_failed` / `outcome_uncertain` |
| **Special** | Sets `contradicts_msg_id` when L1 says resolved but L2 failed |
| **Model** | Featherless (fallback: AI/ML API `gpt-4o`) |

### 3. Customer Impact Analyst (Phase 2)

| | |
|---|---|
| **Question** | How bad is this for the customer and queue? |
| **Access** | Layer 3 — prior calls, open tickets, recurrence (offline CRM fixture) |
| **Cannot see** | Raw transcript, raw tool payloads |
| **Output** | `customer_impact_analysis` |
| **May** | Dispute Outcome severity via `disputes_msg_id` |

### 4. Service Commander (Phase 2)

| | |
|---|---|
| **Question** | What should customer service *do*? |
| **Access** | **Band thread only** — no evidence JSON |
| **Output** | `service_resolution` — severity, actions, cites MSG IDs |
| **Constraint** | Cannot use facts not present in Band history |

---

## Hero demo: Klaus

Fixture: `fixtures/hero-klaus-minimal.json`

- **L1:** Agent verbally confirms callback for Klaus Muller (German Pflegemittelbox-style call).
- **L2:** `create_callback_appointment` returns **504 Gateway Timeout**, `appointment_created: false`, SMS skipped.

The transcript can look fine while execution failed — the core incident class.

---

## Quick start

### Prerequisites

- Node.js 18+
- [Band](https://band.ai) account + remote agent API key (hackathon promo: `BANDHACK26`)
- [AI/ML API](https://aimlapi.com/) and/or [Featherless](https://featherless.ai/) keys

### Setup

```bash
git clone <your-repo-url>
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
2. Open **Klaus** incident, click **Run investigation**
3. Watch agent cards appear; evidence tabs on the left

---

## Dashboard (MVP)

### `/` — Operations desk

- Table of incidents: status, last conversation/execution verdict, run count
- **Import evidence JSON** — paste a `VoiceIncidentEvidence` bundle, validate, open incident room
- Agent roster (live vs Phase 2)

### `/incidents/[id]` — Investigation room

- **Left:** Evidence tabs (Conversation L1, Execution L2, Customer L3 placeholder)
- **Right:** Agent feed — cards appear in order after investigation
- **Run investigation** — triggers orchestrator + Band posts
- **Verdict strip** — cross-layer summary
- **History** — past runs with timestamps and verdicts

Band posts use the **events API** (`thought` type) because Band rejects self-mentions on `/messages`. In Band UI, filter **Event type -> thought**, or use the room ID in the verdict strip.

---

## API reference

### Incidents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents` | Register `{ evidence }` or `{ rawJson: "..." }` |
| `GET` | `/api/incidents/[id]` | Get incident + investigation history |
| `POST` | `/api/incidents/[id]/investigate` | Run 2-agent investigation, post to Band |

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

Paste full JSON on the dashboard import panel.

---

## Repository layout

```
incident-room/
├── src/app/
│   ├── page.tsx                    # Dashboard
│   ├── incidents/[id]/page.tsx     # Investigation room
│   └── api/incidents/              # CRUD + investigate
├── src/components/
│   ├── dashboard/                  # Import panel
│   └── incident/                   # Evidence, feed, verdict
├── src/lib/
│   ├── agents/                     # Prompts, runners, registry
│   ├── band/                       # Band REST client
│   ├── evidence/                   # Zod types
│   ├── incidents/                  # In-memory store
│   ├── llm/                        # Multi-model router
│   └── orchestrator/               # Context filter, pipeline
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
- Agent posts cannot self-mention on `/messages` — use `/events` with `message_type: "thought"`
- Room titles stay "New Session" in Band until a human text message — dashboard shows proper titles

Docs: [Band Agent API](https://docs.thenvoi.com/api/agent-api)

---

## Roadmap

| Phase | Scope |
|-------|--------|
| 0-1 | Band spike, two agents, dev APIs |
| 1b | MVP dashboard |
| 2 | Customer Impact + Service Commander, full Klaus L3 |
| 3 | Clarification loops in Band |
| 4 | CRM fixture lookup |
| 5 | Leaping normalize, dev tooling |
| 6 | Multi-incident seed, SSE, Vercel deploy |

---

## Hackathon positioning

- **Track 1:** Customer support escalation — voice AI incident response
- **Track 3 tag:** Regulated demo (German healthcare-adjacent hero call)
- **Pitch:** Agents hold different layers of reality and coordinate in Band; remove Band and the Commander is blind.

---

## License

MIT
