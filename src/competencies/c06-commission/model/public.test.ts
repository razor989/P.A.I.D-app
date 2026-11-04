import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { Quantity } from "@/core/public";
import {
  applyC06ModelIntent,
  createC06ModelState,
  deriveC06ModelState,
  projectC06PersistedModelV1,
  restoreC06ModelState,
  validateC06PersistedModelV1,
} from "./public";
import type {
  C06ModelCase,
  C06ModelDefinition,
  C06ModelIntent,
  C06ModelState,
} from "./public";

const money = (v: string, basis: string | null) =>
  quantity(ExactDecimal.from(v), "MONETARY_AMOUNT", "PHP", basis);
const known = (value: Quantity) => ({ kind: "KNOWN" as const, value });
function fixture(index: 1 | 2 | 3 | 4): C06ModelDefinition {
  const activityId = `C06-A0${index}` as C06ModelDefinition["activityId"];
  const scenarioId = `C06-S0${index}` as C06ModelDefinition["scenarioId"];
  const salesBasis = index === 2 ? "per month" : index === 4 ? "June" : null;
  const make = (
    sales: string,
    percent: string,
    base: string | null,
    child: "A" | "B" | null,
  ): C06ModelCase => ({
    childId: child
      ? (`${scenarioId}-${child}` as C06ModelCase["childId"])
      : null,
    sales: known(money(sales, salesBasis)),
    commissionRate: known(
      quantity(ExactDecimal.from(percent), "PERCENTAGE_RATE", "%", null),
    ),
    ...(base === null
      ? {
          arrangement: "STRAIGHT_COMMISSION" as const,
          baseSalary: { kind: "NOT_APPLICABLE" as const },
        }
      : {
          arrangement: "BASE_PLUS_COMMISSION" as const,
          baseSalary: known(money(base, "per month")),
          periodAlignment: {
            salesBasis,
            baseSalaryBasis: "per month",
            compensationBasis: index === 4 ? "June" : "per month",
          },
        }),
  });
  return {
    activityId,
    scenarioId,
    cases:
      index === 1
        ? [make("80000", "5", null, "A"), make("80000", "5", "10000", "B")]
        : index === 2
          ? [
              make("300000", "3", "15000", "A"),
              make("500000", "3", "15000", "B"),
            ]
          : [
              index === 3
                ? make("2000000", "5", null, null)
                : make("120000", "3", "15000", null),
            ],
  };
}

