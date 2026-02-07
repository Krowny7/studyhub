# 02 — Routes & pages

Le projet utilise **Next.js App Router** (`/app`).

## Pages (UI)

| Route | Fichier | Accès | Rôle |
|---|---|---|---|
| `/` | `app/page.tsx` | public | Redirection vers `/dashboard` si connecté, sinon `/login` |
| `/login` | `app/login/page.tsx` | public | Auth Supabase (UI de connexion) |
| `/dashboard` | `app/dashboard/page.tsx` | auth | Résumé (XP, ELO, compteurs) |
| `/library` | `app/library/page.tsx` | auth | Bibliothèque de contenus (PDF/docs) |
| `/library/[id]` | `app/library/[id]/page.tsx` | auth | Détail/édition d'un contenu ou d'un dossier |
| `/flashcards` | `app/flashcards/page.tsx` | auth | Sets de flashcards |
| `/flashcards/[id]` | `app/flashcards/[id]/page.tsx` | auth | Vue d'un set (review, ajout rapide, import/export) |
| `/qcm` | `app/qcm/page.tsx` | auth | Sets QCM (quiz_sets) |
| `/qcm/[id]` | `app/qcm/[id]/page.tsx` | auth | Vue QCM + réponses + XP (si officiel) |
| `/exercises` | `app/exercises/page.tsx` | auth | Sets d'exercices |
| `/exercises/[id]` | `app/exercises/[id]/page.tsx` | auth | Vue d'un set d'exercices |
| `/challenges` | `app/challenges/page.tsx` | auth | Liste des duels PvP |
| `/challenges/[id]` | `app/challenges/[id]/page.tsx` | auth | Détail d'un duel (soumission tentative, résultat) |
| `/people` | `app/people/page.tsx` | auth | Groupes/participants (collab/partage) |
| `/people/[id]` | `app/people/[id]/page.tsx` | auth | Détails d'une personne/groupe |
| `/profile` | `app/profile/page.tsx` | auth | Profil utilisateur |
| `/settings` | `app/settings/page.tsx` | auth | Paramètres (préférences, etc.) |
| `/admin/content` | `app/admin/content/page.tsx` | admin | Studio admin : contenus officiels + traductions |

> Les guards sont majoritairement faits via `supabase.auth.getUser()` dans les Server Components + `redirect('/login')`.

## Route handlers (API)

| Route | Fichier | Méthode(s) | Rôle |
|---|---|---:|---|
| `/app/api/locale` | `app/api/locale/route.ts` | POST | Stocke le locale dans le cookie `cfa_locale` |
| `/app/auth/callback` | `app/auth/callback/route.ts` | GET | Callback Supabase Auth (échange code → session) |

## Middleware

- `middleware.ts` : refresh/validation session Supabase sur chaque requête (hors assets).

## Convention pour ajouter une route

1. Créer `app/<route>/page.tsx`
2. Si besoin d'un endpoint : `app/api/<name>/route.ts`
3. Mettre à jour ce document (`02_routes.md`) + `06_features.md`.
