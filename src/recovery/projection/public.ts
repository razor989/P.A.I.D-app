import { z } from "zod";
import { ExactDecimal, isLearnerResponse } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import {
  currentPrimaryCommitmentValid,
  primaryResponseReady,
  stagedResponseReady,
  validateC04A02StageEngagementV1,
} from "@/engine/activity-machine/public";
import type { ActivityContext } from "@/engine/activity-machine/public";
import type { ActivityActor } from "@/engine/activity-runtime/public";
import {
  createC04ActivityBindings,
  projectC04CheckpointIdentity,
  projectC04CheckpointModelV1,
  validateC04CheckpointModelV1,
  validateC04PartialResponseV1,
} from "@/engine/c04-activity-binding/public";

/** Inspect before parsing: JSON.stringify must never invoke user accessors/toJSON.
 * The decimal exception is only for trusted live response encoding, never DTOs.
 */
export function assertCheckpointData(
  value: unknown,
  live = false,
  seen = new Set<object>(),
): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || seen.has(value))
    throw new TypeError("Non-data checkpoint value");
  if (live && value instanceof ExactDecimal) {
    ExactDecimal.prototype.toString.call(value);
    return;
  }
  const array = Array.isArray(value);
  if (
    Object.getPrototypeOf(value) !==
    (array ? Array.prototype : Object.prototype)
  )
    throw new TypeError("Non-data checkpoint prototype");
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  if (
    array &&
    (keys.length !== value.length + 1 ||
      !Array.from({ length: value.length }, (_, index) =>
        Object.prototype.hasOwnProperty.call(value, index),
      ).every(Boolean))
  )
    throw new TypeError("Sparse or decorated checkpoint array");
  for (const key of keys) {
    if (array && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw new TypeError("Non-data checkpoint property");
    assertCheckpointData(descriptor.value, live, seen);
  }
  seen.delete(value);
}

const label = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const decimal = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/)
  .refine(
    (value) => value !== "-0" && ExactDecimal.from(value).toString() === value,
  );
const atomic = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("EXACT_QUANTITY"),
    value: z.strictObject({
      magnitude: decimal,
      kind: label,
      unit: label,
      basis: label.nullable(),
    }),
  }),
  z.strictObject({ kind: z.literal("SINGLE_SELECTION"), selectionId: label }),
  z.strictObject({
    kind: z.literal("SEMANTIC_BOUNDARY"),
    resolution: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("UNKNOWN"), reason: label }),
      z.strictObject({ kind: z.literal("UNDEFINED"), reason: label }),
      z.strictObject({ kind: z.literal("NOT_APPLICABLE") }),
    ]),
  }),
]);
const responseSchema = z.strictObject({
  kind: z.literal("COMPOSITE"),
  parts: z.array(z.strictObject({ key: label, response: atomic })).min(1),
});
type ResponseV1 = z.infer<typeof responseSchema>;
const commitmentSchema = z.strictObject({
  sequence: revision.refine((value) => value > 0),
  activityId: label,
  contractId: label,
  version: z.literal(1),
  scenarioId: label,
  responseRevision: revision,
  response: responseSchema,
  reasoningPreviouslyExposed: z.boolean(),
});
const activitySchema = z.strictObject({
  competencyId: z.literal("C04"),
  activityId: label,
  scenarioId: label,
  position: z.enum([
    "ENTRY",
    "ACTIVE",
    "REVISION",
    "CONFIRMATION",
    "RECONSIDERATION",
    "POST_CONFIRMATION_EXPLANATION",
    "EXP-01",
    "EXP-02",
    "EXP-03",
    "EXP-04",
    "EXP-05",
  ]),
  response: responseSchema.nullable(),
  responseRevision: revision,
  hasChecked: z.boolean(),
  checkedResponse: responseSchema.nullable(),
  checkedRevision: revision.nullable(),
  feedbackRevision: revision.nullable(),
  evaluation: z
    .strictObject({
      outcome: z.enum(["CONFIRMED", "RECONSIDERATION"]),
      diagnostic: label.nullable(),
    })
    .nullable(),
  model: z
    .strictObject({
      evidence: z.strictObject({
        activityId: z.literal("C04-A02"),
        scenarioId: z.literal("C04-S02"),
        selectedChildId: z.enum(["C04-S02-A", "C04-S02-B"]),
      }),
      revision,
      engagement: z.strictObject({
        "EXP-02": z.strictObject({ "C04-S02-A": z.boolean() }),
        "EXP-03": z.strictObject({ "C04-S02-B": z.boolean() }),
      }),
    })
    .optional(),
  staging: z
    .strictObject({
      responseStage: z.enum(["PRIMARY", "REASONING"]),
      firstPrimaryCommitment: commitmentSchema.nullable(),
      currentPrimaryCommitment: commitmentSchema.nullable(),
      commitmentSequence: revision,
      reasoningExposed: z.boolean(),
      explanationCommitmentSequence: revision.nullable(),
      checkedCommitmentSequence: revision.nullable(),
      terminalEntryRevision: revision.nullable(),
      terminalTeachingRevision: revision.nullable(),
    })
    .optional(),
});
export type C04CheckpointV1 = z.infer<typeof activitySchema>;

