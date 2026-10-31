// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReferenceRenderer } from "./reference-renderer";
import type { C04Presentation } from "../c04-anchored-change-track/public";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function setup() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const host = document.createElement("div");
  document.body.append(host);
  const onSelect = vi.fn();
  const onIntent = vi.fn();
  const props: C04Presentation = {
    frame: {
      activityId: "C04-A02",
      stateId: "EXP-02",
      contentReferences: [],
      exposedModelFacts: [],
      exposedDerivedFacts: [],
      allowedLearnerIntents: ["SELECT_MODEL_CHILD", "CONTINUE"],
    },
    blocked: false,
    onSelect,
    onIntent,
    reference: {
      A: {
        original: "20000",
        next: "22000",
        difference: null,
        percentage: null,
        relative: null,
      },
    },
  };
  const renderer = createReferenceRenderer(host, vi.fn());
  return { host, props, renderer, onSelect, onIntent };
}
describe("source-preserved V1 renderer boundary", () => {
  it("mounts the latest explanations in a freshly mounted completed revisit without learner dispatch", () => {
    const { host, props, renderer, onSelect, onIntent } = setup();
    const complete: C04Presentation = {
      ...props,
      frame: { ...props.frame, stateId: "COMPLETE", allowedLearnerIntents: [] },
      reference: {
        A: {
          original: "20000",
          next: "22000",
          difference: "2000",
          percentage: "10",
          relative: "0.1",
        },
        B: {
          original: "10000",
          next: "12000",
          difference: "2000",
          percentage: "20",
          relative: "0.2",
        },
      },
    };
    renderer.update(complete);
    const recap = host.querySelector("[data-recap]");
    host.querySelector<HTMLButtonElement>('[data-action="review"]')!.click();
    for (const [step, selector] of [
      [1, ".employee-explanation-host"],
      [2, ".employee-explanation-host"],
      [3, ".comparison-story"],
      [4, ".formula-explanation-host"],
    ] as const) {
      host
        .querySelector<HTMLButtonElement>(
          `[data-action="review-stage"][data-step="${step}"]`,
        )!
        .click();
      expect(host.querySelector(selector)?.childElementCount).toBeGreaterThan(
        0,
      );
      expect(host.querySelector('input[name="answer"]')).toBeNull();
    }
    host
      .querySelector<HTMLButtonElement>('[data-action="review-return"]')!
      .click();
    expect(host.querySelector("[data-recap]")).toBe(recap);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onIntent).not.toHaveBeenCalled();
    renderer.dispose();
  });
  it("enters recap once, retains active motion on updates, and cancels on block, leave, reduced motion and disposal", () => {
    const { host, props, renderer } = setup();
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => media);
    renderer.dispose();
    const active = createReferenceRenderer(host, vi.fn());
    const animations: {
      cancel: ReturnType<typeof vi.fn>;
      finished: Promise<void>;
    }[] = [];
    const animate = vi.fn(function (
      _frames: Keyframe[],
      _options?: KeyframeAnimationOptions,
    ) {
      void _frames;
      void _options;
      const animation = {
        cancel: vi.fn(),
        finished: new Promise<void>(() => {}),
      };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const complete = {
      ...props,
      frame: { ...props.frame, stateId: "COMPLETE" },
    };
    active.update({ ...complete, blocked: true });
    expect(animate).not.toHaveBeenCalled();
    active.update(complete);
    expect(animate).toHaveBeenCalledTimes(7);
    const first = [...animations];
    active.update(complete);
    expect(animate).toHaveBeenCalledTimes(7);
    expect(
      first.every((animation) => animation.cancel.mock.calls.length === 0),
    ).toBe(true);
    active.update({ ...complete, blocked: true });
    expect(
      first.every((animation) => animation.cancel.mock.calls.length === 1),
    ).toBe(true);
    active.update(complete);
    expect(animate).toHaveBeenCalledTimes(7);
    host.querySelector<HTMLButtonElement>('[data-action="review"]')!.click();
    host
      .querySelector<HTMLButtonElement>('[data-action="review-return"]')!
      .click();
    const returning = animations[animations.length - 1]!;
    expect(
      animate.mock.calls[animate.mock.calls.length - 1]?.[1],
    ).toMatchObject({ duration: 240 });
    expect(host.classList.contains("recap-viewport")).toBe(true);
    active.update({ ...props, frame: { ...props.frame, stateId: "ENTRY" } });
    expect(returning.cancel).toHaveBeenCalledOnce();
    active.update(complete);
    const resumed = animations[animations.length - 1]!;
    media.matches = true;
    const change = media.addEventListener.mock.calls[0]?.[1] as () => void;
    change();
    expect(resumed.cancel).toHaveBeenCalledOnce();
    const count = animate.mock.calls.length;
    active.update({ ...props, frame: { ...props.frame, stateId: "ENTRY" } });
    active.update(complete);
    expect(animate).toHaveBeenCalledTimes(count);
    media.matches = false;
    active.update({ ...props, frame: { ...props.frame, stateId: "ENTRY" } });
    active.update(complete);
    const last = animations[animations.length - 1]!;
    active.dispose();
    expect(last.cancel).toHaveBeenCalledOnce();
    expect(host.classList.contains("recap-viewport")).toBe(false);
    Reflect.deleteProperty(Element.prototype, "animate");
  });
  it("retains the static recap, focus and blocked controls without changing authority", () => {
    const { host, props, renderer, onSelect, onIntent } = setup();
    const completed: C04Presentation = {
      ...props,
      frame: {
        ...props.frame,
        stateId: "COMPLETE",
        responseStage: "REFERENCE_PAIR",
      },
    };
    renderer.update(completed);
    const summary = host.querySelector("[data-recap]");
    const model = host.querySelector("svg");
    const review = host.querySelector<HTMLButtonElement>(
      '[data-action="review"]',
    )!;
    review.focus();
    renderer.update(completed);
    expect(host.querySelector("[data-recap]")).toBe(summary);
    expect(host.querySelector("svg")).toBe(model);
    expect(document.activeElement).toBe(review);
    expect(host.textContent).toContain("practice ended at question 2 of 3");
    expect(host.textContent).toContain("different peso amounts");
    expect(host.querySelector(".completion-seal")?.textContent).toBe("✓");
    expect(host.textContent).not.toMatch(
      /independent mastery|record of answers mastered|example with support/,
    );
    expect(host.querySelectorAll(".recap-result")).toHaveLength(2);
    expect(host.querySelectorAll('[data-scale="shared-pesos"]')).toHaveLength(
      2,
    );
    expect(host.querySelectorAll('[data-scale="own-original"]')).toHaveLength(
      2,
    );
    const widths = (scale: string, part: string) =>
      [...host.querySelectorAll(`[data-scale="${scale}"] .recap-${part}`)].map(
        (node) => node.getAttribute("width"),
      );
    expect(widths("shared-pesos", "original")).toEqual(["200", "100"]);
    expect(widths("shared-pesos", "added")).toEqual(["20", "20"]);
    expect(widths("own-original", "original")).toEqual(["200", "200"]);
    expect(widths("own-original", "added")).toEqual(["20", "40"]);
    expect(host.textContent).toContain("New − Original");
    expect(host.textContent).toContain("nonzero original");
    expect(host.textContent).toContain("division by zero is undefined");
    expect(
      host.querySelector('[data-recap-employee="B"][data-scale="own-original"]')
        ?.textContent,
    ).toContain("₱2,000 ÷ ₱10,000 = 0.20");
    renderer.update({ ...completed, blocked: true });
    expect(review.disabled).toBe(true);
    review.click();
    expect(onIntent).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    renderer.update(completed);
    expect(review.disabled).toBe(false);
    expect(document.activeElement).toBe(host.querySelector(".completion h2"));
    renderer.dispose();
  });
  it("keeps formula authorization and all four outer beats outside local playback", () => {
    const { host, props, renderer, onSelect, onIntent } = setup();
    const A = {
      original: "20000",
      next: "22000",
      difference: "2000",
      percentage: "10",
      relative: "0.1",
    };
    const B = {
      original: "10000",
      next: "12000",
      difference: "2000",
      percentage: "20",
      relative: "0.2",
    };
    const frame = { ...props.frame, stateId: "EXP-05" };
    for (const reference of [
      { A },
      { B },
      { A, B: { ...B, percentage: null } },
      { A: { ...A, original: "10000" }, B },
    ]) {
      renderer.update({ ...props, frame, reference });
      expect(host.querySelector(".formula-story")).toBeNull();
    }
    const authorized = { ...props, frame, reference: { A, B } };
    renderer.update(authorized);
    const svg = host.querySelector(".formula-story .story-salary");
    expect(svg).not.toBeNull();
    host.querySelector<HTMLButtonElement>('[data-moment="3"]')!.click();
    expect(onIntent).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    renderer.update(authorized);
    expect(host.querySelector(".formula-story .story-salary")).toBe(svg);
    for (const time of [12, 24, 36]) {
      host.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
      expect(
        host.querySelector(".formula-story")!.getAttribute("data-time"),
      ).toBe(time.toFixed(3));
      expect(onIntent).not.toHaveBeenCalled();
    }
    host.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    expect(onIntent).toHaveBeenCalledExactlyOnceWith("CONTINUE");
    renderer.update({ ...authorized, blocked: true });
    expect(
      host.querySelector<HTMLInputElement>(".formula-story input")!.disabled,
    ).toBe(true);
    renderer.update({ ...authorized, reference: { A } });
    expect(host.querySelector(".formula-story")).toBeNull();
    renderer.dispose();
  });
  it("requires both authorized employees for comparison and keeps local exploration outside progression", () => {
    const { host, props, renderer, onSelect, onIntent } = setup();
    const A = {
      original: "20000",
      next: "22000",
      difference: "2000",
      percentage: "10",
      relative: "0.1",
    };
    const B = {
      original: "10000",
      next: "12000",
      difference: "2000",
      percentage: "20",
      relative: "0.2",
    };
    const frame = { ...props.frame, stateId: "EXP-04" };
    for (const reference of [
      { A },
      { B },
      { A, B: { ...B, percentage: null } },
      { A: { ...A, original: "10000" }, B },
    ]) {
      renderer.update({ ...props, frame, reference });
      expect(host.querySelector(".comparison-story")).toBeNull();
    }
    const authorized = { ...props, frame, reference: { A, B } };
    renderer.update(authorized);
    const svg = host.querySelector(".comparison-salary");
    expect(svg).not.toBeNull();
    host.querySelector<HTMLButtonElement>('[data-moment="5"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-scale="pesos"]')!.click();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onIntent).not.toHaveBeenCalled();
    renderer.update(authorized);
    expect(host.querySelector(".comparison-salary")).toBe(svg);
    host.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    expect(
      host.querySelector(".comparison-story")?.getAttribute("data-time"),
    ).toBe("25.500");
    expect(onIntent).not.toHaveBeenCalled();
    renderer.update({ ...authorized, blocked: true });
    expect(
      host.querySelector<HTMLInputElement>(".comparison-story input")?.disabled,
    ).toBe(true);
    renderer.update({ ...authorized, reference: { A } });
    expect(host.querySelector(".comparison-story")).toBeNull();
    renderer.dispose();
  });
  it.each([null, "smaller", "equal", "larger"])(
    "keeps the optional B prediction until explicit continuation: %s",
    (prediction) => {
      const { host, props, renderer, onSelect, onIntent } = setup();
      renderer.update({
        ...props,
        frame: { ...props.frame, stateId: "EXP-03" },
        reference: {
          B: {
            original: "10000",
            next: "12000",
            difference: "2000",
            percentage: "20",
            relative: "0.2",
          },
        },
      });
      expect(host.querySelector(".employee-story")).toBeNull();
      expect(host.querySelector(".prediction-choices")).not.toBeNull();
      if (prediction)
        host
          .querySelector<HTMLButtonElement>(
            `[data-action="predict"][data-value="${prediction}"]`,
          )!
          .click();
      expect(host.querySelector(".employee-story")).toBeNull();
      expect(
        host.querySelector("#prediction-feedback")?.textContent,
      ).not.toMatch(/20%|120%|1\/5|0\.20/);
      expect(onSelect).not.toHaveBeenCalled();
      expect(onIntent).not.toHaveBeenCalled();
      host.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
      expect(
        host.querySelector(".employee-story")?.getAttribute("aria-label"),
      ).toBe("Employee B explanation");
      expect(onSelect).not.toHaveBeenCalled();
      expect(onIntent).not.toHaveBeenCalled();
      renderer.dispose();
    },
  );
  it("does not disclose gated percentage/fraction or synthesize engagement on mount", () => {
    const { host, props, renderer, onSelect } = setup();
    renderer.update(props);
    expect(host.textContent).not.toMatch(/10%|0\.10|1\/10/);
    expect(host.querySelector(".salary-svg")).not.toBeNull();
    expect(host.innerHTML).not.toMatch(/₱2,000|10%|0\.10|1\/10/);
    expect(
      host.querySelector(".raise-block, .tile-divider, .total-bracket"),
    ).toBeNull();
    expect(host.querySelector(".original-block")?.getAttribute("width")).toBe(
      "200",
    );
    expect(onSelect).not.toHaveBeenCalled();
    host.querySelector<HTMLButtonElement>("[data-action=engage]")!.click();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("C04-S02-A");
    renderer.dispose();
  });
  it("shows B's unsegmented source salary without disclosing either result", () => {
    const { host, props, renderer, onSelect } = setup();
    renderer.update({
      ...props,
      frame: { ...props.frame, stateId: "EXP-03" },
      reference: {
        B: {
          original: "10000",
          next: "12000",
          difference: null,
          percentage: null,
          relative: null,
        },
      },
    });
    expect(host.querySelector(".original-block")?.getAttribute("width")).toBe(
      "100",
    );
    expect(host.innerHTML).not.toMatch(/₱2,000|20%|0\.20|one fifth/);
    expect(onSelect).not.toHaveBeenCalled();
    host.querySelector<HTMLButtonElement>("[data-action=engage]")!.click();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("C04-S02-B");
    renderer.dispose();
  });
  it("fails closed for missing or mismatched source facts", () => {
    const { host, props, renderer, onSelect } = setup();
    renderer.update({ ...props, reference: {} });
    expect(host.querySelector(".salary-svg, [data-action=engage]")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    renderer.dispose();
  });
  it("preserves actual salary SVG and matching-outline manipulation after permission", () => {
    const { host, props, renderer, onSelect, onIntent } = setup();
    const exposed = {
      ...props,
      reference: {
        A: {
          original: "20000",
          next: "22000",
          difference: "2000",
          percentage: "10",
          relative: "0.1",
        },
      },
    };
    renderer.update(exposed);
    expect(host.querySelector(".original-block")?.getAttribute("width")).toBe(
      "200",
    );
    host.querySelector<HTMLButtonElement>('[data-moment="3"]')!.click();
    expect(host.querySelector(".raise-block")?.getAttribute("width")).toBe(
      "20",
    );
    const comparisonRange = host.querySelector<HTMLInputElement>(
      ".employee-story input",
    )!;
    comparisonRange.value = "28";
    comparisonRange.dispatchEvent(new Event("input", { bubbles: true }));
    expect(host.querySelector(".story-match")?.hasAttribute("hidden")).toBe(
      false,
    );
    const svg = host.querySelector(".story-salary");
    const range = host.querySelector<HTMLInputElement>(
      ".employee-story input",
    )!;
    range.value = "30.5";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.focus();
    renderer.update({
      ...props,
      reference: {
        A: {
          original: "20000",
          next: "22000",
          difference: "2000",
          percentage: "10",
          relative: "0.1",
        },
      },
    });
    expect(host.querySelector(".story-salary")).toBe(svg);
    expect(host.querySelector(".employee-story input")).toBe(range);
    expect(range.value).toBe("30.5");
    expect(document.activeElement).toBe(range);
    for (const button of host.querySelectorAll<HTMLButtonElement>(
      ".employee-story button:not(:disabled)",
    ))
      button.click();
    expect(onIntent).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    renderer.dispose();
  });
  it("blocks controls and cancels handlers on disposal", () => {
    const { host, props, renderer, onSelect } = setup();
    renderer.update({ ...props, blocked: true });
    host.querySelector<HTMLButtonElement>("[data-action=engage]")!.click();
    expect(onSelect).not.toHaveBeenCalled();
    renderer.dispose();
    expect(host.childElementCount).toBe(0);
  });
});
