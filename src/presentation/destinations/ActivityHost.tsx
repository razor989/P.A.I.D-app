import type { ActivityId } from "@/core/public";

export function ActivityHost({ activityId }: { activityId: ActivityId }) {
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
