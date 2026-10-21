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
        />
      ) : (
        <p role="status">This competency is unavailable.</p>
      );
    }
    case "activity":
      return <ActivityShell activityId={props.destination.activityId} />;
  }
}