describe("C06 approved semantic model", () => {
  it.each(["sales", "commissionRate", "baseSalary"] as const)(
    "rejects model zero or missing %s instead of adding participant states",
    (key) => {
      for (const replacement of [
        { kind: "UNKNOWN", reason: "not established" },
        known(
          key === "commissionRate"
            ? quantity(ExactDecimal.from("0"), "PERCENTAGE_RATE", "%", null)
            : money("0", key === "sales" ? "June" : "per month"),
        ),
      ]) {
        const source = fixture(4);
        Object.assign(source.cases[0]!, { [key]: replacement });
        expect(() => createC06ModelState(source)).toThrow();
      }
    },
  );
  it("rejects forged ExactDecimal and non-data quantity properties", () => {
    const source = fixture(3);
    const forged = Object.freeze(
      Object.create(ExactDecimal.prototype),
    ) as ExactDecimal;
    Object.assign(source.cases[0]!, {
      sales: known(quantity(forged, "MONETARY_AMOUNT", "PHP", null)),
    });
    expect(() => createC06ModelState(source)).toThrow();
    const other = fixture(3);
    let touched = false;
    const value = {
      get magnitude() {
        touched = true;
        return ExactDecimal.from("1");
      },
      kind: "MONETARY_AMOUNT",
      unit: "PHP",
      basis: null,
    };
    Object.assign(other.cases[0]!, { sales: { kind: "KNOWN", value } });
    expect(() => createC06ModelState(other)).toThrow();
    expect(touched).toBe(false);
  });
  it("rejects hidden or prototype-bearing checkpoint fields", () => {
    const source = fixture(1);
    const state = createC06ModelState(source);
    const hidden = { ...state };
    Object.defineProperty(hidden, "selectedChildId", {
      value: "C06-S01-A",
      enumerable: false,
    });
    expect(() => validateC06PersistedModelV1(hidden, source)).toThrow();
    expect(() =>
      restoreC06ModelState(Object.assign(Object.create({}), state), source),
    ).toThrow();
  });
  it("recomputes restored selection using current source rather than saved outputs", () => {
    const source = fixture(1);
    const state = applyC06ModelIntent(createC06ModelState(source), {
      type: "SELECT_CHILD",
      childId: "C06-S01-B",
    });
    const evidence = projectC06PersistedModelV1(state, source);
    const current = fixture(1);
    Object.assign(current.cases[1]!, {
      baseSalary: known(money("20000", "per month")),
    });
    const snapshot = deriveC06ModelState(
      restoreC06ModelState(evidence, current),
    );
    if (snapshot.arrangement !== "BASE_PLUS_COMMISSION")
      throw new Error("Expected Base-Plus");
    expect(
      snapshot.totalCompensation.resolution.kind === "KNOWN" &&
        snapshot.totalCompensation.resolution.value.magnitude.toString(),
    ).toBe("24000");
    // This synthetic validation fixture is not a newly authorized study scenario.
  });
  it.each([
    [1, "C06-S01-A", "4000", null],
    [1, "C06-S01-B", "4000", "14000"],
    [2, "C06-S02-A", "9000", "24000"],
    [2, "C06-S02-B", "15000", "30000"],
    [3, null, "100000", null],
    [4, null, "3600", "18600"],
  ] as const)("derives approved %s/%s", (index, child, commission, total) => {
    const initial = createC06ModelState(fixture(index));
    const state = child
      ? applyC06ModelIntent(initial, { type: "SELECT_CHILD", childId: child })
      : initial;
    const snapshot = deriveC06ModelState(state);
    expect(
      snapshot.commission.resolution.kind === "KNOWN" &&
        snapshot.commission.resolution.value.magnitude.toString(),
    ).toBe(commission);
    if (snapshot.arrangement === "BASE_PLUS_COMMISSION")
      expect(
        snapshot.totalCompensation.resolution.kind === "KNOWN" &&
          snapshot.totalCompensation.resolution.value.magnitude.toString(),
      ).toBe(total);
    else {
      expect(snapshot.baseSalary).toEqual({ kind: "NOT_APPLICABLE" });
      expect(snapshot).not.toHaveProperty("totalCompensation");
    }
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
  it("changes complete A01 arrangements without hybrid/zero base states", () => {
    const a = createC06ModelState(fixture(1));
    const b = applyC06ModelIntent(a, {
      type: "SELECT_CHILD",
      childId: "C06-S01-B",
    });
    expect(deriveC06ModelState(a).arrangement).toBe("STRAIGHT_COMMISSION");
    expect(deriveC06ModelState(b).arrangement).toBe("BASE_PLUS_COMMISSION");
    expect(a).not.toHaveProperty("response");
    expect(Object.isFrozen(b)).toBe(true);
  });
  it("A02 changes sales only, not rate/base or sales remainder", () => {
    const a = createC06ModelState(fixture(2));
    const b = applyC06ModelIntent(a, {
      type: "SELECT_CHILD",
      childId: "C06-S02-B",
    });
    const before = deriveC06ModelState(a),
      after = deriveC06ModelState(b);
    expect(after.commissionRate).toEqual(before.commissionRate);
    expect(after.baseSalary).toEqual(before.baseSalary);
    expect(
      after.sales.kind === "KNOWN" && after.sales.value.magnitude.toString(),
    ).toBe("500000");
    expect(after).not.toHaveProperty("remainingSales");
  });
  it.each([3, 4] as const)(
    "A0%s is static and has no mutable selection",
    (index) => {
      const state = createC06ModelState(fixture(index));
      expect(state).not.toHaveProperty("selectedChildId");
      expect(() =>
        applyC06ModelIntent(state, {
          type: "SELECT_CHILD",
          childId: "C06-S01-A",
        }),
      ).toThrow();
      expect(() => projectC06PersistedModelV1(state, fixture(index))).toThrow();
    },
  );
  it.each([
    { type: "SET_RATE", value: "5" },
    { type: "SET_SALES", value: "80" },
    { type: "SET_BASE", value: "0" },
    { type: "SET_COMMISSION", value: "4" },
    { type: "SET_TOTAL", value: "14" },
    { type: "setField", path: "sales", value: "0" },
    { type: "SELECT_CHILD", childId: "C06-S02-A" },
    {
      type: "SELECT_CHILD",
      childId: "C06-S01-A",
      response: "STRAIGHT_COMMISSION",
    },
  ])("rejects forbidden intent %#", (intent) =>
    expect(() =>
      applyC06ModelIntent(
        createC06ModelState(fixture(1)),
        intent as C06ModelIntent,
      ),
    ).toThrow(),
  );
  it("rejects copied, forged and restored-without-issuance states", () => {
    const state = createC06ModelState(fixture(1));
    for (const fake of [
      { ...state },
      JSON.parse(JSON.stringify(state)),
      { activityId: "C06-A03", scenarioId: "C06-S03" },
    ])
      expect(() => deriveC06ModelState(fake as C06ModelState)).toThrow();
  });
  it("defensively copies source quantities/periods", () => {
    const source = fixture(4);
    const state = createC06ModelState(source);
    const entry = source.cases[0]!;
    Object.assign(entry, { sales: known(money("1", "June")) });
    const snapshot = deriveC06ModelState(state);
    expect(
      snapshot.commission.resolution.kind === "KNOWN" &&
        snapshot.commission.resolution.value.magnitude.toString(),
    ).toBe("3600");
  });
  it.each([1, 2] as const)(
    "roundtrips only A0%s selection and recomputes",
    (index) => {
      const source = fixture(index);
      const state = applyC06ModelIntent(createC06ModelState(source), {
        type: "SELECT_CHILD",
        childId: index === 1 ? "C06-S01-B" : "C06-S02-B",
      });
      const evidence = projectC06PersistedModelV1(state, source);
      expect(Object.keys(evidence).sort()).toEqual([
        "activityId",
        "scenarioId",
        "selectedChildId",
      ]);
      const restored = restoreC06ModelState(
        JSON.parse(JSON.stringify(evidence)),
        fixture(index),
      );
      expect(deriveC06ModelState(restored)).toEqual(deriveC06ModelState(state));
      expect(restored).not.toBe(state);
    },
  );
  it.each([
    "commission",
    "totalCompensation",
    "baseSalary",
    "response",
    "feedback",
    "periodAlignment",
  ])("rejects persisted extra %s", (key) => {
    const source = fixture(2),
      state = createC06ModelState(source);
    expect(() =>
      restoreC06ModelState({ ...state, [key]: "injected" }, source),
    ).toThrow();
  });
  it("rejects source mismatch during live projection", () => {
    const source = fixture(1),
      state = createC06ModelState(source);
    const other = fixture(1);
    Object.assign(other.cases[1]!, {
      baseSalary: known(money("20000", "per month")),
    });
    expect(() => projectC06PersistedModelV1(state, other)).toThrow(
      /source mismatch/,
    );
  });
  it("rejects foreign scenario/child persisted evidence", () => {
    expect(() =>
      validateC06PersistedModelV1(
        {
          activityId: "C06-A01",
          scenarioId: "C06-S01",
          selectedChildId: "C06-S02-A",
        },
        fixture(1),
      ),
    ).toThrow();
  });
  it.each([
    (d: C06ModelDefinition) => ({ ...d, scenarioId: "C06-S04" }),
    (d: C06ModelDefinition) => ({ ...d, cases: [d.cases[1], d.cases[0]] }),
    (d: C06ModelDefinition) => ({ ...d, cases: [d.cases[0]] }),
    (d: C06ModelDefinition) => ({ ...d, cases: Array(2) }),
    (d: C06ModelDefinition) => ({
      ...d,
      cases: [
        { ...d.cases[0], baseSalary: known(money("0", "per month")) },
        d.cases[1],
      ],
    }),
    (d: C06ModelDefinition) => ({
      ...d,
      cases: [
        d.cases[0],
        { ...d.cases[1], sales: known(money("90000", null)) },
      ],
    }),
    (d: C06ModelDefinition) => ({
      ...d,
      cases: [
        d.cases[0],
        {
          ...d.cases[1],
          commissionRate: known(
            quantity(ExactDecimal.from("3"), "PERCENTAGE_RATE", "%", null),
          ),
        },
      ],
    }),
    (d: C06ModelDefinition) => ({
      ...d,
      cases: [d.cases[0], { ...d.cases[1], commission: money("4000", null) }],
    }),
  ])("rejects invalid source definition %#", (change) =>
    expect(() =>
      createC06ModelState(change(fixture(1)) as C06ModelDefinition),
    ).toThrow(),
  );
  it("rejects altered A02 invariant base", () => {
    const d = fixture(2);
    Object.assign(d.cases[1]!, { baseSalary: known(money("1", "per month")) });
    expect(() => createC06ModelState(d)).toThrow(/invariant/);
  });
  it("rejects incorrect contextual period evidence", () => {
    const d = fixture(4);
    Object.assign(d.cases[0]!, {
      periodAlignment: {
        salesBasis: "June",
        baseSalaryBasis: "per month",
        compensationBasis: "May",
      },
    });
    expect(() => createC06ModelState(d)).toThrow(/period/);
  });
  it("rejects source getter without reading it", () => {
    let called = false;
    const d = fixture(1);
    Object.defineProperty(d.cases, "0", {
      enumerable: true,
      get() {
        called = true;
        return d;
      },
    });
    expect(() => createC06ModelState(d)).toThrow();
    expect(called).toBe(false);
  });
});
