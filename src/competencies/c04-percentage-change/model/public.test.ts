import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "../../../core/public";
import { calculateC04Change } from "../math/public";
import {
  applyC04ModelIntent,
  createC04ModelState,
  deriveC04ModelState,
} from "./public";
import type {
  C04ModelDefinition,
  C04ModelIntent,
  C04ModelState,
} from "./public";

// Test-local source-derived fixtures; future composition owns actual study membership.
const money = (value: string, unit = "PHP", basis = "per month") =>
  quantity(ExactDecimal.from(value), "MONETARY_AMOUNT", unit, basis);
const pair = (
  original: string,
  next: string,
  label: string,
  childId: string | null = null,
) => ({
  childId,
  original: { role: `Original ${label} (reference)`, value: money(original) },
  newValue: { role: `New ${label}`, value: money(next) },
});
const fixtures = {
  "C04-A01": {
    activityId: "C04-A01",
    scenarioId: "C04-S01",
    cases: [pair("18000", "18000", "monthly salary")],
  },
  "C04-A02": {
    activityId: "C04-A02",
    scenarioId: "C04-S02",
    cases: [
      pair("20000", "22000", "C04-S02-A monthly salary", "C04-S02-A"),
      pair("10000", "12000", "C04-S02-B monthly salary", "C04-S02-B"),
    ],
  },
  "C04-A03": {
    activityId: "C04-A03",
    scenarioId: "C04-S03",
    cases: [pair("30000", "27000", "advertised monthly offer")],
  },
  "C04-A04": {
    activityId: "C04-A04",
    scenarioId: "C04-S04",
    cases: [pair("0", "1500", "monthly communication allowance")],
  },
} as const;
const select = (childId: string) =>
  ({ type: "SELECT_CHILD", childId }) as C04ModelIntent;
const create = (id: keyof typeof fixtures) =>
  createC04ModelState(fixtures[id] as C04ModelDefinition);
// Match T021's separate test-only oracle import convention without production dependencies.
const oraclePath: string = "../../../../tests/oracles/public";
const { resolveOracle } = (await import(/* @vite-ignore */ oraclePath)) as {
  resolveOracle: (
    criteria: Readonly<{ id: string; caseId?: string }>,
  ) => Readonly<{
    expected: Readonly<{
      resolution: string;
      availability: string;
      magnitude: string | null;
    }> | null;
  }>;
};

