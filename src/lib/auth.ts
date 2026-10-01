import "server-only";
import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { verifyPassword as verifyScrypt } from "better-auth/crypto";
import bcrypt from "bcryptjs";

function createAuth() {
  return betterAuth({
    database: new Pool({ connectionString: process.env.DATABASE_URL }),
    emailAndPassword: {
      enabled: true,
      // Private app: accounts are created with `npm run user:create`.
      disableSignUp: true,
      password: {
        // Passwords imported from Supabase are bcrypt hashes ($2a$/$2b$);
        // everything created here uses Better Auth's default scrypt.
        verify: async ({ hash, password }) =>
          hash.startsWith("$2")
            ? bcrypt.compare(password, hash)
            : verifyScrypt({ hash, password }),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days — it's an installed PWA
    },
    plugins: [nextCookies()],
  });
}

// Created on first use so `next build` doesn't need DATABASE_URL or
// BETTER_AUTH_SECRET (Better Auth refuses to start without a secret in prod).
let instance: ReturnType<typeof createAuth> | undefined;
export const getAuth = () => (instance ??= createAuth());
