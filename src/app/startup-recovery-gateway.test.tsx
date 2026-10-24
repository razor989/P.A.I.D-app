// @vitest-environment jsdom
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompositionRoot,
  createApplicationRoot,
  StartupShell,
} from "./composition-root";
import { SessionProvider } from "./session-provider";
import { StartupRecoveryGateway } from "./startup-recovery-gateway";
import type { StartupRecoveryGatewayProps } from "./startup-recovery-gateway";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function props(
  state: StartupRecoveryGatewayProps["state"],
): StartupRecoveryGatewayProps {
  return {
    state,
    active: true,
    canRetryClear: false,
    canConfirmClear: false,
    onContinue: vi.fn(),
    onAbandon: vi.fn(),
    onDiscard: vi.fn(),
    onRetryRead: vi.fn(),
    onRetryClear: vi.fn(),
    onConfirmClear: vi.fn(),
  };
}

describe("T036 bounded Recovery gateway", () => {
  it("actual valid recovery shows explicit choices without auto-start and Continue uses the same actor", async () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      studyDefinitionRevision: "PAID-STUDY-DEF-R001",
      kind: "unfinished-activity",
      checkpoint: {
        competencyId: "C04",
        activityId: "C04-A01",
        scenarioId: "C04-S01",
        position: "ENTRY",
        response: null,
        responseRevision: 0,
        hasChecked: false,
        checkedResponse: null,
        checkedRevision: null,
        feedbackRevision: null,
        evaluation: null,
      },
    });
    const root = createApplicationRoot({
      load: () => Promise.resolve(raw),
      replace: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    });
    root.start();
    await tick();
    const actor = root.session.getSnapshot().context.currentActivity!;
    const start = vi.spyOn(actor, "start");
    const view = render(
      <SessionProvider session={root.session}>
        <StartupShell root={root} />
      </SessionProvider>,
    );
    expect(start).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: "Continue unfinished activity" }),
      );
    expect(start).toHaveBeenCalledTimes(1);
    expect(root.session.getSnapshot().context.currentActivity).toBe(actor);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Activity host",
    );
    view.unmount();
    root.stop();
  });
  it("offers no actions before read or during clear and only approved failure actions", () => {
    for (const state of [
      "pending",
      "clear-pending",
      "library-ready",
      "resumed",
    ] as const) {
      const view = render(<StartupRecoveryGateway {...props(state)} />);
      expect(screen.queryByRole("button")).toBeNull();
      // T043/S2: the original immediate clearing status is now threshold-gated.
      if (state === "clear-pending")
        expect(screen.queryByRole("status")).toBeNull();
      else expect(screen.getByRole("status")).toBeDefined();
      view.unmount();
    }
    const view = render(
      <StartupRecoveryGateway {...props("clear-failed")} canRetryClear />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Retry clearing" }),
    ).toBeDefined();
    view.rerender(
      <StartupRecoveryGateway {...props("clear-failed")} canConfirmClear />,
    );
    expect(
      screen.getByRole("button", { name: "Confirm clearing saved work" }),
    ).toBeDefined();
  });
  it("requires explicit keyboard Continue/Abandon and disables disposed actions", async () => {
    const user = userEvent.setup();
    const input = props("recovery-choice");
    const view = render(<StartupRecoveryGateway {...input} />);
    expect(input.onContinue).not.toHaveBeenCalled();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(input.onContinue).toHaveBeenCalledTimes(1);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(input.onAbandon).toHaveBeenCalledTimes(1);
    view.rerender(<StartupRecoveryGateway {...input} active={false} />);
    expect(
      screen
        .getAllByRole("button")
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Continue unfinished activity" }),
    );
    expect(input.onContinue).toHaveBeenCalledTimes(1);
  });
  it("actual root performs read retry then explicit Discard and waits for real clear acknowledgment", async () => {
    let rejectRead!: (error: unknown) => void;
    let resolveRead!: (value: string | null) => void;
    let resolveClear!: () => void;
    let count = 0;
    const load = () => {
      count++;
      return new Promise<string | null>((yes, no) => {
        resolveRead = yes;
        rejectRead = no;
      });
    };
    const root = createApplicationRoot({
      load,
      replace: () => Promise.resolve(),
      clear: () =>
        new Promise<void>((yes) => {
          resolveClear = yes;
        }),
    });
    root.start();
    const view = render(
      <SessionProvider session={root.session}>
        <StartupShell root={root} />
      </SessionProvider>,
    );
    const user = userEvent.setup();
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => {
      rejectRead(new Error("private diagnostic"));
      await tick();
    });
    expect(screen.queryByText("private diagnostic")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Retry storage read" }),
    );
    expect(count).toBe(2);
    await act(async () => {
      resolveRead("{");
      await tick();
    });
    expect(document.activeElement).toBe(screen.getByRole("status"));
    expect(screen.queryByText("Library is ready.")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Discard unusable saved work" }),
    );
    expect(screen.queryByText(/Clearing saved work/)).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Startup and saved work" }),
    );
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => {
      resolveClear();
      await tick();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Learning Library",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    view.unmount();
    root.stop();
  });
  it("real StrictMode cleanup/remount reaches only its own genuine empty-memory result", async () => {
    const view = render(
      <StrictMode>
        <CompositionRoot />
      </StrictMode>,
    );
    await act(tick);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Learning Library",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    view.unmount();
    render(
      <StrictMode>
        <CompositionRoot />
      </StrictMode>,
    );
    await act(tick);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Learning Library",
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });
});

