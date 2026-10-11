import { ExactDecimal, isScenarioChildId } from "../../../core/public";
import type { DomainResolution, Quantity } from "../../../core/public";
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
import { c05Copy } from "./content";
import { c05James, validateC05James } from "./supporting-james";

export { c05Copy } from "./content";
export { c05James, validateC05James } from "./supporting-james";

const ids = ["C05-A01", "C05-A02", "C05-A03", "C05-A04", "C05-A05"] as const;
const scenarioIds = [
  "C05-S01",
  "C05-S02",
  "C05-S03",
  "C05-S04",
  "C05-S05",
] as const;
const families = [
  "Prepare",
  "Explore and Learn",
  "Apply",
  "Apply",
  "Check and Transfer",
] as const;
/** Exact authoritative R7 §13 descriptors; declarative only. */
const bindings = [
  "Static semantic",
  "Interactive — approved partition sequence",
  "Static semantic — direct conversion",
  "Static semantic — explicit schedule basis",
  "Static semantic — fixed annual-factor basis",
] as const;

export const c05RoleKeys = Object.freeze(
  [
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-representation",
      "reconsider-basis",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-first-state",
      "reconsider-second-state",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-relationship",
      "reconsider-unit",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-basis",
      "information-needed-boundary",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-basis",
      "reconsider-target",
      "completion",
      "accessibility-summary",
    ],
  ].map((roles) => Object.freeze(roles)),
);

const fact = (
  key: string,
  magnitude: string,
  kind: string,
  unit: string,
  basis: string | null,
) => ({
  key,
  resolution: {
    kind: "KNOWN" as const,
    value: { magnitude, kind, unit, basis },
  },
});
const money = (
  key: string,
  magnitude: string,
  basis: string,
  kind = "MONETARY_RATE",
) => fact(key, magnitude, kind, "PHP", basis);
const duration = (
  key: string,
  magnitude: string,
  unit: string,
  basis: string | null,
) => fact(key, magnitude, "DURATION", unit, basis);

/** Only source-given values and S02's explicitly established monthly representation. */
const inputs = [
  {
    id: "C05-S01",
    competencyId: "C05",
    activityId: "C05-A01",
    facts: [
      money(
        "Office clerk annual salary",
        "312000.00",
        "per year",
        "MONETARY_AMOUNT",
      ),
      duration("Established weeks per year", "52", "week", "per year"),
    ],
    conditions: [
      "given annual salary → target weekly salary",
      "direct annual salary ÷ 52 weeks per year; no intermediate representation",
    ],
  },
  {
    id: "C05-S02",
    competencyId: "C05",
    activityId: "C05-A02",
    facts: [
      money(
        "Teacher annual salary",
        "480000.00",
        "per year",
        "MONETARY_AMOUNT",
      ),
      money(
        "C05-S02-B established monthly salary",
        "40000.00",
        "per month",
        "MONETARY_AMOUNT",
      ),
      duration("C05-S02-A months per year", "12", "month", "per year"),
      duration(
        "C05-S02-B semi-monthly pay periods per month",
        "2",
        "semi-monthly pay period",
        "per month",
      ),
    ],
    conditions: [
      "C05-S02-A annual → monthly by 12 months per year",
      "C05-S02-B established monthly → semi-monthly by 2 semi-monthly pay periods per month",
      "linked approved teaching partition only; semi-monthly is not biweekly",
    ],
    variants: [
      {
        id: "C05-S02-A",
        condition: "annual → monthly; established 12 months per year",
      },
      {
        id: "C05-S02-B",
        condition:
          "established monthly → semi-monthly; 2 pay periods per month",
      },
    ],
  },
  {
    id: "C05-S03",
    competencyId: "C05",
    activityId: "C05-A03",
    facts: [
      money(
        "Manager offered annual salary",
        "936000.00",
        "per year",
        "MONETARY_AMOUNT",
      ),
      duration("Established weeks per year", "52", "week", "per year"),
    ],
    conditions: [
      "given annual salary → target weekly salary",
      "direct annual salary ÷ 52 weeks per year; no monthly or daily intermediate",
    ],
  },
  {
    id: "C05-S04",
    competencyId: "C05",
    activityId: "C05-A04",
    facts: [
      money("Part-time worker hourly wage", "100.00", "per hour"),
      duration(
        "Regular hours explicitly established for this week",
        "40",
        "hour",
        "this week",
      ),
    ],
    conditions: [
      "given hourly rate → target weekly wage",
      "hourly wage × scenario-established 40 regular hours this week; no assumed workday distribution",
    ],
  },
  {
    id: "C05-S05",
    competencyId: "C05",
    activityId: "C05-A05",
    facts: [
      money("Employee current daily wage", "4000.00", "per day"),
      duration("Established workweek", "5", "workday", "per week"),
      duration("Applicable annual factor", "261", "workday", "per year"),
      duration("Established months per year", "12", "month", "per year"),
    ],
    conditions: [
      "given daily wage → target monthly equivalent",
      "daily wage × scenario-established 261-day annual factor ÷ 12 months per year",
      "five-day workweek and 261-day annual factor are conditional to this arrangement; no actual attendance calendar",
    ],
  },
] as const;

