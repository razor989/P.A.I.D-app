import { describe, expect, it } from "vitest";
import { ExactDecimal, isProviderRead, quantity } from "@/core/public";
import type { LearnerResponse, Quantity } from "@/core/public";
type AtomicResponse = Extract<
  LearnerResponse,
  { kind: "COMPOSITE" }
>["parts"][number]["response"];
import {
  createC06ModelState,
  applyC06ModelIntent,
  deriveC06ModelState,
} from "../model/public";
import type { C06ModelCase, C06ModelDefinition } from "../model/public";
import {
  c06ResponseFields,
  c06ResponseReady,
  deriveC06ProviderOutput,
  evaluateC06Response,
} from "./public";

const money = (value: string, basis: string | null = null) =>
  quantity(ExactDecimal.from(value), "MONETARY_AMOUNT", "PHP", basis);
const percent = (value: string) =>
  quantity(ExactDecimal.from(value), "PERCENTAGE_RATE", "%", null);
const known = (value: Quantity) => ({ kind: "KNOWN" as const, value });
function fixture(index: 1 | 2 | 3 | 4): C06ModelDefinition {
  const scenarioId = `C06-S0${index}` as C06ModelDefinition["scenarioId"];
  const salesBasis = index === 2 ? "per month" : index === 4 ? "June" : null;
  const make = (
    sales: string,
    rate: string,
    base: string | null,
    child: "A" | "B" | null,
  ): C06ModelCase => ({
    childId: child
      ? (`${scenarioId}-${child}` as C06ModelCase["childId"])
      : null,
    sales: known(money(sales, salesBasis)),
    commissionRate: known(percent(rate)),
    ...(base === null
      ? {
          arrangement: "STRAIGHT_COMMISSION" as const,
          baseSalary: { kind: "NOT_APPLICABLE" as const },
        }
      : {
          arrangement: "BASE_PLUS_COMMISSION" as const,
          baseSalary: known(money(base, "per month")),
          periodAlignment: {
            salesBasis,
            baseSalaryBasis: "per month",
            compensationBasis: index === 4 ? "June" : "per month",
          },
        }),
  });
  return {
    activityId: `C06-A0${index}`,
    scenarioId,
    cases:
      index === 1
        ? [make("80000", "5", null, "A"), make("80000", "5", "10000", "B")]
        : index === 2
          ? [
              make("300000", "3", "15000", "A"),
              make("500000", "3", "15000", "B"),
            ]
          : [
              index === 3
                ? make("2000000", "5", null, null)
                : make("120000", "3", "15000", null),
            ],
  };
}
const exact = (value: Quantity): AtomicResponse => ({
  kind: "EXACT_QUANTITY",
  value,
});
const select = (selectionId: string): AtomicResponse => ({
  kind: "SINGLE_SELECTION",
  selectionId,
});
function answers(index: 1 | 2 | 3 | 4): Record<string, AtomicResponse> {
  return index === 1
    ? {
        expectation: select("DIFFERENT"),
        investigation: select("AGREEMENTS"),
      }
    : index === 2
      ? {
          fixedReason: select("AGREEMENT"),
          changeReason: select("COMMISSION"),
          orderReason: select("COMMISSION_FIRST"),
          rate: exact(percent("3")),
          base: exact(money("15000", "per month")),
          commissionA: exact(money("9000", "per month")),
          totalA: exact(money("24000", "per month")),
          commissionB: exact(money("15000", "per month")),
          totalB: exact(money("30000", "per month")),
        }
      : index === 3
        ? {
            arrangement: select("STRAIGHT_COMMISSION"),
            interpretation: select("COMMISSION_ONLY"),
            sales: exact(money("2000000")),
            rate: exact(percent("5")),
            commission: exact(money("100000")),
          }
        : {
            arrangement: select("BASE_PLUS_COMMISSION"),
            commission: exact(money("3600", "June")),
            total: exact(money("18600", "June")),
          };
}
const composite = (
  entries: Record<string, AtomicResponse>,
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: Object.entries(entries).map(([key, response]) => ({ key, response })),
});

