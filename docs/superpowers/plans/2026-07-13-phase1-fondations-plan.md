# PFM App — Phase 1 (Fondations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 foundations of the PFM app: multi-account tracking, manual
transactions, inter-account transfers, categories/sub-categories, and a basic monthly dashboard,
as a Next.js + Supabase PWA.

**Architecture:** Next.js 16 App Router with Server Actions for all writes, Supabase
(Postgres + Auth) with Row Level Security, SQL views for aggregation, decimal.js for money
handling. Mirrors the validated stack/conventions of the sibling project
`gestion-business-app` (same repo root, `../gestion-business-app`).

**Tech Stack:** Next.js 16, TypeScript, React 19, Tailwind v4 + shadcn/ui, `@supabase/ssr`,
`@supabase/supabase-js`, react-hook-form + zod, TanStack Query, decimal.js, recharts,
Serwist (PWA), Vitest.

## Global Constraints

- Currency: EUR only, no multi-currency support.
- Auth: Supabase Auth email/password, single manually-created account, no public sign-up.
- All money amounts stored as Postgres `numeric(12,2)`, never floating point in calculations —
  wrap in `decimal.js` (`src/lib/money.ts`) before any arithmetic or formatting.
- All writes go through Next.js Server Actions in `src/actions/`, validated with zod schemas
  from `src/domain/validators.ts`.
- All tables have RLS enabled, policy `auth.uid() = user_id`.
- Transactions linked to a transfer (`transfer_id` not null) are never directly
  inserted/updated/deleted by the client — only through the `create_transfer` /
  `delete_transfer` Postgres functions. This is enforced both in RLS policies and in the
  Server Action layer (defense in depth).
- French UI strings throughout (labels, error messages, toasts) — this is a French-speaking
  user's personal app.
- Package manager: npm (matches `gestion-business-app`).

---

## Task 1: Project Scaffolding

**Files:**
- Create: `pfm-app/package.json`
- Create: `pfm-app/tsconfig.json`
- Create: `pfm-app/eslint.config.mjs`
- Create: `pfm-app/.prettierrc.json`
- Create: `pfm-app/.prettierignore`
- Create: `pfm-app/postcss.config.mjs`
- Create: `pfm-app/vitest.config.ts`
- Create: `pfm-app/tests/setup.ts`
- Create: `pfm-app/.env.local.example`
- Create: `pfm-app/.gitignore`
- Create: `pfm-app/src/app/layout.tsx`
- Create: `pfm-app/src/app/page.tsx`
- Create: `pfm-app/src/app/providers.tsx`
- Create: `pfm-app/src/app/globals.css`
- Create: `pfm-app/src/lib/utils.ts`

**Interfaces:**
- Produces: a runnable Next.js dev server (`npm run dev`), `npm run typecheck`, `npm run lint`,
  `npm run test` all working with zero source files beyond scaffolding. Every later task builds
  on this.

- [ ] **Step 1: Initialize the Next.js project**

Run from the repo root (`c:/Users/benja/Documents/Work/Claude Code`):

```bash
npx create-next-app@latest pfm-app --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --no-turbopack --use-npm --yes
```

Expected: a `pfm-app/` directory is created with a working Next.js app (`package.json`, `src/app/`, `tailwind` configured).

- [ ] **Step 2: Replace `package.json` dependencies to match the validated stack**

Edit `pfm-app/package.json` so `dependencies` and `devDependencies` read exactly:

```json
{
  "name": "pfm-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@base-ui/react": "^1.5.0",
    "@hookform/resolvers": "^5.4.0",
    "@serwist/next": "^9.5.11",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.107.0",
    "@tanstack/react-query": "^5.101.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.4.0",
    "decimal.js": "^10.6.0",
    "lucide-react": "^1.17.0",
    "next": "16.2.7",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-hook-form": "^7.77.0",
    "recharts": "^3.8.1",
    "serwist": "^9.5.11",
    "shadcn": "^4.10.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.2",
    "@vitest/coverage-v8": "^4.1.8",
    "eslint": "^9",
    "eslint-config-next": "16.2.7",
    "eslint-config-prettier": "^10.1.8",
    "jsdom": "^29.1.1",
    "prettier": "^3.8.3",
    "prettier-plugin-tailwindcss": "^0.8.0",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.8"
  }
}
```

Then run:

```bash
cd pfm-app && npm install
```

Expected: install completes with no errors.

- [ ] **Step 3: Set `tsconfig.json`**

Write `pfm-app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Set ESLint, Prettier, PostCSS config**

Write `pfm-app/eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
```

Write `pfm-app/.prettierrc.json`:

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 80,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Write `pfm-app/.prettierignore`:

```
node_modules
.next
.vercel
out
build
coverage
*.lock
package-lock.json
public
src/components/ui
```

Write `pfm-app/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Set up Vitest**

Write `pfm-app/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/domain/**", "src/actions/**"],
      exclude: ["src/lib/supabase/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Write `pfm-app/tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Environment variable example file**

Write `pfm-app/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Confirm `pfm-app/.gitignore` (generated by `create-next-app`) includes `.env*.local` and
`node_modules` — if not, append them.

- [ ] **Step 7: Root layout, providers, globals**

Write `pfm-app/src/app/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
```

Write `pfm-app/src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mes Finances",
  description: "Gestion de finances personnelles",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mes Finances",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Write `pfm-app/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

Leave `pfm-app/src/app/globals.css` as generated by `create-next-app` (Tailwind v4 imports) —
no changes needed in this step.

- [ ] **Step 8: Verify the scaffold builds and runs**

Run:

```bash
cd pfm-app && npm run typecheck && npm run lint && npm run test
```

Expected: `typecheck` passes with no errors, `lint` passes (no source files to fail on yet
besides the generated ones), `test` reports "No test files found" without erroring the process
(Vitest exits 0 for an empty suite run via `vitest run`).

- [ ] **Step 9: Commit**

```bash
cd pfm-app && git add -A && git commit -m "chore: scaffold Next.js project with shared tooling config"
```

---

## Task 2: shadcn/ui Setup

**Files:**
- Create: `pfm-app/components.json`
- Create: `pfm-app/src/components/ui/*` (generated)

**Interfaces:**
- Produces: shadcn/ui primitives (`Button`, `Input`, `Select`, `Dialog`, `Card`, `Table`,
  `Form`, `Label`, `Textarea`) importable from `@/components/ui/*`, used by every UI task from
  Task 8 onward.

- [ ] **Step 1: Initialize shadcn/ui**

Run:

```bash
cd pfm-app && npx shadcn@latest init -y -b base-nova --css-variables
```

If the CLI prompts interactively despite `-y`, answer: base color `neutral`, no config file
override, RSC yes, CSS `src/app/globals.css`, alias `@/components`, `@/lib/utils`,
`@/components/ui`, `@/hooks`.

Expected: `pfm-app/components.json` is created, `src/lib/utils.ts` is created with a `cn()`
helper, `src/app/globals.css` gains shadcn's CSS variables.

- [ ] **Step 2: Add the primitives this phase needs**

Run:

```bash
cd pfm-app && npx shadcn@latest add button input select dialog card table form label textarea
```

Expected: files appear under `pfm-app/src/components/ui/` for each component, no errors.

- [ ] **Step 3: Verify build**

Run:

```bash
cd pfm-app && npm run typecheck && npm run lint
```

