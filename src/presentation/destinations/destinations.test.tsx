// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CompetencyOverview } from "./CompetencyOverview";
import { LearningLibrary } from "./LearningLibrary";
import { ActivityHost } from "./ActivityHost";
import type { CompetencySummary } from "../shell/public";

afterEach(cleanup);
it("keeps retained Review separate from fresh opening and blocks it with the destination", async () => {
  const review = vi.fn(),
    select = vi.fn();
  const user = userEvent.setup();
  const c = {
    ...competency,
    activities: competency.activities.map((a) => ({ ...a, available: true })),
  };
  const view = render(
    <CompetencyOverview
      competency={c}
      blocked={false}
      onSelect={select}
      onReviewCompleted={review}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Review completed activity" }),
  );
  expect(review).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Explore and Learn" }));
  expect(select).toHaveBeenCalledWith("C04-A02");
  view.rerender(
    <CompetencyOverview
      competency={c}
      blocked
      onSelect={select}
      onReviewCompleted={review}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Review completed activity" }),
  );
  expect(review).toHaveBeenCalledTimes(1);
  view.rerender(
    <CompetencyOverview competency={c} blocked={false} onSelect={select} />,
  );
  expect(
    screen.queryByRole("button", { name: "Review completed activity" }),
  ).toBeNull();
});

it("T045 renders only matching C04 projections without the obsolete partial-feature note", () => {
  const presentation = {
    frame: {
      activityId: "C04-A01" as const,
      stateId: "ENTRY",
      contentReferences: [],
      exposedModelFacts: [],
      exposedDerivedFacts: [],
      allowedLearnerIntents: [],
    },
    blocked: false,
    onIntent: vi.fn(),
    onSelect: vi.fn(),
  };
  const view = render(
    <ActivityHost activityId="C04-A01" c04Presentation={presentation} />,
  );
  expect(
    screen.getByRole("heading", { name: "Two moments. One salary review." }),
  ).toBeDefined();
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.queryByRole("button", { name: /check|finish/i })).toBeNull();
  view.rerender(
    <ActivityHost activityId="C04-A03" c04Presentation={presentation} />,
  );
  expect(
    screen.queryByRole("heading", { name: "Two moments. One salary review." }),
  ).toBeNull();
  view.rerender(
    <ActivityHost activityId="C01-A01" c04Presentation={presentation} />,
  );
  expect(screen.getByRole("heading", { name: "Activity host" })).toBeDefined();
});
const competency: CompetencySummary = {
  id: "C04",
  label: "Percentage Change",
  available: true,
  activities: [
    { id: "C04-A01", label: "Prepare", available: true },
    { id: "C04-A02", label: "Explore and Learn", available: false },
  ],
};
it("separates catalog membership from available guarded actions", async () => {
  const select = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <CompetencyOverview
      competency={competency}
      blocked={false}
      onSelect={select}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Explore and Learn" }));
  expect(select).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Prepare" }));
  expect(select).toHaveBeenCalledWith("C04-A01");
  expect(
    screen.getByText("Not available in the current Session."),
  ).toBeDefined();
  view.rerender(
    <CompetencyOverview competency={competency} blocked onSelect={select} />,
  );
  await user.click(screen.getByRole("button", { name: "Prepare" }));
  expect(select).toHaveBeenCalledTimes(1);
});
it("renders canonical competency identity without exposing instructional content", async () => {
  const select = vi.fn();
  render(
    <LearningLibrary
      competencies={[competency]}
      blocked={false}
      onSelect={select}
    />,
  );
  expect(screen.getByText("C04")).toBeDefined();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Percentage Change" }));
  expect(select).toHaveBeenCalledWith("C04");
});
it("activity host has no fabricated response, model, completion or assessment controls", () => {
  render(<ActivityHost activityId="C04-A02" />);
  expect(screen.getByText("C04-A02")).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("main")).toBeNull();
});