describe("T043/S2 authentic startup clearing", () => {
  it.each([299, 300, 301])(
    "genuine queue clear at %s ms, durable barrier and focus-safe settlement",
    async (duration) => {
      vi.useFakeTimers();
      let resolveClear!: () => void;
      const clear = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveClear = resolve;
          }),
      );
      const root = createApplicationRoot({
        load: () => Promise.resolve("{"),
        replace: () => Promise.resolve(),
        clear,
      });
      root.start();
      await tick();
      const view = render(
        <StrictMode>
          <SessionProvider session={root.session}>
            <StartupShell root={root} />
          </SessionProvider>
        </StrictMode>,
      );
      const discard = screen.getByRole("button", {
        name: "Discard unusable saved work",
      });
      discard.focus();
      fireEvent.click(discard);
      await act(tick);
      expect(clear).toHaveBeenCalledTimes(1);
      expect(root.session.getSnapshot().matches({ startup: "clearing" })).toBe(
        true,
      );
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByText(/Clearing saved work/)).toBeNull();
      const region = screen.getByRole("region", {
        name: "Startup and saved work",
      });
      expect(document.activeElement).toBe(region);
      act(() => root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" }));
      expect(root.session.getSnapshot().matches({ startup: "clearing" })).toBe(
        true,
      );
      void act(() => vi.advanceTimersByTime(duration));
      expect(screen.queryAllByText(/Clearing saved work/)).toHaveLength(
        duration < 300 ? 0 : 1,
      );
      if (duration >= 300) {
        const status = screen.getByRole("status");
        void act(() => vi.advanceTimersByTime(1));
        expect(screen.getByRole("status")).toBe(status);
        expect(document.activeElement).toBe(region);
      }
      expect(screen.queryByText("Learning Library")).toBeNull();
      await act(async () => {
        resolveClear();
        await tick();
      });
      expect(screen.queryByText(/Clearing saved work/)).toBeNull();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Learning Library",
      );
      view.unmount();
      root.stop();
      expect(vi.getTimerCount()).toBe(0);
      console.log(
        `T043/S2 real queue ${duration}ms: threshold=${duration >= 300}, only durable acknowledgement enters Library`,
      );
    },
  );
  it.each([100, 301])(
    "actual clearing failure at %s ms is immediate, safe retry resets threshold and unmount cancels",
    async (duration) => {
      vi.useFakeTimers();
      let rejectClear!: (error: unknown) => void;
      const root = createApplicationRoot({
        load: () => Promise.resolve("{"),
        replace: () => Promise.resolve(),
        clear: () =>
          new Promise<void>((_, reject) => {
            rejectClear = reject;
          }),
      });
      root.start();
      await tick();
      const view = render(
        <SessionProvider session={root.session}>
          <StartupShell root={root} />
        </SessionProvider>,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Discard unusable saved work" }),
      );
      await act(tick);
      void act(() => vi.advanceTimersByTime(duration));
      await act(async () => {
        rejectClear(new Error("private diagnostic"));
        await tick();
      });
      expect(screen.queryByText(/Clearing saved work/)).toBeNull();
      expect(screen.getByRole("status").textContent).toContain(
        "Saved work could not yet be cleared",
      );
      expect(document.activeElement).toBe(screen.getByRole("status"));
      expect(screen.queryByText(/private diagnostic/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Retry clearing" }));
      await act(tick);
      void act(() => vi.advanceTimersByTime(299));
      expect(screen.queryByRole("status")).toBeNull();
      view.unmount();
      root.stop();
      void act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByText(/Clearing saved work/)).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("gateway visibility is presentation-only and delayed mount does not steal focus", () => {
    const view = render(
      <StartupRecoveryGateway {...props("recovery-choice")} />,
    );
    screen.getByRole("button", { name: "Abandon unfinished activity" }).focus();
    view.rerender(
      <StartupRecoveryGateway
        {...props("clear-pending")}
        clearingVisible={false}
      />,
    );
    const region = screen.getByRole("region");
    expect(document.activeElement).toBe(region);
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(
      <StartupRecoveryGateway {...props("clear-pending")} clearingVisible />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Clearing saved work",
    );
    expect(document.activeElement).toBe(region);
    view.rerender(
      <StartupRecoveryGateway {...props("clear-failed")} canRetryClear />,
    );
    expect(document.activeElement).toBe(screen.getByRole("status"));
  });
});
