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
