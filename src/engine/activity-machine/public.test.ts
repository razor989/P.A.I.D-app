import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import {
  createActivityMachine,
  isActivityEvent,
  validateActivityDefinition,
} from "./public";
import type { ActivityDefinition, ActivityPorts } from "./public";

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

describe("shared parallel activity grammar", () => {
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
      expect(a.getSnapshot().context.position).toBe("ACTIVE");
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
      support: "sourceReview",
    });
    a.send({ type: "CLOSE_SUPPORT" });
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
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
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
});
