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

export type ActivityContext = Readonly<{
  activityId: ActivityId;
  position: Position;
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
    ]) ||
    !isActivityId(value.activityId) ||
    !own(value.edges) ||
    !own(value.support)
  )
    throw new TypeError("Invalid activity definition");
  if ("responseStages" in value) validateStages(value.responseStages);
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
  if (
    !own(entry) ||
    typeof entry.CONTINUE !== "string" ||
    !nodes.has(entry.CONTINUE as Position)
  )
    throw new TypeError("Missing entry route");
}

/** The public event boundary also rejects excess fields; invalid events are ignored without mutation. */
export function isActivityEvent(value: unknown): value is ActivityEvent {
  if (!own(value)) return false;
  switch (value.type) {
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

export function createActivityMachine(
  definition: ActivityDefinition,
  ports: ActivityPorts,
) {
  validateActivityDefinition(definition);
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
    initial: "entry",
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
    context: Object.freeze({
      activityId,
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
    on: { "*": { guard: ({ event }) => !valid(event) } },
  });
}
