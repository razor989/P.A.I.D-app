import type { ActivityId } from "@/core/public";
import { AnchoredChangeTrack } from "../models/c04-anchored-change-track/public";
import type { C04Presentation } from "../models/c04-anchored-change-track/public";

export function ActivityHost({
  activityId,
  c04Presentation,
}: {
  activityId: ActivityId;
  c04Presentation?: C04Presentation | undefined;
}) {
  if (
    c04Presentation &&
    activityId.startsWith("C04-") &&
    c04Presentation.frame.activityId === activityId
  )
    return (
      <>
        <h2>Activity host</h2>
        <AnchoredChangeTrack {...c04Presentation} />
        <p role="note">
          This version presents the track model only. Response inputs,
          assessment and completion controls are not yet available.
        </p>
      </>
    );
  return (
    <>
      <h2>Activity host</h2>
      <p>{activityId}</p>
      <p>
        Instructional presentation is not yet available in this version. This
        host does not provide a lesson, assessment or completion result.
      </p>
    </>
  );
}
