# 01 — Architecture & design

## Stack

- **Next.js 15 (App Router)** + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS v4**
- **Supabase** : Auth + Postgres + RLS + RPC (PostgREST)

## Objectifs de design (V0)

1. **Simplicité** : peu de couches, logique au bon endroit.
2. **Sécurité** : tout accès données passe par **RLS** + règles côté app (UX/guard).
3. **Extensibilité** : nouvelles features = nouveaux composants + SQL idempotent + doc.
4. **Lisibilité** : routes claires, composants réutilisables, petites fonctions pures dans `lib/`.

## Vue d'ensemble

```text
Browser
  │
  │  (Client components)
  ▼
Next.js App Router (routes dans /app)
  │
  ├─ Server Components (data fetch côté serveur via Supabase SSR client)
  ├─ Client Components (mutations / UI riche via Supabase browser client)
  └─ Route Handlers (/app/api/*, /app/auth/*)
  │
  ▼
Supabase
  ├─ Auth (session/cookies)
  ├─ Postgres tables
  ├─ RLS policies
  └─ RPC (fonctions SQL)
```

## Structure du repo

```text
cfa_hub_v7/
  app/                 # pages (App Router) + API routes
  components/          # UI + logique client
  lib/                 # helpers (i18n, permissions, leveling, content)
  supabase/            # scripts SQL (schema/policies/RPC)
  middleware.ts        # refresh session supabase (cookies)
  .env.example
```

### Conventions d'accès aux données

- **Server Components / pages** : utilisent `createClient()` depuis `lib/supabase/server`.
  - Avantage : accès sécurisé via cookies de session (SSR)
  - Bon usage : fetch listes / détails, guards (redirect)
- **Client Components** : utilisent `createClient()` depuis `lib/supabase/browser`.
  - Bon usage : actions utilisateur (create/update), interactions UI, refresh local.

> Règle : éviter de dupliquer de la logique data dans les composants. Quand c'est réutilisable, pousser dans `lib/`.

## Auth & session

- Le middleware (`middleware.ts`) exécute `supabase.auth.getUser()` sur chaque requête (hors assets) pour **rafraîchir/valider** la session.
- Le callback OAuth/email magic link est géré par `app/auth/callback/route.ts` (`exchangeCodeForSession`).

## Patterns UI

- Pages = **mise en page + orchestration**
- Composants = **UI + interactions** (création, édition, filtres, etc.)
- Helpers `lib/` = **fonctions pures** (leveling curve, permissions, i18n, folder pathing, etc.)

## Découpage “produit”

Voir `06_features.md` pour la vue fonctionnelle (QCM, flashcards, exercices, library, people/groups, admin, duels).

## Zones à surveiller

- **RLS Supabase** : la source de vérité des permissions.
- **RPC** : les fonctions doivent être documentées et testées après chaque migration.
- **Compat legacy** : certains scripts (duels) créent des vues de compat (`pvp_attempts`).

