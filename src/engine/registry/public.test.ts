import { describe, expect, it } from "vitest";
import type { ExecutableActivityBinding } from "./public";
import { ActivityRegistry } from "./public";

// Test-only structural binding; NOT a canonical C04 Study manifest or answer bank.
const fixture = (): ExecutableActivityBinding => ({
  activityId: "C04-A01",
  definition: {
    activityId: "C04-A01",
    edges: { ENTRY: { CONTINUE: "ACTIVE" } },
    support: { ACTIVE: ["REVIEW"] },
  },
  ports: {
    ready: () => true,
    evaluate: () => ({ outcome: "CONFIRMED", diagnostic: null }),
    completionEligible: () => true,
    sourceReviewAvailable: () => false,
    informationNeeded: () => false,
    informationReturn: () => false,
  },
});

describe("closed executable registry", () => {
  it("distinguishes the canonical 4/4/4/4/5/4 universe from bound executions", () => {
    const registry = new ActivityRegistry([]);
    const counts = ["C01", "C02", "C03", "C04", "C05", "C06"].map(
      (competency) =>
        Array.from({ length: 9 }, (_, index) =>
          registry.isKnown(`${competency}-A0${index + 1}`),
        ).filter(Boolean).length,
    );
    expect(counts).toEqual([4, 4, 4, 4, 5, 4]);
    expect(counts.reduce((sum, count) => sum + count)).toBe(25);
    expect(registry.isKnown("C04-A02")).toBe(true);
    expect(() => registry.resolve("C04-A02")).toThrow(/Unbound activity ID/);
    for (const id of [
      "C02-S01-F",
      "C05-PV-JAMES-01",
      "C04-A1",
      "C01-A05",
      "C07-A01",
      "C04-A01 ",
    ]) {
      expect(registry.isKnown(id)).toBe(false);
      expect(() => registry.resolve(id)).toThrow(/Unknown activity ID/);
    }
  });

  it("retains an immutable independent graph and port table, without freezing caller input", () => {
    const input = fixture();
    const registry = new ActivityRegistry([input]);
    const saved = registry.resolve("C04-A01");
    expect(registry.resolve("C04-A01")).toBe(saved);
    expect(saved).not.toBe(input);
    (input.definition.edges.ENTRY as { CONTINUE: string }).CONTINUE = "EXP-99";
    (input.definition.support.ACTIVE as string[]).push("REINFORCEMENT");
    (input.ports as { ready: typeof input.ports.ready }).ready = () => false;
    expect(saved.definition.edges.ENTRY?.CONTINUE).toBe("ACTIVE");
    expect(saved.definition.support.ACTIVE).toEqual(["REVIEW"]);
    expect(
      saved.ports.ready({ kind: "SINGLE_SELECTION", selectionId: "choice" }),
    ).toBe(true);
    expect(
      () =>
        ((saved.definition.edges.ENTRY as { CONTINUE: string }).CONTINUE =
          "EXP-99"),
    ).toThrow();
    expect(() =>
      (saved.definition.support.ACTIVE as string[]).push("REINFORCEMENT"),
    ).toThrow();
    expect(
      () =>
        ((saved.ports as { ready: typeof saved.ports.ready }).ready = () =>
          false),
    ).toThrow();
    expect(
      () => ((saved as { activityId: string }).activityId = "C01-A01"),
    ).toThrow();
  });

  it("rejects duplicates, mismatched keys, malformed definitions and incomplete ports", () => {
    const base = fixture();
    const register = (change: object) =>
      new ActivityRegistry([{ ...base, ...change }]);
    expect(() => new ActivityRegistry([fixture(), fixture()])).toThrow(
      /Duplicate/,
    );
    expect(() => register({ activityId: "C04-S01" })).toThrow();
    expect(() => register({ activityId: "C01-A01" })).toThrow(/Conflicting/);
    expect(() =>
      register({ definition: { ...base.definition, activityId: "C04-A02" } }),
    ).toThrow(/Conflicting/);
    expect(() => register({ definition: undefined })).toThrow();
    expect(() =>
      register({ definition: { ...base.definition, edges: {} } }),
    ).toThrow();
    expect(() =>
      register({
        definition: {
          ...base.definition,
          edges: { ENTRY: { CONTINUE: "EXP-99" } },
        },
      }),
    ).toThrow();
    for (const name of [
      "ready",
      "evaluate",
      "completionEligible",
      "sourceReviewAvailable",
      "informationNeeded",
      "informationReturn",
    ] as const) {
      expect(() =>
        register({ ports: { ...base.ports, [name]: null } }),
      ).toThrow(/Invalid activity ports/);
    }
    expect(() => register({ ports: [] })).toThrow(/Invalid activity ports/);
    expect(() =>
      register({ ports: { ...base.ports, unexpected: true } }),
    ).toThrow(/Invalid activity ports/);
    expect(() => register({ extra: true })).toThrow(/Invalid executable/);
    expect(() => new ActivityRegistry(null as never)).toThrow(
      /Invalid registrations/,
    );
  });
});
