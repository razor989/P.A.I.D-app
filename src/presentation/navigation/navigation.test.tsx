// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityId } from "@/core/public";
import { AppShell } from "../shell/AppShell";
import type {
  CompetencySummary,
  Destination,
  ShellProps,
} from "../shell/public";
import { FloatingLessonNav } from "./FloatingLessonNav";
import { LessonExit, LessonMasthead, LessonNavigationProvider } from "./slot";
import { ENTRY_SETTLE, IDLE_DELAY, SCROLL_THRESHOLD } from "./useIslandState";

const steps = ["Prepare", "Explore and Learn", "Apply", "Check and Transfer"];
const competencies: CompetencySummary[] = [
  {
    id: "C04",
    label: "Percentage Change",
    available: true,
    activities: steps.map((label, i) => ({
      id: `C04-A0${i + 1}` as ActivityId,
      label,
      available: true,
    })),
  },
];
const lesson: Destination = {
  kind: "activity",
  activityId: "C04-A02" as ActivityId,
};

function props(extra: Partial<ShellProps> = {}) {
  return {
    destination: lesson,
    competencies,
    blocked: false,
    notice: null,
    canBack: true,
    canReturn: false,
    onBack: vi.fn(),
    onReturn: vi.fn(),
    canLeaveLesson: true,
    onLeaveLesson: vi.fn(),
    onCompetency: vi.fn(),
    onActivity: vi.fn(),
    switchChoice: null,
    ...extra,
  } satisfies ShellProps;
}

