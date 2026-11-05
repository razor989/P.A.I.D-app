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
import { c06Copy as establishedCopy } from "./content";

/** A01 invites a prediction, not an already-learned arrangement classification. */
export const c06PreparePrompts = Object.freeze([
  {
    role: "expectation",
    prompt: "Their sales match. What do you think about their pay?",
    options: [
      { id: "SAME", text: "I think they’ll receive the same pay." },
      { id: "DIFFERENT", text: "I think their pay could be different." },
      { id: "UNSURE", text: "I’m not sure yet. I’d like to look closer." },
    ],
  },
  {
    role: "investigation",
    prompt: "What would you look at more closely before deciding?",
    options: [
      { id: "AGREEMENTS", text: "What each worker’s pay agreement promises." },
      { id: "SALES", text: "How their sales turn into pay." },
      { id: "UNSURE", text: "I’d like someone to walk through both with me." },
    ],
  },
] as const);

/** A03 decisions are source-owned commitments, not renderer-generated answers. */
export const c06ApplyPrompts = Object.freeze([
  {
    role: "arrangement",
    prompt: "Which pay structure follows this agreement?",
    options: [
      { id: "STRAIGHT_COMMISSION", text: "Commission only: sales × rate." },
      { id: "BASE_PLUS_COMMISSION", text: "A fixed salary plus commission." },
    ],
  },
  {
    role: "interpretation",
    prompt: "What does your calculated amount represent?",
    options: [
      {
        id: "COMMISSION_ONLY",
        text: "The agent’s commission earned from this sale.",
      },
      {
        id: "SALE_PROCEEDS",
        text: "The full property-sale proceeds received by the agent.",
      },
      {
        id: "SALE_PLUS_COMMISSION",
        text: "The sale price plus the agent’s commission.",
      },
    ],
  },
] as const);

/** A02 commitments distinguish relationships, not just copied numerical outputs. */
export const c06ExplorePrompts = Object.freeze([
  {
    role: "fixedReason",
    prompt: "Sales rise. Which promise still comes from the same agreement?",
    options: [
      {
        id: "AGREEMENT",
        text: "The salary and rate stay fixed; sales do not rewrite the agreement.",
      },
      { id: "ALL_PAY", text: "Every part of pay must grow when sales grow." },
      { id: "RATE_GROWS", text: "The commission rate grows along with sales." },
    ],
  },
  {
    role: "changeReason",
    prompt: "Why is total pay higher in Situation B?",
    options: [
      {
        id: "COMMISSION",
        text: "More sales at the same rate produce more commission; the salary is unchanged.",
      },
      {
        id: "SALARY",
        text: "The larger sales record increases the fixed salary.",
      },
      {
        id: "SALES_PAY",
        text: "The representative receives the extra sales money as pay.",
      },
    ],
  },
  {
    role: "orderReason",
    prompt: "Which calculation follows the agreement—and why?",
    options: [
      {
        id: "COMMISSION_FIRST",
        text: "Find commission from sales × rate, then add salary. The rate applies only to sales.",
      },
      {
        id: "SALARY_FIRST",
        text: "Add salary to sales, then apply the rate to that whole amount.",
      },
      {
        id: "COMMISSION_ONLY",
        text: "Sales × rate is all the pay; leave out the salary.",
      },
    ],
  },
] as const);

export const c06Copy = Object.freeze({
  ...establishedCopy,
  "c06/S01/scenario":
    "It’s the end of the month. Worker A and Worker B have each sold ₱80,000 worth of goods. Both agreements promise commission at 5% of sales. Worker B’s agreement also promises a fixed monthly salary of ₱10,000.",
  "c06/S01/task":
    "You’ve seen their sales and their agreements. Share a first idea, then choose something you’d like to look at more closely. You don’t need to calculate their pay.",
  "c06/S01/relationship-help":
    "Start with the sales record: it tells us the value of the goods sold, not the worker’s earnings. Now follow the agreement. Commission is pay linked to those sales. A fixed monthly salary is a separate promise—look for it in each worker’s agreement before deciding whether their pay will match.",
  "c06/S01/confirmation":
    "You’ve noticed that matching sales might not tell the whole pay story. Keep the two agreements beside each other: what does Worker B’s promise include that Worker A’s does not? Let’s follow that difference together.",
  "c06/S01/reconsider-arrangement":
    "The matching sales records are a useful place to start. Now look at the agreements beneath them. Both mention commission, but only Worker B’s mentions a fixed monthly salary. Could those different promises matter, even when the sales match? You can keep your first idea while we explore it together.",
  "c06/S01/reconsider-not-applicable":
    "Not being sure gives us a question to investigate. Start with what matches—the sales and the commission rate—then look for a promise that appears in only one agreement. We’ll follow the two pay stories together; you don’t have to change your answer to continue.",
  "c06/S01/completion":
    "Matching sales are only part of the story. The pay agreement tells us what a worker receives for those sales, and whether a fixed salary belongs alongside commission.",
  "c06/S01/accessibility-summary":
    "Here’s where the two stories separate. Each worker earns ₱4,000 commission from ₱80,000 in sales at 5%. Worker A’s agreement ends there: there’s no fixed salary to add, rather than a salary of zero. Worker B has another promise to follow—the ₱10,000 monthly salary. Add it to the ₱4,000 commission and Worker B receives ₱14,000 in total compensation. The 5% applies to sales, not to that fixed salary. And the sales record still shows ₱80,000; calculating commission hasn’t reduced what was sold.",
  "c06/S02/task":
    "Keep one agreement in view while changing only sales. Follow the commission, compare the two pay pictures, then explain what caused the difference.",
  "c06/S02/confirmation":
    "Your comparison follows the agreement: salary and rate remain fixed. Higher sales produce more commission, which raises total compensation. Commission is calculated from sales before the salary is added.",
  "c06/S02/reconsider-invariant-values":
    "Return to the agreement, not the size of the sales record. It promises the same monthly salary and the same rate in both situations. Identify those two fixed promises before revising.",
  "c06/S02/reconsider-formula":
    "Trace the two jobs separately. First identify the sales amount the rate acts on; that produces commission. Then join commission to the fixed salary. Check which job your response describes before revising.",
});

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
      "reconsider-sales",
      "reconsider-meaning",
      "reconsider-commission",
      "reconsider-units",
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
          i === 0
            ? "C06-A01-first-thinking-v2"
            : i === 1
              ? "C06-A02-guided-questions-v3"
              : i === 2
                ? "C06-A03-commission-claim-v2"
                : "C06 arrangement, sales, rate and conditional base (task-local reference)",
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
    Object.keys(copy).length !== Object.keys(c06Copy).length ||
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
