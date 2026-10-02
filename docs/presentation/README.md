# Incident Room — Hackathon Deck

## Live link (after deploy)

| URL | Use |
|-----|-----|
| https://incident-room.vercel.app/presentation | Interactive slides (← →) |
| https://incident-room.vercel.app/presentation?print=1 | **PDF export** (all 12 slides) |

Deploy: push to GitHub → Vercel redeploys automatically.

## PDF — looks good (do this)

1. Open **https://incident-room.vercel.app/presentation?print=1** (or local: `http://localhost:3000/presentation?print=1`)
2. **Cmd+P** (Mac) / **Ctrl+P** (Windows)
3. Destination: **Save as PDF**
4. Layout: **Landscape**
5. Turn **ON** “Background graphics”
6. Margins: **None**
7. Save → send to teammate

## Local only (no deploy)

```bash
npm run dev
open "http://localhost:3000/presentation"
```

## Send to teammate now

1. Make PDF from `?print=1` link above → Slack/email/AirDrop
2. Or share live link after `git push`

```bash
git add src/app/presentation public/presentation docs/presentation package.json scripts/export-presentation-pdf.mjs
git commit -m "Add presentation route and print-optimized PDF mode"
git push
```

Then send: **https://incident-room.vercel.app/presentation**
