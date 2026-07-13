import Decimal from "decimal.js";

export function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function sum(values: Decimal.Value[]): Decimal {
  return values.reduce(
    (acc: Decimal, v) => acc.plus(v),
    new Decimal(0),
  );
}

export function formatMoney(
  amount: Decimal.Value,
  locale: string = "fr-FR",
): string {
  const rounded = toDecimal(amount).toDecimalPlaces(2).toNumber();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}
