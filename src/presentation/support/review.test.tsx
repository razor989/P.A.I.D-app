// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ReviewSurface, SourceReviewSurface, SupportRegion } from "./public";
import type { ReviewContent, SourceReviewContent } from "./public";

afterEach(cleanup);
const origin = {
  receivingActivityId: "C04-A01",
  invokingPhase: "REVISION",
  returnTo: "REVISION",
} as const;
const review: ReviewContent = {
  origin,
  relationships: [
    { id: "relationship", text: "Synthetic trusted relationship" },
  ],
};
const source: SourceReviewContent = {
  origin,
  sourceRecordId: "synthetic-source",
  providerCompetencyId: "synthetic-provider",
  exposedFields: [{ id: "approved-field", text: "Synthetic permitted field" }],
};

it("preserves exact trusted Review origin and read-only relationships without navigation", async () => {
  const onClose = vi.fn();
  const url = location.href;
  const historyLength = history.length;
  render(
    <ReviewSurface
      review={review}
      closeLabel="Close Review"
      onClose={onClose}
    />,
  );
  expect(
    screen
      .getByText("Synthetic trusted relationship")
      .getAttribute("data-field-id"),
  ).toBe("relationship");
  expect(document.querySelector("input, textarea, select, a")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button"));
  expect(onClose).toHaveBeenCalledExactlyOnceWith({ mode: "REVIEW", origin });
  expect(location.href).toBe(url);
  expect(history.length).toBe(historyLength);
});

it("renders only explicit source fields, never extra raw properties or unsafe markup", async () => {
  const onClose = vi.fn();
  const extra = {
    ...source,
    hiddenAnswer: "FORBIDDEN_ANSWER",
    providerRecord: { secret: "PRIVATE_PROVIDER" },
    exposedFields: [
      {
        id: "approved-field",
        text: "<script>synthetic plain text</script>",
        hidden: "FORBIDDEN_FIELD",
      },
    ],
  };
  const view = render(
    <SourceReviewSurface
      sourceReview={extra}
      closeLabel="Return"
      onClose={onClose}
    />,
  );
  expect(view.container.innerHTML).not.toMatch(/FORBIDDEN|PRIVATE_PROVIDER/);
  expect(
    view.container.querySelector("script, input, textarea, select"),
  ).toBeNull();
  expect(
    screen
      .getByText("<script>synthetic plain text</script>")
      .getAttribute("data-field-id"),
  ).toBe("approved-field");
  expect(screen.getByText("synthetic-source")).toBeTruthy();
  expect(screen.getByText("synthetic-provider")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button"));
  expect(onClose).toHaveBeenCalledExactlyOnceWith({
    mode: "SOURCE_REVIEW",
    origin,
  });
});

it("expanded support leaves state and duplicate close requests with the caller", async () => {
  const close = vi.fn();
  const view = render(
    <SupportRegion
      presentation="expanded"
      support={{ mode: "SOURCE_REVIEW", content: source }}
      title="Synthetic support"
      description="Read-only"
      closeLabel="Close"
      onClose={close}
    />,
  );
  expect(screen.getByRole("complementary")).toBeTruthy();
  await userEvent.setup().dblClick(screen.getByRole("button"));
  expect(close).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Synthetic permitted field")).toBeTruthy();
  view.rerender(
    <SupportRegion
      presentation="expanded"
      support={null}
      title="Synthetic support"
      description="Read-only"
      closeLabel="Close"
      onClose={close}
    />,
  );
  expect(view.container.innerHTML).toBe("");
});
