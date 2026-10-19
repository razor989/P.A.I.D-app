import { describe, expect, it } from "vitest";
import type { ActivityModelAdapter } from "../activity-machine/public";
import type { ActivityDefinition } from "../activity-machine/public";
import { ExactDecimal, quantity } from "../../core/public";
import type { LearnerResponse } from "../../core/public";
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

// D4 fixture-only composition, NOT T071/T072 production binding or D5 issuer.
// Context ddc0bb26: final C02 §§13–23, 68–69; D054/S1–S2.
// Exact fixed copy: App f480888 src/study/competencies/c02/content.ts:10–37.
// Full explanation: final C02 §20, lines 4120–4122, no paraphrase.
const d4Texts: Readonly<Record<string, string>> = {
  "c02/S01/confirmation":
    "Confirmed. SSS is ₱600.00, PhilHealth is ₱302.50, Pag-IBIG is ₱200.00, and withholding tax is ₱0.00. Total deductions are ₱1,102.50, so net pay is ₱10,997.50.",
  "c02/S01/reconsider-payroll-role":
    "Check whether you are identifying gross income, one deduction, total deductions, or net pay. These are different payroll roles.",
  "c02/S01/reconsider-arithmetic":
    "Add the four employee deductions before subtracting the total from ₱12,100.00 gross income.",
  "c02/S01-F/scenario":
    "For this PhilHealth check, the employee's established monthly basic salary is ₱8,000.00. The approved PhilHealth minimum contribution basis is ₱10,000.00.",
  "c02/S01-F/task":
    "Identify the contribution basis that applies and determine the employee share at 2.5%.",
  "c02/S01-F/relationship-help":
    "Because ₱8,000.00 is below the approved ₱10,000.00 floor, use ₱10,000.00 as the contribution basis.",
  "c02/S01-F/confirmation":
    "Confirmed. The contribution basis is ₱10,000.00, so the employee share is ₱250.00.",
  "c02/S01-F/reconsider":
    "Do not calculate ₱8,000.00 × 2.5%. That gives ₱200.00 and ignores the approved PhilHealth floor.",
  "c02/S01-F/accessibility-summary":
    "Monthly basic salary ₱8,000.00. PhilHealth minimum contribution basis ₱10,000.00. Employee share at 2.5%: ₱250.00.",
  "C02-FLOOR-EXPLANATION":
    "A contribution rule may place a boundary on the basis used in its calculation. Here, the employee’s monthly basic salary is ₱8,000.00, but the approved PhilHealth rule uses a minimum contribution basis of ₱10,000.00.\n\nThat does not mean the employee suddenly earns ₱10,000.00. The employee’s salary remains ₱8,000.00. The ₱10,000.00 amount is the basis required by this contribution rule.",
};
function d4Fixture(): ExecutableActivityBinding {
  const text = (id: string) => ({ id, text: d4Texts[id]! });
  const definition: ActivityDefinition = {
    activityId: "C02-A01",
    edges: {
      ENTRY: { CONTINUE: "ACTIVE" },
      CONFIRMATION: { CONTINUE: "C02-S01-F" },
      RECONSIDERATION: { CONTINUE: "C02-S01-F" },
    },
    support: {
      ACTIVE: ["REVIEW"],
      CONFIRMATION: ["REVIEW"],
      RECONSIDERATION: ["REVIEW"],
    },
    embeddedFloor: {
      id: "C02-S01-F",
      activityId: "C02-A01",
      primaryScenarioId: "C02-S01",
      salary: "8000.00",
      minimumBasis: "10000.00",
      rate: "2.5%",
      scenario: text("c02/S01-F/scenario"),
      task: text("c02/S01-F/task"),
      help: text("c02/S01-F/relationship-help"),
      explanation: text("C02-FLOOR-EXPLANATION"),
      nonvisual: text("c02/S01-F/accessibility-summary"),
      mainFeedback: {
        confirmation: text("c02/S01/confirmation"),
        payrollRole: text("c02/S01/reconsider-payroll-role"),
        arithmetic: text("c02/S01/reconsider-arithmetic"),
      },
      choices: [
        {
          basis: "8000.00",
          share: "200.00",
          outcome: "RECONSIDERATION",
          feedback: text("c02/S01-F/reconsider"),
        },
        {
          basis: "10000.00",
          share: "250.00",
          outcome: "CONFIRMED",
          feedback: text("c02/S01-F/confirmation"),
        },
      ],
    },
  };
  // Canonical A01 task identifies payroll roles in the intentionally complete static ledger.
  // Role keys are fixture-local response transport, NOT new canonical option/content IDs.
  const expected = d4Anna();
  const ready = (response: LearnerResponse) =>
    response.kind === "COMPOSITE" &&
    response.parts.length === expected.parts.length &&
    response.parts.every(
      (p) =>
        expected.parts.some((e) => e.key === p.key) &&
        p.response.kind === "EXACT_QUANTITY" &&
        p.response.value.kind === "MONETARY_AMOUNT" &&
        p.response.value.unit === "PHP" &&
        p.response.value.basis === null,
    );
  return {
    activityId: "C02-A01",
    definition,
    ports: {
      ready,
      evaluate: (response) => {
        if (!ready(response) || response.kind !== "COMPOSITE")
          throw new TypeError("Not an Anna payroll-role response");
        const correct = response.parts.every((p) => {
          const target = expected.parts.find((e) => e.key === p.key)!.response;
          return (
            p.response.kind === "EXACT_QUANTITY" &&
            p.response.value.magnitude.equals(target.value.magnitude)
          );
        });
        return correct
          ? { outcome: "CONFIRMED", diagnostic: null }
          : {
              outcome: "RECONSIDERATION",
              diagnostic: "c02/S01/reconsider-payroll-role",
            };
      },
      completionEligible: (evidence) =>
        evidence.activityId === "C02-A01" &&
        evidence.evaluation !== null &&
        evidence.checkedRevision === evidence.responseRevision &&
        evidence.feedbackRevision === evidence.responseRevision,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    },
  };
}
function d4Anna(wrong = false) {
  const rows: readonly (readonly [string, string])[] = [
    ["gross", wrong ? "1102.50" : "12100.00"],
    ["SSS", "600.00"],
    ["PhilHealth", "302.50"],
    ["Pag-IBIG", "200.00"],
    ["withholding", "0.00"],
    ["total deductions", "1102.50"],
    ["net pay", "10997.50"],
  ];
  return {
    kind: "COMPOSITE" as const,
    parts: rows.map(([key, amount]) => ({
      key,
      response: {
        kind: "EXACT_QUANTITY" as const,
        value: quantity(
          ExactDecimal.from(amount),
          "MONETARY_AMOUNT",
          "PHP",
          null,
        ),
      },
    })),
  };
}

