import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";
import {
  createActivityMachine,
  createActivityRestoration,
  isActivityEvent,
  validateActivityDefinition,
  availableModelSelections,
  validateC04A02StageEngagementV1,
} from "./public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityPorts,
  ActivityModelAdapter,
  ActivityEvent,
} from "./public";

describe("D014/S1 semantic initialization validation", () => {
  const definition: ActivityDefinition = {
    activityId: "C04-A01",
    edges: { ENTRY: { CONTINUE: "ACTIVE" } },
    support: {},
  };
  const ports: ActivityPorts = {
    ready: () => true,
    evaluate: () => ({ outcome: "CONFIRMED", diagnostic: null }),
    completionEligible: () => true,
    sourceReviewAvailable: () => false,
    informationNeeded: () => false,
    informationReturn: () => false,
  };
  const initial = (): ActivityContext => ({
    activityId: "C04-A01",
    position: "ACTIVE",
    origin: null,
    infoOrigin: null,
    response: null,
    checkedResponse: null,
    responseRevision: 0,
    checkedRevision: null,
    feedbackRevision: null,
    hasChecked: false,
    evaluation: null,
  });
  it.each([
    "COMPLETE",
    "INFO_NEEDED",
    "EXP-01",
    "POST_CONFIRMATION_EXPLANATION",
  ] as const)("refuses inapplicable position %s", (position) => {
    expect(() =>
      createActivityRestoration(definition, ports, { ...initial(), position }),
    ).toThrow();
  });
  it("refuses unknown/accessor/prototyped evidence without invoking accessors", () => {
    const context = initial();
    const get = vi.fn(() => "ACTIVE");
    for (const bad of [
      { ...context, attempts: 1 },
      Object.create(context) as ActivityContext,
      Object.defineProperty({ ...context }, "position", { get }),
    ])
      expect(() => createActivityRestoration(definition, ports, bad)).toThrow();
    expect(get).not.toHaveBeenCalled();
  });
  it("rejects forged token and mismatched checked diagnostics", () => {
    expect(() =>
      createActivityMachine(definition, ports, undefined, {
        activityId: "C04-A01",
      }),
    ).toThrow("Unissued");
    const response = {
      kind: "SINGLE_SELECTION" as const,
      selectionId: "synthetic",
    };
    expect(() =>
      createActivityRestoration(definition, ports, {
        ...initial(),
        position: "CONFIRMATION",
        response,
        checkedResponse: response,
        responseRevision: 1,
        checkedRevision: 1,
        hasChecked: true,
        evaluation: { outcome: "CONFIRMED", diagnostic: "forged" },
      }),
    ).toThrow();
  });
});
import { ExactDecimal, quantity } from "../../core/public";
import type { LearnerResponse } from "../../core/public";
import {
  c04ResponseContracts,
  c04Scenarios,
} from "../../study/competencies/c04/public";
import {
  createC04ModelState,
  applyC04ModelIntent,
  deriveC04ModelState,
} from "../../competencies/c04-percentage-change/model/public";
import type { C04ModelDefinition } from "../../competencies/c04-percentage-change/model/public";
import { evaluateC04Response } from "../../competencies/c04-percentage-change/evaluators/public";
import type { C04EvaluationDefinition } from "../../competencies/c04-percentage-change/evaluators/public";

describe("D044/S1 bounded stage engagement", () => {
  it("strictly validates detached exact evidence without accepting delivery or arbitrary stages", () => {
    const good = {
      "EXP-02": { "C04-S02-A": true },
      "EXP-03": { "C04-S02-B": false },
    };
    const checked = validateC04A02StageEngagementV1(
      JSON.parse(JSON.stringify(good)),
    );
    expect(checked).toEqual(good);
    expect(checked).not.toBe(good);
    expect(Object.isFrozen(checked["EXP-02"])).toBe(true);
    for (const bad of [
      null,
      undefined,
      {},
      [],
      { ...good, delivered: true },
      { ...good, "EXP-02": { "C04-S02-A": 1 } },
      { ...good, "EXP-02": { "C04-S02-B": true } },
      { ...good, "EXP-04": {} },
      { ...good, "EXP-03": { "C04-S02-B": false, revision: 2 } },
      Object.create(good),
      Object.defineProperty({ ...good }, "EXP-02", {
        get: () => {
          throw new Error("must not run");
        },
      }),
    ])
      expect(() => validateC04A02StageEngagementV1(bad)).toThrow(TypeError);
  });

  const definition: ActivityDefinition = {
    activityId: "C04-A02",
    edges: {
      ENTRY: { CONTINUE: "EXP-01" },
      "EXP-01": { CONTINUE: "EXP-02" },
      "EXP-02": { CONTINUE: "EXP-03", PREVIOUS: "EXP-01" },
      "EXP-03": { CONTINUE: "EXP-04", PREVIOUS: "EXP-02" },
      "EXP-04": { CONTINUE: "ACTIVE", PREVIOUS: "EXP-03" },
    },
    support: { "EXP-02": ["REVIEW", "REINFORCEMENT"] },
    modelSelection: {
      modelId: "fixture",
      scenarioId: "C04-S02",
      initialSelectionId: "C04-S02-A",
      selectionIds: ["C04-S02-A", "C04-S02-B"],
      allowedSelections: {
        "EXP-02": ["C04-S02-A"],
        "EXP-03": ["C04-S02-B"],
        ACTIVE: ["C04-S02-A", "C04-S02-B"],
      },
    },
  };
  const issue = (selectionId: string) => ({
    selectionId,
    state: Object.freeze({}),
  });
  const make = (
    select: ActivityModelAdapter["select"] = (_, id) => issue(id),
  ) =>
    createActor(
      createActivityMachine(definition, ports(), {
        initialize: () => issue("C04-S02-A"),
        select,
      }),
    ).start();
  const advance = (a: ReturnType<typeof make>, count = 1) => {
    for (let i = 0; i < count; i++) a.send({ type: "CONTINUE" });
  };
  const select = (a: ReturnType<typeof make>, selectionId: string) => {
    const c = a.getSnapshot().context;
    a.send({
      type: "SELECT_MODEL_CHILD",
      modelId: c.model!.modelId,
      revision: c.model!.revision,
      position: c.position,
      selectionId,
    });
  };
  const evidence = (a: ReturnType<typeof make>) =>
    a.getSnapshot().context.c04A02StageEngagement!;

  it("distinguishes A then B from B twice despite equal final selection and revision", () => {
    const a = make(),
      b = make();
    advance(a, 2);
    advance(b, 2);
    select(a, "C04-S02-A");
    advance(a);
    advance(b);
    select(a, "C04-S02-B");
    select(b, "C04-S02-B");
    select(b, "C04-S02-B");
    advance(a);
    advance(b);
    expect(a.getSnapshot().context.model?.revision).toBe(2);
    expect(b.getSnapshot().context.model?.revision).toBe(2);
    expect(a.getSnapshot().context.position).toBe("EXP-04");
    expect(b.getSnapshot().context.position).toBe("EXP-04");
    expect(a.getSnapshot().context.model?.value.selectionId).toBe(
      b.getSnapshot().context.model?.value.selectionId,
    );
    expect(evidence(a)).toEqual({
      "EXP-02": { "C04-S02-A": true },
      "EXP-03": { "C04-S02-B": true },
    });
    expect(evidence(b)).toEqual({
      "EXP-02": { "C04-S02-A": false },
      "EXP-03": { "C04-S02-B": true },
    });
    a.stop();
    b.stop();
  });

  it("initialization, unauthorized/stale/wrong-position events and navigation create no evidence", () => {
    const a = make();
    select(a, "C04-S02-A");
    advance(a, 2);
    select(a, "C04-S02-B");
    for (const patch of [
      { revision: 99 },
      { modelId: "wrong" },
      { position: "EXP-03" as const },
    ])
      a.send({
        type: "SELECT_MODEL_CHILD",
        modelId: "fixture",
        revision: 0,
        position: "EXP-02",
        selectionId: "C04-S02-A",
        ...patch,
      });
    a.send({ type: "PREVIOUS" });
    advance(a);
    expect(evidence(a)["EXP-02"]["C04-S02-A"]).toBe(false);
    expect(evidence(a)["EXP-03"]["C04-S02-B"]).toBe(false);
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    a.stop();
  });

  it.each(["reject", "throw", "same", "malformed"])(
    "does not count an adapter %s",
    (mode) => {
      const a = make((current, id) => {
        if (mode === "throw") throw new Error("rejected");
        if (mode === "same") return current;
        if (mode === "malformed") return { selectionId: id, state: null };
        return null;
      });
      advance(a, 2);
      select(a, "C04-S02-A");
      expect(evidence(a)["EXP-02"]["C04-S02-A"]).toBe(false);
      expect(a.getSnapshot().context.model?.revision).toBe(0);
      a.stop();
    },
  );

  it("preserves frozen presence across re-entry and support; Review selections remain rejected", () => {
    const a = make();
    advance(a, 2);
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(evidence(a)["EXP-02"]["C04-S02-A"]).toBe(false);
    select(a, "C04-S02-A");
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    expect(evidence(a)["EXP-02"]["C04-S02-A"]).toBe(false);
    a.send({ type: "CLOSE_SUPPORT" });
    select(a, "C04-S02-A");
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(2);
    expect(evidence(a)["EXP-02"]["C04-S02-A"]).toBe(true);
    const saved = evidence(a);
    expect(Object.isFrozen(saved)).toBe(true);
    expect(Object.isFrozen(saved["EXP-02"])).toBe(true);
    expect(Object.isFrozen(saved["EXP-03"])).toBe(true);
    a.send({ type: "CLOSE_SUPPORT" });
    a.send({ type: "PREVIOUS" });
    advance(a);
    a.send({ type: "OPEN_SUPPORT", mode: "REINFORCEMENT" });
    a.send({ type: "CLOSE_SUPPORT" });
    expect(evidence(a)).toEqual(saved);
    advance(a, 3);
    select(a, "C04-S02-B");
    expect(evidence(a)["EXP-03"]["C04-S02-B"]).toBe(false);
    a.stop();
  });
});

