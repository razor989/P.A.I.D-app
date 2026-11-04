import type { ActivityId } from "@/core/public";
import {
  PrepareWorkRecord,
  ExploreWorkRecord,
  ApplyWorkRecord,
  TransferWorkRecord,
} from "../models/c03-overtime-work-record/public";
import type { C03PreparePresentation } from "../models/c03-overtime-work-record/public";
import { AnchoredChangeTrack } from "../models/c04-anchored-change-track/public";
import type { C04Presentation } from "../models/c04-anchored-change-track/public";
import { ReferenceExperience } from "../models/c04-reference/ReferenceExperience";
import { PrepareExperience } from "../models/c04-anchored-change-track/PrepareExperience";
import { ApplyExperience } from "../models/c04-anchored-change-track/ApplyExperience";
import { TransferExperience } from "../models/c04-anchored-change-track/TransferExperience";

export function ActivityHost({
  activityId,
  c04Presentation,
  c03Presentation,
}: {
  activityId: ActivityId;
  c04Presentation?: C04Presentation | undefined;
  c03Presentation?: C03PreparePresentation | undefined;
}) {
  if (
    activityId === "C03-A04" &&
    c03Presentation?.projection.frame.activityId === activityId
  )
    return <TransferWorkRecord {...c03Presentation} />;
  if (
    activityId === "C03-A03" &&
    c03Presentation?.projection.frame.activityId === activityId
  )
    return <ApplyWorkRecord {...c03Presentation} />;
  if (
    activityId === "C03-A02" &&
    c03Presentation?.projection.frame.activityId === activityId
  )
    return <ExploreWorkRecord {...c03Presentation} />;
  if (
    activityId === "C03-A01" &&
    c03Presentation?.projection.frame.activityId === activityId
  )
    return <PrepareWorkRecord {...c03Presentation} />;
  if (
    activityId === "C04-A01" &&
    c04Presentation?.frame.activityId === activityId
  )
    return <PrepareExperience {...c04Presentation} />;
  if (
    activityId === "C04-A02" &&
    c04Presentation?.frame.activityId === activityId
  )
    return <ReferenceExperience {...c04Presentation} />;
  if (
    activityId === "C04-A03" &&
    c04Presentation?.frame.activityId === activityId
  )
    return <ApplyExperience {...c04Presentation} />;
  if (
    activityId === "C04-A04" &&
    c04Presentation?.frame.activityId === activityId
  )
    return <TransferExperience {...c04Presentation} />;
  if (
    c04Presentation &&
    activityId.startsWith("C04-") &&
    c04Presentation.frame.activityId === activityId
  )
    return (
      <>
        <h2>Activity host</h2>
        <AnchoredChangeTrack {...c04Presentation} />
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
