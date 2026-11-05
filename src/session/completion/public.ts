import type { ActivityId, CompetencyId } from "@/core/public";
import { isExecutableActivity, selectSession } from "../app-machine/public";
import type { AppSessionActor } from "../app-machine/public";
export { acquireSessionCheckpointProducer } from "../app-machine/public";

type ActivityReference = Readonly<{
  competencyId: CompetencyId;
  activityId: ActivityId;
}>;
export type LearnerContinuationView = Readonly<{
  resume: ActivityReference | null;
  upNext: ActivityReference | null;
  completedThisSession: readonly ActivityId[];
}>;

/** Read-only navigation view for the Learning Library and activity menus.
 *
 * - `resume`: the live unfinished activity the Session still holds (only while
 *   it is active, not COMPLETE and no finish/abandon clear is settling).
 *   Re-selecting the same activity reuses that actor — the Session's own
 *   resume path. A checkpoint from a previous launch is not reported here: it
 *   is resolved by the startup recovery choice before the Library appears.
 * - `upNext`: the catalog successor of the most recently confirmed finish in
 *   this run, when executable and not itself finished in this run.
 * - `completedThisSession`: confirmed finishes in this run only. Unknown
 *   history stays empty; it is never treated as "not completed".
 *
 * Derives from existing Session state only; writes nothing.
 */
export function selectLearnerContinuation(
  session: AppSessionActor,
): LearnerContinuationView {
  const state = selectSession(session);
  const catalog = session.getSnapshot().context.catalog;
  const completed =
    state.completion.kind === "unknown" ? [] : state.completion.activityIds;
  const reference = (id: ActivityId): ActivityReference | null => {
    const competencyId = catalog.activities.get(id)?.competencyId;
    return competencyId && isExecutableActivity(catalog, id)
      ? Object.freeze({ competencyId, activityId: id })
      : null;
  };
  let resume: ActivityReference | null = null;
  const live = state.currentActivity?.getSnapshot();
  if (
    live &&
    live.status === "active" &&
    live.context.position !== "COMPLETE" &&
    state.lifecyclePhase === "idle"
  )
    resume = reference(live.context.activityId);
  let upNext: ActivityReference | null = null;
  const last = completed[completed.length - 1];
  if (!resume && last) {
    const competencyId = catalog.activities.get(last)?.competencyId;
    const ordered = competencyId
      ? catalog.competencies.get(competencyId)?.activityIds
      : undefined;
    const index = ordered?.indexOf(last) ?? -1;
    const next = index >= 0 ? ordered?.[index + 1] : undefined;
    if (next && !completed.includes(next)) upNext = reference(next);
  }
  return Object.freeze({
    resume,
    upNext,
    completedThisSession: Object.freeze([...completed]),
  });
}

/** Derived observations, never a second completion ledger. Unknown historical
 * negatives cannot be reconstructed from positive present-session evidence.
 */
export function selectCompletionProgress(session: AppSessionActor) {
  const state = selectSession(session);
  const catalog = session.getSnapshot().context.catalog;
  const knowledge = state.completion;
  const ids = knowledge.kind === "unknown" ? [] : knowledge.activityIds;
  const exact = knowledge.kind === "known";
  const summarize = (activityIds: readonly string[]) => {
    const observed = activityIds.filter((id) =>
      ids.some((known) => known === id),
    ).length;
    return Object.freeze({
      total: activityIds.length,
      completed: exact ? observed : null,
      complete: exact ? observed === activityIds.length : null,
      observedLowerBound: observed,
      historicalTotalKnown: exact,
    });
  };
  return Object.freeze({
    kind: knowledge.kind,
    overall: summarize([...catalog.activities.keys()]),
    competencies: Object.freeze(
      [...catalog.competencies.values()].map((competency) =>
        Object.freeze({
          competencyId: competency.id,
          ...summarize(competency.activityIds),
        }),
      ),
    ),
  });
}
