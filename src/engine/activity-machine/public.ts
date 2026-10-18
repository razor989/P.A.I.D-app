import { setup } from "xstate";
import {
  ExactDecimal,
  isActivityId,
  isLearnerResponse,
  isScenarioId,
} from "../../core/public";
import type { ActivityId, LearnerResponse } from "../../core/public";

export type InstructionalPhase =
  | "ENTRY"
  | "EXP"
  | "ACTIVE"
  | "REVISION"
  | "CONFIRMATION"
  | "POST_CONFIRMATION_EXPLANATION"
  | "RECONSIDERATION"
  | "INFO_NEEDED"
  | "COMPLETE";
export type SupportPhase =
  "NONE" | "REVIEW" | "SOURCE_REVIEW" | "REINFORCEMENT";
export type Position =
  | "ENTRY"
  | "ACTIVE"
  | "REVISION"
  | "CONFIRMATION"
  | "POST_CONFIRMATION_EXPLANATION"
  | "RECONSIDERATION"
  | "INFO_NEEDED"
  | "COMPLETE"
  | `EXP-${string}`;
export type Evaluation = Readonly<{
  outcome: "CONFIRMED" | "RECONSIDERATION";
  diagnostic: string | null;
}>;
export type CompletionEvidence = Readonly<{
  activityId: ActivityId;
  responseRevision: number;
  checkedRevision: number | null;
  feedbackRevision: number | null;
  evaluation: Evaluation | null;
}>;
export type ResponseStage = "PRIMARY" | "REASONING";
export type PrimaryField = Readonly<{
  key: string;
  acceptedKinds: readonly ("EXACT_QUANTITY" | "SEMANTIC_BOUNDARY")[];
  quantityKind: string;
  unit: string;
  basis: string | null;
}>;
export type StagedResponseDefinition = Readonly<{
  contractId: string;
  version: number;
  scenarioId: string;
  primaryFields: readonly PrimaryField[];
  reasoningField: string;
  optionIds: readonly string[];
}>;
export type TerminalTeachingDefinition = Readonly<{
  outcomes: "BOTH";
  contentId: string;
}>;
export type ModelSelectionDefinition = Readonly<{
  modelId: string;
  scenarioId: string;
  initialSelectionId: string;
  selectionIds: readonly string[];
  allowedSelections: Readonly<Partial<Record<Position, readonly string[]>>>;
}>;
export type ActivityModelValue = Readonly<{
  selectionId: string;
  state: unknown;
}>;
/** Trusted composition authenticates issuance; callbacks own no mutable actor state. */
export type ActivityModelAdapter = Readonly<{
  initialize: () => ActivityModelValue;
  select: (
    current: ActivityModelValue,
    selectionId: string,
  ) => ActivityModelValue | null;
}>;
export type ActivityModelContext = Readonly<{
  modelId: string;
  revision: number;
  value: ActivityModelValue;
}>;
/** D050/S1: semantic operations, never caller-supplied numeric parameters. */
export type ModelIntent =
  | Readonly<{
      family: "C01";
      operation: "INCLUDE_EARNING" | "REMOVE_EARNING";
      earning: "REGULAR_PAY" | "TRANSPORTATION_ALLOWANCE";
      period: "MAY";
    }>
  | Readonly<{
      family: "C02";
      operation: "INSPECT_BASIS";
      deduction: "SSS" | "PHILHEALTH" | "PAG_IBIG" | "BIR";
    }>
  | Readonly<
      {
        family: "C02";
        operation: "SELECT_BASIS";
      } & (
        | { deduction: "SSS"; basis: "STATUTORY_MSC" }
        | { deduction: "PHILHEALTH"; basis: "MONTHLY_BASIC_SALARY" }
        | { deduction: "PAG_IBIG"; basis: "CAPPED_FUND_SALARY" }
        | { deduction: "BIR"; basis: "TAXABLE_COMPENSATION" }
      )
    >
  | Readonly<{
      family: "C05";
      operation:
        "PARTITION_YEAR_INTO_MONTHS" | "PARTITION_MONTH_INTO_SEMIMONTHLY";
    }>;
export type ModelIntentDefinition = Readonly<{
  family: ModelIntent["family"];
  modelId: string;
  scenarioId: string;
  permissions: readonly Readonly<{ position: Position; intent: ModelIntent }>[];
}>;
/** Trusted family issuance is not JSON validation or a restoration capability.
 * Callbacks are pure: progress lives exclusively in the supplied actor state.
 * Return null/the current state for rejected or no-op operations.
 */
export type ActivityIntentAdapter = Readonly<{
  initialize: () => Readonly<object>;
  transition: (
    current: Readonly<object>,
    intent: ModelIntent,
    position: Position,
  ) => Readonly<object> | null;
  /** Trusted family issuance/current-state proof, never an event predicate. */
  continuationState?: (
    state: Readonly<object>,
    requirement: InstructionalContinuationRequirement,
  ) => boolean;
}>;
/** D018/S1: the four closed source requirements; no expression language. */
export type InstructionalContinuationRequirement =
  | "C01_MAY_REGULAR"
  | "C01_MAY_BOTH"
  | "C05_YEAR_MONTHS"
  | "C05_MONTH_SEMIMONTHLY";
export type InstructionalContinuationPolicy = Readonly<{
  activityId: "C01-A02" | "C05-A02";
  family: "C01" | "C05";
  stages: readonly Readonly<{
    position: "EXP-02" | "EXP-03" | "EXP-04";
    requirement: InstructionalContinuationRequirement;
    action: ModelIntent;
  }>[];
}>;
type InstructionalContinuationEvidence = Readonly<{
  policy: InstructionalContinuationPolicy;
  accepted: readonly InstructionalContinuationRequirement[];
}>;
// Live actor issuance only. D5 must authenticate any future restoration; these
// capabilities and presence values are deliberately not checkpoint content.
const continuationIssuers = new WeakMap<
  InstructionalContinuationEvidence,
  NonNullable<ActivityIntentAdapter["continuationState"]>
>();
export type ActivityIntentContext = Readonly<{
  family: ModelIntent["family"];
  modelId: string;
  scenarioId: string;
  revision: number;
  state: Readonly<object>;
}>;
export type PrimaryCommitment = Readonly<{
  sequence: number;
  activityId: ActivityId;
  contractId: string;
  version: number;
  scenarioId: string;
  responseRevision: number;
  response: LearnerResponse;
  reasoningPreviouslyExposed: boolean;
}>;
/** Edges are supplied by an approved activity manifest at composition time, not inferred from IDs. */
export type ActivityDefinition = Readonly<{
  activityId: ActivityId;
  edges: Readonly<
    Partial<
      Record<
        Position,
        Readonly<
          Partial<Record<"CONTINUE" | "PREVIOUS" | "INFO_NEEDED", Position>>
        >
      >
    >
  >;
  support: Readonly<
    Partial<Record<Position, readonly Exclude<SupportPhase, "NONE">[]>>
  >;
  responseStages?: StagedResponseDefinition;
  terminalTeaching?: TerminalTeachingDefinition;
  modelSelection?: ModelSelectionDefinition;
  modelIntents?: ModelIntentDefinition;
  instructionalContinuation?: InstructionalContinuationPolicy;
}>;
export type ActivityPorts = Readonly<{
  ready: (response: LearnerResponse) => boolean;
  evaluate: (response: LearnerResponse) => Evaluation;
  completionEligible: (evidence: CompletionEvidence) => boolean;
  /** Composition authenticates the receiver and an established provider result. */
  sourceReviewAvailable: (activityId: ActivityId, origin: Position) => boolean;
  /** Composition authenticates a genuinely unresolved required authority. */
  informationNeeded: (activityId: ActivityId, origin: Position) => boolean;
  /** Composition confirms that return to the saved origin is authorized. */
  informationReturn: (activityId: ActivityId, origin: Position) => boolean;
}>;
export type ActivityEvent =
  | {
      type: "MODEL_INTENT";
      activityId: ActivityId;
      scenarioId: string;
      modelId: string;
      position: Position;
      revision: number;
      intent: ModelIntent;
    }
  | {
      type: "SELECT_MODEL_CHILD";
      modelId: string;
      selectionId: string;
      revision: number;
      position: Position;
    }
  | { type: "CONTINUE" | "PREVIOUS" | "INFO_NEEDED" }
  | { type: "RESPONSE_CHANGED"; response: LearnerResponse }
  | { type: "CHECK_RESPONSE" | "CHECK_AGAIN" | "REVISE" | "FINISH_ACTIVITY" }
  | { type: "FEEDBACK_DELIVERED"; revision: number }
  | { type: "OPEN_SUPPORT"; mode: Exclude<SupportPhase, "NONE"> }
  | { type: "CLOSE_SUPPORT" | "COMMIT_PRIMARY_RESPONSE" | "RETURN_TO_PRIMARY" }
  | {
      type: "TERMINAL_TEACHING_DELIVERED";
      revision: number;
      contentId: string;
    };

/** D044/S1: presence, not a delivery acknowledgment or an interaction log. */
export type C04A02StageEngagementV1 = Readonly<{
  "EXP-02": Readonly<{ "C04-S02-A": boolean }>;
  "EXP-03": Readonly<{ "C04-S02-B": boolean }>;
}>;

function stageEngagement(
  employeeA: boolean,
  employeeB: boolean,
): C04A02StageEngagementV1 {
  return Object.freeze({
    "EXP-02": Object.freeze({ "C04-S02-A": employeeA }),
    "EXP-03": Object.freeze({ "C04-S02-B": employeeB }),
  });
}

