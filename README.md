# Mes Finances

Application de finances personnelles : Next.js 16, base **Neon** (Postgres serverless) branchée via l'intégration Vercel, auth **Better Auth** (email + mot de passe, tables dans la même base), installable en **PWA**.

## Architecture des données

- Tout accès à la base est côté serveur (`src/lib/db.ts`, driver HTTP `@neondatabase/serverless`). Il n'y a pas de RLS : chaque requête filtre explicitement sur l'utilisateur de la session (`getUserId()`).
- Écritures : server actions (`src/actions/*`).
- Lectures : `GET /api/data/[query]` → `src/server/queries.ts`, appelé par les pages via `fetchData()` (React Query).
- Schéma : `db/migrations/*.sql`, appliqué par `npm run db:migrate`.

## Mise en route sur Vercel

1. **Vercel → projet → Storage → Create Database → Neon.** L'intégration injecte `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dans tous les environnements.
2. **Variables à ajouter** (Settings → Environment Variables) :
   - `BETTER_AUTH_SECRET` : `openssl rand -base64 32`
   - `BETTER_AUTH_URL` : l'URL de production (`https://….vercel.app` ou votre domaine), en environnement *Production* uniquement.
3. **En local** :
   ```bash
   vercel link && vercel env pull .env.local   # récupère DATABASE_URL & co
   npm run db:migrate                          # crée le schéma dans Neon
   npm run user:create -- vous@exemple.com "mot de passe"
   npm run dev
   ```
   Ajoutez `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL=http://localhost:3000` dans `.env.local` (voir `.env.local.example`).

L'inscription publique est désactivée : les comptes se créent avec `npm run user:create` (relancer la commande sur un email existant réinitialise son mot de passe).

## Reprendre les données de Supabase

```bash
# depuis un backup du dashboard (dump SQL texte)
npm run db:import-supabase -- --from-dump ./db_cluster-XX-XX-XXXX.backup

# ou depuis la base en ligne
SUPABASE_DB_URL="postgresql://postgres:<mdp>@db.<ref>.supabase.co:5432/postgres" \
SUPABASE_CA_CERT=./prod-ca-2021.crt \
  npm run db:import-supabase
```

Copie les utilisateurs (même id, même mot de passe : les hash bcrypt de Supabase sont acceptés à la connexion) puis comptes, catégories, transferts, transactions et budgets. Le certificat se télécharge dans Supabase → Project Settings → Database → SSL. Relançable sans doublons.

## PWA

Manifest dans `src/app/manifest.ts`, service worker Serwist (`src/sw.ts`, actif en production uniquement). Les dernières données consultées restent lisibles hors ligne, et une page `/~offline` s'affiche pour les pages jamais ouvertes. Le cache des données est vidé à l'affichage de l'écran de connexion.

## Vérifications

```bash
npm run typecheck
npm test        # les tests tests/db/* exécutent le vrai SQL sur un Postgres en mémoire (PGlite)
npm run build
```
