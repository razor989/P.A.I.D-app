// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import { QuantityReadout, SemanticBoundaryValue } from "./public";
afterEach(cleanup);

it("preserves exact value, kind/unit/basis and authorized context in DOM order", () => {
  const view = render(
    <QuantityReadout
      label="Source rate"
      quantity={quantity(
        ExactDecimal.from("123456789.123456789"),
        "rate",
        "source units",
        "source basis",
      )}
      condition="Source condition"
      provenance="Source provenance"
    />,
  );
  expect(view.container.textContent).toBe(
    "Source rateValue123456789.123456789KindrateUnitsource unitsBasissource basisConditionSource conditionProvenanceSource provenance",
  );
});

it("renders exact zero without fabricating an absent basis", () => {
  render(
    <SemanticBoundaryValue
      value={{
        kind: "KNOWN",
        readout: {
          label: "Zero",
          quantity: quantity(ExactDecimal.from("0"), "count", "items", null),
        },
      }}
    />,
  );
  expect(screen.getByText("0")).toBeDefined();
  expect(screen.queryByText("Basis")).toBeNull();
});

it.each([
  ["NOT_APPLICABLE", "Not Applicable"],
  ["UNKNOWN", "Unknown"],
  ["UNDEFINED", "Undefined"],
] as const)(
  "distinguishes %s with only authorized explanation",
  (kind, label) => {
    render(
      <SemanticBoundaryValue
        value={{ kind, label: "Source label", reason: "Authorized reason" }}
      />,
    );
    expect(screen.getByText(`Source label: ${label}`)).toBeDefined();
    expect(screen.getByText("Authorized reason")).toBeDefined();
  },
);

it("never traverses or spreads hidden payloads in a withheld projection", () => {
  const withheld = {
    kind: "WITHHELD" as const,
    label: "Source label",
    get reason(): string {
      throw new Error("Must not inspect reason");
    },
    get readout(): never {
      throw new Error("Must not inspect truth");
    },
    secret: "FORBIDDEN-987654",
  };
  const view = render(<SemanticBoundaryValue value={withheld} />);
  expect(view.container.innerHTML).not.toContain("FORBIDDEN");
  expect(view.container.textContent).toBe("Source label: Withheld");
});