// Fixtures below exercise injected contracts; they are NOT canonical source manifests.

// The five explicit C04-A02 explanation steps and A01 direct entry are C3-authorized routes.
const a02: ActivityDefinition = {
  activityId: "C04-A02",
  edges: {
    ENTRY: { CONTINUE: "EXP-01" },
    "EXP-01": { CONTINUE: "EXP-02" },
    "EXP-02": { CONTINUE: "EXP-03", PREVIOUS: "EXP-01" },
    "EXP-03": { CONTINUE: "EXP-04", PREVIOUS: "EXP-02" },
    "EXP-04": { CONTINUE: "EXP-05", PREVIOUS: "EXP-03" },
    "EXP-05": { CONTINUE: "ACTIVE", PREVIOUS: "EXP-04" },
  },
  support: { "EXP-02": ["REVIEW", "REINFORCEMENT"], ACTIVE: ["REVIEW"] },
};
const a01: ActivityDefinition = {
  activityId: "C04-A01",
  edges: { ENTRY: { CONTINUE: "ACTIVE" } },
  support: { ACTIVE: ["REVIEW"] },
};

describe("synthetic actor-local model compatibility", () => {
  const definition: ActivityDefinition = {
    ...a02,
    modelSelection: {
      modelId: "synthetic-model",
      scenarioId: "C04-S02",
      initialSelectionId: "A",
      selectionIds: ["A", "B"],
      allowedSelections: {
        "EXP-02": ["A"],
        "EXP-03": ["B"],
        ACTIVE: ["A", "B"],
        REVISION: ["A", "B"],
      },
    },
  };
  const issue = (selectionId: string) => ({
    selectionId,
    state: Object.freeze({ selectionId, privateTruth: "HIDDEN" }),
  });
  const adapter = (): ActivityModelAdapter => ({
    initialize: vi.fn(() => issue("A")),
    select: vi.fn(
      (_current: import("./public").ActivityModelValue, id: string) =>
        issue(id),
    ),
  });
  const event = (
    a: ReturnType<typeof actor>,
    selectionId: string,
  ): ActivityEvent => ({
    type: "SELECT_MODEL_CHILD",
    modelId: "synthetic-model",
    selectionId,
    revision: a.getSnapshot().context.model!.revision,
    position: a.getSnapshot().context.position,
  });
  const make = (dependency = adapter()) =>
    createActor(createActivityMachine(definition, ports(), dependency)).start();
  const advance = (a: ReturnType<typeof make>, count: number) => {
    for (let i = 0; i < count; i++) a.send({ type: "CONTINUE" });
  };

  it("initializes once per actor sharing logic, without answer or check evidence", () => {
    const dependency = adapter();
    const logic = createActivityMachine(definition, ports(), dependency);
    const a = createActor(logic).start();
    const b = createActor(logic).start();
    expect(dependency.initialize).toHaveBeenCalledTimes(2);
    expect(a.getSnapshot().context.model!.value.state).not.toBe(
      b.getSnapshot().context.model!.value.state,
    );
    expect(a.getSnapshot().context.model).toMatchObject({
      revision: 0,
      value: { selectionId: "A" },
    });
    expect(a.getSnapshot().context).toMatchObject({
      response: null,
      responseRevision: 0,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
    });
    a.stop();
    b.stop();
  });
  it("retains genuine T022 issuance across actor assignment without structural cloning", () => {
    const source: C04ModelDefinition = {
      activityId: "C04-A02",
      scenarioId: "C04-S02",
      cases: [
        {
          childId: "C04-S02-A",
          original: {
            role: "C04-S02-A Original",
            value: quantity(
              ExactDecimal.from("20000"),
              "MONETARY_AMOUNT",
              "PHP",
              "per month",
            ),
          },
          newValue: {
            role: "C04-S02-A New",
            value: quantity(
              ExactDecimal.from("22000"),
              "MONETARY_AMOUNT",
              "PHP",
              "per month",
            ),
          },
        },
        {
          childId: "C04-S02-B",
          original: {
            role: "C04-S02-B Original",
            value: quantity(
              ExactDecimal.from("10000"),
              "MONETARY_AMOUNT",
              "PHP",
              "per month",
            ),
          },
          newValue: {
            role: "C04-S02-B New",
            value: quantity(
              ExactDecimal.from("12000"),
              "MONETARY_AMOUNT",
              "PHP",
              "per month",
            ),
          },
        },
      ],
    };
    const dependency: ActivityModelAdapter = {
      initialize: () => {
        const state = createC04ModelState(source);
        deriveC04ModelState(state);
        return { selectionId: "A", state };
      },
      select: (current, selectionId) => {
        const state = applyC04ModelIntent(
          current.state as ReturnType<typeof createC04ModelState>,
          {
            type: "SELECT_CHILD",
            childId: selectionId === "A" ? "C04-S02-A" : "C04-S02-B",
          },
        );
        deriveC04ModelState(state);
        return { selectionId, state };
      },
    };
    const a = make(dependency);
    const initial = a.getSnapshot().context.model!.value.state as ReturnType<
      typeof createC04ModelState
    >;
    expect(deriveC04ModelState(initial).state).toBe(initial);
    advance(a, 3);
    a.send(event(a, "B"));
    const selected = a.getSnapshot().context.model!.value.state as ReturnType<
      typeof createC04ModelState
    >;
    expect(deriveC04ModelState(selected).state.selectedChildId).toBe(
      "C04-S02-B",
    );
    expect(selected).not.toBe(initial);
    expect(() => deriveC04ModelState(structuredClone(selected))).toThrow(
      "Unissued",
    );
    a.stop();
  });
  it("fails closed on missing adapter and invalid initialization", () => {
    expect(() => createActivityMachine(definition, ports())).toThrow(
      "supplied together",
    );
    const dependency = { ...adapter(), initialize: () => issue("B") };
    const a = createActor(
      createActivityMachine(definition, ports(), dependency),
    );
    expect(a.getSnapshot().status).toBe("error");
    expect(a.getSnapshot().error).toBeInstanceOf(TypeError);
    expect(actor().getSnapshot().context).not.toHaveProperty("model");
  });
  it("fails closed on unsafe current revisions, malformed evidence and information origins", () => {
    const a = make();
    advance(a, 2);
    const context = a.getSnapshot().context;
    for (const revision of [
      -1,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER + 1,
      NaN,
    ])
      expect(
        availableModelSelections(
          { ...context, model: { ...context.model!, revision } },
          definition.modelSelection,
        ),
      ).toEqual([]);
    expect(
      availableModelSelections(
        { ...context, infoOrigin: "EXP-02" },
        definition.modelSelection,
      ),
    ).toEqual([]);
    expect(
      availableModelSelections(
        {
          ...context,
          model: { ...context.model!, value: null },
        } as unknown as typeof context,
        definition.modelSelection,
      ),
    ).toEqual([]);
    a.stop();
  });
  it("permits same-child engagement once, separates responses and isolates actors", () => {
    const dependency = adapter();
    const a = make(dependency);
    const b = make();
    advance(a, 2);
    advance(b, 3);
    const before = a.getSnapshot().context;
    a.send(event(a, "A"));
    b.send(event(b, "B"));
    expect(dependency.select).toHaveBeenCalledTimes(1);
    const { model: previous, ...oldAnswer } = before;
    const { model: current, ...newAnswer } = a.getSnapshot().context;
    expect(newAnswer).toEqual(oldAnswer);
    expect(current!.revision).toBe(1);
    expect(current!.value.state).not.toBe(previous!.value.state);
    expect(b.getSnapshot().context.model!.value.selectionId).toBe("B");
    a.stop();
    b.stop();
  });
  it.each([
    { selectionId: "B" },
    { selectionId: "unknown" },
    { modelId: "wrong" },
    { revision: 1 },
    { revision: Number.MAX_SAFE_INTEGER + 1 },
    { position: "EXP-03" },
    { extra: true },
  ])(
    "rejects invalid or stale event %j without semantic mutation",
    (override) => {
      const dependency = adapter();
      const a = make(dependency);
      advance(a, 2);
      const before = a.getSnapshot().context;
      a.send({ ...event(a, "A"), ...override } as ActivityEvent);
      expect(a.getSnapshot().context).toEqual(before);
      expect(dependency.select).not.toHaveBeenCalled();
      a.stop();
    },
  );
  it.each(["null", "throw", "wrong", "mutable", "same"])(
    "retains all evidence on adapter %s",
    (mode) => {
      const dependency: ActivityModelAdapter = {
        initialize: () => issue("A"),
        select: (current) => {
          if (mode === "throw") throw new Error("rejected");
          if (mode === "null") return null;
          if (mode === "same") return current;
          if (mode === "mutable") return { selectionId: "A", state: {} };
          return issue("B");
        },
      };
      const a = make(dependency);
      advance(a, 2);
      const before = a.getSnapshot().context;
      a.send(event(a, "A"));
      expect(a.getSnapshot().context).toEqual(before);
      a.stop();
    },
  );
  it("retains B on A-focused re-entry and exact Review origin; navigation never selects", () => {
    const dependency = adapter();
    const a = make(dependency);
    advance(a, 3);
    a.send(event(a, "B"));
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.position).toBe("EXP-02");
    expect(a.getSnapshot().context.model!.value.selectionId).toBe("B");
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    const before = a.getSnapshot().context;
    a.send(event(a, "A"));
    expect(a.getSnapshot().context).toEqual(before);
    expect(before.origin).toBe("EXP-02");
    a.send({ type: "CLOSE_SUPPORT" });
    expect(a.getSnapshot().context.model).toBe(before.model);
    expect(dependency.select).toHaveBeenCalledTimes(1);
    a.stop();
  });
  it("rejects prohibited positions and preserves model through Check, Revise and Complete", () => {
    const a = make();
    a.send(event(a, "A"));
    expect(a.getSnapshot().context.model!.revision).toBe(0);
    advance(a, 1);
    a.send(event(a, "A"));
    expect(a.getSnapshot().context.model!.revision).toBe(0);
    advance(a, 3);
    a.send(event(a, "A"));
    expect(a.getSnapshot().context.model!.revision).toBe(0);
    advance(a, 1);
    a.send(event(a, "A"));
    expect(a.getSnapshot().context.model!.revision).toBe(0);
    advance(a, 1);
    a.send(event(a, "B"));
    a.send({ type: "RESPONSE_CHANGED", response });
    const answer = a.getSnapshot().context.response;
    a.send(event(a, "A"));
    expect(a.getSnapshot().context.response).toBe(answer);
    a.send({ type: "CHECK_RESPONSE" });
    const checked = a.getSnapshot().context;
    a.send(event(a, "B"));
    expect(a.getSnapshot().context).toEqual(checked);
    a.send({ type: "REVISE" });
    a.send(event(a, "B"));
    expect(a.getSnapshot().context.model!.revision).toBe(3);
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_AGAIN" });
    a.send({
      type: "FEEDBACK_DELIVERED",
      revision: a.getSnapshot().context.responseRevision,
    });
    a.send({ type: "FINISH_ACTIVITY" });
    const complete = a.getSnapshot().context;
    expect(complete.position).toBe("COMPLETE");
    a.send(event(a, "A"));
    expect(a.getSnapshot().context).toEqual(complete);
    a.stop();
  });
});
// Synthetic optional route; not the production C04-A04 manifest.
const post: ActivityDefinition = {
  activityId: "C04-A04",
  edges: {
    ENTRY: { CONTINUE: "ACTIVE" },
    CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
  },
  support: { POST_CONFIRMATION_EXPLANATION: ["REVIEW"] },
};
const response = {
  kind: "SINGLE_SELECTION" as const,
  selectionId: "learner-choice",
};
const ports = (
  outcome: "CONFIRMED" | "RECONSIDERATION" = "CONFIRMED",
  eligible = true,
): ActivityPorts => ({
  ready: () => true,
  evaluate: () => ({
    outcome,
    diagnostic: outcome === "CONFIRMED" ? null : "RECONSIDER_INTERPRETATION",
  }),
  completionEligible: () => eligible,
  sourceReviewAvailable: () => false,
  informationNeeded: () => false,
  informationReturn: () => false,
});
const actor = (definition = a01, dependencies = ports()) => {
  const instance = createActor(
    createActivityMachine(definition, dependencies),
  ).start();
  return instance;
};

