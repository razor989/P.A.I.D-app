import type { ActivityId } from "@/core/public";
import { ActivityHost } from "../destinations/ActivityHost";

export function ActivityShell({ activityId }: { activityId: ActivityId }) {
  return (
    <section aria-label="Activity workspace">
      <ActivityHost activityId={activityId} />
    </section>
  );
}
