import { z } from "zod";
import { studyDefinitionRevision } from "@/study/revision/public";
import {
  assertCheckpointData,
  canonicalCheckpointJSON,
  validateC04CheckpointV1,
} from "../projection/public";
import type { C04CheckpointV1 } from "../projection/public";

export type RecoveryCheckpointEnvelopeV1 = Readonly<{
  schemaVersion: 1;
  studyDefinitionRevision: typeof studyDefinitionRevision;
  kind: "unfinished-activity";
  checkpoint: C04CheckpointV1;
}>;
const envelope = z.strictObject({
  schemaVersion: z.literal(1),
  studyDefinitionRevision: z.literal(studyDefinitionRevision),
  kind: z.literal("unfinished-activity"),
  checkpoint: z.unknown(),
});

export function validateRecoveryCheckpointV1(
  value: unknown,
): RecoveryCheckpointEnvelopeV1 {
  assertCheckpointData(value);
  const parsed = envelope.parse(value);
  return Object.freeze({
    ...parsed,
    checkpoint: validateC04CheckpointV1(parsed.checkpoint),
  });
}
export function createRecoveryCheckpointV1(
  checkpoint: C04CheckpointV1,
): RecoveryCheckpointEnvelopeV1 {
  return validateRecoveryCheckpointV1({
    schemaVersion: 1,
    studyDefinitionRevision,
    kind: "unfinished-activity",
    checkpoint,
  });
}
export function serializeRecoveryCheckpointV1(value: unknown): string {
  return canonicalCheckpointJSON(validateRecoveryCheckpointV1(value));
}
export function parseRecoveryCheckpointV1(
  text: string,
): RecoveryCheckpointEnvelopeV1 {
  const value: unknown = JSON.parse(text);
  return validateRecoveryCheckpointV1(value);
}
