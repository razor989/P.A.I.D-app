import { useCallback, useEffect, useState } from "react";

export const SLIDE_INTERVAL_MS = 8000;

/** Presentation-only slideshow state. Never persisted, never sent to Session.
 *
 * - Autoplay advances every `SLIDE_INTERVAL_MS` while `playing`.
 * - A mouse over the hero's controls, or focus on a control other than
 *   Play/Pause, holds the timer (`held`). Touch never holds it.
 * - Any manual navigation stops autoplay; only the Play control restarts it,
 *   so a learner's choice is never overridden by a later automatic advance.
 */
export function useSlideshow(
  count: number,
  /** External hold, e.g. while Session navigation is blocked. */
  suspended = false,
  interval = SLIDE_INTERVAL_MS,
) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = hovered || focused || suspended;

  useEffect(() => {
    if (!playing || held || count < 2) return;
    const timer = window.setTimeout(() => {
      setDirection("forward");
      setIndex((i) => (i + 1) % count);
    }, interval);
    return () => window.clearTimeout(timer);
  }, [playing, held, index, count, interval]);

  const goTo = useCallback(
    (next: number) => {
      const target = ((next % count) + count) % count;
      if (target !== index)
        setDirection(
          index === count - 1 && target === 0
            ? "forward"
            : index === 0 && target === count - 1
              ? "backward"
              : target > index
                ? "forward"
                : "backward",
        );
      setIndex(target);
      setPlaying(false);
    },
    [count, index],
  );

  return {
    index: Math.min(index, Math.max(count - 1, 0)),
    direction,
    playing,
    held,
    next: () => goTo(index + 1),
    previous: () => goTo(index - 1),
    goTo,
    // Pressing Play always resumes rotation, even though focus (and the
    // pointer) are still on the control: the learner asked for it explicitly.
    togglePlaying: () => {
      if (!playing) {
        setFocused(false);
        setHovered(false);
      }
      setPlaying(!playing);
    },
    setHovered,
    setFocused,
  };
}
