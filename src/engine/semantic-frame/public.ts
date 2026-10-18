import { isActivityId, isLearnerResponse } from "../../core/public";
import type { ActivityId } from "../../core/public";
import {
  currentPrimaryCommitmentValid,
  availableModelSelections,
  instructionalContinueEligible,
  primaryResponseReady,
  stagedResponseReady,
} from "../activity-machine/public";
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
export type PublicResponseControl = Readonly<{
  role: string;
  acceptedKinds: readonly string[];
  options?: readonly SafeText[];
}>;
export type ChoiceExposure = Readonly<{
  activityId: ActivityId;
  contractId: string;
  version: number;
  stage: "RESPONSE" | "PRIMARY" | "REASONING";
  controls: readonly PublicResponseControl[];
}>;
export type ResponseStageProjection = "PRIMARY" | "REASONING";
export type FrameContent = Readonly<{
  references: readonly Exposure[];
  modelFacts: readonly Exposure[];
  derivedFacts: readonly Exposure[];
  responseContract: SafeText;
  /** Trusted composition authenticates Study membership before injection.
   * This input carries public controls only, never an evaluator answer key. */
  responseControls?: readonly ChoiceExposure[];
  modelSelectionOptions?: readonly SafeText[];
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
  responseStage?: ResponseStageProjection;
  responseControls?: readonly PublicResponseControl[];
  modelSelectionControl?: Readonly<{
    modelId: string;
    revision: number;
    position: Position;
    selectedId: string;
    options: readonly SafeText[];
  }>;
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
  const staging = definition.responseStages;
  const teaching = definition.terminalTeaching;
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
  if (
    staging &&
    c.responseStage !== "PRIMARY" &&
    c.responseStage !== "REASONING"
  )
    throw new TypeError("Missing response stage");
  if (
    staging &&
    c.responseStage === "REASONING" &&
    !currentPrimaryCommitmentValid(c, staging)
  )
    throw new TypeError("Invalid primary commitment exposure");
  if (
    teaching &&
    phase === "POST_CONFIRMATION_EXPLANATION" &&
    (c.terminalEntryRevision !== c.responseRevision ||
      c.checkedRevision !== c.responseRevision ||
      c.feedbackRevision !== c.responseRevision ||
      !c.evaluation)
  )
    throw new TypeError("Invalid terminal teaching entry");
  const currentCheck =
    c.response !== null &&
    c.hasChecked &&
    c.checkedRevision === c.responseRevision &&
    c.evaluation !== null &&
    ((phase === "CONFIRMATION" && c.evaluation.outcome === "CONFIRMED") ||
      (phase === "POST_CONFIRMATION_EXPLANATION" &&
        definition.edges.CONFIRMATION?.CONTINUE ===
          "POST_CONFIRMATION_EXPLANATION" &&
        (c.evaluation.outcome === "CONFIRMED" ||
          teaching?.outcomes === "BOTH") &&
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
    (!teaching ||
      (phase === "POST_CONFIRMATION_EXPLANATION" &&
        c.terminalEntryRevision === c.responseRevision &&
        c.terminalTeachingRevision === c.responseRevision)) &&
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
  const allowedModels = idle
    ? availableModelSelections(c, definition.modelSelection)
    : [];
  let modelSelectionControl: SemanticActivityFrame["modelSelectionControl"];
  if (
    definition.modelSelection &&
    c.model &&
    allowedModels.length &&
    content.modelSelectionOptions
  ) {
    const supplied = content.modelSelectionOptions;
    if (
      !((value: unknown): boolean => Array.isArray(value))(supplied) ||
      supplied.length !== definition.modelSelection.selectionIds.length ||
      new Set(supplied.map((item) => item.id)).size !== supplied.length ||
      supplied.some(
        (item) =>
          Reflect.ownKeys(item).length !== 2 ||
          !safeText(item) ||
          !definition.modelSelection!.selectionIds.includes(item.id),
      )
    )
      throw new TypeError("Invalid model selection labels");
    modelSelectionControl = Object.freeze({
      modelId: c.model.modelId,
      revision: c.model.revision,
      position: phase,
      selectedId: c.model.value.selectionId,
      options: Object.freeze(
        allowedModels.map((id) =>
          safeText(supplied.find((item) => item.id === id))!,
        ),
      ),
    });
    intents.push("SELECT_MODEL_CHILD");
  }
  if (idle) {
    const edge = definition.edges[phase];
    if (
      (phase === "CONFIRMATION" ||
        (phase === "RECONSIDERATION" && teaching?.outcomes === "BOTH")) &&
      edge?.CONTINUE === "POST_CONFIRMATION_EXPLANATION" &&
      currentFeedback &&
      (phase === "CONFIRMATION"
        ? c.evaluation?.outcome === "CONFIRMED"
        : c.evaluation?.outcome === "RECONSIDERATION")
    )
      intents.push("CONTINUE");
    if (
      phase === c.position &&
      instructionalContinueEligible(c, definition, support)
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
      (!staging || stagedResponseReady(c, staging)) &&
      c.checkedRevision !== c.responseRevision &&
      authorized(() => ports.ready(c.response!))
    ) {
      if (phase === "ACTIVE" && !c.hasChecked) intents.push("CHECK_RESPONSE");
      if (c.hasChecked) intents.push("CHECK_AGAIN");
    }
    if (staging && (phase === "ACTIVE" || phase === "REVISION")) {
      if (
        c.responseStage === "PRIMARY" &&
        primaryResponseReady(c.response, staging) &&
        Number.isSafeInteger(c.commitmentSequence) &&
        c.commitmentSequence! < Number.MAX_SAFE_INTEGER
      )
        intents.push("COMMIT_PRIMARY_RESPONSE");
      if (
        c.responseStage === "REASONING" &&
        currentPrimaryCommitmentValid(c, staging) &&
        c.responseRevision < Number.MAX_SAFE_INTEGER
      )
        intents.push("RETURN_TO_PRIMARY");
    }
    if (
      (phase === "CONFIRMATION" || phase === "RECONSIDERATION") &&
      c.response !== null &&
      (!staging || c.responseRevision < Number.MAX_SAFE_INTEGER)
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
  const editable = idle && (phase === "ACTIVE" || phase === "REVISION");
  const controls: PublicResponseControl[] = [];
  // Boolean structural check deliberately avoids Array.isArray's any[] type
  // predicate erasing the declared readonly element types at this boundary.
  const array = (value: unknown): boolean => Array.isArray(value);
  const exact = (value: unknown, keys: readonly string[]): boolean =>
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every(
      (key) => Object.getOwnPropertyDescriptor(value, key)?.value !== undefined,
    );
  if (content.responseControls) {
    if (!array(content.responseControls))
      throw new TypeError("Invalid control exposures");
    const stages = new Set<string>();
    for (const exposure of content.responseControls) {
      if (
        !exact(exposure, [
          "activityId",
          "contractId",
          "version",
          "stage",
          "controls",
        ]) ||
        exposure.activityId !== c.activityId ||
        exposure.contractId !==
          (staging?.contractId ?? content.responseContract.id) ||
        !Number.isSafeInteger(exposure.version) ||
        exposure.version < 1 ||
        (staging && exposure.version !== staging.version) ||
        !["RESPONSE", "PRIMARY", "REASONING"].includes(exposure.stage) ||
        (staging
          ? exposure.stage === "RESPONSE"
          : exposure.stage !== "RESPONSE") ||
        stages.has(exposure.stage) ||
        !array(exposure.controls)
      )
        throw new TypeError("Unauthorized control exposure");
      stages.add(exposure.stage);
      const seen = new Set<string>();
      for (const control of exposure.controls) {
        if (
          !exact(control, [
            "role",
            "acceptedKinds",
            ...(control.options ? ["options"] : []),
          ]) ||
          typeof control.role !== "string" ||
          !control.role ||
          control.role.trim() !== control.role ||
          seen.has(control.role) ||
          !array(control.acceptedKinds) ||
          !control.acceptedKinds.length ||
          new Set(control.acceptedKinds).size !==
            control.acceptedKinds.length ||
          !control.acceptedKinds.every((kind: string) =>
            [
              "EXACT_QUANTITY",
              "SEMANTIC_BOUNDARY",
              "SINGLE_SELECTION",
            ].includes(kind),
          )
        )
          throw new TypeError("Invalid public control");
        seen.add(control.role);
        if (staging) {
          const field = staging.primaryFields.find(
            (item) => item.key === control.role,
          );
          if (
            exposure.stage === "PRIMARY"
              ? !field ||
                control.options !== undefined ||
                JSON.stringify(control.acceptedKinds) !==
                  JSON.stringify(field.acceptedKinds)
              : control.role !== staging.reasoningField ||
                JSON.stringify(control.acceptedKinds) !==
                  JSON.stringify(["SINGLE_SELECTION"])
          )
            throw new TypeError("Wrong-stage control");
        }
        let options: readonly SafeText[] | undefined;
        if (control.options) {
          if (
            !array(control.options) ||
            control.options.length < 2 ||
            new Set(control.options.map((item: SafeText) => item.id)).size !==
              control.options.length ||
            control.options.some(
              (item: SafeText) =>
                !exact(item, ["id", "text"]) || !safeText(item),
            )
          )
            throw new TypeError("Invalid selectable options");
          if (
            staging &&
            JSON.stringify(control.options.map((item: SafeText) => item.id)) !==
              JSON.stringify(staging.optionIds)
          )
            throw new TypeError("Wrong option authority");
          options = Object.freeze(
            control.options.map((item: SafeText) => safeText(item)!),
          );
        } else if (control.acceptedKinds.includes("SINGLE_SELECTION"))
          throw new TypeError("Missing selectable options");
        if (editable && exposure.stage === (c.responseStage ?? "RESPONSE"))
          controls.push(
            Object.freeze({
              role: control.role,
              acceptedKinds: Object.freeze([...control.acceptedKinds]),
              ...(options ? { options } : {}),
            }),
          );
      }
      if (
        staging &&
        (exposure.stage === "PRIMARY"
          ? seen.size !== staging.primaryFields.length
          : seen.size !== 1)
      )
        throw new TypeError("Incomplete stage controls");
    }
  }
  // The declared terminal reference cannot be smuggled through a PUBLIC exposure
  // in an earlier phase. Projection is not a delivery acknowledgment.
  const exposures = (items: readonly Exposure[]): readonly Exposure[] =>
    teaching
      ? items.filter(
          (item) =>
            item.content.id !== teaching.contentId ||
            (phase === "POST_CONFIRMATION_EXPLANATION" &&
              currentFeedback &&
              item.timing === "CURRENT_FEEDBACK"),
        )
      : items;
  return Object.freeze({
    activityId: c.activityId,
    stateId: support === "NONE" ? phase : `${support}[${phase}]`,
    contentReferences: projectFacts(
      exposures(content.references),
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    exposedModelFacts: projectFacts(
      exposures(content.modelFacts),
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    exposedDerivedFacts: projectFacts(
      exposures(content.derivedFacts),
      phase,
      c,
      currentCheck,
      currentFeedback,
    ),
    allowedLearnerIntents: Object.freeze(intents),
    ...(modelSelectionControl ? { modelSelectionControl } : {}),
    responseContract: safeText(content.responseContract)!,
    ...(staging ? { responseStage: c.responseStage! } : {}),
    ...(content.responseControls
      ? { responseControls: Object.freeze(controls) }
      : {}),
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
