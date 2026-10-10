import { describe, expect, it } from "vitest";
import {
  ExactDecimal,
  DecimalPrecisionAuthorityError,
} from "../exact-decimal/public";
import {
  known,
  notApplicable,
  result,
  undefinedResult,
  unknown,
} from "../semantic-values/public";
import {
  addQuantities,
  compareQuantities,
  isQuantity,
  quantity,
} from "./public";

const decimal = (value: string | ExactDecimal): ExactDecimal =>
  ExactDecimal.from(value);

describe("quantity identities", () => {
  it("keeps exact magnitude, kind, unit and representation without conversions", () => {
    const rate = quantity(
      decimal("4000.005"),
      "MONETARY_RATE",
      "PHP",
      "per day",
    );
    expect(rate).toEqual({
      magnitude: decimal("4000.005"),
      kind: "MONETARY_RATE",
      unit: "PHP",
      basis: "per day",
    });
    expect(isQuantity(rate)).toBe(true);
    expect(Object.isFrozen(rate)).toBe(true);
    expect(quantity(decimal("8"), "TIME", "hours", null).basis).toBeNull();
  });

  it("adds and compares only identical semantic identities, preserving exact results", () => {
    const left = quantity(decimal("0.1"), "MONETARY_AMOUNT", "PHP", null);
    const right = quantity(decimal("0.2"), "MONETARY_AMOUNT", "PHP", null);
    const combined = addQuantities(left, right);
    expect(combined.magnitude.equals(decimal("0.3"))).toBe(true);
    expect(compareQuantities(combined, right)).toBe(1);
    expect(compareQuantities(left, left)).toBe(0);
    expect(compareQuantities(left, right)).toBe(-1);
  });

  it("rejects units, bases, rates, salary representations and percent/multiplier role mismatches", () => {
    const reference = quantity(decimal("1"), "MONETARY_AMOUNT", "PHP", null);
    const mismatches = [
      quantity(decimal("1"), "MONETARY_AMOUNT", "USD", null),
      quantity(decimal("1"), "MONETARY_RATE", "PHP", "per day"),
      quantity(decimal("1"), "MONETARY_AMOUNT", "PHP", "per month"),
      quantity(decimal("1"), "TIME", "hours", null),
    ];
    for (const other of mismatches) {
      expect(() => addQuantities(reference, other)).toThrow(TypeError);
      expect(() => compareQuantities(reference, other)).toThrow(TypeError);
    }
    const rate = quantity(decimal("1"), "MONETARY_RATE", "PHP", "per day");
    expect(() =>
      addQuantities(
        rate,
        quantity(decimal("1"), "MONETARY_RATE", "PHP", "per week"),
      ),
    ).toThrow(TypeError);
    const percent = quantity(decimal("10"), "PERCENTAGE", "%", null);
    expect(() =>
      addQuantities(percent, quantity(decimal("1.1"), "MULTIPLIER", "1", null)),
    ).toThrow(TypeError);
    expect(() =>
      addQuantities(
        quantity(decimal("1"), "TIME", "hours", null),
        quantity(decimal("60"), "TIME", "minutes", null),
      ),
    ).toThrow(TypeError);
  });

  it("rejects invalid magnitude and missing semantic identities without a closed unit list", () => {
    expect(() =>
      quantity(2 as unknown as ExactDecimal, "TIME", "hours", null),
    ).toThrow(TypeError);
    expect(() => quantity(decimal("1"), "", "hours", null)).toThrow(TypeError);
    expect(() => quantity(decimal("1"), "TIME", " ", null)).toThrow(TypeError);
    expect(() => quantity(decimal("1"), "TIME", "hours", " ")).toThrow(
      TypeError,
    );
    expect(
      isQuantity({ magnitude: decimal("1"), kind: "TIME", unit: "hours" }),
    ).toBe(false);
    expect(
      isQuantity({ magnitude: 0, kind: "TIME", unit: "hours", basis: null }),
    ).toBe(false);
    expect(
      quantity(decimal("1"), "TIME", "custom authored unit", null).unit,
    ).toBe("custom authored unit");
  });

  it("keeps known exact zero distinct from all T007 resolution and exposure states", () => {
    const zero = quantity(decimal("0"), "MONETARY_AMOUNT", "PHP", null);
    expect(known(zero).kind).toBe("KNOWN");
    const knownZero = known(decimal("0"));
    if (knownZero.kind !== "KNOWN")
      throw new Error("Known zero must remain known");
    expect(knownZero.value.equals(decimal("0"))).toBe(true);
    expect(notApplicable().kind).toBe("NOT_APPLICABLE");
    expect(unknown("missing input").kind).toBe("UNKNOWN");
    expect(undefinedResult("established undefined operation").kind).toBe(
      "UNDEFINED",
    );
    expect(result(known(zero), "WITHHELD")).toEqual({
      resolution: known(zero),
      availability: "WITHHELD",
    });
    expect(() => decimal("1").divide(decimal("3"))).toThrow(
      DecimalPrecisionAuthorityError,
    );
  });
});
