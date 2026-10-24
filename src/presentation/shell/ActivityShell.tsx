import type { ActivityId } from "@/core/public";
import { ActivityHost } from "../destinations/ActivityHost";
import type { C04Presentation } from "./public";

export function ActivityShell({
  activityId,
  c04Presentation,
}: {
  activityId: ActivityId;
  c04Presentation?: C04Presentation | undefined;
}) {
  return (
    <section aria-label="Activity workspace">
      <ActivityHost activityId={activityId} c04Presentation={c04Presentation} />
    </section>
  );
}
