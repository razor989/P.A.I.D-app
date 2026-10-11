import { describe, expect, it } from "vitest";
import {
  ExactDecimal,
  isActivityId,
  isProviderRecordId,
  isScenarioId,
} from "../../../core/public";
import { composeStudyCatalog } from "../../catalog/public";
import {
  activityManifestSchema,
  scenarioDefinitionSchema,
} from "../../schemas/public";
import {
  c05Activities,
  c05Catalog,
  c05Competency,
  c05Copy,
  c05James,
  c05Relationships,
  c05RoleKeys,
  c05Scenarios,
  validateC05Local,
} from "./public";

const bank = () => ({
  competency: c05Competency,
  activities: [...c05Activities],
  scenarios: [...c05Scenarios],
  relationships: c05Relationships,
  james: c05James,
  copy: c05Copy,
  roles: c05RoleKeys,
});
const check = (data: ReturnType<typeof bank> = bank()) =>
  validateC05Local(
    data.competency,
    data.activities,
    data.scenarios,
    data.relationships,
    data.james,
    data.copy,
    data.roles,
  );
const mutateFact = (
  scenario: number,
  key: string,
  change: Record<string, unknown>,
) => {
  const data = bank();
  data.scenarios[scenario] = {
    ...data.scenarios[scenario]!,
    facts: data.scenarios[scenario]!.facts.map((f) =>
      f.key === key ? { ...f, ...change } : f,
    ),
  };
  return data;
};
const walk = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) walk(nested);
};

