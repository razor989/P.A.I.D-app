import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "../../../core/public";
import { applyC04ModelIntent, createC04ModelState } from "../model/public";
import type { C04ModelDefinition } from "../model/public";
import { evaluateC04Response } from "./public";
import type { C04EvaluationDefinition } from "./public";

const money = (amount: string) =>
  quantity(ExactDecimal.from(amount), "MONETARY_AMOUNT", "PHP", "per month");
const percent = (amount: string) =>
  quantity(ExactDecimal.from(amount), "PERCENTAGE_CHANGE", "%", null);
const pair = (
  original: string,
  next: string,
  label: string,
  childId: string | null = null,
) => ({
  childId,
  original: { role: `Original ${label} reference`, value: money(original) },
  newValue: { role: `New ${label}`, value: money(next) },
});
const fixtures = [
  {
    activityId: "C04-A01",
    scenarioId: "C04-S01",
    cases: [pair("18000", "18000", "salary")],
  },
  {
    activityId: "C04-A02",
    scenarioId: "C04-S02",
    cases: [
      pair("20000", "22000", "C04-S02-A salary", "C04-S02-A"),
      pair("10000", "12000", "C04-S02-B salary", "C04-S02-B"),
    ],
  },
  {
    activityId: "C04-A03",
    scenarioId: "C04-S03",
    cases: [pair("30000", "27000", "advertised monthly offer")],
  },
  {
    activityId: "C04-A04",
    scenarioId: "C04-S04",
    cases: [pair("0", "1500", "allowance")],
  },
] as const;
const selection = (id: string) =>
  ({ kind: "SINGLE_SELECTION", selectionId: id }) as const;
const exact = (value: ReturnType<typeof money>) =>
  ({ kind: "EXACT_QUANTITY", value }) as const;
const boundary = (kind: "UNDEFINED" | "UNKNOWN" | "NOT_APPLICABLE") => ({
  kind: "SEMANTIC_BOUNDARY" as const,
  resolution:
    kind === "NOT_APPLICABLE"
      ? { kind }
      : { kind, reason: "Original value is zero" },
});
const response = (fields: Record<string, unknown>) => ({
  kind: "COMPOSITE",
  parts: Object.entries(fields).map(([key, value]) => ({
    key,
    response: value,
  })),
});
const make = (
  index: number,
  fields: readonly string[],
  choice?: "interpretation" | "comparison" | "explanation",
) =>
  ({
    state: createC04ModelState(fixtures[index] as C04ModelDefinition),
    fields,
    choices: choice
      ? [
          {
            key: choice,
            options: ["approved:yes", "approved:no"],
            correctId: "approved:yes",
          },
        ]
      : [],
  }) as C04EvaluationDefinition;

