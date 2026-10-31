// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { placeExploration } from "./employee-exploration";
import {
  createEmployeeExplanation,
  employeeStoryFrame,
} from "./employee-explanation";
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
it("places outside the protected model or chooses the companion area", () => {
  const model = { left: 40, right: 600, top: 200, bottom: 480 };
  const panel = { width: 360, height: 430 };
  const placed = placeExploration({ x: 300, y: 300 }, model, panel, {
    width: 1440,
    height: 1000,
  });
  expect(placed!.x).toBeGreaterThan(model.right);
  expect(
    placeExploration({ x: 300, y: 300 }, model, panel, {
      width: 320,
      height: 800,
    }),
  ).toBeNull();
  expect(
    placeExploration({ x: 300, y: 300 }, model, panel, {
      width: 740,
      height: 500,
    }),
  ).toBeNull();
});
it("projects intermediate entrances without replay and settles reduced motion", () => {
  expect(employeeStoryFrame(0.4).captionProgress[0]).toBeCloseTo(0.5);
  expect(employeeStoryFrame(0.4).equationProgress).toBeCloseTo(0.5);
  expect(employeeStoryFrame(0.4, true).captionProgress[0]).toBe(1);
  expect(employeeStoryFrame(19.9).totalProgress).toBeCloseTo(0.5);
});
it("offers direct phrase and graphic exploration, pins with Space and cleans timers", () => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "performance",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  const host = document.createElement("div");
  document.body.append(host);
  const story = createEmployeeExplanation(vi.fn());
  story.mount(host, "", 0, false);
  expect(host.querySelector('[data-inspect],[data-story="match"]')).toBeNull();
  const phrase = host.querySelector<HTMLElement>(".story-caption strong")!;
  expect(phrase.dataset.explore).toBe("original");
  phrase.focus();
  const panel = host.querySelector<HTMLElement>(".story-callout")!;
  expect(panel.hidden).toBe(false);
  expect(panel.querySelector("svg")).not.toBeNull();
  phrase.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true }),
  );
  phrase.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(panel.hidden).toBe(true);
  expect(document.activeElement).toBe(phrase);
  story.dispose();
  vi.runAllTimers();
  expect(vi.getTimerCount()).toBe(0);
});
