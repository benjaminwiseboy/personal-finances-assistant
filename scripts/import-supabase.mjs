// One-shot copy of every user and their data from the old Supabase project
// into Neon. Ids are kept as-is (the Supabase user uuid becomes the Better Auth
// user id), and the bcrypt password hash is copied, so existing logins keep
// working with the same password.
//
// Usage, from a dashboard backup (plain-SQL pg_dumpall file):
//   npm run db:import-supabase -- --from-dump ./db_cluster-….backup
//
// or from the live database:
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

const dumpFlag = process.argv.indexOf("--from-dump");
const dumpPath = dumpFlag > -1 ? process.argv[dumpFlag + 1] : null;
const sourceUrl = process.env.SUPABASE_DB_URL;
const targetUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if ((!dumpPath && !sourceUrl) || !targetUrl) {
  console.error(
    "DATABASE_URL est requis, ainsi que --from-dump <fichier> ou SUPABASE_DB_URL.",
  );
  process.exit(1);
}

const TABLES = [
  "auth.users",
  "public.accounts",
  "public.categories",
  "public.transfers",
  "public.transactions",
  "public.budgets",
];

/**
 * Loads only the COPY blocks we need from a plain-SQL dump into an in-memory
 * Postgres (PGlite). Columns are created as text: the target casts them back.
 */
async function openDump(file) {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  await db.exec("create schema auth");
  for (const table of TABLES) {
    const start = lines.findIndex((l) => l.startsWith(`COPY ${table} (`));
    if (start < 0) {
      console.warn(`  (${table} absent du dump)`);
      continue;
    }
    const columns = lines[start].match(/\(([^)]*)\)/)[1].split(", ");
    const end = lines.indexOf("\\.", start);
    const data = lines.slice(start + 1, end).join("\n") + "\n";
    await db.exec(
      `create table ${table} (${columns.map((c) => `${c} text`).join(", ")})`,
    );
    await db.query(`copy ${table} from '/dev/blob'`, [], {
      blob: new Blob([data]),
    });
  }
  return { query: (sql) => db.query(sql), end: () => db.close() };
}

// Supabase signs its Postgres certificate with its own CA: download it from
// Project Settings → Database → SSL and point SUPABASE_CA_CERT at the file.
const source = dumpPath
  ? await openDump(dumpPath)
  : new pg.Client({
      connectionString: sourceUrl,
      ...(process.env.SUPABASE_CA_CERT && {
        ssl: { ca: readFileSync(process.env.SUPABASE_CA_CERT, "utf8") },
      }),
    });
const target = new pg.Client({ connectionString: targetUrl });
if (!dumpPath) await source.connect();
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
