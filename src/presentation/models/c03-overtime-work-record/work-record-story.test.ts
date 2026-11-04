import { expect, it } from "vitest";
import { momentDuration, projectWorkRecordStory } from "./work-record-story";
import { placeInspection } from "./work-record-inspection";

it("projects sequential captions and bounded continuous transport", () => {
  expect(projectWorkRecordStory(0)).toMatchObject({ index: 0, cue: 0 });
  expect(projectWorkRecordStory(momentDuration / 3)).toMatchObject({
    index: 0,
    cue: 1,
  });
  expect(projectWorkRecordStory((momentDuration * 2) / 3)).toMatchObject({
    index: 0,
    cue: 2,
  });
  expect(projectWorkRecordStory(momentDuration)).toMatchObject({
    index: 1,
    cue: 0,
  });
  expect(projectWorkRecordStory(Infinity).position).toBe(0);
  expect(projectWorkRecordStory(-100).position).toBe(0);
  expect(projectWorkRecordStory(999999)).toMatchObject({
    position: momentDuration * 3,
    index: 2,
    cue: 2,
  });
});
it("retains accepted C04 collision protection and narrow companion fallback", () => {
  const model = { left: 40, right: 600, top: 200, bottom: 480 };
  const panel = { width: 340, height: 240 };
  const point = { x: 300, y: 300 };
  expect(
    placeInspection(point, model, panel, { width: 1440, height: 1000 })!.x,
  ).toBeGreaterThan(model.right);
  expect(
    placeInspection(point, model, panel, { width: 320, height: 800 }),
  ).toBeNull();
});
