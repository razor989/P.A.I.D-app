import type { projectC06ActivityFrame } from "@/engine/c06-activity-binding/public";
import type { LearnerResponse } from "@/core/public";

export { CommissionMachine } from "./CommissionMachine";
export { PrepareResponse } from "./PrepareResponse";
export { PrepareExperience } from "./PrepareExperience";
export { ExploreExperience } from "./ExploreExperience";
export { ApplyExperience } from "./ApplyExperience";
export { TransferExperience } from "./TransferExperience";

/** Coupled to the authenticated exposure facade; never a copied runtime schema. */
export type C06CommissionProjection = ReturnType<
  typeof projectC06ActivityFrame
>;

export type C06PreparePresentation = Readonly<{
  projection: C06CommissionProjection;
  blocked: boolean;
  onResponse: (response: LearnerResponse) => void;
  onAction: (
    action:
      | "CONTINUE"
      | "PREVIOUS"
      | "REVISE"
      | "CHECK_RESPONSE"
      | "CHECK_AGAIN"
      | "FINISH_ACTIVITY",
  ) => void;
  onSelectWorker: (selectionId: string) => void;
  onHelp: () => void;
  onCloseHelp: () => void;
  /** Only genuinely rendered current feedback/teaching may receive a receipt. */
  onPresented: (kind: "feedback" | "teaching", element: HTMLElement) => void;
  sessionContinuation?: Readonly<{
    available: boolean;
    onContinue: () => void;
  }>;
}>;
