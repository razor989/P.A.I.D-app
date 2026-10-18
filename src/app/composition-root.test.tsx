import { afterEach, describe, expect, it, vi } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { ActivityId, LearnerResponse } from "@/core/public";
import { createCanonicalC04Runtime } from "@/engine/c04-activity-binding/public";
import { createRecoveryCheckpointQueue } from "@/recovery/store/public";
import type {
  RecoveryCheckpointQueue,
  RecoveryCheckpointStore,
} from "@/recovery/store/public";
import { recoverCheckpoint } from "@/recovery/rehydration/public";
import {
  acquireSessionCheckpointProducer,
  createAppSessionActor,
  selectSession,
} from "@/session/app-machine/public";
import type { AppSessionActor } from "@/session/app-machine/public";
import {
  createApplicationCatalog,
  createApplicationRoot,
} from "./composition-root";
import { createWebTestStore } from "./web-test-store";

const sessions: AppSessionActor[] = [];
afterEach(() => {
  sessions.splice(0).forEach((s) => s.stop());
  vi.restoreAllMocks();
});
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
/** Gate actual target acknowledgment, never fabricate a queue result. */
function controlledStore() {
  const target = createWebTestStore();
  const clears: ReturnType<typeof deferred>[] = [];
  const store: RecoveryCheckpointStore = {
    load: () => target.load(),
    replace: (value) => target.replace(value),
    clear: async () => {
      const gate = deferred();
      clears.push(gate);
      await gate.promise;
      await target.clear();
    },
  };
  return { store, clears };
}
async function classified(store = createWebTestStore()) {
  const queue = createRecoveryCheckpointQueue(store);
  const recovery = await recoverCheckpoint(queue);
  const c04Runtime = createCanonicalC04Runtime();
  const catalog = createApplicationCatalog();
  const session = createAppSessionActor({
    catalog,
    c04Runtime,
    queue,
    recovery,
  });
  sessions.push(session);
  session.start();
  return { session, store, queue, recovery, c04Runtime, catalog };
}
function observeRegistry(
  runtime: ReturnType<typeof createCanonicalC04Runtime>,
) {
  const resolve = vi.spyOn(
    Object.getPrototypeOf(runtime.registry) as typeof runtime.registry,
    "resolve",
  );
  return (id: string) => {
    expect(resolve).toHaveBeenCalledWith(id);
    expect(
      resolve.mock.contexts.every((receiver) => receiver === runtime.registry),
    ).toBe(true);
    resolve.mockClear();
  };
}
function open(session: AppSessionActor, activityId: ActivityId = "C04-A01") {
  session.send({ type: "SELECT_ACTIVITY", activityId });
  const actor = selectSession(session).currentActivity;
  if (!actor) throw new Error("Expected real Activity Actor");
  return actor;
}
function checkpoint(): Parameters<RecoveryCheckpointQueue["replace"]>[0] {
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
function finish(session: AppSessionActor) {
  const actor = selectSession(session).currentActivity!;
  actor.send({ type: "CONTINUE" });
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
  actor.send({ type: "RESPONSE_CHANGED", response });
  actor.send({ type: "CHECK_RESPONSE" });
  expect(actor.getSnapshot().context.evaluation).not.toBeNull();
  actor.send({
    type: "FEEDBACK_DELIVERED",
    revision: actor.getSnapshot().context.responseRevision,
  });
  actor.send({ type: "FINISH_ACTIVITY" });
  expect(actor.getSnapshot().matches({ instructional: "complete" })).toBe(true);
  return actor;
}

describe("T035 genuine composition and classified Session integration", () => {
  it("orders an already accepted write before clear and rejects delayed stale submissions", async () => {
    const target = createWebTestStore();
    const writeGate = deferred();
    const clearGate = deferred();
    const operations: string[] = [];
    const store: RecoveryCheckpointStore = {
      load: () => target.load(),
      replace: async (value) => {
        operations.push("replace-start");
        await writeGate.promise;
        await target.replace(value);
        operations.push("replace-durable");
      },
      clear: async () => {
        operations.push("clear-start");
        await clearGate.promise;
        await target.clear();
        operations.push("clear-durable");
      },
    };
    const f = await classified(store);
    open(f.session);
    const stale = acquireSessionCheckpointProducer(f.session);
    const pendingWrite = stale.replace(checkpoint());
    await tick();
    finish(f.session);
    await tick();
    expect(operations).toEqual(["replace-start"]);
    expect(stale.replace(checkpoint())).toBeNull();
    writeGate.resolve();
    expect(await pendingWrite).toMatchObject({ status: "durable" });
    await tick();
    expect(operations).toEqual([
      "replace-start",
      "replace-durable",
      "clear-start",
    ]);
    expect(selectSession(f.session).lifecyclePhase).toBe(
      "finish-clear-in-flight",
    );
    clearGate.resolve();
    await tick();
    expect(selectSession(f.session).lifecyclePhase).toBe("finalized");
    expect(operations[operations.length - 1]).toBe("clear-durable");
    expect(stale.replace(checkpoint())).toBeNull();
    expect(await target.load()).toBeNull();
  });
  it("assembles six source competencies but no automatic recovery or executable journey", async () => {
    const root = createApplicationRoot();
    sessions.push(root.session);

    expect(root.catalog.competencies.size).toBe(6);
    expect(root.catalog.activities.size).toBe(25);
    expect(root.catalog.scenarios.size).toBe(25);
    expect(createRecoveryCheckpointQueue(root.store)).toBe(root.queue);
    expect(root.session.getSnapshot().context.catalog).toBe(root.catalog);
    expect(root.session.getSnapshot().context.queue).toBe(root.queue);
    expect(root.session.getSnapshot().context.createFreshActivity).toBe(
      root.c04Runtime.createActivityActor,
    );
    root.start();
    root.start();
    await tick();

    expect(selectSession(root.session).recovery).toBeNull();
    expect(selectSession(root.session).destination).toBeNull();
    expect(selectSession(root.session).currentActivity).toBeNull();
    root.stop();
    root.stop();
    expect(root.session.getSnapshot().status).toBe("stopped");
    expect(() => root.start()).toThrow("disposed");
  });
  it("isolates root identities and mutable memory targets", async () => {
    const a = createApplicationRoot();
    const b = createApplicationRoot();
    sessions.push(a.session, b.session);
    a.start();
    b.start();
    for (const key of ["session", "store", "queue", "c04Runtime"] as const)
      expect(a[key]).not.toBe(b[key]);
    expect(a.c04Runtime.registry).not.toBe(b.c04Runtime.registry);
    await a.store.replace("root A only");
    expect(await b.store.load()).toBeNull();
    a.stop();
    expect(b.session.getSnapshot().status).toBe("active");
    b.stop();
  });
  it("uses retained binding identities for selection, replay and Continue only after real clear", async () => {
    const controlled = controlledStore();
    const f = await classified(controlled.store);
    expect(f.recovery.status).toBe("NO_CHECKPOINT");
    const issued = observeRegistry(f.c04Runtime);
    const first = open(f.session);
    issued("C04-A01");

    const producer = acquireSessionCheckpointProducer(f.session);
    expect(await producer.replace(checkpoint())).toMatchObject({
      status: "durable",
    });
    finish(f.session);
    await tick();
    expect(selectSession(f.session).lifecyclePhase).toBe(
      "finish-clear-in-flight",
    );
    f.session.send({ type: "CONTINUE_COMPLETED_ACTIVITY" });
    expect(selectSession(f.session).currentActivity).toBe(first);
    expect(producer.replace(checkpoint())).toBeNull();
    expect(await f.store.load()).not.toBeNull();
    controlled.clears[0]!.resolve();
    await tick();
    expect(selectSession(f.session).lifecyclePhase).toBe("finalized");
    const replay = open(f.session);
    expect(replay).not.toBe(first);
    issued("C04-A01");
    expect(first.getSnapshot().status).toBe("stopped");

    finish(f.session);
    await tick();
    controlled.clears[1]!.resolve();
    await tick();
    f.session.send({ type: "CONTINUE_COMPLETED_ACTIVITY" });
    const next = selectSession(f.session).currentActivity!;
    expect(next.getSnapshot().context.activityId).toBe("C04-A02");
    issued("C04-A02");
    expect(producer.replace(checkpoint())).toBeNull();
    expect(await f.store.load()).toBeNull();
    f.session.stop();
    expect(next.getSnapshot().status).toBe("stopped");
  });
  it("durably switches only after target clear and fences stale resurrection", async () => {
    const controlled = controlledStore();
    const f = await classified(controlled.store);
    const issued = observeRegistry(f.c04Runtime);
    const first = open(f.session);
    const stale = acquireSessionCheckpointProducer(f.session);
    await stale.replace(checkpoint());
    const before = first.getSnapshot();
    f.session.send({ type: "SELECT_ACTIVITY", activityId: "C04-A03" });
    expect(selectSession(f.session).decision).toBe("activitySwitchChoice");
    expect(selectSession(f.session).currentActivity).toBe(first);
    expect(first.getSnapshot()).toBe(before);
    f.session.send({ type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY" });
    await tick();
    expect(selectSession(f.session).currentActivity).toBe(first);
    expect(stale.replace(checkpoint())).toBeNull();
    expect(await f.store.load()).not.toBeNull();
    controlled.clears[0]!.resolve();
    await tick();
    const replacement = selectSession(f.session).currentActivity!;
    expect(replacement).not.toBe(first);
    expect(first.getSnapshot().status).toBe("stopped");
    issued("C04-A03");
    expect(stale.replace(checkpoint())).toBeNull();
    expect(await f.store.load()).toBeNull();
    f.session.stop();
    expect(replacement.getSnapshot().status).toBe("stopped");
    expect(
      acquireSessionCheckpointProducer(f.session).replace(checkpoint()),
    ).toBeNull();
  });
  it("retains the classifier-issued restored actor even when a runtime is supplied", async () => {
    const store = createWebTestStore();
    const queue = createRecoveryCheckpointQueue(store);
    await queue.replace(checkpoint());
    const recovery = await recoverCheckpoint(queue);
    expect(recovery.status).toBe("VALID_CHECKPOINT");
    if (recovery.status !== "VALID_CHECKPOINT")
      throw new Error("Expected authentic restoration");
    const c04Runtime = createCanonicalC04Runtime();
    const session = createAppSessionActor({
      catalog: createApplicationCatalog(),
      c04Runtime,
      queue,
      recovery,
    });
    sessions.push(session);
    session.start();
    expect(selectSession(session).currentActivity).toBe(recovery.actor);
    expect(selectSession(session).destination).toBeNull();
    session.stop();
    // This transferred restoration remains unstarted in recoveryChoice; it is
    // not resumed by T035. XState reports unstarted snapshots as active.
    expect(recovery.actor.getSnapshot().context.position).toBe("ENTRY");
  });
  it("rejects non-C04 execution without manufacturing activities from available metadata", async () => {
    const f = await classified();
    f.session.send({ type: "SELECT_COMPETENCY", competencyId: "C01" });
    expect(selectSession(f.session).destination).toEqual({
      kind: "competency",
      competencyId: "C01",
    });
    f.session.send({ type: "SELECT_ACTIVITY", activityId: "C01-A01" });
    expect(selectSession(f.session).currentActivity).toBeNull();
  });
});
