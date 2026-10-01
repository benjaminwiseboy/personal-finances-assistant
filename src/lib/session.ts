import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

/** The signed-in user's id, or null. Deduplicated per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
});
