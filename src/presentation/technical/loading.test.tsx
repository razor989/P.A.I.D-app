// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingPresentation } from "./public";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
describe("T043 technical presentation gate", () => {
  it.each([1, 120, 299])(
    "never mounts a status for %s ms operations, including repeated events",
    (duration) => {
      const view = render(
        <LoadingPresentation pending message="Authorized pending operation." />,
      );
      for (let i = 0; i < 3; i++) {
        view.rerender(
          <LoadingPresentation
            pending
            message="Authorized pending operation."
          />,
        );
        advance(duration);
        expect(screen.queryByRole("status")).toBeNull();
        expect(view.container.textContent).toBe("");
        view.rerender(
          <LoadingPresentation
            pending={false}
            message="Authorized pending operation."
          />,
        );
        advance(1000);
        expect(view.container.innerHTML).toBe("");
      }
    },
  );
  it("mounts at 300, remains the same at 301 and indefinitely, removes immediately", () => {
    const view = render(
      <StrictMode>
        <LoadingPresentation pending message="Authorized pending operation." />
      </StrictMode>,
    );
    advance(299);
    expect(view.container.innerHTML).toBe("");
    advance(1);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Authorized pending operation.");
    advance(1);
    advance(10000);
    expect(screen.getByRole("status")).toBe(status);
    view.rerender(
      <StrictMode>
        <LoadingPresentation
          pending={false}
          message="Authorized pending operation."
        />
      </StrictMode>,
    );
    expect(view.container.innerHTML).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("restarts on identity change, cancels on toggles/unmount and never moves focus", () => {
    const view = render(
      <>
        <button>Unrelated action</button>
        <LoadingPresentation pending operationKey="a" message="Pending." />
      </>,
    );
    screen.getByRole("button").focus();
    advance(299);
    view.rerender(
      <>
        <button>Unrelated action</button>
        <LoadingPresentation pending operationKey="b" message="Pending." />
      </>,
    );
    advance(299);
    expect(screen.queryByRole("status")).toBeNull();
    advance(1);
    expect(screen.getByRole("status")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("button"));
    view.rerender(
      <>
        <button>Unrelated action</button>
        <LoadingPresentation pending={false} message="Pending." />
      </>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(
      <LoadingPresentation pending operationKey="c" message="Pending." />,
    );
    advance(299);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(1000);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
