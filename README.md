# Incident Room

**The customer was told it worked. Did it actually work?**

Voice AI calls can *sound* successful while execution failed silently: the agent confirms a callback, the customer hangs up happy, and the scheduling API returned 504. Incident Room runs specialist agents through **Band** investigation rooms — with **evidence access walls** so no single agent sees the whole file.

Built for the **Band of Agents Hackathon** ([lablab.ai](https://lablab.ai)). Born from real Pflegemittelbox / Leaping QA.

---

## Screenshots

| Operations desk | Live investigation | Completed audit report |
|-----------------|-------------------|------------------------|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Live investigation](docs/screenshots/03-investigation-live.png) | ![Incident report](docs/screenshots/06-incident-report-complete.png) |

**Guide:** [How it works](docs/screenshots/04-guide.png) · `/guide` in the app

> Regenerate live captures from a running dev server: `npm run capture-screenshots` (requires Playwright Chromium — see `npm run install:browsers`).

---

## What it does today

| Layer | What happens |
|-------|----------------|
| **Evidence Router (Normalizer)** | Splits platform JSON into `transcript_packet`, `tool_trace_packet`, `definition_packet` — **no interpretation** |
| **Cause Room** | Claim Tracer (transcript only) vs Backend Witness (tools only) → challenges → Causal Judge bridge finding |
| **Architecture Room** | Control Flow / Policy / Guard investigators localize cause to workflow surfaces |
| **Theory path** | Competing theories with visible withdrawal (Priya, opaque LEAP redelivery imports) |
| **Completed report** | Audit memo: Incident finding, Customer impact, System reality, Cause/Architecture findings, Fix target |
| **Live sync** | SSE stream of Band beats during investigation; report-first after complete |

---

## Quick start

### Prerequisites

- Node.js 18+
- [Band](https://band.ai) API key
- LLM keys (AI/ML API and/or Featherless) for Cause Room agents

### Setup

```bash
git clone https://github.com/zayzyyazy/Incident-Room.git
cd incident-room
npm install
cp .env.example .env.local
# Edit .env.local — BAND_API_KEY, AIMLAPI_KEY, FEATHERLESS_API_KEY
npm run dev
```

Open **http://localhost:3000**

### Demo incidents

| ID | Path | What it shows |
|----|------|----------------|
| `SYN-2026-0615-priya` | Theory investigation | Competing theories → withdrawal → audit report |
| `LEAP-2026-0614-7c9e2a1b` | Opaque LEAP import | Auto-routes to theory path from evidence shape |
| `PMB-2024-0847` | Klaus | Full Cause + Architecture pipeline |
| `REV-2026-001` | Marta | Cross-room revision cycle |

Import JSON via **Desk → Import evidence JSON**, or use seeded fixtures in `fixtures/seeded/`.

---

## Architecture

```
Platform JSON (VoiceIncidentEvidence)
        │
        ▼
 Evidence Router ── transcript_packet ──► Claim Tracer
                 ├── tool_trace_packet ──► Backend Witness
                 └── definition_packet ──► Architecture Room
        │
        ▼
 Cause Room (Band) ── CauseFinding artifact ──► Architecture Room (Band)
        │
        ▼
 Reconciliation report + Evidence trail (expandable Band messages)
```

**Access walls:** agents receive one packet type at open. Cross-room handoff uses Band artifacts and `@mention` threads — not full evidence dumps.

See [PRODUCT.md](./PRODUCT.md) and [EVOLUTION_AND_MULTIROOM_PLAN.md](./EVOLUTION_AND_MULTIROOM_PLAN.md) for product direction.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents` | Register evidence JSON |
| `GET` | `/api/incidents/[id]/investigate/stream` | **SSE** live investigation |
| `POST` | `/api/incidents/[id]/investigate` | Run investigation (non-streaming) |
| `POST` | `/api/dev/investigate-full` | Full Cause + Architecture dev run |

---

## Repository layout

```
incident-room/
├── docs/screenshots/          # README visuals (+ capture script output)
├── fixtures/seeded/           # Demo incidents
├── src/lib/normalizer/        # Evidence Router (packets only)
├── src/lib/cause-room/        # Cause Room agents + access walls
├── src/lib/localization-room/ # Architecture Room
├── src/lib/reality/           # Theory investigation + incident report schema
├── src/lib/demo/              # Live theater UI + report views
└── scripts/capture-screenshots.mjs
```

---

## Band integration

- One room per investigation phase; agents post structured JSON as Band events
- Cross-room: `CauseFinding` artifact → Architecture Room; defense / revision cycles on Marta path
- Room links appear in completed report footer

Docs: [Band Agent API](https://docs.thenvoi.com/api/agent-api)

---

## Hackathon pitch (30 seconds)

> Customer voice calls fail in ways transcripts hide. Incident Room splits evidence so blind agents must argue — conversation vs execution vs workflow — in real Band rooms. The output is an **audit memo**, not a chat summary: what the customer believed, what the system proved, which theories died, and where to fix.

---

## License

MIT
