import {
  ExactDecimal,
  isLearnerResponse,
  isProviderRead,
  quantity,
} from "@/core/public";
import type {
  LearnerResponse,
  ProviderProvenance,
  Quantity,
} from "@/core/public";
import { applyC06ModelIntent, deriveC06ModelState } from "../model/public";
import type { C06ModelState } from "../model/public";

export type C06Evaluation = Readonly<{
  outcome: "CONFIRMED" | "RECONSIDERATION";
  diagnostic:
    | "ARRANGEMENT"
    | "NOT_APPLICABLE"
    | "INVARIANTS"
    | "SALES_BASE"
    | "RATE"
    | "UNITS"
    | "COMMISSION"
    | "TOTAL_COMPENSATION"
    | null;
}>;

/** Semantic evidence roles, not a renderer or an authorization to reveal answers.
 * Canonical source membership is authenticated by the future Engine issuer.
 */
export const c06ResponseFields = Object.freeze({
  "C06-A01": Object.freeze([
    "arrangementA",
    "baseA",
    "arrangementB",
    "baseB",
  ] as const),
  "C06-A02": Object.freeze([
    "rate",
    "base",
    "commissionA",
    "totalA",
    "commissionB",
    "totalB",
  ] as const),
  "C06-A03": Object.freeze(["sales", "rate", "commission"] as const),
  "C06-A04": Object.freeze(["arrangement", "commission", "total"] as const),
});

/** Reject accessors/prototype payloads before the shared structural validator can
 * read them. ExactDecimal storage is authenticated, not merely instanceof.
 */
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
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        typeof key === "string" &&
        !!descriptor &&
        "value" in descriptor &&
        (key === "length" || descriptor.enumerable) &&
        (key === "length" || data(descriptor.value, seen))
      );
    });
  seen.delete(value);
  return valid;
}

/** Complete valid wrong answers remain checkable. A numeric zero base is valid
 * submitted evidence for reconsideration, never silently converted into N/A.
 */
export function c06ResponseReady(
  state: C06ModelState,
  input: unknown,
): input is Extract<LearnerResponse, { kind: "COMPOSITE" }> {
  deriveC06ModelState(state);
  if (!data(input) || !isLearnerResponse(input) || input.kind !== "COMPOSITE")
    return false;
  const fields: readonly string[] = c06ResponseFields[state.activityId];
  if (
    input.parts.length !== fields.length ||
    !fields.every((key) => input.parts.some((part) => part.key === key))
  )
    return false;
  return input.parts.every(({ key, response }) => {
    if (key.startsWith("arrangement"))
      return (
        response.kind === "SINGLE_SELECTION" &&
        ["STRAIGHT_COMMISSION", "BASE_PLUS_COMMISSION"].includes(
          response.selectionId,
        )
      );
    if (key === "baseA" || key === "baseB")
      return (
        response.kind === "EXACT_QUANTITY" ||
        (response.kind === "SEMANTIC_BOUNDARY" &&
          response.resolution.kind === "NOT_APPLICABLE")
      );
    return response.kind === "EXACT_QUANTITY";
  });
}

type View = ReturnType<typeof deriveC06ModelState>;
function knownInput(value: View["sales"]): Quantity {
  if (value.kind !== "KNOWN")
    throw new TypeError("Unresolved C06 evaluation input");
  return value.value;
}
function amount(view: View, role: "base" | "commission" | "total"): Quantity {
  const resolution =
    role === "commission"
      ? view.commission.resolution
      : view.arrangement !== "BASE_PLUS_COMMISSION"
        ? null
        : role === "base"
          ? view.baseSalary
          : view.totalCompensation.resolution;
  if (resolution?.kind !== "KNOWN")
    throw new TypeError("Unresolved C06 evaluation source");
  return resolution.value;
}

