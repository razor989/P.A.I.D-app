import { ExactDecimal } from "../../../core/public";
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
import { c04Copy } from "./content";
import { validateC04ResponseContracts } from "./response-contracts";

export {
  c04ResponseContracts,
  validateC04ResponseContracts,
} from "./response-contracts";
export type { C04ResponseContract } from "./response-contracts";

export { c04Copy } from "./content";

const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"] as const;
const scenarioIds = ["C04-S01", "C04-S02", "C04-S03", "C04-S04"] as const;
const families = [
  "Prepare",
  "Explore and Learn",
  "Apply",
  "Check and Transfer",
] as const;
/** Literal R7 §13 bindings; these are references, not model implementations. */
const bindings = [
  "Static semantic",
  "Interactive — fixed scenario New states",
  "Static semantic",
  "Static semantic — Undefined terminal boundary",
] as const;

export const c04RoleKeys = Object.freeze(
  [
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-roles",
      "reconsider-interpretation",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-denominator",
      "reconsider-interpretation",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-reference",
      "reconsider-direction",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "undefined-result",
      "reconsider-prohibited-substitutions",
      "completion",
      "accessibility-summary",
    ],
  ].map((roles) => Object.freeze(roles)),
);

const source = (key: string, magnitude: string) => ({
  key,
  resolution: {
    kind: "KNOWN" as const,
    value: {
      magnitude,
      kind: "MONETARY_AMOUNT",
      unit: "PHP",
      basis: "per month",
    },
  },
});
/** C04-S02-A/B are source-approved scenario-child labels, not primary scenarios. */
const inputs = [
  {
    id: "C04-S01",
    competencyId: "C04",
    activityId: "C04-A01",
    facts: [
      source("Original monthly salary (reference)", "18000.00"),
      source("New monthly salary", "18000.00"),
    ],
    conditions: [
      "Maya's salary after the review remains unchanged",
      "Original and New retain separate roles even at equal magnitude",
    ],
  },
  {
    id: "C04-S02",
    competencyId: "C04",
    activityId: "C04-A02",
    facts: [
      source("C04-S02-A Original monthly salary (reference)", "20000.00"),
      source("C04-S02-A New monthly salary", "22000.00"),
      source("C04-S02-B Original monthly salary (reference)", "10000.00"),
      source("C04-S02-B New monthly salary", "12000.00"),
    ],
    conditions: [
      "only the two fixed Employee A/B comparisons are approved",
      "each employee retains their own Original reference",
    ],
    variants: [
      {
        id: "C04-S02-A",
        condition: "Employee A fixed Original/New comparison",
      },
      {
        id: "C04-S02-B",
        condition: "Employee B fixed Original/New comparison",
      },
    ],
  },
  {
    id: "C04-S03",
    competencyId: "C04",
    activityId: "C04-A03",
    facts: [
      source("Original advertised monthly offer (reference)", "30000.00"),
      source("New revised monthly offer", "27000.00"),
    ],
    conditions: [
      "offer revised downward before the position is filled",
      "signed change is downward; Original advertised offer remains reference",
    ],
  },
  {
    id: "C04-S04",
    competencyId: "C04",
    activityId: "C04-A04",
    facts: [
      source("Original monthly communication allowance (reference)", "0.00"),
      source("New monthly communication allowance", "1500.00"),
    ],
    conditions: [
      "Original is known zero, not absent",
      "absolute increase remains meaningful; percentage is undefined and numeric percentage withheld",
    ],
  },
] as const;

