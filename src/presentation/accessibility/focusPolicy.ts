import type { FocusEvent } from "./public";

export const MAX_STATUS_LENGTH = 280;

export function eventKey(event: FocusEvent): string {
  return JSON.stringify([event.kind, event.identity]);
}

/** Pure semantic decision; DOM eligibility is checked at the point of focus. */
export function shouldFocus(
  event: FocusEvent,
  previousKey: string | null,
  initial: boolean,
  blocked: boolean,
): boolean {
  if (!event.identity || blocked || eventKey(event) === previousKey)
    return false;
  if (event.kind === "destination" && initial) return false;
  if (event.kind === "invalid-response") return event.structurallyInvalid;
  if (event.kind === "post-modal")
    return event.closeCompleted && event.invokerUnavailable;
  return true;
}

export function isEligibleTarget(
  target: HTMLElement | null,
): target is HTMLElement {
  if (!target?.isConnected || target.tabIndex > 0) return false;
  if (target.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  if (target.matches(":disabled, [aria-disabled=true]")) return false;
  const style = target.ownerDocument.defaultView?.getComputedStyle(target);
  return (
    target.getClientRects().length > 0 &&
    style?.visibility !== "hidden" &&
    style?.visibility !== "collapse" &&
    style?.display !== "none"
  );
}

export function hasBlockingModal(document: Document): boolean {
  // Native modal containment belongs exclusively to T041.
  return document.querySelector("dialog:modal") !== null;
}
