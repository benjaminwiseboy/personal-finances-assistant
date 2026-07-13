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

import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/actions/transactions";

const validInput = {
  account_id: "11111111-1111-4111-8111-111111111111",
  category_id: "22222222-2222-4222-8222-222222222222",
  amount: "10",
  date: "2026-07-13",
  description: "Test",
};

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

    // Zod v4's uuid() enforces the RFC 4122 variant nibble (8/9/a/b in the
    // third group), so plain repeated-digit UUIDs like
    // "11111111-1111-1111-1111-111111111111" fail schema validation before
    // the transfer_id check ever runs. `validInput` uses variant-valid
    // fixtures.
    const result = await updateTransaction("tx-1", validInput);
    expect(result.error).toMatch(/transfert/i);
  });

  it("refuses to update a transaction with an account belonging to another user", async () => {
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
        };
      }
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateTransaction("tx-1", validInput);
    expect(result.error).toMatch(/compte/i);
  });

  it("updates a transaction when account and category belong to the user", async () => {
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
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({ data: { id: "acc-1" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { type: "expense" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateTransaction("tx-1", validInput);
    expect(result.error).toBeUndefined();
  });
});

describe("createTransaction", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to create a transaction with an account belonging to another user", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await createTransaction(validInput);
    expect(result.error).toMatch(/compte/i);
  });

  it("refuses to create a transaction with a category belonging to another user", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({ data: { id: "acc-1" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await createTransaction(validInput);
    expect(result.error).toMatch(/catégorie/i);
  });

  it("creates a transaction when account and category belong to the user", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({ data: { id: "acc-1" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { type: "expense" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "transactions") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await createTransaction(validInput);
    expect(result.error).toBeUndefined();
  });
});