// Explicitly synthetic compatibility definition; not a production C04 binding.
const staged: ActivityDefinition = {
  ...post,
  edges: {
    ...post.edges,
    RECONSIDERATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
  },
  support: {
    ACTIVE: ["REVIEW"],
    REVISION: ["REVIEW"],
    POST_CONFIRMATION_EXPLANATION: ["REVIEW"],
  },
  responseStages: {
    contractId: "synthetic-staged-v1",
    version: 1,
    scenarioId: "C04-S04",
    primaryFields: [
      {
        key: "difference",
        acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
        quantityKind: "MONETARY_AMOUNT",
        unit: "PHP",
        basis: "per month",
      },
      {
        key: "percentage",
        acceptedKinds: ["EXACT_QUANTITY", "SEMANTIC_BOUNDARY"],
        quantityKind: "PERCENTAGE_CHANGE",
        unit: "%",
        basis: null,
      },
    ],
    reasoningField: "explanation",
    optionIds: ["synthetic-correct", "synthetic-wrong"],
  },
  terminalTeaching: { outcomes: "BOTH", contentId: "synthetic-boundary" },
};
const primary = (amount = "999", percentage = "100"): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: [
    {
      key: "difference",
      response: {
        kind: "EXACT_QUANTITY",
        value: quantity(
          ExactDecimal.from(amount),
          "MONETARY_AMOUNT",
          "PHP",
          "per month",
        ),
      },
    },
    {
      key: "percentage",
      response: {
        kind: "EXACT_QUANTITY",
        value: quantity(
          ExactDecimal.from(percentage),
          "PERCENTAGE_CHANGE",
          "%",
          null,
        ),
      },
    },
  ],
});
const explained = (
  response: LearnerResponse,
  selectionId = "synthetic-wrong",
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: [
    ...(response.kind === "COMPOSITE" ? response.parts : []),
    { key: "explanation", response: { kind: "SINGLE_SELECTION", selectionId } },
  ],
});

