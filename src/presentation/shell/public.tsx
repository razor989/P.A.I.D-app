import type { ActivityId, CompetencyId } from "@/core/public";
import type { C04Presentation } from "../models/c04-anchored-change-track/public";
import type { C03PreparePresentation } from "../models/c03-overtime-work-record/public";
export type { C03PreparePresentation } from "../models/c03-overtime-work-record/public";

export type { C04Presentation } from "../models/c04-anchored-change-track/public";
/** C04 owns response and durable Session continuation callbacks as one route payload. */
export type C04RoutePresentation = C04Presentation;

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
  completedReview?: boolean;
  onReviewCompleted?: (() => void) | undefined;
  c04Presentation?: C04Presentation | undefined;
  c03Presentation?: C03PreparePresentation | undefined;
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
