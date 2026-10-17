import { assign, createActor, fromCallback, setup } from "xstate";
import { isActivityId, isCompetencyId, isScenarioId } from "@/core/public";
import type { ActivityId, CompetencyId } from "@/core/public";
import { createC04ActivityActor } from "@/engine/c04-activity-binding/public";
import type { RecoveryClassification } from "@/recovery/rehydration/public";
import type { StudyCatalog } from "@/study/catalog/public";

type ActivityActor = ReturnType<typeof createC04ActivityActor>;
export type SessionDestination =
  | Readonly<{ kind: "library" }>
  | Readonly<{ kind: "competency"; competencyId: CompetencyId }>
  | Readonly<{ kind: "activity"; activityId: ActivityId }>;
export type CompletionKnowledge =
  | Readonly<{ kind: "unknown" }>
  | Readonly<{ kind: "known"; activityIds: readonly ActivityId[] }>;
export type SessionInput = Readonly<{
  catalog: StudyCatalog;
  /** Already classified by T031; this is a trusted composition port, not JSON.
   * Absence of input leaves startup unresolved, not an inferred empty store.
   * A valid actor is transferred unstarted into recoveryChoice, NOT resumed.
   */
  recovery?: RecoveryClassification;
  completion?: CompletionKnowledge;
}>;
export type SessionEvent =
  | Readonly<{ type: "SELECT_COMPETENCY"; competencyId: CompetencyId }>
  | Readonly<{ type: "SELECT_ACTIVITY"; activityId: ActivityId }>
  | Readonly<{ type: "TECHNICAL_STARTED" }>
  | Readonly<{ type: "TECHNICAL_SUCCEEDED" }>
  | Readonly<{
      type: "TECHNICAL_FAILED";
      recoverable: boolean;
      error: unknown;
    }>;

/** Runtime intent validation mirrors typed events; payloads cannot smuggle a
 * destination setter, replacement actor, or learner-context mutation. */
export function isSessionEvent(value: unknown): value is SessionEvent {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const event = value as Record<string, unknown>;
  const exact = (keys: readonly string[]) =>
    Reflect.ownKeys(event).length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(event, key);
      return descriptor !== undefined && "value" in descriptor;
    });
  const type = Object.getOwnPropertyDescriptor(event, "type");
  if (!type || !("value" in type)) return false;
  switch (type.value) {
    case "SELECT_COMPETENCY":
      return (
        exact(["type", "competencyId"]) && isCompetencyId(event.competencyId)
      );
    case "SELECT_ACTIVITY":
      return exact(["type", "activityId"]) && isActivityId(event.activityId);
    case "TECHNICAL_STARTED":
    case "TECHNICAL_SUCCEEDED":
      return exact(["type"]);
    case "TECHNICAL_FAILED":
      return (
        exact(["type", "recoverable", "error"]) &&
        typeof event.recoverable === "boolean"
      );
    default:
      return false;
  }
}

type Context = Readonly<{
  catalog: StudyCatalog;
  recovery: RecoveryClassification | null;
  destination: SessionDestination | null;
  currentActivity: ActivityActor | null;
  completion: CompletionKnowledge;
  technicalError: unknown;
}>;
type TechnicalState = "idle" | "loading" | "recoverable" | "unrecoverable";

function competencyKnown(
  catalog: StudyCatalog,
  id: unknown,
): id is CompetencyId {
  return isCompetencyId(id) && catalog.competencies.get(id)?.id === id;
}
function activityKnown(catalog: StudyCatalog, id: unknown): id is ActivityId {
  if (!isActivityId(id)) return false;
  const activity = catalog.activities.get(id);
  return (
    activity?.id === id &&
    id.startsWith(`${activity.competencyId}-`) &&
    competencyKnown(catalog, activity.competencyId) &&
    catalog.competencies.get(activity.competencyId)!.activityIds.includes(id)
  );
}

