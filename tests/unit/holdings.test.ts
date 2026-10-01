import { describe, expect, it } from "vitest";
import {
  daysUntil,
  expectedGain,
  formatAmount,
  formatDue,
  normalizeDueDate,
  relativeDue,
  reminderText,
  reminderToSend,
  statusLabel,
  toEur,
  urgency,
} from "@/domain/holdings";

// Intl uses narrow no-break spaces in fr-FR; compare on plain spaces.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("currency", () => {
  it("converts FCFA at the fixed parity", () => {
    expect(toEur(655_957, "XOF")).toBeCloseTo(1000, 6);
    expect(toEur(3_000_000, "XOF")).toBeCloseTo(4573.47, 2);
    expect(toEur(2500, "EUR")).toBe(2500);
  });

  it("formats each currency", () => {
    expect(plain(formatAmount(3_000_000, "XOF"))).toBe("3 000 000 FCFA");
    expect(plain(formatAmount(2500, "EUR"))).toBe("2 500,00 €");
  });
});

describe("expected return", () => {
  it("computes the gain over the life or per year", () => {
    expect(expectedGain(2500, 100, "total")).toEqual({ value: 2500, perYear: false });
    expect(expectedGain(3_000_000, 20, "annual")).toEqual({ value: 600_000, perYear: true });
    expect(expectedGain(1000, null, "total")).toBeNull();
  });
});

describe("due dates", () => {
  it("stores a month or year due date as the end of that period", () => {
    expect(normalizeDueDate("2030-03-14", "year")).toBe("2030-12-31");
    expect(normalizeDueDate("2028-02-10", "month")).toBe("2028-02-29");
    expect(normalizeDueDate("2026-10-10", "day")).toBe("2026-10-10");
  });

  it("displays the due date at its precision", () => {
    expect(formatDue("2030-12-31", "year")).toBe("2030");
    expect(formatDue("2028-02-29", "month")).toBe("février 2028");
    expect(formatDue("2026-10-10", "day")).toBe("10 octobre 2026");
  });

  it("counts days and grades urgency", () => {
    expect(daysUntil("2026-10-10", "2026-10-01")).toBe(9);
    expect(daysUntil("2026-03-30", "2026-03-28")).toBe(2); // across DST
    expect(daysUntil("2026-09-28", "2026-10-01")).toBe(-3);
    expect([-1, 0, 7, 8, 30, 31].map(urgency)).toEqual([
      "overdue",
      "soon",
      "soon",
      "upcoming",
      "upcoming",
      "later",
    ]);
  });

  it("phrases the countdown", () => {
    expect(relativeDue(0)).toBe("Aujourd’hui");
    expect(relativeDue(1)).toBe("Demain");
    expect(relativeDue(12)).toBe("Dans 12 jours");
    expect(relativeDue(-3)).toBe("En retard de 3 jours");
    expect(relativeDue(400)).toBe("Dans 13 mois");
    expect(relativeDue(374)).toBe("Dans 12 mois");
  });
});

describe("statuses", () => {
  it("reads 'sent' as 'received' for a debt", () => {
    expect(statusLabel("loan", "sent")).toBe("Envoyé");
    expect(statusLabel("debt", "sent")).toBe("Reçue");
    expect(statusLabel("investment", "active")).toBe("En cours");
  });
});

describe("reminders", () => {
  const none = new Set<number>();

  it("sends nothing before 30 days out", () => {
    expect(reminderToSend(31, none)).toBeNull();
  });

  it("sends the most urgent milestone reached, once", () => {
    expect(reminderToSend(30, none)).toBe(30);
    expect(reminderToSend(20, new Set([30]))).toBeNull();
    expect(reminderToSend(7, new Set([30]))).toBe(7);
    expect(reminderToSend(1, new Set([30, 7]))).toBe(1);
    expect(reminderToSend(0, new Set([30, 7, 1]))).toBe(0);
    expect(reminderToSend(-2, new Set([30, 7, 1, 0]))).toBe(-1);
    expect(reminderToSend(-9, new Set([30, 7, 1, 0, -1]))).toBeNull();
  });

  it("does not replay skipped milestones", () => {
    // Created 3 days before due: only the 7-day reminder goes out.
    expect(reminderToSend(3, none)).toBe(7);
  });

  it("writes a readable notification", () => {
    expect(reminderText("loan", "Prêt à l'ESIF", 7)).toEqual({
      title: "Prêt à l'ESIF",
      body: "Retour de ton prêt dans 7 jours.",
    });
    expect(reminderText("debt", "Dette papa", -2).body).toBe(
      "Remboursement de ta dette : en retard de 2 jours.",
    );
  });
});