export function evaluateC06Response(
  state: C06ModelState,
  input: unknown,
): C06Evaluation {
  if (!c06ResponseReady(state, input))
    throw new TypeError("Invalid or incomplete C06 response");
  const view = deriveC06ModelState(state);
  const wrong = (
    diagnostic: NonNullable<C06Evaluation["diagnostic"]>,
  ): C06Evaluation => Object.freeze({ outcome: "RECONSIDERATION", diagnostic });
  // Source-defined field order makes diagnoses independent of payload ordering.
  for (const key of c06ResponseFields[state.activityId]) {
    const response = input.parts.find((part) => part.key === key)!.response;
    if (key.startsWith("arrangement")) {
      const expected =
        key === "arrangementA" ? "STRAIGHT_COMMISSION" : "BASE_PLUS_COMMISSION";
      if (
        response.kind !== "SINGLE_SELECTION" ||
        response.selectionId !== expected
      )
        return wrong("ARRANGEMENT");
      continue;
    }
    if (key === "baseA") {
      if (
        response.kind !== "SEMANTIC_BOUNDARY" ||
        response.resolution.kind !== "NOT_APPLICABLE"
      )
        return wrong("NOT_APPLICABLE");
      continue;
    }
    if (response.kind !== "EXACT_QUANTITY") return wrong("ARRANGEMENT");
    let selected = view;
    if (state.activityId === "C06-A01" || state.activityId === "C06-A02") {
      const childId =
        state.activityId === "C06-A01"
          ? "C06-S01-B"
          : key.endsWith("B")
            ? "C06-S02-B"
            : "C06-S02-A";
      selected = deriveC06ModelState(
        applyC06ModelIntent(state, { type: "SELECT_CHILD", childId }),
      );
    }
    const expected =
      key === "sales"
        ? knownInput(selected.sales)
        : key === "rate"
          ? knownInput(selected.commissionRate)
          : amount(
              selected,
              key.startsWith("base")
                ? "base"
                : key.startsWith("total")
                  ? "total"
                  : "commission",
            );
    if (
      response.value.kind !== expected.kind ||
      response.value.unit !== expected.unit ||
      response.value.basis !== expected.basis
    )
      return wrong("UNITS");
    if (!response.value.magnitude.equals(expected.magnitude))
      return wrong(
        state.activityId === "C06-A02" && (key === "rate" || key === "base")
          ? "INVARIANTS"
          : key === "sales"
            ? "SALES_BASE"
            : key === "rate"
              ? "RATE"
              : key.startsWith("total")
                ? "TOTAL_COMPENSATION"
                : key.startsWith("base")
                  ? "ARRANGEMENT"
                  : "COMMISSION",
      );
  }
  return Object.freeze({ outcome: "CONFIRMED", diagnostic: null });
}

/** Source-owned computation, not canonical provenance attestation. Engine must
 * authenticate Lina's fixed source before exposing this consumer capability.
 * No output selector exists: Total Compensation cannot be requested here.
 */
export function deriveC06ProviderOutput(state: C06ModelState) {
  const view = deriveC06ModelState(state);
  if (state.activityId !== "C06-A04" || state.scenarioId !== "C06-S04")
    throw new TypeError("Unsupported C06 provider source");
  const provenance = Object.freeze({
    providerCompetencyId: "C06",
    consumerCompetencyId: "C01",
    sourceRecordId: "C06-S04",
    sourceOutputKey: "commission amount",
    relevantCondition: "Lina's established June commission",
  } satisfies ProviderProvenance);
  const output = Object.freeze({
    kind: "ESTABLISHED" as const,
    provenance,
    // The approved provider is an established amount, not a monthly/June rate.
    // Keep June in provenance; do not mutate the source model's quantity basis.
    result: Object.freeze({
      availability: "AVAILABLE" as const,
      resolution: Object.freeze({
        kind: "KNOWN" as const,
        value: quantity(
          amount(view, "commission").magnitude,
          "MONETARY_AMOUNT",
          "PHP",
          null,
        ),
      }),
    }),
  });
  if (!isProviderRead(output))
    throw new TypeError("Invalid C06 provider output");
  return output;
}