// Trusted fixed composition, not checkpoint-driven issuance. Detached validation
// never constructs a model from persisted evidence or starts an actor.
const bindings = createC04ActivityBindings();

function fail(message: string): never {
  throw new TypeError(message);
}

/** Decode value objects only. This does not issue a model or reconstruct an actor. */
function decodeResponse(value: ResponseV1): LearnerResponse {
  return {
    kind: "COMPOSITE",
    parts: value.parts.map((part) => ({
      key: part.key,
      response:
        part.response.kind === "EXACT_QUANTITY"
          ? {
              kind: "EXACT_QUANTITY",
              value: {
                ...part.response.value,
                magnitude: ExactDecimal.from(part.response.value.magnitude),
              },
            }
          : part.response,
    })),
  };
}
function encodeResponse(value: LearnerResponse | null): ResponseV1 | null {
  if (value === null) return null;
  assertCheckpointData(value, true);
  if (!isLearnerResponse(value) || value.kind !== "COMPOSITE")
    return fail("Unsupported C04 response");
  return responseSchema.parse({
    kind: value.kind,
    parts: value.parts.map((part) => ({
      key: part.key,
      response:
        part.response.kind === "EXACT_QUANTITY"
          ? {
              kind: part.response.kind,
              value: {
                ...part.response.value,
                magnitude: ExactDecimal.prototype.toString.call(
                  part.response.value.magnitude,
                ),
              },
            }
          : part.response,
    })),
  });
}
function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}

/** Detached V1 evidence validation. No actor restoration or persisted-model issuance.
 * Only an explicitly checked, complete snapshot is compared with the existing
 * pure binding evaluator; drafts never enter a correctness evaluator.
 */