describe("C04 injected pure model", () => {
  const rows = [
    ["C04-A01", "C04-S01", "18000", "18000", "0", "0", "NO_CHANGE"],
    ["C04-A02", "C04-S02-A", "20000", "22000", "2000", "10", "INCREASE"],
    ["C04-A03", "C04-S03", "30000", "27000", "-3000", "-10", "DECREASE"],
  ] as const;
  it.each(rows)(
    "%s retains paired facts and derives %s",
    (activity, id, original, next, difference, percent, direction) => {
      const state = create(activity);
      const view = deriveC04ModelState(state);
      expect(state.scenarioId).toBe(fixtures[activity].scenarioId);
      expect(view.original.value.magnitude.toString()).toBe(original);
      expect(view.newValue.value.magnitude.toString()).toBe(next);
      expect(view.change.direction).toBe(direction);
      expect(view.change.difference.resolution.kind).toBe("KNOWN");
      expect(view.change.percentageChange.resolution.kind).toBe("KNOWN");
      if (
        view.change.difference.resolution.kind !== "KNOWN" ||
        view.change.percentageChange.resolution.kind !== "KNOWN"
      )
        throw new Error("known case required");
      expect(view.change.difference.resolution.value.magnitude.toString()).toBe(
        difference,
      );
      expect(
        view.change.percentageChange.resolution.value.magnitude.toString(),
      ).toBe(percent);
      expect(view.change).toEqual(
        calculateC04Change(view.original.value, view.newValue.value),
      );
      const oracle = resolveOracle({
        id: `${id}:percentage-change`,
        ...(id === "C04-S02-A" ? { caseId: id } : {}),
      });
      expect(
        view.change.percentageChange.resolution.value.magnitude.equals(
          ExactDecimal.from(oracle.expected!.magnitude!),
        ),
      ).toBe(true);
    },
  );

  it("switches A→B→A repeatedly with no mixed Original or cumulative state", () => {
    const a = create("C04-A02");
    const b = applyC04ModelIntent(a, select("C04-S02-B"));
    const back = applyC04ModelIntent(b, select("C04-S02-A"));
    const aView = deriveC04ModelState(a);
    const bView = deriveC04ModelState(b);
    expect(back).toEqual(a);
    expect(back).not.toBe(a);
    expect([
      aView.original.value.magnitude.toString(),
      aView.newValue.value.magnitude.toString(),
    ]).toEqual(["20000", "22000"]);
    expect([
      bView.original.value.magnitude.toString(),
      bView.newValue.value.magnitude.toString(),
    ]).toEqual(["10000", "12000"]);
    expect(bView.change.difference).toEqual(aView.change.difference);
    expect(bView.change.percentageChange.resolution.kind).toBe("KNOWN");
    if (bView.change.percentageChange.resolution.kind !== "KNOWN")
      throw new Error("known B required");
    expect(
      bView.change.percentageChange.resolution.value.magnitude.toString(),
    ).toBe("20");
    expect(bView.change).toEqual(
      calculateC04Change(bView.original.value, bView.newValue.value),
    );
    expect(
      bView.change.percentageChange.resolution.value.magnitude.equals(
        ExactDecimal.from(
          resolveOracle({
            id: "C04-S02-B:percentage-change",
            caseId: "C04-S02-B",
          }).expected!.magnitude!,
        ),
      ),
    ).toBe(true);
    let state = a;
    for (let i = 0; i < 12; i++)
      state = applyC04ModelIntent(
        state,
        select(i % 2 ? "C04-S02-A" : "C04-S02-B"),
      );
    expect(deriveC04ModelState(state)).toEqual(aView);
    expect(deriveC04ModelState(b)).toEqual(bView);
  });

  it("keeps zero Original established with available difference and withheld undefined percent", () => {
    const result = deriveC04ModelState(create("C04-A04"));
    expect(result.original.value.magnitude.toString()).toBe("0");
    expect(result.change.difference.availability).toBe("AVAILABLE");
    expect(result.change.difference.resolution.kind).toBe("KNOWN");
    if (result.change.difference.resolution.kind !== "KNOWN")
      throw new Error("known difference required");
    expect(result.change.difference.resolution.value.magnitude.toString()).toBe(
      "1500",
    );
    expect(result.change.direction).toBe("INCREASE");
    expect(result.change.relativeChange).toEqual({
      resolution: { kind: "UNDEFINED", reason: "Original value is zero" },
      availability: "WITHHELD",
    });
    expect(result.change.percentageChange).toEqual(
      result.change.relativeChange,
    );
    expect("value" in result.change.percentageChange.resolution).toBe(false);
    expect(
      resolveOracle({ id: "C04-S04:absolute-difference" }).expected,
    ).toMatchObject({
      resolution: "KNOWN",
      availability: "AVAILABLE",
      magnitude: "+1500",
    });
    expect(
      resolveOracle({ id: "C04-S04:percentage-change" }).expected,
    ).toMatchObject({
      resolution: "UNDEFINED",
      availability: "WITHHELD",
      magnitude: null,
    });
  });

  it("defensively copies the definition, freezes nested outputs, and derives deterministically", () => {
    const mutable = {
      ...fixtures["C04-A02"],
      cases: fixtures["C04-A02"].cases.map((item) => ({
        ...item,
        original: { ...item.original },
        newValue: { ...item.newValue },
      })),
    };
    const state = createC04ModelState(mutable as C04ModelDefinition);
    const before = deriveC04ModelState(state);
    mutable.cases[0]!.original.role = "Original corrupted";
    expect(deriveC04ModelState(state)).toEqual(before);
    expect(deriveC04ModelState(state)).toEqual(deriveC04ModelState(state));
    for (const value of [
      state,
      before,
      before.original,
      before.original.value,
      before.original.value.magnitude,
      before.change,
      before.change.difference,
      before.change.difference.resolution,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(() =>
      Object.assign(state, { selectedChildId: "C04-S02-B" }),
    ).toThrow(TypeError);
    expect(() =>
      Object.assign(before.original.value, { basis: "weekly" }),
    ).toThrow(TypeError);
    expect(() =>
      Object.assign(before.change.difference.resolution, { kind: "UNDEFINED" }),
    ).toThrow(TypeError);
  });

  it("accepts exactly four primary pairs and two A02 children, not extra activities", () => {
    expect(Object.keys(fixtures)).toEqual([
      "C04-A01",
      "C04-A02",
      "C04-A03",
      "C04-A04",
    ]);
    expect(fixtures["C04-A02"].cases.map((item) => item.childId)).toEqual([
      "C04-S02-A",
      "C04-S02-B",
    ]);
    for (const id of Object.keys(fixtures) as (keyof typeof fixtures)[])
      expect(deriveC04ModelState(create(id)).state.activityId).toBe(id);
  });

  it("rejects malformed definitions, forged primary identity and invalid quantity semantics", () => {
    const valid = fixtures["C04-A02"];
    for (const invalid of [
      null,
      {},
      { ...valid, activityId: "C04-A05" },
      { ...valid, scenarioId: "C04-S03" },
      { ...valid, cases: [] },
      { ...valid, cases: [valid.cases[0]] },
      { ...valid, cases: [...valid.cases, valid.cases[1]] },
      { ...valid, cases: [...valid.cases].reverse() },
      {
        ...valid,
        cases: [valid.cases[0], { ...valid.cases[1], childId: "C04-S02-C" }],
      },
      {
        ...valid,
        cases: [valid.cases[0], { ...valid.cases[1], childId: "C04-S03-A" }],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          { ...valid.cases[1], original: valid.cases[0].original },
        ],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          { ...valid.cases[1], newValue: valid.cases[0].newValue },
        ],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          pair("10000", "13000", "C04-S02-B monthly salary", "C04-S02-B"),
        ],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          {
            ...valid.cases[1],
            newValue: {
              role: "New weekly salary",
              value: money("12000", "PHP", "per week"),
            },
          },
        ],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          {
            ...valid.cases[1],
            newValue: { role: "New USD salary", value: money("12000", "USD") },
          },
        ],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          {
            ...valid.cases[1],
            newValue: { role: "New salary", value: "12000" },
          },
        ],
      },
      {
        ...valid,
        cases: [
          valid.cases[0],
          {
            ...valid.cases[1],
            original: { role: "Original salary", value: money("-1") },
          },
        ],
      },
      {
        ...fixtures["C04-A01"],
        cases: [pair("18000", "17000", "monthly salary")],
      },
      {
        ...fixtures["C04-A01"],
        cases: [pair("0", "0", "monthly salary")],
      },
      {
        ...fixtures["C04-A03"],
        cases: [pair("30000", "31000", "advertised offer")],
      },
      {
        ...fixtures["C04-A04"],
        cases: [pair("1", "1500", "monthly allowance")],
      },
      { ...valid, unexpected: true },
    ])
      expect(() =>
        createC04ModelState(invalid as C04ModelDefinition),
      ).toThrow();
  });

  it("rejects forged or altered state rather than accepting a structural copy", () => {
    const valid = create("C04-A02");
    for (const invalid of [
      null,
      {},
      { ...valid },
      { ...valid, scenarioId: "C04-S03" },
      { ...valid, selectedChildId: "C04-S02-C" },
      { ...valid, selectedChildId: 1 },
      { ...valid, newValue: 12000 },
      Object.freeze({ ...valid }),
    ]) {
      expect(() => deriveC04ModelState(invalid as C04ModelState)).toThrow(
        TypeError,
      );
      expect(() =>
        applyC04ModelIntent(invalid as C04ModelState, select("C04-S02-B")),
      ).toThrow(TypeError);
    }
  });

  it("rejects static selection, unknown children, edits, sliders, swaps and unexpected fields", () => {
    const a = create("C04-A02");
    for (const id of ["C04-S02-C", "C04-S03-A", "C04-S01", "", "Employee C", 1])
      expect(() => applyC04ModelIntent(a, select(id as string))).toThrow(
        TypeError,
      );
    for (const intent of [
      null,
      undefined,
      {},
      { type: "SET_NEW", newValue: 23000 },
      { type: "SET_ORIGINAL", original: 1 },
      { type: "DRAG", position: 0.5 },
      { type: "SLIDER", percent: 15 },
      { type: "INCREMENT", amount: 2000 },
      { type: "SWAP" },
      { type: "SELECT_CHILD", childId: "C04-S02-B", newValue: 12000 },
      { type: "SELECT_CHILD", childId: "C04-S02-A", index: 1 },
      Object.create({ type: "SELECT_CHILD", childId: "C04-S02-A" }),
    ])
      expect(() => applyC04ModelIntent(a, intent as C04ModelIntent)).toThrow(
        TypeError,
      );
    for (const id of ["C04-A01", "C04-A03", "C04-A04"] as const)
      expect(() =>
        applyC04ModelIntent(create(id), select("C04-S02-A")),
      ).toThrow(TypeError);
  });
});
