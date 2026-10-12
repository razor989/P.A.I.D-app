import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  c01Activities,
  c01Scenarios,
} from "../../src/study/competencies/c01/public";
import {
  c02Activities,
  c02Scenarios,
} from "../../src/study/competencies/c02/public";
import {
  c03Activities,
  c03Scenarios,
} from "../../src/study/competencies/c03/public";
import {
  c04Activities,
  c04Scenarios,
} from "../../src/study/competencies/c04/public";
import {
  c05Activities,
  c05Scenarios,
} from "../../src/study/competencies/c05/public";
import {
  c06Activities,
  c06Scenarios,
} from "../../src/study/competencies/c06/public";
import {
  oracles,
  scenarioLedger,
  deepFrozen,
  findOracles,
  matchesLiteral,
  resolveOracle,
  validateOracles,
} from "./public";
import type { Oracle } from "./public";

const get = (id: string) => resolveOracle({ id });
const alter = (
  id: string,
  change: (item: Oracle) => Oracle,
): readonly Oracle[] =>
  Object.freeze(oracles.map((item) => (item.id === id ? change(item) : item)));
const changed = (id: string, patch: Partial<Oracle>): readonly Oracle[] =>
  alter(id, (item) => Object.freeze({ ...item, ...patch }));
const expectation = (
  id: string,
  patch: Partial<NonNullable<Oracle["expected"]>>,
): readonly Oracle[] =>
  alter(id, (item) =>
    Object.freeze({
      ...item,
      expected: Object.freeze({ ...item.expected!, ...patch }),
    }),
  );

