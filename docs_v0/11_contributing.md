# 11 — Contribuer / workflow

## Branching

Suggestion simple :
- `main` : stable
- `feat/<name>` : feature
- `fix/<name>` : bugfix

## Pull Request checklist

- [ ] Build OK (`npm run build`)
- [ ] Lint OK (`npm run lint`)
- [ ] Pages principales testées : login, dashboard, qcm, challenges
- [ ] Si DB : script SQL idempotent + documenté (`04_supabase_setup.md`)
- [ ] Docs mises à jour (au minimum `06_features.md`)

## Ajout d'une table ou colonne

1. Créer un fichier `supabase/<YYYYMMDD>_<topic>.sql`
2. SQL idempotent : `create table if not exists`, `alter table add column if not exists`, etc.
3. Activer RLS + ajouter policies
4. Si RPC : ajouter `NOTIFY pgrst, 'reload schema'`
5. Mettre à jour : `03_data_model.md` + `04_supabase_setup.md`

## Debug

- Toujours commencer par vérifier l'erreur Supabase (RLS / constraint / function missing)
- Pour les erreurs RPC : vérifier la signature + schema cache
- Pour les problèmes de session : vérifier `middleware.ts` + cookies
