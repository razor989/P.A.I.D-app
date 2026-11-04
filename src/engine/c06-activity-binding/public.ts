import { ExactDecimal, isLearnerResponse } from "@/core/public";
import {
  c06Activities,
  c06Cases,
  c06CommissionProvider,
  c06Competency,
  c06Copy,
  c06Scenarios,
  validateC06Local,
} from "@/study/competencies/c06/public";
import {
  applyC06ModelIntent,
  createC06ModelState,
  deriveC06ModelState,
  projectC06PersistedModelV1,
  restoreC06ModelState,
} from "@/competencies/c06-commission/model/public";
import type {
  C06ModelCase,
  C06ModelDefinition,
  C06ModelState,
} from "@/competencies/c06-commission/model/public";
import {
  c06ResponseFields,
  c06ResponseReady,
  deriveC06ProviderOutput,
  evaluateC06Response,
} from "@/competencies/c06-commission/evaluators/public";
import { createActivityRestoration } from "../activity-machine/public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityModelAdapter,
  ActivityPorts,
  Position,
} from "../activity-machine/public";
import { createActivityActor } from "../activity-runtime/public";
import type { ActivityActor } from "../activity-runtime/public";
import { ActivityRegistry } from "../registry/public";
import type { ExecutableActivityBinding } from "../registry/public";
import { projectSemanticActivityFrame } from "../semantic-frame/public";
import type { Exposure } from "../semantic-frame/public";

type Id = C06ModelDefinition["activityId"];
const ids = ["C06-A01", "C06-A02", "C06-A03", "C06-A04"] as const;
const canonical = {
  competency: c06Competency,
  activities: c06Activities,
  scenarios: c06Scenarios,
  cases: c06Cases,
  provider: c06CommissionProvider,
  copy: c06Copy,
};
const has = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);

/** Inspect data descriptors before any boundary reads, including adversarial sources. */
function data(value: unknown, seen = new Set<object>()): void {
  if (
    value === null ||
    ["string", "boolean"].includes(typeof value) ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (value instanceof ExactDecimal) {
    ExactDecimal.prototype.toString.call(value);
    return;
  }
  if (
    !value ||
    typeof value !== "object" ||
    seen.has(value) ||
    Object.getPrototypeOf(value) !==
      (Array.isArray(value) ? Array.prototype : Object.prototype)
  )
    throw new TypeError("Invalid C06 boundary data");
  seen.add(value);
  if (
    Array.isArray(value) &&
    (Reflect.ownKeys(value).length !== value.length + 1 ||
      !Array.from({ length: value.length }, (_, i) => has(value, i)).every(
        Boolean,
      ))
  )
    throw new TypeError("Invalid C06 boundary array");
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !d || !d.enumerable || !("value" in d))
      throw new TypeError("Invalid C06 boundary property");
    data(d.value, seen);
  }
  seen.delete(value);
}

