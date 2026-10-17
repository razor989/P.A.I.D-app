import {
  and,
  assign,
  createActor,
  fromCallback,
  fromPromise,
  setup,
  stateIn,
} from "xstate";
import { isActivityId, isCompetencyId, isScenarioId } from "@/core/public";
import type { ActivityId, CompetencyId } from "@/core/public";
import { createC04ActivityActor } from "@/engine/c04-activity-binding/public";
import type { RecoveryClassification } from "@/recovery/rehydration/public";
import type { StudyCatalog } from "@/study/catalog/public";
import type {
  RecoveryCheckpointQueue,
  RecoveryMutationResult,
} from "@/recovery/store/public";

type ActivityActor = ReturnType<typeof createC04ActivityActor>;
export type SessionDestination =
  | Readonly<{ kind: "library" }>
  | Readonly<{ kind: "competency"; competencyId: CompetencyId }>
  | Readonly<{ kind: "activity"; activityId: ActivityId }>;
export type CompletionKnowledge =
  | Readonly<{ kind: "unknown" }>
  | Readonly<{ kind: "known" | "partial"; activityIds: readonly ActivityId[] }>;
export type SessionInput = Readonly<{
  catalog: StudyCatalog;
  /** Already classified by T031; this is a trusted composition port, not JSON.
   * Absence of input leaves startup unresolved, not an inferred empty store.
   * A valid actor is transferred unstarted into recoveryChoice, NOT resumed.
   */
  recovery?: RecoveryClassification;
  completion?: CompletionKnowledge;
  queue?: RecoveryCheckpointQueue;
}>;
export type SessionEvent =
  | Readonly<{
      type:
        | "OBSERVE_ACTIVITY_COMPLETE"
        | "CONTINUE_COMPLETED_ACTIVITY"
        | "RETURN_TO_UNFINISHED_ACTIVITY"
        | "ABANDON_AND_OPEN_SELECTED_ACTIVITY"
        | "CANCEL_PENDING_ACTIVITY_SWITCH"
        | "RETRY_PENDING_CLEAR"
        | "RECOVER_PENDING_CLEAR";
    }>
  | Readonly<{ type: "RETURN_TO_LIBRARY" }>
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
    case "RETURN_TO_LIBRARY":
    case "OBSERVE_ACTIVITY_COMPLETE":
    case "CONTINUE_COMPLETED_ACTIVITY":
    case "RETURN_TO_UNFINISHED_ACTIVITY":
    case "ABANDON_AND_OPEN_SELECTED_ACTIVITY":
    case "CANCEL_PENDING_ACTIVITY_SWITCH":
    case "RETRY_PENDING_CLEAR":
    case "RECOVER_PENDING_CLEAR":
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
  queue: RecoveryCheckpointQueue | null;
  generation: number;
  writable: boolean;
  pendingTargetActivityId: ActivityId | null;
  switchOrigin: SessionDestination | null;
  transaction: Transaction | null;
  finalizedActor: ActivityActor | null;
  lastResult: RecoveryMutationResult | null;
  barrierError: unknown;
}>;
type Transaction = Readonly<{
  token: object;
  actor: ActivityActor;
  generation: number;
  purpose: "finish" | "abandon";
  method: "clear" | "retry" | "recoveryClear";
}>;
type Settlement = Readonly<{
  transaction: Transaction;
  result: RecoveryMutationResult | null;
  error: unknown;
}>;
// Internal invocation outputs are one-use capabilities, never public events.
const settlements = new WeakSet<object>();
function authenticated(context: Context, output: Settlement): boolean {
  return (
    !!output &&
    settlements.has(output) &&
    output.transaction === context.transaction &&
    output.transaction.actor === context.currentActivity &&
    output.transaction.generation === context.generation
  );
}
function complete(context: Context): boolean {
  const snapshot = context.currentActivity?.getSnapshot();
  return (
    snapshot?.status === "active" &&
    snapshot.matches({ instructional: "complete" }) &&
    snapshot.context.position === "COMPLETE" &&
    activityKnown(context.catalog, snapshot.context.activityId)
  );
}
function free(context: Context): boolean {
  return (
    context.transaction === null &&
    context.pendingTargetActivityId === null &&
    (!complete(context) || context.finalizedActor === context.currentActivity)
  );
}
function executable(context: Context, id: unknown): id is ActivityId {
  // The inspected source-fixed C04 facade wires exactly these four bindings.
  // This availability proof constructs no actor, including during switch choice.
  return (
    activityKnown(context.catalog, id) &&
    ["C04-A01", "C04-A02", "C04-A03", "C04-A04"].includes(id)
  );
}
function successor(context: Context): ActivityId | null {
  if (!complete(context) || context.finalizedActor !== context.currentActivity)
    return null;
  const id = context.currentActivity!.getSnapshot().context.activityId;
  const competency = context.catalog.activities.get(id)?.competencyId;
  const ordered = competency
    ? context.catalog.competencies.get(competency)?.activityIds
    : undefined;
  const index = ordered?.indexOf(id) ?? -1;
  const next = index >= 0 ? ordered?.[index + 1] : undefined;
  return next &&
    executable(context, next) &&
    context.catalog.activities.get(next)?.competencyId === competency
    ? next
    : null;
}
function replaceActivity(context: Context, id: ActivityId) {
  context.currentActivity?.stop();
  const currentActivity = createC04ActivityActor(id);
  currentActivity.start();
  return {
    currentActivity,
    generation: context.generation + 1,
    writable: true,
    finalizedActor: null,
    transaction: null,
    lastResult: null,
    barrierError: null,
    pendingTargetActivityId: null,
    switchOrigin: null,
    destination: Object.freeze({ kind: "activity" as const, activityId: id }),
  };
}
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
    input.queue &&
    [
      "clear",
      "retry",
      "recoveryClear",
      "replace",
      "replaceBarrier",
      "load",
    ].some(
      (key) =>
        typeof input.queue![key as keyof RecoveryCheckpointQueue] !==
        "function",
    )
  )
    throw new TypeError("Invalid Recovery queue");
  if (
    !catalog ||
    typeof catalog.competencies?.get !== "function" ||
    typeof catalog.activities?.get !== "function" ||
    typeof catalog.scenarios?.get !== "function"
  )
    throw new TypeError("Invalid Session catalog");
  if (
    completion.kind !== "unknown" &&
    (!["known", "partial"].includes(completion.kind) ||
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
            kind: completion.kind,
            activityIds: Object.freeze([...completion.activityIds]),
          }),
    technicalError:
      recovery?.status === "technical-failure" ? recovery.error : null,
    queue: input.queue ?? null,
    generation: 0,
    writable: true,
    pendingTargetActivityId: null,
    switchOrigin: null,
    transaction: null,
    finalizedActor: null,
    lastResult: null,
    barrierError: null,
  };
}

