import { describe, expect, it } from "vitest";
import { ExactDecimal } from "../../core/public";
import type { ProviderProvenance } from "../../core/public";
import { c01Activities, c01Scenarios } from "../competencies/c01/public";
import { c02Activities, c02Scenarios } from "../competencies/c02/public";
import { c03Activities, c03Scenarios } from "../competencies/c03/public";
import { c04Activities, c04Scenarios } from "../competencies/c04/public";
import {
  c05Activities,
  c05James,
  c05Scenarios,
} from "../competencies/c05/public";
import {
  c06Activities,
  c06CommissionProvider,
  c06Scenarios,
} from "../competencies/c06/public";
import type { ActivityManifest, ScenarioDefinition } from "../schemas/public";
import {
  lookupProviderReview,
  providerReviewDefinitions,
  validateProviderReviewGraph,
} from "./public";
import type { ProviderReviewBank, ProviderReviewDefinition } from "./public";

const bank = (): ProviderReviewBank => ({
  activities: [
    ...c01Activities,
    ...c02Activities,
    ...c03Activities,
    ...c04Activities,
    ...c05Activities,
    ...c06Activities,
  ],
  scenarios: [
    ...c01Scenarios,
    ...c02Scenarios,
    ...c03Scenarios,
    ...c04Scenarios,
    ...c05Scenarios,
    ...c06Scenarios,
  ],
  james: c05James,
  commission: c06CommissionProvider,
});
const corrupt = (
  change: (item: ScenarioDefinition) => ScenarioDefinition,
  id = "C01-S03",
) => ({
  ...bank(),
  scenarios: bank().scenarios.map((item) =>
    item.id === id ? change(item) : item,
  ),
});
const corruptActivity = (
  change: (item: ActivityManifest) => ActivityManifest,
) => ({
  ...bank(),
  activities: bank().activities.map((item) =>
    item.id === "C01-A03" ? change(item) : item,
  ),
});
const altered = (
  index: number,
  change: (item: ProviderReviewDefinition) => ProviderReviewDefinition,
) =>
  providerReviewDefinitions.map((item, i) =>
    i === index ? change(item) : item,
  );

