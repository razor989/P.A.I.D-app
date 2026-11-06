import type { LearnerResponse } from "@/core/public";
import type { projectC03ActivityFrame } from "@/engine/c03-activity-binding/public";
import type { checkC03ComparisonPart } from "@/engine/c03-activity-binding/public";

export { PrepareWorkRecord } from "./PrepareWorkRecord";
export { ExploreWorkRecord } from "./ExploreWorkRecord";
export { ApplyWorkRecord } from "./ApplyWorkRecord";
export { TransferWorkRecord } from "./TransferWorkRecord";

/** Directly coupled to the existing exposure-filtered source, not a copied schema. */
export type C03WorkRecordProjection = ReturnType<
  typeof projectC03ActivityFrame
>;
export type C03PrepareAction =
  | "CONTINUE"
  | "PREVIOUS"
  | "CHECK_RESPONSE"
  | "CHECK_AGAIN"
  | "REVISE"
  | "FINISH_ACTIVITY";
export type C03PreparePresentation = Readonly<{
  projection: C03WorkRecordProjection;
  blocked: boolean;
  onSelectCondition?: (selectionId: string) => void;
  onCheckPart?: (field: string) => ReturnType<typeof checkC03ComparisonPart>;
  sessionContinuation?: Readonly<{
    available: boolean;
    onContinue: () => void;
  }>;
  onAction: (action: C03PrepareAction) => void;
  onResponse: (response: LearnerResponse) => void;
  onHelp: () => void;
  onCloseHelp: () => void;
  /** Caller issues a revision-bound delivery receipt only for real rendered feedback. */
  onFeedbackPresented?: (element: HTMLElement) => void;
}>;
