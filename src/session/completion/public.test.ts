import { afterEach, describe, expect, it, vi } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { ActivityId, LearnerResponse } from "@/core/public";
import { composeStudyCatalog } from "@/study/catalog/public";
import { createRecoveryCheckpointQueue } from "@/recovery/store/public";
import type { RecoveryCheckpointQueue } from "@/recovery/store/public";
import {
  createAppSessionActor,
  isSessionEvent,
  selectSession,
} from "../app-machine/public";
import type {
  AppSessionActor,
  CompletionKnowledge,
} from "../app-machine/public";
import { navigate } from "../navigation/public";
import {
  acquireSessionCheckpointProducer,
  selectCompletionProgress,
} from "./public";

const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"] as const;
function catalog(order: readonly ActivityId[] = ids) {
  return composeStudyCatalog({
    complete: false,
    competencies: [
      { id: "C04", activityIds: order },
      { id: "C01", activityIds: ["C01-A01"] },
    ],
    activities: [...ids, "C01-A01"].map((id) => ({
      id,
      competencyId: id.slice(0, 3),
      scenarioIds: [id.replace("-A", "-S")],
      instructionalFamily: "T034 catalog membership fixture",
      contentReferences: [{ contentId: "fixture", variableIds: [] }],
      responseContract: { contractId: "fixture" },
    })),
    scenarios: [],
    contentIds: [],
    responseContractIds: [],
    modelProfileIds: [],
    interactionProfileIds: [],
    oracleIds: [],
  });
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function controlled() {
  const calls: {
    operation: "clear" | "replace";
    gate: ReturnType<typeof deferred>;
  }[] = [];
  let stored: string | null = "last trustworthy checkpoint";
  const store = {
    load: () => Promise.resolve(stored),
    clear: async () => {
      const gate = deferred();
      calls.push({ operation: "clear", gate });
      await gate.promise;
      stored = null;
    },
    replace: async (value: string) => {
      const gate = deferred();
      calls.push({ operation: "replace", gate });
      await gate.promise;
      stored = value;
    },
  };
  const queue = createRecoveryCheckpointQueue(store);
  return {
    queue,
    calls,
    get stored() {
      return stored;
    },
  };
}
const sessions: AppSessionActor[] = [];
afterEach(() => {
  sessions.splice(0).forEach((s) => s.stop());
  vi.restoreAllMocks();
});
function session(
  queue?: RecoveryCheckpointQueue,
  completion?: CompletionKnowledge,
  order?: readonly ActivityId[],
) {
  const s = createAppSessionActor({
    catalog: catalog(order),
    recovery: { status: "NO_CHECKPOINT" },
    ...(queue ? { queue } : {}),
    ...(completion ? { completion } : {}),
  });
  sessions.push(s);
  s.start();
  return s;
}
function open(s: AppSessionActor, id: ActivityId = "C04-A01") {
  s.send({ type: "SELECT_ACTIVITY", activityId: id });
  return selectSession(s).currentActivity!;
}
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function finish(s: AppSessionActor) {
  const a = selectSession(s).currentActivity!;
  expect(a.getSnapshot().context.activityId).toBe("C04-A01");
  a.send({ type: "CONTINUE" });
  const money = (value: string) => ({
    kind: "EXACT_QUANTITY" as const,
    value: quantity(
      ExactDecimal.from(value),
      "MONETARY_AMOUNT",
      "PHP",
      "per month",
    ),
  });
  const response: LearnerResponse = {
    kind: "COMPOSITE",
    parts: [
      { key: "original", response: money("18000") },
      { key: "new", response: money("18000") },
      { key: "difference", response: money("0") },
      {
        key: "percentage",
        response: {
          kind: "EXACT_QUANTITY",
          value: quantity(
            ExactDecimal.from("0"),
            "PERCENTAGE_CHANGE",
            "%",
            null,
          ),
        },
      },
      {
        key: "interpretation",
        response: { kind: "SINGLE_SELECTION", selectionId: "c04-a01-increase" },
      },
    ],
  };
  a.send({ type: "RESPONSE_CHANGED", response });
  a.send({ type: "CHECK_RESPONSE" });
  // Participation permits Reconsideration too; this is not a correctness gate.
  expect(a.getSnapshot().context.evaluation).not.toBeNull();
  a.send({
    type: "FEEDBACK_DELIVERED",
    revision: a.getSnapshot().context.responseRevision,
  });
  a.send({ type: "FINISH_ACTIVITY" });
  expect(a.getSnapshot().matches({ instructional: "complete" })).toBe(true);
  return a;
}
function checkpoint(): Parameters<RecoveryCheckpointQueue["replace"]>[0] {
  // Typed public queue DTO, no checkpoint-owner import or private snapshot.
  return {
    schemaVersion: 1,
    studyDefinitionRevision: "PAID-STUDY-DEF-R001",
    kind: "unfinished-activity",
    checkpoint: {
      competencyId: "C04",
      activityId: "C04-A01",
      scenarioId: "C04-S01",
      position: "ENTRY",
      response: null,
      responseRevision: 0,
      hasChecked: false,
      checkedResponse: null,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
    },
  };
}

describe("T034 genuine completion and real durable queue", () => {
  it("finishes the genuine final C04-A04 teaching sequence and refuses cross-competency Continue", async () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s, "C04-A04");
    a.send({ type: "CONTINUE" });
    const primary: LearnerResponse = {
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
          response: {
            kind: "SEMANTIC_BOUNDARY",
            resolution: { kind: "UNDEFINED", reason: "Original value is zero" },
          },
        },
      ],
    };
    a.send({ type: "RESPONSE_CHANGED", response: primary });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: {
        kind: "COMPOSITE",
        parts: [
          ...primary.parts,
          {
            key: "explanation",
            response: {
              kind: "SINGLE_SELECTION",
              selectionId: "c04-a04-use-new",
            },
          },
        ],
      },
    });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({
      type: "FEEDBACK_DELIVERED",
      revision: a.getSnapshot().context.responseRevision,
    });
    a.send({ type: "CONTINUE" });
    a.send({
      type: "TERMINAL_TEACHING_DELIVERED",
      revision: a.getSnapshot().context.responseRevision,
      contentId: "c04/S04/undefined-result",
    });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("COMPLETE");
    q.calls[0]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion).toEqual({
      kind: "partial",
      activityIds: ["C04-A04"],
    });
    expect(s.getSnapshot().can({ type: "CONTINUE_COMPLETED_ACTIVITY" })).toBe(
      false,
    );
    expect(selectSession(s).currentActivity).toBe(a);
  });
  it.each(["unknown", "known", "partial"] as const)(
    "finalizes %s knowledge only after durable clear",
    async (kind) => {
      const q = controlled();
      const s = session(
        q.queue,
        kind === "unknown" ? { kind } : { kind, activityIds: [] },
      );
      const a = open(s);
      const stop = vi.spyOn(a, "stop");
      const destination = selectSession(s).destination;
      finish(s);
      expect(q.calls.map((c) => c.operation)).toEqual(["clear"]);
      expect(selectSession(s).lifecyclePhase).toBe("finish-clear-in-flight");
      expect(selectSession(s).completion).toEqual(
        kind === "unknown" ? { kind } : { kind, activityIds: [] },
      );
      for (const type of [
        "CONTINUE_COMPLETED_ACTIVITY",
        "OBSERVE_ACTIVITY_COMPLETE",
        "RETURN_TO_UNFINISHED_ACTIVITY",
        "ABANDON_AND_OPEN_SELECTED_ACTIVITY",
      ] as const)
        s.send({ type });
      expect(navigate(s, { type: "SYSTEM_BACK" })).toBe("rejected");
      expect(q.calls).toHaveLength(1);
      expect(stop).not.toHaveBeenCalled();
      q.calls[0]!.gate.resolve();
      await tick();
      expect(selectSession(s).completion).toEqual({
        kind: kind === "known" ? "known" : "partial",
        activityIds: ["C04-A01"],
      });
      expect(selectSession(s).currentActivity).toBe(a);
      expect(selectSession(s).destination).toBe(destination);
      expect(selectSession(s).lifecyclePhase).toBe("finalized");
      expect(q.stored).toBeNull();
      const progress = selectCompletionProgress(s);
      expect(progress.overall.completed).toBe(kind === "known" ? 1 : null);
      expect(progress.overall.observedLowerBound).toBe(1);
      expect(progress.overall.historicalTotalKnown).toBe(kind === "known");
      s.send({ type: "OBSERVE_ACTIVITY_COMPLETE" });
      expect(q.calls).toHaveLength(1);
    },
  );
  it("fails closed without a queue and rejects forged completion before genuine COMPLETE", () => {
    const s = session();
    open(s);
    expect(s.getSnapshot().can({ type: "OBSERVE_ACTIVITY_COMPLETE" })).toBe(
      false,
    );
    finish(s);
    expect(selectSession(s).completion).toEqual({ kind: "unknown" });
    expect(
      s.getSnapshot().can({ type: "SELECT_ACTIVITY", activityId: "C04-A02" }),
    ).toBe(false);
  });
  it("retains COMPLETE on technical failure, rejects Back, and retries the actual failed clear", async () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s);
    finish(s);
    q.calls[0]!.gate.reject(new Error("uncertain storage"));
    await tick();
    expect(selectSession(s).lifecyclePhase).toBe("failed");
    expect(selectSession(s).technical).toBe("idle");
    expect(selectSession(s).technicalError).toBeNull();
    expect(selectSession(s).barrierResult).toMatchObject({
      operation: "clear",
      status: "technical-failure",
    });
    expect(selectSession(s).currentActivity).toBe(a);
    expect(selectSession(s).completion.kind).toBe("unknown");
    expect(q.stored).toBe("last trustworthy checkpoint");
    expect(navigate(s, { type: "SYSTEM_BACK" })).toBe("rejected");
    s.send({ type: "RETRY_PENDING_CLEAR" });
    expect(q.calls).toHaveLength(2);
    q.calls[1]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion).toEqual({
      kind: "partial",
      activityIds: ["C04-A01"],
    });
    expect(selectSession(s).barrierResult).toMatchObject({
      operation: "clear",
      status: "durable",
      requestId: 2,
    });
  });
  it("recovers an earlier real failed replace only through recoveryClear", async () => {
    const q = controlled();
    const write = q.queue.replace(checkpoint());
    q.calls[0]!.gate.reject(new Error("write failed"));
    expect((await write).status).toBe("technical-failure");
    const s = session(q.queue);
    open(s);
    finish(s);
    await tick();
    expect(selectSession(s).barrierResult).toMatchObject({
      status: "blocked",
      reason: "paused",
    });
    expect(s.getSnapshot().can({ type: "RETRY_PENDING_CLEAR" })).toBe(false);
    s.send({ type: "RECOVER_PENDING_CLEAR" });
    expect(q.calls[1]!.operation).toBe("clear");
    q.calls[1]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion.kind).toBe("partial");
  });
  it("fences scheduled stale producers before queue submission, after clear and shutdown", async () => {
    const q = controlled();
    const s = session(q.queue);
    open(s);
    const producer = acquireSessionCheckpointProducer(s);
    finish(s);
    expect(producer.replace(checkpoint())).toBeNull();
    q.calls[0]!.gate.resolve();
    await tick();
    expect(producer.replace(checkpoint())).toBeNull();
    s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A01" });
    expect(producer.replace(checkpoint())).toBeNull();
    s.stop();
    expect(producer.replace(checkpoint())).toBeNull();
    expect(q.calls.map((c) => c.operation)).toEqual(["clear"]);
  });
  it("canonical replay is fresh and repeated completion idempotent", async () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s);
    finish(s);
    q.calls[0]!.gate.resolve();
    await tick();
    const stop = vi.spyOn(a, "stop");
    const replay = open(s);
    expect(replay).not.toBe(a);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(replay.getSnapshot().context).toMatchObject({
      position: "ENTRY",
      response: null,
      evaluation: null,
      hasChecked: false,
      responseRevision: 0,
    });
    finish(s);
    q.calls[1]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion).toEqual({
      kind: "partial",
      activityIds: ["C04-A01"],
    });
    const replayStop = vi.spyOn(replay, "stop");
    s.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(replayStop).toHaveBeenCalledTimes(1);
  });
  it("retains prior positive identities, freezes progress and never coerces unknown to zero", async () => {
    const q = controlled();
    const s = session(q.queue, { kind: "partial", activityIds: ["C04-A03"] });
    open(s);
    finish(s);
    q.calls[0]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion).toEqual({
      kind: "partial",
      activityIds: ["C04-A03", "C04-A01"],
    });
    const progress = selectCompletionProgress(s);
    expect(progress.overall).toMatchObject({
      completed: null,
      complete: null,
      observedLowerBound: 2,
      historicalTotalKnown: false,
    });
    expect(Object.isFrozen(progress.competencies)).toBe(true);
    expect(Object.isFrozen(selectSession(s).completion)).toBe(true);
    expect(selectCompletionProgress(session()).overall.completed).toBeNull();
    expect(
      selectCompletionProgress(
        session(undefined, { kind: "known", activityIds: [] }),
      ).overall.completed,
    ).toBe(0);
  });
  it("canonical known A02 replay has fresh model and no historical engagement", () => {
    const s = session(undefined, { kind: "known", activityIds: ["C04-A02"] });
    const a = open(s, "C04-A02");
    expect(a.getSnapshot().context).toMatchObject({
      position: "ENTRY",
      response: null,
      checkedResponse: null,
      evaluation: null,
      model: { revision: 0 },
      c04A02StageEngagement: {
        "EXP-02": { "C04-S02-A": false },
        "EXP-03": { "C04-S02-B": false },
      },
    });
    expect(selectSession(s).completion).toEqual({
      kind: "known",
      activityIds: ["C04-A02"],
    });
  });
  it("serializes an accepted producer write before clear and refuses scheduled stale writes", async () => {
    const q = controlled();
    const s = session(q.queue);
    open(s);
    const producer = acquireSessionCheckpointProducer(s);
    const writing = producer.replace(checkpoint());
    expect(writing).not.toBeNull();
    finish(s);
    expect(q.calls.map((c) => c.operation)).toEqual(["replace"]);
    expect(producer.replace(checkpoint())).toBeNull();
    q.calls[0]!.gate.resolve();
    await writing;
    await tick();
    expect(q.calls.map((c) => c.operation)).toEqual(["replace", "clear"]);
    q.calls[1]!.gate.resolve();
    await tick();
    expect(q.stored).toBeNull();
    expect(producer.replace(checkpoint())).toBeNull();
  });
  it("shutdown stops current actor once and a late accepted clear cannot insert completion", async () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s);
    const stop = vi.spyOn(a, "stop");
    finish(s);
    s.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    q.calls[0]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion.kind).toBe("unknown");
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("failed clear cannot be canceled or recovered as a failed replacement; repeated retry remains technical", async () => {
    const q = controlled();
    const s = session(q.queue);
    open(s);
    finish(s);
    q.calls[0]!.gate.reject(new Error("one"));
    await tick();
    expect(s.getSnapshot().can({ type: "RECOVER_PENDING_CLEAR" })).toBe(false);
    s.send({ type: "RETRY_PENDING_CLEAR" });
    q.calls[1]!.gate.reject(new Error("two"));
    await tick();
    expect(selectSession(s).completion.kind).toBe("unknown");
    expect(selectSession(s).lifecyclePhase).toBe("failed");
    s.send({ type: "RETRY_PENDING_CLEAR" });
    q.calls[2]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion.kind).toBe("partial");
  });
  it("Continue uses catalog order rather than arithmetic and refuses a final entry", async () => {
    for (const order of [
      ["C04-A01", "C04-A03", "C04-A02", "C04-A04"],
      ["C04-A02", "C04-A03", "C04-A04", "C04-A01"],
    ] as const) {
      const q = controlled();
      const s = session(q.queue, undefined, order);
      const a = open(s);
      finish(s);
      q.calls[0]!.gate.resolve();
      await tick();
      s.send({ type: "CONTINUE_COMPLETED_ACTIVITY" });
      if (order[0] === "C04-A01")
        expect(
          selectSession(s).currentActivity!.getSnapshot().context.activityId,
        ).toBe("C04-A03");
      else expect(selectSession(s).currentActivity).toBe(a);
    }
  });
  it("isolates genuine Sessions, queues and late internal-result forgery", async () => {
    const one = controlled(),
      two = controlled();
    const s = session(one.queue),
      t = session(two.queue);
    open(s);
    open(t);
    finish(s);
    finish(t);
    s.send({
      type: "xstate.done.actor.t034.clear",
      output: {
        result: { operation: "clear", status: "durable", requestId: 1 },
      },
    } as never);
    for (const status of [
      "superseded",
      "blocked",
      "durable",
      "technical-failure",
    ]) {
      s.send({
        type: "xstate.done.actor.t034.clear",
        output: {
          transaction: t.getSnapshot().context.transaction,
          result: { operation: "clear", status, requestId: 99 },
        },
      } as never);
    }
    expect(selectSession(s).completion.kind).toBe("unknown");
    two.calls[0]!.gate.resolve();
    await tick();
    expect(selectSession(t).completion.kind).toBe("partial");
    expect(selectSession(s).completion.kind).toBe("unknown");
    one.calls[0]!.gate.resolve();
    await tick();
    expect(selectSession(s).completion.kind).toBe("partial");
    s.send({
      type: "xstate.done.actor.t034.clear",
      output: {
        result: { operation: "clear", status: "durable", requestId: 1 },
      },
    } as never);
    expect(selectSession(s).completion).toEqual({
      kind: "partial",
      activityIds: ["C04-A01"],
    });
  });
});

