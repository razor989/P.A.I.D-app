import { describe, expect, it } from "vitest";
import {
  isActivityId,
  isProviderRead,
  isScenarioChildId,
  isScenarioId,
} from "../../../core/public";
import { composeStudyCatalog } from "../../catalog/public";
import {
  activityManifestSchema,
  scenarioDefinitionSchema,
} from "../../schemas/public";
import {
  c02Activities,
  c02Catalog,
  c02Competency,
  c02Copy,
  c02PhilHealthFloor,
  c02RoleKeys,
  c02Scenarios,
  validateC02Local,
} from "./public";

const registry = () => ({
  complete: false,
  competencies: [c02Competency],
  activities: [...c02Activities],
  scenarios: [...c02Scenarios],
  contentIds: Object.keys(c02Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
const check = (
  input = registry(),
  support = c02PhilHealthFloor,
  copy: Readonly<Record<string, string>> = c02Copy,
) =>
  validateC02Local(
    input.competencies[0]!,
    input.activities,
    input.scenarios,
    support,
    copy,
  );
const changeFact = (scenario: number, key: string, resolution: unknown) => {
  const input = registry();
  input.scenarios[scenario] = {
    ...input.scenarios[scenario]!,
    facts: input.scenarios[scenario]!.facts.map((f) =>
      f.key === key ? { ...f, resolution } : f,
    ),
  } as (typeof input.scenarios)[number];
  return input;
};
const get = (scenario: number, key: string) => {
  const entry = c02Scenarios[scenario]!.facts.find((f) => f.key === key);
  expect(entry).toBeDefined();
  return entry!.resolution;
};
const amount = (scenario: number, key: string, value: string) => {
  const resolution = get(scenario, key);
  expect(resolution.kind).toBe("KNOWN");
  if (resolution.kind === "KNOWN") {
    expect(resolution.value.magnitude.toString()).toBe(value);
    expect(resolution.value).toMatchObject({
      kind: "MONETARY_AMOUNT",
      unit: "PHP",
      basis: null,
    });
  }
};

describe("C02 frozen study bank", () => {
  it("has one competency, four canonical ordered activities, four owned primary scenarios and successors", () => {
    expect([
      c02Catalog.competencies.size,
      c02Catalog.activities.size,
      c02Catalog.scenarios.size,
    ]).toEqual([1, 4, 4]);
    expect(c02Competency.activityIds).toEqual([
      "C02-A01",
      "C02-A02",
      "C02-A03",
      "C02-A04",
    ]);
    expect(
      c02Activities.map((a) => [
        a.id,
        a.instructionalFamily,
        a.scenarioIds,
        a.successorActivityId ?? null,
      ]),
    ).toEqual([
      ["C02-A01", "Prepare", ["C02-S01"], "C02-A02"],
      ["C02-A02", "Explore and Learn", ["C02-S02"], "C02-A03"],
      ["C02-A03", "Apply", ["C02-S03"], "C02-A04"],
      ["C02-A04", "Check and Transfer", ["C02-S04"], null],
    ]);
    expect(
      c02Scenarios.map((s) => [s.id, s.activityId, s.competencyId]),
    ).toEqual([
      ["C02-S01", "C02-A01", "C02"],
      ["C02-S02", "C02-A02", "C02"],
      ["C02-S03", "C02-A03", "C02"],
      ["C02-S04", "C02-A04", "C02"],
    ]);
    expect(c02Scenarios.every((s) => !s.variants)).toBe(true);
    expect(
      c02Activities.map((a) => a.modelBinding?.interactionProfileId),
    ).toEqual([
      "Interactive — evaluative",
      "Interactive — explanatory/live",
      "Static semantic",
      "Static semantic",
    ]);
    expect(() => check()).not.toThrow();
    expect(() => composeStudyCatalog(registry())).not.toThrow();
  });

  it("pins all established monthly facts, employee-only deductions and separate bases", () => {
    for (const [i, pairs] of (
      [
        [
          ["established monthly gross income", "12100"],
          ["SSS employee share", "600"],
          ["PhilHealth employee share", "302.5"],
          ["Pag-IBIG employee share", "200"],
          ["BIR withholding tax", "0"],
        ],
        [
          ["C01-S03 established monthly gross income", "12937.5"],
          ["source-established monthly regular/basic pay", "12000"],
          ["source-established overtime pay for same month", "937.5"],
          ["SSS employee share", "650"],
          ["PhilHealth employee share", "300"],
          ["Pag-IBIG employee share", "200"],
          ["BIR withholding tax", "0"],
        ],
        [
          ["established monthly gross/basic salary", "24000"],
          ["GSIS employee share", "2160"],
          ["PhilHealth employee share", "600"],
          ["Pag-IBIG employee share", "200"],
          ["taxable compensation for monthly BIR", "21040"],
          ["BIR withholding tax", "31.05"],
        ],
        [
          ["Job A established monthly gross income", "28000"],
          ["Job A monthly basic salary", "25000"],
          ["Job A explicitly non-taxable allowance", "3000"],
          ["Job A SSS employee share", "1400"],
          ["Job A PhilHealth employee share", "625"],
          ["Job A Pag-IBIG employee share", "200"],
          ["Job A BIR withholding tax", "291.3"],
          ["Job B established monthly gross income", "28000"],
          ["Job B monthly basic salary", "28000"],
          ["Job B SSS employee share", "1400"],
          ["Job B PhilHealth employee share", "700"],
          ["Job B Pag-IBIG employee share", "200"],
          ["Job B BIR withholding tax", "730.05"],
        ],
      ] as const
    ).entries()) {
      for (const [key, value] of pairs) amount(i, key, value);
      expect(
        c02Scenarios[i]!.conditions!.some((c) => c.includes("Monthly payroll")),
      ).toBe(true);
    }
    expect(c02Scenarios[0]!.conditions!.join(" ")).toContain(
      "MSC PHP 12000.00",
    );
    expect(c02Scenarios[1]!.conditions!.join(" ")).toContain(
      "MSC PHP 13000.00",
    );
    expect(c02Scenarios[1]!.conditions!.join(" ")).toContain(
      "PHP 10000.00 MFS",
    );
    expect(c02Scenarios[2]!.conditions!.join(" ")).toContain(
      "15% only on excess above PHP 20833.00",
    );
    expect(c02Scenarios[3]!.conditions!.join(" ")).toContain(
      "explicitly non-taxable",
    );
    expect(c02Scenarios[3]!.conditions!.join(" ")).toContain(
      "PhilHealth basic salary PHP 25000.00",
    );
    expect(c02Scenarios[3]!.conditions!.join(" ")).toContain(
      "PhilHealth basic salary PHP 28000.00",
    );
    expect(
      c02Scenarios[3]!.facts.filter((f) => f.key.startsWith("Job A ")),
    ).toHaveLength(7);
    expect(
      c02Scenarios[3]!.facts.filter((f) => f.key.startsWith("Job B ")),
    ).toHaveLength(7);
    expect(get(3, "Job B additional allowance applicability")).toEqual({
      kind: "NOT_APPLICABLE",
    });
    expect(get(2, "private-sector SSS employee share applicability")).toEqual({
      kind: "NOT_APPLICABLE",
    });
    for (const i of [0, 1])
      expect(get(i, "government GSIS employee share applicability")).toEqual({
        kind: "NOT_APPLICABLE",
      });
    expect(get(0, "BIR withholding tax").kind).toBe("KNOWN");
    expect(get(1, "BIR withholding tax").kind).toBe("KNOWN");
  });

  it("attaches one typed non-activity floor support to A01, not an A/B child", () => {
    expect(c02PhilHealthFloor).toMatchObject({
      id: "C02-S01-F",
      activityId: "C02-A01",
      primaryScenarioId: "C02-S01",
      period: "monthly",
      employeeShareRate: "2.5%",
    });
    expect(c02PhilHealthFloor.basicSalary.magnitude.toString()).toBe("8000");
    expect(
      c02PhilHealthFloor.minimumContributionBasis.magnitude.toString(),
    ).toBe("10000");
    expect(c02PhilHealthFloor.contentKeys).toHaveLength(6);
    expect(c02Activities[0]!.contentReferences.map((r) => r.contentId)).toEqual(
      expect.arrayContaining([...c02PhilHealthFloor.contentKeys]),
    );
    expect(
      c02Activities
        .slice(1)
        .every((a) =>
          a.contentReferences.every((r) => !r.contentId.includes("S01-F")),
        ),
    ).toBe(true);
    expect(isActivityId("C02-S01-F")).toBe(false);
    expect(isScenarioId("C02-S01-F")).toBe(false);
    expect(isScenarioChildId("C02-S01-F")).toBe(false);
    expect(
      activityManifestSchema.safeParse({ ...c02Activities[0], id: "C02-S01-F" })
        .success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({
        ...c02Scenarios[0],
        id: "C02-S01-F",
      }).success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({
        ...c02Scenarios[0],
        variants: [{ id: "C02-S01-F", condition: "floor" }],
      }).success,
    ).toBe(false);
  });

  it("preserves C01-S03 gross provenance and excludes unsupported exports", () => {
    const provenance = {
      providerCompetencyId: "C01",
      consumerCompetencyId: "C02",
      sourceOutputKey: "gross-income result",
      sourceRecordId: "C01-S03",
      relevantCondition: "James's established gross income for the same month",
    };
    expect(c02Activities[1]!.providerReferences).toEqual([provenance]);
    expect(c02Scenarios[1]!.providerReferences).toEqual([provenance]);
    expect(
      isProviderRead({
        kind: "ESTABLISHED",
        provenance,
        result: {
          availability: "AVAILABLE",
          resolution: get(1, "C01-S03 established monthly gross income"),
        },
      }),
    ).toBe(true);
    for (const altered of [
      { ...provenance, sourceOutputKey: "converted pay value" },
      { ...provenance, sourceRecordId: "C01-S99" },
      { ...provenance, providerCompetencyId: "C03" },
    ]) {
      const input = registry();
      input.activities[1] = {
        ...input.activities[1]!,
        providerReferences: [
          altered as unknown as NonNullable<
            (typeof input.activities)[number]["providerReferences"]
          >[number],
        ],
      };
      expect(() => check(input)).toThrow();
    }
    expect(
      c02Scenarios[1]!.facts.every((f) => !f.key.includes("recomputed")),
    ).toBe(true);
  });

  it("attaches 41 role entries and both canonical GLO entries without substitutions", () => {
    expect(Object.keys(c02Copy)).toHaveLength(43);
    expect(c02Copy["GLO-08-C02"]).toBe(
      "Start with gross income, determine the applicable deductions, and find net pay.",
    );
    expect(c02Copy["GLO-09-C02"]).toBe(
      "Different deductions can use different approved bases, rates, floors, caps, brackets, or rules. Determine each applicable deduction before finding total deductions and net pay.",
    );
    expect(c02Copy["c02/S03/reconsider-corrected-oracle"]).toBe(
      "Use the approved BIR result ₱31.05. Do not use the superseded rounded values ₱31.00, ₱2,991.00, or ₱21,009.00.",
    );
    expect(c02RoleKeys.map((roles) => roles.length)).toEqual([8, 9, 9, 9]);
    expect(c02PhilHealthFloor.contentKeys).toHaveLength(6);
    const expected = [
      ...c02RoleKeys.flatMap((roles, i) =>
        roles.map((role) => `c02/S0${i + 1}/${role}`),
      ),
      ...c02PhilHealthFloor.contentKeys,
      "GLO-08-C02",
      "GLO-09-C02",
    ];
    expect(Object.keys(c02Copy).sort()).toEqual(expected.sort());
    for (const [i, activity] of c02Activities.entries()) {
      const keys = activity.contentReferences.map((ref) => ref.contentId);
      expect(keys).toEqual([
        ...c02RoleKeys[i]!.map((role) => `c02/S0${i + 1}/${role}`),
        ...(i === 0 ? [...c02PhilHealthFloor.contentKeys] : []),
        "GLO-08-C02",
        "GLO-09-C02",
      ]);
      expect(
        activity.contentReferences.every((ref) => ref.variableIds.length === 0),
      ).toBe(true);
    }
  });

  it("rejects inventory drift, wrong ownership, extra cases and content/provenance leakage", () => {
    const variations = [
      (r: ReturnType<typeof registry>) => {
        r.activities.push(r.activities[0]!);
      },
      (r: ReturnType<typeof registry>) => {
        r.activities.pop();
      },
      (r: ReturnType<typeof registry>) => {
        r.activities.push({
          ...r.activities[0]!,
          id: "C02-A05" as (typeof r.activities)[0]["id"],
        });
      },
      (r: ReturnType<typeof registry>) => {
        r.activities[0] = {
          ...r.activities[0]!,
          id: "C02-S01-F" as (typeof r.activities)[0]["id"],
        };
      },
      (r: ReturnType<typeof registry>) => {
        r.activities[0] = { ...r.activities[0]!, scenarioIds: ["C02-S02"] };
      },
      (r: ReturnType<typeof registry>) => {
        r.scenarios[1] = r.scenarios[0]!;
      },
      (r: ReturnType<typeof registry>) => {
        r.scenarios[2] = { ...r.scenarios[2]!, id: "C03-S03" };
      },
      (r: ReturnType<typeof registry>) => {
        r.scenarios.pop();
      },
      (r: ReturnType<typeof registry>) => {
        r.scenarios.push({ ...r.scenarios[0]!, id: "C02-S05" });
      },
      (r: ReturnType<typeof registry>) => {
        r.activities[0] = { ...r.activities[0]!, oracle: { oracleId: "leak" } };
      },
      (r: ReturnType<typeof registry>) => {
        r.activities[0] = {
          ...r.activities[0]!,
          contentReferences: r.activities[0]!.contentReferences.filter(
            (ref) => !ref.contentId.includes("S01-F"),
          ),
        };
      },
      (r: ReturnType<typeof registry>) => {
        r.activities[1] = {
          ...r.activities[1]!,
          contentReferences: r.activities[1]!.contentReferences.filter(
            (ref) => !ref.contentId.includes("provider-callout"),
          ),
        };
      },
      (r: ReturnType<typeof registry>) => {
        r.scenarios[3] = {
          ...r.scenarios[3]!,
          facts: r.scenarios[3]!.facts.filter(
            (f) => !f.key.startsWith("Job B "),
          ),
        };
      },
    ];
    for (const mutate of variations) {
      const r = registry();
      mutate(r);
      expect(() => check(r)).toThrow();
    }
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        activities: [...c02Activities, c02Activities[0]],
      }),
    ).toThrow();
    expect(() =>
      check(registry(), { ...c02PhilHealthFloor, activityId: "C02-A02" }),
    ).toThrow();
    expect(() =>
      check(registry(), {
        ...c02PhilHealthFloor,
        minimumContributionBasis: c02PhilHealthFloor.basicSalary,
      }),
    ).toThrow();
    expect(() =>
      check(registry(), c02PhilHealthFloor, {
        ...c02Copy,
        "c02/S01-F/confirmation": "₱200.00",
      }),
    ).toThrow();
    expect(() =>
      check(registry(), c02PhilHealthFloor, {
        ...c02Copy,
        "c02/S01-F/task": undefined as unknown as string,
      }),
    ).toThrow();
    expect(() =>
      check(registry(), c02PhilHealthFloor, {
        ...c02Copy,
        "c02/S04/task": "changed",
      }),
    ).toThrow();
  });

  it("rejects amount, period, basis, branch, tax treatment and zero/N-A/unknown substitutions", () => {
    const field = c02Scenarios[2]!.facts.find(
      (f) => f.key === "BIR withholding tax",
    )!;
    if (field.resolution.kind !== "KNOWN")
      throw new Error("source BIR fact must be KNOWN");
    for (const replacement of [
      {
        ...field.resolution,
        value: { ...field.resolution.value, magnitude: "31.00" },
      },
      { kind: "UNKNOWN", reason: "missing" },
      { kind: "UNDEFINED", reason: "missing" },
      { kind: "NOT_APPLICABLE" },
    ])
      expect(() =>
        check(changeFact(2, "BIR withholding tax", replacement)),
      ).toThrow();
    for (const replacement of [
      undefined,
      { kind: "NOT_APPLICABLE" },
      { kind: "UNKNOWN", reason: "missing" },
      { kind: "UNDEFINED", reason: "missing" },
    ]) {
      expect(() =>
        check(changeFact(0, "BIR withholding tax", replacement)),
      ).toThrow();
    }
    const notApplicable = get(3, "Job B additional allowance applicability");
    expect(() =>
      check(
        changeFact(3, "Job B additional allowance applicability", {
          kind: "KNOWN",
          value: {
            magnitude: "0",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: null,
          },
        }),
      ),
    ).toThrow();
    expect(notApplicable.kind).toBe("NOT_APPLICABLE");
    for (const [index, replacement] of [
      [0, "Weekly payroll; ordinary private-sector employee"],
      [1, "SSS employee share uses MSC PHP 12937.50"],
      [2, "Monthly payroll; ordinary private-sector employee; SSS branch"],
      [3, "Job A: allowance PHP 3000.00 taxable"],
    ] as const) {
      const r = registry();
      r.scenarios[index] = {
        ...r.scenarios[index]!,
        conditions: [replacement],
      };
      expect(() => check(r)).toThrow();
    }
    expect(
      scenarioDefinitionSchema.safeParse({
        ...c02Scenarios[2],
        facts: [
          ...c02Scenarios[2]!.facts,
          {
            key: "oracle",
            resolution: {
              kind: "KNOWN",
              value: {
                magnitude: "21008.95",
                kind: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: null,
              },
            },
          },
        ],
      }).success,
    ).toBe(true);
    // Structural acceptance alone is insufficient: local authority rejects an independent result fact.
    const r = registry();
    r.scenarios[2] = {
      ...r.scenarios[2]!,
      facts: [
        ...r.scenarios[2]!.facts,
        { key: "oracle", resolution: field.resolution },
      ],
    };
    expect(() => check(r)).toThrow();
  });

  it("deep-freezes the actual catalog, copy, supporting facts and arrays", () => {
    for (const value of [
      c02Competency,
      c02Competency.activityIds,
      c02Activities,
      c02Scenarios,
      c02Copy,
      c02PhilHealthFloor,
      c02PhilHealthFloor.contentKeys,
      c02PhilHealthFloor.basicSalary,
      c02Scenarios[3]!.facts,
      c02Activities[0]!.contentReferences,
      c02Scenarios[2]!.facts[0]!.resolution,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(() =>
      (c02Competency.activityIds as string[]).push("C02-A05"),
    ).toThrow();
    expect(() => (c02Scenarios[3]!.facts as unknown[]).pop()).toThrow();
    expect(() =>
      Object.assign(c02Copy, { "c02/S01/task": "changed" }),
    ).toThrow();
    expect(() =>
      Object.assign(c02PhilHealthFloor, { activityId: "C02-A02" }),
    ).toThrow();
    expect(() =>
      Object.assign(c02Scenarios[2]!.facts[0]!.resolution, { kind: "UNKNOWN" }),
    ).toThrow();
    expect(c02Catalog.activities).not.toHaveProperty("set");
  });
});