describe("T018 source-first oracle bank", () => {
  it("has exactly 25 canonical activity/scenario pairs and no support/policy progress units", () => {
    expect(scenarioLedger.map((s) => s.competency)).toEqual([
      ...Array(4).fill("C01"),
      ...Array(4).fill("C02"),
      ...Array(4).fill("C03"),
      ...Array(4).fill("C04"),
      ...Array(5).fill("C05"),
      ...Array(4).fill("C06"),
    ]);
    expect(
      new Set(scenarioLedger.map((s) => `${s.competency}-A0${s.ordinal}`)).size,
    ).toBe(25);
    expect(
      new Set(
        oracles
          .filter((o) => o.class === "PRIMARY" || o.class === "VARIANT")
          .map((o) => o.activityId),
      ).size,
    ).toBe(25);
    expect(
      oracles
        .filter((o) => o.class === "STATUTORY_QA" || o.class === "POLICY")
        .every((o) => o.activityId === null),
    ).toBe(true);
    validateOracles(oracles);
    expect(oracles.filter((o) => o.class === "PRIMARY").length).toBe(31);
    expect(oracles.filter((o) => o.class === "VARIANT").length).toBe(19);
    expect(oracles.filter((o) => o.class === "SUPPORTING").length).toBe(10);
  });
  it("traces every fixture to a real tracked authority path and actual study identity, without using producer outputs", () => {
    const activities = [
      ...c01Activities,
      ...c02Activities,
      ...c03Activities,
      ...c04Activities,
      ...c05Activities,
      ...c06Activities,
    ];
    const scenarios = [
      ...c01Scenarios,
      ...c02Scenarios,
      ...c03Scenarios,
      ...c04Scenarios,
      ...c05Scenarios,
      ...c06Scenarios,
    ];
    expect(activities.length).toBe(25);
    expect(scenarios.length).toBe(25);
    for (const fixture of oracles) {
      expect(
        existsSync(resolve("../PAID-Context-System", fixture.source.path)),
        fixture.id,
      ).toBe(true);
      expect(fixture.source.section.length).toBeGreaterThan(1);
      if (fixture.class !== "PRIMARY" && fixture.class !== "VARIANT") continue;
      expect(
        activities.some(
          (a) =>
            a.id === fixture.activityId &&
            a.scenarioIds.includes(fixture.scenarioId!),
        ),
        fixture.id,
      ).toBe(true);
      const scenario = scenarios.find((s) => s.id === fixture.scenarioId);
      expect(scenario?.activityId, fixture.id).toBe(fixture.activityId);
      if (fixture.caseId?.startsWith(`${fixture.scenarioId}-`)) {
        expect(
          scenario?.variants?.some((v) => v.id === fixture.caseId),
          fixture.id,
        ).toBe(true);
      }
    }
  });

  const results = [
    ["C01-S01:gross-income", "19200.00"],
    ["C01-S02:gross-income", "19000.00"],
    ["C01-S03:gross-income", "12937.50"],
    ["C01-S04:gross-income", "19400.00"],
    ["C02-S01:total-deductions", "1102.50"],
    ["C02-S01:net-pay", "10997.50"],
    ["C02-S02:total-deductions", "1150.00"],
    ["C02-S02:net-pay", "11787.50"],
    ["C02-S03:BIR", "31.05"],
    ["C02-S03:total-deductions", "2991.05"],
    ["C02-S03:net-pay", "21008.95"],
    ["Job A:total-deductions", "2516.30"],
    ["Job A:net-pay", "25483.70"],
    ["Job B:total-deductions", "3030.05"],
    ["Job B:net-pay", "24969.95"],
    ["C03-S01:overtime-pay", "250.00"],
    ["C03-S02-A:overtime-pay", "250.00"],
    ["C03-S02-B:overtime-pay", "338.00"],
    ["C03-S03:overtime-pay", "937.50"],
    ["C03-S04:overtime-pay", "936.00"],
    ["C04-S01:percentage-change", "0"],
    ["C04-S02-A:percentage-change", "+10"],
    ["C04-S02-B:percentage-change", "+20"],
    ["C04-S03:percentage-change", "-10"],
    ["C04-S04:absolute-difference", "+1500"],
    ["C05-S01:guided-weekly-representation", "6000"],
    ["C05-S02-A:monthly-representation", "40000"],
    ["C05-S02-B:semi-monthly-representation", "20000"],
    ["C05-S03:weekly-representation", "18000"],
    ["C05-S04:weekly-representation", "4000"],
    ["C05-S05:monthly-representation", "87000"],
    ["Worker A:commission", "4000"],
    ["Worker B:commission", "4000"],
    ["Worker B:base-plus-total", "14000"],
    ["Situation A:commission", "9000"],
    ["Situation A:base-plus-total", "24000"],
    ["Situation B:commission", "15000"],
    ["Situation B:base-plus-total", "30000"],
    ["C06-S03:commission", "100000"],
    ["C06-S04:commission", "3600"],
    ["C06-S04:base-plus-total", "18600"],
  ] as const;
  it.each(results)(
    "preserves source literal and exact magnitude %s",
    (id, literal) => {
      const record = get(id);
      expect(record.expected?.magnitude).toBe(literal);
      expect(matchesLiteral(literal, record)).toBe(true);
      expect(record.source.path).toMatch(/\.md$/);
      expect(record.conditions.length).toBeGreaterThan(0);
    },
  );

  it("separates corrected Fletcher, zero, N/A, unknown, undefined and withheld", () => {
    expect(get("C02-S03:BIR").source.decision).toContain("supersedes");
    expect(get("C02-S01:BIR").expected).toMatchObject({
      resolution: "KNOWN",
      magnitude: "0.00",
      availability: "AVAILABLE",
    });
    expect(get("Worker A:base-salary").expected).toMatchObject({
      resolution: "NOT_APPLICABLE",
      magnitude: null,
      availability: "AVAILABLE",
    });
    expect(get("missing-hours:overtime-pay").expected).toMatchObject({
      resolution: "UNKNOWN",
      magnitude: null,
      availability: "WITHHELD",
    });
    expect(get("C04-S04:percentage-change").expected).toMatchObject({
      resolution: "UNDEFINED",
      magnitude: null,
      availability: "WITHHELD",
      kind: "PERCENTAGE_CHANGE",
      unit: "%",
    });
    expect(get("C04-S04:absolute-difference").expected).toMatchObject({
      resolution: "KNOWN",
      magnitude: "+1500",
      unit: "PHP",
    });
  });
  it("preserves factor/period limitations, classification and all four actual T017 edges", () => {
    expect(get("C05-S04:weekly-representation").conditions.join()).toContain(
      "THIS week only",
    );
    expect(get("C05-S05:monthly-representation").expected?.basis).toContain(
      "261-day",
    );
    expect(get("C06-S03:commission").expected?.basis).toBeNull();
    expect(get("C05-PV-JAMES-01:regular-pay").expected?.magnitude).toBe(
      "12000",
    );
    expect(
      [
        get("C05-PV-JAMES-01:regular-pay"),
        get("C03-S03:overtime-pay"),
        get("C06-S04:commission"),
        get("C01-S03:gross-income"),
      ].map((v) => v.expected?.magnitude),
    ).toEqual(["12000", "937.50", "3600", "12937.50"]);
    expect(get("C06-S04:base-plus-total").expected?.magnitude).toBe("18600");
    expect(get("C01-S04:gross-income").expected?.magnitude).toBe("19400.00");
    expect(get("C02-S03:SSS").expected?.resolution).toBe("NOT_APPLICABLE");
    expect(get("C02-S01:GSIS").expected?.resolution).toBe("NOT_APPLICABLE");
    expect(oracles.filter((o) => o.class === "STATUTORY_QA").length).toBe(16);
    expect(oracles.filter((o) => o.class === "POLICY").length).toBe(14);
    expect(get("policy:offline").expected).toBeNull();
  });
  it("freezes all nested arrays, source and policy surfaces and rejects attempted mutation", () => {
    expect(deepFrozen(oracles)).toBe(true);
    expect(deepFrozen(scenarioLedger)).toBe(true);
    expect(deepFrozen(findOracles("C06-A01"))).toBe(true);
    expect(() => (oracles as Oracle[]).push(oracles[0]!)).toThrow();
    expect(() =>
      (get("C01-S01:gross-income").conditions as string[]).push("fake"),
    ).toThrow();
    expect(() =>
      Object.defineProperty(get("policy:offline").policy!, "behavior", {
        value: "altered",
      }),
    ).toThrow();
    expect(() => resolveOracle({ activityId: "C06-A01" })).toThrow(/ambiguous/);
    expect(() => resolveOracle({ id: "missing" })).toThrow(/missing/);
    expect(
      resolveOracle({
        scenarioId: "C06-S01",
        caseId: "Worker A",
        role: "commission",
      }).id,
    ).toBe("Worker A:commission");
  });
});

