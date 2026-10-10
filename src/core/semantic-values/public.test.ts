import { describe, expect, it } from "vitest";
import {
  known,
  notApplicable,
  result,
  undefinedResult,
  unknown,
  type DomainResolution,
} from "./public";

function describeResolution(value: DomainResolution<number>): string {
  switch (value.kind) {
    case "KNOWN":
      return `known: ${value.value}`;
    case "NOT_APPLICABLE":
      return "not applicable";
    case "UNKNOWN":
      return `missing: ${value.reason}`;
    case "UNDEFINED":
      return `undefined: ${value.reason}`;
    default: {
      const exhaustive: never = value;
      throw new Error(`Invalid domain state: ${String(exhaustive)}`);
    }
  }
}

describe("semantic boundaries", () => {
  it("preserves KNOWN(0), distinct from NOT_APPLICABLE", () => {
    expect(known(0)).toEqual({ kind: "KNOWN", value: 0 });
    expect(notApplicable<number>()).toEqual({ kind: "NOT_APPLICABLE" });
    expect(describeResolution(known(0))).toBe("known: 0");
    expect(describeResolution(notApplicable())).toBe("not applicable");
  });

  it("keeps UNKNOWN missing input and UNDEFINED established-input operation distinct", () => {
    expect(describeResolution(unknown("required basis not established"))).toBe(
      "missing: required basis not established",
    );
    expect(describeResolution(undefinedResult("original is zero"))).toBe(
      "undefined: original is zero",
    );
  });

  it("keeps availability separate, including when withholding either nonnumeric cause", () => {
    const missing = unknown<number>("required input absent");
    const undefinedMath = undefinedResult<number>("original zero");
    expect(result(known(0), "AVAILABLE")).toEqual({
      resolution: known(0),
      availability: "AVAILABLE",
    });
    expect(result(missing, "WITHHELD")).toEqual({
      resolution: missing,
      availability: "WITHHELD",
    });
    expect(result(undefinedMath, "WITHHELD")).toEqual({
      resolution: undefinedMath,
      availability: "WITHHELD",
    });
    expect(result(missing, "AVAILABLE").resolution).toBe(missing);
  });

  it("rejects sentinel inputs and invalid availability instead of silently collapsing states", () => {
    for (const invalid of [null, undefined, NaN, "", false]) {
      expect(() => known(invalid)).toThrow(TypeError);
    }
    for (const invalid of ["", "  ", null]) {
      expect(() => unknown(invalid as string)).toThrow(TypeError);
      expect(() => undefinedResult(invalid as string)).toThrow(TypeError);
    }
    expect(() => result(known(0), "UNKNOWN" as "AVAILABLE")).toThrow(TypeError);
  });

  it("exhaustively dispatches every valid state and fails closed on an invalid runtime state", () => {
    expect(
      [
        known(0),
        notApplicable<number>(),
        unknown<number>("missing"),
        undefinedResult<number>("no result"),
      ].map(describeResolution),
    ).toEqual([
      "known: 0",
      "not applicable",
      "missing: missing",
      "undefined: no result",
    ]);
    expect(() =>
      describeResolution({
        kind: "WITHHELD",
      } as unknown as DomainResolution<number>),
    ).toThrow("Invalid domain state");
    // Technical read failures are errors, not fabricated UNKNOWN domain values.
    expect(() => {
      throw new Error("persistence read failed");
    }).toThrow("persistence read failed");
  });

  it("accepts nonnumeric known values for later exact-decimal objects without arithmetic", () => {
    const decimalLike = Object.freeze({ digits: "0" });
    expect(known(decimalLike)).toEqual({ kind: "KNOWN", value: decimalLike });
  });
});
