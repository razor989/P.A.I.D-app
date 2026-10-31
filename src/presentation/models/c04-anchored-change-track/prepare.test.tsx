// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createC04ActivityActor,
  composeC04ActivityFrame,
} from "@/engine/c04-activity-binding/public";
import { PrepareV3Experience as PrepareExperience } from "./PrepareV3Experience";

afterEach(cleanup);
const values = {
  original: "18000",
  next: "18000",
  difference: null,
  percentage: null,
};

it("provides a distinct landing and local deterministic explanation without evidence or answer leaks", async () => {
  const actor = createC04ActivityActor(
    "C04-A01",
    "C04-A01-guided-prepare-v3",
  ).start();
  try {
    const onIntent = vi.fn(),
      onDraft = vi.fn(),
      onPresented = vi.fn();
    const before = actor.getSnapshot();
    const view = render(
      <PrepareExperience
        frame={composeC04ActivityFrame(actor)}
        prepare={values}
        blocked={false}
        onIntent={onIntent}
        onSelect={vi.fn()}
        onDraft={onDraft}
        onPresented={onPresented}
      />,
    );
    const user = userEvent.setup();
    expect(
      screen.getByRole("heading", { name: "Two moments. One salary review." }),
    ).toBeDefined();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Start with Maya/ }));
    for (const name of [
      "02 After the review",
      "03 One peso scale",
      "04 Your reasoning",
      "01 Before the review",
    ]) {
      await user.click(screen.getByRole("button", { name }));
      expect(view.container.innerHTML).not.toMatch(
        /0%|₱0\.00|zero difference|did not change/i,
      );
    }
    await user.click(screen.getByRole("button", { name: /Inspect Original/ }));
    expect(
      screen.getByRole("complementary", { name: "Model inspection" }),
    ).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: "Close model inspection" }),
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Inspect Original/ }),
    );
    expect(actor.getSnapshot()).toBe(before);
    expect(onIntent).not.toHaveBeenCalled();
    expect(onDraft).not.toHaveBeenCalled();
    expect(onPresented).not.toHaveBeenCalled();
  } finally {
    actor.stop();
  }
});

it("blocks local and canonical actions under the technical barrier", () => {
  const actor = createC04ActivityActor(
    "C04-A01",
    "C04-A01-guided-prepare-v3",
  ).start();
  try {
    render(
      <PrepareExperience
        frame={composeC04ActivityFrame(actor)}
        prepare={values}
        blocked
        onIntent={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: /Start with Maya/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  } finally {
    actor.stop();
  }
});

it("acknowledges connected current feedback only when unblocked", () => {
  const actor = createC04ActivityActor(
    "C04-A01",
    "C04-A01-guided-prepare-v3",
  ).start();
  try {
    const onPresented = vi.fn((kind: string, element: HTMLElement) => {
      expect(kind).toBe("feedback");
      expect(element.isConnected).toBe(true);
      expect(element.textContent).toContain("Authorized feedback");
    });
    const frame = {
      ...composeC04ActivityFrame(actor),
      stateId: "CONFIRMATION",
      feedbackState: {
        outcome: "CONFIRMED" as const,
        content: { id: "test-feedback", text: "Authorized feedback" },
      },
    };
    const props = {
      frame,
      prepare: { ...values, difference: "0", percentage: "0" },
      onIntent: vi.fn(),
      onSelect: vi.fn(),
      onPresented,
    };
    const view = render(<PrepareExperience {...props} blocked />);
    expect(onPresented).not.toHaveBeenCalled();
    view.rerender(<PrepareExperience {...props} blocked={false} />);
    expect(onPresented).toHaveBeenCalledOnce();
  } finally {
    actor.stop();
  }
});
