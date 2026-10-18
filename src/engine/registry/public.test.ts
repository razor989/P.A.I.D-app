import { describe, expect, it } from "vitest";
import type { ActivityModelAdapter } from "../activity-machine/public";
import type { ExecutableActivityBinding } from "./public";
import { ActivityRegistry } from "./public";
import { createActivityActor } from "../activity-runtime/public";
import type {
  ActivityIntentAdapter,
  ModelIntent,
} from "../activity-machine/public";

describe("D1 optional intent registration trust boundary", () => {
  // D050/S1 §2 C05; final C05 C3 §§30–35 (6c4b45d1), compatibility only.
  const intent: ModelIntent = {
    family: "C05",
    operation: "PARTITION_YEAR_INTO_MONTHS",
  };
  const intentFixture = () => ({
    activityId: "C05-A02" as const,
    definition: {
      activityId: "C05-A02" as const,
      edges: {
        ENTRY: { CONTINUE: "EXP-02" as const },
        "EXP-02": { CONTINUE: "ACTIVE" as const },
      },
      support: {},
      modelIntents: {
        family: "C05" as const,
        modelId: "C05-FIXTURE",
        scenarioId: "C05-S02",
        permissions: [{ position: "EXP-02" as const, intent: { ...intent } }],
      },
    },
    ports: fixture().ports,
    intentAdapter: {
      initialize: () => Object.freeze({ partitioned: false }),
      transition: () => Object.freeze({ partitioned: true }),
    } as ActivityIntentAdapter,
  });
  it("detaches/freezes policy and callback table without freezing caller-owned input", () => {
    const input = intentFixture();
    const registry = new ActivityRegistry([input]);
    const saved = registry.resolve(input.activityId);
    const transition = input.intentAdapter.transition;
    input.definition.modelIntents.permissions.pop();
    input.definition.modelIntents.modelId = "changed";
    input.intentAdapter = {
      initialize: () => {
        throw new Error("replaced");
      },
      transition: () => null,
    };
    expect(saved.intentAdapter!.transition).toBe(transition);
    expect(saved.definition.modelIntents!.permissions).toHaveLength(1);
    expect(saved.definition.modelIntents!.modelId).toBe("C05-FIXTURE");
    expect(
      Object.isFrozen(saved.definition.modelIntents!.permissions[0]!.intent),
    ).toBe(true);
    expect(Object.isFrozen(saved.intentAdapter)).toBe(true);
    expect(Object.isFrozen(input.definition)).toBe(false);
    const actor = createActivityActor(registry, input.activityId).start();
    actor.send({ type: "CONTINUE" });
    actor.send({
      type: "MODEL_INTENT",
      activityId: input.activityId,
      scenarioId: "C05-S02",
      modelId: "C05-FIXTURE",
      position: "EXP-02",
      revision: 0,
      intent,
    });
    expect(actor.getSnapshot().context.intentModel!.state).toEqual({
      partitioned: true,
    });
    expect(actor.getSnapshot().context.intentModel!.revision).toBe(1);
    actor.stop();
  });
  it.each([
    "missing",
    "orphan",
    "undefined",
    "callback",
    "extra-adapter",
    "prototype-adapter",
    "accessor-adapter",
    "extra-policy",
    "prototype-policy",
    "accessor-policy",
    "activity",
    "scenario",
    "family",
    "permission-family",
    "unknown-stage",
    "extra-intent",
    "prototype-intent",
    "accessor-intent",
    "accessor-binding",
    "selection-conflict",
    "unregistered-operation",
    "accessor-permission-array",
  ])("fails closed at registration: %s", (kind) => {
    const input = intentFixture();
    const policy = input.definition.modelIntents;
    const get = () => {
      throw new Error("Accessor executed");
    };
    let bad: unknown = input;
    if (kind === "missing") bad = { ...input, intentAdapter: undefined };
    if (kind === "orphan")
      bad = { ...fixture(), intentAdapter: input.intentAdapter };
    if (kind === "undefined")
      bad = {
        ...input,
        definition: { ...input.definition, modelIntents: undefined },
      };
    if (kind === "callback")
      bad = {
        ...input,
        intentAdapter: { ...input.intentAdapter, transition: null },
      };
    if (kind === "extra-adapter")
      bad = {
        ...input,
        intentAdapter: { ...input.intentAdapter, extra: true },
      };
    if (kind === "prototype-adapter")
      bad = {
        ...input,
        intentAdapter: Object.assign(
          Object.create({}) as object,
          input.intentAdapter,
        ),
      };
    if (kind === "accessor-adapter")
      bad = {
        ...input,
        intentAdapter: Object.defineProperty(
          { ...input.intentAdapter },
          "transition",
          { get },
        ),
      };
    if (kind === "extra-policy")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: { ...policy, extra: true },
        },
      };
    if (kind === "prototype-policy")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: Object.assign(Object.create({}) as object, policy),
        },
      };
    if (kind === "accessor-policy")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: Object.defineProperty({ ...policy }, "family", { get }),
        },
      };
    if (kind === "activity")
      bad = {
        ...input,
        activityId: "C05-A01",
        definition: { ...input.definition, activityId: "C05-A01" },
      };
    if (kind === "scenario") policy.scenarioId = "C05-S01";
    if (kind === "family")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: { ...policy, family: "C03" },
        },
      };
    if (kind === "permission-family")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: {
            ...policy,
            permissions: [
              {
                position: "EXP-02",
                intent: {
                  family: "C01",
                  operation: "INCLUDE_EARNING",
                  earning: "REGULAR_PAY",
                  period: "MAY",
                },
              },
            ],
          },
        },
      };
    if (kind === "unknown-stage")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: {
            ...policy,
            permissions: [{ position: "EXP-99", intent }],
          },
        },
      };
    if (kind === "extra-intent")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: {
            ...policy,
            permissions: [
              { position: "EXP-02", intent: { ...intent, factor: 13 } },
            ],
          },
        },
      };
    if (kind === "prototype-intent")
      policy.permissions[0]!.intent = Object.assign(
        Object.create({}),
        intent,
      ) as (typeof policy.permissions)[number]["intent"];
    if (kind === "accessor-intent")
      policy.permissions[0]!.intent = Object.defineProperty(
        { ...intent },
        "operation",
        { get },
      );
    if (kind === "accessor-binding")
      bad = Object.defineProperty({ ...input }, "definition", { get });
    if (kind === "selection-conflict")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelSelection: {
            modelId: "selection",
            scenarioId: "C05-S02",
            initialSelectionId: "a",
            selectionIds: ["a"],
            allowedSelections: {},
          },
        },
      };
    if (kind === "unregistered-operation")
      bad = {
        ...input,
        definition: {
          ...input.definition,
          modelIntents: {
            ...policy,
            permissions: [
              {
                position: "EXP-02",
                intent: { family: "C05", operation: "SET_FIELD" },
              },
            ],
          },
        },
      };
    if (kind === "accessor-permission-array")
      Object.defineProperty(policy.permissions, "0", { get });
    expect(
      () => new ActivityRegistry([bad as ExecutableActivityBinding]),
    ).toThrow(TypeError);
  });
  it("leaves opted-out binding legal events and construction unchanged", () => {
    const registry = new ActivityRegistry([fixture()]);
    expect(Object.keys(registry.resolve("C04-A01")).sort()).toEqual([
      "activityId",
      "definition",
      "ports",
    ]);
    const actor = createActivityActor(registry, "C04-A01").start();
    const before = actor.getSnapshot();
    actor.send({
      type: "MODEL_INTENT",
      activityId: "C05-A02",
      scenarioId: "C05-S02",
      modelId: "C05-FIXTURE",
      position: "EXP-02",
      revision: 0,
      intent,
    });
    expect(actor.getSnapshot()).toBe(before);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("ACTIVE");
    actor.stop();
  });
});

