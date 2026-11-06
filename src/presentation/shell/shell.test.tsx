// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { ShellProps } from "./public";

afterEach(cleanup);
it.each([
  ["C04-A01", "C04-A01", "C04-A01-elicit-engage-v4", true],
  ["C04-A01", "C04-A01", "C04-A01-guided-prepare-v3", false],
  ["C04-A01", "C04-A01", "C04-A01-interpretation-v1", false],
  ["C04-A01", "C04-A01", undefined, false],
  ["C04-A01", "C04-A02", "C04-A01-elicit-engage-v4", false],
  ["C04-A03", "C04-A01", "C04-A01-elicit-engage-v4", false],
  ["C04-A04", "C04-A01", "C04-A01-elicit-engage-v4", false],
  ["C04-A02", "C04-A02", undefined, true],
  ["C04-A03", "C04-A03", undefined, true],
  ["C04-A04", "C04-A04", undefined, true],
  ["C04-A04", "C04-A03", undefined, false],
  ["C04-A03", "C04-A02", undefined, false],
] as const)(
  "bounds reference shell styling to the route and exact contract: %s / %s / %s",
  (activityId, projectedActivityId, contract, expected) => {
    const p = props();
    const view = render(
      <AppShell
        {...p}
        destination={{ kind: "activity", activityId }}
        c04Presentation={{
          frame: {
            activityId: projectedActivityId,
            stateId: "ENTRY",
            contentReferences: [],
            exposedModelFacts: [],
            exposedDerivedFacts: [],
            allowedLearnerIntents: [],
          },
          ...(contract ? { prepareContractId: contract } : {}),
          blocked: false,
          onIntent: vi.fn(),
          onSelect: vi.fn(),
        }}
      />,
    );
    expect(
      view.container.firstElementChild?.hasAttribute("data-reference-activity"),
    ).toBe(expected);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.tabIndex).toBe(-1);
    heading.focus();
    expect(document.activeElement).toBe(heading);
    view.rerender(
      <AppShell
        {...p}
        destination={{ kind: "competency", competencyId: "C04" }}
      />,
    );
    expect(
      view.container.firstElementChild?.hasAttribute("data-reference-activity"),
    ).toBe(false);
  },
);
it("keeps fresh A01 navigation and keyboard skip authentic with the reference shell", async () => {
  const p = props();
  render(
    <AppShell
      {...p}
      destination={{ kind: "activity", activityId: "C04-A01" }}
      c04Presentation={{
        frame: {
          activityId: "C04-A01",
          stateId: "ENTRY",
          contentReferences: [],
          exposedModelFacts: [],
          exposedDerivedFacts: [],
          allowedLearnerIntents: [],
        },
        prepareContractId: "C04-A01-elicit-engage-v4",
        blocked: false,
        onIntent: vi.fn(),
        onSelect: vi.fn(),
      }}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Learning Library" }));
  expect(p.onBack).toHaveBeenCalledOnce();
  expect(p.onReturn).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("link", { name: "Skip to main content" }));
  expect(document.activeElement).toBe(screen.getByRole("main"));
});
it("returns focus from completed review to its distinct trigger, with heading fallback", () => {
  const p = props();
  const view = render(
    <AppShell
      {...p}
      completedReview
      destination={{ kind: "activity", activityId: "C04-A02" }}
    />,
  );
  view.rerender(
    <AppShell
      {...p}
      completedReview={false}
      destination={{ kind: "competency", competencyId: "C04" }}
      onReviewCompleted={vi.fn()}
    />,
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Review completed activity" }),
  );
  view.rerender(
    <AppShell
      {...p}
      completedReview
      destination={{ kind: "activity", activityId: "C04-A02" }}
    />,
  );
  view.rerender(
    <AppShell
      {...p}
      completedReview={false}
      destination={{ kind: "competency", competencyId: "C04" }}
    />,
  );
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { level: 1 }),
  );
});

it("does not forward a stale C04 response route to another activity", () => {
  const p = props();
  render(
    <AppShell
      {...p}
      destination={{ kind: "activity", activityId: "C04-A03" }}
      c04Presentation={{
        frame: {
          activityId: "C04-A01",
          stateId: "ACTIVE",
          contentReferences: [{ id: "stale", text: "STALE_RESPONSE_ROUTE" }],
          exposedModelFacts: [],
          exposedDerivedFacts: [],
          allowedLearnerIntents: [],
        },
        blocked: false,
        onIntent: vi.fn(),
        onSelect: vi.fn(),
      }}
    />,
  );
  expect(screen.queryByText("STALE_RESPONSE_ROUTE")).toBeNull();
});

it("T044 forwards a matching optional projection only through the activity route", () => {
  const p = props();
  const view = render(
    <AppShell
      {...p}
      destination={{ kind: "activity", activityId: "C04-A02" }}
      c04Presentation={{
        frame: {
          activityId: "C04-A02",
          stateId: "EXP-01",
          contentReferences: [{ id: "authorized", text: "Issued stage prose" }],
          exposedModelFacts: [],
          exposedDerivedFacts: [],
          allowedLearnerIntents: [],
        },
        blocked: false,
        onIntent: vi.fn(),
        onSelect: vi.fn(),
      }}
    />,
  );
  // A02's source renderer does not parse prose to manufacture missing quantities.
  expect(
    screen
      .getAllByRole("status")
      .some((element) => element.textContent?.includes("do not authorize")),
  ).toBe(true);
  expect(screen.queryByText("Issued stage prose")).toBeNull();
  view.rerender(<AppShell {...p} />);
  expect(screen.queryByText("Issued stage prose")).toBeNull();
});
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
    canLeaveLesson: true,
    onLeaveLesson: vi.fn(),
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
  await user.click(screen.getByRole("radio", { name: "Explore and Learn" }));
  await user.click(
    screen.getByRole("button", { name: /^Start Explore and Learn/ }),
  );
  expect(p.onActivity).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(
    screen
      .getAllByRole("status")
      .filter((status) => status.textContent === "Please wait."),
  ).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Percentage Change",
  );
});