/** Local declarative direction and missing-information semantics; never a conversion engine. */
export const c05Relationships = Object.freeze({
  "C05-S01": Object.freeze({
    givenBasis: "per year",
    targetBasis: "per week",
    factKeys: Object.freeze([
      "Office clerk annual salary",
      "Established weeks per year",
    ]),
    missingBasis: Object.freeze({
      kind: "UNKNOWN",
      reason: "52 weeks per year information needed",
    }) satisfies DomainResolution<Quantity>,
  }),
  "C05-S02": Object.freeze({
    givenBasis: "per year",
    targetBasis: "per semi-monthly pay period",
    factKeys: Object.freeze([
      "Teacher annual salary",
      "C05-S02-B established monthly salary",
      "C05-S02-A months per year",
      "C05-S02-B semi-monthly pay periods per month",
    ]),
    steps: Object.freeze([
      Object.freeze({ id: "C05-S02-A", from: "per year", to: "per month" }),
      Object.freeze({
        id: "C05-S02-B",
        from: "per month",
        to: "per semi-monthly pay period",
      }),
    ]),
    missingBasis: Object.freeze({
      kind: "UNKNOWN",
      reason: "approved partition basis information needed",
    }) satisfies DomainResolution<Quantity>,
  }),
  "C05-S03": Object.freeze({
    givenBasis: "per year",
    targetBasis: "per week",
    factKeys: Object.freeze([
      "Manager offered annual salary",
      "Established weeks per year",
    ]),
    missingBasis: Object.freeze({
      kind: "UNKNOWN",
      reason: "52 weeks per year information needed",
    }) satisfies DomainResolution<Quantity>,
  }),
  "C05-S04": Object.freeze({
    givenBasis: "per hour",
    targetBasis: "per week",
    factKeys: Object.freeze([
      "Part-time worker hourly wage",
      "Regular hours explicitly established for this week",
    ]),
    missingBasis: Object.freeze({
      kind: "UNKNOWN",
      reason: "weekly hours information needed",
    }) satisfies DomainResolution<Quantity>,
  }),
  "C05-S05": Object.freeze({
    givenBasis: "per day",
    targetBasis: "per month",
    factKeys: Object.freeze([
      "Employee current daily wage",
      "Established workweek",
      "Applicable annual factor",
      "Established months per year",
    ]),
    steps: Object.freeze([
      Object.freeze({ from: "per day", to: "per year" }),
      Object.freeze({ from: "per year", to: "per month" }),
    ]),
    missingBasis: Object.freeze({
      kind: "UNKNOWN",
      reason: "261-day annual factor information needed",
    }) satisfies DomainResolution<Quantity>,
  }),
} as const);

