// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode, createRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccessibilityCoordinator } from "./public";
import type { FocusEvent, SafeAnnouncement } from "./public";
import { isEligibleTarget } from "./focusPolicy";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
  } as DOMRectList);
  const query = document.querySelector.bind(document);
  vi.spyOn(document, "querySelector").mockImplementation((selector: string) =>
    selector === "dialog:modal" ? null : query(selector),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("preserves initial focus and focuses a genuine destination once under StrictMode", () => {
  const target = createRef<HTMLHeadingElement>();
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  const tree = (identity: string) => (
    <StrictMode>
      <h1 ref={target} tabIndex={-1}>
        Current heading
      </h1>
      <AccessibilityCoordinator
        event={{ kind: "destination", identity, target }}
      />
    </StrictMode>
  );
  const view = render(tree("library"));
  expect(focus).not.toHaveBeenCalled();
  view.rerender(tree("activity"));
  expect(document.activeElement).toBe(target.current);
  expect(focus).toHaveBeenCalledTimes(1);
  view.rerender(tree("activity"));
  expect(focus).toHaveBeenCalledTimes(1);
});

it("consumes blocked transitions and rejects ineligible targets", () => {
  const target = createRef<HTMLHeadingElement>();
  const event: FocusEvent = { kind: "major-step", identity: "step", target };
  const view = render(
    <>
      <h2 ref={target} tabIndex={-1}>
        Step
      </h2>
      <AccessibilityCoordinator event={event} blocked />
    </>,
  );
  view.rerender(
    <>
      <h2 ref={target} tabIndex={-1}>
        Step
      </h2>
      <AccessibilityCoordinator event={event} />
    </>,
  );
  expect(document.activeElement).not.toBe(target.current);
  target.current!.setAttribute("hidden", "");
  expect(isEligibleTarget(target.current)).toBe(false);
  target.current!.removeAttribute("hidden");
  target.current!.setAttribute("inert", "");
  expect(isEligibleTarget(target.current)).toBe(false);
  expect(isEligibleTarget(document.createElement("button"))).toBe(false);
});

it("keeps one persistent bounded polite target and deduplicates safe semantic identities", () => {
  const source = createRef<HTMLParagraphElement>();
  const tree = (announcement: SafeAnnouncement | null) => (
    <StrictMode>
      <p ref={source}>Synthetic visible safe message.</p>
      <AccessibilityCoordinator announcement={announcement} />
    </StrictMode>
  );
  const view = render(tree(null));
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("");
  const a = {
    identity: "a",
    text: "Synthetic visible safe message.",
    visibleSource: source,
  };
  view.rerender(tree(a));
  expect(status.textContent).toBe(a.text);
  const span = status.firstChild;
  view.rerender(tree({ ...a }));
  expect(status.firstChild).toBe(span);
  view.rerender(tree({ ...a, identity: "b" }));
  expect(status.firstChild).not.toBe(span);
  view.rerender(
    tree({ ...a, identity: "unsafe", text: "WITHHELD_TEST_ANSWER" }),
  );
  expect(status.textContent).toBe("");
  expect(view.container.innerHTML).not.toContain("WITHHELD_TEST_ANSWER");
  view.rerender(tree({ ...a, identity: "long", text: "x".repeat(281) }));
  expect(status.textContent).toBe("");
  view.rerender(tree(null));
  expect(screen.getByRole("status")).toBe(status);
});

it("rejects disabled, aria-hidden and positive-tabindex targets", () => {
  const button = document.createElement("button");
  document.body.append(button);
  button.disabled = true;
  expect(isEligibleTarget(button)).toBe(false);
  button.disabled = false;
  button.setAttribute("aria-hidden", "true");
  expect(isEligibleTarget(button)).toBe(false);
  button.removeAttribute("aria-hidden");
  button.tabIndex = 1;
  expect(isEligibleTarget(button)).toBe(false);
  button.remove();
});

it.each(["hidden", "display", "visibility", "aria-hidden", "inert"])(
  "rejects %s descendant prose under StrictMode without copying the synthetic marker",
  (mode) => {
    const source = createRef<HTMLParagraphElement>();
    const marker = "SYNTHETIC_T042_HIDDEN_ONLY_MARKER";
    const tree = (announcement: SafeAnnouncement | null) => (
      <StrictMode>
        <p ref={source}>
          Visible prefix.
          <span
            hidden={mode === "hidden"}
            inert={mode === "inert"}
            aria-hidden={mode === "aria-hidden" ? true : undefined}
            style={
              mode === "display"
                ? { display: "none" }
                : mode === "visibility"
                  ? { visibility: "hidden" }
                  : undefined
            }
          >
            {marker}
          </span>
        </p>
        <AccessibilityCoordinator announcement={announcement} />
      </StrictMode>
    );
    const view = render(tree(null));
    view.rerender(
      tree({
        identity: mode,
        text: `Visible prefix.${marker}`,
        visibleSource: source,
      }),
    );
    expect(source.current?.textContent).toContain(marker);
    expect(screen.getByRole("status").textContent).toBe("");
  },
);

it("accepts exactly 280 visible characters but refuses 281", () => {
  const source = createRef<HTMLParagraphElement>();
  const tree = (length: number, announce: boolean) => (
    <StrictMode>
      <p ref={source}>{"x".repeat(length)}</p>
      <AccessibilityCoordinator
        announcement={
          announce
            ? {
                identity: `${length}`,
                text: "x".repeat(length),
                visibleSource: source,
              }
            : null
        }
      />
    </StrictMode>
  );
  const view = render(tree(280, false));
  view.rerender(tree(280, true));
  expect(screen.getByRole("status").textContent).toHaveLength(280);
  view.rerender(tree(281, true));
  expect(screen.getByRole("status").textContent).toBe("");
});
