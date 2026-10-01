// One-shot copy of every user and their data from the old Supabase project
// into Neon. Ids are kept as-is (the Supabase user uuid becomes the Better Auth
// user id), and the bcrypt password hash is copied, so existing logins keep
// working with the same password.
//
// Usage:
//   SUPABASE_DB_URL="postgresql://postgres:…@db.xxx.supabase.co:5432/postgres" \
//   SUPABASE_CA_CERT=./prod-ca-2021.crt \
//     npm run db:import-supabase
//
// Run `npm run db:migrate` first. Safe to re-run: existing rows are skipped.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const sourceUrl = process.env.SUPABASE_DB_URL;
const targetUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("SUPABASE_DB_URL et DATABASE_URL sont requis.");
  process.exit(1);
}

// Supabase signs its Postgres certificate with its own CA: download it from
// Project Settings → Database → SSL and point SUPABASE_CA_CERT at the file.
const source = new pg.Client({
  connectionString: sourceUrl,
  ...(process.env.SUPABASE_CA_CERT && {
    ssl: { ca: readFileSync(process.env.SUPABASE_CA_CERT, "utf8") },
  }),
});
const target = new pg.Client({ connectionString: targetUrl });
await source.connect();
await target.connect();

/** Copies rows as-is, skipping ids that already exist in the target. */
async function copy(table, columns, rows) {
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const params = columns.map((_, i) => `$${i + 1}`).join(", ");
  let inserted = 0;
  for (const row of rows) {
    const res = await target.query(
      `insert into ${table} (${cols}) values (${params}) on conflict do nothing`,
      columns.map((c) => row[c]),
    );
    inserted += res.rowCount;
  }
  console.log(`  ${table.padEnd(12)} ${inserted}/${rows.length}`);
}

try {
  const { rows: users } = await source.query(`
    select id::text, email, encrypted_password, created_at
    from auth.users where email is not null`);

  await target.query("begin");

  console.log("Copie :");
  for (const u of users) {
    await target.query(
      `insert into "user" (id, name, email, "emailVerified", "createdAt")
       values ($1, $2, lower($3), true, $4) on conflict do nothing`,
      [u.id, u.email.split("@")[0], u.email, u.created_at],
    );
    if (u.encrypted_password) {
      await target.query(
        `insert into "account" (id, "accountId", "providerId", "userId", password)
         select $1, $2, 'credential', $2, $3
         where not exists (
           select 1 from "account" where "userId" = $2 and "providerId" = 'credential'
         )`,
        [randomUUID(), u.id, u.encrypted_password],
      );
    }
  }
  console.log(`  ${"user".padEnd(12)} ${users.length}`);

  const read = (sql) => source.query(sql).then((r) => r.rows);

  await copy(
    "accounts",
    ["id", "user_id", "name", "type", "initial_balance", "is_primary", "created_at"],
    await read(`select *, user_id::text as user_id from public.accounts`),
  );
  // Roots before children so parent_id always resolves.
  await copy(
    "categories",
    ["id", "user_id", "name", "type", "parent_id", "created_at"],
    await read(`select *, user_id::text as user_id from public.categories
                order by parent_id nulls first`),
  );
  await copy(
    "transfers",
    ["id", "user_id", "from_account_id", "to_account_id", "amount", "date", "description", "created_at"],
    await read(`select *, user_id::text as user_id, date::text as date from public.transfers`),
  );
  await copy(
    "transactions",
    ["id", "user_id", "account_id", "category_id", "transfer_id", "amount", "date", "description", "created_at"],
    await read(`select *, user_id::text as user_id, date::text as date from public.transactions`),
  );
  await copy(
    "budgets",
    ["id", "user_id", "category_id", "amount", "created_at", "updated_at"],
    await read(`select *, user_id::text as user_id from public.budgets`),
  );

  await target.query("commit");
  console.log("Import terminé.");
} catch (error) {
  await target.query("rollback").catch(() => {});
  throw error;
} finally {
  await source.end();
  await target.end();
}
