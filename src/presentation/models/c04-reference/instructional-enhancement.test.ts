// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEmployeeExplanation,
  employeeStoryFrame,
} from "./employee-explanation";
import { mountQuestionOne } from "./question-one-exploration";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
function setup() {
  const host = document.createElement("div");
  document.body.append(host);
  const announce = vi.fn();
  const story = createEmployeeExplanation(announce);
  story.mount(host, "", 0, false);
  return { host, story, announce };
}
describe("bounded instructional choreography", () => {
  it("reconstructs directly sought states with accurate fixed geometry and equivalents", () => {
    const { host, story } = setup();
    expect(host.querySelector(".story-added")?.hasAttribute("hidden")).toBe(
      true,
    );
    host.querySelector<HTMLButtonElement>('[data-moment="4"]')!.click();
    const seek = host.querySelector("input")!;
    seek.value = "40";
    seek.dispatchEvent(new Event("input", { bubbles: true }));
    expect(host.textContent).toContain("1/10 = 0.10 = 10/100 = 10%");
    expect(host.querySelectorAll(".story-hundred line")).toHaveLength(9);
    expect(host.querySelectorAll("[data-tenths] line")).toHaveLength(9);
    expect(host.querySelector(".story-share")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(host.querySelector(".original-block")?.getAttribute("width")).toBe(
      "200",
    );
    expect(host.querySelector(".raise-block")?.getAttribute("width")).toBe(
      "20",
    );
    host
      .querySelector<SVGElement>('[data-explore="original"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(host.querySelector(".story-callout")?.textContent).toContain(
      "different comparison",
    );
    story.dispose();
  });
  it("plays actual moments, pauses, seeks, replays and cancels on departure", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const { host, story } = setup();
    host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
    vi.advanceTimersByTime(8500);
    expect(
      host.querySelector(".employee-story")?.getAttribute("data-moment"),
    ).toBe("1");
    host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
    vi.advanceTimersByTime(17000);
    expect(
      host.querySelector(".employee-story")?.getAttribute("data-moment"),
    ).toBe("1");
    const range = host.querySelector("input")!;
    range.value = "51";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(host.textContent).toContain("110% total");
    host.querySelector<HTMLButtonElement>('[data-story="replay"]')!.click();
    expect(host.querySelector(".story-added")?.hasAttribute("hidden")).toBe(
      true,
    );
    story.dispose();
    vi.runAllTimers();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("projects boundaries, intermediate movement and reduced-motion states deterministically", () => {
    expect(employeeStoryFrame(-1).time).toBe(0);
    expect(employeeStoryFrame(Number.NaN).time).toBe(0);
    expect(employeeStoryFrame(99).time).toBe(51);
    for (let chapter = 0; chapter < 6; chapter++) {
      expect(employeeStoryFrame(chapter * 8.5).index).toBe(chapter);
      expect(employeeStoryFrame(chapter * 8.5 + 2.5).cue).toBe(1);
      expect(employeeStoryFrame(chapter * 8.5 + 5.5).cue).toBe(2);
    }
    expect(employeeStoryFrame(17.6).additionX).toBeCloseTo(222);
    expect(employeeStoryFrame(17.6, true).additionX).toBe(208);
    expect(employeeStoryFrame(37.1).hundredProgress).toBeCloseTo(0.5);
    expect(employeeStoryFrame(37.1, true).hundredProgress).toBe(1);
  });
  it("keeps visual and control identity through seek, inspection and parent remount", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const { host, story, announce } = setup();
    const svg = host.querySelector(".story-salary");
    const range = host.querySelector("input")!;
    range.focus();
    range.value = "17.6";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    const sought = host
      .querySelector(".story-added")!
      .getAttribute("transform");
    host.querySelector<HTMLButtonElement>('[data-story="replay"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
    vi.advanceTimersByTime(17600);
    expect(host.querySelector(".story-added")!.getAttribute("transform")).toBe(
      sought,
    );
    const inspect = host.querySelector<HTMLButtonElement>(
      '[data-explore="original"]',
    )!;
    inspect.focus();
    inspect.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(
      host.querySelector(".employee-story")!.getAttribute("data-playing"),
    ).toBe("false");
    const pausedAt = host
      .querySelector(".employee-story")!
      .getAttribute("data-time");
    vi.advanceTimersByTime(1000);
    expect(
      host.querySelector(".employee-story")!.getAttribute("data-time"),
    ).toBe(pausedAt);
    story.mount(host, "", 0, false);
    expect(host.querySelector(".story-salary")).toBe(svg);
    expect(host.querySelector("input")).toBe(range);
    expect(document.activeElement).toBe(inspect);
    inspect.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(host.querySelector<HTMLElement>(".story-callout")!.hidden).toBe(
      true,
    );
    expect(document.activeElement).toBe(inspect);
    expect(announce).toHaveBeenCalled();
    story.dispose();
  });
  it("blocks all local controls and cancels rapid playback on detach", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const { host, story } = setup();
    for (let i = 0; i < 9; i++)
      host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
    expect(vi.getTimerCount()).toBe(1);
    story.mount(host, "", 0, true);
    expect(vi.getTimerCount()).toBe(0);
    expect(
      [
        ...host.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
          "button,input",
        ),
      ].every((control) => control.disabled),
    ).toBe(true);
    story.mount(host, "", 0, false);
    host.querySelector<HTMLButtonElement>('[data-story="play"]')!.click();
    story.detach();
    expect(vi.getTimerCount()).toBe(0);
    story.dispose();
  });
  it("compares peso scale and reference shares without assessment callbacks", () => {
    const host = document.createElement("div");
    document.body.append(host);
    mountQuestionOne(host, false, ["", ""], false);
    host.querySelector<HTMLButtonElement>('[data-q1-mode="shares"]')!.click();
    expect(host.textContent).toContain("₱2,000 / ₱10,000 = 0.20 = 20%");
    expect(
      host.querySelectorAll<SVGElement>(".raise-block")[1]?.style.transform,
    ).toBe("scaleX(2)");
    mountQuestionOne(host, true, ["", ""], false);
    host.querySelector<HTMLButtonElement>('[data-q1-mode="separate"]')!.click();
    expect(host.textContent).toContain("₱12,000 − ₱10,000 = ₱2,000");
    expect(
      host.querySelectorAll(".raise-block")[1]?.getAttribute("width"),
    ).toBe("20");
  });
});
