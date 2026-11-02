import type { Quantity } from "@/core/public";
import { ExactDecimal, isLearnerResponse } from "@/core/public";
import {
  c03Activities,
  c03A01Diagnostic,
  c03Competency,
  c03Copy,
  c03Evidence,
  c03Scenarios,
  validateC03Local,
} from "@/study/competencies/c03/public";
import {
  applyC03ModelIntent,
  createC03ModelState,
  deriveC03ModelState,
  projectC03PersistedModelV1,
  restoreC03ModelState,
} from "@/competencies/c03-overtime-pay/model/public";
import type {
  C03ModelDefinition,
  C03ModelState,
} from "@/competencies/c03-overtime-pay/model/public";
import {
  c03ConditionOptions,
  c03ResponseFields,
  c03ResponseReady,
  deriveC03ProviderOutput,
  evaluateC03Response,
} from "@/competencies/c03-overtime-pay/evaluators/public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityModelAdapter,
  ActivityPorts,
} from "../activity-machine/public";
import { createActivityRestoration } from "../activity-machine/public";
import { createActivityActor } from "../activity-runtime/public";
import type { ActivityActor } from "../activity-runtime/public";
import { ActivityRegistry } from "../registry/public";
import type { ExecutableActivityBinding } from "../registry/public";
import { projectSemanticActivityFrame } from "../semantic-frame/public";
import type { Exposure, PublicResponseControl } from "../semantic-frame/public";
import { c03Explanation } from "./instruction";

type Id = C03ModelDefinition["activityId"];
const ids = ["C03-A01", "C03-A02", "C03-A03", "C03-A04"] as const;
const canonical = {
  competency: c03Competency,
  activities: c03Activities,
  scenarios: c03Scenarios,
  evidence: c03Evidence,
  copy: c03Copy,
};

/** No caller-provided definition enters canonical composition. The optional
 * source argument supports adversarial validation, never alternate issuance.
 */
export function authenticateC03BindingSource(
  source: typeof canonical = canonical,
): void {
  validateC03Local(
    source.competency,
    source.activities,
    source.scenarios,
    source.evidence,
    source.copy,
  );
  if (source.competency.id !== "C03")
    throw new TypeError("Invalid C03 competency");
  source.activities.forEach((a, i) => {
    const s = source.scenarios[i]!;
    if (
      a.id !== ids[i] ||
      a.competencyId !== "C03" ||
      s.competencyId !== "C03" ||
      s.activityId !== a.id ||
      a.scenarioIds.length !== 1 ||
      a.scenarioIds[0] !== s.id
    )
      throw new TypeError("C03 source membership mismatch");
  });
}

function identity(id: unknown): Id {
  if (!ids.some((item) => item === id))
    throw new TypeError("Unknown C03 activity");
  return id as Id;
}

function modelDefinition(id: Id): C03ModelDefinition {
  authenticateC03BindingSource();
  const s = c03Scenarios[ids.indexOf(id)]!;
  const value = (key: string): Quantity => {
    const matches = s.facts.filter((f) => f.key === key);
    const r = matches[0]?.resolution;
    if (matches.length !== 1 || r?.kind !== "KNOWN")
      throw new TypeError("Missing canonical C03 quantity");
    return r.value;
  };
  const paired = id === "C03-A02";
  const cases = paired
    ? [
        {
          childId: "C03-S02-A" as const,
          condition: "ordinary working day" as const,
          rate: value("C03-S02-A regular hourly rate"),
          hours: value("C03-S02-A overtime hours"),
          multiplier: value(
            "C03-S02-A ordinary working day applicable multiplier",
          ),
        },
        {
          childId: "C03-S02-B" as const,
          condition: "rest day" as const,
          rate: value("C03-S02-B regular hourly rate"),
          hours: value("C03-S02-B overtime hours"),
          multiplier: value("C03-S02-B rest day applicable multiplier"),
        },
      ]
    : [
        {
          childId: null,
          condition:
            id === "C03-A04"
              ? ("regular holiday" as const)
              : ("ordinary working day" as const),
          rate: value(
            id === "C03-A01"
              ? "regular hourly rate"
              : "established regular hourly rate",
          ),
          hours: value(
            id === "C03-A03"
              ? "aggregate monthly overtime hours"
              : "overtime hours",
          ),
          multiplier: value(
            id === "C03-A04"
              ? "regular holiday applicable multiplier"
              : "ordinary working day applicable multiplier",
          ),
        },
      ];
  return Object.freeze({
    activityId: id,
    scenarioId: s.id as C03ModelDefinition["scenarioId"],
    evidenceMode: c03Evidence[s.id as keyof typeof c03Evidence].mode,
    cases: Object.freeze(cases),
  });
}