// Test-only structural binding; NOT a canonical C04 Study manifest or answer bank.
const fixture = (): ExecutableActivityBinding => ({
  activityId: "C04-A01",
  definition: {
    activityId: "C04-A01",
    edges: { ENTRY: { CONTINUE: "ACTIVE" } },
    support: { ACTIVE: ["REVIEW"] },
  },
  ports: {
    ready: () => true,
    evaluate: () => ({ outcome: "CONFIRMED", diagnostic: null }),
    completionEligible: () => true,
    sourceReviewAvailable: () => false,
    informationNeeded: () => false,
    informationReturn: () => false,
  },
});

describe("closed executable registry", () => {
  const modelFixture = () => {
    const base = fixture();
    const modelAdapter: ActivityModelAdapter = {
      initialize: () => ({
        selectionId: "A",
        state: Object.freeze({ private: true }),
      }),
      select: (_current, selectionId) => ({
        selectionId,
        state: Object.freeze({ private: true }),
      }),
    };
    return {
      ...base,
      definition: {
        ...base.definition,
        modelSelection: {
          modelId: "synthetic",
          scenarioId: "C04-S01",
          initialSelectionId: "A",
          selectionIds: ["A", "B"],
          allowedSelections: { ACTIVE: ["A", "B"] },
        },
      },
      modelAdapter,
    };
  };
  it("retains immutable model policy and detached adapter functions", () => {
    const input = modelFixture();
    const initialize = input.modelAdapter.initialize;
    const registry = new ActivityRegistry([input]);
    input.definition.modelSelection.allowedSelections.ACTIVE.pop();
    input.modelAdapter = {
      ...input.modelAdapter,
      initialize: () => {
        throw new Error("replaced");
      },
    };
    const retained = registry.resolve(input.activityId);
    expect(retained.modelAdapter!.initialize).toBe(initialize);
    expect(
      retained.definition.modelSelection!.allowedSelections.ACTIVE,
    ).toEqual(["A", "B"]);
    expect(
      Object.isFrozen(
        retained.definition.modelSelection!.allowedSelections.ACTIVE,
      ),
    ).toBe(true);
    expect(Object.keys(retained.ports)).toHaveLength(6);
    expect(() => new ActivityRegistry([retained, retained])).toThrow(
      "Duplicate",
    );
  });
  it.each(["missing", "orphan", "bad", "extra", "callback"])(
    "rejects model binding %s",
    (mode) => {
      const input = modelFixture();
      let malformed: unknown = input;
      if (mode === "missing") {
        const { modelAdapter: omitted, ...rest } = input;
        expect(omitted).toBeDefined();
        malformed = rest;
      }
      if (mode === "orphan")
        malformed = { ...fixture(), modelAdapter: input.modelAdapter };
      if (mode === "bad")
        malformed = {
          ...input,
          modelAdapter: { initialize: null, select: input.modelAdapter.select },
        };
      if (mode === "extra")
        malformed = {
          ...input,
          modelAdapter: { ...input.modelAdapter, extra: true },
        };
      if (mode === "callback")
        malformed = {
          ...input,
          definition: {
            ...input.definition,
            modelSelection: {
              ...input.definition.modelSelection,
              callback: () => true,
            },
          },
        };
      expect(
        () => new ActivityRegistry([malformed as ExecutableActivityBinding]),
      ).toThrow();
    },
  );
  it("defensively freezes synthetic optional stage/teaching metadata and isolates fresh actors", () => {
    const input = fixture();
    const definition = {
      ...input.definition,
      edges: {
        ENTRY: { CONTINUE: "ACTIVE" as const },
        CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" as const },
        RECONSIDERATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" as const },
      },
      responseStages: {
        contractId: "synthetic",
        version: 1,
        scenarioId: "C04-S01",
        primaryFields: [
          {
            key: "quantity",
            acceptedKinds: ["EXACT_QUANTITY" as const],
            quantityKind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: null,
          },
        ],
        reasoningField: "interpretation",
        optionIds: ["synthetic-one", "synthetic-two"],
      },
      terminalTeaching: {
        outcomes: "BOTH" as const,
        contentId: "synthetic-teaching",
      },
    };
    const registry = new ActivityRegistry([{ ...input, definition }]);
    const retained = registry.resolve(input.activityId).definition;
    definition.responseStages.contractId = "mutated";
    definition.responseStages.version = 99;
    definition.responseStages.primaryFields[0]!.unit = "USD";
    definition.responseStages.optionIds.push("extra");
    definition.terminalTeaching.contentId = "mutated";
    expect(retained.responseStages).toMatchObject({
      contractId: "synthetic",
      version: 1,
      optionIds: ["synthetic-one", "synthetic-two"],
    });
    expect(retained.terminalTeaching?.contentId).toBe("synthetic-teaching");
    const visit = (value: unknown): void => {
      if (value && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(visit);
      }
    };
    visit(retained);
    expect(() =>
      Object.assign(retained.responseStages!.primaryFields[0]!, {
        unit: "USD",
      }),
    ).toThrow();
    const a = createActivityActor(registry, input.activityId);
    const b = createActivityActor(registry, input.activityId);
    a.start();
    b.start();
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    expect(b.getSnapshot().context.position).toBe("ENTRY");
    expect(a.getSnapshot().context).not.toBe(b.getSnapshot().context);
    expect(a.getSnapshot().context.firstPrimaryCommitment).toBeNull();
    a.stop();
    b.stop();
  });
  it("distinguishes the canonical 4/4/4/4/5/4 universe from bound executions", () => {
    const registry = new ActivityRegistry([]);
    const counts = ["C01", "C02", "C03", "C04", "C05", "C06"].map(
      (competency) =>
        Array.from({ length: 9 }, (_, index) =>
          registry.isKnown(`${competency}-A0${index + 1}`),
        ).filter(Boolean).length,
    );
    expect(counts).toEqual([4, 4, 4, 4, 5, 4]);
    expect(counts.reduce((sum, count) => sum + count)).toBe(25);
    expect(registry.isKnown("C04-A02")).toBe(true);
    expect(() => registry.resolve("C04-A02")).toThrow(/Unbound activity ID/);
    for (const id of [
      "C02-S01-F",
      "C05-PV-JAMES-01",
      "C04-A1",
      "C01-A05",
      "C07-A01",
      "C04-A01 ",
    ]) {
      expect(registry.isKnown(id)).toBe(false);
      expect(() => registry.resolve(id)).toThrow(/Unknown activity ID/);
    }
  });

  it("retains an immutable independent graph and port table, without freezing caller input", () => {
    const input = fixture();
    const registry = new ActivityRegistry([input]);
    const saved = registry.resolve("C04-A01");
    expect(registry.resolve("C04-A01")).toBe(saved);
    expect(saved).not.toBe(input);
    (input.definition.edges.ENTRY as { CONTINUE: string }).CONTINUE = "EXP-99";
    (input.definition.support.ACTIVE as string[]).push("REINFORCEMENT");
    (input.ports as { ready: typeof input.ports.ready }).ready = () => false;
    expect(saved.definition.edges.ENTRY?.CONTINUE).toBe("ACTIVE");
    expect(saved.definition.support.ACTIVE).toEqual(["REVIEW"]);
    expect(
      saved.ports.ready({ kind: "SINGLE_SELECTION", selectionId: "choice" }),
    ).toBe(true);
    expect(
      () =>
        ((saved.definition.edges.ENTRY as { CONTINUE: string }).CONTINUE =
          "EXP-99"),
    ).toThrow();
    expect(() =>
      (saved.definition.support.ACTIVE as string[]).push("REINFORCEMENT"),
    ).toThrow();
    expect(
      () =>
        ((saved.ports as { ready: typeof saved.ports.ready }).ready = () =>
          false),
    ).toThrow();
    expect(
      () => ((saved as { activityId: string }).activityId = "C01-A01"),
    ).toThrow();
  });

  it("rejects duplicates, mismatched keys, malformed definitions and incomplete ports", () => {
    const base = fixture();
    const register = (change: object) =>
      new ActivityRegistry([{ ...base, ...change }]);
    expect(() => new ActivityRegistry([fixture(), fixture()])).toThrow(
      /Duplicate/,
    );
    expect(() => register({ activityId: "C04-S01" })).toThrow();
    expect(() => register({ activityId: "C01-A01" })).toThrow(/Conflicting/);
    expect(() =>
      register({ definition: { ...base.definition, activityId: "C04-A02" } }),
    ).toThrow(/Conflicting/);
    expect(() => register({ definition: undefined })).toThrow();
    expect(() =>
      register({ definition: { ...base.definition, edges: {} } }),
    ).toThrow();
    expect(() =>
      register({
        definition: {
          ...base.definition,
          edges: { ENTRY: { CONTINUE: "EXP-99" } },
        },
      }),
    ).toThrow();
    for (const name of [
      "ready",
      "evaluate",
      "completionEligible",
      "sourceReviewAvailable",
      "informationNeeded",
      "informationReturn",
    ] as const) {
      expect(() =>
        register({ ports: { ...base.ports, [name]: null } }),
      ).toThrow(/Invalid activity ports/);
    }
    expect(() => register({ ports: [] })).toThrow(/Invalid activity ports/);
    expect(() =>
      register({ ports: { ...base.ports, unexpected: true } }),
    ).toThrow(/Invalid activity ports/);
    expect(() => register({ extra: true })).toThrow(/Invalid executable/);
    expect(() => new ActivityRegistry(null as never)).toThrow(
      /Invalid registrations/,
    );
  });
});