describe("D4 closed Floor Registry trust and retention", () => {
  it("retains and recursively freezes detached optional source manifest through Runtime", () => {
    const input = d4Fixture();
    const registry = new ActivityRegistry([input]);
    const saved = registry.resolve("C02-A01");
    expect(saved.definition.embeddedFloor).not.toBe(
      input.definition.embeddedFloor,
    );
    expect(
      Object.isFrozen(saved.definition.embeddedFloor!.choices[0]!.feedback),
    ).toBe(true);
    expect(Object.isFrozen(saved.definition.embeddedFloor!.mainFeedback)).toBe(
      true,
    );
    expect(Object.isFrozen(input.definition.embeddedFloor)).toBe(false);
    const changed = input.definition.embeddedFloor! as unknown as {
      salary: string;
      choices: unknown[];
    };
    changed.salary = "9000.00";
    changed.choices.pop();
    expect(saved.definition.embeddedFloor!.salary).toBe("8000.00");
    expect(saved.definition.embeddedFloor!.choices).toHaveLength(2);
    const actor = createActivityActor(registry, "C02-A01").start();
    expect(actor.getSnapshot().context.c02Floor!.phase).toBe("MAIN");
    actor.stop();
    expect(() => new ActivityRegistry([saved, saved])).toThrow("Duplicate");
    expect(() => registry.resolve("C02-S01-F")).toThrow("Unknown");
    expect(() => registry.resolve("C02-A05")).toThrow("Unknown");
    const all = Array.from({ length: 6 }, (_, i) =>
      Array.from(
        { length: i === 4 ? 5 : 4 },
        (_, j) => `C0${i + 1}-A0${j + 1}`,
      ),
    ).flat();
    expect(all).toHaveLength(25);
    expect(all.every((id) => registry.isKnown(id))).toBe(true);
    expect(registry.isKnown("C02-S01-F")).toBe(false);
  });
  it.each([
    "activity",
    "scenario",
    "id",
    "salary",
    "floor",
    "rate",
    "basis",
    "share",
    "outcome",
    "copy",
    "explanation",
    "extra",
    "choice-extra",
    "duplicate-choice",
    "direct-edge",
    "previous",
    "terminal",
    "undefined",
  ])("rejects malformed Floor registration: %s", (kind) => {
    const input = d4Fixture();
    const definition = structuredClone(input.definition) as unknown as Record<
      string,
      unknown
    >;
    const floor = definition.embeddedFloor as Record<string, unknown>;
    const choices = floor.choices as Record<string, unknown>[];
    switch (kind) {
      case "activity":
        definition.activityId = "C02-A02";
        break;
      case "scenario":
        floor.primaryScenarioId = "C02-S02";
        break;
      case "id":
        floor.id = "C02-A05";
        break;
      case "salary":
        floor.salary = "9000.00";
        break;
      case "floor":
        floor.minimumBasis = "8000.00";
        break;
      case "rate":
        floor.rate = "5%";
        break;
      case "basis":
        choices[0]!.basis = "9000.00";
        break;
      case "share":
        choices[0]!.share = "250.00";
        break;
      case "outcome":
        choices[0]!.outcome = "CONFIRMED";
        break;
      case "copy":
        choices[0]!.feedback = {
          id: "c02/S01-F/reconsider",
          text: "Confirmed.",
        };
        break;
      case "explanation":
        floor.explanation = { id: "C02-FLOOR-EXPLANATION", text: "250" };
        break;
      case "extra":
        floor.extra = true;
        break;
      case "choice-extra":
        choices[0]!.extra = true;
        break;
      case "duplicate-choice":
        choices[1] = choices[0]!;
        break;
      case "direct-edge":
        definition.edges = { ENTRY: { CONTINUE: "C02-S01-F" } };
        break;
      case "previous":
        definition.edges = {
          ENTRY: { CONTINUE: "ACTIVE" },
          CONFIRMATION: { CONTINUE: "C02-S01-F" },
          RECONSIDERATION: { CONTINUE: "C02-S01-F" },
          "C02-S01-F": { PREVIOUS: "ACTIVE" },
        };
        break;
      case "terminal":
        definition.terminalTeaching = {
          outcomes: "BOTH",
          contentId: "C02-FLOOR-EXPLANATION",
        };
        break;
      case "undefined":
        definition.embeddedFloor = undefined;
        break;
    }
    expect(
      () =>
        new ActivityRegistry([
          { ...input, definition: definition as ActivityDefinition },
        ]),
    ).toThrow();
  });
});
