import { describe, expect, it } from "vitest";
import { c04CompletionEligible } from "./public";
import type { C04CompletionEvidence } from "./public";

const confirmed = { outcome: "CONFIRMED", diagnostic: null } as const;
const reconsideration = {
  outcome: "RECONSIDERATION",
  diagnostic: "RECONSIDER_QUANTITY",
} as const;
const evidence = (
  evaluation: C04CompletionEvidence["evaluation"] = confirmed,
): C04CompletionEvidence => ({
  activityId: "C04-A04",
  responseRevision: 2,
  checkedRevision: 2,
  feedbackRevision: 2,
  evaluation,
});
describe("C04 completion currency", () => {
  it("allows confirmed and reconsideration only after applicable feedback", () => {
    expect(c04CompletionEligible(evidence())).toBe(true);
    expect(c04CompletionEligible(evidence(reconsideration))).toBe(true);
    expect(
      c04CompletionEligible({ ...evidence(), feedbackRevision: null }),
    ).toBe(false);
    expect(
      c04CompletionEligible({
        ...evidence(),
        checkedRevision: null,
        feedbackRevision: null,
        evaluation: null,
      }),
    ).toBe(false);
  });
  it("rejects stale check and feedback until revised response is checked and fed back", () => {
    const revised = { ...evidence(reconsideration), responseRevision: 3 };
    expect(c04CompletionEligible(revised)).toBe(false);
    expect(
      c04CompletionEligible({
        ...revised,
        checkedRevision: 3,
        feedbackRevision: null,
      }),
    ).toBe(false);
    expect(
      c04CompletionEligible({
        ...revised,
        checkedRevision: 3,
        feedbackRevision: 3,
      }),
    ).toBe(true);
  });
  it("rejects forged, inconsistent or scoring evidence", () => {
    for (const invalid of [
      null,
      { ...evidence(), points: 1 },
      { ...evidence(), evaluation: { outcome: "SCORED", diagnostic: null } },
      { ...evidence(), feedbackRevision: 3 },
      { ...evidence(), checkedRevision: null },
      { ...evidence(), evaluation: { ...confirmed, penalty: 1 } },
      { ...evidence(), responseRevision: NaN },
    ])
      expect(() =>
        c04CompletionEligible(invalid as C04CompletionEvidence),
      ).toThrow(TypeError);
  });
});
