import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { DomainResolution, Quantity } from "@/core/public";
import { calculateC03OvertimePay, deriveC03Multiplier } from "./public";
import type { C03Condition } from "./public";

const known = <T>(value: T): DomainResolution<T> => ({ kind: "KNOWN", value });
const rate = (value: string) =>
  quantity(ExactDecimal.from(value), "MONETARY_RATE", "PHP", "per hour");
const hours = (value: string) =>
  quantity(ExactDecimal.from(value), "DURATION", "hours", null);
const compute = (r: string, c: C03Condition, h: string) =>
  calculateC03OvertimePay(known(rate(r)), known(c), known(hours(h)));

describe("C03 condition-linked exact mathematics", () => {
  // PP10-A-0202-C03-001 and final Amendment C §78: expected answers, not a second formula.
  it.each([
    ["S01", "100", "ordinary working day", "2", "250"],
    ["S02-A", "100", "ordinary working day", "2", "250"],
    ["S02-B", "100", "rest day", "2", "338"],
    ["S03", "75", "ordinary working day", "10", "937.5"],
    ["S04", "120", "regular holiday", "3", "936"],
  ] as const)("verifies %s exactly", (_, r, c, h, answer) => {
    expect(compute(r, c, h)).toEqual({
      resolution: {
        kind: "KNOWN",
        value: quantity(
          ExactDecimal.from(answer),
          "MONETARY_AMOUNT",
          "PHP",
          null,
        ),
      },
      availability: "AVAILABLE",
    });
  });

  it.each([
    ["ordinary working day", "1.25", "125"],
    ["rest day", "1.69", "169"],
    ["regular holiday", "2.60", "260"],
  ] as const)(
    "derives the approved %s multiplier, not a selected number",
    (c, m, p) => {
      const value = deriveC03Multiplier(c);
      expect(value).toEqual(
        quantity(ExactDecimal.from(m), "MULTIPLIER", "dimensionless", null),
      );
      expect(
        value.magnitude.multiply(ExactDecimal.from("100")).toString(),
      ).toBe(p);
    },
  );

  it("preserves exact comparison difference of PHP 88", () => {
    const a = compute("100", "ordinary working day", "2").resolution;
    const b = compute("100", "rest day", "2").resolution;
    if (a.kind !== "KNOWN" || b.kind !== "KNOWN")
      throw new Error("Missing answer");
    expect(b.value.magnitude.subtract(a.value.magnitude).toString()).toBe("88");
  });

  it("retains known zero hours as an established zero amount", () => {
    expect(compute("100", "ordinary working day", "0").resolution).toEqual({
      kind: "KNOWN",
      value: quantity(ExactDecimal.from("0"), "MONETARY_AMOUNT", "PHP", null),
    });
  });

  it.each(["rate", "condition", "hours"] as const)(
    "withholds for UNKNOWN %s without coercing it to zero",
    (missing) => {
      const unknown = {
        kind: "UNKNOWN",
        reason: `${missing} not established`,
      } as const;
      expect(
        calculateC03OvertimePay(
          missing === "rate" ? unknown : known(rate("100")),
          missing === "condition" ? unknown : known("ordinary working day"),
          missing === "hours" ? unknown : known(hours("0")),
        ),
      ).toEqual({ resolution: unknown, availability: "WITHHELD" });
    },
  );

  it.each([
    { kind: "NOT_APPLICABLE" },
    { kind: "UNDEFINED", reason: "Authorized upstream undefined operation" },
  ] as const)("does not replace $kind with UNKNOWN or zero", (resolution) => {
    expect(
      calculateC03OvertimePay(
        resolution,
        known("ordinary working day"),
        known(hours("2")),
      ),
    ).toEqual({ resolution, availability: "WITHHELD" });
  });

  it.each(["0", "-1"])("rejects established nonpositive rate %s", (r) => {
    expect(() => compute(r, "rest day", "2")).toThrow(RangeError);
  });
  it("rejects negative hours and does not let unknown mask invalid established quantities", () => {
    expect(() => compute("100", "rest day", "-0.1")).toThrow(RangeError);
    expect(() =>
      calculateC03OvertimePay(
        known(rate("0")),
        { kind: "UNKNOWN", reason: "condition missing" },
        known(hours("2")),
      ),
    ).toThrow(RangeError);
  });

  it.each([
    quantity(ExactDecimal.from("100"), "MONETARY_AMOUNT", "PHP", "per hour"),
    quantity(ExactDecimal.from("100"), "MONETARY_RATE", "USD", "per hour"),
    quantity(ExactDecimal.from("100"), "MONETARY_RATE", "PHP", "per month"),
  ])("rejects invalid hourly units/basis/kind", (value) => {
    expect(() =>
      calculateC03OvertimePay(
        known(value),
        known("rest day"),
        known(hours("2")),
      ),
    ).toThrow(TypeError);
  });
  it.each([
    quantity(ExactDecimal.from("2"), "DURATION", "days", null),
    quantity(ExactDecimal.from("2"), "DURATION", "hours", "per month"),
  ])("rejects implicit duration conversions", (value) => {
    expect(() =>
      calculateC03OvertimePay(
        known(rate("100")),
        known("rest day"),
        known(value),
      ),
    ).toThrow(TypeError);
  });

  it.each(["night shift", "holiday and rest day", "toString", "1.69", null])(
    "rejects unauthorized condition %s",
    (condition) => {
      expect(() => deriveC03Multiplier(condition as C03Condition)).toThrow(
        TypeError,
      );
    },
  );
  it.each([
    null,
    { kind: "WITHHELD" },
    { kind: "UNKNOWN", reason: "" },
    { kind: "KNOWN", value: 0 },
  ])(
    "fails technically on malformed domain input rather than inventing UNKNOWN",
    (value) => {
      expect(() =>
        calculateC03OvertimePay(
          value as DomainResolution<Quantity>,
          known("rest day"),
          known(hours("2")),
        ),
      ).toThrow();
    },
  );

  it("does not round fractional money or impose invented rate/hour caps or increments", () => {
    const fractional = compute(
      "0.001",
      "ordinary working day",
      "0.001",
    ).resolution;
    const large = compute(
      "1000000000",
      "regular holiday",
      "1000000",
    ).resolution;
    expect(
      fractional.kind === "KNOWN" && fractional.value.magnitude.toString(),
    ).toBe("0.00000125");
    expect(large.kind === "KNOWN" && large.value.magnitude.toString()).toBe(
      "2600000000000000",
    );
  });
});
