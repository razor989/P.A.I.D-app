import {
  ExactDecimal,
  isProviderRead,
  isScenarioChildId,
  quantity,
} from "../../../core/public";
import type {
  DomainResolution,
  ProviderProvenance,
  Quantity,
} from "../../../core/public";
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
import { c06Copy } from "./content";

export { c06Copy } from "./content";

const ids = ["C06-A01", "C06-A02", "C06-A03", "C06-A04"] as const;
const scenarioIds = ["C06-S01", "C06-S02", "C06-S03", "C06-S04"] as const;
const families = [
  "Prepare",
  "Explore and Learn",
  "Apply",
  "Check and Transfer",
] as const;
/** R7 §13 literal profiles, not controls or an interaction implementation. */
const bindings = [
  "Interactive — arrangement structure",
  "Interactive — approved sales comparison",
  "Static semantic — straight commission",
  "Static semantic — base plus commission",
] as const;

export const c06RoleKeys = Object.freeze(
  [
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-arrangement",
      "reconsider-not-applicable",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-invariant-values",
      "reconsider-formula",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "reconsider-arrangement",
      "reconsider-rate",
      "completion",
      "accessibility-summary",
    ],
    [
      "scenario",
      "task",
      "relationship-help",
      "confirmation",
      "provider-note",
      "reconsider-scope",
      "completion",
      "accessibility-summary",
    ],
  ].map((roles) => Object.freeze(roles)),
);

const amount = (value: string, basis: string | null) =>
  quantity(ExactDecimal.from(value), "MONETARY_AMOUNT", "PHP", basis);
const rate = (value: string) =>
  quantity(ExactDecimal.from(value), "PERCENTAGE_RATE", "%", null);
const known = (value: Quantity) =>
  Object.freeze({ kind: "KNOWN" as const, value });
const notApplicable = Object.freeze({ kind: "NOT_APPLICABLE" as const });

type Straight = Readonly<{
  arrangement: "STRAIGHT_COMMISSION";
  sales: Quantity;
  commissionRate: Quantity;
  baseSalary: DomainResolution<Quantity> & { readonly kind: "NOT_APPLICABLE" };
}>;
type BasePlus = Readonly<{
  arrangement: "BASE_PLUS_COMMISSION";
  sales: Quantity;
  commissionRate: Quantity;
  baseSalary: DomainResolution<Quantity> & {
    readonly kind: "KNOWN";
    readonly value: Quantity;
  };
}>;
type Case = Straight | BasePlus;
const straight = (
  sales: string,
  basis: string | null,
  percent: string,
): Straight =>
  Object.freeze({
    arrangement: "STRAIGHT_COMMISSION",
    sales: amount(sales, basis),
    commissionRate: rate(percent),
    baseSalary: notApplicable,
  });
const basePlus = (
  sales: string,
  basis: string | null,
  percent: string,
  base: string,
): BasePlus =>
  Object.freeze({
    arrangement: "BASE_PLUS_COMMISSION",
    sales: amount(sales, basis),
    commissionRate: rate(percent),
    baseSalary: known(amount(base, "per month")),
  });

/** Fixed source inputs only. A/B are children of their primary scenario, never progress units. */
export const c06Cases = Object.freeze({
  "C06-S01": Object.freeze([
    Object.freeze({
      id: "C06-S01-A",
      worker: "Worker A",
      ...straight("80000.00", null, "5"),
    }),
    Object.freeze({
      id: "C06-S01-B",
      worker: "Worker B",
      ...basePlus("80000.00", null, "5", "10000.00"),
    }),
  ]),
  "C06-S02": Object.freeze([
    Object.freeze({
      id: "C06-S02-A",
      situation: "Situation A",
      ...basePlus("300000.00", "per month", "3", "15000.00"),
    }),
    Object.freeze({
      id: "C06-S02-B",
      situation: "Situation B",
      ...basePlus("500000.00", "per month", "3", "15000.00"),
    }),
  ]),
  "C06-S03": straight("2000000.00", null, "5"),
  "C06-S04": basePlus("120000.00", "June", "3", "15000.00"),
});

/** Only the approved established commission output is available to C01-S04. */
const provenance = Object.freeze({
  providerCompetencyId: "C06",
  consumerCompetencyId: "C01",
  sourceRecordId: "C06-S04",
  sourceOutputKey: "commission amount",
  relevantCondition: "Lina's established June commission",
} satisfies ProviderProvenance);
export const c06CommissionProvider = Object.freeze({
  consumerScenarioId: "C01-S04",
  read: Object.freeze({
    kind: "ESTABLISHED",
    provenance,
    result: Object.freeze({
      availability: "AVAILABLE",
      resolution: known(amount("3600.00", null)),
    }),
  }),
});

