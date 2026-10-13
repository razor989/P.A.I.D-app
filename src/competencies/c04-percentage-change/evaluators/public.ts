import { isLearnerResponse } from "../../../core/public";
import type { LearnerResponse, Quantity } from "../../../core/public";
import { applyC04ModelIntent, deriveC04ModelState } from "../model/public";
import type { C04ModelState } from "../model/public";

type Field =
  | "original"
  | "new"
  | "difference"
  | "percentage"
  | "interpretation"
  | "originalA"
  | "originalB"
  | "differenceA"
  | "differenceB"
  | "percentageA"
  | "percentageB"
  | "comparison"
  | "explanation";
type Choice = Readonly<{
  key: "interpretation" | "comparison" | "explanation";
  options: readonly string[];
  correctId: string;
}>;

/** Trusted composition supplies source-owned options and chooses the actual response controls.
 * This contract validates structure and model mathematics, NOT study provenance or copy linkage.
 */
export type C04EvaluationDefinition = Readonly<{
  state: C04ModelState;
  fields: readonly Field[];
  choices: readonly Choice[];
}>;

export type C04Diagnostic =
  | "RECONSIDER_INTERPRETATION"
  | "RECONSIDER_DIRECTION"
  | "RECONSIDER_REPRESENTATION"
  | "RECONSIDER_UNDEFINED"
  | "RECONSIDER_QUANTITY";

export type C04Evaluation = Readonly<
  | { outcome: "CONFIRMED"; diagnostic: null }
  | { outcome: "RECONSIDERATION"; diagnostic: C04Diagnostic }
>;

type Atomic = Extract<
  LearnerResponse,
  {
    kind:
      | "SINGLE_SELECTION"
      | "MULTIPLE_SELECTIONS"
      | "EXACT_QUANTITY"
      | "SEMANTIC_BOUNDARY";
  }
>;
type Truth = Readonly<{ value: Quantity | null; undefined: boolean }>;

const keys: Readonly<Record<string, readonly Field[]>> = Object.freeze({
  "C04-A01": ["original", "new", "difference", "percentage", "interpretation"],
  "C04-A02": [
    "originalA",
    "originalB",
    "differenceA",
    "differenceB",
    "percentageA",
    "percentageB",
    "comparison",
  ],
  "C04-A03": ["original", "new", "difference", "percentage", "interpretation"],
  "C04-A04": ["difference", "percentage", "explanation"],
});

function plain(
  value: unknown,
  names: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === names.length &&
    names.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor;
    })
  );
}

function complete(fields: readonly Field[], activity: string): boolean {
  if (activity === "C04-A01")
    return ["original", "new", "difference", "interpretation"].every((k) =>
      fields.includes(k as Field),
    );
  if (activity === "C04-A02")
    return [
      "differenceA",
      "differenceB",
      "percentageA",
      "percentageB",
      "comparison",
    ].every((k) => fields.includes(k as Field));
  if (activity === "C04-A03")
    return keys[activity]!.every((k) => fields.includes(k));
  return (
    activity === "C04-A04" &&
    fields.length === 3 &&
    fields.includes("difference") &&
    fields.includes("percentage") &&
    fields.includes("explanation")
  );
}

function same(left: Quantity, right: Quantity): boolean {
  return (
    left.kind === right.kind &&
    left.unit === right.unit &&
    left.basis === right.basis &&
    left.magnitude.equals(right.magnitude)
  );
}

function known(value: Quantity): Truth {
  return { value, undefined: false };
}

