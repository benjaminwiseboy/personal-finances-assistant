# Phase 2 — Budgets (design)

## Objectif

Permettre à l'utilisateur de fixer une **limite de dépense mensuelle par catégorie**
et de suivre sa **consommation** (dépensé vs budget) mois par mois, avec alerte de
dépassement.

Décisions validées :

- **Montant mensuel récurrent** : un budget = un montant qui s'applique à chaque
  mois (pas de montant différent par mois en Phase 2).
- **Dépenses uniquement** : pas d'objectif de revenu.
- **Catégories racines** : un budget porte sur une catégorie de dépense de premier
  niveau ; la consommation inclut ses sous-catégories.

## Modèle de données

Nouvelle table `budgets` :

| colonne       | type            | notes                                         |
| ------------- | --------------- | --------------------------------------------- |
| `id`          | uuid PK         | `gen_random_uuid()`                           |
| `user_id`     | uuid            | FK `auth.users`, `on delete cascade`          |
| `category_id` | uuid            | FK `categories`, `on delete cascade`          |
| `amount`      | numeric(12,2)   | limite mensuelle, `> 0`                       |
| `created_at`  | timestamptz     | `now()`                                       |
| `updated_at`  | timestamptz     | `now()`                                       |

- `unique (user_id, category_id)` : un seul budget par catégorie.
- RLS `security_invoker` : chaque utilisateur ne lit/écrit que ses budgets
  (`user_id = auth.uid()`), même schéma que les autres tables.
- Contrainte applicative (côté action serveur) : la catégorie doit appartenir à
  l'utilisateur, être de type `expense` et racine (`parent_id is null`).

Pas de nouvelle vue SQL : la consommation réutilise `v_category_monthly_summary`
(déjà agrégée par catégorie racine, type, année, mois, transferts exclus).

## Calcul de la consommation (logique pure, testable)

`src/domain/budgets.ts` — fonction `budgetStatus(amount, spent)` renvoyant :

- `spent`, `remaining = amount - spent`, `ratio = spent / amount`
- `state` : `ok` (< 0.8), `warning` (0.8–1), `over` (> 1)

La page fusionne côté client : budgets (récurrents) + lignes de
`v_category_monthly_summary` du mois sélectionné (type `expense`), jointes sur
`category_root_id = budget.category_id`. Une catégorie sans dépense ce mois = 0.

## UI

### Nouvel onglet « Budgets » (rail desktop + tabs mobile)

Icône `Target`. La barre mobile repasse à 5 onglets.

### Page Budgets

- **Sélecteur de mois** (composant `MonthNav` réutilisé) : la consommation
  affichée correspond au mois choisi ; les budgets eux-mêmes sont récurrents.
- **En-tête récapitulatif** : total budgété vs total dépensé ce mois, barre de
  progression globale, reste.
- **Une carte par budget** : nom de catégorie, montant budgété, dépensé, restant,
  barre de progression. Couleur selon `state` : ember (`ok`), ambre (`warning`),
  rouge/`destructive` (`over`, avec « Dépassé de X € »).
- **Ajouter un budget** (dialogue) : sélection d'une catégorie de dépense racine
  pas encore budgétée + montant. Si toutes les catégories sont budgétées ou qu'il
  n'y a aucune catégorie de dépense, message d'accompagnement.
- **Modifier / supprimer** un budget (édition du montant).

### Encart dashboard

Bloc compact « Budgets à surveiller » : les budgets en `warning`/`over` du mois
courant (ou un état « tout est sous contrôle » si aucun). Réutilise
`budgetStatus` et la carte de progression.

## Backend

`src/actions/budgets.ts` :

- `createBudget({ category_id, amount })`
- `updateBudget(id, { amount })`
- `deleteBudget(id)`

Validation zod (`src/domain/validators.ts`) : `BudgetFormSchema` (category_id uuid,
amount décimal `> 0`). Chaque action vérifie l'authentification, l'appartenance de
la catégorie, son type `expense` et `parent_id is null`. `revalidatePath` sur
`/budgets` et `/dashboard`.

Clés React Query : `["budgets"]` (liste des budgets récurrents). La consommation
réutilise une requête sur `v_category_monthly_summary` scindée par mois. Les
actions de transaction invalident déjà `dashboard-categories` ; on ajoute
l'invalidation de `["budgets"]` là où c'est pertinent (création de budget).

## Tests

- `budgetStatus` : seuils ok/warning/over, division par zéro, dépassement.
- `BudgetFormSchema` : montant ≤ 0 rejeté, montant valide, catégorie requise.

## Hors périmètre (améliorations futures)

Budgets par sous-catégorie, montant différent par mois, objectifs de revenus,
report du non-dépensé, notifications push d'alerte.

## Migration

Fichier `supabase/migrations/2026071613xxxx_budgets.sql`. Base distante : à
appliquer par l'utilisateur (`supabase db push` si le projet est lié, ou coller le
SQL dans l'éditeur SQL Supabase). La fonctionnalité n'est active qu'une fois la
migration passée.
