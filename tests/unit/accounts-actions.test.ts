import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockGetUser = vi.fn(async () => ({
  data: { user: { id: "test-user-id" } },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}));
// revalidatePath requires a Next.js request context (static generation
// store); outside of one (e.g. a plain Vitest unit test) it throws. Mock it
// as a no-op here so we can exercise the action's logic in isolation.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { deleteAccount } from "@/actions/accounts";

describe("deleteAccount", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to delete an account with existing transactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [{ id: "t1" }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteAccount("acc-1");

    expect(result.error).toMatch(/transactions/i);
  });

  it("deletes an account with no transactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "accounts") {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteAccount("acc-1");

    expect(result.error).toBeUndefined();
  });
});
