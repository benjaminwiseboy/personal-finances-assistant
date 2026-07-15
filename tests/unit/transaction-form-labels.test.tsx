import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionForm } from "@/components/transactions/transaction-form";

vi.mock("@/actions/transactions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}));

describe("TransactionForm select labels", () => {
  it("shows the account NAME in the trigger, not the id", () => {
    render(
      <TransactionForm
        accounts={[{ id: "acc-uuid-1", name: "Société Générale" }]}
        categories={[{ id: "cat-uuid-1", name: "Alimentation" }]}
      />,
    );

    // The account combobox trigger should display the human name, never the raw id.
    const accountTrigger = screen.getByLabelText("Compte");
    expect(accountTrigger.textContent).toContain("Société Générale");
    expect(accountTrigger.textContent).not.toContain("acc-uuid-1");

    const categoryTrigger = screen.getByLabelText("Catégorie");
    expect(categoryTrigger.textContent).toContain("Alimentation");
    expect(categoryTrigger.textContent).not.toContain("cat-uuid-1");
  });
});