describe("C04 bounded evaluation", () => {
  const a01 = () =>
    make(
      0,
      ["original", "new", "difference", "interpretation"],
      "interpretation",
    );
  const a02 = () =>
    make(
      1,
      [
        "differenceA",
        "differenceB",
        "percentageA",
        "percentageB",
        "comparison",
      ],
      "comparison",
    );
  const a03 = () =>
    make(
      2,
      ["original", "new", "difference", "percentage", "interpretation"],
      "interpretation",
    );
  const a04 = () =>
    make(3, ["difference", "percentage", "explanation"], "explanation");
  const noChange = () =>
    response({
      original: exact(money("18000")),
      new: exact(money("18000")),
      difference: exact(money("0")),
      interpretation: selection("approved:yes"),
    });
  const compare = () =>
    response({
      differenceA: exact(money("2000")),
      differenceB: exact(money("2000")),
      percentageA: exact(percent("10")),
      percentageB: exact(percent("20")),
      comparison: selection("approved:yes"),
    });
  const decrease = () =>
    response({
      original: exact(money("30000")),
      new: exact(money("27000")),
      difference: exact(money("-3000")),
      percentage: exact(percent("-10")),
      interpretation: selection("approved:yes"),
    });
  const undefinedAnswer = () =>
    response({
      difference: exact(money("1500")),
      percentage: boundary("UNDEFINED"),
      explanation: selection("approved:yes"),
    });

  it("confirms known no-change, optional known 0%, never undefined", () => {
    expect(evaluateC04Response(a01(), noChange())).toEqual({
      outcome: "CONFIRMED",
      diagnostic: null,
    });
    const definition = make(
      0,
      ["original", "new", "difference", "percentage", "interpretation"],
      "interpretation",
    );
    const withPercent = response({
      original: exact(money("18000")),
      new: exact(money("18000")),
      difference: exact(money("0")),
      percentage: exact(percent("0")),
      interpretation: selection("approved:yes"),
    });
    expect(evaluateC04Response(definition, withPercent).outcome).toBe(
      "CONFIRMED",
    );
    withPercent.parts[3]!.response = boundary("UNDEFINED");
    expect(evaluateC04Response(definition, withPercent).outcome).toBe(
      "RECONSIDERATION",
    );
  });
  it("compares both employee-specific original denominators regardless of selected child", () => {
    const definition = a02();
    expect(evaluateC04Response(definition, compare()).outcome).toBe(
      "CONFIRMED",
    );
    const b = {
      ...definition,
      state: applyC04ModelIntent(definition.state, {
        type: "SELECT_CHILD",
        childId: "C04-S02-B",
      }),
    };
    expect(evaluateC04Response(b, compare()).outcome).toBe("CONFIRMED");
    const wrong = compare();
    wrong.parts[3]!.response = exact(percent("10"));
    expect(evaluateC04Response(b, wrong)).toEqual({
      outcome: "RECONSIDERATION",
      diagnostic: "RECONSIDER_QUANTITY",
    });
    wrong.parts[3]!.response = exact(percent("20"));
    wrong.parts[4]!.response = selection("approved:no");
    expect(evaluateC04Response(b, wrong).diagnostic).toBe(
      "RECONSIDER_INTERPRETATION",
    );
  });
  it("checks the signed advertised-offer decrease rather than a payroll deduction", () => {
    expect(evaluateC04Response(a03(), decrease()).outcome).toBe("CONFIRMED");
    const wrong = decrease();
    wrong.parts[3]!.response = exact(percent("10"));
    expect(evaluateC04Response(a03(), wrong).outcome).toBe("RECONSIDERATION");
    wrong.parts[3]!.response = exact(percent("-10"));
    wrong.parts[4]!.response = selection("approved:no");
    expect(evaluateC04Response(a03(), wrong).diagnostic).toBe(
      "RECONSIDER_DIRECTION",
    );
  });
  it("distinguishes incorrect roles, mixed employee originals and unsupported options", () => {
    const inverted = decrease();
    inverted.parts[0]!.response = exact(money("27000"));
    inverted.parts[1]!.response = exact(money("30000"));
    expect(evaluateC04Response(a03(), inverted)).toEqual({
      outcome: "RECONSIDERATION",
      diagnostic: "RECONSIDER_QUANTITY",
    });
    const detailed = make(
      1,
      [
        "originalA",
        "originalB",
        "differenceA",
        "differenceB",
        "percentageA",
        "percentageB",
        "comparison",
      ],
      "comparison",
    );
    const mixed = response({
      originalA: exact(money("20000")),
      originalB: exact(money("20000")),
      differenceA: exact(money("2000")),
      differenceB: exact(money("2000")),
      percentageA: exact(percent("10")),
      percentageB: exact(percent("20")),
      comparison: selection("approved:yes"),
    });
    expect(evaluateC04Response(detailed, mixed).outcome).toBe(
      "RECONSIDERATION",
    );
    const unknown = compare();
    unknown.parts[4]!.response = selection("invented option");
    expect(() => evaluateC04Response(a02(), unknown)).toThrow(TypeError);
    expect(() =>
      evaluateC04Response(
        {
          ...detailed,
          choices: [{ ...detailed.choices[0]!, correctId: "invented" }],
        },
        mixed,
      ),
    ).toThrow(TypeError);
  });
  it("accepts known absolute +1500 and semantic undefined without a numeric percentage", () => {
    const definition = a04();
    expect(evaluateC04Response(definition, undefinedAnswer())).toEqual({
      outcome: "CONFIRMED",
      diagnostic: null,
    });
    for (const invalid of [
      boundary("UNKNOWN"),
      boundary("NOT_APPLICABLE"),
      exact(percent("0")),
      exact(percent("100")),
    ]) {
      const wrong = undefinedAnswer();
      wrong.parts[1]!.response = invalid;
      expect(evaluateC04Response(definition, wrong).diagnostic).toBe(
        "RECONSIDER_UNDEFINED",
      );
    }
    const wrong = undefinedAnswer();
    wrong.parts[0]!.response = exact(money("0"));
    expect(evaluateC04Response(definition, wrong).diagnostic).toBe(
      "RECONSIDER_QUANTITY",
    );
  });
  it("T023-AUDIT-01: an undefined label cannot confirm a wrong or unverified explanation", () => {
    const definition = a04();
    const wrongChoice = undefinedAnswer();
    wrongChoice.parts[2]!.response = selection("approved:no");
    expect(evaluateC04Response(definition, wrongChoice)).toEqual({
      outcome: "RECONSIDERATION",
      diagnostic: "RECONSIDER_UNDEFINED",
    });
    const wrongReason = undefinedAnswer();
    wrongReason.parts[1]!.response = {
      kind: "SEMANTIC_BOUNDARY",
      resolution: {
        kind: "UNDEFINED",
        reason: "Because the denominator is 1500.",
      },
    };
    expect(evaluateC04Response(definition, wrongReason).outcome).toBe(
      "RECONSIDERATION",
    );
    for (const arbitrary of [
      "arbitrary explanation",
      "Original is zero, but use the New as denominator",
    ]) {
      const unverified = undefinedAnswer();
      unverified.parts[1]!.response = {
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "UNDEFINED", reason: arbitrary },
      };
      expect(evaluateC04Response(definition, unverified)).toEqual({
        outcome: "RECONSIDERATION",
        diagnostic: "RECONSIDER_UNDEFINED",
      });
    }
    const unsupported = response({
      difference: exact(money("1500")),
      percentage: boundary("UNDEFINED"),
    });
    expect(() => evaluateC04Response(definition, unsupported)).toThrow(
      TypeError,
    );
    expect(() =>
      evaluateC04Response({ ...definition, choices: [] }, undefinedAnswer()),
    ).toThrow(TypeError);
    expect(() =>
      evaluateC04Response(
        {
          ...definition,
          fields: ["difference", "percentage"],
        },
        undefinedAnswer(),
      ),
    ).toThrow(TypeError);
  });
  it("rejects malformed, unauthorized and forged contracts but reconsiders valid wrong quantities", () => {
    const def = a03();
    for (const bad of [
      null,
      { kind: "OTHER" },
      { ...decrease(), score: 1 },
      response({
        ...Object.fromEntries(decrease().parts.map((p) => [p.key, p.response])),
        extra: selection("approved:yes"),
      }),
      response({ original: exact(money("30000")) }),
    ])
      expect(() => evaluateC04Response(def, bad)).toThrow(TypeError);
    expect(() =>
      evaluateC04Response({ ...def, state: { ...def.state } }, decrease()),
    ).toThrow(TypeError);
    expect(() =>
      evaluateC04Response(
        { ...def, fields: [...def.fields, "extra"] } as C04EvaluationDefinition,
        decrease(),
      ),
    ).toThrow(TypeError);
    const wrong = decrease();
    wrong.parts[3]!.response = exact(
      quantity(ExactDecimal.from("-10"), "PERCENTAGE_CHANGE", "%", "per month"),
    );
    expect(evaluateC04Response(def, wrong).diagnostic).toBe(
      "RECONSIDER_REPRESENTATION",
    );
    wrong.parts[3]!.response = {
      kind: "EXACT_QUANTITY",
      value: { ...percent("0"), magnitude: Infinity },
    };
    expect(() => evaluateC04Response(def, wrong)).toThrow(TypeError);
  });
  it("is deterministic and freezes results", () => {
    const definition = a01();
    const value = evaluateC04Response(definition, noChange());
    expect(evaluateC04Response(definition, noChange())).toEqual(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(() => Object.assign(value, { outcome: "RECONSIDERATION" })).toThrow(
      TypeError,
    );
  });
});
