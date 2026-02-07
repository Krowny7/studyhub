# Troubleshooting — Données "disparues" (QCM / Flashcards / PDF)

## Symptômes typiques
- Les pages **Library / Flashcards / QCM / Exercises** affichent 0 élément alors que tu en avais.
- Tu es bien connecté (auth OK), mais les listes sont vides.

Dans ce projet, **les pages n'ajoutent pas systématiquement `.eq("owner_id", auth.uid())`** : elles comptent sur les **policies RLS** pour ne renvoyer que ce que l'utilisateur a le droit de voir.

Donc, 2 causes reviennent tout le temps :

1) **Mauvais projet Supabase (URL/key)** : tu pointes vers une base vide.
2) **RLS / `owner_id` pas alignés** : tes lignes existent mais ne sont pas "visibles" pour ton user.

---

## Méthode rapide (zéro screenshot)

### 1) Vérifier l'URL Supabase utilisée par l'app
Ouvre : **`/admin/diagnostics`**
- Ça affiche l'`user.id` courant
- Ça affiche l'URL Supabase (env)
- Et des **counts RLS-aware** sur `documents`, `flashcard_sets`, `quiz_sets`, `exercise_sets`

➡️ Si tout est à 0 : soit mauvais projet, soit RLS.

### 2) Diagnostic DB (copier-coller)
Dans Supabase → SQL editor : exécute **`supabase/DIAGNOSTICS.sql`**.
- Copie/colle ici le résultat (texte brut).

### 3) Fix le plus fréquent (owner_id + policies)
Exécute ensuite **`supabase/COMPAT_ALIGN.sql`**.
Ça :
- Ajoute `owner_id`/`visibility` si manquants
- Backfill `owner_id` depuis `user_id`/`created_by`/`profile_id` si présents
- (Re)crée des policies RLS de base cohérentes avec l'app

---

## Cause 1 — Mauvais projet Supabase
Signes :
- `DIAGNOSTICS.sql` montre **`total_rows = 0`** sur toutes les tables de contenu.

Fix :
- Mets à jour `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (env du deploy + `.env.local` en local)
- Redéploie / redémarre.

---

## Cause 2 — RLS activé mais policies/owner_id KO
Signes :
- Supabase Table Editor montre des lignes, mais `/admin/diagnostics` affiche 0.
- `DIAGNOSTICS.sql` montre **`rls_enabled = true`** et **`policy_count = 0`**
- ou `owner_id_null` élevé.

Fix :
- Run `supabase/COMPAT_ALIGN.sql`.

