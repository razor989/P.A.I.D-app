import { createC04RestoredActivityActor } from "@/engine/c04-activity-binding/public";
import type { C04Restoration } from "@/engine/c04-activity-binding/public";
import { parseRecoveryCheckpointV1 } from "../checkpoint/public";
import type { RecoveryCheckpointEnvelopeV1 } from "../checkpoint/public";
import {
  canonicalCheckpointJSON,
  projectC04CheckpointV1,
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

/** T030 owns ordered reads. No classification branch writes or clears storage;
 * the returned new actor remains unstarted and downstream caller-owned.
 */
export async function recoverCheckpoint(
  queue: Pick<RecoveryCheckpointQueue, "load">,
): Promise<RecoveryClassification> {
  let result: Awaited<ReturnType<RecoveryCheckpointQueue["load"]>>;
  try {
    result = await queue.load();
  } catch (error) {
    return Object.freeze({ status: "technical-failure", error });
  }
  if (result.status === "technical-failure")
    return Object.freeze({ status: "technical-failure", error: result.error });
  if (result.checkpoint === null)
    return Object.freeze({ status: "NO_CHECKPOINT" });
  try {
    const checkpoint = parseRecoveryCheckpointV1(result.checkpoint);
    const actor = reconstruct(checkpoint);
    return Object.freeze({ status: "VALID_CHECKPOINT", checkpoint, actor });
  } catch {
    return Object.freeze({ status: "UNUSABLE_CHECKPOINT" });
  }
}
