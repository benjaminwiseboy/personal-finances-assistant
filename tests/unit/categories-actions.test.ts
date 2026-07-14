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
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/actions/categories";

describe("deleteCategory", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to delete a category with transactions", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({ data: [{ id: "t1" }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteCategory("cat-1");
    expect(result.error).toMatch(/transactions/i);
  });

  it("refuses to delete a category with sub-categories", async () => {
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
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({ data: [{ id: "sub-1" }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await deleteCategory("cat-1");
    expect(result.error).toMatch(/sous-catégories/i);
  });
});

describe("createCategory", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to create a category with a parent belonging to another user", async () => {
    mockFrom.mockImplementation((table: string) => {
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

    const result = await createCategory({
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toMatch(/parente/i);
  });

  it("creates a category when the parent belongs to the user", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "parent-1", parent_id: null },
                    error: null,
                  }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await createCategory({
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toBeUndefined();
  });

  it("refuses to create a category with a parent that is itself a sub-category", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "parent-1", parent_id: "grandparent-1" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await createCategory({
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toMatch(/racine/i);
  });

  it("creates a top-level category without checking a parent", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await createCategory({
      name: "Top",
      type: "income",
      parent_id: null,
    });
    expect(result.error).toBeUndefined();
  });
});

describe("updateCategory", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("refuses to update a category with a parent belonging to another user", async () => {
    mockFrom.mockImplementation((table: string) => {
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

    const result = await updateCategory("cat-1", {
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toMatch(/parente/i);
  });

  it("updates a category when the parent belongs to the user", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === "id") {
                // parent lookup: .eq("id", parentId).eq("user_id", userId).single()
                return {
                  eq: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: "parent-1", parent_id: null },
                        error: null,
                      }),
                  }),
                };
              }
              if (column === "parent_id") {
                // has-children lookup: .eq("parent_id", id).limit(1)
                return {
                  limit: () => Promise.resolve({ data: [], error: null }),
                };
              }
              throw new Error(`unexpected eq column: ${column}`);
            },
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateCategory("cat-1", {
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toBeUndefined();
  });

  it("refuses to update a category with a parent that is itself a sub-category", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "parent-1", parent_id: "grandparent-1" },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateCategory("cat-1", {
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toMatch(/racine/i);
  });

  it("refuses to set a category as its own parent", async () => {
    mockFrom.mockImplementation((table: string) => {
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateCategory("cat-1", {
      name: "Sub",
      type: "expense",
      parent_id: "cat-1",
    });
    expect(result.error).toMatch(/propre catégorie parente/i);
  });

  it("refuses to re-parent a category that already has children", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === "id") {
                return {
                  eq: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: "parent-1", parent_id: null },
                        error: null,
                      }),
                  }),
                };
              }
              if (column === "parent_id") {
                return {
                  limit: () =>
                    Promise.resolve({ data: [{ id: "child-1" }], error: null }),
                };
              }
              throw new Error(`unexpected eq column: ${column}`);
            },
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await updateCategory("cat-1", {
      name: "Sub",
      type: "expense",
      parent_id: "parent-1",
    });
    expect(result.error).toMatch(/sous-catégories/i);
  });
});