export function validateC04CheckpointV1(value: unknown): C04CheckpointV1 {
  assertCheckpointData(value);
  const data = activitySchema.parse(value);
  const identity = projectC04CheckpointIdentity(data.activityId);
  if (identity.scenarioId !== data.scenarioId)
    fail("Checkpoint scenario mismatch");
  const binding =
    bindings.find((item) => item.activityId === data.activityId) ??
    fail("Unknown C04 binding");
  const definition = binding.definition;
  const graphPositions = new Set([
    "ENTRY",
    "ACTIVE",
    ...Object.keys(definition.edges),
    ...Object.values(definition.edges).flatMap((edge) =>
      Object.values(edge ?? {}),
    ),
  ]);
  if (
    !graphPositions.has(data.position) &&
    !["REVISION", "CONFIRMATION", "RECONSIDERATION"].includes(data.position)
  )
    fail("Unsupported instructional position");
  const response =
    data.response === null ? null : decodeResponse(data.response);
  const checkedResponse =
    data.checkedResponse === null ? null : decodeResponse(data.checkedResponse);
  const stage = data.staging?.responseStage ?? "RESPONSE";
  data.response = encodeResponse(response);
  data.checkedResponse = encodeResponse(checkedResponse);
  if (
    response !== null &&
    !validateC04PartialResponseV1(data.activityId, response, stage)
  )
    fail("Invalid source response");
  if (
    checkedResponse !== null &&
    (!validateC04PartialResponseV1(
      data.activityId,
      checkedResponse,
      definition.responseStages ? "REASONING" : "RESPONSE",
    ) ||
      !binding.ports.ready(checkedResponse))
  )
    fail("Invalid checked response");
  if (
    (data.responseRevision === 0) !== (response === null) ||
    (!data.hasChecked &&
      (checkedResponse !== null ||
        data.checkedRevision !== null ||
        data.feedbackRevision !== null ||
        data.evaluation !== null))
  )
    fail("Invalid response history");
  const feedbackPhase = [
    "CONFIRMATION",
    "RECONSIDERATION",
    "POST_CONFIRMATION_EXPLANATION",
  ].includes(data.position);
  if (data.evaluation !== null) {
    if (
      !data.hasChecked ||
      (!feedbackPhase &&
        !(data.position === "REVISION" && !definition.responseStages)) ||
      response === null ||
      checkedResponse === null ||
      data.checkedRevision !== data.responseRevision ||
      (data.feedbackRevision !== null &&
        data.feedbackRevision !== data.responseRevision) ||
      canonicalCheckpointJSON(data.response) !==
        canonicalCheckpointJSON(data.checkedResponse)
    )
      fail("Stale checked feedback");
    const expected = binding.ports.evaluate(checkedResponse);
    if (
      expected.outcome !== data.evaluation.outcome ||
      expected.diagnostic !== data.evaluation.diagnostic
    )
      fail("Checked evaluation mismatch");
    if (
      (data.evaluation.outcome === "CONFIRMED") !==
      (data.evaluation.diagnostic === null)
    )
      fail("Invalid evaluation shape");
    if (
      data.position === "CONFIRMATION" &&
      data.evaluation.outcome !== "CONFIRMED"
    )
      fail("Incorrect confirmation phase");
    if (
      data.position === "RECONSIDERATION" &&
      data.evaluation.outcome !== "RECONSIDERATION"
    )
      fail("Incorrect reconsideration phase");
  } else if (
    feedbackPhase ||
    checkedResponse !== null ||
    data.checkedRevision !== null ||
    data.feedbackRevision !== null
  )
    fail("Missing current evaluation");
  if (data.position === "REVISION" && !data.hasChecked)
    fail("Revision before check");
  if (data.hasChecked && response === null)
    fail("Checked history without response");
  const instruction =
    data.position === "ENTRY" || data.position.startsWith("EXP-");
  if (
    instruction &&
    (response !== null || data.responseRevision !== 0 || data.hasChecked)
  )
    fail("Response before active phase");
  if (data.hasChecked && !feedbackPhase && data.position !== "REVISION")
    fail("Checked history outside revision");
  if (definition.modelSelection) {
    const model = data.model ?? fail("Missing A02 model evidence");
    validateC04CheckpointModelV1(model.evidence);
    validateC04A02StageEngagementV1(model.engagement);
    const a = model.engagement["EXP-02"]["C04-S02-A"],
      b = model.engagement["EXP-03"]["C04-S02-B"];
    if (
      model.revision < Number(a) + Number(b) ||
      (model.revision === 0 &&
        model.evidence.selectedChildId !==
          definition.modelSelection.initialSelectionId)
    )
      fail("Inconsistent model evidence");
    // EXP-02 cannot be revisited after EXP-03 without retaining earlier B
    // evidence, so only constraints valid for *all* Previous histories apply.
    if (model.revision === 0 && (a || b)) fail("Engagement without action");
    if (data.position === "ENTRY" && model.revision !== 0)
      fail("Model action before entry");
    if (
      (data.position === "ENTRY" || data.position === "EXP-01") &&
      model.revision === 0 &&
      (a || b)
    )
      fail("Premature engagement");
    if (
      instruction &&
      data.position !== "ENTRY" &&
      data.position !== "EXP-01" &&
      data.position !== "EXP-02" &&
      model.evidence.selectedChildId === "C04-S02-B" &&
      model.revision === 0
    )
      fail("Unselected model child");
  } else if (data.model !== undefined) fail("Synthetic model evidence");
  if (definition.responseStages) {
    const policy = definition.responseStages;
    const s = data.staging ?? fail("Missing A04 staging evidence");
    const decodeCommitment = (
      item: NonNullable<typeof s.currentPrimaryCommitment>,
    ) => ({
      ...item,
      activityId: binding.activityId,
      response: decodeResponse(item.response),
    });
    for (const item of [s.firstPrimaryCommitment, s.currentPrimaryCommitment]) {
      if (!item) continue;
      item.response = responseSchema.parse(
        encodeResponse(decodeResponse(item.response)),
      );
      if (
        item.activityId !== data.activityId ||
        item.scenarioId !== data.scenarioId ||
        item.contractId !== policy.contractId ||
        item.version !== policy.version ||
        item.responseRevision === 0 ||
        item.responseRevision > data.responseRevision ||
        !validateC04PartialResponseV1(
          data.activityId,
          decodeResponse(item.response),
          "PRIMARY",
        ) ||
        !primaryResponseReady(decodeResponse(item.response), policy)
      )
        fail("Invalid primary commitment");
    }
    const first = s.firstPrimaryCommitment,
      current = s.currentPrimaryCommitment;
    if (
      s.commitmentSequence > data.responseRevision ||
      (s.commitmentSequence === 0) !== (first === null) ||
      s.reasoningExposed !== (first !== null) ||
      (first && (first.sequence !== 1 || first.reasoningPreviouslyExposed)) ||
      (current &&
        (current.sequence !== s.commitmentSequence ||
          current.reasoningPreviouslyExposed !== current.sequence > 1)) ||
      (first &&
        current &&
        (first.responseRevision > current.responseRevision ||
          (current.sequence > 1 &&
            first.responseRevision >= current.responseRevision) ||
          (current.sequence === 1 &&
            canonicalCheckpointJSON(first) !==
              canonicalCheckpointJSON(current))))
    )
      fail("Inconsistent commitment history");
    const context: ActivityContext = {
      activityId: binding.activityId,
      position: data.position,
      origin: null,
      infoOrigin: null,
      response,
      checkedResponse,
      responseRevision: data.responseRevision,
      hasChecked: data.hasChecked,
      checkedRevision: data.checkedRevision,
      feedbackRevision: data.feedbackRevision,
      evaluation: data.evaluation,
      ...s,
      firstPrimaryCommitment: first ? decodeCommitment(first) : null,
      currentPrimaryCommitment: current ? decodeCommitment(current) : null,
    };
    if (s.responseStage === "PRIMARY") {
      if (
        current !== null ||
        s.explanationCommitmentSequence !== null ||
        s.checkedCommitmentSequence !== null ||
        data.evaluation !== null
      )
        fail("Primary stage carries dependent evidence");
    } else {
      if (!currentPrimaryCommitmentValid(context, policy))
        fail("Invalid reasoning commitment");
      const hasExplanation =
        data.response?.parts.some(
          (part) => part.key === policy.reasoningField,
        ) ?? false;
      if (
        hasExplanation
          ? !stagedResponseReady(context, policy)
          : s.explanationCommitmentSequence !== null
      )
        fail("Invalid reasoning response currency");
      if (
        s.checkedCommitmentSequence !==
        (data.evaluation ? current?.sequence : null)
      )
        fail("Invalid checked commitment currency");
    }
    if (
      instruction &&
      (s.commitmentSequence !== 0 || s.responseStage !== "PRIMARY")
    )
      fail("Premature staging history");
    if (data.position === "POST_CONFIRMATION_EXPLANATION") {
      if (
        data.feedbackRevision !== data.responseRevision ||
        s.terminalEntryRevision !== data.responseRevision ||
        (s.terminalTeachingRevision !== null &&
          s.terminalTeachingRevision !== data.responseRevision)
      )
        fail("Invalid terminal teaching currency");
    } else if (
      s.terminalEntryRevision !== null ||
      s.terminalTeachingRevision !== null
    )
      fail("Premature terminal acknowledgment");
  } else if (data.staging !== undefined) fail("Staging on non-staged activity");
  const normalize = (item: ResponseV1 | null) =>
    item === null ? null : encodeResponse(decodeResponse(item));
  data.response = normalize(data.response);
  data.checkedResponse = normalize(data.checkedResponse);
  if (data.staging)
    for (const item of [
      data.staging.firstPrimaryCommitment,
      data.staging.currentPrimaryCommitment,
    ])
      if (item) item.response = responseSchema.parse(normalize(item.response));
  return frozen(data);
}

