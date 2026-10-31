import { expect, it } from "vitest";
import { constructC04Response } from "./c04-response-adapter";
import type { ResponseField } from "./c04-response-adapter";
const field: ResponseField = {
  role: "difference",
  required: true,
  acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
  quantityKind: "MONETARY_AMOUNT",
  unit: "PHP",
  basis: "per month",
};
it("constructs exact quantities without deciding correctness", () => {
  const response = constructC04Response([field], { difference: "-3000" });
  expect(response?.kind).toBe("COMPOSITE");
  if (response?.kind !== "COMPOSITE") throw new Error("Expected composite");
  const value = response.parts[0]!.response;
  expect(value.kind).toBe("EXACT_QUANTITY");
  if (value.kind === "EXACT_QUANTITY") {
    expect(value.value.magnitude.toString()).toBe("-3000");
    expect(value.value.basis).toBe("per month");
  }
});
it.each(["", "-", "1.", "1,500", "NaN", "Infinity", " 10 "])(
  "rejects incomplete/malformed draft %s",
  (difference) => {
    expect(constructC04Response([field], { difference })).toBeNull();
  },
);
it("preserves semantic UNDEFINED rather than substituting zero", () => {
  expect(
    constructC04Response([field], { difference: "UNDEFINED" }),
  ).toMatchObject({
    parts: [
      {
        response: {
          kind: "SEMANTIC_BOUNDARY",
          resolution: { kind: "UNDEFINED" },
        },
      },
    ],
  });
});
it("accepts only exposed option identities and omits empty optional fields", () => {
  const choice = {
    role: "reason",
    required: true,
    acceptedKinds: ["SINGLE_SELECTION"],
    options: [{ id: "public", text: "Approved" }],
  };
  expect(constructC04Response([choice], { reason: "private" })).toBeNull();
  expect(
    constructC04Response([{ ...field, required: false }, choice], {
      reason: "public",
    }),
  ).toMatchObject({ parts: [{ key: "reason" }] });
});
