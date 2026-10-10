import { describe, expect, it } from "vitest";
import BigNumber from "bignumber.js";
import {
  DecimalDivisionByZeroError,
  DecimalPrecisionAuthorityError,
  ExactDecimal,
} from "./public";

const decimal = (value: string | ExactDecimal): ExactDecimal =>
  ExactDecimal.from(value);

describe("exact decimal", () => {
  it("adds, subtracts and multiplies without binary approximation or intermediate rounding", () => {
    expect(decimal("0.1").add(decimal("0.2")).equals(decimal("0.3"))).toBe(
      true,
    );
    expect(decimal("0.17").multiply(decimal("0.13")).toString()).toBe("0.0221");
    expect(decimal("0.001").multiply(decimal("0.001")).toString()).toBe(
      "0.000001",
    );
    expect(decimal("1.005").multiply(decimal("3")).toString()).toBe("3.015");
    expect(decimal("0.1").subtract(decimal("0.2")).toString()).toBe("-0.1");
  });

  it("preserves signed numbers and known zero with exact equality and ordering", () => {
    expect(decimal("-0.00").equals(decimal("0"))).toBe(true);
    expect(decimal("-2.500").equals(decimal("-2.5"))).toBe(true);
    expect(decimal("-2.5").compare(decimal("0"))).toBe(-1);
    expect(decimal("0").compare(decimal("0.00"))).toBe(0);
    expect(decimal("10.01").compare(decimal("10.001"))).toBe(1);
    expect(decimal("-5").add(decimal("5")).toString()).toBe("0");
    const exact = decimal("3");
    expect(decimal(exact)).toBe(exact);
  });

  it("rejects numbers, malformed and nonfinite decimal construction and operands", () => {
    for (const input of [
      0.1,
      NaN,
      Infinity,
      null,
      undefined,
      {},
      new BigNumber("1"),
      true,
    ]) {
      expect(() => decimal(input as string)).toThrow(TypeError);
    }
    for (const input of [
      "",
      " ",
      " 1",
      "1 ",
      ".5",
      "1.",
      "1e3",
      "NaN",
      "Infinity",
      "0x10",
      "1,000",
      "1.2.3",
    ]) {
      expect(() => decimal(input)).toThrow(TypeError);
    }
    expect(() => decimal("1").add(0.2 as unknown as ExactDecimal)).toThrow(
      TypeError,
    );
    expect(() => decimal("1").compare("2" as unknown as ExactDecimal)).toThrow(
      TypeError,
    );
    expect(() =>
      decimal("1").multiply(new BigNumber(2) as unknown as ExactDecimal),
    ).toThrow(TypeError);
    expect(() => +decimal("1")).toThrow(TypeError);
    expect(() => Number(decimal("1"))).toThrow(TypeError);
  });

  it("divides terminating decimals exactly, regardless of default division settings", () => {
    expect(decimal("1").divide(decimal("8")).toString()).toBe("0.125");
    expect(decimal("-1").divide(decimal("40")).toString()).toBe("-0.025");
    expect(decimal("0").divide(decimal("3")).toString()).toBe("0");
    expect(decimal("1").divide(decimal("0.0002")).toString()).toBe("5000");
    expect(decimal("1").divide(decimal("128")).toString()).toBe("0.0078125");
  });

  it("fails closed on repeating division and zero divisors without numeric sentinels", () => {
    expect(() => decimal("1").divide(decimal("3"))).toThrow(
      DecimalPrecisionAuthorityError,
    );
    expect(() => decimal("-2").divide(decimal("6"))).toThrow(
      DecimalPrecisionAuthorityError,
    );
    expect(() => decimal("1").divide(decimal("0"))).toThrow(
      DecimalDivisionByZeroError,
    );
    expect(() => decimal("0").divide(decimal("0"))).toThrow(
      DecimalDivisionByZeroError,
    );
    expect(() =>
      decimal("1").divide(decimal("0"), {
        decimalPlaces: 2,
        roundingMode: "UP",
      }),
    ).toThrow(DecimalDivisionByZeroError);
  });

  it("rounds only on an explicit scale and mode, without mutating exact intermediates", () => {
    const intermediate = decimal("1.005");
    expect(
      intermediate
        .quantize({ decimalPlaces: 2, roundingMode: "HALF_UP" })
        .toString(),
    ).toBe("1.01");
    expect(
      intermediate
        .quantize({ decimalPlaces: 2, roundingMode: "HALF_EVEN" })
        .toString(),
    ).toBe("1");
    expect(
      decimal("-1.239")
        .quantize({ decimalPlaces: 2, roundingMode: "DOWN" })
        .toString(),
    ).toBe("-1.23");
    expect(
      decimal("-1.231")
        .quantize({ decimalPlaces: 2, roundingMode: "UP" })
        .toString(),
    ).toBe("-1.24");
    expect(intermediate.toString()).toBe("1.005");
    expect(
      decimal("1")
        .divide(decimal("3"), { decimalPlaces: 4, roundingMode: "HALF_UP" })
        .toString(),
    ).toBe("0.3333");
    expect(
      decimal("2")
        .divide(decimal("3"), { decimalPlaces: 0, roundingMode: "UP" })
        .toString(),
    ).toBe("1");
    expect(
      decimal("1")
        .divide(decimal("8"), { decimalPlaces: 2, roundingMode: "HALF_UP" })
        .toString(),
    ).toBe("0.13");
    expect(decimal("1").divide(decimal("8")).toString()).toBe("0.125");
  });

  it("rejects absent or invalid quantization decisions and leaves global settings intact", () => {
    const before = BigNumber.config();
    for (const decision of [
      undefined,
      { decimalPlaces: -1, roundingMode: "UP" },
      { decimalPlaces: 1.5, roundingMode: "UP" },
      { decimalPlaces: 2, roundingMode: "INVALID" },
      { decimalPlaces: 1_000_000_001, roundingMode: "UP" },
    ]) {
      expect(() => decimal("1.25").quantize(decision as never)).toThrow(
        TypeError,
      );
      expect(() =>
        decimal("1").divide(decimal("3"), decision as never),
      ).toThrow();
    }
    decimal("1").divide(decimal("3"), {
      decimalPlaces: 3,
      roundingMode: "DOWN",
    });
    expect(BigNumber.config()).toEqual(before);
  });
});
