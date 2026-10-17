import { ExactDecimal, isLearnerResponse } from "../../core/public";
import type { LearnerResponse } from "../../core/public";
import {
  c04Activities,
  c04Boundary,
  c04Competency,
  c04Copy,
  c04ResponseContracts,
  c04Scenarios,
  validateC04Local,
  validateC04ResponseContracts,
} from "../../study/competencies/c04/public";
import type { C04ResponseContract } from "../../study/competencies/c04/public";
import {
  applyC04ModelIntent,
  createC04ModelState,
  deriveC04ModelState,
  projectC04PersistedModelV1,
  validateC04PersistedModelV1,
} from "../../competencies/c04-percentage-change/model/public";
import type {
  C04ModelDefinition,
  C04ModelSnapshot,
  C04ModelState,
  C04PersistedModelV1,
} from "../../competencies/c04-percentage-change/model/public";
import { evaluateC04Response } from "../../competencies/c04-percentage-change/evaluators/public";
import type {
  C04Evaluation,
  C04EvaluationDefinition,
} from "../../competencies/c04-percentage-change/evaluators/public";
import { c04CompletionEligible } from "../../competencies/c04-percentage-change/completion/public";
import type {
  ActivityDefinition,
  ActivityModelAdapter,
  ActivityPorts,
  Position,
  PrimaryField,
  SupportPhase,
} from "../activity-machine/public";
import { createActivityActor } from "../activity-runtime/public";
import type { ActivityActor } from "../activity-runtime/public";
import { ActivityRegistry } from "../registry/public";
import type { ExecutableActivityBinding } from "../registry/public";
import { projectSemanticActivityFrame } from "../semantic-frame/public";
import type {
  ChoiceExposure,
  Exposure,
  SemanticActivityFrame,
} from "../semantic-frame/public";
import type { SafeText } from "../review/public";

export type C04BindingActivityId = C04ModelDefinition["activityId"];
type Source = Readonly<{
  competency: typeof c04Competency;
  activities: typeof c04Activities;
  scenarios: typeof c04Scenarios;
  boundary: typeof c04Boundary;
  copy: Readonly<Record<string, string>>;
  contracts: readonly C04ResponseContract[];
}>;
const canonical: Source = {
  competency: c04Competency,
  activities: c04Activities,
  scenarios: c04Scenarios,
  boundary: c04Boundary,
  copy: c04Copy,
  contracts: c04ResponseContracts,
};

/** Authentication is deliberately stricter than the generic registry's shape checks. */
export function authenticateC04BindingSource(source: Source = canonical): void {
  validateC04Local(
    source.competency,
    source.activities,
    source.scenarios,
    source.boundary,
    source.copy,
  );
  validateC04ResponseContracts(source.contracts);
  for (const [index, contract] of source.contracts.entries()) {
    const activity = source.activities[index]!;
    const scenario = source.scenarios[index]!;
    if (
      contract.activityId !== activity.id ||
      contract.scenarioId !== scenario.id ||
      scenario.activityId !== activity.id ||
      activity.scenarioIds.length !== 1 ||
      activity.scenarioIds[0] !== scenario.id ||
      activity.competencyId !== source.competency.id ||
      !activity.contentReferences.some(
        (ref) => ref.contentId === contract.confirmationFeedbackRef,
      ) ||
      contract.choices.some(
        (choice) =>
          !activity.contentReferences.some(
            (ref) => ref.contentId === choice.incorrectFeedbackRef,
          ),
      )
    )
      throw new TypeError("C04 binding source membership mismatch");
  }
}

/** D061/S2: source identity, not model state or a caller-controlled mapping. */
export function projectC04CheckpointIdentity(activityId: unknown): Readonly<{
  activityId: string;
  scenarioId: string;
}> {
  authenticateC04BindingSource();
  const activity = c04Activities.find((item) => item.id === activityId);
  const scenario =
    activity &&
    c04Scenarios.find(
      (item) =>
        item.id === activity.scenarioIds[0] && item.activityId === activity.id,
    );
  if (!activity || !scenario)
    throw new TypeError("Invalid C04 checkpoint identity");
  return Object.freeze({ activityId: activity.id, scenarioId: scenario.id });
}

