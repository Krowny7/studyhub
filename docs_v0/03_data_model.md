# 03 — Modèle de données (Supabase)

Ce document décrit **ce que l'app consomme réellement** (tables/colonnes vues dans le code) + les scripts de création présents dans `supabase/`.

> Important : certaines tables (ex: `documents`, `quiz_sets`, `flashcard_sets`, `library_folders`...) sont **référencées par le code** mais ne sont pas (encore) définies dans les scripts `supabase/*.sql` fournis. Elles sont supposées exister (setup antérieur).

## Tables principales observées dans le code

### Auth / profils

- `auth.users` (géré par Supabase Auth)
- `profiles` (profil app)
  - colonnes utilisées : `id`, `username`, `avatar_url`, `active_group_id`, `xp_total`

### Groupes (collaboration/partage)

- `study_groups`
  - colonnes utilisées : `id`, `name`, (optionnel) `owner_id`, `invite_code`
- `group_memberships`
  - colonnes utilisées : `group_id`, `user_id`
  - utilisé pour l'appartenance aux groupes et le partage de contenu

### Bibliothèque (PDF / docs)

- `library_folders`
  - colonnes utilisées : `id`, `name`, `parent_id`
- `documents`
  - colonnes utilisées : `id`, `title`, `visibility`, `created_at`, `external_url`, `preview_url`, `folder_id`, `owner_id` (implicite)
- `document_shares`
  - pour partager un document à un ou plusieurs groupes (pattern identique aux autres *shares*)

### Flashcards

- `flashcard_sets`
- `flashcards`
- `flashcard_set_shares`

### QCM

- `quiz_sets`
  - supporte le mode « officiel » via `is_official`, `official_published`, `difficulty`
- `quiz_questions`
- `quiz_set_shares`
- (optionnel) `quiz_attempts` (référencé par le code)

### Exercices

- `exercise_sets` *(créée par `supabase/exercises.sql`)*
- `exercises` *(supposée exister ou créée ailleurs)*
- `exercise_set_shares` *(créée par `supabase/exercises.sql`)*

### Tags & vues sauvegardées

*(créées par `supabase/tags_and_views.sql`)*

- `tags`
- `document_tags`
- `flashcard_set_tags`
- `quiz_set_tags`
- `saved_views`

### XP / niveaux

*(créées/complétées par `supabase/leveling.sql`)*

- `profiles.xp_total`
- `xp_events`
- `quiz_question_progress`
- `app_admins`

### Duels PvP / ELO

*(créées/complétées par `supabase/DUELS_SETUP.sql`)*

- `pvp_challenges`
- `pvp_challenge_attempts` (et/ou vue compat `pvp_attempts`)
- `ratings` (ELO)
- `pvp_rating_events` (historique deltas)

## Fonctions RPC (observées dans le code)

- Admin / permissions
  - `is_app_admin()`
  - `is_user_app_admin(p_user_id uuid)`
- Groupes
  - `create_group(...)`
  - `join_group(...)`
- XP
  - `award_quiz_question_xp(question_id, selected_index)`
  - `get_xp_daily(days)` / `get_xp_daily_for_user(...)`
- Duels
  - `pvp_create_challenge(...)`
  - `pvp_accept_challenge(...)`
  - `pvp_submit_attempt(...)`
  - `pvp_get_challenge_detail(...)`

> Les scripts `leveling.sql` et `DUELS_SETUP.sql` sont **l'autorité** sur les signatures. Le code contient aussi une compat « legacy keys » (fallback) pour éviter les erreurs de cache ou de noms d'arguments.

## Visibilité & partage

Le code manipule `visibility` comme :
- `private` : propriétaire uniquement
- `public` : propriétaire (édition), lecture gérée par RLS selon choix
- `groups` / `group` : partagé à un ou plusieurs groupes

La logique applicative se trouve dans `lib/permissions.ts`.

La source de vérité reste **RLS Supabase** : l'app fait des checks UX mais la DB doit refuser toute action illégitime.

## Diagramme relationnel (conceptuel)

```text
auth.users ──1──► profiles
     │
     ├──*──► group_memberships ◄──*── study_groups
     │
     ├──*──► documents ──*──► document_shares ──*──► study_groups
     │
     ├──*──► flashcard_sets ──*──► flashcard_set_shares ──*──► study_groups
     │
     ├──*──► quiz_sets ──*──► quiz_set_shares ──*──► study_groups
     │
     ├──*──► exercise_sets ──*──► exercise_set_shares ──*──► study_groups
     │
     └──*──► pvp_challenges ──*──► pvp_attempts
```

## Où modifier quoi ?

- Schéma / tables / RLS / RPC : `supabase/*.sql`
- Helpers front (permissions/paths/leveling/i18n) : `lib/`
- Pages : `app/`
- UI & actions : `components/`
