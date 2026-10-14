import { setup } from "xstate";
import { isActivityId, isLearnerResponse } from "../../core/public";
import type { ActivityId, LearnerResponse } from "../../core/public";

export type InstructionalPhase =
  | "ENTRY"
  | "EXP"
  | "ACTIVE"
  | "REVISION"
  | "CONFIRMATION"
  | "RECONSIDERATION"
  | "INFO_NEEDED"
  | "COMPLETE";
export type SupportPhase =
  "NONE" | "REVIEW" | "SOURCE_REVIEW" | "REINFORCEMENT";
export type Position = "ENTRY" | "ACTIVE" | "INFO_NEEDED" | `EXP-${string}`;
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
  | { type: "CLOSE_SUPPORT" };

export type ActivityContext = Readonly<{
  activityId: ActivityId;
  position: Position;
  origin: Position | null;
  infoOrigin: Position | null;
  response: LearnerResponse | null;
  checkedResponse: LearnerResponse | null;
  responseRevision: number;
  checkedRevision: number | null;
  feedbackRevision: number | null;
  evaluation: Evaluation | null;
}>;

const position = (value: string): value is Position =>
  value === "ENTRY" ||
  value === "ACTIVE" ||
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

/** Reject malformed definitions before any actor exists. IDs are not generated or guessed. */
export function validateActivityDefinition(
  value: unknown,
): asserts value is ActivityDefinition {
  if (
    !fields(value, ["activityId", "edges", "support"]) ||
    !isActivityId(value.activityId) ||
    !own(value.edges) ||
    !own(value.support)
  )
    throw new TypeError("Invalid activity definition");
  const nodes = new Set<Position>(["ENTRY", "ACTIVE", "INFO_NEEDED"]);
  for (const [from, edges] of Object.entries(value.edges)) {
    if (!position(from) || !own(edges))
      throw new TypeError("Invalid activity edge");
    nodes.add(from);
    for (const [intent, target] of Object.entries(edges)) {
      if (
        !intents.some((item) => item === intent) ||
        typeof target !== "string" ||
        !position(target) ||
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
  const freeze = (object: object): void => {
    for (const child of Object.values(object) as unknown[])
      if (child !== null && typeof child === "object") freeze(child);
    Object.freeze(object);
  };
  freeze(clone);
  return clone;
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
    ports.ready(context.response) &&
    context.checkedRevision !== context.responseRevision &&
    ((event.type === "CHECK_RESPONSE" && context.responseRevision === 1) ||
      (event.type === "CHECK_AGAIN" && context.responseRevision > 1));
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
      checkedResponse: response,
      checkedRevision: context.responseRevision,
      evaluation: Object.freeze({
        outcome: result.outcome,
        diagnostic: result.diagnostic,
      }),
      feedbackRevision: null,
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
          RESPONSE_CHANGED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              context.responseRevision < Number.MAX_SAFE_INTEGER,
            actions: [
              assign(
                ({
                  context,
                  event,
                }: {
                  context: ActivityContext;
                  event: ActivityEvent;
                }) => ({
                  ...clear,
                  response: immutableResponse(
                    (
                      event as Extract<
                        ActivityEvent,
                        { type: "RESPONSE_CHANGED" }
                      >
                    ).response,
                  ),
                  responseRevision: context.responseRevision + 1,
                }),
              ),
              seal,
            ],
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
              valid(event) && idle({ context }) && context.response !== null,
            target: "revision",
          },
          FINISH_ACTIVITY: { guard: finish, target: "complete" },
        },
      },
      reconsideration: {
        on: {
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
              valid(event) && idle({ context }) && context.response !== null,
            target: "revision",
          },
          FINISH_ACTIVITY: { guard: finish, target: "complete" },
        },
      },
      revision: {
        on: {
          RESPONSE_CHANGED: {
            guard: ({
              context,
              event,
            }: {
              context: ActivityContext;
              event: ActivityEvent;
            }) =>
              valid(event) &&
              idle({ context }) &&
              context.responseRevision < Number.MAX_SAFE_INTEGER,
            actions: [
              assign(
                ({
                  context,
                  event,
                }: {
                  context: ActivityContext;
                  event: ActivityEvent;
                }) => ({
                  ...clear,
                  response: immutableResponse(
                    (
                      event as Extract<
                        ActivityEvent,
                        { type: "RESPONSE_CHANGED" }
                      >
                    ).response,
                  ),
                  responseRevision: context.responseRevision + 1,
                }),
              ),
              seal,
            ],
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
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
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
