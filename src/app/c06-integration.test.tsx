// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from "vitest";
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
import { selectSession } from "@/session/app-machine/public";

const roots: ReturnType<typeof createApplicationRoot>[] = [];
// jsdom does not implement native modal dialog methods. Browser checks exercise
// the real focus trap and Escape behavior; this shim exposes its open state only.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  roots.splice(0).forEach((root) => root.stop());
});
async function mount(store = createWebTestStore()) {
  const root = createApplicationRoot(store);
  roots.push(root);
  act(() => root.start());
  await waitFor(() =>
    expect(selectSession(root.session).startup).not.toBe("pending"),
  );
  render(
    <SessionProvider session={root.session}>
      <StartupShell root={root} />
    </SessionProvider>,
  );
  return { root, store };
}
function enter() {
  fireEvent.click(screen.getByRole("button", { name: "Commission" }));
  expect(
    screen.getByRole("button", { name: "Explore and Learn" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Prepare" }));
  fireEvent.click(screen.getByRole("button", { name: /Meet the workers/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Share my first thinking/ }),
  );
}
it.each([false, true])(
  "uses the production Session Actor, V4 recovery and durable completion (wrong=%s)",
  async (wrong) => {
    const { root, store } = await mount();
    enter();
    const actor = selectSession(root.session).currentActivity!;
    expect(actor.getSnapshot().context.activityId).toBe("C06-A01");
    fireEvent.click(
      screen.getByRole("radio", {
        name: wrong
          ? "I think they’ll receive the same pay."
          : "I think their pay could be different.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next question →" }));
    fireEvent.click(
      screen.getByRole("radio", {
        name: "What each worker’s pay agreement promises.",
      }),
    );
    await waitFor(async () =>
      expect(await store.load()).toContain('"schemaVersion":4'),
    );
    expect(screen.queryByText(/14,000/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record my thinking" }));
    await waitFor(() =>
      expect(actor.getSnapshot().context.feedbackRevision).toBe(
        actor.getSnapshot().context.responseRevision,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Finish Prepare" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Follow both pay stories →" }),
    );
    await waitFor(() =>
      expect(actor.getSnapshot().context.terminalTeachingRevision).toBe(
        actor.getSnapshot().context.responseRevision,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Finish Prepare" }));
    await waitFor(() =>
      expect(selectSession(root.session).lifecyclePhase).toBe("finalized"),
    );
    expect(await store.load()).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Back to Commission activities/ }),
    );
    expect(selectSession(root.session).destination).toEqual({
      kind: "competency",
      competencyId: "C06",
    });
    expect(selectSession(root.session).currentActivity).toBe(actor);
    expect(actor.getSnapshot().context.position).toBe("COMPLETE");
  },
  20000,
);

it("restores unfinished A01 through production startup without a second local Actor", async () => {
  const { root, store } = await mount();
  enter();
  fireEvent.click(
    screen.getByRole("radio", {
      name: "I’m not sure yet. I’d like to look closer.",
    }),
  );
  await waitFor(async () => expect(await store.load()).toContain("UNSURE"));
  cleanup();
  root.stop();
  const restored = await mount(store);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue unfinished activity" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("radio", {
        name: "I’m not sure yet. I’d like to look closer.",
      }),
    ).toBeChecked(),
  );
  expect(
    selectSession(restored.root.session).currentActivity?.getSnapshot().context
      .activityId,
  ).toBe("C06-A01");
});

