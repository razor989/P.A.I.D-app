import { z } from "zod";
import { studyDefinitionRevision } from "@/study/revision/public";
import {
  assertCheckpointData,
  canonicalCheckpointJSON,
  validateC04CheckpointV1,
  validateC02ReferenceCheckpointV2,
} from "../projection/public";
import type { C04CheckpointV1 } from "../projection/public";
import type { C02ReferenceCheckpointV2 } from "../projection/public";
import { validateC03CheckpointV3 } from "../projection/public";
import type { C03CheckpointV3 } from "../projection/public";
import { validateC06CheckpointV4 } from "../projection/public";
import type { C06CheckpointV4 } from "../projection/public";

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

/** Explicit opt-in reference extension. V1 entry points remain V1-only. */
export type RecoveryCheckpointEnvelopeV2 = Readonly<{
  schemaVersion: 2;
  studyDefinitionRevision: typeof studyDefinitionRevision;
  kind: "unfinished-activity";
  checkpoint: C02ReferenceCheckpointV2;
}>;
const envelopeV2 = z.strictObject({
  schemaVersion: z.literal(2),
  studyDefinitionRevision: z.literal(studyDefinitionRevision),
  kind: z.literal("unfinished-activity"),
  checkpoint: z.unknown(),
});

export function validateRecoveryCheckpointV2(
  value: unknown,
): RecoveryCheckpointEnvelopeV2 {
  assertCheckpointData(value);
  const parsed = envelopeV2.parse(value);
  return Object.freeze({
    ...parsed,
    checkpoint: validateC02ReferenceCheckpointV2(parsed.checkpoint),
  });
}

export function createRecoveryCheckpointV2(
  checkpoint: C02ReferenceCheckpointV2,
): RecoveryCheckpointEnvelopeV2 {
  return validateRecoveryCheckpointV2({
    schemaVersion: 2,
    studyDefinitionRevision,
    kind: "unfinished-activity",
    checkpoint,
  });
}

export function serializeRecoveryCheckpointV2(value: unknown): string {
  return canonicalCheckpointJSON(validateRecoveryCheckpointV2(value));
}

export function parseRecoveryCheckpointV2(
  text: string,
): RecoveryCheckpointEnvelopeV2 {
  const value: unknown = JSON.parse(text);
  return validateRecoveryCheckpointV2(value);
}

/** C03 opt-in; V1/V2 bytes and dispatch remain untouched. */
export type RecoveryCheckpointEnvelopeV3 = Readonly<{
  schemaVersion: 3;
  studyDefinitionRevision: typeof studyDefinitionRevision;
  kind: "unfinished-activity";
  checkpoint: C03CheckpointV3;
}>;
const envelopeV3 = z.strictObject({
  schemaVersion: z.literal(3),
  studyDefinitionRevision: z.literal(studyDefinitionRevision),
  kind: z.literal("unfinished-activity"),
  checkpoint: z.unknown(),
});
export function validateRecoveryCheckpointV3(
  value: unknown,
): RecoveryCheckpointEnvelopeV3 {
  assertCheckpointData(value);
  const parsed = envelopeV3.parse(value);
  return Object.freeze({
    ...parsed,
    checkpoint: validateC03CheckpointV3(parsed.checkpoint),
  });
}
export function createRecoveryCheckpointV3(
  checkpoint: C03CheckpointV3,
): RecoveryCheckpointEnvelopeV3 {
  return validateRecoveryCheckpointV3({
    schemaVersion: 3,
    studyDefinitionRevision,
    kind: "unfinished-activity",
    checkpoint,
  });
}
export function serializeRecoveryCheckpointV3(value: unknown): string {
  return canonicalCheckpointJSON(validateRecoveryCheckpointV3(value));
}
export function parseRecoveryCheckpointV3(
  text: string,
): RecoveryCheckpointEnvelopeV3 {
  const value: unknown = JSON.parse(text);
  return validateRecoveryCheckpointV3(value);
}

/** C06 opt-in only. Existing version parsers remain closed to V4. */
export type RecoveryCheckpointEnvelopeV4 = Readonly<{
  schemaVersion: 4;
  studyDefinitionRevision: typeof studyDefinitionRevision;
  kind: "unfinished-activity";
  checkpoint: C06CheckpointV4;
}>;
const envelopeV4 = z.strictObject({
  schemaVersion: z.literal(4),
  studyDefinitionRevision: z.literal(studyDefinitionRevision),
  kind: z.literal("unfinished-activity"),
  checkpoint: z.unknown(),
});
export function validateRecoveryCheckpointV4(
  value: unknown,
): RecoveryCheckpointEnvelopeV4 {
  assertCheckpointData(value);
  const parsed = envelopeV4.parse(value);
  return Object.freeze({
    ...parsed,
    checkpoint: validateC06CheckpointV4(parsed.checkpoint),
  });
}
export function createRecoveryCheckpointV4(
  checkpoint: C06CheckpointV4,
): RecoveryCheckpointEnvelopeV4 {
  return validateRecoveryCheckpointV4({
    schemaVersion: 4,
    studyDefinitionRevision,
    kind: "unfinished-activity",
    checkpoint,
  });
}
export function serializeRecoveryCheckpointV4(value: unknown): string {
  return canonicalCheckpointJSON(validateRecoveryCheckpointV4(value));
}
export function parseRecoveryCheckpointV4(
  text: string,
): RecoveryCheckpointEnvelopeV4 {
  const value: unknown = JSON.parse(text);
  return validateRecoveryCheckpointV4(value);
}
