import { describe, expect, it } from "vitest";
import { projectC04Reference } from "./c04-reference-projection";

function frame(): Parameters<typeof projectC04Reference>[0] {
  return {
    activityId: "C04-A02",
    stateId: "EXP-02",
    contentReferences: [],
    exposedModelFacts: [],
    exposedDerivedFacts: [],
    allowedLearnerIntents: [],
    responseContract: { id: "contract", text: "contract" },
    reviewAvailability: false,
    sourceReviewAvailability: false,
    completionActionAvailability: false,
  };
}

describe("reference mathematical projection exposure boundary", () => {
  it("permits fixed-model explanation values only at C04-A02 completion without mutating exposure", () => {
    const complete = { ...frame(), stateId: "COMPLETE" };
    const before = structuredClone(complete);
    expect(projectC04Reference(complete)).toMatchObject({
      A: { difference: "2000", percentage: "10", relative: "0.1" },
      B: { difference: "2000", percentage: "20", relative: "0.2" },
    });
    expect(complete).toEqual(before);
    expect(
      projectC04Reference({ ...complete, activityId: "C04-A01" }),
    ).toBeUndefined();
    for (const stateId of [
      "ENTRY",
      "EXP-02",
      "ACTIVE",
      "CONFIRMATION",
      "RECONSIDERATION",
    ]) {
      expect(
        projectC04Reference({ ...complete, stateId })?.A?.percentage,
      ).toBeNull();
      expect(
        projectC04Reference({ ...complete, stateId })?.B?.difference,
      ).toBeNull();
    }
  });
  it("requires separate exact employee exposure for each derived quantity", () => {
    const before = frame();
    expect(projectC04Reference(before)?.A?.percentage).toBeNull();
    const engaged = {
      ...before,
      exposedDerivedFacts: [
        {
          id: "c04/S02/authored-focus/C04-S02-A/difference",
          text: "source-owned difference",
        },
        {
          id: "c04/S02/authored-focus/C04-S02-A/percentage",
          text: "source-owned percentage",
        },
      ],
    };
    expect(projectC04Reference(engaged)?.A).toMatchObject({
      difference: "2000",
      percentage: "10",
      relative: "0.1",
    });
    expect(projectC04Reference(engaged)?.B?.percentage).toBeNull();
    expect(
      projectC04Reference({
        ...engaged,
        exposedDerivedFacts: engaged.exposedDerivedFacts.slice(0, 1),
      })?.A?.percentage,
    ).toBeNull();
  });
  it("rejects lookalike exposure IDs and does not parse display text", () => {
    const source = frame();
    for (const id of [
      "foreign/authored-focus/C04-S02-A/percentage",
      "c04/S02/authored-focus/C04-S02-A/percentage-extra",
      "c04/S02/engaged-track/C04-S02-A/percentage",
    ]) {
      expect(
        projectC04Reference({
          ...source,
          exposedDerivedFacts: [{ id, text: "10%" }],
        })?.A?.percentage,
      ).toBeNull();
    }
    const projected = projectC04Reference({
      ...source,
      exposedDerivedFacts: [
        {
          id: "c04/S02/authored-focus/C04-S02-A/percentage",
          text: "not a numeric display string",
        },
      ],
    });
    expect(projected?.A?.percentage).toBe("10");
    expect(projected?.B?.percentage).toBeNull();
    expect(
      projectC04Reference({ ...source, activityId: "C04-A01" }),
    ).toBeUndefined();
  });
});
