import { ExactDecimal } from "../../core/public";
import type {
  ActivityManifest,
  CompetencyDefinition,
  ScenarioDefinition,
} from "../schemas/public";
import {
  activityManifestSchema,
  competencyDefinitionSchema,
  scenarioDefinitionSchema,
} from "../schemas/public";
import {
  c01Activities,
  c01Competency,
  c01Copy,
  c01Scenarios,
} from "../competencies/c01/public";
import {
  c02Activities,
  c02Competency,
  c02Copy,
  c02RoleKeys,
  c02Scenarios,
  c02PhilHealthFloor,
} from "../competencies/c02/public";
import {
  c03Activities,
  c03Competency,
  c03Copy,
  c03RoleKeys,
  c03Scenarios,
  c03Evidence,
} from "../competencies/c03/public";
import {
  c04Activities,
  c04Competency,
  c04Copy,
  c04RoleKeys,
  c04Scenarios,
  c04Boundary,
} from "../competencies/c04/public";
import {
  c05Activities,
  c05Competency,
  c05Copy,
  c05RoleKeys,
  c05Scenarios,
  c05Relationships,
  c05James,
} from "../competencies/c05/public";
import {
  c06Activities,
  c06Competency,
  c06Copy,
  c06RoleKeys,
  c06Scenarios,
  c06Cases,
  c06CommissionProvider,
} from "../competencies/c06/public";
import {
  providerReviewDefinitions,
  validateProviderReviewGraph,
} from "../provider-review/public";
import type { ProviderReviewDefinition } from "../provider-review/public";

export type StudyPart = Readonly<{
  competency: CompetencyDefinition;
  activities: readonly ActivityManifest[];
  scenarios: readonly ScenarioDefinition[];
  copy: Readonly<Record<string, string>>;
  roles: readonly (readonly string[])[];
}>;
export type ContentBank = Readonly<{
  parts: readonly StudyPart[];
  providerDefinitions: readonly ProviderReviewDefinition[];
  c02Support: typeof c02PhilHealthFloor;
  c03Evidence: typeof c03Evidence;
  c04Boundary: typeof c04Boundary;
  c05Relationships: typeof c05Relationships;
  james: typeof c05James;
  cases: typeof c06Cases;
  commission: typeof c06CommissionProvider;
}>;

// Source-owned exports are the registry; no alternate definitions or computed answers.
const part = (
  competency: CompetencyDefinition,
  activities: readonly ActivityManifest[],
  scenarios: readonly ScenarioDefinition[],
  copy: Readonly<Record<string, string>>,
  roles: readonly (readonly string[])[],
): StudyPart =>
  Object.freeze({ competency, activities, scenarios, copy, roles });
const c01Roles = Object.freeze(
  c01Activities.map((activity) =>
    Object.freeze(
      activity.contentReferences
        .filter((ref) => ref.contentId.startsWith("c01/"))
        .map((ref) => ref.contentId.split("/")[2]!),
    ),
  ),
);
export const actualContentBank: ContentBank = Object.freeze({
  parts: Object.freeze([
    part(c01Competency, c01Activities, c01Scenarios, c01Copy, c01Roles),
    part(c02Competency, c02Activities, c02Scenarios, c02Copy, c02RoleKeys),
    part(c03Competency, c03Activities, c03Scenarios, c03Copy, c03RoleKeys),
    part(c04Competency, c04Activities, c04Scenarios, c04Copy, c04RoleKeys),
    part(c05Competency, c05Activities, c05Scenarios, c05Copy, c05RoleKeys),
    part(c06Competency, c06Activities, c06Scenarios, c06Copy, c06RoleKeys),
  ]),
  providerDefinitions: providerReviewDefinitions,
  c02Support: c02PhilHealthFloor,
  c03Evidence,
  c04Boundary,
  c05Relationships,
  james: c05James,
  cases: c06Cases,
  commission: c06CommissionProvider,
});

