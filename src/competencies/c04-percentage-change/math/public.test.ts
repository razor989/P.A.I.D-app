import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "../../../core/public";
import type { Quantity } from "../../../core/public";
import { calculateC04Change } from "./public";

// Test-only independent fixture; a non-literal import keeps the oracle's separate
// TS configuration out of the production project's root typecheck graph.
const oraclePath: string = "../../../../tests/oracles/public";
type OracleExpectation = Readonly<{
  resolution: string;
  availability: string;
  magnitude: string | null;
}>;
const { resolveOracle } = (await import(/* @vite-ignore */ oraclePath)) as {
  resolveOracle: (
    criteria: Readonly<{ id: string; caseId?: string }>,
  ) => Readonly<{
    expected: OracleExpectation | null;
  }>;
};

const decimal = (text: string) => ExactDecimal.from(text);
const money = (
  text: string,
  kind = "MONETARY_AMOUNT",
  unit = "PHP",
  basis: string | null = "per month",
) => quantity(decimal(text), kind, unit, basis);

const cases = [
  ["C04-S01", "18000", "18000", "0", "0", "NO_CHANGE", null],
  ["C04-S02-A", "20000", "22000", "2000", "10", "INCREASE", "C04-S02-A"],
  ["C04-S02-B", "10000", "12000", "2000", "20", "INCREASE", "C04-S02-B"],
  ["C04-S03", "30000", "27000", "-3000", "-10", "DECREASE", null],
] as const;

