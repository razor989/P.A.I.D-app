import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Phone "model dock" for a story stage (§H). Presentation only.
 *
 * Narrow stages pin the model under the floating lesson nav (CSS). This hook
 * publishes the dock and playback heights on the stage as `--dock-h` and
 * `--playback-h`, so captions can keep clear of both. When the moment changes
 * and the model is pinned, it scrolls only enough to bring the current
 * caption into the space between the model and the playback bar.
 */
export function useStoryDock(
  stage: RefObject<HTMLElement | null>,
  dockSelector: string,
  moment: number,
  reduced: boolean,
): void {
  useEffect(() => {
    const element = stage.current;
    const dock = element?.querySelector<HTMLElement>(dockSelector);
    const bar = element?.querySelector<HTMLElement>("[data-playback]");
    if (!element || !dock || !bar || typeof ResizeObserver !== "function")
      return;
    const observer = new ResizeObserver(() => {
      element.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
      element.style.setProperty("--playback-h", `${bar.offsetHeight}px`);
    });
    observer.observe(dock);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [stage, dockSelector]);
  const shown = useRef(moment);
  useEffect(() => {
    if (shown.current === moment) return;
    shown.current = moment;
    const element = stage.current;
    const dock = element?.querySelector<HTMLElement>(dockSelector);
    const bar = element?.querySelector<HTMLElement>("[data-playback]");
    const caption = element?.querySelector<HTMLElement>(
      '[data-current="true"]',
    );
    // Only a pinned model (phone dock, or a landscape column) needs this:
    // the dock itself or the nearest ancestor that sticks for it.
    let pinned: HTMLElement | null = dock ?? null;
    while (pinned && pinned !== element) {
      if (getComputedStyle(pinned).position === "sticky") break;
      pinned = pinned.parentElement;
    }
    if (!caption || !pinned || pinned === element) return;
    const box = caption.getBoundingClientRect();
    const model = pinned.getBoundingClientRect();
    const stacked = model.left < box.right && box.left < model.right;
    const top = stacked
      ? model.bottom
      : parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingBlockStart,
        ) || 0;
    const bottom = bar?.getBoundingClientRect().top ?? window.innerHeight;
    if (box.top < top || box.bottom > bottom)
      caption.scrollIntoView?.({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
  }, [stage, dockSelector, moment, reduced]);
}
