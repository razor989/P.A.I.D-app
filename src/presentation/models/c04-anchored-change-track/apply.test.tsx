// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplyExperience } from "./ApplyExperience";
import { ApplyResponse } from "./ApplyResponse";
import { ApplyComparison } from "./ApplyComparison";
import type { C04Presentation } from "./public";
afterEach(cleanup);
it("does not render a no-op Review when only generic support is available", () => {
  const p = props();
  render(
    <ApplyExperience
      {...p}
      frame={{
        ...p.frame,
        stateId: "ACTIVE",
        allowedLearnerIntents: ["OPEN_SUPPORT"],
        reviewAvailability: false,
      }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
});
it("inspection supports focus, pinning, Escape and an interaction barrier", async () => {
  const p = props();
  const model = {
    ...p,
    apply: {
      original: "30000",
      next: "27000",
      difference: "-3000",
      percentage: "-10",
      comparisonScale: "0.9",
    },
    frame: {
      ...p.frame,
      stateId: "CONFIRMATION",
      exposedDerivedFacts: [
        { id: "c04/S03/checked/difference", text: "-3000" },
        { id: "c04/S03/checked/percentage", text: "-10" },
      ],
    },
  };
  const view = render(<ApplyComparison {...model} />);
  const change = screen.getByRole("button", {
    name: "Inspect the removed portion",
  });
  await userEvent.click(change);
  expect(change.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen.getByText(/negative sign records/, { selector: ".mini-copy-text" }),
  ).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(change.getAttribute("aria-expanded")).toBe("false");
  view.rerender(<ApplyComparison {...model} blocked />);
  expect(
    screen
      .getByRole("button", { name: "Inspect original offer" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
});
function props(): C04Presentation {
  return {
    frame: {
      activityId: "C04-A03",
      stateId: "ENTRY",
      contentReferences: [],
      exposedModelFacts: [
        { id: "c04/S03/selected-track/original", text: "30000 PHP" },
        { id: "c04/S03/selected-track/newValue", text: "27000 PHP" },
      ],
      exposedDerivedFacts: [],
      allowedLearnerIntents: ["CONTINUE"],
    },
    blocked: false,
    onIntent: vi.fn(),
    onSelect: vi.fn(),
    onDraft: vi.fn(),
  };
}
it("keeps all pre-check surfaces free of derived answers even with an overprovided value projection", async () => {
  const p = props();
  const view = render(
    <ApplyExperience
      {...p}
      apply={{
        original: "30000",
        next: "27000",
        difference: "-3000",
        percentage: "-10",
      }}
    />,
  );
  expect(view.container.innerHTML).not.toMatch(
    /-3000|−3,000|−10%|-10%|10% decrease/,
  );
  expect(screen.getByText("₱30,000")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: /Work on the offer/ }),
  );
  expect(p.onIntent).toHaveBeenCalledWith("CONTINUE");
  expect(p.onDraft).not.toHaveBeenCalled();
});
it("requires every response, preserves signs, and never locally grades", async () => {
  const p = props();
  const fields = ["original", "new", "difference", "percentage"].map(
    (role) => ({ role, required: true, acceptedKinds: ["EXACT_QUANTITY"] }),
  );
  const view = render(
    <ApplyResponse
      {...p}
      frame={{
        ...p.frame,
        stateId: "ACTIVE",
        allowedLearnerIntents: ["CHECK_RESPONSE"],
      }}
      fields={fields}
    />,
  );
  const inputs = screen.getAllByRole("textbox");
  await userEvent.type(inputs[0]!, "30000");
  await userEvent.type(inputs[1]!, "27000");
  await userEvent.click(
    screen.getByRole("button", { name: /Work out the change →/ }),
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: /^Signed difference/ }),
    "-3000",
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: /^Percentage change/ }),
    "-10",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /State your conclusion →/ }),
  );
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Check" }).disabled,
  ).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(p.onIntent).toHaveBeenCalledWith("CHECK_RESPONSE");
  expect(p.onDraft).toHaveBeenLastCalledWith({
    original: "30000",
    new: "27000",
    difference: "-3000",
    percentage: "-10",
  });
  expect(view.container.textContent).not.toContain("Confirmed");
});
it("only acknowledges mounted current feedback and never behind a barrier", () => {
  const p = props();
  const onPresented =
    vi.fn<(kind: "feedback" | "terminal", element: HTMLElement) => void>();
  const frame = {
    ...p.frame,
    stateId: "CONFIRMATION",
    allowedLearnerIntents: [],
    feedbackState: {
      outcome: "CONFIRMED" as const,
      content: { id: "source", text: "Current source feedback" },
    },
  };
  const view = render(
    <ApplyExperience {...p} frame={frame} blocked onPresented={onPresented} />,
  );
  expect(onPresented).not.toHaveBeenCalled();
  view.rerender(
    <ApplyExperience {...p} frame={frame} onPresented={onPresented} />,
  );
  expect(onPresented).toHaveBeenCalledWith("feedback", expect.any(HTMLElement));
  expect(onPresented.mock.calls[0]![1].textContent).toContain(
    "Current source feedback",
  );
});

it("reading navigation never commits or calculates; malformed and composing drafts cannot Check", async () => {
  const p = props();
  const fields = ["original", "new", "difference", "percentage"].map(
    (role) => ({
      role,
      required: true,
      acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
    }),
  );
  render(
    <ApplyResponse
      {...p}
      fields={fields}
      frame={{
        ...p.frame,
        stateId: "ACTIVE",
        allowedLearnerIntents: ["CHECK_RESPONSE"],
      }}
    />,
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: /Work out the change →/ }),
  );
  expect(
    screen.getByRole<HTMLInputElement>("textbox", {
      name: /^Signed difference/,
    }).value,
  ).toBe("");
  await userEvent.type(
    screen.getByRole("textbox", { name: /^Signed difference/ }),
    "3,000",
  );
  expect(
    screen.getByRole("textbox", { name: /^Signed difference/ }),
  ).toBeTruthy();
  const signed = screen.getByRole("textbox", { name: /^Signed difference/ });
  fireEvent.compositionStart(signed);
  expect(screen.getByText("Finish entering the number.")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: /State your conclusion →/ }),
  );
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Check" }).disabled,
  ).toBe(true);
  expect(p.onIntent).not.toHaveBeenCalled();
});

it("restores semantic boundaries, permits numerical revision, and does not expose an unapproved graph", async () => {
  const p = props();
  const fields = ["original", "new", "difference", "percentage"].map(
    (role) => ({
      role,
      required: true,
      acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
    }),
  );
  const view = render(
    <ApplyResponse
      {...p}
      fields={fields}
      responseDraft={{
        original: "UNDEFINED",
        new: "27000",
        difference: "-3000",
        percentage: "-10",
      }}
      frame={{
        ...p.frame,
        stateId: "REVISION",
        allowedLearnerIntents: ["CHECK_AGAIN"],
      }}
    />,
  );
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: /original offer/ })
      .value,
  ).toBe("UNDEFINED");
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: /original offer/ }),
    "NUMBER",
  );
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: /^Original salary/ })
      .disabled,
  ).toBe(false);
  await userEvent.type(
    screen.getByRole("textbox", { name: /^Original salary/ }),
    "30000",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "State your conclusion" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(p.onIntent).toHaveBeenCalledWith("CHECK_AGAIN");
  view.unmount();
  const graph = render(
    <ApplyComparison
      {...p}
      apply={{
        original: "30000",
        next: "27000",
        difference: "-3000",
        percentage: "-10",
        comparisonScale: "0.9",
      }}
    />,
  );
  expect(graph.container.innerHTML).toBe("");
});
