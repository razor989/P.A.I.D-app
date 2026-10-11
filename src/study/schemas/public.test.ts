import { describe, expect, it } from "vitest";
import type { ActivityId } from "../../core/public";
import {
  ExactDecimal,
  isLearnerResponse,
  isProviderRead,
  quantity,
} from "../../core/public";
import {
  activityManifestSchema,
  competencyDefinitionSchema,
  contentReferenceSchema,
  fixedQuantitySchema,
  fixedResolutionSchema,
  modelReferenceSchema,
  oracleReferenceSchema,
  providerReferenceSchema,
  responseContractReferenceSchema,
  scenarioDefinitionSchema,
} from "./public";

// Synthetic structural fixtures only; NOT records from the approved fixed study bank.
export const competency = { id: "C01", activityIds: ["C01-A01"] } as const;
export const activity = {
  id: "C01-A01",
  competencyId: "C01",
  scenarioIds: ["C01-S01"],
  instructionalFamily: "test family",
  contentReferences: [
    { contentId: "test-copy", variableIds: ["test-variable"] },
  ],
  responseContract: { contractId: "test-response" },
  modelBinding: {
    profileId: "test-model",
    interactionProfileId: "test-interaction",
  },
  oracle: { oracleId: "test-oracle" },
} as const;
export const scenario = {
  id: "C01-S01",
  competencyId: "C01",
  activityId: "C01-A01",
  facts: [
    {
      key: "test-zero",
      resolution: {
        kind: "KNOWN",
        value: {
          magnitude: "0",
          kind: "MONETARY_AMOUNT",
          unit: "PHP",
          basis: null,
        },
      },
    },
  ],
  variants: [{ id: "C01-S01-A", condition: "test condition" }],
} as const;
export const provider = {
  providerCompetencyId: "C03",
  consumerCompetencyId: "C01",
  sourceOutputKey: "overtime-pay value",
  sourceRecordId: "C03-S01",
  relevantCondition: null,
} as const;

