// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnchoredChangeTrack } from "./AnchoredChangeTrack";
import type { C04TrackFrame } from "./public";

afterEach(cleanup);

it.each([
  ["C04-A01", "equal", "180"],
  ["C04-A02", "increase", "330"],
  ["C04-A03", "decrease", "75"],
  ["C04-A04", "increase", "330"],
] as const)(
  "%s shows its fixed Original/New scene without revealing calculated answers",
  (activityId, scene, marker) => {
    const { container } = render(
      <AnchoredChangeTrack
        frame={{
          ...frame,
          activityId,
          stateId: "ENTRY",
          allowedLearnerIntents: [],
          exposedDerivedFacts: [],
        }}
        blocked={false}
        onIntent={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-scene")).toBe(scene);
    expect(svg.querySelector("circle")?.getAttribute("cx")).toBe(marker);
    expect(svg.querySelectorAll("path")).toHaveLength(2);
    expect(svg.textContent).toContain("Original");
    expect(svg.textContent).toContain("New");
    expect(svg.textContent).not.toMatch(/Change Span|Relative to Original/);
    expect(container.querySelector('[data-fact-id$="/difference"]')).toBeNull();
    expect(container.querySelector('[data-fact-id$="/percentage"]')).toBeNull();
    expect(container.querySelector("[data-feedback]")).toBeNull();
  },
);
const frame: C04TrackFrame = {
  activityId: "C04-A02",
  stateId: "ACTIVE",
  contentReferences: [{ id: "test/prose", text: "Authorized prose." }],
  exposedModelFacts: [
    { id: "test/original", text: "Original: 20000 PHP per month" },
    { id: "test/newValue", text: "New: 22000 PHP per month" },
  ],
  exposedDerivedFacts: [],
  allowedLearnerIntents: ["CONTINUE", "PREVIOUS", "SELECT_MODEL_CHILD"],
  modelSelectionControl: {
    modelId: "issued-model",
    revision: 1,
    position: "ACTIVE",
    selectedId: "C04-S02-A",
    options: [
      { id: "C04-S02-A", text: "Employee A New" },
      { id: "C04-S02-B", text: "Employee B New" },
    ],
  },
};

it("does not reconstruct omitted answers from visible numbers or add response controls", () => {
  const { container } = render(
    <AnchoredChangeTrack
      frame={frame}
      blocked={false}
      onIntent={vi.fn()}
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByText("Authorized prose.")).toBeDefined();
  expect(container.textContent).not.toMatch(/\b2000 PHP|10%|20%/);
  expect(container.querySelector("input")).toBeNull();
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
    "true",
  );
  expect(container.querySelectorAll("dl dt")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /check|finish/i })).toBeNull();
});

it("supports pointer, Enter and Space with stable focus and communicated selection", async () => {
  const select = vi.fn();
  const intent = vi.fn();
  const user = userEvent.setup();
  render(
    <AnchoredChangeTrack
      frame={frame}
      blocked={false}
      onIntent={intent}
      onSelect={select}
    />,
  );
  const first = screen.getByRole("button", {
    name: "Employee A New",
    pressed: true,
  });
  first.focus();
  await user.keyboard("{Enter}");
  await user.tab();
  await user.keyboard(" ");
  expect(select.mock.calls).toEqual([["C04-S02-A"], ["C04-S02-B"]]);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Employee B New" }),
  );
  await user.click(screen.getByRole("button", { name: "Previous" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(intent.mock.calls).toEqual([["PREVIOUS"], ["CONTINUE"]]);
});

it("honors blocked and omitted capabilities, even with supplied selection metadata", async () => {
  const select = vi.fn();
  const intent = vi.fn();
  const view = render(
    <AnchoredChangeTrack
      frame={frame}
      blocked
      onIntent={intent}
      onSelect={select}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Employee B New" }));
  expect(select).not.toHaveBeenCalled();
  view.rerender(
    <AnchoredChangeTrack
      frame={{ ...frame, allowedLearnerIntents: [] }}
      blocked={false}
      onIntent={intent}
      onSelect={select}
    />,
  );
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});
