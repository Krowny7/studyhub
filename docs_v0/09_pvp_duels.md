# 09 — Duels PvP / ELO

Référence DB :
- `supabase/DUELS_SETUP.sql`
- `supabase/README_DUELS.md`

## Objectif

Permettre à deux utilisateurs de s'affronter sur un QCM (quiz_set), puis mettre à jour leur classement **ELO**.

## Modèle (conceptuel)

### `pvp_challenges`
Un duel.
- `id` (uuid)
- `quiz_set_id`
- `created_by`
- `opponent_id`
- `status` : `pending` → `accepted` → `completed`
- `expires_at`
- `rated` : si la mise à jour ELO a été appliquée
- `winner_id`

### `pvp_attempts` / `pvp_challenge_attempts`
Une tentative par joueur.
- `challenge_id`
- `user_id`
- `score` / `total`
- `duration_seconds`
- `submitted_at`

### `ratings`
Le ELO courant.
- `user_id`
- `elo` (defaut 1200)
- `games_played`

### `pvp_rating_events`
Historique des changements ELO par duel.

## Flow

1. **Création** : A défie B (`pvp_create_challenge`)
2. **Acceptation** : B accepte (`pvp_accept_challenge`)
3. **Jeu** : A et B soumettent leur tentative (`pvp_submit_attempt`)
4. **Résolution** : à la 2ème soumission, le duel passe `completed`, winner calculé
5. **Rating** : si `rated=false`, application du ELO + insertion `pvp_rating_events`

## Règles de victoire

- Score le plus élevé gagne
- En cas d'égalité : le temps (`duration_seconds`) le plus faible gagne
- Sinon : draw

## Notes de compatibilité

Le code contient des fallbacks sur les noms d'arguments RPC (`p_*` vs legacy). Si tu vois des erreurs de schema cache, exécute `DUELS_SETUP.sql`.

## UI

- `/challenges` : liste des duels
- `/challenges/[id]` : composant `PvpChallengeView` (accept / jouer / soumettre / résultats)

