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
  // Measured from layout, not the painted box: entrance motion may still be
  // translating the heading, and the scroll must land where it settles.
  const top = layoutTop(heading) - window.scrollY;
  const offset = navOffset();
  if (top < offset || top > offset + window.innerHeight * 0.3)
    window.scrollTo?.({
      top: Math.max(0, window.scrollY + top - offset),
      behavior: behavior(reduced),
    });
}

/** Document position of an element, ignoring any CSS transforms. */
function layoutTop(element: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

/** Make newly shown feedback visible without taking it to the top. */
export function revealFeedback(
  element: HTMLElement | null,
  reduced: boolean,
  focus: "outcome" | "if-lost" = "if-lost",
): void {
  if (!element) return;
  // An outcome takes focus at its heading: the control that produced it is
  // about to be replaced or disabled. Inline feedback only catches focus that
  // would otherwise fall to the page body.
  const active = document.activeElement;
  if (focus === "outcome" || !active || active === document.body) {
    const title = element.querySelector<HTMLElement>("h2, h3, h4");
    if (title) {
      if (!title.hasAttribute("tabindex")) title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
  const box = element.getBoundingClientRect();
  if (box.top < navOffset() || box.bottom > window.innerHeight)
    element.scrollIntoView?.({
      block:
        box.height > window.innerHeight - navOffset() ? "start" : "nearest",
      behavior: behavior(reduced),
    });
}