const parsedScenarios: readonly ScenarioDefinition[] = Object.freeze(
  inputs.map((item) => scenarioDefinitionSchema.parse(item)),
);
const parsedActivities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id, i) =>
    activityManifestSchema.parse({
      id,
      competencyId: "C05",
      scenarioIds: [scenarioIds[i]!],
      instructionalFamily: families[i],
      contentReferences: [
        ...c05RoleKeys[i]!.map((role) => ({
          contentId: `c05/S0${i + 1}/${role}`,
          variableIds: [],
        })),
        { contentId: "GLO-08-C05", variableIds: [] },
        { contentId: "GLO-09-C05", variableIds: [] },
      ],
      responseContract: {
        contractId:
          "C05 given-to-target representation and established basis (task-local reference)",
      },
      modelBinding: {
        profileId: "Compensation Time-Basis Board",
        interactionProfileId: bindings[i],
      },
      ...(i < 4 ? { successorActivityId: ids[i + 1] } : {}),
    }),
  ),
);
const parsedCompetency = competencyDefinitionSchema.parse({
  id: "C05",
  activityIds: ids,
});

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const scenarioSnapshot = (s: ScenarioDefinition) => ({
  ...s,
  facts: s.facts.map((f) => ({
    key: f.key,
    resolution:
      f.resolution.kind === "KNOWN"
        ? {
            kind: "KNOWN",
            value: {
              ...f.resolution.value,
              magnitude: f.resolution.value.magnitude.toString(),
            },
          }
        : f.resolution,
  })),
});

/** Complete C05-internal validation even though global memberships are future-owned. */
export function validateC05Local(
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  relationships: typeof c05Relationships,
  james: typeof c05James,
  copy: Readonly<Record<string, string>>,
  roles: readonly (readonly string[])[] = c05RoleKeys,
): void {
  if (
    !competencyDefinitionSchema.safeParse(competency).success ||
    !same(competency, parsedCompetency) ||
    activities.length !== 5 ||
    scenarios.length !== 5 ||
    activities.some(
      (a, i) =>
        !activityManifestSchema.safeParse(a).success ||
        !same(a, parsedActivities[i]),
    ) ||
    scenarios.some(
      (s, i) =>
        !scenarioDefinitionSchema.safeParse(s).success ||
        s.facts.some(
          (f) =>
            f.resolution.kind !== "KNOWN" ||
            !(f.resolution.value.magnitude instanceof ExactDecimal),
        ) ||
        !same(scenarioSnapshot(s), scenarioSnapshot(parsedScenarios[i]!)),
    ) ||
    !same(relationships, c05Relationships) ||
    !same(roles, c05RoleKeys) ||
    Object.keys(copy).length !== 42 ||
    Object.keys(c05Copy).some(
      (key) => copy[key] !== c05Copy[key as keyof typeof c05Copy],
    ) ||
    !isScenarioChildId("C05-S02-A") ||
    !isScenarioChildId("C05-S02-B")
  )
    throw new Error("C05 fixed local inventory/content mismatch");
  validateC05James(james);
}

validateC05Local(
  parsedCompetency,
  parsedActivities,
  parsedScenarios,
  c05Relationships,
  c05James,
  c05Copy,
);
/** Global provider/model/response registries and answer oracles are later-owned. */
export const c05Catalog = composeStudyCatalog({
  complete: false,
  competencies: [parsedCompetency],
  activities: parsedActivities,
  scenarios: parsedScenarios,
  contentIds: Object.keys(c05Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
export const c05Competency = c05Catalog.competencies.get("C05")!;
export const c05Activities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id) => c05Catalog.activities.get(id)!),
);
export const c05Scenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioIds.map((id) => c05Catalog.scenarios.get(id)!),
);