function definition(id: Id): ActivityDefinition {
  if (id === "C03-A01")
    return {
      activityId: id,
      edges: { ENTRY: { CONTINUE: "ACTIVE" } },
      support: {},
    };
  const support: ActivityDefinition["support"] = {
    ACTIVE: ["REVIEW"],
    REVISION: ["REVIEW"],
    CONFIRMATION: ["REVIEW"],
    RECONSIDERATION: ["REVIEW"],
  };
  if (id !== "C03-A02")
    return {
      activityId: id,
      edges: { ENTRY: { CONTINUE: "ACTIVE" } },
      support,
    };
  return {
    activityId: id,
    edges: {
      ENTRY: { CONTINUE: "EXP-01" },
      "EXP-01": { CONTINUE: "EXP-02" },
      "EXP-02": { PREVIOUS: "EXP-01", CONTINUE: "EXP-03" },
      "EXP-03": { PREVIOUS: "EXP-02", CONTINUE: "EXP-04" },
      "EXP-04": { PREVIOUS: "EXP-03", CONTINUE: "EXP-05" },
      "EXP-05": { PREVIOUS: "EXP-04", CONTINUE: "ACTIVE" },
    },
    support: {
      ...support,
      "EXP-01": ["REVIEW"],
      "EXP-02": ["REVIEW"],
      "EXP-03": ["REVIEW"],
      "EXP-04": ["REVIEW"],
      "EXP-05": ["REVIEW"],
    },
    c03Inspection: "C03-A02-ordinary-day-exp02-v1",
    modelSelection: {
      modelId: "C03-A02:Overtime Work Record",
      scenarioId: "C03-S02",
      initialSelectionId: "C03-S02-A",
      selectionIds: ["C03-S02-A", "C03-S02-B"],
      allowedSelections: {
        "EXP-02": ["C03-S02-A"],
        "EXP-03": ["C03-S02-A", "C03-S02-B"],
        "EXP-04": ["C03-S02-A", "C03-S02-B"],
        "EXP-05": ["C03-S02-A", "C03-S02-B"],
        ACTIVE: ["C03-S02-A", "C03-S02-B"],
        REVISION: ["C03-S02-A", "C03-S02-B"],
      },
    },
  };
}