describe("C06 evidence-based evaluators", () => {
  it("requires A03 structure and meaning commitments and diagnoses them independently", () => {
    const state = createC06ModelState(fixture(3));
    const correct = answers(3);
    const legacy = Object.fromEntries(
      Object.entries(correct).filter(
        ([key]) => key !== "arrangement" && key !== "interpretation",
      ),
    );
    expect(c06ResponseReady(state, composite(legacy))).toBe(false);
    expect(
      evaluateC06Response(
        state,
        composite({ ...correct, arrangement: select("BASE_PLUS_COMMISSION") }),
      ),
    ).toEqual({ outcome: "RECONSIDERATION", diagnostic: "ARRANGEMENT" });
    expect(
      evaluateC06Response(
        state,
        composite({ ...correct, interpretation: select("SALE_PROCEEDS") }),
      ),
    ).toEqual({ outcome: "RECONSIDERATION", diagnostic: "PAYMENT_MEANING" });
    expect(evaluateC06Response(state, composite(correct)).outcome).toBe(
      "CONFIRMED",
    );
  });
  it("checks each A02 role using source mathematics without completing a composite", () => {
    const state = createC06ModelState(fixture(2));
    for (const [key, response] of Object.entries(answers(2))) {
      const input = { kind: "COMPOSITE" as const, parts: [{ key, response }] };
      expect(c06ResponseReady(state, input)).toBe(false);
      expect(evaluateC06Response(state, input, key).outcome).toBe("CONFIRMED");
      const wrong = key.endsWith("Reason")
        ? select("WRONG")
        : exact(key === "rate" ? percent("1") : money("1", "per month"));
      expect(
        evaluateC06Response(
          state,
          { kind: "COMPOSITE", parts: [{ key, response: wrong }] },
          key,
        ).outcome,
      ).toBe("RECONSIDERATION");
    }
    expect(() =>
      evaluateC06Response(state, composite(answers(2)), "totalA"),
    ).toThrow();
    expect(() =>
      evaluateC06Response(
        createC06ModelState(fixture(1)),
        composite(answers(1)),
        "expectation",
      ),
    ).toThrow();
  });
  it.each([1, 2, 3, 4] as const)(
    "accepts complete known answers for A0%s without changing work or model",
    (index) => {
      const state = createC06ModelState(fixture(index));
      const response = composite(answers(index));
      const before = JSON.stringify(response);
      expect(c06ResponseReady(state, response)).toBe(true);
      expect(evaluateC06Response(state, response)).toEqual({
        outcome: "CONFIRMED",
        diagnostic: null,
      });
      expect(JSON.stringify(response)).toBe(before);
      expect(state).toEqual(createC06ModelState(fixture(index)));
    },
  );
  it.each([
    [1, "expectation", select("SAME"), "ARRANGEMENT"],
    [1, "expectation", select("UNSURE"), "NOT_APPLICABLE"],
    [2, "rate", exact(percent("5")), "INVARIANTS"],
    [2, "base", exact(money("9000", "per month")), "INVARIANTS"],
    [2, "commissionB", exact(money("16500", "per month")), "COMMISSION"],
    [2, "totalB", exact(money("15000", "per month")), "TOTAL_COMPENSATION"],
    [3, "sales", exact(money("100000")), "SALES_BASE"],
    [3, "rate", exact(percent("0.05")), "RATE"],
    [3, "commission", exact(money("10000000")), "COMMISSION"],
    [4, "arrangement", select("STRAIGHT_COMMISSION"), "ARRANGEMENT"],
    [4, "commission", exact(money("18600", "June")), "COMMISSION"],
    [4, "total", exact(money("19400", "June")), "TOTAL_COMPENSATION"],
  ] as const)(
    "diagnoses submitted A0%s %s evidence only",
    (index, key, replacement, diagnostic) => {
      const response = composite({ ...answers(index), [key]: replacement });
      const state = createC06ModelState(fixture(index));
      expect(c06ResponseReady(state, response)).toBe(true);
      expect(evaluateC06Response(state, response)).toEqual({
        outcome: "RECONSIDERATION",
        diagnostic,
      });
    },
  );
  it.each(["kind", "unit", "basis"] as const)(
    "retains wrong %s as checkable units evidence",
    (key) => {
      const value = {
        ...money("3600", "June"),
        [key]: key === "kind" ? "PERCENTAGE_RATE" : key === "unit" ? "%" : null,
      } as Quantity;
      const state = createC06ModelState(fixture(4));
      const response = composite({ ...answers(4), commission: exact(value) });
      expect(c06ResponseReady(state, response)).toBe(true);
      expect(evaluateC06Response(state, response).diagnostic).toBe("UNITS");
    },
  );
  it("keeps comparison answers independent of selected child", () => {
    const initial = createC06ModelState(fixture(2));
    const selected = applyC06ModelIntent(initial, {
      type: "SELECT_CHILD",
      childId: "C06-S02-B",
    });
    expect(evaluateC06Response(selected, composite(answers(2))).outcome).toBe(
      "CONFIRMED",
    );
    expect("selectedChildId" in initial && initial.selectedChildId).toBe(
      "C06-S02-A",
    );
    expect("selectedChildId" in selected && selected.selectedChildId).toBe(
      "C06-S02-B",
    );
  });
  it.each([
    ["fixedReason", "ALL_PAY", "INVARIANTS"],
    ["changeReason", "SALARY", "CAUSAL_CHANGE"],
    ["orderReason", "SALARY_FIRST", "CALCULATION_ORDER"],
  ])(
    "checks A02 reasoning %s even when every number is correct",
    (key, choice, diagnostic) => {
      const state = createC06ModelState(fixture(2));
      const response = composite({ ...answers(2), [key]: select(choice) });
      expect(c06ResponseReady(state, response)).toBe(true);
      expect(evaluateC06Response(state, response)).toEqual({
        outcome: "RECONSIDERATION",
        diagnostic,
      });
    },
  );
  it.each([1, 2, 3, 4] as const)(
    "rejects incomplete, duplicate, unknown and extra A0%s evidence",
    (index) => {
      const state = createC06ModelState(fixture(index));
      const response = composite(answers(index));
      if (response.kind !== "COMPOSITE") throw new Error("fixture");
      for (const invalid of [
        null,
        {},
        { ...response, parts: response.parts.slice(1) },
        { ...response, parts: [...response.parts, response.parts[0]] },
        {
          ...response,
          parts: response.parts.map((p, i) =>
            i === 0 ? { ...p, key: "unknown" } : p,
          ),
        },
        { ...response, cachedAnswer: "3600" },
      ]) {
        expect(c06ResponseReady(state, invalid)).toBe(false);
        expect(() => evaluateC06Response(state, invalid)).toThrow();
      }
      expect(c06ResponseFields[state.activityId].length).toBe(
        response.parts.length,
      );
    },
  );
  it("rejects unknown options, missing semantic values and forged exact storage", () => {
    const state = createC06ModelState(fixture(1));
    for (const replacement of [
      select("tiered"),
      {
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "UNKNOWN", reason: "missing" },
      } as const,
    ])
      expect(
        c06ResponseReady(
          state,
          composite({ ...answers(1), expectation: replacement }),
        ),
      ).toBe(false);
    const forged = Object.create(ExactDecimal.prototype) as ExactDecimal;
    expect(
      c06ResponseReady(
        createC06ModelState(fixture(3)),
        composite({
          ...answers(3),
          commission: exact({ ...money("1"), magnitude: forged }),
        }),
      ),
    ).toBe(false);
  });
  it("rejects accessor, hidden, cyclic and prototype payloads without invoking getters", () => {
    const state = createC06ModelState(fixture(3));
    let touched = false;
    const accessor = {
      get kind() {
        touched = true;
        return "COMPOSITE";
      },
    };
    const hidden = { ...composite(answers(3)) };
    Object.defineProperty(hidden, "cache", { value: "100000" });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const invalid of [
      accessor,
      hidden,
      cycle,
      Object.assign(Object.create({}) as object, composite(answers(3))),
    ])
      expect(c06ResponseReady(state, invalid)).toBe(false);
    expect(touched).toBe(false);
  });
  it("uses deterministic source role order, not caller diagnosis ordering", () => {
    const entries = {
      ...answers(3),
      sales: exact(money("1")),
      commission: exact(money("2")),
    };
    const input = composite(entries);
    if (input.kind !== "COMPOSITE") throw new Error("fixture");
    expect(
      evaluateC06Response(createC06ModelState(fixture(3)), {
        ...input,
        parts: [...input.parts].reverse(),
      }).diagnostic,
    ).toBe("SALES_BASE");
  });
});

