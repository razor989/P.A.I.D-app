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
import { c02Copy } from "./content";
import { c02PhilHealthFloor } from "./supporting-philhealth";
import type { PhilHealthFloorSupport } from "./supporting-philhealth";

export { c02Copy } from "./content";
export { c02PhilHealthFloor } from "./supporting-philhealth";

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
const fact = (key: string, magnitude: string) => ({
  key,
  resolution: known(magnitude),
});
const deduction = (name: string, magnitude: string, basis: string) =>
  [fact(`${name} employee share`, magnitude), basis] as const;

/** Source-owned gross result; this is a provenance reference, not a C01 calculator. */
const jamesGross = {
  providerCompetencyId: "C01",
  consumerCompetencyId: "C02",
  sourceOutputKey: "gross-income result",
  sourceRecordId: "C01-S03",
  relevantCondition: "James's established gross income for the same month",
} as const;

const [annaSSS, annaSSSBasis] = deduction(
  "SSS",
  "600.00",
  "SSS employee share uses MSC PHP 12000.00 (private-sector table)",
);
const [jamesSSS, jamesSSSBasis] = deduction(
  "SSS",
  "650.00",
  "SSS employee share uses MSC PHP 13000.00 (private-sector table)",
);

const scenarioInputs = [
  {
    id: "C02-S01",
    competencyId: "C02",
    activityId: "C02-A01",
    facts: [
      fact("established monthly gross income", "12100.00"),
      annaSSS,
      fact("PhilHealth employee share", "302.50"),
      fact("Pag-IBIG employee share", "200.00"),
      fact("BIR withholding tax", "0.00"),
      {
        key: "government GSIS employee share applicability",
        resolution: { kind: "NOT_APPLICABLE" as const },
      },
    ],
    conditions: [
      "Monthly payroll; ordinary private-sector employee; SSS branch, not GSIS",
      annaSSSBasis,
      "PhilHealth employee share uses monthly basic salary PHP 12100.00",
      "Pag-IBIG employee share is capped at PHP 200.00",
      "Taxable compensation is below the applicable monthly BIR threshold; withholding is known zero",
    ],
  },
  {
    id: "C02-S02",
    competencyId: "C02",
    activityId: "C02-A02",
    facts: [
      fact("C01-S03 established monthly gross income", "12937.50"),
      fact("source-established monthly regular/basic pay", "12000.00"),
      fact("source-established overtime pay for same month", "937.50"),
      jamesSSS,
      fact("PhilHealth employee share", "300.00"),
      fact("Pag-IBIG employee share", "200.00"),
      fact("BIR withholding tax", "0.00"),
      {
        key: "government GSIS employee share applicability",
        resolution: { kind: "NOT_APPLICABLE" as const },
      },
    ],
    conditions: [
      "Monthly payroll; ordinary private-sector employee; SSS branch, not GSIS",
      jamesSSSBasis,
      "PhilHealth uses monthly basic/regular salary PHP 12000.00, not gross including overtime",
      "Pag-IBIG applicable salary exceeds PHP 10000.00 MFS; employee share capped at PHP 200.00",
      "Taxable compensation is below the applicable monthly BIR threshold; withholding is known zero",
      "Gross income is established by C01; do not recompute regular pay or overtime",
    ],
    providerReferences: [jamesGross],
  },
  {
    id: "C02-S03",
    competencyId: "C02",
    activityId: "C02-A03",
    facts: [
      fact("established monthly gross/basic salary", "24000.00"),
      fact("GSIS employee share", "2160.00"),
      fact("PhilHealth employee share", "600.00"),
      fact("Pag-IBIG employee share", "200.00"),
      fact("taxable compensation for monthly BIR", "21040.00"),
      fact("BIR withholding tax", "31.05"),
      {
        key: "private-sector SSS employee share applicability",
        resolution: { kind: "NOT_APPLICABLE" as const },
      },
    ],
    conditions: [
      "Monthly payroll; ordinary government employee; GSIS branch, not SSS",
      "GSIS employee share uses actual monthly basic salary PHP 24000.00",
      "PhilHealth employee share uses monthly basic salary PHP 24000.00",
      "Pag-IBIG employee share capped at PHP 200.00",
      "Monthly BIR: taxable compensation PHP 21040.00, 15% only on excess above PHP 20833.00; A1 corrected withholding PHP 31.05",
    ],
  },
  {
    id: "C02-S04",
    competencyId: "C02",
    activityId: "C02-A04",
    // Job A/B prefixes are local fact-group lookups, NOT scenario or child IDs.
    facts: [
      fact("Job A established monthly gross income", "28000.00"),
      fact("Job A monthly basic salary", "25000.00"),
      fact("Job A explicitly non-taxable allowance", "3000.00"),
      fact("Job A SSS employee share", "1400.00"),
      fact("Job A PhilHealth employee share", "625.00"),
      fact("Job A Pag-IBIG employee share", "200.00"),
      fact("Job A BIR withholding tax", "291.30"),
      fact("Job B established monthly gross income", "28000.00"),
      fact("Job B monthly basic salary", "28000.00"),
      {
        key: "Job B additional allowance applicability",
        resolution: { kind: "NOT_APPLICABLE" as const },
      },
      fact("Job B SSS employee share", "1400.00"),
      fact("Job B PhilHealth employee share", "700.00"),
      fact("Job B Pag-IBIG employee share", "200.00"),
      fact("Job B BIR withholding tax", "730.05"),
    ],
    conditions: [
      "Monthly payroll; both jobs are ordinary private-sector SSS, not GSIS",
      "Job A: SSS table-derived applicable MSC; PhilHealth basic salary PHP 25000.00; Pag-IBIG capped PHP 200.00",
      "Job A: allowance PHP 3000.00 explicitly non-taxable; BIR taxable compensation excludes this allowance and authorized contributions",
      "Job B: SSS table-derived applicable MSC; PhilHealth basic salary PHP 28000.00; Pag-IBIG capped PHP 200.00",
      "Job B: no additional allowance; BIR taxable compensation uses the applicable monthly bracket after authorized contributions",
      "Equal gross income does not imply equal deduction bases or equal take-home pay",
    ],
  },
] as const;

