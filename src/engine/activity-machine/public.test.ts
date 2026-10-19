import { createActor } from "xstate";
import { describe, expect, it, vi } from "vitest";
import {
  createActivityMachine,
  createActivityRestoration,
  isActivityEvent,
  validateActivityDefinition,
  availableModelSelections,
  validateC04A02StageEngagementV1,
  instructionalContinueEligible,
  c02WorkingStateValid,
} from "./public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityPorts,
  ActivityModelAdapter,
  ActivityEvent,
  ModelIntent,
  ActivityIntentAdapter,
  Position,
} from "./public";
import { ActivityRegistry } from "../registry/public";
import { createActivityActor } from "../activity-runtime/public";
import type { ExecutableActivityBinding } from "../registry/public";
import { projectSemanticActivityFrame } from "../semantic-frame/public";

// D1 compatibility fixtures only, NOT Study-authenticated production bindings.
// Context @ 3c524857: D050/S1 §§1–4; final Amendment C C3 C01 §§23–27,
// C02 §§26–33, C05 §§30–35, C03 §§30–36, C06 §§38–42.
// Final storyboard blobs: C01 8b141c2d, C02 a63b485a, C05 6c4b45d1,
// C03 619ca232, C06 1867a428. Family callbacks alone own all exact math.
describe("D1 source-bounded public actor intent compatibility", () => {
  const decimal = (value: string) => ExactDecimal.from(value);
  const ports: ActivityPorts = {
    ready: () => false,
    evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
    completionEligible: () => false,
    sourceReviewAvailable: () => false,
    informationNeeded: () => false,
    informationReturn: () => false,
  };
  const graph = (family: "C01" | "C02" | "C05"): ActivityDefinition => ({
    activityId: `${family}-A02`,
    edges: {
      ENTRY: { CONTINUE: "EXP-01" },
      "EXP-01": { CONTINUE: "EXP-02" },
      "EXP-02": { CONTINUE: "EXP-03", PREVIOUS: "EXP-01" },
      "EXP-03": { CONTINUE: "EXP-04", PREVIOUS: "EXP-02" },
      "EXP-04": { CONTINUE: "EXP-05", PREVIOUS: "EXP-03" },
      "EXP-05": { CONTINUE: "EXP-06", PREVIOUS: "EXP-04" },
      "EXP-06": { CONTINUE: "ACTIVE", PREVIOUS: "EXP-05" },
    },
    support: { "EXP-02": ["REVIEW", "REINFORCEMENT"], ACTIVE: ["REVIEW"] },
  });
  const binding = (
    family: "C01" | "C02" | "C05",
    permissions: readonly { position: Position; intent: ModelIntent }[],
    intentAdapter: ActivityIntentAdapter,
  ): ExecutableActivityBinding => ({
    activityId: `${family}-A02`,
    definition: {
      ...graph(family),
      modelIntents: {
        family,
        modelId: `${family}-D1-FIXTURE`,
        scenarioId: `${family}-S02`,
        permissions,
      },
    },
    ports,
    intentAdapter,
  });
  const earning = (
    operation: "INCLUDE_EARNING" | "REMOVE_EARNING",
    target: "REGULAR_PAY" | "TRANSPORTATION_ALLOWANCE",
  ): ModelIntent => ({
    family: "C01",
    operation,
    earning: target,
    period: "MAY",
  });
  const year: ModelIntent = {
    family: "C05",
    operation: "PARTITION_YEAR_INTO_MONTHS",
  };
  const month: ModelIntent = {
    family: "C05",
    operation: "PARTITION_MONTH_INTO_SEMIMONTHLY",
  };
  type Actor = ReturnType<typeof createActivityActor>;
  const advance = (actor: Actor, target: Position) => {
    for (
      let steps = 0;
      actor.getSnapshot().context.position !== target && steps < 8;
      steps++
    )
      actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe(target);
  };
  const event = (actor: Actor, intent: ModelIntent): ActivityEvent => {
    const context = actor.getSnapshot().context;
    return {
      type: "MODEL_INTENT",
      activityId: context.activityId,
      scenarioId: context.intentModel!.scenarioId,
      modelId: context.intentModel!.modelId,
      position: context.position,
      revision: context.intentModel!.revision,
      intent,
    };
  };
  const send = (actor: Actor, intent: ModelIntent) =>
    actor.send(event(actor, intent));
  const unchanged = (actor: Actor, input: unknown) => {
    const before = actor.getSnapshot().context;
    actor.send(input as ActivityEvent);
    expect(actor.getSnapshot().context).toEqual(before);
    expect(actor.getSnapshot().context.intentModel).toBe(before.intentModel);
    expect(actor.getSnapshot().context.intentModel?.revision).toBe(
      before.intentModel?.revision,
    );
  };
  type Earnings = Readonly<{
    record: readonly Readonly<{
      id: string;
      amount: ExactDecimal;
      period: "MAY";
      applicable: true;
    }>[];
    membership: readonly string[];
    composition: ExactDecimal;
    meaning: "EXPLORATORY_PARTIAL" | "COMPLETE_MAY_COMPOSITION";
  }>;
  const c01 = (): ExecutableActivityBinding => {
    const issue = (membership: readonly string[]): Earnings => {
      const record = Object.freeze([
        Object.freeze({
          id: "REGULAR_PAY",
          amount: decimal("17250"),
          period: "MAY" as const,
          applicable: true as const,
        }),
        Object.freeze({
          id: "TRANSPORTATION_ALLOWANCE",
          amount: decimal("1750"),
          period: "MAY" as const,
          applicable: true as const,
        }),
      ]);
      return Object.freeze({
        record,
        membership: Object.freeze([...membership]),
        composition: record
          .filter((row) => membership.includes(row.id))
          .reduce((total, row) => total.add(row.amount), decimal("0")),
        meaning:
          membership.length === 2
            ? "COMPLETE_MAY_COMPOSITION"
            : "EXPLORATORY_PARTIAL",
      });
    };
    const regular = [
      earning("INCLUDE_EARNING", "REGULAR_PAY"),
      earning("REMOVE_EARNING", "REGULAR_PAY"),
    ];
    const all = [
      ...regular,
      earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE"),
      earning("REMOVE_EARNING", "TRANSPORTATION_ALLOWANCE"),
    ];
    // Final C01 has FOUR explanation steps, not the generic six-step fixture graph.
    const base = binding(
      "C01",
      [
        ...regular.map((intent) => ({ position: "EXP-02" as const, intent })),
        ...["EXP-03", "ACTIVE", "REVISION"].flatMap((position) =>
          all.map((intent) => ({ position: position as Position, intent })),
        ),
      ],
      {
        initialize: () => issue([]),
        continuationState: (current, requirement) => {
          const state = current as Earnings;
          return (
            state.membership.includes("REGULAR_PAY") &&
            (requirement === "C01_MAY_REGULAR" ||
              (requirement === "C01_MAY_BOTH" &&
                state.membership.includes("TRANSPORTATION_ALLOWANCE")))
          );
        },
        transition: (current, intent) => {
          if (intent.family !== "C01") return null;
          const state = current as Earnings;
          const included = state.membership.includes(intent.earning);
          if (included === (intent.operation === "INCLUDE_EARNING"))
            return null;
          return issue(
            intent.operation === "INCLUDE_EARNING"
              ? [...state.membership, intent.earning]
              : state.membership.filter((id) => id !== intent.earning),
          );
        },
      },
    );
    return {
      ...base,
      definition: {
        ...base.definition,
        instructionalContinuation: {
          activityId: "C01-A02",
          family: "C01",
          stages: [
            {
              position: "EXP-02",
              requirement: "C01_MAY_REGULAR",
              action: earning("INCLUDE_EARNING", "REGULAR_PAY"),
            },
            {
              position: "EXP-03",
              requirement: "C01_MAY_BOTH",
              action: earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE"),
            },
          ],
        },
        edges: {
          ENTRY: { CONTINUE: "EXP-01" },
          "EXP-01": { CONTINUE: "EXP-02" },
          "EXP-02": { CONTINUE: "EXP-03", PREVIOUS: "EXP-01" },
          "EXP-03": { CONTINUE: "EXP-04", PREVIOUS: "EXP-02" },
          "EXP-04": { CONTINUE: "ACTIVE", PREVIOUS: "EXP-03" },
        },
      },
    };
  };
  it("C01 preserves independent May earnings through inclusion/removal/reinstatement and actor isolation", () => {
    const registry = new ActivityRegistry([c01()]);
    const a = createActivityActor(registry, "C01-A02").start();
    const b = createActivityActor(registry, "C01-A02").start();
    const state = () => a.getSnapshot().context.intentModel!.state as Earnings;
    expect(state().membership).toEqual([]);
    expect(state().composition.toString()).toBe("0");
    advance(a, "EXP-02");
    unchanged(
      a,
      event(a, earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE")),
    );
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    expect(state().composition.toString()).toBe("17250");
    expect(state().meaning).toBe("EXPLORATORY_PARTIAL");
    unchanged(a, event(a, earning("INCLUDE_EARNING", "REGULAR_PAY")));
    advance(a, "EXP-03");
    const old = state();
    send(a, earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE"));
    expect(state().membership).toEqual([
      "REGULAR_PAY",
      "TRANSPORTATION_ALLOWANCE",
    ]);
    expect(state().composition.toString()).toBe("19000");
    send(a, earning("REMOVE_EARNING", "REGULAR_PAY"));
    expect(state().membership).toEqual(["TRANSPORTATION_ALLOWANCE"]);
    expect(state().composition.toString()).toBe("1750");
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    expect(state().composition.toString()).toBe("19000");
    expect(state().meaning).toBe("COMPLETE_MAY_COMPOSITION");
    expect(
      state().record.map((row) => [row.id, row.amount.toString(), row.period]),
    ).toEqual([
      ["REGULAR_PAY", "17250", "MAY"],
      ["TRANSPORTATION_ALLOWANCE", "1750", "MAY"],
    ]);
    expect(old.composition.toString()).toBe("17250");
    expect(Object.isFrozen(state().membership)).toBe(true);
    expect(a.getSnapshot().context.intentModel!.revision).toBe(4);
    expect(
      (b.getSnapshot().context.intentModel!.state as Earnings).membership,
    ).toEqual([]);
    expect(b.getSnapshot().context.intentModel!.revision).toBe(0);
    a.stop();
    b.stop();
  });

  type Deduction = "SSS" | "PHILHEALTH" | "PAG_IBIG" | "BIR";
  type Ledger = Readonly<{
    gross: ExactDecimal;
    rows: Readonly<
      Record<
        Deduction,
        Readonly<{
          inspected: boolean;
          basis: string | null;
          amount: ExactDecimal | null;
        }>
      >
    >;
    taxable: ExactDecimal | null;
  }>;
  const inspect = (deduction: Deduction): ModelIntent => ({
    family: "C02",
    operation: "INSPECT_BASIS",
    deduction,
  });
  const selections = [
    {
      family: "C02",
      operation: "SELECT_BASIS",
      deduction: "SSS",
      basis: "STATUTORY_MSC",
    },
    {
      family: "C02",
      operation: "SELECT_BASIS",
      deduction: "PHILHEALTH",
      basis: "MONTHLY_BASIC_SALARY",
    },
    {
      family: "C02",
      operation: "SELECT_BASIS",
      deduction: "PAG_IBIG",
      basis: "CAPPED_FUND_SALARY",
    },
    {
      family: "C02",
      operation: "SELECT_BASIS",
      deduction: "BIR",
      basis: "TAXABLE_COMPENSATION",
    },
  ] as const satisfies readonly ModelIntent[];
  const c02 = () => {
    const deductions: readonly Deduction[] = [
      "SSS",
      "PHILHEALTH",
      "PAG_IBIG",
      "BIR",
    ];
    const row = () =>
      Object.freeze({ inspected: false, basis: null, amount: null });
    return binding(
      "C02",
      [
        ...deductions.map((deduction) => ({
          position: "EXP-02" as const,
          intent: inspect(deduction),
        })),
        { position: "EXP-03", intent: selections[0] },
        { position: "EXP-04", intent: selections[1] },
        { position: "EXP-04", intent: selections[2] },
        { position: "EXP-05", intent: selections[3] },
        ...[...deductions.map(inspect), ...selections].map((intent) => ({
          position: "ACTIVE" as const,
          intent,
        })),
      ],
      {
        initialize: () =>
          Object.freeze({
            gross: decimal("12937.50"),
            rows: Object.freeze({
              SSS: row(),
              PHILHEALTH: row(),
              PAG_IBIG: row(),
              BIR: row(),
            }),
            taxable: null,
          }),
        transition: (current, intent) => {
          if (intent.family !== "C02") return null;
          const state = current as Ledger;
          const previous = state.rows[intent.deduction];
          if (intent.operation === "INSPECT_BASIS") {
            if (previous.inspected) return null;
            return Object.freeze({
              ...state,
              rows: Object.freeze({
                ...state.rows,
                [intent.deduction]: Object.freeze({
                  ...previous,
                  inspected: true,
                }),
              }),
            });
          }
          if (previous.basis === intent.basis) return null;
          const fixed = {
            SSS: decimal("13000").multiply(decimal("0.05")),
            PHILHEALTH: decimal("12000").multiply(decimal("0.025")),
            PAG_IBIG: decimal("10000").multiply(decimal("0.02")),
            BIR: decimal("0"),
          };
          let taxable = state.taxable;
          if (intent.deduction === "BIR") {
            if (
              !state.rows.SSS.amount ||
              !state.rows.PHILHEALTH.amount ||
              !state.rows.PAG_IBIG.amount
            )
              return null;
            taxable = state.gross
              .subtract(state.rows.SSS.amount)
              .subtract(state.rows.PHILHEALTH.amount)
              .subtract(state.rows.PAG_IBIG.amount);
            if (taxable.compare(decimal("20833")) > 0) return null;
          }
          return Object.freeze({
            ...state,
            taxable,
            rows: Object.freeze({
              ...state.rows,
              [intent.deduction]: Object.freeze({
                inspected: true,
                basis: intent.basis,
                amount: fixed[intent.deduction],
              }),
            }),
          });
        },
      },
    );
  };
  it("C02 retains four deduction identities, withholds early amounts, derives in order, and never fills ACTIVE answers", () => {
    const actor = createActivityActor(
      new ActivityRegistry([c02()]),
      "C02-A02",
    ).start();
    const state = () =>
      actor.getSnapshot().context.intentModel!.state as Ledger;
    advance(actor, "EXP-02");
    for (const deduction of ["SSS", "PHILHEALTH", "PAG_IBIG", "BIR"] as const)
      send(actor, inspect(deduction));
    expect(Object.values(state().rows).map((row) => row.inspected)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(Object.values(state().rows).map((row) => row.amount)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    unchanged(actor, event(actor, selections[0]));
    advance(actor, "EXP-03");
    send(actor, selections[0]);
    const sss = state().rows.SSS;
    advance(actor, "EXP-04");
    send(actor, selections[1]);
    send(actor, selections[2]);
    expect(state().rows.SSS).toBe(sss);
    expect(state().rows.BIR.amount).toBeNull();
    advance(actor, "EXP-05");
    send(actor, selections[3]);
    expect(
      Object.values(state().rows).map((row) => row.amount?.toString()),
    ).toEqual(["650", "300", "200", "0"]);
    expect(state().taxable?.toString()).toBe("11787.5");
    const total = Object.values(state().rows).reduce(
      (sum, row) => sum.add(row.amount!),
      decimal("0"),
    );
    expect(total.toString()).toBe("1150");
    expect(state().gross.subtract(total).toString()).toBe("11787.5");
    // Taxable compensation and net are distinct meanings; no net/total response injected.
    expect("net" in state()).toBe(false);
    advance(actor, "ACTIVE");
    for (const selection of selections)
      unchanged(actor, event(actor, selection));
    expect(actor.getSnapshot().context.response).toBeNull();
    expect(actor.getSnapshot().context.responseRevision).toBe(0);
    expect(actor.getSnapshot().context.intentModel!.revision).toBe(8);
    actor.stop();
  });
  it("C02 cannot establish BIR before the mandatory contribution rows", () => {
    const actor = createActivityActor(
      new ActivityRegistry([c02()]),
      "C02-A02",
    ).start();
    advance(actor, "EXP-05");
    unchanged(actor, event(actor, selections[3]));
    actor.stop();
  });

  type Partitions = Readonly<{
    annual: ExactDecimal;
    months: Readonly<{ count: 12; monthlyGiven: ExactDecimal }> | null;
    semimonthly: Readonly<{ count: 2; amount: ExactDecimal }> | null;
  }>;
  const c05 = (): ExecutableActivityBinding => {
    const base = binding(
      "C05",
      [
        { position: "EXP-02", intent: year },
        { position: "EXP-04", intent: month },
      ],
      {
        continuationState: (current, requirement) => {
          const state = current as Partitions;
          return (
            state.months?.count === 12 &&
            state.months.monthlyGiven.toString() === "40000" &&
            (requirement === "C05_YEAR_MONTHS" ||
              (requirement === "C05_MONTH_SEMIMONTHLY" &&
                state.semimonthly?.count === 2 &&
                state.semimonthly.amount.toString() === "20000"))
          );
        },
        initialize: () =>
          Object.freeze({
            annual: decimal("480000"),
            months: null,
            semimonthly: null,
          }),
        transition: (current, intent) => {
          if (intent.family !== "C05") return null;
          const state = current as Partitions;
          if (intent.operation === "PARTITION_YEAR_INTO_MONTHS") {
            if (state.months) return null;
            return Object.freeze({
              ...state,
              months: Object.freeze({
                count: 12 as const,
                monthlyGiven: state.annual.divide(decimal("12")),
              }),
            });
          }
          if (!state.months || state.semimonthly) return null;
          return Object.freeze({
            ...state,
            semimonthly: Object.freeze({
              count: 2 as const,
              amount: state.months.monthlyGiven.divide(decimal("2")),
            }),
          });
        },
      },
    );
    return {
      ...base,
      definition: {
        ...base.definition,
        instructionalContinuation: {
          activityId: "C05-A02",
          family: "C05",
          stages: [
            {
              position: "EXP-02",
              requirement: "C05_YEAR_MONTHS",
              action: year,
            },
            {
              position: "EXP-04",
              requirement: "C05_MONTH_SEMIMONTHLY",
              action: month,
            },
          ],
        },
      },
    };
  };
  // D018/S1 §§2–5; final C01 §§24–25 and C05 §§28–34. These
  // projections consume the same live registry actor, never a patched snapshot.
  const parity = (
    actor: Actor,
    registry: ActivityRegistry,
    expected: boolean,
  ) => {
    const context = actor.getSnapshot().context;
    const source = registry.resolve(context.activityId);
    const support = actor.getSnapshot().value.support;
    const frame = projectSemanticActivityFrame({
      context,
      phase: context.position,
      support:
        support === "none"
          ? "NONE"
          : support === "review"
            ? "REVIEW"
            : support === "sourceReview"
              ? "SOURCE_REVIEW"
              : "REINFORCEMENT",
      definition: source.definition,
      ports: source.ports,
      content: {
        references: [],
        modelFacts: [],
        derivedFacts: [],
        responseContract: {
          id: "D2-fixture",
          text: "Source-bound headless fixture",
        },
      },
    });
    expect(frame.allowedLearnerIntents.includes("CONTINUE")).toBe(expected);
    expect(instructionalContinueEligible(context, source.definition)).toBe(
      expected,
    );
    const destination = source.definition.edges[context.position]?.CONTINUE;
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe(
      expected ? destination : context.position,
    );
    if (!expected) expect(actor.getSnapshot().context).toBe(context);
  };
  it("D2 C01 gates each independent action and current composition, removal/reinclusion and Previous/re-entry with machine/frame parity", () => {
    const registry = new ActivityRegistry([c01()]);
    const a = createActivityActor(registry, "C01-A02").start();
    const fresh = createActivityActor(registry, "C01-A02").start();
    parity(a, registry, true); // Entry -> EXP-01
    parity(a, registry, true); // EXP-01 -> EXP-02
    parity(a, registry, false);
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    const first = a.getSnapshot().context.instructionalContinuation!;
    expect(first.accepted).toEqual(["C01_MAY_REGULAR"]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.accepted)).toBe(true);
    parity(a, registry, true);
    parity(a, registry, false); // regular engagement cannot stand for allowance
    send(a, earning("REMOVE_EARNING", "REGULAR_PAY"));
    send(a, earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE"));
    expect(a.getSnapshot().context.instructionalContinuation!.accepted).toEqual(
      ["C01_MAY_REGULAR", "C01_MAY_BOTH"],
    );
    parity(a, registry, false); // independent action recorded, current regular absent
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    const both = a.getSnapshot().context.instructionalContinuation;
    send(a, earning("REMOVE_EARNING", "REGULAR_PAY"));
    parity(a, registry, false);
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    expect(a.getSnapshot().context.instructionalContinuation).toBe(both);
    a.send({ type: "PREVIOUS" });
    parity(a, registry, true); // authentic EXP-02 evidence retained
    parity(a, registry, true);
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.instructionalContinuation).toBe(both);
    parity(a, registry, true);
    parity(a, registry, true); // final explanation -> ACTIVE uses same helper
    advance(fresh, "EXP-02");
    expect(
      fresh.getSnapshot().context.instructionalContinuation!.accepted,
    ).toEqual([]);
    parity(fresh, registry, false);
    a.stop();
    fresh.stop();
  });
  it("D2 C05 blocks both source stages and retains ordered Given/evidence on Previous and re-entry", () => {
    const registry = new ActivityRegistry([c05()]);
    const a = createActivityActor(registry, "C05-A02").start();
    advance(a, "EXP-02");
    parity(a, registry, false);
    unchanged(a, event(a, month));
    send(a, year);
    parity(a, registry, true);
    parity(a, registry, true);
    parity(a, registry, false);
    const monthly = a.getSnapshot().context.intentModel!;
    unchanged(a, event(a, year));
    expect(a.getSnapshot().context.instructionalContinuation!.accepted).toEqual(
      ["C05_YEAR_MONTHS"],
    );
    a.send({ type: "PREVIOUS" });
    parity(a, registry, true);
    parity(a, registry, false);
    send(a, month);
    expect(
      (a.getSnapshot().context.intentModel!.state as Partitions).months,
    ).toBe((monthly.state as Partitions).months);
    parity(a, registry, true);
    a.send({ type: "PREVIOUS" });
    parity(a, registry, true);
    a.stop();
  });
  it.each(["REVIEW", "SOURCE_REVIEW", "REINFORCEMENT"] as const)(
    "D2 support %s suppresses Continue without manufacturing engagement",
    (mode) => {
      const base = c01();
      const registry = new ActivityRegistry([
        {
          ...base,
          definition: { ...base.definition, support: { "EXP-02": [mode] } },
          ports: { ...base.ports, sourceReviewAvailable: () => true },
        },
      ]);
      const a = createActivityActor(registry, "C01-A02").start();
      advance(a, "EXP-02");
      a.send({ type: "OPEN_SUPPORT", mode });
      unchanged(a, event(a, earning("INCLUDE_EARNING", "REGULAR_PAY")));
      parity(a, registry, false);
      a.send({ type: "CLOSE_SUPPORT" });
      parity(a, registry, false);
      send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
      a.send({ type: "OPEN_SUPPORT", mode });
      parity(a, registry, false);
      a.send({ type: "CLOSE_SUPPORT" });
      parity(a, registry, true);
      a.stop();
    },
  );
  it.each(["null", "same", "clone", "throw", "mutable", "primitive"])(
    "D2 rejected adapter result %s writes neither revision nor stage evidence",
    (kind) => {
      const base = c01();
      const registry = new ActivityRegistry([
        {
          ...base,
          intentAdapter: {
            ...base.intentAdapter!,
            transition: (current) => {
              if (kind === "throw") throw new Error("family refusal");
              if (kind === "null") return null;
              if (kind === "same") return current;
              if (kind === "clone") return Object.freeze({ ...current });
              if (kind === "mutable") return {};
              return 1 as never;
            },
          },
        },
      ]);
      const a = createActivityActor(registry, "C01-A02").start();
      advance(a, "EXP-02");
      const before = a.getSnapshot().context;
      send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
      expect(a.getSnapshot().context.intentModel).toBe(before.intentModel);
      expect(a.getSnapshot().context.instructionalContinuation).toBe(
        before.instructionalContinuation,
      );
      parity(a, registry, false);
      a.stop();
    },
  );
  it("D2 wrong-stage accepted action/revision cannot substitute for required stage engagement", () => {
    const base = c01();
    const registry = new ActivityRegistry([
      {
        ...base,
        definition: {
          ...base.definition,
          modelIntents: {
            ...base.definition.modelIntents!,
            permissions: [
              ...base.definition.modelIntents!.permissions,
              {
                position: "EXP-01",
                intent: earning("INCLUDE_EARNING", "REGULAR_PAY"),
              },
            ],
          },
        },
      },
    ]);
    const a = createActivityActor(registry, "C01-A02").start();
    advance(a, "EXP-01");
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    expect(a.getSnapshot().context.intentModel!.revision).toBe(1);
    expect(a.getSnapshot().context.instructionalContinuation!.accepted).toEqual(
      [],
    );
    advance(a, "EXP-02");
    unchanged(a, event(a, earning("INCLUDE_EARNING", "REGULAR_PAY")));
    parity(a, registry, false);
    send(a, earning("REMOVE_EARNING", "REGULAR_PAY"));
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    parity(a, registry, true);
    a.stop();
  });
  it.each([
    "activity",
    "family",
    "stage",
    "action",
    "duplicate",
    "non-edge",
    "missing-capability",
    "extra",
  ])("D2 rejects malformed policy %s before actor launch", (kind) => {
    const base = c01();
    const policy = structuredClone(base.definition.instructionalContinuation!);
    const first = policy.stages[0];
    const bad =
      kind === "activity"
        ? { ...policy, activityId: "C05-A02" }
        : kind === "family"
          ? { ...policy, family: "C05" }
          : kind === "stage"
            ? {
                ...policy,
                stages: [{ ...first, position: "EXP-01" }, policy.stages[1]],
              }
            : kind === "action"
              ? {
                  ...policy,
                  stages: [
                    {
                      ...first,
                      action: earning("REMOVE_EARNING", "REGULAR_PAY"),
                    },
                    policy.stages[1],
                  ],
                }
              : kind === "duplicate"
                ? { ...policy, stages: [first, first] }
                : kind === "extra"
                  ? { ...policy, requiresEngagement: true }
                  : policy;
    expect(
      () =>
        new ActivityRegistry([
          {
            ...base,
            definition: {
              ...base.definition,
              instructionalContinuation: bad as never,
              ...(kind === "non-edge"
                ? { edges: { ...base.definition.edges, "EXP-02": {} } }
                : {}),
            },
            ...(kind === "missing-capability"
              ? {
                  intentAdapter: {
                    initialize: base.intentAdapter!.initialize,
                    transition: base.intentAdapter!.transition,
                  },
                }
              : {}),
          },
        ]),
    ).toThrow(TypeError);
  });
  it("D2 pure evaluation fails closed on absent/unissued evidence and legacy no-policy actors retain Continue", () => {
    const base = c01();
    const registry = new ActivityRegistry([base]);
    const a = createActivityActor(registry, "C01-A02").start();
    advance(a, "EXP-02");
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    const context = a.getSnapshot().context;
    // Pure-helper malformed-input probes only: never assigned to an actor.
    expect(
      instructionalContinueEligible(
        {
          ...context,
          instructionalContinuation: undefined,
        } as unknown as ActivityContext,
        base.definition,
      ),
    ).toBe(false);
    expect(
      instructionalContinueEligible(
        {
          ...context,
          instructionalContinuation: structuredClone(
            context.instructionalContinuation!,
          ),
        },
        base.definition,
      ),
    ).toBe(false);
    expect(
      instructionalContinueEligible(
        { ...context, intentModel: undefined } as unknown as ActivityContext,
        base.definition,
      ),
    ).toBe(false);
    expect(
      instructionalContinueEligible(context, {
        ...base.definition,
        instructionalContinuation: {} as never,
      }),
    ).toBe(false);
    a.stop();
    const { instructionalContinuation: omitted, ...legacy } = base.definition;
    expect(omitted).toBeDefined();
    const old = new ActivityRegistry([{ ...base, definition: legacy }]);
    const b = createActivityActor(old, "C01-A02").start();
    advance(b, "EXP-02");
    parity(b, old, true);
    parity(b, old, true);
    expect(b.getSnapshot().context.instructionalContinuation).toBeUndefined();
    b.stop();
  });
  it.each(["C01", "C05"] as const)(
    "D2 %s precomputed initial state creates no engagement or Continue permission",
    (family) => {
      const base = family === "C01" ? c01() : c05();
      const adapter = base.intentAdapter!;
      const initial = adapter.initialize();
      const first = adapter.transition(
        initial,
        family === "C01" ? earning("INCLUDE_EARNING", "REGULAR_PAY") : year,
        "EXP-02",
      )!;
      const complete = adapter.transition(
        first,
        family === "C01"
          ? earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE")
          : month,
        family === "C01" ? "EXP-03" : "EXP-04",
      )!;
      const registry = new ActivityRegistry([
        { ...base, intentAdapter: { ...adapter, initialize: () => complete } },
      ]);
      const a = createActivityActor(registry, base.activityId).start();
      advance(a, "EXP-02");
      expect(a.getSnapshot().context.intentModel!.revision).toBe(0);
      expect(
        a.getSnapshot().context.instructionalContinuation!.accepted,
      ).toEqual([]);
      parity(a, registry, false);
      unchanged(
        a,
        event(
          a,
          family === "C01" ? earning("INCLUDE_EARNING", "REGULAR_PAY") : year,
        ),
      );
      parity(a, registry, false);
      a.stop();
    },
  );
  it("D2 C01 allowance-only current state cannot satisfy regular-stage evidence", () => {
    const base = c01();
    const adapter = base.intentAdapter!;
    const allowance = adapter.transition(
      adapter.initialize(),
      earning("INCLUDE_EARNING", "TRANSPORTATION_ALLOWANCE"),
      "EXP-03",
    )!;
    const registry = new ActivityRegistry([
      { ...base, intentAdapter: { ...adapter, initialize: () => allowance } },
    ]);
    const a = createActivityActor(registry, base.activityId).start();
    advance(a, "EXP-02");
    parity(a, registry, false);
    expect(a.getSnapshot().context.instructionalContinuation!.accepted).toEqual(
      [],
    );
    a.stop();
  });
  it("D2 C05 missing monthly Given refuses second-first even when the operation is an allowed current intent", () => {
    const base = c05();
    const registry = new ActivityRegistry([
      {
        ...base,
        definition: {
          ...base.definition,
          modelIntents: {
            ...base.definition.modelIntents!,
            permissions: [
              ...base.definition.modelIntents!.permissions,
              { position: "EXP-02", intent: month },
            ],
          },
        },
      },
    ]);
    const a = createActivityActor(registry, base.activityId).start();
    advance(a, "EXP-02");
    unchanged(a, event(a, month));
    expect(a.getSnapshot().context.instructionalContinuation!.accepted).toEqual(
      [],
    );
    parity(a, registry, false);
    a.stop();
  });
  it("D2 current-state capability failure fails closed without mutating genuine evidence", () => {
    const base = c01();
    const registry = new ActivityRegistry([
      {
        ...base,
        intentAdapter: {
          ...base.intentAdapter!,
          continuationState: () => {
            throw new Error("unissued family state");
          },
        },
      },
    ]);
    const a = createActivityActor(registry, base.activityId).start();
    advance(a, "EXP-02");
    send(a, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    expect(a.getSnapshot().context.instructionalContinuation!.accepted).toEqual(
      ["C01_MAY_REGULAR"],
    );
    parity(a, registry, false);
    a.stop();
  });
  it("C05 retains both ordered partitions and the established monthly Given without an additive total", () => {
    const actor = createActivityActor(
      new ActivityRegistry([c05()]),
      "C05-A02",
    ).start();
    advance(actor, "EXP-02");
    unchanged(actor, event(actor, month));
    send(actor, year);
    const first = actor.getSnapshot().context.intentModel!;
    expect((first.state as Partitions).months!.monthlyGiven.toString()).toBe(
      "40000",
    );
    unchanged(actor, event(actor, year));
    advance(actor, "EXP-04");
    send(actor, month);
    const final = actor.getSnapshot().context.intentModel!;
    expect((final.state as Partitions).months).toBe(
      (first.state as Partitions).months,
    );
    expect((final.state as Partitions).semimonthly!.amount.toString()).toBe(
      "20000",
    );
    expect((final.state as Partitions).annual.toString()).toBe("480000");
    expect((first.state as Partitions).semimonthly).toBeNull();
    expect(final.revision).toBe(2);
    unchanged(actor, event(actor, month));
    actor.stop();
  });
  it("D2 prevents the D1 zero-revision raw Continue bypass and second-first partition", () => {
    const actor = createActivityActor(
      new ActivityRegistry([c05()]),
      "C05-A02",
    ).start();
    advance(actor, "EXP-02");
    expect(actor.getSnapshot().context.intentModel!.revision).toBe(0);
    unchanged(actor, { type: "CONTINUE" });
    unchanged(actor, event(actor, month));
    actor.stop();
  });

  it.each([
    "family",
    "activity",
    "scenario",
    "model",
    "stage",
    "stale",
    "future",
    "earning",
    "period",
    "extra",
    "prototype",
    "accessor",
    "target",
    "rate",
    "factor",
    "operation",
    "delivery",
  ])("rejects %s without changing model state or revision", (kind) => {
    const actor = createActivityActor(
      new ActivityRegistry([c01()]),
      "C01-A02",
    ).start();
    advance(actor, "EXP-02");
    send(actor, earning("INCLUDE_EARNING", "REGULAR_PAY"));
    const good = event(actor, earning("REMOVE_EARNING", "REGULAR_PAY"));
    const get = vi.fn(() => "MAY");
    let bad: unknown = good;
    const intent = (good as Extract<ActivityEvent, { type: "MODEL_INTENT" }>)
      .intent;
    if (kind === "family") bad = { ...good, intent: year };
    if (kind === "activity") bad = { ...good, activityId: "C01-A01" };
    if (kind === "scenario") bad = { ...good, scenarioId: "C01-S01" };
    if (kind === "model") bad = { ...good, modelId: "other" };
    if (kind === "stage") bad = { ...good, position: "EXP-03" };
    if (kind === "stale") bad = { ...good, revision: 0 };
    if (kind === "future") bad = { ...good, revision: 2 };
    if (kind === "earning")
      bad = { ...good, intent: { ...intent, earning: "OVERTIME" } };
    if (kind === "period")
      bad = { ...good, intent: { ...intent, period: "MARCH" } };
    if (kind === "extra") bad = { ...good, arbitrary: true };
    if (kind === "prototype")
      bad = {
        ...good,
        intent: Object.assign(Object.create({}) as object, intent),
      };
    if (kind === "accessor")
      bad = {
        ...good,
        intent: Object.defineProperty({ ...intent }, "period", { get }),
      };
    if (kind === "target")
      bad = {
        ...good,
        intent: {
          family: "C02",
          operation: "INSPECT_BASIS",
          deduction: "UNKNOWN",
        },
      };
    if (kind === "rate")
      bad = { ...good, intent: { ...selections[0], rate: "0.01" } };
    if (kind === "factor") bad = { ...good, intent: { ...year, factor: 13 } };
    if (kind === "operation")
      bad = { ...good, intent: { ...intent, operation: "SET_FIELD" } };
    if (kind === "delivery")
      bad = { ...good, intent: { ...intent, engaged: true, delivered: true } };
    unchanged(actor, bad);
    expect(get).not.toHaveBeenCalled();
    actor.stop();
  });
  it("validates accessor event discriminants without executing them at the public validator boundary", () => {
    // XState itself reads event.type before dispatch; that framework routing is
    // not the public validator. Never claim dispatch is a JSON sandbox.
    const get = vi.fn(() => "MODEL_INTENT");
    expect(isActivityEvent(Object.defineProperty({}, "type", { get }))).toBe(
      false,
    );
    expect(get).not.toHaveBeenCalled();
  });
  it("refuses support-phase misuse, global/unbound intent, and unauthorized current stage", () => {
    const registry = new ActivityRegistry([
      c01(),
      {
        activityId: "C01-A01",
        definition: {
          activityId: "C01-A01",
          edges: { ENTRY: { CONTINUE: "ACTIVE" } },
          support: {},
        },
        ports,
      },
    ]);
    const actor = createActivityActor(registry, "C01-A02").start();
    unchanged(actor, event(actor, earning("INCLUDE_EARNING", "REGULAR_PAY")));
    advance(actor, "EXP-02");
    for (const mode of ["REVIEW", "REINFORCEMENT"] as const) {
      actor.send({ type: "OPEN_SUPPORT", mode });
      unchanged(actor, event(actor, earning("INCLUDE_EARNING", "REGULAR_PAY")));
      actor.send({ type: "CLOSE_SUPPORT" });
    }
    const other = createActivityActor(registry, "C01-A01").start();
    unchanged(other, event(actor, earning("INCLUDE_EARNING", "REGULAR_PAY")));
    expect(other.getSnapshot().context.intentModel).toBeUndefined();
    actor.stop();
    other.stop();
  });
  it.each([
    "wrong-row",
    "wrong-basis",
    "forged-rate",
    "stale-stage",
    "non-C02",
  ])("C02 rejects %s and preserves every row/revision", (kind) => {
    const actor = createActivityActor(
      new ActivityRegistry([c02()]),
      "C02-A02",
    ).start();
    advance(actor, "EXP-03");
    const good = event(actor, selections[0]);
    const bad =
      kind === "wrong-row"
        ? { ...good, intent: { ...selections[0], deduction: "OTHER" } }
        : kind === "wrong-basis"
          ? { ...good, intent: { ...selections[0], basis: "GROSS_INCOME" } }
          : kind === "forged-rate"
            ? { ...good, intent: { ...selections[0], rate: "0.1" } }
            : kind === "stale-stage"
              ? { ...good, position: "EXP-02" }
              : { ...good, intent: year };
    unchanged(actor, bad);
    actor.stop();
  });
  it.each(["factor", "conversion", "stage", "revision"])(
    "C05 rejects arbitrary %s",
    (kind) => {
      const actor = createActivityActor(
        new ActivityRegistry([c05()]),
        "C05-A02",
      ).start();
      advance(actor, "EXP-02");
      const good = event(actor, year);
      unchanged(
        actor,
        kind === "factor"
          ? { ...good, intent: { ...year, factor: 11 } }
          : kind === "conversion"
            ? {
                ...good,
                intent: { family: "C05", operation: "CONVERT_TO_WEEKLY" },
              }
            : kind === "stage"
              ? { ...good, position: "EXP-04" }
              : { ...good, revision: 1 },
      );
      actor.stop();
    },
  );
});

describe("D1 complete selection compatibility (test-only C03/C06 adapters)", () => {
  // Context final C3 blobs 619ca232 (C03 §§30–36), 1867a428 (C06 §§29–42),
  // fixed banks PP10-A-0202-C03-001 / C06-001; D050/S1 §2.
  const d = (value: string) => ExactDecimal.from(value);
  const ports: ActivityPorts = {
    ready: () => false,
    evaluate: () => ({ outcome: "RECONSIDERATION", diagnostic: null }),
    completionEligible: () => false,
    sourceReviewAvailable: () => false,
    informationNeeded: () => false,
    informationReturn: () => false,
  };
  const comparison = (activityId: "C03-A02" | "C06-A01" | "C06-A02") => {
    const scenarioId = activityId.replace("A", "S");
    const ids = [`${scenarioId}-A`, `${scenarioId}-B`];
    const issue = (selectionId: string) => {
      const second = selectionId === ids[1];
      if (activityId === "C03-A02") {
        const multiplier = d(second ? "1.69" : "1.25");
        return {
          selectionId,
          state: Object.freeze({
            condition: second ? "REST_DAY" : "ORDINARY_DAY",
            hourly: d("100"),
            hours: d("2"),
            multiplier,
            overtime: d("100").multiply(d("2")).multiply(multiplier),
          }),
        };
      }
      const straight = activityId === "C06-A01" && !second;
      const sales = d(
        activityId === "C06-A01" ? "80000" : second ? "500000" : "300000",
      );
      const rate = d(activityId === "C06-A01" ? "0.05" : "0.03");
      const commission = sales.multiply(rate);
      const base = straight
        ? null
        : d(activityId === "C06-A01" ? "10000" : "15000");
      return {
        selectionId,
        state: Object.freeze({
          arrangement: straight
            ? "STRAIGHT_COMMISSION"
            : "BASE_PLUS_COMMISSION",
          sales,
          rate,
          base: straight
            ? Object.freeze({ kind: "NOT_APPLICABLE" })
            : Object.freeze({ kind: "KNOWN", amount: base }),
          commission,
          total: base
            ? Object.freeze({ kind: "KNOWN", amount: base.add(commission) })
            : Object.freeze({ kind: "NOT_APPLICABLE" }),
        }),
      };
    };
    const binding: ExecutableActivityBinding = {
      activityId,
      definition: {
        activityId,
        edges: { ENTRY: { CONTINUE: "ACTIVE" } },
        support: {},
        modelSelection: {
          modelId: `${activityId}-FIXTURE`,
          scenarioId,
          initialSelectionId: ids[0]!,
          selectionIds: ids,
          allowedSelections: { ACTIVE: ids },
        },
      },
      ports,
      modelAdapter: {
        initialize: () => issue(ids[0]!),
        select: (_current, selectionId) =>
          ids.includes(selectionId) ? issue(selectionId) : null,
      },
    };
    return { binding, ids };
  };
  it.each(["C03-A02", "C06-A01", "C06-A02"] as const)(
    "transports complete approved %s selections and rejects edited/hybrid consequences",
    (activityId) => {
      const { binding, ids } = comparison(activityId);
      const actor = createActivityActor(
        new ActivityRegistry([binding]),
        activityId,
      ).start();
      actor.send({ type: "CONTINUE" });
      const select = (selectionId: string) => ({
        type: "SELECT_MODEL_CHILD" as const,
        modelId: `${activityId}-FIXTURE`,
        selectionId,
        position: "ACTIVE" as const,
        revision: actor.getSnapshot().context.model!.revision,
      });
      const first = actor.getSnapshot().context.model!.value.state;
      if (activityId === "C03-A02") {
        expect(
          (first as { multiplier: ExactDecimal }).multiplier.toString(),
        ).toBe("1.25");
        expect((first as { overtime: ExactDecimal }).overtime.toString()).toBe(
          "250",
        );
      } else {
        expect(
          (first as { commission: ExactDecimal }).commission.toString(),
        ).toBe(activityId === "C06-A01" ? "4000" : "9000");
        expect((first as { base: unknown }).base).toEqual(
          activityId === "C06-A01"
            ? { kind: "NOT_APPLICABLE" }
            : { kind: "KNOWN", amount: d("15000") },
        );
        if (activityId === "C06-A02")
          expect(
            (
              first as { total: { amount: ExactDecimal } }
            ).total.amount.toString(),
          ).toBe("24000");
      }
      actor.send(select(ids[1]!));
      const final = actor.getSnapshot().context.model!.value.state;
      if (activityId === "C03-A02") {
        expect(
          (final as { multiplier: ExactDecimal }).multiplier.toString(),
        ).toBe("1.69");
        expect((final as { overtime: ExactDecimal }).overtime.toString()).toBe(
          "338",
        );
      } else {
        expect(
          (final as { commission: ExactDecimal }).commission.toString(),
        ).toBe(activityId === "C06-A01" ? "4000" : "15000");
        expect(
          (
            final as { total: { amount: ExactDecimal } }
          ).total.amount.toString(),
        ).toBe(activityId === "C06-A01" ? "14000" : "30000");
      }
      for (const bad of [
        { ...select(ids[0]!), multiplier: "1.69" },
        { ...select(ids[0]!), base: "0" },
        { ...select(ids[0]!), sales: "500000", commission: "9000" },
        select("HYBRID"),
      ]) {
        const before = actor.getSnapshot().context.model;
        actor.send(bad);
        expect(actor.getSnapshot().context.model).toBe(before);
        expect(actor.getSnapshot().context.model!.revision).toBe(1);
      }
      actor.send(select(ids[0]!));
      expect(actor.getSnapshot().context.model!.value.state).toEqual(first);
      expect(actor.getSnapshot().context.model!.revision).toBe(2);
      actor.stop();
    },
  );
});

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
type D4Actor = ReturnType<typeof createActivityActor>;
function d4Frame(actor: D4Actor, binding: ExecutableActivityBinding) {
  const c = actor.getSnapshot().context;
  const feedback = c.evaluation
    ? c.evaluation.outcome === "CONFIRMED"
      ? binding.definition.embeddedFloor!.mainFeedback.confirmation
      : binding.definition.embeddedFloor!.mainFeedback.payrollRole
    : null;
  return projectSemanticActivityFrame({
    context: c,
    phase: c.position,
    support: c.origin === null ? "NONE" : "REVIEW",
    definition: binding.definition,
    ports: binding.ports,
    content: {
      references: [],
      modelFacts: [],
      derivedFacts: [],
      responseContract: {
        id: "c02/S01/task",
        text: "Identify the starting gross income, each individual deduction, total deductions, and Anna's final take-home pay.",
      },
      ...(feedback
        ? {
            feedback: {
              outcome: c.evaluation!.outcome,
              revision: c.responseRevision,
              content: feedback,
            },
          }
        : {}),
    },
  });
}
function d4Check(actor: D4Actor, wrong = false) {
  actor.send({ type: "CONTINUE" });
  actor.send({ type: "RESPONSE_CHANGED", response: d4Anna(wrong) });
  actor.send({ type: "CHECK_RESPONSE" });
}
// Test-controlled trusted presentation boundary: the complete exact feedback or
// local passage/consequence and nonvisual equivalent become available before ACK.
// This is headless semantic availability, NOT DOM/a11y/browser certification.
function d4Present(
  actor: D4Actor,
  binding: ExecutableActivityBinding,
  available = true,
) {
  const frame = d4Frame(actor, binding);
  const delivery = frame.c02Delivery;
  if (!delivery || !available) return false;
  const shown = delivery.passages.map((p) => ({ ...p }));
  const accessible = { ...delivery.nonvisual };
  expect(shown.every((p) => d4Texts[p.id] === p.text)).toBe(true);
  expect(d4Texts[accessible.id]).toBe(accessible.text);
  if (delivery.purpose === "MAIN_FEEDBACK")
    expect(frame.feedbackState?.content).toEqual(shown[0]);
  else {
    expect(frame.embeddedFloor!.consequence).not.toBeNull();
    expect(shown).toContainEqual(frame.embeddedFloor!.feedback);
    expect(shown).toContainEqual(frame.embeddedFloor!.explanation);
    expect(accessible).toEqual(frame.embeddedFloor!.nonvisual);
  }
  actor.send({
    type:
      delivery.purpose === "MAIN_FEEDBACK"
        ? "C02_MAIN_FEEDBACK_DELIVERED"
        : "C02_FLOOR_TEACHING_DELIVERED",
    capability: delivery.capability,
  });
  return true;
}
function d4Select(
  actor: D4Actor,
  binding: ExecutableActivityBinding,
  basis: "8000.00" | "10000.00",
) {
  const event = d4Frame(actor, binding).embeddedFloor!.controls.find(
    (e) => e.basis === basis,
  )!;
  expect(event).toBeDefined();
  actor.send(event);
}
function d4Unchanged(actor: D4Actor, event: unknown) {
  const before = actor.getSnapshot().context;
  actor.send(event as ActivityEvent);
  expect(actor.getSnapshot().context).toBe(before);
}

describe("D4 C02 Anna/Floor source-backed public execution", () => {
  const start = () => {
    const registry = new ActivityRegistry([d4Fixture()]);
    const binding = registry.resolve("C02-A01");
    return { binding, actor: createActivityActor(registry, "C02-A01").start() };
  };
  const early = (actor: D4Actor, binding: ExecutableActivityBinding) => {
    expect(d4Frame(actor, binding).completionActionAvailability).toBe(false);
    d4Unchanged(actor, { type: "FINISH_ACTIVITY" });
    expect(
      c02WorkingStateValid(actor.getSnapshot().context, binding.definition),
    ).toBe(true);
  };
  const main = (c: ActivityContext) => ({
    response: c.response,
    checkedResponse: c.checkedResponse,
    responseRevision: c.responseRevision,
    checkedRevision: c.checkedRevision,
    feedbackRevision: c.feedbackRevision,
    evaluation: c.evaluation,
    hasChecked: c.hasChecked,
  });
  it.each([false, true])(
    "both checked branches, meaningful main delivery, diagnostic correction and current Floor teaching: reconsideration=%s",
    (wrong) => {
      const { actor, binding } = start();
      early(actor, binding);
      actor.send({ type: "CONTINUE" });
      early(actor, binding);
      actor.send({ type: "RESPONSE_CHANGED", response: d4Anna(wrong) });
      early(actor, binding);
      actor.send({ type: "CHECK_RESPONSE" });
      early(actor, binding);
      const pending = d4Frame(actor, binding).c02Delivery!;
      expect(pending.purpose).toBe("MAIN_FEEDBACK");
      expect(pending.outcome).toBe(wrong ? "RECONSIDERATION" : "CONFIRMED");
      expect(pending.passages[0]!.id).toBe(
        wrong ? "c02/S01/reconsider-payroll-role" : "c02/S01/confirmation",
      );
      expect(d4Present(actor, binding, false)).toBe(false);
      d4Unchanged(actor, { type: "CONTINUE" });
      d4Unchanged(actor, { type: "FEEDBACK_DELIVERED", revision: 1 });
      expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
      d4Present(actor, binding);
      expect(actor.getSnapshot().context.feedbackRevision).toBe(1);
      expect(actor.getSnapshot().context.position).toBe(
        wrong ? "RECONSIDERATION" : "CONFIRMATION",
      );
      early(actor, binding);
      d4Unchanged(actor, {
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: pending.capability,
      });
      actor.send({ type: "CONTINUE" });
      expect(actor.getSnapshot().context.position).toBe("C02-S01-F");
      early(actor, binding);
      const anna = main(actor.getSnapshot().context);
      expect(d4Frame(actor, binding).embeddedFloor!.consequence).toBeNull();
      d4Select(actor, binding, "8000.00");
      early(actor, binding);
      const diagnostic = d4Frame(actor, binding);
      expect(diagnostic.embeddedFloor!.consequence).toEqual({
        basis: "8000.00",
        share: "200.00",
        rate: "2.5%",
      });
      expect(diagnostic.embeddedFloor!.feedback!.text).toBe(
        d4Texts["c02/S01-F/reconsider"],
      );
      const stale = diagnostic.c02Delivery!;
      d4Present(actor, binding);
      early(actor, binding);
      expect(actor.getSnapshot().context.c02Floor!.teachingRevision).toBe(1);
      d4Select(actor, binding, "10000.00");
      early(actor, binding);
      expect(main(actor.getSnapshot().context)).toEqual(anna);
      expect(actor.getSnapshot().context.response).toBe(anna.response);
      expect(actor.getSnapshot().context.checkedResponse).toBe(
        anna.checkedResponse,
      );
      expect(actor.getSnapshot().context.evaluation).toBe(anna.evaluation);
      expect(actor.getSnapshot().context.c02Floor!.revision).toBe(2);
      expect(actor.getSnapshot().context.c02Floor!.teachingRevision).toBeNull();
      d4Unchanged(actor, {
        type: "C02_FLOOR_TEACHING_DELIVERED",
        capability: stale.capability,
      });
      expect(d4Frame(actor, binding).embeddedFloor!.consequence).toEqual({
        basis: "10000.00",
        share: "250.00",
        rate: "2.5%",
      });
      d4Present(actor, binding);
      expect(d4Frame(actor, binding).completionActionAvailability).toBe(true);
      expect(main(actor.getSnapshot().context)).toEqual(anna);
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).toBe("COMPLETE");
      expect(
        c02WorkingStateValid(actor.getSnapshot().context, binding.definition),
      ).toBe(true);
      actor.stop();
    },
  );
  it.each([false, true])(
    "direct correct basis requires its own delivery and main completion port: reconsideration=%s",
    (wrong) => {
      const { actor, binding } = start();
      d4Check(actor, wrong);
      d4Present(actor, binding);
      actor.send({ type: "CONTINUE" });
      d4Select(actor, binding, "10000.00");
      early(actor, binding);
      d4Present(actor, binding);
      expect(d4Frame(actor, binding).completionActionAvailability).toBe(true);
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).toBe("COMPLETE");
      actor.stop();
      const fixture = d4Fixture();
      const refused = {
        ...fixture,
        ports: { ...fixture.ports, completionEligible: () => false },
      };
      const registry = new ActivityRegistry([refused]);
      const b = registry.resolve("C02-A01");
      const a = createActivityActor(registry, "C02-A01").start();
      d4Check(a, wrong);
      d4Present(a, b);
      a.send({ type: "CONTINUE" });
      d4Select(a, b, "10000.00");
      d4Present(a, b);
      early(a, b);
      a.stop();
    },
  );
  it("rejects forged copied excess-field wrong-purpose and stale capabilities in both pending branches", () => {
    for (const wrong of [false, true]) {
      const { actor, binding } = start();
      d4Check(actor, wrong);
      const token = d4Frame(actor, binding).c02Delivery!.capability;
      for (const input of [
        { type: "C02_MAIN_FEEDBACK_DELIVERED" },
        { type: "C02_MAIN_FEEDBACK_DELIVERED", capability: {} },
        { type: "C02_MAIN_FEEDBACK_DELIVERED", capability: { ...token } },
        {
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: { identity: Symbol("forged") },
        },
        { type: "C02_MAIN_FEEDBACK_DELIVERED", capability: token, revision: 1 },
        {
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: token,
          contentId: "wrong",
        },
        {
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: token,
          branch: "CONFIRMED",
        },
        {
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: token,
          revision: -1,
        },
        { type: "C02_FLOOR_TEACHING_DELIVERED", capability: token },
        { type: "FEEDBACK_DELIVERED", revision: 1 },
        { type: "FEEDBACK_DELIVERED", revision: 0 },
        { type: "FEEDBACK_DELIVERED", revision: 2 },
        { type: "FEEDBACK_DELIVERED", revision: NaN },
      ])
        d4Unchanged(actor, input);
      actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      d4Unchanged(actor, {
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: token,
      });
      d4Unchanged(actor, { type: "CONTINUE" });
      d4Unchanged(actor, { type: "FINISH_ACTIVITY" });
      actor.send({ type: "CLOSE_SUPPORT" });
      d4Unchanged(actor, {
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: token,
      });
      d4Present(actor, binding);
      actor.send({ type: "CONTINUE" });
      d4Unchanged(actor, {
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: token,
      });
      actor.stop();
    }
  });
  it("isolates matching actors from one machine and separate Runtime actors; wrong actor and branch never acknowledge", () => {
    const fixture = d4Fixture();
    const machine = createActivityMachine(fixture.definition, fixture.ports);
    const a = createActor(machine).start();
    const b = createActor(machine).start();
    for (const actor of [a, b]) d4Check(actor);
    const ta = d4Frame(a, fixture).c02Delivery!.capability;
    d4Unchanged(b, { type: "C02_MAIN_FEEDBACK_DELIVERED", capability: ta });
    d4Present(a, fixture);
    expect(b.getSnapshot().context.feedbackRevision).toBeNull();
    const other = start();
    d4Check(other.actor, true);
    d4Unchanged(other.actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: ta,
    });
    d4Present(b, fixture);
    a.send({ type: "CONTINUE" });
    b.send({ type: "CONTINUE" });
    d4Select(a, fixture, "8000.00");
    d4Select(b, fixture, "8000.00");
    const local = d4Frame(a, fixture).c02Delivery!.capability;
    d4Unchanged(b, { type: "C02_FLOOR_TEACHING_DELIVERED", capability: local });
    d4Present(a, fixture);
    expect(b.getSnapshot().context.c02Floor!.teachingRevision).toBeNull();
    d4Select(a, fixture, "10000.00");
    expect(b.getSnapshot().context.c02Floor!.basis).toBe("8000.00");
    for (const actor of [a, b, other.actor]) actor.stop();
  });
  it("REVISE changed Anna CHECK_AGAIN invalidates pending delivery and starts fresh Floor; fresh replay starts at Entry", () => {
    const { actor, binding } = start();
    d4Check(actor, true);
    const old = d4Frame(actor, binding).c02Delivery!.capability;
    actor.send({ type: "REVISE" });
    expect(actor.getSnapshot().context.position).toBe("REVISION");
    expect(actor.getSnapshot().context.c02Floor!.phase).toBe("MAIN");
    d4Unchanged(actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: old,
    });
    early(actor, binding);
    actor.send({ type: "RESPONSE_CHANGED", response: d4Anna() });
    actor.send({ type: "CHECK_AGAIN" });
    expect(actor.getSnapshot().context.evaluation!.outcome).toBe("CONFIRMED");
    expect(actor.getSnapshot().context.responseRevision).toBe(2);
    d4Unchanged(actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: old,
    });
    d4Present(actor, binding);
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.c02Floor).toMatchObject({
      mainRevision: 2,
      revision: 0,
      basis: null,
      teachingRevision: null,
    });
    d4Select(actor, binding, "10000.00");
    d4Present(actor, binding);
    actor.send({ type: "FINISH_ACTIVITY" });
    const replay = start();
    expect(replay.actor.getSnapshot().context).toMatchObject({
      position: "ENTRY",
      response: null,
      responseRevision: 0,
    });
    expect(replay.actor.getSnapshot().context.c02Floor!.basis).toBeNull();
    d4Unchanged(replay.actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: old,
    });
    actor.stop();
    replay.actor.stop();
  });
  it("rejects invalid basis stage revisions overlays and generic terminal-teaching bypass without Anna mutation", () => {
    const { actor, binding } = start();
    d4Check(actor);
    d4Present(actor, binding);
    actor.send({ type: "CONTINUE" });
    const event = d4Frame(actor, binding).embeddedFloor!.controls[0]!;
    for (const patch of [
      { basis: "9000.00" },
      { rate: "5%" },
      { revision: -1 },
      { revision: 1 },
      { revision: Number.MAX_SAFE_INTEGER },
      { mainRevision: 0 },
      { mainRevision: 2 },
      { activityId: "C02-A02" },
      { scenarioId: "C02-S01" },
      { position: "ACTIVE" },
    ])
      d4Unchanged(actor, { ...event, ...patch });
    for (const input of [
      { type: "PREVIOUS" },
      { type: "CONTINUE" },
      { type: "REVISE" },
      { type: "CHECK_RESPONSE" },
      { type: "OPEN_SUPPORT", mode: "REVIEW" },
      { type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" },
      {
        type: "TERMINAL_TEACHING_DELIVERED",
        revision: 1,
        contentId: "C02-FLOOR-EXPLANATION",
      },
    ])
      d4Unchanged(actor, input);
    d4Select(actor, binding, "8000.00");
    const stale = d4Frame(actor, binding).c02Delivery!.capability;
    d4Unchanged(actor, event);
    d4Select(actor, binding, "10000.00");
    d4Unchanged(actor, {
      type: "C02_FLOOR_TEACHING_DELIVERED",
      capability: stale,
    });
    const current = d4Frame(actor, binding).c02Delivery!.capability;
    d4Unchanged(actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: current,
    });
    d4Unchanged(actor, {
      type: "C02_FLOOR_TEACHING_DELIVERED",
      capability: { ...current },
    });
    d4Unchanged(actor, {
      type: "C02_FLOOR_TEACHING_DELIVERED",
      capability: current,
      contentId: "wrong",
    });
    d4Present(actor, binding);
    d4Unchanged(actor, {
      type: "C02_FLOOR_TEACHING_DELIVERED",
      capability: current,
    });
    actor.stop();
  });
  it("proves live interruption invariants at every boundary and rejects detached contradictory unissued D5 restoration", () => {
    const { actor, binding } = start();
    const inspect = () => {
      const c = actor.getSnapshot().context;
      expect(c02WorkingStateValid(c, binding.definition)).toBe(true);
      expect(c02WorkingStateValid({ ...c }, binding.definition)).toBe(false);
      for (const patch of [
        { activityId: "C02-A02" },
        { responseRevision: c.responseRevision + 1 },
        { position: "ACTIVE" },
        { c02Floor: { ...c.c02Floor!, revision: -1 } },
        {
          c02Floor: {
            ...c.c02Floor!,
            basis: "10000.00",
            outcome: "RECONSIDERATION",
          },
        },
      ]) {
        expect(
          c02WorkingStateValid(
            { ...c, ...patch } as ActivityContext,
            binding.definition,
          ),
        ).toBe(false);
      }
      expect(() =>
        createActivityRestoration(binding.definition, binding.ports, c),
      ).toThrow("D5");
      expect(() =>
        createActivityMachine(binding.definition, binding.ports, undefined, {
          activityId: "C02-A01",
        }),
      ).toThrow("Unissued");
    };
    inspect();
    actor.send({ type: "CONTINUE" });
    inspect();
    actor.send({ type: "RESPONSE_CHANGED", response: d4Anna() });
    inspect();
    actor.send({ type: "CHECK_RESPONSE" });
    inspect();
    d4Present(actor, binding);
    inspect();
    actor.send({ type: "CONTINUE" });
    inspect();
    d4Select(actor, binding, "8000.00");
    inspect();
    d4Present(actor, binding);
    inspect();
    d4Select(actor, binding, "10000.00");
    inspect();
    d4Present(actor, binding);
    inspect();
    actor.send({ type: "FINISH_ACTIVITY" });
    inspect();
    actor.stop();
  });
});

