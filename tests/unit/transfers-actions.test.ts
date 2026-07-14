import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));
// revalidatePath requires a Next.js request context (static generation
// store); outside of one (e.g. a plain Vitest unit test) it throws. Mock it
// as a no-op here so we can exercise the action's logic in isolation.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createTransfer, deleteTransfer } from "@/actions/transfers";

describe("createTransfer", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects same-account transfers without calling the database", async () => {
    const result = await createTransfer({
      from_account_id: "11111111-1111-4111-8111-111111111111",
      to_account_id: "11111111-1111-4111-8111-111111111111",
      amount: "100",
      date: "2026-07-13",
      description: "",
    });

    expect(result.error).toBeDefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // Zod v4's uuid() enforces the RFC 4122 variant nibble (8/9/a/b in the
  // third group), so plain repeated-digit UUIDs like
  // "11111111-1111-1111-1111-111111111111" fail schema validation before
  // reaching the RPC call. Use variant-valid fixtures here, matching the
  // convention established in transactions-actions.test.ts.
  it("calls create_transfer with the parsed arguments", async () => {
    mockRpc.mockResolvedValue({ data: "new-transfer-id", error: null });

    const result = await createTransfer({
      from_account_id: "11111111-1111-4111-8111-111111111111",
      to_account_id: "22222222-2222-4222-8222-222222222222",
      amount: "150,50",
      date: "2026-07-13",
      description: "Épargne mensuelle",
    });

    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("create_transfer", {
      p_from_account_id: "11111111-1111-4111-8111-111111111111",
      p_to_account_id: "22222222-2222-4222-8222-222222222222",
      p_amount: "150.50",
      p_date: "2026-07-13",
      p_description: "Épargne mensuelle",
    });
  });
});

describe("deleteTransfer", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls delete_transfer with the transfer id", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await deleteTransfer("transfer-1");

    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("delete_transfer", {
      p_transfer_id: "transfer-1",
    });
  });
});
