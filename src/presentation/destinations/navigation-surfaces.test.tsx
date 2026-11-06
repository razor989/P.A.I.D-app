// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningLibrary } from "./LearningLibrary";
import { ActivityGallery } from "./gallery/ActivityGallery";
import { initialFeatured } from "./gallery/featured";
import { SLIDE_INTERVAL_MS } from "./library/useSlideshow";
import { activityStory } from "./content";
import { DestinationView } from "../shell/DestinationView";
import type { ActivityId } from "@/core/public";
import type {
  CompetencySummary,
  LearnerContinuation,
  ShellProps,
} from "../shell/public";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const activities = (prefix: "C03" | "C04" | "C06", available = true) =>
  (
    ["Prepare", "Explore and Learn", "Apply", "Check and Transfer"] as const
  ).map((label, i) => ({
    id: `${prefix}-A0${i + 1}` as ActivityId,
    label,
    available,
  }));
const library: CompetencySummary[] = [
  {
    id: "C01",
    label: "Gross Income",
    available: true,
    offered: false,
    activities: [{ id: "C01-A01", label: "Prepare", available: false }],
  },
  {
    id: "C03",
    label: "Overtime Pay",
    available: true,
    offered: true,
    activities: activities("C03"),
  },
  {
    id: "C04",
    label: "Percentage Change",
    available: true,
    offered: true,
    activities: activities("C04"),
  },
  {
    id: "C06",
    label: "Commission",
    available: true,
    offered: true,
    activities: activities("C06"),
  },
];
const none: LearnerContinuation = {
  resume: null,
  upNext: null,
  completedThisSession: [],
};
const visibleSlideTitle = () =>
  screen
    .getAllByRole("tabpanel")
    .map(
      (panel) => within(panel).getByRole("heading", { level: 2 }).textContent,
    );