Expected: both pass (ESLint ignores `src/components/ui/**` per Task 1's config).

- [ ] **Step 4: Commit**

```bash
cd pfm-app && git add -A && git commit -m "chore: add shadcn/ui primitives"
```

---

## Task 3: Database Schema & RLS Migration

**Files:**
- Create: `pfm-app/supabase/migrations/20260713120000_initial_schema.sql`

**Interfaces:**
- Produces: tables `accounts`, `categories`, `transfers`, `transactions` with RLS, applied to
  the Supabase project. Later tasks (4, 5, 8–12) depend on this exact schema.

- [ ] **Step 1: Create the Supabase project link (if not already linked)**

If this is the first Supabase interaction for this repo, install the Supabase CLI if not
present and link the project:

```bash
cd pfm-app && npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>
```

(`<your-project-ref>` comes from the Supabase dashboard URL of the project created for this
app. Skip `login`/`link` if already authenticated from another project in this environment —
only `init` is required per-repo.)

Expected: `pfm-app/supabase/config.toml` exists.

- [ ] **Step 2: Write the schema migration**

Write `pfm-app/supabase/migrations/20260713120000_initial_schema.sql`:

```sql
-- Accounts ---------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  initial_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

create policy "accounts_select_own" on accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_delete_own" on accounts
  for delete using (auth.uid() = user_id);

-- Categories ---------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  parent_id uuid references categories(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

create policy "categories_select_own" on categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on categories
  for delete using (auth.uid() = user_id);

create index categories_parent_id_idx on categories(parent_id);

-- Transfers ------------------------------------------------------------------
-- Rows are only ever inserted/deleted via the create_transfer / delete_transfer
-- SECURITY DEFINER functions (see migration 20260713122000), never directly by
-- the client, so only a select policy is granted here.

create table transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references accounts(id) on delete restrict,
  to_account_id uuid not null references accounts(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  description text,
  created_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

alter table transfers enable row level security;

create policy "transfers_select_own" on transfers
  for select using (auth.uid() = user_id);

-- Transactions ---------------------------------------------------------------
-- Direct client insert/update/delete is only allowed for regular (non-transfer)
-- transactions. Transfer-linked rows (transfer_id not null) can only be
-- written by the SECURITY DEFINER functions, which bypass RLS as the function
-- owner — this policy still blocks any accidental/malicious direct write to
-- those rows from the client.

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid references categories(id) on delete restrict,
  transfer_id uuid references transfers(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint transactions_category_xor_transfer check (
    (transfer_id is null and category_id is not null)
    or (transfer_id is not null and category_id is null)
  )
);

alter table transactions enable row level security;

create policy "transactions_select_own" on transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on transactions
  for insert with check (auth.uid() = user_id and transfer_id is null);
create policy "transactions_update_own" on transactions
  for update using (auth.uid() = user_id and transfer_id is null)
  with check (auth.uid() = user_id and transfer_id is null);
create policy "transactions_delete_own" on transactions
  for delete using (auth.uid() = user_id and transfer_id is null);

create index transactions_account_id_idx on transactions(account_id);
create index transactions_category_id_idx on transactions(category_id);
create index transactions_transfer_id_idx on transactions(transfer_id);
create index transactions_date_idx on transactions(date);
```

- [ ] **Step 3: Apply the migration**

Run:

```bash
cd pfm-app && npx supabase db push
```

Expected: output confirms the migration was applied with no errors.

- [ ] **Step 4: Verify in the Supabase dashboard**

Open the project's Table Editor and confirm `accounts`, `categories`, `transfers`,
`transactions` exist with RLS enabled (a shield icon or "RLS enabled" label next to each
table).

- [ ] **Step 5: Commit**

```bash
cd pfm-app && git add supabase/ && git commit -m "feat(db): add Phase 1 schema with RLS (accounts, categories, transfers, transactions)"
```

---

## Task 4: SQL Views Migration

**Files:**
- Create: `pfm-app/supabase/migrations/20260713121000_views.sql`

**Interfaces:**
- Consumes: `accounts`, `categories`, `transactions` tables from Task 3.
- Produces: views `v_account_balances`, `v_category_monthly_summary`, `v_monthly_totals`,
  queried by Task 8 (accounts), Task 12 (dashboard).

- [ ] **Step 1: Write the views migration**

Write `pfm-app/supabase/migrations/20260713121000_views.sql`:

```sql
-- Account balance = initial balance + sum of all its transactions
-- (transfer-linked transactions ARE included: they move real money between
-- accounts and must affect the balance).
create view v_account_balances
  with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.initial_balance,
  a.initial_balance + coalesce(sum(t.amount), 0) as balance
from accounts a
left join transactions t on t.account_id = a.id
group by a.id, a.user_id, a.name, a.type, a.initial_balance;

-- Monthly spending/income per root category, excluding transfer-linked
-- transactions (a transfer is not a real expense/income).
create view v_category_monthly_summary
  with (security_invoker = true) as
select
  t.user_id,
  coalesce(c.parent_id, c.id) as category_root_id,
  coalesce(root.name, c.name) as category_name,
  c.type,
  extract(year from t.date)::int as year,
  extract(month from t.date)::int as month,
  sum(abs(t.amount)) as total
from transactions t
join categories c on c.id = t.category_id
left join categories root on root.id = c.parent_id
where t.transfer_id is null
group by
  t.user_id,
  coalesce(c.parent_id, c.id),
  coalesce(root.name, c.name),
  c.type,
  extract(year from t.date),
  extract(month from t.date);

-- Monthly totals (income / expense / net), excluding transfer-linked
-- transactions.
create view v_monthly_totals
  with (security_invoker = true) as
select
  t.user_id,
  extract(year from t.date)::int as year,
  extract(month from t.date)::int as month,
  coalesce(sum(t.amount) filter (where t.amount > 0), 0) as total_income,
  coalesce(abs(sum(t.amount) filter (where t.amount < 0)), 0) as total_expense,
  coalesce(sum(t.amount), 0) as net
from transactions t
where t.transfer_id is null
group by t.user_id, extract(year from t.date), extract(month from t.date);
```

- [ ] **Step 2: Apply and verify**

Run:

```bash
cd pfm-app && npx supabase db push
```

Expected: migration applied with no errors. In the Supabase SQL editor, run
`select * from v_account_balances;` — expected: empty result set (no accounts yet), no error.

- [ ] **Step 3: Commit**

```bash
cd pfm-app && git add supabase/ && git commit -m "feat(db): add account balance and monthly summary views"
```

---

## Task 5: Transfer RPC Functions Migration

**Files:**
- Create: `pfm-app/supabase/migrations/20260713122000_transfer_functions.sql`

**Interfaces:**
- Consumes: `accounts`, `transfers`, `transactions` tables from Task 3.
- Produces: Postgres functions `create_transfer(p_from_account_id uuid, p_to_account_id uuid,
  p_amount numeric, p_date date, p_description text) returns uuid` and
  `delete_transfer(p_transfer_id uuid) returns void`, called via `.rpc()` from
  `src/actions/transfers.ts` in Task 11.

- [ ] **Step 1: Write the functions migration**

Write `pfm-app/supabase/migrations/20260713122000_transfer_functions.sql`:

```sql
create or replace function create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_transfer_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'Les comptes source et destination doivent être différents';
  end if;

  if p_amount <= 0 then
    raise exception 'Le montant doit être positif';
  end if;

  if not exists (
    select 1 from accounts where id = p_from_account_id and user_id = v_user_id
  ) then
    raise exception 'Compte source introuvable';
  end if;

  if not exists (
    select 1 from accounts where id = p_to_account_id and user_id = v_user_id
  ) then
    raise exception 'Compte destination introuvable';
  end if;

  insert into transfers (user_id, from_account_id, to_account_id, amount, date, description)
  values (v_user_id, p_from_account_id, p_to_account_id, p_amount, p_date, p_description)
  returning id into v_transfer_id;

  insert into transactions (user_id, account_id, category_id, transfer_id, amount, date, description)
  values
    (v_user_id, p_from_account_id, null, v_transfer_id, -p_amount, p_date, coalesce(p_description, 'Transfert')),
    (v_user_id, p_to_account_id, null, v_transfer_id, p_amount, p_date, coalesce(p_description, 'Transfert'));

  return v_transfer_id;
end;
$$;

create or replace function delete_transfer(p_transfer_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from transfers where id = p_transfer_id and user_id = v_user_id
  ) then
    raise exception 'Transfert introuvable';
  end if;

  delete from transactions where transfer_id = p_transfer_id;
  delete from transfers where id = p_transfer_id;
end;
$$;

grant execute on function create_transfer(uuid, uuid, numeric, date, text) to authenticated;
grant execute on function delete_transfer(uuid) to authenticated;
```

- [ ] **Step 2: Apply and manually verify atomicity**

Run:

```bash
cd pfm-app && npx supabase db push
```

In the Supabase SQL editor, as a smoke test (replace the UUIDs with two real account ids and
a real authenticated user context, or run via the app once Task 11 exists):

```sql
select create_transfer(
  '<account-a-id>'::uuid,
  '<account-b-id>'::uuid,
  100.00,
  current_date,
  'Test transfer'
);
```

Expected: returns a UUID, and `select * from transactions where transfer_id = '<returned-uuid>'`
shows exactly 2 rows (one negative on account A, one positive on account B).

- [ ] **Step 3: Commit**

```bash
cd pfm-app && git add supabase/ && git commit -m "feat(db): add create_transfer/delete_transfer atomic RPC functions"
```

---

## Task 6: Supabase Client Helpers, Database Types & Auth Middleware

**Files:**
- Create: `pfm-app/src/lib/supabase/client.ts`
- Create: `pfm-app/src/lib/supabase/server.ts`
- Create: `pfm-app/src/lib/supabase/middleware.ts`
- Create: `pfm-app/src/lib/supabase/types.ts`
- Create: `pfm-app/middleware.ts`

**Interfaces:**
- Produces: `createClient()` (browser, from `@/lib/supabase/client`), `createClient()` (server,
  async, from `@/lib/supabase/server`), both typed with `Database`. Every Server Action and
  Server Component from Task 7 onward imports one of these.

- [ ] **Step 1: Database types**

Write `pfm-app/src/lib/supabase/types.ts`:

```ts
export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          initial_balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          initial_balance?: number | string;
        };
        Update: {
          name?: string;
          type?: string;
          initial_balance?: number | string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "income" | "expense";
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "income" | "expense";
          parent_id?: string | null;
        };
        Update: {
          name?: string;
          type?: "income" | "expense";
          parent_id?: string | null;
        };
      };
      transfers: {
        Row: {
          id: string;
          user_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: number;
          date: string;
          description: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string | null;
          transfer_id: string | null;
          amount: number;
          date: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          category_id: string;
          amount: number | string;
          date: string;
          description: string;
        };
        Update: {
          account_id?: string;
          category_id?: string;
          amount?: number | string;
          date?: string;
          description?: string;
        };
      };
    };
    Views: {
      v_account_balances: {
        Row: {
          account_id: string;
          user_id: string;
          name: string;
          type: string;
          initial_balance: number;
          balance: number;
        };
      };
      v_category_monthly_summary: {
        Row: {
          user_id: string;
          category_root_id: string;
          category_name: string;
          type: "income" | "expense";
          year: number;
          month: number;
          total: number;
        };
      };
      v_monthly_totals: {
        Row: {
          user_id: string;
          year: number;
          month: number;
          total_income: number;
          total_expense: number;
          net: number;
        };
      };
    };
    Functions: {
      create_transfer: {
        Args: {
          p_from_account_id: string;
          p_to_account_id: string;
          p_amount: number | string;
          p_date: string;
          p_description: string | null;
        };
        Returns: string;
      };
      delete_transfer: {
        Args: { p_transfer_id: string };
        Returns: undefined;
      };
    };
  };
};
```

- [ ] **Step 2: Browser and server Supabase clients**

Write `pfm-app/src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Write `pfm-app/src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context — cookies are read-only here.
            // Refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Session-refresh middleware helper**

Write `pfm-app/src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 4: Root middleware**

Write `pfm-app/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Environment variables**

Copy `pfm-app/.env.local.example` to `pfm-app/.env.local` and fill in the real Supabase project
URL and anon key from the Supabase dashboard (Project Settings → API).

- [ ] **Step 6: Verify typecheck**

Run:

```bash
cd pfm-app && npm run typecheck
```

Expected: passes with no errors (no auth pages exist to exercise the redirect yet — this just
confirms the middleware and clients compile).

- [ ] **Step 7: Commit**

```bash
cd pfm-app && git add -A && git commit -m "feat: add Supabase client/server helpers, database types, and auth middleware"
```

---

## Task 7: Domain Validators & Money Helpers (TDD)

**Files:**
- Create: `pfm-app/src/lib/money.ts`
- Create: `pfm-app/tests/unit/money.test.ts`
- Create: `pfm-app/src/domain/validators.ts`
- Create: `pfm-app/tests/unit/validators.test.ts`

**Interfaces:**
- Produces: `toDecimal(value): Decimal`, `sum(values): Decimal`, `formatMoney(amount, locale?):
  string` from `@/lib/money`. `AccountFormSchema`, `CategoryFormSchema`,
  `TransactionFormSchema`, `TransferFormSchema` (and their `Input`/`Values` types) from
  `@/domain/validators`, consumed by Server Actions in Tasks 9–11 and forms in Tasks 9–12.

- [ ] **Step 1: Write the failing money tests**

Write `pfm-app/tests/unit/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { formatMoney, sum, toDecimal } from "@/lib/money";

describe("money", () => {
  it("converts a number or string to a Decimal", () => {
    expect(toDecimal(1500.5).toString()).toBe("1500.5");
    expect(toDecimal("1500.50").toString()).toBe("1500.5");
  });

  it("sums a list of values with decimal precision", () => {
    const result = sum([0.1, 0.2, "0.3"]);
    expect(result.toString()).toBe("0.6");
  });

  it("sums an empty list to zero", () => {
    expect(sum([]).toString()).toBe("0");
  });

  it("formats a positive amount as EUR currency", () => {
    expect(formatMoney(1234.5)).toBe("1 234,50 €");
  });

  it("formats a negative amount as EUR currency", () => {
    expect(formatMoney(-50)).toBe("-50,00 €");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatMoney(new Decimal("10.006"))).toBe("10,01 €");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd pfm-app && npx vitest run tests/unit/money.test.ts`
Expected: FAIL — `Cannot find module '@/lib/money'`.

- [ ] **Step 3: Implement `src/lib/money.ts`**

Write `pfm-app/src/lib/money.ts`:

```ts
import Decimal from "decimal.js";

export function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function sum(values: Decimal.Value[]): Decimal {
  return values.reduce(
    (acc: Decimal, v) => acc.plus(v),
    new Decimal(0),
  );
}

export function formatMoney(
  amount: Decimal.Value,
  locale: string = "fr-FR",
): string {
  const rounded = toDecimal(amount).toDecimalPlaces(2).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd pfm-app && npx vitest run tests/unit/money.test.ts`
Expected: PASS, 6 tests.

Note: the exact French formatting of `Intl.NumberFormat("fr-FR", ...)` (e.g. whether the
thousands separator is a regular or narrow no-break space) depends on the Node.js ICU build. If
the assertions above fail only on whitespace characters, adjust the expected strings to match
the actual runtime output rather than changing the implementation.

- [ ] **Step 5: Write the failing validator tests**

Write `pfm-app/tests/unit/validators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AccountFormSchema,
  CategoryFormSchema,
  TransactionFormSchema,
  TransferFormSchema,
} from "@/domain/validators";

describe("AccountFormSchema", () => {
  it("accepts a valid account", () => {
    const result = AccountFormSchema.safeParse({
      name: "Compte courant",
      type: "courant",
      initial_balance: "1000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = AccountFormSchema.safeParse({
      name: "",
      type: "courant",
      initial_balance: "0",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes comma decimal separator to dot", () => {
    const result = AccountFormSchema.safeParse({
      name: "Livret A",
      type: "livret",
      initial_balance: "1500,75",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initial_balance).toBe("1500.75");
    }
  });
});

describe("CategoryFormSchema", () => {
  it("accepts a root category with no parent", () => {
    const result = CategoryFormSchema.safeParse({
      name: "Alimentation",
      type: "expense",
      parent_id: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parent_id).toBeNull();
    }
  });

  it("rejects an invalid type", () => {
    const result = CategoryFormSchema.safeParse({
      name: "Alimentation",
      type: "invalid",
      parent_id: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("TransactionFormSchema", () => {
  it("accepts a valid transaction", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-1111-111111111111",
      category_id: "22222222-2222-2222-2222-222222222222",
      amount: "42.50",
      date: "2026-07-13",
      description: "Courses",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a zero amount (e.g. a balance adjustment)", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-1111-111111111111",
      category_id: "22222222-2222-2222-2222-222222222222",
      amount: "0",
      date: "2026-07-13",
      description: "Régularisation",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-1111-111111111111",
      category_id: "22222222-2222-2222-2222-222222222222",
      amount: "-5",
      date: "2026-07-13",
      description: "Courses",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty description", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-1111-111111111111",
      category_id: "22222222-2222-2222-2222-222222222222",
      amount: "10",
      date: "2026-07-13",
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("TransferFormSchema", () => {
  const base = {
    from_account_id: "11111111-1111-1111-1111-111111111111",
    to_account_id: "22222222-2222-2222-2222-222222222222",
    amount: "100",
    date: "2026-07-13",
    description: "",
  };

  it("accepts a valid transfer", () => {
    expect(TransferFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects when source and destination accounts are the same", () => {
    const result = TransferFormSchema.safeParse({
      ...base,
      to_account_id: base.from_account_id,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    const result = TransferFormSchema.safeParse({ ...base, amount: "0" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd pfm-app && npx vitest run tests/unit/validators.test.ts`
Expected: FAIL — `Cannot find module '@/domain/validators'`.

- [ ] **Step 7: Implement `src/domain/validators.ts`**

Write `pfm-app/src/domain/validators.ts`:

```ts
import { z } from "zod";

// Shared primitives ----------------------------------------------------------

const emptyToNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+([.,]\d+)?$/, "Montant invalide")
  .transform((v) => v.replace(",", "."));

// Account ----------------------------------------------------------------

export const AccountTypeSchema = z.enum([
  "courant",
  "livret",
  "epargne",
  "autre",
]);
export type AccountTypeInput = z.infer<typeof AccountTypeSchema>;

export const ACCOUNT_TYPE_LABELS: Record<AccountTypeInput, string> = {
  courant: "Compte courant",
  livret: "Livret",
  epargne: "Épargne",
  autre: "Autre",
};

export const AccountFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(80),
  type: AccountTypeSchema,
  initial_balance: decimalString,
});
export type AccountFormInput = z.input<typeof AccountFormSchema>;
export type AccountFormValues = z.output<typeof AccountFormSchema>;

// Category ----------------------------------------------------------------

export const CategoryTypeSchema = z.enum(["income", "expense"]);
export type CategoryTypeInput = z.infer<typeof CategoryTypeSchema>;

export const CATEGORY_TYPE_LABELS: Record<CategoryTypeInput, string> = {
  income: "Entrée",
  expense: "Sortie",
};

export const CategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(80),
  type: CategoryTypeSchema,
  parent_id: emptyToNull,
});
export type CategoryFormInput = z.input<typeof CategoryFormSchema>;
export type CategoryFormValues = z.output<typeof CategoryFormSchema>;

// Transaction ----------------------------------------------------------------
// The amount entered here is always zero or positive (zero is allowed, e.g.
// for a balance adjustment/régularisation): the sign (credit/debit) is
// derived server-side from the selected category's type (income → positive,
// expense → negative) so the user never has to think about signs.

export const TransactionFormSchema = z.object({
  account_id: z.string().uuid("Compte requis"),
  category_id: z.string().uuid("Catégorie requise"),
  amount: decimalString.refine(
    (v) => parseFloat(v) >= 0,
    "Le montant ne peut pas être négatif",
  ),
  date: z.string().date("Date requise"),
  description: z
    .string()
    .trim()
    .min(1, "La description est requise")
    .max(200),
});
export type TransactionFormInput = z.input<typeof TransactionFormSchema>;
export type TransactionFormValues = z.output<typeof TransactionFormSchema>;

// Transfer ----------------------------------------------------------------

export const TransferFormSchema = z
  .object({
    from_account_id: z.string().uuid("Compte source requis"),
    to_account_id: z.string().uuid("Compte destination requis"),
    amount: decimalString.refine(
      (v) => parseFloat(v) > 0,
      "Le montant doit être positif",
    ),
    date: z.string().date("Date requise"),
    description: emptyToNull,
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: "Les comptes source et destination doivent être différents",
    path: ["to_account_id"],
  });
export type TransferFormInput = z.input<typeof TransferFormSchema>;
export type TransferFormValues = z.output<typeof TransferFormSchema>;
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd pfm-app && npx vitest run tests/unit/validators.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 9: Run the full suite and commit**

```bash
cd pfm-app && npm run test && npm run typecheck
git add -A && git commit -m "feat: add money helpers and domain validators with tests"
```

---

## Task 8: Auth — Login, Logout, Route Guard

**Files:**
- Create: `pfm-app/src/actions/auth.ts`
- Create: `pfm-app/src/app/login/page.tsx`
- Create: `pfm-app/src/components/layout/app-shell.tsx`
- Create: `pfm-app/src/components/layout/nav-links.tsx`
- Create: `pfm-app/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` and `@/lib/supabase/client` (Task 6).
- Produces: `loginAction(formData): Promise<{ error: string } | never>` (redirects on success),
  `logoutAction(): Promise<never>` from `@/actions/auth`, an `AppShell` component wrapping every
  page under `(app)/`, consumed by Tasks 9–12's pages.

- [ ] **Step 1: Auth Server Actions**

Write `pfm-app/src/actions/auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Identifiants invalides" };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Login page**

Write `pfm-app/src/app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Mes Finances</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state?.error && (
              <p className="text-sm text-red-600" role="alert">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Nav links and app shell**

Write `pfm-app/src/components/layout/nav-links.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/accounts", label: "Comptes" },
  { href: "/transactions", label: "Transactions" },
  { href: "/transfers", label: "Transferts" },
  { href: "/categories", label: "Catégories" },
];

