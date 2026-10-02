# Incident Room — Sprint plan (locked)

**Deadline:** 19 Jun 2026, 3:00 PM UTC  
**Track:** Track 1 — Internal Enterprise Workflows  
**Repo:** https://github.com/zayzyyazy/Incident-Room

---

## Hook

**The customer was told it worked. Did it actually work?**  
Then: **Where in the agent system is that behavior coming from?**

---

## What judges should remember

> Klaus thought his callback was booked. Claim Tracer saw the confirmation. Backend Witness saw the 504. Neither opening story held. Causal Judge bridged: **premature confirmation after failed scheduling API**. Two challenge rounds — agents changed their minds in Band. Cause Finding + suspect surfaces.

---

## Room 1 — Cause Room (building now)

**9 Band posts · 3 agents · 2 challenge rounds**

| # | Agent | Post |
|---|--------|------|
| 1 | Claim Tracer | Initial hypothesis (conversation only) |
| 2 | Backend Witness | Initial hypothesis (execution only) |
| 3 | Causal Judge | Bridge hypothesis (round 1) |
| 4 | Claim Tracer | CHALLENGE / YIELD (round 1) |
| 5 | Backend Witness | CHALLENGE / NARROW (round 1) |
| 6 | Causal Judge | Bridge refined (round 2) |
| 7 | Claim Tracer | CHALLENGE / YIELD (round 2) |
| 8 | Backend Witness | CHALLENGE / NARROW (round 2) |
| 9 | Causal Judge | **Cause Finding** |

**Test:** `POST /api/dev/investigate-cause-room` `{ "fixture": "hero-klaus-minimal" }`

---

## Room 2 — Localization Room (if time)

Cause Finding + recurrence enrich + artifacts → ranked `suspect_surfaces`

---

## Build order

1. ✅ Cause Room schemas + 3 agents + orchestrator + dev route
2. Run Klaus + Maria + Anissa fixtures through Cause Room
3. UI feed for evolution + challenge rounds
4. Localization Room (optional)
5. Deploy + video

---

## Cut

Chat platform, SSE polish, auto-fix, full Evaluator room, cross-platform pitch.

---

## Docs

- Product lock: [PRODUCT.md](./PRODUCT.md)
- Multi-room plan: [EVOLUTION_AND_MULTIROOM_PLAN.md](./EVOLUTION_AND_MULTIROOM_PLAN.md)
- Journal: [PROJECT_LOG.md](./PROJECT_LOG.md)

**Locked:** 15 Jun 2026 — Cause Room architecture.
