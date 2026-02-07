# Diagnostics guide (Supabase ↔ code cohesion)

This project includes a **single source of truth** diagnostics page at:

- `/admin/diagnostics`

It is designed to answer, in one place:

1) **Is the app pointing to the right Supabase project?**  
2) **Are required tables/columns/RPCs present?** (schema cohesion)  
3) **Do RLS policies allow the expected access for an authenticated user?** (access cohesion)  
4) **Are there intermittent network/Supabase errors on the current device?** (net log)

## Quick start

1. Copy `.env.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. (Recommended) Set the server-only key for schema checks:
   - `SUPABASE_SERVICE_ROLE_KEY`

> This key is **server-only** and must be configured in Vercel as a secret.

3. Start the app and open:
   - `http://localhost:3000/admin/diagnostics`

## How to use it

### Export JSON (recommended)

At the bottom of the page there is an **Export diagnostics** card:
- Click **Copy JSON**
- Paste the JSON into ChatGPT (or your ticket/issue) to troubleshoot quickly.

The export contains:
- masked env info (URL / anon key)
- auth context
- schema checks + access checks
- device supabase network log (last ~40 requests)

### Interpreting failures

- `NOT_FOUND`: missing table/column/RPC or wrong schema/project
- `RLS_DENIED`: object exists, but RLS/permissions block access in the current context
- `ERROR`: other error (timeout, 5xx, etc.)

### Why schema checks can differ from access checks

Schema checks are executed with the **Service Role** when configured (bypasses RLS),
so you can separate:
- “object does not exist” (schema issue)
from:
- “object exists but RLS blocks the user” (policy issue)

## Best practices

- Keep the contract list in `lib/supabase/contract.ts` up-to-date when you add/rename tables or columns.
- Prefer changing DB via SQL scripts/migrations in `supabase/`.
- Use `/admin/diagnostics` after any deployment or schema change.
