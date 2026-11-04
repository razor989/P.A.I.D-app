import { ExactDecimal, isLearnerResponse, isProviderRead } from "@/core/public";
import type {
  LearnerResponse,
  ProviderProvenance,
  Quantity,
} from "@/core/public";
import { applyC03ModelIntent, deriveC03ModelState } from "../model/public";
import type { C03ModelState } from "../model/public";

/** Study-owned membership supplied by authenticated Engine composition. */
export type C03DiagnosticMembership = Readonly<
  Record<
    "expectation" | "investigation",
    Readonly<{ options: readonly Readonly<{ id: string }>[] }>
  >
>;

export type C03ResponseField =
  | "expectation"
  | "investigation"
  | "condition"
  | "multiplier"
  | "overtimePay"
  | "invariants"
  | "changes"
  | "multiplierA"
  | "multiplierB"
  | "difference";
export type C03Evaluation = Readonly<{
  outcome: "CONFIRMED" | "RECONSIDERATION";
  diagnostic:
    | "WORK_CONDITION"
    | "CONDITION_MULTIPLIER"
    | "ARITHMETIC"
    | "UNITS"
    | "INVARIANTS"
    | "SCOPE"
    | null;
}>;
export const c03ResponseFields = Object.freeze({
  "C03-A01": Object.freeze(["expectation", "investigation"] as const),
  "C03-A02": Object.freeze([
    "invariants",
    "changes",
    "multiplierA",
    "multiplierB",
    "difference",
  ] as const),
  "C03-A03": Object.freeze(["multiplier", "overtimePay"] as const),
  "C03-A04": Object.freeze(["condition", "multiplier", "overtimePay"] as const),
});
export const c03ConditionOptions = Object.freeze([
  "ordinary working day",
  "rest day",
  "regular holiday",
]);

function data(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (value instanceof ExactDecimal) {
    try {
      ExactDecimal.prototype.toString.call(value);
      return true;
    } catch {
      return false;
    }
  }
  if (
    !value ||
    typeof value !== "object" ||
    seen.has(value) ||
    Object.getPrototypeOf(value) !==
      (Array.isArray(value) ? Array.prototype : Object.prototype)
  )
    return false;
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  const valid =
    (!Array.isArray(value) || keys.length === value.length + 1) &&
    keys.every((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return (
        typeof key === "string" &&
        !!d &&
        "value" in d &&
        (key === "length" || d.enumerable) &&
        (key === "length" || data(d.value, seen))
      );
    });
  seen.delete(value);
  return valid;
}

/** Structure and option membership only: valid wrong answers remain checkable.
 * Trusted Engine composition authenticates the supplied issued model's Study origin.
 */
export function c03ResponseReady(
  state: C03ModelState,
  input: unknown,
  diagnostic?: C03DiagnosticMembership,
): input is Extract<LearnerResponse, { kind: "COMPOSITE" }> {
  const view = deriveC03ModelState(state);
  if (!data(input) || !isLearnerResponse(input) || input.kind !== "COMPOSITE")
    return false;
  const fields: readonly string[] = c03ResponseFields[view.state.activityId];
  if (
    input.parts.length !== fields.length ||
    !fields.every((key) => input.parts.some((p) => p.key === key))
  )
    return false;
  return input.parts.every(({ key, response: r }) => {
    if (view.state.activityId === "C03-A01")
      return (
        diagnostic !== undefined &&
        (key === "expectation" || key === "investigation") &&
        r.kind === "SINGLE_SELECTION" &&
        diagnostic[key].options.some((option) => option.id === r.selectionId)
      );
    if (key === "condition")
      return (
        r.kind === "SINGLE_SELECTION" &&
        c03ConditionOptions.includes(r.selectionId)
      );
    if (key === "invariants" || key === "changes") {
      const options = [
        "rate + hours",
        "condition + multiplier + overtimePay",
        "rate + multiplier",
      ];
      return r.kind === "SINGLE_SELECTION" && options.includes(r.selectionId);
    }
    // Units are meaningful submitted evidence and get a units diagnosis, not a
    // speculative condition diagnosis. Unknown/missing quantities are not zero.
    return r.kind === "EXACT_QUANTITY";
  });
}

export function evaluateC03Response(
  state: C03ModelState,
  input: unknown,
  diagnostic?: C03DiagnosticMembership,
): C03Evaluation {
  if (!c03ResponseReady(state, input, diagnostic))
    throw new TypeError("Invalid or incomplete C03 response");
  if (state.activityId === "C03-A01")
    return Object.freeze({ outcome: "CONFIRMED", diagnostic: null });
  return evaluateParts(state, input);
}

/** A02 advisory field check. Validates only real submitted evidence; never fills
 * absent answers or grants final completion. Shares the final evaluation oracle. */