describe("D4 additional main content and revision epochs", () => {
  it("source arithmetic reconsideration authenticates its own current content before explicit Continue", () => {
    const source = d4Fixture();
    const binding = {
      ...source,
      ports: {
        ...source.ports,
        evaluate: (response: LearnerResponse) => {
          const result = source.ports.evaluate(response);
          return result.outcome === "CONFIRMED"
            ? result
            : { ...result, diagnostic: "c02/S01/reconsider-arithmetic" };
        },
      },
    };
    const registry = new ActivityRegistry([binding]);
    const saved = registry.resolve("C02-A01");
    const actor = createActivityActor(registry, "C02-A01").start();
    d4Check(actor, true);
    const f = d4Frame(actor, saved);
    const descriptor = f.c02Delivery!;
    expect(descriptor.passages[0]!.id).toBe("c02/S01/reconsider-arithmetic");
    expect(f.feedbackState!.content).toEqual(descriptor.passages[0]);
    // Explicit exact branch passage and accessible equivalent available first.
    expect(descriptor.passages[0]!.text).toBe(
      d4Texts["c02/S01/reconsider-arithmetic"],
    );
    expect(descriptor.nonvisual).toEqual(descriptor.passages[0]);
    actor.send({
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: descriptor.capability,
    });
    expect(actor.getSnapshot().context.position).toBe("RECONSIDERATION");
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("C02-S01-F");
    actor.stop();
  });
  it("same-revision recheck after Revise rejects the prior delivery epoch; valid Floor acknowledgments cannot unlock main", () => {
    const registry = new ActivityRegistry([d4Fixture()]);
    const binding = registry.resolve("C02-A01");
    const actor = createActivityActor(registry, "C02-A01").start();
    d4Check(actor, true);
    const previous = d4Frame(actor, binding).c02Delivery!.capability;
    d4Present(actor, binding);
    actor.send({ type: "REVISE" });
    expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
    actor.send({ type: "CHECK_AGAIN" });
    expect(actor.getSnapshot().context.responseRevision).toBe(1);
    d4Unchanged(actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: previous,
    });
    d4Present(actor, binding);
    actor.send({ type: "CONTINUE" });
    d4Select(actor, binding, "10000.00");
    const local = d4Frame(actor, binding).c02Delivery!.capability;
    d4Unchanged(actor, {
      type: "C02_MAIN_FEEDBACK_DELIVERED",
      capability: local,
    });
    d4Unchanged(actor, { type: "FINISH_ACTIVITY" });
    d4Present(actor, binding);
    d4Unchanged(actor, {
      type: "C02_FLOOR_TEACHING_DELIVERED",
      capability: local,
    });
    actor.stop();
  });
});
