# 05 — Auth, sécurité, permissions

## Auth (Supabase)

- L'app s'appuie sur **Supabase Auth**.
- La session est portée par des **cookies**.

### Refresh de session

`middleware.ts` instancie un `createServerClient` et appelle :
- `supabase.auth.getUser()`

But :
- valider les cookies
- rafraîchir la session si besoin

### Callback

`app/auth/callback/route.ts` :
- lit le paramètre `code`
- exécute `exchangeCodeForSession(code)`
- redirige vers `next` (defaut `/dashboard`)

## Modèle de sécurité

### Principe

La **source de vérité** des droits est en base via :
- **RLS (Row Level Security)**
- **policies** par table
- **RPC** pour les actions critiques (XP, PvP)

L'app applique en plus des gardes UX (ex: masquer des boutons), mais la DB doit **toujours refuser** les opérations non autorisées.

### Visibilité des contenus

Le champ `visibility` est normalisé par `lib/permissions.ts` :
- `private`
- `public`
- `groups` (inclut legacy `group`)

Règles côté app (édition) :
- **private** : owner uniquement
- **public** : owner uniquement (l'édition)
- **groups** : owner OU membre d'un groupe de partage

> La lecture dépend de tes policies RLS. La V0 suppose une lecture au moins owner-scoped, et éventuellement group/public selon ton produit.

### Admin

Le concept d'admin est basé sur la table :
- `public.app_admins`

RPC :
- `is_app_admin()`
- `is_user_app_admin(p_user_id)`

Usage :
- permettre la création/publication de contenus officiels
- gérer traductions / modération

## Checklist sécurité (avant prod)

- [ ] RLS activé sur toutes les tables exposées
- [ ] Policies minimales (select/insert/update/delete) + tests
- [ ] Buckets storage : règles cohérentes (public vs signed URLs)
- [ ] RPC : vérifier signatures & privilèges (SECURITY DEFINER si nécessaire, mais à contrôler)
- [ ] Pas de données sensibles dans le client (éviter de select des colonnes inutiles)
