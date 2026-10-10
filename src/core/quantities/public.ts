import { ExactDecimal } from "../exact-decimal/public";

/** Open vocabulary: kind, unit and basis are semantic identities, not conversion instructions. */
export type Quantity = Readonly<{
  magnitude: ExactDecimal;
  kind: string;
  unit: string;
  basis: string | null;
}>;

function label(value: string, name: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  ) {
    throw new TypeError(`Quantity ${name} must be a nonempty trimmed identity`);
  }
  return value;
}

export function quantity(
  magnitude: ExactDecimal,
  kind: string,
  unit: string,
  basis: string | null,
): Quantity {
  if (!(magnitude instanceof ExactDecimal)) {
    throw new TypeError("Quantity magnitude must be an exact decimal");
  }
  if (basis !== null) label(basis, "basis");
  return Object.freeze({
    magnitude,
    kind: label(kind, "kind"),
    unit: label(unit, "unit"),
    basis,
  });
}

export function isQuantity(value: unknown): value is Quantity {
  return (
    typeof value === "object" &&
    value !== null &&
    "magnitude" in value &&
    value.magnitude instanceof ExactDecimal &&
    "kind" in value &&
    typeof value.kind === "string" &&
    value.kind.trim() === value.kind &&
    value.kind.length > 0 &&
    "unit" in value &&
    typeof value.unit === "string" &&
    value.unit.trim() === value.unit &&
    value.unit.length > 0 &&
    "basis" in value &&
    (value.basis === null ||
      (typeof value.basis === "string" &&
        value.basis.trim() === value.basis &&
        value.basis.length > 0))
  );
}

function matching(left: Quantity, right: Quantity): void {
  if (
    !isQuantity(left) ||
    !isQuantity(right) ||
    left.kind !== right.kind ||
    left.unit !== right.unit ||
    left.basis !== right.basis
  ) {
    throw new TypeError(
      "Quantity kind, unit and basis must match; no implicit conversion",
    );
  }
}

export function addQuantities(left: Quantity, right: Quantity): Quantity {
  matching(left, right);
  return quantity(
    left.magnitude.add(right.magnitude),
    left.kind,
    left.unit,
    left.basis,
  );
}

export function compareQuantities(left: Quantity, right: Quantity): -1 | 0 | 1 {
  matching(left, right);
  return left.magnitude.compare(right.magnitude);
}
