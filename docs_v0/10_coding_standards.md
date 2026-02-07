# 10 — Standards de code (V0)

## TypeScript

- `strict: true` (tsconfig)
- Préférer des types locaux (interfaces) proches du besoin UI
- Éviter `any` sauf pour compat schéma/legacy ; si `any` nécessaire, l'encapsuler et ajouter un commentaire.

## Next.js (App Router)

- Server Components : fetch data + guards + layout
- Client Components : interactions utilisateur + mutations
- Garder les pages (`app/.../page.tsx`) fines : orchestration uniquement

## Supabase

- Server-side : `lib/supabase/server.ts`
- Client-side : `lib/supabase/browser.ts`
- Les opérations critiques se font via RLS/RPC (pas de « sécurité front »)
- Après ajout d'une RPC : `NOTIFY pgrst, 'reload schema'`

## UI

- Composants réutilisables dans `components/`
- Utiliser les classes utilitaires déjà présentes (btn, card, card-soft, etc.)
- Feedback UX : `busy`, `msg` (pattern déjà utilisé)

## Docs

- Toute feature → update `docs_v0/06_features.md`
- Toute décision d'archi → ajouter un ADR via `docs_v0/templates/adr_template.md`