const counts = [4, 4, 4, 4, 5, 4];
const models = [
  "Pay-Period Earnings Sheet",
  "Payslip-Inspired Instructional Payroll Ledger",
  "Overtime Work Record",
  "Anchored Change Track",
  "Compensation Time-Basis Board",
  "Modular Commission Machine",
];
const responses = [
  "C01 established-earnings response semantics (task-local reference)",
  "C02 statutory payroll response semantics (task-local reference)",
  "C03 condition-linked overtime response semantics (task-local reference)",
  "C04 original-reference percentage and nonnumeric undefined response (task-local reference)",
  "C05 given-to-target representation and established basis (task-local reference)",
  "C06 arrangement, sales, rate and conditional base (task-local reference)",
];
const bindings = [
  [
    "Interactive — evaluative",
    "Interactive — explanatory/live",
    "Static semantic",
    "Static semantic",
  ],
  [
    "Static semantic + embedded floor state",
    "Interactive — explanatory",
    "Static semantic",
    "Static semantic — paired configuration",
  ],
  [
    "Static semantic",
    "Interactive — explanatory",
    "Static semantic — aggregate-hours form",
    "Static semantic — approved single-day schematic allowed",
  ],
  [
    "Static semantic",
    "Interactive — fixed scenario New states",
    "Static semantic",
    "Static semantic — Undefined terminal boundary",
  ],
  [
    "Static semantic",
    "Interactive — approved partition sequence",
    "Static semantic — direct conversion",
    "Static semantic — explicit schedule basis",
    "Static semantic — fixed annual-factor basis",
  ],
  [
    "Interactive — arrangement structure",
    "Interactive — approved sales comparison",
    "Static semantic — straight commission",
    "Static semantic — base plus commission",
  ],
];

function reject(owner: string, field: string, reason: string): never {
  throw new Error(`${owner} ${field}: ${reason}`);
}

