import { ExactDecimal, isQuantity, quantity } from "../../../core/public";
import type { ActivityId, Quantity, ScenarioId } from "../../../core/public";
import { calculateC04Change } from "../math/public";
import type { C04Change } from "../math/public";

type C04ActivityId = Extract<ActivityId, `C04-${string}`>;
type C04ScenarioId = Extract<ScenarioId, `C04-S0${1 | 2 | 3 | 4}`>;
type C04ChildId = "C04-S02-A" | "C04-S02-B";

export type C04ModelCase = Readonly<{
  childId: C04ChildId | null;
  original: Readonly<{ role: string; value: Quantity }>;
  newValue: Readonly<{ role: string; value: Quantity }>;
}>;

/** Trusted composition supplies the source-approved facts; this type cannot attest provenance. */
export type C04ModelDefinition = Readonly<{
  activityId: C04ActivityId;
  scenarioId: C04ScenarioId;
  cases: readonly C04ModelCase[];
}>;

export type C04ModelState = Readonly<{
  activityId: C04ActivityId;
  scenarioId: C04ScenarioId;
  selectedChildId: C04ChildId | null;
}>;

/** D061/S1: evidence only; never an issued live model or derived answer. */
export type C04PersistedModelV1 = Readonly<{
  activityId: "C04-A02";
  scenarioId: "C04-S02";
  selectedChildId: C04ChildId;
}>;

export type C04ModelIntent = Readonly<{
  type: "SELECT_CHILD";
  childId: C04ChildId;
}>;

export type C04ModelSnapshot = Readonly<{
  state: C04ModelState;
  original: C04ModelCase["original"];
  newValue: C04ModelCase["newValue"];
  change: C04Change;
}>;

// Issuance binds each working state to a private, defensive copy of its definition.
const definitions = new WeakMap<C04ModelState, C04ModelDefinition>();

function record(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor;
    })
  );
}

function fact(
  value: unknown,
  role: "Original" | "New",
): C04ModelCase["original"] {
  if (
    !record(value, ["role", "value"]) ||
    typeof value.role !== "string" ||
    !value.role.includes(role) ||
    value.role.trim() !== value.role ||
    !record(value.value, ["magnitude", "kind", "unit", "basis"]) ||
    !isQuantity(value.value) ||
    !Object.isFrozen(value.value.magnitude)
  ) {
    throw new TypeError(`Invalid C04 ${role} fact`);
  }
  const source = value.value;
  if (
    source.kind !== "MONETARY_AMOUNT" ||
    source.unit !== "PHP" ||
    source.basis !== "per month"
  ) {
    throw new TypeError(
      "C04 requires established monthly PHP monetary amounts",
    );
  }
  return Object.freeze({
    role: value.role,
    value: quantity(source.magnitude, source.kind, source.unit, source.basis),
  });
}

function copyCase(value: unknown, childId: C04ChildId | null): C04ModelCase {
  if (
    !record(value, ["childId", "original", "newValue"]) ||
    value.childId !== childId
  ) {
    throw new TypeError("Invalid C04 case identity");
  }
  const original = fact(value.original, "Original");
  const newValue = fact(value.newValue, "New");
  if (
    childId !== null &&
    (!original.role.includes(childId) || !newValue.role.includes(childId))
  ) {
    throw new TypeError("C04 child fact roles must identify the selected case");
  }
  // Math is the sole authority for comparability, nonnegativity and the result.
  calculateC04Change(original.value, newValue.value);
  return Object.freeze({ childId, original, newValue });
}

function copyDefinition(input: unknown): C04ModelDefinition {
  if (
    !record(input, ["activityId", "scenarioId", "cases"]) ||
    !Array.isArray(input.cases)
  ) {
    throw new TypeError("Invalid C04 definition");
  }
  const pairs = {
    "C04-A01": "C04-S01",
    "C04-A02": "C04-S02",
    "C04-A03": "C04-S03",
    "C04-A04": "C04-S04",
  } as const;
  if (
    !(
      typeof input.activityId === "string" &&
      Object.prototype.hasOwnProperty.call(pairs, input.activityId)
    ) ||
    input.scenarioId !== pairs[input.activityId as C04ActivityId]
  ) {
    throw new TypeError("Unknown C04 activity/scenario binding");
  }
  const activityId = input.activityId as C04ActivityId;
  const scenarioId = input.scenarioId as C04ScenarioId;
  const expected: readonly (C04ChildId | null)[] =
    activityId === "C04-A02" ? ["C04-S02-A", "C04-S02-B"] : [null];
  if (
    input.cases.length !== expected.length ||
    Reflect.ownKeys(input.cases).length !== expected.length + 1
  ) {
    throw new TypeError("Invalid C04 case inventory");
  }
  const suppliedCases: readonly unknown[] = input.cases;
  const cases = Object.freeze(
    expected.map((id, index) => copyCase(suppliedCases[index], id)),
  );
  const changes = cases.map((item) =>
    calculateC04Change(item.original.value, item.newValue.value),
  );
  const zero = ExactDecimal.from("0");
  if (
    (activityId === "C04-A01" &&
      (changes[0]?.direction !== "NO_CHANGE" ||
        changes[0]?.percentageChange.resolution.kind !== "KNOWN")) ||
    (activityId === "C04-A03" &&
      (changes[0]?.direction !== "DECREASE" ||
        changes[0]?.percentageChange.resolution.kind !== "KNOWN")) ||
    (activityId === "C04-A04" &&
      (!cases[0]!.original.value.magnitude.equals(zero) ||
        changes[0]?.difference.resolution.kind !== "KNOWN" ||
        changes[0]?.percentageChange.resolution.kind !== "UNDEFINED" ||
        changes[0]?.percentageChange.availability !== "WITHHELD" ||
        changes[0]?.direction !== "INCREASE")) ||
    (activityId === "C04-A02" &&
      (changes.some((change) => change.direction !== "INCREASE") ||
        changes.some(
          (change) => change.percentageChange.resolution.kind !== "KNOWN",
        ) ||
        changes[0]?.difference.resolution.kind !== "KNOWN" ||
        changes[1]?.difference.resolution.kind !== "KNOWN" ||
        !changes[0].difference.resolution.value.magnitude.equals(
          changes[1].difference.resolution.value.magnitude,
        ) ||
        cases[0]!.original.value.magnitude.equals(
          cases[1]!.original.value.magnitude,
        )))
  )
    throw new TypeError("Invalid C04 scenario semantics");
  return Object.freeze({ activityId, scenarioId, cases });
}

