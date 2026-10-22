// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ActionButton,
  ChoiceGroup,
  ExactDecimalInput,
  assessDecimalDraft,
} from "./public";
import type { DecimalDraft } from "./public";

afterEach(cleanup);
const descriptions = {
  empty: "Enter a value",
  incomplete: "Complete the decimal",
  malformed: "Use a finite decimal",
  valid: "Usable decimal, not graded",
  composing: "Editing text",
};

it("retains native button types, keyboard activation and disabled behavior", async () => {
  const action = vi.fn();
  const view = render(<ActionButton label="Intent" onAction={action} />);
  const button = screen.getByRole("button", { name: "Intent" });
  expect(button.getAttribute("type")).toBe("button");
  button.focus();
  await userEvent.setup().keyboard("{Enter} ");
  expect(action).toHaveBeenCalledTimes(2);
  view.rerender(
    <ActionButton label="Intent" type="submit" disabled onAction={action} />,
  );
  expect(button.getAttribute("type")).toBe("submit");
  await userEvent.setup().click(button);
  expect(action).toHaveBeenCalledTimes(2);
});

it.each(["single", "multiple"] as const)(
  "forwards native %s semantic IDs without guessing selection",
  async (mode) => {
    const onChoice = vi.fn();
    render(
      <ChoiceGroup
        mode={mode}
        legend="Source choices"
        description="Source description"
        options={[
          { id: "source-a", label: "First", checked: false },
          {
            id: "source-b",
            label: "Unavailable",
            checked: false,
            disabled: true,
          },
        ]}
        onChoice={onChoice}
      />,
    );
    expect(
      screen
        .getByRole("group", { name: "Source choices" })
        .getAttribute("aria-describedby"),
    ).toBeTruthy();
    const input = screen.getByLabelText("First");
    expect(input.getAttribute("value")).toBe("source-a");
    await userEvent.setup().click(input);
    expect(onChoice).toHaveBeenCalledWith({
      optionId: "source-a",
      checked: true,
    });
    await userEvent.setup().click(screen.getByLabelText("Unavailable"));
    expect(onChoice).toHaveBeenCalledTimes(1);
  },
);

it("disables the native group without dispatching intent", async () => {
  const intent = vi.fn();
  render(
    <ChoiceGroup
      mode="multiple"
      legend="Disabled"
      disabled
      options={[{ id: "a", label: "A", checked: true }]}
      onChoice={intent}
    />,
  );
  await userEvent.setup().click(screen.getByLabelText("A"));
  expect(intent).not.toHaveBeenCalled();
});

it.each([
  ["", "empty"],
  ["-", "incomplete"],
  ["+", "incomplete"],
  ["1.", "incomplete"],
  [".", "incomplete"],
  ["1,25", "malformed"],
  ["1e3", "malformed"],
  [" 2", "malformed"],
  ["NaN", "malformed"],
  [".5", "malformed"],
  ["0", "valid"],
  ["-0.125", "valid"],
  ["+001.2300", "valid"],
  ["9007199254740993.0000000000000001", "valid"],
])("classifies lossless draft %j as %s", (draft, state) => {
  const result = assessDecimalDraft(draft);
  expect(result.state).toBe(state);
  expect(result.draft).toBe(draft);
  if (result.state === "valid")
    expect(result.candidate.toString()).toBe(
      draft === "+001.2300" ? "1.23" : draft,
    );
  else expect(result.candidate).toBeNull();
});

it("associates usability explanations, keeps valid candidates ungraded and preserves IME drafts", () => {
  const changes = vi.fn<(draft: DecimalDraft) => void>();
  function Harness() {
    const [draft, setDraft] = useState("");
    return (
      <ExactDecimalInput
        label="Decimal"
        draft={draft}
        descriptions={descriptions}
        required
        onDraftChange={(next: DecimalDraft) => {
          changes(next);
          setDraft(next.draft);
        }}
      />
    );
  }
  render(<Harness />);
  const input = screen.getByRole("textbox");
  expect(input.getAttribute("type")).toBe("text");
  expect(input.getAttribute("inputmode")).toBe("decimal");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(input, { target: { value: "1." } });
  expect(screen.getByText("Complete the decimal").id).toBe(
    input.getAttribute("aria-describedby"),
  );
  fireEvent.change(input, { target: { value: "123.456000" } });
  expect(input.getAttribute("aria-invalid")).toBeNull();
  expect(input.getAttribute("value")).toBe("123.456000");
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "１２" } });
  expect(changes).toHaveBeenLastCalledWith({
    state: "composing",
    draft: "１２",
    candidate: null,
  });
  expect(input.getAttribute("aria-invalid")).toBeNull();
  fireEvent.compositionEnd(input, { target: { value: "12" } });
  expect(changes.mock.lastCall?.[0].state).toBe("valid");
});

it("does not mark an optional empty input invalid", () => {
  render(
    <ExactDecimalInput
      label="Optional"
      draft=""
      descriptions={descriptions}
      disabled
      onDraftChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
});
