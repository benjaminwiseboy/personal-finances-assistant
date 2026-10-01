import { NextResponse, type NextRequest } from "next/server";
import { runDueReminders } from "@/server/reminders";

// Called daily by Vercel Cron (vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await runDueReminders());
}
