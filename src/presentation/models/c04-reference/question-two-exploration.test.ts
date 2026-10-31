// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  detachQuestionTwo,
  mountQuestionTwo,
} from "./question-two-exploration";

afterEach(() => document.body.replaceChildren());
function setup(incorrect = false) {
  const host = document.createElement("div");
  document.body.append(host);
  mountQuestionTwo(host, incorrect, [], false);
  return host;
}
function choose(host: HTMLElement, id: string) {
  host.querySelector<HTMLButtonElement>(`[data-q2-choice="${id}"]`)!.click();
}
it("conceals worked justification until a reasoning choice and responds to each misconception", () => {
  const host = setup();
  expect(host.querySelector<HTMLElement>(".q2-pair")!.hidden).toBe(true);
  expect(host.querySelector<HTMLElement>(".q2-insight")!.hidden).toBe(true);
  for (const [id, copy] of [
    ["shared", "Equal changes do not"],
    ["new", "New salaries include"],
    ["own", "supports the pair"],
  ] as const) {
    choose(host, id);
    expect(host.querySelector("#q2-response")!.textContent).toContain(copy);
    expect(document.activeElement).toBe(host.querySelector("#q2-response"));
  }
  expect(host.querySelector<HTMLElement>(".q2-pair")!.hidden).toBe(false);
  expect(host.querySelectorAll(".q2-fraction")).toHaveLength(2);
  expect(
    host.querySelector('[data-employee="A"] .q2-ratio')!.textContent,
  ).toContain("₱20,000");
  expect(
    host.querySelector('[data-employee="B"] .q2-ratio')!.textContent,
  ).toContain("₱10,000");
  expect(host.querySelectorAll("svg text")).toHaveLength(0);
  detachQuestionTwo(host);
});
it("distinguishes help steps and keeps graphical reconsideration local", () => {
  const host = setup(true);
  expect(host.querySelector<HTMLElement>(".q2-help")!.hidden).toBe(true);
  mountQuestionTwo(host, true, [], false, 1);
  expect(host.querySelector("#q2-help")!.textContent).toContain(
    "Identify each starting whole",
  );
  expect(host.querySelector<HTMLElement>(".q2-fraction")!.hidden).toBe(true);
  for (const [id, copy] of [
    ["change", "numerator"],
    ["new", "new totals"],
    ["original", "starting wholes"],
  ] as const) {
    choose(host, id);
    expect(
      host.querySelector("#q2-response")!.textContent.toLowerCase(),
    ).toContain(copy);
  }
  mountQuestionTwo(host, true, [], false, 2);
  expect(host.querySelector("#q2-help")!.textContent).toContain(
    "Put each original beneath its change",
  );
  expect(host.querySelector<HTMLElement>(".q2-fraction")!.hidden).toBe(false);
  detachQuestionTwo(host);
});
it("retains nodes and choices across parent updates, blocks interaction and resets on path change or departure", () => {
  const host = setup(),
    model = host.querySelector("svg"),
    button = host.querySelector('[data-q2-choice="own"]');
  choose(host, "own");
  mountQuestionTwo(host, false, [], true);
  choose(host, "new");
  expect(
    host.querySelector('[data-q2-choice="own"]')!.getAttribute("aria-pressed"),
  ).toBe("true");
  mountQuestionTwo(host, false, [], false);
  expect(host.querySelector("svg")).toBe(model);
  expect(host.querySelector('[data-q2-choice="own"]')).toBe(button);
  mountQuestionTwo(host, true, [], false);
  expect(host.querySelector<HTMLElement>(".q2-help")!.hidden).toBe(true);
  detachQuestionTwo(host);
  mountQuestionTwo(host, false, [], false);
  expect(host.querySelector<HTMLElement>(".q2-pair")!.hidden).toBe(true);
  detachQuestionTwo(host);
  choose(host, "own");
  expect(host.querySelector<HTMLElement>(".q2-pair")!.hidden).toBe(true);
});
