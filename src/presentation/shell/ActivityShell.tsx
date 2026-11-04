import type { ActivityId } from "@/core/public";
import { ActivityHost } from "../destinations/ActivityHost";
import type { C04RoutePresentation, C03PreparePresentation } from "./public";

export function ActivityShell({
  activityId,
  c04Presentation,
  c03Presentation,
}: {
  activityId: ActivityId;
  c04Presentation?: C04RoutePresentation | undefined;
  c03Presentation?: C03PreparePresentation | undefined;
}) {
  return (
    <section aria-label="Activity workspace">
      <ActivityHost
        activityId={activityId}
        c04Presentation={c04Presentation}
        c03Presentation={c03Presentation}
      />
    </section>
  );
}
