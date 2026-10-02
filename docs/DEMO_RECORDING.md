# Screen recording script — Incident Room

**Hero incident:** `retell_call_clinic_44102` (Maria Santos · Retell · reschedule HTTP 503)  
**Backup:** `PMB-2024-0847` (Klaus · callback never booked)

**Layout:** Browser **left half** = Incident Room · **right half** = Band room (open link when investigation starts).

---

## 0. Prep (off camera)

```bash
cd incident-room
npm run dev
```

1. `.env.local` has `BAND_API_KEY` (+ specialist keys if posting to Band).
2. CRM: open `/crm` → **Reload seed customers** (13 records).
3. Band: room has only you + Agent 1 — do **not** pre-add Normalizer.

---

## 1. Desk (15 sec)

1. Open **http://localhost:3000** — Operations Desk.
2. Point at stats row + incident table.
3. Say: *"Voice calls that sound successful — we investigate whether they actually worked."*
4. Click **`retell_call_clinic_44102`** (import via Desk if missing: `fixtures/imports/raw-retell-appointment-gap.json`).

---

## 2. Theories — live investigation (90 sec)

1. Tab **Theories** (default). Click **Run investigation**.
2. **Crew bar:** only **IR** at first — names **appear one by one** as recruited (NR → CM → EX → PL → WF).
3. **Stage:** crewmates spawn on **dashed floor slots** — no spoilers for unrecruited agents.
4. **Theory strip + dialogue box** (bottom): active theory + who agrees/disagrees + agent line (readable, not a wall of text).
5. Narrate beats:
   - Normalizer delivers evidence (no interpretation).
   - Communication proposes `conversation resolved`.
   - Room challenges — execution opens tool trace.
   - Theories contest until **call outcome** (not "NOT JUSTIFIED" headline).
6. Split screen: Band room shows matching posts from recruited specialists.

---

## 3. Reports (20 sec)

1. Tab **Reports** — call outcome, customer impact, cited evidence, fix target.
2. **Download PDF** — show `CALL OUTCOME` section.

---

## 4. CRM (10 sec, optional)

1. `/crm` — Maria Santos matched on phone from evidence.
2. Open ticket: reschedule not confirmed.

---

## 5. Agents (10 sec, optional)

1. Sidebar **Agents** — investigation party grid lights up after a run.

---

## Closing line

> *"The customer was told the appointment moved. The tool trace says 503. Incident Room recruits blind specialists, kills bad theories on the record, and ships an audit memo — not a chat summary."*

---

## Capture (automated)

**Full walkthrough** (~2 min — timeline → investigation until **Cleared ✓** → report → CRM):

```bash
npm run dev
npm run record-full-demo
# → docs/screenshots/incident-room-full-demo.webm
```

**Screenshots + short clip:**

```bash
npm run install:browsers   # once
npm run dev
npm run capture-demo         # → PNGs + incident-room-demo.webm
```

Regenerate PDF smoke test:

```bash
npm run validate-briefs
```
