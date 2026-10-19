import { createActor } from "xstate";
import { createActivityMachine } from "../activity-machine/public";
import {
  abandonC02ReferenceRecovery,
  c02WorkingStateValid,
  c02DeliveryFor,
  createC02ReferenceMachine,
  inspectC02ReferenceRecovery,
} from "../activity-machine/public";
import type { ActivityRestoration } from "../activity-machine/public";
import type { C02ReferenceInitialization } from "../activity-machine/public";
import { ActivityRegistry } from "../registry/public";
import { ExactDecimal, isLearnerResponse } from "../../core/public";
import type { LearnerResponse } from "../../core/public";
import {
  c02Activities,
  c02Catalog,
  c02Competency,
  c02Copy,
  c02PhilHealthFloor,
  c02Scenarios,
  validateC02Local,
} from "@/study/competencies/c02/public";

/** Each call returns a new unstarted actor. The authorized caller owns start/stop. */
export function createActivityActor(
  registry: ActivityRegistry,
  id: unknown,
  restoration?: ActivityRestoration,
) {
  if (!(registry instanceof ActivityRegistry))
    throw new TypeError("Invalid activity registry");
  const binding = registry.resolve(id);
  return createActor(
    createActivityMachine(
      binding.definition,
      binding.ports,
      binding.modelAdapter,
      restoration,
      binding.intentAdapter,
    ),
  );
}

export type ActivityActor = ReturnType<typeof createActivityActor>;

const referenceActors = new WeakMap<
  ActivityActor,
  ReturnType<typeof createC02ReferenceMachine>
>();
const referenceRoles = [
  "gross",
  "SSS",
  "PhilHealth",
  "Pag-IBIG",
  "withholding",
  "total deductions",
  "net pay",
] as const;

/** Current canonical Study facts, not Registry/caller/checkpoint provenance. */
function authenticateC02ReferenceSource(): readonly string[] {
  validateC02Local(
    c02Competency,
    c02Activities,
    c02Scenarios,
    c02PhilHealthFloor,
    c02Copy,
  );
  const anna = c02Scenarios.find((scenario) => scenario.id === "C02-S01");
  const activity = c02Activities.find((item) => item.id === "C02-A01");
  if (
    !anna ||
    !activity ||
    anna.activityId !== "C02-A01" ||
    anna.competencyId !== "C02" ||
    c02Catalog.activities.get("C02-A01") !== activity ||
    activity.instructionalFamily !== "Prepare" ||
    activity.modelBinding?.profileId !==
      "Payslip-Inspired Instructional Payroll Ledger" ||
    activity.modelBinding.interactionProfileId !==
      "Static semantic + embedded floor state" ||
    activity.responseContract.contractId !==
      "C02 statutory payroll response semantics (task-local reference)" ||
    c02PhilHealthFloor.id !== "C02-S01-F"
  )
    throw new TypeError("Invalid canonical C02 reference identity");
  const keys = [
    "established monthly gross income",
    "SSS employee share",
    "PhilHealth employee share",
    "Pag-IBIG employee share",
    "BIR withholding tax",
  ];
  const amounts = keys.map((key, i) => {
    const matches = anna.facts.filter((fact) => fact.key === key);
    const resolution = matches[0]?.resolution;
    if (
      matches.length !== 1 ||
      !resolution ||
      resolution.kind !== "KNOWN" ||
      resolution.value.kind !== "MONETARY_AMOUNT" ||
      resolution.value.unit !== "PHP" ||
      resolution.value.basis !== null ||
      !resolution.value.magnitude.equals(
        ExactDecimal.from(["12100", "600", "302.5", "200", "0"][i]!),
      )
    )
      throw new TypeError("Invalid canonical C02 payroll fact");
    return resolution.value.magnitude;
  });
  const total = amounts
    .slice(1)
    .reduce((sum, amount) => sum.add(amount), ExactDecimal.from("0"));
  const net = amounts[0]!.subtract(total);
  if (
    !total.equals(ExactDecimal.from("1102.5")) ||
    !net.equals(ExactDecimal.from("10997.5")) ||
    !c02PhilHealthFloor.basicSalary.magnitude.equals(
      ExactDecimal.from("8000"),
    ) ||
    !c02PhilHealthFloor.minimumContributionBasis.magnitude.equals(
      ExactDecimal.from("10000"),
    )
  )
    throw new TypeError("Invalid canonical C02 derived facts");
  return Object.freeze(
    [...amounts, total, net].map((amount) => amount.toString()),
  );
}

