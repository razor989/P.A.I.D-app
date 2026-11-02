import { ExactDecimal, isQuantity, quantity } from "@/core/public";
import type { ActivityId, Quantity } from "@/core/public";
import { calculateC03OvertimePay, deriveC03Multiplier } from "../math/public";
import type { C03Condition } from "../math/public";

type C03ActivityId = Extract<ActivityId, `C03-${string}`>;
type C03ChildId = "C03-S02-A" | "C03-S02-B";

export type C03ModelCase = Readonly<{
  childId: C03ChildId | null;
  condition: C03Condition;
  rate: Quantity;
  hours: Quantity;
  multiplier: Quantity;
}>;

/** Trusted composition must authenticate canonical Study membership/fact provenance.
 * Structural validation alone does not attest the origin of supplied quantities.
 */
export type C03ModelDefinition = Readonly<{
  activityId: C03ActivityId;
  scenarioId: "C03-S01" | "C03-S02" | "C03-S03" | "C03-S04";
  evidenceMode:
    | "ordinary-day record"
    | "paired fixed conditions"
    | "monthly aggregate overtime hours"
    | "regular-holiday single day";
  cases: readonly C03ModelCase[];
}>;

export type C03ModelState =
  | Readonly<{
      activityId: "C03-A02";
      scenarioId: "C03-S02";
      selectedChildId: C03ChildId;
    }>
  | Readonly<{
      activityId: Exclude<C03ActivityId, "C03-A02">;
      scenarioId: "C03-S01" | "C03-S03" | "C03-S04";
    }>;

export type C03ModelIntent = Readonly<{
  type: "SELECT_CHILD";
  childId: C03ChildId;
}>;

/** Model-side V1 evidence only; not a complete application Recovery checkpoint. */
export type C03PersistedModelV1 = Readonly<{
  activityId: "C03-A02";
  scenarioId: "C03-S02";
  selectedChildId: C03ChildId;
}>;

export type C03ModelSnapshot = Readonly<{
  state: C03ModelState;
  evidenceMode: C03ModelDefinition["evidenceMode"];
  condition: C03Condition;
  rate: Quantity;
  hours: Quantity;
  multiplier: Quantity;
  overtimePay: ReturnType<typeof calculateC03OvertimePay>;
}>;

const definitions = new WeakMap<C03ModelState, C03ModelDefinition>();
const profiles = Object.freeze({
  "C03-A01": ["C03-S01", "ordinary-day record"],
  "C03-A02": ["C03-S02", "paired fixed conditions"],
  "C03-A03": ["C03-S03", "monthly aggregate overtime hours"],
  "C03-A04": ["C03-S04", "regular-holiday single day"],
} as const);

function record(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return (
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d !== undefined && d.enumerable && "value" in d;
    })
  );
}

function copyQuantity(value: unknown): Quantity {
  if (
    !record(value, ["magnitude", "kind", "unit", "basis"]) ||
    !isQuantity(value) ||
    !Object.isFrozen(value.magnitude)
  )
    throw new TypeError("Invalid C03 source quantity");
  // Authenticate ExactDecimal private storage, not instanceof alone.
  const magnitude = ExactDecimal.from(
    ExactDecimal.prototype.toString.call(value.magnitude),
  );
  return quantity(magnitude, value.kind, value.unit, value.basis);
}

function copyCase(
  input: unknown,
  childId: C03ChildId | null,
  condition: C03Condition,
): C03ModelCase {
  if (
    !record(input, ["childId", "condition", "rate", "hours", "multiplier"]) ||
    input.childId !== childId ||
    input.condition !== condition
  )
    throw new TypeError("Invalid C03 condition/case membership");
  const rate = copyQuantity(input.rate);
  const hours = copyQuantity(input.hours);
  const supplied = copyQuantity(input.multiplier);
  const multiplier = deriveC03Multiplier(condition);
  if (
    supplied.kind !== multiplier.kind ||
    supplied.unit !== multiplier.unit ||
    supplied.basis !== multiplier.basis ||
    !supplied.magnitude.equals(multiplier.magnitude)
  )
    throw new TypeError("C03 source condition/multiplier mismatch");
  calculateC03OvertimePay(
    { kind: "KNOWN", value: rate },
    { kind: "KNOWN", value: condition },
    { kind: "KNOWN", value: hours },
  );
  return Object.freeze({ childId, condition, rate, hours, multiplier });
}

function copyDefinition(input: unknown): C03ModelDefinition {
  if (
    !record(input, ["activityId", "scenarioId", "evidenceMode", "cases"]) ||
    typeof input.activityId !== "string" ||
    !Object.prototype.hasOwnProperty.call(profiles, input.activityId)
  )
    throw new TypeError("Invalid C03 model definition");
  const activityId = input.activityId as C03ActivityId;
  const [scenarioId, evidenceMode] = profiles[activityId];
  const paired = activityId === "C03-A02";
  const count = paired ? 2 : 1;
  if (
    input.scenarioId !== scenarioId ||
    input.evidenceMode !== evidenceMode ||
    !Array.isArray(input.cases) ||
    Object.getPrototypeOf(input.cases) !== Array.prototype ||
    input.cases.length !== count ||
    Reflect.ownKeys(input.cases).length !== count + 1
  )
    throw new TypeError("Invalid C03 scenario/evidence inventory");
  const cases = Object.freeze(
    Array.from({ length: count }, (_, i) => {
      const d = Object.getOwnPropertyDescriptor(input.cases, String(i));
      if (!d || !d.enumerable || !("value" in d))
        throw new TypeError("Invalid C03 case data");
      return copyCase(
        d.value,
        paired ? (i === 0 ? "C03-S02-A" : "C03-S02-B") : null,
        activityId === "C03-A04"
          ? "regular holiday"
          : paired && i === 1
            ? "rest day"
            : "ordinary working day",
      );
    }),
  );
  if (
    paired &&
    (!cases[0]!.rate.magnitude.equals(cases[1]!.rate.magnitude) ||
      !cases[0]!.hours.magnitude.equals(cases[1]!.hours.magnitude))
  )
    throw new TypeError("C03 comparison rate and hours must remain invariant");
  return Object.freeze({ activityId, scenarioId, evidenceMode, cases });
}