const fact = (key: string, resolution: DomainResolution<Quantity>) => ({
  key,
  resolution,
});
const facts = (state: Case) => [
  fact("Sales base", known(state.sales)),
  fact("Commission rate", known(state.commissionRate)),
  fact("Base salary", state.baseSalary),
];
const scenarioInputs = [
  {
    id: "C06-S01",
    competencyId: "C06",
    activityId: "C06-A01",
    facts: [],
    conditions: [
      "Worker A and Worker B have identical sales and rate; arrangement determines base-salary applicability",
    ],
    variants: c06Cases["C06-S01"].map(({ id, worker }) => ({
      id,
      condition: worker,
    })),
  },
  {
    id: "C06-S02",
    competencyId: "C06",
    activityId: "C06-A02",
    facts: [],
    conditions: [
      "Only the two approved monthly sales states change; rate and monthly base remain fixed",
    ],
    variants: c06Cases["C06-S02"].map(({ id, situation }) => ({
      id,
      condition: situation,
    })),
  },
  {
    id: "C06-S03",
    competencyId: "C06",
    activityId: "C06-A03",
    facts: facts(c06Cases["C06-S03"]),
    conditions: [
      "Straight-commission property sale; no monthly pay period established",
    ],
  },
  {
    id: "C06-S04",
    competencyId: "C06",
    activityId: "C06-A04",
    facts: facts(c06Cases["C06-S04"]),
    conditions: ["June base-plus-commission compensation arrangement"],
  },
] as const;
const parsedScenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioInputs.map((item) => scenarioDefinitionSchema.parse(item)),
);
const parsedActivities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id, i) =>
    activityManifestSchema.parse({
      id,
      competencyId: "C06",
      scenarioIds: [scenarioIds[i]!],
      instructionalFamily: families[i],
      contentReferences: [
        ...c06RoleKeys[i]!.map((role) => ({
          contentId: `c06/S0${i + 1}/${role}`,
          variableIds: [],
        })),
        { contentId: "GLO-08-C06", variableIds: [] },
        { contentId: "GLO-09-C06", variableIds: [] },
      ],
      responseContract: {
        contractId:
          "C06 arrangement, sales, rate and conditional base (task-local reference)",
      },
      modelBinding: {
        profileId: "Modular Commission Machine",
        interactionProfileId: bindings[i],
      },
      ...(i < 3 ? { successorActivityId: ids[i + 1] } : {}),
    }),
  ),
);
const parsedCompetency = competencyDefinitionSchema.parse({
  id: "C06",
  activityIds: ids,
});

/** Compare full shape as well as values; decimal identity is checked before serialization. */
function snapshot(value: unknown): unknown {
  if (value instanceof ExactDecimal) return { exactDecimal: value.toString() };
  if (Array.isArray(value)) return value.map(snapshot);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, snapshot(entry)]),
    );
  return value;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b));
function hasExactQuantities(value: unknown): boolean {
  if (typeof value === "number" || typeof value === "function") return false;
  if (value instanceof ExactDecimal) return true;
  if (Array.isArray(value)) return value.every(hasExactQuantities);
  if (value !== null && typeof value === "object") {
    const fields = value as Record<string, unknown>;
    if ("magnitude" in fields && !(fields.magnitude instanceof ExactDecimal))
      return false;
    return Object.values(fields).every(hasExactQuantities);
  }
  return true;
}

/** Full C06-local closure; partial global catalog membership never waives a known C06 error. */
export function validateC06Local(
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  cases: typeof c06Cases,
  provider: typeof c06CommissionProvider,
  copy: Readonly<Record<string, string>>,
  roles: readonly (readonly string[])[] = c06RoleKeys,
): void {
  if (
    !competencyDefinitionSchema.safeParse(competency).success ||
    !same(competency, parsedCompetency) ||
    activities.length !== 4 ||
    scenarios.length !== 4 ||
    activities.some(
      (entry, i) =>
        !activityManifestSchema.safeParse(entry).success ||
        !same(entry, parsedActivities[i]),
    ) ||
    scenarios.some(
      (entry, i) =>
        !scenarioDefinitionSchema.safeParse(entry).success ||
        !hasExactQuantities(entry) ||
        !same(entry, parsedScenarios[i]),
    ) ||
    !hasExactQuantities(cases) ||
    !same(cases, c06Cases) ||
    !hasExactQuantities(provider) ||
    !same(provider, c06CommissionProvider) ||
    !isProviderRead(provider.read) ||
    !same(roles, c06RoleKeys) ||
    Object.keys(copy).length !== 34 ||
    Object.keys(c06Copy).some(
      (key) => copy[key] !== c06Copy[key as keyof typeof c06Copy],
    ) ||
    !c06Cases["C06-S01"].every((entry) => isScenarioChildId(entry.id)) ||
    !c06Cases["C06-S02"].every((entry) => isScenarioChildId(entry.id))
  )
    throw new Error("C06 fixed local inventory/content mismatch");
}

validateC06Local(
  parsedCompetency,
  parsedActivities,
  parsedScenarios,
  c06Cases,
  c06CommissionProvider,
  c06Copy,
);
/** Global response/model/provider registries and oracles belong to later tasks. */
export const c06Catalog = composeStudyCatalog({
  complete: false,
  competencies: [parsedCompetency],
  activities: parsedActivities,
  scenarios: parsedScenarios,
  contentIds: Object.keys(c06Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
export const c06Competency = c06Catalog.competencies.get("C06")!;
export const c06Activities: readonly ActivityManifest[] = Object.freeze(
  ids.map((id) => c06Catalog.activities.get(id)!),
);
export const c06Scenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioIds.map((id) => c06Catalog.scenarios.get(id)!),
);