function enterExplore() {
  fireEvent.click(screen.getByRole("button", { name: "Commission" }));
  expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Check and Transfer" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Explore and Learn" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Investigate the two situations →" }),
  );
}
function fillExplore(wrong = false) {
  for (const name of [
    /The salary and rate stay fixed/,
    /More sales at the same rate/,
    /Find commission from sales/,
  ]) {
    if (wrong) {
      fireEvent.click(screen.getAllByRole("radio")[1]!);
      fireEvent.click(
        screen.getByRole("button", { name: "Check this answer" }),
      );
      expect(
        screen.getByText("Let’s trace this answer together."),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Next question →" }),
      ).toBeNull();
    }
    fireEvent.click(screen.getByRole("radio", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Check this answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question →" }));
  }
  const fields = [
    ["Commission rate (%)", "3%"],
    ["Monthly base salary (₱)", "₱15,000"],
    ["Situation A commission (₱)", "9,000"],
    ["Situation A total compensation (₱)", "24,000"],
    ["Situation B commission (₱)", "15,000"],
    ["Situation B total compensation (₱)", "30,000"],
  ];
  for (const [i, [label, value]] of fields.entries()) {
    const input = screen.getByLabelText(label!);
    if (wrong) {
      fireEvent.change(input, { target: { value: "1" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Check this answer" }),
      );
      expect(
        screen.getByText("Let’s trace this answer together."),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Next question →" }),
      ).toBeNull();
      const helper = screen.getByRole("button", { name: /Help me/ });
      fireEvent.click(helper);
      expect(input).toHaveValue("1");
      fireEvent.click(
        screen.getByRole("button", { name: "Return to this question" }),
      );
      expect(input).toHaveValue("1");
    }
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Check this answer" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: i === 5 ? "Bring my comparison together →" : "Next question →",
      }),
    );
  }
}
it("runs all six A02 teaching states, real selection, reconsideration, revision and durable completion", async () => {
  const { root, store } = await mount();
  enterExplore();
  const actor = selectSession(root.session).currentActivity!;
  expect(actor.getSnapshot().context.activityId).toBe("C06-A02");
  expect(screen.queryByText(/₱9,000/)).not.toBeInTheDocument();
  for (let index = 1; index <= 6; index++) {
    expect(actor.getSnapshot().context.position).toBe(`EXP-0${index}`);
    const before = actor.getSnapshot().context.responseRevision;
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(actor.getSnapshot().context.position).toBe(`EXP-0${index}`);
    expect(actor.getSnapshot().context.responseRevision).toBe(before);
    if (index === 4) {
      fireEvent.click(screen.getByRole("button", { name: "Situation B" }));
      expect(actor.getSnapshot().context.model?.value.selectionId).toBe(
        "C06-S02-B",
      );
      expect(actor.getSnapshot().context.response).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Explain this pay relationship" }),
      );
      expect(screen.getByRole("dialog")).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: "Return to this explanation" }),
      );
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: index === 6 ? "Explain my comparison →" : "Next idea →",
      }),
    );
  }
  expect(actor.getSnapshot().context.position).toBe("ACTIVE");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  fillExplore(true);
  await waitFor(() =>
    expect(actor.getSnapshot().context.feedbackRevision).toBe(
      actor.getSnapshot().context.responseRevision,
    ),
  );
  expect(actor.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
  fireEvent.click(
    screen.getByRole("button", { name: "Finish Explore and Learn" }),
  );
  await waitFor(() =>
    expect(selectSession(root.session).lifecyclePhase).toBe("finalized"),
  );
  expect(await store.load()).toBeNull();
  expect(
    screen.getByRole("region", { name: "Activity completion" }),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to Commission activities →" }),
  );
  expect(selectSession(root.session).destination).toEqual({
    kind: "competency",
    competencyId: "C06",
  });
}, 20000);

