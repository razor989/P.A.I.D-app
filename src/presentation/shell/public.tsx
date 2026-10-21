import type { ActivityId, CompetencyId } from "@/core/public";

export { AppShell } from "./AppShell";
export type ActivitySummary = Readonly<{
  id: ActivityId;
  label: string;
  available: boolean;
}>;
export type CompetencySummary = Readonly<{
  id: CompetencyId;
  label: string;
  available: boolean;
  activities: readonly ActivitySummary[];
}>;
export type Destination =
  | Readonly<{ kind: "library" }>
  | Readonly<{ kind: "competency"; competencyId: CompetencyId }>
  | Readonly<{ kind: "activity"; activityId: ActivityId }>;
export type ShellProps = Readonly<{
  destination: Destination;
  competencies: readonly CompetencySummary[];
  blocked: boolean;
  notice: string | null;
  canBack: boolean;
  canReturn: boolean;
  onBack: () => void;
  onReturn: () => void;
  onCompetency: (id: CompetencyId) => void;
  onActivity: (id: ActivityId) => void;
  switchChoice: Readonly<{
    canReturn: boolean;
    canAbandon: boolean;
    onReturn: () => void;
    onAbandon: () => void;
  }> | null;
}>;