const dock = () => document.querySelector<HTMLElement>("[data-floating-nav]")!;
const island = () =>
  screen.getByRole("button", { name: "Open lesson navigation", hidden: true });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("floating lesson navigation", () => {
  it("replaces the lesson header with the floating composition, keeping Back", () => {
    const p = props();
    render(<AppShell {...p} />);
    expect(dock()).toHaveAttribute("data-mode", "expanded");
    expect(screen.getByText("p.a.i.d.")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Lesson navigation" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(p.onBack).toHaveBeenCalledOnce();
    // The current lesson is marked, truthfully and without being a control.
    const current = nav.querySelector('[aria-current="page"]');
    expect(current).toHaveTextContent("02Percentage ChangeExplore and Learn");
    expect(current?.closest("button")).toBeNull();
    // The Session never allows Learning Library from a lesson; no dead control.
    expect(
      screen.queryByRole("button", { name: "Learning Library" }),
    ).toBeNull();
  });

  it("offers Learning Library whenever the Session allows it", () => {
    const p = props({ canReturn: true });
    render(<AppShell {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Learning Library" }));
    expect(p.onReturn).toHaveBeenCalledOnce();
  });

  it.each(steps.map((_, i) => `C04-A0${i + 1}` as ActivityId))(
    "presents one consistent lesson exit in %s, following the Session",
    async (activityId) => {
      const p = props({ destination: { kind: "activity", activityId } });
      const view = render(<AppShell {...p} />);
      const exit = await screen.findByRole("button", {
        name: "Return to Learning Library",
      });
      expect(exit).toBeEnabled();
      expect(exit).toHaveAccessibleDescription(
        /Unfinished work stays ready to resume\./,
      );
      fireEvent.click(exit);
      expect(p.onLeaveLesson).toHaveBeenCalledOnce();
      view.rerender(<AppShell {...p} canLeaveLesson={false} />);
      expect(
        screen.getByRole("button", { name: "Return to Learning Library" }),
      ).toBeDisabled();
    },
  );

  it("keeps the accepted header on the Library and galleries", () => {
    render(
      <AppShell
        {...props({ destination: { kind: "competency", competencyId: "C04" } })}
      />,
    );
    expect(dock()).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Application navigation" }),
    ).toBeInTheDocument();
  });
});

describe("lesson slot", () => {
  const world = { world: "#2f5a45", deep: "#1f3d30", soft: "#dde6cc" };
  const place = {
    competency: "Percentage Change",
    activity: "Apply",
    number: "03",
    world,
  };
  const nav = (
    <FloatingLessonNav
      place={place}
      identity="a"
      canBack
      canReturn={false}
      onBack={() => {}}
      onReturn={() => {}}
    />
  );

  it("moves a lesson's own exit button into the raised action, unchanged", () => {
    const onClick = vi.fn();
    render(
      <LessonNavigationProvider>
        {nav}
        <LessonMasthead>
          <header>masthead</header>
        </LessonMasthead>
        <LessonExit hint="Leave here to return to your activities.">
          <button onClick={onClick}>Leave lesson for Learning Library</button>
        </LessonExit>
      </LessonNavigationProvider>,
    );
    const button = screen.getByRole("button", {
      name: "Leave lesson for Learning Library",
    });
    expect(dock()).toContainElement(button);
    expect(button).toHaveAccessibleDescription(
      "Leave here to return to your activities.",
    );
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText("masthead")).toBeNull();
    expect(document.querySelector("[data-lesson-spacer]")).toBeInTheDocument();
  });

  it("keeps the original strip and masthead for a lesson rendered on its own", () => {
    render(
      <>
        <LessonMasthead>
          <header>masthead</header>
        </LessonMasthead>
        <LessonExit hint="hint" className="strip">
          <button>Return to Learning Library</button>
        </LessonExit>
      </>,
    );
    expect(screen.getByText("masthead")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Leave the lesson" }),
    ).toContainElement(
      screen.getByRole("button", { name: "Return to Learning Library" }),
    );
  });
});

describe("island behaviour", () => {
  const scrollTo = (y: number) => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel"));
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
    });
  };
  const settle = () =>
    act(() => {
      vi.advanceTimersByTime(ENTRY_SETTLE + 50);
    });
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 5000,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 1000,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(document.documentElement, "scrollHeight");
    Reflect.deleteProperty(window, "scrollY");
  });

  it("ignores the app's own scrolling while a lesson settles", () => {
    render(<AppShell {...props()} />);
    scrollTo(0);
    expect(dock()).toHaveAttribute("data-mode", "expanded");
  });

  it("ignores programmatic scrolling that follows no learner input", () => {
    render(<AppShell {...props()} />);
    settle();
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 600,
    });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
    });
    expect(dock()).toHaveAttribute("data-mode", "expanded");
  });

  it("compacts on a deliberate upward scroll, ignoring small movement", () => {
    render(<AppShell {...props()} />);
    settle();
    scrollTo(1000 - (SCROLL_THRESHOLD - 10));
    expect(dock()).toHaveAttribute("data-mode", "expanded");
    scrollTo(1000 - SCROLL_THRESHOLD - 20);
    expect(dock()).toHaveAttribute("data-mode", "compact");
    expect(island()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("navigation", {
        name: "Lesson navigation",
        hidden: true,
      }),
    ).toHaveAttribute("inert");
  });

  it("expands again on a deliberate downward scroll after the lockout", () => {
    render(<AppShell {...props()} />);
    settle();
    scrollTo(950);
    expect(dock()).toHaveAttribute("data-mode", "compact");
    // Inside the lockout nothing changes, whatever the travel.
    scrollTo(1000);
    expect(dock()).toHaveAttribute("data-mode", "compact");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    scrollTo(1060);
    expect(dock()).toHaveAttribute("data-mode", "expanded");
  });

  it("softens the unused island after the idle delay and restores it on engagement", () => {
    render(<AppShell {...props()} />);
    settle();
    scrollTo(950);
    act(() => {
      vi.advanceTimersByTime(IDLE_DELAY - 100);
    });
    expect(dock()).not.toHaveAttribute("data-idle");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(dock()).toHaveAttribute("data-idle");
    fireEvent.pointerEnter(dock(), { pointerType: "mouse" });
    expect(dock()).not.toHaveAttribute("data-idle");
    fireEvent.pointerLeave(dock(), { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(IDLE_DELAY + 50);
    });
    expect(dock()).toHaveAttribute("data-idle");
  });

  it("opens from the island with focus on Back, and Escape returns to it", () => {
    render(<AppShell {...props()} />);
    settle();
    scrollTo(950);
    act(() => {
      fireEvent.click(island());
    });
    expect(dock()).toHaveAttribute("data-mode", "expanded");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Back" }),
    );
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      vi.advanceTimersByTime(50);
    });
    expect(dock()).toHaveAttribute("data-mode", "compact");
  });

  it("never hides a focused control because the page moved", () => {
    render(<AppShell {...props()} />);
    settle();
    screen.getByRole("button", { name: "Back" }).focus();
    scrollTo(900);
    expect(dock()).toHaveAttribute("data-mode", "expanded");
  });

  it("presents the expanded navigation again for a new lesson", () => {
    const view = render(<AppShell {...props()} />);
    settle();
    scrollTo(950);
    expect(dock()).toHaveAttribute("data-mode", "compact");
    view.rerender(
      <AppShell
        {...props({
          destination: {
            kind: "activity",
            activityId: "C04-A03" as ActivityId,
          },
        })}
      />,
    );
    expect(dock()).toHaveAttribute("data-mode", "expanded");
  });
});