export function evaluateC03ComparisonPart(
  state: C03ModelState,
  input: unknown,
  field: string,
): C03Evaluation {
  if (
    state.activityId !== "C03-A02" ||
    !c03ResponseFields["C03-A02"].some((key) => key === field) ||
    !data(input) ||
    !isLearnerResponse(input) ||
    input.kind !== "COMPOSITE"
  )
    throw new TypeError("Invalid A02 field check");
  const matches = input.parts.filter((part) => part.key === field);
  if (
    matches.length !== 1 ||
    new Set(input.parts.map((part) => part.key)).size !== input.parts.length
  )
    throw new TypeError("Missing or duplicate A02 evidence");
  const response = matches[0]!.response;
  if (field === "invariants" || field === "changes") {
    if (
      response.kind !== "SINGLE_SELECTION" ||
      ![
        "rate + hours",
        "condition + multiplier + overtimePay",
        "rate + multiplier",
      ].includes(response.selectionId)
    )
      throw new TypeError("Invalid A02 selection");
  } else if (response.kind !== "EXACT_QUANTITY")
    throw new TypeError("Invalid A02 quantity");
  return evaluateParts(state, { kind: "COMPOSITE", parts: matches });
}

function evaluateParts(
  state: C03ModelState,
  input: Extract<LearnerResponse, { kind: "COMPOSITE" }>,
): C03Evaluation {
  const view = deriveC03ModelState(state);
  const wrong = (
    diagnostic: NonNullable<C03Evaluation["diagnostic"]>,
  ): C03Evaluation => Object.freeze({ outcome: "RECONSIDERATION", diagnostic });
  for (const { key, response } of input.parts) {
    if (response.kind === "SINGLE_SELECTION") {
      const expected =
        key === "condition"
          ? view.condition
          : key === "invariants"
            ? "rate + hours"
            : "condition + multiplier + overtimePay";
      if (response.selectionId !== expected)
        return wrong(
          key === "condition"
            ? "WORK_CONDITION"
            : key === "invariants"
              ? "INVARIANTS"
              : "SCOPE",
        );
    } else if (response.kind === "EXACT_QUANTITY") {
      let expected: Quantity;
      if (
        key === "difference" ||
        key === "multiplierA" ||
        key === "multiplierB"
      ) {
        const a = deriveC03ModelState(
          applyC03ModelIntent(state, {
            type: "SELECT_CHILD",
            childId: "C03-S02-A",
          }),
        );
        const b = deriveC03ModelState(
          applyC03ModelIntent(state, {
            type: "SELECT_CHILD",
            childId: "C03-S02-B",
          }),
        );
        if (key === "difference") {
          if (
            a.overtimePay.resolution.kind !== "KNOWN" ||
            b.overtimePay.resolution.kind !== "KNOWN"
          )
            throw new TypeError("Unresolved trusted C03 model");
          expected = {
            ...a.overtimePay.resolution.value,
            magnitude: b.overtimePay.resolution.value.magnitude.subtract(
              a.overtimePay.resolution.value.magnitude,
            ),
          };
        } else expected = key === "multiplierA" ? a.multiplier : b.multiplier;
      } else if (key === "multiplier") expected = view.multiplier;
      else {
        if (view.overtimePay.resolution.kind !== "KNOWN")
          throw new TypeError("Unresolved trusted C03 model");
        expected = view.overtimePay.resolution.value;
      }
      if (
        response.value.kind !== expected.kind ||
        response.value.unit !== expected.unit ||
        response.value.basis !== expected.basis
      )
        return wrong("UNITS");
      if (!response.value.magnitude.equals(expected.magnitude))
        return wrong(
          key.startsWith("multiplier") ? "CONDITION_MULTIPLIER" : "ARITHMETIC",
        );
    }
  }
  return Object.freeze({ outcome: "CONFIRMED", diagnostic: null });
}

/** Source-owned output computation colocated with the evaluation oracle. Engine
 * must authenticate canonical James membership before issuing consumer capability.
 * No completion prerequisite or learner-facing exposure permission is implied.
 */
export function deriveC03ProviderOutput(state: C03ModelState) {
  const view = deriveC03ModelState(state);
  if (state.activityId !== "C03-A03" || state.scenarioId !== "C03-S03")
    throw new TypeError("Unsupported C03 provider source");
  const provenance: ProviderProvenance = Object.freeze({
    providerCompetencyId: "C03",
    consumerCompetencyId: "C01",
    sourceOutputKey: "overtime-pay value",
    sourceRecordId: "C03-S03",
    relevantCondition: view.condition,
  });
  const output = Object.freeze({
    kind: "ESTABLISHED" as const,
    provenance,
    result: view.overtimePay,
  });
  if (!isProviderRead(output))
    throw new TypeError("Invalid C03 provider output");
  return output;
}
