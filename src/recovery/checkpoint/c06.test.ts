import { describe, expect, it } from "vitest";
import { createC06ActivityActor } from "@/engine/c06-activity-binding/public";
import { projectC06CheckpointV4 } from "../projection/public";
import {
  createRecoveryCheckpointV4,
  parseRecoveryCheckpointV4,
  serializeRecoveryCheckpointV4,
  validateRecoveryCheckpointV4,
  parseRecoveryCheckpointV1,
  parseRecoveryCheckpointV2,
  parseRecoveryCheckpointV3,
} from "./public";

describe("C06 V4 closed envelope", () => {
  it("round-trips canonical V4 and fences old parsers", () => {
    const a = createC06ActivityActor("C06-A04");
    try {
      const p = createRecoveryCheckpointV4(projectC06CheckpointV4(a));
      const json = serializeRecoveryCheckpointV4(p);
      expect(parseRecoveryCheckpointV4(json)).toEqual(p);
      for (const parse of [
        parseRecoveryCheckpointV1,
        parseRecoveryCheckpointV2,
        parseRecoveryCheckpointV3,
      ])
        expect(() => parse(json)).toThrow();
      for (const patch of [
        { schemaVersion: 3 },
        { studyDefinitionRevision: "obsolete" },
        { kind: "snapshot" },
        { cachedAnswer: 3600 },
      ])
        expect(() =>
          validateRecoveryCheckpointV4({ ...p, ...patch }),
        ).toThrow();
      expect(() => parseRecoveryCheckpointV4("not-json")).toThrow();
      expect(() => parseRecoveryCheckpointV4("null")).toThrow();
    } finally {
      a.stop();
    }
  });
});
