// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { C04ResponseControls } from "./C04ResponseControls";
import type { C04Presentation } from "./public";
afterEach(cleanup);
const base: C04Presentation = {
  frame: {
    activityId: "C04-A04",
    stateId: "ACTIVE",
    contentReferences: [],
    exposedModelFacts: [],
    exposedDerivedFacts: [],
    allowedLearnerIntents: ["COMMIT_PRIMARY_RESPONSE"],
    responseStage: "PRIMARY",
  },
  fields: [
    {
      role: "percentage",
      required: true,
      acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
      unit: "%",
    },
  ],
  blocked: false,
  onIntent: vi.fn(),
  onSelect: vi.fn(),
  onDraft: vi.fn(),
};
it("keeps malformed drafts from commitment and supports keyboard UNDEFINED", async () => {
  const user = userEvent.setup();
  render(<C04ResponseControls {...base} />);
  const button = screen.getByRole("button", {
    name: "Commit primary response",
  });
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByRole("textbox"), "-");
  expect(button.hasAttribute("disabled")).toBe(true);
  screen.getByRole("checkbox").focus();
  await user.keyboard(" ");
  expect(button.hasAttribute("disabled")).toBe(false);
  await user.click(button);
  expect(base.onIntent).toHaveBeenCalledWith("COMMIT_PRIMARY_RESPONSE");
  expect(base.onDraft).toHaveBeenLastCalledWith({ percentage: "UNDEFINED" });
});
it("blocks response controls during technical barriers", () => {
  render(<C04ResponseControls {...base} blocked />);
  for (const element of screen.getAllByRole("textbox"))
    expect((element as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByRole<HTMLInputElement>("checkbox").disabled).toBe(true);
});