describe("unfinished-activity decision", () => {
  const choice = (extra = {}) => ({
    canReturn: true,
    canAbandon: true,
    onReturn: vi.fn(),
    onAbandon: vi.fn(),
    unfinishedActivityId: "C04-A02" as ActivityId,
    selectedActivityId: "C04-A03" as ActivityId,
    ...extra,
  });
  const gallery: Destination = { kind: "competency", competencyId: "C04" };

  it("is a labelled modal naming both activities, focused on the safe choice", () => {
    const c = choice();
    render(<AppShell {...props({ destination: gallery, switchChoice: c })} />);
    const dialog = screen.getByRole("dialog", {
      name: "Explore and Learn isn’t finished yet",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/You chose to open Apply/);
    expect(dialog).toHaveTextContent(
      "Abandoning clears the work saved in Explore and Learn",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Return to unfinished activity" }),
    );
    expect(document.getElementById("paid-main")).toHaveAttribute("inert");
    expect(document.querySelector("header")).toHaveAttribute("inert");
    fireEvent.click(
      screen.getByRole("button", { name: "Return to unfinished activity" }),
    );
    expect(c.onReturn).toHaveBeenCalledOnce();
  });

  it("runs abandonment once however fast it is pressed", () => {
    const c = choice();
    render(<AppShell {...props({ destination: gallery, switchChoice: c })} />);
    const abandon = screen.getByRole("button", {
      name: "Abandon and open selected activity",
    });
    fireEvent.click(abandon);
    fireEvent.click(abandon);
    expect(c.onAbandon).toHaveBeenCalledOnce();
    expect(c.onReturn).not.toHaveBeenCalled();
  });

  it("cancels only through the existing Back decision (Not now or Escape)", () => {
    const p = props({ destination: gallery, switchChoice: choice() });
    const view = render(<AppShell {...p} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(p.onBack).toHaveBeenCalledOnce();
    view.unmount();
    const q = props({
      destination: gallery,
      switchChoice: choice(),
      canBack: false,
    });
    render(<AppShell {...q} />);
    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(q.onBack).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the decision", () => {
    render(
      <AppShell {...props({ destination: gallery, switchChoice: choice() })} />,
    );
    const notNow = screen.getByRole("button", { name: "Not now" });
    notNow.focus();
    fireEvent.keyDown(notNow, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Return to unfinished activity" }),
    );
  });

  it("returns focus to its opener when the switch is cancelled", () => {
    const p = props({ destination: gallery });
    const view = render(
      <>
        <button>Start Apply</button>
        <AppShell {...p} />
      </>,
    );
    const opener = screen.getByRole("button", { name: "Start Apply" });
    opener.focus();
    view.rerender(
      <>
        <button>Start Apply</button>
        <AppShell {...p} switchChoice={choice()} />
      </>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Return to unfinished activity" }),
    );
    view.rerender(
      <>
        <button>Start Apply</button>
        <AppShell {...p} />
      </>,
    );
    expect(document.activeElement).toBe(opener);
  });

  it("still offers the decision with generic wording when names are unknown", () => {
    render(
      <AppShell
        {...props({
          destination: gallery,
          switchChoice: choice({
            unfinishedActivityId: null,
            selectedActivityId: null,
          }),
        })}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "You have an unfinished activity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Abandon and open selected activity",
      }),
    ).toBeEnabled();
  });
});