export type ActivityContext = Readonly<{
  activityId: ActivityId;
  position: Position;
  model?: ActivityModelContext;
  intentModel?: ActivityIntentContext;
  instructionalContinuation?: InstructionalContinuationEvidence;
  c04A02StageEngagement?: C04A02StageEngagementV1;
  origin: Position | null;
  infoOrigin: Position | null;
  response: LearnerResponse | null;
  checkedResponse: LearnerResponse | null;
  responseRevision: number;
  hasChecked: boolean;
  checkedRevision: number | null;
  feedbackRevision: number | null;
  evaluation: Evaluation | null;
  responseStage?: ResponseStage;
  firstPrimaryCommitment?: PrimaryCommitment | null;
  currentPrimaryCommitment?: PrimaryCommitment | null;
  commitmentSequence?: number;
  reasoningExposed?: boolean;
  explanationCommitmentSequence?: number | null;
  checkedCommitmentSequence?: number | null;
  terminalEntryRevision?: number | null;
  terminalTeachingRevision?: number | null;
}>;

const position = (value: string): value is Position =>
  value === "ENTRY" ||
  value === "ACTIVE" ||
  value === "CONFIRMATION" ||
  value === "INFO_NEEDED" ||
  (/^EXP-[0-9]{2,}$/.test(value) && value !== "EXP-00");
const own = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const fields = (
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> =>
  own(value) &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });

/** Validate detached presence only; this never creates actor or model state. */
export function validateC04A02StageEngagementV1(
  value: unknown,
): C04A02StageEngagementV1 {
  if (
    !fields(value, ["EXP-02", "EXP-03"]) ||
    !fields(value["EXP-02"], ["C04-S02-A"]) ||
    !fields(value["EXP-03"], ["C04-S02-B"]) ||
    typeof value["EXP-02"]["C04-S02-A"] !== "boolean" ||
    typeof value["EXP-03"]["C04-S02-B"] !== "boolean"
  )
    throw new TypeError("Invalid C04-A02 stage engagement evidence");
  return stageEngagement(
    value["EXP-02"]["C04-S02-A"],
    value["EXP-03"]["C04-S02-B"],
  );
}

const modes = ["REVIEW", "SOURCE_REVIEW", "REINFORCEMENT"] as const;
const intents = ["CONTINUE", "PREVIOUS", "INFO_NEEDED"] as const;
const identity = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const strings = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  Reflect.ownKeys(value).length === value.length + 1 &&
  value.every(identity) &&
  new Set(value).size === value.length;

export function isModelIntent(value: unknown): value is ModelIntent {
  if (!own(value)) return false;
  const family = Object.getOwnPropertyDescriptor(value, "family");
  const operation = Object.getOwnPropertyDescriptor(value, "operation");
  if (!family || !("value" in family) || !operation || !("value" in operation))
    return false;
  if (family.value === "C01")
    return (
      fields(value, ["family", "operation", "earning", "period"]) &&
      ["INCLUDE_EARNING", "REMOVE_EARNING"].includes(
        value.operation as string,
      ) &&
      ["REGULAR_PAY", "TRANSPORTATION_ALLOWANCE"].includes(
        value.earning as string,
      ) &&
      value.period === "MAY"
    );
  if (family.value === "C05")
    return (
      fields(value, ["family", "operation"]) &&
      [
        "PARTITION_YEAR_INTO_MONTHS",
        "PARTITION_MONTH_INTO_SEMIMONTHLY",
      ].includes(value.operation as string)
    );
  if (family.value !== "C02") return false;
  if (operation.value === "INSPECT_BASIS")
    return (
      fields(value, ["family", "operation", "deduction"]) &&
      ["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"].includes(
        value.deduction as string,
      )
    );
  return (
    operation.value === "SELECT_BASIS" &&
    fields(value, ["family", "operation", "deduction", "basis"]) &&
    ((value.deduction === "SSS" && value.basis === "STATUTORY_MSC") ||
      (value.deduction === "PHILHEALTH" &&
        value.basis === "MONTHLY_BASIC_SALARY") ||
      (value.deduction === "PAG_IBIG" &&
        value.basis === "CAPPED_FUND_SALARY") ||
      (value.deduction === "BIR" && value.basis === "TAXABLE_COMPENSATION"))
  );
}

function sameIntent(left: ModelIntent, right: ModelIntent): boolean {
  return (
    Reflect.ownKeys(left).every(
      (key) => Reflect.get(left, key) === Reflect.get(right, key),
    ) && Reflect.ownKeys(left).length === Reflect.ownKeys(right).length
  );
}

export function validateActivityIntentAdapter(
  value: unknown,
): asserts value is ActivityIntentAdapter {
  if (
    !own(value) ||
    !fields(value, [
      "initialize",
      "transition",
      ...("continuationState" in value ? ["continuationState"] : []),
    ]) ||
    typeof value.initialize !== "function" ||
    typeof value.transition !== "function" ||
    ("continuationState" in value &&
      typeof value.continuationState !== "function")
  )
    throw new TypeError("Invalid activity intent adapter");
}

const continuationSources = {
  C01_MAY_REGULAR: {
    activityId: "C01-A02",
    family: "C01",
    position: "EXP-02",
    action: {
      family: "C01",
      operation: "INCLUDE_EARNING",
      earning: "REGULAR_PAY",
      period: "MAY",
    },
  },
  C01_MAY_BOTH: {
    activityId: "C01-A02",
    family: "C01",
    position: "EXP-03",
    action: {
      family: "C01",
      operation: "INCLUDE_EARNING",
      earning: "TRANSPORTATION_ALLOWANCE",
      period: "MAY",
    },
  },
  C05_YEAR_MONTHS: {
    activityId: "C05-A02",
    family: "C05",
    position: "EXP-02",
    action: { family: "C05", operation: "PARTITION_YEAR_INTO_MONTHS" },
  },
  C05_MONTH_SEMIMONTHLY: {
    activityId: "C05-A02",
    family: "C05",
    position: "EXP-04",
    action: { family: "C05", operation: "PARTITION_MONTH_INTO_SEMIMONTHLY" },
  },
} as const;

function validateInstructionalContinuation(
  definition: ActivityDefinition,
): void {
  const policy = definition.instructionalContinuation;
  if (!policy) return;
  if (
    !fields(policy, ["activityId", "family", "stages"]) ||
    policy.activityId !== definition.activityId ||
    !["C01-A02", "C05-A02"].includes(policy.activityId) ||
    policy.family !== definition.modelIntents?.family ||
    !Array.isArray(policy.stages) ||
    policy.stages.length !== 2 ||
    Object.getPrototypeOf(policy.stages) !== Array.prototype ||
    Reflect.ownKeys(policy.stages).length !== 3
  )
    throw new TypeError("Invalid instructional continuation policy");
  const seen = new Set<string>();
  for (let index = 0; index < policy.stages.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(policy.stages, index);
    const stage: unknown =
      descriptor && "value" in descriptor ? descriptor.value : null;
    if (
      !fields(stage, ["position", "requirement", "action"]) ||
      typeof stage.requirement !== "string" ||
      !Object.prototype.hasOwnProperty.call(
        continuationSources,
        stage.requirement,
      ) ||
      !isModelIntent(stage.action)
    )
      throw new TypeError("Invalid continuation stage");
    const source =
      continuationSources[
        stage.requirement as InstructionalContinuationRequirement
      ];
    const destination = definition.edges[source.position]?.CONTINUE;
    if (
      source.activityId !== policy.activityId ||
      source.family !== policy.family ||
      stage.position !== source.position ||
      !sameIntent(stage.action, source.action) ||
      seen.has(stage.requirement) ||
      !destination ||
      !(
        destination === "ACTIVE" ||
        (destination.startsWith("EXP-") && definition.edges[destination])
      ) ||
      !definition.modelIntents.permissions.some(
        (permission) =>
          permission.position === source.position &&
          sameIntent(permission.intent, source.action),
      )
    )
      throw new TypeError("Incoherent instructional continuation policy");
    seen.add(stage.requirement);
  }
}

/** One read-only Entry/EXP decision for the actor and public frame. No delivery
 * claim, revision threshold, family arithmetic or C04 presence reinterpretation. */
export function instructionalContinueEligible(
  context: ActivityContext,
  definition: ActivityDefinition,
  support: SupportPhase = context.origin === null ? "NONE" : "REVIEW",
): boolean {
  try {
    if (
      context.activityId !== definition.activityId ||
      context.origin !== null ||
      support !== "NONE" ||
      !(context.position === "ENTRY" || context.position.startsWith("EXP-"))
    )
      return false;
    const destination = definition.edges[context.position]?.CONTINUE;
    if (
      !destination ||
      !(
        destination === "ACTIVE" ||
        (destination.startsWith("EXP-") && definition.edges[destination])
      )
    )
      return false;
    const policy = definition.instructionalContinuation;
    if (!("instructionalContinuation" in definition)) return true;
    if (!policy) return false;
    validateInstructionalContinuation(definition);
    const stage = policy.stages.find(
      (item) => item.position === context.position,
    );
    if (!stage) return true;
    const evidence = context.instructionalContinuation;
    const model = context.intentModel;
    const evaluator = evidence && continuationIssuers.get(evidence);
    return (
      !!evidence &&
      !!evaluator &&
      sameIntentState(evidence.policy, policy) &&
      evidence.accepted.includes(stage.requirement) &&
      !!model &&
      model.family === policy.family &&
      model.modelId === definition.modelIntents?.modelId &&
      model.scenarioId === definition.modelIntents?.scenarioId &&
      immutableIntentState(model.state) &&
      evaluator(model.state, stage.requirement) === true
    );
  } catch {
    return false;
  }
}

function validateModelIntents(
  value: unknown,
  activityId: ActivityId,
): asserts value is ModelIntentDefinition {
  if (
    !fields(value, ["family", "modelId", "scenarioId", "permissions"]) ||
    !["C01", "C02", "C05"].includes(value.family as string) ||
    typeof value.family !== "string" ||
    activityId !== `${value.family}-A02` ||
    value.scenarioId !== `${value.family}-S02` ||
    !identity(value.modelId) ||
    !Array.isArray(value.permissions) ||
    value.permissions.length === 0 ||
    Object.getPrototypeOf(value.permissions) !== Array.prototype ||
    Reflect.ownKeys(value.permissions).length !== value.permissions.length + 1
  )
    throw new TypeError("Invalid model intent policy");
  for (let index = 0; index < value.permissions.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(
      value.permissions,
      index,
    );
    if (!descriptor || !("value" in descriptor))
      throw new TypeError("Invalid model intent permission");
    const permission: unknown = descriptor.value;
    if (
      !fields(permission, ["position", "intent"]) ||
      typeof permission.position !== "string" ||
      !(
        permission.position === "ACTIVE" ||
        permission.position === "REVISION" ||
        /^EXP-(?!00)[0-9]{2,}$/.test(permission.position)
      ) ||
      !isModelIntent(permission.intent) ||
      permission.intent.family !== value.family
    )
      throw new TypeError("Invalid model intent permission");
  }
}

