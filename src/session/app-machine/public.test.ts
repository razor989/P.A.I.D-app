import { afterEach, describe, expect, it, vi } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { ActivityId, CompetencyId, LearnerResponse } from "@/core/public";
import {
  composeC04ActivityFrame,
  createC04ActivityActor,
  createCanonicalC04Runtime,
} from "@/engine/c04-activity-binding/public";
import { recoverCheckpoint } from "@/recovery/rehydration/public";
import { composeStudyCatalog } from "@/study/catalog/public";
import {
  applySessionStartupClassification,
  beginSessionStartupReadRetry,
  createAppSessionActor,
  isSessionEvent,
  selectSession,
} from "./public";
import type { AppSessionActor, CompletionKnowledge } from "./public";

describe("T035 optional trusted runtime input", () => {
  it("T036 public intents strictly reject payload and classification smuggling", () => {
    for (const type of [
      "CONTINUE_RECOVERED_ACTIVITY",
      "ABANDON_RECOVERED_ACTIVITY",
      "DISCARD_UNUSABLE_CHECKPOINT",
      "RETRY_RECOVERY_CLEAR",
      "CONFIRM_RECOVERY_CLEAR",
    ]) {
      expect(isSessionEvent({ type })).toBe(true);
      expect(isSessionEvent({ type, status: "durable" })).toBe(false);
      expect(isSessionEvent(Object.assign(Object.create({}), { type }))).toBe(
        false,
      );
      expect(
        isSessionEvent({
          get type() {
            throw Error("must not read");
          },
        }),
      ).toBe(false);
    }
    expect(
      isSessionEvent({
        type: "startup.classified",
        recovery: { status: "NO_CHECKPOINT" },
      }),
    ).toBe(false);
    expect(isSessionEvent({ type: "startup.readRetry" })).toBe(false);
    const actor = createAppSessionActor({ catalog: catalog() });
    sessions.push(actor);
    expect(
      applySessionStartupClassification(actor, { status: "NO_CHECKPOINT" }),
    ).toBe("ignored");
    expect(beginSessionStartupReadRetry(actor)).toBe(false);
    actor.start();
    actor.send({
      type: "startup.classified",
      recovery: { status: "NO_CHECKPOINT" },
    });
    expect(selectSession(actor).destination).toBeNull();
    expect(
      applySessionStartupClassification(actor, { status: "NO_CHECKPOINT" }),
    ).toBe("ignored");
  });
  it("rejects nonissued capability before constructing Session", () => {
    const runtime = createCanonicalC04Runtime();
    for (const fake of [
      { ...runtime },
      new Proxy(runtime, {}),
      Object.create(runtime) as typeof runtime,
    ])
      expect(() =>
        createAppSessionActor({ catalog: catalog(), c04Runtime: fake }),
      ).toThrow("Invalid canonical C04 runtime");
  });
  it("accepts an authentic capability without resolving startup or constructing an activity", () => {
    const c04Runtime = createCanonicalC04Runtime();
    const actor = createAppSessionActor({ catalog: catalog(), c04Runtime });
    sessions.push(actor);
    actor.start();
    expect(selectSession(actor).destination).toBeNull();
    expect(selectSession(actor).currentActivity).toBeNull();
    expect(actor.getSnapshot().context.createFreshActivity).toBe(
      c04Runtime.createActivityActor,
    );
  });
});

// Synthetic catalog composition, NOT replacement fixed bank content. Real C04
// actors still authenticate their own canonical Study source inside the facade.
const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"] as const;
const catalog = () =>
  composeStudyCatalog({
    complete: false,
    competencies: [
      { id: "C04", activityIds: ids },
      { id: "C01", activityIds: ["C01-A01"] },
    ],
    activities: [...ids, "C01-A01"].map((id) => ({
      id,
      competencyId: id.slice(0, 3),
      scenarioIds: [id.replace("-A", "-S")],
      instructionalFamily: "Session identity fixture",
      contentReferences: [{ contentId: "session-test-copy", variableIds: [] }],
      responseContract: { contractId: "session-test-response" },
    })),
    scenarios: ids.map((id) => ({
      id: id.replace("-A", "-S"),
      activityId: id,
      competencyId: "C04",
      facts: [],
      variants: [],
    })),
    contentIds: [],
    responseContractIds: [],
    modelProfileIds: [],
    interactionProfileIds: [],
    oracleIds: [],
  });
