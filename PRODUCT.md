# Incident Room — Product lock

Read this before every build session. If a feature does not serve this doc, do not build it.

**Last updated:** 15 Jun 2026 — **Cause Room + Localization Room + Cause Revision loop** locked

---

## Default demo path vs wow capability

| Path | What ships |
|------|------------|
| **Default (hackathon)** | **Room 1 Cause Finding v1** → **Room 2 Localization** → ranked `suspect_surfaces` |
| **Wow (if time + artifacts)** | Localization sends **Cause Revision Request** back to Causal Judge when implementation evidence contradicts the causal story |

**Not a pipeline.** Separate investigation spaces with a **controlled feedback loop**.

### Cause Revision Request (Room 2 → Causal Judge)

When Localization finds contradictory implementation evidence:

1. Room 2 sends **Cause Revision Request** to Causal Judge  
2. Causal Judge responds **HOLD_FINDING** or **REVISE_FINDING**  
3. Room 2 continues with updated Cause Finding v2  

**Klaus rule:** Do **not** force a revision twist unless artifacts clearly support it (e.g. workflow shows success branch before API validation, tool schema swallows 504). Otherwise judges will feel you invented the twist. Default Klaus demo = Cause → Localization **without** revision unless fake schema/workflow is explicit in fixtures.

---

## Hook (what judges should repeat)

**The customer was told it worked. Did it actually work?**

Then: **Where in the agent system is that behavior coming from?**

---

## Two-room architecture (locked)

| Room | Question | Output |
|------|----------|--------|
| **Room 1 — Cause Room** | What happened in this incident? | **Cause Finding** (cause, evidence, ruled out, evolution, `recurrence_hint_request`) |
| **Room 2 — Localization Room** | Where in the stack is this behavior most likely coming from? | **Ranked suspect surfaces** + investigation target *(post-hackathon unless time)* |

**Room 2 is localization, not fixing.** No auto-patches in the demo.

### Canonical layer (locked)

- **Mechanism** generalizes across platforms (`confirmation_before_backend_success`, …)
- **Surface** localizes to a native pointer (Leaping stage, LangGraph node, …)
- **surface_type** enum: `workflow_branch`, `dialogue_stage`, `prompt_policy`, `tool_contract`, `confirmation_guard`, `state_transition`, `error_handler`

---

## Band agents — locked identities

### Room 1 — do not recreate (already registered)

| Band name | Env key | Role |
|-----------|---------|------|
| Claim Tracer | `BAND_API_KEY_CLAIM_TRACER` | Conversation evidence only |
| Backend Witness | `BAND_API_KEY_BACKEND_WITNESS` | Execution evidence only |
| Causal Judge | `BAND_API_KEY_CAUSAL_JUDGE` | Bridge + Cause Finding |

### Room 2 — create these 4 Band agents now

| Band name | Env key | Access | Question |
|-----------|---------|--------|----------|
| **Control Flow Investigator** | `BAND_API_KEY_CONTROL_FLOW_INVESTIGATOR` | Workflow graph, branches, transitions, state changes | What execution path could emit this behavior? |
| **Policy Investigator** | `BAND_API_KEY_POLICY_INVESTIGATOR` | System prompt, stage prompts, confirmation rules | What instruction or policy permits this behavior? |
| **Guard Investigator** | `BAND_API_KEY_GUARD_INVESTIGATOR` | Tool schemas, success criteria, error handling | What missing guard allows this behavior? |
| **Localization Judge** | `BAND_API_KEY_LOCALIZATION_JUDGE` | Surface candidates from Band thread only | What implementation mechanism + primary surface survives? |

Room creator for Localization Room: **Control Flow Investigator** key (mirrors Claim Tracer owning Cause Room).

Investigators post `surface_candidate` artifacts. Judge posts `LocalizationFinding` with `implementation_mechanism` + `primary_surface`.

---

## Room 1 — Cause Room ✅ live on localhost + Band

Three agents with **hard evidence walls** and **two challenge rounds** minimum.