/** Preserve family-issued identity, but refuse mutable/accessor/prototype state.
 * ExactDecimal is the existing immutable Core quantity primitive.
 */
function immutableIntentState(
  value: unknown,
  seen = new Set<object>(),
): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || !Object.isFrozen(value) || seen.has(value))
    return false;
  if (value instanceof ExactDecimal) {
    try {
      ExactDecimal.prototype.toString.call(value);
      return true;
    } catch {
      return false;
    }
  }
  if (!(
    own(value) ||
    (Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype)
  ))
    return false;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !("value" in descriptor) ||
      !immutableIntentState(descriptor.value, seen)
    )
      return false;
  }
  seen.delete(value);
  return true;
}

function sameIntentState(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof ExactDecimal && right instanceof ExactDecimal)
    return left.toString() === right.toString();
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const keys = Reflect.ownKeys(left);
  return (
    keys.length === Reflect.ownKeys(right).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        sameIntentState(Reflect.get(left, key), Reflect.get(right, key)),
    )
  );
}

function validateModelSelection(
  value: unknown,
): asserts value is ModelSelectionDefinition {
  if (
    !fields(value, [
      "modelId",
      "scenarioId",
      "initialSelectionId",
      "selectionIds",
      "allowedSelections",
    ]) ||
    !identity(value.modelId) ||
    !isScenarioId(value.scenarioId) ||
    !identity(value.initialSelectionId) ||
    !strings(value.selectionIds) ||
    !value.selectionIds.includes(value.initialSelectionId) ||
    !own(value.allowedSelections)
  )
    throw new TypeError("Invalid model selection definition");
  for (const key of Reflect.ownKeys(value.allowedSelections)) {
    const allowed =
      typeof key === "string" ? value.allowedSelections[key] : undefined;
    if (
      typeof key !== "string" ||
      !(
        key === "ACTIVE" ||
        key === "REVISION" ||
        (/^EXP-[0-9]{2,}$/.test(key) && key !== "EXP-00")
      ) ||
      !strings(allowed) ||
      !allowed.every((id) =>
        (value.selectionIds as readonly string[]).includes(id),
      )
    )
      throw new TypeError("Invalid model selection permissions");
  }
}

export function validateActivityModelAdapter(
  value: unknown,
): asserts value is ActivityModelAdapter {
  if (
    !fields(value, ["initialize", "select"]) ||
    typeof value.initialize !== "function" ||
    typeof value.select !== "function"
  )
    throw new TypeError("Invalid activity model adapter");
}

function modelValue(
  value: unknown,
  selectionId: string,
): ActivityModelValue | null {
  if (
    !fields(value, ["selectionId", "state"]) ||
    value.selectionId !== selectionId ||
    value.state === null ||
    typeof value.state !== "object" ||
    !Object.isFrozen(value.state)
  )
    return null;
  // Do not clone: domain issuance may be associated with this exact object identity.
  return Object.freeze({ selectionId, state: value.state });
}

/** Shared structural availability predicate; no executable adapter is called here. */
export function availableModelSelections(
  context: ActivityContext,
  policy?: ModelSelectionDefinition,
): readonly string[] {
  const model = context.model;
  if (
    !policy ||
    !model ||
    !fields(model, ["modelId", "revision", "value"]) ||
    model.modelId !== policy.modelId ||
    !Number.isSafeInteger(model.revision) ||
    model.revision < 0 ||
    model.revision >= Number.MAX_SAFE_INTEGER ||
    !fields(model.value, ["selectionId", "state"]) ||
    !identity(model.value.selectionId) ||
    !modelValue(model.value, model.value.selectionId) ||
    !policy.selectionIds.includes(model.value.selectionId) ||
    context.origin !== null ||
    context.infoOrigin !== null ||
    !(
      context.position === "ACTIVE" ||
      context.position === "REVISION" ||
      context.position.startsWith("EXP-")
    )
  )
    return [];
  return policy.allowedSelections[context.position] ?? [];
}

function validateStages(
  value: unknown,
): asserts value is StagedResponseDefinition {
  if (
    !fields(value, [
      "contractId",
      "version",
      "scenarioId",
      "primaryFields",
      "reasoningField",
      "optionIds",
    ]) ||
    !identity(value.contractId) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !isScenarioId(value.scenarioId) ||
    !identity(value.reasoningField) ||
    !strings(value.optionIds) ||
    value.optionIds.length < 2 ||
    !Array.isArray(value.primaryFields) ||
    !value.primaryFields.length ||
    Reflect.ownKeys(value.primaryFields).length !==
      value.primaryFields.length + 1
  )
    throw new TypeError("Invalid response stages");
  const keys = new Set<string>();
  for (const field of value.primaryFields) {
    if (
      !fields(field, [
        "key",
        "acceptedKinds",
        "quantityKind",
        "unit",
        "basis",
      ]) ||
      !identity(field.key) ||
      field.key === value.reasoningField ||
      keys.has(field.key) ||
      !strings(field.acceptedKinds) ||
      !field.acceptedKinds.every(
        (kind) => kind === "EXACT_QUANTITY" || kind === "SEMANTIC_BOUNDARY",
      ) ||
      !identity(field.quantityKind) ||
      !identity(field.unit) ||
      !(field.basis === null || identity(field.basis))
    )
      throw new TypeError("Invalid primary field");
    keys.add(field.key);
  }
}

/** Reject malformed definitions before any actor exists. IDs are not generated or guessed. */
export function validateActivityDefinition(
  value: unknown,
): asserts value is ActivityDefinition {
  if (
    !own(value) ||
    !fields(value, [
      "activityId",
      "edges",
      "support",
      ...("responseStages" in value ? ["responseStages"] : []),
      ...("terminalTeaching" in value ? ["terminalTeaching"] : []),
      ...("modelSelection" in value ? ["modelSelection"] : []),
      ...("modelIntents" in value ? ["modelIntents"] : []),
      ...("instructionalContinuation" in value
        ? ["instructionalContinuation"]
        : []),
    ]) ||
    !isActivityId(value.activityId) ||
    !own(value.edges) ||
    !own(value.support)
  )
    throw new TypeError("Invalid activity definition");
  if ("responseStages" in value) validateStages(value.responseStages);
  if ("modelSelection" in value) validateModelSelection(value.modelSelection);
  if ("modelIntents" in value) {
    if ("modelSelection" in value)
      throw new TypeError("Conflicting model capabilities");
    validateModelIntents(value.modelIntents, value.activityId);
  }
  const both = "terminalTeaching" in value;
  if (
    both &&
    (!fields(value.terminalTeaching, ["outcomes", "contentId"]) ||
      value.terminalTeaching.outcomes !== "BOTH" ||
      !identity(value.terminalTeaching.contentId))
  )
    throw new TypeError("Invalid terminal teaching");
  if (
    both &&
    ((value.edges.CONFIRMATION as Record<string, unknown> | undefined)
      ?.CONTINUE !== "POST_CONFIRMATION_EXPLANATION" ||
      (value.edges.RECONSIDERATION as Record<string, unknown> | undefined)
        ?.CONTINUE !== "POST_CONFIRMATION_EXPLANATION")
  )
    throw new TypeError("Missing both-outcome teaching edges");
  const nodes = new Set<Position>(["ENTRY", "ACTIVE", "INFO_NEEDED"]);
  for (const [from, edges] of Object.entries(value.edges)) {
    if (
      !(position(from) || (both && from === "RECONSIDERATION")) ||
      !own(edges) ||
      ((from === "CONFIRMATION" || from === "RECONSIDERATION") &&
        !fields(edges, ["CONTINUE"]))
    )
      throw new TypeError("Invalid activity edge");
    nodes.add(from);
    for (const [intent, target] of Object.entries(edges)) {
      if (
        !intents.some((item) => item === intent) ||
        typeof target !== "string" ||
        !(position(target) || target === "POST_CONFIRMATION_EXPLANATION") ||
        target === "CONFIRMATION" ||
        (from === "CONFIRMATION" &&
          (intent !== "CONTINUE" ||
            target !== "POST_CONFIRMATION_EXPLANATION")) ||
        (target === "POST_CONFIRMATION_EXPLANATION" &&
          ((from !== "CONFIRMATION" && !(both && from === "RECONSIDERATION")) ||
            intent !== "CONTINUE")) ||
        (from === "RECONSIDERATION" &&
          (intent !== "CONTINUE" ||
            target !== "POST_CONFIRMATION_EXPLANATION")) ||
        (intent === "INFO_NEEDED" && target !== "INFO_NEEDED") ||
        (from === "INFO_NEEDED" &&
          (intent !== "PREVIOUS" || target === "INFO_NEEDED")) ||
        (from !== "INFO_NEEDED" &&
          target === "INFO_NEEDED" &&
          intent !== "INFO_NEEDED") ||
        (intent === "CONTINUE" && (from === "ACTIVE" || target === "ENTRY"))
      )
        throw new TypeError("Invalid activity edge");
      nodes.add(target);
    }
  }
  // These are instructional phases, not graph edges. Support must name its actual origin.
  for (const phase of [
    "REVISION",
    "CONFIRMATION",
    "RECONSIDERATION",
    "COMPLETE",
  ] as const)
    nodes.add(phase);
  for (const [from, allowed] of Object.entries(value.support)) {
    if (
      !nodes.has(from as Position) ||
      !Array.isArray(allowed) ||
      !allowed.every((mode: unknown) => modes.some((item) => item === mode)) ||
      new Set(allowed).size !== allowed.length
    )
      throw new TypeError("Invalid support definition");
  }
  // Every referenced explanation must have an explicit entry in the approved graph.
  for (const node of nodes)
    if (
      node.startsWith("EXP-") &&
      !Object.prototype.hasOwnProperty.call(value.edges, node)
    )
      throw new TypeError("Unspecified explanation step");
  const entry = value.edges.ENTRY;
  if (value.modelIntents) {
    for (const permission of (value.modelIntents as ModelIntentDefinition)
      .permissions)
      if (!nodes.has(permission.position))
        throw new TypeError("Unknown model intent position");
  }
  if (value.modelSelection) {
    for (const phase of Object.keys(
      (value.modelSelection as ModelSelectionDefinition).allowedSelections,
    ))
      if (!nodes.has(phase as Position))
        throw new TypeError("Unknown model selection position");
  }
  if (
    !own(entry) ||
    typeof entry.CONTINUE !== "string" ||
    !nodes.has(entry.CONTINUE as Position)
  )
    throw new TypeError("Missing entry route");
  if ("instructionalContinuation" in value) {
    if (!value.instructionalContinuation)
      throw new TypeError("Missing continuation policy");
    validateInstructionalContinuation(value as ActivityDefinition);
  }
}

