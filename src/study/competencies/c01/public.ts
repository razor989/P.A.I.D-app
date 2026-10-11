import { composeStudyCatalog } from "../../catalog/public";
import {
  activityManifestSchema,
  competencyDefinitionSchema,
  scenarioDefinitionSchema,
} from "../../schemas/public";
import type {
  ActivityManifest,
  CompetencyDefinition,
  ScenarioDefinition,
} from "../../schemas/public";
import { c01Copy } from "./content";

export { c01Copy } from "./content";

// Amount and membership are separate: March's KNOWN 900 remains in the record.
const money = (magnitude: string) => ({
  magnitude,
  kind: "MONETARY_AMOUNT",
  unit: "PHP",
  basis: null,
});
const known = (magnitude: string) => ({
  kind: "KNOWN" as const,
  value: money(magnitude),
});

const jamesRegular = {
  providerCompetencyId: "C05",
  consumerCompetencyId: "C01",
  sourceOutputKey: "converted pay value",
  sourceRecordId: "C05-PV-JAMES-01",
  relevantCondition: "James's established regular pay for the month",
} as const;
const jamesOvertime = {
  providerCompetencyId: "C03",
  consumerCompetencyId: "C01",
  sourceOutputKey: "overtime-pay value",
  sourceRecordId: "C03-S03",
  relevantCondition: "James's overtime pay for the same month",
} as const;
const linaCommission = {
  providerCompetencyId: "C06",
  consumerCompetencyId: "C01",
  sourceOutputKey: "commission amount",
  sourceRecordId: "C06-S04",
  relevantCondition: "Lina's established June commission",
} as const;

const scenarioInputs = [
  {
    id: "C01-S01",
    competencyId: "C01",
    activityId: "C01-A01",
    facts: [
      { key: "April base salary", resolution: known("18000.00") },
      { key: "April meal allowance", resolution: known("1200.00") },
      { key: "paid March overtime payment", resolution: known("900.00") },
      {
        key: "March overtime applicability to April",
        resolution: { kind: "NOT_APPLICABLE" },
      },
    ],
    conditions: [
      "April gross-income pay period",
      "Meal allowance is part of April earnings",
      "March overtime was already paid in March",
    ],
  },
  {
    id: "C01-S02",
    competencyId: "C01",
    activityId: "C01-A02",
    facts: [
      { key: "May regular pay", resolution: known("17250.00") },
      { key: "May transportation allowance", resolution: known("1750.00") },
    ],
    conditions: [
      "May gross-income pay period",
      "Employer includes transportation allowance in May earnings",
    ],
  },
  {
    id: "C01-S03",
    competencyId: "C01",
    activityId: "C01-A03",
    facts: [
      {
        key: "C05-established regular pay for the month",
        resolution: known("12000.00"),
      },
      {
        key: "C03-established overtime pay for the same month",
        resolution: known("937.50"),
      },
    ],
    conditions: ["Both established earnings belong to the same month"],
    providerReferences: [jamesRegular, jamesOvertime],
  },
  {
    id: "C01-S04",
    competencyId: "C01",
    activityId: "C01-A04",
    facts: [
      { key: "June monthly base salary", resolution: known("15000.00") },
      { key: "C06-established June commission", resolution: known("3600.00") },
      { key: "June communication allowance", resolution: known("800.00") },
    ],
    conditions: [
      "June gross-income pay period",
      "Employer includes communication allowance in June earnings",
    ],
    providerReferences: [linaCommission],
  },
] as const;

/** All four are primary scenarios; no generated variants or computed totals. */
const parsedScenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioInputs.map((entry) => scenarioDefinitionSchema.parse(entry)),
);

const roleKeys = [
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-period-applicability",
    "reconsider-total",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-applicability",
    "reconsider-total",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "provider-callout",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-ownership",
    "reconsider-total",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "provider-callout",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-ownership",
    "reconsider-composition",
    "completion",
    "accessibility-summary",
  ],
] as const;

const ids = ["C01-A01", "C01-A02", "C01-A03", "C01-A04"] as const;
const families = [
  "Prepare",
  "Explore and Learn",
  "Apply",
  "Check and Transfer",
] as const;
const bindings = [
  "Interactive — evaluative",
  "Interactive — explanatory/live",
  "Static semantic",
  "Static semantic",
] as const;