describe("T010 local definition schemas (test-only synthetic data)", () => {
  it("retains the compile-time learner activity boundary", () => {
    const valid: ActivityId = "C05-A05";
    // @ts-expect-error a supporting record is not a learner activity
    const supporting: ActivityId = "C02-S01-F";
    expect(valid).toBe("C05-A05");
    expect(
      activityManifestSchema.safeParse({ ...activity, id: supporting }).success,
    ).toBe(false);
  });
  it("parses canonical competency, activity, scenario and structural references", () => {
    expect(competencyDefinitionSchema.parse(competency).id).toBe("C01");
    expect(
      competencyDefinitionSchema.safeParse({
        id: "C01",
        activityIds: ["C01-A02"],
      }).success,
    ).toBe(true);
    expect(activityManifestSchema.parse(activity).scenarioIds).toEqual([
      "C01-S01",
    ]);
    expect(scenarioDefinitionSchema.parse(scenario).variants?.[0]?.id).toBe(
      "C01-S01-A",
    );
    expect(
      contentReferenceSchema.safeParse(activity.contentReferences[0]).success,
    ).toBe(true);
    expect(
      responseContractReferenceSchema.safeParse(activity.responseContract)
        .success,
    ).toBe(true);
    expect(modelReferenceSchema.safeParse(activity.modelBinding).success).toBe(
      true,
    );
    expect(oracleReferenceSchema.safeParse(activity.oracle).success).toBe(true);
    expect(providerReferenceSchema.safeParse(provider).success).toBe(true);
  });
  it("preserves exact zero and distinct nonnumeric domain resolutions", () => {
    const parsed = scenarioDefinitionSchema.parse(scenario);
    const resolution = parsed.facts[0]?.resolution;
    expect(resolution?.kind).toBe("KNOWN");
    if (resolution?.kind !== "KNOWN")
      throw new Error("Expected known test fact");
    expect(resolution.value.magnitude.equals(ExactDecimal.from("0"))).toBe(
      true,
    );
    expect(fixedResolutionSchema.parse({ kind: "NOT_APPLICABLE" }).kind).toBe(
      "NOT_APPLICABLE",
    );
    expect(
      fixedResolutionSchema.parse({
        kind: "UNKNOWN",
        reason: "test information needed",
      }).kind,
    ).toBe("UNKNOWN");
    expect(
      fixedResolutionSchema.parse({
        kind: "UNDEFINED",
        reason: "test undefined operation",
      }).kind,
    ).toBe("UNDEFINED");
    expect(
      fixedQuantitySchema
        .parse({
          magnitude: ExactDecimal.from("1.25"),
          kind: "test",
          unit: "PHP",
          basis: null,
        })
        .magnitude.toString(),
    ).toBe("1.25");
    expect(
      isLearnerResponse({
        kind: "EXACT_QUANTITY",
        value: quantity(ExactDecimal.from("0"), "test", "PHP", null),
      }),
    ).toBe(true);
    expect(
      isProviderRead({
        kind: "ESTABLISHED",
        provenance: provider,
        result: {
          resolution: { kind: "NOT_APPLICABLE" },
          availability: "WITHHELD",
        },
      }),
    ).toBe(true);
  });
  it("rejects supporting/provider/child IDs as learner activities and bad ownership", () => {
    for (const id of [
      "C02-S01-F",
      "C05-PV-JAMES-01",
      "C01-S01-A",
      "C07-A01",
      "C01-A05",
    ])
      expect(
        activityManifestSchema.safeParse({ ...activity, id }).success,
      ).toBe(false);
    expect(
      competencyDefinitionSchema.safeParse({ ...competency, id: "GI" }).success,
    ).toBe(false);
    expect(
      competencyDefinitionSchema.safeParse({
        id: "C01",
        activityIds: ["C02-A01"],
      }).success,
    ).toBe(false);
    expect(
      competencyDefinitionSchema.safeParse({
        id: "C01",
        activityIds: ["C01-A01", "C02-A01"],
      }).success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({ ...activity, competencyId: "C02" })
        .success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({
        ...activity,
        scenarioIds: ["C02-S01"],
      }).success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({ ...scenario, activityId: "C02-A01" })
        .success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({
        ...scenario,
        variants: [{ id: "C01-S02-A", condition: "test" }],
      }).success,
    ).toBe(false);
  });
  it("rejects duplicates, unsupported discriminants, malformed payloads and runtime leakage", () => {
    expect(
      competencyDefinitionSchema.safeParse({
        ...competency,
        activityIds: ["C01-A01", "C01-A01"],
      }).success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({
        ...activity,
        scenarioIds: ["C01-S01", "C01-S01"],
      }).success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({
        ...scenario,
        variants: [scenario.variants[0], scenario.variants[0]],
      }).success,
    ).toBe(false);
    expect(
      scenarioDefinitionSchema.safeParse({
        ...scenario,
        facts: [{ key: "x", resolution: { kind: "KNOWN", value: 0 } }],
      }).success,
    ).toBe(false);
    expect(fixedResolutionSchema.safeParse({ kind: "WRONG" }).success).toBe(
      false,
    );
    expect(
      fixedResolutionSchema.safeParse({
        kind: "KNOWN",
        value: { magnitude: 0, kind: "test", unit: "PHP", basis: null },
      }).success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({
        ...activity,
        learnerResponse: "runtime state",
      }).success,
    ).toBe(false);
    expect(
      contentReferenceSchema.safeParse({
        contentId: "test",
        variableIds: ["v", "v"],
      }).success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({
        ...activity,
        providerReferences: [provider, provider],
      }).success,
    ).toBe(false);
  });
  it("distinguishes mandatory and genuinely optional references", () => {
    const withoutOptional = {
      ...activity,
      modelBinding: undefined,
      oracle: undefined,
    };
    expect(activityManifestSchema.safeParse(withoutOptional).success).toBe(
      true,
    );
    expect(
      activityManifestSchema.safeParse({
        ...withoutOptional,
        providerReferences: null,
      }).success,
    ).toBe(false);
    expect(
      activityManifestSchema.safeParse({
        ...withoutOptional,
        responseContract: undefined,
      }).success,
    ).toBe(false);
    expect(modelReferenceSchema.safeParse({ profileId: "" }).success).toBe(
      false,
    );
    expect(
      providerReferenceSchema.safeParse({
        ...provider,
        sourceOutputKey: "not approved",
      }).success,
    ).toBe(false);
    expect(
      responseContractReferenceSchema.safeParse({
        contractId: "x",
        evaluator: () => true,
      }).success,
    ).toBe(false);
  });
});
