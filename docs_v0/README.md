# Docs V0 — CFA Hub

Objectif : un **dossier de référence** (living docs) pour comprendre rapidement le programme, son architecture, et les règles de contribution.

> Convention : la V0 pose le socle (noms, structure, principes). Les ajouts futurs doivent **s'aligner** dessus.

## Table des matières

1. **Démarrage rapide** — `00_quickstart.md`
2. **Architecture & design** — `01_architecture.md`
3. **Routes & pages (Next.js App Router)** — `02_routes.md`
4. **Modèle de données (Supabase)** — `03_data_model.md`
5. **Setup Supabase (scripts SQL)** — `04_supabase_setup.md`
6. **Fonctionnalités (vue produit)** — `06_features.md`
7. **Auth, sécurité, RLS, permissions** — `05_auth_and_security.md`
8. **I18n (FR/EN)** — `07_i18n.md`
9. **XP / niveaux** — `08_leveling_xp.md`
10. **Duels PvP / ELO** — `09_pvp_duels.md`
11. **Standards de code (front, data, UX)** — `10_coding_standards.md`
12. **Contribuer / workflow** — `11_contributing.md`

## Templates

- Spécification de feature : `templates/feature_spec.md`
- ADR (Architecture Decision Record) : `templates/adr_template.md`
- Runbook bug / incident : `templates/runbook_bug.md`

## Comment maintenir cette doc

- Toute feature qui touche le produit doit être reflétée dans `06_features.md`.
- Toute feature qui touche l'architecture ou le modèle de données doit aussi mettre à jour :
  - `01_architecture.md` et/ou `03_data_model.md`.
- Les migrations Supabase doivent être ajoutées dans `04_supabase_setup.md` (ordre d'exécution + vérifs).

- [Troubleshooting — Supabase data missing](10-troubleshooting.md)
