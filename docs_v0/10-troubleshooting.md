# Troubleshooting — data not showing (Supabase)

## Symptoms
- You can log in, but **QCM / Flashcards / PDFs** show **0 items**.

## Fast diagnosis (no screenshots)
1. In the app, open: `/admin/diagnostics`.
2. Check:
   - **Supabase URL** (masked): if it doesn't match your real project, you're pointing to another DB.
   - **Counts**: if everything is `0`, it's almost always **wrong env vars** (URL/anon key).
   - If you see **errors** (missing tables / permission denied), it's schema/RLS.

## Schema/RLS alignment
- In Supabase SQL editor:
  1. Run `supabase/DIAGNOSTICS.sql` and copy/paste results.
  2. If `owner_id_null` is high or `policy_count=0` while RLS is enabled, run `supabase/COMPAT_ALIGN.sql`.

## Most common root causes
- **Wrong Supabase project**: the deployed environment uses URL/key from another project.
- **owner_id not backfilled**: rows exist but `owner_id` is NULL → RLS hides everything.
- **RLS enabled without policies**: `select` returns 0 rows.