export function createC03ActivityBindings(): readonly ExecutableActivityBinding[] {
  return Object.freeze(
    ids.map((id) => {
      const source = modelDefinition(id);
      const oracle = createC03ModelState(source);
      const ports: ActivityPorts = {
        ready: (r) => c03ResponseReady(oracle, r, c03A01Diagnostic),
        evaluate: (r) => evaluateC03Response(oracle, r, c03A01Diagnostic),
        completionEligible: (e) =>
          e.activityId === id &&
          e.responseRevision > 0 &&
          e.checkedRevision === e.responseRevision &&
          e.feedbackRevision === e.responseRevision &&
          (e.evaluation?.outcome === "CONFIRMED" ||
            (id !== "C03-A01" && e.evaluation?.outcome === "RECONSIDERATION")),
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const modelAdapter: ActivityModelAdapter = {
        initialize: () => {
          const state = createC03ModelState(source);
          return Object.freeze({ selectionId: "C03-S02-A", state });
        },
        select: (current, selected) => {
          const state = current.state as C03ModelState;
          const proof = projectC03PersistedModelV1(state, source);
          if (
            proof.selectedChildId !== current.selectionId ||
            (selected !== "C03-S02-A" && selected !== "C03-S02-B")
          )
            return null;
          return Object.freeze({
            selectionId: selected,
            state:
              selected === current.selectionId
                ? state
                : applyC03ModelIntent(state, {
                    type: "SELECT_CHILD",
                    childId: selected,
                  }),
          });
        },
      };
      return Object.freeze({
        activityId: id,
        definition: definition(id),
        ports,
        ...(id === "C03-A02" ? { modelAdapter } : {}),
      });
    }),
  );
}

const actors = new WeakMap<
  ActivityActor,
  { registry: ActivityRegistry; id: Id }
>();
function issue(
  actor: ActivityActor,
  registry: ActivityRegistry,
  id: Id,
): ActivityActor {
  actors.set(actor, { registry, id });
  const stop = actor.stop.bind(actor);
  actor.stop = () => {
    actors.delete(actor);
    return stop();
  };
  return actor;
}
export function createC03ActivityActor(input: unknown): ActivityActor {
  const id = identity(input);
  const registry = new ActivityRegistry(createC03ActivityBindings());
  return issue(createActivityActor(registry, id), registry, id);
}
function inspect(actor: ActivityActor) {
  const issued = actors.get(actor);
  if (!issued || actor.getSnapshot().status !== "active")
    throw new TypeError("Unissued or inactive C03 actor");
  authenticateC03BindingSource();
  return {
    ...issued,
    binding: issued.registry.resolve(issued.id),
    context: actor.getSnapshot().context,
  };
}

/** Public presentation input is a projection, never the private model/oracle.
 * UI geometry, response layout and accessible presentation remain T062-owned.
 */
export function projectC03ActivityFrame(actor: ActivityActor) {
  const { id, binding, context: c } = inspect(actor);
  const source = modelDefinition(id);
  const state =
    id === "C03-A02"
      ? (c.model!.value.state as C03ModelState)
      : createC03ModelState(source);
  if (id === "C03-A02") projectC03PersistedModelV1(state, source);
  const view = deriveC03ModelState(state);
  const prefix = `c03/S0${ids.indexOf(id) + 1}/`;
  const text = (role: string) => {
    const key = prefix + role;
    if (!Object.prototype.hasOwnProperty.call(c03Copy, key))
      throw new TypeError("Unknown C03 copy role");
    return Object.freeze({
      id: key,
      text: c03Copy[key as keyof typeof c03Copy],
    });
  };
  const expose = (
    role: string,
    timing: Exposure["timing"] = "PUBLIC",
  ): Exposure => ({ content: text(role), phases: [c.position], timing });
  const feedbackCurrent =
    c.checkedRevision === c.responseRevision &&
    c.feedbackRevision === c.responseRevision &&
    c.evaluation !== null;
  const revealed =
    id !== "C03-A01" &&
    feedbackCurrent &&
    ["CONFIRMATION", "RECONSIDERATION", "COMPLETE"].includes(c.position);
  const taught =
    id === "C03-A02" &&
    [
      "EXP-02",
      "EXP-03",
      "EXP-04",
      "EXP-05",
      "ACTIVE",
      "REVISION",
      "CONFIRMATION",
      "RECONSIDERATION",
      "COMPLETE",
    ].includes(c.position);
  const support = c.origin === null ? ("NONE" as const) : ("REVIEW" as const);
  const explanation =
    id === "C03-A02" &&
    Object.prototype.hasOwnProperty.call(c03Explanation, c.position)
      ? c03Explanation[c.position as keyof typeof c03Explanation]
      : [];
  const diagnostic = c.evaluation?.diagnostic;
  const feedbackRole =
    c.evaluation?.outcome === "CONFIRMED"
      ? "confirmation"
      : id === "C03-A01"
        ? diagnostic === "WORK_CONDITION"
          ? "reconsider-condition"
          : "reconsider-multiplier"
        : id === "C03-A02"
          ? diagnostic === "INVARIANTS"
            ? "reconsider-invariant-values"
            : diagnostic === "WORK_CONDITION" ||
                diagnostic === "CONDITION_MULTIPLIER"
              ? "reconsider-condition"
              : null
          : diagnostic === "WORK_CONDITION" ||
              diagnostic === "CONDITION_MULTIPLIER"
            ? "reconsider-condition"
            : null;
  const controls: readonly PublicResponseControl[] =
    id === "C03-A01"
      ? c03ResponseFields["C03-A01"].map((role) =>
          Object.freeze({
            role,
            acceptedKinds: ["SINGLE_SELECTION" as const],
            options: c03A01Diagnostic[role].options,
          }),
        )
      : c03ResponseFields[id].map((key) =>
          Object.freeze({
            role: key,
            acceptedKinds: [
              key === "condition"
                ? "SINGLE_SELECTION"
                : key === "invariants" || key === "changes"
                  ? "SINGLE_SELECTION"
                  : "EXACT_QUANTITY",
            ],
            ...(key === "condition"
              ? {
                  options: c03ConditionOptions.map((option) => ({
                    id: option,
                    text: option,
                  })),
                }
              : key === "invariants" || key === "changes"
                ? {
                    options: [
                      "rate + hours",
                      "condition + multiplier + overtimePay",
                      "rate + multiplier",
                    ].map((option) => ({ id: option, text: option })),
                  }
                : {}),
          }),
        );
  const frame = projectSemanticActivityFrame({
    context: c,
    phase: c.position,
    support,
    definition: binding.definition,
    ports: binding.ports,
    content: {
      references: [
        expose("scenario"),
        expose("task"),
        ...explanation.map((passage, index): Exposure => ({
          content: {
            id: `c03/${c.position}/passage-${index + 1}`,
            text: passage,
          },
          phases: [c.position],
          timing: "PUBLIC",
        })),
        ...(revealed
          ? [expose("accessibility-summary", "CURRENT_FEEDBACK")]
          : []),
        ...(c.position === "COMPLETE"
          ? [expose("completion", "CURRENT_FEEDBACK")]
          : []),
      ],
      modelFacts: [],
      derivedFacts: [],
      responseContract: {
        id: c03Activities[ids.indexOf(id)]!.responseContract.contractId,
        text: c03Activities[ids.indexOf(id)]!.responseContract.contractId,
      },
      responseControls: [
        {
          activityId: id,
          contractId:
            c03Activities[ids.indexOf(id)]!.responseContract.contractId,
          version: id === "C03-A01" ? 2 : 1,
          stage: "RESPONSE",
          controls,
        },
      ],
      ...(binding.definition.modelSelection
        ? {
            modelSelectionOptions:
              binding.definition.modelSelection.selectionIds.map(
                (selection) => ({
                  id: selection,
                  text:
                    selection === "C03-S02-A"
                      ? "Ordinary working day"
                      : "Rest day",
                }),
              ),
          }
        : {}),
      ...(c.evaluation && feedbackRole
        ? {
            feedback: {
              outcome: c.evaluation.outcome,
              revision: c.responseRevision,
              content: text(feedbackRole),
            },
          }
        : {}),
      ...(id !== "C03-A01"
        ? {
            review: {
              receivingActivityId: id,
              invokingPhase: c.position,
              relationships: [text("relationship-help")],
            },
          }
        : {}),
    },
  });
  // All non-frame mathematical channels are equally source-authenticated and
  // exposure-filtered. No hidden quantities or summary IDs accompany blanks.
  const comparison =
    id === "C03-A02" &&
    [
      "EXP-04",
      "EXP-05",
      "ACTIVE",
      "REVISION",
      "CONFIRMATION",
      "RECONSIDERATION",
      "COMPLETE",
    ].includes(c.position)
      ? Object.freeze(
          ["C03-S02-A", "C03-S02-B"].map((child) => {
            const item = deriveC03ModelState(
              applyC03ModelIntent(state, {
                type: "SELECT_CHILD",
                childId: child as "C03-S02-A" | "C03-S02-B",
              }),
            );
            return Object.freeze({
              condition: item.condition,
              multiplier: item.multiplier,
              overtimePay: item.overtimePay,
            });
          }),
        )
      : null;
  return Object.freeze({
    frame,
    diagnosticPrompts: id === "C03-A01" ? c03A01Diagnostic : null,
    workEvidence: Object.freeze({
      scenarioId: source.scenarioId,
      evidenceMode: source.evidenceMode,
      rate: view.rate,
      hours: view.hours,
      conditions: c03Scenarios[ids.indexOf(id)]!.conditions,
    }),
    response: c.response,
    mathematicalExplanation:
      taught || revealed
        ? Object.freeze({
            condition: view.condition,
            multiplier: view.multiplier,
            overtimePay: view.overtimePay,
          })
        : null,
    comparison,
    diagnostic: feedbackCurrent ? diagnostic : null,
  });
}

const providerOutputs = new WeakSet<object>();
export function readC03OvertimeProvider() {
  const output = deriveC03ProviderOutput(
    createC03ModelState(modelDefinition("C03-A03")),
  );
  providerOutputs.add(output);
  return output;
}
export function isAuthenticatedC03OvertimeProvider(
  value: unknown,
): value is ReturnType<typeof readC03OvertimeProvider> {
  authenticateC03BindingSource();
  return (
    value !== null && typeof value === "object" && providerOutputs.has(value)
  );
}

/** Minimal source-authenticated model evidence; durable envelopes are Recovery-owned. */
export function projectC03ModelCheckpoint(actor: ActivityActor) {
  const { id, context } = inspect(actor);
  const source = modelDefinition(id);
  return Object.freeze({
    activityId: id,
    scenarioId: source.scenarioId,
    model:
      id === "C03-A02"
        ? projectC03PersistedModelV1(
            context.model!.value.state as C03ModelState,
            source,
          )
        : null,
  });
}

/** Existing Actor restoration capability with canonical source/model reissuance. */
export function createC03RestoredActivityActor(input: {
  activityId: Id;
  scenarioId: string;
  context: ActivityContext;
  model: unknown;
  responseContract?: Readonly<{ id: string; version: number }>;
}): ActivityActor {
  const data = (value: unknown, seen = new Set<object>()): void => {
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
      throw new TypeError("Invalid C03 restoration data");
    seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (
      Array.isArray(value) &&
      (keys.length !== value.length + 1 ||
        !Array.from({ length: value.length }, (_, i) =>
          Object.prototype.hasOwnProperty.call(value, i),
        ).every(Boolean))
    )
      throw new TypeError("Invalid C03 restoration array");
    for (const key of keys) {
      if (Array.isArray(value) && key === "length") continue;
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || !d || !d.enumerable || !("value" in d))
        throw new TypeError("Invalid C03 restoration property");
      data(d.value, seen);
    }
    seen.delete(value);
  };
  data(input);
  if (
    !input ||
    Reflect.ownKeys(input).length !==
      (input.responseContract === undefined ? 4 : 5) ||
    !["activityId", "scenarioId", "context", "model"].every((k) => {
      const d = Object.getOwnPropertyDescriptor(input, k);
      return d && "value" in d;
    })
  )
    throw new TypeError("Invalid C03 restoration input");
  const id = identity(input.activityId);
  const contract = input.responseContract;
  if (id === "C03-A01" || contract !== undefined) {
    if (
      !contract ||
      Reflect.ownKeys(contract).length !== 2 ||
      contract.id !==
        c03Activities[ids.indexOf(id)]!.responseContract.contractId ||
      contract.version !== (id === "C03-A01" ? 2 : 1)
    )
      throw new TypeError("Incompatible C03 response contract");
  }
  const source = modelDefinition(id);
  if (input.scenarioId !== source.scenarioId || input.context.activityId !== id)
    throw new TypeError("C03 restoration identity mismatch");
  const registry = new ActivityRegistry(createC03ActivityBindings());
  const binding = registry.resolve(id);
  let context = input.context;
  if (id === "C03-A02") {
    const state = restoreC03ModelState(input.model, source);
    if (
      !context.model ||
      Reflect.ownKeys(context.model).length !== 3 ||
      !["modelId", "revision", "value"].every((k) =>
        Object.prototype.hasOwnProperty.call(context.model!, k),
      ) ||
      !context.model.value ||
      Reflect.ownKeys(context.model.value).length !== 2 ||
      !["selectionId", "state"].every((k) =>
        Object.prototype.hasOwnProperty.call(context.model!.value, k),
      ) ||
      context.model.value.selectionId !==
        (state.activityId === "C03-A02" ? state.selectedChildId : "") ||
      context.model.modelId !== binding.definition.modelSelection!.modelId
    )
      throw new TypeError("Missing C03 restoration model");
    context = {
      ...context,
      model: {
        ...context.model,
        value: {
          selectionId:
            state.activityId === "C03-A02" ? state.selectedChildId : "",
          state,
        },
      },
    };
  } else if (input.model !== null || context.model !== undefined)
    throw new TypeError("Unexpected static C03 model");
  if (context.response !== null) {
    const response = context.response;
    if (
      !isLearnerResponse(response) ||
      response.kind !== "COMPOSITE" ||
      !response.parts.every(
        ({ key, response: r }) =>
          (c03ResponseFields[id] as readonly string[]).includes(key) &&
          (id === "C03-A01"
            ? (key === "expectation" || key === "investigation") &&
              r.kind === "SINGLE_SELECTION" &&
              c03A01Diagnostic[key].options.some(
                (option) => option.id === r.selectionId,
              )
            : key === "condition"
              ? r.kind === "SINGLE_SELECTION" &&
                c03ConditionOptions.includes(r.selectionId)
              : key === "invariants" || key === "changes"
                ? r.kind === "SINGLE_SELECTION" &&
                  [
                    "rate + hours",
                    "condition + multiplier + overtimePay",
                    "rate + multiplier",
                  ].includes(r.selectionId)
                : r.kind === "EXACT_QUANTITY"),
      )
    )
      throw new TypeError("Invalid saved C03 response");
  }
  const restoration = createActivityRestoration(
    binding.definition,
    binding.ports,
    context,
    binding.modelAdapter,
  );
  return issue(createActivityActor(registry, id, restoration), registry, id);
}

/** Only issued actors may contribute live work to the durable projection. */
export function inspectC03RecoveryActor(actor: ActivityActor) {
  const { id, context, binding } = inspect(actor);
  if (
    context.position === "COMPLETE" ||
    context.infoOrigin !== null ||
    (context.origin !== null && context.origin !== context.position)
  )
    throw new TypeError("C03 Recovery requires resumable work");
  return Object.freeze({
    activityId: id,
    scenarioId: modelDefinition(id).scenarioId,
    context,
    responseContract: {
      id: c03Activities[ids.indexOf(id)]!.responseContract.contractId,
      version: id === "C03-A01" ? (2 as const) : (1 as const),
    },
    definition: binding.definition,
    model: projectC03ModelCheckpoint(actor).model,
  });
}

/** Detached, source-authenticated checkpoint validation and reconstruction. */
export function validateC03RecoveryWork(
  input: Parameters<typeof createC03RestoredActivityActor>[0],
) {
  const actor = createC03RestoredActivityActor(input);
  try {
    return actor.getSnapshot().context;
  } finally {
    actor.stop();
  }
}
