import type { QueryName, QueryResult } from "@/server/queries";

/** Client-side reader for /api/data/[query] — the queryFn for every page. */
export async function fetchData<K extends QueryName>(
  name: K,
  params: Record<string, string | number> = {},
): Promise<QueryResult<K>> {
  const search = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`/api/data/${name}?${search}`);
  if (res.status === 401) {
    window.location.assign("/login");
  }
  if (!res.ok) {
    throw new Error(`Échec du chargement (${name}): ${res.status}`);
  }
  return res.json();
}