const sessions: AppSessionActor[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
  vi.restoreAllMocks();
});
function session(completion?: CompletionKnowledge) {
  const actor = createAppSessionActor({
    catalog: catalog(),
    recovery: { status: "NO_CHECKPOINT" },
    ...(completion ? { completion } : {}),
  });
  sessions.push(actor);
  return actor.start();
}
function open(actor: AppSessionActor, id: ActivityId = "C04-A01") {
  actor.send({ type: "SELECT_ACTIVITY", activityId: id });
  const activity = selectSession(actor).currentActivity;
  if (!activity) throw new Error("Expected current Activity Actor");
  return activity;
}
const money = (n: string) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(ExactDecimal.from(n), "MONETARY_AMOUNT", "PHP", "per month"),
});
const percent = (n: string) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(ExactDecimal.from(n), "PERCENTAGE_CHANGE", "%", null),
});
const composite = (
  fields: Record<
    string,
    Exclude<LearnerResponse, { kind: "COMPOSITE" | "MODEL_STATE" }>
  >,
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: Object.entries(fields).map(([key, response]) => ({ key, response })),
});
function technicalTrace(actor: AppSessionActor) {
  actor.send({ type: "TECHNICAL_STARTED" });
  expect(selectSession(actor).technical).toBe("loading");
  const error = new Error("Controlled technical interruption");
  actor.send({ type: "TECHNICAL_FAILED", recoverable: true, error });
  expect(selectSession(actor).technical).toBe("recoverable");
  expect(selectSession(actor).technicalError).toBe(error);
  actor.send({ type: "TECHNICAL_STARTED" });
  actor.send({ type: "TECHNICAL_SUCCEEDED" });
  expect(selectSession(actor).technical).toBe("idle");
  actor.send({ type: "TECHNICAL_STARTED" });
  actor.send({ type: "TECHNICAL_FAILED", recoverable: false, error });
  expect(selectSession(actor).technical).toBe("unrecoverable");
}

