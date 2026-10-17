import { describe, expect, it } from "vitest";
import { studyDefinitionRevision } from "@/study/revision/public";
import {
  createRecoveryCheckpointV1,
  parseRecoveryCheckpointV1,
  serializeRecoveryCheckpointV1,
  validateRecoveryCheckpointV1,
} from "./public";
import type { C04CheckpointV1 } from "../projection/public";

const initial: C04CheckpointV1 = {
  competencyId: "C04",
  activityId: "C04-A01",
  scenarioId: "C04-S01",
  position: "ENTRY",
  response: null,
  responseRevision: 0,
  hasChecked: false,
  checkedResponse: null,
  checkedRevision: null,
  feedbackRevision: null,
  evaluation: null,
};
describe("T029 strict V1 envelope", () => {
  it("uses sole Study authority and round trips canonically", () => {
    const envelope = createRecoveryCheckpointV1(initial);
    expect(envelope.studyDefinitionRevision).toBe(studyDefinitionRevision);
    expect(Object.isFrozen(envelope.checkpoint)).toBe(true);
    const json = serializeRecoveryCheckpointV1(envelope);
    expect(parseRecoveryCheckpointV1(json)).toEqual(envelope);
    expect(serializeRecoveryCheckpointV1(parseRecoveryCheckpointV1(json))).toBe(
      json,
    );
    expect(
      serializeRecoveryCheckpointV1(
        Object.fromEntries(Object.entries(envelope).reverse()),
      ),
    ).toBe(json);
  });
  it.each([
    { schemaVersion: 2 },
    { schemaVersion: "1" },
    { studyDefinitionRevision: "PAID-STUDY-DEF-R002" },
    { kind: "completed" },
    { extra: true },
    { checkpoint: { ...initial, scenarioId: "C04-S03" } },
    { checkpoint: { ...initial, position: "COMPLETE" } },
    { checkpoint: { ...initial, position: "EXP-01" } },
    { checkpoint: { ...initial, learnerId: "forbidden" } },
  ])("rejects incompatible or unsupported %j", (change) => {
    expect(() =>
      validateRecoveryCheckpointV1({
        ...createRecoveryCheckpointV1(initial),
        ...change,
      }),
    ).toThrow();
  });
  it("rejects non-data and malformed JSON without invoking accessors", () => {
    const envelope = createRecoveryCheckpointV1(initial);
    expect(() =>
      validateRecoveryCheckpointV1(Object.create(envelope)),
    ).toThrow();
    expect(() =>
      validateRecoveryCheckpointV1({
        ...envelope,
        checkpoint: { ...initial, responseRevision: NaN },
      }),
    ).toThrow();
    expect(() =>
      validateRecoveryCheckpointV1(
        Object.defineProperty({}, "checkpoint", {
          get() {
            throw new Error("getter executed");
          },
        }),
      ),
    ).toThrow("Non-data checkpoint property");
    expect(() => parseRecoveryCheckpointV1("{")).toThrow();
  });
});
