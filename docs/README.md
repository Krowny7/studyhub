# CFA Hub – Dev & Diagnostics Notes

This folder is intentionally written so you can copy/paste a **single JSON report** into ChatGPT and get an actionable fix quickly.

## What to run when something breaks

1. **Local checks**

```bash
npm install
npm run typecheck
npm run build
npm run lint
```

2. **App ↔ Supabase cohesion**

Open `/admin/diagnostics` while logged in.

- Click **"Copy JSON report"**.
- Paste the JSON into ChatGPT with: *"Analyse this diagnostics report and tell me what is wrong and what SQL / Supabase setting to change."*

## Supabase contract

The app expects:

- Tables and columns listed in `lib/supabase/contract.ts`
- RLS policies allowing the operations used by the UI
- Storage buckets: `avatars` + `media`

See `docs/SUPABASE_CONTRACT.md` for the checklist.

## Uploads

Images are stored in Supabase Storage bucket `media`.

See `docs/UPLOADS.md`.
