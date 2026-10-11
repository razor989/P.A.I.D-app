import { z } from "zod";
import {
  ExactDecimal,
  isActivityId,
  isCompetencyId,
  isProviderRead,
  isScenarioChildId,
  isScenarioId,
  quantity,
} from "../../core/public";
import type {
  ActivityId,
  CompetencyId,
  DomainResolution,
  ProviderProvenance,
  Quantity,
  ScenarioChildId,
  ScenarioId,
} from "../../core/public";

const label = z
  .string()
  .min(1)
  .refine((text) => text === text.trim());
const distinct = <T>(values: readonly T[]): boolean =>
  new Set(values).size === values.length;

export const competencyIdSchema = z.custom<CompetencyId>(isCompetencyId);
export const activityIdSchema = z.custom<ActivityId>(isActivityId);
export const scenarioIdSchema = z.custom<ScenarioId>(isScenarioId);
export const scenarioChildIdSchema =
  z.custom<ScenarioChildId>(isScenarioChildId);

/** Keys are references, not new enumerations or authorized bank membership. */
export const contentReferenceSchema = z.strictObject({
  contentId: label,
  variableIds: z.array(label).refine(distinct),
});
export const responseContractReferenceSchema = z.strictObject({
  contractId: label,
});
export const modelReferenceSchema = z.strictObject({
  profileId: label,
  interactionProfileId: label.optional(),
});
export const oracleReferenceSchema = z.strictObject({ oracleId: label });

/** The accepted provider validator owns the edge/output/source vocabulary. */
export const providerReferenceSchema = z
  .custom<ProviderProvenance>((value) =>
    isProviderRead({
      kind: "ESTABLISHED",
      provenance: value,
      result: {
        resolution: { kind: "NOT_APPLICABLE" },
        availability: "AVAILABLE",
      },
    }),
  )
  .transform((value) => ({ ...value }));

const providerReferencesSchema = z
  .array(providerReferenceSchema)
  .refine((refs) => distinct(refs.map((ref) => JSON.stringify(ref))));

/** Serial decimal text is parsed by T008; no JS number or implicit conversion. */
export const fixedQuantitySchema = z
  .strictObject({
    magnitude: z.union([
      z.string().regex(/^[+-]?\d+(?:\.\d+)?$/),
      z.custom<ExactDecimal>((value) => value instanceof ExactDecimal),
    ]),
    kind: label,
    unit: label,
    basis: label.nullable(),
  })
  .transform((value): Quantity =>
    quantity(
      ExactDecimal.from(value.magnitude),
      value.kind,
      value.unit,
      value.basis,
    ),
  );

export const fixedResolutionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("KNOWN"), value: fixedQuantitySchema }),
  z.strictObject({ kind: z.literal("NOT_APPLICABLE") }),
  z.strictObject({ kind: z.literal("UNKNOWN"), reason: label }),
  z.strictObject({ kind: z.literal("UNDEFINED"), reason: label }),
]);
export type FixedResolution = DomainResolution<Quantity>;

export const competencyDefinitionSchema = z.strictObject({
  id: competencyIdSchema,
  activityIds: z.array(activityIdSchema).refine(distinct),
});

export const activityManifestSchema = z
  .strictObject({
    id: activityIdSchema,
    competencyId: competencyIdSchema,
    scenarioIds: z.array(scenarioIdSchema).min(1).refine(distinct),
    instructionalFamily: label,
    contentReferences: z
      .array(contentReferenceSchema)
      .min(1)
      .refine((refs) => distinct(refs.map((ref) => ref.contentId))),
    responseContract: responseContractReferenceSchema,
    modelBinding: modelReferenceSchema.optional(),
    oracle: oracleReferenceSchema.optional(),
    providerReferences: providerReferencesSchema.optional(),
    successorActivityId: activityIdSchema.optional(),
  })
  .refine(
    (activity) =>
      activity.id.startsWith(`${activity.competencyId}-`) &&
      activity.scenarioIds.every((id) =>
        id.startsWith(`${activity.competencyId}-`),
      ) &&
      (activity.successorActivityId === undefined ||
        activity.successorActivityId.startsWith(`${activity.competencyId}-`)),
    { message: "Activity competency ownership mismatch" },
  );

export const scenarioDefinitionSchema = z
  .strictObject({
    id: scenarioIdSchema,
    competencyId: competencyIdSchema,
    activityId: activityIdSchema,
    facts: z
      .array(z.strictObject({ key: label, resolution: fixedResolutionSchema }))
      .refine((facts) => distinct(facts.map((fact) => fact.key))),
    conditions: z.array(label).refine(distinct).optional(),
    variants: z
      .array(z.strictObject({ id: scenarioChildIdSchema, condition: label }))
      .refine((variants) => distinct(variants.map((variant) => variant.id)))
      .optional(),
    providerReferences: providerReferencesSchema.optional(),
  })
  .refine(
    (scenario) =>
      scenario.id.startsWith(`${scenario.competencyId}-`) &&
      scenario.activityId.startsWith(`${scenario.competencyId}-`) &&
      (scenario.variants?.every((variant) =>
        variant.id.startsWith(`${scenario.id}-`),
      ) ??
        true),
    { message: "Scenario/child competency ownership mismatch" },
  );

export type CompetencyDefinition = z.output<typeof competencyDefinitionSchema>;
export type ActivityManifest = z.output<typeof activityManifestSchema>;
export type ScenarioDefinition = z.output<typeof scenarioDefinitionSchema>;