function enterApply() {
  fireEvent.click(screen.getByRole("button", { name: "Commission" }));
  expect(
    screen.getByRole("button", { name: "Check and Transfer" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Work out the agent’s commission →" }),
  );
}
function fillApply(sales = "₱2,000,000", rate = "5%", commission = "100,000") {
  fireEvent.click(
    screen.getByRole("button", {
      name: /01Read the agreement|01 Read the agreement/,
    }),
  );
  fireEvent.click(
    screen.getByRole("radio", { name: "Commission only: sales × rate." }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /02.*Build the calculation/ }),
  );
  for (const [label, value] of [
    ["Sales base (₱)", sales],
    ["Commission rate (%)", rate],
    ["Agent’s commission (₱)", commission],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  fireEvent.click(
    screen.getByRole("button", { name: /03.*Explain the payment/ }),
  );
  fireEvent.click(
    screen.getByRole("radio", {
      name: "The agent’s commission earned from this sale.",
    }),
  );
}
it("runs A03 through production checks, contextual correction, Help, and durable completion", async () => {
  const { root, store } = await mount();
  enterApply();
  const actor = selectSession(root.session).currentActivity!;
  expect(actor.getSnapshot().context.activityId).toBe("C06-A03");
  expect(screen.queryByText(/₱100,000/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Monthly/)).not.toBeInTheDocument();
  fillApply("100,000", "5", "1");
  fireEvent.click(
    screen.getByRole("button", { name: "Check my commission claim" }),
  );
  expect(
    screen.getByText(/Use the full ₱2,000,000.00 property sale/),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: "Finish Apply" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Revise my commission claim →" }),
  );
  const helper = screen.getByRole("button", {
    name: "Walk me through the relationship",
  });
  helper.focus();
  fireEvent.click(helper);
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Return to my commission claim" }),
  );
  expect(
    screen.getByRole("button", { name: "Walk me through the relationship" }),
  ).toHaveFocus();
  fireEvent.click(
    screen.getByRole("button", { name: /02.*Build the calculation/ }),
  );
  expect(screen.getByLabelText("Sales base (₱)")).toHaveValue("100000");
  fillApply("2,000,000", "0.05", "1");
  fireEvent.click(
    screen.getByRole("button", { name: "Check my commission claim" }),
  );
  expect(screen.getByText(/Convert 5% to 0.05/)).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Revise my commission claim →" }),
  );
  fillApply("2,000,000", "5%", "1");
  fireEvent.click(
    screen.getByRole("button", { name: "Check my commission claim" }),
  );
  expect(screen.getByText(/Apply 5% to the full property sale/)).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Revise my commission claim →" }),
  );
  fillApply();
  fireEvent.click(
    screen.getByRole("button", { name: "Check my commission claim" }),
  );
  await waitFor(() =>
    expect(actor.getSnapshot().context.feedbackRevision).toBe(
      actor.getSnapshot().context.responseRevision,
    ),
  );
  expect(actor.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
  expect(
    screen.getByRole("region", { name: "Bring the commission story together" }),
  ).toHaveTextContent("₱100,000");
  expect(
    screen.getByText("Your commission claim holds together."),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Follow the story →" }));
  fireEvent.click(screen.getByRole("button", { name: "Follow the story →" }));
  fireEvent.click(screen.getByRole("button", { name: "See my recap →" }));
  await waitFor(() =>
    expect(selectSession(root.session).lifecyclePhase).toBe("finalized"),
  );
  expect(
    screen.getByRole("region", { name: "Activity completion" }),
  ).toBeVisible();
  expect(await store.load()).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to Commission activities" }),
  );
  expect(
    screen.getByRole("button", { name: "Check and Transfer" }),
  ).toBeDisabled();
}, 20000);

function enterTransfer() {
  fireEvent.click(screen.getByRole("button", { name: "Commission" }));
  fireEvent.click(screen.getByRole("button", { name: "Check and Transfer" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Read Lina’s June record →" }),
  );
}
function fillTransfer(wrong: boolean) {
  fireEvent.click(screen.getByRole("radio", { name: "Base-plus-commission" }));
  fireEvent.click(
    screen.getByRole("button", { name: /02.*Determine commission/ }),
  );
  fireEvent.change(screen.getByLabelText("Lina’s June commission (₱)"), {
    target: { value: wrong ? "1" : "3,600" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /03.*Determine total pay/ }),
  );
  fireEvent.change(
    screen.getByLabelText("Lina’s June total compensation (₱)"),
    { target: { value: wrong ? "19,400" : "18,600" } },
  );
}
it.each([false, true])(
  "runs independent A04 and required transfer teaching through production (wrong=%s)",
  async (wrong) => {
    const { root, store } = await mount();
    enterTransfer();
    const actor = selectSession(root.session).currentActivity!;
    expect(actor.getSnapshot().context.activityId).toBe("C06-A04");
    expect(document.body.textContent).not.toMatch(/3,600|18,600/);
    const helper = screen.getByRole("button", {
      name: "Review the pay relationship",
    });
    helper.focus();
    fireEvent.click(helper);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(document.body.textContent).not.toMatch(/3,600|18,600/);
    fireEvent.click(
      screen.getByRole("button", { name: "Return to my June calculation" }),
    );
    expect(helper).toHaveFocus();
    fillTransfer(wrong);
    await waitFor(async () =>
      expect(await store.load()).toContain('"schemaVersion":4'),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Check my June calculation" }),
    );
    await waitFor(() =>
      expect(actor.getSnapshot().context.feedbackRevision).toBe(
        actor.getSnapshot().context.responseRevision,
      ),
    );
    expect(actor.getSnapshot().context.evaluation?.outcome).toBe(
      wrong ? "RECONSIDERATION" : "CONFIRMED",
    );
    expect(
      screen.queryByRole("button", { name: "See my June recap →" }),
    ).toBeNull();
    if (wrong) {
      expect(
        screen.queryByRole("button", {
          name: "Follow the June pay relationship →",
        }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Revise my June calculation" }),
      );
      fillTransfer(false);
      fireEvent.click(
        screen.getByRole("button", { name: "Check my June calculation" }),
      );
      expect(actor.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
    }
    fireEvent.click(
      screen.getByRole("button", {
        name: "Follow the June pay relationship →",
      }),
    );
    await waitFor(() =>
      expect(actor.getSnapshot().context.terminalTeachingRevision).toBe(
        actor.getSnapshot().context.responseRevision,
      ),
    );
    expect(
      screen.getByText(/C06 Commission ₱3,600 is exported read-only/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "See my June recap →" }),
    );
    await waitFor(() =>
      expect(selectSession(root.session).lifecyclePhase).toBe("finalized"),
    );
    expect(await store.load()).toBeNull();
    expect(
      screen.getByRole("region", { name: "Your recorded June response" }),
    ).toHaveTextContent("₱18,600");
    fireEvent.click(
      screen.getByRole("button", { name: "Commission: Ideas Together →" }),
    );
    fireEvent.click(
      screen.getByRole("radio", { name: "A03 · A property sale" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reveal the connection" }),
    );
    expect(
      screen.getByText(/property price supplied the sales base/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Beyond the sales record →" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Follow the connection" }),
    );
    expect(screen.getByText(/A sale alone cannot tell/)).toBeVisible();
    expect(actor.getSnapshot().context.position).toBe("COMPLETE");
  },
  20000,
);

it("recovers A04 actual answers through production V4 startup", async () => {
  const { root, store } = await mount();
  enterTransfer();
  fillTransfer(true);
  await waitFor(async () => expect(await store.load()).toContain('"total"'));
  cleanup();
  root.stop();
  const restored = await mount(store);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue unfinished activity" }),
  );
  expect(
    selectSession(restored.root.session).currentActivity?.getSnapshot().context
      .activityId,
  ).toBe("C06-A04");
  fireEvent.click(
    screen.getByRole("button", { name: /03.*Determine total pay/ }),
  );
  expect(
    screen.getByLabelText("Lina’s June total compensation (₱)"),
  ).toHaveValue("19400");
  fireEvent.click(
    screen.getByRole("button", { name: "Check my June calculation" }),
  );
  expect(screen.getByText("Look again at how the pay connects.")).toBeVisible();
}, 20000);

it("restores A03 saved answers through application V4 startup without a monthly basis", async () => {
  const { root, store } = await mount();
  enterApply();
  fillApply("2,000,000", "5%", "80000");
  await waitFor(async () => expect(await store.load()).toContain("C06-A03"));
  cleanup();
  root.stop();
  const restored = await mount(store);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue unfinished activity" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /02.*Build the calculation/ }),
  );
  expect(screen.getByLabelText("Agent’s commission (₱)")).toHaveValue("80000");
  const response = selectSession(
    restored.root.session,
  ).currentActivity!.getSnapshot().context.response;
  expect(response?.kind).toBe("COMPOSITE");
  if (response?.kind === "COMPOSITE")
    for (const part of response.parts) {
      expect(["EXACT_QUANTITY", "SINGLE_SELECTION"]).toContain(
        part.response.kind,
      );
      if (part.response.kind === "EXACT_QUANTITY")
        expect(part.response.value.basis).toBeNull();
    }
  fireEvent.click(
    screen.getByRole("button", { name: /03.*Explain the payment/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Check my commission claim" }),
  );
  expect(screen.getByText(/Apply 5% to the full property sale/)).toBeVisible();
}, 20000);

it("restores A02's explanation position and selected sales record through production startup", async () => {
  const { root, store } = await mount();
  enterExplore();
  for (let index = 1; index < 4; index++)
    fireEvent.click(screen.getByRole("button", { name: "Next idea →" }));
  fireEvent.click(screen.getByRole("button", { name: "Situation B" }));
  await waitFor(async () => expect(await store.load()).toContain("C06-S02-B"));
  cleanup();
  root.stop();
  const restored = await mount(store);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue unfinished activity" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Situation B" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(
    selectSession(restored.root.session).currentActivity?.getSnapshot().context
      .position,
  ).toBe("EXP-04");
}, 20000);
