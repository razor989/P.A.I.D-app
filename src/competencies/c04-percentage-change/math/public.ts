import { ExactDecimal, isQuantity, quantity } from "../../../core/public";
import type { DomainResolution, Quantity } from "../../../core/public";

/** The frozen core public entrypoint exposes DomainResolution, but not Result. */
type C04Result<T> = Readonly<{
  resolution: DomainResolution<T>;
  availability: "AVAILABLE" | "WITHHELD";
}>;

export type C04Direction = "INCREASE" | "DECREASE" | "NO_CHANGE";

export type C04Change = Readonly<{
  difference: C04Result<Quantity>;
  relativeChange: C04Result<ExactDecimal>;
  percentageChange: C04Result<Quantity>;
  direction: C04Direction;
}>;

/** Established, nonnegative comparable values only; Original is always the reference. */
export function calculateC04Change(
  original: Quantity,
  newValue: Quantity,
): C04Change {
  if (
    !isQuantity(original) ||
    !isQuantity(newValue) ||
    original.kind !== newValue.kind ||
    original.unit !== newValue.unit ||
    original.basis !== newValue.basis
  ) {
    throw new TypeError(
      "C04 requires established quantities with matching kind, unit and basis",
    );
  }

  const zero = ExactDecimal.from("0");
  if (
    original.magnitude.compare(zero) < 0 ||
    newValue.magnitude.compare(zero) < 0
  ) {
    throw new RangeError(
      "C04 does not support negative salary or allowance values",
    );
  }

  const difference = newValue.magnitude.subtract(original.magnitude);
  const direction: C04Direction =
    difference.compare(zero) > 0
      ? "INCREASE"
      : difference.compare(zero) < 0
        ? "DECREASE"
        : "NO_CHANGE";
  const signedDifference = Object.freeze({
    resolution: Object.freeze({
      kind: "KNOWN" as const,
      value: quantity(difference, original.kind, original.unit, original.basis),
    }),
    availability: "AVAILABLE" as const,
  });

  if (original.magnitude.equals(zero)) {
    const reason = "Original value is zero";
    return Object.freeze({
      difference: signedDifference,
      relativeChange: Object.freeze({
        resolution: Object.freeze({ kind: "UNDEFINED" as const, reason }),
        availability: "WITHHELD" as const,
      }),
      percentageChange: Object.freeze({
        resolution: Object.freeze({ kind: "UNDEFINED" as const, reason }),
        availability: "WITHHELD" as const,
      }),
      direction,
    });
  }

  // Exact division throws DecimalPrecisionAuthorityError when the quotient repeats.
  // No caller or global rounding policy is inferred from the fixed C04 scenarios.
  const relative = difference.divide(original.magnitude);
  const percentage = relative.multiply(ExactDecimal.from("100"));
  const relativeResolution = Object.freeze({
    kind: "KNOWN" as const,
    value: relative,
  });
  const percentageResolution = Object.freeze({
    kind: "KNOWN" as const,
    value: quantity(percentage, "PERCENTAGE_CHANGE", "%", null),
  });
  return Object.freeze({
    difference: signedDifference,
    relativeChange: Object.freeze({
      resolution: relativeResolution,
      availability: "AVAILABLE" as const,
    }),
    percentageChange: Object.freeze({
      resolution: percentageResolution,
      availability: "AVAILABLE" as const,
    }),
    direction,
  });
}
