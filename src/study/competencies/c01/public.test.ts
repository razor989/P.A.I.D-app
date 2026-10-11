import { describe, expect, it } from "vitest";
import { composeStudyCatalog } from "../../catalog/public";
import {
  activityManifestSchema,
  competencyDefinitionSchema,
  scenarioDefinitionSchema,
} from "../../schemas/public";
import {
  c01Activities,
  c01Catalog,
  c01Competency,
  c01Copy,
  c01Scenarios,
  validateC01Local,
} from "./public";

// Literal §§11.0–11.1 transcription fingerprint, independently pinned in this test.
// Independent source-row comparison is also run against §11.1 during verification.
const SOURCE_COPY_FNV32 = "99e05c96";
const fingerprint = (text: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};
const roles = [
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-period-applicability",
    "reconsider-total",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-applicability",
    "reconsider-total",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "provider-callout",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-ownership",
    "reconsider-total",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "provider-callout",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-ownership",
    "reconsider-composition",
    "completion",
    "accessibility-summary",
  ],
] as const;

const catalogInput = () => ({
  complete: false,
  competencies: [c01Competency],
  activities: [...c01Activities],
  scenarios: [...c01Scenarios],
  contentIds: Object.keys(c01Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
const withFact = (
  scenarioIndex: number,
  factIndex: number,
  replacement: unknown,
) => {
  const input = catalogInput();
  input.scenarios[scenarioIndex] = {
    ...c01Scenarios[scenarioIndex]!,
    facts: c01Scenarios[scenarioIndex]!.facts.map((fact, index) =>
      index === factIndex ? replacement : fact,
    ) as (typeof c01Scenarios)[number]["facts"],
  };
  return input;
};

describe("frozen C01 four-activity bank", () => {
  it("pins canonical inventory, owners, ordering, successor chain, model roles", () => {
    expect(c01Catalog.competencies.size).toBe(1);
    expect(c01Catalog.activities.size).toBe(4);
    expect(c01Catalog.scenarios.size).toBe(4);
    expect(c01Competency.activityIds).toEqual([
      "C01-A01",
      "C01-A02",
      "C01-A03",
      "C01-A04",
    ]);
    expect(
      c01Activities.map((a) => [
        a.id,
        a.instructionalFamily,
        a.scenarioIds,
        a.successorActivityId ?? null,
      ]),
    ).toEqual([
      ["C01-A01", "Prepare", ["C01-S01"], "C01-A02"],
      ["C01-A02", "Explore and Learn", ["C01-S02"], "C01-A03"],
      ["C01-A03", "Apply", ["C01-S03"], "C01-A04"],
      ["C01-A04", "Check and Transfer", ["C01-S04"], null],
    ]);
    expect(c01Activities.map((a) => a.modelBinding)).toEqual([
      {
        profileId: "Pay-Period Earnings Sheet",
        interactionProfileId: "Interactive — evaluative",
      },
      {
        profileId: "Pay-Period Earnings Sheet",
        interactionProfileId: "Interactive — explanatory/live",
      },
      {
        profileId: "Pay-Period Earnings Sheet",
        interactionProfileId: "Static semantic",
      },
      {
        profileId: "Pay-Period Earnings Sheet",
        interactionProfileId: "Static semantic",
      },
    ]);
    expect(
      c01Scenarios.map((s) => [s.id, s.competencyId, s.activityId]),
    ).toEqual([
      ["C01-S01", "C01", "C01-A01"],
      ["C01-S02", "C01", "C01-A02"],
      ["C01-S03", "C01", "C01-A03"],
      ["C01-S04", "C01", "C01-A04"],
    ]);
    expect(
      c01Activities.every((a) => a.competencyId === "C01" && !a.oracle),
    ).toBe(true);
    expect(c01Activities.map((a) => a.id)).not.toContain("C05-PV-JAMES-01");
  });

  it("pins each exact PHP component, period and separate March non-applicability", () => {
    const expected = [
      [
        ["April base salary", "18000", "KNOWN"],
        ["April meal allowance", "1200", "KNOWN"],
        ["paid March overtime payment", "900", "KNOWN"],
        ["March overtime applicability to April", null, "NOT_APPLICABLE"],
      ],
      [
        ["May regular pay", "17250", "KNOWN"],
        ["May transportation allowance", "1750", "KNOWN"],
      ],
      [
        ["C05-established regular pay for the month", "12000", "KNOWN"],
        ["C03-established overtime pay for the same month", "937.5", "KNOWN"],
      ],
      [
        ["June monthly base salary", "15000", "KNOWN"],
        ["C06-established June commission", "3600", "KNOWN"],
        ["June communication allowance", "800", "KNOWN"],
      ],
    ];
    expect(
      c01Scenarios.map((s) =>
        s.facts.map((f) => [
          f.key,
          f.resolution.kind === "KNOWN"
            ? f.resolution.value.magnitude.toString()
            : null,
          f.resolution.kind,
        ]),
      ),
    ).toEqual(expected);
    for (const scenario of c01Scenarios) {
      for (const fact of scenario.facts) {
        if (fact.resolution.kind === "KNOWN") {
          expect(fact.resolution.value).toMatchObject({
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: null,
          });
        }
      }
      expect(
        scenario.facts.every(
          (f) => !f.key.toLowerCase().includes("gross income"),
        ),
      ).toBe(true);
    }
    expect(c01Scenarios.map((s) => s.conditions)).toEqual([
      [
        "April gross-income pay period",
        "Meal allowance is part of April earnings",
        "March overtime was already paid in March",
      ],
      [
        "May gross-income pay period",
        "Employer includes transportation allowance in May earnings",
      ],
      ["Both established earnings belong to the same month"],
      [
        "June gross-income pay period",
        "Employer includes communication allowance in June earnings",
      ],
    ]);
  });

  it("pins only authorized C05/C03/C06 provider exports and established sources", () => {
    const expected = [
      {
        providerCompetencyId: "C05",
        consumerCompetencyId: "C01",
        sourceOutputKey: "converted pay value",
        sourceRecordId: "C05-PV-JAMES-01",
        relevantCondition: "James's established regular pay for the month",
      },
      {
        providerCompetencyId: "C03",
        consumerCompetencyId: "C01",
        sourceOutputKey: "overtime-pay value",
        sourceRecordId: "C03-S03",
        relevantCondition: "James's overtime pay for the same month",
      },
      {
        providerCompetencyId: "C06",
        consumerCompetencyId: "C01",
        sourceOutputKey: "commission amount",
        sourceRecordId: "C06-S04",
        relevantCondition: "Lina's established June commission",
      },
    ];
    expect(c01Scenarios[2]!.providerReferences).toEqual(expected.slice(0, 2));
    expect(c01Scenarios[3]!.providerReferences).toEqual(expected.slice(2));
    expect(c01Activities[2]!.providerReferences).toEqual(expected.slice(0, 2));
    expect(c01Activities[3]!.providerReferences).toEqual(expected.slice(2));
    expect(
      c01Activities
        .slice(0, 2)
        .every((a) => a.providerReferences === undefined),
    ).toBe(true);
  });

  it("pins all literal source roles, local lookup membership and no substitutions", () => {
    expect(c01Copy["GLO-08-C01"]).toBe(
      "Identify which earnings apply and combine them to determine gross income before deductions.",
    );
    expect(c01Copy["GLO-09-C01"]).toBe(
      "Work with the earnings established for the current pay period and combine only the amounts that belong in gross income.",
    );
    expect(Object.keys(c01Copy)).toHaveLength(36);
    expect(fingerprint(JSON.stringify(c01Copy))).toBe(SOURCE_COPY_FNV32);
    for (const [i, activity] of c01Activities.entries()) {
      expect(activity.contentReferences.map((r) => r.contentId)).toEqual([
        ...roles[i]!.map((role) => `c01/S0${i + 1}/${role}`),
        "GLO-08-C01",
        "GLO-09-C01",
      ]);
      expect(
        activity.contentReferences.every(
          (r) => r.variableIds.length === 0 && r.contentId in c01Copy,
        ),
      ).toBe(true);
    }
  });

  it("validates against accepted schemas, catalog and explicit C01-local closure", () => {
    expect(competencyDefinitionSchema.safeParse(c01Competency).success).toBe(
      true,
    );
    expect(
      c01Activities.every((a) => activityManifestSchema.safeParse(a).success),
    ).toBe(true);
    expect(
      c01Scenarios.every((s) => scenarioDefinitionSchema.safeParse(s).success),
    ).toBe(true);
    expect(() =>
      validateC01Local(c01Competency, c01Activities, c01Scenarios, c01Copy),
    ).not.toThrow();
    expect(composeStudyCatalog(catalogInput()).activities.size).toBe(4);
    expect(c01Catalog.activities.get("C01-A01")).toBe(c01Activities[0]);
  });

  it("deep-freezes catalog definitions and literal copy", () => {
    expect(Object.isFrozen(c01Copy)).toBe(true);
    expect(Object.isFrozen(c01Competency.activityIds)).toBe(true);
    expect(Object.isFrozen(c01Scenarios[0]!.facts[0]!.resolution)).toBe(true);
    expect(Object.isFrozen(c01Activities[2]!.providerReferences![0])).toBe(
      true,
    );
    expect(() =>
      Object.assign(c01Scenarios[0]!.facts[0]!.resolution, {
        kind: "NOT_APPLICABLE",
      }),
    ).toThrow();
    expect(() =>
      Object.assign(c01Copy, { "c01/S01/task": "changed" }),
    ).toThrow();
  });
});

describe("C01 rejects drift even when a partial catalog would defer external memberships", () => {
  it("rejects duplicate, extra, absent and supporting-record learner activities", () => {
    expect(() =>
      composeStudyCatalog({
        ...catalogInput(),
        activities: [...c01Activities, c01Activities[0]],
      }),
    ).toThrow();
    for (const activities of [
      c01Activities.slice(0, 3),
      [...c01Activities, { ...c01Activities[0], id: "C01-A05" }],
      [...c01Activities, { ...c01Activities[0], id: "C05-PV-JAMES-01" }],
    ])
      expect(() =>
        validateC01Local(
          c01Competency,
          activities as typeof c01Activities,
          c01Scenarios,
          c01Copy,
        ),
      ).toThrow();
  });

  it("rejects missing scenarios and wrong scenario assignments and ownership", () => {
    expect(() =>
      validateC01Local(
        c01Competency,
        c01Activities,
        c01Scenarios.slice(1),
        c01Copy,
      ),
    ).toThrow();
    expect(() =>
      validateC01Local(
        c01Competency,
        [
          { ...c01Activities[0]!, scenarioIds: ["C01-S02"] },
          ...c01Activities.slice(1),
        ],
        c01Scenarios,
        c01Copy,
      ),
    ).toThrow();
    expect(() =>
      composeStudyCatalog({
        ...catalogInput(),
        activities: [
          { ...c01Activities[0], scenarioIds: ["C01-S02"] },
          ...c01Activities.slice(1),
        ],
      }),
    ).toThrow();
    expect(
      competencyDefinitionSchema.safeParse({
        id: "C01",
        activityIds: ["C02-A01"],
      }).success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({
        ...c01Activities[0],
        competencyId: "C02",
      }).success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({
        ...c01Scenarios[0],
        activityId: "C02-A01",
      }).success,
    ).toBe(false);
  });

  it("rejects changed frozen amounts, periods, non-applicability and missing/null/zero substitutions", () => {
    const changed = withFact(0, 0, {
      key: "April base salary",
      resolution: {
        kind: "KNOWN",
        value: {
          magnitude: "18001",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
      },
    });
    expect(() =>
      validateC01Local(
        c01Competency,
        c01Activities,
        changed.scenarios,
        c01Copy,
      ),
    ).toThrow();
    for (const resolution of [
      null,
      undefined,
      {
        kind: "KNOWN",
        value: {
          magnitude: "0",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
      },
      { kind: "UNKNOWN", reason: "missing" },
      { kind: "UNDEFINED", reason: "undefined" },
    ]) {
      const input = withFact(0, 3, {
        key: "March overtime applicability to April",
        resolution,
      });
      expect(() =>
        validateC01Local(
          c01Competency,
          c01Activities,
          input.scenarios,
          c01Copy,
        ),
      ).toThrow();
    }
    const wrongPeriod = catalogInput();
    wrongPeriod.scenarios[0] = {
      ...c01Scenarios[0]!,
      conditions: ["March gross-income pay period"],
    };
    expect(() =>
      validateC01Local(
        c01Competency,
        c01Activities,
        wrongPeriod.scenarios,
        c01Copy,
      ),
    ).toThrow();
    expect(
      scenarioDefinitionSchema.safeParse(
        withFact(0, 3, {
          key: "March overtime applicability to April",
          resolution: null,
        }).scenarios[0],
      ).success,
    ).toBe(false);
  });

  it("rejects missing and invalid source-copy roles", () => {
    const missing = { ...c01Copy } as Record<string, string>;
    delete missing["c01/S03/provider-callout"];
    expect(() =>
      validateC01Local(c01Competency, c01Activities, c01Scenarios, missing),
    ).toThrow();
    const invalid = { ...c01Copy, "c01/S02/task": "" };
    expect(() =>
      validateC01Local(c01Competency, c01Activities, c01Scenarios, invalid),
    ).toThrow();
    const refs = [
      {
        ...c01Activities[0]!,
        contentReferences: [{ contentId: "unapproved", variableIds: [] }],
      },
      ...c01Activities.slice(1),
    ];
    expect(() =>
      validateC01Local(c01Competency, refs, c01Scenarios, c01Copy),
    ).toThrow();
  });

  it("rejects forged provider edges and C06 total compensation", () => {
    const unsupported = {
      ...c01Scenarios[3]!.providerReferences![0],
      sourceOutputKey: "total compensation",
    };
    expect(
      scenarioDefinitionSchema.safeParse({
        ...c01Scenarios[3],
        providerReferences: [unsupported],
      }).success,
    ).toBe(false);
    for (const [scenarioIndex, changed] of [
      [3, unsupported],
      [
        3,
        {
          ...c01Scenarios[3]!.providerReferences![0],
          sourceRecordId: "C06-S03",
        },
      ],
      [
        2,
        {
          ...c01Scenarios[2]!.providerReferences![0],
          sourceRecordId: "C05-S99",
        },
      ],
    ] as const) {
      const altered = c01Scenarios.map((scenario, index) =>
        index === scenarioIndex
          ? { ...scenario, providerReferences: [changed] }
          : scenario,
      );
      expect(() =>
        validateC01Local(
          c01Competency,
          c01Activities,
          altered as typeof c01Scenarios,
          c01Copy,
        ),
      ).toThrow();
    }
  });
});
