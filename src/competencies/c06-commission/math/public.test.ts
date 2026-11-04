import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { DomainResolution, Quantity } from "@/core/public";
import { calculateC06Compensation } from "./public";
import type { C06CalculationInput } from "./public";

const amount = (v: string, basis: string | null = null) =>
  quantity(ExactDecimal.from(v), "MONETARY_AMOUNT", "PHP", basis);
const rate = (v: string) =>
  quantity(ExactDecimal.from(v), "PERCENTAGE_RATE", "%", null);
const known = (value: Quantity) => ({ kind: "KNOWN" as const, value });
const straight = (s = "80000", r = "5"): C06CalculationInput => ({
  arrangement: "STRAIGHT_COMMISSION",
  sales: known(amount(s)),
  commissionRate: known(rate(r)),
  baseSalary: { kind: "NOT_APPLICABLE" },
});
const plus = (s = "120000", r = "3", b = "15000"): C06CalculationInput => ({
  arrangement: "BASE_PLUS_COMMISSION",
  sales: known(amount(s, "June")),
  commissionRate: known(rate(r)),
  baseSalary: known(amount(b, "per month")),
  periodAlignment: {
    salesBasis: "June",
    baseSalaryBasis: "per month",
    compensationBasis: "June",
  },
});
const text = (v: DomainResolution<Quantity>) =>
  v.kind === "KNOWN" ? v.value.magnitude.toString() : v.kind;

describe("C06 exact commission mathematics", () => {
  // Approved Known-Answer Register: literal expected answers, not runtime result tables.
  it.each([
    ["S01-A", "80000", "5", null, "4000", null],
    ["S01-B", "80000", "5", "10000", "4000", "14000"],
    ["S02-A", "300000", "3", "15000", "9000", "24000"],
    ["S02-B", "500000", "3", "15000", "15000", "30000"],
    ["S03", "2000000", "5", null, "100000", null],
    ["S04", "120000", "3", "15000", "3600", "18600"],
  ] as const)("verifies %s", (_, s, r, b, c, t) => {
    const result = calculateC06Compensation(
      b === null ? straight(s, r) : plus(s, r, b),
    );
    expect(text(result.commission.resolution)).toBe(c);
    expect(result.commission.availability).toBe("AVAILABLE");
    if (result.arrangement === "BASE_PLUS_COMMISSION")
      expect(text(result.totalCompensation.resolution)).toBe(t);
    else {
      expect(result.baseSalary).toEqual({ kind: "NOT_APPLICABLE" });
      expect(result).not.toHaveProperty("totalCompensation");
    }
  });
  it.each([
    ["0", "5"],
    ["100", "0"],
  ])("preserves known zero %s/%s", (s, r) =>
    expect(
      text(calculateC06Compensation(straight(s, r)).commission.resolution),
    ).toBe("0"),
  );
  it("does not round intermediate or final values", () =>
    expect(
      text(
        calculateC06Compensation(straight("1.2345", "3.75")).commission
          .resolution,
      ),
    ).toBe("0.04629375"));
  it("does not invent universal caps", () =>
    expect(
      text(
        calculateC06Compensation(straight("1000000000000000000000", "125"))
          .commission.resolution,
      ),
    ).toBe("1250000000000000000000"));
  it.each(["sales", "commissionRate"] as const)(
    "unknown %s is not erased by zero",
    (key) => {
      const result = calculateC06Compensation({
        ...straight("0", "0"),
        [key]: { kind: "UNKNOWN", reason: "source missing" },
      });
      expect(result.commission).toEqual({
        resolution: { kind: "UNKNOWN", reason: "source missing" },
        availability: "WITHHELD",
      });
    },
  );
  it("preserves partial knowledge when base is missing", () => {
    const result = calculateC06Compensation({
      ...plus(),
      baseSalary: { kind: "UNKNOWN", reason: "base missing" },
    } as C06CalculationInput);
    expect(text(result.commission.resolution)).toBe("3600");
    if (result.arrangement !== "BASE_PLUS_COMMISSION")
      throw new Error("Expected Base-Plus");
    expect(result.totalCompensation).toEqual({
      resolution: { kind: "UNKNOWN", reason: "base missing" },
      availability: "WITHHELD",
    });
  });
  it.each([
    { kind: "NOT_APPLICABLE" },
    { kind: "UNDEFINED", reason: "upstream undefined" },
  ] as const)("preserves $kind cause", (value) =>
    expect(
      calculateC06Compensation({ ...straight(), sales: value }).commission,
    ).toEqual({ resolution: value, availability: "WITHHELD" }),
  );
  it("withholds dependent total for missing sales", () => {
    const result = calculateC06Compensation({
      ...plus(),
      sales: { kind: "UNKNOWN", reason: "sales missing" },
    });
    if (result.arrangement !== "BASE_PLUS_COMMISSION")
      throw new Error("Expected Base-Plus");
    expect(result.totalCompensation.availability).toBe("WITHHELD");
  });
  it.each(["sales", "commissionRate", "baseSalary"] as const)(
    "rejects negative %s",
    (key) =>
      expect(() =>
        calculateC06Compensation({
          ...plus(),
          [key]: known(
            key === "commissionRate"
              ? rate("-1")
              : amount("-1", key === "sales" ? "June" : "per month"),
          ),
        }),
      ).toThrow(RangeError),
  );
  it.each([
    { ...straight(), baseSalary: known(amount("0")) },
    { ...plus(), baseSalary: { kind: "NOT_APPLICABLE" } },
    { ...straight(), arrangement: "TIERED" },
    { ...straight(), commission: "4000" },
    { ...straight(), commissionRate: known(amount("5")) },
    {
      ...straight(),
      sales: known(
        quantity(ExactDecimal.from("80"), "MONETARY_AMOUNT", "USD", null),
      ),
    },
    {
      ...plus(),
      periodAlignment: {
        salesBasis: "May",
        baseSalaryBasis: "per month",
        compensationBasis: "June",
      },
    },
    { ...plus(), periodAlignment: undefined },
    { ...straight(), sales: { kind: "UNKNOWN", reason: "" } },
    { ...straight(), sales: { kind: "KNOWN", value: 80000 } },
  ])("rejects malformed/unsupported contract %#", (value) =>
    expect(() =>
      calculateC06Compensation(value as C06CalculationInput),
    ).toThrow(),
  );
  it("preserves period and does not mutate inputs", () => {
    const source = plus();
    const result = calculateC06Compensation(source);
    expect(Object.isFrozen(result)).toBe(true);
    if (
      result.arrangement !== "BASE_PLUS_COMMISSION" ||
      result.totalCompensation.resolution.kind !== "KNOWN"
    )
      throw new Error("Expected known total");
    expect(result.totalCompensation.resolution.value.basis).toBe("June");
    expect(source.sales.kind === "KNOWN" && source.sales.value.basis).toBe(
      "June",
    );
  });
  it("rejects getters without executing them", () => {
    let touched = false;
    const source = {
      ...straight(),
      get sales(): DomainResolution<Quantity> {
        touched = true;
        throw new Error("getter");
      },
    };
    expect(() => calculateC06Compensation(source)).toThrow(TypeError);
    expect(touched).toBe(false);
  });
});
