// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { PrepareWorkRecord } from "./public";
import {
  createC03ActivityActor,
  projectC03ActivityFrame,
} from "@/engine/c03-activity-binding/public";

afterEach(cleanup);
function mount(deliver = true, blocked = false) {
  const actor = createC03ActivityActor("C03-A01");
  actor.start();
  function Harness() {
    const [projection, update] = useState(() => projectC03ActivityFrame(actor));
    useEffect(() => {
      const subscription = actor.subscribe(() =>
        update(projectC03ActivityFrame(actor)),
      );
      return () => {
        subscription.unsubscribe();
        actor.stop();
      };
    }, []);
    const revision = actor.getSnapshot().context.responseRevision;
    return (
      <PrepareWorkRecord
        projection={projection}
        blocked={blocked}
        onAction={(type) => actor.send({ type })}
        onResponse={(response) =>
          actor.send({ type: "RESPONSE_CHANGED", response })
        }
        onHelp={() => actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" })}
        onCloseHelp={() => actor.send({ type: "CLOSE_SUPPORT" })}
        onFeedbackPresented={(element) => {
          const c = actor.getSnapshot().context;
          const pending = projectC03ActivityFrame(actor).frame.feedbackState;
          if (
            deliver &&
            element.isConnected &&
            pending &&
            c.feedbackRevision === null &&
            c.checkedRevision === revision &&
            c.responseRevision === revision &&
            element.textContent?.includes(pending.content.text)
          )
            actor.send({ type: "FEEDBACK_DELIVERED", revision });
        }}
      />
    );
  }
  return { actor, view: render(<Harness />), user: userEvent.setup() };
}
async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Start with Nico/ }));
  await user.click(
    screen.getByRole("button", { name: /Share my first thinking/ }),
  );
}
async function choose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }),
  );
  await user.click(screen.getByRole("button", { name: /Next question/ }));
  await user.click(
    screen.getByRole("radio", {
      name: "I'm not sure yet; I would like to compare ideas.",
    }),
  );
}
it("has one entry, cumulative eight-plus-two evidence and no solution", async () => {
  const { actor, view, user } = mount();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(view.container.textContent).toContain("₱100.00");
  await user.click(screen.getByRole("button", { name: /Start with Nico/ }));
  expect(view.container.querySelectorAll('[data-motion="hour"]')).toHaveLength(
    8,
  );
  await user.click(screen.getByRole("button", { name: "Next moment" }));
  expect(view.container.querySelectorAll('[data-motion="hour"]')).toHaveLength(
    10,
  );
  expect(actor.getSnapshot().context.position).toBe("ENTRY");
  expect(view.container.innerHTML).not.toMatch(/1\.25|250|multiplier/);
});
it("uses exact source prompts and nine options without defaults or numeric input", async () => {
  const { actor, user } = mount();
  await start(user);
  expect(screen.getAllByRole("radio")).toHaveLength(4);
  expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(
    screen.getByText("How do you imagine Nico's extra hours might be paid?"),
  ).toBeTruthy();
  expect(
    screen.queryByText(
      "What would you want to find out before deciding Nico's extra pay?",
    ),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Record my thinking" }),
  ).toBeNull();
  await choose(user);
  expect(actor.getSnapshot().context.responseRevision).toBe(2);
  expect(
    screen.getByRole("button", { name: "Record my thinking" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Help/ })).toBeNull();
});
it("records uncertainty neutrally, delivers real visible acknowledgment and finishes answer-free", async () => {
  const { actor, view, user } = mount();
  await start(user);
  await choose(user);
  await user.click(screen.getByRole("button", { name: "Record my thinking" }));
  expect(actor.getSnapshot().context.evaluation).toEqual({
    outcome: "CONFIRMED",
    diagnostic: null,
  });
  expect(actor.getSnapshot().context.feedbackRevision).toBe(2);
  expect(
    screen.getByText(/Your thinking is recorded\. This is your starting point/),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Finish Prepare" }));
  expect(actor.getSnapshot().context.position).toBe("COMPLETE");
  expect(
    screen.getByRole("region", { name: "Activity completion" }),
  ).toBeTruthy();
  expect(view.container.textContent).toContain(
    "I'm not sure yet; I would like to compare ideas.",
  );
  expect(view.container.innerHTML).not.toMatch(
    /1\.25|250|Reconsideration|Confirmed\./,
  );
});
it("does not enable Finish when acknowledgment delivery is withheld", async () => {
  const { actor, user } = mount(false);
  await start(user);
  await choose(user);
  await user.click(screen.getByRole("button", { name: "Record my thinking" }));
  expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
  expect(screen.queryByRole("button", { name: "Finish Prepare" })).toBeNull();
});
it("revision withdraws delivery/finish and records changed thinking without correction", async () => {
  const { actor, user } = mount();
  await start(user);
  await choose(user);
  await user.click(screen.getByRole("button", { name: "Record my thinking" }));
  await user.click(screen.getByRole("button", { name: "Change my thinking" }));
  await user.click(
    screen.getByRole("radio", {
      name: "I would start with the usual pay for each hour.",
    }),
  );
  await user.click(screen.getByRole("button", { name: /Next question/ }));
  expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
  expect(screen.queryByRole("button", { name: "Finish Prepare" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Record my thinking" }));
  expect(actor.getSnapshot().context.feedbackRevision).toBe(3);
});
it("fact inspection supports tap, close and Escape with focus restoration", async () => {
  const { user } = mount();
  await user.click(screen.getByRole("button", { name: /Start with Nico/ }));
  const trigger = screen.getByRole("button", { name: "Eight regular hours" });
  await user.click(trigger);
  expect(
    screen.getByRole("region", { name: "Eight regular hours" }),
  ).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger);
  expect(
    screen.queryByRole("region", { name: "Eight regular hours" }),
  ).toBeNull();
});
it("blocked presentation cannot enter the journey", () => {
  const { actor } = mount(true, true);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: /Start with Nico/ })
      .disabled,
  ).toBe(true);
  expect(actor.getSnapshot().context.position).toBe("ENTRY");
});

it("keeps both Actor selections when navigating questions without recording early", async () => {
  const { actor, view, user } = mount();
  await start(user);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: /Next question/ })
      .disabled,
  ).toBe(true);
  await choose(user);
  await user.click(screen.getByRole("button", { name: /Previous question/ }));
  expect(screen.getAllByRole("radio")).toHaveLength(4);
  expect(
    screen.getByRole<HTMLInputElement>("radio", {
      name: "I'm not sure yet; I would like to find out.",
    }).checked,
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Record my thinking" }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: /Next question/ }));
  expect(screen.getAllByRole("radio")).toHaveLength(5);
  expect(
    screen.getByRole<HTMLInputElement>("radio", {
      name: "I'm not sure yet; I would like to compare ideas.",
    }).checked,
  ).toBe(true);
  expect(actor.getSnapshot().context.responseRevision).toBe(2);
  expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
  expect(view.container.querySelectorAll("label svg[data-idea]")).toHaveLength(
    5,
  );
});