const scenarioIds = ["C02-S01", "C02-S02", "C02-S03", "C02-S04"] as const;
const activityIds = ["C02-A01", "C02-A02", "C02-A03", "C02-A04"] as const;
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
export const c02RoleKeys = Object.freeze([
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-payroll-role",
    "reconsider-arithmetic",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "provider-callout",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-basis",
    "reconsider-ownership",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-branch",
    "reconsider-BIR",
    "reconsider-corrected-oracle",
    "completion",
    "accessibility-summary",
  ],
  [
    "scenario",
    "task",
    "relationship-help",
    "confirmation",
    "reconsider-comparison",
    "reconsider-Job-A",
    "reconsider-Job-B",
    "completion",
    "accessibility-summary",
  ],
] as const);

const parsedScenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioInputs.map((s) => scenarioDefinitionSchema.parse(s)),
);
const parsedActivities: readonly ActivityManifest[] = Object.freeze(
  activityIds.map((id, index) =>
    activityManifestSchema.parse({
      id,
      competencyId: "C02",
      scenarioIds: [scenarioIds[index]!],
      instructionalFamily: families[index],
      contentReferences: [
        ...c02RoleKeys[index]!.map((role) => ({
          contentId: `c02/S0${index + 1}/${role}`,
          variableIds: [],
        })),
        ...(index === 0
          ? c02PhilHealthFloor.contentKeys.map((contentId) => ({
              contentId,
              variableIds: [],
            }))
          : []),
        { contentId: "GLO-08-C02", variableIds: [] },
        { contentId: "GLO-09-C02", variableIds: [] },
      ],
      responseContract: {
        contractId:
          "C02 statutory payroll response semantics (task-local reference)",
      },
      modelBinding: {
        profileId: "Payslip-Inspired Instructional Payroll Ledger",
        interactionProfileId: bindings[index],
      },
      ...(index === 1 ? { providerReferences: [jamesGross] } : {}),
      ...(index < 3 ? { successorActivityId: activityIds[index + 1] } : {}),
    }),
  ),
);
const parsedCompetency: CompetencyDefinition = competencyDefinitionSchema.parse(
  { id: "C02", activityIds },
);