export function authenticateC06BindingSource(
  source: typeof canonical = canonical,
): void {
  data(source);
  if (Reflect.ownKeys(source).length !== 6)
    throw new TypeError("Invalid C06 source");
  validateC06Local(
    source.competency,
    source.activities,
    source.scenarios,
    source.cases,
    source.provider,
    source.copy,
  );
  source.activities.forEach((a, i) => {
    if (
      a.id !== ids[i] ||
      a.competencyId !== "C06" ||
      source.scenarios[i]?.activityId !== a.id ||
      a.scenarioIds.length !== 1 ||
      a.scenarioIds[0] !== source.scenarios[i]?.id
    )
      throw new TypeError("Invalid C06 source membership");
  });
}
function identity(input: unknown): Id {
  if (!ids.some((id) => id === input))
    throw new TypeError("Unknown C06 activity");
  return input as Id;
}
function modelDefinition(id: Id): C06ModelDefinition {
  authenticateC06BindingSource();
  const scenarioId = c06Scenarios[ids.indexOf(id)]!
    .id as C06ModelDefinition["scenarioId"];
  const source = c06Cases[scenarioId];
  const entries = "length" in source ? source : [source];
  const cases = entries.map((item): C06ModelCase => {
    const childId = "id" in item ? (item.id as C06ModelCase["childId"]) : null;
    const sales = { kind: "KNOWN" as const, value: item.sales };
    const commissionRate = {
      kind: "KNOWN" as const,
      value: item.commissionRate,
    };
    return item.arrangement === "STRAIGHT_COMMISSION"
      ? {
          childId,
          arrangement: item.arrangement,
          sales,
          commissionRate,
          baseSalary: item.baseSalary,
        }
      : {
          childId,
          arrangement: item.arrangement,
          sales,
          commissionRate,
          baseSalary: item.baseSalary,
          periodAlignment: {
            salesBasis: item.sales.basis,
            baseSalaryBasis: item.baseSalary.value.basis,
            compensationBasis: id === "C06-A04" ? "June" : "per month",
          },
        };
  });
  return { activityId: id, scenarioId, cases };
}
function contract(id: Id) {
  return Object.freeze({
    id: c06Activities[ids.indexOf(id)]!.responseContract.contractId,
    version: 1 as const,
  });
}
const explanation = Object.freeze({
  "EXP-01":
    "This arrangement contains both Commission and a Base Salary. The Base Salary is fixed at ₱15,000.00. The Commission Rate is fixed at 3%. The Sales Input will change between two approved states so we can observe what that change causes.",
  "EXP-02":
    "Commission is determined from the active Sales Input and the fixed Commission Rate. The Base Salary does not enter this multiplication.",
  "EXP-03":
    "Sales is ₱300,000.00. At the fixed 3% rate, Commission is ₱9,000.00. The Base Salary remains ₱15,000.00, so Total Compensation is ₱24,000.00.",
  "EXP-04":
    "Only Sales changed. The 3% Commission Rate and ₱15,000.00 Base Salary stayed fixed. Higher Sales produced a higher Commission, and the higher Commission produced a higher Total Compensation.",
  "EXP-05":
    "Changed: Sales, Commission and Total Compensation. Stayed fixed: Arrangement, Rate and Base Salary.",
  "EXP-06":
    "The Commission Machine has two stages in this Base-Plus arrangement. First, Sales and Rate determine Commission. Only after Commission is established does the Total-Compensation stage combine Commission with the fixed Base Salary. The Sales amount is the basis for the Commission calculation. The machine is not removing Commission money from Sales or reducing the Sales amount.",
});
function definition(id: Id): ActivityDefinition {
  const teaching = id === "C06-A01" || id === "C06-A04";
  const edges: Record<string, { CONTINUE?: Position; PREVIOUS?: Position }> = {
    ENTRY: { CONTINUE: id === "C06-A02" ? "EXP-01" : "ACTIVE" },
  };
  const support: Record<string, readonly "REVIEW"[]> = {
    ACTIVE: ["REVIEW"],
    REVISION: ["REVIEW"],
    CONFIRMATION: ["REVIEW"],
    RECONSIDERATION: ["REVIEW"],
  };
  if (id === "C06-A02")
    for (let i = 1; i <= 6; i++) {
      const p = `EXP-0${i}`;
      edges[p] = {
        CONTINUE: i === 6 ? "ACTIVE" : `EXP-0${i + 1}`,
        ...(i > 1 ? { PREVIOUS: `EXP-0${i - 1}` as Position } : {}),
      };
      support[p] = ["REVIEW"];
    }
  if (teaching) {
    edges.CONFIRMATION = { CONTINUE: "POST_CONFIRMATION_EXPLANATION" };
    edges.RECONSIDERATION = { CONTINUE: "POST_CONFIRMATION_EXPLANATION" };
    support.POST_CONFIRMATION_EXPLANATION = ["REVIEW"];
  }
  const paired = id === "C06-A01" || id === "C06-A02";
  const scenario = modelDefinition(id).scenarioId;
  const selections = [`${scenario}-A`, `${scenario}-B`];
  return {
    activityId: id,
    edges,
    support,
    ...(teaching
      ? {
          terminalTeaching: {
            outcomes: "BOTH" as const,
            contentId: `c06/S0${ids.indexOf(id) + 1}/accessibility-summary`,
          },
        }
      : {}),
    ...(paired
      ? {
          modelSelection: {
            modelId: `${id}:Modular Commission Machine`,
            scenarioId: scenario,
            initialSelectionId: selections[0]!,
            selectionIds: selections,
            allowedSelections:
              id === "C06-A01"
                ? { ACTIVE: selections, REVISION: selections }
                : {
                    "EXP-04": selections,
                    "EXP-05": selections,
                    "EXP-06": selections,
                    ACTIVE: selections,
                    REVISION: selections,
                  },
          },
        }
      : {}),
  };
}
export function createC06ActivityBindings(): readonly ExecutableActivityBinding[] {
  return Object.freeze(
    ids.map((id) => {
      const source = modelDefinition(id);
      const oracle = createC06ModelState(source);
      const ports: ActivityPorts = {
        ready: (r) => c06ResponseReady(oracle, r),
        evaluate: (r) => evaluateC06Response(oracle, r),
        completionEligible: (e) =>
          e.activityId === id &&
          e.responseRevision > 0 &&
          e.checkedRevision === e.responseRevision &&
          e.feedbackRevision === e.responseRevision &&
          (id === "C06-A01" || id === "C06-A04"
            ? e.evaluation !== null
            : e.evaluation?.outcome === "CONFIRMED"),
        sourceReviewAvailable: () => false,
        informationNeeded: () => false,
        informationReturn: () => false,
      };
      const d = definition(id);
      const modelAdapter: ActivityModelAdapter = {
        initialize: () => {
          const state = createC06ModelState(source);
          if (!("selectedChildId" in state))
            throw new TypeError("Static C06 model");
          return Object.freeze({ selectionId: state.selectedChildId, state });
        },
        select: (current, selection) => {
          const state = current.state as C06ModelState;
          const proof = projectC06PersistedModelV1(state, source);
          if (
            proof.selectedChildId !== current.selectionId ||
            !d.modelSelection?.selectionIds.includes(selection)
          )
            return null;
          return Object.freeze({
            selectionId: selection,
            state:
              selection === current.selectionId
                ? state
                : applyC06ModelIntent(state, {
                    type: "SELECT_CHILD",
                    childId: selection as typeof proof.selectedChildId,
                  }),
          });
        },
      };
      return Object.freeze({
        activityId: id,
        definition: d,
        ports,
        ...(d.modelSelection ? { modelAdapter } : {}),
      });
    }),
  );
}
const actors = new WeakMap<
  ActivityActor,
  { id: Id; registry: ActivityRegistry }
