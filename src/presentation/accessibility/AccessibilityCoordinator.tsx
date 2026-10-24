import { useEffect, useRef } from "react";
import type { AccessibilityCoordinatorProps } from "./public";
import {
  eventKey,
  hasBlockingModal,
  isEligibleTarget,
  shouldFocus,
} from "./focusPolicy";
import { StatusAnnouncer } from "./StatusAnnouncer";

export function AccessibilityCoordinator({
  event = null,
  announcement = null,
  blocked = false,
}: AccessibilityCoordinatorProps) {
  const previous = useRef<string | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (!event) return;
    const target = event.target.current;
    const permitted = shouldFocus(
      event,
      previous.current,
      !initialized.current,
      blocked,
    );
    // Consume even suppressed transitions: closing a modal must not replay stale focus.
    previous.current = eventKey(event);
    initialized.current = true;
    if (
      permitted &&
      isEligibleTarget(target) &&
      !hasBlockingModal(target.ownerDocument) &&
      (event.kind !== "invalid-response" ||
        target.getAttribute("aria-invalid") === "true")
    ) {
      target.focus();
    }
  }, [event, blocked]);
  return <StatusAnnouncer announcement={announcement} />;
}
