// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createFormulaExplanation, formulaFrame } from "./formula-explanation";
import { formulaChapters } from "./formula-content";
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it("projects every cue independently and preserves the percentage equality distinction", () => {
  for (const start of [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44]) {
    const initial = formulaFrame(start),
      middle = formulaFrame(start + 0.4),
      settled = formulaFrame(start + 0.8);
    expect(initial.entrances[initial.cue]).toBe(0);
    expect(middle.entrances[middle.cue]).toBeCloseTo(0.5);
    expect(settled.entrances[settled.cue]).toBeCloseTo(1);
    expect(formulaFrame(start, true).entrances).toEqual([1, 1, 1]);
  }
  expect(formulaFrame(NaN).time).toBe(0);
  expect(formulaFrame(100).time).toBe(48);
  expect(formulaFrame(-1).time).toBe(0);
  expect(formulaChapters[2].equations).toContain("0.10 × 100 = 10; report 10%");
  expect(formulaChapters[2].equations).toContain("0.10 × 100% = 10%");
  for (const chapter of formulaChapters)
    chapter.captions.forEach((text, i) =>
      expect(text).toContain(chapter.emphasis[i]),
    );
});
function setup(reduced = true) {
  const motion = {
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => motion);
  const host = document.createElement("div");
  document.body.append(host);
  const announce = vi.fn(),
    story = createFormulaExplanation(announce);
  story.mount(host, "", 0, false);
  const seek = (time: number) => {
    const input = host.querySelector<HTMLInputElement>("input")!;
    input.value = String(time);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return { host, story, seek, announce, motion };
}
it("builds from an intact original, keeps the new total separate and reconstructs earlier states", () => {
  const { host, story, seek } = setup();
  expect(
    host.querySelector<HTMLElement>("[data-formula-denominator]")!.hidden,
  ).toBe(true);
  expect(
    host.querySelector<HTMLElement>("[data-formula-multiply]")!.hidden,
  ).toBe(true);
  seek(20);
  expect(
    host.querySelector<HTMLElement>("[data-formula-denominator]")!.hidden,
  ).toBe(false);
  expect(host.querySelector<HTMLElement>("[data-formula-b]")!.hidden).toBe(
    false,
  );
  expect(host.querySelector(".story-original")!.getAttribute("width")).toBe(
    "200",
  );
  expect(host.querySelectorAll("[data-formula-divisions] path")).toHaveLength(
    9,
  );
  seek(24);
  expect(host.querySelectorAll("[data-formula-hundred] path")).toHaveLength(9);
  expect(
    host.querySelector<HTMLElement>("[data-formula-percent]")!.hidden,
  ).toBe(false);
  expect(
    host.querySelector("[data-formula-model-note]")!.textContent,
  ).toContain("New total: 110%");
  seek(44);
  expect(host.querySelector("[data-equation]")!.textContent).toContain(
    "undefined",
  );
  seek(0);
  expect(host.querySelectorAll("[data-formula-divisions] path")).toHaveLength(
    0,
  );
  expect(
    host.querySelector("[data-formula-copy]")!.hasAttribute("hidden"),
  ).toBe(true);
  story.dispose();
  expect(host.children).toHaveLength(0);
});
it("retains identity, pauses on inspection, restores focus, blocks and cleans up all local work", () => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "performance",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  const removeListener = vi.spyOn(document, "removeEventListener");
  const { host, story, seek, motion } = setup(false),
    svg = host.querySelector(".story-salary"),
    range = host.querySelector("input");
  // Seek covers absolute-time reconstruction above. Exercise real scheduled
  // playback across the chapter boundary without redrawing 248 jsdom frames.
  seek(11.9);
  host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(500);
  expect(host.querySelector(".formula-story")!.getAttribute("data-time")).toBe(
    "12.400",
  );
  const original = host.querySelector<SVGElement>(
    'svg [data-explore="original"]',
  )!;
  original.focus();
  original.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  expect(host.querySelector<HTMLElement>(".story-callout")!.hidden).toBe(false);
  expect(
    host.querySelector(".formula-story")!.getAttribute("data-playing"),
  ).toBe("false");
  original.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(document.activeElement).toBe(original);
  story.mount(host, "", 0, false);
  expect(host.querySelector(".story-salary")).toBe(svg);
  expect(host.querySelector("input")).toBe(range);
  host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
  story.mount(host, "", 0, true);
  vi.advanceTimersByTime(500);
  expect(vi.getTimerCount()).toBe(0);
  expect(
    [
      ...host.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        "button,input",
      ),
    ].every((e) => e.disabled),
  ).toBe(true);
  original.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(host.querySelector<HTMLElement>(".story-callout")!.hidden).toBe(true);
  story.mount(host, "", 2, false);
  expect(host.querySelector(".formula-story")!.getAttribute("data-time")).toBe(
    "24.000",
  );
  story.detach();
  expect(vi.getTimerCount()).toBe(0);
  expect(host.children).toHaveLength(0);
  expect(motion.removeEventListener).toHaveBeenCalledWith(
    "change",
    expect.any(Function),
  );
  expect(removeListener).toHaveBeenCalledWith(
    "visibilitychange",
    expect.any(Function),
  );
  story.dispose();
  original.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  window.dispatchEvent(new Event("resize"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(vi.getTimerCount()).toBe(0);
  expect(host.children).toHaveLength(0);
});
