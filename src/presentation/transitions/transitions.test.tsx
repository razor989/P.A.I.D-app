// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityId, CompetencyId } from "@/core/public";
import { AppShell } from "../shell/AppShell";
import type {
  CompetencySummary,
  Destination,
  ShellProps,
} from "../shell/public";
import { planTransition } from "./plan";

const steps = [
  "Prepare",
  "Explore and Learn",
  "Apply",
  "Check and Transfer",
] as const;
const labels = {
  C03: "Overtime Pay",
  C04: "Percentage Change",
  C06: "Commission",
} as const;
const competencies: CompetencySummary[] = (["C03", "C04", "C06"] as const).map(
  (id) => ({
    id,
    label: labels[id],
    available: true,
    activities: steps.map((label, i) => ({
      id: `${id}-A0${i + 1}` as ActivityId,
      label,
      available: true,
    })),
  }),
);
const library: Destination = { kind: "library" };
const gallery = (id: CompetencyId): Destination => ({
  kind: "competency",
  competencyId: id,
});
const lesson = (id: string): Destination => ({
  kind: "activity",
  activityId: id as ActivityId,
});

describe("transition planning", () => {
  it("pairs Library and gallery as accordion unfold and fold", () => {
    for (const id of ["C03", "C04", "C06"] as const) {
      expect(planTransition(library, gallery(id), competencies)).toMatchObject({
        family: "accordion",
        direction: "forward",
        competencyId: id,
      });
      expect(planTransition(gallery(id), library, competencies)).toMatchObject({
        family: "accordion",
        direction: "back",
        competencyId: id,
      });
    }
  });

  it("pairs every gallery activity with chapter enter and return", () => {
    const expected = ["prepare", "explore", "apply", "transfer"];
    for (const c of competencies)
      c.activities.forEach((a, i) => {
        const enter = planTransition(gallery(c.id), lesson(a.id), competencies);
        expect(enter).toMatchObject({
          family: "chapter",
          direction: "forward",
          competencyId: c.id,
          chapter: {
            activityId: a.id,
            competencyId: c.id,
            step: expected[i],
            number: `0${i + 1}`,
          },
        });
        expect(
          planTransition(lesson(a.id), gallery(c.id), competencies),
        ).toMatchObject({ family: "chapter", direction: "back" });
      });
  });

  it("treats Library resume and Library return from a lesson as chapters", () => {
    expect(
      planTransition(library, lesson("C06-A03"), competencies),
    ).toMatchObject({ family: "chapter", direction: "forward" });
    expect(
      planTransition(lesson("C03-A02"), library, competencies),
    ).toMatchObject({ family: "chapter", direction: "back" });
  });

  it("never animates an unchanged destination and falls back at equal depth", () => {
    expect(planTransition(gallery("C04"), gallery("C04"), competencies)).toBe(
      null,
    );
    expect(
      planTransition(lesson("C04-A01"), lesson("C04-A02"), competencies),
    ).toMatchObject({ family: "fallback" });
    expect(
      planTransition(gallery("C04"), lesson("C99-A01"), competencies),
    ).toMatchObject({ family: "fallback" });
  });
});

/* Runtime: jsdom has neither matchMedia nor Web Animations, which is exactly
 * the "off" path every other test relies on. These tests install both. */
function installMotion(reduce = false) {
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  const animate = vi.fn(() => ({ cancel: vi.fn(), pause: vi.fn() }));
  Element.prototype.animate = animate as unknown as Element["animate"];
  // jsdom lacks constructable sheets; a minimal stand-in suffices.
  class Sheet {
    replaceSync() {}
  }
  vi.stubGlobal("CSSStyleSheet", Sheet);
  Object.defineProperty(Document.prototype, "adoptedStyleSheets", {
    configurable: true,
    value: [],
  });
  const attach = vi.fn(function (this: HTMLElement) {
    const root = document.createElement("div");
    Object.defineProperty(root, "adoptedStyleSheets", { writable: true });
    this.append(root);
    return root as unknown as ShadowRoot;
  });
  HTMLElement.prototype.attachShadow = attach;
  return { animate, attach };
}

function props(destination: Destination, extra: Partial<ShellProps> = {}) {
  return {
    destination,
    competencies,
    blocked: false,
    notice: null,
    canBack: true,
    canReturn: true,
    onBack: vi.fn(),
    onReturn: vi.fn(),
    onCompetency: vi.fn(),
    onActivity: vi.fn(),
    switchChoice: null,
    ...extra,
  } satisfies ShellProps;
}

