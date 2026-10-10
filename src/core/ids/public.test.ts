import { describe, expect, it } from "vitest";
import {
  COMPETENCY_IDS,
  isActivityId,
  isCompetencyId,
  isProviderRecordId,
  isScenarioChildId,
  isScenarioId,
  isSupportingRecordId,
  type ActivityId,
  type ScenarioChildId,
  type ScenarioId,
} from "./public";

describe("canonical identity", () => {
  it("recognizes exactly the six canonical competency codes, never historical aliases", () => {
    expect(COMPETENCY_IDS).toEqual(["C01", "C02", "C03", "C04", "C05", "C06"]);
    for (const id of COMPETENCY_IDS) expect(isCompetencyId(id)).toBe(true);
    for (const alias of [
      "GI",
      "NP",
      "OT",
      "PC",
      "WS",
      "COM",
      "C00",
      "C07",
      null,
    ]) {
      expect(isCompetencyId(alias)).toBe(false);
    }
  });

  it("accepts the frozen 4+4+4+4+5+4 activity structure, not merely the pattern", () => {
    const activities: ActivityId[] = COMPETENCY_IDS.flatMap((id) =>
      Array.from(
        { length: id === "C05" ? 5 : 4 },
        (_, index) => `${id}-A0${index + 1}`,
      ),
    ) as ActivityId[];
    expect(activities).toHaveLength(25);
    expect(activities.every(isActivityId)).toBe(true);
    for (const invalid of [
      "C01-A05",
      "C06-A05",
      "C05-A06",
      "C01-A00",
      "C07-A01",
      "GI-A01",
      "C01-a01",
      "C01-A1",
      "C01-A01 ",
      "C02-S01-F",
      "C05-PV-JAMES-01",
      0,
    ]) {
      expect(isActivityId(invalid)).toBe(false);
    }
  });

  it("validates scenario and established child forms without claiming bank membership", () => {
    const validForms: readonly ScenarioId[] = [
      "C02-S01",
      "C06-S12",
      "C01-S09",
      "C05-S10",
      "C04-S99",
    ];
    const validChildForms: readonly ScenarioChildId[] = [
      "C02-S01-A",
      "C06-S12-B",
      "C04-S99-A",
    ];
    for (const id of validForms) expect(isScenarioId(id)).toBe(true);
    for (const id of validChildForms) expect(isScenarioChildId(id)).toBe(true);
    // These are form examples, not claims that the complete bank contains them.
    for (const invalid of [
      "C02-S00",
      "C02-S1",
      "C02-S001",
      "C02-S100",
      "C02-S-1",
      "C02-S1.5",
      "C07-S01",
      "GI-S01",
      "C02-S01-F",
      "C02-S01-A",
    ]) {
      expect(isScenarioId(invalid)).toBe(false);
    }
    for (const invalid of [
      "C02-S01-F",
      "C02-S01-C",
      "C07-S01-A",
      "C02-S00-B",
      "C02-S1-A",
      "C02-S100-B",
    ]) {
      expect(isScenarioChildId(invalid)).toBe(false);
    }
  });

  it("rejects malformed scenario and child literals at the TypeScript boundary too", () => {
    // @ts-expect-error A single-digit scenario number is not the canonical form.
    const shortScenario: ScenarioId = "C02-S1";
    // @ts-expect-error Zero is not a canonical scenario number.
    const zeroScenario: ScenarioId = "C02-S00";
    // @ts-expect-error Three digits are not the approved form.
    const longScenario: ScenarioId = "C02-S100";
    // @ts-expect-error Noncanonical competency prefixes are not permitted.
    const aliasScenario: ScenarioId = "GI-S01";
    // @ts-expect-error Child identity inherits the two-digit scenario form.
    const shortChild: ScenarioChildId = "C02-S1-A";
    // @ts-expect-error Child identity inherits the nonzero scenario number.
    const zeroChild: ScenarioChildId = "C02-S00-B";
    // @ts-expect-error Only established A/B child suffix forms are permitted.
    const supportingRecord: ScenarioChildId = "C02-S01-F";

    for (const id of [
      shortScenario,
      zeroScenario,
      longScenario,
      aliasScenario,
    ]) {
      expect(isScenarioId(id)).toBe(false);
    }
    for (const id of [shortChild, zeroChild, supportingRecord]) {
      expect(isScenarioChildId(id)).toBe(false);
    }
  });

  it("keeps established support and provider records out of learner activities", () => {
    expect(isSupportingRecordId("C02-S01-F")).toBe(true);
    expect(isProviderRecordId("C05-PV-JAMES-01")).toBe(true);
    expect(isActivityId("C02-S01-F")).toBe(false);
    expect(isActivityId("C05-PV-JAMES-01")).toBe(false);
    expect(isSupportingRecordId("C02-S02-F")).toBe(false);
    expect(isProviderRecordId("C05-PV-JAMES-02")).toBe(false);
  });

  it("keeps identity stable independently of any display label", () => {
    const id = "C01-A01";
    for (const label of ["Pay-Period Earnings Sheet", "Renamed label", ""]) {
      expect(isActivityId(id)).toBe(true);
      expect(isActivityId(label)).toBe(false);
    }
  });
});
