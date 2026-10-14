import { isActivityId, isLearnerResponse } from "../../core/public";
import type { ActivityId } from "../../core/public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityEvent,
  ActivityPorts,
  CompletionEvidence,
  Position,
  SupportPhase,
} from "../activity-machine/public";
import { projectReview, projectSourceReview } from "../review/public";
import type {
  ReviewAuthorization,
  ReviewProjection,
  SafeText,
  SourceReviewAuthorization,
  SourceReviewProjection,
} from "../review/public";

export type Exposure = Readonly<{
  content: SafeText;
  /** Source-authored exposure scope; checked alone is never a universal reveal. */
  phases: readonly Position[];
  timing: "PUBLIC" | "CURRENT_CHECK" | "CURRENT_FEEDBACK" | "EXPLICIT_REVEAL";
  /** Explicit reveal is tied to a particular current check, not a boolean. */
  revealRevision?: number;
}>;
export type FrameContent = Readonly<{
  references: readonly Exposure[];
  modelFacts: readonly Exposure[];
  derivedFacts: readonly Exposure[];
  responseContract: SafeText;
  feedback?: Readonly<{
    outcome: "CONFIRMED" | "RECONSIDERATION";
    revision: number;
    content: SafeText;
  }>;
  review?: ReviewAuthorization;
  sourceReview?: SourceReviewAuthorization;
}>;
/** Authentication of source material, manifest membership, reveal and provider
 * provenance belongs to future trusted composition (T027+), NOT this interface.
 * A synthetic injected authorization demonstrates enforcement, not authenticity. */
export type FrameInput = Readonly<{
  context: ActivityContext;
  phase: Position;
  support: SupportPhase;
  definition: ActivityDefinition;
  ports: ActivityPorts;
  content: FrameContent;
}>;
export type LearnerIntent = ActivityEvent["type"];
export type SemanticActivityFrame = Readonly<{
  activityId: ActivityId;
  stateId: string;
  contentReferences: readonly SafeText[];
  exposedModelFacts: readonly SafeText[];
  exposedDerivedFacts: readonly SafeText[];
  allowedLearnerIntents: readonly LearnerIntent[];
  responseContract: SafeText;
  feedbackState?: Readonly<{
    outcome: "CONFIRMED" | "RECONSIDERATION";
    content: SafeText;
  }>;
  reviewAvailability: boolean;
  sourceReviewAvailability: boolean;
  completionActionAvailability: boolean;
  review?: ReviewProjection;
  sourceReview?: SourceReviewProjection;
}>;

const phaseValid = (value: unknown): value is Position =>
  value === "ENTRY" ||
  value === "ACTIVE" ||
  value === "REVISION" ||
  value === "CONFIRMATION" ||
  value === "POST_CONFIRMATION_EXPLANATION" ||
  value === "RECONSIDERATION" ||
  value === "INFO_NEEDED" ||
  value === "COMPLETE" ||
  (typeof value === "string" &&
    /^EXP-[0-9]{2,}$/.test(value) &&
    value !== "EXP-00");
const safeText = (value: SafeText | undefined): SafeText | null =>
  value &&
  typeof value.id === "string" &&
  value.id.trim() === value.id &&
  value.id.length > 0 &&
  typeof value.text === "string" &&
  value.text.trim() === value.text &&
  value.text.length > 0
    ? Object.freeze({ id: value.id, text: value.text })
    : null;
const authorized = (callback: () => boolean): boolean => {
  try {
    return callback() === true;
  } catch {
    return false;
  }
};