const layers = () => document.querySelectorAll("[data-paid-transition]");

describe("transition stage", () => {
  const saved = {
    matchMedia: Object.getOwnPropertyDescriptor(window, "matchMedia"),
    animate: Object.getOwnPropertyDescriptor(Element.prototype, "animate"),
    attach: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "attachShadow",
    ),
  };
  const restore = (
    target: object,
    key: string,
    descriptor: PropertyDescriptor | undefined,
  ) => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  };
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    restore(window, "matchMedia", saved.matchMedia);
    restore(Element.prototype, "animate", saved.animate);
    restore(HTMLElement.prototype, "attachShadow", saved.attach);
    Reflect.deleteProperty(Document.prototype, "adoptedStyleSheets");
  });

  it("adds nothing where the platform cannot animate", () => {
    const { rerender } = render(<AppShell {...props(library)} />);
    rerender(<AppShell {...props(gallery("C04"))} />);
    expect(layers()).toHaveLength(0);
  });

  it("decorates a real change with one hidden layer that always clears", () => {
    const { animate } = installMotion();
    const { rerender } = render(<AppShell {...props(library)} />);
    expect(layers()).toHaveLength(0);
    rerender(<AppShell {...props(gallery("C06"))} />);
    const [layer] = layers();
    expect(layer).toHaveAttribute("data-paid-transition", "accordion");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    // The layer itself must stay hit-testable to catch presses; only the
    // copied screen (which still contains buttons) is inert.
    expect(layer).not.toHaveAttribute("inert");
    expect(layer!.querySelector('[data-part="still"]')).toHaveAttribute(
      "inert",
    );
    expect(animate).toHaveBeenCalled();
    // The destination is already live and named underneath.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Commission",
    );
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(layers()).toHaveLength(0);
  });

  it("does not animate when the destination stays the same", () => {
    installMotion();
    const { rerender } = render(<AppShell {...props(gallery("C04"))} />);
    rerender(
      <AppShell
        {...props(gallery("C04"), {
          switchChoice: {
            canReturn: true,
            canAbandon: true,
            onReturn: vi.fn(),
            onAbandon: vi.fn(),
          },
        })}
      />,
    );
    expect(layers()).toHaveLength(0);
  });

  it("keeps a single layer under rapid changes and uses the latest family", () => {
    installMotion();
    const { rerender } = render(<AppShell {...props(library)} />);
    rerender(<AppShell {...props(gallery("C03"))} />);
    rerender(<AppShell {...props(lesson("C03-A02"))} />);
    expect(layers()).toHaveLength(1);
    expect(layers()[0]).toHaveAttribute("data-paid-transition", "chapter");
    rerender(<AppShell {...props(gallery("C03"))} />);
    expect(layers()).toHaveLength(1);
    expect(layers()[0]).toHaveAttribute("data-direction", "back");
  });

  it("ends a run at once on a key press, without consuming the key", () => {
    installMotion();
    const { rerender } = render(<AppShell {...props(gallery("C04"))} />);
    rerender(<AppShell {...props(lesson("C04-A01"))} />);
    expect(layers()).toHaveLength(1);
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(layers()).toHaveLength(0);
  });

  it("catches a press on the layer and ends the run", () => {
    installMotion();
    const onActivity = vi.fn();
    const { rerender } = render(
      <AppShell {...props(gallery("C04"), { onActivity })} />,
    );
    rerender(<AppShell {...props(lesson("C04-A02"), { onActivity })} />);
    const [layer] = layers();
    act(() => {
      layer!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(layers()).toHaveLength(0);
    expect(onActivity).not.toHaveBeenCalled();
  });

  it("ends a run when the app is backgrounded or unmounted", () => {
    installMotion();
    const { rerender, unmount } = render(<AppShell {...props(library)} />);
    rerender(<AppShell {...props(gallery("C04"))} />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Reflect.deleteProperty(document, "visibilityState");
    expect(layers()).toHaveLength(0);
    rerender(<AppShell {...props(library)} />);
    expect(layers()).toHaveLength(1);
    unmount();
    expect(layers()).toHaveLength(0);
  });

  it("uses only the brief non-spatial fallback under reduced motion", () => {
    installMotion(true);
    const { rerender } = render(<AppShell {...props(library)} />);
    rerender(<AppShell {...props(gallery("C04"))} />);
    expect(layers()[0]).toHaveAttribute("data-paid-transition", "fallback");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(layers()).toHaveLength(0);
  });
});
