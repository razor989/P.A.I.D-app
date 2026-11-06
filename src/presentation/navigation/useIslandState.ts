import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** Presentation-only state of the floating lesson navigation. It never feeds
 * Session, history or progress; it only decides how the controls are shown. */
export type IslandMode = "expanded" | "compact";

/** Scroll travel in one direction before the island changes shape. */
export const SCROLL_THRESHOLD = 24;
/** Quiet period after a change, so a jittery scroll cannot oscillate. */
export const CHANGE_LOCKOUT = 250;
/** Unused compact island becomes semi-transparent after this long. */
export const IDLE_DELAY = 2000;
/** After entering a lesson, scrolling is the app's or the browser's (scroll
 * restoration, reset to the top), not the learner's: it never changes shape. */
export const ENTRY_SETTLE = 700;
/** Scrolling counts as the learner's only shortly after their own scroll
 * input; programmatic scrolling (focus, scrollIntoView, restoration) does not
 * change the navigation's shape. */
export const INTENT_WINDOW = 600;

const scrollKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

const textEntry =
  'input:not([type="button"],[type="checkbox"],[type="radio"],[type="range"],[type="submit"],[type="reset"]), textarea, select, [contenteditable="true"]';

export function useIslandState(
  root: RefObject<HTMLElement | null>,
  /** Changing this (a new lesson) presents the expanded navigation again. */
  resetKey: string,
) {
  const [mode, setModeState] = useState<IslandMode>("expanded");
  const [idle, setIdle] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const modeRef = useRef<IslandMode>("expanded");
  const hover = useRef(false);
  const press = useRef(false);
  const lockUntil = useRef(0);
  const lastY = useRef(0);
  const travel = useRef(0);
  const reveal = useRef<"none" | "focus">("none");

  const setMode = useCallback((next: IslandMode) => {
    if (modeRef.current === next) return;
    modeRef.current = next;
    lockUntil.current = performance.now() + CHANGE_LOCKOUT;
    setModeState(next);
    if (next === "expanded") setIdle(false);
  }, []);

  /** A focused control, a hovered or pressed island never changes under the
   * learner because the page moved. */
  const held = useCallback(() => {
    const element = root.current;
    return (
      hover.current ||
      press.current ||
      (!!element && element.contains(document.activeElement))
    );
  }, [root]);

  const syncEngaged = useCallback(() => {
    const element = root.current;
    const now =
      hover.current ||
      press.current ||
      (!!element && element.contains(document.activeElement));
    setEngaged(now);
    if (now) setIdle(false);
  }, [root]);

  // New lesson: expanded and discoverable again.
  useEffect(() => {
    modeRef.current = "expanded";
    setModeState("expanded");
    setIdle(false);
    lastY.current = window.scrollY;
    travel.current = 0;
    lockUntil.current = performance.now() + ENTRY_SETTLE;
  }, [resetKey]);

  // Scroll direction, accumulated and thresholded, read once per frame.
  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;
    let intentAt = -Infinity;
    let dragging = false;
    const intent = () => {
      intentAt = performance.now();
    };
    const onKey = (event: KeyboardEvent) => {
      if (scrollKeys.has(event.key)) intent();
    };
    // A press on the page's own scrollbar targets the root element.
    const onDown = (event: PointerEvent) => {
      if (event.target === document.documentElement) dragging = true;
    };
    const onUp = () => {
      dragging = false;
    };
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const max =
        (document.scrollingElement ?? document.documentElement).scrollHeight -
        window.innerHeight;
      setScrolled(y > 8);
      const delta = y - lastY.current;
      lastY.current = y;
      // Ignore overscroll bounce at either end of the page.
      if (y < 0 || y > max + 1 || delta === 0) return;
      const now = performance.now();
      if (!dragging && now - intentAt > INTENT_WINDOW) {
        travel.current = 0;
        return;
      }
      if (now < lockUntil.current) {
        travel.current = 0;
        return;
      }
      const sum =
        Math.sign(delta) === Math.sign(travel.current)
          ? travel.current + delta
          : delta;
      travel.current = sum;
      if (sum >= SCROLL_THRESHOLD && modeRef.current === "compact") {
        travel.current = 0;
        setMode("expanded");
      } else if (
        sum <= -SCROLL_THRESHOLD &&
        modeRef.current === "expanded" &&
        !held()
      ) {
        travel.current = 0;
        setMode("compact");
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const passive = { passive: true } as const;
    window.addEventListener("scroll", onScroll, passive);
    window.addEventListener("wheel", intent, passive);
    window.addEventListener("touchmove", intent, passive);
    window.addEventListener("keydown", onKey, passive);
    window.addEventListener("pointerdown", onDown, passive);
    window.addEventListener("pointerup", onUp, passive);
    window.addEventListener("pointercancel", onUp, passive);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", intent);
      window.removeEventListener("touchmove", intent);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [held, setMode]);

  // Protect lesson inputs: typing, an on-screen keyboard, or keyboard focus
  // landing beneath the expanded navigation tucks it away.
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const element = root.current;
      const target = event.target;
      if (!element || !(target instanceof Element) || element.contains(target))
        return;
      if (modeRef.current !== "expanded") return;
      if (target.closest('[role="dialog"], [data-paid-transition]')) return;
      // Programmatic focus (headings, tabindex -1) is not the learner moving
      // to a control, and never hides the navigation at lesson entry.
      const control = target.matches(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const box = target.getBoundingClientRect();
      const nav = element.getBoundingClientRect();
      const under = control && box.top < nav.bottom && box.bottom > nav.top;
      if (target.matches(textEntry) || under) setMode("compact");
    };
    const viewport = window.visualViewport;
    const onViewport = () => {
      if (viewport && viewport.height < window.innerHeight * 0.75)
        setMode("compact");
    };
    document.addEventListener("focusin", onFocusIn);
    viewport?.addEventListener("resize", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      viewport?.removeEventListener("resize", onViewport);
    };
  }, [root, setMode]);

  // Idle transparency applies only to an unused compact island.
  useEffect(() => {
    if (mode !== "compact" || engaged) return;
    const timer = window.setTimeout(() => setIdle(true), IDLE_DELAY);
    return () => window.clearTimeout(timer);
  }, [mode, engaged]);

  // Engagement (hover, focus, press) restores full prominence at once.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hover.current = true;
      syncEngaged();
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hover.current = false;
      syncEngaged();
    };
    const down = () => {
      press.current = true;
      syncEngaged();
    };
    const up = () => {
      if (!press.current) return;
      press.current = false;
      syncEngaged();
    };
    const focus = () => queueMicrotask(syncEngaged);
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("pointerdown", down);
    element.addEventListener("focusin", focus);
    element.addEventListener("focusout", focus);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("focusin", focus);
      element.removeEventListener("focusout", focus);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [root, syncEngaged]);

  /** Activating the compact island opens the full navigation. */
  const open = useCallback(() => {
    reveal.current = "focus";
    setMode("expanded");
  }, [setMode]);
  /** Escape from the expanded navigation returns to the island. */
  const close = useCallback(() => setMode("compact"), [setMode]);
  /** Consumed by the component after an open, to place focus once. */
  const takeReveal = useCallback(() => {
    const value = reveal.current;
    reveal.current = "none";
    return value === "focus";
  }, []);

  return {
    mode,
    idle: mode === "compact" && idle,
    scrolled,
    open,
    close,
    takeReveal,
  };
}