>();
function issue(actor: ActivityActor, registry: ActivityRegistry, id: Id) {
  actors.set(actor, { registry, id });
  const stop = actor.stop.bind(actor);
  actor.stop = () => {
    actors.delete(actor);
    return stop();
  };
  return actor;
}
export function createC06ActivityActor(input: unknown): ActivityActor {
  const id = identity(input);
  const registry = new ActivityRegistry(createC06ActivityBindings());
  return issue(createActivityActor(registry, id), registry, id);
}
function inspect(actor: ActivityActor) {
  const proof = actors.get(actor);
  if (!proof || actor.getSnapshot().status !== "active")
    throw new TypeError("Unissued or inactive C06 actor");
  authenticateC06BindingSource();
  const context = actor.getSnapshot().context;
  const source = modelDefinition(proof.id);
  const state = context.model
    ? (context.model.value.state as C06ModelState)
    : createC06ModelState(source);
  if (context.model) {
    const p = projectC06PersistedModelV1(state, source);
    if (p.selectedChildId !== context.model.value.selectionId)
      throw new TypeError("C06 live selection mismatch");
  }
  return {
    ...proof,
    context,
    source,
    state,
    binding: proof.registry.resolve(proof.id),
  };
}

/** All mathematical channels are exposure filtered; no oracle/model state is published. */
export function projectC06ActivityFrame(actor: ActivityActor) {
  const { id, context: c, state, binding } = inspect(actor);
  const prefix = `c06/S0${ids.indexOf(id) + 1}/`;
  const text = (role: string) => {
    const key = prefix + role;
    if (!has(c06Copy, key)) throw new TypeError("Unknown C06 copy");
    return Object.freeze({
      id: key,
      text: c06Copy[key as keyof typeof c06Copy],
    });
  };
  const expose = (role: string): Exposure => ({
    content: text(role),
    phases: [c.position],
    timing: role === "accessibility-summary" ? "CURRENT_FEEDBACK" : "PUBLIC",
  });
  const teaching = c.position === "POST_CONFIRMATION_EXPLANATION";
  const feedback =
    c.evaluation !== null &&
    c.checkedRevision === c.responseRevision &&
    ["CONFIRMATION", "RECONSIDERATION"].includes(c.position);
  const taught =
    id === "C06-A02" && !["ENTRY", "EXP-01", "EXP-02"].includes(c.position);
  const solved =
    teaching ||
    c.position === "COMPLETE" ||
    taught ||
    (id === "C06-A03" && feedback && c.evaluation?.outcome === "CONFIRMED");
  const feedbackRole =
    c.evaluation?.outcome === "CONFIRMED"
      ? "confirmation"
      : id === "C06-A01"
        ? c.evaluation?.diagnostic === "NOT_APPLICABLE"
          ? "reconsider-not-applicable"
          : "reconsider-arrangement"
        : id === "C06-A02"
          ? c.evaluation?.diagnostic === "INVARIANTS"
            ? "reconsider-invariant-values"
            : "reconsider-formula"
          : id === "C06-A03"
            ? c.evaluation?.diagnostic === "RATE"
              ? "reconsider-rate"
              : "reconsider-arrangement"
            : "relationship-help";
  const frame = projectSemanticActivityFrame({
    context: c,
    phase: c.position,
    support: c.origin === null ? "NONE" : "REVIEW",
    definition: binding.definition,
    ports: binding.ports,
    content: {
      references: [
        expose("scenario"),
        expose("task"),
        ...(teaching
          ? [
              expose("accessibility-summary"),
              ...(id === "C06-A04" ? [expose("provider-note")] : []),
              {
                content: {
                  id: `${prefix}common-ownership-explanation`,
                  text:
                    id === "C06-A01"
                      ? "Worker A: Straight Commission. Commission ₱4,000. Base Salary Not Applicable. Machine Ends at Commission. Worker B: Base-Plus-Commission. Commission ₱4,000. Base Salary ₱10,000. Total Compensation ₱14,000."
                      : "C06 Commission ₱3,600 is exported read-only to C01. C06 Total Compensation ₱18,600 stays a C06 result. The C01 allowance ₱800 remains outside C06.",
                },
                phases: [c.position],
                timing: "CURRENT_FEEDBACK" as const,
              },
            ]
          : []),
        ...(c.position === "COMPLETE" ? [expose("completion")] : []),
        ...(id === "C06-A02" && has(explanation, c.position)
          ? [
              {
                content: {
                  id: `c06/${c.position}`,
                  text:
                    c.position === "EXP-04" &&
                    "selectedChildId" in state &&
                    state.selectedChildId === "C06-S02-A"
                      ? "Select Situation B to change Sales from ₱300,000.00 to ₱500,000.00. The 3% Commission Rate, ₱15,000.00 Base Salary and Base-Plus arrangement stay fixed."
                      : explanation[c.position as keyof typeof explanation],
                },
                phases: [c.position],
                timing: "PUBLIC" as const,
              },
            ]
          : []),
      ],
      modelFacts: [],
      derivedFacts: [],
      responseContract: { id: contract(id).id, text: contract(id).id },
      responseControls: [
        {
          activityId: id,
          contractId: contract(id).id,
          version: 1,
          stage: "RESPONSE",
          controls: c06ResponseFields[id].map((role) => ({
            role,
            acceptedKinds: role.startsWith("arrangement")
              ? ["SINGLE_SELECTION"]
              : role === "baseA" || role === "baseB"
                ? ["SEMANTIC_BOUNDARY", "EXACT_QUANTITY"]
                : ["EXACT_QUANTITY"],
            ...(role.startsWith("arrangement")
              ? {
                  options: ["STRAIGHT_COMMISSION", "BASE_PLUS_COMMISSION"].map(
                    (option) => ({ id: option, text: option }),
                  ),
                }
              : {}),
          })),
        },
      ],
      ...(binding.definition.modelSelection
        ? {
            modelSelectionOptions:
              binding.definition.modelSelection.selectionIds.map(
                (selection) => ({
                  id: selection,
                  text: selection.endsWith("A")
                    ? id === "C06-A01"
                      ? "Worker A"
                      : "Situation A"
                    : id === "C06-A01"
                      ? "Worker B"
                      : "Situation B",
                }),
              ),
          }
        : {}),
      ...(feedback
        ? {
            feedback: {
              outcome: c.evaluation.outcome,
              revision: c.responseRevision,
              content: text(feedbackRole),
            },
          }
        : {}),
      review: {
        receivingActivityId: id,
        invokingPhase: c.position,
        relationships: [text("relationship-help")],
      },
    },
  });
  const publish = (s: C06ModelState) => {
    const v = deriveC06ModelState(s);
    return Object.freeze({
      sales: v.sales,
      commissionRate: v.commissionRate,
      arrangement: v.arrangement,
      ...(v.arrangement === "BASE_PLUS_COMMISSION"
        ? { baseSalary: v.baseSalary }
        : {}),
      ...(solved
        ? {
            commission: v.commission,
            ...(v.arrangement === "BASE_PLUS_COMMISSION"
              ? { totalCompensation: v.totalCompensation }
              : {}),
          }
        : {}),
    });
  };
  const displayedState =
    id === "C06-A02" && c.position === "EXP-03"
      ? applyC06ModelIntent(state, {
          type: "SELECT_CHILD",
          childId: "C06-S02-A",
        })
      : state;
  return Object.freeze({
    frame,
    response: c.response,
    model: publish(displayedState),
    comparison:
      id === "C06-A02" &&
      [
        "EXP-05",
        "EXP-06",
        "ACTIVE",
        "REVISION",
        "CONFIRMATION",
        "RECONSIDERATION",
        "COMPLETE",
      ].includes(c.position)
        ? Object.freeze(
            ["C06-S02-A", "C06-S02-B"].map((child) =>
              publish(
                applyC06ModelIntent(state, {
                  type: "SELECT_CHILD",
                  childId: child as "C06-S02-A" | "C06-S02-B",
                }),
              ),
            ),
          )
        : null,
  });
}

