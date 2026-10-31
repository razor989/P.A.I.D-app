import type { SemanticActivityFrame } from "@/engine/semantic-frame/public";

export { AnchoredChangeTrack } from "./AnchoredChangeTrack";
export type C04TrackFrame = Pick<
  SemanticActivityFrame,
  | "activityId"
  | "stateId"
  | "contentReferences"
  | "exposedModelFacts"
  | "exposedDerivedFacts"
  | "modelSelectionControl"
  | "allowedLearnerIntents"
  | "feedbackState"
  | "responseControls"
  | "responseStage"
  | "review"
  | "sourceReview"
> &
  Partial<Pick<SemanticActivityFrame, "reviewAvailability">>;
export type C04Field = Readonly<{
  role: string;
  required: boolean;
  acceptedKinds: readonly string[];
  quantityKind?: string;
  unit?: string;
  basis?: string | null;
  options?: readonly Readonly<{ id: string; text: string }>[];
}>;
export type C04Action =
  | "CONTINUE"
  | "PREVIOUS"
  | "CHECK_RESPONSE"
  | "CHECK_AGAIN"
  | "REVISE"
  | "COMMIT_PRIMARY_RESPONSE"
  | "RETURN_TO_PRIMARY"
  | "NEXT_GUIDED_QUESTION"
  | "FINISH_ACTIVITY";
export type C04Presentation = Readonly<{
  apply?:
    | Readonly<{
        original: string | null;
        next: string | null;
        difference: string | null;
        percentage: string | null;
        comparisonScale?: string | null;
      }>
    | undefined;
  responseDraft?: Readonly<Record<string, string>>;
  responseConclusion?: string;
  prepareLegacyDraft?: Readonly<Record<string, string>>;
  prepare?:
    | Readonly<{
        original: string;
        next: string;
        difference: string | null;
        percentage: string | null;
      }>
    | undefined;
  prepareContractId?: string;
  prepareStageIndex?: number;
  prepareRecordedLabels?: readonly Readonly<{ role: string; text: string }>[];
  prepareRecorded?: readonly Readonly<{ role: string; selectionId: string }>[];
  prepareSelections?: Readonly<Record<string, string>>;
  reference?:
    | Readonly<
        Record<
          string,
          Readonly<{
            original: string;
            next: string;
            difference: string | null;
            percentage: string | null;
            relative: string | null;
          }>
        >
      >
    | undefined;
  frame: C04TrackFrame;
  blocked: boolean;
  onIntent: (intent: C04Action) => void;
  onSelect: (selectionId: string) => void;
  fields?: readonly C04Field[];
  draftIdentity?: string;
  selectedGuidedOption?: string;
  presentationIdentity?: string;
  onDraft?: (draft: Readonly<Record<string, string>>) => void;
  onCheckDraft?: (draft: Readonly<Record<string, string>>) => void;
  onPresented?: (kind: "feedback" | "terminal", element: HTMLElement) => void;
  onSupport?: (mode: "REVIEW" | "SOURCE_REVIEW" | "CLOSE") => void;
  canContinueSession?: boolean;
  onContinueSession?: () => void;
  onReturnToLibrary?: () => void;
}>;