describe("synthetic staged response and both-outcome compatibility", () => {
  it("adapts the four actual Study option banks to unchanged T023 without production actor bindings", () => {
    const exact = (amount: string, percent = false) => ({
      kind: "EXACT_QUANTITY" as const,
      value: quantity(
        ExactDecimal.from(amount),
        percent ? "PERCENTAGE_CHANGE" : "MONETARY_AMOUNT",
        percent ? "%" : "PHP",
        percent ? null : "per month",
      ),
    });
    const numerical = [
      { original: exact("18000"), new: exact("18000"), difference: exact("0") },
      {
        differenceA: exact("2000"),
        differenceB: exact("2000"),
        percentageA: exact("10", true),
        percentageB: exact("20", true),
      },
      {
        original: exact("30000"),
        new: exact("27000"),
        difference: exact("-3000"),
        percentage: exact("-10", true),
      },
      {
        difference: exact("1500"),
        percentage: {
          kind: "SEMANTIC_BOUNDARY" as const,
          resolution: {
            kind: "UNDEFINED" as const,
            reason: "Original value is zero",
          },
        },
      },
    ];
    c04ResponseContracts.forEach((contract, index) => {
      const scenario = c04Scenarios[index]!;
      const cases = (index === 1 ? ["C04-S02-A", "C04-S02-B"] : [null]).map(
        (childId, pairIndex) => {
          const original = scenario.facts[pairIndex * 2]!;
          const next = scenario.facts[pairIndex * 2 + 1]!;
          if (
            original.resolution.kind !== "KNOWN" ||
            next.resolution.kind !== "KNOWN"
          )
            throw new Error("Unestablished source fact");
          return {
            childId,
            original: { role: original.key, value: original.resolution.value },
            newValue: { role: next.key, value: next.resolution.value },
          };
        },
      );
      const state = createC04ModelState({
        activityId: contract.activityId,
        scenarioId: contract.scenarioId,
        cases,
      } as C04ModelDefinition);
      const choice = contract.choices[0]!;
      const required = Object.entries(numerical[index]!);
      const definition = {
        state,
        fields: [...required.map(([key]) => key), choice.role],
        choices: [
          {
            key: choice.role,
            options: choice.options.map((option) => option.id),
            correctId: choice.correctId,
          },
        ],
      } as C04EvaluationDefinition;
      for (const option of choice.options) {
        const response = {
          kind: "COMPOSITE",
          parts: [
            ...required.map(([key, response]) => ({ key, response })),
            {
              key: choice.role,
              response: { kind: "SINGLE_SELECTION", selectionId: option.id },
            },
          ],
        };
        expect(evaluateC04Response(definition, response).outcome).toBe(
          option.id === choice.correctId ? "CONFIRMED" : "RECONSIDERATION",
        );
      }
      expect(() =>
        evaluateC04Response(definition, {
          kind: "COMPOSITE",
          parts: required.map(([key, response]) => ({ key, response })),
        }),
      ).toThrow();
    });
  });
  it("commits semantic boundaries without grading, rejects wrong representations, and blocks support-stage mutation", () => {
    const a = actor(staged);
    a.send({ type: "CONTINUE" });
    const invalid = {
      kind: "COMPOSITE",
      parts: [
        {
          key: "difference",
          response: {
            kind: "EXACT_QUANTITY",
            value: quantity(
              ExactDecimal.from("5"),
              "MONETARY_AMOUNT",
              "USD",
              "per month",
            ),
          },
        },
      ],
    } as const;
    a.send({ type: "RESPONSE_CHANGED", response: invalid });
    expect(a.getSnapshot().context.response).toBeNull();
    for (const resolution of [
      { kind: "UNDEFINED", reason: "Original value is zero" },
      { kind: "UNKNOWN", reason: "learner judgment" },
      { kind: "NOT_APPLICABLE" },
    ] as const) {
      const response: LearnerResponse = {
        kind: "COMPOSITE",
        parts: [
          {
            key: "difference",
            response: {
              kind: "EXACT_QUANTITY",
              value: quantity(
                ExactDecimal.from("1500"),
                "MONETARY_AMOUNT",
                "PHP",
                "per month",
              ),
            },
          },
          {
            key: "percentage",
            response: { kind: "SEMANTIC_BOUNDARY", resolution },
          },
        ],
      };
      a.send({ type: "RESPONSE_CHANGED", response });
      a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      const during = a.getSnapshot().context;
      expect(during.responseStage).toBe("REASONING");
      expect(during.evaluation).toBeNull();
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      const supported = a.getSnapshot().context;
      a.send({ type: "RETURN_TO_PRIMARY" });
      a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      a.send({ type: "RESPONSE_CHANGED", response: explained(response) });
      a.send({ type: "CHECK_RESPONSE" });
      expect(a.getSnapshot().context).toBe(supported);
      a.send({ type: "CLOSE_SUPPORT" });
      expect(a.getSnapshot().context.responseStage).toBe("REASONING");
      a.send({ type: "RETURN_TO_PRIMARY" });
      expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    }
    a.stop();
  });
  it("commits incorrect structural values without evaluation, locks primary and retains first evidence across revisions", () => {
    let evaluations = 0;
    const a = actor(staged, {
      ...ports("RECONSIDERATION"),
      evaluate: (response) => {
        evaluations++;
        expect(response.kind).toBe("COMPOSITE");
        return {
          outcome: "RECONSIDERATION",
          diagnostic: "RECONSIDER_UNDEFINED",
        };
      },
    });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    a.send({ type: "CONTINUE" });
    const submitted = primary();
    a.send({ type: "RESPONSE_CHANGED", response: submitted });
    a.send({ type: "CHECK_RESPONSE" });
    expect(evaluations).toBe(0);
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.responseStage).toBe("PRIMARY");
    a.send({ type: "CLOSE_SUPPORT" });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    const first = a.getSnapshot().context.firstPrimaryCommitment!;
    expect(first.reasoningPreviouslyExposed).toBe(false);
    expect(Object.isFrozen(first.response)).toBe(true);
    expect(first.response).not.toBe(submitted);
    expect(evaluations).toBe(0);
    expect(a.getSnapshot().context).toMatchObject({
      responseStage: "REASONING",
      hasChecked: false,
      evaluation: null,
      feedbackRevision: null,
    });
    a.send({ type: "RESPONSE_CHANGED", response: explained(primary("1500")) });
    expect(a.getSnapshot().context.responseRevision).toBe(1);
    a.send({
      type: "RESPONSE_CHANGED",
      response: explained(submitted, "unknown"),
    });
    expect(a.getSnapshot().context.responseRevision).toBe(1);
    a.send({ type: "RESPONSE_CHANGED", response: explained(submitted) });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "CHECK_RESPONSE" });
    expect(evaluations).toBe(1);
    expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
    a.send({ type: "FEEDBACK_DELIVERED", revision: 2 });
    a.send({ type: "REVISE" });
    expect(a.getSnapshot().context).toMatchObject({
      position: "REVISION",
      responseStage: "PRIMARY",
      currentPrimaryCommitment: null,
      hasChecked: true,
      checkedRevision: null,
      feedbackRevision: null,
    });
    expect(a.getSnapshot().context.firstPrimaryCommitment).toBe(first);
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(
      a.getSnapshot().context.currentPrimaryCommitment
        ?.reasoningPreviouslyExposed,
    ).toBe(true);
    a.send({ type: "RETURN_TO_PRIMARY" });
    expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: explained(
        a.getSnapshot().context.currentPrimaryCommitment!.response,
      ),
    });
    a.send({ type: "CHECK_RESPONSE" });
    expect(evaluations).toBe(1);
    a.send({ type: "CHECK_AGAIN" });
    expect(evaluations).toBe(2);
    expect(a.getSnapshot().context.firstPrimaryCommitment).toBe(first);
    expect(() => Object.assign(first, { sequence: 100 })).toThrow();
    a.stop();
  });
  it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
    "requires actual feedback and independently acknowledged teaching for %s",
    (outcome) => {
      const a = actor(staged, ports(outcome));
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response: primary() });
      a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      a.send({ type: "RESPONSE_CHANGED", response: explained(primary()) });
      a.send({ type: "CHECK_RESPONSE" });
      a.send({ type: "CONTINUE" });
      expect(a.getSnapshot().context.position).not.toBe(
        "POST_CONFIRMATION_EXPLANATION",
      );
      const revision = a.getSnapshot().context.responseRevision;
      a.send({ type: "FEEDBACK_DELIVERED", revision });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
      a.send({ type: "CONTINUE" });
      expect(a.getSnapshot().context.evaluation?.outcome).toBe(outcome);
      for (const [r, contentId] of [
        [revision - 1, "synthetic-boundary"],
        [revision, "wrong-reference"],
      ] as const)
        a.send({ type: "TERMINAL_TEACHING_DELIVERED", revision: r, contentId });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.terminalTeachingRevision).toBeNull();
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      const during = a.getSnapshot().context;
      for (const type of [
        "COMMIT_PRIMARY_RESPONSE",
        "RETURN_TO_PRIMARY",
        "CHECK_AGAIN",
        "FINISH_ACTIVITY",
      ] as const)
        a.send({ type });
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision,
        contentId: "synthetic-boundary",
      });
      expect(a.getSnapshot().context).toBe(during);
      a.send({ type: "CLOSE_SUPPORT" });
      // Test simulates trusted delivery; source projection alone is not delivery.
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision,
        contentId: "synthetic-boundary",
      });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      expect(a.getSnapshot().context.evaluation?.outcome).toBe(outcome);
      a.stop();
    },
  );
  it("rejects malformed policies/events, partial primary commitments and legacy staging events", () => {
    for (const definition of [
      {
        ...staged,
        terminalTeaching: { outcomes: "CONFIRMED", contentId: "x" },
      },
      { ...staged, responseStages: { ...staged.responseStages!, version: 0 } },
      {
        ...staged,
        responseStages: { ...staged.responseStages!, optionIds: ["x", "x"] },
      },
      {
        ...staged,
        responseStages: {
          ...staged.responseStages!,
          reasoningField: "difference",
        },
      },
      { ...staged, edges: post.edges },
    ])
      expect(() => validateActivityDefinition(definition)).toThrow();
    expect(
      isActivityEvent({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision: 1,
        contentId: "x",
        extra: true,
      }),
    ).toBe(false);
    const a = actor(staged);
    a.send({ type: "CONTINUE" });
    const partial: LearnerResponse = { kind: "COMPOSITE", parts: [] };
    a.send({ type: "RESPONSE_CHANGED", response: partial });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    a.send({
      type: "RESPONSE_CHANGED",
      response: {
        kind: "COMPOSITE",
        parts: [
          {
            key: "percentage",
            response: {
              kind: "SEMANTIC_BOUNDARY",
              resolution: { kind: "UNKNOWN", reason: "learner judgment" },
            },
          },
        ],
      },
    });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    a.send({ type: "RESPONSE_CHANGED", response: explained(primary()) });
    expect(a.getSnapshot().context.responseRevision).toBe(1);
    a.stop();
    const legacy = actor();
    legacy.send({ type: "CONTINUE" });
    const before = legacy.getSnapshot().context;
    legacy.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    legacy.send({ type: "RETURN_TO_PRIMARY" });
    expect(legacy.getSnapshot().context).toBe(before);
    legacy.stop();
  });
});

