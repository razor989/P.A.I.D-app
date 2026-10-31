// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  detachQuestionOne,
  mountQuestionOne,
} from "./question-one-exploration";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function setup(incorrect = false) {
  const host = document.createElement("div");
  document.body.append(host);
  mountQuestionOne(host, incorrect, ["", ""], false);
  if (!incorrect)
    host
      .querySelector<HTMLButtonElement>('[data-q1-reason="difference"]')!
      .click();
  return host;
}
it("retains controls, geometry, focus and mode through a same-feedback update", () => {
  const host = setup(),
    svg = host.querySelector("svg"),
    button = host.querySelector<HTMLButtonElement>('[data-q1-mode="shares"]')!;
  button.click();
  mountQuestionOne(host, false, ["", ""], false);
  expect(host.querySelector("svg")).toBe(svg);
  expect(host.querySelector('[data-q1-mode="shares"]')).toBe(button);
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(host.textContent).toContain("₱2,000 / ₱20,000 = 0.10 = 10%");
  expect(host.textContent).toContain("₱2,000 / ₱10,000 = 0.20 = 20%");
  expect(
    host.querySelectorAll<SVGElement>(".raise-block")[1]!.style.transform,
  ).toBe("scaleX(2)");
  host.querySelector<HTMLButtonElement>('[data-q1-mode="pesos"]')!.click();
  expect(
    host.querySelectorAll<SVGElement>(".raise-block")[1]!.style.transform,
  ).toBe("scaleX(1)");
  detachQuestionOne(host);
});
it("blocks exploration, resets for a different feedback path and ends state on departure", () => {
  const host = setup();
  mountQuestionOne(host, false, ["", ""], true);
  host
    .querySelector<HTMLButtonElement>('[data-q1-mode="shares"]')!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(host.textContent).not.toContain("0.20");
  mountQuestionOne(host, true, ["", ""], false);
  host.querySelector<HTMLButtonElement>('[data-q1-mode="separate"]')!.click();
  expect(host.textContent).toContain("₱12,000 − ₱10,000 = ₱2,000");
  expect(host.textContent).toContain("not lost");
  detachQuestionOne(host);
  mountQuestionOne(host, true, ["", ""], false);
  expect(
    host
      .querySelector('[data-q1-mode="original"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  detachQuestionOne(host);
});
it("withholds explanatory solution until a reasoning attempt and supplies distinct responses", () => {
  const host = document.createElement("div");
  document.body.append(host);
  mountQuestionOne(host, false, [], false);
  expect(host.querySelector<HTMLElement>(".q1-pair")!.hidden).toBe(true);
  for (const [choice, copy] of [
    ["total", "New totals include"],
    ["percentage", "not added pesos"],
    ["difference", "supports your answer"],
  ]) {
    host
      .querySelector<HTMLButtonElement>(`[data-q1-reason="${choice}"]`)!
      .click();
    expect(host.querySelector(".q1-reason-feedback")!.textContent).toContain(
      copy,
    );
  }
  expect(host.querySelector<HTMLElement>(".q1-pair")!.hidden).toBe(false);
  detachQuestionOne(host);
});
it("renders both help steps in the retained wrong-answer model", () => {
  const host = setup(true),
    svg = host.querySelector("svg");
  mountQuestionOne(host, true, [], false, 1);
  expect(host.querySelector("#q1-help")!.textContent).toContain(
    "Inspect only what was added",
  );
  mountQuestionOne(host, true, [], false, 2);
  expect(host.querySelector("#q1-help")!.textContent).toContain(
    "Connect each picture to subtraction",
  );
  expect(host.querySelector("svg")).toBe(svg);
  expect(host.querySelectorAll("svg text")).toHaveLength(0);
  detachQuestionOne(host);
});
it("cancels replaced motion, blocked motion and departure motion", () => {
  const cancel = vi.fn();
  vi.stubGlobal("getComputedStyle", () => ({
    transform: "matrix(1,0,0,1,0,0)",
  }));
  const host = setup();
  host
    .querySelectorAll<SVGElement>(".q1-original,.q1-added,.q1-scale")
    .forEach((element) => {
      element.animate = vi.fn(
        () => ({ cancel, onfinish: null }) as unknown as Animation,
      );
    });
  host.querySelector<HTMLButtonElement>('[data-q1-mode="shares"]')!.click();
  host.querySelector<HTMLButtonElement>('[data-q1-mode="pesos"]')!.click();
  expect(cancel).toHaveBeenCalled();
  cancel.mockClear();
  mountQuestionOne(host, false, ["", ""], true);
  expect(cancel).toHaveBeenCalled();
  mountQuestionOne(host, false, ["", ""], false);
  host.querySelector<HTMLButtonElement>('[data-q1-mode="shares"]')!.click();
  cancel.mockClear();
  detachQuestionOne(host);
  expect(cancel).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
