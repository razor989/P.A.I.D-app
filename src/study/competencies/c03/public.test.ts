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
  c03Activities,
  c03Catalog,
  c03Competency,
  c03Copy,
  c03Evidence,
  c03RoleKeys,
  c03Scenarios,
  validateC03Local,
} from "./public";

const registry = () => ({
  complete: false,
  competencies: [c03Competency],
  activities: [...c03Activities],
  scenarios: [...c03Scenarios],
  contentIds: Object.keys(c03Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
const check = (
  r = registry(),
  evidence: typeof c03Evidence = c03Evidence,
  copy: Readonly<Record<string, string>> = c03Copy,
) =>
  validateC03Local(
    r.competencies[0]!,
    r.activities,
    r.scenarios,
    evidence,
    copy,
  );

const alterFact = (scenario: number, key: string, resolution: unknown) => {
  const r = registry();
  r.scenarios[scenario] = {
    ...r.scenarios[scenario]!,
    facts: r.scenarios[scenario]!.facts.map((f) =>
      f.key === key ? { key, resolution } : f,
    ),
  } as (typeof r.scenarios)[number];
  return r;
};

describe("C03 source-pinned fixed definitions", () => {
  it("has precisely one competency, four ordered activity/primary scenario pairs and successors", () => {
    expect([
      c03Catalog.competencies.size,
      c03Catalog.activities.size,
      c03Catalog.scenarios.size,
    ]).toEqual([1, 4, 4]);
    expect(c03Competency.activityIds).toEqual([
      "C03-A01",
      "C03-A02",
      "C03-A03",
      "C03-A04",
    ]);
    expect(
      c03Activities.map((a) => [
        a.id,
        a.instructionalFamily,
        a.scenarioIds,
        a.successorActivityId ?? null,
      ]),
    ).toEqual([
      ["C03-A01", "Prepare", ["C03-S01"], "C03-A02"],
      ["C03-A02", "Explore and Learn", ["C03-S02"], "C03-A03"],
      ["C03-A03", "Apply", ["C03-S03"], "C03-A04"],
      ["C03-A04", "Check and Transfer", ["C03-S04"], null],
    ]);
    expect(
      c03Scenarios.map((s) => [s.id, s.activityId, s.competencyId]),
    ).toEqual([
      ["C03-S01", "C03-A01", "C03"],
      ["C03-S02", "C03-A02", "C03"],
      ["C03-S03", "C03-A03", "C03"],
      ["C03-S04", "C03-A04", "C03"],
    ]);
    expect(c03Scenarios[1]!.variants).toEqual([
      { id: "C03-S02-A", condition: "ordinary working day" },
      { id: "C03-S02-B", condition: "rest day" },
    ]);
    expect(c03Scenarios.filter((s) => s.variants)).toHaveLength(1);
    expect(
      isScenarioChildId("C03-S02-A") && isScenarioChildId("C03-S02-B"),
    ).toBe(true);
  });

  it("preserves all exact rate/hour/condition-linked multiplier quantities, including paired invariants", () => {
    const expected = [
      [
        ["regular hourly rate", "100", "MONETARY_RATE", "PHP", "per hour"],
        ["overtime hours", "2", "DURATION", "hours", null],
        [
          "ordinary working day applicable multiplier",
          "1.25",
          "MULTIPLIER",
          "dimensionless",
          null,
        ],
      ],
      [
        [
          "C03-S02-A regular hourly rate",
          "100",
          "MONETARY_RATE",
          "PHP",
          "per hour",
        ],
        ["C03-S02-A overtime hours", "2", "DURATION", "hours", null],
        [
          "C03-S02-A ordinary working day applicable multiplier",
          "1.25",
          "MULTIPLIER",
          "dimensionless",
          null,
        ],
        [
          "C03-S02-B regular hourly rate",
          "100",
          "MONETARY_RATE",
          "PHP",
          "per hour",
        ],
        ["C03-S02-B overtime hours", "2", "DURATION", "hours", null],
        [
          "C03-S02-B rest day applicable multiplier",
          "1.69",
          "MULTIPLIER",
          "dimensionless",
          null,
        ],
      ],
      [
        [
          "established regular hourly rate",
          "75",
          "MONETARY_RATE",
          "PHP",
          "per hour",
        ],
        ["aggregate monthly overtime hours", "10", "DURATION", "hours", null],
        [
          "ordinary working day applicable multiplier",
          "1.25",
          "MULTIPLIER",
          "dimensionless",
          null,
        ],
      ],
      [
        [
          "established regular hourly rate",
          "120",
          "MONETARY_RATE",
          "PHP",
          "per hour",
        ],
        ["overtime hours", "3", "DURATION", "hours", null],
        [
          "regular holiday applicable multiplier",
          "2.6",
          "MULTIPLIER",
          "dimensionless",
          null,
        ],
      ],
    ];
    expect(
      c03Scenarios.map((s) =>
        s.facts.map((f) => {
          expect(f.resolution.kind).toBe("KNOWN");
          if (f.resolution.kind !== "KNOWN")
            throw new Error("Unresolved fixed case");
          expect(f.resolution.value.magnitude).toBeInstanceOf(ExactDecimal);
          return [
            f.key,
            f.resolution.value.magnitude.toString(),
            f.resolution.value.kind,
            f.resolution.value.unit,
            f.resolution.value.basis,
          ];
        }),
      ),
    ).toEqual(expected);
    expect(c03Scenarios[1]!.facts[0]!.resolution).toEqual(
      c03Scenarios[1]!.facts[3]!.resolution,
    );
    expect(c03Scenarios[1]!.facts[1]!.resolution).toEqual(
      c03Scenarios[1]!.facts[4]!.resolution,
    );
    expect(c03Scenarios.map((s) => s.conditions)).toEqual([
      [
        "ordinary working day",
        "2 overtime hours after the regular eight hours",
      ],
      [
        "same regular hourly rate and overtime hours in both states",
        "work condition determines the applicable multiplier",
      ],
      [
        "ordinary working day",
        "10 overtime hours in aggregate during the month; no per-day distribution established",
      ],
      [
        "regular holiday",
        "3 overtime hours beyond the first eight hours; single-day schematic permitted",
      ],
    ]);
  });

  it("pins all FOUR R7 §13 C03 model bindings, not generic or C01/C02 substitutes", () => {
    expect(
      c03Activities.map((a) => [
        a.modelBinding?.profileId,
        a.modelBinding?.interactionProfileId,
      ]),
    ).toEqual([
      ["Overtime Work Record", "Static semantic"],
      ["Overtime Work Record", "Interactive — explanatory"],
      ["Overtime Work Record", "Static semantic — aggregate-hours form"],
      [
        "Overtime Work Record",
        "Static semantic — approved single-day schematic allowed",
      ],
    ]);
    for (const i of [0, 1, 2, 3])
      for (const wrong of [
        "Static semantic",
        "Interactive — evaluative",
        "Interactive — explanatory/live",
        "Static semantic + embedded floor state",
        "Static semantic — paired configuration",
        "Static semantic — aggregate-hours form",
        "Static semantic — approved single-day schematic allowed",
      ]) {
        if (wrong === c03Activities[i]!.modelBinding!.interactionProfileId)
          continue;
        const r = registry();
        r.activities[i] = {
          ...r.activities[i]!,
          modelBinding: {
            profileId: "Overtime Work Record",
            interactionProfileId: wrong,
          },
        };
        expect(activityManifestSchema.safeParse(r.activities[i]).success).toBe(
          true,
        );
        expect(() => check(r)).toThrow();
      }
  });

  it("pins monthly aggregate James and limited single-day Mara independently", () => {
    expect(c03Evidence["C03-S03"]).toEqual({
      mode: "monthly aggregate overtime hours",
      distribution: "not established",
      schematic: "no single-day shift strip",
    });
    expect(c03Evidence["C03-S04"]).toEqual({
      mode: "regular-holiday single day",
      distribution: "only the approved single day",
      schematic: "approved single-day schematic allowed",
    });
    expect(JSON.stringify(c03Scenarios[2])).not.toMatch(
      /shift length|date distribution|single-day shift/i,
    );
    for (const [id, replacement] of [
      [
        "C03-S03",
        {
          mode: "single shift",
          distribution: "one day",
          schematic: "ten-hour strip",
        },
      ],
      [
        "C03-S04",
        {
          mode: "regular-holiday single day",
          distribution: "not established",
          schematic: "not allowed",
        },
      ],
    ] as const) {
      expect(() =>
        check(registry(), {
          ...c03Evidence,
          [id]: replacement,
        }),
      ).toThrow();
    }
  });

  it("attaches the exact 32 scenario roles and two canonical GLO identifiers", () => {
    expect(c03RoleKeys.map((roles) => roles.length)).toEqual([8, 8, 8, 8]);
    const keys = [
      ...c03RoleKeys.flatMap((roles, i) =>
        roles.map((role) => `c03/S0${i + 1}/${role}`),
      ),
      "GLO-08-C03",
      "GLO-09-C03",
    ];
    expect(keys).toHaveLength(34);
    expect(Object.keys(c03Copy).sort()).toEqual(keys.sort());
    for (const [i, activity] of c03Activities.entries())
      expect(activity.contentReferences).toEqual([
        ...c03RoleKeys[i]!.map((role) => ({
          contentId: `c03/S0${i + 1}/${role}`,
          variableIds: [],
        })),
        { contentId: "GLO-08-C03", variableIds: [] },
        { contentId: "GLO-09-C03", variableIds: [] },
      ]);
  });

  it("freezes the exported role-key roster at both levels without changing references", () => {
    const originalRoles = c03RoleKeys.map((roles) => [...roles]);
    const originalReferences = c03Activities.map((activity) =>
      activity.contentReferences.map((reference) => reference.contentId),
    );
    expect(Object.isFrozen(c03RoleKeys)).toBe(true);
    for (const roles of c03RoleKeys) {
      expect(Object.isFrozen(roles)).toBe(true);
      expect(() => (roles as unknown as string[]).push("extra-role")).toThrow();
      expect(() => (roles as unknown as string[]).splice(0, 1)).toThrow();
    }
    expect(() =>
      (c03RoleKeys as unknown as string[][]).push(["extra-role"]),
    ).toThrow();
    expect(() => (c03RoleKeys as unknown as string[][]).splice(0, 1)).toThrow();
    expect(() => {
      (c03RoleKeys as unknown as string[][])[0] = ["wrong-role"];
    }).toThrow();
    expect(c03RoleKeys).toEqual(originalRoles);
    expect(
      c03Activities.map((activity) =>
        activity.contentReferences.map((reference) => reference.contentId),
      ),
    ).toEqual(originalReferences);
  });

  it("parses with T010 schemas/catalog; keeps only established downstream C03→C01 semantics", () => {
    expect(() => check()).not.toThrow();
    expect(
      c03Activities.every((a) => activityManifestSchema.safeParse(a).success),
    ).toBe(true);
    expect(
      c03Scenarios.every((s) => scenarioDefinitionSchema.safeParse(s).success),
    ).toBe(true);
    expect(composeStudyCatalog(registry()).scenarios.size).toBe(4);
    expect(c03Scenarios[2]!.id).toBe("C03-S03");
    expect(
      isProviderRead({
        kind: "ESTABLISHED",
        provenance: {
          providerCompetencyId: "C03",
          consumerCompetencyId: "C01",
          sourceOutputKey: "overtime-pay value",
          sourceRecordId: "C03-S03",
          relevantCondition: "James's overtime pay for the same month",
        },
        result: {
          availability: "AVAILABLE",
          resolution: { kind: "NOT_APPLICABLE" },
        },
      }),
    ).toBe(true);
    expect(c03Activities.every((a) => !a.providerReferences && !a.oracle)).toBe(
      true,
    );
    expect(c03Scenarios.every((s) => !s.providerReferences)).toBe(true);
    expect(JSON.stringify(c03Scenarios)).not.toMatch(
      /expected|answer|overtime.pay.result|₱88|937\.50/,
    );
  });

  it("rejects duplicate, foreign, absent and fifth activity/scenario, and promoted child identities", () => {
    const edits: ((r: ReturnType<typeof registry>) => void)[] = [
      (r) => {
        r.activities.push(r.activities[0]!);
      },
      (r) => {
        r.activities.pop();
      },
      (r) => {
        r.activities.push({
          ...r.activities[0]!,
          id: "C03-A05" as (typeof r.activities)[0]["id"],
        });
      },
      (r) => {
        r.activities[0] = { ...r.activities[0]!, id: "C02-A01" };
      },
      (r) => {
        r.activities[0] = {
          ...r.activities[0]!,
          id: "C03-S02-A" as (typeof r.activities)[0]["id"],
        };
      },
      (r) => {
        r.activities[0] = { ...r.activities[0]!, scenarioIds: ["C03-S02"] };
      },
      (r) => {
        r.scenarios.push(r.scenarios[0]!);
      },
      (r) => {
        r.scenarios.pop();
      },
      (r) => {
        r.scenarios.push({ ...r.scenarios[1]!, id: "C03-S05" });
      },
      (r) => {
        r.scenarios[0] = { ...r.scenarios[0]!, id: "C02-S01" };
      },
      (r) => {
        r.scenarios[0] = {
          ...r.scenarios[0]!,
          id: "C03-S02-A" as (typeof r.scenarios)[0]["id"],
        };
      },
      (r) => {
        r.scenarios[1] = { ...r.scenarios[1]!, activityId: "C03-A03" };
      },
      (r) => {
        r.competencies[0] = {
          ...r.competencies[0]!,
          activityIds: ["C03-A01", "C03-A02"],
        };
      },
    ];
    for (const edit of edits) {
      const r = registry();
      edit(r);
      expect(() => check(r)).toThrow();
    }
  });

  it("rejects missing, duplicated, swapped or reassigned S02 children", () => {
    const variants = c03Scenarios[1]!.variants!;
    for (const bad of [
      [],
      [variants[0]!],
      [variants[0]!, variants[0]!],
      [...variants].reverse(),
      [{ ...variants[0]!, condition: "rest day" }, variants[1]!],
      [
        { ...variants[0]!, id: "C03-S01-A" as (typeof variants)[0]["id"] },
        variants[1]!,
      ],
    ]) {
      const r = registry();
      r.scenarios[1] = { ...r.scenarios[1]!, variants: bad };
      expect(() => check(r)).toThrow();
    }
  });

  it("rejects rate/hour/multiplier drift, quantity-role collapse and invalid semantic substitutions", () => {
    const bad = [
      [0, "regular hourly rate", "101", "MONETARY_RATE", "PHP", "per hour"],
      [
        1,
        "C03-S02-B regular hourly rate",
        "99",
        "MONETARY_RATE",
        "PHP",
        "per hour",
      ],
      [1, "C03-S02-B overtime hours", "3", "DURATION", "hours", null],
      [
        2,
        "aggregate monthly overtime hours",
        "10",
        "MONETARY_AMOUNT",
        "PHP",
        null,
      ],
      [
        3,
        "established regular hourly rate",
        "120",
        "MONETARY_AMOUNT",
        "PHP",
        null,
      ],
      [
        0,
        "ordinary working day applicable multiplier",
        "1.69",
        "MULTIPLIER",
        "dimensionless",
        null,
      ],
      [
        1,
        "C03-S02-B rest day applicable multiplier",
        "1.25",
        "MULTIPLIER",
        "dimensionless",
        null,
      ],
      [
        3,
        "regular holiday applicable multiplier",
        "2.60",
        "MULTIPLIER",
        "PHP",
        null,
      ],
      [0, "overtime hours", "0", "DURATION", "hours", null],
    ] as const;
    for (const [i, key, magnitude, kind, unit, basis] of bad)
      expect(() =>
        check(
          alterFact(i, key, {
            kind: "KNOWN",
            value: { magnitude, kind, unit, basis },
          }),
        ),
      ).toThrow();
    for (const resolution of [
      { kind: "NOT_APPLICABLE" },
      { kind: "UNKNOWN", reason: "not given" },
      { kind: "UNDEFINED", reason: "undefined" },
      {
        kind: "KNOWN",
        value: { magnitude: 2, kind: "DURATION", unit: "hours", basis: null },
      },
    ]) {
      expect(() => check(alterFact(0, "overtime hours", resolution))).toThrow();
    }
    const r = registry();
    r.scenarios[2] = {
      ...r.scenarios[2]!,
      facts: [
        ...r.scenarios[2]!.facts,
        {
          key: "invented daily hours",
          resolution: r.scenarios[2]!.facts[1]!.resolution,
        },
      ],
    };
    expect(() => check(r)).toThrow();
  });

  it("rejects changed role text, bindings, provider invention, answer fields and calculated JS-number results", () => {
    const r = registry();
    r.activities[0] = {
      ...r.activities[0]!,
      contentReferences: r.activities[0]!.contentReferences.slice(1),
    };
    expect(() => check(r)).toThrow();
    for (const copy of [
      { ...c03Copy, "c03/S01/confirmation": "Changed" },
      { ...c03Copy, "GLO-08-C03": "Wrong" },
    ])
      expect(() => check(registry(), c03Evidence, copy)).toThrow();
    for (const additional of [
      { oracle: { oracleId: "answer" } },
      {
        providerReferences: [
          {
            providerCompetencyId: "C05",
            consumerCompetencyId: "C03",
            sourceOutputKey: "hourly-rate representation",
            sourceRecordId: "C05-PV-JAMES-01",
            relevantCondition: null,
          },
        ],
      },
    ]) {
      const candidate = registry();
      candidate.activities[2] = {
        ...candidate.activities[2]!,
        ...additional,
      } as (typeof candidate.activities)[2];
      expect(() => check(candidate)).toThrow();
    }
    const candidate = registry();
    candidate.scenarios[0] = {
      ...candidate.scenarios[0]!,
      expectedResult: 100 * 1.25 * 2,
    } as (typeof candidate.scenarios)[0];
    expect(() => check(candidate)).toThrow();
    expect(
      scenarioDefinitionSchema.safeParse(candidate.scenarios[0]).success,
    ).toBe(false);
  });

  it("exposes deeply frozen catalog entries, evidence and copy, not mutable scenario truth", () => {
    for (const entry of [
      c03Competency,
      ...c03Activities,
      ...c03Scenarios,
      c03Evidence,
      c03Copy,
    ]) {
      const walk = (value: unknown): void => {
        if (typeof value !== "object" || value === null) return;
        expect(Object.isFrozen(value)).toBe(true);
        for (const nested of Object.values(value)) walk(nested);
      };
      walk(entry);
    }
    expect(() => {
      (c03Scenarios[0]!.facts as unknown[]).push(c03Scenarios[0]!.facts[0]);
    }).toThrow();
    expect(() => {
      (c03Evidence["C03-S03"] as { mode: string }).mode = "one shift";
    }).toThrow();
  });
});
