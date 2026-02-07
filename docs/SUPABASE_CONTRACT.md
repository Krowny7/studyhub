# Supabase contract (what must exist)

This repo uses **Supabase Postgres + RLS + Storage**.
The canonical checklist lives in code: `lib/supabase/contract.ts`.

## 1) Tables & columns

The diagnostics page verifies:
- table exists + basic select works (HEAD request)
- specific required columns exist for some tables
- required RPCs exist

If a table check fails but you are **admin** in the app, it usually means:
- the table doesn't exist, **or**
- RLS blocks your user, **or**
- the table is in another schema (not `public`), **or**
- the project is connected to the wrong Supabase instance

## 2) RLS & permissions

**Grants** (`anon/authenticated`) are not enough: RLS policies must allow the query.

Useful SQL in Supabase SQL editor:

### List policies

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### List grants

```sql
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
```

## 3) Storage buckets

Buckets used by the app:

- `avatars` (profile images)
- `media` (images inserted into flashcards / MCQ)

### Recommended bucket settings

- **Public bucket** (simplest for Vercel free tier)
- Upload rule: authenticated users can insert
- Read: public or authenticated (if public bucket, public read is implicit)

## 4) Single JSON report for ChatGPT

When something breaks:

1. Open `/admin/diagnostics`
2. Copy the JSON
3. Paste this prompt + JSON into ChatGPT:

```text
You are a senior Supabase + Next.js engineer.
Given the diagnostics JSON below, identify which checks failed and propose:
- the root cause
- the exact Supabase SQL (RLS policies, function, grants) or Storage setting to change
- the exact code file(s) to adjust if it's an app-side issue

JSON:
<PASTE>
```
