import { describe, expect, it } from "vitest";
import * as revision from "./public";
import { studyDefinitionRevision } from "./public";

describe("P10-D027/S1 Study revision authority", () => {
  it("exposes the exact owner-assigned ASCII identity", () => {
    expect(studyDefinitionRevision).toBe("PAID-STUDY-DEF-R001");
    expect(typeof studyDefinitionRevision).toBe("string");
    expect(
      [...studyDefinitionRevision].every((c) => c.charCodeAt(0) < 128),
    ).toBe(true);
  });

  it("has one read-only public authority and no setter or alternate provider", () => {
    expect(Object.keys(revision)).toEqual(["studyDefinitionRevision"]);
    expect(Reflect.set(revision, "studyDefinitionRevision", "forged")).toBe(
      false,
    );
    expect(revision.studyDefinitionRevision).toBe(studyDefinitionRevision);
  });

  it("retains the same identity across repeated module reads", async () => {
    const first = await import("./public");
    const second = await import("./public");
    expect(first.studyDefinitionRevision).toBe(studyDefinitionRevision);
    expect(second.studyDefinitionRevision).toBe(studyDefinitionRevision);
    expect(first).toBe(second);
  });
});