/** Capture completion knowledge, never infer historical zero from a checkpoint. */
function initialContext(input: SessionInput): Context {
  const { catalog, recovery, completion = { kind: "unknown" } } = input;
  if (
    !catalog ||
    typeof catalog.competencies?.get !== "function" ||
    typeof catalog.activities?.get !== "function" ||
    typeof catalog.scenarios?.get !== "function"
  )
    throw new TypeError("Invalid Session catalog");
  if (
    completion.kind !== "unknown" &&
    (completion.kind !== "known" ||
      !Array.isArray(completion.activityIds) ||
      completion.activityIds.some((id) => !activityKnown(catalog, id)) ||
      new Set(completion.activityIds).size !== completion.activityIds.length)
  )
    throw new TypeError("Invalid completion knowledge");
  let currentActivity: ActivityActor | null = null;
  if (recovery !== undefined) {
    if (
      !recovery ||
      ![
        "NO_CHECKPOINT",
        "VALID_CHECKPOINT",
        "UNUSABLE_CHECKPOINT",
        "technical-failure",
      ].includes(recovery.status)
    )
      throw new TypeError("Invalid recovery classification");
    if (recovery.status === "VALID_CHECKPOINT") {
      const checkpoint = recovery.checkpoint?.checkpoint;
      const actor = recovery.actor;
      const snapshot = actor?.getSnapshot();
      const activity =
        checkpoint &&
        catalog.activities.get(checkpoint.activityId as ActivityId);
      const scenario =
        checkpoint && isScenarioId(checkpoint.scenarioId)
          ? catalog.scenarios.get(checkpoint.scenarioId)
          : undefined;
      if (
        !checkpoint ||
        !activityKnown(catalog, checkpoint.activityId) ||
        !isScenarioId(checkpoint.scenarioId) ||
        !activity?.scenarioIds.includes(checkpoint.scenarioId) ||
        scenario?.activityId !== checkpoint.activityId ||
        snapshot?.status !== "active" ||
        snapshot.context.activityId !== checkpoint.activityId ||
        snapshot.context.position !== checkpoint.position
      )
        throw new TypeError("Incompatible recovered actor identity");
      currentActivity = actor;
    }
  }
  return {
    catalog,
    recovery: recovery ?? null,
    destination: null,
    currentActivity,
    completion:
      completion.kind === "unknown"
        ? Object.freeze({ kind: "unknown" })
        : Object.freeze({
            kind: "known",
            activityIds: Object.freeze([...completion.activityIds]),
          }),
    technicalError:
      recovery?.status === "technical-failure" ? recovery.error : null,
  };
}

function selectable(context: Context, event: SessionEvent): boolean {
  if (
    event.type !== "SELECT_ACTIVITY" ||
    !isSessionEvent(event) ||
    !activityKnown(context.catalog, event.activityId)
  )
    return false;
  if (context.currentActivity) {
    const snapshot = context.currentActivity.getSnapshot();
    return (
      snapshot.status === "active" &&
      snapshot.context.position !== "COMPLETE" &&
      snapshot.context.activityId === event.activityId
    );
  }
  // Only C04 is executable at this milestone. Other bank identities are not locks
  // or prerequisites; their executable bindings belong to later tasks.
  return (
    event.activityId.startsWith("C04-") &&
    !(
      context.completion.kind === "known" &&
      context.completion.activityIds.includes(event.activityId)
    )
  );
}

