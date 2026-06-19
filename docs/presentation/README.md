# Incident Room — Hackathon Deck

## View online (after deploy)

https://incident-room.vercel.app/presentation/

## View locally

```bash
open docs/presentation/index.html
```

Navigate: **← →** or **Space**

## Export PDF (30 seconds)

1. Open `docs/presentation/index.html` in Chrome
2. **Cmd+P** → Destination: **Save as PDF**
3. Layout: **Landscape**
4. Enable **Background graphics**
5. Save as `Incident-Room-Deck.pdf`

Or (after `npx playwright install`):

```bash
npm run presentation:pdf
```

Output: `docs/presentation/Incident-Room-Deck.pdf`

## Send to teammate right now

| Method | What to send |
|--------|----------------|
| **Fastest** | AirDrop / Slack the PDF from steps above |
| **Live link** | Push to GitHub → Vercel redeploys → share `/presentation/` URL |
| **Same Wi‑Fi** | `cd docs/presentation && python3 -m http.server 8765` → `http://YOUR_IP:8765` |
| **GitHub** | Commit `public/presentation/` + PDF, push, share repo link |

## Speaker notes

See [SPEAKER-NOTES.md](./SPEAKER-NOTES.md) (~6–8 min script).