describe("T032 authoritative headless Session core", () => {
  it("leaves missing startup evidence unresolved; never assumes no checkpoint", () => {
    const actor = createAppSessionActor({ catalog: catalog() });
    sessions.push(actor);
    actor.start();
    expect(actor.getSnapshot().value).toEqual({ startup: "evaluate" });
    expect(selectSession(actor)).toMatchObject({
      destination: null,
      currentActivity: null,
      completion: { kind: "unknown" },
    });
    expect(
      actor
        .getSnapshot()
        .can({ type: "SELECT_ACTIVITY", activityId: "C04-A01" }),
    ).toBe(false);
  });

  it("accepts explicit absent classification into Library and all three regions", () => {
    const actor = session();
    expect(actor.getSnapshot().value).toEqual({
      session: {
        destination: "library",
        decision: "none",
        technical: "idle",
        lifecycle: "idle",
      },
    });
    expect(selectSession(actor)).toMatchObject({
      destination: { kind: "library" },
      currentActivity: null,
      completion: { kind: "unknown" },
    });
    expect(Object.isFrozen(selectSession(actor).destination)).toBe(true);
  });

  it("selects catalog competencies without constructing an Activity Actor", () => {
    const actor = session();
    for (const competencyId of ["C04", "C01"] as const) {
      actor.send({ type: "SELECT_COMPETENCY", competencyId });
      expect(selectSession(actor).destination).toEqual({
        kind: "competency",
        competencyId,
      });
      expect(selectSession(actor).currentActivity).toBeNull();
    }
  });

  it.each(ids)(
    "constructs canonical %s and preserves it through repeated selection",
    (id) => {
      const actor = session();
      const activity = open(actor, id);
      expect(activity.getSnapshot().context.activityId).toBe(id);
      expect(activity.getSnapshot().context.position).toBe("ENTRY");
      activity.send({ type: "CONTINUE" });
      const before = activity.getSnapshot();
      for (let i = 0; i < 10; i++)
        actor.send({ type: "SELECT_ACTIVITY", activityId: id });
      expect(selectSession(actor).currentActivity).toBe(activity);
      expect(activity.getSnapshot()).toBe(before);
      expect(selectSession(actor).destination).toEqual({
        kind: "activity",
        activityId: id,
      });
      expect(Object.keys(actor.getSnapshot().children)).toEqual([
        "0.appSession",
      ]);
    },
  );

  it("browses competencies without abandoning A and re-enters the exact live A", () => {
    const actor = session();
    const a = open(actor);
    a.send({ type: "CONTINUE" });
    const before = a.getSnapshot();
    actor.send({ type: "SELECT_COMPETENCY", competencyId: "C01" });
    expect(selectSession(actor).destination).toEqual({
      kind: "competency",
      competencyId: "C01",
    });
    expect(selectSession(actor).currentActivity).toBe(a);
    expect(a.getSnapshot()).toBe(before);
    open(actor);
    expect(a.getSnapshot()).toBe(before);
    expect(selectSession(actor).destination).toEqual({
      kind: "activity",
      activityId: "C04-A01",
    });
  });

  it("opens authorized T034 executable conflicts without losing A and rejects unavailable B", () => {
    const actor = session();
    const a = open(actor);
    const stop = vi.spyOn(a, "stop");
    const before = actor.getSnapshot();
    for (const id of ["C04-A02", "C04-A03", "C04-A04", "C01-A01"] as const) {
      const event = { type: "SELECT_ACTIVITY" as const, activityId: id };
      expect(actor.getSnapshot().can(event)).toBe(id !== "C01-A01");
      actor.send(event);
      expect(selectSession(actor).currentActivity).toBe(a);
      if (id !== "C01-A01") {
        expect(selectSession(actor).decision).toBe("activitySwitchChoice");
        actor.send({ type: "CANCEL_PENDING_ACTIVITY_SWITCH" });
      }
      expect(selectSession(actor).destination).toBe(before.context.destination);
    }
    expect(stop).not.toHaveBeenCalled();
    expect(selectSession(actor).decision).toBe("none");
  });

  it.each(["C04-S01", "C04-A05", "C02-S01-F", "C99-A01", "", null])(
    "rejects forged activity identity %s",
    (id) => {
      const actor = session();
      const event = {
        type: "SELECT_ACTIVITY" as const,
        activityId: id as ActivityId,
      };
      expect(actor.getSnapshot().can(event)).toBe(false);
      actor.send(event);
      expect(selectSession(actor).currentActivity).toBeNull();
      expect(selectSession(actor).destination).toEqual({ kind: "library" });
    },
  );

  it.each(["C07", "C04-A01", "C03", null])(
    "rejects malformed or uncatalogued competency %s",
    (id) => {
      const actor = session();
      const event = {
        type: "SELECT_COMPETENCY" as const,
        competencyId: id as CompetencyId,
      };
      expect(actor.getSnapshot().can(event)).toBe(false);
      actor.send(event);
      expect(selectSession(actor).destination).toEqual({ kind: "library" });
    },
  );

  it("rejects a valid but not yet executable non-C04 activity without fallback", () => {
    const actor = session();
    expect(
      actor
        .getSnapshot()
        .can({ type: "SELECT_ACTIVITY", activityId: "C01-A01" }),
    ).toBe(false);
    actor.send({ type: "SELECT_ACTIVITY", activityId: "C01-A01" });
    expect(selectSession(actor).currentActivity).toBeNull();
  });

  it("keeps decision, destination and learner draft/check/feedback independent of technical errors", () => {
    const actor = session();
    const activity = open(actor);
    activity.send({ type: "CONTINUE" });
    const role = composeC04ActivityFrame(activity).responseControls!.find(
      (control) => control.role === "interpretation",
    )!;
    activity.send({
      type: "RESPONSE_CHANGED",
      response: composite({
        original: money("18000"),
        new: money("18000"),
        difference: money("0"),
        percentage: percent("0"),
        interpretation: {
          kind: "SINGLE_SELECTION",
          selectionId: role.options![0]!.id,
        },
      }),
    });
    activity.send({ type: "CHECK_RESPONSE" });
    const context = activity.getSnapshot().context;
    expect(context.checkedResponse).not.toBeNull();
    expect(context.evaluation).not.toBeNull();
    const frame = composeC04ActivityFrame(activity);
    const snapshot = activity.getSnapshot();
    const destination = selectSession(actor).destination;
    technicalTrace(actor);
    expect(selectSession(actor).destination).toBe(destination);
    expect(selectSession(actor).currentActivity).toBe(activity);
    expect(selectSession(actor).decision).toBe("none");
    expect(activity.getSnapshot()).toBe(snapshot);
    expect(activity.getSnapshot().context).toBe(context);
    expect(composeC04ActivityFrame(activity)).toEqual(frame);
  });

  it("preserves genuine A02 model selection, mathematical values and engagement during technical failure", () => {
    const actor = session();
    const activity = open(actor, "C04-A02");
    activity.send({ type: "CONTINUE" });
    activity.send({ type: "CONTINUE" });
    expect(activity.getSnapshot().context.position).toBe("EXP-02");
    const context = activity.getSnapshot().context;
    activity.send({
      type: "SELECT_MODEL_CHILD",
      modelId: context.model!.modelId,
      selectionId: "C04-S02-A",
      revision: context.model!.revision,
      position: "EXP-02",
    });
    const snapshot = activity.getSnapshot();
    expect(snapshot.context.model!.revision).toBe(1);
    expect(snapshot.context.c04A02StageEngagement!["EXP-02"]["C04-S02-A"]).toBe(
      true,
    );
    const frame = composeC04ActivityFrame(activity);
    technicalTrace(actor);
    expect(activity.getSnapshot()).toBe(snapshot);
    expect(composeC04ActivityFrame(activity)).toEqual(frame);
  });

  it("preserves A04 staged commitment and teaching position during technical interruption", () => {
    const actor = session();
    const activity = open(actor, "C04-A04");
    activity.send({ type: "CONTINUE" });
    activity.send({
      type: "RESPONSE_CHANGED",
      response: composite({
        difference: money("1500"),
        percentage: {
          kind: "SEMANTIC_BOUNDARY",
          resolution: { kind: "UNDEFINED", reason: "Original value is zero" },
        },
      }),
    });
    activity.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    const snapshot = activity.getSnapshot();
    expect(snapshot.context.firstPrimaryCommitment).not.toBeNull();
    expect(snapshot.context.responseStage).toBe("REASONING");
    technicalTrace(actor);
    expect(activity.getSnapshot()).toBe(snapshot);
  });

  it("rejects illegal technical event/state combinations and forged failure shape", () => {
    const actor = session();
    for (const event of [
      { type: "TECHNICAL_SUCCEEDED" as const },
      {
        type: "TECHNICAL_FAILED" as const,
        recoverable: true,
        error: "bad order",
      },
    ]) {
      expect(actor.getSnapshot().can(event)).toBe(false);
      actor.send(event);
    }
    actor.send({ type: "TECHNICAL_STARTED" });
    const forged = {
      type: "TECHNICAL_FAILED",
      recoverable: "yes",
      error: null,
    } as never;
    expect(actor.getSnapshot().can(forged)).toBe(false);
    actor.send(forged);
    expect(selectSession(actor).technical).toBe("loading");
    actor.send({
      type: "TECHNICAL_FAILED",
      recoverable: false,
      error: "fatal",
    });
    expect(actor.getSnapshot().can({ type: "TECHNICAL_STARTED" })).toBe(false);
  });

  it("rejects payload mutation attempts and accessor events using the public runtime guard", () => {
    const actor = session();
    const malformed = [
      {
        type: "SELECT_ACTIVITY",
        activityId: "C04-A01",
        actor: createC04ActivityActor("C04-A02"),
      },
      {
        type: "SELECT_COMPETENCY",
        competencyId: "C04",
        destination: { kind: "activity" },
      },
      {
        type: "TECHNICAL_STARTED",
        response: { kind: "FREE_TEXT", text: "mutate" },
      },
      { type: "TECHNICAL_FAILED", recoverable: true },
    ];
    for (const event of malformed) {
      expect(isSessionEvent(event)).toBe(false);
      expect(actor.getSnapshot().can(event as never)).toBe(false);
      actor.send(event as never);
    }
    const accessor = Object.defineProperty({}, "type", {
      get: () => {
        throw new Error("must not evaluate");
      },
    });
    expect(isSessionEvent(accessor)).toBe(false);
    expect(isSessionEvent(null)).toBe(false);
    expect(isSessionEvent({ type: "TECHNICAL_STARTED" })).toBe(true);
    expect(selectSession(actor).currentActivity).toBeNull();
    (malformed[0]!.actor as ReturnType<typeof createC04ActivityActor>).stop();
  });

  it("owns lifecycle cleanup on Session stop without disposing on browse or failure", () => {
    const actor = session();
    const activity = open(actor);
    const stop = vi.spyOn(activity, "stop");
    actor.send({ type: "SELECT_COMPETENCY", competencyId: "C04" });
    technicalTrace(actor);
    expect(stop).not.toHaveBeenCalled();
    actor.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(activity.getSnapshot().status).toBe("stopped");
    const snapshot = activity.getSnapshot();
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    activity.send({ type: "CONTINUE" });
    actor.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
    expect(warning).toHaveBeenCalledTimes(2);
    expect(activity.getSnapshot()).toBe(snapshot);
    expect(selectSession(actor).currentActivity).toBe(activity);
  });

  it("does not create shared state across separately initialized Sessions", () => {
    const first = session();
    const second = session();
    const a = open(first, "C04-A02");
    const b = open(second, "C04-A02");
    expect(a).not.toBe(b);
    expect(a.getSnapshot().context.model!.value.state).not.toBe(
      b.getSnapshot().context.model!.value.state,
    );
    a.send({ type: "CONTINUE" });
    first.send({ type: "TECHNICAL_STARTED" });
    expect(b.getSnapshot().context.position).toBe("ENTRY");
    expect(selectSession(second).technical).toBe("idle");
    first.stop();
    expect(b.getSnapshot().status).toBe("active");
  });

  it("represents unknown versus explicit known-empty history without persistence or insertion", () => {
    expect(selectSession(session()).completion).toEqual({ kind: "unknown" });
    const input: ActivityId[] = [];
    const actor = session({ kind: "known", activityIds: input });
    input.push("C04-A01");
    expect(selectSession(actor).completion).toEqual({
      kind: "known",
      activityIds: [],
    });
    expect(Object.isFrozen(selectSession(actor).completion)).toBe(true);
    expect(
      selectSession(session({ kind: "known", activityIds: ["C04-A01"] }))
        .completion,
    ).toEqual({ kind: "known", activityIds: ["C04-A01"] });
  });

  it("permits source-authorized completed replay and rejects bad completion composition", () => {
    const actor = session({ kind: "known", activityIds: ["C04-A01"] });
    expect(
      actor
        .getSnapshot()
        .can({ type: "SELECT_ACTIVITY", activityId: "C04-A01" }),
    ).toBe(true);
    for (const activityIds of [
      ["C04-A01", "C04-A01"],
      ["C03-A01"],
      ["C04-A99"],
    ])
      expect(() =>
        createAppSessionActor({
          catalog: catalog(),
          completion: {
            kind: "known",
            activityIds: activityIds as ActivityId[],
          },
        }),
      ).toThrow("completion knowledge");
  });

  it.each([
    "SYSTEM_BACK",
    "RETURN_TO_LIBRARY",
    "CONFIRM_SWITCH",
    "CANCEL_SWITCH",
    "FINISH_ACTIVITY",
    "RESUME_RECOVERY",
    "DISCARD_RECOVERY",
    "RETRY",
    "SET_DESTINATION",
    "ATTACH_ACTIVITY",
  ])(
    "leaves successor or unsupported event %s unavailable, not a stub success",
    (type) => {
      const actor = session();
      const event = { type } as never;
      expect(actor.getSnapshot().can(event)).toBe(false);
      const before = actor.getSnapshot();
      actor.send(event);
      expect(actor.getSnapshot()).toBe(before);
    },
  );
});

