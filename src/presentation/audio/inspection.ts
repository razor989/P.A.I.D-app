import { useEffect, useMemo, useRef } from "react";
import type { SoundEngine } from "./engine";
import { useSound } from "./SoundProvider";

/**
 * What an inspection pop-up reports. Opening by hover or focus whispers, a
 * deliberate pin reveals, and the mini-animation inside sounds as it moves:
 * pieces placing one by one, a bar growing, a line drawing.
 */
export type InspectionEvent =
  "open" | "close" | "switch" | "pin" | "piece" | "grow" | "draw";

export type InspectionSound = (
  event: InspectionEvent,
  detail?: Readonly<{ index?: number; delayMs?: number }>,
) => void;

export const silentInspection: InspectionSound = () => {};

export function createInspectionSound(engine: SoundEngine): InspectionSound {
  return (event, detail = {}) => {
    const delay = detail.delayMs ? { delayMs: detail.delayMs } : {};
    switch (event) {
      case "open":
        return engine.play("inspect.open");
      case "close":
        return engine.play("inspect.close");
      case "switch":
        return engine.play("inspect.switch");
      case "pin":
        return engine.play("model.reveal");
      case "piece":
        // Each later piece sits a touch higher: a small rising cascade.
        return engine.play("story.piece", {
          ...delay,
          rate: 1 + Math.min(detail.index ?? 0, 10) * 0.02,
        });
      case "grow":
        return engine.play("story.grow", delay);
      case "draw":
        return engine.play("story.draw", delay);
    }
  };
}

/** The inspection sound for DOM-driven pop-up controllers. */
export function useInspectionSound(): InspectionSound {
  const engine = useSound();
  return useMemo(() => createInspectionSound(engine), [engine]);
}

/**
 * For React-state pop-ups: whispers when the shown part goes from none to
 * one, ticks when it changes to another, and closes when it goes away. A
 * pinned open has already played its reveal; unmounting is silent.
 */
export function useInspectionCues(part: string | null, pinned: boolean) {
  const engine = useSound();
  const shown = useRef(part);
  useEffect(() => {
    const before = shown.current;
    shown.current = part;
    if (before === part) return;
    if (part === null) engine.play("inspect.close");
    else if (!pinned)
      engine.play(before === null ? "inspect.open" : "inspect.switch");
  }, [engine, part, pinned]);
}