function projectFacts(
  items: readonly Exposure[],
  phase: Position,
  context: ActivityContext,
  currentCheck: boolean,
  currentFeedback: boolean,
): readonly SafeText[] {
  // This phase is reachable only after delivery for the current confirmed check.
  if (phase === "POST_CONFIRMATION_EXPLANATION" && !currentFeedback)
    return Object.freeze([]);
  if (!Array.isArray(items)) return Object.freeze([]);
  const entries: readonly Exposure[] = items;
  const output: SafeText[] = [];
  for (const item of entries) {
    if (!item || !Array.isArray(item.phases) || !item.phases.includes(phase))
      continue;
    const permitted =
      item.timing === "PUBLIC" ||
      (item.timing === "CURRENT_CHECK" && currentCheck) ||
      (item.timing === "CURRENT_FEEDBACK" && currentFeedback) ||
      (item.timing === "EXPLICIT_REVEAL" &&
        currentCheck &&
        item.revealRevision === context.responseRevision);
    if (!permitted) continue;
    const safe = safeText(item.content);
    if (safe) output.push(safe);
  }
  return Object.freeze(output);
}

/** Pure, allowlist-only semantic projection. Never pass a snapshot, evaluator
 * diagnostic, raw response, model or provider result to a renderer. */
export function projectSemanticActivityFrame(
  input: FrameInput,
): SemanticActivityFrame {
  const { context: c, phase, support, definition, ports, content } = input;
  if (
    !isActivityId(c.activityId) ||
    c.activityId !== definition.activityId ||
    !phaseValid(phase) ||
    (phase === "POST_CONFIRMATION_EXPLANATION" &&
      definition.edges.CONFIRMATION?.CONTINUE !==
        "POST_CONFIRMATION_EXPLANATION") ||
    c.position !== phase ||
    !["NONE", "REVIEW", "SOURCE_REVIEW", "REINFORCEMENT"].includes(support) ||
    (support === "NONE" ? c.origin !== null : c.origin !== phase) ||
    !Number.isSafeInteger(c.responseRevision) ||
    c.responseRevision < 0 ||
    !content ||
    !safeText(content.responseContract)
  )
    throw new TypeError("Invalid semantic projection input");
  const currentCheck =
    c.response !== null &&
    c.hasChecked &&
    c.checkedRevision === c.responseRevision &&
    c.evaluation !== null &&
    ((phase === "CONFIRMATION" && c.evaluation.outcome === "CONFIRMED") ||
      (phase === "POST_CONFIRMATION_EXPLANATION" &&
        definition.edges.CONFIRMATION?.CONTINUE ===
          "POST_CONFIRMATION_EXPLANATION" &&
        c.evaluation.outcome === "CONFIRMED" &&
        c.feedbackRevision === c.responseRevision) ||
      (phase === "RECONSIDERATION" &&
        c.evaluation.outcome === "RECONSIDERATION") ||
      phase === "COMPLETE");
  const currentFeedback =
    currentCheck && c.feedbackRevision === c.responseRevision;
  const modes = definition.support[phase] ?? [];
  const idle = support === "NONE";
  const reviewAvailable =
    idle &&
    modes.includes("REVIEW") &&
    projectReview(c.activityId, phase, phase, "REVIEW", content.review) !==
      null;
  const sourceAvailable =
    idle &&
    phase !== "INFO_NEEDED" &&
    modes.includes("SOURCE_REVIEW") &&
    authorized(() => ports.sourceReviewAvailable(c.activityId, phase)) &&
    projectSourceReview(
      c.activityId,
      phase,
      phase,
      "SOURCE_REVIEW",
      content.sourceReview,
    ) !== null;
  const review = projectReview(
    c.activityId,
    phase,
    c.origin,
    support,
    content.review,
  );
  const sourceReview =
    phase !== "INFO_NEEDED" &&
    modes.includes("SOURCE_REVIEW") &&
    authorized(() => ports.sourceReviewAvailable(c.activityId, phase))
      ? projectSourceReview(
          c.activityId,
          phase,
          c.origin,
          support,
          content.sourceReview,
        )
      : null;
  const finish =
    idle &&
    currentFeedback &&
    ((phase === "CONFIRMATION" &&
      definition.edges.CONFIRMATION?.CONTINUE !==
        "POST_CONFIRMATION_EXPLANATION") ||
      phase === "POST_CONFIRMATION_EXPLANATION" ||
      phase === "RECONSIDERATION") &&
    authorized(() =>
      ports.completionEligible({
        activityId: c.activityId,
        responseRevision: c.responseRevision,
        checkedRevision: c.checkedRevision,
        feedbackRevision: c.feedbackRevision,
        evaluation: c.evaluation,
      } satisfies CompletionEvidence),
    );
  const intents: LearnerIntent[] = [];
  if (idle) {
    const edge = definition.edges[phase];
    if (
      phase === "CONFIRMATION" &&
      edge?.CONTINUE === "POST_CONFIRMATION_EXPLANATION" &&
      currentFeedback &&
      c.evaluation?.outcome === "CONFIRMED"
    )
      intents.push("CONTINUE");
    if (
      (phase === "ENTRY" || phase.startsWith("EXP-")) &&
      edge?.CONTINUE &&
      (edge.CONTINUE === "ACTIVE" || edge.CONTINUE.startsWith("EXP-")) &&
      (edge.CONTINUE === "ACTIVE" || definition.edges[edge.CONTINUE])
    )
      intents.push("CONTINUE");
    if (
      phase.startsWith("EXP-") &&
      edge?.PREVIOUS?.startsWith("EXP-") &&
      definition.edges[edge.PREVIOUS]
    )
      intents.push("PREVIOUS");
    if (
      phase === "INFO_NEEDED" &&
      c.infoOrigin &&
      edge?.PREVIOUS === c.infoOrigin &&
      authorized(() => ports.informationReturn(c.activityId, c.infoOrigin!))
    )
      intents.push("PREVIOUS");
    if (
      (phase === "ENTRY" || phase.startsWith("EXP-") || phase === "ACTIVE") &&
      edge?.INFO_NEEDED === "INFO_NEEDED" &&
      c.checkedRevision === null &&
      authorized(() => ports.informationNeeded(c.activityId, phase))
    )
      intents.push("INFO_NEEDED");
    if (
      (phase === "ACTIVE" || phase === "REVISION") &&
      c.responseRevision < Number.MAX_SAFE_INTEGER
    )
      intents.push("RESPONSE_CHANGED");
    if (
      (phase === "ACTIVE" || phase === "REVISION") &&
      c.response !== null &&
      isLearnerResponse(c.response) &&
      c.checkedRevision !== c.responseRevision &&
      authorized(() => ports.ready(c.response!))
    ) {
      if (phase === "ACTIVE" && !c.hasChecked) intents.push("CHECK_RESPONSE");
      if (c.hasChecked) intents.push("CHECK_AGAIN");
    }
    if (
      (phase === "CONFIRMATION" || phase === "RECONSIDERATION") &&
      c.response !== null
    )
      intents.push("REVISE");
    if (finish) intents.push("FINISH_ACTIVITY");
    if (
      reviewAvailable ||
      sourceAvailable ||
      (modes.includes("REINFORCEMENT") && phase.startsWith("EXP-"))
    )
      intents.push("OPEN_SUPPORT");
  } else intents.push("CLOSE_SUPPORT");
  const feedback =
    currentFeedback &&
    content.feedback?.revision === c.responseRevision &&
    content.feedback.outcome === c.evaluation?.outcome
      ? safeText(content.feedback.content)
      : null;
  return Object.freeze({
    activityId: c.activityId,
    stateId: support === "NONE" ? phase : `${support}[${phase}]`,
    contentReferences: projectFacts(
      content.references,
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    exposedModelFacts: projectFacts(
      content.modelFacts,
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    exposedDerivedFacts: projectFacts(
      content.derivedFacts,
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    allowedLearnerIntents: Object.freeze(intents),
    responseContract: safeText(content.responseContract)!,
    ...(feedback
      ? {
          feedbackState: Object.freeze({
            outcome: c.evaluation!.outcome,
            content: feedback,
          }),
        }
      : {}),
    reviewAvailability: Boolean(reviewAvailable),
    sourceReviewAvailability: Boolean(sourceAvailable),
    completionActionAvailability: finish,
    ...(review ? { review } : {}),
    ...(sourceReview ? { sourceReview } : {}),
  });
}