describe("T034 unfinished switch transaction", () => {
  it.each(["library", "competency", "activity"] as const)(
    "neutral Back restores %s origin and exact mathematics",
    (origin) => {
      const q = controlled();
      const s = session(q.queue);
      const a = open(s);
      a.send({ type: "CONTINUE" });
      const before = a.getSnapshot();
      if (origin !== "activity")
        s.send({ type: "SELECT_COMPETENCY", competencyId: "C04" });
      if (origin === "library") s.send({ type: "RETURN_TO_LIBRARY" });
      const destination = selectSession(s).destination;
      s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
      expect(selectSession(s)).toMatchObject({
        decision: "activitySwitchChoice",
        pendingTargetActivityId: "C04-A02",
      });
      expect(selectSession(s).destination).toBe(destination);
      expect(selectSession(s).switchOrigin).toBe(destination);
      expect(navigate(s, { type: "SYSTEM_BACK" })).toBe("destination-changed");
      expect(selectSession(s).destination).toBe(destination);
      expect(selectSession(s).currentActivity).toBe(a);
      expect(a.getSnapshot()).toBe(before);
      expect(q.calls).toHaveLength(0);
    },
  );
  it("Return-A preserves snapshot and abandon waits for durable clear before disposing exactly once", async () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s);
    const before = a.getSnapshot();
    const stop = vi.spyOn(a, "stop");
    s.send({ type: "SELECT_COMPETENCY", competencyId: "C04" });
    s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
    s.send({ type: "RETURN_TO_UNFINISHED_ACTIVITY" });
    expect(selectSession(s).currentActivity).toBe(a);
    expect(a.getSnapshot()).toBe(before);
    s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
    s.send({ type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY" });
    expect(navigate(s, { type: "SYSTEM_BACK" })).toBe("rejected");
    s.send({ type: "RETURN_TO_UNFINISHED_ACTIVITY" });
    expect(selectSession(s).currentActivity).toBe(a);
    expect(stop).not.toHaveBeenCalled();
    expect(q.calls).toHaveLength(1);
    q.calls[0]!.gate.resolve();
    await tick();
    const b = selectSession(s).currentActivity!;
    expect(b).not.toBe(a);
    expect(b.getSnapshot().context).toMatchObject({
      activityId: "C04-A02",
      position: "ENTRY",
      response: null,
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(selectSession(s).decision).toBe("none");
    expect(
      s.getSnapshot().matches({ session: { destination: "activity" } }),
    ).toBe(true);
  });
  it("failed abandonment preserves A; retry succeeds without completion insertion", async () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s);
    s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
    s.send({ type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY" });
    q.calls[0]!.gate.reject(new Error("clear failed"));
    await tick();
    expect(selectSession(s).currentActivity).toBe(a);
    expect(selectSession(s).pendingTargetActivityId).toBe("C04-A02");
    expect(navigate(s, { type: "SYSTEM_BACK" })).toBe("rejected");
    s.send({ type: "RETRY_PENDING_CLEAR" });
    q.calls[1]!.gate.resolve();
    await tick();
    expect(selectSession(s).currentActivity).not.toBe(a);
    expect(selectSession(s).completion.kind).toBe("unknown");
  });
  it("rejects malformed no-payload events, forged and unavailable B before any clear", () => {
    const q = controlled();
    const s = session(q.queue);
    const a = open(s);
    for (const id of ["C01-A01", "C99-A01", "C04-A05"])
      s.send({ type: "SELECT_ACTIVITY", activityId: id } as never);
    expect(selectSession(s).decision).toBe("none");
    expect(selectSession(s).currentActivity).toBe(a);
    expect(q.calls).toHaveLength(0);
    for (const type of [
      "OBSERVE_ACTIVITY_COMPLETE",
      "CONTINUE_COMPLETED_ACTIVITY",
      "RETURN_TO_UNFINISHED_ACTIVITY",
      "ABANDON_AND_OPEN_SELECTED_ACTIVITY",
      "CANCEL_PENDING_ACTIVITY_SWITCH",
      "RETRY_PENDING_CLEAR",
      "RECOVER_PENDING_CLEAR",
    ]) {
      expect(isSessionEvent({ type })).toBe(true);
      expect(isSessionEvent({ type, status: "durable" })).toBe(false);
      expect(isSessionEvent(Object.create({ type }))).toBe(false);
      const getter = vi.fn(() => type);
      expect(
        isSessionEvent(Object.defineProperty({}, "type", { get: getter })),
      ).toBe(false);
      expect(getter).not.toHaveBeenCalled();
    }
  });
});

describe("T034 focused independent audit corrections", () => {
  it.each(["replay", "continue", "abandon"] as const)(
    "settles successful %s replacement to actual and selected idle without clearing a pre-existing technical error",
    async (replacement) => {
      const q = controlled();
      const s = session(q.queue);
      const a = open(s);
      const error = new Error("pre-existing unrelated technical failure");
      s.send({ type: "TECHNICAL_STARTED" });
      s.send({ type: "TECHNICAL_FAILED", recoverable: false, error });
      if (replacement === "abandon") {
        s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
        s.send({ type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY" });
      } else finish(s);
      expect(selectSession(s).technical).toBe("unrecoverable");
      expect(selectSession(s).technicalError).toBe(error);
      q.calls[0]!.gate.resolve();
      await tick();
      expect(selectSession(s).technicalError).toBe(error);
      if (replacement !== "abandon") {
        expect(
          s.getSnapshot().matches({ session: { lifecycle: "finalized" } }),
        ).toBe(true);
        expect(selectSession(s).lifecyclePhase).toBe("finalized");
        if (replacement === "replay") open(s);
        else s.send({ type: "CONTINUE_COMPLETED_ACTIVITY" });
      }
      expect(selectSession(s).currentActivity).not.toBe(a);
      expect(s.getSnapshot().matches({ session: { lifecycle: "idle" } })).toBe(
        true,
      );
      expect(selectSession(s).lifecyclePhase).toBe("idle");
      expect(selectSession(s).technical).toBe("unrecoverable");
      expect(selectSession(s).technicalError).toBe(error);
      expect(selectSession(s).barrierError).toBeNull();
    },
  );
  it("keeps barrier failure observable when the independent technical operation succeeds", async () => {
    const q = controlled();
    const s = session(q.queue);
    open(s);
    finish(s);
    expect(selectSession(s).technical).toBe("idle");
    s.send({ type: "TECHNICAL_STARTED" });
    q.calls[0]!.gate.reject(new Error("storage unavailable"));
    await tick();
    expect(selectSession(s).technical).toBe("loading");
    const result = selectSession(s).barrierResult;
    const error = selectSession(s).barrierError;
    expect(result).toMatchObject({ status: "technical-failure" });
    expect(error).toBe(result);
    s.send({ type: "TECHNICAL_SUCCEEDED" });
    expect(selectSession(s).technical).toBe("idle");
    expect(selectSession(s).technicalError).toBeNull();
    expect(selectSession(s).lifecyclePhase).toBe("failed");
    expect(selectSession(s).barrierResult).toBe(result);
    expect(selectSession(s).barrierError).toBe(error);
  });
  it("exposes a rejected queue invocation through barrierError only", async () => {
    const q = controlled();
    const error = new Error("queue invocation rejected");
    // The real queue is frozen and reports adapter rejection as a typed result.
    // This trusted-port fault injection covers the invocation catch separately.
    const s = session({
      ...q.queue,
      clear: () => Promise.reject(error),
    });
    open(s);
    finish(s);
    await tick();
    expect(s.getSnapshot().matches({ session: { lifecycle: "failed" } })).toBe(
      true,
    );
    expect(selectSession(s)).toMatchObject({
      technical: "idle",
      technicalError: null,
      lifecyclePhase: "failed",
      barrierResult: null,
      barrierError: error,
      completion: { kind: "unknown" },
    });
  });
  const cases = [
    { purpose: "finish", replacement: "replay", recoverable: true },
    { purpose: "finish", replacement: "continue", recoverable: false },
    { purpose: "abandon", replacement: "selected", recoverable: true },
    { purpose: "abandon", replacement: "selected", recoverable: false },
  ] as const;
  it.each(cases)(
    "preserves independent technical errors through $purpose clear and $replacement replacement ($recoverable)",
    async ({ purpose, replacement, recoverable }) => {
      const q = controlled();
      const s = session(q.queue);
      const a = open(s);
      const stop = vi.spyOn(a, "stop");
      const error = new Error("unrelated technical operation");
      const storageError = new Error("clear adapter failed");
      const technical = recoverable ? "recoverable" : "unrecoverable";
      const assertTechnical = () => {
        expect(s.getSnapshot().matches({ session: { technical } })).toBe(true);
        expect(selectSession(s).technical).toBe(technical);
        expect(selectSession(s).technicalError).toBe(error);
      };
      s.send({ type: "TECHNICAL_STARTED" });
      if (purpose === "finish") finish(s);
      else {
        s.send({ type: "SELECT_ACTIVITY", activityId: "C04-A02" });
        s.send({ type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY" });
      }
      expect(selectSession(s).technical).toBe("loading");
      s.send({ type: "TECHNICAL_FAILED", recoverable, error });
      assertTechnical();
      expect(selectSession(s).lifecyclePhase).toBe(
        purpose === "finish"
          ? "finish-clear-in-flight"
          : "abandon-clear-in-flight",
      );
      expect(
        s.getSnapshot().matches({ session: { lifecycle: "clearing" } }),
      ).toBe(true);
      q.calls[0]!.gate.reject(storageError);
      await tick();
      assertTechnical();
      expect(
        s.getSnapshot().matches({ session: { lifecycle: "failed" } }),
      ).toBe(true);
      expect(selectSession(s).lifecyclePhase).toBe("failed");
      expect(selectSession(s).barrierError).toMatchObject({
        status: "technical-failure",
        operation: "clear",
        error: storageError,
      });
      expect(selectSession(s).currentActivity).toBe(a);
      expect(stop).not.toHaveBeenCalled();
      s.send({ type: "RETRY_PENDING_CLEAR" });
      assertTechnical();
      expect(selectSession(s).barrierError).toBeNull();
      q.calls[1]!.gate.resolve();
      await tick();
      assertTechnical();
      expect(selectSession(s).barrierError).toBeNull();
      if (purpose === "finish") {
        expect(
          s.getSnapshot().matches({ session: { lifecycle: "finalized" } }),
        ).toBe(true);
        expect(selectSession(s).lifecyclePhase).toBe("finalized");
        if (replacement === "replay") open(s);
        else s.send({ type: "CONTINUE_COMPLETED_ACTIVITY" });
      }
      assertTechnical();
      expect(s.getSnapshot().matches({ session: { lifecycle: "idle" } })).toBe(
        true,
      );
      expect(selectSession(s).lifecyclePhase).toBe("idle");
      expect(selectSession(s).currentActivity).not.toBe(a);
      expect(
        selectSession(s).currentActivity!.getSnapshot().context,
      ).toMatchObject({
        activityId: replacement === "replay" ? "C04-A01" : "C04-A02",
        position: "ENTRY",
        response: null,
      });
      expect(stop).toHaveBeenCalledTimes(1);
      expect(selectSession(s).completion).toEqual(
        purpose === "finish"
          ? { kind: "partial", activityIds: ["C04-A01"] }
          : { kind: "unknown" },
      );
    },
  );
});
