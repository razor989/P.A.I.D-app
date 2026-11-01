import { expect, it } from "vitest";
import { projectC04Transfer } from "./c04-transfer-projection";
type Frame = Parameters<typeof projectC04Transfer>[0];
const frame = (extra: Partial<Frame> = {}) =>
  ({
    activityId: "C04-A04",
    stateId: "ACTIVE",
    contentReferences: [],
    exposedDerivedFacts: [],
    exposedModelFacts: [
      { id: "c04/S04/selected-track/original", text: "not parsed" },
      { id: "c04/S04/selected-track/newValue", text: "not parsed" },
    ],
    ...extra,
  }) as unknown as Frame;
it("exposes established quantities, not a calculated answer or denominator scale", () => {
  expect(projectC04Transfer(frame())).toEqual({
    original: "0",
    next: "1500",
    difference: null,
    explained: false,
  });
  expect(projectC04Transfer(frame({ activityId: "C04-A03" }))).toBeUndefined();
  expect(
    projectC04Transfer(frame({ exposedModelFacts: [] }))?.original,
  ).toBeNull();
});
it("requires terminal phase AND exact authorized passage; neither feedback nor lookalikes suffice", () => {
  for (const extra of [
    { stateId: "CONFIRMATION" },
    { stateId: "RECONSIDERATION" },
    {
      stateId: "POST_CONFIRMATION_EXPLANATION",
      contentReferences: [{ id: "wrong/undefined-result", text: "wrong" }],
    },
    {
      contentReferences: [
        { id: "c04/S04/undefined-result", text: "wrong phase" },
      ],
    },
  ])
    expect(
      projectC04Transfer(frame(extra as Partial<Frame>))?.difference,
    ).toBeNull();
  expect(
    projectC04Transfer(
      frame({
        stateId: "POST_CONFIRMATION_EXPLANATION",
        contentReferences: [{ id: "c04/S04/undefined-result", text: "source" }],
      }),
    )?.difference,
  ).toBe("1500");
  expect(
    projectC04Transfer(
      frame({
        stateId: "COMPLETE",
        contentReferences: [{ id: "c04/S04/completion", text: "source" }],
      }),
    )?.explained,
  ).toBe(true);
});
