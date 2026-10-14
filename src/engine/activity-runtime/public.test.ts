import { describe, expect, it } from "vitest";
import type { ExecutableActivityBinding } from "../registry/public";
import { ActivityRegistry } from "../registry/public";
import { createActivityActor } from "./public";

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
