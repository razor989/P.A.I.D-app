import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function media() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : null;
}

function subscribe(change: () => void) {
  const list = media();
  list?.addEventListener("change", change);
  return () => list?.removeEventListener("change", change);
}

/**
 * The learner's reduced-motion preference, kept current when it changes.
 * One shared reading for lesson presentation: motion may only decorate a
 * state that is already shown, so `true` means "show the end state now".
 * Environments without matchMedia (tests, some WebViews) report `false`.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  );
}
