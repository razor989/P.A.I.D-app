import { ExactDecimal, quantity } from "@/core/public";
import type { ActivityId, Quantity } from "@/core/public";
import { calculateC06Compensation } from "../math/public";
import type { C06CalculationInput, C06PeriodAlignment } from "../math/public";

type C06ActivityId = Extract<ActivityId, `C06-${string}`>;
type C06ChildId = "C06-S01-A" | "C06-S01-B" | "C06-S02-A" | "C06-S02-B";
type C06ScenarioId = "C06-S01" | "C06-S02" | "C06-S03" | "C06-S04";

/** Inputs only; trusted future binding authenticates canonical Study provenance.
 * This module validates closed source semantics, not provenance by structural typing.
 */
export type C06ModelCase = Readonly<{ childId: C06ChildId | null }> &
  C06CalculationInput;
export type C06ModelDefinition = Readonly<{
  activityId: C06ActivityId;
  scenarioId: C06ScenarioId;
  cases: readonly C06ModelCase[];
}>;

export type C06ModelState =
  | Readonly<{
      activityId: "C06-A01";
      scenarioId: "C06-S01";
      selectedChildId: "C06-S01-A" | "C06-S01-B";
    }>
  | Readonly<{
      activityId: "C06-A02";
      scenarioId: "C06-S02";
      selectedChildId: "C06-S02-A" | "C06-S02-B";
    }>
  | Readonly<{
      activityId: "C06-A03";
      scenarioId: "C06-S03";
    }>
  | Readonly<{
      activityId: "C06-A04";
      scenarioId: "C06-S04";
    }>;

/** Complete approved model selection, never the learner's arrangement response. */
export type C06ModelIntent = Readonly<{
  type: "SELECT_CHILD";
  childId: C06ChildId;
}>;
/** Minimal model evidence only, not an application Recovery checkpoint. */
export type C06PersistedModelV1 = Extract<
  C06ModelState,
  { selectedChildId: C06ChildId }
>;

const definitions = new WeakMap<C06ModelState, C06ModelDefinition>();
const profiles = Object.freeze({
  "C06-A01": "C06-S01",
  "C06-A02": "C06-S02",
  "C06-A03": "C06-S03",
  "C06-A04": "C06-S04",
} as const);

function record(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d !== undefined && d.enumerable && "value" in d;
    })
  );
}

function copyQuantity(value: unknown, rate: boolean): Quantity {
  if (!record(value, ["magnitude", "kind", "unit", "basis"]))
    throw new TypeError("Invalid C06 source quantity");
  // Authenticate exact storage before copying; never coerce source numbers.
  const magnitude = ExactDecimal.from(
    ExactDecimal.prototype.toString.call(value.magnitude as ExactDecimal),
  );
  if (magnitude.compare(ExactDecimal.from("0")) <= 0)
    throw new RangeError("C06 fixed model parameters must be positive");
  if (
    value.kind !== (rate ? "PERCENTAGE_RATE" : "MONETARY_AMOUNT") ||
    value.unit !== (rate ? "%" : "PHP") ||
    (rate && value.basis !== null) ||
    (value.basis !== null && typeof value.basis !== "string")
  )
    throw new TypeError("Invalid C06 source quantity role");
  return quantity(
    magnitude,
    rate ? "PERCENTAGE_RATE" : "MONETARY_AMOUNT",
    rate ? "%" : "PHP",
    value.basis,
  );
}

