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

// Activity gallery: covers (radios) choose what is shown; the panel action
// opens it through the Session. A cover is "offered" when it is not marked
// unavailable, which is what the former activity buttons' enabled state meant.
const activityCover = (label: string) =>
  screen.getByRole("radio", { name: label });
function openActivity(label: string) {
  fireEvent.click(activityCover(label));
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^(Start|Resume) ${label}( again)?$`),
    }),
  );
}
function expectOffered(label: string, offered = true) {
  const cover = activityCover(label);
  if (offered) {
    expect(cover).toBeEnabled();
    expect(cover).not.toHaveAccessibleDescription(/not available/);
  } else expect(cover).toHaveAccessibleDescription(/not available/);
}

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
  openActivity("Prepare");
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
  expect(
    root.session
      .getSnapshot()
      .can({ type: "SELECT_ACTIVITY", activityId: "C03-A04" }),
  ).toBe(true);
  act(() => {
    root.session.send({ type: "SELECT_ACTIVITY", activityId: "C03-A04" });
  });
  expect(selectSession(root.session).decision).toBe("activitySwitchChoice");
  expect(selectSession(root.session).currentActivity).toBe(actor);
  expect(actor.getSnapshot().status).toBe("active");
  fireEvent.click(
    screen.getByRole("button", { name: "Return to unfinished activity" }),
  );
  expect(selectSession(root.session).currentActivity).toBe(actor);
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
  expectOffered("Explore and Learn");
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
  expect(selectSession(second.root.session).destination).toEqual({
    kind: "library",
  });
  // A reload lands in the Learning Library, which offers to resume.
  fireEvent.click(screen.getByRole("button", { name: /^Resume / }));
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
  openActivity("Prepare");
  expect(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  ).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(screen.getByRole("button", { name: "Learning Library" }));
  fireEvent.click(screen.getByRole("button", { name: "Percentage Change" }));
  // C04 gallery: select the Prepare cover, then open it from the panel.
  fireEvent.click(screen.getByRole("radio", { name: "Prepare" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Prepare" }));
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

it("returns a reloaded C03-A04 to the library and restores it on Resume", async () => {
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
  // The recovered activity is kept live behind the library's Resume.
  expect(selectSession(root.session).destination).toEqual({ kind: "library" });
  const pending = selectSession(root.session).currentActivity!;
  expect(pending).not.toBe(actor);
  expect(await store.load()).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Resume / }));
  const restored = selectSession(root.session).currentActivity!;
  expect(restored).toBe(pending);
  expect(selectSession(root.session).destination).toEqual({
    kind: "activity",
    activityId: "C03-A04",
  });
  expect(restored).not.toBe(actor);
  expect(restored.getSnapshot().context.activityId).toBe("C03-A04");
  expect(restored.getSnapshot().context.position).toBe("ENTRY");
  expect(restored.getSnapshot().context.response).toBeNull();
  expect(restored.getSnapshot().context.evaluation).toBeNull();
  expect(await store.load()).not.toBeNull();
});

it("rejects a C03 checkpoint with mismatched model identity without deleting it before discard", async () => {
  const actor = createC03ActivityActor("C03-A04");
  const store = createWebTestStore();
  try {
    const saved = serializeRecoveryCheckpointV3(
      createRecoveryCheckpointV3(projectC03CheckpointV3(actor)),
    );
    // Keep the genuine A04 model while corrupting its activity binding.
    await store.replace(saved.replace('"C03-A04"', '"C03-A03"'));
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
  openActivity("Explore and Learn");
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
  expect(selectSession(second.root.session).destination).toEqual({
    kind: "library",
  });
  // A reload lands in the Learning Library, which offers to resume.
  fireEvent.click(screen.getByRole("button", { name: /^Resume / }));
  expect(screen.getByRole("button", { name: "Rest day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue →" }));
  fireEvent.click(screen.getByRole("button", { name: "Try the comparison →" }));
  const actor = selectSession(second.root.session).currentActivity!;
  for (const answer of [
    "The hourly rate and overtime hours",
    "The work condition, multiplier and overtime pay",
    ["Ordinary working-day multiplier", "1.25"],
    ["Rest-day multiplier", "1.69"],
  ]) {
    if (typeof answer === "string")
      fireEvent.click(screen.getByRole("radio", { name: answer }));
    else
      fireEvent.change(screen.getByLabelText(answer[0]!), {
        target: { value: answer[1] },
      });
    fireEvent.click(
      screen.getByRole("button", { name: "Check this answer →" }),
    );
    expect(screen.getByText("Yes—that fits.")).toBeVisible();
    expect(actor.getSnapshot().context.evaluation).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next question →" }));
  }
  fireEvent.change(screen.getByLabelText("Difference in overtime pay (₱)"), {
    target: { value: "80" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check this answer →" }));
  expect(screen.getByText("Look at this part again.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Finish Explore and Learn" }),
  ).toBeNull();
  expect(actor.getSnapshot().context.evaluation).toBeNull();
  fireEvent.change(screen.getByLabelText("Difference in overtime pay (₱)"), {
    target: { value: "88" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check this answer →" }));
  expect(screen.getByText("Yes—that fits.")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Difference in overtime pay (₱)"), {
    target: { value: "80" },
  });
  expect(screen.queryByText("Yes—that fits.")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Check my comparison →" }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Difference in overtime pay (₱)"), {
    target: { value: "88" },
  });
  expect(
    screen.getByRole("button", { name: "Check this answer →" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Check this answer →" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Check my comparison →" }),
  );
  await waitFor(() =>
    expect(screen.getByText("The relationship is clear.")).toBeVisible(),
  );
  expect(actor.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
  await waitFor(() =>
    expect(actor.getSnapshot().context.feedbackRevision).toBe(
      actor.getSnapshot().context.responseRevision,
    ),
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
  expectOffered("Apply");
  fireEvent.click(
    screen.getByRole("button", { name: "Review completed activity" }),
  );
  expect(screen.getByRole("heading", { name: /Same two hours/ })).toBeVisible();
}, 15_000);