// Reject accessors, prototypes, sparse arrays and hidden properties before Core
// structural checks. Decimal methods authenticate their private value, not instanceof alone.
function responseData(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value !== "object" || seen.has(value)) return false;
  if (value instanceof ExactDecimal) {
    try {
      return ExactDecimal.prototype.toString.call(value) === value.toString();
    } catch {
      return false;
    }
  }
  if (
    Object.getPrototypeOf(value) !==
    (Array.isArray(value) ? Array.prototype : Object.prototype)
  )
    return false;
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  const result =
    (!Array.isArray(value) ||
      (keys.length === value.length + 1 &&
        Array.from({ length: value.length }, (_, index) =>
          Object.prototype.hasOwnProperty.call(value, index),
        ).every(Boolean))) &&
    keys.every((key) => {
      if (Array.isArray(value) && key === "length") return true;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        typeof key === "string" &&
        descriptor !== undefined &&
        descriptor.enumerable &&
        "value" in descriptor &&
        responseData(descriptor.value, seen)
      );
    });
  seen.delete(value);
  return result;
}

/** D019/S1: supplied-field membership only; never readiness or correctness.
 * REASONING may carry retained primary fields; commitment equality is checked
 * separately by the checkpoint/actor, not authorized by this predicate.
 */
export function validateC04PartialResponseV1(
  activityId: unknown,
  response: unknown,
  stage: unknown,
): boolean {
  try {
    authenticateC04BindingSource();
    const contract = c04ResponseContracts.find(
      (item) => item.activityId === activityId,
    );
    const policy = contract?.stages.find((item) => item.id === stage);
    if (
      !contract ||
      !policy ||
      !responseData(response) ||
      !isLearnerResponse(response) ||
      response.kind !== "COMPOSITE"
    )
      return false;
    const retained =
      stage === "REASONING" ? (contract.commitment?.fields ?? []) : [];
    return response.parts.every(({ key, response: part }) => {
      if (!policy.editableFields.includes(key) && !retained.includes(key))
        return false;
      const field = contract.fields.find((item) => item.role === key);
      if (!field?.acceptedKinds.includes(part.kind)) return false;
      if (part.kind === "SINGLE_SELECTION")
        return contract.choices.some(
          (choice) =>
            choice.role === key &&
            choice.visibleStages.includes(policy.id) &&
            choice.options.some((option) => option.id === part.selectionId),
        );
      return (
        part.kind === "SEMANTIC_BOUNDARY" ||
        (part.kind === "EXACT_QUANTITY" &&
          part.value.kind === field.quantityKind &&
          part.value.unit === field.unit &&
          part.value.basis === field.basis)
      );
    });
  } catch {
    return false;
  }
}

function sourceModel(index: number): C04ModelDefinition {
  const scenario = c04Scenarios[index]!;
  const pair = (offset: number, childId: "C04-S02-A" | "C04-S02-B" | null) => {
    const original = scenario.facts[offset]!;
    const next = scenario.facts[offset + 1]!;
    if (
      original.resolution.kind !== "KNOWN" ||
      next.resolution.kind !== "KNOWN"
    )
      throw new TypeError("C04 requires established source facts");
    return {
      childId,
      original: { role: original.key, value: original.resolution.value },
      newValue: { role: next.key, value: next.resolution.value },
    };
  };
  return {
    activityId: c04Activities[index]!.id as C04BindingActivityId,
    scenarioId: scenario.id as C04ModelDefinition["scenarioId"],
    cases:
      index === 1
        ? [pair(0, "C04-S02-A"), pair(2, "C04-S02-B")]
        : [pair(0, null)],
  };
}

/** D061/S1: authenticates fixed Study provenance before reading live issuance. */
export function projectC04CheckpointModelV1(
  state: unknown,
): C04PersistedModelV1 {
  authenticateC04BindingSource();
  return projectC04PersistedModelV1(state, sourceModel(1));
}

/** Validates detached JSON evidence, without restoring or issuing live state. */
export function validateC04CheckpointModelV1(
  evidence: unknown,
): C04PersistedModelV1 {
  authenticateC04BindingSource();
  return validateC04PersistedModelV1(evidence, sourceModel(1));
}

