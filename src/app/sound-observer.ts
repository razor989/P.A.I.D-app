/**
 * Authoritative sound moments. Presentation never decides that a response was
 * confirmed or that an activity completed; these observers only notice, in
 * consecutive snapshots of the same actor or Session, that the engine or the
 * Session just did. They never evaluate, never infer from presentation, and
 * never replay a result that was already there when observation began.
 */

export type CheckOutcome = "CONFIRMED" | "RECONSIDERATION";

export type CheckView = Readonly<{
  /** Stable per actor instance (a restored actor is a new instance). */
  actor: number;
  responseRevision: number;
  checkedRevision: number | null;
  responseStage: string | null;
  outcome: CheckOutcome | null;
}>;

/**
 * Fires once when an actor's response becomes checked at its current
 * revision. The first view of every actor is a silent baseline: a restored
 * checkpoint, a re-entered unfinished activity, a completed-activity review or
 * a StrictMode re-run all start with their existing result and stay quiet.
 */
export function createCheckObserver() {
  const last = new Map<number, string>();
  return (view: CheckView | null): CheckOutcome | null => {
    if (!view) return null;
    const checked =
      view.outcome !== null && view.checkedRevision === view.responseRevision;
    const key = checked
      ? `${view.responseRevision}/${view.responseStage ?? ""}`
      : "";
    const previous = last.get(view.actor);
    last.set(view.actor, key);
    if (previous === undefined) return null;
    return checked && key !== previous ? view.outcome : null;
  };
}

export type CompletionView = Readonly<{
  lifecyclePhase: string;
  /** The Session's completion record; finalizing a finish replaces it. */
  completion: object;
}>;

/**
 * Fires when the Session finalizes a finish: the durable clear succeeded and
 * a new completion record was committed. It keys on the record itself, so a
 * fast clear that never renders its in-flight phase is still heard once. A
 * completion screen shown while the clear is in flight, a failed clear, an
 * abandon, a completed review or the first observation never fires.
 */
export function createCompletionObserver() {
  let previous: object | null = null;
  return (view: CompletionView): boolean => {
    const before = previous;
    previous = view.completion;
    return (
      before !== null &&
      before !== view.completion &&
      view.lifecyclePhase === "finalized"
    );
  };
}
