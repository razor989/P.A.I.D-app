import type { RefObject } from "react";

export { AccessibilityCoordinator } from "./AccessibilityCoordinator";
export type FocusEvent = Readonly<
  { identity: string; target: RefObject<HTMLElement | null> } & (
    | { kind: "destination" | "major-step" | "recovered-activity" }
    | { kind: "invalid-response"; structurallyInvalid: boolean }
    | {
        kind: "post-modal";
        closeCompleted: boolean;
        invokerUnavailable: boolean;
      }
  )
>;
/** Text must already be authorized and visible in the caller's current view. */
export type SafeAnnouncement = Readonly<{
  identity: string;
  text: string;
  visibleSource: RefObject<HTMLElement | null>;
}>;
export type AccessibilityCoordinatorProps = Readonly<{
  event?: FocusEvent | null;
  announcement?: SafeAnnouncement | null;
  blocked?: boolean;
}>;