function ready(
  contract: C04ResponseContract,
  response: LearnerResponse,
): boolean {
  if (!isLearnerResponse(response) || response.kind !== "COMPOSITE")
    return false;
  return (
    contract.fields.every(
      (field) =>
        !field.required || response.parts.some((p) => p.key === field.role),
    ) &&
    response.parts.every(({ key, response: part }) => {
      const field = contract.fields.find((field) => field.role === key);
      if (!field || !field.acceptedKinds.includes(part.kind)) return false;
      if (part.kind === "SINGLE_SELECTION")
        return contract.choices.some(
          (choice) =>
            choice.role === key &&
            choice.options.some((o) => o.id === part.selectionId),
        );
      return (
        part.kind === "SEMANTIC_BOUNDARY" ||
        (part.kind === "EXACT_QUANTITY" &&
          part.value.kind === field.quantityKind &&
          part.value.unit === field.unit &&
          part.value.basis === field.basis)
      );
    })
  );
}

function definition(
  index: number,
  contract: C04ResponseContract,
): ActivityDefinition {
  const activityId = c04Activities[index]!.id as C04BindingActivityId;
  if (index === 1)
    return {
      activityId,
      edges: {
        ENTRY: { CONTINUE: "EXP-01" },
        "EXP-01": { CONTINUE: "EXP-02" },
        "EXP-02": { PREVIOUS: "EXP-01", CONTINUE: "EXP-03" },
        "EXP-03": { PREVIOUS: "EXP-02", CONTINUE: "EXP-04" },
        "EXP-04": { PREVIOUS: "EXP-03", CONTINUE: "EXP-05" },
        "EXP-05": { PREVIOUS: "EXP-04", CONTINUE: "ACTIVE" },
      },
      support: {
        "EXP-01": ["REVIEW"],
        "EXP-02": ["REVIEW"],
        "EXP-03": ["REVIEW"],
        "EXP-04": ["REVIEW"],
        "EXP-05": ["REVIEW"],
        ACTIVE: ["REVIEW"],
        REVISION: ["REVIEW"],
      },
      modelSelection: {
        modelId: c04Activities[index]!.modelBinding!.profileId,
        scenarioId: contract.scenarioId,
        initialSelectionId: "C04-S02-A",
        selectionIds: ["C04-S02-A", "C04-S02-B"],
        allowedSelections: {
          "EXP-02": ["C04-S02-A"],
          "EXP-03": ["C04-S02-B"],
          ACTIVE: ["C04-S02-A", "C04-S02-B"],
          REVISION: ["C04-S02-A", "C04-S02-B"],
        },
      },
    };
  const basic: ActivityDefinition = {
    activityId,
    edges: { ENTRY: { CONTINUE: "ACTIVE" } },
    support: { ACTIVE: ["REVIEW"], REVISION: ["REVIEW"] },
  };
  if (index !== 3) return basic;
  return {
    ...basic,
    edges: {
      ...basic.edges,
      CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
      RECONSIDERATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
    },
    support: { POST_CONFIRMATION_EXPLANATION: ["REVIEW"] },
    responseStages: {
      contractId: contract.contractId,
      version: contract.version,
      scenarioId: contract.scenarioId,
      primaryFields: contract.fields
        .filter((f) => f.role !== "explanation")
        .map((f): PrimaryField => ({
          key: f.role,
          acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
          quantityKind: f.quantityKind!,
          unit: f.unit!,
          basis: f.basis!,
        })),
      reasoningField: contract.choices[0]!.role,
      optionIds: contract.choices[0]!.options.map((o) => o.id),
    },
    terminalTeaching: {
      outcomes: "BOTH",
      contentId: contract.terminalTeaching!.contentRef,
    },
  };
}

