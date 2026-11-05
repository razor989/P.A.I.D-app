import type { ShellProps } from "./public";
import { LearningLibrary } from "../destinations/LearningLibrary";
import { CompetencyOverview } from "../destinations/CompetencyOverview";
import { ActivityShell } from "./ActivityShell";

export function DestinationView(props: ShellProps) {
  switch (props.destination.kind) {
    case "library":
      return (
        <LearningLibrary
          competencies={props.competencies}
          blocked={props.blocked}
          onSelect={props.onCompetency}
        />
      );
    case "competency": {
      const id = props.destination.competencyId;
      const competency = props.competencies.find((c) => c.id === id);
      return competency ? (
        <CompetencyOverview
          competency={competency}
          blocked={props.blocked}
          onSelect={props.onActivity}
          onReviewCompleted={props.onReviewCompleted}
        />
      ) : (
        <p role="status">This competency is unavailable.</p>
      );
    }
    case "activity":
      return (
        <ActivityShell
          activityId={props.destination.activityId}
          c06Presentation={
            ["C06-A01", "C06-A02", "C06-A03", "C06-A04"].includes(
              props.destination.activityId,
            )
              ? props.c06Presentation
              : undefined
          }
          c03Presentation={
            ["C03-A01", "C03-A02", "C03-A03", "C03-A04"].includes(
              props.destination.activityId,
            )
              ? props.c03Presentation && {
                  ...props.c03Presentation,
                  libraryNavigation: {
                    available: props.canReturn,
                    onReturn: props.onReturn,
                  },
                }
              : undefined
          }
          c04Presentation={
            props.destination.activityId ===
            props.c04Presentation?.frame.activityId
              ? props.c04Presentation
              : undefined
          }
        />
      );
  }
}
