import { expect, it } from "vitest";
import { momentDuration, projectPrepareStory } from "./prepare-v3-story";

it("seeks deterministically in either direction and clamps before-check explanation", () => {
  for (const checked of [false, true]) {
    for (const time of [
      -1,
      0,
      1,
      4499,
      4500,
      9000,
      13500,
      18000,
      22500,
      27000,
      Infinity,
      NaN,
    ]) {
      const first = projectPrepareStory(time, checked);
      projectPrepareStory(100000, checked);
      expect(projectPrepareStory(time, checked)).toEqual(first);
      if (!checked) {
        expect(first.index).toBeLessThan(4);
        expect(
          first.showDifference || first.showReference || first.showPercentage,
        ).toBe(false);
        expect(first.moment.caption).not.toMatch(
          /0%|zero difference|did not change/i,
        );
      }
    }
  }
  expect(projectPrepareStory(6 * momentDuration, true).showPercentage).toBe(
    true,
  );
  expect(projectPrepareStory(0, true).showNew).toBe(false);
});