describe("T032 externally composed T031 outcomes (no startup read orchestration)", () => {
  it.each(["UNUSABLE_CHECKPOINT", "technical-failure"] as const)(
    "preserves %s distinctly without selecting Library",
    (status) => {
      const error = new Error("load unavailable");
      const actor = createAppSessionActor({
        catalog: catalog(),
        recovery:
          status === "technical-failure" ? { status, error } : { status },
      });
      sessions.push(actor);
      actor.start();
      expect(actor.getSnapshot().value).toEqual({
        startup:
          status === "technical-failure" ? "evaluate" : "recoveryFailure",
      });
      expect(selectSession(actor).destination).toBeNull();
      expect(selectSession(actor).currentActivity).toBeNull();
      expect(selectSession(actor).technical).toBe(
        status === "technical-failure" ? "recoverable" : "idle",
      );
      expect(selectSession(actor).completion).toEqual({ kind: "unknown" });
    },
  );

  async function recovered(position: "ENTRY" | "ACTIVE" = "ENTRY") {
    // Minimal valid canonical V1 ENTRY fixture; T031 independently validates and
    // constructs the actual actor. No forbidden checkpoint/projection imports.
    const raw = JSON.stringify({
      schemaVersion: 1,
      studyDefinitionRevision: "PAID-STUDY-DEF-R001",
      kind: "unfinished-activity",
      checkpoint: {
        competencyId: "C04",
        activityId: "C04-A01",
        scenarioId: "C04-S01",
        position,
        response: null,
        checkedResponse: null,
        responseRevision: 0,
        hasChecked: false,
        checkedRevision: null,
        feedbackRevision: null,
        evaluation: null,
      },
    });
    const read = vi.fn(() =>
      Promise.resolve({
        requestId: 1,
        operation: "load" as const,
        status: "loaded" as const,
        checkpoint: raw,
      }),
    );
    const outcome = await recoverCheckpoint({ load: read });
    expect(read).toHaveBeenCalledTimes(1);
    if (outcome.status !== "VALID_CHECKPOINT")
      throw new Error("Invalid T031 fixture");
    return outcome;
  }

  it("retains the exact authentic recovered actor unstarted for T036, without resuming", async () => {
    const outcome = await recovered("ACTIVE");
    const start = vi.spyOn(outcome.actor, "start");
    const stop = vi.spyOn(outcome.actor, "stop");
    const before = outcome.actor.getSnapshot();
    const actor = createAppSessionActor({
      catalog: catalog(),
      recovery: outcome,
    });
    sessions.push(actor);
    actor.start();
    expect(actor.getSnapshot().value).toEqual({ startup: "recoveryChoice" });
    expect(selectSession(actor).destination).toBeNull();
    expect(selectSession(actor).currentActivity).toBe(outcome.actor);
    expect(outcome.actor.getSnapshot()).toBe(before);
    expect(start).not.toHaveBeenCalled();
    expect(
      actor
        .getSnapshot()
        .can({ type: "SELECT_ACTIVITY", activityId: "C04-A01" }),
    ).toBe(false);
    actor.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("rejects incompatible recovered actor identity without starting or stopping caller actors", async () => {
    const outcome = await recovered();
    const wrong = createC04ActivityActor("C04-A02");
    const start = vi.spyOn(wrong, "start");
    const stop = vi.spyOn(wrong, "stop");
    expect(() =>
      createAppSessionActor({
        catalog: catalog(),
        recovery: { ...outcome, actor: wrong },
      }),
    ).toThrow("recovered actor identity");
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    wrong.stop();
    outcome.actor.stop();
  });

  it("D015/S1 returns only from competency, preserving exact actor and parallel state", () => {
    const actor = session();
    const event = { type: "RETURN_TO_LIBRARY" } as const;
    expect(isSessionEvent(event)).toBe(true);
    expect(actor.getSnapshot().can(event)).toBe(false);
    const a = open(actor, "C04-A02");
    a.send({ type: "CONTINUE" });
    const activityBefore = a.getSnapshot();
    expect(actor.getSnapshot().can(event)).toBe(false);
    const stop = vi.spyOn(a, "stop");
    actor.send({ type: "SELECT_COMPETENCY", competencyId: "C04" });
    actor.send({ type: "TECHNICAL_STARTED" });
    actor.send({
      type: "TECHNICAL_FAILED",
      recoverable: true,
      error: "controlled",
    });
    const before = selectSession(actor);
    expect(actor.getSnapshot().can(event)).toBe(true);
    actor.send(event);
    expect(selectSession(actor)).toEqual({
      ...before,
      startup: "library-ready",
      destination: { kind: "library" },
    });
    expect(selectSession(actor).currentActivity).toBe(a);
    expect(a.getSnapshot()).toBe(activityBefore);
    expect(stop).not.toHaveBeenCalled();
    expect(actor.getSnapshot().can(event)).toBe(false);
    expect(open(actor, "C04-A02")).toBe(a);
    expect(a.getSnapshot()).toBe(activityBefore);
  });

  it("D015/S1 preserves real checked feedback and mathematical values through Library and re-entry", () => {
    const actor = session();
    const a = open(actor);
    a.send({ type: "CONTINUE" });
    const role = composeC04ActivityFrame(a).responseControls!.find(
      (control) => control.role === "interpretation",
    )!;
    a.send({
      type: "RESPONSE_CHANGED",
      response: composite({
        original: money("18000"),
        new: money("18000"),
        difference: money("0"),
        percentage: percent("0"),
        interpretation: {
          kind: "SINGLE_SELECTION",
          selectionId: role.options![0]!.id,
        },
      }),
    });
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.checkedResponse).not.toBeNull();
    a.send({
      type: "FEEDBACK_DELIVERED",
      revision: a.getSnapshot().context.responseRevision,
    });
    const before = a.getSnapshot();
    const frame = composeC04ActivityFrame(a);
    actor.send({ type: "SELECT_COMPETENCY", competencyId: "C04" });
    actor.send({ type: "RETURN_TO_LIBRARY" });
    expect(open(actor)).toBe(a);
    expect(a.getSnapshot()).toBe(before);
    expect(composeC04ActivityFrame(a)).toEqual(frame);
  });

  it("D015/S1 rejects malformed returns and startup/recovery barriers", async () => {
    const actor = session();
    actor.send({ type: "SELECT_COMPETENCY", competencyId: "C04" });
    const get = vi.fn(() => "RETURN_TO_LIBRARY");
    for (const bad of [
      { type: "RETURN_TO_LIBRARY", extra: true },
      { type: "RETURN_TO_LIBRARY", [Symbol()]: true },
      Object.create({ type: "RETURN_TO_LIBRARY" }) as unknown,
      Object.defineProperty({}, "type", { get }),
    ]) {
      expect(isSessionEvent(bad)).toBe(false);
    }
    expect(get).not.toHaveBeenCalled();
    // XState itself reads event.type before guard dispatch. Keep its raw-input
    // rejection check separate from our validator's getter-free guarantee.
    expect(
      actor
        .getSnapshot()
        .can({ type: "RETURN_TO_LIBRARY", extra: true } as never),
    ).toBe(false);
    for (const recovery of [
      undefined,
      { status: "UNUSABLE_CHECKPOINT" as const, reason: "invalid" as const },
      await recovered(),
    ]) {
      const blocked = createAppSessionActor({
        catalog: catalog(),
        ...(recovery ? { recovery } : {}),
      });
      sessions.push(blocked);
      blocked.start();
      const before = blocked.getSnapshot();
      expect(before.can({ type: "RETURN_TO_LIBRARY" })).toBe(false);
      blocked.send({ type: "RETURN_TO_LIBRARY" });
      expect(blocked.getSnapshot()).toBe(before);
    }
  });

  it("rejects invalid composition rather than manufacturing a fallback Session", () => {
    expect(() => createAppSessionActor({ catalog: null as never })).toThrow(
      "catalog",
    );
    expect(() =>
      createAppSessionActor({
        catalog: catalog(),
        recovery: { status: "absent" } as never,
      }),
    ).toThrow("classification");
  });
});
