import { describe, expect, it } from "vitest";
import { ExactDecimal } from "../exact-decimal/public";
import { quantity } from "../quantities/public";
import { isProviderRead, parseProviderRead } from "./public";
import type { ProviderRead, ProviderProvenance } from "./public";

const provenance = {
  providerCompetencyId: "C06",
  consumerCompetencyId: "C01",
  sourceRecordId: "C06-S04",
  sourceOutputKey: "commission amount",
  relevantCondition: "base plus commission",
} as const;
const amount = quantity(
  ExactDecimal.from("3600"),
  "commission amount",
  "PHP",
  "per sale",
);
const established = {
  kind: "ESTABLISHED",
  provenance,
  result: {
    availability: "WITHHELD",
    resolution: { kind: "KNOWN", value: amount },
  },
} as const;

describe("provider ownership and provenance", () => {
  it("retains authorized origin, quantity, condition and withholding as a frozen snapshot", () => {
    const read = parseProviderRead(established);
    expect(read).toEqual(established);
    expect(Object.isFrozen(read)).toBe(true);
    if (read.kind !== "ESTABLISHED")
      throw new Error("unexpected technical failure");
    expect(Object.isFrozen(read.provenance)).toBe(true);
    expect(Object.isFrozen(read.result)).toBe(true);
    expect(Object.isFrozen(read.result.resolution)).toBe(true);
    if (read.result.resolution.kind !== "KNOWN")
      throw new Error("unexpected domain state");
    expect(Object.isFrozen(read.result.resolution.value)).toBe(true);
    expect(read.result.resolution.value.magnitude.toString()).toBe("3600");
    expect(read.result.resolution.value.basis).toBe("per sale");
    expect(() => {
      Object.assign(read.provenance, { sourceOutputKey: "other" });
    }).toThrow(TypeError);
  });

  it("accepts only confirmed edges and labels; excludes C06 total compensation", () => {
    expect(isProviderRead(established)).toBe(true);
    expect(Object.isFrozen(amount)).toBe(true);
    expect(
      isProviderRead({
        ...established,
        provenance: { ...provenance, sourceOutputKey: "Total Compensation" },
      }),
    ).toBe(false);
    expect(
      isProviderRead({
        ...established,
        provenance: { ...provenance, consumerCompetencyId: "C02" },
      }),
    ).toBe(false);
    expect(
      isProviderRead({
        ...established,
        provenance: { ...provenance, sourceRecordId: "C05-S01" },
      }),
    ).toBe(false);
    expect(
      isProviderRead({
        ...established,
        result: {
          availability: "AVAILABLE",
          resolution: {
            kind: "KNOWN",
            value: quantity(
              ExactDecimal.from("3600"),
              "gross-income result",
              "PHP",
              null,
            ),
          },
        },
      }),
    ).toBe(false);
    expect(
      isProviderRead({
        ...established,
        result: {
          availability: "AVAILABLE",
          resolution: {
            kind: "KNOWN",
            value: { ...amount, additional: "unapproved" },
          },
        },
      }),
    ).toBe(false);
    const hourly = {
      ...established,
      provenance: {
        providerCompetencyId: "C05",
        consumerCompetencyId: "C03",
        sourceRecordId: "C05-PV-JAMES-01",
        sourceOutputKey: "hourly-rate representation",
        relevantCondition: null,
      },
      result: {
        availability: "AVAILABLE",
        resolution: {
          kind: "KNOWN",
          value: quantity(
            ExactDecimal.from("75"),
            "hourly-rate representation",
            "PHP/hour",
            "regular hours",
          ),
        },
      },
    };
    expect(isProviderRead(hourly)).toBe(true);
  });

  it("retains semantic UNKNOWN under WITHHELD and distinguishes technical failures", () => {
    const missing = {
      ...established,
      result: {
        availability: "WITHHELD",
        resolution: {
          kind: "UNKNOWN",
          reason: "unresolved authoritative source",
        },
      },
    };
    expect(parseProviderRead(missing)).toEqual(missing);
    expect(
      isProviderRead({
        ...established,
        result: {
          availability: "WITHHELD",
          resolution: { kind: "UNDEFINED", reason: "undefined operation" },
        },
      }),
    ).toBe(true);
    expect(
      parseProviderRead({
        kind: "TECHNICAL_FAILURE",
        error: "storage read failed",
      }),
    ).toEqual({ kind: "TECHNICAL_FAILURE", error: "storage read failed" });
    expect(isProviderRead({ kind: "TECHNICAL_FAILURE", error: " " })).toBe(
      false,
    );
    expect(
      isProviderRead({
        ...missing,
        result: {
          ...missing.result,
          resolution: { kind: "UNKNOWN", reason: "" },
        },
      }),
    ).toBe(false);
  });

  it("does not require provider completion or expose calculation or mutation methods", () => {
    const read = parseProviderRead(established);
    expect("providerCompleted" in read).toBe(false);
    expect("recompute" in read).toBe(false);
    expect("replace" in read).toBe(false);
    expect(isProviderRead({ ...established, providerCompleted: true })).toBe(
      false,
    );
    expect(() =>
      parseProviderRead({
        ...established,
        provenance: { ...provenance, relevantCondition: " " },
      }),
    ).toThrow(TypeError);
  });
});

// @ts-expect-error unapproved provider edge
const wrongEdge: ProviderProvenance = {
  ...provenance,
  consumerCompetencyId: "C02",
};
const wrongKey: ProviderProvenance = {
  ...provenance,
  // @ts-expect-error forbidden C06 export
  sourceOutputKey: "Total Compensation",
};
function compileTimeReadonly(
  readOnly: Extract<ProviderRead, { kind: "ESTABLISHED" }>,
): void {
  // @ts-expect-error consumer cannot replace established result
  readOnly.result = established.result;
  // @ts-expect-error consumer cannot edit provenance
  readOnly.provenance.sourceOutputKey = "commission amount";
}
void compileTimeReadonly;
void wrongEdge;
void wrongKey;
