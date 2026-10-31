import type { ActivityId } from "@/core/public";
import { ActivityHost } from "../destinations/ActivityHost";
import type { C04RoutePresentation } from "./public";

export function ActivityShell({
  activityId,
  c04Presentation,
}: {
  activityId: ActivityId;
  c04Presentation?: C04RoutePresentation | undefined;
}) {
  return (
    <section aria-label="Activity workspace">
      <ActivityHost activityId={activityId} c04Presentation={c04Presentation} />
    </section>
  );
}
