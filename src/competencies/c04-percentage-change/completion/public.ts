import type { C04Evaluation } from "../evaluators/public";

/** Runtime owns issuance and currency of these revision tokens; this guard only checks them. */
export type C04CompletionEvidence = Readonly<{
  activityId: "C04-A01" | "C04-A02" | "C04-A03" | "C04-A04";
  responseRevision: number;
  checkedRevision: number | null;
  feedbackRevision: number | null;
  evaluation: C04Evaluation | null;
}>;

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
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor;
    })
  );
}

/** Eligibility is not correctness; feedback must belong to the currently evaluated revision. */
export function c04CompletionEligible(input: C04CompletionEvidence): boolean {
  if (
    !record(input, [
      "activityId",
      "responseRevision",
      "checkedRevision",
      "feedbackRevision",
      "evaluation",
    ]) ||
    !["C04-A01", "C04-A02", "C04-A03", "C04-A04"].includes(input.activityId) ||
    !Number.isSafeInteger(input.responseRevision) ||
    input.responseRevision < 0 ||
    ![input.checkedRevision, input.feedbackRevision].every(
      (revision) =>
        revision === null ||
        (Number.isSafeInteger(revision) &&
          revision >= 0 &&
          revision <= input.responseRevision),
    )
  )
    throw new TypeError("Invalid C04 completion evidence");
  if (
    input.evaluation !== null &&
    (!record(input.evaluation, ["outcome", "diagnostic"]) ||
      !(
        (input.evaluation.outcome === "CONFIRMED" &&
          input.evaluation.diagnostic === null) ||
        (input.evaluation.outcome === "RECONSIDERATION" &&
          [
            "RECONSIDER_INTERPRETATION",
            "RECONSIDER_DIRECTION",
            "RECONSIDER_REPRESENTATION",
            "RECONSIDER_UNDEFINED",
            "RECONSIDER_QUANTITY",
          ].includes(input.evaluation.diagnostic))
      ))
  )
    throw new TypeError("Invalid C04 evaluation evidence");
  if (
    (input.checkedRevision === null) !== (input.evaluation === null) ||
    (input.feedbackRevision !== null &&
      (input.checkedRevision === null ||
        input.feedbackRevision > input.checkedRevision))
  )
    throw new TypeError("Inconsistent C04 check/feedback evidence");
  return (
    input.checkedRevision === input.responseRevision &&
    input.feedbackRevision === input.responseRevision &&
    input.evaluation !== null
  );
}
