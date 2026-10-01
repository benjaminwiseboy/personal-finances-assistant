// Applies db/migrations/*.sql in order, once each (tracked in _migrations).
// Usage: npm run db:migrate   (reads DATABASE_URL from .env.local or env)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant (lancez `vercel env pull .env.local`).");
  process.exit(1);
}

const dir = path.resolve("db/migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const { rows } = await client.query("select name from _migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    process.stdout.write(`→ ${file} … `);
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      await client.query("insert into _migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
    } catch (error) {
      await client.query("rollback");
      console.log("échec");
      throw error;
    }
  }
  console.log("Base à jour.");
} finally {
  await client.end();
}
