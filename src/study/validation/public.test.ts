import { describe, expect, it } from "vitest";
import { actualContentBank, validateContent } from "./public";
import type { ContentBank } from "./public";

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
// Deliberately invalid records are cast only at the runtime validation boundary.
const replace = (key: keyof ContentBank, value: unknown): ContentBank =>
  freeze({ ...actualContentBank, [key]: value });
const changePart = (
  index: number,
  change: (part: ContentBank["parts"][number]) => unknown,
  keepNestedMutable = false,
): ContentBank => {
  const parts = [...actualContentBank.parts];
  const modified = change(parts[index]!);
  parts[index] = (
    keepNestedMutable ? Object.freeze(modified) : freeze(modified)
  ) as ContentBank["parts"][number];
  return Object.freeze({ ...actualContentBank, parts: Object.freeze(parts) });
};
const changeEntry = (
  index: number,
  field: "activities" | "scenarios",
  offset: number,
  change: (item: Record<string, unknown>) => unknown,
): ContentBank =>
  changePart(index, (part) => {
    const entries: unknown[] = [...part[field]];
    entries[offset] = freeze(
      change(entries[offset] as Record<string, unknown>),
    );
    return { ...part, [field]: freeze(entries) };
  });
const withProvider = (
  index: number,
  change: (edge: Record<string, unknown>) => unknown,
): ContentBank =>
  replace(
    "providerDefinitions",
    actualContentBank.providerDefinitions.map((edge, i) =>
      i === index ? change(edge as unknown as Record<string, unknown>) : edge,
    ),
  );

describe("T019 actual bank", () => {
  it("has exact source-owned identities, 6/25 inventory, successors and primary scenarios", () => {
    expect(validateContent(actualContentBank)).toEqual({
      competencies: 6,
      activities: 25,
      scenarios: 25,
      providerEdges: 4,
    });
    expect(
      actualContentBank.parts.map((part) => [
        part.competency.id,
        part.activities.length,
      ]),
    ).toEqual([
      ["C01", 4],
      ["C02", 4],
      ["C03", 4],
      ["C04", 4],
      ["C05", 5],
      ["C06", 4],
    ]);
    for (const part of actualContentBank.parts) {
      expect(part.activities.map((activity) => activity.id)).toEqual(
        part.competency.activityIds,
      );
      expect(
        part.activities.map((activity) => activity.successorActivityId),
      ).toEqual([...part.competency.activityIds.slice(1), undefined]);
      expect(part.scenarios.map((scenario) => scenario.activityId)).toEqual(
        part.competency.activityIds,
      );
      for (const [i, activity] of part.activities.entries()) {
        expect(activity.scenarioIds).toEqual([part.scenarios[i]!.id]);
        expect(
          activity.contentReferences.slice(-2).map((ref) => ref.contentId),
        ).toEqual([
          `GLO-08-${part.competency.id}`,
          `GLO-09-${part.competency.id}`,
        ]);
        expect(activity.responseContract.contractId).toContain(
          part.competency.id,
        );
        expect(activity.modelBinding?.profileId).toBeTruthy();
        expect(activity.modelBinding?.interactionProfileId).toBeTruthy();
      }
    }
  });
  it("keeps supporting states separate and corrected C02 roles deeply frozen", () => {
    expect(
      actualContentBank.parts[1]!.roles.map((roles) => [
        Object.isFrozen(roles),
        roles.length,
      ]),
    ).toEqual([
      [true, 8],
      [true, 9],
      [true, 9],
      [true, 9],
    ]);
    expect(Object.isFrozen(actualContentBank.parts[1]!.roles)).toBe(true);
    const ids = actualContentBank.parts.flatMap((part) =>
      part.activities.map((activity) => activity.id),
    );
    expect(ids).not.toContain("C05-PV-JAMES-01");
    expect(ids).not.toContain("C02-S01-F");
    expect(
      actualContentBank.parts.flatMap((part) =>
        part.scenarios.flatMap((scenario) => scenario.variants ?? []),
      ).length,
    ).toBeGreaterThan(0);
  });
  it("keeps four specific provider edges and approved semantic/reveal declarations", () => {
    expect(
      actualContentBank.providerDefinitions.map((edge) => [
        edge.sourceRecordId,
        edge.consumerScenarioId,
        edge.sourceOutputKey,
      ]),
    ).toEqual([
      ["C05-PV-JAMES-01", "C01-S03", "converted pay value"],
      ["C03-S03", "C01-S03", "overtime-pay value"],
      ["C06-S04", "C01-S04", "commission amount"],
      ["C01-S03", "C02-S02", "gross-income result"],
    ]);
    expect(actualContentBank.james.provenance.sourceOutputKey).toBe(
      "wage/salary representation",
    );
    expect(actualContentBank.james.establishedRegularPay.basis).toBeNull();
    expect(actualContentBank.providerDefinitions[2]!.allowedOutputs).toEqual([
      "commission amount",
    ]);
    expect(
      actualContentBank.providerDefinitions[2]!.read.result.resolution.value.magnitude.toString(),
    ).toBe("3600");
    expect(
      actualContentBank.c04Boundary["C04-S04"].percentageResolution.kind,
    ).toBe("UNDEFINED");
    expect(actualContentBank.c04Boundary["C04-S04"].numericAvailability).toBe(
      "WITHHELD",
    );
    expect(actualContentBank.cases["C06-S01"][0]!.baseSalary.kind).toBe(
      "NOT_APPLICABLE",
    );
    const workerB = actualContentBank.cases["C06-S01"][1]!;
    expect(
      workerB.baseSalary.kind === "KNOWN"
        ? workerB.baseSalary.value.basis
        : null,
    ).toBe("per month");
  });
});