export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-1", className)}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith(link.href)
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
```

Write `pfm-app/src/components/layout/app-shell.tsx`:

```tsx
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-semibold">Mes Finances</span>
        <div className="flex items-center gap-4">
          <NavLinks className="hidden md:flex" />
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>
      <NavLinks className="flex overflow-x-auto border-b border-zinc-200 px-2 py-1 md:hidden dark:border-zinc-800" />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Protected layout**

Write `pfm-app/src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
```

This is a second layer of protection in addition to the `middleware.ts` redirect from Task 6 —
defense in depth in case middleware matcher config ever misses a route.

- [ ] **Step 5: Manually verify the auth flow**

In the Supabase dashboard (Authentication → Users), create the single user account manually
with an email/password.

Run:

```bash
cd pfm-app && npm run dev
```

Visit `http://localhost:3000` — expected: redirected to `/login` (no pages exist under `(app)/`
yet, but this confirms the middleware redirect fires). Log in with the created credentials —
expected: redirected toward `/dashboard` (a 404 is expected there until Task 12 adds the page,
but the redirect chain and session cookie should work). Confirm no infinite redirect loop.

- [ ] **Step 6: Typecheck, lint, and commit**

```bash
cd pfm-app && npm run typecheck && npm run lint
git add -A && git commit -m "feat: add login page, logout action, and protected app layout"
```

