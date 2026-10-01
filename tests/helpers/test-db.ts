import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// An in-memory Postgres (PGlite) with the real Neon migrations applied, plus a
// `sql` tag shaped like the Neon HTTP driver's, so server actions and queries
// run their actual SQL in tests. Wire it up with:
//
//   vi.mock("@/lib/db", async () => (await import("../helpers/test-db")).dbModule);

const MIGRATIONS = path.resolve(__dirname, "../../db/migrations");

export const pg = new PGlite();

let ready: Promise<void> | null = null;
export function migrate() {
  ready ??= (async () => {
    const { readdirSync } = await import("node:fs");
    for (const file of readdirSync(MIGRATIONS).sort()) {
      await pg.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
    }
  })();
  return ready;
}

type Row = Record<string, unknown>;

class Query implements PromiseLike<Row[]> {
  constructor(
    readonly text: string,
    readonly params: unknown[],
  ) {}
  run(db: Pick<PGlite, "query"> = pg) {
    return db.query<Row>(this.text, this.params).then((r) => r.rows);
  }
  then<A = Row[], B = never>(
    ok?: ((rows: Row[]) => A | PromiseLike<A>) | null,
    ko?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ) {
    return this.run().then(ok, ko);
  }
}

function sqlTag(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.reduce((acc, s, i) => `${acc}$${i}${s}`);
  return new Query(text, values);
}

export const sql = Object.assign(sqlTag, {
  transaction: (queries: Query[]) =>
    pg.transaction(async (tx) => {
      const out: Row[][] = [];
      for (const q of queries) out.push(await q.run(tx));
      return out;
    }),
});

export const dbModule = { sql };

/** Wipes app data and auth users between tests. */
export async function reset() {
  await migrate();
  await pg.exec(`truncate "user" cascade`);
}

export async function createUser(id: string) {
  await sql`insert into "user" (id, name, email) values (${id}, ${id}, ${`${id}@test.local`})`;
}

export async function insertAccount(userId: string, name = "Courant") {
  const [row] = await sql`
    insert into accounts (user_id, name, type, initial_balance)
    values (${userId}, ${name}, 'courant', 1000) returning id`;
  return row.id as string;
}

export async function insertCategory(
  userId: string,
  name: string,
  type: "income" | "expense" = "expense",
  parentId: string | null = null,
) {
  const [row] = await sql`
    insert into categories (user_id, name, type, parent_id)
    values (${userId}, ${name}, ${type}, ${parentId}) returning id`;
  return row.id as string;
}

export async function insertTransaction(
  userId: string,
  accountId: string,
  categoryId: string,
  amount: string,
  date = "2026-07-13",
) {
  const [row] = await sql`
    insert into transactions (user_id, account_id, category_id, amount, date, description)
    values (${userId}, ${accountId}, ${categoryId}, ${amount}, ${date}, 'test') returning id`;
  return row.id as string;
}
