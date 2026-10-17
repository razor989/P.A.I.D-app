import { isActivityId, isCompetencyId } from "@/core/public";
import { isSessionEvent, selectSession } from "../app-machine/public";
import type { AppSessionActor, SessionEvent } from "../app-machine/public";

type ActivityActor = NonNullable<
  ReturnType<typeof selectSession>["currentActivity"]
>;
export type NavigationIntent =
  | Extract<
      SessionEvent,
      { type: "SELECT_COMPETENCY" | "SELECT_ACTIVITY" | "RETURN_TO_LIBRARY" }
    >
  | Readonly<{ type: "SYSTEM_BACK" }>;
export type NavigationOutcome =
  | "support-closed"
  | "explanation-previous"
  | "destination-changed"
  | "platform-root"
  | "rejected";

export function isNavigationIntent(value: unknown): value is NavigationIntent {
  if (isSessionEvent(value))
    return (
      value.type === "SELECT_COMPETENCY" ||
      value.type === "SELECT_ACTIVITY" ||
      value.type === "RETURN_TO_LIBRARY"
    );
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== 1
  )
    return false;
  const type = Object.getOwnPropertyDescriptor(value, "type");
  return type !== undefined && "value" in type && type.value === "SYSTEM_BACK";
}

/** Shared D035/S1 path: genuine actor observations and existing Engine events.
 * No route authority, retained state, or test-specific priority implementation.
 */
export function resolveActivityBack(
  activity: ActivityActor,
): "support-closed" | "explanation-previous" | "unavailable" | "rejected" {
  const snapshot = activity.getSnapshot();
  if (snapshot.status !== "active") return "rejected";
  if (
    snapshot.matches({ support: "review" }) ||
    snapshot.matches({ support: "sourceReview" })
  ) {
    if (!snapshot.can({ type: "CLOSE_SUPPORT" })) return "rejected";
    activity.send({ type: "CLOSE_SUPPORT" });
    return "support-closed";
  }
  // Never treat an unsupported local support context as route-level Back.
  if (!snapshot.matches({ support: "none" })) return "rejected";
  if (
    snapshot.matches({ instructional: "exp" }) &&
    snapshot.can({ type: "PREVIOUS" })
  ) {
    activity.send({ type: "PREVIOUS" });
    return "explanation-previous";
  }
  return "unavailable";
}

/** Stateless semantic coordinator. Only Session changes destinations. */
export function navigate(
  session: AppSessionActor,
  intent: unknown,
): NavigationOutcome {
  if (!isNavigationIntent(intent)) return "rejected";
  const snapshot = session.getSnapshot();
  const state = selectSession(session);
  if (
    snapshot.status === "active" &&
    intent.type === "SYSTEM_BACK" &&
    state.decision === "activitySwitchChoice"
  ) {
    const cancel = { type: "CANCEL_PENDING_ACTIVITY_SWITCH" } as const;
    if (!snapshot.can(cancel)) return "rejected";
    session.send(cancel);
    return "destination-changed";
  }
  if (
    snapshot.status !== "active" ||
    state.lifecyclePhase === "finish-clear-in-flight" ||
    state.lifecyclePhase === "abandon-clear-in-flight" ||
    state.lifecyclePhase === "failed" ||
    !snapshot.matches({ session: { decision: "none" } }) ||
    !state.destination
  )
    return "rejected";
  if (intent.type !== "SYSTEM_BACK") {
    if (!snapshot.can(intent)) return "rejected";
    session.send(intent);
    return "destination-changed";
  }
  switch (state.destination.kind) {
    case "library":
      return "platform-root";
    case "competency": {
      const event = { type: "RETURN_TO_LIBRARY" } as const;
      if (!snapshot.can(event)) return "rejected";
      session.send(event);
      return "destination-changed";
    }
    case "activity": {
      const activity = state.currentActivity;
      const id = state.destination.activityId;
      if (
        !activity ||
        !isActivityId(id) ||
        activity.getSnapshot().context.activityId !== id
      )
        return "rejected";
      const local = resolveActivityBack(activity);
      if (local !== "unavailable") return local;
      const competencyId = id.split("-")[0];
      if (!isCompetencyId(competencyId)) return "rejected";
      const event = { type: "SELECT_COMPETENCY", competencyId } as const;
      if (!session.getSnapshot().can(event)) return "rejected";
      session.send(event);
      return "destination-changed";
    }
  }
}
