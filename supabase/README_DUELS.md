# Duels (PvP) – DB Setup

Si tu vois des erreurs du type :

- `pvp_submit_attempt` → **400 (Bad Request)**
- `Could not find the function public.pvp_get_challenge_detail(...) in the schema cache`
- `new row for relation "pvp_challenges" violates check constraint "pvp_challenges_status_check"`

➡️ Exécute **un seul script** : **`DUELS_SETUP.sql`** (dans le SQL Editor Supabase).

Ce script :
1. crée une **vue de compatibilité** `pvp_attempts` si ta base utilise `pvp_challenge_attempts`.
2. corrige la contrainte `status` de `pvp_challenges`.
3. (re)crée les RPC nécessaires (`pvp_accept_challenge`, `pvp_submit_attempt`, `pvp_get_challenge_detail`).
4. force un refresh du cache PostgREST (`NOTIFY pgrst, 'reload schema'`).

Ensuite :
- Hard refresh du navigateur (Ctrl+F5)
- Si besoin, redémarre ton `npm run dev`

> Important : les anciens scripts de fix ont été retirés car ils ciblaient une vieille version du schéma (colonnes inexistantes).