/** The public event boundary also rejects excess fields; invalid events are ignored without mutation. */
export function isActivityEvent(value: unknown): value is ActivityEvent {
  if (!own(value)) return false;
  const type = Object.getOwnPropertyDescriptor(value, "type");
  if (!type || !("value" in type)) return false;
  switch (value.type) {
    case "MODEL_INTENT":
      return (
        fields(value, [
          "type",
          "activityId",
          "scenarioId",
          "modelId",
          "position",
          "revision",
          "intent",
        ]) &&
        isActivityId(value.activityId) &&
        isScenarioId(value.scenarioId) &&
        identity(value.modelId) &&
        typeof value.position === "string" &&
        (position(value.position) || value.position === "REVISION") &&
        Number.isSafeInteger(value.revision) &&
        (value.revision as number) >= 0 &&
        isModelIntent(value.intent)
      );
    case "SELECT_MODEL_CHILD":
      return (
        fields(value, [
          "type",
          "modelId",
          "selectionId",
          "revision",
          "position",
        ]) &&
        identity(value.modelId) &&
        identity(value.selectionId) &&
        Number.isSafeInteger(value.revision) &&
        (value.revision as number) >= 0 &&
        typeof value.position === "string" &&
        (position(value.position) ||
          [
            "REVISION",
            "RECONSIDERATION",
            "POST_CONFIRMATION_EXPLANATION",
            "COMPLETE",
          ].includes(value.position))
      );
    case "CONTINUE":
    case "PREVIOUS":
    case "INFO_NEEDED":
    case "CHECK_RESPONSE":
    case "CHECK_AGAIN":
    case "REVISE":
    case "FINISH_ACTIVITY":
    case "CLOSE_SUPPORT":
    case "COMMIT_PRIMARY_RESPONSE":
    case "RETURN_TO_PRIMARY":
      return fields(value, ["type"]);
    case "RESPONSE_CHANGED":
      return (
        fields(value, ["type", "response"]) && isLearnerResponse(value.response)
      );
    case "FEEDBACK_DELIVERED":
      return (
        fields(value, ["type", "revision"]) &&
        Number.isSafeInteger(value.revision) &&
        (value.revision as number) >= 0
      );
    case "TERMINAL_TEACHING_DELIVERED":
      return (
        fields(value, ["type", "revision", "contentId"]) &&
        Number.isSafeInteger(value.revision) &&
        (value.revision as number) >= 0 &&
        identity(value.contentId)
      );
    case "OPEN_SUPPORT":
      return (
        fields(value, ["type", "mode"]) &&
        modes.some((mode) => mode === value.mode)
      );
    default:
      return false;
  }
}

function immutableResponse(value: LearnerResponse): LearnerResponse {
  // The frozen core validator checks structure; clone the whole validated data tree before retaining it.
  const clone = structuredClone(value);
  // structuredClone strips ExactDecimal prototypes. Restore quantity values
  // from the validated original without sharing mutable caller containers.
  const restore = (copy: unknown, original: unknown): void => {
    if (
      copy === null ||
      typeof copy !== "object" ||
      original === null ||
      typeof original !== "object"
    )
      return;
    const target = copy as Record<string, unknown>;
    for (const [key, child] of Object.entries(original)) {
      if (child instanceof ExactDecimal)
        target[key] = ExactDecimal.from(child.toString());
      else restore(target[key], child);
    }
  };
  restore(clone, value);
  const freeze = (object: object): void => {
    for (const child of Object.values(object) as unknown[])
      if (child !== null && typeof child === "object") freeze(child);
    Object.freeze(object);
  };
  freeze(clone);
  return clone;
}

function parts(response: LearnerResponse | null) {
  return response?.kind === "COMPOSITE" ? response.parts : null;
}
function samePrimary(left: LearnerResponse, right: LearnerResponse): boolean {
  const a = parts(left);
  const b = parts(right);
  return (
    a !== null &&
    b !== null &&
    a.length === b.length &&
    a.every((part) => {
      const other = b.find((item) => item.key === part.key)?.response;
      const answer = part.response;
      if (answer.kind === "EXACT_QUANTITY" && other?.kind === "EXACT_QUANTITY")
        return (
          answer.value.kind === other.value.kind &&
          answer.value.unit === other.value.unit &&
          answer.value.basis === other.value.basis &&
          answer.value.magnitude.equals(other.value.magnitude)
        );
      return JSON.stringify(answer) === JSON.stringify(other);
    })
  );
}
function primaryResponse(
  response: LearnerResponse | null,
  policy: StagedResponseDefinition,
): LearnerResponse | null {
  const entries = parts(response);
  if (!entries) return null;
  return {
    kind: "COMPOSITE",
    parts: entries.filter((part) =>
      policy.primaryFields.some((field) => field.key === part.key),
    ),
  };
}
/** Shared structural guards keep machine and public intent projection aligned.
 * They do not authenticate Study provenance or compare mathematical answers.
 */
export function primaryResponseReady(
  response: LearnerResponse | null,
  policy: StagedResponseDefinition,
): boolean {
  if (!response || !isLearnerResponse(response)) return false;
  const entries = parts(response);
  return (
    entries !== null &&
    entries.length === policy.primaryFields.length &&
    policy.primaryFields.every((field) => {
      const answer = entries.find((part) => part.key === field.key)?.response;
      return (
        answer !== undefined &&
        field.acceptedKinds.some((kind) => kind === answer.kind) &&
        (answer.kind !== "EXACT_QUANTITY" ||
          (answer.value.kind === field.quantityKind &&
            answer.value.unit === field.unit &&
            answer.value.basis === field.basis))
      );
    })
  );
}
export function currentPrimaryCommitmentValid(
  context: ActivityContext,
  policy: StagedResponseDefinition,
): boolean {
  const committed = context.currentPrimaryCommitment;
  const primary = primaryResponse(context.response, policy);
  return (
    committed !== undefined &&
    committed !== null &&
    context.responseStage === "REASONING" &&
    committed.activityId === context.activityId &&
    committed.contractId === policy.contractId &&
    committed.version === policy.version &&
    committed.scenarioId === policy.scenarioId &&
    committed.sequence === context.commitmentSequence &&
    Number.isSafeInteger(committed.sequence) &&
    committed.sequence > 0 &&
    Number.isSafeInteger(committed.responseRevision) &&
    committed.responseRevision >= 0 &&
    Number.isSafeInteger(context.responseRevision) &&
    committed.responseRevision <= context.responseRevision &&
    context.reasoningExposed === true &&
    primaryResponseReady(committed.response, policy) &&
    primary !== null &&
    primaryResponseReady(primary, policy) &&
    samePrimary(primary, committed.response)
  );
}
export function stagedResponseReady(
  context: ActivityContext,
  policy: StagedResponseDefinition,
): boolean {
  const entries = parts(context.response);
  const selection = entries?.find(
    (part) => part.key === policy.reasoningField,
  )?.response;
  return (
    currentPrimaryCommitmentValid(context, policy) &&
    context.response !== null &&
    isLearnerResponse(context.response) &&
    entries?.length === policy.primaryFields.length + 1 &&
    selection?.kind === "SINGLE_SELECTION" &&
    policy.optionIds.includes(selection.selectionId) &&
    context.explanationCommitmentSequence ===
      context.currentPrimaryCommitment?.sequence
  );
}

/** D014/S1: validate semantic construction, never a serialized machine snapshot.
 * The resolved binding supplies source membership and genuine model issuance.
 */
