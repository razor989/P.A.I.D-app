// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { ShellProps } from "./public";

afterEach(cleanup);
function props(): ShellProps {
  return {
    destination: { kind: "library" },
    competencies: [
      {
        id: "C04",
        label: "Percentage Change",
        available: true,
        activities: [
          { id: "C04-A02", label: "Explore and Learn", available: true },
        ],
      },
    ],
    blocked: false,
    notice: null,
    canBack: true,
    canReturn: true,
    onBack: vi.fn(),
    onReturn: vi.fn(),
    onCompetency: vi.fn(),
    onActivity: vi.fn(),
    switchChoice: null,
  };
}
it("provides one main, destination title and working keyboard skip link without route state", async () => {
  document.title = "P.A.I.D. — Startup";
  const p = props();
  const view = render(<AppShell {...p} />);
  expect(document.title).toBe("P.A.I.D. — Learning Library");
  expect(screen.getAllByRole("main")).toHaveLength(1);
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "Skip to main content" }),
  );
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("main"));
  await user.click(screen.getByRole("button", { name: "Percentage Change" }));
  expect(p.onCompetency).toHaveBeenCalledWith("C04");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Learning Library",
  );
  view.rerender(
    <AppShell
      {...p}
      destination={{ kind: "competency", competencyId: "C04" }}
    />,
  );
  expect(document.title).toBe("P.A.I.D. — Percentage Change");
  view.rerender(
    <AppShell
      {...p}
      destination={{ kind: "activity", activityId: "C04-A02" }}
    />,
  );
  expect(document.title).toBe(
    "P.A.I.D. — Percentage Change — Explore and Learn",
  );
  expect(screen.getByText(/does not provide a lesson/)).toBeDefined();
  expect(document.querySelector('[tabindex="1"]')).toBeNull();
  view.unmount();
  expect(document.title).toBe("P.A.I.D. — Startup");
});
it("keeps technical barriers and switch decisions separate from the destination", async () => {
  const p = props();
  const onCancel = vi.fn();
  render(
    <AppShell
      {...p}
      destination={{ kind: "competency", competencyId: "C04" }}
      blocked
      canBack
      onBack={onCancel}
      canReturn={false}
      notice="Please wait."
      switchChoice={{
        canReturn: false,
        canAbandon: false,
        onReturn: vi.fn(),
        onAbandon: vi.fn(),
      }}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Explore and Learn" }));
  expect(p.onActivity).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("Please wait.");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Percentage Change",
  );
});
