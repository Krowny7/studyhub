# 08 — XP / Niveaux

## Objectif

- Récompenser l'apprentissage via des QCM **officiels**.
- Empêcher le “farm” (XP gagnée plusieurs fois sur la même question).

## Côté DB (Supabase)

Référence :
- `supabase/leveling.sql`
- `SUPABASE_XP_SETUP.md`

### Tables

- `profiles.xp_total` : XP cumulée (int)
- `xp_events` : historique (audit)
- `quiz_question_progress` : anti-farm (1 XP par question)
- `app_admins` : liste des admins (modération contenus officiels)

### RPC

- `award_quiz_question_xp(question_id, selected_index)`
  - vérifie : QCM officiel + publié, réponse correcte, pas déjà attribuée
  - écrit : `xp_events`, `quiz_question_progress`, incrémente `profiles.xp_total`
- `get_xp_daily(days)` : agrégation XP par jour (graphe)

## Côté app

### Niveau

Le niveau est calculé **côté front** à partir de `xp_total` via `lib/leveling.ts` :
- Level démarre à 1
- XP pour passer un level : `BASE_XP * 1.15^(level-1)` (arrondi)

### UI

- Dashboard : affiche le niveau et l'XP totale
- Graphe : composant `XpBarChart` (si données dispo)

## Conventions pour étendre l'XP

Si tu ajoutes de l'XP pour une nouvelle activité (ex: exercices officiels) :
1. Ajouter un type d'événement dans `xp_events` (ou un champ `source`)
2. Ajouter une RPC dédiée pour l'attribution (garde-fous)
3. Mettre à jour la doc (ce fichier) + `SUPABASE_XP_SETUP.md`
