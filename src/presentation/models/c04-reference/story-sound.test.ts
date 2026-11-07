import { expect, it } from "vitest";
import { storyAccents, type ReferenceCue } from "./story-sound";

function listen() {
  const heard: ReferenceCue[] = [];
  return {
    heard,
    sound: {
      cue: (cue: ReferenceCue) => heard.push(cue),
      inspection: () => {},
    },
  };
}
const accents = storyAccents(
  [
    { at: 2, cue: "story.appear" },
    { at: 6, cue: "story.grow" },
  ],
  5,
  10,
);

it("turns a page per chapter, accents each visual once, and settles at the end", () => {
  const { heard, sound } = listen();
  for (let t = 0; t < 10.2; t += 0.05)
    accents(sound, t, Math.min(10, t + 0.05), false);
  expect(heard).toEqual([
    "story.appear",
    "story.moment",
    "story.grow",
    "story.end",
  ]);
});

it("stays silent going backwards and skips motion when reduced", () => {
  const { heard, sound } = listen();
  accents(sound, 8, 1, false);
  accents(sound, 1, 7, true);
  expect(heard).toEqual(["story.moment", "story.appear"]);
});