describe("Learning Library", () => {
  it("lists only offered competencies and keeps the collection an independent route", async () => {
    const onSelect = vi.fn();
    render(
      <LearningLibrary
        competencies={library}
        continuation={none}
        blocked={false}
        onSelect={onSelect}
        onActivity={vi.fn()}
      />,
    );
    const list = screen.getByRole("list", { name: "Competencies" });
    expect(
      within(list)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Overtime Pay", "Percentage Change", "Commission"]);
    expect(screen.queryByText("Gross Income")).toBeNull();
    expect(screen.queryByText(/C04-A0/)).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Commission" }));
    expect(onSelect).toHaveBeenCalledWith("C06");
  });

  it("keeps heading, artwork and entrance synchronised across manual slide changes", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <LearningLibrary
        competencies={library}
        blocked={false}
        onSelect={onSelect}
      />,
    );
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
    await user.click(screen.getByRole("button", { name: "Next competency" }));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
    await user.click(
      screen.getByRole("button", { name: "Enter Percentage Change" }),
    );
    expect(onSelect).toHaveBeenCalledWith("C04");
    const tab = screen.getByRole("tab", { name: /Percentage Change/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    tab.focus();
    await user.keyboard("{ArrowRight}");
    expect(visibleSlideTitle()).toEqual(["Every sale carries a share."]);
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: /Commission/ }),
    );
    await user.keyboard("{Home}");
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
    await user.click(
      screen.getByRole("button", { name: "Previous competency" }),
    );
    expect(visibleSlideTitle()).toEqual(["Every sale carries a share."]);
  });

  it("autoplays at a fixed interval, pauses on request and stops after manual choice", () => {
    vi.useFakeTimers();
    render(
      <LearningLibrary
        competencies={library}
        blocked={false}
        onSelect={vi.fn()}
      />,
    );
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
    fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 3));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
    fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }));
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["Every sale carries a share."]);
    // Manual selection is never overridden by a later automatic advance.
    fireEvent.click(screen.getByRole("tab", { name: /Overtime Pay/ }));
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 3));
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
    expect(
      screen.getByRole("button", { name: "Play slideshow" }),
    ).toBeDefined();
  });

  // React derives onPointerEnter/onPointerLeave from pointerover/pointerout.
  const pointer = (
    type: "pointerenter" | "pointerleave",
    target: Element,
    pointerType: "mouse" | "touch",
  ) => {
    const event = new Event(
      type === "pointerenter" ? "pointerover" : "pointerout",
      { bubbles: true },
    );
    Object.defineProperty(event, "pointerType", { value: pointerType });
    Object.defineProperty(event, "relatedTarget", { value: document.body });
    fireEvent(target, event);
  };

  it("holds autoplay only while a mouse rests on the hero's controls", () => {
    vi.useFakeTimers();
    render(
      <LearningLibrary
        competencies={library}
        blocked={false}
        onSelect={vi.fn()}
      />,
    );
    const controls = screen.getByRole("tablist").parentElement!;
    // A cursor resting on the headline or artwork never freezes the show.
    const copy = screen.getByRole("heading", {
      name: "When the workday runs long.",
    });
    pointer("pointerenter", copy, "mouse");
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
    // Mouse over the controls holds it; leaving resumes it.
    pointer("pointerenter", controls, "mouse");
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
    pointer("pointerleave", controls, "mouse");
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["Every sale carries a share."]);
    // Touch has no matching "leave", so it never holds.
    pointer("pointerenter", controls, "touch");
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
  });

  it("resumes when Play is pressed even though focus stays on it", () => {
    vi.useFakeTimers();
    render(
      <LearningLibrary
        competencies={library}
        blocked={false}
        onSelect={vi.fn()}
      />,
    );
    const pause = screen.getByRole("button", { name: "Pause slideshow" });
    pause.focus();
    fireEvent.click(pause);
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2));
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
    const play = screen.getByRole("button", { name: "Play slideshow" });
    expect(document.activeElement).toBe(play);
    fireEvent.click(play);
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
  });

  it("holds autoplay while keyboard focus is on another hero control", () => {
    vi.useFakeTimers();
    render(
      <LearningLibrary
        competencies={library}
        blocked={false}
        onSelect={vi.fn()}
      />,
    );
    void act(() => screen.getByRole("tab", { name: /Overtime Pay/ }).focus());
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2));
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
    void act(() => screen.getByRole("tab", { name: /Overtime Pay/ }).blur());
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(visibleSlideTitle()).toEqual(["Every change has a starting point."]);
  });

  it("disables every control and holds autoplay while navigation is blocked", () => {
    vi.useFakeTimers();
    render(
      <LearningLibrary competencies={library} blocked onSelect={vi.fn()} />,
    );
    for (const control of [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("tab"),
    ])
      expect((control as HTMLButtonElement).disabled).toBe(true);
    void act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2));
    expect(visibleSlideTitle()).toEqual(["When the workday runs long."]);
  });

  it("offers resume, up-next or a first-visit start only from the continuation view", async () => {
    const onActivity = vi.fn(),
      onSelect = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <LearningLibrary
        competencies={library}
        continuation={none}
        blocked={false}
        onSelect={onSelect}
        onActivity={onActivity}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Every journey starts somewhere." }),
    ).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: "Begin with Overtime Pay" }),
    );
    expect(onSelect).toHaveBeenLastCalledWith("C03");
    view.rerender(
      <LearningLibrary
        competencies={library}
        continuation={{
          resume: { competencyId: "C04", activityId: "C04-A02" },
          upNext: null,
          completedThisSession: [],
        }}
        blocked={false}
        onSelect={onSelect}
        onActivity={onActivity}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Pick up where you left off." }),
    ).toBeDefined();
    expect(
      screen.getByRole("listitem", { current: "step" }).textContent,
    ).toContain("Explore and Learn");
    await user.click(
      screen.getByRole("button", { name: "Resume Explore and Learn" }),
    );
    expect(onActivity).toHaveBeenLastCalledWith("C04-A02");
    view.rerender(
      <LearningLibrary
        competencies={library}
        continuation={{
          resume: null,
          upNext: { competencyId: "C03", activityId: "C03-A03" },
          completedThisSession: ["C03-A02"],
        }}
        blocked={false}
        onSelect={onSelect}
        onActivity={onActivity}
      />,
    );
    expect(screen.getByText(/You finished/).textContent).toContain(
      "Explore and Learn",
    );
    await user.click(screen.getByRole("button", { name: "Start Apply" }));
    expect(onActivity).toHaveBeenLastCalledWith("C03-A03");
  });
});

