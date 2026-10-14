import { isActivityId, isProviderRead } from "../../core/public";
import type { ActivityId } from "../../core/public";
import type { Position, SupportPhase } from "../activity-machine/public";

export type SafeText = Readonly<{ id: string; text: string }>;
export type ReviewProjection = Readonly<{
  mode: "REVIEW";
  receivingActivityId: ActivityId;
  invokingPhase: Position;
  returnTo: Position;
  relationships: readonly SafeText[];
}>;
export type SourceReviewProjection = Readonly<{
  mode: "SOURCE_REVIEW";
  receivingActivityId: ActivityId;
  invokingPhase: Position;
  returnTo: Position;
  sourceRecordId: string;
  providerCompetencyId: string;
  exposedFields: readonly SafeText[];
}>;

/** Trusted composition must authenticate content identity and provenance before injection.
 * Structural validation here cannot establish membership in the canonical Study bank. */
export type ReviewAuthorization = Readonly<{
  receivingActivityId: ActivityId;
  invokingPhase: Position;
  relationships: readonly SafeText[];
}>;
export type SourceReviewAuthorization = Readonly<{
  mode: "SOURCE_REVIEW";
  receivingActivityId: ActivityId;
  invokingPhase: Position;
  sourceRecordId: string;
  providerCompetencyId: string;
  sourceOutputKey: string;
  providerRead: unknown;
  permittedFields: readonly string[];
  requestedFields: readonly string[];
  providerFields: readonly SafeText[];
}>;

const label = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const text = (value: SafeText): SafeText | null =>
  value && label(value.id) && label(value.text)
    ? Object.freeze({ id: value.id, text: value.text })
    : null;

export function projectReview(
  activityId: ActivityId,
  phase: Position,
  origin: Position | null,
  support: SupportPhase,
  authorization: ReviewAuthorization | undefined,
): ReviewProjection | null {
  if (
    !isActivityId(activityId) ||
    support !== "REVIEW" ||
    origin !== phase ||
    !authorization ||
    authorization.receivingActivityId !== activityId ||
    authorization.invokingPhase !== phase ||
    !Array.isArray(authorization.relationships)
  )
    return null;
  const relationships = authorization.relationships.map(text);
  if (relationships.includes(null)) return null;
  return Object.freeze({
    mode: "REVIEW",
    receivingActivityId: activityId,
    invokingPhase: phase,
    returnTo: origin,
    relationships: Object.freeze(relationships as SafeText[]),
  });
}

/** Reject the entire request when even one requested field exceeds the explicit
 * receiving edge's field whitelist. Never copy the provider result wholesale. */
export function projectSourceReview(
  activityId: ActivityId,
  phase: Position,
  origin: Position | null,
  support: SupportPhase,
  authorization: SourceReviewAuthorization | undefined,
): SourceReviewProjection | null {
  if (
    !isActivityId(activityId) ||
    support !== "SOURCE_REVIEW" ||
    origin !== phase ||
    !authorization ||
    authorization.mode !== "SOURCE_REVIEW" ||
    authorization.receivingActivityId !== activityId ||
    authorization.invokingPhase !== phase ||
    !label(authorization.sourceRecordId) ||
    !label(authorization.providerCompetencyId) ||
    !label(authorization.sourceOutputKey) ||
    !isProviderRead(authorization.providerRead) ||
    authorization.providerRead.kind !== "ESTABLISHED" ||
    authorization.providerRead.result.availability !== "AVAILABLE" ||
    authorization.providerRead.provenance.providerCompetencyId !==
      authorization.providerCompetencyId ||
    authorization.providerRead.provenance.consumerCompetencyId !==
      activityId.slice(0, 3) ||
    authorization.providerRead.provenance.sourceRecordId !==
      authorization.sourceRecordId ||
    authorization.providerRead.provenance.sourceOutputKey !==
      authorization.sourceOutputKey ||
    !Array.isArray(authorization.permittedFields) ||
    !Array.isArray(authorization.requestedFields) ||
    !Array.isArray(authorization.providerFields) ||
    authorization.requestedFields.length === 0 ||
    !authorization.permittedFields.every(label) ||
    !authorization.requestedFields.every(
      (id) => label(id) && authorization.permittedFields.includes(id),
    ) ||
    new Set(authorization.requestedFields).size !==
      authorization.requestedFields.length
  )
    return null;
  // A source result can carry more fields than the receiving edge permits.
  // Only the explicitly requested, whitelisted fields are constructed.
  const fields: readonly SafeText[] = authorization.providerFields;
  const exposedFields: SafeText[] = [];
  for (const id of authorization.requestedFields) {
    const matches = fields.filter((field) => field?.id === id);
    if (matches.length !== 1) return null;
    const match = matches[0];
    if (!match) return null;
    const safe = text(match);
    if (!safe) return null;
    exposedFields.push(safe);
  }
  return Object.freeze({
    mode: "SOURCE_REVIEW",
    receivingActivityId: activityId,
    invokingPhase: phase,
    returnTo: origin,
    sourceRecordId: authorization.sourceRecordId,
    providerCompetencyId: authorization.providerCompetencyId,
    exposedFields: Object.freeze(exposedFields),
  });
}
