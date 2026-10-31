// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  comparisonFrame,
  createComparisonExplanation,
} from "./comparison-explanation";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it("projects both scales with constant relative shares, reversible seeks, and no changed salary", () => {
  for (const start of [0, 2.5, 5.5, 8.5, 11, 14]) {
    const initial = comparisonFrame(start),
      middle = comparisonFrame(start + 0.325),
      settled = comparisonFrame(start + 0.65);
    expect(initial.entrances[initial.cue]).toBe(0);
    expect(middle.entrances[middle.cue]).toBeCloseTo(0.5);
    expect(settled.entrances[settled.cue]).toBeCloseTo(1);
    expect(comparisonFrame(start, true).entrances).toEqual([1, 1, 1]);
  }
  for (const time of [0, 17, 25.5, 26.2, 26.9, 34, 50, 51]) {
    const f = comparisonFrame(time);
    expect(f.bAddition / f.bOriginal).toBeCloseTo(0.2);
  }
  expect(comparisonFrame(0).bOriginal).toBe(100);
  expect(comparisonFrame(26.2).bOriginal).toBeCloseTo(150);
  expect(comparisonFrame(27).bOriginal).toBe(200);
  expect(comparisonFrame(26.2, true).bOriginal).toBe(200);
  expect(comparisonFrame(50, false, "pesos").bAddition).toBe(20);
  expect(comparisonFrame(0, false, "percent").bAddition).toBe(40);
});
function setup() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const host = document.createElement("div");
  document.body.append(host);
  const announce = vi.fn(),
    story = createComparisonExplanation(announce);
  story.mount(host, ["", ""], 0, false);
  const seek = (time: number) => {
    const range = host.querySelector<HTMLInputElement>("input")!;
    range.value = String(time);
    range.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return { host, story, announce, seek };
}
it("keeps equal peso additions and intact 100-part originals with automatic outline copies", () => {
  const { host, story, seek } = setup();
  const width = (employee: string, selector: string) =>
    host
      .querySelector(`[data-comparison-employee="${employee}"] ${selector}`)
      ?.getAttribute("width");
  expect(width("A", ".story-original")).toBe("200");
  expect(width("B", ".story-original")).toBe("100");
  expect(width("A", ".raise-block")).toBe("20");
  expect(width("B", ".raise-block")).toBe("20");
  expect(host.textContent).not.toContain("Same addition:");
  expect(host.textContent).not.toContain("new salary");
  expect(
    host.querySelector(".story-salary")?.getAttribute("aria-label"),
  ).toContain("new salary ₱22,000");
  expect(host.querySelectorAll(".comparison-added-label")).toHaveLength(2);
  expect(
    host.querySelector('[data-label-employee="B"]')?.getAttribute("style"),
  ).toContain("--original-width: 37.878");
  expect(host.querySelectorAll("[data-match]:not([hidden])")).toHaveLength(0);
  seek(20);
  expect(host.querySelectorAll("[data-match]:not([hidden])")).toHaveLength(2);
  seek(40);
  expect(width("B", ".story-original")).toBe("200");
  expect(width("B", ".raise-block")).toBe("40");
  expect(
    host.querySelector<HTMLElement>(
      '[data-label-employee="B"] [data-whole-percent]',
    )?.hidden,
  ).toBe(false);
  expect(
    host
      .querySelector('[data-comparison-employee="B"] [data-original-bracket]')
      ?.getAttribute("d"),
  ).toBe("M4 69v5h200v-5");
  expect(
    host.querySelectorAll(
      '[data-comparison-employee="A"] [data-divisions] path',
    ),
  ).toHaveLength(9);
  expect(
    host.querySelectorAll('[data-comparison-employee="A"] [data-hundred] path'),
  ).toHaveLength(9);
  expect(
    host.querySelectorAll(
      '[data-comparison-employee="B"] [data-divisions] path',
    ),
  ).toHaveLength(4);
  expect(
    host.querySelectorAll('[data-comparison-employee="B"] [data-hundred] path'),
  ).toHaveLength(19);
  host.querySelector<HTMLButtonElement>('[data-scale="pesos"]')!.click();
  expect(width("B", ".story-original")).toBe("100");
  expect(width("B", ".raise-block")).toBe("20");
  expect(host.querySelector("[data-scale-caption]")?.textContent).toContain(
    "equal width",
  );
  seek(0);
  expect(width("B", ".story-original")).toBe("100");
  story.dispose();
  expect(host.children).toHaveLength(0);
});
it("retains identity, pauses exploration, restores focus, blocks and cancels all local work", () => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "performance",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  const { host, story } = setup();
  const svg = host.querySelector("svg.story-salary"),
    range = host.querySelector("input");
  const original = host.querySelector<SVGElement>('[data-explore="original"]')!;
  original.focus();
  original.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  expect(host.querySelector<HTMLElement>(".story-callout")!.hidden).toBe(false);
  expect(host.querySelector(".mini-equation")!.textContent).toContain(
    "₱20,000 = 100%",
  );
  original.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(document.activeElement).toBe(original);
  story.mount(host, ["", ""], 0, false);
  expect(host.querySelector("svg.story-salary")).toBe(svg);
  expect(host.querySelector("input")).toBe(range);
  host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  story.mount(host, ["", ""], 0, true);
  vi.advanceTimersByTime(500);
  expect(vi.getTimerCount()).toBe(0);
  expect(
    [
      ...host.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        "button,input",
      ),
    ].every((c) => c.disabled),
  ).toBe(true);
  original.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(host.querySelector<HTMLElement>(".story-callout")!.hidden).toBe(true);
  story.mount(host, ["", ""], 1, false);
  expect(host.querySelector(".employee-story")?.getAttribute("data-time")).toBe(
    "25.500",
  );
  story.detach();
  expect(vi.getTimerCount()).toBe(0);
  expect(host.children).toHaveLength(0);
  story.dispose();
});