function copyCase(
  value: unknown,
  activityId: C06ActivityId,
  index: number,
): C06ModelCase {
  const straight =
    activityId === "C06-A03" || (activityId === "C06-A01" && index === 0);
  const keys = [
    "childId",
    "arrangement",
    "sales",
    "commissionRate",
    "baseSalary",
  ];
  if (!straight) keys.push("periodAlignment");
  const scenarioId = profiles[activityId];
  const childId =
    activityId === "C06-A01" || activityId === "C06-A02"
      ? (`${scenarioId}-${index === 0 ? "A" : "B"}` as C06ChildId)
      : null;
  if (
    !record(value, keys) ||
    value.childId !== childId ||
    value.arrangement !==
      (straight ? "STRAIGHT_COMMISSION" : "BASE_PLUS_COMMISSION")
  )
    throw new TypeError("C06 case/arrangement membership mismatch");
  if (
    !record(value.sales, ["kind", "value"]) ||
    value.sales.kind !== "KNOWN" ||
    !record(value.commissionRate, ["kind", "value"]) ||
    value.commissionRate.kind !== "KNOWN"
  )
    throw new TypeError("C06 fixed cases require established sales and rate");
  const sales = copyQuantity(value.sales.value, false);
  const commissionRate = copyQuantity(value.commissionRate.value, true);
  const salesBasis =
    activityId === "C06-A02"
      ? "per month"
      : activityId === "C06-A04"
        ? "June"
        : null;
  if (sales.basis !== salesBasis)
    throw new TypeError("C06 source sales basis mismatch");
  const inputs = {
    childId,
    sales: Object.freeze({ kind: "KNOWN" as const, value: sales }),
    commissionRate: Object.freeze({
      kind: "KNOWN" as const,
      value: commissionRate,
    }),
  };
  if (straight) {
    if (
      !record(value.baseSalary, ["kind"]) ||
      value.baseSalary.kind !== "NOT_APPLICABLE"
    )
      throw new TypeError("Straight Commission base must be N/A");
    return Object.freeze({
      ...inputs,
      arrangement: "STRAIGHT_COMMISSION",
      baseSalary: Object.freeze({ kind: "NOT_APPLICABLE" }),
    });
  }
  if (
    !record(value.baseSalary, ["kind", "value"]) ||
    value.baseSalary.kind !== "KNOWN"
  )
    throw new TypeError("C06 fixed Base-Plus case requires established base");
  const base = copyQuantity(value.baseSalary.value, false);
  const compensationBasis = activityId === "C06-A04" ? "June" : "per month";
  const period = value.periodAlignment;
  if (
    base.basis !== "per month" ||
    !record(period, ["salesBasis", "baseSalaryBasis", "compensationBasis"]) ||
    period.salesBasis !== salesBasis ||
    period.baseSalaryBasis !== base.basis ||
    period.compensationBasis !== compensationBasis
  )
    throw new TypeError("C06 source compensation-period evidence mismatch");
  const periodAlignment: C06PeriodAlignment = Object.freeze({
    salesBasis,
    baseSalaryBasis: base.basis,
    compensationBasis,
  });
  return Object.freeze({
    ...inputs,
    arrangement: "BASE_PLUS_COMMISSION",
    baseSalary: Object.freeze({ kind: "KNOWN", value: base }),
    periodAlignment,
  });
}

function copyDefinition(value: unknown): C06ModelDefinition {
  if (
    !record(value, ["activityId", "scenarioId", "cases"]) ||
    typeof value.activityId !== "string" ||
    !Object.prototype.hasOwnProperty.call(profiles, value.activityId)
  )
    throw new TypeError("Invalid C06 model definition");
  const activityId = value.activityId as C06ActivityId;
  const count = activityId === "C06-A01" || activityId === "C06-A02" ? 2 : 1;
  if (
    value.scenarioId !== profiles[activityId] ||
    !Array.isArray(value.cases) ||
    Object.getPrototypeOf(value.cases) !== Array.prototype ||
    value.cases.length !== count ||
    Reflect.ownKeys(value.cases).length !== count + 1
  )
    throw new TypeError("Invalid C06 scenario inventory");
  const cases = Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const d = Object.getOwnPropertyDescriptor(value.cases, String(index));
      if (!d || !d.enumerable || !("value" in d))
        throw new TypeError("Invalid C06 source case data");
      return copyCase(d.value, activityId, index);
    }),
  );
  const a = cases[0]!;
  const b = cases[1];
  const amount = (
    entry: C06ModelCase,
    key: "sales" | "commissionRate" | "baseSalary",
  ) => {
    const v = entry[key];
    if (v.kind !== "KNOWN")
      throw new TypeError("C06 invariant requires known input");
    return v.value.magnitude;
  };
  if (
    b &&
    (!amount(a, "commissionRate").equals(amount(b, "commissionRate")) ||
      (activityId === "C06-A01" &&
        !amount(a, "sales").equals(amount(b, "sales"))) ||
      (activityId === "C06-A02" &&
        (!amount(a, "baseSalary").equals(amount(b, "baseSalary")) ||
          amount(a, "sales").compare(amount(b, "sales")) >= 0)))
  )
    throw new TypeError("C06 controlled comparison invariants violated");
  return Object.freeze({ activityId, scenarioId: profiles[activityId], cases });
}

