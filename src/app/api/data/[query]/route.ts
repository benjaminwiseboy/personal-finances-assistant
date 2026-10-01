import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "@/lib/session";
import { BadRequest, queries, type QueryName } from "@/server/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ query: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { query } = await params;
  if (!Object.hasOwn(queries, query)) {
    return NextResponse.json({ error: "Requête inconnue" }, { status: 404 });
  }

  const search = Object.fromEntries(request.nextUrl.searchParams);
  try {
    const data = await queries[query as QueryName](userId, search);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof BadRequest) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