describe("C06 Commission-only provider calculation", () => {
  it("exports exactly the established amount with June provenance, never Total", () => {
    const state = createC06ModelState(fixture(4));
    const output = deriveC06ProviderOutput(state);
    expect(isProviderRead(output)).toBe(true);
    expect(output.provenance).toEqual({
      providerCompetencyId: "C06",
      consumerCompetencyId: "C01",
      sourceRecordId: "C06-S04",
      sourceOutputKey: "commission amount",
      relevantCondition: "Lina's established June commission",
    });
    expect(output.result.resolution.kind).toBe("KNOWN");
    if (output.result.resolution.kind !== "KNOWN") throw new Error("fixture");
    expect(output.result.resolution.value).toEqual(money("3600"));
    expect(Object.keys(output)).toEqual(["kind", "provenance", "result"]);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.result.resolution.value)).toBe(true);
    expect(deriveC06ModelState(state).commission.resolution).toEqual(
      known(money("3600", "June")),
    );
    expect(JSON.stringify(output)).not.toContain("18600");
    expect(
      isProviderRead({
        ...output,
        provenance: {
          ...output.provenance,
          sourceOutputKey: "total compensation",
        },
      }),
    ).toBe(false);
  });
  it.each([1, 2, 3] as const)(
    "rejects non-Lina A0%s provider sources",
    (index) => {
      expect(() =>
        deriveC06ProviderOutput(createC06ModelState(fixture(index))),
      ).toThrow();
    },
  );
  it("rejects unissued model state", () => {
    expect(() =>
      deriveC06ProviderOutput({ activityId: "C06-A04", scenarioId: "C06-S04" }),
    ).toThrow();
  });
});