/** No answer data is returned. A02 uses both issued child states, never a mixed pair. */
export function evaluateC04Response(
  definition: C04EvaluationDefinition,
  input: unknown,
): C04Evaluation {
  if (
    !plain(definition, ["state", "fields", "choices"]) ||
    !Array.isArray(definition.fields) ||
    !Array.isArray(definition.choices)
  )
    throw new TypeError("Invalid C04 evaluation definition");
  const view = deriveC04ModelState(definition.state); // rejects unissued/forged state
  const activity = view.state.activityId;
  const allowed = keys[activity];
  const fields: readonly unknown[] = definition.fields;
  if (
    !allowed ||
    !fields.length ||
    Reflect.ownKeys(fields).length !== fields.length + 1 ||
    fields.some(
      (key) => typeof key !== "string" || !allowed.includes(key as Field),
    ) ||
    new Set(fields).size !== fields.length ||
    !complete(definition.fields, activity)
  )
    throw new TypeError("Invalid C04 response fields");
  const choices: readonly unknown[] = definition.choices;
  if (Reflect.ownKeys(choices).length !== choices.length + 1)
    throw new TypeError("Invalid C04 choices");
  const choiceMap = new Map<string, Choice>();
  for (const choice of choices) {
    if (
      !plain(choice, ["key", "options", "correctId"]) ||
      (choice.key !== "interpretation" &&
        choice.key !== "comparison" &&
        choice.key !== "explanation") ||
      (choice.key === "explanation") !== (activity === "C04-A04") ||
      !definition.fields.includes(choice.key) ||
      choiceMap.has(choice.key) ||
      !Array.isArray(choice.options) ||
      choice.options.length < 2 ||
      Reflect.ownKeys(choice.options).length !== choice.options.length + 1 ||
      !choice.options.every(
        (id: unknown) =>
          typeof id === "string" && id.trim() === id && id.length > 0,
      ) ||
      new Set(choice.options).size !== choice.options.length ||
      !choice.options.includes(choice.correctId)
    )
      throw new TypeError("Invalid source-owned choice contract");
    choiceMap.set(choice.key, choice as Choice);
  }
  if (
    choiceMap.size !==
    definition.fields.filter(
      (key) =>
        key === "interpretation" ||
        key === "comparison" ||
        key === "explanation",
    ).length
  )
    throw new TypeError("Missing source-owned choice contract");

  const responseFields: readonly Field[] = definition.fields;

  const truth = new Map<Field, Truth>();
  const base = view.change;
  if (base.difference.resolution.kind !== "KNOWN")
    throw new TypeError("Invalid model difference");
  truth.set("original", known(view.original.value));
  truth.set("new", known(view.newValue.value));
  truth.set("difference", known(base.difference.resolution.value));
  if (base.percentageChange.resolution.kind === "KNOWN")
    truth.set("percentage", known(base.percentageChange.resolution.value));
  else if (
    base.percentageChange.resolution.kind === "UNDEFINED" &&
    base.percentageChange.availability === "WITHHELD"
  )
    truth.set("percentage", { value: null, undefined: true });
  else throw new TypeError("Invalid model percentage");
  // The frozen DomainResolution reason is domain metadata, not a graded prose
  // answer. Keep it aligned with the issued mathematical state; evaluate the
  // learner's explanation only through the injected source-owned choice.
  const undefinedReason =
    base.percentageChange.resolution.kind === "UNDEFINED"
      ? base.percentageChange.resolution.reason
      : null;
  if (activity === "C04-A02") {
    for (const [suffix, id] of [
      ["A", "C04-S02-A"],
      ["B", "C04-S02-B"],
    ] as const) {
      const selected = deriveC04ModelState(
        applyC04ModelIntent(definition.state, {
          type: "SELECT_CHILD",
          childId: id,
        }),
      );
      if (
        selected.change.difference.resolution.kind !== "KNOWN" ||
        selected.change.percentageChange.resolution.kind !== "KNOWN"
      )
        throw new TypeError("Invalid employee comparison");
      truth.set(`original${suffix}`, known(selected.original.value));
      truth.set(
        `difference${suffix}`,
        known(selected.change.difference.resolution.value),
      );
      truth.set(
        `percentage${suffix}`,
        known(selected.change.percentageChange.resolution.value),
      );
    }
  }

  if (!isLearnerResponse(input))
    throw new TypeError("Invalid learner response");
  if (input.kind === "MODEL_STATE" || input.kind === "MULTIPLE_SELECTIONS")
    throw new TypeError("Unauthorized C04 response structure");
  const parts: readonly Readonly<{ key: string; response: Atomic }>[] | null =
    input.kind === "COMPOSITE"
      ? input.parts
      : responseFields.length === 1
        ? [{ key: responseFields[0]!, response: input }]
        : null;
  if (
    !parts ||
    parts.length !== responseFields.length ||
    parts.some((part) => !responseFields.includes(part.key as Field))
  )
    throw new TypeError("Unauthorized C04 response structure");
  let diagnostic: C04Diagnostic | null = null;
  for (const field of responseFields) {
    const response = parts.find((part) => part.key === field)?.response;
    if (!response) throw new TypeError("Missing C04 response field");
    const choice = choiceMap.get(field);
    if (choice) {
      if (
        response.kind !== "SINGLE_SELECTION" ||
        !choice.options.includes(response.selectionId)
      )
        throw new TypeError("Unauthorized C04 selection");
      if (response.selectionId !== choice.correctId)
        diagnostic ??=
          field === "explanation"
            ? "RECONSIDER_UNDEFINED"
            : field === "comparison" || activity === "C04-A01"
              ? "RECONSIDER_INTERPRETATION"
              : "RECONSIDER_DIRECTION";
      continue;
    }
    const expected = truth.get(field);
    if (!expected) throw new TypeError("Missing C04 model truth");
    if (expected.undefined) {
      if (response.kind === "SEMANTIC_BOUNDARY") {
        if (
          response.resolution.kind !== "UNDEFINED" ||
          response.resolution.reason !== undefinedReason
        )
          diagnostic ??= "RECONSIDER_UNDEFINED";
      } else if (response.kind === "EXACT_QUANTITY")
        diagnostic ??= "RECONSIDER_UNDEFINED";
      else throw new TypeError("Unauthorized C04 response kind");
      continue;
    }
    if (response.kind === "SEMANTIC_BOUNDARY") {
      diagnostic ??= "RECONSIDER_INTERPRETATION";
    } else if (response.kind === "EXACT_QUANTITY") {
      const expectedValue = expected.value!;
      if (
        response.value.kind !== expectedValue.kind ||
        response.value.unit !== expectedValue.unit ||
        response.value.basis !== expectedValue.basis
      )
        diagnostic ??= "RECONSIDER_REPRESENTATION";
      else if (!same(response.value, expectedValue))
        // An incorrect percentage alone does not prove which denominator was used.
        diagnostic ??= "RECONSIDER_QUANTITY";
    } else throw new TypeError("Unauthorized C04 response kind");
  }
  return diagnostic === null
    ? Object.freeze({ outcome: "CONFIRMED", diagnostic: null })
    : Object.freeze({ outcome: "RECONSIDERATION", diagnostic });
}
