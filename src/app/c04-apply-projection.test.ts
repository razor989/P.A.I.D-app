import { expect, it } from "vitest";
import { projectC04Apply } from "./c04-apply-projection";
type SemanticActivityFrame = Parameters<typeof projectC04Apply>[0];

const frame = (extra: Partial<SemanticActivityFrame> = {}) =>
  ({
    activityId: "C04-A03",
    stateId: "ENTRY",
    exposedModelFacts: [
      { id: "c04/S03/selected-track/original", text: "source" },
      { id: "c04/S03/selected-track/newValue", text: "source" },
    ],
    exposedDerivedFacts: [],
    ...extra,
  }) as unknown as SemanticActivityFrame;
it("projects fixed source values but never an unexposed solution", () => {
  expect(projectC04Apply(frame())).toEqual({
    original: "30000",
    next: "27000",
    difference: null,
    percentage: null,
    comparisonScale: null,
  });
  expect(projectC04Apply(frame({ activityId: "C04-A02" }))).toBeUndefined();
  expect(
    projectC04Apply(frame({ exposedModelFacts: [] }))?.original,
  ).toBeNull();
});
it("requires exact derived identities independently, not outcome or suffix lookalikes", () => {
  expect(
    projectC04Apply(
      frame({
        stateId: "COMPLETE",
        exposedDerivedFacts: [
          { id: "wrong/checked/difference", text: "wrong" },
        ],
      }),
    )?.difference,
  ).toBeNull();
  expect(
    projectC04Apply(
      frame({
        exposedDerivedFacts: [
          { id: "c04/S03/checked/difference", text: "source" },
        ],
      }),
    ),
  ).toEqual({
    original: "30000",
    next: "27000",
    difference: "-3000",
    percentage: null,
    comparisonScale: null,
  });
  expect(
    projectC04Apply(
      frame({
        exposedDerivedFacts: [
          { id: "c04/S03/checked/percentage", text: "source" },
        ],
      }),
    )?.percentage,
  ).toBe("-10");
  expect(
    projectC04Apply(
      frame({
        exposedDerivedFacts: [
          { id: "c04/S03/checked/percentage", text: "source" },
        ],
      }),
    )?.comparisonScale,
  ).toBe("0.9");
});
