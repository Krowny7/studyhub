# XP / Niveaux (QCM officiels)

## Ce que ça fait
- Ajoute `profiles.xp_total` (XP totale) + affichage niveau/progression.
- Ajoute `xp_events` (historique) + `quiz_question_progress` (anti-farm : XP 1 seule fois par question).
- Ajoute 2 fonctions RPC :
  - `award_quiz_question_xp(question_id, selected_index)` → attribue l’XP **uniquement** si le QCM est officiel + publié et si la réponse est correcte.
  - `get_xp_daily(days)` → agrégation XP/jour (pour le graphe 90 jours).

## Installation (Supabase)
1. Ouvre **Supabase → SQL editor**
2. Exécute le fichier : `supabase/leveling.sql`

## Créer un QCM « officiel »
L’idée est que seuls les contenus « admin » donnent de l’XP.

1. Dans Supabase, ajoute ton `user_id` dans `public.app_admins`.
2. Sur le QCM à rendre officiel (table `public.quiz_sets`) :
   - `is_official = true`
   - `official_published = true`
   - `difficulty = 1..3` (1 facile, 2 moyen, 3 dur)
   - recommandé : `visibility = 'public'`

## Règles XP (par défaut)
- XP attribuée **par question correcte** :
  - difficulté 1 → 10 XP
  - difficulté 2 → 15 XP
  - difficulté 3 → 20 XP
- XP attribuée **1 seule fois par question** (première fois que tu la réussis), même avec tentatives illimitées.

## Notes
- Si tu n’as pas encore appliqué le SQL, le site fonctionne :
  - pas d’XP
  - pas de graphe 90 jours
- Tout est pensé pour être extensible à des « exercices officiels » plus tard (même mécanisme : `xp_events`).
