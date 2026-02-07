# 06 — Fonctionnalités (vue produit)

## 1) Auth & onboarding

- Page `/login`
- Redirection automatique `/` → `/dashboard` si connecté

## 2) Dashboard

- Route : `/dashboard`
- Indicateurs actuels :
  - XP total + niveau (dérivé côté app via `lib/leveling.ts`)
  - ELO & games (table `ratings`)
  - Compteurs : `documents`, `flashcard_sets`, `quiz_sets`

> Note : la section “daily activity” est un UI placeholder pour l'instant.

## 3) Library (PDF / documents)

- Routes : `/library`, `/library/[id]`
- Tables : `documents`, `library_folders`, `document_shares`
- Objectif : stocker des PDFs/links et les organiser en dossiers (arborescence `parent_id`).
- Helpers : `lib/content/folders.ts` (ancêtres + chemins)

## 4) Flashcards

- Routes : `/flashcards`, `/flashcards/[id]`
- Tables : `flashcard_sets`, `flashcards`, `flashcard_set_shares`
- Fonctions clés :
  - création de set
  - ajout rapide
  - review (flip + navigation + plein écran)
  - mode "study" (shuffle, inversion recto/verso, boutons d’auto-évaluation : À revoir / Difficile / Bien / Facile — session-only)
  - import/export

Composants notables :
- `FlashcardSetCreator`
- `FlashcardQuickAdd`
- `FlashcardReview`
- `FlashcardImporterExporter`

## 5) QCM

- Routes : `/qcm`, `/qcm/[id]`
- Tables : `quiz_sets`, `quiz_questions`, `quiz_set_shares`
- XP (si officiel) : RPC `award_quiz_question_xp`

Composants notables :
- `QuizSetCreator`
- `QuizSetView` (état visuel clair sur la réponse sélectionnée)
- `AdminOfficialControls` (mode officiel)

## 6) Exercices

- Routes : `/exercises`, `/exercises/[id]`
- Tables : `exercise_sets`, `exercises`, `exercise_set_shares`
- Composants :
  - `ExerciseSetCreator`

## 7) Tags & vues sauvegardées

- Tables : `tags`, `*_tags`, `saved_views`
- UX : filtrage + sauvegarde de requêtes (smart views)

Composants notables :
- `TagPicker`, `TagMultiSelect`, `TagFilterField`
- `SavedViewsBar`

## 8) Groupes / People

- Routes : `/people`, `/people/[id]`
- Tables : `study_groups`, `group_memberships`
- RPC : `create_group`, `join_group`

Composants notables :
- `GroupSettings`, `GroupMultiPicker`

## 9) Profil & settings

- Routes : `/profile`, `/settings`
- Tables : `profiles`
- Storage : bucket `avatars`

Composants notables :
- `ProfileSettings`
- `SignOutButton`

## 10) Admin studio

- Route : `/admin/content`
- Cible : contenu officiel + publications + traductions

Composants notables :
- `AdminContentStudio`
- `AdminTranslationsPanel`
- `AdminOfficialControls`

## 11) XP / niveaux

- Script : `supabase/leveling.sql` + doc `SUPABASE_XP_SETUP.md`
- Principe : XP par question correcte (officiel uniquement), anti-farm par `quiz_question_progress`
- UI : niveau affiché sur `/dashboard` + graphe (composant `XpBarChart`)

## 12) Duels PvP (ELO)

- Routes : `/challenges`, `/challenges/[id]`
- Script : `supabase/DUELS_SETUP.sql` + doc `supabase/README_DUELS.md`
- Principe : duel sur un quiz_set, tentatives, winner, rating event + ELO.

Composants notables :
- `PvpInviteButton`
- `PvpChallengeView`
- `ChallengeDetailClient`
