import { expect, it } from "vitest";
import { exploreBeatDuration, projectExploreStory } from "./explore-story";
it("uses sentence-sized durations and reconstructs every seek without learner evidence", () => {
  expect(exploreBeatDuration("Two extra hours.")).toBe(4400);
  expect(exploreBeatDuration(Array(100).fill("word").join(" "))).toBe(8500);
  expect(projectExploreStory(6000, [4400, 6000, 5000])).toMatchObject({
    index: 1,
    progress: 1600 / 6000,
  });
  expect(projectExploreStory(15400, [4400, 6000, 5000])).toMatchObject({
    index: 2,
    progress: 1,
  });
  expect(projectExploreStory(0, [4400, 6000]).progress).toBe(0);
});
it("clamps invalid and oversized seeks including an empty sequence", () => {
  for (const time of [NaN, Infinity, -100])
    expect(projectExploreStory(time, [4400]).position).toBe(0);
  expect(projectExploreStory(1e9, [4400, 6000]).index).toBe(1);
  expect(projectExploreStory(1e9, [])).toMatchObject({
    index: 0,
    position: 0,
    progress: 0,
  });
});
