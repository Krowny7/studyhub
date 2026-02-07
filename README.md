# CFA Hub (v7)

Plateforme de révision (QCM, flashcards, exercices) avec **auth Supabase**, **bibliothèque de PDFs**, **XP/niveaux** et **duels PvP (ELO)**.

## Documentation

➡️ Point d'entrée : **`docs_v0/README.md`**

- Démarrage rapide : `docs_v0/00_quickstart.md`
- Architecture : `docs_v0/01_architecture.md`
- Modèle de données (Supabase) : `docs_v0/03_data_model.md`
- Setup Supabase : `docs_v0/04_supabase_setup.md`

## Prérequis

- Node.js (LTS recommandé)
- Un projet **Supabase** avec les scripts SQL du dossier `supabase/`

## Lancer en local

1. Installer les dépendances
   ```bash
   npm install
   ```
2. Configurer l'environnement
   ```bash
   cp .env.example .env.local
   # puis remplir NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
3. Démarrer
   ```bash
   npm run dev
   ```

## Conventions de doc (V0)

- La doc vit dans `docs_v0/`.
- Chaque nouvelle fonctionnalité ajoute :
  - un fichier `docs_v0/features/<feature>.md` (ou une section dans `06_features.md`)
  - et, si besoin, une mini-décision d'architecture (ADR) via `docs_v0/templates/adr_template.md`.


## Diagnostics (Supabase ↔ code cohesion)

Open: `/admin/diagnostics`

- Provides **schema checks** (tables/columns/RPCs/storage) and **RLS access checks**.
- Includes an **Export JSON** button to copy/paste a full diagnostics report into ChatGPT or a ticket.
- Recommended: set `SUPABASE_SERVICE_ROLE_KEY` (server-only) so schema checks bypass RLS.

See: `docs_v0/DIAGNOSTICS_GUIDE.md`

## Quality commands

```bash
npm run typecheck
npm run lint
npm run build
```

Audit:

```bash
npm audit
npm run audit:json
```