function issue(
  definition: C03ModelDefinition,
  childId: C03ChildId = "C03-S02-A",
): C03ModelState {
  const state: C03ModelState =
    definition.activityId === "C03-A02"
      ? Object.freeze({
          activityId: "C03-A02",
          scenarioId: "C03-S02",
          selectedChildId: childId,
        })
      : Object.freeze({
          activityId: definition.activityId,
          scenarioId: definition.scenarioId as
            "C03-S01" | "C03-S03" | "C03-S04",
        });
  definitions.set(state, definition);
  return state;
}

function requireDefinition(state: C03ModelState): C03ModelDefinition {
  const definition = state && definitions.get(state);
  if (!definition) throw new TypeError("Unissued C03 model state");
  return definition;
}

export function createC03ModelState(
  authority: C03ModelDefinition,
): C03ModelState {
  return issue(copyDefinition(authority));
}

/** T061 may adapt shared SELECT_MODEL_CHILD to this complete family selection. */
export function applyC03ModelIntent(
  state: C03ModelState,
  intent: C03ModelIntent,
): C03ModelState {
  const definition = requireDefinition(state);
  if (
    state.activityId !== "C03-A02" ||
    !record(intent, ["type", "childId"]) ||
    intent.type !== "SELECT_CHILD" ||
    (intent.childId !== "C03-S02-A" && intent.childId !== "C03-S02-B")
  )
    throw new TypeError("Unauthorized C03 model intent");
  return issue(definition, intent.childId);
}

/** TRUSTED INTERNAL data. Does not authorize visual, text, tooltip or ARIA reveal. */
export function deriveC03ModelState(state: C03ModelState): C03ModelSnapshot {
  const definition = requireDefinition(state);
  const selected = definition.cases.find(
    (item) =>
      item.childId ===
      (state.activityId === "C03-A02" ? state.selectedChildId : null),
  )!;
  return Object.freeze({
    state,
    evidenceMode: definition.evidenceMode,
    condition: selected.condition,
    rate: selected.rate,
    hours: selected.hours,
    multiplier: deriveC03Multiplier(selected.condition),
    overtimePay: calculateC03OvertimePay(
      { kind: "KNOWN", value: selected.rate },
      { kind: "KNOWN", value: selected.condition },
      { kind: "KNOWN", value: selected.hours },
    ),
  });
}

export function validateC03PersistedModelV1(
  value: unknown,
  authority: C03ModelDefinition,
): C03PersistedModelV1 {
  const source = copyDefinition(authority);
  if (
    source.activityId !== "C03-A02" ||
    !record(value, ["activityId", "scenarioId", "selectedChildId"]) ||
    value.activityId !== source.activityId ||
    value.scenarioId !== source.scenarioId ||
    (value.selectedChildId !== "C03-S02-A" &&
      value.selectedChildId !== "C03-S02-B")
  )
    throw new TypeError("Invalid C03 persisted model evidence");
  return Object.freeze({
    activityId: "C03-A02",
    scenarioId: "C03-S02",
    selectedChildId: value.selectedChildId,
  });
}

export function projectC03PersistedModelV1(
  state: C03ModelState,
  authority: C03ModelDefinition,
): C03PersistedModelV1 {
  const issued = requireDefinition(state);
  const source = copyDefinition(authority);
  if (
    issued.activityId !== source.activityId ||
    issued.scenarioId !== source.scenarioId ||
    issued.evidenceMode !== source.evidenceMode ||
    issued.cases.length !== source.cases.length ||
    issued.cases.some((item, index) => {
      const expected = source.cases[index]!;
      return (
        item.childId !== expected.childId ||
        item.condition !== expected.condition ||
        (["rate", "hours", "multiplier"] as const).some(
          (role) =>
            item[role].kind !== expected[role].kind ||
            item[role].unit !== expected[role].unit ||
            item[role].basis !== expected[role].basis ||
            !item[role].magnitude.equals(expected[role].magnitude),
        )
      );
    })
  )
    throw new TypeError("C03 live model/source mismatch");
  return validateC03PersistedModelV1(state, source);
}

/** Reissue from current trusted source, never from persisted quantities or answers. */
export function restoreC03ModelState(
  value: unknown,
  authority: C03ModelDefinition,
): C03ModelState {
  const source = copyDefinition(authority);
  const evidence = validateC03PersistedModelV1(value, source);
  return issue(source, evidence.selectedChildId);
}
