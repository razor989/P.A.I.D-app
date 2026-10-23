// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SystemRecoverySurface } from "./public";

afterEach(cleanup);

it("keeps technical status distinct and calls only explicit authorized actions", async () => {
  const retry = vi.fn();
  const destructive = vi.fn();
  const view = render(
    <SystemRecoverySurface
      title="Synthetic technical status"
      status="Synthetic storage unavailable"
      explanation="Supplied safe explanation"
      actions={[
        { id: "retry", label: "Retry", onAction: retry },
        { id: "reset", label: "Reset", onAction: destructive, disabled: true },
      ]}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe(
    "Synthetic storage unavailable",
  );
  expect(screen.queryByText("Information Needed")).toBeNull();
  expect(screen.queryByText("Reconsideration")).toBeNull();
  expect(retry).not.toHaveBeenCalled();
  expect(destructive).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole("button", { name: "Reset" }));
  expect(destructive).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(destructive).not.toHaveBeenCalled();
});