describe("T017 actual fixed-bank provider graph", () => {
  it("has exactly four instantiated edges in both matching consumer records", () => {
    expect(
      providerReviewDefinitions.map((d) => [
        d.sourceRecordId,
        d.consumerScenarioId,
      ]),
    ).toEqual([
      ["C05-PV-JAMES-01", "C01-S03"],
      ["C03-S03", "C01-S03"],
      ["C06-S04", "C01-S04"],
      ["C01-S03", "C02-S02"],
    ]);
    expect(
      bank().scenarios.flatMap((s) => s.providerReferences ?? []),
    ).toHaveLength(4);
    expect(
      bank().activities.flatMap((a) => a.providerReferences ?? []),
    ).toHaveLength(4);
    expect(() =>
      validateProviderReviewGraph(bank(), providerReviewDefinitions),
    ).not.toThrow();
    expect(c03Scenarios[2]!.providerReferences).toBeUndefined();
    expect(c05James.hourlyRateProvenance.sourceOutputKey).toBe(
      "hourly-rate representation",
    );
    expect(c05James.hourlyRate.magnitude.toString()).toBe("75");
    expect(c05James.regularHours.magnitude.toString()).toBe("160");
    expect(c05James.establishedRegularPay.basis).toBeNull();
    expect(c04Scenarios.every((s) => s.providerReferences === undefined)).toBe(
      true,
    );
    expect(c05Activities).toHaveLength(5);
    expect(c05Scenarios).toHaveLength(5);
    expect(c05Activities.some((a) => a.id === (c05James.id as string))).toBe(
      false,
    );
  });

  it.each([
    [
      "C05-PV-JAMES-01",
      "C01-S03",
      "converted pay value",
      "12000",
      "James's established regular pay for the month",
    ],
    [
      "C03-S03",
      "C01-S03",
      "overtime-pay value",
      "937.5",
      "James's overtime pay for the same month",
    ],
    [
      "C06-S04",
      "C01-S04",
      "commission amount",
      "3600",
      "Lina's established June commission",
    ],
    [
      "C01-S03",
      "C02-S02",
      "gross-income result",
      "12937.5",
      "James's established gross income for the same month",
    ],
  ])(
    "resolves real %s into %s, key %s",
    (source, target, key, amount, condition) => {
      const ref = bank()
        .scenarios.find((s) => s.id === target)!
        .providerReferences!.find((r) => r.sourceRecordId === source)!;
      const d = lookupProviderReview(target, ref);
      expect(d.sourceOutputKey).toBe(key);
      expect(d.relevantCondition).toBe(condition);
      expect(d.allowedOutputs).toEqual([key]);
      expect(d.origin).toEqual({
        sourceRecordId: source,
        sourceCompetencyId: ref.providerCompetencyId,
      });
      expect(d.consumerCompetencyId).toBe(ref.consumerCompetencyId);
      expect(d.read.result.availability).toBe("AVAILABLE");
      expect(d.read.result.resolution.value).toMatchObject({
        kind: "MONETARY_AMOUNT",
        unit: "PHP",
        basis: null,
      });
      expect(d.read.result.resolution.value.magnitude.toString()).toBe(amount);
    },
  );

  it("reconciles only James's source-owned wage/salary key to the real converted-pay reference", () => {
    const d = providerReviewDefinitions[0]!;
    expect(d.sourceOwnedOutputKey).toBe(c05James.provenance.sourceOutputKey);
    expect(d.sourceOutputKey).toBe("converted pay value");
    expect(d.allowedOutputs).toEqual(["converted pay value"]);
    expect(() => lookupProviderReview("C01-S03", c05James.provenance)).toThrow(
      /unresolved/,
    );
  });

  it("resolves every actual edge from a reversed-insertion-order provenance copy", () => {
    for (const definition of providerReviewDefinitions) {
      const reference = Object.fromEntries(
        Object.entries(definition.read.provenance).reverse(),
      ) as ProviderProvenance;
      expect(reference).not.toBe(definition.read.provenance);
      expect(
        lookupProviderReview(definition.consumerScenarioId, reference),
      ).toBe(definition);
    }
  });

  it("accepts reordered graph objects and a numerically identical exact-decimal fact", () => {
    const source = c01Scenarios[2]!;
    const first = source.facts[0]!;
    if (first.resolution.kind !== "KNOWN")
      throw new Error("Expected known fact");
    const reordered: ScenarioDefinition = Object.fromEntries(
      Object.entries({
        ...source,
        facts: [
          {
            resolution: {
              value: {
                basis: first.resolution.value.basis,
                unit: first.resolution.value.unit,
                kind: first.resolution.value.kind,
                magnitude: ExactDecimal.from("12000.000"),
              },
              kind: "KNOWN",
            },
            key: first.key,
          },
          ...source.facts.slice(1),
        ],
        providerReferences: source.providerReferences!.map((ref) =>
          Object.fromEntries(Object.entries(ref).reverse()),
        ),
      }).reverse(),
    ) as ScenarioDefinition;
    expect(() =>
      validateProviderReviewGraph(
        corrupt(() => reordered),
        providerReviewDefinitions,
      ),
    ).not.toThrow();
  });

  it("exports only Lina's 3600 commission, never base/sales/rate/total/allowance/gross", () => {
    const d = providerReviewDefinitions[2]!;
    expect(Object.keys(d)).toEqual([
      "sourceRecordId",
      "sourceCompetencyId",
      "consumerScenarioId",
      "consumerActivityId",
      "consumerCompetencyId",
      "sourceOutputKey",
      "sourceOwnedOutputKey",
      "relevantCondition",
      "allowedOutputs",
      "origin",
      "read",
    ]);
    expect(d.read.result.resolution.value.magnitude.toString()).toBe("3600");
    expect(JSON.stringify(d)).not.toMatch(
      /18600|15000|120000|19400|800|sales|rate/,
    );
    expect(c06CommissionProvider.consumerScenarioId).toBe(d.consumerScenarioId);
  });

  it("keeps outer, nested and returned lookup data deeply read-only, with no navigation or progress fields", () => {
    expect(Object.isFrozen(providerReviewDefinitions)).toBe(true);
    for (const d of providerReviewDefinitions) {
      for (const nested of [
        d,
        d.allowedOutputs,
        d.origin,
        d.read,
        d.read.provenance,
        d.read.result,
        d.read.result.resolution,
        d.read.result.resolution.value,
        d.read.result.resolution.value.magnitude,
      ])
        expect(Object.isFrozen(nested)).toBe(true);
      expect(JSON.stringify(d)).not.toMatch(
        /navigation|prerequisite|reveal|completion|oracle|calculator|runtime/,
      );
    }
    const ref = c01Scenarios[3]!.providerReferences![0]!;
    const d = lookupProviderReview("C01-S04", ref);
    expect(() =>
      (d.allowedOutputs as string[]).push("total compensation"),
    ).toThrow();
    expect(
      () => ((d.read.result.resolution.value as { unit: string }).unit = "USD"),
    ).toThrow();
    expect(() =>
      (providerReviewDefinitions as ProviderReviewDefinition[]).pop(),
    ).toThrow();
    expect(lookupProviderReview("C01-S04", ref)).toBe(d);
    expect(() => lookupProviderReview("C01-S99", ref)).toThrow(/unresolved/);
  });
});

