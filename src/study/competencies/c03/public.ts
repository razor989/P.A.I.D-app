import { composeStudyCatalog } from "../../catalog/public";
import { ExactDecimal } from "../../../core/public";
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
import { c03Copy } from "./content";

export { c03Copy } from "./content";

const known = (
  magnitude: string,
  kind: string,
  unit: string,
  basis: string | null,
) => ({
  kind: "KNOWN" as const,
  value: { magnitude, kind, unit, basis },
});
const rate = (magnitude: string) =>
  known(magnitude, "MONETARY_RATE", "PHP", "per hour");
const hours = (magnitude: string) =>
  known(magnitude, "DURATION", "hours", null);
const multiplier = (magnitude: string) =>
  known(magnitude, "MULTIPLIER", "dimensionless", null);
const fact = (key: string, resolution: ReturnType<typeof known>) => ({
  key,
  resolution,
});

const scenarioInputs = [
  {
    id: "C03-S01",
    competencyId: "C03",
    activityId: "C03-A01",
    facts: [
      fact("regular hourly rate", rate("100.00")),
      fact("overtime hours", hours("2")),
      fact("ordinary working day applicable multiplier", multiplier("1.25")),
    ],
    conditions: [
      "ordinary working day",
      "2 overtime hours after the regular eight hours",
    ],
  },
  {
    id: "C03-S02",
    competencyId: "C03",
    activityId: "C03-A02",
    facts: [
      fact("C03-S02-A regular hourly rate", rate("100.00")),
      fact("C03-S02-A overtime hours", hours("2")),
      fact(
        "C03-S02-A ordinary working day applicable multiplier",
        multiplier("1.25"),
      ),
      fact("C03-S02-B regular hourly rate", rate("100.00")),
      fact("C03-S02-B overtime hours", hours("2")),
      fact("C03-S02-B rest day applicable multiplier", multiplier("1.69")),
    ],
    conditions: [
      "same regular hourly rate and overtime hours in both states",
      "work condition determines the applicable multiplier",
    ],
    variants: [
      { id: "C03-S02-A", condition: "ordinary working day" },
      { id: "C03-S02-B", condition: "rest day" },
    ],
  },
  {
    id: "C03-S03",
    competencyId: "C03",
    activityId: "C03-A03",
    facts: [
      fact("established regular hourly rate", rate("75.00")),
      fact("aggregate monthly overtime hours", hours("10")),
      fact("ordinary working day applicable multiplier", multiplier("1.25")),
    ],
    conditions: [
      "ordinary working day",
      "10 overtime hours in aggregate during the month; no per-day distribution established",
    ],
  },
  {
    id: "C03-S04",
    competencyId: "C03",
    activityId: "C03-A04",
    facts: [
      fact("established regular hourly rate", rate("120.00")),
      fact("overtime hours", hours("3")),
      fact("regular holiday applicable multiplier", multiplier("2.60")),
    ],
    conditions: [
      "regular holiday",
      "3 overtime hours beyond the first eight hours; single-day schematic permitted",
    ],
  },
] as const;

const activityIds = ["C03-A01", "C03-A02", "C03-A03", "C03-A04"] as const;
const scenarioIds = ["C03-S01", "C03-S02", "C03-S03", "C03-S04"] as const;
const families = [
  "Prepare",
  "Explore and Learn",
  "Apply",
  "Check and Transfer",
] as const;
/** Literal R7 §13 C03 bindings; not interchangeable with C01/C02 descriptors. */
const bindings = [
  "Static semantic",
  "Interactive — explanatory",
  "Static semantic — aggregate-hours form",
  "Static semantic — approved single-day schematic allowed",
] as const;

export const c03RoleKeys = Object.freeze(
  Object.freeze([
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-condition",
      "reconsider-multiplier",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-invariant-values",
      "reconsider-condition",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-condition",
      "reconsider-boundary",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-condition",
      "reconsider-scope",
      "completion",
      "accessibility-summary",
    ],
  ] as const).map((roles) => Object.freeze(roles)),
);

/** No additional shifts, dates or hours are implied by these source-evidence modes.
 * S02 fact-key links identify children within ONE parent Scenario Definition.
 */