function validateActivityRestoration(
  definition: ActivityDefinition,
  ports: ActivityPorts,
  value: ActivityContext,
): ActivityContext {
  const reject = (): never => {
    throw new TypeError("Invalid semantic restoration");
  };
  const stagingKeys = [
    "responseStage",
    "firstPrimaryCommitment",
    "currentPrimaryCommitment",
    "commitmentSequence",
    "reasoningExposed",
    "explanationCommitmentSequence",
    "checkedCommitmentSequence",
  ];
  const keys = [
    "activityId",
    "position",
    "origin",
    "infoOrigin",
    "response",
    "checkedResponse",
    "responseRevision",
    "hasChecked",
    "checkedRevision",
    "feedbackRevision",
    "evaluation",
    ...(definition.modelSelection ? ["model", "c04A02StageEngagement"] : []),
    ...(definition.responseStages ? stagingKeys : []),
    ...(definition.terminalTeaching
      ? ["terminalEntryRevision", "terminalTeachingRevision"]
      : []),
  ];
  if (
    !fields(value, keys) ||
    value.activityId !== definition.activityId ||
    !/^C04-A0[1-4]$/.test(value.activityId) ||
    value.origin !== null ||
    value.infoOrigin !== null
  )
    reject();
  const rev = (n: unknown): n is number =>
    Number.isSafeInteger(n) && (n as number) >= 0;
  const data = (item: unknown, seen = new Set<object>()): void => {
    if (
      item === null ||
      ["string", "boolean"].includes(typeof item) ||
      (typeof item === "number" && Number.isFinite(item))
    )
      return;
    if (item instanceof ExactDecimal) {
      ExactDecimal.prototype.toString.call(item);
      return;
    }
    if (
      typeof item !== "object" ||
      item === undefined ||
      seen.has(item) ||
      Object.getPrototypeOf(item) !==
        (Array.isArray(item) ? Array.prototype : Object.prototype)
    )
      return reject();
    seen.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && key === "length") continue;
      const d = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== "string" || !d || !d.enumerable || !("value" in d))
        reject();
      data(d!.value, seen);
    }
    seen.delete(item);
  };
  // Opaque issued model state is checked by the source binding, not cloned.
  for (const [key, item] of Object.entries(value))
    if (key !== "model") data(item);
  const positions = new Set<string>([
    "ENTRY",
    "ACTIVE",
    "REVISION",
    "CONFIRMATION",
    "RECONSIDERATION",
    ...Object.keys(definition.edges),
    ...Object.values(definition.edges).flatMap((edge) =>
      Object.values(edge ?? {}),
    ),
  ]);
  if (
    !positions.has(value.position) ||
    ["COMPLETE", "INFO_NEEDED"].includes(value.position) ||
    !rev(value.responseRevision) ||
    typeof value.hasChecked !== "boolean"
  )
    reject();
  if (
    (value.position.startsWith("EXP-") && value.activityId !== "C04-A02") ||
    (value.position === "POST_CONFIRMATION_EXPLANATION" &&
      value.activityId !== "C04-A04")
  )
    reject();
  for (const response of [value.response, value.checkedResponse])
    if (response !== null && !isLearnerResponse(response)) reject();
  if ((value.responseRevision === 0) !== (value.response === null)) reject();
  const instruction =
    value.position === "ENTRY" || value.position.startsWith("EXP-");
  const feedback = [
    "CONFIRMATION",
    "RECONSIDERATION",
    "POST_CONFIRMATION_EXPLANATION",
  ].includes(value.position);
  if (instruction && (value.response !== null || value.hasChecked)) reject();
  if (
    value.hasChecked &&
    (value.response === null || (!feedback && value.position !== "REVISION"))
  )
    reject();
  if (value.position === "REVISION" && !value.hasChecked) reject();
  if (
    !value.hasChecked &&
    [
      value.checkedResponse,
      value.checkedRevision,
      value.feedbackRevision,
      value.evaluation,
    ].some((item) => item !== null)
  )
    reject();
  if (value.evaluation !== null) {
    if (
      !fields(value.evaluation, ["outcome", "diagnostic"]) ||
      !value.hasChecked ||
      value.checkedResponse === null ||
      value.response === null ||
      (!feedback &&
        !(value.position === "REVISION" && !definition.responseStages)) ||
      value.checkedRevision !== value.responseRevision ||
      (value.feedbackRevision !== null &&
        value.feedbackRevision !== value.responseRevision) ||
      !samePrimary(value.response, value.checkedResponse) ||
      !ports.ready(value.checkedResponse)
    )
      reject();
    const expected = ports.evaluate(value.checkedResponse!);
    if (
      expected.outcome !== value.evaluation.outcome ||
      expected.diagnostic !== value.evaluation.diagnostic ||
      (value.position === "CONFIRMATION" && expected.outcome !== "CONFIRMED") ||
      (value.position === "RECONSIDERATION" &&
        expected.outcome !== "RECONSIDERATION")
    )
      reject();
  } else if (
    feedback ||
    value.checkedResponse !== null ||
    value.checkedRevision !== null ||
    value.feedbackRevision !== null
  )
    reject();
  if (definition.modelSelection) {
    const m = value.model;
    if (
      !fields(m, ["modelId", "revision", "value"]) ||
      !m ||
      m.modelId !== definition.modelSelection.modelId ||
      !rev(m.revision) ||
      !fields(m.value, ["selectionId", "state"]) ||
      !definition.modelSelection.selectionIds.includes(m.value.selectionId)
    )
      reject();
    validateC04A02StageEngagementV1(value.c04A02StageEngagement);
    const e = value.c04A02StageEngagement!;
    if (
      m!.revision <
        Number(e["EXP-02"]["C04-S02-A"]) + Number(e["EXP-03"]["C04-S02-B"]) ||
      (m!.revision === 0 &&
        m!.value.selectionId !==
          definition.modelSelection.initialSelectionId) ||
      (value.position === "ENTRY" && m!.revision !== 0)
    )
      reject();
  }
  const policy = definition.responseStages;
  if (policy) {
    const first = value.firstPrimaryCommitment,
      current = value.currentPrimaryCommitment;
    for (const c of [first, current]) {
      if (c === null) continue;
      if (
        !fields(c, [
          "sequence",
          "activityId",
          "contractId",
          "version",
          "scenarioId",
          "responseRevision",
          "response",
          "reasoningPreviouslyExposed",
        ]) ||
        !c ||
        c.activityId !== value.activityId ||
        c.contractId !== policy.contractId ||
        c.version !== policy.version ||
        c.scenarioId !== policy.scenarioId ||
        !rev(c.sequence) ||
        c.sequence === 0 ||
        !rev(c.responseRevision) ||
        c.responseRevision === 0 ||
        c.responseRevision > value.responseRevision ||
        typeof c.reasoningPreviouslyExposed !== "boolean" ||
        !primaryResponseReady(c.response, policy)
      )
        reject();
    }
    if (
      !rev(value.commitmentSequence) ||
      value.commitmentSequence > value.responseRevision ||
      (value.commitmentSequence === 0) !== (first === null) ||
      value.reasoningExposed !== (first !== null) ||
      (first && (first.sequence !== 1 || first.reasoningPreviouslyExposed)) ||
      (current &&
        (current.sequence !== value.commitmentSequence ||
          current.reasoningPreviouslyExposed !== current.sequence > 1)) ||
      (first &&
        current &&
        (first.responseRevision > current.responseRevision ||
          (current.sequence > 1 &&
            first.responseRevision >= current.responseRevision) ||
          (current.sequence === 1 &&
            JSON.stringify(first) !== JSON.stringify(current))))
    )
      reject();
    if (value.responseStage === "PRIMARY") {
      if (
        current !== null ||
        value.explanationCommitmentSequence !== null ||
        value.checkedCommitmentSequence !== null ||
        value.evaluation !== null ||
        (value.response !== null &&
          parts(value.response)?.some((p) => p.key === policy.reasoningField))
      )
        reject();
    } else if (value.responseStage === "REASONING") {
      if (!currentPrimaryCommitmentValid(value, policy)) reject();
      const explanation = parts(value.response)?.some(
        (p) => p.key === policy.reasoningField,
      );
      if (
        explanation
          ? !stagedResponseReady(value, policy)
          : value.explanationCommitmentSequence !== null
      )
        reject();
      if (
        value.checkedCommitmentSequence !==
        (value.evaluation ? current?.sequence : null)
      )
        reject();
    } else reject();
    if (
      instruction &&
      (value.commitmentSequence !== 0 || value.responseStage !== "PRIMARY")
    )
      reject();
  }
  if (definition.terminalTeaching) {
    if (value.position === "POST_CONFIRMATION_EXPLANATION") {
      if (
        value.feedbackRevision !== value.responseRevision ||
        value.terminalEntryRevision !== value.responseRevision ||
        (value.terminalTeachingRevision !== null &&
          value.terminalTeachingRevision !== value.responseRevision)
      )
        reject();
    } else if (
      value.terminalEntryRevision !== null ||
      value.terminalTeachingRevision !== null
    )
      reject();
  }
  const copyCommitment = (c: PrimaryCommitment | null | undefined) =>
    c == null
      ? null
      : Object.freeze({ ...c, response: immutableResponse(c.response) });
  return Object.freeze({
    ...value,
    response:
      value.response === null ? null : immutableResponse(value.response),
    checkedResponse:
      value.checkedResponse === null
        ? null
        : immutableResponse(value.checkedResponse),
    evaluation:
      value.evaluation === null ? null : Object.freeze({ ...value.evaluation }),
    ...(value.model
      ? {
          model: Object.freeze({
            ...value.model,
            value: Object.freeze({ ...value.model.value }),
          }),
          c04A02StageEngagement: stageEngagement(
            value.c04A02StageEngagement!["EXP-02"]["C04-S02-A"],
            value.c04A02StageEngagement!["EXP-03"]["C04-S02-B"],
          ),
        }
      : {}),
    ...(policy
      ? {
          firstPrimaryCommitment: copyCommitment(value.firstPrimaryCommitment),
          currentPrimaryCommitment: copyCommitment(
            value.currentPrimaryCommitment,
          ),
        }
      : {}),
  });
}

const restorationIssuers = new WeakMap<
  object,
  Readonly<{
    context: ActivityContext;
    evaluate: ActivityPorts["evaluate"];
    definition: ActivityDefinition;
    adapter: ActivityModelAdapter | undefined;
  }>
>();
export type ActivityRestoration = Readonly<{ activityId: ActivityId }>;

/** Trusted source composition must validate response membership and model issuance.
 * Like ordinary ports, this is a composition capability, never a JSON boundary.
 */