describe("T017 fail-closed graph validation on source-incorrect fixtures", () => {
  const ref = c01Scenarios[2]!.providerReferences![0]!;
  it("rejects executable, undefined, symbol, hidden and accessor provenance fields in real lookups", () => {
    const reference = providerReviewDefinitions[0]!.read.provenance;
    for (const extra of [
      { calculate: () => 12000 },
      { unexpected: undefined },
    ]) {
      expect(() =>
        lookupProviderReview("C01-S03", { ...reference, ...extra }),
      ).toThrow(/unresolved/);
    }
    const symbol = { ...reference };
    Object.defineProperty(symbol, Symbol("secret"), { value: 1 });
    const hidden = { ...reference };
    Object.defineProperty(hidden, "secret", { value: undefined });
    const accessor = { ...reference };
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get: () => "injected",
    });
    for (const invalid of [symbol, hidden, accessor])
      expect(() => lookupProviderReview("C01-S03", invalid)).toThrow(
        /unresolved/,
      );
  });

  it("rejects executable or hidden additions to actual source, activity, scenario and reference fixtures", () => {
    const injected = { execute: () => 1 };
    for (const fixture of [
      corrupt((s) => ({ ...s, ...injected })),
      corrupt((s) => ({
        ...s,
        providerReferences: [
          { ...s.providerReferences![0]!, ...injected },
          s.providerReferences![1]!,
        ],
      })),
      corruptActivity((a) => ({ ...a, ...injected })),
      corrupt((s) => ({
        ...s,
        facts: [
          {
            ...s.facts[0]!,
            resolution: { ...s.facts[0]!.resolution, ...injected },
          },
          ...s.facts.slice(1),
        ],
      })),
    ])
      expect(() =>
        validateProviderReviewGraph(fixture, providerReviewDefinitions),
      ).toThrow();
    const source = c03Scenarios.find((s) => s.id === "C03-S03")!;
    expect(() =>
      validateProviderReviewGraph(
        corrupt((s) => ({ ...s, ...injected }), source.id),
        providerReviewDefinitions,
      ),
    ).toThrow();
    const hidden = { ...c01Scenarios[2]! };
    Object.defineProperty(hidden, "execute", { value: () => 1 });
    expect(() =>
      validateProviderReviewGraph(
        corrupt(() => hidden),
        providerReviewDefinitions,
      ),
    ).toThrow();
    const undefinedField = { ...c01Activities[2]!, invalid: undefined };
    expect(() =>
      validateProviderReviewGraph(
        corruptActivity(() => undefinedField),
        providerReviewDefinitions,
      ),
    ).toThrow();
    expect(() =>
      Object.defineProperty(ExactDecimal.from("12000"), Symbol("hidden"), {
        value: 1,
      }),
    ).toThrow();
  });

  it("preserves array order and rejects unauthorized consumer, output, and progress identities", () => {
    expect(() =>
      validateProviderReviewGraph(
        corrupt((s) => ({
          ...s,
          providerReferences: [...s.providerReferences!].reverse(),
        })),
        providerReviewDefinitions,
      ),
    ).toThrow();
    const d = providerReviewDefinitions[0]!;
    expect(() => lookupProviderReview("C01-S04", d.read.provenance)).toThrow();
    expect(() =>
      lookupProviderReview("C01-S03", {
        ...d.read.provenance,
        sourceOutputKey: "wage/salary representation",
      } as ProviderProvenance),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        { ...bank(), activities: [...bank().activities, c01Activities[0]!] },
        providerReviewDefinitions,
      ),
    ).toThrow();
  });
  it.each([
    ["nonexistent scenario", { ...ref, sourceRecordId: "C05-S99" }],
    ["forged provider", { ...ref, sourceRecordId: "C05-PV-JAMES-02" }],
    ["wrong provider owner", { ...ref, providerCompetencyId: "C03" }],
    ["wrong consumer owner", { ...ref, consumerCompetencyId: "C04" }],
    ["wrong association", { ...ref, sourceRecordId: "C05-S01" }],
    [
      "different whitelisted key",
      { ...ref, sourceOutputKey: "wage/salary representation" },
    ],
    ["arbitrary alias", { ...ref, sourceOutputKey: "Converted Pay Value" }],
    ["wrong condition", { ...ref, relevantCondition: "weekly" }],
  ])("rejects %s", (_name, changed) => {
    const fixture = corrupt((s) => ({
      ...s,
      providerReferences: [
        changed as ProviderProvenance,
        s.providerReferences![1]!,
      ],
    }));
    expect(() =>
      validateProviderReviewGraph(fixture, providerReviewDefinitions),
    ).toThrow();
  });

  it("rejects missing, duplicate and fabricated C05→C04 or C05→C03 references", () => {
    expect(() =>
      validateProviderReviewGraph(
        corrupt((s) => ({ ...s, providerReferences: [] })),
        providerReviewDefinitions,
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        corrupt((s) => ({
          ...s,
          providerReferences: [...s.providerReferences!, ref],
        })),
        providerReviewDefinitions,
      ),
    ).toThrow();
    for (const id of ["C04-S01", "C03-S03"]) {
      const fixture = corrupt((s) => ({ ...s, providerReferences: [ref] }), id);
      expect(() =>
        validateProviderReviewGraph(fixture, providerReviewDefinitions),
      ).toThrow();
    }
    expect(() =>
      validateProviderReviewGraph(
        corruptActivity((a) => ({ ...a, providerReferences: [] })),
        providerReviewDefinitions,
      ),
    ).toThrow();
  });

  it("rejects extra progress, forged James/commission source and unsupported descriptors", () => {
    expect(() =>
      validateProviderReviewGraph(
        {
          ...bank(),
          activities: [
            ...bank().activities,
            { ...c05Activities[0]!, id: c05James.id as ActivityManifest["id"] },
          ],
        },
        providerReviewDefinitions,
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        {
          ...bank(),
          james: {
            ...c05James,
            establishedRegularPay: {
              ...c05James.establishedRegularPay,
              basis: "per month",
            },
          },
        },
        providerReviewDefinitions,
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        {
          ...bank(),
          commission: {
            ...c06CommissionProvider,
            read: {
              ...c06CommissionProvider.read,
              result: {
                ...c06CommissionProvider.read.result,
                resolution: {
                  kind: "KNOWN",
                  value: {
                    ...c06CommissionProvider.read.result.resolution.value,
                    magnitude: ExactDecimal.from("0"),
                  },
                },
              },
            },
          },
        },
        providerReviewDefinitions,
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(bank(), [
        ...providerReviewDefinitions,
        providerReviewDefinitions[0]!,
      ]),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(0, (d) => ({
          ...d,
          sourceOwnedOutputKey: "converted pay value",
        })),
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(0, (d) => ({
          ...d,
          allowedOutputs: [...d.allowedOutputs, "wage/salary representation"],
        })),
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(0, (d) => ({ ...d, allowedOutputs: [d.sourceOutputKey] })),
      ),
    ).toThrow(/mutable/);
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(2, (d) => ({ ...d, allowedOutputs: ["total compensation"] })),
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(2, (d) => ({
          ...d,
          read: {
            ...d.read,
            result: {
              ...d.read.result,
              resolution: {
                ...d.read.result.resolution,
                value: {
                  ...d.read.result.resolution.value,
                  magnitude: ExactDecimal.from("18600"),
                },
              },
            },
          },
        })),
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(3, (d) => ({
          ...d,
          read: {
            ...d.read,
            result: {
              ...d.read.result,
              resolution: {
                ...d.read.result.resolution,
                value: {
                  ...d.read.result.resolution.value,
                  magnitude: ExactDecimal.from("0"),
                },
              },
            },
          },
        })),
      ),
    ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(1, (d) => ({
          ...d,
          read: {
            ...d.read,
            result: {
              ...d.read.result,
              resolution: {
                ...d.read.result.resolution,
                value: { ...d.read.result.resolution.value, unit: "USD" },
              },
            },
          },
        })),
      ),
    ).toThrow();
    for (const field of [
      "navigateTo",
      "revealAfter",
      "completionPrerequisite",
      "oracle",
      "calculate",
    ])
      expect(() =>
        validateProviderReviewGraph(
          bank(),
          altered(2, (d) => ({ ...d, [field]: "C06-A04" })),
        ),
      ).toThrow();
    expect(() =>
      validateProviderReviewGraph(
        bank(),
        altered(2, (d) => ({
          ...d,
          read: {
            ...d.read,
            result: {
              ...d.read.result,
              resolution: { kind: "UNKNOWN", reason: "missing source" },
            },
          } as unknown as ProviderReviewDefinition["read"],
        })),
      ),
    ).toThrow();
  });
});
