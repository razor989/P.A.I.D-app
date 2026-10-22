// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ResponseRegion } from "./public";
import type { DecimalDraft } from "../controls/public";
afterEach(cleanup);

it("is optional grouping without invented actions", () => {
  render(<ResponseRegion legend="Source region" controls={[]} />);
  expect(screen.getByRole("group", { name: "Source region" })).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});

it("composes supplied controls and forwards only supplied callback intents", async () => {
  const action = vi.fn(),
    choice = vi.fn(),
    draft = vi.fn<(value: DecimalDraft) => void>();
  render(
    <ResponseRegion
      legend="Source region"
      description="Caller description"
      controls={[
        {
          id: "a",
          kind: "action",
          props: { label: "Caller action", onAction: action },
        },
        {
          id: "b",
          kind: "choice",
          props: {
            mode: "single",
            legend: "Caller choices",
            options: [{ id: "source", label: "Source", checked: false }],
            onChoice: choice,
          },
        },
        {
          id: "c",
          kind: "decimal",
          props: {
            label: "Caller decimal",
            draft: "",
            descriptions: {
              empty: "Empty",
              incomplete: "Incomplete",
              malformed: "Malformed",
              valid: "Valid",
              composing: "Editing",
            },
            onDraftChange: draft,
          },
        },
      ]}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button"));
  await user.click(screen.getByRole("radio"));
  await user.type(screen.getByRole("textbox"), "1");
  expect(action).toHaveBeenCalledTimes(1);
  expect(choice).toHaveBeenCalledWith({ optionId: "source", checked: true });
  const result = draft.mock.lastCall?.[0];
  expect(result?.state).toBe("valid");
  if (result?.state === "valid") expect(result.candidate.toString()).toBe("1");
});
