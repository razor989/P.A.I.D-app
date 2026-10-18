import { describe, expect, it, vi } from "vitest";
import type { ExecutableActivityBinding } from "../registry/public";
import { ActivityRegistry } from "../registry/public";
import { createActivityActor } from "./public";
import { createActivityRestoration } from "../activity-machine/public";
import type {
  ActivityIntentAdapter,
  ModelIntent,
} from "../activity-machine/public";
import { ExactDecimal } from "../../core/public";

describe("D1 Registry → Runtime → actor intent transport", () => {
  // C05 final C3 §§30–35 / D050/S1; compatibility fixture, not production binding.
  const year: ModelIntent = {
    family: "C05",
    operation: "PARTITION_YEAR_INTO_MONTHS",
  };
  const make = (
    adapter?: ActivityIntentAdapter,
  ): ExecutableActivityBinding => ({
    activityId: "C05-A02",
    definition: {
      activityId: "C05-A02",
      edges: {
        ENTRY: { CONTINUE: "EXP-02" },
        "EXP-02": { CONTINUE: "ACTIVE" },
      },
      support: {},
      modelIntents: {
        family: "C05",
        modelId: "C05-FIXTURE",
        scenarioId: "C05-S02",
        permissions: [{ position: "EXP-02", intent: year }],
      },
    },
    ports: fixture().ports,
    intentAdapter: adapter ?? {
      initialize: () =>
        Object.freeze({ annual: ExactDecimal.from("480000"), monthly: null }),
      transition: (current) => {
        const state = current as {
          annual: ExactDecimal;
          monthly: ExactDecimal | null;
        };
        return state.monthly
          ? null
          : Object.freeze({
              ...state,
              monthly: state.annual.divide(ExactDecimal.from("12")),
            });
      },
    },
  });
  it("creates unstarted fresh isolated actors and transports immutable meaningful changes exactly once", () => {
    const registry = new ActivityRegistry([make()]);
    const a = createActivityActor(registry, "C05-A02");
    const b = createActivityActor(registry, "C05-A02");
    const publish = vi.fn();
    a.subscribe(publish);
    expect(publish).not.toHaveBeenCalled();
    const first = a.getSnapshot().context.intentModel!;
    expect(first.state).not.toBe(b.getSnapshot().context.intentModel!.state);
    a.start();
    b.start();
    a.send({ type: "CONTINUE" });
    const intentEvent = {
      type: "MODEL_INTENT" as const,
      activityId: "C05-A02" as const,
      scenarioId: "C05-S02",
      modelId: "C05-FIXTURE",
      position: "EXP-02" as const,
      revision: 0,
      intent: year,
    };
    a.send(intentEvent);
    const next = a.getSnapshot().context.intentModel!;
    expect((next.state as { monthly: ExactDecimal }).monthly.toString()).toBe(
      "40000",
    );
    expect((first.state as { monthly: null }).monthly).toBeNull();
    expect(next.revision).toBe(1);
    expect(Object.isFrozen(next.state)).toBe(true);
    a.send(intentEvent);
    expect(a.getSnapshot().context.intentModel).toBe(next);
    a.send({ ...intentEvent, revision: 1 });
    expect(a.getSnapshot().context.intentModel).toBe(next);
    expect(b.getSnapshot().context.intentModel!.revision).toBe(0);
    const fresh = createActivityActor(registry, "C05-A02");
    expect(fresh.getSnapshot().context.intentModel!.revision).toBe(0);
    expect(
      (fresh.getSnapshot().context.intentModel!.state as { monthly: null })
        .monthly,
    ).toBeNull();
    const retained = registry.resolve("C05-A02");
    // D5 deliberately does not add non-C04 restoration authority.
    expect(() =>
      createActivityRestoration(
        retained.definition,
        retained.ports,
        a.getSnapshot().context,
      ),
    ).toThrow("Invalid semantic restoration");
    expect(() =>
      createActivityActor(registry, "C05-A02", { activityId: "C05-A02" }),
    ).toThrow("Unissued");
    a.stop();
    b.stop();
    fresh.stop();
  });
  it.each([
    "null",
    "same",
    "equal",
    "mutable",
    "nested-mutable",
    "accessor",
    "prototype",
    "throw",
  ])("rejects adapter %s transition without state/revision changes", (kind) => {
    const get = vi.fn(() => true);
    const registry = new ActivityRegistry([
      make({
        initialize: () => Object.freeze({ partitioned: false }),
        transition: (current) => {
          if (kind === "null") return null;
          if (kind === "same") return current;
          if (kind === "equal") return Object.freeze({ partitioned: false });
          if (kind === "mutable") return { partitioned: true };
          if (kind === "nested-mutable")
            return Object.freeze({ nested: { partitioned: true } });
          if (kind === "accessor")
            return Object.freeze(
              Object.defineProperty({}, "partitioned", { get }),
            );
          if (kind === "prototype")
            return Object.freeze(
              Object.assign(Object.create({}) as object, { partitioned: true }),
            );
          throw new Error("domain refusal");
        },
      }),
    ]);
    const actor = createActivityActor(registry, "C05-A02").start();
    actor.send({ type: "CONTINUE" });
    const before = actor.getSnapshot().context.intentModel!;
    actor.send({
      type: "MODEL_INTENT",
      activityId: "C05-A02",
      scenarioId: "C05-S02",
      modelId: "C05-FIXTURE",
      position: "EXP-02",
      revision: 0,
      intent: year,
    });
    expect(actor.getSnapshot().context.intentModel).toBe(before);
    expect(actor.getSnapshot().context.intentModel!.revision).toBe(0);
    expect(get).not.toHaveBeenCalled();
    actor.stop();
  });
});

