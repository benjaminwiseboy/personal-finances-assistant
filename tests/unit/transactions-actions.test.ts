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

import { deleteTransaction, updateTransaction } from "@/actions/transactions";

describe("deleteTransaction", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to delete a transaction linked to a transfer", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { transfer_id: "tr-1" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteTransaction("tx-1");
    expect(result.error).toMatch(/transfert/i);
  });

  it("deletes a regular transaction", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { transfer_id: null },
                    error: null,
                  }),
              }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteTransaction("tx-1");
    expect(result.error).toBeUndefined();
  });
});

describe("updateTransaction", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to update a transaction linked to a transfer", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { transfer_id: "tr-1" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateTransaction("tx-1", {
      // Zod v4's uuid() enforces the RFC 4122 variant nibble (8/9/a/b in the
      // third group), so plain repeated-digit UUIDs like
      // "11111111-1111-1111-1111-111111111111" fail schema validation before
      // the transfer_id check ever runs. Use variant-valid fixtures instead.
      account_id: "11111111-1111-4111-8111-111111111111",
      category_id: "22222222-2222-4222-8222-222222222222",
      amount: "10",
      date: "2026-07-13",
      description: "Test",
    });
    expect(result.error).toMatch(/transfert/i);
  });
});