/** Independent S8 classifier. Admissible wrong exact quantities remain wrong answers. */
export function evaluateC02ReferenceResponse(response: LearnerResponse) {
  const expected = authenticateC02ReferenceSource();
  if (
    !isLearnerResponse(response) ||
    response.kind !== "COMPOSITE" ||
    response.parts.length !== 7 ||
    new Set(response.parts.map((part) => part.key)).size !== 7 ||
    response.parts.some(
      (part) =>
        !referenceRoles.some((key) => key === part.key) ||
        part.response.kind !== "EXACT_QUANTITY" ||
        part.response.value.kind !== "MONETARY_AMOUNT" ||
        part.response.value.unit !== "PHP" ||
        part.response.value.basis !== null,
    )
  )
    throw new TypeError("Invalid C02 reference monetary roles");
  const wrong = referenceRoles.map((key, i) => {
    const answer = response.parts.find((part) => part.key === key)!.response;
    return (
      answer.kind !== "EXACT_QUANTITY" ||
      !answer.value.magnitude.equals(ExactDecimal.from(expected[i]!))
    );
  });
  const diagnostic = wrong.slice(0, 5).some(Boolean)
    ? "c02/S01/reconsider-payroll-role"
    : wrong.slice(5).some(Boolean)
      ? "c02/S01/reconsider-arithmetic"
      : null;
  return Object.freeze({
    outcome:
      diagnostic === null
        ? ("CONFIRMED" as const)
        : ("RECONSIDERATION" as const),
    diagnostic,
  });
}

/** Opt-in headless reference, not a production C02 Registry binding or Session route. */
export function createC02ReferenceActivityActor(
  initialization?: C02ReferenceInitialization,
): ActivityActor {
  const source = authenticateC02ReferenceSource();
  if (initialization !== undefined) inspectReferenceInput(initialization);
  if (
    initialization?.response !== null &&
    initialization?.response !== undefined
  ) {
    const expected = evaluateC02ReferenceResponse(initialization.response);
    if (
      initialization.evaluation !== null &&
      (initialization.evaluation.outcome !== expected.outcome ||
        initialization.evaluation.diagnostic !== expected.diagnostic)
    )
      throw new TypeError("C02 saved outcome disagrees with current Study");
  }
  const reference = createC02ReferenceMachine(source, initialization);
  const actor = reference.actor;
  try {
    if (
      !c02WorkingStateValid(actor.getSnapshot().context, reference.definition)
    )
      throw new TypeError("Invalid C02 reference actor");
    referenceActors.set(actor, reference);
    // XState stop() on an unstarted actor need not publish a stopped snapshot.
    // Explicit abandonment must nevertheless revoke Runtime issuance/custody.
    const stop = actor.stop.bind(actor);
    actor.stop = () => {
      referenceActors.delete(actor);
      return stop();
    };
    return actor;
  } catch (error) {
    actor.stop();
    throw error;
  }
}

function inspectReferenceInput(value: unknown, seen = new Set<object>()): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (value instanceof ExactDecimal) {
    ExactDecimal.prototype.toString.call(value);
    return;
  }
  if (
    typeof value !== "object" ||
    seen.has(value) ||
    Object.getPrototypeOf(value) !==
      (Array.isArray(value) ? Array.prototype : Object.prototype)
  )
    throw new TypeError("Unsafe C02 reference initialization");
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  if (
    Array.isArray(value) &&
    (keys.length !== value.length + 1 ||
      !Array.from({ length: value.length }, (_, i) =>
        Object.prototype.hasOwnProperty.call(value, i),
      ).every(Boolean))
  )
    throw new TypeError("Unsafe C02 reference array");
  for (const key of keys) {
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw new TypeError("Unsafe C02 reference property");
    inspectReferenceInput(descriptor.value, seen);
  }
  seen.delete(value);
}

/** Authenticated live issuance inspection for Recovery and headless presentation.
 * A copied actor/context or structurally registered binding cannot claim issuance.
 */
export function inspectC02ReferenceActivityActor(actor: ActivityActor) {
  const reference = referenceActors.get(actor);
  if (
    !reference ||
    actor.getSnapshot().status !== "active" ||
    !c02WorkingStateValid(actor.getSnapshot().context, reference.definition)
  )
    throw new TypeError("Unissued or inactive C02 reference actor");
  authenticateC02ReferenceSource();
  return Object.freeze({
    context: actor.getSnapshot().context,
    definition: reference.definition,
    ports: reference.ports,
    pending: inspectC02ReferenceRecovery(actor.getSnapshot().context),
    delivery: c02DeliveryFor(actor.getSnapshot().context, reference.definition),
  });
}

/** Explicit cancellation removes only provisional eligibility; no storage mutation. */
export function cancelC02ReferencePendingWork(actor: ActivityActor): void {
  const { context } = inspectC02ReferenceActivityActor(actor);
  abandonC02ReferenceRecovery(context);
}
