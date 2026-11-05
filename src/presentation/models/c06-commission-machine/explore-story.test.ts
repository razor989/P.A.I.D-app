import { describe, expect, it } from "vitest";
import {
  exploreChapters,
  exploreMoment,
  exploreDuration,
} from "./explore-story";

describe("A02 presentation-only explanation moments", () => {
  it("holds complete thoughts for reading and inspection, with length-based timing", () => {
    const texts = [
      "One two three",
      "A longer explanation ".repeat(10),
      "Eight nine",
    ];
    const first = exploreDuration(texts[0]!);
    expect(first).toBeGreaterThanOrEqual(8000);
    expect(exploreDuration(texts[1]!)).toBeGreaterThanOrEqual(12000);
    expect(exploreDuration(texts[1]!)).toBeGreaterThan(first);
    expect(exploreMoment(first / 2, texts)).toMatchObject({
      cue: 0,
      progress: 0.5,
    });
    expect(exploreMoment(first, texts)).toMatchObject({ cue: 1, progress: 0 });
    expect(exploreMoment(99999, texts)).toMatchObject({ cue: 2, progress: 1 });
  });
  it("keeps the six canonical purposes and three developed moments per purpose", () => {
    expect(exploreChapters).toHaveLength(6);
    for (const chapter of exploreChapters) {
      expect(chapter.moments).toHaveLength(3);
      for (const [title, passage] of chapter.moments) {
        expect(title.length).toBeGreaterThan(5);
        expect(passage.length).toBeGreaterThan(90);
      }
    }
  });
  it.each([
    [-100, 0, 0],
    [0, 0, 0],
    [7999, 7999, 0],
    [8000, 8000, 1],
    [16000, 16000, 2],
    [99999, 24000, 2],
    [Number.NaN, 0, 0],
    [Number.POSITIVE_INFINITY, 0, 0],
  ])("clamps time %s to %s in moment %s", (time, position, cue) => {
    expect(exploreMoment(time)).toMatchObject({ position, cue });
  });
});