describe("C04 activity gallery", () => {
  const c04 = library[2]!;
  it("chooses the initial featured activity from resume, then up-next, then availability", () => {
    expect(initialFeatured(c04, none)).toBe(0);
    expect(
      initialFeatured(c04, {
        ...none,
        upNext: { competencyId: "C04", activityId: "C04-A03" },
      }),
    ).toBe(2);
    expect(
      initialFeatured(c04, {
        resume: { competencyId: "C04", activityId: "C04-A04" },
        upNext: { competencyId: "C04", activityId: "C04-A03" },
        completedThisSession: [],
      }),
    ).toBe(3);
    // Another competency's progress never moves this gallery.
    expect(
      initialFeatured(c04, {
        ...none,
        resume: { competencyId: "C03", activityId: "C03-A02" },
      }),
    ).toBe(0);
    expect(
      initialFeatured(
        {
          ...c04,
          activities: c04.activities.map((a, i) => ({
            ...a,
            available: i > 1,
          })),
        },
        none,
      ),
    ).toBe(2);
  });

  it("selection only changes presentation; opening goes through the Session callback", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityGallery
        competency={c04}
        continuation={none}
        blocked={false}
        onSelect={onSelect}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);
    for (const [label, phrase] of [
      ["Explore and Learn", /two employees/],
      ["Apply", /two monthly salary offers/],
      ["Check and Transfer", /a shop price, a smaller bill/],
      ["Prepare", /Meet Maya/],
    ] as const) {
      await user.click(screen.getByRole("radio", { name: label }));
      expect(
        screen.getByRole("radio", { name: label }).getAttribute("aria-checked"),
      ).toBe("true");
      const panel = screen.getByRole("group", { name: label });
      expect(within(panel).getByText(phrase)).toBeDefined();
      expect(
        within(panel).getByRole("button", { name: `Start ${label}` }),
      ).toBeDefined();
    }
    expect(onSelect).not.toHaveBeenCalled();
    screen.getByRole("radio", { name: "Prepare" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Apply" }),
    );
    await user.keyboard("{End}");
    expect(
      screen
        .getByRole("radio", { name: "Check and Transfer" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "Previous activity" }));
    expect(screen.getByRole("group", { name: "Apply" })).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start Apply" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("C04-A03");
  });

  it("states only Session-backed status and preserves the retained Review entry", async () => {
    const onReviewCompleted = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityGallery
        competency={c04}
        continuation={{
          resume: { competencyId: "C04", activityId: "C04-A02" },
          upNext: null,
          completedThisSession: ["C04-A01"],
        }}
        blocked={false}
        onSelect={vi.fn()}
        onReviewCompleted={onReviewCompleted}
      />,
    );
    expect(screen.getByText("In progress: your work is waiting")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Resume Explore and Learn" }),
    ).toBeDefined();
    await user.click(screen.getByRole("radio", { name: "Prepare" }));
    expect(screen.getByText("Finished this session")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Start Prepare again" }),
    ).toBeDefined();
    expect(
      screen.getByText(/Explore and Learn is still in progress/),
    ).toBeDefined();
    await user.click(screen.getByRole("radio", { name: "Apply" }));
    expect(
      screen.queryByText(/Finished this session|Suggested next/),
    ).toBeNull();
    const review = screen.getByRole("button", {
      name: "Review completed activity",
    });
    expect(review.id).toBe("review-completed-activity");
    await user.click(review);
    expect(onReviewCompleted).toHaveBeenCalledOnce();
  });

  it("blocks opening and selection while navigation is blocked or unavailable", () => {
    const onSelect = vi.fn();
    const view = render(
      <ActivityGallery
        competency={{
          ...c04,
          activities: c04.activities.map((a) => ({ ...a, available: false })),
        }}
        blocked={false}
        onSelect={onSelect}
      />,
    );
    const open = screen.getByRole("button", { name: "Start Prepare" });
    expect((open as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Not available right now")).toBeDefined();
    view.rerender(
      <ActivityGallery competency={c04} blocked onSelect={onSelect} />,
    );
    for (const control of [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("radio"),
    ])
      expect((control as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Start Prepare" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("C03 and C06 activity galleries", () => {
  const c03 = library[1]!;
  const c06 = library[3]!;
  const fallback = activityStory("C01-A01", "Prepare");

  it("gives every C03 and C06 activity its own step and description", () => {
    for (const competency of [c03, c06])
      competency.activities.forEach((a, i) => {
        const story = activityStory(a.id, a.label);
        expect(story.description).not.toBe(fallback.description);
        expect(story.step).toBe(
          (["prepare", "explore", "apply", "transfer"] as const)[i],
        );
      });
  });

  it.each([
    [
      c03,
      "Competency 03",
      [
        ["Prepare", /Nico’s eight-hour workday/],
        ["Explore and Learn", /ordinary day with a rest day/],
        ["Apply", /James’s monthly work record/],
        ["Check and Transfer", /Mara’s overtime on a regular holiday/],
      ],
    ],
    [
      c06,
      "Competency 06",
      [
        ["Prepare", /Same sales, different pay agreements/],
        ["Explore and Learn", /Keep one agreement and change the sales/],
        ["Apply", /A property sale closes/],
        ["Check and Transfer", /Lina’s June pay record/],
      ],
    ],
  ] as const)(
    "%#: presents four covers with activity copy and opens through the Session callback",
    async (competency, kicker, copy) => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      const { container } = render(
        <ActivityGallery
          competency={competency}
          continuation={none}
          blocked={false}
          onSelect={onSelect}
        />,
      );
      expect(screen.getByText(new RegExp(kicker))).toBeDefined();
      expect(screen.getAllByRole("radio")).toHaveLength(4);
      expect(container.querySelectorAll("svg text").length).toBeGreaterThan(0);
      expect(container.textContent).not.toMatch(/PERCENTAGE CHANGE/);
      for (const [label, phrase] of copy) {
        await user.click(screen.getByRole("radio", { name: label }));
        const panel = screen.getByRole("group", { name: label });
        expect(within(panel).getByText(phrase)).toBeDefined();
      }
      expect(onSelect).not.toHaveBeenCalled();
      await user.click(
        screen.getByRole("button", { name: "Start Check and Transfer" }),
      );
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(`${competency.id}-A04`);
    },
  );

  it("features only this competency's Session-backed progress", () => {
    const view = render(
      <ActivityGallery
        competency={c03}
        continuation={{
          resume: null,
          upNext: { competencyId: "C03", activityId: "C03-A03" },
          completedThisSession: ["C03-A01", "C03-A02"],
        }}
        blocked={false}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "Apply" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByText("Suggested next")).toBeDefined();
    view.unmount();
    render(
      <ActivityGallery
        competency={c06}
        continuation={{
          resume: { competencyId: "C04", activityId: "C04-A03" },
          upNext: null,
          completedThisSession: [],
        }}
        blocked={false}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen
        .getByRole("radio", { name: "Prepare" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.queryByText(/In progress/)).toBeNull();
    expect(screen.queryByText(/still in progress/)).toBeNull();
    expect(screen.getByRole("button", { name: "Start Prepare" })).toBeDefined();
  });

  it("routes the three offered competencies to the gallery and others to the overview", () => {
    const shell = (competencyId: ShellProps["competencies"][number]["id"]) =>
      ({
        destination: { kind: "competency", competencyId },
        competencies: library,
        continuation: none,
        blocked: false,
        notice: null,
        canBack: true,
        canReturn: false,
        onBack: vi.fn(),
        onReturn: vi.fn(),
        onCompetency: vi.fn(),
        onActivity: vi.fn(),
        switchChoice: null,
      }) satisfies ShellProps;
    for (const id of ["C03", "C04", "C06"] as const) {
      const view = render(<DestinationView {...shell(id)} />);
      expect(
        screen.getByRole("radiogroup", { name: "Choose an activity" }),
      ).toBeDefined();
      view.unmount();
    }
    render(<DestinationView {...shell("C01")} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Learning activities" }),
    ).toBeDefined();
  });
});