/** Semantic boundary metadata only: no calculated numeric difference/percentage bank. */
export const c04Boundary = Object.freeze({
  "C04-S01": Object.freeze({
    originalRole: "Original monthly salary (reference)",
    percentageResolution: "KNOWN",
    numericAvailability: "AVAILABLE",
  }),
  "C04-S02": Object.freeze({
    originalRoles: Object.freeze([
      "C04-S02-A Original monthly salary (reference)",
      "C04-S02-B Original monthly salary (reference)",
    ]),
    percentageResolution: "KNOWN",
    numericAvailability: "AVAILABLE",
  }),
  "C04-S03": Object.freeze({
    originalRole: "Original advertised monthly offer (reference)",
    direction: "decrease",
    percentageResolution: "KNOWN",
    numericAvailability: "AVAILABLE",
  }),
  "C04-S04": Object.freeze({
    originalRole: "Original monthly communication allowance (reference)",
    percentageResolution: Object.freeze({
      kind: "UNDEFINED",
      reason: "Original value is zero",
    }) satisfies DomainResolution<Quantity>,
    numericAvailability: "WITHHELD",
    absoluteChangeAvailability: "AVAILABLE",
    responseKind: "SEMANTIC_BOUNDARY",
    undefinedCopyId: "c04/S04/undefined-result",
  }),
} as const);

const parsedScenarios: readonly ScenarioDefinition[] = Object.freeze(
  inputs.map((input) => scenarioDefinitionSchema.parse(input)),
);
const parsedActivities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id, index) =>
    activityManifestSchema.parse({
      id,
      competencyId: "C04",
      scenarioIds: [scenarioIds[index]!],
      instructionalFamily: families[index],
      contentReferences: [
        ...c04RoleKeys[index]!.map((role) => ({
          contentId: `c04/S0${index + 1}/${role}`,
          variableIds: [],
        })),
        { contentId: "GLO-08-C04", variableIds: [] },
        { contentId: "GLO-09-C04", variableIds: [] },
      ],
      responseContract: {
        contractId:
          "C04 original-reference percentage and nonnumeric undefined response (task-local reference)",
      },
      modelBinding: {
        profileId: "Anchored Change Track",
        interactionProfileId: bindings[index],
      },
      ...(index < 3 ? { successorActivityId: ids[index + 1] } : {}),
    }),
  ),
);
const parsedCompetency = competencyDefinitionSchema.parse({
  id: "C04",
  activityIds: ids,
});

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const scenarioSnapshot = (s: ScenarioDefinition) => ({
  id: s.id,
  competencyId: s.competencyId,
  activityId: s.activityId,
  facts: s.facts.map((f) => ({
    key: f.key,
    resolution:
      f.resolution.kind === "KNOWN"
        ? {
            kind: "KNOWN",
            value: {
              magnitude: f.resolution.value.magnitude.toString(),
              kind: f.resolution.value.kind,
              unit: f.resolution.value.unit,
              basis: f.resolution.value.basis,
            },
          }
        : f.resolution,
  })),
  conditions: s.conditions,
  variants: s.variants,
  providerReferences: s.providerReferences,
});

/** Validate every C04-internal membership even while the global registry is partial. */
export function validateC04Local(
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  boundary: typeof c04Boundary,
  copy: Readonly<Record<string, string>>,
  roles: readonly (readonly string[])[] = c04RoleKeys,
): void {
  validateC04ResponseContracts();
  if (
    !competencyDefinitionSchema.safeParse(competency).success ||
    !same(competency, parsedCompetency) ||
    activities.length !== 4 ||
    scenarios.length !== 4 ||
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
    !same(boundary, c04Boundary) ||
    !same(roles, c04RoleKeys) ||
    Object.keys(copy).length !== 34 ||
    Object.keys(c04Copy).some(
      (key) => copy[key] !== c04Copy[key as keyof typeof c04Copy],
    )
  )
    throw new Error("C04 fixed local inventory/content mismatch");
}

validateC04Local(
  parsedCompetency,
  parsedActivities,
  parsedScenarios,
  c04Boundary,
  c04Copy,
);
/** External model/response memberships are future-owned; C04 local checks above are complete. */
export const c04Catalog = composeStudyCatalog({
  complete: false,
  competencies: [parsedCompetency],
  activities: parsedActivities,
  scenarios: parsedScenarios,
  contentIds: Object.keys(c04Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
export const c04Competency = c04Catalog.competencies.get("C04")!;
export const c04Activities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id) => c04Catalog.activities.get(id)!),
);
export const c04Scenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioIds.map((id) => c04Catalog.scenarios.get(id)!),
);