/** C01-S04 source review is a whitelist, not a C06 activity or learner-answer channel. */
export function readC06CommissionProvider() {
  return deriveC06ProviderOutput(
    createC06ModelState(modelDefinition("C06-A04")),
  );
}
export function projectC06SourceReview(
  receiver: unknown,
  fields: readonly string[],
) {
  data(fields);
  if (
    receiver !== "C01-S04" ||
    fields.length === 0 ||
    new Set(fields).size !== fields.length ||
    !fields.every((f) => ["sales", "rate", "commission"].includes(f))
  )
    throw new TypeError("Unauthorized C06 source review");
  const state = deriveC06ModelState(
    createC06ModelState(modelDefinition("C06-A04")),
  );
  const provider = readC06CommissionProvider();
  const values = {
    sales: state.sales,
    rate: state.commissionRate,
    commission:
      provider.result.resolution.kind === "KNOWN"
        ? provider.result.resolution.value
        : null,
  };
  return Object.freeze({
    receiver: "C01-S04",
    provenance: provider.provenance,
    fields: Object.freeze(
      fields.map((key) =>
        Object.freeze({ key, value: values[key as keyof typeof values] }),
      ),
    ),
  });
}

type RestorationInput = {
  activityId: Id;
  scenarioId: string;
  responseContract: Readonly<{ id: string; version: number }>;
  context: ActivityContext;
  model: unknown;
};
/** Restore semantic evidence only; selected domain state is always freshly source-issued. */
export function createC06RestoredActivityActor(
  input: RestorationInput,
): ActivityActor {
  data(input);
  if (
    Reflect.ownKeys(input).length !== 5 ||
    !["activityId", "scenarioId", "responseContract", "context", "model"].every(
      (k) => has(input, k),
    )
  )
    throw new TypeError("Invalid C06 restoration");
  const id = identity(input.activityId);
  const source = modelDefinition(id);
  if (
    input.scenarioId !== source.scenarioId ||
    input.context.activityId !== id ||
    Reflect.ownKeys(input.responseContract).length !== 2 ||
    input.responseContract.id !== contract(id).id ||
    input.responseContract.version !== 1
  )
    throw new TypeError("C06 restoration identity mismatch");
  const registry = new ActivityRegistry(createC06ActivityBindings());
  const binding = registry.resolve(id);
  let context = input.context;
  if (binding.modelAdapter) {
    const state = restoreC06ModelState(input.model, source);
    if (
      !("selectedChildId" in state) ||
      !context.model ||
      context.model.value.state !== null ||
      context.model.value.selectionId !== state.selectedChildId
    )
      throw new TypeError("Invalid C06 saved selection");
    context = {
      ...context,
      model: { ...context.model, value: { ...context.model.value, state } },
    };
  } else if (input.model !== null || context.model !== undefined)
    throw new TypeError("Unexpected C06 static model");
  for (const r of [context.response, context.checkedResponse])
    if (r !== null) {
      if (
        !isLearnerResponse(r) ||
        r.kind !== "COMPOSITE" ||
        !r.parts.every(({ key, response }) => {
          if (!(c06ResponseFields[id] as readonly string[]).includes(key))
            return false;
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
        })
      )
        throw new TypeError("Invalid saved C06 response");
    }
  const token = createActivityRestoration(
    binding.definition,
    binding.ports,
    context,
    binding.modelAdapter,
  );
  return issue(createActivityActor(registry, id, token), registry, id);
}
export function inspectC06RecoveryActor(actor: ActivityActor) {
  const { id, source, context, state } = inspect(actor);
  if (
    context.position === "COMPLETE" ||
    context.infoOrigin !== null ||
    (context.origin !== null && context.origin !== context.position)
  )
    throw new TypeError("C06 Recovery requires resumable work");
  return Object.freeze({
    activityId: id,
    scenarioId: source.scenarioId,
    responseContract: contract(id),
    context,
    model: context.model ? projectC06PersistedModelV1(state, source) : null,
  });
}
export function validateC06RecoveryWork(input: RestorationInput) {
  const actor = createC06RestoredActivityActor(input);
  try {
    return actor.getSnapshot().context;
  } finally {
    actor.stop();
  }
}
