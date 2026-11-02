import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import * as api from "./public";
import type {
  C03ModelDefinition,
  C03ModelIntent,
  C03ModelState,
} from "./public";

// Test-only source rows: PP10-A-0202-C03-001; protected Study remains independently tested.
const q = (
  n: string,
  kind: string,
  unit: string,
  basis: string | null = null,
) => quantity(ExactDecimal.from(n), kind, unit, basis);
function definition(index = 1): C03ModelDefinition {
  const rows = [
    [
      "C03-A01",
      "C03-S01",
      "ordinary-day record",
      "100",
      "2",
      "ordinary working day",
      "1.25",
    ],
    [
      "C03-A02",
      "C03-S02",
      "paired fixed conditions",
      "100",
      "2",
      "ordinary working day",
      "1.25",
    ],
    [
      "C03-A03",
      "C03-S03",
      "monthly aggregate overtime hours",
      "75",
      "10",
      "ordinary working day",
      "1.25",
    ],
    [
      "C03-A04",
      "C03-S04",
      "regular-holiday single day",
      "120",
      "3",
      "regular holiday",
      "2.60",
    ],
  ] as const;
  const [activityId, scenarioId, evidenceMode, r, h, condition, m] =
    rows[index]!;
  const first = {
    childId: index === 1 ? ("C03-S02-A" as const) : null,
    condition,
    rate: q(r, "MONETARY_RATE", "PHP", "per hour"),
    hours: q(h, "DURATION", "hours"),
    multiplier: q(m, "MULTIPLIER", "dimensionless"),
  };
  return {
    activityId,
    scenarioId,
    evidenceMode,
    cases:
      index === 1
        ? [
            first,
            {
              ...first,
              childId: "C03-S02-B",
              condition: "rest day",
              multiplier: q("1.69", "MULTIPLIER", "dimensionless"),
            },
          ]
        : [first],
  };
}
const create = (index = 1) => api.createC03ModelState(definition(index));
const select = (state: C03ModelState, childId: "C03-S02-A" | "C03-S02-B") =>
  api.applyC03ModelIntent(state, { type: "SELECT_CHILD", childId });
const pay = (state: C03ModelState) => {
  const result = api.deriveC03ModelState(state).overtimePay.resolution;
  if (result.kind !== "KNOWN") throw new Error("Expected source-known pay");
  return result.value.magnitude.toString();
};

