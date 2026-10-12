import { describe, expect, it } from "vitest";
import {
  ExactDecimal,
  isProviderRead,
  isScenarioChildId,
} from "../../../core/public";
import { composeStudyCatalog } from "../../catalog/public";
import {
  activityManifestSchema,
  scenarioDefinitionSchema,
} from "../../schemas/public";
import {
  c06Activities,
  c06Cases,
  c06Catalog,
  c06CommissionProvider,
  c06Competency,
  c06Copy,
  c06RoleKeys,
  c06Scenarios,
  validateC06Local,
} from "./public";

const bank = () => ({
  competency: c06Competency,
  activities: [...c06Activities],
  scenarios: [...c06Scenarios],
  cases: c06Cases,
  provider: c06CommissionProvider,
  copy: c06Copy as Readonly<Record<string, string>>,
  roles: c06RoleKeys,
});
type Bank = ReturnType<typeof bank>;
const check = (data: Bank = bank()) =>
  validateC06Local(
    data.competency,
    data.activities,
    data.scenarios,
    data.cases,
    data.provider,
    data.copy,
    data.roles,
  );
const reject = (data: Bank) =>
  expect(() => check(data)).toThrow("C06 fixed local");
const changeActivity = (index: number, change: Record<string, unknown>) => {
  const data = bank();
  data.activities[index] = { ...data.activities[index]!, ...change };
  return data;
};
const changeScenario = (index: number, change: Record<string, unknown>) => {
  const data = bank();
  data.scenarios[index] = { ...data.scenarios[index]!, ...change };
  return data;
};
const changeCase = (
  scenario: "C06-S01" | "C06-S02",
  index: number,
  change: Record<string, unknown>,
) =>
  ({
    ...c06Cases,
    [scenario]: c06Cases[scenario].map((state, i) =>
      i === index ? { ...state, ...change } : state,
    ),
  }) as typeof c06Cases;
const numbers = (value: unknown): unknown => {
  if (value instanceof ExactDecimal) return value.toString();
  if (Array.isArray(value)) return value.map(numbers);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, numbers(v)]),
    );
  return value;
};
const walk = (value: unknown): void => {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) walk(nested);
};

