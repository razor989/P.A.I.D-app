// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireSessionCheckpointProducer,
  selectSession,
} from "@/session/app-machine/public";
import { createApplicationRoot, CompositionRoot } from "./composition-root";
import {
  SessionProvider,
  useSessionActor,
  useSessionCheckpointProducer,
  useSessionSnapshot,
} from "./session-provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("T035 React boundary", () => {
  it("subscribes to the actual Session and unsubscribes on unmount", () => {
    const root = createApplicationRoot();
    root.start();
    const unsubscribe = vi.fn();
    const original = root.session.subscribe.bind(root.session);
    const subscribe = vi
      .spyOn(root.session, "subscribe")
      .mockImplementation((...args) => {
        const subscription = original(...args);
        return {
          unsubscribe: () => {
            unsubscribe();
            subscription.unsubscribe();
          },
        };
      });
    let actor: ReturnType<typeof useSessionActor> | undefined;
    let producer:
      ReturnType<typeof acquireSessionCheckpointProducer> | undefined;
    function Probe() {
      actor = useSessionActor();
      producer = useSessionCheckpointProducer();
      const snapshot = useSessionSnapshot();
      return (
        <output>
          {snapshot.matches({ startup: "evaluate" }) ? "unresolved" : "other"}
        </output>
      );
    }
    const view = render(
      <StrictMode>
        <SessionProvider session={root.session}>
          <Probe />
        </SessionProvider>
      </StrictMode>,
    );
    expect(actor).toBe(root.session);
    expect(screen.getByText("unresolved")).toBeDefined();
    expect(selectSession(actor!).destination).toBeNull();
    const created = subscribe.mock.calls.length;
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(created);
    root.stop();
    expect(actor!.getSnapshot().status).toBe("stopped");
    expect(producer).toBeDefined();
  });
  it("mounts real unresolved state without learner controls through StrictMode replay", () => {
    const view = render(
      <StrictMode>
        <CompositionRoot />
      </StrictMode>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain(
      "Startup is unresolved",
    );
    expect(screen.queryByRole("button")).toBeNull();
    act(() => view.unmount());
    expect(view.container.textContent).toBe("");
  });
});
