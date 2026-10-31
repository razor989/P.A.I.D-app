// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createEmployeeExplanation } from "./employee-explanation";
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
it("keeps B's five-part whole on A's peso scale and subdivides it without resizing", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const story = createEmployeeExplanation(vi.fn(), "B");
  story.mount(host, "", 0, false);
  const seek = (time: number) => {
    const input = host.querySelector<HTMLInputElement>("input")!;
    input.value = String(time);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  expect(host.querySelector(".story-original")?.getAttribute("width")).toBe(
    "100",
  );
  expect(host.querySelector(".raise-block")?.getAttribute("width")).toBe("20");
  expect(host.querySelectorAll("[data-tenths] line")).toHaveLength(4);
  expect(host.querySelectorAll(".story-hundred line")).toHaveLength(19);
  seek(28);
  expect(host.querySelector(".story-added")?.getAttribute("transform")).toBe(
    "translate(108.000 0)",
  );
  expect(host.querySelector(".story-match")?.hasAttribute("hidden")).toBe(
    false,
  );
  seek(40);
  expect(host.querySelector(".story-equation")?.textContent).toBe(
    "1/5 = 0.20 = 20/100 = 20%",
  );
  expect(host.querySelector(".story-original")?.getAttribute("width")).toBe(
    "100",
  );
  seek(50);
  expect(host.querySelector(".story-equation")?.textContent).toBe(
    "100% original + 20% increase = 120% total",
  );
  const addition = host.querySelector<SVGElement>(".story-added")!;
  addition.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(host.querySelector(".mini-equation")?.textContent).toBe(
    "₱2,000 × 5 = ₱10,000",
  );
  expect(host.querySelectorAll(".mini-divisions path")).toHaveLength(4);
  expect(host.querySelector(".mini-original")?.getAttribute("width")).toBe(
    "120",
  );
  story.mount(host, "", 0, true);
  expect(host.querySelector<HTMLElement>(".story-callout")?.hidden).toBe(true);
  expect(host.querySelector<HTMLInputElement>("input")?.disabled).toBe(true);
  story.dispose();
  expect(host.children).toHaveLength(0);
});
