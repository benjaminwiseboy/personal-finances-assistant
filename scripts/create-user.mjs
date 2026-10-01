// Creates (or resets the password of) a login. Sign-up is disabled in the app.
// Usage: npm run user:create -- email@exemple.com "mot de passe" ["Nom"]
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

config({ path: ".env.local", quiet: true });

const [email, password, name = email?.split("@")[0]] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage : npm run user:create -- email "mot de passe (8+ car.)" [nom]');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

try {
  const hash = await hashPassword(password);
  await client.query("begin");
  const { rows } = await client.query(
    `insert into "user" (id, name, email, "emailVerified")
     values ($1, $2, lower($3), true)
     on conflict (email) do update set "updatedAt" = now()
     returning id`,
    [randomUUID(), name, email],
  );
  const userId = rows[0].id;
  await client.query(
    `delete from "account" where "userId" = $1 and "providerId" = 'credential'`,
    [userId],
  );
  await client.query(
    `insert into "account" (id, "accountId", "providerId", "userId", password)
     values ($1, $2, 'credential', $2, $3)`,
    [randomUUID(), userId, hash],
  );
  await client.query("commit");
  console.log(`Utilisateur prêt : ${email.toLowerCase()} (${userId})`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
