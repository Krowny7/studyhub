# 00 — Démarrage rapide

## 1) Prérequis

- Node.js (LTS recommandé)
- Un projet **Supabase** (URL + ANON KEY)

## 2) Installation

```bash
npm install
```

## 3) Configuration (.env)

```bash
cp .env.example .env.local
```

Renseigner :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (optionnel) `NEXT_PUBLIC_APP_URL` (utile derrière un domaine custom)

## 4) Setup base de données (Supabase)

Dans **Supabase → SQL Editor**, exécuter les scripts du dossier `supabase/`.

Ordre recommandé (idempotent / safe si déjà appliqué) :
1. `supabase/tags_and_views.sql`
2. `supabase/exercises.sql`
3. `supabase/leveling.sql` (XP/niveaux) → voir aussi `SUPABASE_XP_SETUP.md`
4. `supabase/admin_official_content.sql` (outils admin contenus officiels)
5. `supabase/translations.sql` (traductions contenus officiels)
6. `supabase/admin_badge_public.sql` (badge admin public)
7. `supabase/DUELS_SETUP.sql` (duels PvP + RPC) → voir aussi `supabase/README_DUELS.md`

> Note : si tu ajoutes une migration SQL, mets-la à la fin et documente-la dans `04_supabase_setup.md`.

## 5) Lancer le serveur

```bash
npm run dev
```

Ouvrir : http://localhost:3000

## 6) Vérifications rapides

- Accès : `/login` → connexion Supabase
- Après login : redirection `/dashboard`
- Vérifier que le middleware rafraîchit bien la session (cookies)
- Si des features liées à la DB cassent : re-check RLS/policies et présence des RPC (voir docs `04_supabase_setup.md`)