/** Technical role lookup keys are NOT canonical content IDs; GLO IDs are. */
const parsedActivities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id, index) => {
    const scenarioId = scenarioInputs[index]!.id;
    const shortId = scenarioId.slice(-3);
    return activityManifestSchema.parse({
      id,
      competencyId: "C01",
      scenarioIds: [scenarioId],
      instructionalFamily: families[index],
      contentReferences: [
        ...roleKeys[index]!.map((role) => ({
          contentId: `c01/${shortId}/${role}`,
          variableIds: [],
        })),
        { contentId: "GLO-08-C01", variableIds: [] },
        { contentId: "GLO-09-C01", variableIds: [] },
      ],
      responseContract: {
        contractId:
          "C01 established-earnings response semantics (task-local reference)",
      },
      modelBinding: {
        profileId: "Pay-Period Earnings Sheet",
        interactionProfileId: bindings[index],
      },
      ...(index === 2
        ? { providerReferences: [jamesRegular, jamesOvertime] }
        : {}),
      ...(index === 3 ? { providerReferences: [linaCommission] } : {}),
      ...(index < 3 ? { successorActivityId: ids[index + 1] } : {}),
    });
  }),
);

const parsedCompetency: CompetencyDefinition = competencyDefinitionSchema.parse(
  {
    id: "C01",
    activityIds: ids,
  },
);

/** C01-internal closure is checked independently of the partial cross-bank registry. */
export function validateC01Local(
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  copy: Readonly<Record<string, string>>,
): void {
  if (
    competency.id !== "C01" ||
    activities.length !== 4 ||
    scenarios.length !== 4 ||
    competency.activityIds.some((id, i) => id !== ids[i]) ||
    activities.some(
      (entry, i) =>
        entry.id !== ids[i] ||
        entry.scenarioIds.length !== 1 ||
        entry.scenarioIds[0] !== scenarioInputs[i]!.id ||
        entry.instructionalFamily !== families[i] ||
        entry.competencyId !== "C01" ||
        entry.successorActivityId !== ids[i + 1],
    ) ||
    scenarios.some(
      (entry, i) =>
        entry.id !== scenarioInputs[i]!.id ||
        entry.activityId !== ids[i] ||
        entry.competencyId !== "C01" ||
        entry.facts.length !== parsedScenarios[i]!.facts.length ||
        entry.facts.some((fact, j) => {
          const expected = parsedScenarios[i]!.facts[j]!;
          return (
            fact.key !== expected.key ||
            fact.resolution.kind !== expected.resolution.kind ||
            (fact.resolution.kind === "KNOWN" &&
              expected.resolution.kind === "KNOWN" &&
              (fact.resolution.value.magnitude.toString() !==
                expected.resolution.value.magnitude.toString() ||
                fact.resolution.value.kind !== expected.resolution.value.kind ||
                fact.resolution.value.unit !== expected.resolution.value.unit ||
                fact.resolution.value.basis !==
                  expected.resolution.value.basis))
          );
        }) ||
        JSON.stringify(entry.conditions) !==
          JSON.stringify(parsedScenarios[i]!.conditions) ||
        JSON.stringify(entry.providerReferences) !==
          JSON.stringify(parsedScenarios[i]!.providerReferences),
    ) ||
    activities.some(
      (entry, i) =>
        JSON.stringify(entry.providerReferences) !==
        JSON.stringify(parsedActivities[i]!.providerReferences),
    )
  ) {
    throw new Error("C01 fixed local inventory mismatch");
  }
  for (const [i, activity] of activities.entries()) {
    const required = [
      ...roleKeys[i]!.map(
        (role) => `c01/${scenarioInputs[i]!.id.slice(-3)}/${role}`,
      ),
      "GLO-08-C01",
      "GLO-09-C01",
    ];
    if (
      activity.contentReferences.length !== required.length ||
      required.some(
        (id) =>
          !activity.contentReferences.some(
            (ref) =>
              ref.contentId === id &&
              ref.variableIds.length === 0 &&
              typeof copy[id] === "string" &&
              copy[id] === c01Copy[id as keyof typeof c01Copy],
          ),
      )
    ) {
      throw new Error("C01 canonical role lookup mismatch");
    }
  }
}

validateC01Local(parsedCompetency, parsedActivities, parsedScenarios, c01Copy);

/** Partial only because provider-review and other competency records are later-owned. */
export const c01Catalog = composeStudyCatalog({
  complete: false,
  competencies: [parsedCompetency],
  activities: parsedActivities,
  scenarios: parsedScenarios,
  contentIds: Object.keys(c01Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});

export const c01Competency = c01Catalog.competencies.get("C01")!;
export const c01Activities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id) => c01Catalog.activities.get(id)!),
);
export const c01Scenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioInputs.map((entry) => c01Catalog.scenarios.get(entry.id)!),
);
