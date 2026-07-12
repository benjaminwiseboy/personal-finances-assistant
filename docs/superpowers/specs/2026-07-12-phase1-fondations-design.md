# PFM App — Phase 1 : Fondations

## Contexte

Application de gestion de finances personnelles (PFM), mono-utilisateur, accessible en PWA
(desktop + mobile). Projet distinct de `gestion-business-app` (qui couvre investissements,
foncier et prêts business) : le PFM gère le quotidien financier personnel (comptes bancaires,
dépenses/revenus, budget).

Le cahier des charges complet couvre 5 grands blocs fonctionnels. Ce document ne couvre que la
**Phase 1 (Fondations)** ; les phases suivantes (Budgets, Récurrences, Import CSV,
Prêts & emprunts) auront chacune leur propre spec, une fois la Phase 1 implémentée.

### Décisions de cadrage

- **Devise** : euros uniquement, pas de multi-devise.
- **Authentification** : Supabase Auth (email/password), un seul compte créé manuellement
  (pas d'inscription publique). RLS Postgres sur `auth.uid() = user_id`.
- **Hébergement** : Vercel (app Next.js) + Supabase Cloud (base de données).
- **Stack** : identique à `gestion-business-app` pour cohérence et réutilisation de patterns —
  Next.js 16 (App Router) + TypeScript, `@supabase/ssr`, Tailwind v4 + shadcn/ui,
  react-hook-form + zod, recharts, Serwist (PWA), TanStack Query, Zustand (si besoin), decimal.js
  pour les montants côté app (stockage `numeric` côté Postgres), Vitest pour les tests.

## Périmètre de la Phase 1

- Gestion multicompte (comptes bancaires, soldes)
- Transactions manuelles (CRUD dépenses/revenus)
- Transferts inter-comptes (génération automatique de 2 transactions liées)
- Catégories et sous-catégories (entrées/sorties)
- Dashboard basique : navigation mensuelle, 3 KPI, répartition des dépenses par catégorie

Hors périmètre (traité en phases ultérieures) : budgets/limites, récurrences (abonnements),
import CSV et auto-catégorisation, prêts et emprunts.

## Architecture générale

- **Server Actions** pour toutes les écritures (create/update/delete comptes, transactions,
  catégories, transferts) — pas d'API routes séparées sauf besoin spécifique futur.
- **Supabase** : Postgres + Auth + RLS sur toutes les tables.
- **PWA** via Serwist : manifest + service worker, installable sur mobile et desktop, cache des
  assets statiques uniquement (pas de cache offline des données financières en Phase 1 — l'app
  nécessite une connexion à Supabase).
- **TanStack Query** côté client pour le cache/refetch après les Server Actions ; **Zustand**
  uniquement si un état global UI s'avère utile (ex: mois sélectionné dans le dashboard).
- Montants gérés en **decimal.js** côté app, stockés en `numeric(12,2)` côté Postgres (jamais de
  float).

## Modèle de données

```sql
-- Comptes bancaires
accounts
  id              uuid pk default gen_random_uuid()
  user_id         uuid not null references auth.users
  name            text not null
  type            text not null   -- 'courant' | 'livret' | 'épargne' | 'autre'
  initial_balance numeric(12,2) not null default 0
  created_at      timestamptz not null default now()

-- Catégories (entrées/sorties), avec sous-catégories
categories
  id            uuid pk default gen_random_uuid()
  user_id       uuid not null references auth.users
  name          text not null
  type          text not null   -- 'income' | 'expense'
  parent_id     uuid references categories(id)   -- null = catégorie racine
  created_at    timestamptz not null default now()

-- Transferts inter-comptes (source de vérité pour l'audit)
transfers
  id              uuid pk default gen_random_uuid()
  user_id         uuid not null references auth.users
  from_account_id uuid not null references accounts(id)
  to_account_id   uuid not null references accounts(id)
  amount          numeric(12,2) not null check (amount > 0)
  date            date not null
  description     text
  created_at      timestamptz not null default now()

  check (from_account_id <> to_account_id)

-- Transactions (dépenses, revenus, et les 2 lignes générées par un transfert)
transactions
  id            uuid pk default gen_random_uuid()
  user_id       uuid not null references auth.users
  account_id    uuid not null references accounts(id)
  category_id   uuid references categories(id)     -- null si liée à un transfert
  transfer_id   uuid references transfers(id)       -- non-null si générée par un transfert
  amount        numeric(12,2) not null              -- signé : positif = crédit, négatif = débit
  date          date not null
  description   text not null
  created_at    timestamptz not null default now()

  check ( (transfer_id is null and category_id is not null)
       or (transfer_id is not null and category_id is null) )
```

### Vues SQL (agrégation déléguée à Supabase)

```sql
-- Solde de chaque compte = solde initial + somme de ses transactions
v_account_balances (account_id, name, type, balance)

-- Résumé mensuel par catégorie racine, hors transactions liées à un transfert
v_category_monthly_summary (user_id, category_root_id, category_name, type, year, month, total)

-- Totaux du mois (entrées / sorties / reste à vivre)
v_monthly_totals (user_id, year, month, total_income, total_expense, net)
```

### RLS

Policy `USING (auth.uid() = user_id)` en lecture/écriture sur `accounts`, `categories`,
`transfers`, `transactions`. Les vues héritent des permissions via `security_invoker = true`.

### Transferts — atomicité

Une fonction Postgres `create_transfer(from_account, to_account, amount, date, description)`
insère la ligne `transfers` + les 2 lignes `transactions` (débit/crédit) dans une seule
transaction SQL, appelée depuis un Server Action via `.rpc()`. Même principe pour la suppression
(`delete_transfer`), qui supprime les 2 transactions liées.

## Écrans

Toutes les pages sont protégées par auth (redirection vers `/login` sinon).

- **`/dashboard`** — sélecteur de mois (← mois →), 3 cartes KPI (entrées / sorties / reste à
  vivre), graphique de répartition des dépenses par catégorie (recharts), liste des transactions
  récentes du mois.
- **`/accounts`** — liste des comptes avec soldes (`v_account_balances`), création/édition/
  suppression.
- **`/transactions`** — liste filtrable (compte, catégorie, mois), formulaire création/édition,
  suppression. Les lignes issues d'un transfert sont affichées mais non éditables
  individuellement (on édite/supprime le transfert).
- **`/transfers`** — formulaire (compte source, compte destination, montant, date, description) +
  historique.
- **`/categories`** — gestion arborescente (catégories racines + sous-catégories), type
  entrée/sortie.
- **`/login`** — formulaire Supabase Auth email/password (pas d'inscription publique).

## Server Actions

Regroupées par domaine dans `src/actions/` :

- `accounts.ts` : `createAccount`, `updateAccount`, `deleteAccount`
- `categories.ts` : `createCategory`, `updateCategory`, `deleteCategory`
- `transactions.ts` : `createTransaction`, `updateTransaction`, `deleteTransaction` (refuse si
  `transfer_id` non-null)
- `transfers.ts` : `createTransfer`, `deleteTransfer` (appellent les fonctions Postgres RPC)

Validation des inputs avec zod avant chaque écriture ; erreurs remontées via `sonner` (toasts).

**Suppression d'un compte/catégorie utilisé(e)** : bloquée si des transactions y sont rattachées
(message d'erreur explicite), pas de suppression en cascade silencieuse — évite la perte de
données historiques par erreur.

## Tests, erreurs, cas limites

- **Vitest** : tests unitaires sur la validation zod ; tests d'intégration légers sur les Server
  Actions critiques (`createTransfer` génère bien 2 transactions liées, `deleteTransaction`
  refuse sur transaction de transfert).
- **Cas limites gérés dès la Phase 1** :
  - Suppression compte/catégorie référencé(e) → bloquée avec message clair.
  - Transfert vers le même compte (`from_account_id = to_account_id`) → rejeté côté zod et côté
    contrainte SQL.
  - Montant transaction à 0 → autorisé (ex: régularisation) mais montant transfert doit être
    `> 0`.
  - Mois sans transactions → dashboard affiche des totaux à 0, pas d'erreur.
- **PWA** : manifest avec icônes, `display: standalone`, testé sur mobile (installation) et
  desktop (Chrome/Edge "installer l'app"). Pas de mode offline en Phase 1.

## Hors périmètre (Phase 1)

Budgets/limites, récurrences (abonnements), import CSV et auto-catégorisation, prêts et
emprunts — chacun fera l'objet d'une spec dédiée une fois la Phase 1 implémentée et validée.

## Roadmap des phases suivantes (pour mémoire)

1. ~~Fondations~~ (ce document)
2. Budgets : limite mensuelle par catégorie, suivi de consommation, graphiques de répartition
3. Récurrences : abonnements/prélèvements, génération à la volée à l'ouverture de l'app
4. Import CSV : parsing, preview, moteur de règles (mots-clés → catégorie), dé-doublonnage par
   hash
5. Prêts & emprunts : contacts/tiers, contrats (dette/créance), liaison remboursements, alertes
   d'échéance
