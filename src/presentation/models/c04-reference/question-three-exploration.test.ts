// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  detachQuestionThree,
  mountQuestionThree,
} from "./question-three-exploration";

afterEach(() => document.body.replaceChildren());
function setup(incorrect = false) {
  const host = document.createElement("div");
  document.body.append(host);
  mountQuestionThree(host, incorrect, [], false);
  return host;
}
function choose(host: HTMLElement, id: string) {
  host.querySelector<HTMLButtonElement>(`[data-q3-choice="${id}"]`)!.click();
}
it("withholds additional worked evidence until a choice, with distinct misconception responses", () => {
  const host = setup();
  expect(host.querySelector<HTMLElement>(".q3-pair")!.hidden).toBe(true);
  expect(host.querySelector<HTMLElement>(".q3-insight")!.hidden).toBe(true);
  for (const [choice, text] of [
    ["equal", "Equal pesos describe"],
    ["higher", "A’s higher salary"],
    ["smaller", "That relationship fits"],
  ]) {
    choose(host, choice!);
    expect(host.querySelector("#q3-response")!.textContent).toContain(text);
    expect(document.activeElement).toBe(host.querySelector("#q3-response"));
  }
  expect(host.querySelector<HTMLElement>(".q3-insight")!.hidden).toBe(false);
  expect(
    host.querySelector('[data-employee="A"] .q3-calculation')!.textContent,
  ).toContain("0.10");
  expect(
    host.querySelector('[data-employee="B"] .q3-calculation')!.textContent,
  ).toContain("0.20");
  expect(host.querySelectorAll("svg text")).toHaveLength(0);
  expect(host.querySelector(".q3-share")!.textContent).toContain(
    "different peso amounts",
  );
  detachQuestionThree(host);
});
it("separates help 1 share inspection from help 2 calculation without removing either original", () => {
  const host = setup(true);
  expect(host.querySelector<HTMLElement>(".q3-share")!.hidden).toBe(true);
  mountQuestionThree(host, true, [], false, 1);
  expect(host.querySelector("#q3-help")!.textContent).toContain(
    "Compare the shares",
  );
  expect(host.querySelector<HTMLElement>(".q3-share")!.hidden).toBe(false);
  expect(host.querySelectorAll(".q3-share-match")).toHaveLength(2);
  expect(host.querySelector<HTMLElement>(".q3-calculation")!.hidden).toBe(true);
  choose(host, "equal");
  expect(host.querySelector<HTMLElement>(".q3-calculation")!.hidden).toBe(true);
  mountQuestionThree(host, true, [], false, 2);
  expect(host.querySelector("#q3-help")!.textContent).toContain(
    "Connect each share",
  );
  expect(host.querySelector<HTMLElement>(".q3-calculation")!.hidden).toBe(
    false,
  );
  expect(host.querySelector(".q3-insight")!.textContent).toContain(
    "Both originals remain intact",
  );
  detachQuestionThree(host);
});
it("retains nodes and selection through blocking, resets paths, and detaches listeners", () => {
  const host = setup(),
    model = host.querySelector("svg"),
    control = host.querySelector('[data-q3-choice="smaller"]');
  choose(host, "smaller");
  mountQuestionThree(host, false, [], true);
  choose(host, "equal");
  expect(control!.getAttribute("aria-pressed")).toBe("true");
  expect((control as HTMLButtonElement).disabled).toBe(true);
  mountQuestionThree(host, false, [], false);
  expect(host.querySelector("svg")).toBe(model);
  expect(host.querySelector('[data-q3-choice="smaller"]')).toBe(control);
  mountQuestionThree(host, true, [], false);
  expect(host.querySelector<HTMLElement>(".q3-help")!.hidden).toBe(true);
  detachQuestionThree(host);
  mountQuestionThree(host, false, [], false);
  detachQuestionThree(host);
  choose(host, "smaller");
  expect(host.querySelector<HTMLElement>(".q3-insight")!.hidden).toBe(true);
});