| Agent | Domain | Cannot see |
|-------|--------|------------|
| **Claim Tracer** | Transcript, customer belief, agent wording | Tool calls, API results, backend state |
| **Backend Witness** | Tool invocations, status codes, side effects, workflow | Transcript quotes as primary evidence |
| **Causal Judge** | Both agents' Band posts + cited evidence | Raw feeds unless cited |

### Collaboration rules (non-negotiable)

1. **Final cause ≠ any agent's opening hypothesis**
2. **Two challenge rounds** — CT and BW must CHALLENGE / SUPPORT / YIELD with visible `opinion_changed`
3. **Causal Judge introduces bridge hypotheses** — not refereeing winners
4. **Cause Finding includes `evolution[]`** — proof collaboration happened
5. **`recurrence_hint_request: true`** when orchestrator should enrich before Room 2

### Klaus arc (demo script)

| Step | Room shows |
|------|------------|
| CT | Customer believes callback booked; agent confirmed |
| BW | `create_callback_appointment` → **504**, no appointment |
| CJ | Rules out pure hallucination + API-only → **premature confirmation after failed scheduling API** |
| CT | YIELD / NARROW (round 1 + 2) |
| BW | NARROW to include customer-facing continuation (round 1 + 2) |
| Verdict | Cause Finding + evolution + recurrence hint |

### Band post sequence (9 posts)

1. Claim Tracer initial  
2. Backend Witness initial  
3. Causal Judge bridge (round 1)  
4. Claim Tracer challenge (round 1)  
5. Backend Witness challenge (round 1)  
6. Causal Judge bridge (round 2)  
7. Claim Tracer challenge (round 2)  
8. Backend Witness challenge (round 2)  
9. Cause Finding  

**Localhost:** `http://localhost:3000` → open incident → **Run Cause Room** (~60s)

**Dev API:** `POST /api/dev/investigate-cause-room` with `{ "fixture": "hero-klaus-minimal" }`

**Band:** Rooms named `{incident_id} · {title}`. Posts are **readable English**; full JSON in metadata.

---

## Room 2 — Localization Room

**Input:** `CauseFinding` artifact + platform agent artifact (via adapter)

**Goal:** Discover the **implementation mechanism** that explains why the CauseFinding was possible — not rank surfaces.

**Output:** `LocalizationFinding` with `implementation_mechanism`, `mechanism_explanation`, `primary_surface` (evidence pointer), `supporting_surfaces`

**Sequence (memorable arc):**
1. Control Flow Investigator — opening surface theory
2. Policy Investigator — **attacks** opening as incomplete
3. Guard Investigator — **attacks** redirect as incomplete
4. Mechanism Judge — eliminates incomplete explanations
5. Mechanism Judge — **discovers mechanism** none proposed initially (e.g. Schritt 1 before Schritt 3)
6. Mechanism Judge — localizes mechanism to primary surface + supporting evidence

**15-second judge moment:** Three specialists disagreed on the culprit surface, but together uncovered a deeper implementation mechanism none of them proposed initially.

Mechanism generalizes (`confirmation_before_backend_success`). Pointer localizes (`Anliegenaufnahme + Email`).

Recurrence is a **handoff field**, not a third room:
```json
{ "similar_incidents_last_30_days": 4, "shared_signals": ["504 on handoff tool"] }
```

---

## Demo north star (Klaus — Video B)

Human line: *"Great, thanks for booking the callback."*  
Tool: `create_callback_appointment` → **504**  
Cause: premature confirmation after failed scheduling API  
Localization (if shipped): `confirmation_policy` vs `success_branch`

---

## Kill list (hackathon sprint)

- Chat platform / SSE dashboard polish before Cause Room runs on Klaus  
- Auto-fix / code patches  
- Full Evaluator Room as separate room  
- Cross-platform normalizer in pitch  

---

## Legacy (still in repo, not primary)

Old **Conversation Analyst → Outcome Investigator** linear pipeline remains at `/api/dev/investigate-two` for comparison.