function selectable(context: Context, event: SessionEvent): boolean {
  if (
    event.type !== "SELECT_ACTIVITY" ||
    !isSessionEvent(event) ||
    !executable(context, event.activityId) ||
    !free(context)
  )
    return false;
  if (context.currentActivity && !complete(context)) {
    const snapshot = context.currentActivity.getSnapshot();
    return (
      snapshot.status === "active" &&
      snapshot.context.position !== "COMPLETE" &&
      snapshot.context.activityId === event.activityId
    );
  }
  // Only C04 is executable at this milestone. Other bank identities are not locks
  // or prerequisites; their executable bindings belong to later tasks.
  return true;
}

const machine = setup({
  types: {
    context: {} as Context,
    input: {} as Context,
    events: {} as SessionEvent,
  },
  actors: {
    clearOperation: fromPromise<
      Settlement,
      { transaction: Transaction; queue: RecoveryCheckpointQueue }
    >(async ({ input }) => {
      let result: RecoveryMutationResult | null = null;
      let error: unknown = null;
      try {
        result = await input.queue[input.transaction.method]();
      } catch (caught) {
        error = caught;
      }
      const output = Object.freeze({
        transaction: input.transaction,
        result,
        error,
      });
      settlements.add(output);
      return output;
    }),
    // A lifetime resource, not a second semantic Activity Actor/store. It reads
    // the single Session-owned reference only at shutdown; no replacement path.
    activityLifetime: fromCallback<
      SessionEvent,
      {
        current: () => ActivityActor | null;
        observe: (callback: () => void) => { unsubscribe: () => void };
        notify: () => void;
      }
    >(({ input }) => {
      let current: ActivityActor | null = null;
      let subscription: { unsubscribe: () => void } | undefined;
      const watch = input.observe(() => {
        const next = input.current();
        if (next === current) return;
        subscription?.unsubscribe();
        current = next;
        subscription = current?.subscribe(() => input.notify());
      });
      return () => {
        watch.unsubscribe();
        subscription?.unsubscribe();
        input.current()?.stop();
      };
    }),
  },
  guards: {
    returnToLibrary: and([
      "eventValid",
      ({ context }) => free(context),
      stateIn({ session: { decision: "none" } }),
    ]),
    noCheckpoint: ({ context }) => context.recovery?.status === "NO_CHECKPOINT",
    validCheckpoint: ({ context }) =>
      context.recovery?.status === "VALID_CHECKPOINT",
    unusableCheckpoint: ({ context }) =>
      context.recovery?.status === "UNUSABLE_CHECKPOINT",
    competencyKnown: ({ context, event }) =>
      isSessionEvent(event) &&
      event.type === "SELECT_COMPETENCY" &&
      free(context) &&
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
    switchRequested: ({ context, event }) =>
      isSessionEvent(event) &&
      event.type === "SELECT_ACTIVITY" &&
      free(context) &&
      executable(context, event.activityId) &&
      !!context.currentActivity &&
      !complete(context) &&
      context.currentActivity.getSnapshot().status === "active" &&
      context.currentActivity.getSnapshot().context.activityId !==
        event.activityId,
    choiceOpen: ({ context, event }) =>
      isSessionEvent(event) &&
      !!context.pendingTargetActivityId &&
      !context.transaction &&
      !complete(context),
    canFinish: ({ context, event }) =>
      isSessionEvent(event) &&
      complete(context) &&
      !!context.queue &&
      !context.transaction &&
      !context.pendingTargetActivityId &&
      context.finalizedActor !== context.currentActivity,
    canAbandon: ({ context, event }) =>
      isSessionEvent(event) &&
      !!context.queue &&
      !context.transaction &&
      !!context.currentActivity &&
      context.currentActivity.getSnapshot().status === "active" &&
      !complete(context) &&
      executable(context, context.pendingTargetActivityId),
    canContinue: ({ context, event }) =>
      isSessionEvent(event) && free(context) && successor(context) !== null,
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
      if (complete(context)) return replaceActivity(context, event.activityId);
      const currentActivity =
        context.currentActivity ?? createC04ActivityActor(event.activityId);
      currentActivity.start();
      return {
        currentActivity,
        generation: context.currentActivity
          ? context.generation
          : context.generation + 1,
        destination: Object.freeze({
          kind: "activity" as const,
          activityId: event.activityId,
        }),
      };
    }),
    requestSwitch: assign(({ context, event }) =>
      event.type === "SELECT_ACTIVITY"
        ? {
            pendingTargetActivityId: event.activityId,
            switchOrigin: context.destination,
          }
        : {},
    ),
    cancelSwitch: assign(({ context }) => ({
      pendingTargetActivityId: null,
      switchOrigin: null,
      destination: context.switchOrigin,
    })),
    returnActivity: assign(({ context }) => ({
      pendingTargetActivityId: null,
      switchOrigin: null,
      destination: Object.freeze({
        kind: "activity" as const,
        activityId: context.currentActivity!.getSnapshot().context.activityId,
      }),
    })),
    continueActivity: assign(({ context }) =>
      replaceActivity(context, successor(context)!),
    ),
    beginFinish: assign(({ context }) => ({
      writable: false,
      lastResult: null,
      barrierError: null,
      transaction: Object.freeze({
        token: Object.freeze({}),
        actor: context.currentActivity!,
        generation: context.generation,
        purpose: "finish" as const,
        method: "clear" as const,
      }),
    })),
    beginAbandon: assign(({ context }) => ({
      writable: false,
      lastResult: null,
      barrierError: null,
      transaction: Object.freeze({
        token: Object.freeze({}),
        actor: context.currentActivity!,
        generation: context.generation,
        purpose: "abandon" as const,
        method: "clear" as const,
      }),
    })),
    retryClear: assign(({ context }) => ({
      barrierError: null,
      transaction: Object.freeze({
        ...context.transaction!,
        method: "retry" as const,
      }),
    })),
    recoverClear: assign(({ context }) => ({
      barrierError: null,
      transaction: Object.freeze({
        ...context.transaction!,
        method: "recoveryClear" as const,
      }),
    })),
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
      observe: (callback) => self.subscribe(callback),
      notify: () => self.send({ type: "OBSERVE_ACTIVITY_COMPLETE" }),
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
            SELECT_ACTIVITY: [
              { guard: "switchRequested", actions: "requestSwitch" },
              {
                guard: "activitySelectable",
                target: ".activity",
                actions: "activity",
              },
            ],
            CONTINUE_COMPLETED_ACTIVITY: {
              guard: "canContinue",
              target: ".activity",
              actions: "continueActivity",
            },
            RETURN_TO_UNFINISHED_ACTIVITY: {
              guard: "choiceOpen",
              target: ".activity",
              actions: "returnActivity",
            },
            CANCEL_PENDING_ACTIVITY_SWITCH: {
              guard: "choiceOpen",
              actions: "cancelSwitch",
            },
          },
          states: {
            library: {
              entry: "library",
              always: {
                guard: ({ context }) =>
                  context.destination?.kind === "activity",
                target: "activity",
              },
            },
            competency: {
              always: {
                guard: ({ context }) =>
                  context.destination?.kind === "activity",
                target: "activity",
              },
              on: {
                RETURN_TO_LIBRARY: {
                  guard: "returnToLibrary",
                  target: "library",
                },
              },
            },
            activity: {},
          },
        },
        decision: {
          initial: "none",
          states: {
            none: {
              always: {
                guard: ({ context }) =>
                  context.pendingTargetActivityId !== null,
                target: "activitySwitchChoice",
              },
            },
            activitySwitchChoice: {
              always: {
                guard: ({ context }) =>
                  context.pendingTargetActivityId === null,
                target: "none",
              },
            },
          },
        },
        lifecycle: {
          initial: "idle",
          on: {
            OBSERVE_ACTIVITY_COMPLETE: {
              guard: "canFinish",
              target: ".clearing",
              actions: "beginFinish",
            },
            ABANDON_AND_OPEN_SELECTED_ACTIVITY: {
              guard: "canAbandon",
              target: ".clearing",
              actions: "beginAbandon",
            },
          },
          states: {
            idle: {},
            finalized: {
              // Replacement clears finalizedActor. Settle the lifecycle in the
              // same macrostep, including durable abandonment opening B.
              always: {
                guard: ({ context }) =>
                  context.finalizedActor !== context.currentActivity,
                target: "idle",
              },
            },
            clearing: {
              invoke: {
                id: "t034.clear",
                src: "clearOperation",
                input: ({ context }) => ({
                  transaction: context.transaction!,
                  queue: context.queue!,
                }),
                onDone: [
                  {
                    guard: ({ context, event }) =>
                      authenticated(context, event.output) &&
                      event.output.result?.status === "durable" &&
                      event.output.result.operation === "clear" &&
                      Number.isSafeInteger(event.output.result.requestId) &&
                      event.output.result.requestId > 0,
                    target: "finalized",
                    actions: assign(({ context, event }) => {
                      settlements.delete(event.output);
                      if (context.transaction!.purpose === "abandon")
                        return replaceActivity(
                          context,
                          context.pendingTargetActivityId!,
                        );
                      const id =
                        context.currentActivity!.getSnapshot().context
                          .activityId;
                      const ids =
                        context.completion.kind === "unknown"
                          ? []
                          : context.completion.activityIds;
                      return {
                        transaction: null,
                        finalizedActor: context.currentActivity,
                        barrierError: null,
                        lastResult: event.output.result,
                        completion: Object.freeze({
                          kind:
                            context.completion.kind === "known"
                              ? ("known" as const)
                              : ("partial" as const),
                          activityIds: Object.freeze(
                            ids.includes(id) ? [...ids] : [...ids, id],
                          ),
                        }),
                      };
                    }),
                  },
                  {
                    guard: ({ context, event }) =>
                      authenticated(context, event.output),
                    target: "failed",
                    actions: assign(({ event }) => {
                      settlements.delete(event.output);
                      return {
                        lastResult: event.output.result,
                        barrierError: event.output.error ?? event.output.result,
                      };
                    }),
                  },
                ],
              },
            },
            failed: {
              on: {
                RETRY_PENDING_CLEAR: {
                  guard: ({ context, event }) =>
                    isSessionEvent(event) &&
                    context.lastResult?.status === "technical-failure" &&
                    context.lastResult.operation === "clear",
                  target: "clearing",
                  actions: "retryClear",
                },
                RECOVER_PENDING_CLEAR: {
                  guard: ({ context, event }) =>
                    isSessionEvent(event) &&
                    context.lastResult?.status === "blocked" &&
                    context.lastResult.reason === "paused",
                  target: "clearing",
                  actions: "recoverClear",
                },
              },
            },
          },
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

/** A captured producer is authority for one live actor generation only. It never
 * projects or stores history; later bootstrap must use this fence, not the raw queue.
 */
export function acquireSessionCheckpointProducer(actor: AppSessionActor) {
  const captured = actor.getSnapshot().context;
  const current = captured.currentActivity;
  return Object.freeze({
    replace(checkpoint: Parameters<RecoveryCheckpointQueue["replace"]>[0]) {
      const snapshot = actor.getSnapshot();
      const context = snapshot.context;
      if (
        snapshot.status !== "active" ||
        !snapshot.matches("session") ||
        !current ||
        !context.writable ||
        context.currentActivity !== current ||
        context.generation !== captured.generation ||
        !context.queue ||
        context.transaction ||
        complete(context) ||
        checkpoint.checkpoint.activityId !==
          current.getSnapshot().context.activityId
      )
        return null;
      return context.queue.replace(checkpoint);
    },
  });
}

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
    pendingTargetActivityId: context.pendingTargetActivityId,
    switchOrigin: context.switchOrigin,
    lifecyclePhase: context.transaction
      ? snapshot.matches({ session: { lifecycle: "failed" } })
        ? ("failed" as const)
        : context.transaction.purpose === "finish"
          ? ("finish-clear-in-flight" as const)
          : ("abandon-clear-in-flight" as const)
      : context.finalizedActor
        ? ("finalized" as const)
        : ("idle" as const),
    barrierResult: context.lastResult,
    barrierError: context.barrierError,
  });
}