// Fixture is synthetic execution data; T027 must authenticate source C04 bindings.
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

describe("generic T024 actor factory", () => {
  it("forwards only issued restoration bound to the resolved evaluator", () => {
    const registry = new ActivityRegistry([fixture()]);
    const binding = registry.resolve("C04-A01");
    const fresh = createActivityActor(registry, "C04-A01");
    const context = {
      ...fresh.getSnapshot().context,
      position: "ACTIVE" as const,
    };
    const token = createActivityRestoration(
      binding.definition,
      binding.ports,
      context,
    );
    const restored = createActivityActor(registry, "C04-A01", token);
    expect(restored.getSnapshot().value).toEqual({
      instructional: "active",
      support: "none",
    });
    let published = 0;
    restored.subscribe(() => published++);
    expect(published).toBe(0);
    restored.start();
    expect(restored.getSnapshot().context.position).toBe("ACTIVE");
    expect(fresh.getSnapshot().context.position).toBe("ENTRY");
    expect(() =>
      createActivityActor(registry, "C04-A01", { activityId: "C04-A01" }),
    ).toThrow("Unissued");
    expect(() =>
      createActivityActor(new ActivityRegistry([fixture()]), "C04-A01", token),
    ).toThrow("Unissued");
    restored.stop();
    fresh.stop();
  });
  it("independently initializes, selects, checks, supports and resets synthetic model actors", () => {
    const base = fixture();
    const initialize = vi.fn(() => ({
      selectionId: "A",
      state: Object.freeze({ private: true }),
    }));
    const binding: ExecutableActivityBinding = {
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
      modelAdapter: {
        initialize,
        select: (_current, selectionId) => ({
          selectionId,
          state: Object.freeze({ selectionId }),
        }),
      },
    };
    const registry = new ActivityRegistry([binding]);
    const a = createActivityActor(registry, base.activityId).start();
    const b = createActivityActor(registry, base.activityId).start();
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(a.getSnapshot().context.model!.value.state).not.toBe(
      b.getSnapshot().context.model!.value.state,
    );
    a.send({ type: "CONTINUE" });
    b.send({ type: "CONTINUE" });
    const select = (actor: typeof a, selectionId: string) =>
      actor.send({
        type: "SELECT_MODEL_CHILD",
        modelId: "synthetic",
        selectionId,
        revision: actor.getSnapshot().context.model!.revision,
        position: actor.getSnapshot().context.position,
      });
    select(a, "A");
    select(b, "B");
    const second = b.getSnapshot().context.model;
    select(a, "B");
    expect(a.getSnapshot().context.model!.revision).toBe(2);
    expect(second!.revision).toBe(1);
    expect(b.getSnapshot().context.model).toBe(second);
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    select(a, "A");
    a.send({ type: "CLOSE_SUPPORT" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { kind: "SINGLE_SELECTION", selectionId: "synthetic" },
    });
    a.send({ type: "CHECK_RESPONSE" });
    expect(b.getSnapshot().context.response).toBeNull();
    expect(b.getSnapshot().context.model).toBe(second);
    a.stop();
    const fresh = createActivityActor(registry, base.activityId);
    expect(initialize).toHaveBeenCalledTimes(3);
    expect(fresh.getSnapshot().context.model).toMatchObject({
      revision: 0,
      value: { selectionId: "A" },
    });
    expect(fresh.getSnapshot().context.model!.value.state).not.toBe(
      second!.value.state,
    );
    fresh.stop();
    b.stop();
  });
  it("constructs unstarted actors; the caller starts, advances and disposes them", () => {
    const registry = new ActivityRegistry([fixture()]);
    const a = createActivityActor(registry, "C04-A01");
    const b = createActivityActor(registry, "C04-A01");
    let published = 0;
    const subscription = a.subscribe(() => published++);
    expect(published).toBe(0);
    expect(a).not.toBe(b);
    expect(a.getSnapshot().context).not.toBe(b.getSnapshot().context);
    expect(a.getSnapshot().context.position).toBe("ENTRY");
    expect(a.getSnapshot().value).toEqual({
      instructional: "entry",
      support: "none",
    });
    expect(b.getSnapshot().context.position).toBe("ENTRY");
    a.start();
    expect(published).toBe(1);
    b.start();
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(a.getSnapshot().value).toEqual({
      instructional: "active",
      support: "review",
    });
    expect(b.getSnapshot().value).toEqual({
      instructional: "entry",
      support: "none",
    });
    a.send({ type: "CLOSE_SUPPORT" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: { kind: "SINGLE_SELECTION", selectionId: "synthetic-choice" },
    });
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.checkedRevision).toBe(1);
    expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
    expect(b.getSnapshot().context.response).toBeNull();
    expect(b.getSnapshot().context.checkedRevision).toBeNull();
    expect(b.getSnapshot().context.evaluation).toBeNull();
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("COMPLETE");
    expect(b.getSnapshot().context.feedbackRevision).toBeNull();
    expect(b.getSnapshot().context.position).toBe("ENTRY");
    a.stop();
    subscription.unsubscribe();
    b.stop();
    const c = createActivityActor(registry, "C04-A01");
    expect(c.getSnapshot().context.position).toBe("ENTRY");
    c.start();
    c.stop();
  });

  it("does not start, publish or manufacture a fallback actor for invalid requests", () => {
    const registry = new ActivityRegistry([fixture()]);
    expect(() => createActivityActor(registry, "C04-A02")).toThrow(/Unbound/);
    expect(() => createActivityActor(registry, "C02-S01-F")).toThrow(/Unknown/);
    expect(() => createActivityActor(registry, undefined)).toThrow(/Unknown/);
    expect(() => createActivityActor({} as never, "C04-A01")).toThrow(
      /Invalid activity registry/,
    );
  });

  it("repeated construction ignores caller mutations made after registration", () => {
    const input = fixture();
    const registry = new ActivityRegistry([input]);
    (input.definition.edges.ENTRY as { CONTINUE: string }).CONTINUE = "EXP-99";
    (input.ports as { ready: typeof input.ports.ready }).ready = () => false;
    const a = createActivityActor(registry, "C04-A01");
    const b = createActivityActor(registry, "C04-A01");
    a.start();
    b.start();
    a.send({ type: "CONTINUE" });
    b.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    expect(b.getSnapshot().context.position).toBe("ACTIVE");
    a.stop();
    b.stop();
  });
});
