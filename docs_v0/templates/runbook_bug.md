# Runbook — Bug / Incident

## Symptômes

- Message d'erreur exact :
- Page / route :
- Repro steps :

## Hypothèses

- (RLS ?) (RPC ?) (constraint ?) (auth ?) (front ?)

## Diagnostic rapide

1. Vérifier la session : utilisateur connecté ? cookies ?
2. Vérifier Supabase logs (DB / Auth)
3. Vérifier RLS (policy manquante ?)
4. Si RPC : vérifier signature + schema cache (PostgREST)

## Fix

- ...

## Post-mortem

- Cause racine :
- Prévention :
- Tests ajoutés :