---

## Task 9: Accounts (Server Actions + UI)

**Files:**
- Create: `pfm-app/src/actions/accounts.ts`
- Create: `pfm-app/tests/unit/accounts-actions.test.ts`
- Create: `pfm-app/src/components/accounts/account-form.tsx`
- Create: `pfm-app/src/components/accounts/account-list.tsx`
- Create: `pfm-app/src/app/(app)/accounts/page.tsx`

**Interfaces:**
- Consumes: `AccountFormSchema`, `ACCOUNT_TYPE_LABELS` (Task 7), `createClient()` server
  (Task 6), `v_account_balances` view (Task 4).
- Produces: `createAccount(input: AccountFormInput): Promise<{ error?: string }>`,
  `updateAccount(id: string, input: AccountFormInput): Promise<{ error?: string }>`,
  `deleteAccount(id: string): Promise<{ error?: string }>` from `@/actions/accounts`, used by
  Task 10 (transaction form's account picker) and Task 12 (dashboard).

- [ ] **Step 1: Write the failing action tests**

Write `pfm-app/tests/unit/accounts-actions.test.ts`. This mocks the Supabase server client so
the test runs without a live database, and asserts the delete guard behavior:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { deleteAccount } from "@/actions/accounts";

describe("deleteAccount", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to delete an account with existing transactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [{ id: "t1" }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteAccount("acc-1");

    expect(result.error).toMatch(/transactions/i);
  });

  it("deletes an account with no transactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "accounts") {
        return {
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteAccount("acc-1");

    expect(result.error).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd pfm-app && npx vitest run tests/unit/accounts-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/accounts'`.

- [ ] **Step 3: Implement `src/actions/accounts.ts`**

Write `pfm-app/src/actions/accounts.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  AccountFormSchema,
  type AccountFormInput,
} from "@/domain/validators";

export async function createAccount(
  input: AccountFormInput,
): Promise<{ error?: string }> {
  const parsed = AccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    initial_balance: parsed.data.initial_balance,
  });

  if (error) return { error: "Échec de la création du compte" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function updateAccount(
  id: string,
  input: AccountFormInput,
): Promise<{ error?: string }> {
  const parsed = AccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      initial_balance: parsed.data.initial_balance,
    })
    .eq("id", id);

  if (error) return { error: "Échec de la mise à jour du compte" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteAccount(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: linked, error: linkedError } = await supabase
    .from("transactions")
    .select("id")
    .eq("account_id", id)
    .limit(1);

  if (linkedError) return { error: "Échec de la vérification du compte" };
  if (linked && linked.length > 0) {
    return {
      error:
        "Impossible de supprimer ce compte : des transactions y sont rattachées",
    };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: "Échec de la suppression du compte" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd pfm-app && npx vitest run tests/unit/accounts-actions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Account form component**

Write `pfm-app/src/components/accounts/account-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  ACCOUNT_TYPE_LABELS,
  AccountFormSchema,
  type AccountFormInput,
} from "@/domain/validators";
import { createAccount, updateAccount } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountFormProps = {
  account?: { id: string; name: string; type: string; initial_balance: number };
  onSuccess?: () => void;
};

export function AccountForm({ account, onSuccess }: AccountFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormInput>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type as AccountFormInput["type"],
          initial_balance: String(account.initial_balance),
        }
      : { name: "", type: "courant", initial_balance: "0" },
  });

  async function onSubmit(values: AccountFormInput) {
    setSubmitting(true);
    const result = account
      ? await updateAccount(account.id, values)
      : await createAccount(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(account ? "Compte mis à jour" : "Compte créé");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={watch("type")}
          onValueChange={(v) =>
            setValue("type", v as AccountFormInput["type"])
          }
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="initial_balance">Solde initial</Label>
        <Input id="initial_balance" {...register("initial_balance")} />
        {errors.initial_balance && (
          <p className="text-sm text-red-600">
            {errors.initial_balance.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Account list + page**

Write `pfm-app/src/components/accounts/account-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ACCOUNT_TYPE_LABELS } from "@/domain/validators";
import { formatMoney } from "@/lib/money";
import { deleteAccount } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountForm } from "./account-form";

type AccountRow = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  balance: number;
};

export function AccountList({
  accounts,
  onChanged,
}: {
  accounts: AccountRow[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AccountRow | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce compte ?")) return;
    const result = await deleteAccount(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Compte supprimé");
    onChanged();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <Card key={account.account_id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{account.name}</span>
              <span className="text-xs font-normal text-zinc-500">
                {ACCOUNT_TYPE_LABELS[
                  account.type as keyof typeof ACCOUNT_TYPE_LABELS
                ] ?? account.type}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {formatMoney(account.balance)}
            </span>
            <div className="flex gap-2">
              <Dialog
                open={editing?.account_id === account.account_id}
                onOpenChange={(open) => setEditing(open ? account : null)}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Modifier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier le compte</DialogTitle>
                  </DialogHeader>
                  <AccountForm
                    account={{
                      id: account.account_id,
                      name: account.name,
                      type: account.type,
                      initial_balance: account.initial_balance,
                    }}
                    onSuccess={() => {
                      setEditing(null);
                      onChanged();
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(account.account_id)}
              >
                Supprimer
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

Write `pfm-app/src/app/(app)/accounts/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/accounts/account-form";
import { AccountList } from "@/components/accounts/account-list";

type AccountRow = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  balance: number;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_account_balances")
      .select("*")
      .order("name");
    setAccounts(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Comptes</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>Nouveau compte</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau compte</DialogTitle>
            </DialogHeader>
            <AccountForm
              onSuccess={() => {
                setCreating(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <AccountList accounts={accounts} onChanged={load} />
    </div>
  );
}
```

- [ ] **Step 7: Manually verify**

Run `cd pfm-app && npm run dev`, log in, go to `/accounts`. Create a "Compte courant" account
with an initial balance of 500. Expected: it appears in the list showing "500,00 €". Edit it to
rename it — expected: the name updates. Delete it — expected: it disappears (no transactions
exist yet, so the delete succeeds).

- [ ] **Step 8: Typecheck, lint, full test suite, commit**

```bash
cd pfm-app && npm run typecheck && npm run lint && npm run test
git add -A && git commit -m "feat: add account CRUD (server actions + UI)"
```

---

## Task 10: Categories (Server Actions + UI)

**Files:**
- Create: `pfm-app/src/actions/categories.ts`
- Create: `pfm-app/tests/unit/categories-actions.test.ts`
- Create: `pfm-app/src/components/categories/category-form.tsx`
- Create: `pfm-app/src/components/categories/category-tree.tsx`
- Create: `pfm-app/src/app/(app)/categories/page.tsx`

**Interfaces:**
- Consumes: `CategoryFormSchema`, `CATEGORY_TYPE_LABELS` (Task 7), `createClient()` server
  (Task 6).
- Produces: `createCategory`, `updateCategory`, `deleteCategory` from `@/actions/categories`
  (same `{ error?: string }` shape as accounts), a category picker pattern reused by Task 11's
  transaction form.

- [ ] **Step 1: Write the failing action tests**

Write `pfm-app/tests/unit/categories-actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { deleteCategory } from "@/actions/categories";

describe("deleteCategory", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to delete a category with transactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({ data: [{ id: "t1" }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteCategory("cat-1");
    expect(result.error).toMatch(/transactions/i);
  });

  it("refuses to delete a category with sub-categories", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({ data: [{ id: "sub-1" }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteCategory("cat-1");
    expect(result.error).toMatch(/sous-catégories/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd pfm-app && npx vitest run tests/unit/categories-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/categories'`.

- [ ] **Step 3: Implement `src/actions/categories.ts`**

Write `pfm-app/src/actions/categories.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CategoryFormSchema,
  type CategoryFormInput,
} from "@/domain/validators";

export async function createCategory(
  input: CategoryFormInput,
): Promise<{ error?: string }> {
  const parsed = CategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    parent_id: parsed.data.parent_id,
  });

  if (error) return { error: "Échec de la création de la catégorie" };

  revalidatePath("/categories");
  return {};
}

export async function updateCategory(
  id: string,
  input: CategoryFormInput,
): Promise<{ error?: string }> {
  const parsed = CategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      parent_id: parsed.data.parent_id,
    })
    .eq("id", id);

  if (error) return { error: "Échec de la mise à jour de la catégorie" };

  revalidatePath("/categories");
  return {};
}

export async function deleteCategory(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: linkedTx, error: txError } = await supabase
    .from("transactions")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (txError) return { error: "Échec de la vérification de la catégorie" };
  if (linkedTx && linkedTx.length > 0) {
    return {
      error:
        "Impossible de supprimer cette catégorie : des transactions y sont rattachées",
    };
  }

  const { data: children, error: childError } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", id)
    .limit(1);

  if (childError) return { error: "Échec de la vérification de la catégorie" };
  if (children && children.length > 0) {
    return {
      error:
        "Impossible de supprimer cette catégorie : elle a des sous-catégories",
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: "Échec de la suppression de la catégorie" };

  revalidatePath("/categories");
  return {};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd pfm-app && npx vitest run tests/unit/categories-actions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Category form component**

Write `pfm-app/src/components/categories/category-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  CATEGORY_TYPE_LABELS,
  CategoryFormSchema,
  type CategoryFormInput,
} from "@/domain/validators";
import { createCategory, updateCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoryOption = { id: string; name: string; type: string };

type CategoryFormProps = {
  rootCategories: CategoryOption[];
  category?: { id: string; name: string; type: string; parent_id: string | null };
  onSuccess?: () => void;
};

export function CategoryForm({
  rootCategories,
  category,
  onSuccess,
}: CategoryFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: category
      ? {
          name: category.name,
          type: category.type as CategoryFormInput["type"],
          parent_id: category.parent_id ?? "",
        }
      : { name: "", type: "expense", parent_id: "" },
  });

  const selectedType = watch("type");
  const selectedParent = watch("parent_id");

  async function onSubmit(values: CategoryFormInput) {
    setSubmitting(true);
    const result = category
      ? await updateCategory(category.id, values)
      : await createCategory(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(category ? "Catégorie mise à jour" : "Catégorie créée");
    onSuccess?.();
  }

  const eligibleParents = rootCategories.filter(
    (c) => c.type === selectedType && c.id !== category?.id,
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={selectedType}
          onValueChange={(v) =>
            setValue("type", v as CategoryFormInput["type"])
          }
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="parent_id">Catégorie parente (optionnel)</Label>
        <Select
          value={selectedParent || "none"}
          onValueChange={(v) => setValue("parent_id", v === "none" ? "" : v)}
        >
          <SelectTrigger id="parent_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucune (catégorie racine)</SelectItem>
            {eligibleParents.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Category tree + page**

Write `pfm-app/src/components/categories/category-tree.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CATEGORY_TYPE_LABELS } from "@/domain/validators";
import { deleteCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";

type CategoryRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

export function CategoryTree({
  categories,
  onChanged,
}: {
  categories: CategoryRow[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const roots = categories.filter((c) => c.parent_id === null);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const result = await deleteCategory(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Catégorie supprimée");
    onChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      {(["income", "expense"] as const).map((type) => (
        <div key={type} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-500">
            {CATEGORY_TYPE_LABELS[type]}
          </h2>
          {roots
            .filter((r) => r.type === type)
            .map((root) => (
              <div key={root.id} className="flex flex-col gap-1">
                <CategoryRowItem
                  category={root}
                  onEdit={() => setEditing(root)}
                  onDelete={() => handleDelete(root.id)}
                />
                {categories
                  .filter((c) => c.parent_id === root.id)
                  .map((child) => (
                    <div key={child.id} className="ml-6">
                      <CategoryRowItem
                        category={child}
                        onEdit={() => setEditing(child)}
                        onDelete={() => handleDelete(child.id)}
                      />
                    </div>
                  ))}
              </div>
            ))}
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
              rootCategories={roots}
              category={editing}
              onSuccess={() => {
                setEditing(null);
                onChanged();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryRowItem({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <span>{category.name}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Modifier
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          Supprimer
        </Button>
      </div>
    </div>
  );
}
```

Write `pfm-app/src/app/(app)/categories/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryForm } from "@/components/categories/category-form";
import { CategoryTree } from "@/components/categories/category-tree";

type CategoryRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("id, name, type, parent_id")
      .order("name");
    setCategories(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catégories</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>Nouvelle catégorie</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle catégorie</DialogTitle>
            </DialogHeader>
            <CategoryForm
              rootCategories={categories.filter((c) => c.parent_id === null)}
              onSuccess={() => {
                setCreating(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <CategoryTree categories={categories} onChanged={load} />
    </div>
  );
}
```

- [ ] **Step 7: Manually verify**

`npm run dev`, go to `/categories`. Create a root expense category "Alimentation", then a
sub-category "Restaurant" with parent "Alimentation". Expected: the tree shows "Restaurant"
indented under "Alimentation". Try deleting "Alimentation" — expected: blocked with a "elle a
des sous-catégories" error toast.

- [ ] **Step 8: Typecheck, lint, full test suite, commit**

```bash
cd pfm-app && npm run typecheck && npm run lint && npm run test
git add -A && git commit -m "feat: add category CRUD with parent/child tree (server actions + UI)"
```

---

## Task 11: Transactions (Server Actions + UI)

**Files:**
- Create: `pfm-app/src/actions/transactions.ts`
- Create: `pfm-app/tests/unit/transactions-actions.test.ts`
- Create: `pfm-app/src/components/transactions/transaction-form.tsx`
- Create: `pfm-app/src/components/transactions/transaction-list.tsx`
- Create: `pfm-app/src/app/(app)/transactions/page.tsx`

**Interfaces:**
- Consumes: `TransactionFormSchema` (Task 7), `createClient()` server/client (Task 6), account
  list (Task 9 pattern), category list (Task 10 pattern).
- Produces: `createTransaction`, `updateTransaction`, `deleteTransaction` from
  `@/actions/transactions` — `deleteTransaction`/`updateTransaction` reject transfer-linked
  rows, consumed nowhere else in Phase 1 but exercised directly by this task's UI.

- [ ] **Step 1: Write the failing action tests**

Write `pfm-app/tests/unit/transactions-actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { deleteTransaction, updateTransaction } from "@/actions/transactions";

describe("deleteTransaction", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to delete a transaction linked to a transfer", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { transfer_id: "tr-1" },
                  error: null,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteTransaction("tx-1");
    expect(result.error).toMatch(/transfert/i);
  });

  it("deletes a regular transaction", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: { transfer_id: null }, error: null }),
            }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteTransaction("tx-1");
    expect(result.error).toBeUndefined();
  });
});

describe("updateTransaction", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to update a transaction linked to a transfer", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { transfer_id: "tr-1" },
                  error: null,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateTransaction("tx-1", {
      account_id: "11111111-1111-1111-1111-111111111111",
      category_id: "22222222-2222-2222-2222-222222222222",
      amount: "10",
      date: "2026-07-13",
      description: "Test",
    });
    expect(result.error).toMatch(/transfert/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd pfm-app && npx vitest run tests/unit/transactions-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/transactions'`.

- [ ] **Step 3: Implement `src/actions/transactions.ts`**

The sign of `amount` is derived from the category's type: `expense` categories store a negative
amount, `income` categories store a positive amount. The form always collects a non-negative
number (enforced by `TransactionFormSchema`, zero allowed for adjustments).

Write `pfm-app/src/actions/transactions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TransactionFormSchema,
  type TransactionFormInput,
} from "@/domain/validators";
import { toDecimal } from "@/lib/money";

async function signedAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  amount: string,
): Promise<{ amount?: string; error?: string }> {
  const { data: category, error } = await supabase
    .from("categories")
    .select("type")
    .eq("id", categoryId)
    .single();

  if (error || !category) return { error: "Catégorie introuvable" };

  const magnitude = toDecimal(amount).abs();
  const signed =
    category.type === "expense" ? magnitude.negated() : magnitude;
  return { amount: signed.toString() };
}

export async function createTransaction(
  input: TransactionFormInput,
): Promise<{ error?: string }> {
  const parsed = TransactionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const signed = await signedAmount(
    supabase,
    parsed.data.category_id,
    parsed.data.amount,
  );
  if (signed.error || !signed.amount) {
    return { error: signed.error ?? "Échec du calcul du montant" };
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: parsed.data.account_id,
    category_id: parsed.data.category_id,
    amount: signed.amount,
    date: parsed.data.date,
    description: parsed.data.description,
  });

  if (error) return { error: "Échec de la création de la transaction" };

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function updateTransaction(
  id: string,
  input: TransactionFormInput,
): Promise<{ error?: string }> {
  const parsed = TransactionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("transfer_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) return { error: "Transaction introuvable" };
  if (existing.transfer_id) {
    return {
      error:
        "Cette transaction fait partie d'un transfert : modifiez le transfert directement",
    };
  }

  const signed = await signedAmount(
    supabase,
    parsed.data.category_id,
    parsed.data.amount,
  );
  if (signed.error || !signed.amount) {
    return { error: signed.error ?? "Échec du calcul du montant" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: parsed.data.account_id,
      category_id: parsed.data.category_id,
      amount: signed.amount,
      date: parsed.data.date,
      description: parsed.data.description,
    })
    .eq("id", id);

  if (error) return { error: "Échec de la mise à jour de la transaction" };

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteTransaction(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("transfer_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) return { error: "Transaction introuvable" };
  if (existing.transfer_id) {
    return {
      error:
        "Cette transaction fait partie d'un transfert : supprimez le transfert directement",
    };
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: "Échec de la suppression de la transaction" };

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd pfm-app && npx vitest run tests/unit/transactions-actions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Transaction form component**

Write `pfm-app/src/components/transactions/transaction-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  TransactionFormSchema,
  type TransactionFormInput,
} from "@/domain/validators";
import {
  createTransaction,
  updateTransaction,
} from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };

type TransactionFormProps = {
  accounts: Option[];
  categories: Option[];
  transaction?: {
    id: string;
    account_id: string;
    category_id: string;
    amount: number;
    date: string;
    description: string;
  };
  onSuccess?: () => void;
};

export function TransactionForm({
  accounts,
  categories,
  transaction,
  onSuccess,
}: TransactionFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormInput>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: transaction
      ? {
          account_id: transaction.account_id,
          category_id: transaction.category_id,
          amount: String(Math.abs(transaction.amount)),
          date: transaction.date,
          description: transaction.description,
        }
      : {
          account_id: accounts[0]?.id ?? "",
          category_id: categories[0]?.id ?? "",
          amount: "",
          date: new Date().toISOString().slice(0, 10),
          description: "",
        },
  });

  async function onSubmit(values: TransactionFormInput) {
    setSubmitting(true);
    const result = transaction
      ? await updateTransaction(transaction.id, values)
      : await createTransaction(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(transaction ? "Transaction mise à jour" : "Transaction créée");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="account_id">Compte</Label>
        <Select
          value={watch("account_id")}
          onValueChange={(v) => setValue("account_id", v)}
        >
          <SelectTrigger id="account_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="category_id">Catégorie</Label>
        <Select
          value={watch("category_id")}
          onValueChange={(v) => setValue("category_id", v)}
        >
          <SelectTrigger id="category_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Montant</Label>
        <Input id="amount" {...register("amount")} />
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && (
          <p className="text-sm text-red-600">{errors.date.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Transaction list + page**

Write `pfm-app/src/components/transactions/transaction-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { deleteTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";

type TransactionRow = {
  id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  transfer_id: string | null;
  amount: number;
  date: string;
  description: string;
};

type Option = { id: string; name: string };

export function TransactionList({
  transactions,
  accounts,
  categories,
  onChanged,
}: {
  transactions: TransactionRow[];
  accounts: Option[];
  categories: Option[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  async function handleDelete(row: TransactionRow) {
    if (row.transfer_id) {
      toast.error(
        "Cette transaction fait partie d'un transfert : supprimez le transfert dans l'onglet Transferts",
      );
      return;
    }
    if (!confirm("Supprimer cette transaction ?")) return;
    const result = await deleteTransaction(row.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaction supprimée");
    onChanged();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{tx.date}</TableCell>
              <TableCell>{tx.description}</TableCell>
              <TableCell>{tx.account_name}</TableCell>
              <TableCell>{tx.category_name ?? "Transfert"}</TableCell>
              <TableCell
                className={`text-right ${tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {formatMoney(tx.amount)}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!tx.transfer_id}
                  onClick={() => setEditing(tx)}
                >
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(tx)}
                >
                  Supprimer
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
          </DialogHeader>
          {editing && (
            <TransactionForm
              accounts={accounts}
              categories={categories}
              transaction={{
                id: editing.id,
                account_id: editing.account_id,
                category_id: editing.category_id ?? "",
                amount: editing.amount,
                date: editing.date,
                description: editing.description,
              }}
              onSuccess={() => {
                setEditing(null);
                onChanged();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Write `pfm-app/src/app/(app)/transactions/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";

type Option = { id: string; name: string };

type TransactionRow = {
  id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  transfer_id: string | null;
  amount: number;
  date: string;
  description: string;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: accountRows }, { data: categoryRows }, { data: txRows }] =
      await Promise.all([
        supabase.from("accounts").select("id, name").order("name"),
        supabase.from("categories").select("id, name").order("name"),
        supabase
          .from("transactions")
          .select(
            "id, account_id, category_id, transfer_id, amount, date, description, accounts(name), categories(name)",
          )
          .order("date", { ascending: false }),
      ]);

    setAccounts(accountRows ?? []);
    setCategories(categoryRows ?? []);
    setTransactions(
      (txRows ?? []).map((row) => {
        const r = row as unknown as {
          id: string;
          account_id: string;
          category_id: string | null;
          transfer_id: string | null;
          amount: number;
          date: string;
          description: string;
          accounts: { name: string } | null;
          categories: { name: string } | null;
        };
        return {
          id: r.id,
          account_id: r.account_id,
          account_name: r.accounts?.name ?? "",
          category_id: r.category_id,
          category_name: r.categories?.name ?? null,
          transfer_id: r.transfer_id,
          amount: r.amount,
          date: r.date,
          description: r.description,
        };
      }),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button disabled={accounts.length === 0 || categories.length === 0}>
              Nouvelle transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
            </DialogHeader>
            <TransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={() => {
                setCreating(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <TransactionList
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        onChanged={load}
      />
    </div>
  );
}
```

- [ ] **Step 7: Manually verify**

`npm run dev`, go to `/transactions`. Create an expense transaction of 25 on "Restaurant" —
expected: it appears with a red, negative amount (-25,00 €) even though you typed a positive
number. Go to `/accounts` — expected: the account balance decreased by 25. Edit the transaction
to change the amount to 30 — expected: balance updates accordingly. Delete it — expected:
balance reverts.

- [ ] **Step 8: Typecheck, lint, full test suite, commit**

```bash
cd pfm-app && npm run typecheck && npm run lint && npm run test
git add -A && git commit -m "feat: add transaction CRUD with sign-by-category (server actions + UI)"
```

---

## Task 12: Transfers (Server Actions + UI)

**Files:**
- Create: `pfm-app/src/actions/transfers.ts`
- Create: `pfm-app/tests/unit/transfers-actions.test.ts`
- Create: `pfm-app/src/components/transfers/transfer-form.tsx`
- Create: `pfm-app/src/components/transfers/transfer-list.tsx`
- Create: `pfm-app/src/app/(app)/transfers/page.tsx`

**Interfaces:**
- Consumes: `TransferFormSchema` (Task 7), `createClient()` server (Task 6), `create_transfer`/
  `delete_transfer` RPC functions (Task 5), account list (Task 9 pattern).
- Produces: `createTransfer`, `deleteTransfer` from `@/actions/transfers`, exercised only by
  this task's UI in Phase 1.

- [ ] **Step 1: Write the failing action tests**

Write `pfm-app/tests/unit/transfers-actions.test.ts`. This asserts the Server Action validates
input with zod *before* calling the RPC (so a same-account transfer never reaches the
database), and that it forwards well-formed input to `supabase.rpc("create_transfer", ...)`
with the right argument names:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

import { createTransfer, deleteTransfer } from "@/actions/transfers";

describe("createTransfer", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects same-account transfers without calling the database", async () => {
    const result = await createTransfer({
      from_account_id: "11111111-1111-1111-1111-111111111111",
      to_account_id: "11111111-1111-1111-1111-111111111111",
      amount: "100",
      date: "2026-07-13",
      description: "",
    });

    expect(result.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls create_transfer with the parsed arguments", async () => {
    mockRpc.mockResolvedValue({ data: "new-transfer-id", error: null });

    const result = await createTransfer({
      from_account_id: "11111111-1111-1111-1111-111111111111",
      to_account_id: "22222222-2222-2222-2222-222222222222",
      amount: "150,50",
      date: "2026-07-13",
      description: "Épargne mensuelle",
    });

    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("create_transfer", {
      p_from_account_id: "11111111-1111-1111-1111-111111111111",
      p_to_account_id: "22222222-2222-2222-2222-222222222222",
      p_amount: "150.50",
      p_date: "2026-07-13",
      p_description: "Épargne mensuelle",
    });
  });
});

describe("deleteTransfer", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls delete_transfer with the transfer id", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await deleteTransfer("transfer-1");

    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("delete_transfer", {
      p_transfer_id: "transfer-1",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd pfm-app && npx vitest run tests/unit/transfers-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/transfers'`.

- [ ] **Step 3: Implement `src/actions/transfers.ts`**

Write `pfm-app/src/actions/transfers.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TransferFormSchema,
  type TransferFormInput,
} from "@/domain/validators";

export async function createTransfer(
  input: TransferFormInput,
): Promise<{ error?: string }> {
  const parsed = TransferFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_transfer", {
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: parsed.data.description,
  });

  if (error) return { error: "Échec de la création du transfert" };

  revalidatePath("/transfers");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteTransfer(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_transfer", {
    p_transfer_id: id,
  });

  if (error) return { error: "Échec de la suppression du transfert" };

  revalidatePath("/transfers");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd pfm-app && npx vitest run tests/unit/transfers-actions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Transfer form component**

Write `pfm-app/src/components/transfers/transfer-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  TransferFormSchema,
  type TransferFormInput,
} from "@/domain/validators";
import { createTransfer } from "@/actions/transfers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };

export function TransferForm({
  accounts,
  onSuccess,
}: {
  accounts: Option[];
  onSuccess?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferFormInput>({
    resolver: zodResolver(TransferFormSchema),
    defaultValues: {
      from_account_id: accounts[0]?.id ?? "",
      to_account_id: accounts[1]?.id ?? "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
    },
  });

  async function onSubmit(values: TransferFormInput) {
    setSubmitting(true);
    const result = await createTransfer(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Transfert effectué");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="from_account_id">Compte source</Label>
        <Select
          value={watch("from_account_id")}
          onValueChange={(v) => setValue("from_account_id", v)}
        >
          <SelectTrigger id="from_account_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="to_account_id">Compte destination</Label>
        <Select
          value={watch("to_account_id")}
          onValueChange={(v) => setValue("to_account_id", v)}
        >
          <SelectTrigger id="to_account_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.to_account_id && (
          <p className="text-sm text-red-600">
            {errors.to_account_id.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Montant</Label>
        <Input id="amount" {...register("amount")} />
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Input id="description" {...register("description")} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Transfert en cours..." : "Transférer"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Transfer list + page**

Write `pfm-app/src/components/transfers/transfer-list.tsx`:

```tsx
"use client";

import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { deleteTransfer } from "@/actions/transfers";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TransferRow = {
  id: string;
  from_account_name: string;
  to_account_name: string;
  amount: number;
  date: string;
  description: string | null;
};

export function TransferList({
  transfers,
  onChanged,
}: {
  transfers: TransferRow[];
  onChanged: () => void;
}) {
  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce transfert ?")) return;
    const result = await deleteTransfer(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Transfert supprimé");
    onChanged();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>De</TableHead>
          <TableHead>Vers</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfers.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.date}</TableCell>
            <TableCell>{t.from_account_name}</TableCell>
            <TableCell>{t.to_account_name}</TableCell>
            <TableCell>{t.description ?? ""}</TableCell>
            <TableCell className="text-right">
              {formatMoney(t.amount)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(t.id)}
              >
                Supprimer
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Write `pfm-app/src/app/(app)/transfers/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransferForm } from "@/components/transfers/transfer-form";
import { TransferList } from "@/components/transfers/transfer-list";

type Option = { id: string; name: string };

type TransferRow = {
  id: string;
  from_account_name: string;
  to_account_name: string;
  amount: number;
  date: string;
  description: string | null;
};

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: accountRows }, { data: transferRows }] = await Promise.all([
      supabase.from("accounts").select("id, name").order("name"),
      supabase
        .from("transfers")
        .select(
          "id, amount, date, description, from_account:accounts!transfers_from_account_id_fkey(name), to_account:accounts!transfers_to_account_id_fkey(name)",
        )
        .order("date", { ascending: false }),
    ]);

    setAccounts(accountRows ?? []);
    setTransfers(
      (transferRows ?? []).map((row) => {
        const r = row as unknown as {
          id: string;
          amount: number;
          date: string;
          description: string | null;
          from_account: { name: string } | null;
          to_account: { name: string } | null;
        };
        return {
          id: r.id,
          amount: r.amount,
          date: r.date,
          description: r.description,
          from_account_name: r.from_account?.name ?? "",
          to_account_name: r.to_account?.name ?? "",
        };
      }),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transferts</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button disabled={accounts.length < 2}>Nouveau transfert</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau transfert</DialogTitle>
            </DialogHeader>
            <TransferForm
              accounts={accounts}
              onSuccess={() => {
                setCreating(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <TransferList transfers={transfers} onChanged={load} />
    </div>
  );
}
```

Note: the `accounts!transfers_from_account_id_fkey` / `..._to_account_id_fkey` embed hints
assume PostgREST auto-names foreign key constraints as `<table>_<column>_fkey` (Postgres's
default naming when a constraint name isn't given explicitly in the `references` clause of
Task 3's migration). If `npx supabase db push` reports different constraint names, adjust these
two strings to match — check via
`select conname from pg_constraint where conrelid = 'transfers'::regclass;` in the SQL editor.

- [ ] **Step 7: Manually verify end-to-end atomicity**

`npm run dev`, ensure at least 2 accounts exist, go to `/transfers`, create a transfer of 200
from account A to account B. Expected: it appears in the transfer list; `/accounts` shows A's
balance down by 200 and B's up by 200; `/transactions` shows two rows tagged "Transfert" that
have no working "Modifier" button. Delete the transfer — expected: both balances revert and both
transaction rows disappear from `/transactions`.

- [ ] **Step 8: Typecheck, lint, full test suite, commit**

```bash
cd pfm-app && npm run typecheck && npm run lint && npm run test
git add -A && git commit -m "feat: add inter-account transfers (server actions + UI)"
```

---

## Task 13: Dashboard

**Files:**
- Create: `pfm-app/src/components/dashboard/month-nav.tsx`
- Create: `pfm-app/src/components/dashboard/kpi-cards.tsx`
- Create: `pfm-app/src/components/dashboard/category-chart.tsx`
- Create: `pfm-app/src/components/dashboard/recent-transactions.tsx`
- Create: `pfm-app/src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `v_monthly_totals`, `v_category_monthly_summary` views (Task 4), `formatMoney`
  (Task 7), `createClient()` client (Task 6).
- Produces: the `/dashboard` page — the app's landing page (Task 8's root `page.tsx` redirects
  here). Nothing later in Phase 1 depends on this task's exports; it is the final integration
  point.

- [ ] **Step 1: Month navigator**

Write `pfm-app/src/components/dashboard/month-nav.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function MonthNav({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  function goPrev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }

  function goNext() {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={goPrev} aria-label="Mois précédent">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-40 text-center font-medium">
        {MONTH_LABELS[month - 1]} {year}
      </span>
      <Button variant="outline" size="icon" onClick={goNext} aria-label="Mois suivant">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: KPI cards**

Write `pfm-app/src/components/dashboard/kpi-cards.tsx`:

```tsx
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCards({
  totalIncome,
  totalExpense,
  net,
}: {
  totalIncome: number;
  totalExpense: number;
  net: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Total des entrées
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold text-emerald-600">
          {formatMoney(totalIncome)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Total des sorties
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold text-red-600">
          {formatMoney(totalExpense)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Reste à vivre
          </CardTitle>
        </CardHeader>
        <CardContent
          className={`text-2xl font-semibold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}
        >
          {formatMoney(net)}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Category chart**

Write `pfm-app/src/components/dashboard/category-chart.tsx`:

```tsx
"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

type CategorySlice = { category_name: string; total: number };

export function CategoryChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Répartition des dépenses
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Aucune dépense ce mois-ci.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-500">
          Répartition des dépenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category_name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry: { category_name: string }) => entry.category_name}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatMoney(value)} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Recent transactions**

Write `pfm-app/src/components/dashboard/recent-transactions.tsx`:

```tsx
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

export function RecentTransactions({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-500">
          Transactions récentes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {transactions.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aucune transaction ce mois-ci.
          </p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between text-sm">
            <span>
              {tx.date} — {tx.description}
            </span>
            <span
              className={tx.amount < 0 ? "text-red-600" : "text-emerald-600"}
            >
              {formatMoney(tx.amount)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Dashboard page wiring everything together**

Write `pfm-app/src/app/(app)/dashboard/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MonthNav } from "@/components/dashboard/month-nav";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [totals, setTotals] = useState({
    total_income: 0,
    total_expense: 0,
    net: 0,
  });
  const [categoryData, setCategoryData] = useState<
    { category_name: string; total: number }[]
  >([]);
  const [recent, setRecent] = useState<
    { id: string; date: string; description: string; amount: number }[]
  >([]);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: totalsRow }, { data: categoryRows }, { data: recentRows }] =
      await Promise.all([
        supabase
          .from("v_monthly_totals")
          .select("total_income, total_expense, net")
          .eq("year", year)
          .eq("month", month)
          .maybeSingle(),
        supabase
          .from("v_category_monthly_summary")
          .select("category_name, total")
          .eq("year", year)
          .eq("month", month)
          .eq("type", "expense")
          .order("total", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, date, description, amount")
          .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
          .lt(
            "date",
            month === 12
              ? `${year + 1}-01-01`
              : `${year}-${String(month + 1).padStart(2, "0")}-01`,
          )
          .order("date", { ascending: false })
          .limit(10),
      ]);

    setTotals(
      totalsRow ?? { total_income: 0, total_expense: 0, net: 0 },
    );
    setCategoryData(categoryRows ?? []);
    setRecent(recentRows ?? []);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <MonthNav
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>
      <KpiCards
        totalIncome={totals.total_income}
        totalExpense={totals.total_expense}
        net={totals.net}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChart data={categoryData} />
        <RecentTransactions transactions={recent} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Manually verify the full flow**

`npm run dev`, log in, land on `/dashboard`. With the accounts/categories/transactions/transfers
created in previous tasks' verification steps, expected: KPI cards show correct totals for the
current month, the pie chart shows expense categories, recent transactions list shows the
latest entries. Click the month navigator arrows — expected: data updates for the selected
month (an empty month shows 0,00 € everywhere and "Aucune dépense ce mois-ci." / "Aucune
transaction ce mois-ci." messages, no errors).

- [ ] **Step 7: Typecheck, lint, full test suite, build, commit**

```bash
cd pfm-app && npm run typecheck && npm run lint && npm run test && npm run build
git add -A && git commit -m "feat: add dashboard with monthly KPIs, category chart, and recent transactions"
```

Expected: `npm run build` completes successfully — this is the first production build of the
whole Phase 1 feature set.

---

## Task 14: PWA (Manifest, Icons, Service Worker)

**Files:**
- Create: `pfm-app/public/manifest.json`
- Create: `pfm-app/public/icons/icon.svg`
- Create: `pfm-app/public/icons/icon-maskable.svg`
- Create: `pfm-app/src/sw.ts`
- Create: `pfm-app/next.config.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (purely additive shell around the existing app).
- Produces: an installable PWA. Terminal task of Phase 1.

- [ ] **Step 1: Manifest**

Write `pfm-app/public/manifest.json`:

```json
{
  "name": "Mes Finances",
  "short_name": "Finances",
  "description": "Gestion de finances personnelles",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fafafa",
  "theme_color": "#0f172a",
  "lang": "fr",
  "icons": [
    {
      "src": "/icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Icons**

Write `pfm-app/public/icons/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <text x="256" y="296" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="220" font-weight="700" text-anchor="middle" fill="#fafafa">€</text>
  <text x="256" y="396" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="40" font-weight="500" text-anchor="middle" fill="#94a3b8">FINANCES</text>
</svg>
```

Write `pfm-app/public/icons/icon-maskable.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f172a"/>
  <text x="256" y="316" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="200" font-weight="700" text-anchor="middle" fill="#fafafa">€</text>
</svg>
```

- [ ] **Step 3: Service worker**

Write `pfm-app/src/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

- [ ] **Step 4: Wire Serwist into the Next.js config**

Write `pfm-app/next.config.ts`:

```ts
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

const isProd = process.env.NODE_ENV === "production";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: !isProd,
});

export default isProd ? withSerwist(nextConfig) : nextConfig;
```

- [ ] **Step 5: Build and manually verify installability**

```bash
cd pfm-app && npm run build && npm run start
```

Open `http://localhost:3000` in Chrome or Edge. Expected: the browser's address bar shows an
"Install app" icon; DevTools → Application → Manifest shows no errors and lists both icons;
DevTools → Application → Service Workers shows `sw.js` registered and activated. Install the
app and confirm it opens in its own standalone window. On a mobile device (or Chrome's device
toolbar emulation), confirm the "Add to Home Screen" prompt uses the app name "Mes Finances" and
the euro-sign icon.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
cd pfm-app && npm run typecheck && npm run lint
git add -A && git commit -m "feat: add PWA manifest, icons, and Serwist service worker"
```

---

## Post-Phase-1 Checklist

- [ ] All 14 tasks committed individually (no squashing) so `git log` reads as a build history.
- [ ] `npm run build` succeeds.
- [ ] Manual smoke test: create 2 accounts, a few income/expense categories with one
  sub-category, several transactions, one transfer, and confirm the dashboard totals match
  hand-calculated expectations for the current month.
- [ ] Deploy to Vercel (connect the `pfm-app` GitHub repo, set `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables) and repeat the smoke test against
  the deployed URL.
- [ ] Phase 2 (Budgets) gets its own spec via `superpowers:brainstorming`, building on this
  schema.