/** Exactly four authenticated executable bindings; callbacks retain no mutable actor state. */
export function createC04ActivityBindings(): readonly ExecutableActivityBinding[] {
  authenticateC04BindingSource();
  return Object.freeze(
    c04ResponseContracts.map((contract, index) => {
      const modelDefinition = sourceModel(index);
      const seed = createC04ModelState(modelDefinition);
      const ports: ActivityPorts = {
        ready: (response) => ready(contract, response),
        evaluate: (response) => {
          if (!ready(contract, response) || response.kind !== "COMPOSITE")
            throw new TypeError("Unauthorized C04 response");
          return evaluateC04Response(
            {
              state: seed,
              fields: response.parts.map(
                (p) => p.key,
              ) as C04EvaluationDefinition["fields"],
              choices: contract.choices.map((choice) => ({
                key: choice.role as C04EvaluationDefinition["choices"][number]["key"],
                options: choice.options.map((o) => o.id),
                correctId: choice.correctId,
              })),
            },
            response,
          );
        },
        completionEligible: (evidence) =>
          evidence.activityId === contract.activityId &&
          c04CompletionEligible({
            ...evidence,
            activityId: modelDefinition.activityId,
            evaluation: evidence.evaluation as C04Evaluation | null,
          }),
        // These fixed C04 scenarios have no unresolved input or runtime provider edge.
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const modelAdapter: ActivityModelAdapter = {
        initialize: () => {
          const state = createC04ModelState(modelDefinition);
          const view = deriveC04ModelState(state);
          return { selectionId: view.state.selectedChildId!, state };
        },
        select: (current, selectionId) => {
          const view = deriveC04ModelState(current.state as C04ModelState);
          if (
            view.state.activityId !== "C04-A02" ||
            view.state.selectedChildId !== current.selectionId ||
            (selectionId !== "C04-S02-A" && selectionId !== "C04-S02-B")
          )
            return null;
          const state = applyC04ModelIntent(view.state, {
            type: "SELECT_CHILD",
            childId: selectionId,
          });
          deriveC04ModelState(state);
          return { selectionId, state };
        },
      };
      return Object.freeze({
        activityId: modelDefinition.activityId,
        definition: definition(index, contract),
        ports,
        ...(index === 1 ? { modelAdapter } : {}),
      });
    }),
  );
}

export function createC04ActivityRegistry(): ActivityRegistry {
  return new ActivityRegistry(createC04ActivityBindings());
}

/** Returns a fresh unstarted T025 actor; start/stop and delivery remain caller-owned. */
export function createC04ActivityActor(id: unknown): ActivityActor {
  return createActivityActor(createC04ActivityRegistry(), id);
}

const text = (id: keyof typeof c04Copy): SafeText => ({
  id,
  text: c04Copy[id],
});
const exposure = (
  content: SafeText,
  phase: Position,
  timing: Exposure["timing"] = "PUBLIC",
): Exposure => ({
  content,
  phases: [phase],
  timing,
});
const factText = (
  view: C04ModelSnapshot,
  role: "original" | "newValue",
  prefix: string,
): SafeText => ({
  id: `${prefix}/${role}`,
  text: `${view[role].role}: ${view[role].value.magnitude.toString()} PHP per month`,
});
function derived(
  view: C04ModelSnapshot,
  prefix: string,
  percentage: boolean,
): SafeText[] {
  const result: SafeText[] = [];
  const difference = view.change.difference.resolution;
  const percent = view.change.percentageChange.resolution;
  if (difference.kind === "KNOWN")
    result.push({
      id: `${prefix}/difference`,
      text: `New minus Original: ${difference.value.magnitude.toString()} PHP per month`,
    });
  if (percentage && percent.kind === "KNOWN")
    result.push({
      id: `${prefix}/percentage`,
      text: `Difference relative to Original ${view.original.value.magnitude.toString()} PHP per month: ${percent.value.magnitude.toString()}%`,
    });
  return result;
}

/** C3 §§41,45,48,50,54 canonical prose, separated at the §§44/47 reveal boundary. */
const teaching: Readonly<Record<string, string>> = Object.freeze({
  "EXP-01":
    "Both employees receive the same increase in pesos. Before thinking about percentages, calculate the absolute change for each salary. Employee A: ₱22,000 − ₱20,000 = ₱2,000. Employee B: ₱12,000 − ₱10,000 = ₱2,000. So the two absolute changes are equal: each salary increased by ₱2,000.00. That does not yet tell us whether the percentage increases are equal.",
  "EXP-02":
    "The Original stays fixed as the reference basis. The ₱22,000.00 New value tells us the ending salary. It does not replace ₱20,000.00 as the reference denominator.",
  "EXP-03":
    "Employee B also gains ₱2,000.00. But this time the Original salary is only ₱10,000.00. The same absolute increase is now compared with a smaller starting reference.",
  "EXP-04":
    "Both employees gained exactly ₱2,000.00. Their absolute increases are equal. But percentage change does not ask only how many pesos changed. It asks how large that change is relative to the Original value. ₱2,000.00 is 10% of ₱20,000.00, but it is 20% of ₱10,000.00. That is why equal peso increases can produce different percentage increases. Absolute Change A = Absolute Change B but Percentage Change A ≠ Percentage Change B because Original A ≠ Original B.",
  "EXP-05":
    "We can now state the full relationship. First find the signed difference: New minus Original. Then compare that difference with the Original value. Finally, multiply by 100 to express the relative change as a percentage. The Original is the reference denominator because percentage change describes change from the starting value.",
});
const dependentTeaching: Readonly<Record<string, string>> = Object.freeze({
  "EXP-02":
    "For Employee A, the ₱2,000.00 increase is measured relative to the Original salary of ₱20,000.00. ₱2,000 ÷ ₱20,000 × 100 = 10%. Employee A’s salary therefore increased by 10% from the Original salary.",
  "EXP-03":
    "₱2,000 ÷ ₱10,000 × 100 = 20%. Employee B’s salary therefore increased by 20% from the Original salary. The important changed element is: Original Reference Basis ₱20,000 → ₱10,000 not the absolute change.",
});

/** Reads the real actor snapshot only; never sends events or creates delivery evidence. */
export function composeC04ActivityFrame(
  actor: ActivityActor,
): SemanticActivityFrame {
  const snapshot = actor.getSnapshot();
  if (snapshot.status === "error") throw new TypeError("Failed C04 actor");
  const c = snapshot.context;
  const index = c04Activities.findIndex((a) => a.id === c.activityId);
  if (index < 0) throw new TypeError("Unbound C04 actor");
  const binding = createC04ActivityRegistry().resolve(c.activityId);
  const contract = c04ResponseContracts[index]!;
  const phase = c.position;
  const support: SupportPhase = snapshot.matches({ support: "review" })
    ? "REVIEW"
    : snapshot.matches({ support: "sourceReview" })
      ? "SOURCE_REVIEW"
      : snapshot.matches({ support: "reinforcement" })
        ? "REINFORCEMENT"
        : "NONE";
  const prefix = `c04/S0${index + 1}`;
  const copy = (role: string) =>
    text(`${prefix}/${role}` as keyof typeof c04Copy);
  const references: Exposure[] = [
    exposure(copy("scenario"), phase),
    exposure(copy("task"), phase),
  ];
  const modelFacts: Exposure[] = [];
  const derivedFacts: Exposure[] = [];
  const seed = createC04ModelState(sourceModel(index));
  const selected =
    index === 1
      ? deriveC04ModelState(c.model?.value.state as C04ModelState)
      : deriveC04ModelState(seed);
  if (
    selected.state.activityId !== c.activityId ||
    selected.state.scenarioId !== contract.scenarioId ||
    (index === 1 &&
      selected.state.selectedChildId !== c.model?.value.selectionId)
  )
    throw new TypeError("C04 actor model membership mismatch");
  modelFacts.push(
    exposure(factText(selected, "original", `${prefix}/selected-track`), phase),
    exposure(factText(selected, "newValue", `${prefix}/selected-track`), phase),
  );
  if (index === 1) {
    const step = teaching[phase];
    if (step)
      references.push(
        exposure({ id: `${prefix}/${phase}/teaching`, text: step }, phase),
      );
    const children = ["C04-S02-A", "C04-S02-B"] as const;
    const focused =
      phase === "EXP-02"
        ? [children[0]]
        : phase === "EXP-03"
          ? [children[1]]
          : children;
    // Initialization and opposite-child engagement never authorize a focused reveal.
    // Navigation only retains the actor's issued selection; it cannot engage it.
    const dependentStep = phase === "EXP-02" || phase === "EXP-03";
    const focusEngaged =
      c.model!.revision > 0 &&
      focused.some((childId) => childId === selected.state.selectedChildId);
    if (dependentStep && focusEngaged)
      references.push(
        exposure(
          {
            id: `${prefix}/${phase}/dependent-teaching`,
            text: dependentTeaching[phase]!,
          },
          phase,
        ),
      );
    if (
      phase.startsWith("EXP-") ||
      phase === "ACTIVE" ||
      phase === "REVISION"
    ) {
      for (const childId of focused) {
        const view = deriveC04ModelState(
          applyC04ModelIntent(seed, { type: "SELECT_CHILD", childId }),
        );
        const focus = `${prefix}/authored-focus/${childId}`;
        modelFacts.push(
          exposure(factText(view, "original", focus), phase),
          exposure(factText(view, "newValue", focus), phase),
        );
        if (!dependentStep || focusEngaged)
          derivedFacts.push(
            ...derived(view, focus, phase !== "EXP-01").map((fact) =>
              exposure(fact, phase),
            ),
          );
      }
      const relevant =
        phase === "EXP-02"
          ? children[0]
          : phase === "EXP-03"
            ? children[1]
            : null;
      if (
        c.model!.revision > 0 &&
        (!relevant || relevant === selected.state.selectedChildId)
      )
        derivedFacts.push(
          ...derived(
            selected,
            `${prefix}/engaged-track/${selected.state.selectedChildId}`,
            phase !== "EXP-01",
          ).map((fact) => exposure(fact, phase)),
        );
      if (phase === "EXP-05")
        references.push(
          exposure(
            {
              id: `${prefix}/formula`,
              text: "Percentage Change = (New − Original) ÷ Original × 100",
            },
            phase,
          ),
        );
    }
  }
  const checked =
    c.checkedRevision === c.responseRevision && c.evaluation !== null;
  if (checked && index !== 1 && phase !== "REVISION")
    derivedFacts.push(
      ...derived(selected, `${prefix}/checked`, true).map((fact) =>
        exposure(fact, phase, "CURRENT_CHECK"),
      ),
    );
  if (phase === "POST_CONFIRMATION_EXPLANATION")
    references.push(
      exposure(copy("undefined-result"), phase, "CURRENT_FEEDBACK"),
    );
  if (phase === "COMPLETE")
    references.push(exposure(copy("completion"), phase, "CURRENT_FEEDBACK"));
  const responseControls: ChoiceExposure[] = contract.stages.map((stage) => ({
    activityId: c.activityId,
    contractId: contract.contractId,
    version: contract.version,
    stage: stage.id,
    controls: stage.editableFields.map((role) => {
      const field = contract.fields.find((f) => f.role === role)!;
      const choice = contract.choices.find((choice) => choice.role === role);
      return {
        role,
        acceptedKinds: field.acceptedKinds,
        ...(choice
          ? { options: choice.options.map((o) => ({ id: o.id, text: o.text })) }
          : {}),
      };
    }),
  }));
  const diagnostic = c.evaluation?.diagnostic;
  const diagnosticRole =
    index === 0 && diagnostic === "RECONSIDER_QUANTITY"
      ? "reconsider-roles"
      : index === 1 && diagnostic === "RECONSIDER_REPRESENTATION"
        ? "reconsider-denominator"
        : index === 2 && diagnostic === "RECONSIDER_REPRESENTATION"
          ? "reconsider-reference"
          : null;
  const feedbackRef =
    c.evaluation?.outcome === "CONFIRMED"
      ? contract.confirmationFeedbackRef
      : diagnosticRole
        ? `${prefix}/${diagnosticRole}`
        : contract.choices[0]!.incorrectFeedbackRef;
  return projectSemanticActivityFrame({
    context: c,
    phase,
    support,
    definition: binding.definition,
    ports: binding.ports,
    content: {
      references,
      modelFacts,
      derivedFacts,
      responseContract: { id: contract.contractId, text: contract.contractId },
      responseControls,
      ...(index === 1
        ? {
            modelSelectionOptions: sourceModel(index).cases.map((item) => ({
              id: item.childId!,
              text: item.newValue.role,
            })),
          }
        : {}),
      ...(c.evaluation
        ? {
            feedback: {
              outcome: c.evaluation.outcome,
              revision: c.responseRevision,
              content: text(feedbackRef as keyof typeof c04Copy),
            },
          }
        : {}),
      review: {
        receivingActivityId: c.activityId,
        invokingPhase: phase,
        relationships: [copy("relationship-help")],
      },
    },
  });
}
