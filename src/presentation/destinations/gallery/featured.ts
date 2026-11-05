import type { ActivityId } from "@/core/public";
import type {
  CompetencySummary,
  LearnerContinuation,
} from "../../shell/public";

/** Initial featured activity: the Session's live unfinished activity in this
 * competency, else its suggested next activity, else the first available. */
export function initialFeatured(
  competency: CompetencySummary,
  continuation: LearnerContinuation | undefined,
): number {
  const at = (id: ActivityId | undefined) =>
    id ? competency.activities.findIndex((a) => a.id === id) : -1;
  const resume = at(continuation?.resume?.activityId);
  if (resume >= 0) return resume;
  const next = at(continuation?.upNext?.activityId);
  if (next >= 0) return next;
  return Math.max(
    0,
    competency.activities.findIndex((a) => a.available),
  );
}
