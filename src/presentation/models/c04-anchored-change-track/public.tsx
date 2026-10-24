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
>;
export type C04Presentation = Readonly<{
  frame: C04TrackFrame;
  blocked: boolean;
  onIntent: (intent: "CONTINUE" | "PREVIOUS") => void;
  onSelect: (selectionId: string) => void;
}>;
