// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  createC06ActivityActor,
  projectC06ActivityFrame,
} from "@/engine/c06-activity-binding/public";
import { CommissionMachine } from "./CommissionMachine";
import { PrepareResponse } from "./PrepareResponse";
import { PrepareExperience } from "./PrepareExperience";
import { CommissionObservation } from "./CommissionObservation";
import type { C06PreparePresentation } from "./public";
import type { LearnerResponse } from "@/core/public";
import { ExactDecimal, quantity } from "@/core/public";
import { ExploreRecord } from "./ExploreRecord";
import { ExploreStory } from "./ExploreStory";
import { ExploreRecap } from "./ExploreRecap";
import { exploreChapters } from "./explore-story";

const actors: ReturnType<typeof createC06ActivityActor>[] = [];
afterEach(() => {
  cleanup();
  actors.splice(0).forEach((a) => a.stop());
});
function active() {
  const actor = createC06ActivityActor("C06-A01");
  actors.push(actor);
  actor.start();
  actor.send({ type: "CONTINUE" });
  return actor;
}
describe("C06-A01 independently implementable presentation primitives", () => {
  it("keeps the story in range when the first animation timestamp precedes setup", () => {
    const actor = active();
    let tick: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const view = render(
        <CommissionObservation
          projection={projectC06ActivityFrame(actor)}
          blocked={false}
          reduced
          onRespond={() => {}}
        />,
      );
      fireEvent.click(view.getByRole("button", { name: "Play sales story" }));
      act(() => tick?.(-100));
      expect(
        view.getByRole("heading", { name: "Two workers. A month of selling." }),
      ).toBeTruthy();
      expect(view.getByRole("slider").getAttribute("value")).toBe("0");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it.each([false, true])(
    "renders genuine feedback and teaching before lawful recap (wrong=%s)",
    (wrong) => {
      const actor = active();
      const delivered: string[] = [];
      const props = (): C06PreparePresentation => ({
        projection: projectC06ActivityFrame(actor),
        blocked: false,
        onResponse: (response) =>
          actor.send({ type: "RESPONSE_CHANGED", response }),
        onAction: (type) => actor.send({ type }),
        onSelectWorker: () => {},
        onHelp: () => {},
        onCloseHelp: () => {},
        onPresented: (kind, element) => {
          expect(element.isConnected).toBe(true);
          const c = actor.getSnapshot().context;
          if (kind === "feedback") {
            expect(element.textContent).toContain(
              projectC06ActivityFrame(actor).frame.feedbackState!.content.text,
            );
            if (c.feedbackRevision === null) {
              delivered.push(kind);
              actor.send({
                type: "FEEDBACK_DELIVERED",
                revision: c.responseRevision,
              });
            }
          } else if (c.terminalTeachingRevision !== c.responseRevision) {
            expect(element.textContent).toContain(
              projectC06ActivityFrame(actor).frame.contentReferences.find(
                (r) => r.id === "c06/S01/accessibility-summary",
              )!.text,
            );
            delivered.push(kind);
            actor.send({
              type: "TERMINAL_TEACHING_DELIVERED",
              revision: c.responseRevision,
              contentId: "c06/S01/accessibility-summary",
            });
          }
        },
      });
      const view = render(<PrepareExperience {...props()} />);
      fireEvent.click(
        view.getByRole("radio", {
          name: wrong
            ? "I think they’ll receive the same pay."
            : "I think their pay could be different.",
        }),
      );
      view.rerender(<PrepareExperience {...props()} />);
      fireEvent.click(view.getByRole("button", { name: "Next question →" }));
      fireEvent.click(
        view.getByRole("radio", {
          name: "What each worker’s pay agreement promises.",
        }),
      );
      view.rerender(<PrepareExperience {...props()} />);
      expect(view.queryByText(/14,000/)).toBeNull();
      fireEvent.click(view.getByRole("button", { name: "Record my thinking" }));
      view.rerender(<PrepareExperience {...props()} />);
      expect(
        view.getByText(/There’s more than sales|Let’s follow that idea/),
      ).toBeTruthy();
      expect(delivered).toEqual(["feedback"]);
      expect(view.queryByRole("button", { name: "Finish Prepare" })).toBeNull();
      view.rerender(<PrepareExperience {...props()} />);
      fireEvent.click(
        view.getByRole("button", { name: "Follow both pay stories →" }),
      );
      view.rerender(<PrepareExperience {...props()} />);
      expect(delivered).toEqual(["feedback", "teaching"]);
      view.rerender(<PrepareExperience {...props()} />);
      fireEvent.click(view.getByRole("button", { name: "Finish Prepare" }));
      view.rerender(<PrepareExperience {...props()} />);
      expect(actor.getSnapshot().context.position).toBe("COMPLETE");
      expect(
        view.getByRole("region", { name: "Activity completion" }),
      ).toBeTruthy();
      expect(view.queryByRole("button", { name: "Finish Prepare" })).toBeNull();
    },
  );
  it("renders genuine Straight topology without Base/Total modules or hidden answers", () => {
    const actor = active();
    const view = render(
      <CommissionMachine
        model={projectC06ActivityFrame(actor).model}
        worker="Worker A"
      />,
    );
    expect(view.getByText("Ends at Commission.")).toBeTruthy();
    expect(
      view.queryByLabelText("Then assemble Total Compensation"),
    ).toBeNull();
    expect(view.queryByText("Base Salary")).toBeNull();
    expect(view.queryByText("Total Compensation")).toBeNull();
    expect(view.container.innerHTML).not.toMatch(/4,000|14,000|4000|14000/);
    expect(
      view.container.querySelectorAll("[data-explore]").length,
    ).toBeGreaterThan(0);
  });
  it("selection publishes complete Base-Plus structure but neither answers nor solved outputs", () => {
    const actor = active();
    const control = projectC06ActivityFrame(actor).frame.modelSelectionControl!;
    actor.send({
      type: "SELECT_MODEL_CHILD",
      modelId: control.modelId,
      position: control.position,
      revision: control.revision,
      selectionId: "C06-S01-B",
    });
    const projection = projectC06ActivityFrame(actor);
    const view = render(
      <CommissionMachine model={projection.model} worker="Worker B" />,
    );
    expect(projection.response).toBeNull();
    expect(view.getByText("Base Salary")).toBeTruthy();
    expect(view.getByText("Total Compensation")).toBeTruthy();
    expect(view.getByText("₱10,000 per month")).toBeTruthy();
    expect(view.container.innerHTML).not.toMatch(/4,000|14,000|4000|14000/);
  });
  it("records uncertainty without inventing structural answers", () => {
    const actor = active();
    const props = () => ({
      projection: projectC06ActivityFrame(actor),
      blocked: false,
      onResponse: (response: LearnerResponse) =>
        actor.send({ type: "RESPONSE_CHANGED", response }),
    });
    const view = render(<PrepareResponse {...props()} />);
    fireEvent.click(
      view.getByRole("radio", {
        name: "I’m not sure yet. I’d like to look closer.",
      }),
    );
    view.rerender(<PrepareResponse {...props()} />);
    fireEvent.click(view.getByRole("button", { name: "Next question →" }));
    fireEvent.click(
      view.getByRole("radio", {
        name: "I’d like someone to walk through both with me.",
      }),
    );
    expect(actor.getSnapshot().context.response).toEqual({
      kind: "COMPOSITE",
      parts: [
        {
          key: "expectation",
          response: { kind: "SINGLE_SELECTION", selectionId: "UNSURE" },
        },
        {
          key: "investigation",
          response: { kind: "SINGLE_SELECTION", selectionId: "UNSURE" },
        },
      ],
    });
    actor.send({ type: "CHECK_RESPONSE" });
    expect(actor.getSnapshot().context.evaluation?.outcome).toBe(
      "RECONSIDERATION",
    );
    expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
  });
});

function exploreProps(): C06PreparePresentation {
  const actor = createC06ActivityActor("C06-A02");
  actor.start();
  const projection = projectC06ActivityFrame(actor);
  actor.stop();
  return {
    projection,
    blocked: false,
    onAction: vi.fn(),
    onResponse: vi.fn(),
    onSelectWorker: vi.fn(),
    onHelp: vi.fn(),
    onCloseHelp: vi.fn(),
    onPresented: vi.fn(),
  };
}
it("shows a complete thought immediately and illustrates all three moment controls", () => {
  const view = render(<ExploreStory {...exploreProps()} stage={0} />);
  const text = view.getByText(exploreChapters[0].moments[0][1]);
  expect(text.tagName).toBe("P");
  expect(text.querySelectorAll("span")).toHaveLength(0);
  const moments = view.getByRole("group", {
    name: "Choose an explanation moment",
  });
  expect(moments.querySelectorAll("button svg")).toHaveLength(3);
  fireEvent.click(
    view.getByRole("button", { name: /Another part can change/ }),
  );
  expect(
    view.getByText(exploreChapters[0].moments[2][1]).closest("[hidden]"),
  ).toBeNull();
});
it("formats actual numeric records without substituting correct answers or filling missing values", () => {
  const p = exploreProps();
  const projection = {
    ...p.projection,
    response: {
      kind: "COMPOSITE" as const,
      parts: [
        {
          key: "rate",
          response: {
            kind: "EXACT_QUANTITY" as const,
            value: quantity(
              ExactDecimal.from("4"),
              "PERCENTAGE_RATE",
              "%",
              null,
            ),
          },
        },
        {
          key: "base",
          response: {
            kind: "EXACT_QUANTITY" as const,
            value: quantity(
              ExactDecimal.from("12345.67"),
              "MONETARY_AMOUNT",
              "PHP",
              "per month",
            ),
          },
        },
        {
          key: "commissionA",
          response: {
            kind: "EXACT_QUANTITY" as const,
            value: quantity(
              ExactDecimal.from("1"),
              "MONETARY_AMOUNT",
              "PHP",
              "per month",
            ),
          },
        },
      ],
    },
  };
  const view = render(<ExploreRecord projection={projection} />);
  expect(view.getAllByText("4%").length).toBeGreaterThan(0);
  expect(view.getByText("₱12,345.67")).toBeTruthy();
  expect(view.getByText("₱1")).toBeTruthy();
  expect(view.queryByText("₱9,000")).toBeNull();
  expect(view.getAllByText("Not recorded").length).toBeGreaterThan(0);
});
it("composes completion, recorded work and transfer steps with a local explanation revisit", () => {
  const p = exploreProps();
  const view = render(<ExploreRecap {...p} />);
  expect(
    view.getByRole("region", {
      name: "Your recorded calculations",
      hidden: true,
    }),
  ).toBeTruthy();
  expect(
    view.getByRole("region", { name: "Take the reasoning forward" }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", { name: "Revisit the explanation" }),
  );
  expect(
    view.getByRole("region", { name: "Commission explanation" }),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Return to recap" }));
  expect(
    view.queryByRole("region", { name: "Commission explanation" }),
  ).toBeNull();
  expect(p.onAction).not.toHaveBeenCalled();
});