const machine = setup({
  types: {
    context: {} as Context,
    input: {} as Context,
    events: {} as SessionEvent,
  },
  actors: {
    // A lifetime resource, not a second semantic Activity Actor/store. It reads
    // the single Session-owned reference only at shutdown; no replacement path.
    activityLifetime: fromCallback<
      SessionEvent,
      { current: () => ActivityActor | null }
    >(
      ({ input }) =>
        () =>
          input.current()?.stop(),
    ),
  },
  guards: {
    noCheckpoint: ({ context }) => context.recovery?.status === "NO_CHECKPOINT",
    validCheckpoint: ({ context }) =>
      context.recovery?.status === "VALID_CHECKPOINT",
    unusableCheckpoint: ({ context }) =>
      context.recovery?.status === "UNUSABLE_CHECKPOINT",
    competencyKnown: ({ context, event }) =>
      isSessionEvent(event) &&
      event.type === "SELECT_COMPETENCY" &&
      competencyKnown(context.catalog, event.competencyId),
    activitySelectable: ({ context, event }) => selectable(context, event),
    recoverable: ({ event }) =>
      isSessionEvent(event) &&
      event.type === "TECHNICAL_FAILED" &&
      event.recoverable === true,
    unrecoverable: ({ event }) =>
      isSessionEvent(event) &&
      event.type === "TECHNICAL_FAILED" &&
      event.recoverable === false,
    eventValid: ({ event }) => isSessionEvent(event),
  },
  actions: {
    library: assign({
      destination: () => Object.freeze({ kind: "library" as const }),
    }),
    competency: assign({
      destination: ({ event }) => {
        if (event.type !== "SELECT_COMPETENCY")
          throw new TypeError("Invalid competency intent");
        return Object.freeze({
          kind: "competency" as const,
          competencyId: event.competencyId,
        });
      },
    }),
    activity: assign(({ context, event }) => {
      if (event.type !== "SELECT_ACTIVITY")
        throw new TypeError("Invalid activity intent");
      const currentActivity =
        context.currentActivity ?? createC04ActivityActor(event.activityId);
      currentActivity.start();
      return {
        currentActivity,
        destination: Object.freeze({
          kind: "activity" as const,
          activityId: event.activityId,
        }),
      };
    }),
    clearTechnicalError: assign({ technicalError: () => null }),
    technicalError: assign({
      technicalError: ({ event }) =>
        event.type === "TECHNICAL_FAILED" ? event.error : null,
    }),
  },
}).createMachine({
  id: "appSession",
  context: ({ input }) => input,
  invoke: {
    src: "activityLifetime",
    input: ({ self }) => ({
      current: () => self.getSnapshot().context.currentActivity,
    }),
  },
  initial: "startup",
  states: {
    startup: {
      initial: "evaluate",
      states: {
        evaluate: {
          always: [
            { guard: "noCheckpoint", target: "#appSession.session" },
            { guard: "validCheckpoint", target: "recoveryChoice" },
            { guard: "unusableCheckpoint", target: "recoveryFailure" },
          ],
        },
        // Structural hooks only. T036 owns resume/discard and retry orchestration.
        recoveryChoice: {},
        recoveryFailure: {},
      },
    },
    session: {
      type: "parallel",
      states: {
        destination: {
          initial: "library",
          on: {
            SELECT_COMPETENCY: {
              guard: "competencyKnown",
              target: ".competency",
              actions: "competency",
            },
            SELECT_ACTIVITY: {
              guard: "activitySelectable",
              target: ".activity",
              actions: "activity",
            },
          },
          states: {
            library: { entry: "library" },
            competency: {},
            activity: {},
          },
        },
        decision: {
          initial: "none",
          states: { none: {}, activitySwitchChoice: {} },
        },
        technical: {
          initial: "idle",
          states: {
            idle: {
              on: {
                TECHNICAL_STARTED: {
                  guard: "eventValid",
                  target: "loading",
                  actions: "clearTechnicalError",
                },
              },
            },
            loading: {
              on: {
                TECHNICAL_SUCCEEDED: {
                  guard: "eventValid",
                  target: "idle",
                  actions: "clearTechnicalError",
                },
                TECHNICAL_FAILED: [
                  {
                    guard: "recoverable",
                    target: "recoverable",
                    actions: "technicalError",
                  },
                  {
                    guard: "unrecoverable",
                    target: "unrecoverable",
                    actions: "technicalError",
                  },
                ],
              },
            },
            // A new operation notification is not a retry implementation. The
            // operation owner must actually retry; Session never replays math.
            recoverable: {
              on: {
                TECHNICAL_STARTED: { guard: "eventValid", target: "loading" },
              },
            },
            unrecoverable: {},
          },
        },
      },
    },
  },
});

/** Returns one unstarted Session. Creating the actor never reads storage. */
export function createAppSessionActor(input: SessionInput) {
  return createActor(machine, { input: initialContext(input) });
}
export type AppSessionActor = ReturnType<typeof createAppSessionActor>;

/** One observation surface; no independent routing or presentation state. */
export function selectSession(actor: AppSessionActor) {
  const snapshot = actor.getSnapshot();
  const { context } = snapshot;
  let technical: TechnicalState =
    context.recovery?.status === "technical-failure" ? "recoverable" : "idle";
  for (const state of [
    "idle",
    "loading",
    "recoverable",
    "unrecoverable",
  ] as const)
    if (snapshot.matches({ session: { technical: state } })) technical = state;
  return Object.freeze({
    destination: context.destination,
    currentActivity: context.currentActivity,
    completion: context.completion,
    decision: snapshot.matches({
      session: { decision: "activitySwitchChoice" },
    })
      ? ("activitySwitchChoice" as const)
      : ("none" as const),
    technical,
    technicalError: context.technicalError,
    recovery: context.recovery,
  });
}
