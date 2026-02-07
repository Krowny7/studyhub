# 04 — Setup Supabase (DB + policies + RPC)

## Objectif

Avoir une base Supabase capable de faire tourner :
- Auth + profils
- Library (docs/folders) + partages
- Flashcards / QCM / Exercices
- Tags + vues sauvegardées
- XP/niveaux (contenus officiels)
- Duels PvP + ELO

## Variables d'environnement

Dans `.env.local` :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (optionnel) `NEXT_PUBLIC_APP_URL`

## Ordre recommandé des scripts SQL

Dans **Supabase → SQL Editor**, exécuter les fichiers dans l'ordre :

1. `supabase/tags_and_views.sql` — tags + joins + saved views (+ trigger `touch_updated_at`)
2. `supabase/exercises.sql` — exercise sets + shares + RLS minimal
3. `supabase/leveling.sql` — XP, admins, RPC d'XP, anti-farm
4. `supabase/admin_official_content.sql` — colonnes official + policies admin
5. `supabase/translations.sql` — table de traductions + policies
6. `supabase/admin_badge_public.sql` — rendre le badge admin lisible (UX)
7. `supabase/DUELS_SETUP.sql` — duels + compat + RPC + refresh cache

> Tous ces scripts sont conçus pour être **idempotents** (safe à rejouer).

## Storage

### Bucket `avatars`

Le code upload les avatars dans :
- `supabase.storage.from("avatars")`

À faire dans Supabase :
1. Storage → Create bucket `avatars`
2. Recommandé : bucket **public** (car le code stocke un `publicUrl` en DB)

Si tu veux un bucket privé : il faudra remplacer `getPublicUrl()` par des signed URLs.

## Vérifications post-setup

### 1) Vérifier les RPC critiques

Dans SQL Editor, tu peux lister les fonctions :
- `pvp_accept_challenge`, `pvp_submit_attempt`, `pvp_get_challenge_detail`
- `award_quiz_question_xp`, `get_xp_daily`

Si PostgREST ne voit pas la fonction :
- exécuter `supabase/DUELS_SETUP.sql` (il fait un `NOTIFY pgrst, 'reload schema'`)
- hard refresh navigateur, redémarrer `npm run dev`

### 2) Vérifier RLS

- Les tables des scripts (`tags`, `saved_views`, `exercise_sets`, etc.) activent RLS.
- S'assurer que les policies correspondent aux attentes (lecture owner-scoped, admin override).

### 3) Vérifier l'XP

Voir `SUPABASE_XP_SETUP.md`.

Rappel : l'XP n'est attribuée que si :
- le QCM est **officiel** (`is_official=true`) ET **publié** (`official_published=true`)
- la réponse est correcte
- et la question n'a pas déjà attribué de l'XP à l'utilisateur (anti-farm)

## Troubleshooting (les classiques)

### Erreur : « Could not find the function public.pvp_* in the schema cache »

- Exécuter `supabase/DUELS_SETUP.sql`
- Vérifier dans `supabase/README_DUELS.md`
- Redémarrer dev server + hard refresh

### Erreur : 400 sur RPC

- Dans le code, certains RPC utilisent des arguments `p_*`.
- Si ta DB attend des noms legacy (`challenge_id` au lieu de `p_challenge_id`), le code retente en fallback.
- Le vrai fix reste : appliquer les scripts à jour.

### Avatar ne s'affiche pas

- Vérifier le bucket `avatars` (public)
- Vérifier que `profiles.avatar_url` stocke bien une URL accessible

## Ajouter une nouvelle migration

1. Créer `supabase/<YYYYMMDD>_<feature>.sql`
2. Écrire le SQL **idempotent** (create if not exists / alter add column if not exists)
3. Documenter dans ce fichier + ajouter une ligne dans `00_quickstart.md` et ici (ordre)
4. Si RPC : ajouter un `NOTIFY pgrst, 'reload schema'`