describe("T019 rejects malformed source declarations", () => {
  const invalid: readonly [string, () => ContentBank, RegExp][] = [
    [
      "missing competency",
      () => replace("parts", actualContentBank.parts.slice(1)),
      /competencies/,
    ],
    [
      "extra competency",
      () =>
        replace("parts", [
          ...actualContentBank.parts,
          actualContentBank.parts[0]!,
        ]),
      /competencies/,
    ],
    [
      "duplicate competency",
      () =>
        changePart(1, (p) => ({
          ...p,
          competency: actualContentBank.parts[0]!.competency,
        })),
      /identity/,
    ],
    [
      "missing activity",
      () => changePart(0, (p) => ({ ...p, activities: p.activities.slice(1) })),
      /inventory/,
    ],
    [
      "duplicate activity",
      () => changeEntry(0, "activities", 1, (a) => ({ ...a, id: "C01-A01" })),
      /successor|identity/,
    ],
    [
      "wrong owner",
      () =>
        changeEntry(0, "activities", 0, (a) => ({ ...a, competencyId: "C03" })),
      /activity|ownership/,
    ],
    [
      "support as progress",
      () =>
        changeEntry(4, "activities", 0, (a) => ({
          ...a,
          id: "C05-PV-JAMES-01",
        })),
      /activity|ownership/,
    ],
    [
      "wrong successor",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          successorActivityId: "C01-A04",
        })),
      /successor/,
    ],
    [
      "orphan scenario",
      () =>
        changeEntry(0, "scenarios", 0, (s) => ({
          ...s,
          activityId: "C01-A04",
        })),
      /ownership/,
    ],
    [
      "duplicate scenario",
      () => changeEntry(0, "scenarios", 1, (s) => ({ ...s, id: "C01-S01" })),
      /identity/,
    ],
    [
      "promoted child",
      () => changeEntry(3, "scenarios", 1, (s) => ({ ...s, id: "C04-S02-A" })),
      /scenario|identity/,
    ],
    [
      "missing GLO",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          contentReferences: (a.contentReferences as unknown[]).slice(0, -1),
        })),
      /role\/GLO/,
    ],
    [
      "foreign role",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          contentReferences: [
            { contentId: "c03/S01/scenario", variableIds: [] },
            ...(a.contentReferences as unknown[]).slice(1),
          ],
        })),
      /role\/GLO/,
    ],
    [
      "swapped role",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          contentReferences: [
            (a.contentReferences as unknown[])[1],
            (a.contentReferences as unknown[])[0],
            ...(a.contentReferences as unknown[]).slice(2),
          ],
        })),
      /role\/GLO/,
    ],
    [
      "missing copy",
      () =>
        changePart(0, (p) => ({
          ...p,
          copy: Object.fromEntries(
            Object.entries(p.copy).filter(
              ([key]) => key !== "c01/S01/scenario",
            ),
          ),
        })),
      /dictionary/,
    ],
    [
      "wrong scenario role",
      () =>
        changePart(0, (p) => ({
          ...p,
          roles: [p.roles[1], p.roles[0], ...p.roles.slice(2)],
        })),
      /role declarations/,
    ],
    [
      "wrong family",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          instructionalFamily: "Apply",
        })),
      /family/,
    ],
    [
      "wrong response",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          responseContract: { contractId: "C03 incorrect" },
        })),
      /response/,
    ],
    [
      "missing response",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          responseContract: undefined,
        })),
      /activity|response/,
    ],
    [
      "wrong model",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          modelBinding: {
            profileId: "Overtime Work Record",
            interactionProfileId: "Interactive — evaluative",
          },
        })),
      /model/,
    ],
    [
      "generic interaction",
      () =>
        changeEntry(4, "activities", 1, (a) => ({
          ...a,
          modelBinding: {
            ...(a.modelBinding as object),
            interactionProfileId: "Interactive",
          },
        })),
      /model/,
    ],
    [
      "missing model",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          modelBinding: undefined,
        })),
      /activity|model/,
    ],
    [
      "invalid oracle declaration",
      () =>
        changeEntry(0, "activities", 0, (a) => ({
          ...a,
          oracle: { oracleId: "forged" },
        })),
      /oracle/,
    ],
    [
      "wrong provider source",
      () =>
        changeEntry(0, "scenarios", 2, (s) => ({
          ...s,
          providerReferences: [
            {
              ...(s.providerReferences as Record<string, unknown>[])[0],
              sourceRecordId: "C05-PV-JAMES-02",
            },
            ...(s.providerReferences as unknown[]).slice(1),
          ],
        })),
      /scenario/,
    ],
    [
      "wrong provider condition",
      () =>
        changeEntry(0, "scenarios", 2, (s) => ({
          ...s,
          providerReferences: [
            {
              ...(s.providerReferences as Record<string, unknown>[])[0],
              relevantCondition: "invented",
            },
            ...(s.providerReferences as unknown[]).slice(1),
          ],
        })),
      /provider/,
    ],
    [
      "duplicate edge",
      () =>
        replace("providerDefinitions", [
          ...actualContentBank.providerDefinitions,
          actualContentBank.providerDefinitions[0]!,
        ]),
      /edges/,
    ],
    [
      "wrong provider unit",
      () =>
        withProvider(2, (e) => ({
          ...e,
          read: {
            ...(e.read as object),
            result: {
              ...actualContentBank.providerDefinitions[2]!.read.result,
              resolution: {
                ...actualContentBank.providerDefinitions[2]!.read.result
                  .resolution,
                value: {
                  ...actualContentBank.providerDefinitions[2]!.read.result
                    .resolution.value,
                  unit: "USD",
                },
              },
            },
          },
        })),
      /Provider integrity/,
    ],
    [
      "total-compensation leak",
      () =>
        withProvider(2, (e) => ({
          ...e,
          allowedOutputs: ["commission amount", "total compensation"],
        })),
      /Provider integrity/,
    ],
    [
      "James unauthorized alias",
      () =>
        withProvider(0, (e) => ({
          ...e,
          sourceOwnedOutputKey: "converted pay value",
        })),
      /Provider integrity/,
    ],
    [
      "James invented basis",
      () =>
        replace("james", {
          ...actualContentBank.james,
          establishedRegularPay: {
            ...actualContentBank.james.establishedRegularPay,
            basis: "per month",
          },
        }),
      /semantic/,
    ],
    [
      "undefined changed to known",
      () =>
        replace("c04Boundary", {
          ...actualContentBank.c04Boundary,
          "C04-S04": {
            ...actualContentBank.c04Boundary["C04-S04"],
            percentageResolution: "KNOWN",
          },
        }),
      /semantic/,
    ],
    [
      "premature numeric exposure",
      () =>
        replace("c04Boundary", {
          ...actualContentBank.c04Boundary,
          "C04-S04": {
            ...actualContentBank.c04Boundary["C04-S04"],
            numericAvailability: "AVAILABLE",
          },
        }),
      /semantic/,
    ],
    [
      "original mutable C02 inner arrays",
      () =>
        changePart(
          1,
          (p) => ({
            ...p,
            roles: Object.freeze(p.roles.map((roles) => [...roles])),
          }),
          true,
        ),
      /mutable/,
    ],
    [
      "mutable model metadata",
      () =>
        changePart(
          0,
          (p) => ({
            ...p,
            activities: Object.freeze([
              {
                ...p.activities[0],
                modelBinding: { ...p.activities[0]!.modelBinding },
              },
              ...p.activities.slice(1),
            ]),
          }),
          true,
        ),
      /mutable/,
    ],
    [
      "unexpected own field",
      () =>
        changeEntry(0, "activities", 0, (a) => ({ ...a, executable: false })),
      /activity/,
    ],
    [
      "function in data",
      () =>
        replace("c04Boundary", {
          ...actualContentBank.c04Boundary,
          execute: () => 0,
        }),
      /executable/,
    ],
    [
      "unexpected outer declaration",
      () => Object.freeze({ ...actualContentBank, fabricated: true }),
      /fields/,
    ],
    [
      "unexpected study part declaration",
      () => changePart(0, (p) => ({ ...p, fabricated: true })),
      /fields/,
    ],
  ];
  it.each(invalid)("rejects %s", (_label, bank, expected) =>
    expect(() => validateContent(bank())).toThrow(expected),
  );
});