describe("C04 original-relative pure mathematics", () => {
  it.each(cases)(
    "%s yields exact signed difference and percentage",
    (id, original, next, difference, percent, direction, child) => {
      const computed = calculateC04Change(money(original), money(next));
      expect(computed.direction).toBe(direction);
      expect(computed.difference.availability).toBe("AVAILABLE");
      expect(computed.difference.resolution.kind).toBe("KNOWN");
      expect(computed.percentageChange.availability).toBe("AVAILABLE");
      expect(computed.percentageChange.resolution.kind).toBe("KNOWN");
      if (
        computed.difference.resolution.kind !== "KNOWN" ||
        computed.percentageChange.resolution.kind !== "KNOWN" ||
        computed.relativeChange.resolution.kind !== "KNOWN"
      )
        throw new Error("Known inputs must resolve");
      expect(
        computed.difference.resolution.value.magnitude.equals(
          decimal(difference),
        ),
      ).toBe(true);
      expect(computed.difference.resolution.value).toMatchObject({
        kind: "MONETARY_AMOUNT",
        unit: "PHP",
        basis: "per month",
      });
      expect(
        computed.percentageChange.resolution.value.magnitude.equals(
          decimal(percent),
        ),
      ).toBe(true);
      expect(computed.percentageChange.resolution.value).toMatchObject({
        kind: "PERCENTAGE_CHANGE",
        unit: "%",
        basis: null,
      });
      expect(
        computed.relativeChange.resolution.value
          .multiply(decimal("100"))
          .equals(decimal(percent)),
      ).toBe(true);
      const oracle = resolveOracle({
        id: `${id}:percentage-change`,
        ...(child === null ? {} : { caseId: child }),
      });
      expect(oracle.expected?.resolution).toBe("KNOWN");
      expect(
        computed.percentageChange.resolution.value.magnitude.equals(
          decimal(oracle.expected!.magnitude!),
        ),
      ).toBe(true);
    },
  );

  it("uses each Original, not New, as denominator and preserves roles when swapped", () => {
    const a = calculateC04Change(money("20000"), money("22000"));
    const b = calculateC04Change(money("10000"), money("12000"));
    const swapped = calculateC04Change(money("20000"), money("18000"));
    expect(a.difference.resolution.kind).toBe("KNOWN");
    expect(b.difference).toEqual(a.difference);
    if (
      a.percentageChange.resolution.kind !== "KNOWN" ||
      b.percentageChange.resolution.kind !== "KNOWN"
    )
      throw new Error("Expected known percentages");
    expect(a.percentageChange.resolution.value.magnitude.toString()).toBe("10");
    expect(b.percentageChange.resolution.value.magnitude.toString()).toBe("20");
    expect(swapped.direction).toBe("DECREASE");
    expect(
      swapped.difference.resolution.kind === "KNOWN" &&
        swapped.difference.resolution.value.magnitude.toString(),
    ).toBe("-2000");
    expect(() => calculateC04Change(money("3"), money("4"))).toThrow(
      "Nonterminating decimal division requires explicit precision and rounding",
    );
  });

  it("keeps zero Original known, difference available, and numeric percentage undefined/withheld", () => {
    const change = calculateC04Change(money("0"), money("1500"));
    expect(change.direction).toBe("INCREASE");
    expect(change.difference).toEqual({
      resolution: { kind: "KNOWN", value: money("1500") },
      availability: "AVAILABLE",
    });
    expect(change.relativeChange).toEqual({
      resolution: { kind: "UNDEFINED", reason: "Original value is zero" },
      availability: "WITHHELD",
    });
    expect(change.percentageChange).toEqual({
      resolution: { kind: "UNDEFINED", reason: "Original value is zero" },
      availability: "WITHHELD",
    });
    expect("value" in change.percentageChange.resolution).toBe(false);
    const differenceOracle = resolveOracle({
      id: "C04-S04:absolute-difference",
    });
    const percentageOracle = resolveOracle({ id: "C04-S04:percentage-change" });
    expect(differenceOracle.expected).toMatchObject({
      resolution: "KNOWN",
      availability: "AVAILABLE",
      magnitude: "+1500",
    });
    expect(percentageOracle.expected).toMatchObject({
      resolution: "UNDEFINED",
      availability: "WITHHELD",
      magnitude: null,
    });
    expect(
      change.difference.resolution.kind === "KNOWN" &&
        change.difference.resolution.value.magnitude.equals(
          decimal(differenceOracle.expected!.magnitude!),
        ),
    ).toBe(true);
    expect(change.percentageChange.resolution.kind).toBe(
      percentageOracle.expected?.resolution,
    );
    expect(change.percentageChange.availability).toBe(
      percentageOracle.expected?.availability,
    );
  });

  it("preserves frozen core interoperability, input identity, deterministic immutable outputs", () => {
    const original = money("10000");
    const next = money("12000");
    const result = calculateC04Change(original, next);
    expect(calculateC04Change(original, next)).toEqual(result);
    expect(original.magnitude.toString()).toBe("10000");
    expect(next.magnitude.toString()).toBe("12000");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.difference)).toBe(true);
    expect(Object.isFrozen(result.difference.resolution)).toBe(true);
    expect(Object.isFrozen(result.percentageChange.resolution)).toBe(true);
    expect(() => Object.assign(result, { direction: "DECREASE" })).toThrow(
      TypeError,
    );
    expect(() =>
      Object.assign(result.difference.resolution, { kind: "UNDEFINED" }),
    ).toThrow(TypeError);
  });

  it("rejects invalid quantities, mismatched identity and negative inputs without conversion", () => {
    for (const wrong of [
      money("1", "MONETARY_RATE"),
      money("1", "MONETARY_AMOUNT", "USD"),
      money("1", "MONETARY_AMOUNT", "PHP", "per week"),
    ]) {
      expect(() => calculateC04Change(money("1"), wrong)).toThrow(TypeError);
    }
    for (const invalid of [
      null,
      undefined,
      "0",
      0,
      NaN,
      Infinity,
      {
        magnitude: "1",
        kind: "MONETARY_AMOUNT",
        unit: "PHP",
        basis: "per month",
      },
      { magnitude: decimal("1"), kind: "", unit: "PHP", basis: "per month" },
    ]) {
      expect(() => calculateC04Change(invalid as Quantity, money("1"))).toThrow(
        TypeError,
      );
    }
    expect(() => calculateC04Change(money("-1"), money("2"))).toThrow(
      RangeError,
    );
    expect(() => calculateC04Change(money("1"), money("-2"))).toThrow(
      RangeError,
    );
    expect(() => ExactDecimal.from(NaN as unknown as string)).toThrow(
      TypeError,
    );
    expect(() => ExactDecimal.from("Infinity")).toThrow(TypeError);
  });
});
