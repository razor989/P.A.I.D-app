import { selectSession } from "../app-machine/public";
import type { AppSessionActor } from "../app-machine/public";
export { acquireSessionCheckpointProducer } from "../app-machine/public";

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