function issue(
  definition: C06ModelDefinition,
  child?: C06ChildId,
): C06ModelState {
  const state = Object.freeze({
    activityId: definition.activityId,
    scenarioId: definition.scenarioId,
    ...(definition.cases.length === 2
      ? { selectedChildId: child ?? definition.cases[0]!.childId! }
      : {}),
  }) as C06ModelState;
  definitions.set(state, definition);
  return state;
}

function requireDefinition(state: C06ModelState): C06ModelDefinition {
  const definition = state && definitions.get(state);
  if (!definition) throw new TypeError("Unissued C06 model state");
  return definition;
}

export function createC06ModelState(
  authority: C06ModelDefinition,
): C06ModelState {
  return issue(copyDefinition(authority));
}

export function applyC06ModelIntent(
  state: C06ModelState,
  intent: C06ModelIntent,
): C06ModelState {
  const definition = requireDefinition(state);
  if (
    definition.cases.length !== 2 ||
    !record(intent, ["type", "childId"]) ||
    intent.type !== "SELECT_CHILD" ||
    !definition.cases.some((entry) => entry.childId === intent.childId)
  )
    throw new TypeError("Unauthorized C06 model intent");
  return issue(definition, intent.childId);
}

/** TRUSTED INTERNAL truth; does not authorize visual/text/ARIA answer exposure.
 * No layout, animation, response, evaluation or provider-export responsibility.
 */
export function deriveC06ModelState(state: C06ModelState) {
  const definition = requireDefinition(state);
  const selected = definition.cases.find(
    (entry) =>
      entry.childId ===
      ("selectedChildId" in state ? state.selectedChildId : null),
  )!;
  const input: C06CalculationInput =
    selected.arrangement === "STRAIGHT_COMMISSION"
      ? {
          arrangement: selected.arrangement,
          sales: selected.sales,
          commissionRate: selected.commissionRate,
          baseSalary: selected.baseSalary,
        }
      : {
          arrangement: selected.arrangement,
          sales: selected.sales,
          commissionRate: selected.commissionRate,
          baseSalary: selected.baseSalary,
          periodAlignment: selected.periodAlignment,
        };
  const calculation = calculateC06Compensation(input);
  return Object.freeze({
    state,
    sales: selected.sales,
    commissionRate: selected.commissionRate,
    ...calculation,
  });
}

export function validateC06PersistedModelV1(
  value: unknown,
  authority: C06ModelDefinition,
): C06PersistedModelV1 {
  const source = copyDefinition(authority);
  if (
    source.cases.length !== 2 ||
    !record(value, ["activityId", "scenarioId", "selectedChildId"]) ||
    value.activityId !== source.activityId ||
    value.scenarioId !== source.scenarioId ||
    !source.cases.some((entry) => entry.childId === value.selectedChildId)
  )
    throw new TypeError("Invalid C06 persisted selection evidence");
  return Object.freeze({
    activityId: value.activityId,
    scenarioId: value.scenarioId,
    selectedChildId: value.selectedChildId,
  }) as C06PersistedModelV1;
}

function sameSource(a: C06ModelDefinition, b: C06ModelDefinition): boolean {
  // Definitions are now closed, defensive data; ExactDecimal is serialized explicitly.
  const serialize = (value: unknown): string =>
    JSON.stringify(value, (_key, entry: unknown) =>
      entry instanceof ExactDecimal ? entry.toString() : entry,
    );
  return serialize(a) === serialize(b);
}

export function projectC06PersistedModelV1(
  state: C06ModelState,
  authority: C06ModelDefinition,
): C06PersistedModelV1 {
  const issued = requireDefinition(state);
  const source = copyDefinition(authority);
  if (!sameSource(issued, source))
    throw new TypeError("C06 live model/source mismatch");
  return validateC06PersistedModelV1(state, source);
}

/** Recompute from current authenticated source, never persisted amounts/answers. */
export function restoreC06ModelState(
  value: unknown,
  authority: C06ModelDefinition,
): C06ModelState {
  const source = copyDefinition(authority);
  const evidence = validateC06PersistedModelV1(value, source);
  return issue(source, evidence.selectedChildId);
}
