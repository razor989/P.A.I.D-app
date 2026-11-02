import { ExactDecimal, isQuantity, quantity } from "@/core/public";
import type { DomainResolution, Quantity } from "@/core/public";

export type C03Condition =
  "ordinary working day" | "rest day" | "regular holiday";

type C03Result = Readonly<{
  resolution: DomainResolution<Quantity>;
  availability: "AVAILABLE" | "WITHHELD";
}>;

// Approved fixed-study instructional parameters, NOT a current statutory table.
const multipliers = Object.freeze({
  "ordinary working day": "1.25",
  "rest day": "1.69",
  "regular holiday": "2.60",
});

export function deriveC03Multiplier(condition: C03Condition): Quantity {
  if (
    typeof condition !== "string" ||
    !Object.prototype.hasOwnProperty.call(multipliers, condition)
  )
    throw new TypeError("Unsupported C03 study condition");
  return quantity(
    ExactDecimal.from(multipliers[condition]),
    "MULTIPLIER",
    "dimensionless",
    null,
  );
}

function validateResolution<T>(value: DomainResolution<T>): void {
  if (!value || typeof value !== "object")
    throw new TypeError("An explicit domain resolution is required");
  switch (value.kind) {
    case "KNOWN":
    case "NOT_APPLICABLE":
      return;
    case "UNKNOWN":
    case "UNDEFINED":
      if (typeof value.reason === "string" && value.reason.trim()) return;
  }
  throw new TypeError("Invalid C03 domain resolution");
}

function validateQuantity(value: Quantity, rate: boolean): void {
  if (
    !isQuantity(value) ||
    value.kind !== (rate ? "MONETARY_RATE" : "DURATION") ||
    value.unit !== (rate ? "PHP" : "hours") ||
    value.basis !== (rate ? "per hour" : null)
  )
    throw new TypeError("C03 requires PHP per hour and overtime hours");
  const sign = value.magnitude.compare(ExactDecimal.from("0"));
  if (sign < 0 || (rate && sign === 0))
    throw new RangeError("C03 requires positive rate and nonnegative hours");
}

/** Pure trusted-domain computation. AVAILABLE means derivable, never reveal permission.
 * No independently authored multiplier, rounding, conversion or parameter caps.
 */
export function calculateC03OvertimePay(
  rate: DomainResolution<Quantity>,
  condition: DomainResolution<C03Condition>,
  hours: DomainResolution<Quantity>,
): C03Result {
  validateResolution(rate);
  validateResolution(condition);
  validateResolution(hours);
  if (rate.kind === "KNOWN") validateQuantity(rate.value, true);
  if (hours.kind === "KNOWN") validateQuantity(hours.value, false);
  const multiplier =
    condition.kind === "KNOWN" ? deriveC03Multiplier(condition.value) : null;
  // Missing required information takes precedence; known zero cannot erase it.
  const unresolved =
    [rate, condition, hours].find((item) => item.kind === "UNKNOWN") ??
    [rate, condition, hours].find((item) => item.kind !== "KNOWN");
  if (unresolved) {
    return Object.freeze({
      resolution: Object.freeze({ ...unresolved }),
      availability: "WITHHELD",
    });
  }
  if (rate.kind !== "KNOWN" || hours.kind !== "KNOWN" || !multiplier)
    throw new TypeError("Incomplete C03 calculation");
  return Object.freeze({
    resolution: Object.freeze({
      kind: "KNOWN",
      value: quantity(
        rate.value.magnitude
          .multiply(multiplier.magnitude)
          .multiply(hours.value.magnitude),
        "MONETARY_AMOUNT",
        "PHP",
        null,
      ),
    }),
    availability: "AVAILABLE",
  });
}
