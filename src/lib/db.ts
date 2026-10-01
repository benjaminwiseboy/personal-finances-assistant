import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// HTTP driver: one round-trip per query, no connection to manage — the right
// fit for Vercel functions. DATABASE_URL is injected by the Neon integration.
// Created on first use so `next build` doesn't need the variable.
let client: NeonQueryFunction<false, false> | undefined;
const db = () => (client ??= neon(process.env.DATABASE_URL!));

type Sql = NeonQueryFunction<false, false>;

export const sql = Object.assign(
  ((...args: Parameters<Sql>) => db()(...args)) as Sql,
  {
    transaction: ((...args: Parameters<Sql["transaction"]>) =>
      db().transaction(...args)) as Sql["transaction"],
  },
);