describe("C03 Simplified Overtime Work Record model", () => {
  it.each([
    [0, "250"],
    [1, "250"],
    [2, "937.5"],
    [3, "936"],
  ] as const)(
    "issues approved activity %i and derives its exact result",
    (index, expected) => {
      const state = create(index);
      expect(pay(state)).toBe(expected);
      expect(state.activityId).toBe(definition(index).activityId);
      expect(state.scenarioId).toBe(definition(index).scenarioId);
      expect(Object.isFrozen(state)).toBe(true);
    },
  );
  it("selects complete causal conditions, preserves invariants and has deterministic repeated selection", () => {
    const initial = create();
    const rest = select(initial, "C03-S02-B");
    const a = api.deriveC03ModelState(initial);
    const b = api.deriveC03ModelState(rest);
    expect([a.condition, b.condition]).toEqual([
      "ordinary working day",
      "rest day",
    ]);
    expect([
      a.multiplier.magnitude.toString(),
      b.multiplier.magnitude.toString(),
    ]).toEqual(["1.25", "1.69"]);
    expect([pay(initial), pay(rest)]).toEqual(["250", "338"]);
    expect([a.rate, a.hours]).toEqual([b.rate, b.hours]);
    expect(api.deriveC03ModelState(select(rest, "C03-S02-B"))).toEqual(b);
    expect(pay(select(rest, "C03-S02-A"))).toBe("250");
    expect(pay(initial)).toBe("250");
  });
  it.each([0, 2, 3])(
    "keeps static activity %i free of mutable selection/control evidence",
    (index) => {
      const state = create(index);
      expect(Object.keys(state)).toEqual(["activityId", "scenarioId"]);
      expect(() => select(state, "C03-S02-B")).toThrow();
      expect(() =>
        api.projectC03PersistedModelV1(state, definition(index)),
      ).toThrow();
    },
  );
  it("preserves aggregate versus approved single-day modes without fabricating shifts", () => {
    const james = api.deriveC03ModelState(create(2));
    const mara = api.deriveC03ModelState(create(3));
    expect(james.evidenceMode).toBe("monthly aggregate overtime hours");
    expect(james.hours.magnitude.toString()).toBe("10");
    expect(mara.evidenceMode).toBe("regular-holiday single day");
    expect(mara.hours.magnitude.toString()).toBe("3");
    expect(Object.keys(james)).toEqual([
      "state",
      "evidenceMode",
      "condition",
      "rate",
      "hours",
      "multiplier",
      "overtimePay",
    ]);
    expect(Object.keys(mara)).toEqual(Object.keys(james));
  });
  it.each([
    { type: "SET_MULTIPLIER", value: "1.69" },
    { type: "setField", field: "hours", value: "18" },
    { type: "SET_RATE", value: "200" },
    { type: "SELECT_CHILD", childId: "C03-S04" },
    { type: "SELECT_CHILD", childId: "C04-S02-A" },
    { type: "SELECT_CHILD", childId: "C03-S02-B", multiplier: "1.25" },
    null,
  ])("rejects unauthorized intent without altering issued state", (intent) => {
    const state = create();
    expect(() =>
      api.applyC03ModelIntent(state, intent as C03ModelIntent),
    ).toThrow();
    expect(pay(state)).toBe("250");
  });
  it("does not export independent multiplier mutation, grading, navigation or storage", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "applyC03ModelIntent",
        "createC03ModelState",
        "deriveC03ModelState",
        "projectC03PersistedModelV1",
        "restoreC03ModelState",
        "validateC03PersistedModelV1",
      ].sort(),
    );
  });
  it.each([
    {},
    null,
    { ...create() },
    Object.freeze({
      ...create(),
      activityId: "C03-A04",
      scenarioId: "C03-S04",
    }),
  ])("rejects unissued/forged model state", (state) => {
    expect(() => api.deriveC03ModelState(state as C03ModelState)).toThrow();
    expect(() => select(state as C03ModelState, "C03-S02-B")).toThrow();
  });
  it.each([
    { activityId: "C03-A05" },
    { scenarioId: "C03-S03" },
    { evidenceMode: "single 18-hour shift" },
    { shiftDistribution: [2, 2, 2, 2, 2] },
    { providerProvenance: { competencyId: "C05" } },
    { expectedPay: "250" },
  ])(
    "rejects invented identities, evidence or provider conversion",
    (patch) => {
      expect(() =>
        api.createC03ModelState({
          ...definition(),
          ...patch,
        } as C03ModelDefinition),
      ).toThrow();
    },
  );
  it.each([
    { condition: "regular holiday" },
    { multiplier: q("1.69", "MULTIPLIER", "dimensionless") },
    { multiplier: q("1.25", "PERCENTAGE", "%") },
    { rate: q("100", "MONETARY_RATE", "PHP", "per month") },
    { rate: q("0", "MONETARY_RATE", "PHP", "per hour") },
    { hours: q("-1", "DURATION", "hours") },
    { childId: "C03-S02-C" },
    { shifts: ["invented"] },
  ])("rejects invalid source case semantics", (patch) => {
    const source = definition();
    expect(() =>
      api.createC03ModelState({
        ...source,
        cases: [{ ...source.cases[0]!, ...patch }, source.cases[1]!],
      } as C03ModelDefinition),
    ).toThrow();
  });
  it("rejects paired invariant changes, missing/extra children and fabricated James allocation", () => {
    const source = definition();
    for (const cases of [
      [source.cases[0]!],
      [...source.cases, source.cases[0]!],
      [
        source.cases[0]!,
        { ...source.cases[1]!, hours: q("3", "DURATION", "hours") },
      ],
      [
        source.cases[0]!,
        {
          ...source.cases[1]!,
          rate: q("200", "MONETARY_RATE", "PHP", "per hour"),
        },
      ],
    ])
      expect(() => api.createC03ModelState({ ...source, cases })).toThrow();
    expect(() =>
      api.createC03ModelState({
        ...definition(2),
        evidenceMode: "regular-holiday single day",
      }),
    ).toThrow();
    expect(() =>
      api.createC03ModelState({
        ...definition(2),
        shifts: ["18 hours"],
      } as C03ModelDefinition),
    ).toThrow();
  });
  it("defensively copies definitions; transitions never mutate input or expose private cases", () => {
    const source = definition();
    const before = JSON.stringify(source);
    const state = api.createC03ModelState(source);
    select(state, "C03-S02-B");
    expect(JSON.stringify(source)).toBe(before);
    (source as { evidenceMode: string }).evidenceMode = "forged";
    (source.cases as unknown[])[0] = null;
    expect(pay(state)).toBe("250");
    expect(() => api.createC03ModelState(source)).toThrow();
    const snapshot = api.deriveC03ModelState(state);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.rate)).toBe(true);
    expect(() =>
      Object.assign(state, { selectedChildId: "C03-S02-B" }),
    ).toThrow();
  });
  it("rejects accessor/prototype/sparse/hidden data without evaluating source getters", () => {
    let reads = 0;
    const source = definition();
    const getter = Object.defineProperty({ ...source }, "cases", {
      enumerable: true,
      get() {
        reads++;
        return source.cases;
      },
    });
    const sparse: unknown[] = new Array<unknown>(2);
    for (const value of [
      getter,
      Object.create(source) as unknown,
      { ...source, cases: sparse },
      Object.defineProperty({ ...source }, "evidenceMode", {
        enumerable: false,
      }),
    ])
      expect(() =>
        api.createC03ModelState(value as C03ModelDefinition),
      ).toThrow();
    expect(reads).toBe(0);
    const forged = Object.freeze(
      Object.create(ExactDecimal.prototype),
    ) as ExactDecimal;
    expect(() =>
      api.createC03ModelState({
        ...source,
        cases: [
          {
            ...source.cases[0]!,
            rate: { ...source.cases[0]!.rate, magnitude: forged },
          },
          source.cases[1]!,
        ],
      }),
    ).toThrow();
  });

  it.each(["C03-S02-A", "C03-S02-B"] as const)(
    "round-trips minimal %s selection and recomputes from source",
    (childId) => {
      const state = select(create(), childId);
      const evidence = api.projectC03PersistedModelV1(state, definition());
      expect(evidence).toEqual({
        activityId: "C03-A02",
        scenarioId: "C03-S02",
        selectedChildId: childId,
      });
      const parsed: unknown = JSON.parse(JSON.stringify(evidence));
      expect(api.validateC03PersistedModelV1(parsed, definition())).toEqual(
        evidence,
      );
      expect(() => api.deriveC03ModelState(parsed as C03ModelState)).toThrow();
      const restored = api.restoreC03ModelState(parsed, definition());
      expect(restored).not.toBe(state);
      expect(api.deriveC03ModelState(restored)).toEqual(
        api.deriveC03ModelState(state),
      );
    },
  );
  it.each([
    { activityId: "C03-A03" },
    { scenarioId: "C03-S04" },
    { selectedChildId: "obsolete" },
    { overtimePay: "338" },
    { multiplier: "1.69" },
    { hours: "2" },
    { checked: true },
    { schemaVersion: 2 },
  ])("rejects fabricated/obsolete checkpoint fields", (patch) => {
    const value = {
      activityId: "C03-A02",
      scenarioId: "C03-S02",
      selectedChildId: "C03-S02-A",
      ...patch,
    };
    expect(() =>
      api.validateC03PersistedModelV1(value, definition()),
    ).toThrow();
    expect(() => api.restoreC03ModelState(value, definition())).toThrow();
  });
  it("requires matching live issuance and current trusted checkpoint authority", () => {
    const state = create();
    const evidence = api.projectC03PersistedModelV1(state, definition());
    expect(() =>
      api.projectC03PersistedModelV1({ ...state }, definition()),
    ).toThrow();
    expect(() =>
      api.validateC03PersistedModelV1(evidence, definition(0)),
    ).toThrow();
    const source = definition();
    const changed = {
      ...source,
      cases: source.cases.map((c) => ({
        ...c,
        rate: q("101", "MONETARY_RATE", "PHP", "per hour"),
      })),
    };
    expect(() => api.projectC03PersistedModelV1(state, changed)).toThrow();
    expect(() =>
      api.projectC03PersistedModelV1(state, {
        ...source,
        scenarioId: "C03-S03",
      }),
    ).toThrow();
  });
});
