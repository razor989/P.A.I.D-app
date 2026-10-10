// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import "./jsdom-setup";

describe("React verification infrastructure", () => {
  it("renders and interacts with a test-only control in jsdom", async () => {
    const user = userEvent.setup();
    render(<button type="button">Harness control</button>);

    const button = screen.getByRole("button", { name: "Harness control" });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveFocus();
  });
});
