import { describe, expect, it } from "vitest";
import { ExactDecimal } from "../exact-decimal/public";
import { quantity } from "../quantities/public";
import { isLearnerResponse, parseLearnerResponse } from "./public";
import type { LearnerResponse } from "./public";

const amount = quantity(
  ExactDecimal.from("0.100"),
  "rate",
  "percent",
  "per sale",
);
const selection = { kind: "SINGLE_SELECTION", selectionId: "option:1" };

describe("response structural contracts", () => {
  it("accepts identity-based single selections but not text or wrong payloads", () => {
    expect(isLearnerResponse(selection)).toBe(true);
    expect(
      isLearnerResponse({ kind: "SINGLE_SELECTION", selectionId: " " }),
    ).toBe(false);
    expect(
      isLearnerResponse({ kind: "SINGLE_SELECTION", selectionIds: ["a"] }),
    ).toBe(false);
    expect(isLearnerResponse({ ...selection, answer: true })).toBe(false);
  });

  it("preserves distinct multiple selections and rejects duplicates or empty sets", () => {
    const input = { kind: "MULTIPLE_SELECTIONS", selectionIds: ["a", "b"] };
    const parsed = parseLearnerResponse(input);
    input.selectionIds.push("c");
    expect(parsed).toEqual({
      kind: "MULTIPLE_SELECTIONS",
      selectionIds: ["a", "b"],
    });
    expect(
      isLearnerResponse({ kind: input.kind, selectionIds: ["a", "a"] }),
    ).toBe(false);
    expect(isLearnerResponse({ kind: input.kind, selectionIds: [] })).toBe(
      false,
    );
  });

  it("retains exact magnitude, kind, unit and basis without converting to JS floats", () => {
    const parsed = parseLearnerResponse({
      kind: "EXACT_QUANTITY",
      value: amount,
    });
    expect(parsed).toEqual({ kind: "EXACT_QUANTITY", value: amount });
    expect(
      isLearnerResponse({
        kind: "EXACT_QUANTITY",
        value: { ...amount, magnitude: 0.1 },
      }),
    ).toBe(false);
    expect(
      isLearnerResponse({
        kind: "EXACT_QUANTITY",
        value: { ...amount, basis: " " },
      }),
    ).toBe(false);
    expect(
      isLearnerResponse({
        kind: "EXACT_QUANTITY",
        value: quantity(
          ExactDecimal.from("0.1"),
          "multiplier",
          "percent",
          "per sale",
        ),
      }),
    ).toBe(true);
    expect(
      isLearnerResponse({
        kind: "EXACT_QUANTITY",
        value: quantity(ExactDecimal.from("0.1"), "rate", "ratio", null),
      }),
    ).toBe(true);
    expect(
      isLearnerResponse({
        kind: "EXACT_QUANTITY",
        value: { ...amount, additional: "unapproved" },
      }),
    ).toBe(false);
  });

  it("accepts nonnumeric boundary states without treating KNOWN as a boundary", () => {
    expect(
      parseLearnerResponse({
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "UNDEFINED", reason: "zero original" },
      }),
    ).toEqual({
      kind: "SEMANTIC_BOUNDARY",
      resolution: { kind: "UNDEFINED", reason: "zero original" },
    });
    expect(
      isLearnerResponse({
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "UNKNOWN", reason: "missing input" },
      }),
    ).toBe(true);
    expect(
      isLearnerResponse({
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "NOT_APPLICABLE" },
      }),
    ).toBe(true);
    expect(
      isLearnerResponse({
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "KNOWN", value: amount },
      }),
    ).toBe(false);
    expect(
      isLearnerResponse({
        kind: "SEMANTIC_BOUNDARY",
        resolution: { kind: "UNDEFINED", reason: " " },
      }),
    ).toBe(false);
  });

  it("validates bounded composite keyed atomic responses without an activity language", () => {
    const response = {
      kind: "COMPOSITE",
      parts: [
        { key: "choice", response: selection },
        { key: "amount", response: { kind: "EXACT_QUANTITY", value: amount } },
      ],
    };
    expect(isLearnerResponse(response)).toBe(true);
    expect(
      isLearnerResponse({
        ...response,
        parts: [response.parts[0], response.parts[0]],
      }),
    ).toBe(false);
    expect(
      isLearnerResponse({ ...response, parts: [{ key: "nested", response }] }),
    ).toBe(false);
    expect(isLearnerResponse({ ...response, parts: [] })).toBe(false);
  });

  it("validates model identity and meaningful keyed states without interpreting them", () => {
    const response = {
      kind: "MODEL_STATE",
      modelId: "model:1",
      entries: [{ key: "assignment", response: selection }],
    };
    expect(isLearnerResponse(response)).toBe(true);
    expect(isLearnerResponse({ ...response, modelId: "" })).toBe(false);
    expect(
      isLearnerResponse({
        ...response,
        entries: [{ key: "assignment", response: { kind: "SCORE", value: 1 } }],
      }),
    ).toBe(false);
    expect(isLearnerResponse({ kind: "UNKNOWN_KIND", selectionId: "a" })).toBe(
      false,
    );
  });

  it("does not determine correctness from valid input", () => {
    expect(
      isLearnerResponse({
        kind: "SINGLE_SELECTION",
        selectionId: "not-an-authorized-option",
      }),
    ).toBe(true);
    expect(isLearnerResponse({ kind: "EXACT_QUANTITY", value: amount })).toBe(
      true,
    );
    expect(() =>
      parseLearnerResponse({ kind: "EXACT_QUANTITY", value: "0.1" }),
    ).toThrow(TypeError);
  });
});

// @ts-expect-error incompatible discriminant and payload
const invalid: LearnerResponse = { kind: "EXACT_QUANTITY", selectionId: "a" };
void invalid;