/** Check the input itself before parsing; Zod parsing would detach and freeze a repair. */
function sealed(
  value: unknown,
  owner: string,
  ancestors = new Set<object>(),
): void {
  if (value instanceof ExactDecimal) {
    if (
      Object.getPrototypeOf(value) !== ExactDecimal.prototype ||
      !Object.isFrozen(value) ||
      Reflect.ownKeys(value).length
    )
      reject(owner, "decimal", "forged or mutable ExactDecimal");
    return;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (
    typeof value !== "object" ||
    !Object.isFrozen(value) ||
    ancestors.has(value)
  )
    reject(owner, "data", "mutable, executable or cyclic declaration");
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    !Array.isArray(value)
  )
    reject(owner, "prototype", "unsupported data prototype");
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  if (
    Array.isArray(value) &&
    (Object.keys(value).length !== value.length ||
      keys.length !== value.length + 1)
  )
    reject(owner, "array", "sparse or unexpected own property");
  for (const key of keys) {
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      descriptor.value === undefined ||
      (Array.isArray(value) &&
        (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
    )
      reject(
        owner,
        String(key),
        "accessor, hidden, undefined or unexpected own property",
      );
    sealed(descriptor.value, `${owner}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

function equal(a: unknown, b: unknown): boolean {
  if (a instanceof ExactDecimal || b instanceof ExactDecimal)
    return (
      a instanceof ExactDecimal && b instanceof ExactDecimal && a.equals(b)
    );
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a),
    other = Object.keys(b);
  return (
    keys.length === other.length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        equal(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

function same(
  owner: string,
  field: string,
  value: unknown,
  expected: unknown,
): void {
  if (!equal(value, expected))
    reject(owner, field, "source-owned fixed declaration mismatch");
}

function schema(owner: string, field: string, valid: boolean): void {
  if (!valid) reject(owner, field, "invalid schema or unexpected field");
}

export function validateContent(bank: ContentBank): Readonly<{
  competencies: number;
  activities: number;
  scenarios: number;
  providerEdges: number;
}> {
  sealed(bank, "study bank");
  const bankKeys = [
    "parts",
    "providerDefinitions",
    "c02Support",
    "c03Evidence",
    "c04Boundary",
    "c05Relationships",
    "james",
    "cases",
    "commission",
  ];
  if (
    Object.keys(bank).length !== bankKeys.length ||
    bankKeys.some((key) => !Object.prototype.hasOwnProperty.call(bank, key))
  )
    reject(
      "study bank",
      "fields",
      "unexpected or missing source-owned declaration",
    );
  if (bank.parts.length !== 6)
    reject("study", "competencies", "expected exactly C01–C06");
  const activities: ActivityManifest[] = [],
    scenarios: ScenarioDefinition[] = [];
  const seen = new Set<string>();
  for (const [i, current] of bank.parts.entries()) {
    const owner = `C0${i + 1}`,
      reference = actualContentBank.parts[i]!;
    if (
      Object.keys(current).length !== 5 ||
      ["competency", "activities", "scenarios", "copy", "roles"].some(
        (key) => !Object.prototype.hasOwnProperty.call(current, key),
      )
    )
      reject(owner, "fields", "unexpected or missing study-part declaration");
    schema(
      owner,
      "competency",
      competencyDefinitionSchema.safeParse(current.competency).success,
    );
    if (current.competency.id !== owner || seen.has(current.competency.id))
      reject(owner, "identity", "wrong order or duplicate competency");
    seen.add(owner);
    same(
      owner,
      "ordered activity IDs",
      current.competency.activityIds,
      reference.competency.activityIds,
    );
    if (
      current.activities.length !== counts[i] ||
      current.scenarios.length !== counts[i]
    )
      reject(
        owner,
        "inventory",
        "wrong activity or primary scenario distribution",
      );
    same(
      owner,
      "source-owned content dictionary",
      current.copy,
      reference.copy,
    );
    same(owner, "scenario role declarations", current.roles, reference.roles);
    if (current.roles.length !== counts[i])
      reject(owner, "roles", "wrong activity role attachment count");
    for (const [j, activity] of current.activities.entries()) {
      const expected = reference.activities[j]!;
      schema(
        String(activity.id),
        "activity",
        activityManifestSchema.safeParse(activity).success,
      );
      if (seen.has(activity.id))
        reject(activity.id, "identity", "duplicate activity");
      seen.add(activity.id);
      if (
        activity.id !== expected.id ||
        activity.competencyId !== owner ||
        activity.id !== current.competency.activityIds[j]
      )
        reject(activity.id, "ownership", "wrong or supporting progress unit");
      same(
        activity.id,
        "primary scenario",
        activity.scenarioIds,
        expected.scenarioIds,
      );
      same(
        activity.id,
        "family",
        activity.instructionalFamily,
        expected.instructionalFamily,
      );
      same(
        activity.id,
        "successor",
        activity.successorActivityId,
        current.activities[j + 1]?.id,
      );
      same(activity.id, "response contract", activity.responseContract, {
        contractId: responses[i],
      });
      same(activity.id, "model family/interaction", activity.modelBinding, {
        profileId: models[i],
        interactionProfileId: bindings[i]![j],
      });
      same(activity.id, "oracle declaration", activity.oracle, expected.oracle);
      same(
        activity.id,
        "activity provider references",
        activity.providerReferences,
        expected.providerReferences,
      );
      const scenarioId = expected.scenarioIds[0]!,
        prefix = `${owner.toLowerCase()}/${scenarioId.slice(-3)}/`;
      const roleIds = current.roles[j]!.map((role) => `${prefix}${role}`);
      const required = [
        ...roleIds,
        ...(owner === "C02" && j === 0 ? [...bank.c02Support.contentKeys] : []),
        `GLO-08-${owner}`,
        `GLO-09-${owner}`,
      ];
      same(
        activity.id,
        "role/GLO attachment",
        activity.contentReferences.map((ref) => ref.contentId),
        required,
      );
      same(
        activity.id,
        "content reference metadata",
        activity.contentReferences,
        expected.contentReferences,
      );
      for (const ref of activity.contentReferences) {
        if (
          !Object.prototype.hasOwnProperty.call(current.copy, ref.contentId) ||
          !current.copy[ref.contentId]?.trim()
        )
          reject(activity.id, ref.contentId, "missing or empty canonical copy");
        if (
          ref.variableIds.length ||
          /\{\{[^}]+\}\}/.test(current.copy[ref.contentId]!)
        )
          reject(activity.id, ref.contentId, "undeclared dynamic placeholder");
      }
      activities.push(activity);
    }
    for (const [j, scenario] of current.scenarios.entries()) {
      const expected = reference.scenarios[j]!;
      schema(
        String(scenario.id),
        "scenario",
        scenarioDefinitionSchema.safeParse(scenario).success,
      );
      if (seen.has(scenario.id))
        reject(scenario.id, "identity", "duplicate or promoted child scenario");
      seen.add(scenario.id);
      if (
        scenario.id !== expected.id ||
        scenario.competencyId !== owner ||
        scenario.activityId !== current.activities[j]?.id
      )
        reject(scenario.id, "ownership", "orphan or foreign primary scenario");
      same(
        scenario.id,
        "facts/conditions/child states/provider references",
        scenario,
        expected,
      );
      for (const child of scenario.variants ?? []) {
        if (seen.has(child.id))
          reject(child.id, "child identity", "duplicate or promoted child");
        seen.add(child.id);
      }
      scenarios.push(scenario);
    }
  }
  if (activities.length !== 25 || scenarios.length !== 25)
    reject(
      "study",
      "progress census",
      "expected 25 activities and primary scenarios",
    );
  for (const key of [
    "c02Support",
    "c03Evidence",
    "c04Boundary",
    "c05Relationships",
    "james",
    "cases",
    "commission",
  ] as const)
    same(
      key,
      "source-owned semantic/reveal data",
      bank[key],
      actualContentBank[key],
    );
  if (bank.providerDefinitions.length !== 4)
    reject("provider", "edges", "expected exactly four instantiated edges");
  validateProviderReviewGraph(
    { activities, scenarios, james: bank.james, commission: bank.commission },
    bank.providerDefinitions,
  );
  return Object.freeze({
    competencies: 6,
    activities: activities.length,
    scenarios: scenarios.length,
    providerEdges: bank.providerDefinitions.length,
  });
}
