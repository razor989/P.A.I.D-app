import { useRef } from "react";
import type { PointerEvent } from "react";

/**
 * Hover intent for inspection triggers (§K4.3). A panel opens only after a
 * real pointer movement over the trigger: a new screen that lands under a
 * resting cursor (after a click) must not open one. Touch never hovers.
 */
export function useHoverIntent(
  onIntent: (target: HTMLElement) => void,
  onLeave: () => void,
) {
  const hovered = useRef(false);
  return {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (
        event.pointerType === "touch" ||
        hovered.current ||
        (event.movementX === 0 && event.movementY === 0)
      )
        return;
      hovered.current = true;
      onIntent(event.currentTarget);
    },
    onPointerLeave() {
      hovered.current = false;
      onLeave();
    },
  };
}
