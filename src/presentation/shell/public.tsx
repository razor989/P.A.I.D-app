import type { ActivityId, CompetencyId } from "@/core/public";
import type { C04Presentation } from "../models/c04-anchored-change-track/public";
import type { C03PreparePresentation } from "../models/c03-overtime-work-record/public";
import type { C06PreparePresentation } from "../models/c06-commission-machine/public";
export type { C06PreparePresentation } from "../models/c06-commission-machine/public";
export type { C03PreparePresentation } from "../models/c03-overtime-work-record/public";

export type { C04Presentation } from "../models/c04-anchored-change-track/public";
/** C04 owns response and durable Session continuation callbacks as one route payload. */
export type C04RoutePresentation = C04Presentation;

export { AppShell } from "./AppShell";
/** Decorative startup ident and its display-only readiness signal. */
export { StartupIdent, signalStartupSurface } from "../transitions/public";
export type ActivitySummary = Readonly<{
  id: ActivityId;
  label: string;
  available: boolean;
}>;
export type CompetencySummary = Readonly<{
  id: CompetencyId;
  label: string;
  available: boolean;
  /** Part of the current learner-facing offering (it has executable
   * activities). `false` keeps the catalog destination intact but omits it
   * from the Learning Library. Absent means offered. */
  offered?: boolean;
  activities: readonly ActivitySummary[];
}>;
export type ActivityReference = Readonly<{
  competencyId: CompetencyId;
  activityId: ActivityId;
}>;
/** Read-only navigation view of authoritative Session state. Presentation
 * never writes it; gallery or slideshow selection never feeds back into it. */
export type LearnerContinuation = Readonly<{
  /** The live unfinished activity held by the Session (re-entering resumes it). */
  resume: ActivityReference | null;
  /** Catalog successor of the activity most recently finished in this run. */
  upNext: ActivityReference | null;
  /** Activities whose finish was confirmed in this run (never a full history). */
  completedThisSession: readonly ActivityId[];
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
  c06Presentation?: C06PreparePresentation | undefined;
  destination: Destination;
  competencies: readonly CompetencySummary[];
  continuation?: LearnerContinuation | undefined;
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
    /** Read-only names for the decision: the live unfinished activity held by
     * the Session and the activity the learner just selected. */
    unfinishedActivityId?: ActivityId | null | undefined;
    selectedActivityId?: ActivityId | null | undefined;
  }> | null;
}>;
