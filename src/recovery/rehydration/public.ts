import { createC04RestoredActivityActor } from "@/engine/c04-activity-binding/public";
import type { C04Restoration } from "@/engine/c04-activity-binding/public";
import { parseRecoveryCheckpointV1 } from "../checkpoint/public";
import type { RecoveryCheckpointEnvelopeV1 } from "../checkpoint/public";
import { parseRecoveryCheckpointV2 } from "../checkpoint/public";
import type { RecoveryCheckpointEnvelopeV2 } from "../checkpoint/public";
import { createC02ReferenceActivityActor } from "@/engine/activity-runtime/public";
import {
  canonicalCheckpointJSON,
  projectC04CheckpointV1,
  projectC02ReferenceCheckpointV2,
} from "../projection/public";
import type { C04CheckpointV1 } from "../projection/public";
import type { RecoveryCheckpointQueue } from "../store/public";

// Existing Recovery -> Core root-public permission; no domain/private import.
import { ExactDecimal } from "@/core/public";

type Actor = ReturnType<typeof createC04RestoredActivityActor>;
type Context = C04Restoration["context"];
type Commitment = NonNullable<Context["currentPrimaryCommitment"]>;
type ResponseV1 = NonNullable<C04CheckpointV1["response"]>;

function decodeResponse(value: ResponseV1 | null): Context["response"] {
  if (value === null) return null;
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

/** Validated semantic evidence only; the binding independently validates source
 * composition and reissues A02. This never constructs a library snapshot.
 */
function reconstruct(envelope: RecoveryCheckpointEnvelopeV1): Actor {
  const data = envelope.checkpoint;
  const identity = data.activityId as Context["activityId"];
  const commitment = (
    item: NonNullable<typeof data.staging>["currentPrimaryCommitment"],
  ): Commitment | null =>
    item === null
      ? null
      : {
          ...item,
          activityId: identity,
          response: decodeResponse(item.response)!,
        };
  const context: Context = {
    activityId: identity,
    position: data.position,
    origin: null,
    infoOrigin: null,
    response: decodeResponse(data.response),
    checkedResponse: decodeResponse(data.checkedResponse),
    responseRevision: data.responseRevision,
    checkedRevision: data.checkedRevision,
    feedbackRevision: data.feedbackRevision,
    hasChecked: data.hasChecked,
    evaluation: data.evaluation,
    ...(data.model
      ? {
          model: {
            revision: data.model.revision,
            value: {
              selectionId: data.model.evidence.selectedChildId,
              state: null,
            },
          },
          c04A02StageEngagement: data.model.engagement,
        }
      : {}),
    ...(data.staging
      ? {
          ...data.staging,
          firstPrimaryCommitment: commitment(
            data.staging.firstPrimaryCommitment,
          ),
          currentPrimaryCommitment: commitment(
            data.staging.currentPrimaryCommitment,
          ),
        }
      : {}),
  };
  const actor = createC04RestoredActivityActor({
    scenarioId: data.scenarioId,
    context,
    ...(data.model ? { modelEvidence: data.model.evidence } : {}),
  });
  try {
    if (
      canonicalCheckpointJSON(projectC04CheckpointV1(actor)) !==
      canonicalCheckpointJSON(data)
    )
      throw new TypeError("Reconstructed semantic checkpoint mismatch");
    return actor;
  } catch (error) {
    actor.stop();
    throw error;
  }
}

export type RecoveryClassification =
  | Readonly<{ status: "NO_CHECKPOINT" }>
  | Readonly<{
      status: "VALID_CHECKPOINT";
      checkpoint: RecoveryCheckpointEnvelopeV1;
      actor: Actor;
    }>
  | Readonly<{ status: "UNUSABLE_CHECKPOINT" }>
  | Readonly<{ status: "technical-failure"; error: unknown }>;

type ReadQueue = Pick<RecoveryCheckpointQueue, "load">;
const classificationClaims = new WeakMap<
  object,
  {
    queue: ReadQueue;
    untouched: () => boolean;
    release: () => void;
  }
>();

/** Consume the exact classifier-issued result once, for its original queue.
 * No status, actor or error is read from an unissued object. */
export function claimRecoveryClassification(
  queue: ReadQueue,
  value: unknown,
): value is RecoveryClassification {
  if (
    value === null ||
    typeof value !== "object" ||
    classificationClaims.get(value)?.queue !== queue
  )
    return false;
  const proof = classificationClaims.get(value)!;
  const untouched = proof.untouched();
  proof.release();
  classificationClaims.delete(value);
  return untouched;
}

function issueClassification(
  queue: ReadQueue,
  value: RecoveryClassification,
): RecoveryClassification {
  Object.freeze(value);
  let emitted = false;
  const actor = value.status === "VALID_CHECKPOINT" ? value.actor : null;
  const snapshot = actor?.getSnapshot();
  const subscription = actor?.subscribe(() => {
    emitted = true;
  });
  classificationClaims.set(value, {
    queue,
    untouched: () => !emitted && (!actor || actor.getSnapshot() === snapshot),
    release: () => subscription?.unsubscribe(),
  });
  return value;
}

/** T030 owns ordered reads. No classification branch writes or clears storage;
 * the returned new actor remains unstarted and downstream caller-owned.
 */
export async function recoverCheckpoint(
  queue: ReadQueue,
): Promise<RecoveryClassification> {
  let result: Awaited<ReturnType<RecoveryCheckpointQueue["load"]>>;
  try {
    result = await queue.load();
  } catch (error) {
    return issueClassification(queue, { status: "technical-failure", error });
  }
  if (result.status === "technical-failure")
    return issueClassification(queue, {
      status: "technical-failure",
      error: result.error,
    });
  if (result.checkpoint === null)
    return issueClassification(queue, { status: "NO_CHECKPOINT" });
  try {
    const checkpoint = parseRecoveryCheckpointV1(result.checkpoint);
    const actor = reconstruct(checkpoint);
    return issueClassification(queue, {
      status: "VALID_CHECKPOINT",
      checkpoint,
      actor,
    });
  } catch {
    return issueClassification(queue, { status: "UNUSABLE_CHECKPOINT" });
  }
}

/** Distinct classification cannot enter unchanged V1 Session startup. */
export type RecoveryClassificationV2 =
  | Readonly<{ status: "NO_CHECKPOINT_V2" }>
  | Readonly<{
      status: "VALID_REFERENCE_CHECKPOINT_V2";
      checkpoint: RecoveryCheckpointEnvelopeV2;
      actor: Actor;
    }>
  | Readonly<{ status: "UNUSABLE_CHECKPOINT_V2" }>
  | Readonly<{ status: "technical-failure-v2"; error: unknown }>;
const referenceClaims = new WeakMap<
  object,
  { queue: ReadQueue; untouched: () => boolean; release: () => void }
>();

function issueReferenceClassification(
  queue: ReadQueue,
  value: RecoveryClassificationV2,
): RecoveryClassificationV2 {
  Object.freeze(value);
  const actor =
    value.status === "VALID_REFERENCE_CHECKPOINT_V2" ? value.actor : null;
  const snapshot = actor?.getSnapshot();
  const work = actor
    ? canonicalCheckpointJSON(projectC02ReferenceCheckpointV2(actor))
    : null;
  let emitted = false;
  const subscription = actor?.subscribe(() => {
    emitted = true;
  });
  referenceClaims.set(value, {
    queue,
    untouched: () => {
      if (emitted || (actor && actor.getSnapshot() !== snapshot)) return false;
      try {
        return (
          !actor ||
          canonicalCheckpointJSON(projectC02ReferenceCheckpointV2(actor)) ===
            work
        );
      } catch {
        return false;
      }
    },
    release: () => subscription?.unsubscribe(),
  });
  return value;
}

export function claimRecoveryClassificationV2(
  queue: ReadQueue,
  value: unknown,
): value is RecoveryClassificationV2 {
  if (value === null || typeof value !== "object") return false;
  const proof = referenceClaims.get(value);
  if (!proof || proof.queue !== queue) return false;
  referenceClaims.delete(value);
  const untouched = proof.untouched();
  proof.release();
  return untouched;
}

function reconstructReference(envelope: RecoveryCheckpointEnvelopeV2): Actor {
  const data = envelope.checkpoint;
  const response = decodeResponse(data.response);
  const pending =
    data.floor.kind === "MAIN"
      ? null
      : {
          basis: data.floor.basis,
          revision: data.floor.revision,
          mainRevision: data.floor.mainRevision,
        };
  const position =
    data.position === "C02-S01-F"
      ? data.evaluation!.outcome === "CONFIRMED"
        ? "CONFIRMATION"
        : "RECONSIDERATION"
      : data.position;
  const actor = createC02ReferenceActivityActor({
    position,
    response,
    responseRevision: data.responseRevision,
    hasChecked: data.hasChecked,
    evaluation: data.evaluation,
    pending,
  });
  try {
    // Compare replay-normalized meaning, never force saved Floor into live Anna.
    const expected = {
      ...data,
      position,
      feedbackRevision: null,
      floor: pending
        ? { kind: "ANNA_REPLAY_PENDING_FLOOR", ...pending }
        : { kind: "MAIN" },
    };
    if (
      canonicalCheckpointJSON(projectC02ReferenceCheckpointV2(actor)) !==
      canonicalCheckpointJSON(expected)
    )
      throw new TypeError("Reconstructed C02 reference work mismatch");
    return actor;
  } catch (error) {
    actor.stop();
    throw error;
  }
}

/** Explicit opt-in, headless and non-destructive. No V1 dispatch or Session change. */
export async function recoverReferenceCheckpointV2(
  queue: ReadQueue,
): Promise<RecoveryClassificationV2> {
  let result: Awaited<ReturnType<ReadQueue["load"]>>;
  try {
    result = await queue.load();
  } catch (error) {
    return issueReferenceClassification(queue, {
      status: "technical-failure-v2",
      error,
    });
  }
  if (result.status === "technical-failure")
    return issueReferenceClassification(queue, {
      status: "technical-failure-v2",
      error: result.error,
    });
  if (result.checkpoint === null)
    return issueReferenceClassification(queue, { status: "NO_CHECKPOINT_V2" });
  try {
    const checkpoint = parseRecoveryCheckpointV2(result.checkpoint);
    const actor = reconstructReference(checkpoint);
    return issueReferenceClassification(queue, {
      status: "VALID_REFERENCE_CHECKPOINT_V2",
      checkpoint,
      actor,
    });
  } catch {
    return issueReferenceClassification(queue, {
      status: "UNUSABLE_CHECKPOINT_V2",
    });
  }
}
