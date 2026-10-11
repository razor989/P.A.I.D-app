import { describe, expect, it } from "vitest";
import { composeStudyCatalog } from "./public";
import {
  activity,
  competency,
  provider,
  scenario,
} from "../schemas/public.test";

// These are synthetic registry entries, not six/25 fixed-bank evidence.
const registry = () => ({
  complete: true,
  competencies: [competency],
  activities: [activity],
  scenarios: [scenario],
  contentIds: ["test-copy"],
  responseContractIds: ["test-response"],
  modelProfileIds: ["test-model"],
  interactionProfileIds: ["test-interaction"],
  oracleIds: ["test-oracle"],
  providerRecordIds: [],
});

describe("T010 caller-supplied catalog composition", () => {
  it("indexes a valid synthetic registry and detaches immutable snapshots", () => {
    const input = registry();
    const catalog = composeStudyCatalog(input);
    expect([...catalog.activities.keys()]).toEqual(["C01-A01"]);
    expect(catalog.competencies.get("C01")?.activityIds).toEqual(["C01-A01"]);
    expect(catalog.scenarios.get("C01-S01")?.facts[0]?.resolution.kind).toBe(
      "KNOWN",
    );
    expect(catalog.activities.size).toBe(1);
    expect([...catalog.activities.values()]).toHaveLength(1);
    expect([...catalog.activities]).toHaveLength(1);
    input.contentIds.push("later test copy");
    expect(
      () =>
        ((
          catalog.activities.get("C01-A01") as { instructionalFamily: string }
        ).instructionalFamily = "mutation"),
    ).toThrow();
    expect(() =>
      (catalog.activities as Map<string, unknown>).set("C01-A02", {}),
    ).toThrow();
    expect(() =>
      (catalog.competencies.get("C01")?.activityIds as string[]).push(
        "C01-A02",
      ),
    ).toThrow();
    expect(catalog.activities.size).toBe(1);
  });
  it("rejects duplicate canonical definitions and reference registry IDs", () => {
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        competencies: [competency, competency],
      }),
    ).toThrow(/Duplicate competency/);
    expect(() =>
      composeStudyCatalog({ ...registry(), activities: [activity, activity] }),
    ).toThrow(/Duplicate activity/);
    expect(() =>
      composeStudyCatalog({ ...registry(), scenarios: [scenario, scenario] }),
    ).toThrow(/Duplicate scenario/);
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        contentIds: ["test-copy", "test-copy"],
      }),
    ).toThrow(/Duplicate content/);
  });
  it("rejects local ownership contradictions even with an incomplete registry", () => {
    const partial = { ...registry(), complete: false };
    expect(() =>
      composeStudyCatalog({
        ...partial,
        activities: [{ ...activity, competencyId: "C02" }],
      }),
    ).toThrow();
    expect(() =>
      composeStudyCatalog({
        ...partial,
        scenarios: [{ ...scenario, activityId: "C01-A02" }],
      }),
    ).toThrow(/Wrong scenario ownership/);
    expect(() =>
      composeStudyCatalog({
        ...partial,
        competencies: [{ ...competency, activityIds: [] }],
      }),
    ).toThrow(/Unlisted activity/);
    expect(() =>
      composeStudyCatalog({
        ...partial,
        activities: [{ ...activity, successorActivityId: "C02-A01" }],
      }),
    ).toThrow();
  });
  it("rejects foreign competency activity references without supplying the activity", () => {
    const foreign = { id: "C01", activityIds: ["C02-A01"] };
    for (const complete of [false, true]) {
      expect(() =>
        composeStudyCatalog({
          ...registry(),
          complete,
          competencies: [foreign],
          activities: [],
          scenarios: [],
        }),
      ).toThrow();
    }
    const sameOwner = { id: "C01", activityIds: ["C01-A02"] };
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        complete: false,
        competencies: [sameOwner],
        activities: [],
        scenarios: [],
      }),
    ).not.toThrow();
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        complete: true,
        competencies: [sameOwner],
        activities: [],
        scenarios: [],
      }),
    ).toThrow(/Dangling activity C01-A02/);
  });
  it("permits unresolved future membership in partial registry; complete registry rejects dangling references", () => {
    const partial = {
      ...registry(),
      complete: false,
      scenarios: [],
      contentIds: [],
      modelProfileIds: [],
    };
    expect(() => composeStudyCatalog(partial)).not.toThrow();
    expect(() => composeStudyCatalog({ ...partial, complete: true })).toThrow(
      /Dangling scenario/,
    );
    expect(() =>
      composeStudyCatalog({ ...registry(), contentIds: [] }),
    ).toThrow(/Dangling content/);
    expect(() =>
      composeStudyCatalog({ ...registry(), responseContractIds: [] }),
    ).toThrow(/Dangling response/);
    expect(() =>
      composeStudyCatalog({ ...registry(), modelProfileIds: [] }),
    ).toThrow(/Dangling model/);
    expect(() =>
      composeStudyCatalog({ ...registry(), interactionProfileIds: [] }),
    ).toThrow(/Dangling interaction/);
    expect(() => composeStudyCatalog({ ...registry(), oracleIds: [] })).toThrow(
      /Dangling oracle/,
    );
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        activities: [{ ...activity, successorActivityId: "C01-A02" }],
      }),
    ).toThrow(/Dangling successor/);
  });
  it("validates provider consumer/source identity without creating provider review instances", () => {
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        activities: [{ ...activity, providerReferences: [provider] }],
      }),
    ).toThrow(/Dangling provider source/);
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        complete: false,
        activities: [{ ...activity, providerReferences: [provider] }],
      }),
    ).not.toThrow();
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        scenarios: [
          {
            ...scenario,
            providerReferences: [{ ...provider, consumerCompetencyId: "C01" }],
          },
        ],
      }),
    ).toThrow(/Dangling provider source/);
    const reviewSource = {
      providerCompetencyId: "C05",
      consumerCompetencyId: "C01",
      sourceOutputKey: "converted pay value",
      sourceRecordId: "C05-PV-JAMES-01",
      relevantCondition: null,
    };
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        activities: [{ ...activity, providerReferences: [reviewSource] }],
      }),
    ).toThrow(/Dangling provider source/);
    expect(() =>
      composeStudyCatalog({
        ...registry(),
        providerRecordIds: ["C05-PV-JAMES-01"],
        activities: [{ ...activity, providerReferences: [reviewSource] }],
      }),
    ).not.toThrow();
  });
});