function issue(
  definition: C04ModelDefinition,
  childId: C04ChildId | null,
): C04ModelState {
  if (!definition.cases.some((item) => item.childId === childId)) {
    throw new TypeError("Unauthorized C04 child selection");
  }
  const state = Object.freeze({
    activityId: definition.activityId,
    scenarioId: definition.scenarioId,
    selectedChildId: childId,
  });
  definitions.set(state, definition);
  return state;
}

/** Caller must establish canonical study provenance before passing the definition. */
export function createC04ModelState(
  definition: C04ModelDefinition,
): C04ModelState {
  const copy = copyDefinition(definition);
  return issue(copy, copy.cases[0]!.childId);
}

function requireState(value: unknown): {
  state: C04ModelState;
  definition: C04ModelDefinition;
} {
  if (
    value === null ||
    typeof value !== "object" ||
    !definitions.has(value as C04ModelState)
  ) {
    throw new TypeError("Unissued C04 model state");
  }
  const state = value as C04ModelState;
  const definition = definitions.get(state)!;
  if (
    !Object.isFrozen(state) ||
    !record(state, ["activityId", "scenarioId", "selectedChildId"]) ||
    state.activityId !== definition.activityId ||
    state.scenarioId !== definition.scenarioId ||
    !definition.cases.some((item) => item.childId === state.selectedChildId)
  ) {
    throw new TypeError("Corrupted C04 model state");
  }
  return { state, definition };
}

function checkpointAuthority(input: C04ModelDefinition): C04ModelDefinition {
  const definition = copyDefinition(input);
  if (
    definition.activityId !== "C04-A02" ||
    definition.scenarioId !== "C04-S02"
  )
    throw new TypeError("Unsupported C04 checkpoint model authority");
  return definition;
}

/** Trusted composition authenticates source membership before supplying authority.
 * Parsing validates evidence only and deliberately does not call issue(). */
export function validateC04PersistedModelV1(
  value: unknown,
  authority: C04ModelDefinition,
): C04PersistedModelV1 {
  const definition = checkpointAuthority(authority);
  if (
    !record(value, ["activityId", "scenarioId", "selectedChildId"]) ||
    !Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) => descriptor.enumerable,
    ) ||
    value.activityId !== definition.activityId ||
    value.scenarioId !== definition.scenarioId ||
    (value.selectedChildId !== "C04-S02-A" &&
      value.selectedChildId !== "C04-S02-B") ||
    !definition.cases.some((item) => item.childId === value.selectedChildId)
  )
    throw new TypeError("Invalid C04 persisted model evidence");
  return Object.freeze({
    activityId: "C04-A02",
    scenarioId: "C04-S02",
    selectedChildId: value.selectedChildId,
  });
}

/** Read-only live projection verifies domain issuance AND the supplied source.
 * It never selects, reissues, restores, or exposes the private definition. */
export function projectC04PersistedModelV1(
  value: unknown,
  authority: C04ModelDefinition,
): C04PersistedModelV1 {
  const source = checkpointAuthority(authority);
  const { state, definition } = requireState(value);
  if (
    definition.activityId !== source.activityId ||
    definition.scenarioId !== source.scenarioId ||
    definition.cases.length !== source.cases.length ||
    definition.cases.some((item, index) => {
      const expected = source.cases[index]!;
      return (
        item.childId !== expected.childId ||
        (["original", "newValue"] as const).some(
          (role) =>
            item[role].role !== expected[role].role ||
            !item[role].value.magnitude.equals(
              expected[role].value.magnitude,
            ) ||
            item[role].value.kind !== expected[role].value.kind ||
            item[role].value.unit !== expected[role].value.unit ||
            item[role].value.basis !== expected[role].value.basis,
        )
      );
    })
  )
    throw new TypeError("C04 live model source mismatch");
  return validateC04PersistedModelV1(state, source);
}

/** A selection changes the entire approved case, never a numeric field. */
export function applyC04ModelIntent(
  state: C04ModelState,
  intent: C04ModelIntent,
): C04ModelState {
  const { definition } = requireState(state);
  if (
    !record(intent, ["type", "childId"]) ||
    intent.type !== "SELECT_CHILD" ||
    definition.activityId !== "C04-A02" ||
    (intent.childId !== "C04-S02-A" && intent.childId !== "C04-S02-B")
  ) {
    throw new TypeError("Unauthorized C04 model intent");
  }
  return issue(definition, intent.childId);
}

/** Internal derived data is not authorization to reveal an instructional answer. */
export function deriveC04ModelState(state: C04ModelState): C04ModelSnapshot {
  const { state: current, definition } = requireState(state);
  const selected = definition.cases.find(
    (item) => item.childId === current.selectedChildId,
  )!;
  return Object.freeze({
    state: current,
    original: selected.original,
    newValue: selected.newValue,
    change: calculateC04Change(
      selected.original.value,
      selected.newValue.value,
    ),
  });
}
