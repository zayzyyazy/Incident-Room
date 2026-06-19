# Incident Room — Speaker Notes

**Total time:** ~6–8 minutes (hackathon) · **Demo slide:** 90 seconds live

---

## Slide 1 — Title (20s)

- "Incident Room — we built this for the Band of Agents hackathon."
- Tagline: voice incidents contested in public, Band on the left, verdict in-app on the right.

## Slide 2 — Hook (25s)

- Read the quote slowly.
- "Every voice AI team has seen this: the call sounds perfect, the customer is happy, and the tool trace tells a different story."

## Slide 3 — Problem (40s)

- Success theater: agents optimize for conversational closure, not execution truth.
- No shared audit room where specialists can challenge each other.

## Slide 4 — Hero (45s)

- Maria Santos, Northside Family Clinic, Retell voice agent.
- She heard a confirmation; Cal.com returned 503 — slot never reserved.
- This is our demo incident: `retell_call_clinic_44102`.

## Slide 5 — Solution (35s)

- Structured evidence → recruited specialists → live investigation.
- Band is the public collaboration layer; Incident Room is the investigation desk.

## Slide 6 — Demo layout (30s)

- **This is the money shot for judges:** split screen.
- Fresh Band room each refresh; investigation streams beats over SSE.

## Slide 7 — Multi-agent (40s)

- Normalizer only routes — no interpretation.
- Claim Tracer vs Backend Witness — conversation vs execution walls.
- Crew appears one-by-one in the Investigation Bay (Among Us energy).

## Slide 8 — Evidence layers (35s)

- Three layers in `VoiceIncidentEvidence` — conversation, execution, customer context.
- Output: fix target + PDF report.

## Slide 9 — Stack (30s)

- Next.js, MongoDB, Band API, Vercel.
- Production hardening: fallbacks when Band is slow or at room limit.

## Slide 10 — Run it (60s + LIVE DEMO)

**Switch to live demo or pre-recorded video:**

1. `npm run dev` · localhost:3000
2. Band synced → open room
3. Hero investigation → Theories → Run investigation
4. Narrate beats on both screens

## Slide 11 — Verdict (25s)

- Call failed despite success language.
- Fix: gate success copy on tool success.

## Slide 12 — Thank you (15s)

- Links on screen.
- "Happy to walk through the Band integration or the evidence model."

---

## Q&A prep

| Question | Answer |
|----------|--------|
| Why Band? | Public audit trail + real multi-agent recruitment in chat |
| vs single LLM? | Theories are contested; agents have access walls |
| Production? | Mongo persistence, Vercel deploy, Band fallbacks |
| Demo incident? | Maria Santos / Cal.com 503 / Retell |