describe("shared parallel activity grammar", () => {
  it("requires a declared, current, learner-controlled post-confirmation route and preserves exact Review origin", () => {
    expect(() => validateActivityDefinition(post)).not.toThrow();
    const a = actor(post);
    a.send({ type: "CONTINUE" });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "CONTINUE" });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("CONFIRMATION");
    a.send({ type: "FEEDBACK_DELIVERED", revision: 0 });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("CONFIRMATION");
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    const evidence = a.getSnapshot().context;
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("CONFIRMATION");
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "postConfirmationExplanation",
      support: "none",
    });
    expect(a.getSnapshot().context).toMatchObject({
      hasChecked: true,
      responseRevision: evidence.responseRevision,
      checkedRevision: evidence.checkedRevision,
      feedbackRevision: evidence.feedbackRevision,
      checkedResponse: evidence.checkedResponse,
      evaluation: evidence.evaluation,
    });
    a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    expect(a.getSnapshot().value).toHaveProperty("support", "none");
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(a.getSnapshot().context.origin).toBe(
      "POST_CONFIRMATION_EXPLANATION",
    );
    const during = a.getSnapshot().context;
    for (const type of [
      "CONTINUE",
      "FINISH_ACTIVITY",
      "REVISE",
      "CHECK_AGAIN",
    ] as const)
      a.send({ type });
    expect(a.getSnapshot().context).toEqual(during);
    a.send({ type: "CLOSE_SUPPORT" });
    expect(a.getSnapshot().context.position).toBe(
      "POST_CONFIRMATION_EXPLANATION",
    );
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe(
      "POST_CONFIRMATION_EXPLANATION",
    );
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("COMPLETE");
    a.stop();
  });

  it("rejects undeclared or conflicting destinations and preserves legacy/reconsideration Finish", () => {
    for (const edges of [
      { ENTRY: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" } },
      { ENTRY: { CONTINUE: "ACTIVE" }, CONFIRMATION: { CONTINUE: "ACTIVE" } },
      {
        ENTRY: { CONTINUE: "ACTIVE" },
        CONFIRMATION: { PREVIOUS: "POST_CONFIRMATION_EXPLANATION" },
      },
      {
        ENTRY: { CONTINUE: "ACTIVE" },
        CONFIRMATION: {
          CONTINUE: "POST_CONFIRMATION_EXPLANATION",
          PREVIOUS: "ACTIVE",
        },
      },
    ])
      expect(() => validateActivityDefinition({ ...post, edges })).toThrow();
    for (const definition of [a01, post]) {
      const a = actor(definition, ports("RECONSIDERATION"));
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response });
      a.send({ type: "CHECK_RESPONSE" });
      a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      a.send({ type: "CONTINUE" });
      expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      a.stop();
    }
  });
  it("does not progress on missing check or feedback, and Finish still obeys completion eligibility", () => {
    const a = actor(post, ports("CONFIRMED", false));
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    a.send({ type: "CONTINUE" });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe(
      "POST_CONFIRMATION_EXPLANATION",
    );
    a.stop();
    const legacy = actor(a01);
    legacy.send({ type: "CONTINUE" });
    legacy.send({ type: "RESPONSE_CHANGED", response });
    legacy.send({ type: "CHECK_RESPONSE" });
    legacy.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    legacy.send({ type: "CONTINUE" });
    expect(legacy.getSnapshot().context.position).toBe("CONFIRMATION");
    legacy.send({ type: "FINISH_ACTIVITY" });
    expect(legacy.getSnapshot().context.position).toBe("COMPLETE");
    legacy.stop();
  });
  it("constructs at ENTRY/NONE and follows only explicit explanation edges", () => {
    const a = actor(a02);
    expect(a.getSnapshot().value).toEqual({
      instructional: "entry",
      support: "none",
    });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-01");
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.position).toBe("EXP-01");
    a.send({ type: "CONTINUE" });
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.position).toBe("EXP-01");
    for (let index = 0; index < 5; index++) a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "active",
      support: "none",
    });
    a.stop();
  });

  it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
    "checks, delivers feedback, and completes %s without scoring",
    (outcome) => {
      const a = actor(a01, ports(outcome));
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().value).toEqual({
        instructional: "active",
        support: "none",
      });
      a.send({ type: "CHECK_RESPONSE" });
      expect(a.getSnapshot().value).toEqual({
        instructional:
          outcome === "CONFIRMED" ? "confirmation" : "reconsideration",
        support: "none",
      });
      expect(a.getSnapshot().context.checkedRevision).toBe(1);
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe(
        outcome === "CONFIRMED" ? "CONFIRMATION" : "RECONSIDERATION",
      );
      a.send({ type: "FEEDBACK_DELIVERED", revision: 0 });
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().value).toEqual({
        instructional: "complete",
        support: "none",
      });
      a.stop();
    },
  );

  it("revision invalidates the old check and feedback until new check and delivery", () => {
    const a = actor(a01, ports("RECONSIDERATION"));
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    a.send({ type: "REVISE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { ...response, selectionId: "revision" },
    });
    expect(a.getSnapshot().context).toMatchObject({
      responseRevision: 2,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
    });
    a.send({ type: "FINISH_ACTIVITY" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    expect(a.getSnapshot().value).toEqual({
      instructional: "revision",
      support: "none",
    });
    a.send({ type: "CHECK_AGAIN" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 2 });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "complete",
      support: "none",
    });
    a.stop();
  });

  it("holds exact EXP origin, blocks advancement during review, and permits transient reinforcement", () => {
    const a = actor(a02);
    a.send({ type: "CONTINUE" });
    a.send({ type: "CONTINUE" });
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    const before = a.getSnapshot().context;
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    expect(a.getSnapshot().context).toEqual(before);
    expect(a.getSnapshot().value).toEqual({
      instructional: "exp",
      support: "review",
    });
    a.send({ type: "CLOSE_SUPPORT" });
    expect(a.getSnapshot().context.position).toBe("EXP-02");
    a.send({ type: "OPEN_SUPPORT", mode: "REINFORCEMENT" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "exp",
      support: "reinforcement",
    });
    a.send({ type: "CLOSE_SUPPORT" });
    expect(a.getSnapshot().context.position).toBe("EXP-02");
    a.stop();
  });

  it("rejects unsupported source review, unknown events and forged fields without mutation", () => {
    const a = actor();
    a.send({ type: "CONTINUE" });
    const before = a.getSnapshot();
    a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    a.send({ type: "CLOSE_SUPPORT" });
    a.send({ type: "SET_STATE", target: "COMPLETE" } as never);
    a.send({ type: "RESPONSE_CHANGED", response, bonus: true } as never);
    expect(a.getSnapshot().context).toEqual(before.context);
    expect(a.getSnapshot().value).toEqual(before.value);
    expect(isActivityEvent({ type: "CHECK_RESPONSE", retry: true })).toBe(
      false,
    );
    expect(isActivityEvent({ type: "FEEDBACK_DELIVERED", revision: -1 })).toBe(
      false,
    );
    a.stop();
  });

  it("rejects bogus definitions before construction and does not trust an eligibility boolean alone", () => {
    expect(() =>
      validateActivityDefinition({
        ...a02,
        edges: { ENTRY: { CONTINUE: "EXP-99" } },
      }),
    ).toThrow();
    expect(() =>
      validateActivityDefinition({ ...a01, activityId: "unknown" }),
    ).toThrow();
    const a = actor(a01, ports("CONFIRMED", false));
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "confirmation",
      support: "none",
    });
    a.stop();
  });

  it("supports source review only on an injected authorized receiving edge, with exact return", () => {
    // Transition graph is supplied by the future approved receiver composition, not by this test.
    const receiver: ActivityDefinition = {
      ...a01,
      support: { ACTIVE: ["SOURCE_REVIEW"] },
    };
    const a = actor(receiver, {
      ...ports(),
      sourceReviewAvailable: (id, origin) =>
        id === "C04-A01" && origin === "ACTIVE",
    });
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    const before = a.getSnapshot().context;
    a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "active",
      support: "sourceReview",
    });
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.checkedRevision).toBeNull();
    a.send({ type: "CLOSE_SUPPORT" });
    expect(a.getSnapshot().context).toEqual(before);
    a.stop();
  });

  it("enters INFO_NEEDED only for a declared semantic boundary, not unknown events", () => {
    const boundary: ActivityDefinition = {
      ...a01,
      edges: {
        ENTRY: { CONTINUE: "ACTIVE", INFO_NEEDED: "INFO_NEEDED" },
        INFO_NEEDED: { PREVIOUS: "ENTRY" },
      },
    };
    const a = actor(boundary, {
      ...ports(),
      informationNeeded: (id, origin) => id === "C04-A01" && origin === "ENTRY",
      informationReturn: () => true,
    });
    a.send({ type: "TECHNICAL_RETRY" } as never);
    expect(a.getSnapshot().value).toEqual({
      instructional: "entry",
      support: "none",
    });
    a.send({ type: "INFO_NEEDED" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "infoNeeded",
      support: "none",
    });
    a.stop();
  });

  it("requires both a receiving edge and an established-source port for Source Review", () => {
    const receiver: ActivityDefinition = {
      ...a01,
      support: { ACTIVE: ["SOURCE_REVIEW"] },
    };
    const unavailable = actor(receiver);
    unavailable.send({ type: "CONTINUE" });
    unavailable.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    expect(unavailable.getSnapshot().value).toEqual({
      instructional: "active",
      support: "none",
    });
    unavailable.stop();
    const a = actor(receiver, {
      ...ports(),
      sourceReviewAvailable: (id, origin) =>
        id === "C04-A01" && origin === "ACTIVE",
    });
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    const before = a.getSnapshot().context;
    a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "confirmation",
      support: "none",
    });
    expect(a.getSnapshot().context).toEqual(before);
    a.stop();
    const b = actor(
      {
        ...receiver,
        support: { ACTIVE: ["SOURCE_REVIEW"], ENTRY: ["REVIEW"] },
      },
      {
        ...ports(),
        sourceReviewAvailable: (id, origin) =>
          id === "C04-A01" && origin === "ACTIVE",
      },
    );
    b.send({ type: "CONTINUE" });
    b.send({ type: "RESPONSE_CHANGED", response });
    const saved = b.getSnapshot().context;
    b.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    b.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    b.send({ type: "CHECK_RESPONSE" });
    b.send({ type: "FINISH_ACTIVITY" });
    expect(b.getSnapshot().context.origin).toBe("ACTIVE");
    expect(b.getSnapshot().context.checkedRevision).toBeNull();
    b.send({ type: "CLOSE_SUPPORT", extra: 1 } as never);
    expect(b.getSnapshot().context.origin).toBe("ACTIVE");
    b.send({ type: "CLOSE_SUPPORT" });
    expect(b.getSnapshot().context).toEqual(saved);
    expect(before.feedbackRevision).toBe(1);
    b.stop();
  });

  it("requires an unresolved-authority port and an exact manifest return from INFO_NEEDED", () => {
    const boundary: ActivityDefinition = {
      ...a01,
      edges: {
        ENTRY: { CONTINUE: "ACTIVE", INFO_NEEDED: "INFO_NEEDED" },
        INFO_NEEDED: { PREVIOUS: "ENTRY" },
      },
    };
    const denied = actor(boundary);
    denied.send({ type: "INFO_NEEDED" });
    expect(denied.getSnapshot().context.position).toBe("ENTRY");
    denied.stop();
    const a = actor(boundary, {
      ...ports(),
      informationNeeded: (id, origin) => id === "C04-A01" && origin === "ENTRY",
      informationReturn: () => false,
    });
    a.send({ type: "INFO_NEEDED" });
    expect(a.getSnapshot().context.infoOrigin).toBe("ENTRY");
    for (const type of [
      "CONTINUE",
      "CHECK_RESPONSE",
      "FEEDBACK_DELIVERED",
      "FINISH_ACTIVITY",
      "PREVIOUS",
    ] as const)
      a.send({
        type,
        ...(type === "FEEDBACK_DELIVERED" ? { revision: 0 } : {}),
      } as never);
    expect(a.getSnapshot().value).toEqual({
      instructional: "infoNeeded",
      support: "none",
    });
    expect(a.getSnapshot().context.evaluation).toBeNull();
    expect(a.getSnapshot().context.feedbackRevision).toBeNull();
    a.stop();
    const allowed = actor(boundary, {
      ...ports(),
      informationNeeded: () => true,
      informationReturn: (id, origin) => id === "C04-A01" && origin === "ENTRY",
    });
    allowed.send({ type: "INFO_NEEDED" });
    allowed.send({ type: "PREVIOUS" });
    expect(allowed.getSnapshot().value).toEqual({
      instructional: "entry",
      support: "none",
    });
    expect(allowed.getSnapshot().context.infoOrigin).toBeNull();
    allowed.stop();
  });

  it("detaches manifest arrays and freezes machine-owned snapshots, including nested response evidence", () => {
    const definition: ActivityDefinition = {
      ...a01,
      edges: { ENTRY: { CONTINUE: "ACTIVE" } },
      support: { ACTIVE: ["REVIEW"] },
    };
    const a = actor(definition);
    (definition.support.ACTIVE as string[]).push("SOURCE_REVIEW");
    (definition.edges.ENTRY as { CONTINUE: string }).CONTINUE = "INFO_NEEDED";
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "active",
      support: "none",
    });
    const mutable = {
      type: "RESPONSE_CHANGED" as const,
      response: { ...response },
    };
    a.send(mutable);
    mutable.response.selectionId = "changed";
    expect(a.getSnapshot().context.response).toEqual(response);
    const context = a.getSnapshot().context;
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.response)).toBe(true);
    expect(() => {
      (context as { position: string }).position = "COMPLETE";
    }).toThrow();
    expect(() => {
      (context.response as { selectionId: string }).selectionId = "changed";
    }).toThrow();
    a.send({ type: "CHECK_RESPONSE" });
    expect(Object.isFrozen(a.getSnapshot().context)).toBe(true);
    expect(Object.isFrozen(a.getSnapshot().context.evaluation)).toBe(true);
    a.stop();
  });

  it("rejects invalid edges, wrong identities, malformed intents and phase shortcuts", () => {
    for (const definition of [
      { ...a01, activityId: "C09-A01" },
      { ...a01, edges: { ENTRY: { CONTINUE: "EXP-02" } } },
      { ...a01, edges: { ENTRY: { CONTINUE: "COMPLETE" } } },
      {
        ...a01,
        edges: { ENTRY: { CONTINUE: "ACTIVE", INFO_NEEDED: "ACTIVE" } },
      },
      {
        ...a01,
        edges: { ENTRY: { CONTINUE: "ACTIVE" }, ACTIVE: { CONTINUE: "ENTRY" } },
      },
      { ...a01, support: { "EXP-99": ["SOURCE_REVIEW"] } },
    ])
      expect(() => validateActivityDefinition(definition)).toThrow();
    const a = actor({ ...a01, edges: { ENTRY: { CONTINUE: "ACTIVE" } } });
    for (const event of [
      { type: "FINISH_ACTIVITY" },
      { type: "CHECK_RESPONSE" },
      { type: "PREVIOUS" },
      { type: "CONTINUE", target: "COMPLETE" },
      { type: "OPEN_SUPPORT", mode: "NONE" },
      { type: "RESPONSE_CHANGED", response: { ...response, unexpected: true } },
      { type: "FEEDBACK_DELIVERED", revision: -2 },
      { type: "INFO_NEEDED" },
    ])
      a.send(event as never);
    expect(a.getSnapshot().context.position).toBe("ENTRY");
    expect(a.getSnapshot().context.responseRevision).toBe(0);
    a.send({ type: "CONTINUE" });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    a.send({ type: "CHECK_AGAIN" });
    expect(a.getSnapshot().context.evaluation).toBeNull();
    a.stop();
  });

  it("requires a fresh check and feedback after revision and prevents repeated completion", () => {
    const a = actor(
      { ...a01, edges: { ENTRY: { CONTINUE: "ACTIVE" } } },
      ports("RECONSIDERATION"),
    );
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "REVISE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    expect(a.getSnapshot().context.checkedRevision).toBeNull();
    expect(a.getSnapshot().context.feedbackRevision).toBeNull();
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("REVISION");
    a.send({ type: "CHECK_AGAIN" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    expect(a.getSnapshot().context.feedbackRevision).toBeNull();
    a.send({ type: "FEEDBACK_DELIVERED", revision: 2 });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "complete",
      support: "none",
    });
    const snapshot = a.getSnapshot();
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context).toEqual(snapshot.context);
    a.stop();
  });

  it("uses check history rather than response edit count to select first check and recheck", () => {
    let evaluations = 0;
    const a = actor(a01, {
      ...ports("RECONSIDERATION"),
      evaluate: () => {
        evaluations++;
        return {
          outcome: "RECONSIDERATION",
          diagnostic: "RECONSIDER_INTERPRETATION",
        };
      },
    });
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { ...response, selectionId: "second" },
    });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { ...response, selectionId: "third" },
    });
    expect(a.getSnapshot().context).toMatchObject({
      responseRevision: 3,
      hasChecked: false,
      checkedRevision: null,
    });
    a.send({ type: "CHECK_AGAIN" });
    expect(evaluations).toBe(0);
    a.send({ type: "CHECK_RESPONSE" });
    expect(evaluations).toBe(1);
    expect(a.getSnapshot().context).toMatchObject({
      position: "RECONSIDERATION",
      hasChecked: true,
      checkedRevision: 3,
      feedbackRevision: null,
    });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "CHECK_AGAIN" });
    expect(evaluations).toBe(1);
    a.send({ type: "FEEDBACK_DELIVERED", revision: 3 });
    a.send({ type: "REVISE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { ...response, selectionId: "fourth" },
    });
    expect(a.getSnapshot().context).toMatchObject({
      position: "REVISION",
      hasChecked: true,
      responseRevision: 4,
      checkedResponse: null,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
    });
    a.send({ type: "FINISH_ACTIVITY" });
    a.send({ type: "CHECK_RESPONSE" });
    expect(evaluations).toBe(1);
    expect(a.getSnapshot().value).toEqual({
      instructional: "revision",
      support: "none",
    });
    a.send({ type: "CHECK_AGAIN" });
    expect(evaluations).toBe(2);
    expect(a.getSnapshot().context.checkedRevision).toBe(4);
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "reconsideration",
      support: "none",
    });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 3 });
    expect(a.getSnapshot().context.feedbackRevision).toBeNull();
    a.send({ type: "FEEDBACK_DELIVERED", revision: 4 });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "complete",
      support: "none",
    });
    a.stop();
  });

  it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
    "enforces phase-specific support origins and preserves %s evidence on return",
    (outcome) => {
      const phase =
        outcome === "CONFIRMED" ? "CONFIRMATION" : "RECONSIDERATION";
      const support: ActivityDefinition["support"] = {
        ACTIVE: ["REVIEW"],
        [phase]: ["REVIEW", "SOURCE_REVIEW"] as const,
        COMPLETE: ["REVIEW"],
      };
      const sourceOrigins: string[] = [];
      const a = actor(
        { ...a01, support },
        {
          ...ports(outcome),
          sourceReviewAvailable: (id, origin) => {
            sourceOrigins.push(origin);
            return id === "C04-A01" && origin === phase;
          },
        },
      );
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response });
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(a.getSnapshot().context.origin).toBe("ACTIVE");
      a.send({ type: "CLOSE_SUPPORT" });
      a.send({ type: "CHECK_RESPONSE" });
      const beforeFeedback = a.getSnapshot().context;
      a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
      expect(sourceOrigins.length).toBeGreaterThan(0);
      expect(sourceOrigins.every((origin) => origin === phase)).toBe(true);
      expect(a.getSnapshot().value).toEqual({
        instructional:
          outcome === "CONFIRMED" ? "confirmation" : "reconsideration",
        support: "sourceReview",
      });
      expect(a.getSnapshot().context.origin).toBe(phase);
      a.send({ type: "CHECK_AGAIN" });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.checkedRevision).toBe(1);
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      a.send({ type: "CLOSE_SUPPORT" });
      expect(a.getSnapshot().context).toEqual(beforeFeedback);
      a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      const afterFeedback = a.getSnapshot().context;
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(a.getSnapshot().context.origin).toBe(phase);
      a.send({ type: "CLOSE_SUPPORT" });
      expect(a.getSnapshot().context).toEqual(afterFeedback);
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
      expect(a.getSnapshot().value).toEqual({
        instructional: "complete",
        support: "none",
      });
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(a.getSnapshot().context.origin).toBe("COMPLETE");
      a.send({ type: "CLOSE_SUPPORT" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      a.stop();
    },
  );

  it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
    "does not inherit ACTIVE-only support in %s or COMPLETE",
    (outcome) => {
      const a = actor(a01, ports(outcome));
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response });
      a.send({ type: "CHECK_RESPONSE" });
      const checked = a.getSnapshot().context;
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(a.getSnapshot().context).toEqual(checked);
      expect(a.getSnapshot().value.support).toBe("none");
      a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      a.send({ type: "FINISH_ACTIVITY" });
      const complete = a.getSnapshot().context;
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(a.getSnapshot().context).toEqual(complete);
      expect(a.getSnapshot().value).toEqual({
        instructional: "complete",
        support: "none",
      });
      a.stop();
    },
  );

  it("permits the first check after exactly one edit and never treats a repeated check as a new evaluation", () => {
    let evaluations = 0;
    const a = actor(a01, {
      ...ports(),
      evaluate: () => {
        evaluations++;
        return { outcome: "CONFIRMED", diagnostic: null };
      },
    });
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    const checked = a.getSnapshot().context;
    expect(checked).toMatchObject({
      position: "CONFIRMATION",
      hasChecked: true,
      checkedRevision: 1,
    });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "CHECK_AGAIN" });
    expect(evaluations).toBe(1);
    expect(a.getSnapshot().context).toEqual(checked);
    a.stop();
  });

  it("keeps REVISION support permission and origin separate from ACTIVE", () => {
    const a = actor(
      { ...a01, support: { ACTIVE: ["REVIEW"], REVISION: ["REVIEW"] } },
      ports("RECONSIDERATION"),
    );
    a.send({ type: "CONTINUE" });
    a.send({ type: "RESPONSE_CHANGED", response });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    a.send({ type: "REVISE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { ...response, selectionId: "revised" },
    });
    const before = a.getSnapshot().context;
    expect(before.position).toBe("REVISION");
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(a.getSnapshot().context.origin).toBe("REVISION");
    expect(a.getSnapshot().value).toEqual({
      instructional: "revision",
      support: "review",
    });
    a.send({ type: "CHECK_AGAIN" });
    expect(a.getSnapshot().context.checkedRevision).toBeNull();
    a.send({ type: "CLOSE_SUPPORT" });
    expect(a.getSnapshot().context).toEqual(before);
    a.stop();
    const denied = actor(a01, ports("RECONSIDERATION"));
    denied.send({ type: "CONTINUE" });
    denied.send({ type: "RESPONSE_CHANGED", response });
    denied.send({ type: "CHECK_RESPONSE" });
    denied.send({ type: "REVISE" });
    denied.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(denied.getSnapshot().value).toEqual({
      instructional: "revision",
      support: "none",
    });
    denied.stop();
  });
});
