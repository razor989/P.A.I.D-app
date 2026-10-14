import { describe, expect, it } from "vitest";
import {
  ExactDecimal,
  isLearnerResponse,
  isScenarioChildId,
} from "../../../core/public";
import { composeStudyCatalog } from "../../catalog/public";
import {
  activityManifestSchema,
  scenarioDefinitionSchema,
} from "../../schemas/public";
import {
  c04Activities,
  c04ResponseContracts,
  validateC04ResponseContracts,
  c04Boundary,
  c04Catalog,
  c04Competency,
  c04Copy,
  c04RoleKeys,
  c04Scenarios,
  validateC04Local,
} from "./public";

const bank = () => ({
  competency: c04Competency,
  activities: [...c04Activities],
  scenarios: [...c04Scenarios],
  boundary: c04Boundary,
  copy: c04Copy,
  roles: c04RoleKeys,
});
const check = (
  data: {
    competency: typeof c04Competency;
    activities: typeof c04Activities;
    scenarios: typeof c04Scenarios;
    boundary: typeof c04Boundary;
    copy: Readonly<Record<string, string>>;
    roles: readonly (readonly string[])[];
  } = bank(),
) =>
  validateC04Local(
    data.competency,
    data.activities,
    data.scenarios,
    data.boundary,
    data.copy,
    data.roles,
  );
const change = (scenario: number, key: string, resolution: unknown) => {
  const data = bank();
  data.scenarios[scenario] = {
    ...data.scenarios[scenario]!,
    facts: data.scenarios[scenario]!.facts.map((fact) =>
      fact.key === key ? { key, resolution } : fact,
    ),
  } as (typeof data.scenarios)[number];
  return data;
};

