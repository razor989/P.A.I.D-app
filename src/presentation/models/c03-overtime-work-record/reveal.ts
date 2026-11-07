/**
 * Lesson scroll rule for a new state (§K4.1–4.2). Presentation only.
 *
 * The root's scroll-padding already equals the floating lesson nav's height
 * (`--lesson-nav-scroll`, owned by the shell), so `scrollIntoView` lands an
 * element just below the nav, never under it. Nothing moves when the target
 * is already comfortably in view.
 */
function navOffset() {
  return (
    parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingBlockStart,
    ) || 0
  );
}

function behavior(reduced: boolean): ScrollBehavior {
  return reduced ? "auto" : "smooth";
}

/** Focus a new state's heading and bring it to the top of the lesson view. */
export function revealHeading(
  heading: HTMLElement | null,
  reduced: boolean,
): void {
  if (!heading) return;
  heading.focus({ preventScroll: true });
  const top = heading.getBoundingClientRect().top;
  const offset = navOffset();
  if (top < offset || top > offset + window.innerHeight * 0.3)
    heading.scrollIntoView?.({ block: "start", behavior: behavior(reduced) });
}

/** Make newly shown feedback visible without taking it to the top. */
export function revealFeedback(
  element: HTMLElement | null,
  reduced: boolean,
): void {
  if (!element) return;
  const box = element.getBoundingClientRect();
  if (box.top < navOffset() || box.bottom > window.innerHeight)
    element.scrollIntoView?.({
      block:
        box.height > window.innerHeight - navOffset() ? "start" : "nearest",
      behavior: behavior(reduced),
    });
}