export function createActivityRestoration(
  definition: ActivityDefinition,
  ports: ActivityPorts,
  context: ActivityContext,
  modelAdapter?: ActivityModelAdapter,
): ActivityRestoration {
  validateActivityDefinition(definition);
  if (!!definition.modelSelection !== (modelAdapter !== undefined))
    throw new TypeError("Missing restoration model authority");
  if (modelAdapter && context.model) {
    validateActivityModelAdapter(modelAdapter);
    // Exercise the existing opaque adapter's source validation, not a learner
    // event. Discard its independently issued result; no revision/engagement is
    // changed. The binding's adapter rejects detached/plain domain state.
    if (
      !modelValue(
        modelAdapter.select(
          context.model.value,
          context.model.value.selectionId,
        ),
        context.model.value.selectionId,
      )
    )
      throw new TypeError("Unauthenticated restoration model");
  }
  const validated = validateActivityRestoration(definition, ports, context);
  const token = Object.freeze({ activityId: definition.activityId });
  restorationIssuers.set(token, {
    context: validated,
    evaluate: ports.evaluate,
    definition,
    adapter: modelAdapter,
  });
  return token;
}

export function createActivityMachine(
  definition: ActivityDefinition,
  ports: ActivityPorts,
  modelAdapter?: ActivityModelAdapter,
  restoration?: ActivityRestoration,
  intentAdapter?: ActivityIntentAdapter,
) {
  validateActivityDefinition(definition);
  if (!!definition.modelIntents !== (intentAdapter !== undefined))
    throw new TypeError(
      "Model intent policy and adapter must be supplied together",
    );
  if (intentAdapter !== undefined) validateActivityIntentAdapter(intentAdapter);
  if (definition.instructionalContinuation && !intentAdapter?.continuationState)
    throw new TypeError(
      "Continuation requires trusted family state capability",
    );
  const intentAuthority = intentAdapter
    ? Object.freeze({
        initialize: intentAdapter.initialize,
        transition: intentAdapter.transition,
        continuationState: intentAdapter.continuationState,
      })
    : undefined;
  const intentPolicy = definition.modelIntents
    ? structuredClone(definition.modelIntents)
    : undefined;
  if (intentPolicy) {
    for (const permission of intentPolicy.permissions) {
      Object.freeze(permission.intent);
      Object.freeze(permission);
    }
    Object.freeze(intentPolicy.permissions);
    Object.freeze(intentPolicy);
  }
  const initializeIntentModel = (): ActivityIntentContext => {
    try {
      const state = intentAuthority!.initialize();
      if (!state || typeof state !== "object" || !immutableIntentState(state))
        throw new TypeError("Invalid intent state");
      return Object.freeze({
        family: intentPolicy!.family,
        modelId: intentPolicy!.modelId,
        scenarioId: intentPolicy!.scenarioId,
        revision: 0,
        state,
      });
    } catch {
      throw new TypeError("Invalid activity intent initialization");
    }
  };
  if (!!definition.modelSelection !== (modelAdapter !== undefined))
    throw new TypeError("Model metadata and adapter must be supplied together");
  if (modelAdapter !== undefined) validateActivityModelAdapter(modelAdapter);
  const adapter = modelAdapter
    ? Object.freeze({
        initialize: modelAdapter.initialize,
        select: modelAdapter.select,
      })
    : undefined;
  const modelPolicy = definition.modelSelection
    ? structuredClone(definition.modelSelection)
    : undefined;
  if (modelPolicy) {
    Object.freeze(modelPolicy.selectionIds);
    for (const ids of Object.values(modelPolicy.allowedSelections))
      Object.freeze(ids);
    Object.freeze(modelPolicy.allowedSelections);
    Object.freeze(modelPolicy);
  }
  const initializeModel = (): ActivityModelContext => {
    try {
      const value = modelValue(
        adapter!.initialize(),
        modelPolicy!.initialSelectionId,
      );
      if (!value) throw new TypeError("Invalid model value");
      return Object.freeze({
        modelId: modelPolicy!.modelId,
        revision: 0,
        value,
      });
    } catch {
      throw new TypeError("Invalid activity model initialization");
    }
  };
  if (
    !own(ports) ||
    typeof ports.ready !== "function" ||
    typeof ports.evaluate !== "function" ||
    typeof ports.completionEligible !== "function" ||
    typeof ports.sourceReviewAvailable !== "function" ||
    typeof ports.informationNeeded !== "function" ||
    typeof ports.informationReturn !== "function"
  )
    throw new TypeError("Invalid activity ports");
  // Detach from mutable caller arrays/maps. Functions are injected pure ports, not source content.
  const edges = structuredClone(definition.edges);
  const support = structuredClone(definition.support);
  const staging = definition.responseStages
    ? structuredClone(definition.responseStages)
    : undefined;
  const teaching = definition.terminalTeaching
    ? structuredClone(definition.terminalTeaching)
    : undefined;
  const activityId = definition.activityId;
  const continuationPolicy = definition.instructionalContinuation
    ? structuredClone(definition.instructionalContinuation)
    : undefined;
  if (continuationPolicy) {
    for (const stage of continuationPolicy.stages) {
      Object.freeze(stage.action);
      Object.freeze(stage);
    }
    Object.freeze(continuationPolicy.stages);
    Object.freeze(continuationPolicy);
  }
  const continueDefinition: ActivityDefinition = Object.freeze({
    ...definition,
    edges,
    ...(intentPolicy ? { modelIntents: intentPolicy } : {}),
    ...(continuationPolicy
      ? { instructionalContinuation: continuationPolicy }
      : {}),
  });
  const issueContinuation = (
    accepted: readonly InstructionalContinuationRequirement[],
  ): InstructionalContinuationEvidence => {
    const evidence = Object.freeze({
      policy: continuationPolicy!,
      accepted: Object.freeze([...accepted]),
    });
    continuationIssuers.set(evidence, intentAuthority!.continuationState!);
    return evidence;
  };
  const issued =
    restoration === undefined ? undefined : restorationIssuers.get(restoration);
  if (
    restoration !== undefined &&
    (!issued ||
      issued.evaluate !== ports.evaluate ||
      issued.definition !== definition ||
      issued.adapter !== modelAdapter ||
      restoration.activityId !== activityId)
  )
    throw new TypeError("Unissued semantic restoration");
  const restored = issued
    ? validateActivityRestoration(definition, ports, issued.context)
    : undefined;
  const machineSetup = setup({
    types: { context: {} as ActivityContext, events: {} as ActivityEvent },
  });
  const { assign } = machineSetup;
  const valid = (event: ActivityEvent): boolean => isActivityEvent(event);
  const clear = {
    checkedResponse: null,
    checkedRevision: null,
    feedbackRevision: null,
    evaluation: null,
    ...(staging ? { checkedCommitmentSequence: null } : {}),
    ...(teaching
      ? { terminalEntryRevision: null, terminalTeachingRevision: null }
      : {}),
  };
  const authorized = (
    callback: (activityId: ActivityId, origin: Position) => boolean,
    origin: Position,
  ) => {
    try {
      return callback(activityId, origin) === true;
    } catch {
      return false;
    }
  };
  const enabled = (context: ActivityContext, event: ActivityEvent) =>
    valid(event) &&
    event.type === "OPEN_SUPPORT" &&
    (support[context.position]?.includes(event.mode) ?? false) &&
    (event.mode !== "SOURCE_REVIEW" ||
      (context.position !== "INFO_NEEDED" &&
        authorized(ports.sourceReviewAvailable, context.position))) &&
    (event.mode !== "REINFORCEMENT" || context.position.startsWith("EXP-"));
  const idle = ({ context }: { context: ActivityContext }) =>
    context.origin === null;
  const check = ({
    context,
    event,
  }: {
    context: ActivityContext;
    event: ActivityEvent;
  }) =>
    valid(event) &&
    context.origin === null &&
    context.response !== null &&
    (!staging || stagedResponseReady(context, staging)) &&
    ports.ready(context.response) &&
    context.checkedRevision !== context.responseRevision &&
    ((event.type === "CHECK_RESPONSE" && !context.hasChecked) ||
      (event.type === "CHECK_AGAIN" && context.hasChecked));
  const checked = assign(({ context }: { context: ActivityContext }) => {
    const response = context.response!;
    const result = ports.evaluate(response);
    if (
      !fields(result, ["outcome", "diagnostic"]) ||
      !(
        (result.outcome === "CONFIRMED" && result.diagnostic === null) ||
        (result.outcome === "RECONSIDERATION" &&
          typeof result.diagnostic === "string" &&
          result.diagnostic.trim() === result.diagnostic &&
          result.diagnostic.length > 0)
      )
    )
      throw new TypeError("Invalid evaluation result");
    return {
      hasChecked: true,
      position:
        result.outcome === "CONFIRMED" ? "CONFIRMATION" : "RECONSIDERATION",
      checkedResponse: response,
      checkedRevision: context.responseRevision,
      evaluation: Object.freeze({
        outcome: result.outcome,
        diagnostic: result.diagnostic,
      }),
      feedbackRevision: null,
      ...(staging
        ? {
            checkedCommitmentSequence:
              context.currentPrimaryCommitment!.sequence,
          }
        : {}),
      ...(teaching
        ? { terminalEntryRevision: null, terminalTeachingRevision: null }
        : {}),
    };
  });
  const finish = ({
    context,
    event,
  }: {
    context: ActivityContext;
    event: ActivityEvent;
  }) => {
    if (
      !valid(event) ||
      !idle({ context }) ||
      (teaching &&
        (context.position !== "POST_CONFIRMATION_EXPLANATION" ||
          context.terminalEntryRevision !== context.responseRevision ||
          context.terminalTeachingRevision !== context.responseRevision)) ||
      (context.position === "CONFIRMATION" &&
        edges.CONFIRMATION?.CONTINUE === "POST_CONFIRMATION_EXPLANATION") ||
      (context.position === "POST_CONFIRMATION_EXPLANATION" &&
        edges.CONFIRMATION?.CONTINUE !== "POST_CONFIRMATION_EXPLANATION") ||
      context.response === null ||
      context.checkedRevision !== context.responseRevision ||
      context.feedbackRevision !== context.responseRevision ||
      context.evaluation === null
    )
      return false;
    try {
      return (
        ports.completionEligible(
          Object.freeze({
            activityId,
            responseRevision: context.responseRevision,
            checkedRevision: context.checkedRevision,
            feedbackRevision: context.feedbackRevision,
            evaluation: context.evaluation,
          }),
        ) === true
      );
    } catch {
      return false;
    }
  };
  const next = (
    context: ActivityContext,
    intent: "CONTINUE" | "PREVIOUS" | "INFO_NEEDED",
  ) => edges[context.position]?.[intent];
  // A post-assignment action freezes the actual XState-owned context, not just a projection.
  const seal = ({ context }: { context: ActivityContext }) => {
    Object.freeze(context);
  };
  const resetPrimary = (context: ActivityContext) =>
    staging
      ? {
          ...clear,
          responseStage: "PRIMARY" as const,
          response: context.response
            ? immutableResponse(primaryResponse(context.response, staging)!)
            : null,
          currentPrimaryCommitment: null,
          explanationCommitmentSequence: null,
          responseRevision: context.responseRevision + 1,
        }
      : {};
  const stageEvents = {
    COMMIT_PRIMARY_RESPONSE: {
      guard: ({
        context,
        event,
      }: {
        context: ActivityContext;
        event: ActivityEvent;
      }) =>
        valid(event) &&
        !!staging &&
        idle({ context }) &&
        context.responseStage === "PRIMARY" &&
        primaryResponseReady(context.response, staging) &&
        Number.isSafeInteger(context.responseRevision) &&
        context.responseRevision >= 0 &&
        Number.isSafeInteger(context.commitmentSequence) &&
        context.commitmentSequence! >= 0 &&
        context.commitmentSequence! < Number.MAX_SAFE_INTEGER,
      actions: [
        assign(({ context }: { context: ActivityContext }) => {
          const commitment: PrimaryCommitment = Object.freeze({
            sequence: context.commitmentSequence! + 1,
            activityId,
            contractId: staging!.contractId,
            version: staging!.version,
            scenarioId: staging!.scenarioId,
            responseRevision: context.responseRevision,
            response: immutableResponse(context.response!),
            reasoningPreviouslyExposed: context.reasoningExposed!,
          });
          return {
            responseStage: "REASONING" as const,
            commitmentSequence: commitment.sequence,
            currentPrimaryCommitment: commitment,
            firstPrimaryCommitment:
              context.firstPrimaryCommitment ?? commitment,
            reasoningExposed: true,
            explanationCommitmentSequence: null,
          };
        }),
        seal,
      ],
    },
    RETURN_TO_PRIMARY: {
      guard: ({
        context,
        event,
      }: {
        context: ActivityContext;
        event: ActivityEvent;
      }) =>
        valid(event) &&
        !!staging &&
        idle({ context }) &&
        currentPrimaryCommitmentValid(context, staging) &&
        context.responseRevision < Number.MAX_SAFE_INTEGER,
      actions: [
        assign(({ context }: { context: ActivityContext }) =>
          resetPrimary(context),
        ),
        seal,
      ],
    },
  };
  const changeAllowed = (
    context: ActivityContext,
    event: ActivityEvent,
  ): boolean => {
    if (
      !valid(event) ||
      event.type !== "RESPONSE_CHANGED" ||
      !idle({ context }) ||
      context.responseRevision >= Number.MAX_SAFE_INTEGER
    )
      return false;
    if (!staging) return true;
    if (context.responseStage === "PRIMARY") {
      // Partial drafts are allowed, but only declared representations/roles.
      const entries = parts(event.response);
      return (
        entries !== null &&
        entries.every((entry) => {
          const field = staging.primaryFields.find(
            (item) => item.key === entry.key,
          );
          return (
            field !== undefined &&
            field.acceptedKinds.some((kind) => kind === entry.response.kind) &&
            (entry.response.kind !== "EXACT_QUANTITY" ||
              (entry.response.value.kind === field.quantityKind &&
                entry.response.value.unit === field.unit &&
                entry.response.value.basis === field.basis))
          );
        })
      );
    }
    const draft = {
      ...context,
      response: event.response,
      explanationCommitmentSequence:
        context.currentPrimaryCommitment?.sequence ?? null,
    };
    return stagedResponseReady(draft, staging);
  };
  const change = assign(
    ({
      context,
      event,
    }: {
      context: ActivityContext;
      event: ActivityEvent;
    }) => ({
      ...clear,
      response: immutableResponse(
        (event as Extract<ActivityEvent, { type: "RESPONSE_CHANGED" }>)
          .response,
      ),
      responseRevision: context.responseRevision + 1,
      ...(staging
        ? context.responseStage === "PRIMARY"
          ? {
              currentPrimaryCommitment: null,
              explanationCommitmentSequence: null,
            }
          : {
              explanationCommitmentSequence:
                context.currentPrimaryCommitment!.sequence,
            }
        : {}),
    }),
  );
  const revise = assign(({ context }: { context: ActivityContext }) => ({
    position: "REVISION" as const,
    ...resetPrimary(context),
  }));
  const enterTeaching = assign(({ context }: { context: ActivityContext }) => ({
    position: "POST_CONFIRMATION_EXPLANATION" as const,
    ...(teaching
      ? {
          terminalEntryRevision: context.responseRevision,
          terminalTeachingRevision: null,
        }
      : {}),
  }));
  const infoAllowed = (context: ActivityContext) =>
    next(context, "INFO_NEEDED") === "INFO_NEEDED" &&
    context.checkedRevision === null &&
    authorized(ports.informationNeeded, context.position);
  const enterInfo = {
    target: "infoNeeded",
    guard: ({
      context,
      event,
    }: {
      context: ActivityContext;
      event: ActivityEvent;
    }) => valid(event) && idle({ context }) && infoAllowed(context),
    actions: [
      assign(({ context }: { context: ActivityContext }) => ({
        position: "INFO_NEEDED",
        infoOrigin: context.position,
      })),
      seal,
    ],
  };
  const returnInfo = (target: "entry" | "exp" | "active") => ({
    target,
    guard: ({
      context,
      event,
    }: {
      context: ActivityContext;
      event: ActivityEvent;
    }) =>
      valid(event) &&
      idle({ context }) &&
      context.infoOrigin !== null &&
      next(context, "PREVIOUS") === context.infoOrigin &&
      (target === "entry"
        ? context.infoOrigin === "ENTRY"
        : target === "active"
          ? context.infoOrigin === "ACTIVE"
          : context.infoOrigin.startsWith("EXP-")) &&
      authorized(ports.informationReturn, context.infoOrigin),
    actions: [
      assign(({ context }: { context: ActivityContext }) => ({
        position: context.infoOrigin!,
        infoOrigin: null,
      })),
      seal,
    ],
  });
  const move = (intent: "CONTINUE" | "PREVIOUS") => ({
    guard: ({
      context,
      event,
    }: {
      context: ActivityContext;
      event: ActivityEvent;
    }) =>
      valid(event) && idle({ context }) && next(context, intent) !== undefined,
    actions: [
      assign(({ context }: { context: ActivityContext }) => ({
        position: next(context, intent)!,
      })),
      seal,
    ],
  });
  const instruction = {
    initial: restored
      ? restored.position.startsWith("EXP-")
        ? "exp"
        : (
            {
              ENTRY: "entry",
              ACTIVE: "active",
              REVISION: "revision",
              CONFIRMATION: "confirmation",
              RECONSIDERATION: "reconsideration",
              POST_CONFIRMATION_EXPLANATION: "postConfirmationExplanation",
            } as Record<string, string>
          )[restored.position]!
      : "entry",
    states: {
      entry: {
        on: {
          CONTINUE: [
            {
              ...move("CONTINUE"),
              target: "active",
              guard: ({
                context,
                event,
              }: {
                context: ActivityContext;
                event: ActivityEvent;
              }) =>
                valid(event) &&
                instructionalContinueEligible(context, continueDefinition) &&
                idle({ context }) &&
                next(context, "CONTINUE") === "ACTIVE",
            },
            {
              ...move("CONTINUE"),
              target: "exp",
              guard: ({
                context,
                event,
              }: {
                context: ActivityContext;
                event: ActivityEvent;
              }) =>
                valid(event) &&
                instructionalContinueEligible(context, continueDefinition) &&
                idle({ context }) &&
                next(context, "CONTINUE")?.startsWith("EXP-") === true,
            },
          ],
          INFO_NEEDED: enterInfo,
        },
      },
      exp: {
        on: {
          CONTINUE: [
            {
              ...move("CONTINUE"),
              target: "active",
              guard: ({
                context,
                event,
              }: {
                context: ActivityContext;
                event: ActivityEvent;
              }) =>
                valid(event) &&
                instructionalContinueEligible(context, continueDefinition) &&
                idle({ context }) &&
                next(context, "CONTINUE") === "ACTIVE",
            },
            {
              ...move("CONTINUE"),
              target: "exp",
              guard: ({
                context,
                event,
              }: {
                context: ActivityContext;
                event: ActivityEvent;
              }) =>
                valid(event) &&
                instructionalContinueEligible(context, continueDefinition) &&
                idle({ context }) &&
                next(context, "CONTINUE")?.startsWith("EXP-") === true,
            },
          ],
          PREVIOUS: {
            ...move("PREVIOUS"),
            target: "exp",
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              next(context, "PREVIOUS")?.startsWith("EXP-") === true,
          },
          INFO_NEEDED: enterInfo,
        },
      },
      active: {
        on: {
          ...stageEvents,
          RESPONSE_CHANGED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) => changeAllowed(context, event),
            actions: [change, seal],
          },
          CHECK_RESPONSE: [
            { guard: check, target: "confirmation", actions: [checked, seal] },
          ],
          CHECK_AGAIN: [
            { guard: check, target: "confirmation", actions: [checked, seal] },
          ],
          INFO_NEEDED: enterInfo,
        },
      },
      confirmation: {
        always: {
          guard: ({ context }: { context: ActivityContext }) =>
            context.evaluation?.outcome === "RECONSIDERATION",
          target: "reconsideration",
        },
        on: {
          CONTINUE: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              edges.CONFIRMATION?.CONTINUE ===
                "POST_CONFIRMATION_EXPLANATION" &&
              context.position === "CONFIRMATION" &&
              context.response !== null &&
              context.hasChecked &&
              context.checkedRevision === context.responseRevision &&
              context.evaluation?.outcome === "CONFIRMED" &&
              context.feedbackRevision === context.responseRevision,
            target: "postConfirmationExplanation",
            actions: [enterTeaching, seal],
          },
          FEEDBACK_DELIVERED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              event.type === "FEEDBACK_DELIVERED" &&
              context.checkedRevision === event.revision &&
              context.feedbackRevision === null,
            actions: [
              assign(({ context }: { context: ActivityContext }) => ({
                feedbackRevision: context.responseRevision,
              })),
              seal,
            ],
          },
          REVISE: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              context.response !== null &&
              (!staging || context.responseRevision < Number.MAX_SAFE_INTEGER),
            target: "revision",
            actions: [revise, seal],
          },
          FINISH_ACTIVITY: {
            guard: finish,
            target: "complete",
            actions: [assign({ position: "COMPLETE" }), seal],
          },
        },
      },
      postConfirmationExplanation: {
        on: {
          TERMINAL_TEACHING_DELIVERED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              event.type === "TERMINAL_TEACHING_DELIVERED" &&
              !!teaching &&
              idle({ context }) &&
              context.hasChecked &&
              context.response !== null &&
              context.evaluation !== null &&
              context.checkedRevision === context.responseRevision &&
              context.feedbackRevision === context.responseRevision &&
              context.terminalEntryRevision === context.responseRevision &&
              context.terminalTeachingRevision === null &&
              event.revision === context.responseRevision &&
              event.contentId === teaching.contentId,
            actions: [
              assign(({ context }: { context: ActivityContext }) => ({
                terminalTeachingRevision: context.responseRevision,
              })),
              seal,
            ],
          },
          FINISH_ACTIVITY: {
            guard: finish,
            target: "complete",
            actions: [assign({ position: "COMPLETE" }), seal],
          },
        },
      },
      reconsideration: {
        on: {
          CONTINUE: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              !!teaching &&
              idle({ context }) &&
              edges.RECONSIDERATION?.CONTINUE ===
                "POST_CONFIRMATION_EXPLANATION" &&
              context.position === "RECONSIDERATION" &&
              context.hasChecked &&
              context.response !== null &&
              context.evaluation?.outcome === "RECONSIDERATION" &&
              context.checkedRevision === context.responseRevision &&
              context.feedbackRevision === context.responseRevision,
            target: "postConfirmationExplanation",
            actions: [enterTeaching, seal],
          },
          FEEDBACK_DELIVERED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              event.type === "FEEDBACK_DELIVERED" &&
              context.checkedRevision === event.revision &&
              context.feedbackRevision === null,
            actions: [
              assign(({ context }: { context: ActivityContext }) => ({
                feedbackRevision: context.responseRevision,
              })),
              seal,
            ],
          },
          REVISE: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              context.response !== null &&
              (!staging || context.responseRevision < Number.MAX_SAFE_INTEGER),
            target: "revision",
            actions: [revise, seal],
          },
          FINISH_ACTIVITY: {
            guard: finish,
            target: "complete",
            actions: [assign({ position: "COMPLETE" }), seal],
          },
        },
      },
      revision: {
        on: {
          ...stageEvents,
          RESPONSE_CHANGED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) => changeAllowed(context, event),
            actions: [change, seal],
          },
          CHECK_AGAIN: [
            { guard: check, target: "confirmation", actions: [checked, seal] },
          ],
        },
      },
      infoNeeded: {
        on: {
          PREVIOUS: [
            returnInfo("entry"),
            returnInfo("exp"),
            returnInfo("active"),
          ],
        },
      },
      complete: {},
    },
  };
  // XState's parallel regions share one machine-owned context; support never replaces instruction.
  return machineSetup.createMachine({
    id: "activity",
    type: "parallel",
    context: () =>
      restored ??
      Object.freeze({
        activityId,
        ...(modelPolicy ? { model: initializeModel() } : {}),
        ...(intentPolicy ? { intentModel: initializeIntentModel() } : {}),
        ...(continuationPolicy
          ? { instructionalContinuation: issueContinuation([]) }
          : {}),
        ...(activityId === "C04-A02"
          ? { c04A02StageEngagement: stageEngagement(false, false) }
          : {}),
        position: "ENTRY",
        origin: null,
        infoOrigin: null,
        response: null,
        checkedResponse: null,
        responseRevision: 0,
        hasChecked: false,
        checkedRevision: null,
        feedbackRevision: null,
        evaluation: null,
        ...(staging
          ? {
              responseStage: "PRIMARY" as const,
              firstPrimaryCommitment: null,
              currentPrimaryCommitment: null,
              commitmentSequence: 0,
              reasoningExposed: false,
              explanationCommitmentSequence: null,
              checkedCommitmentSequence: null,
            }
          : {}),
        ...(teaching
          ? { terminalEntryRevision: null, terminalTeachingRevision: null }
          : {}),
      }),
    on: {
      "*": { guard: ({ event }) => !valid(event) },
      MODEL_INTENT: {
        guard: ({ context, event }) =>
          !!intentAuthority &&
          !!intentPolicy &&
          isActivityEvent(event) &&
          event.activityId === activityId &&
          event.scenarioId === intentPolicy.scenarioId &&
          event.modelId === intentPolicy.modelId &&
          event.intent.family === intentPolicy.family &&
          event.position === context.position &&
          event.revision === context.intentModel?.revision &&
          context.intentModel.revision < Number.MAX_SAFE_INTEGER &&
          context.origin === null &&
          context.infoOrigin === null &&
          intentPolicy.permissions.some(
            (permission) =>
              permission.position === context.position &&
              sameIntent(permission.intent, event.intent),
          ),
        actions: [
          assign(({ context, event }) => {
            if (event.type !== "MODEL_INTENT") return {};
            try {
              const previous = context.intentModel!;
              const state = intentAuthority!.transition(
                previous.state,
                Object.freeze({ ...event.intent }),
                context.position,
              );
              if (
                !state ||
                typeof state !== "object" ||
                !immutableIntentState(state) ||
                sameIntentState(previous.state, state)
              )
                return {};
              const stage = continuationPolicy?.stages.find(
                (item) =>
                  item.position === context.position &&
                  sameIntent(item.action, event.intent),
              );
              const accepted =
                context.instructionalContinuation?.accepted ?? [];
              const engaged = stage !== undefined;
              return {
                intentModel: Object.freeze({
                  ...previous,
                  revision: previous.revision + 1,
                  state,
                }),
                ...(engaged && !accepted.includes(stage.requirement)
                  ? {
                      instructionalContinuation: issueContinuation([
                        ...accepted,
                        stage.requirement,
                      ]),
                    }
                  : {}),
              };
            } catch {
              return {};
            }
          }),
          seal,
        ],
      },
      SELECT_MODEL_CHILD: {
        guard: ({ context, event }) =>
          !!adapter &&
          isActivityEvent(event) &&
          event.modelId === context.model?.modelId &&
          event.revision === context.model.revision &&
          event.position === context.position &&
          availableModelSelections(context, modelPolicy).includes(
            event.selectionId,
          ),
        actions: [
          assign(({ context, event }) => {
            if (event.type !== "SELECT_MODEL_CHILD") return {};
            try {
              const previous = context.model!;
              const value = modelValue(
                adapter!.select(previous.value, event.selectionId),
                event.selectionId,
              );
              if (!value || value.state === previous.value.state) return {};
              return {
                ...(context.c04A02StageEngagement
                  ? {
                      c04A02StageEngagement: stageEngagement(
                        context.c04A02StageEngagement["EXP-02"]["C04-S02-A"] ||
                          (context.position === "EXP-02" &&
                            event.selectionId === "C04-S02-A"),
                        context.c04A02StageEngagement["EXP-03"]["C04-S02-B"] ||
                          (context.position === "EXP-03" &&
                            event.selectionId === "C04-S02-B"),
                      ),
                    }
                  : {}),
                model: Object.freeze({
                  modelId: previous.modelId,
                  revision: previous.revision + 1,
                  value,
                }),
              };
            } catch {
              return {};
            }
          }),
          seal,
        ],
      },
    },
    states: {
      instructional: instruction,
      support: {
        initial: "none",
        states: {
          none: {
            on: {
              OPEN_SUPPORT: [
                {
                  guard: ({ context, event }) =>
                    enabled(context, event) &&
                    event.type === "OPEN_SUPPORT" &&
                    event.mode === "REVIEW",
                  target: "review",
                  actions: [
                    assign(({ context }) => ({
                      origin: context.position,
                    })),
                    seal,
                  ],
                },
                {
                  guard: ({ context, event }) =>
                    enabled(context, event) &&
                    event.type === "OPEN_SUPPORT" &&
                    event.mode === "SOURCE_REVIEW",
                  target: "sourceReview",
                  actions: [
                    assign(({ context }) => ({
                      origin: context.position,
                    })),
                    seal,
                  ],
                },
                {
                  guard: ({ context, event }) =>
                    enabled(context, event) &&
                    event.type === "OPEN_SUPPORT" &&
                    event.mode === "REINFORCEMENT",
                  target: "reinforcement",
                  actions: [
                    assign(({ context }) => ({
                      origin: context.position,
                    })),
                    seal,
                  ],
                },
              ],
            },
          },
          review: {
            on: {
              CLOSE_SUPPORT: {
                guard: ({ event }) => valid(event),
                target: "none",
                actions: [assign({ origin: null }), seal],
              },
            },
          },
          sourceReview: {
            on: {
              CLOSE_SUPPORT: {
                guard: ({ event }) => valid(event),
                target: "none",
                actions: [assign({ origin: null }), seal],
              },
            },
          },
          reinforcement: {
            on: {
              CLOSE_SUPPORT: {
                guard: ({ event }) => valid(event),
                target: "none",
                actions: [assign({ origin: null }), seal],
              },
            },
          },
        },
      },
    },
  });
}
