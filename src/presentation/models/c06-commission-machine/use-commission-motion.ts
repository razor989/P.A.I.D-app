import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** Local C06 adaptation of accepted C03 choreography. Never gates an Actor action. */
export function useWorkRecordMotion(
  surface: RefObject<HTMLElement | null>,
  identity: string,
  blocked: boolean,
) {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (reduced || blocked) return;
    const animations: Animation[] = [];
    surface.current
      ?.querySelectorAll<HTMLElement | SVGElement>("[data-motion]")
      .forEach((element) => {
        const kind = element.dataset.motion;
        const frames =
          kind === "hour"
            ? [
                { transform: "translateY(12px) scale(.94)", opacity: 0 },
                { transform: "none", opacity: 1 },
              ]
            : kind === "emphasis"
              ? [{ transform: "translateX(8px)" }, { transform: "none" }]
              : [{ transform: "translateY(14px)" }, { transform: "none" }];
        const animation = element.animate?.(frames, {
          duration: kind === "hour" ? 340 : 420,
          delay: kind === "hour" ? Number(element.dataset.order ?? 0) * 55 : 0,
          easing: "cubic-bezier(.2,.75,.25,1)",
          fill: "backwards",
        });
        if (animation) animations.push(animation);
      });
    return () => animations.forEach((animation) => animation.cancel());
  }, [surface, identity, reduced, blocked]);
  return reduced;
}
