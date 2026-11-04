// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createApplicationRoot, StartupShell } from "./composition-root";
import { SessionProvider } from "./session-provider";
import { createWebTestStore } from "./web-test-store";
import {
  selectSession,
  acquireSessionCheckpointProducer,
} from "@/session/app-machine/public";
import { createC03ActivityActor } from "@/engine/c03-activity-binding/public";
import { projectC03CheckpointV3 } from "@/recovery/projection/public";
import {
  createRecoveryCheckpointV3,
  serializeRecoveryCheckpointV3,
} from "@/recovery/checkpoint/public";

const roots: ReturnType<typeof createApplicationRoot>[] = [];
afterEach(() => {
  cleanup();
  roots.splice(0).forEach((root) => root.stop());
});
async function mount(store = createWebTestStore()) {
  const root = createApplicationRoot(store);
  roots.push(root);
  act(() => {
    root.start();
  });
  await waitFor(() =>
    expect(selectSession(root.session).startup).not.toBe("pending"),
  );
  const view = render(
    <SessionProvider session={root.session}>
      <StartupShell root={root} />
    </SessionProvider>,
  );
  return { root, view, store };
}
function enter() {
  fireEvent.click(screen.getByRole("button", { name: "Overtime Pay" }));
  fireEvent.click(screen.getByRole("button", { name: "Prepare" }));
  fireEvent.click(screen.getByRole("button", { name: /Start with Nico/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Share my first thinking/ }),
  );
}
it("uses the Session actor, persists V3 and returns to the overview after Prepare", async () => {
  const { root, store } = await mount();
  enter();
  const actor = selectSession(root.session).currentActivity!;
  expect(actor.getSnapshot().context.activityId).toBe("C03-A01");
  for (const id of ["C03-A04"] as const)
    expect(
      root.session
        .getSnapshot()
        .can({ type: "SELECT_ACTIVITY", activityId: id }),
    ).toBe(false);
  fireEvent.click(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
  fireEvent.click(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to compare ideas.",
    }),
  );
  await waitFor(async () =>
    expect((await store.load())!).toContain('"schemaVersion":3'),
  );
  const stale = acquireSessionCheckpointProducer(root.session);
  const saved = createRecoveryCheckpointV3(projectC03CheckpointV3(actor));
  fireEvent.click(screen.getByRole("button", { name: "Record my thinking" }));
  await waitFor(() =>
    expect(actor.getSnapshot().context.feedbackRevision).toBe(
      actor.getSnapshot().context.responseRevision,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Change my thinking" }));
  expect(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  ).toBeChecked();
  fireEvent.click(
    screen.getByRole("radio", {
      name: "I would start with the usual pay for each hour.",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Next question/ }));
  fireEvent.click(screen.getByRole("button", { name: "Record my thinking" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish Prepare" }));
  await waitFor(() =>
    expect(selectSession(root.session).lifecyclePhase).toBe("finalized"),
  );
  expect(await store.load()).toBeNull();
  expect(stale.replace(saved)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Return to Overtime Pay" }),
  );
  expect(selectSession(root.session).destination).toEqual({
    kind: "competency",
    competencyId: "C03",
  });
  expect(
    screen.getByRole("button", { name: "Explore and Learn" }),
  ).toBeEnabled();
  fireEvent.click(
    screen.getByRole("button", { name: /Review completed activity/ }),
  );
  expect(selectSession(root.session).currentActivity).toBe(actor);
  expect(
    screen.getByRole("button", { name: "Return to Overtime Pay" }),
  ).toBeEnabled();
});

it("restores A01 through startup choice with selections retained", async () => {
  const first = await mount();
  enter();
  fireEvent.click(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  );
  await waitFor(async () =>
    expect((await first.store.load())!).toContain("expectation"),
  );
  first.view.unmount();
  first.root.stop();
  const second = await mount(first.store);
  expect(selectSession(second.root.session).startup).toBe("recovery-choice");
  fireEvent.click(
    screen.getByRole("button", { name: "Continue unfinished activity" }),
  );
  expect(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  ).toBeChecked();
  expect(selectSession(second.root.session).currentActivity).not.toBe(
    selectSession(first.root.session).currentActivity,
  );
});

it("retains C03 work across navigation and uses the existing cross-activity abandonment barrier", async () => {
  const { root, store } = await mount();
  enter();
  const actor = selectSession(root.session).currentActivity!;
  fireEvent.click(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(selectSession(root.session).currentActivity).toBe(actor);
  fireEvent.click(screen.getByRole("button", { name: "Prepare" }));
  expect(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  ).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(screen.getByRole("button", { name: "Learning Library" }));
  fireEvent.click(screen.getByRole("button", { name: "Percentage Change" }));
  fireEvent.click(screen.getByRole("button", { name: "Prepare" }));
  expect(selectSession(root.session).decision).toBe("activitySwitchChoice");
  expect(selectSession(root.session).currentActivity).toBe(actor);
  fireEvent.click(
    screen.getByRole("button", { name: "Abandon and open selected activity" }),
  );
  await waitFor(() =>
    expect(
      selectSession(root.session).currentActivity?.getSnapshot().context
        .activityId,
    ).toBe("C04-A01"),
  );
  expect(actor.getSnapshot().status).toBe("stopped");
  await waitFor(async () =>
    expect((await store.load())!).toContain('"schemaVersion":1'),
  );
});

it("does not admit a canonical but unauthorized C03-A04 saved activity", async () => {
  const actor = createC03ActivityActor("C03-A04");
  const store = createWebTestStore();
  try {
    await store.replace(
      serializeRecoveryCheckpointV3(
        createRecoveryCheckpointV3(projectC03CheckpointV3(actor)),
      ),
    );
  } finally {
    actor.stop();
  }
  const { root } = await mount(store);
  expect(selectSession(root.session).startup).toBe("recovery-failure");
  expect(selectSession(root.session).currentActivity).toBeNull();
  expect(await store.load()).not.toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Discard unusable saved work" }),
  );
  await waitFor(() =>
    expect(selectSession(root.session).startup).toBe("library-ready"),
  );
  expect(await store.load()).toBeNull();
});

it("runs A02 in production with authentic inspection, V3 recovery and delivered comparison feedback", async () => {
  const first = await mount();
  fireEvent.click(screen.getByRole("button", { name: "Overtime Pay" }));
  fireEvent.click(screen.getByRole("button", { name: "Explore and Learn" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Start the investigation →" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  expect(screen.queryByRole("button", { name: "Continue →" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Inspect ordinary working day" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  fireEvent.click(screen.getByRole("button", { name: "Rest day" }));
  await waitFor(async () =>
    expect((await first.store.load())!).toContain(
      '"selectedChildId":"C03-S02-B"',
    ),
  );
  first.view.unmount();
  first.root.stop();
  const second = await mount(first.store);
  expect(selectSession(second.root.session).startup).toBe("recovery-choice");
  fireEvent.click(
    screen.getByRole("button", { name: "Continue unfinished activity" }),
  );
  expect(screen.getByRole("button", { name: "Rest day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  fireEvent.click(screen.getByRole("button", { name: "Try the comparison →" }));
  fireEvent.click(
    screen
      .getByRole("group", { name: "What stays the same?" })
      .querySelectorAll("input")[0]!,
  );
  fireEvent.click(
    screen
      .getByRole("group", { name: "What changes between the situations?" })
      .querySelectorAll("input")[1]!,
  );
  fireEvent.click(screen.getByRole("button", { name: /Next part/ }));
  fireEvent.change(screen.getByLabelText("Ordinary working-day multiplier"), {
    target: { value: "1.25" },
  });
  fireEvent.change(screen.getByLabelText("Rest-day multiplier"), {
    target: { value: "1.69" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Next part/ }));
  fireEvent.change(screen.getByLabelText("Difference in overtime pay (₱)"), {
    target: { value: "80" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check my comparison" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Finish Explore and Learn" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Revise my comparison" }));
  fireEvent.click(screen.getByRole("button", { name: /Next part/ }));
  fireEvent.click(screen.getByRole("button", { name: /Next part/ }));
  fireEvent.change(screen.getByLabelText("Difference in overtime pay (₱)"), {
    target: { value: "88" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check again" }));
  await waitFor(() =>
    expect(screen.getByText("The relationship is clear.")).toBeVisible(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Finish Explore and Learn" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", {
        name: "Return to Overtime Pay",
      }),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Return to Overtime Pay" }),
  );
  expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Review completed activity" }),
  );
  expect(screen.getByText("The condition makes the difference.")).toBeVisible();
});
