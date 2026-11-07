// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InspectionEvent } from "../../audio/public";
import { createWorkRecordInspection } from "./work-record-inspection";
import { createWorkRecordInspection as createCommissionInspection } from "../c06-commission-machine/commission-inspection";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function mount(create: typeof createWorkRecordInspection) {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "performance",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-inspection-model>
      <button data-explore="a">A</button>
      <button data-explore="b">B</button>
    </div>
    <div data-inspection-panel hidden>
      <h4></h4><p data-inspection-copy></p>
      <svg data-diagram="a"><rect data-mini-piece/><rect data-mini-piece/><rect data-mini-piece/></svg>
      <svg data-diagram="b"><rect data-sound-grow/></svg>
    </div>`;
  document.body.append(root);
  const heard: InspectionEvent[] = [];
  const inspection = create(root, {
    blocked: () => false,
    opened: () => {},
    sound: (event) => heard.push(event),
    facts: () => [
      { id: "a", title: "A", copy: "a" },
      { id: "b", title: "B", copy: "b" },
    ],
  });
  const [a, b] = [...root.querySelectorAll<HTMLElement>("[data-explore]")];
  return { root, heard, inspection, a: a!, b: b! };
}

describe.each([
  ["C03 work record", createWorkRecordInspection],
  ["C06 commission machine", createCommissionInspection],
])("%s inspection sound", (_name, create) => {
  it("whispers open, sounds each piece as it places, ticks on switch and closes", () => {
    const { heard, inspection, a, b, root } = mount(create);
    a.focus();
    expect(heard).toEqual(["open"]);
    vi.advanceTimersByTime(1600);
    expect(heard).toEqual(["open", "piece", "piece", "piece"]);
    b.focus();
    expect(heard.slice(4)).toEqual(["switch", "grow"]);
    root.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(heard[heard.length - 1]).toBe("close");
    inspection.dispose();
  });

  it("reveals on a pin, never repeats it, and closes from outside quietly", () => {
    const { heard, inspection, a } = mount(create);
    a.click();
    expect(heard[0]).toBe("pin");
    a.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(heard.filter((e) => e === "pin")).toHaveLength(1);
    const before = heard.length;
    inspection.close();
    inspection.dispose();
    expect(heard.length).toBe(before);
  });

  it("places pieces silently when motion is reduced", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => {},
    }));
    const { heard, inspection, a } = mount(create);
    a.focus();
    vi.advanceTimersByTime(1600);
    expect(heard).toEqual(["open"]);
    inspection.dispose();
  });
});