describe("C04 fixed source definitions", () => {
  it("adds response authority through the existing public boundary without changing copy or catalog", () => {
    validateC04ResponseContracts(c04ResponseContracts);
    expect(c04ResponseContracts.map((record) => record.activityId)).toEqual(
      c04Competency.activityIds,
    );
    expect(Object.keys(c04Copy)).toHaveLength(34);
    for (const record of c04ResponseContracts) {
      expect(c04Copy).toHaveProperty(record.confirmationFeedbackRef);
      for (const choice of record.choices)
        expect(c04Copy).toHaveProperty(choice.incorrectFeedbackRef);
      if (record.terminalTeaching)
        expect(c04Copy).toHaveProperty(record.terminalTeaching.contentRef);
    }
    check();
  });
  it("has exactly one/four/four ordered owned definitions and only two S02 children", () => {
    expect([
      c04Catalog.competencies.size,
      c04Catalog.activities.size,
      c04Catalog.scenarios.size,
    ]).toEqual([1, 4, 4]);
    expect(c04Competency.activityIds).toEqual([
      "C04-A01",
      "C04-A02",
      "C04-A03",
      "C04-A04",
    ]);
    expect(
      c04Activities.map((a) => [
        a.id,
        a.instructionalFamily,
        a.scenarioIds,
        a.successorActivityId ?? null,
      ]),
    ).toEqual([
      ["C04-A01", "Prepare", ["C04-S01"], "C04-A02"],
      ["C04-A02", "Explore and Learn", ["C04-S02"], "C04-A03"],
      ["C04-A03", "Apply", ["C04-S03"], "C04-A04"],
      ["C04-A04", "Check and Transfer", ["C04-S04"], null],
    ]);
    expect(c04Scenarios.map((s) => [s.id, s.activityId])).toEqual([
      ["C04-S01", "C04-A01"],
      ["C04-S02", "C04-A02"],
      ["C04-S03", "C04-A03"],
      ["C04-S04", "C04-A04"],
    ]);
    expect(c04Scenarios[1]!.variants?.map((v) => v.id)).toEqual([
      "C04-S02-A",
      "C04-S02-B",
    ]);
    expect(c04Scenarios.filter((s) => s.variants)).toHaveLength(1);
    expect(
      isScenarioChildId("C04-S02-A") && isScenarioChildId("C04-S02-B"),
    ).toBe(true);
    check();
  });

  it("preserves all source-role facts as exact monthly PHP quantities", () => {
    expect(
      c04Scenarios.map((s) =>
        s.facts.map((f) => [
          f.key,
          f.resolution.kind === "KNOWN"
            ? f.resolution.value.magnitude.toString()
            : null,
        ]),
      ),
    ).toEqual([
      [
        ["Original monthly salary (reference)", "18000"],
        ["New monthly salary", "18000"],
      ],
      [
        ["C04-S02-A Original monthly salary (reference)", "20000"],
        ["C04-S02-A New monthly salary", "22000"],
        ["C04-S02-B Original monthly salary (reference)", "10000"],
        ["C04-S02-B New monthly salary", "12000"],
      ],
      [
        ["Original advertised monthly offer (reference)", "30000"],
        ["New revised monthly offer", "27000"],
      ],
      [
        ["Original monthly communication allowance (reference)", "0"],
        ["New monthly communication allowance", "1500"],
      ],
    ]);
    for (const s of c04Scenarios)
      for (const fact of s.facts) {
        expect(fact.resolution.kind).toBe("KNOWN");
        if (fact.resolution.kind === "KNOWN") {
          expect(fact.resolution.value.magnitude).toBeInstanceOf(ExactDecimal);
          expect([
            fact.resolution.value.kind,
            fact.resolution.value.unit,
            fact.resolution.value.basis,
          ]).toEqual(["MONETARY_AMOUNT", "PHP", "per month"]);
        }
      }
    expect(c04Scenarios[0]!.facts[0]!.key).not.toBe(
      c04Scenarios[0]!.facts[1]!.key,
    );
    expect(c04Boundary["C04-S01"].percentageResolution).toBe("KNOWN");
    expect(c04Boundary["C04-S03"].direction).toBe("decrease");
    expect(c04Boundary["C04-S04"].percentageResolution.kind).toBe("UNDEFINED");
    expect(c04Boundary["C04-S04"].numericAvailability).toBe("WITHHELD");
    expect(c04Boundary["C04-S04"].absoluteChangeAvailability).toBe("AVAILABLE");
    expect(
      isLearnerResponse({
        kind: "SEMANTIC_BOUNDARY",
        resolution: c04Boundary["C04-S04"].percentageResolution,
      }),
    ).toBe(true);
  });

  it("binds four exact R7 profiles and exactly 34 correctly attached role references", () => {
    expect(
      c04Activities.map((a) => [
        a.modelBinding?.profileId,
        a.modelBinding?.interactionProfileId,
      ]),
    ).toEqual([
      ["Anchored Change Track", "Static semantic"],
      ["Anchored Change Track", "Interactive — fixed scenario New states"],
      ["Anchored Change Track", "Static semantic"],
      [
        "Anchored Change Track",
        "Static semantic — Undefined terminal boundary",
      ],
    ]);
    expect(Object.keys(c04Copy)).toHaveLength(34);
    expect(c04RoleKeys.map((r) => r.length)).toEqual([8, 8, 8, 8]);
    expect(c04RoleKeys[3]).toContain("undefined-result");
    for (const [i, a] of c04Activities.entries()) {
      expect(a.contentReferences.map((r) => r.contentId)).toEqual([
        ...c04RoleKeys[i]!.map((role) => `c04/S0${i + 1}/${role}`),
        "GLO-08-C04",
        "GLO-09-C04",
      ]);
    }
    expect(c04Activities.every((a) => !a.oracle && !a.providerReferences)).toBe(
      true,
    );
    expect(c04Scenarios.every((s) => !s.providerReferences)).toBe(true);
    expect(activityManifestSchema.safeParse(c04Activities[3]).success).toBe(
      true,
    );
    expect(scenarioDefinitionSchema.safeParse(c04Scenarios[3]).success).toBe(
      true,
    );
    expect(() =>
      composeStudyCatalog({
        complete: false,
        competencies: [c04Competency],
        activities: [...c04Activities],
        scenarios: [...c04Scenarios],
        contentIds: Object.keys(c04Copy),
        responseContractIds: [],
        modelProfileIds: [],
        interactionProfileIds: [],
        oracleIds: [],
      }),
    ).not.toThrow();
  });
});