/** Stable object-key order; response array order is semantic and preserved.
 * Existing binding evaluation uses supplied-field order for diagnostic priority.
 */
export function canonicalCheckpointJSON(value: unknown): string {
  assertCheckpointData(value);
  function order(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(order);
    if (item !== null && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, order(child)]),
      );
    return item;
  }
  return JSON.stringify(order(value));
}

/** Project semantic context only; never serialize an XState snapshot or support state. */
export function projectC04CheckpointV1(actor: ActivityActor): C04CheckpointV1 {
  const snapshot = actor.getSnapshot();
  if (snapshot.status !== "active")
    fail("Only active unfinished actors can be checkpointed");
  const c = snapshot.context;
  if (
    Object.getPrototypeOf(c) !== Object.prototype ||
    Reflect.ownKeys(c).some(
      (key) =>
        !Object.prototype.hasOwnProperty.call(
          Object.getOwnPropertyDescriptor(c, key) ?? {},
          "value",
        ),
    )
  )
    fail("Non-data actor context");
  if (c.infoOrigin !== null) fail("Unsupported C04 provider context");
  const identity = projectC04CheckpointIdentity(c.activityId);
  const definition = bindings.find(
    (item) => item.activityId === c.activityId,
  )!.definition;
  if (c.origin !== null && c.origin !== c.position)
    fail("Ambiguous support origin");
  if (definition.modelSelection) {
    const evidence = projectC04CheckpointModelV1(c.model?.value.state);
    if (
      c.model?.modelId !== definition.modelSelection.modelId ||
      c.model.value.selectionId !== evidence.selectedChildId
    )
      fail("Actor model identity mismatch");
  }
  const encodeCommitment = (
    item:
      | NonNullable<ActivityContext["currentPrimaryCommitment"]>
      | null
      | undefined,
  ) =>
    item == null ? null : { ...item, response: encodeResponse(item.response) };
  return validateC04CheckpointV1({
    competencyId: "C04",
    ...identity,
    position: c.origin ?? c.position,
    response: encodeResponse(c.response),
    responseRevision: c.responseRevision,
    hasChecked: c.hasChecked,
    checkedResponse: encodeResponse(c.checkedResponse),
    checkedRevision: c.checkedRevision,
    feedbackRevision: c.feedbackRevision,
    evaluation: c.evaluation,
    ...(definition.modelSelection
      ? {
          model: {
            evidence: projectC04CheckpointModelV1(c.model?.value.state),
            revision: c.model?.revision,
            engagement: c.c04A02StageEngagement,
          },
        }
      : c.model !== undefined || c.c04A02StageEngagement !== undefined
        ? fail("Unexpected actor model")
        : {}),
    ...(definition.responseStages
      ? {
          staging: {
            responseStage: c.responseStage,
            firstPrimaryCommitment: encodeCommitment(c.firstPrimaryCommitment),
            currentPrimaryCommitment: encodeCommitment(
              c.currentPrimaryCommitment,
            ),
            commitmentSequence: c.commitmentSequence,
            reasoningExposed: c.reasoningExposed,
            explanationCommitmentSequence: c.explanationCommitmentSequence,
            checkedCommitmentSequence: c.checkedCommitmentSequence,
            terminalEntryRevision: c.terminalEntryRevision,
            terminalTeachingRevision: c.terminalTeachingRevision,
          },
        }
      : {}),
  });
}
