import type { InspectionSound } from "../../audio/public";

/** Presentation sound moments the reference renderer and its explanations
 * report; they never play audio themselves. */
export type ReferenceCue =
  | "model.select"
  | "model.step"
  | "ui.toggle.on"
  | "ui.toggle.off"
  | "story.moment"
  | "story.end"
  | "story.grow"
  | "story.appear"
  | "story.stamp"
  | "story.draw"
  | "story.piece";

export type ReferenceSound = Readonly<{
  cue: (name: ReferenceCue) => void;
  inspection: InspectionSound;
}>;

export const silentReference: ReferenceSound = Object.freeze({
  cue: () => {},
  inspection: () => {},
});

type Accent = Readonly<{ at: number; cue: ReferenceCue; motion?: boolean }>;

const MOTION: ReadonlySet<ReferenceCue> = new Set([
  "story.grow",
  "story.draw",
  "story.piece",
]);

/**
 * Sounds for an explanation that plays by itself, in seconds: a page turn as
 * each chapter begins, an accent as playback passes each visual event, and a
 * settle at the end. Called only from the playback clock, so seeking,
 * stepping and pausing are silent here.
 */
export function storyAccents(
  accents: readonly Accent[],
  chapterDuration: number,
  end: number,
) {
  return (
    sound: ReferenceSound,
    previous: number,
    current: number,
    reduced: boolean,
  ) => {
    if (current <= previous) return;
    if (
      current < end &&
      Math.floor(current / chapterDuration) >
        Math.floor(previous / chapterDuration)
    )
      sound.cue("story.moment");
    for (const accent of accents) {
      if (accent.at <= previous || accent.at > current) continue;
      if (reduced && (accent.motion ?? MOTION.has(accent.cue))) continue;
      sound.cue(accent.cue);
    }
    if (current >= end && previous < end) sound.cue("story.end");
  };
}
