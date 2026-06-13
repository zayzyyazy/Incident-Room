# Incident Room — Product lock

Read this before every build session. If a feature does not serve this doc, do not build it.

---

## Primary question

**Where did this voice AI call fail?**

Answer format: **layer + failure class + evidence** (with MSG IDs in Band).

---

## Secondary questions (optional, never primary)

- Is this failure **recurring** for this customer or workflow? (pattern layer)
- Which **fix surface** does engineering own? (integration, prompt, confirm-after-tool policy)

---

## Forbidden primary outputs

Do not make these the main deliverable:

- CS escalation playbooks ("callback within 2 hours", "open P1 ticket")
- "What should customer service do now?"
- Transcript summary or call quality score without execution cross-check
- Single-agent verdict on "was the call good?"

---

## Who this is for

| User | Yes |
|------|-----|
| Voice AI operator / QA / workflow owner debugging calls | Yes |
| Engineer sitting next to the workflow at the lounge | Yes |
| Human ticket-queue agent routing CS work | No (not primary) |

**Customer service** in this project means **customer-facing phone calls** (the channel), not the product user.

---

## The four agents (locked roles)

| Agent | Question |
|-------|----------|
| Conversation Analyst | What did the **conversation layer** assert or imply? |
| Outcome Investigator | What did **execution** actually do? |
| Pattern Analyst | Is this failure **recurring**? |
| Failure Synthesizer | **Where** did it fail, **what class**, **which layer owns the fix?** (Band only) |

---

## Failure layers and classes

| Layer | Example modes |
|-------|----------------|
| L1 Conversation | Wrong intent, misunderstood entity, hallucinated confirmation, premature verbal closure |
| L2 Execution | Tool not called, parameter drift, API timeout, silent tool error, workflow continued after error |
| L3 Pattern | Same failure on prior calls, regression, recurring customer/workflow hit |
| Synthesis | Combined root cause, cited MSG IDs, fix surface |

---

## Drift checklist (before merging)

- [ ] Does this require execution data, not transcript alone?
- [ ] Does this name a failure **layer** or **class**?
- [ ] Would a Pflegemittelbox QA person use this at the workflow lounge?
- [ ] Is Band structurally necessary (not just a log dump)?
- [ ] Is the main output **not** a CS playbook?

---

## Naming guide

**Use:** failure autopsy, operator, voice AI QA, Pattern Analyst, Failure Synthesizer, where did it fail

**Avoid as product center:** Service Commander, CS escalation, ticket triage, "what should CS do"

---

## Demo north star (Klaus)

Verbal callback confirmed at T05 (L1) + `create_callback_appointment` 504 + no appointment (L2).

Demo ends on **cross-layer failure location**, not "escalate Klaus."
