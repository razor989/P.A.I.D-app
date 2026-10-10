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
    expect(isScenarioId("C02-S01")).toBe(true);
    expect(isScenarioId("C06-S12")).toBe(true); // form only; not a claim of membership
    expect(isScenarioChildId("C02-S01-A")).toBe(true);
    for (const invalid of [
      "C02-S00",
      "C02-S1",
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
    ]) {
      expect(isScenarioChildId(invalid)).toBe(false);
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
