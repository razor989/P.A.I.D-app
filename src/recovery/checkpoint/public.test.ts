import { describe, expect, it } from "vitest";
import { studyDefinitionRevision } from "@/study/revision/public";
import {
  createRecoveryCheckpointV1,
  parseRecoveryCheckpointV1,
  serializeRecoveryCheckpointV1,
  validateRecoveryCheckpointV1,
  createRecoveryCheckpointV2,
  parseRecoveryCheckpointV2,
  serializeRecoveryCheckpointV2,
  validateRecoveryCheckpointV2,
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

// Independently identified reference tuple: D061/S6 §2, S8 §2; not an actor issuer.
const c02Initial = {
  competencyId: "C02",
  activityId: "C02-A01",
  scenarioId: "C02-S01",
  embeddedScenarioId: "C02-S01-F",
  profileId: "D5-C02-A01-REFERENCE",
  position: "ENTRY",
  response: null,
  checkedResponse: null,
  responseRevision: 0,
  hasChecked: false,
  checkedRevision: null,
  feedbackRevision: null,
  evaluation: null,
  floor: { kind: "MAIN" },
} as const;

describe("D5 explicit closed V2 envelope", () => {
  it("round trips canonically without broadening V1 or accepting V1 as V2", () => {
    const v2 = createRecoveryCheckpointV2(c02Initial);
    const text = serializeRecoveryCheckpointV2(v2);
    expect(parseRecoveryCheckpointV2(text)).toEqual(v2);
    expect(serializeRecoveryCheckpointV2(parseRecoveryCheckpointV2(text))).toBe(
      text,
    );
    expect(Object.isFrozen(v2.checkpoint.floor)).toBe(true);
    expect(() => parseRecoveryCheckpointV1(text)).toThrow();
    expect(() =>
      parseRecoveryCheckpointV2(
        serializeRecoveryCheckpointV1(createRecoveryCheckpointV1(initial)),
      ),
    ).toThrow();
  });
  it.each([
    { schemaVersion: 1 },
    { schemaVersion: "2" },
    { studyDefinitionRevision: "PAID-STUDY-DEF-R002" },
    { kind: "completed" },
    { extra: true },
    { checkpoint: { ...c02Initial, competencyId: "C01" } },
    { checkpoint: { ...c02Initial, activityId: "C02-A02" } },
    { checkpoint: { ...c02Initial, scenarioId: "C02-S02" } },
    { checkpoint: { ...c02Initial, embeddedScenarioId: "C02-S01" } },
    { checkpoint: { ...c02Initial, profileId: "production" } },
    { checkpoint: { ...c02Initial, position: "COMPLETE" } },
  ])("rejects unsupported identity/version %j", (change) => {
    expect(() =>
      validateRecoveryCheckpointV2({
        ...createRecoveryCheckpointV2(c02Initial),
        ...change,
      }),
    ).toThrow();
  });
  it("rejects unsafe values before invoking accessors or toJSON", () => {
    let invoked = false;
    const accessor = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() {
        invoked = true;
        return 2;
      },
    });
    expect(() => serializeRecoveryCheckpointV2(accessor)).toThrow(
      "Non-data checkpoint property",
    );
    expect(() =>
      validateRecoveryCheckpointV2({
        ...createRecoveryCheckpointV2(c02Initial),
        toJSON() {
          invoked = true;
          return {};
        },
      }),
    ).toThrow();
    expect(invoked).toBe(false);
    expect(() => parseRecoveryCheckpointV2("{")).toThrow();
  });
  it("rejects cycles, symbols, prototypes, decorated arrays, nonfinite values and proxy failures", () => {
    const envelope = createRecoveryCheckpointV2(c02Initial);
    const cycle: Record<string, unknown> = { ...envelope };
    cycle.self = cycle;
    const array: unknown[] & { extra?: boolean } = [];
    array.extra = true;
    for (const value of [
      cycle,
      Object.create(envelope),
      { ...envelope, hidden: Symbol("capability") },
      Object.defineProperty({ ...envelope }, "hidden", { value: true }),
      {
        ...envelope,
        checkpoint: { ...c02Initial, responseRevision: Infinity },
      },
      { ...envelope, checkpoint: array },
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("proxy trap");
          },
        },
      ),
    ])
      expect(() => serializeRecoveryCheckpointV2(value)).toThrow();
  });
});
