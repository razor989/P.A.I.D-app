// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FeedbackSurface, InformationNeededSurface } from "./public";

afterEach(cleanup);

it("distinguishes caller-owned outcomes without invalid-input semantics and removes stale exposure", () => {
  const view = render(
    <FeedbackSurface
      feedback={{
        outcome: "CONFIRMED",
        content: "Synthetic current confirmation",
      }}
    />,
  );
  expect(screen.getByRole("heading").textContent).toBe("Confirmation");
  expect(screen.getByRole("status").textContent).toContain(
    "Synthetic current confirmation",
  );
  view.rerender(
    <FeedbackSurface
      feedback={{
        outcome: "RECONSIDERATION",
        content: "Synthetic reconsideration",
      }}
    />,
  );
  expect(screen.getByRole("heading").textContent).toBe("Reconsideration");
  expect(view.container.innerHTML).not.toContain("aria-invalid");
  expect(view.container.innerHTML).not.toContain(
    "Synthetic current confirmation",
  );
  view.rerender(<FeedbackSurface feedback={null} />);
  expect(view.container.innerHTML).toBe("");
  view.rerender(
    <FeedbackSurface feedback={{ outcome: "CONFIRMED", content: " " }} />,
  );
  expect(view.container.innerHTML).toBe("");
});

it("requires an authorized Information Needed explanation and only invokes the supplied return", async () => {
  const onReturn = vi.fn();
  const view = render(<InformationNeededSurface information={null} />);
  expect(view.container.innerHTML).toBe("");
  view.rerender(
    <InformationNeededSurface
      information={{ explanation: "", returnLabel: "Return", onReturn }}
    />,
  );
  expect(view.container.innerHTML).toBe("");
  view.rerender(
    <InformationNeededSurface
      information={{
        explanation: "Synthetic authorized explanation",
        returnLabel: "Return to origin",
        onReturn,
      }}
    />,
  );
  expect(screen.getByRole("heading").textContent).toBe("Information Needed");
  expect(screen.queryByRole("alert")).toBeNull();
  await userEvent.setup().click(screen.getByRole("button"));
  expect(onReturn).toHaveBeenCalledTimes(1);
  expect(onReturn).toHaveBeenCalledWith();
});