describe("C06 fixed source bank", () => {
  it("has exactly one competency, four ordered manifests and four primary scenarios", () => {
    expect([
      c06Catalog.competencies.size,
      c06Catalog.activities.size,
      c06Catalog.scenarios.size,
    ]).toEqual([1, 4, 4]);
    expect(c06Competency.activityIds).toEqual([
      "C06-A01",
      "C06-A02",
      "C06-A03",
      "C06-A04",
    ]);
    expect(
      c06Activities.map((a) => [
        a.id,
        a.instructionalFamily,
        a.scenarioIds,
        a.successorActivityId ?? null,
      ]),
    ).toEqual([
      ["C06-A01", "Prepare", ["C06-S01"], "C06-A02"],
      ["C06-A02", "Explore and Learn", ["C06-S02"], "C06-A03"],
      ["C06-A03", "Apply", ["C06-S03"], "C06-A04"],
      ["C06-A04", "Check and Transfer", ["C06-S04"], null],
    ]);
    expect(c06Scenarios.map((s) => s.id)).toEqual([
      "C06-S01",
      "C06-S02",
      "C06-S03",
      "C06-S04",
    ]);
    for (const [i, id] of ["C06-S01", "C06-S02"].entries()) {
      expect(c06Scenarios[i]!.variants!.map((s) => s.id)).toEqual([
        `${id}-A`,
        `${id}-B`,
      ]);
      expect(
        c06Scenarios[i]!.variants!.every((s) => isScenarioChildId(s.id)),
      ).toBe(true);
    }
    expect(c06Scenarios.filter((s) => s.variants)).toHaveLength(2);
    check();
  });

  it("stores six exact typed input cases, not independently stored calculated answers", () => {
    const states = [
      ...c06Cases["C06-S01"],
      ...c06Cases["C06-S02"],
      c06Cases["C06-S03"],
      c06Cases["C06-S04"],
    ];
    expect(
      states.map((s) => [
        s.arrangement,
        numbers(s.sales),
        numbers(s.commissionRate),
        numbers(s.baseSalary),
      ]),
    ).toEqual([
      [
        "STRAIGHT_COMMISSION",
        {
          magnitude: "80000",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
        { magnitude: "5", kind: "PERCENTAGE_RATE", unit: "%", basis: null },
        { kind: "NOT_APPLICABLE" },
      ],
      [
        "BASE_PLUS_COMMISSION",
        {
          magnitude: "80000",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
        { magnitude: "5", kind: "PERCENTAGE_RATE", unit: "%", basis: null },
        {
          kind: "KNOWN",
          value: {
            magnitude: "10000",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: "per month",
          },
        },
      ],
      [
        "BASE_PLUS_COMMISSION",
        {
          magnitude: "300000",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: "per month",
        },
        { magnitude: "3", kind: "PERCENTAGE_RATE", unit: "%", basis: null },
        {
          kind: "KNOWN",
          value: {
            magnitude: "15000",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: "per month",
          },
        },
      ],
      [
        "BASE_PLUS_COMMISSION",
        {
          magnitude: "500000",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: "per month",
        },
        { magnitude: "3", kind: "PERCENTAGE_RATE", unit: "%", basis: null },
        {
          kind: "KNOWN",
          value: {
            magnitude: "15000",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: "per month",
          },
        },
      ],
      [
        "STRAIGHT_COMMISSION",
        {
          magnitude: "2000000",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
        { magnitude: "5", kind: "PERCENTAGE_RATE", unit: "%", basis: null },
        { kind: "NOT_APPLICABLE" },
      ],
      [
        "BASE_PLUS_COMMISSION",
        {
          magnitude: "120000",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: "June",
        },
        { magnitude: "3", kind: "PERCENTAGE_RATE", unit: "%", basis: null },
        {
          kind: "KNOWN",
          value: {
            magnitude: "15000",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: "per month",
          },
        },
      ],
    ]);
    expect(c06Cases["C06-S01"][0]!.sales.magnitude.toString()).toBe(
      c06Cases["C06-S01"][1]!.sales.magnitude.toString(),
    );
    expect(c06Cases["C06-S01"][0]!.commissionRate.magnitude.toString()).toBe(
      c06Cases["C06-S01"][1]!.commissionRate.magnitude.toString(),
    );
    expect(c06Cases["C06-S02"][0]!.commissionRate.magnitude.toString()).toBe(
      c06Cases["C06-S02"][1]!.commissionRate.magnitude.toString(),
    );
    expect(numbers(c06Cases["C06-S02"][0]!.baseSalary)).toEqual(
      numbers(c06Cases["C06-S02"][1]!.baseSalary),
    );
    for (const state of states) {
      expect(
        "commission" in state ||
          "totalCompensation" in state ||
          "formula" in state,
      ).toBe(false);
      expect(state.sales.magnitude).toBeInstanceOf(ExactDecimal);
    }
    expect(c06Scenarios[3]!.facts.map((f) => f.key)).toEqual([
      "Sales base",
      "Commission rate",
      "Base salary",
    ]);
  });

  it("binds all four literal R7 profiles and exactly its own eight roles plus two GLOs", () => {
    expect(c06Activities.map((a) => a.modelBinding)).toEqual([
      {
        profileId: "Modular Commission Machine",
        interactionProfileId: "Interactive — arrangement structure",
      },
      {
        profileId: "Modular Commission Machine",
        interactionProfileId: "Interactive — approved sales comparison",
      },
      {
        profileId: "Modular Commission Machine",
        interactionProfileId: "Static semantic — straight commission",
      },
      {
        profileId: "Modular Commission Machine",
        interactionProfileId: "Static semantic — base plus commission",
      },
    ]);
    expect(Object.keys(c06Copy)).toHaveLength(34);
    expect(c06RoleKeys.map((roles) => roles.length)).toEqual([8, 8, 8, 8]);
    for (const [i, activity] of c06Activities.entries()) {
      expect(activity.contentReferences.map((ref) => ref.contentId)).toEqual([
        ...c06RoleKeys[i]!.map((role) => `c06/S0${i + 1}/${role}`),
        "GLO-08-C06",
        "GLO-09-C06",
      ]);
      expect(
        activity.contentReferences.every((ref) => ref.variableIds.length === 0),
      ).toBe(true);
    }
    expect(c06RoleKeys[3]).toContain("provider-note");
    expect(
      c06RoleKeys
        .slice(0, 3)
        .every((roles) => !roles.includes("provider-note")),
    ).toBe(true);
    expect(
      c06Activities.every(
        (a) => a.oracle === undefined && a.providerReferences === undefined,
      ),
    ).toBe(true);
  });

  it("whitelists only the established C06-S04 commission for C01-S04 read-only review", () => {
    expect(c06CommissionProvider.consumerScenarioId).toBe("C01-S04");
    expect(isProviderRead(c06CommissionProvider.read)).toBe(true);
    expect(numbers(c06CommissionProvider.read)).toEqual({
      kind: "ESTABLISHED",
      provenance: {
        providerCompetencyId: "C06",
        consumerCompetencyId: "C01",
        sourceRecordId: "C06-S04",
        sourceOutputKey: "commission amount",
        relevantCondition: "Lina's established June commission",
      },
      result: {
        availability: "AVAILABLE",
        resolution: {
          kind: "KNOWN",
          value: {
            magnitude: "3600",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: null,
          },
        },
      },
    });
    expect(JSON.stringify(c06CommissionProvider)).not.toContain("18600");
    check();
  });

  it("rejects duplicate, foreign, missing, extra and promoted progress/scenario records", () => {
    for (const entries of [
      [c06Activities[0]!, ...c06Activities.slice(0, 3)],
      c06Activities.slice(1),
      [...c06Activities, { ...c06Activities[0]!, id: "C06-A05" }],
      [...c06Activities, { ...c06Activities[0]!, id: "C05-A01" }],
    ])
      reject({ ...bank(), activities: entries as Bank["activities"] });
    for (const entries of [
      [c06Scenarios[0]!, ...c06Scenarios.slice(0, 3)],
      c06Scenarios.slice(1),
      [...c06Scenarios, { ...c06Scenarios[0]!, id: "C06-S05" }],
      [...c06Scenarios, { ...c06Scenarios[0]!, id: "C06-S01-A" }],
      [...c06Scenarios, { ...c06Scenarios[0]!, id: "C05-S01" }],
    ])
      reject({ ...bank(), scenarios: entries as Bank["scenarios"] });
    reject({
      ...bank(),
      competency: {
        ...c06Competency,
        activityIds: [
          "C06-A01",
          "C06-A02",
          "C06-A03",
          "C06-A04",
          "C06-S01-A" as "C06-A01",
        ],
      },
    });
    reject(changeActivity(0, { instructionalFamily: "Apply" }));
    reject(changeActivity(0, { successorActivityId: "C06-A03" }));
    reject(changeActivity(0, { scenarioIds: ["C06-S02"] }));
    reject(changeScenario(0, { activityId: "C06-A02" }));
    reject(
      changeScenario(1, {
        variants: [{ id: "C06-S01-A", condition: "Worker A" }],
      }),
    );
  });

  it("rejects malformed worker/situation inputs, arrangements, applicability and invented states", () => {
    const wrong = (
      scenario: "C06-S01" | "C06-S02",
      index: number,
      change: Record<string, unknown>,
    ) => reject({ ...bank(), cases: changeCase(scenario, index, change) });
    for (const baseSalary of [
      {
        kind: "KNOWN",
        value: {
          magnitude: ExactDecimal.from("0"),
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
      },
      null,
      { kind: "UNKNOWN", reason: "missing" },
      { kind: "UNDEFINED", reason: "invalid" },
      undefined,
    ])
      wrong("C06-S01", 0, { baseSalary });
    wrong("C06-S01", 0, { arrangement: "BASE_PLUS_COMMISSION" });
    wrong("C06-S01", 1, { arrangement: "STRAIGHT_COMMISSION" });
    wrong("C06-S01", 0, { arrangement: "TIERED_COMMISSION" });
    wrong("C06-S01", 1, { baseSalary: { kind: "NOT_APPLICABLE" } });
    wrong("C06-S02", 0, {
      sales: {
        ...c06Cases["C06-S02"][0]!.sales,
        magnitude: ExactDecimal.from("400000"),
      },
    });
    wrong("C06-S02", 1, {
      commissionRate: {
        ...c06Cases["C06-S02"][1]!.commissionRate,
        magnitude: ExactDecimal.from("5"),
      },
    });
    wrong("C06-S02", 1, {
      baseSalary: {
        kind: "KNOWN",
        value: {
          ...c06Cases["C06-S02"][1]!.baseSalary.value,
          magnitude: ExactDecimal.from("16000"),
        },
      },
    });
    wrong("C06-S01", 0, {
      sales: { ...c06Cases["C06-S01"][0]!.sales, kind: "MONETARY_RATE" },
    });
    wrong("C06-S01", 0, {
      commissionRate: {
        ...c06Cases["C06-S01"][0]!.commissionRate,
        unit: "PHP",
      },
    });
    wrong("C06-S01", 0, {
      sales: { ...c06Cases["C06-S01"][0]!.sales, magnitude: 80000 },
    });
    wrong("C06-S01", 0, { id: "C06-S01-B" });
    wrong("C06-S02", 0, { slider: { min: 0, max: 1000000 } });
    wrong("C06-S02", 0, { quota: "100000" });
    wrong("C06-S02", 0, { tieredRate: "5%" });
    wrong("C06-S02", 0, { bonusThreshold: "100000" });
    wrong("C06-S02", 0, { inputRange: "arbitrary" });
    reject({
      ...bank(),
      cases: {
        ...c06Cases,
        "C06-S02": [
          ...c06Cases["C06-S02"],
          { ...c06Cases["C06-S02"][0], id: "C06-S02-C" },
        ],
      } as unknown as typeof c06Cases,
    });
    reject({
      ...bank(),
      cases: {
        ...c06Cases,
        "C06-S04": {
          ...c06Cases["C06-S04"],
          sales: { ...c06Cases["C06-S04"].sales, basis: "July" },
        },
      },
    });
    reject({
      ...bank(),
      cases: {
        ...c06Cases,
        "C06-S03": { ...c06Cases["C06-S03"], baseSalary: null },
      } as unknown as typeof c06Cases,
    });
  });

  it("rejects changed scenario facts, unsupported output metadata, and executable/result fields", () => {
    reject(
      changeScenario(3, {
        facts: [
          {
            key: "Sales base",
            resolution: {
              kind: "KNOWN",
              value: {
                magnitude: "120000",
                kind: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: "June",
              },
            },
          },
        ],
      }),
    );
    reject(
      changeScenario(2, {
        facts: [
          ...c06Scenarios[2]!.facts,
          {
            key: "commission",
            resolution: {
              kind: "KNOWN",
              value: {
                magnitude: "100000",
                kind: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: null,
              },
            },
          },
        ],
      }),
    );
    reject(
      changeScenario(3, {
        providerReferences: [
          {
            providerCompetencyId: "C05",
            consumerCompetencyId: "C01",
            sourceRecordId: "C05-PV-JAMES-01",
            sourceOutputKey: "converted pay value",
            relevantCondition: null,
          },
        ],
      }),
    );
    reject(changeActivity(3, { oracle: { oracleId: "invented-result" } }));
    reject(changeActivity(1, { controls: { salesSlider: true } }));
    reject({
      ...bank(),
      cases: {
        ...c06Cases,
        "C06-S04": { ...c06Cases["C06-S04"], totalCompensation: "18600" },
      } as typeof c06Cases,
    });
    reject({
      ...bank(),
      cases: {
        ...c06Cases,
        "C06-S04": { ...c06Cases["C06-S04"], allowance: "800" },
      } as typeof c06Cases,
    });
    reject({
      ...bank(),
      cases: {
        ...c06Cases,
        "C06-S04": { ...c06Cases["C06-S04"], calculate: () => 18600 },
      } as typeof c06Cases,
    });
  });

  it("rejects generic, swapped or source-incorrect model profiles and missing/altered/extra roles", () => {
    for (const value of [
      "Interactive",
      "Static semantic",
      "Interactive — approved sales comparison",
      "Static semantic — straight commission",
    ])
      reject(
        changeActivity(0, {
          modelBinding: {
            profileId: "Modular Commission Machine",
            interactionProfileId: value,
          },
        }),
      );
    reject(
      changeActivity(3, {
        modelBinding: {
          profileId: "Other model",
          interactionProfileId: "Static semantic — base plus commission",
        },
      }),
    );
    for (const copy of [
      { ...c06Copy, "c06/S04/provider-note": "wrong" },
      { ...c06Copy, extra: "extra" },
      Object.fromEntries(Object.entries(c06Copy).slice(1)),
    ])
      reject({ ...bank(), copy });
    reject({
      ...bank(),
      roles: c06RoleKeys.map((roles) =>
        roles.filter((role) => role !== "provider-note"),
      ),
    });
    reject({
      ...bank(),
      roles: c06RoleKeys.map((roles, i) =>
        i === 3
          ? roles.map((role) =>
              role === "provider-note" ? "reconsider-generic" : role,
            )
          : roles,
      ),
    });
    reject(
      changeActivity(2, {
        contentReferences: c06Activities[3]!.contentReferences,
      }),
    );
  });

  it("rejects provider amount, role, origin, consumer, conditions and forbidden exports", () => {
    const established = c06CommissionProvider.read;
    if (
      established.kind !== "ESTABLISHED" ||
      established.result.resolution.kind !== "KNOWN"
    )
      throw new Error("Expected established commission");
    const wrongProvider = (change: Record<string, unknown>) =>
      reject({
        ...bank(),
        provider: {
          ...c06CommissionProvider,
          ...change,
        },
      });
    for (const magnitude of ["18600", "15000", "120000", "19400", "800"])
      wrongProvider({
        read: {
          ...established,
          result: {
            ...established.result,
            resolution: {
              kind: "KNOWN",
              value: {
                ...established.result.resolution.value,
                magnitude: ExactDecimal.from(magnitude),
              },
            },
          },
        },
      });
    for (const sourceOutputKey of [
      "total compensation",
      "base salary",
      "sales",
      "commission rate",
      "gross income",
    ])
      wrongProvider({
        read: {
          ...established,
          provenance: { ...established.provenance, sourceOutputKey },
        },
      });
    for (const providerCompetencyId of ["C05", "C03", "C01"])
      wrongProvider({
        read: {
          ...established,
          provenance: { ...established.provenance, providerCompetencyId },
        },
      });
    wrongProvider({ consumerScenarioId: "C01-S03" });
    wrongProvider({
      read: {
        ...established,
        provenance: { ...established.provenance, sourceRecordId: "C06-S03" },
      },
    });
    wrongProvider({
      read: {
        ...established,
        provenance: { ...established.provenance, consumerCompetencyId: "C02" },
      },
    });
    wrongProvider({
      read: {
        ...established,
        result: { ...established.result, availability: "WITHHELD" },
      },
    });
  });

  it("parses with strict T010 schemas/catalog and rejects invalid local input even in partial-global mode", () => {
    for (const activity of c06Activities)
      expect(activityManifestSchema.safeParse(activity).success).toBe(true);
    for (const scenario of c06Scenarios)
      expect(scenarioDefinitionSchema.safeParse(scenario).success).toBe(true);
    expect(
      composeStudyCatalog({
        complete: false,
        competencies: [c06Competency],
        activities: c06Activities,
        scenarios: c06Scenarios,
        contentIds: Object.keys(c06Copy),
        responseContractIds: [],
        modelProfileIds: [],
        interactionProfileIds: [],
        oracleIds: [],
      }).scenarios.size,
    ).toBe(4);
    expect(() =>
      composeStudyCatalog({
        complete: false,
        competencies: [c06Competency],
        activities: [...c06Activities, c06Activities[0]],
        scenarios: c06Scenarios,
        contentIds: Object.keys(c06Copy),
        responseContractIds: [],
        modelProfileIds: [],
        interactionProfileIds: [],
        oracleIds: [],
      }),
    ).toThrow();
    reject(
      changeActivity(3, {
        modelBinding: {
          profileId: "Modular Commission Machine",
          interactionProfileId: "Static semantic",
        },
      }),
    );
  });

  it("deep-freezes exports and refuses mutation of outer/inner roles, states, quantities and provenance", () => {
    for (const value of [
      c06Catalog,
      c06Competency,
      c06Activities,
      c06Scenarios,
      c06Cases,
      c06CommissionProvider,
      c06Copy,
      c06RoleKeys,
    ])
      walk(value);
    expect(() => (c06RoleKeys as unknown[]).push([])).toThrow();
    expect(() => (c06RoleKeys[0] as unknown[]).push("invented")).toThrow();
    expect(() => (c06Activities as unknown[]).reverse()).toThrow();
    expect(() => (c06Scenarios[0]!.variants as unknown[]).pop()).toThrow();
    expect(() => (c06Cases["C06-S01"] as unknown[]).pop()).toThrow();
    expect(() => {
      (c06Cases["C06-S01"][0] as { arrangement: string }).arrangement = "OTHER";
    }).toThrow();
    expect(() => {
      (c06Cases["C06-S02"][0]!.sales as { unit: string }).unit = "USD";
    }).toThrow();
    expect(() => {
      (
        c06CommissionProvider as { consumerScenarioId: string }
      ).consumerScenarioId = "C01-S03";
    }).toThrow();
    const read = c06CommissionProvider.read;
    if (read.kind === "ESTABLISHED")
      expect(() => {
        (read.provenance as { sourceOutputKey: string }).sourceOutputKey =
          "total";
      }).toThrow();
    expect(() =>
      (c06Activities[0]!.contentReferences as unknown[]).pop(),
    ).toThrow();
    check();
  });
});
