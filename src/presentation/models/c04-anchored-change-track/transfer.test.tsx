// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TransferExperience } from "./TransferExperience";
import { TransferSynthesis } from "./TransferSynthesis";
import { TransferStory } from "./TransferStory";
import type { C04Presentation } from "./public";
afterEach(cleanup);
it("lets the learner reveal, revisit and replay everyday comparisons without requiring them", () => {
  const view = render(<TransferStory blocked={false} />);
  expect(screen.queryByText("25% increase")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "See it in everyday life →" }),
  );
  expect(screen.getByRole("heading", { name: "At the shop" })).toHaveFocus();
  fireEvent.click(
    screen.getByRole("button", { name: "Show me the comparison" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("25% increase");
  fireEvent.click(screen.getByRole("button", { name: "Replay scene ↻" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "₱50 ÷ ₱200 × 100 = 25%",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next scene →" }));
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Show me the comparison" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("−20%");
  fireEvent.click(screen.getByRole("button", { name: "Next scene →" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Show me the comparison" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "percentage change is undefined",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next scene →" }));
  expect(
    screen.getByRole("heading", { name: "What did we start with?" }),
  ).toHaveFocus();
  expect(screen.getByText("25% increase")).toBeVisible();
  view.rerender(<TransferStory blocked />);
  screen
    .getAllByRole("button")
    .forEach((button) => expect(button).toBeDisabled());
});
it("compares the same increase against three references without grading a prediction", () => {
  render(<TransferSynthesis blocked={false} />);
  const reveal = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Reveal the comparison" }),
    );
  expect(screen.queryByText("100%")).toBeNull();
  reveal();
  expect(screen.getByText("100%")).toBeVisible();
  fireEvent.click(screen.getByRole("radio", { name: "₱3,000 original" }));
  expect(screen.queryByText("100%")).toBeNull();
  reveal();
  expect(screen.getByText("50%")).toBeVisible();
  fireEvent.click(screen.getByRole("radio", { name: "₱0 original" }));
  expect(screen.queryByText("Undefined")).toBeNull();
  reveal();
  expect(screen.getByText("Undefined")).toBeVisible();
  expect(screen.getByRole("img")).toHaveAccessibleName(
    /Original ₱0. New ₱1,500/,
  );
  expect(screen.getByRole("region").textContent).not.toMatch(
    /correct answer|score|passed/i,
  );
});
it("blocks the ungraded comparison controls when the application is blocked", () => {
  render(<TransferSynthesis blocked />);
  expect(
    screen.getByRole("button", { name: "Reveal the comparison" }),
  ).toBeDisabled();
  screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());
});
it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
  "recaps the actual %s record and changes only presentation when concluding C04",
  (outcome) => {
    const base = props();
    const onIntent = vi.fn(),
      onPresented = vi.fn(),
      onReturnToLibrary = vi.fn();
    const p = props({
      onIntent,
      onPresented,
      onReturnToLibrary,
      frame: { ...base.frame, stateId: "COMPLETE", allowedLearnerIntents: [] },
      transfer: {
        original: "0",
        next: "1500",
        difference: "1500",
        explained: true,
      },
      transferRecord: {
        primary: { difference: "0", percentage: "100" },
        reasoning: "The learner's actual source-owned reasoning.",
        feedback: {
          id: "authentic-source-feedback",
          text: "Authentic delivered feedback.",
        },
        outcome,
      },
    });
    const view = render(<TransferExperience {...p} />);
    const record = screen.getByRole("region", {
      name: "Your recorded response",
    });
    expect(record).toHaveTextContent("₱0");
    expect(record).toHaveTextContent("100%");
    expect(record).toHaveTextContent(
      "The learner's actual source-owned reasoning.",
    );
    expect(record).toHaveTextContent("Authentic delivered feedback.");
    expect(record).toHaveTextContent(
      outcome === "CONFIRMED" ? "Confirmation" : "Reconsideration",
    );
    expect(
      screen.getByRole("region", { name: "What the relationship showed" }),
    ).toHaveTextContent("Undefined");
    expect(
      screen.queryByRole("button", { name: /Return to the Learning Library/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Percentage Change Ideas Together →",
      }),
    );
    expect(
      screen.getByRole("heading", { name: /The change tells a story/ }),
    ).toHaveFocus();
    expect(
      screen.getByRole("region", { name: "Percentage change connections" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Your recorded response" }),
    ).toBeNull();
    expect(view.container.textContent).not.toMatch(
      /mastery|perfect score|all four activities completed/i,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "See it in everyday life →" }),
    );
    expect(
      screen.queryByRole("region", { name: "Percentage change connections" }),
    ).toBeNull();
    expect(screen.getByRole("heading", { name: "At the shop" })).toHaveFocus();
    fireEvent.click(
      screen.getByRole("button", { name: "← Back to ideas together" }),
    );
    expect(
      screen.getByRole("region", { name: "Percentage change connections" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "← Back to your recap" }),
    );
    expect(
      screen.getByRole("region", { name: "Your recorded response" }),
    ).toHaveTextContent("100%");
    view.rerender(<TransferExperience {...p} blocked />);
    expect(
      screen.getByRole("button", {
        name: "Percentage Change Ideas Together →",
      }),
    ).toBeDisabled();
    view.rerender(<TransferExperience {...p} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Percentage Change Ideas Together →",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Return to the Learning Library →" }),
    );
    expect(onReturnToLibrary).toHaveBeenCalledOnce();
    expect(onIntent).not.toHaveBeenCalled();
    expect(onPresented).not.toHaveBeenCalled();
  },
);
it("does not infer a record or synthesize an interpretation when completion projections are missing", () => {
  const base = props();
  render(
    <TransferExperience
      {...base}
      frame={{ ...base.frame, stateId: "COMPLETE", allowedLearnerIntents: [] }}
    />,
  );
  expect(screen.getByText(/No result has been inferred/)).toBeVisible();
  expect(
    screen.queryByRole("region", { name: "What the relationship showed" }),
  ).toBeNull();
});
const fields = [
  {
    role: "difference",
    required: true,
    acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
    quantityKind: "MONETARY_AMOUNT",
    unit: "PHP",
    basis: "per month",
  },
  {
    role: "percentage",
    required: true,
    acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
    quantityKind: "PERCENTAGE_CHANGE",
    unit: "%",
    basis: null,
  },
];
const props = (extra: Partial<C04Presentation> = {}): C04Presentation => ({
  blocked: false,
  onIntent: vi.fn(),
  onSelect: vi.fn(),
  fields,
  transfer: { original: "0", next: "1500", difference: null, explained: false },
  frame: {
    activityId: "C04-A04",
    stateId: "ACTIVE",
    responseStage: "PRIMARY",
    contentReferences: [],
    exposedModelFacts: [],
    exposedDerivedFacts: [],
    allowedLearnerIntents: ["COMMIT_PRIMARY_RESPONSE"],
  },
  ...extra,
});
it("withholds reasoning, terminal mathematics and answer-bearing accessibility until authorized", () => {
  const { container } = render(<TransferExperience {...props()} />);
  expect(screen.queryByRole("radio")).toBeNull();
  expect(container.querySelector("[data-terminal]")).toBeNull();
  expect(container.textContent).not.toMatch(
    /division by zero|percentage is undefined|₱1,500 − ₱0|100%/,
  );
  expect(
    container.querySelector("[data-zero-bar]")?.getAttribute("width"),
  ).toBe("0");
  expect(
    screen.getByRole("button", { name: "Commit my calculation →" }),
  ).toBeDisabled();
});
it("does not disclose missing model facts through accessible labels or zero geometry", () => {
  const { container } = render(
    <TransferExperience
      {...props({
        transfer: {
          original: null,
          next: null,
          difference: null,
          explained: false,
        },
      })}
    />,
  );
  const scale = screen.getByRole("group", { name: /Original allowance/ });
  expect(scale).toHaveAccessibleName(
    "Original allowance not exposed. New allowance not exposed. Both use the same peso scale.",
  );
  expect(container.querySelector("svg")?.textContent).not.toContain("1,500");
  expect(container.textContent).not.toContain(
    "The original mark has no length.",
  );
  expect(
    container.querySelector("[data-zero-bar]")?.nextElementSibling?.tagName,
  ).not.toBe("path");
});
it("restores a learner-selected boundary without grading or preselecting reasoning", () => {
  const intent = vi.fn();
  const onDraft = vi.fn();
  render(
    <TransferExperience
      {...props({
        responseDraft: { difference: "1500", percentage: "UNDEFINED" },
        onIntent: intent,
        onDraft,
      })}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Commit my calculation →" }),
  );
  expect(intent).toHaveBeenCalledWith("COMMIT_PRIMARY_RESPONSE");
  expect(onDraft).not.toHaveBeenCalled();
});
it("does not steal restored support focus when the learning step is unchanged", () => {
  const base = props();
  const p = {
    ...base,
    frame: { ...base.frame, allowedLearnerIntents: ["OPEN_SUPPORT" as const] },
  };
  const view = render(<TransferExperience {...p} />);
  view.rerender(<TransferExperience {...p} blocked />);
  const invoker = screen.getByRole("button", {
    name: "Review the relationship",
  });
  view.rerender(<TransferExperience {...p} />);
  invoker.focus();
  view.rerender(<TransferExperience {...p} blocked />);
  view.rerender(<TransferExperience {...p} />);
  expect(invoker).toHaveFocus();
});
it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
  "delivers authentic %s feedback from connected content without terminal teaching",
  (outcome) => {
    const presented = vi.fn();
    const base = props();
    const { container } = render(
      <TransferExperience
        {...base}
        onPresented={presented}
        frame={{
          ...base.frame,
          stateId: outcome === "CONFIRMED" ? "CONFIRMATION" : "RECONSIDERATION",
          feedbackState: {
            outcome,
            content: { id: "source", text: "Exact source feedback" },
          },
          allowedLearnerIntents: ["CONTINUE"],
        }}
      />,
    );
    expect(presented).toHaveBeenCalledWith(
      "feedback",
      container.querySelector("[data-feedback]"),
    );
    expect(container.querySelector("[data-terminal]")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Finish activity" }),
    ).toBeNull();
  },
);
it("requires the actual terminal passage and suppresses receipt under a blocking barrier", () => {
  const base = props(),
    presented = vi.fn();
  const p = {
    ...base,
    onPresented: presented,
    frame: {
      ...base.frame,
      stateId: "POST_CONFIRMATION_EXPLANATION" as const,
      allowedLearnerIntents: [],
      contentReferences: [
        {
          id: "c04/S04/undefined-result",
          text: "Exact authorized terminal teaching",
        },
      ],
    },
  };
  const view = render(<TransferExperience {...p} blocked />);
  expect(presented).not.toHaveBeenCalled();
  view.rerender(<TransferExperience {...p} />);
  const terminal = view.container.querySelector("[data-terminal]");
  expect(terminal?.textContent).toContain("Exact authorized terminal teaching");
  expect(presented).toHaveBeenCalledWith("terminal", terminal);
});