const snapshot = (scenario: ScenarioDefinition) => ({
  facts: scenario.facts.map(({ key, resolution }) =>
    resolution.kind === "KNOWN"
      ? [
          key,
          "KNOWN",
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
  providerReferences: scenario.providerReferences,
});

/** Full C02-local closure, independent of the later-owned global registry. */
export function validateC02Local(
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  support: PhilHealthFloorSupport,
  copy: Readonly<Record<string, string>>,
): void {
  if (
    competency.id !== "C02" ||
    activities.length !== 4 ||
    scenarios.length !== 4 ||
    JSON.stringify(competency.activityIds) !== JSON.stringify(activityIds) ||
    activities.some(
      (a, i) =>
        a.id !== activityIds[i] ||
        a.competencyId !== "C02" ||
        JSON.stringify(a.scenarioIds) !== JSON.stringify([scenarioIds[i]]) ||
        a.instructionalFamily !== families[i] ||
        a.successorActivityId !== activityIds[i + 1] ||
        JSON.stringify(a.providerReferences ?? []) !==
          JSON.stringify(parsedActivities[i]!.providerReferences ?? []) ||
        JSON.stringify(a.contentReferences) !==
          JSON.stringify(parsedActivities[i]!.contentReferences) ||
        a.oracle !== undefined ||
        a.modelBinding?.profileId !==
          parsedActivities[i]!.modelBinding?.profileId ||
        a.modelBinding?.interactionProfileId !== bindings[i] ||
        a.responseContract.contractId !==
          parsedActivities[i]!.responseContract.contractId,
    ) ||
    scenarios.some(
      (s, i) =>
        s.id !== scenarioIds[i] ||
        s.activityId !== activityIds[i] ||
        s.competencyId !== "C02" ||
        s.variants !== undefined ||
        JSON.stringify(snapshot(s)) !==
          JSON.stringify(snapshot(parsedScenarios[i]!)),
    ) ||
    support.id !== "C02-S01-F" ||
    support.activityId !== "C02-A01" ||
    support.primaryScenarioId !== "C02-S01" ||
    support.period !== "monthly" ||
    support.basicSalary.magnitude.toString() !== "8000" ||
    support.minimumContributionBasis.magnitude.toString() !== "10000" ||
    support.employeeShareRate !== "2.5%" ||
    support.basicSalary.unit !== "PHP" ||
    support.minimumContributionBasis.unit !== "PHP" ||
    JSON.stringify(support.contentKeys) !==
      JSON.stringify(c02PhilHealthFloor.contentKeys) ||
    Object.keys(copy).length !== 43 ||
    Object.keys(c02Copy).some(
      (key) => copy[key] !== c02Copy[key as keyof typeof c02Copy],
    )
  ) {
    throw new Error("C02 fixed local inventory/content mismatch");
  }
}

validateC02Local(
  parsedCompetency,
  parsedActivities,
  parsedScenarios,
  c02PhilHealthFloor,
  c02Copy,
);

/** External C01 source registry and model/response identities are later-owned. */
export const c02Catalog = composeStudyCatalog({
  complete: false,
  competencies: [parsedCompetency],
  activities: parsedActivities,
  scenarios: parsedScenarios,
  contentIds: Object.keys(c02Copy),
  responseContractIds: [],
  modelProfileIds: [],
  interactionProfileIds: [],
  oracleIds: [],
});
export const c02Competency = c02Catalog.competencies.get("C02")!;
export const c02Activities: readonly ActivityManifest[] = Object.freeze(
  activityIds.map((id) => c02Catalog.activities.get(id)!),
);
export const c02Scenarios: readonly ScenarioDefinition[] = Object.freeze(
  scenarioIds.map((id) => c02Catalog.scenarios.get(id)!),
);
