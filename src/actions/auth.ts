"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { getAuth } from "@/lib/auth";

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis" };
  }

  try {
    // nextCookies() sets the session cookie on the action's response.
    await getAuth().api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) return { error: "Identifiants invalides" };
    throw error;
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