describe("malformed records rejected by actual validator", () => {
  const identity = "C01-S01:gross-income";
  it("rejects duplicate identity", () =>
    expect(() =>
      validateOracles(Object.freeze([...oracles.slice(0, -1), oracles[0]!])),
    ).toThrow());
  it.each([
    [
      "missing trace",
      changed(identity, {
        source: Object.freeze({ path: "", section: "", decision: "" }),
      }),
    ],
    ["wrong competency", changed(identity, { competencyId: "C02" })],
    ["wrong activity", changed(identity, { activityId: "C01-A02" })],
    ["wrong scenario", changed(identity, { scenarioId: "C01-S02" })],
    ["invented child", changed(identity, { caseId: "C01-S01-B" })],
    ["extra primary activity", changed(identity, { activityId: "C05-A05" })],
    ["support promoted", changed("C02-S01-F:PhilHealth", { class: "PRIMARY" })],
    [
      "policy as math",
      changed("policy:offline", { expected: get(identity).expected }),
    ],
    ["wrong role", changed(identity, { role: "net-pay" })],
    ["wrong unit", expectation(identity, { unit: "%" })],
    ["wrong kind", expectation(identity, { kind: "PERCENTAGE_CHANGE" })],
    [
      "invented period",
      expectation("C06-S03:commission", { basis: "per month" }),
    ],
    [
      "wrong availability",
      expectation("C04-S04:percentage-change", { availability: "AVAILABLE" }),
    ],
    [
      "zero replacing N/A",
      expectation("Worker A:base-salary", {
        resolution: "KNOWN",
        magnitude: "0",
      }),
    ],
    [
      "unknown replacing withheld",
      expectation("missing-hours:overtime-pay", { availability: "AVAILABLE" }),
    ],
    [
      "percentage fabricated",
      expectation("C04-S04:percentage-change", {
        resolution: "KNOWN",
        magnitude: "0",
      }),
    ],
    [
      "missing answer invented",
      expectation("missing-schedule:weekly-representation", {
        resolution: "KNOWN",
        magnitude: "4000",
      }),
    ],
    ["old Fletcher BIR", expectation("C02-S03:BIR", { magnitude: "31.00" })],
    [
      "old Fletcher deductions",
      expectation("C02-S03:total-deductions", { magnitude: "2991.00" }),
    ],
    [
      "old Fletcher net",
      expectation("C02-S03:net-pay", { magnitude: "21009.00" }),
    ],
    [
      "total exported instead of commission",
      expectation("C06-S04:commission", { magnitude: "18600" }),
    ],
    [
      "straight total invented",
      expectation("Worker A:base-plus-total", {
        resolution: "KNOWN",
        magnitude: "4000",
      }),
    ],
    [
      "wrong schedule",
      changed("C05-S05:monthly-representation", {
        conditions: Object.freeze(["313 days/year"]),
      }),
    ],
    [
      "invalid source",
      changed(identity, {
        source: Object.freeze({
          path: "03 Decisions/forged.md",
          section: "§C01-S01",
          decision: "fake",
        }),
      }),
    ],
    ["wrong classification", changed(identity, { class: "SUPPORTING" })],
  ])("rejects %s", (_reason, bad) =>
    expect(() => validateOracles(bad)).toThrow(),
  );
  it("rejects mutable nested fixture and mutable mapped outer collection", () => {
    expect(() => validateOracles(oracles.map((v) => v))).toThrow(/Mutable/);
    const bad = Object.freeze(
      oracles.map((item) =>
        item.id === identity
          ? Object.freeze({ ...item, conditions: [...item.conditions] })
          : item,
      ),
    );
    expect(() => validateOracles(bad)).toThrow(/Mutable nested/);
  });
  it("rejects a frozen but hidden own-property payload through the real validator", () => {
    const item = { ...get(identity) };
    Object.defineProperty(item, "concealed", {
      value: "wrong",
      enumerable: false,
    });
    Object.freeze(item);
    expect(() =>
      validateOracles(
        Object.freeze(oracles.map((v) => (v.id === identity ? item : v))),
      ),
    ).toThrow(/Mutable nested/);
  });
});