describe("C05 fixed source bank", () => {
  it("preserves one/five/five, two linked child states, two consecutive Apply activities and successor order", () => {
    expect([
      c05Catalog.competencies.size,
      c05Catalog.activities.size,
      c05Catalog.scenarios.size,
    ]).toEqual([1, 5, 5]);
    expect(c05Competency.activityIds).toEqual([
      "C05-A01",
      "C05-A02",
      "C05-A03",
      "C05-A04",
      "C05-A05",
    ]);
    expect(
      c05Activities.map((a) => [
        a.id,
        a.instructionalFamily,
        a.scenarioIds,
        a.successorActivityId ?? null,
      ]),
    ).toEqual([
      ["C05-A01", "Prepare", ["C05-S01"], "C05-A02"],
      ["C05-A02", "Explore and Learn", ["C05-S02"], "C05-A03"],
      ["C05-A03", "Apply", ["C05-S03"], "C05-A04"],
      ["C05-A04", "Apply", ["C05-S04"], "C05-A05"],
      ["C05-A05", "Check and Transfer", ["C05-S05"], null],
    ]);
    expect(c05Scenarios[1]!.variants?.map((v) => v.id)).toEqual([
      "C05-S02-A",
      "C05-S02-B",
    ]);
    expect(c05Scenarios.filter((s) => s.variants)).toHaveLength(1);
    check();
  });
  it("uses exact source quantities, direction, schedule and conditional factors without a calculator", () => {
    expect(
      c05Scenarios.map((s) =>
        s.facts.map((f) => [
          f.key,
          f.resolution.kind === "KNOWN"
            ? [
                f.resolution.value.magnitude.toString(),
                f.resolution.value.kind,
                f.resolution.value.unit,
                f.resolution.value.basis,
              ]
            : null,
        ]),
      ),
    ).toEqual([
      [
        [
          "Office clerk annual salary",
          ["312000", "MONETARY_AMOUNT", "PHP", "per year"],
        ],
        ["Established weeks per year", ["52", "DURATION", "week", "per year"]],
      ],
      [
        [
          "Teacher annual salary",
          ["480000", "MONETARY_AMOUNT", "PHP", "per year"],
        ],
        [
          "C05-S02-B established monthly salary",
          ["40000", "MONETARY_AMOUNT", "PHP", "per month"],
        ],
        ["C05-S02-A months per year", ["12", "DURATION", "month", "per year"]],
        [
          "C05-S02-B semi-monthly pay periods per month",
          ["2", "DURATION", "semi-monthly pay period", "per month"],
        ],
      ],
      [
        [
          "Manager offered annual salary",
          ["936000", "MONETARY_AMOUNT", "PHP", "per year"],
        ],
        ["Established weeks per year", ["52", "DURATION", "week", "per year"]],
      ],
      [
        [
          "Part-time worker hourly wage",
          ["100", "MONETARY_RATE", "PHP", "per hour"],
        ],
        [
          "Regular hours explicitly established for this week",
          ["40", "DURATION", "hour", "this week"],
        ],
      ],
      [
        [
          "Employee current daily wage",
          ["4000", "MONETARY_RATE", "PHP", "per day"],
        ],
        ["Established workweek", ["5", "DURATION", "workday", "per week"]],
        [
          "Applicable annual factor",
          ["261", "DURATION", "workday", "per year"],
        ],
        [
          "Established months per year",
          ["12", "DURATION", "month", "per year"],
        ],
      ],
    ]);
    expect(
      Object.values(c05Relationships).map((r) => [
        r.givenBasis,
        r.targetBasis,
        r.missingBasis.kind,
      ]),
    ).toEqual([
      ["per year", "per week", "UNKNOWN"],
      ["per year", "per semi-monthly pay period", "UNKNOWN"],
      ["per year", "per week", "UNKNOWN"],
      ["per hour", "per week", "UNKNOWN"],
      ["per day", "per month", "UNKNOWN"],
    ]);
    expect(c05Relationships["C05-S02"].steps).toEqual([
      { id: "C05-S02-A", from: "per year", to: "per month" },
      { id: "C05-S02-B", from: "per month", to: "per semi-monthly pay period" },
    ]);
    expect(c05Relationships["C05-S05"].steps).toEqual([
      { from: "per day", to: "per year" },
      { from: "per year", to: "per month" },
    ]);
    expect(c05Scenarios[2]!.conditions).toContain(
      "direct annual salary ÷ 52 weeks per year; no monthly or daily intermediate",
    );
    expect(c05Scenarios[4]!.conditions).toContain(
      "five-day workweek and 261-day annual factor are conditional to this arrangement; no actual attendance calendar",
    );
    expect(
      c05Scenarios
        .flatMap((s) => s.facts)
        .every(
          (f) =>
            f.resolution.kind === "KNOWN" &&
            f.resolution.value.magnitude instanceof ExactDecimal,
        ),
    ).toBe(true);
    expect(
      c05Scenarios
        .flatMap((s) => s.facts)
        .some(
          (f) =>
            f.resolution.kind === "KNOWN" &&
            f.resolution.value.magnitude.toString() === "313",
        ),
    ).toBe(false);
  });
  it("binds five exact R7 §13 model profiles rather than generic/swapped descriptors", () => {
    expect(
      c05Activities.map((a) => [
        a.modelBinding?.profileId,
        a.modelBinding?.interactionProfileId,
      ]),
    ).toEqual([
      ["Compensation Time-Basis Board", "Static semantic"],
      [
        "Compensation Time-Basis Board",
        "Interactive — approved partition sequence",
      ],
      ["Compensation Time-Basis Board", "Static semantic — direct conversion"],
      [
        "Compensation Time-Basis Board",
        "Static semantic — explicit schedule basis",
      ],
      [
        "Compensation Time-Basis Board",
        "Static semantic — fixed annual-factor basis",
      ],
    ]);
    for (const bad of [
      "Static semantic",
      "Interactive",
      "Static semantic — fixed annual-factor basis",
    ]) {
      const data = bank();
      data.activities[3] = {
        ...data.activities[3]!,
        modelBinding: {
          profileId: "Compensation Time-Basis Board",
          interactionProfileId: bad,
        },
      };
      expect(activityManifestSchema.safeParse(data.activities[3]).success).toBe(
        true,
      );
      expect(() => check(data)).toThrow();
    }
  });
  it("attaches 40 exact scenario roles and two GLOs without promoting role keys to canonical IDs", () => {
    expect(Object.keys(c05Copy)).toHaveLength(42);
    expect(
      c05Activities.map((a) => a.contentReferences.map((r) => r.contentId)),
    ).toEqual(
      c05RoleKeys.map((roles, i) => [
        ...roles.map((r) => `c05/S0${i + 1}/${r}`),
        "GLO-08-C05",
        "GLO-09-C05",
      ]),
    );
    expect(c05RoleKeys[3]).toContain("information-needed-boundary");
    expect(c05Copy["c05/S04/information-needed-boundary"]).toContain(
      "information needed",
    );
    expect(c05Copy["c05/S02/reconsider-second-state"]).toContain(
      "semi-monthly",
    );
    check();
  });
  it("keeps James an established separate provider record for C01 and C03, not a progress unit", () => {
    expect(isProviderRecordId(c05James.id)).toBe(true);
    expect(isActivityId(c05James.id) || isScenarioId(c05James.id)).toBe(false);
    expect(c05James.hourlyRate.magnitude.toString()).toBe("75");
    expect(c05James.regularHours.magnitude.toString()).toBe("160");
    expect(c05James.establishedRegularPay.magnitude.toString()).toBe("12000");
    expect([
      c05James.provenance.consumerCompetencyId,
      c05James.provenance.sourceOutputKey,
      c05James.hourlyRateProvenance.consumerCompetencyId,
      c05James.hourlyRateProvenance.sourceOutputKey,
    ]).toEqual([
      "C01",
      "wage/salary representation",
      "C03",
      "hourly-rate representation",
    ]);
    expect(c05Activities.map((a) => String(a.id))).not.toContain(c05James.id);
    expect(c05Scenarios.map((s) => String(s.id))).not.toContain(c05James.id);
  });
  it("rejects missing, duplicate, sixth and foreign primary identities and family/successor errors", () => {
    for (const field of ["activities", "scenarios"] as const) {
      for (const list of [
        bank()[field].slice(1),
        [...bank()[field], bank()[field][0]!],
        [...bank()[field].slice(0, 4), bank()[field][0]!],
      ]) {
        const data = bank();
        (data as Record<string, unknown>)[field] = list;
        expect(() => check(data)).toThrow();
      }
    }
    for (const field of ["activities", "scenarios"] as const) {
      const data = bank();
      data[field][0] = { ...data[field][0]!, id: "C06-S01" } as never;
      expect(() => check(data)).toThrow();
    }
    for (const change of [
      { instructionalFamily: "Apply" },
      { successorActivityId: "C05-A05" },
      { scenarioIds: ["C05-S02-A"] },
      { id: "C05-PV-JAMES-01" },
      { oracle: { oracleId: "answer" } },
      { runtime: {} },
      { evaluator: () => 1 },
      { progress: true },
    ]) {
      const data = bank();
      data.activities[1] = {
        ...data.activities[1]!,
        ...change,
      } as (typeof data.activities)[number];
      expect(() => check(data)).toThrow();
    }
    const data = bank();
    data.scenarios[1] = {
      ...data.scenarios[1]!,
      variants: [
        { id: "C05-S02-A", condition: "other" },
        { id: "C05-S02-B", condition: "other" },
      ],
    };
    expect(() => check(data)).toThrow();
  });
  it("rejects altered numbers, rates, periods, units, default factors and invented output facts", () => {
    for (const [index, key] of [
      [0, "Office clerk annual salary"],
      [1, "Teacher annual salary"],
      [2, "Manager offered annual salary"],
      [3, "Part-time worker hourly wage"],
      [4, "Employee current daily wage"],
      [1, "C05-S02-B established monthly salary"],
      [4, "Applicable annual factor"],
    ] as const) {
      for (const value of ["0", "313", "30"]) {
        const source = c05Scenarios[index]!.facts.find((f) => f.key === key)!;
        if (source.resolution.kind !== "KNOWN") throw Error();
        const original = source.resolution.value;
        expect(() =>
          check(
            mutateFact(index, key, {
              resolution: {
                kind: "KNOWN",
                value: { ...original, magnitude: ExactDecimal.from(value) },
              },
            }),
          ),
        ).toThrow();
      }
    }
    for (const [index, key] of [
      [0, "Established weeks per year"],
      [1, "C05-S02-B semi-monthly pay periods per month"],
      [3, "Regular hours explicitly established for this week"],
      [4, "Established workweek"],
    ] as const) {
      const source = c05Scenarios[index]!.facts.find((f) => f.key === key)!;
      if (source.resolution.kind !== "KNOWN") throw Error();
      for (const value of [
        { ...source.resolution.value, basis: "per hour" },
        { ...source.resolution.value, unit: "biweekly" },
        { ...source.resolution.value, magnitude: ExactDecimal.from("8") },
        100,
        { kind: "UNKNOWN", reason: "missing" },
        { kind: "UNDEFINED", reason: "missing" },
        { kind: "NOT_APPLICABLE" },
      ])
        expect(() =>
          check(
            mutateFact(index, key, {
              resolution:
                typeof value === "object" &&
                "kind" in value &&
                !("magnitude" in value)
                  ? value
                  : { kind: "KNOWN", value },
            }),
          ),
        ).toThrow();
    }
    for (const change of [
      {
        facts: [
          ...c05Scenarios[2]!.facts,
          {
            key: "invented monthly salary",
            resolution: {
              kind: "KNOWN",
              value: {
                magnitude: ExactDecimal.from("78000"),
                kind: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: "per month",
              },
            },
          },
        ],
      },
      { conditions: ["five days every week"] },
      { result: { value: 18000 } },
      { calculator: () => 18000 },
    ]) {
      const data = bank();
      data.scenarios[2] = {
        ...data.scenarios[2]!,
        ...change,
      } as (typeof data.scenarios)[number];
      expect(() => check(data)).toThrow();
    }
    expect(
      scenarioDefinitionSchema.safeParse({
        ...c05Scenarios[0],
        facts: [
          {
            key: "bad",
            resolution: {
              kind: "KNOWN",
              value: {
                magnitude: 1.1,
                kind: "MONETARY_RATE",
                unit: "PHP",
                basis: "per hour",
              },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("rejects James alterations, false periods, forged provenance and promotion", () => {
    for (const change of [
      {
        hourlyRate: {
          ...c05James.hourlyRate,
          magnitude: ExactDecimal.from("76"),
        },
      },
      {
        regularHours: {
          ...c05James.regularHours,
          magnitude: ExactDecimal.from("40"),
        },
      },
      {
        establishedRegularPay: {
          ...c05James.establishedRegularPay,
          magnitude: ExactDecimal.from("11999"),
        },
      },
      { workdays: 5 },
      { id: "C05-S06" },
      { provenance: { ...c05James.provenance, sourceRecordId: "C05-S99" } },
      {
        hourlyRateProvenance: {
          ...c05James.hourlyRateProvenance,
          sourceOutputKey: "converted pay value",
        },
      },
      {
        establishedRegularPay: {
          ...c05James.establishedRegularPay,
          basis: "per month",
        },
      },
    ]) {
      expect(() =>
        check({
          ...bank(),
          james: { ...c05James, ...change } as typeof c05James,
        }),
      ).toThrow();
    }
  });
  it("rejects missing/extra/moved copy, altered roles, relationships and unsupported semantics", () => {
    for (const copy of [
      { ...c05Copy, "c05/S04/information-needed-boundary": "incorrect" },
      { ...c05Copy, extra: "invention" },
      Object.fromEntries(Object.entries(c05Copy).slice(1)),
    ])
      expect(() =>
        check({ ...bank(), copy: copy as typeof c05Copy }),
      ).toThrow();
    expect(() =>
      check({ ...bank(), roles: c05RoleKeys.map((r) => r.slice(1)) }),
    ).toThrow();
    for (const change of [
      {
        "C05-S04": {
          ...c05Relationships["C05-S04"],
          missingBasis: { kind: "NOT_APPLICABLE" },
        },
      },
      { "C05-S05": { ...c05Relationships["C05-S05"], targetBasis: "per day" } },
      {
        "C05-S02": {
          ...c05Relationships["C05-S02"],
          steps: [{ from: "per year", to: "per week" }],
        },
      },
    ])
      expect(() =>
        check({
          ...bank(),
          relationships: {
            ...c05Relationships,
            ...change,
          } as typeof c05Relationships,
        }),
      ).toThrow();
  });
  it("uses T010 partial catalog without masking C05 errors or exposing a mutable catalog", () => {
    expect(
      composeStudyCatalog({
        complete: false,
        competencies: [c05Competency],
        activities: c05Activities,
        scenarios: c05Scenarios,
        contentIds: Object.keys(c05Copy),
        responseContractIds: [],
        modelProfileIds: [],
        interactionProfileIds: [],
        oracleIds: [],
      }).activities.size,
    ).toBe(5);
    expect(() =>
      composeStudyCatalog({
        complete: false,
        competencies: [c05Competency],
        activities: [...c05Activities, c05Activities[0]],
        scenarios: c05Scenarios,
        contentIds: Object.keys(c05Copy),
        responseContractIds: [],
        modelProfileIds: [],
        interactionProfileIds: [],
        oracleIds: [],
      }),
    ).toThrow();
  });
  it("deep-freezes all exported arrays, nested records, James and content without leaking mutable copies", () => {
    for (const value of [
      c05Activities,
      c05Scenarios,
      c05Competency,
      c05Catalog,
      c05Copy,
      c05RoleKeys,
      c05Relationships,
      c05James,
    ])
      walk(value);
    expect(() => (c05RoleKeys as unknown[]).push([])).toThrow();
    expect(() => (c05RoleKeys[0] as unknown[]).push("invented")).toThrow();
    expect(() => (c05Activities as unknown[]).reverse()).toThrow();
    expect(() => (c05Scenarios[1]!.facts as unknown[]).pop()).toThrow();
    expect(() => (c05Scenarios[1]!.variants as unknown[]).pop()).toThrow();
    expect(() => {
      (c05James as { role: string }).role = "other";
    }).toThrow();
    expect(() => {
      (c05James.provenance as { sourceOutputKey: string }).sourceOutputKey =
        "other";
    }).toThrow();
    expect(() =>
      (c05Activities[0]!.contentReferences as unknown[]).pop(),
    ).toThrow();
    expect(() =>
      (c05Relationships["C05-S02"].steps as unknown[]).pop(),
    ).toThrow();
    check();
  });
});
