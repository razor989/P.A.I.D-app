// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrepareExperience } from "./PrepareExperience";
import { momentDuration, projectPrepareStory } from "./prepare-story";
afterEach(cleanup);
it("keeps diagnostic lead text opaque throughout its positional entrance", () => {
  const calls: { element: Element; frames: Keyframe[] }[] = [];
  const original = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: function (this: Element, frames: Keyframe[]) {
      calls.push({ element: this, frames });
      return { cancel: vi.fn() };
    },
  });
  try {
    const frame = {
      activityId: "C04-A01",
      stateId: "RESPONSE",
      allowedLearnerIntents: [],
      contentReferences: [],
      exposedModelFacts: [],
      exposedDerivedFacts: [],
    } as unknown as import("@/engine/semantic-frame/public").SemanticActivityFrame;
    const view = render(
      <PrepareExperience
        frame={frame}
        blocked={false}
        onIntent={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const lead = view.container.querySelector(".check-header > .lead");
    expect(lead).not.toBeNull();
    const entrance = calls.find((call) => call.element === lead);
    expect(entrance).toBeDefined();
    expect(entrance!.frames.map((frame) => frame.opacity)).toEqual([1, 1]);
    expect(entrance!.frames.map((frame) => frame.transform)).toEqual([
      "translateY(15px)",
      "none",
    ]);
    // Preserve accepted fading on the other entrance elements.
    expect(
      calls.find((call) => call.element.matches(".check-header > h2"))
        ?.frames[0]?.opacity,
    ).toBe(0);
  } finally {
    if (original) Object.defineProperty(Element.prototype, "animate", original);
    else Reflect.deleteProperty(Element.prototype, "animate");
  }
});
it("uses A02 entrance timing, cancels motion on unmount and keeps instructions out of the illustration", async () => {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  const original = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: animate,
  });
  try {
    const frame = {
      activityId: "C04-A01",
      stateId: "ENTRY",
      allowedLearnerIntents: ["CONTINUE"],
      contentReferences: [],
      exposedModelFacts: [],
      exposedDerivedFacts: [],
    } as unknown as import("@/engine/semantic-frame/public").SemanticActivityFrame;
    const view = render(
      <PrepareExperience
        frame={frame}
        blocked={false}
        onIntent={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Start with Maya/ }));
    expect(
      animate.mock.calls.some((call) => {
        const options = (
          call as unknown as [Keyframe[], KeyframeAnimationOptions]
        )[1];
        return (
          options.duration === 420 &&
          options.easing === "cubic-bezier(.2,.75,.25,1)"
        );
      }),
    ).toBe(true);
    expect(view.container.querySelector(".story-play svg")).toBeNull();
    expect(
      view.container.querySelector(".story-salary")?.textContent,
    ).not.toMatch(/\bnotice\b|\bkeep\b|\bin view\b/i);
    const cancellations = cancel.mock.calls.length;
    view.unmount();
    expect(cancel.mock.calls.length).toBeGreaterThan(cancellations);
  } finally {
    if (original) Object.defineProperty(Element.prototype, "animate", original);
    else Reflect.deleteProperty(Element.prototype, "animate");
  }
});
it("reveals a situation, never a worked solution, and shares A02 playback and inspection structure", async () => {
  const frame = {
    activityId: "C04-A01",
    stateId: "ENTRY",
    responseContract: { id: "C04-A01-elicit-engage-v4", version: 4 },
    allowedLearnerIntents: ["CONTINUE"],
    contentReferences: [],
    exposedModelFacts: [],
    exposedDerivedFacts: [],
  } as unknown as import("@/engine/semantic-frame/public").SemanticActivityFrame;
  {
    const onIntent = vi.fn(),
      onDraft = vi.fn();
    const view = render(
      <PrepareExperience
        frame={frame}
        blocked={false}
        onIntent={onIntent}
        onSelect={vi.fn()}
        onDraft={onDraft}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Start with Maya/ }));
    for (const moment of [
      "02 Before the review",
      "04 After the review",
      "06 Your first thinking",
    ])
      await user.click(screen.getByRole("button", { name: moment }));
    expect(view.container.textContent).not.toMatch(
      /0%|100%|denominator|zero difference|New minus Original|did not change/,
    );
    expect(
      view.container.querySelector(".story-playback .story-play"),
    ).not.toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Inspect before the review" }),
    );
    expect(
      screen
        .getByRole("complementary", { name: "Document inspection" })
        .hasAttribute("hidden"),
    ).toBe(false);
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("complementary", { name: "Document inspection" }),
    ).toBeNull();
    expect(onIntent).not.toHaveBeenCalled();
    expect(onDraft).not.toHaveBeenCalled();
    for (let time = 0; time <= 6 * momentDuration; time += 1000) {
      const first = projectPrepareStory(time);
      projectPrepareStory(0);
      expect(projectPrepareStory(time)).toEqual(first);
      expect(first.moment.captions.join(" ")).not.toMatch(
        /0%|100%|denominator|did not change/,
      );
    }
  }
});
