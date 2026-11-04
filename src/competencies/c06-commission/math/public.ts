import { ExactDecimal, isQuantity, quantity } from "@/core/public";
import type { DomainResolution, Quantity } from "@/core/public";

type NotApplicable = Readonly<{ kind: "NOT_APPLICABLE" }>;
type RequiredValue = Exclude<DomainResolution<Quantity>, NotApplicable>;

/** Explicit scenario evidence, not a conversion rule inferred from unlike bases.
 * Trusted composition authenticates the period against the source narrative.
 */
export type C06PeriodAlignment = Readonly<{
  salesBasis: string | null;
  baseSalaryBasis: string | null;
  compensationBasis: string;
}>;

type Inputs = Readonly<{
  sales: DomainResolution<Quantity>;
  commissionRate: DomainResolution<Quantity>;
}>;

export type C06CalculationInput = Inputs &
  (
    | Readonly<{
        arrangement: "STRAIGHT_COMMISSION";
        baseSalary: NotApplicable;
      }>
    | Readonly<{
        arrangement: "BASE_PLUS_COMMISSION";
        baseSalary: RequiredValue;
        periodAlignment: C06PeriodAlignment;
      }>
  );

export type C06Result = Readonly<{
  resolution: DomainResolution<Quantity>;
  availability: "AVAILABLE" | "WITHHELD";
}>;

export type C06Calculation =
  | Readonly<{
      arrangement: "STRAIGHT_COMMISSION";
      baseSalary: NotApplicable;
      commission: C06Result;
    }>
  | Readonly<{
      arrangement: "BASE_PLUS_COMMISSION";
      baseSalary: RequiredValue;
      commission: C06Result;
      totalCompensation: C06Result;
    }>;

function record(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d !== undefined && d.enumerable && "value" in d;
    })
  );
}

function resolution(value: unknown, rate: boolean): DomainResolution<Quantity> {
  if (record(value, ["kind"]) && value.kind === "NOT_APPLICABLE")
    return Object.freeze({ kind: "NOT_APPLICABLE" });
  if (
    record(value, ["kind", "reason"]) &&
    (value.kind === "UNKNOWN" || value.kind === "UNDEFINED") &&
    typeof value.reason === "string" &&
    value.reason.trim()
  )
    return Object.freeze({ kind: value.kind, reason: value.reason });
  if (
    !record(value, ["kind", "value"]) ||
    value.kind !== "KNOWN" ||
    !record(value.value, ["magnitude", "kind", "unit", "basis"]) ||
    !isQuantity(value.value)
  )
    throw new TypeError("Invalid C06 domain quantity/resolution");
  const input = value.value;
  // Authenticate private exact-decimal storage; instanceof alone is insufficient.
  const magnitude = ExactDecimal.from(
    ExactDecimal.prototype.toString.call(input.magnitude),
  );
  if (
    input.kind !== (rate ? "PERCENTAGE_RATE" : "MONETARY_AMOUNT") ||
    input.unit !== (rate ? "%" : "PHP") ||
    (rate && input.basis !== null)
  )
    throw new TypeError(
      "C06 requires PHP amounts and an unbased percentage rate",
    );
  if (magnitude.compare(ExactDecimal.from("0")) < 0)
    throw new RangeError(
      "Negative C06 parameters are outside the source contract",
    );
  return Object.freeze({
    kind: "KNOWN",
    value: quantity(magnitude, input.kind, input.unit, input.basis),
  });
}

function result(value: DomainResolution<Quantity>): C06Result {
  return Object.freeze({
    resolution: value,
    availability: value.kind === "KNOWN" ? "AVAILABLE" : "WITHHELD",
  });
}

function unresolved(
  values: readonly DomainResolution<Quantity>[],
): DomainResolution<Quantity> | undefined {
  return (
    values.find((value) => value.kind === "UNKNOWN") ??
    values.find((value) => value.kind !== "KNOWN")
  );
}

/** Exact trusted-domain calculation; AVAILABLE is NOT permission to reveal an answer.
 * No universal rate/range, intermediate rounding, or learner-response mutation.
 * Zero edges are domain semantics, not additions to the positive fixed study bank.
 */
export function calculateC06Compensation(
  input: C06CalculationInput,
): C06Calculation {
  const straight = record(input, [
    "arrangement",
    "sales",
    "commissionRate",
    "baseSalary",
  ]);
  const basePlus = record(input, [
    "arrangement",
    "sales",
    "commissionRate",
    "baseSalary",
    "periodAlignment",
  ]);
  if (
    (!straight || input.arrangement !== "STRAIGHT_COMMISSION") &&
    (!basePlus || input.arrangement !== "BASE_PLUS_COMMISSION")
  )
    throw new TypeError("C06 requires an explicit discriminated arrangement");
  const sales = resolution(input.sales, false);
  const rate = resolution(input.commissionRate, true);
  const base = resolution(input.baseSalary, false);
  if (
    (input.arrangement === "STRAIGHT_COMMISSION" &&
      base.kind !== "NOT_APPLICABLE") ||
    (input.arrangement === "BASE_PLUS_COMMISSION" &&
      base.kind === "NOT_APPLICABLE")
  )
    throw new TypeError("C06 base applicability contradicts the arrangement");

  const missing = unresolved([sales, rate]);
  const commission = result(
    missing ??
      (sales.kind === "KNOWN" && rate.kind === "KNOWN"
        ? Object.freeze({
            kind: "KNOWN" as const,
            value: quantity(
              sales.value.magnitude.multiply(
                rate.value.magnitude.divide(ExactDecimal.from("100")),
              ),
              "MONETARY_AMOUNT",
              "PHP",
              sales.value.basis,
            ),
          })
        : (() => {
            throw new TypeError("Incomplete C06 commission inputs");
          })()),
  );
  if (input.arrangement === "STRAIGHT_COMMISSION")
    return Object.freeze({
      arrangement: input.arrangement,
      baseSalary: Object.freeze({ kind: "NOT_APPLICABLE" as const }),
      commission,
    });

  const period = input.periodAlignment;
  if (
    !record(period, ["salesBasis", "baseSalaryBasis", "compensationBasis"]) ||
    ![period.salesBasis, period.baseSalaryBasis].every(
      (basis) =>
        basis === null ||
        (typeof basis === "string" &&
          basis.trim() !== "" &&
          basis.trim() === basis),
    ) ||
    typeof period.compensationBasis !== "string" ||
    !period.compensationBasis.trim() ||
    period.compensationBasis.trim() !== period.compensationBasis ||
    (sales.kind === "KNOWN" && sales.value.basis !== period.salesBasis) ||
    (base.kind === "KNOWN" && base.value.basis !== period.baseSalaryBasis)
  )
    throw new TypeError(
      "C06 total requires explicit matching source-period evidence",
    );
  if (base.kind === "NOT_APPLICABLE")
    throw new TypeError("Base-Plus requires an applicable base");
  const incomplete = unresolved([commission.resolution, base]);
  const total = result(
    incomplete ??
      (commission.resolution.kind === "KNOWN" && base.kind === "KNOWN"
        ? Object.freeze({
            kind: "KNOWN" as const,
            value: quantity(
              base.value.magnitude.add(commission.resolution.value.magnitude),
              "MONETARY_AMOUNT",
              "PHP",
              period.compensationBasis,
            ),
          })
        : (() => {
            throw new TypeError("Incomplete C06 total inputs");
          })()),
  );
  return Object.freeze({
    arrangement: input.arrangement,
    baseSalary: base,
    commission,
    totalCompensation: total,
  });
}
