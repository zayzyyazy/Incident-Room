# Cross-platform import samples

Raw exports for testing the **Normalizer** import path (`normalizeImportedJson`).

| File | Detected platform | Story |
|------|-------------------|--------|
| `raw-vapi-refund-denied.json` | vapi | Refund promised; `refund_payment` 402 |
| `raw-retell-appointment-gap.json` | retell | Reschedule confirmed; Cal.com 503 |
| `raw-bland-rx-transfer-failed.json` | bland | Pharmacist transfer; bridge 409 |
| `raw-openai-ticket-ghost.json` | openai_chat | Ticket ID spoken; Zendesk 500 |
| `raw-generic-crm-write-fail.json` | generic | Policy update; CRM write 409 |
| `raw-leaping-warranty-export.json` | leaping | `calls[]` export; shipment tool failed |

## In the app

1. Open **Operations Desk** → **Import evidence** → **Paste JSON**
2. Click any **Try platform samples** card (loads raw JSON)
3. **Preview normalize** → **Normalize & open incident**
4. **Run investigation** on the imported incident

## CLI

```bash
npm run validate-import-samples
```

## Files on disk

Samples are also available via:

- `GET /api/import-samples`
- `GET /api/import-samples/:id`