export const c03Evidence = Object.freeze({
  "C03-S01": Object.freeze({
    mode: "ordinary-day record",
    distribution: "single approved workday",
    schematic: "allowed",
  }),
  "C03-S02": Object.freeze({
    mode: "paired fixed conditions",
    distribution: "same rate and hours",
    schematic: "allowed",
  }),
  "C03-S03": Object.freeze({
    mode: "monthly aggregate overtime hours",
    distribution: "not established",
    schematic: "no single-day shift strip",
  }),
  "C03-S04": Object.freeze({
    mode: "regular-holiday single day",
    distribution: "only the approved single day",
    schematic: "approved single-day schematic allowed",
  }),
} as const);

const parsedScenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioInputs.map((input) => scenarioDefinitionSchema.parse(input)),
);
const parsedActivities: readonly ActivityManifest[] = Object.freeze(
  activityIds.map((id, index) =>
    activityManifestSchema.parse({
      id,
      competencyId: "C03",
      scenarioIds: [scenarioIds[index]!],
      instructionalFamily: families[index],
      contentReferences: [
        ...c03RoleKeys[index]!.map((role) => ({
          contentId: `c03/S0${index + 1}/${role}`,
          variableIds: [],
        })),
        { contentId: "GLO-08-C03", variableIds: [] },
        { contentId: "GLO-09-C03", variableIds: [] },
      ],
      responseContract: {
        contractId:
          "C03 condition-linked overtime response semantics (task-local reference)",
      },
      modelBinding: {
        profileId: "Overtime Work Record",
        interactionProfileId: bindings[index],
      },
      ...(index < 3 ? { successorActivityId: activityIds[index + 1] } : {}),
    }),
  ),
);
const parsedCompetency: CompetencyDefinition = competencyDefinitionSchema.parse(
  { id: "C03", activityIds },
);

type Evidence = typeof c03Evidence;
const snapshot = (scenario: ScenarioDefinition) => ({
  id: scenario.id,
  competencyId: scenario.competencyId,
  activityId: scenario.activityId,
  facts: scenario.facts.map(({ key, resolution }) =>
    resolution.kind === "KNOWN"
      ? [
          key,
          resolution.kind,
          resolution.value.magnitude.toString(),
          resolution.value.kind,
          resolution.value.unit,
          resolution.value.basis,
        ]
      : [
          key,
          resolution.kind,
          "reason" in resolution ? resolution.reason : null,
        ],
  ),
  conditions: scenario.conditions,
  variants: scenario.variants,
  providerReferences: scenario.providerReferences,
});
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Complete C03-local validation; partial registry defers ONLY future-owned external references.
 * Compare every semantic value, quantity role, copy role and binding against fixed source rows.
 */
export function validateC03Local(
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  evidence: Evidence,
  copy: Readonly<Record<string, string>>,
): void {
  if (
    !competencyDefinitionSchema.safeParse(competency).success ||
    activities.some(
      (activity) => !activityManifestSchema.safeParse(activity).success,
    ) ||
    scenarios.some(
      (scenario) =>
        !scenarioDefinitionSchema.safeParse(scenario).success ||
        scenario.facts.some(
          (fact) =>
            fact.resolution.kind === "KNOWN" &&
            !(fact.resolution.value.magnitude instanceof ExactDecimal),
        ),
    ) ||
    !same(competency, parsedCompetency) ||
    activities.length !== 4 ||
    scenarios.length !== 4 ||
    activities.some(
      (activity, index) => !same(activity, parsedActivities[index]),
    ) ||
    scenarios.some(
      (scenario, index) =>
        !same(snapshot(scenario), snapshot(parsedScenarios[index]!)),
    ) ||
    !same(evidence, c03Evidence) ||
    Object.keys(copy).length !== 34 ||
    Object.keys(c03Copy).some(
      (key) => copy[key] !== c03Copy[key as keyof typeof c03Copy],
    )
  ) {
    throw new Error("C03 fixed local inventory/content mismatch");
  }
}

validateC03Local(
  parsedCompetency,
  parsedActivities,
  parsedScenarios,
  c03Evidence,
  c03Copy,
);

/** Response/model identities are future-owned; all local C03 membership is checked above. */
export const c03Catalog = composeStudyCatalog({
  complete: false,
  competencies: [parsedCompetency],
  activities: parsedActivities,
  scenarios: parsedScenarios,
  contentIds: Object.keys(c03Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
export const c03Competency = c03Catalog.competencies.get("C03")!;
export const c03Activities: readonly ActivityManifest[] = Object.freeze(
  activityIds.map((id) => c03Catalog.activities.get(id)!),
);
export const c03Scenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioIds.map((id) => c03Catalog.scenarios.get(id)!),
);