describe("C04 local rejection and runtime immutability", () => {
  it("rejects missing, duplicate, foreign or fifth activities and primary scenarios", () => {
    for (const field of ["activities", "scenarios"] as const) {
      for (const replacement of [
        (items: unknown[]) => items.slice(1),
        (items: unknown[]) => [...items, items[0]],
        (items: unknown[]) => [
          ...items,
          {
            ...(items[0] as object),
            id: field === "activities" ? "C05-A01" : "C05-S01",
          },
        ],
        (items: unknown[]) => [
          {
            ...(items[0] as object),
            id: field === "activities" ? "C05-A01" : "C05-S01",
          },
          ...items.slice(1),
        ],
      ]) {
        const data = bank();
        Object.assign(data, { [field]: replacement(data[field]) });
        expect(() => check(data)).toThrow();
      }
    }
  });

  it("rejects altered originals, New states, kinds/bases, invalid negatives and missing zero", () => {
    const original = c04Scenarios[1]!.facts[0]!.key;
    for (const resolution of [
      {
        kind: "KNOWN",
        value: {
          magnitude: "22000.00",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: "per month",
        },
      },
      {
        kind: "KNOWN",
        value: {
          magnitude: "-20000.00",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: "per month",
        },
      },
      {
        kind: "KNOWN",
        value: {
          magnitude: "20000.00",
          kind: "MONETARY_RATE",
          unit: "PHP",
          basis: "per month",
        },
      },
      {
        kind: "KNOWN",
        value: {
          magnitude: "20000.00",
          kind: "MONETARY_AMOUNT",
          unit: "USD",
          basis: "per month",
        },
      },
      {
        kind: "KNOWN",
        value: {
          magnitude: "20000.00",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: "per year",
        },
      },
      { kind: "UNKNOWN", reason: "missing" },
      { kind: "NOT_APPLICABLE" },
      { kind: "UNDEFINED", reason: "zero" },
    ])
      expect(() => check(change(1, original, resolution))).toThrow();
    for (const magnitude of ["0.00", "100.00", "22000.00"])
      expect(() =>
        check(
          change(3, c04Scenarios[3]!.facts[1]!.key, {
            kind: "KNOWN",
            value: {
              magnitude,
              kind: "MONETARY_AMOUNT",
              unit: "PHP",
              basis: "per month",
            },
          }),
        ),
      ).toThrow();
    expect(() =>
      check(
        change(3, c04Scenarios[3]!.facts[0]!.key, {
          kind: "UNKNOWN",
          reason: "missing",
        }),
      ),
    ).toThrow();
  });

  it("rejects extra S02 states, denominator substitutions, boundary conflation, bindings, copy and runtime/oracle fields", () => {
    for (const variant of [
      { id: "C04-S02-C", condition: "third value" },
      { id: "C04-S03-A", condition: "misattached" },
    ]) {
      const data = bank();
      data.scenarios[1] = {
        ...data.scenarios[1]!,
        variants: [...data.scenarios[1]!.variants!, variant],
      } as (typeof data.scenarios)[number];
      expect(() => check(data)).toThrow();
    }
    for (const binding of [
      "Interactive — explanatory",
      "Interactive — continuous slider",
      "Static semantic — aggregate-hours form",
      "Static semantic",
    ]) {
      const data = bank();
      data.activities[binding === "Static semantic" ? 3 : 1] = {
        ...data.activities[binding === "Static semantic" ? 3 : 1]!,
        modelBinding: {
          profileId: "Anchored Change Track",
          interactionProfileId: binding,
        },
      };
      expect(() => check(data)).toThrow();
    }
    for (const boundary of [
      {
        ...c04Boundary,
        "C04-S01": {
          ...c04Boundary["C04-S01"],
          percentageResolution: "UNDEFINED",
        },
      },
      {
        ...c04Boundary,
        "C04-S04": {
          ...c04Boundary["C04-S04"],
          numericAvailability: "AVAILABLE",
        },
      },
      {
        ...c04Boundary,
        "C04-S04": {
          ...c04Boundary["C04-S04"],
          percentageResolution: { kind: "KNOWN", value: 0 },
        },
      },
      {
        ...c04Boundary,
        "C04-S04": {
          ...c04Boundary["C04-S04"],
          percentageResolution: { kind: "UNKNOWN", reason: "missing" },
        },
      },
      {
        ...c04Boundary,
        "C04-S04": {
          ...c04Boundary["C04-S04"],
          percentageResolution: { kind: "NOT_APPLICABLE" },
        },
      },
      {
        ...c04Boundary,
        "C04-S03": { ...c04Boundary["C04-S03"], direction: "increase" },
      },
      {
        ...c04Boundary,
        "C04-S02": {
          ...c04Boundary["C04-S02"],
          originalRoles: ["C04-S02-A New monthly salary"],
        },
      },
    ])
      expect(() =>
        check({ ...bank(), boundary: boundary as typeof c04Boundary }),
      ).toThrow();
    for (const copy of [
      { ...c04Copy, "c04/S04/undefined-result": "0%" },
      { ...c04Copy, extra: "invented" },
      Object.fromEntries(Object.entries(c04Copy).slice(1)),
    ])
      expect(() => check({ ...bank(), copy })).toThrow();
    expect(() =>
      check({ ...bank(), roles: c04RoleKeys.map((r) => r.slice(1)) }),
    ).toThrow();
    for (const addition of [
      { oracle: { oracleId: "result" } },
      { slider: { min: 0, max: 30000, increment: 1 } },
      { progress: true },
      { evaluator: () => 100 },
      {
        providerReferences: [
          {
            providerCompetencyId: "C05",
            consumerCompetencyId: "C04",
            sourceRecordId: "C05-PV-FAKE-01",
            sourceOutputKey: "salary",
            relevantCondition: null,
          },
        ],
      },
    ]) {
      const data = bank();
      data.activities[1] = {
        ...data.activities[1]!,
        ...addition,
      } as (typeof data.activities)[number];
      expect(() => check(data)).toThrow();
    }
    const data = bank();
    data.scenarios[0] = {
      ...data.scenarios[0]!,
      expectedPercentage: 0 / 1,
    } as (typeof data.scenarios)[number];
    expect(() => check(data)).toThrow();
  });

  it("deep-freezes exported outer and inner arrays, copy, records and fixed paired states", () => {
    const walk = (value: unknown): void => {
      if (typeof value !== "object" || value === null) return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const nested of Object.values(value)) walk(nested);
    };
    for (const exported of [
      c04Activities,
      c04Scenarios,
      c04Competency,
      c04RoleKeys,
      c04Boundary,
      c04Copy,
      c04Catalog,
    ])
      walk(exported);
    expect(Object.isFrozen(c04RoleKeys)).toBe(true);
    for (const roles of c04RoleKeys) expect(Object.isFrozen(roles)).toBe(true);
    expect(() => (c04RoleKeys as unknown[]).push([])).toThrow();
    expect(() => (c04RoleKeys[1] as unknown[]).push("invented")).toThrow();
    expect(() => (c04Activities as unknown[]).reverse()).toThrow();
    expect(() =>
      (c04Scenarios[1]!.variants as unknown[]).push({ id: "C04-S02-C" }),
    ).toThrow();
    expect(() => {
      (c04Scenarios[1]!.facts[1] as { key: string }).key = "third New value";
    }).toThrow();
    expect(() => {
      (c04Copy as Record<string, string>).extra = "extra";
    }).toThrow();
    expect(() =>
      (c04Activities[0]!.contentReferences as unknown[]).pop(),
    ).toThrow();
    expect(c04Scenarios[1]!.variants?.map((v) => v.id)).toEqual([
      "C04-S02-A",
      "C04-S02-B",
    ]);
    check();
  });
});
