import { afterEach, describe, expect, it, vi } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { ActivityId, LearnerResponse } from "@/core/public";
import {
  createCanonicalC04Runtime,
  composeC04ActivityFrame,
  projectC04CheckpointModelV1,
} from "@/engine/c04-activity-binding/public";
import { createRecoveryCheckpointQueue } from "@/recovery/store/public";
import type {
  RecoveryCheckpointQueue,
  RecoveryCheckpointStore,
} from "@/recovery/store/public";
import { recoverCheckpoint } from "@/recovery/rehydration/public";
import {
  acquireSessionCheckpointProducer,
  applySessionStartupClassification,
  beginSessionStartupReadRetry,
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
  it("assembles six source competencies and classifies the actual memory target", async () => {
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

    expect(selectSession(root.session).recovery?.status).toBe("NO_CHECKPOINT");
    expect(selectSession(root.session).destination).toEqual({
      kind: "library",
    });
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

function ioGate<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function startupStore(raw: string | null = null) {
  let data = raw;
  const reads: ReturnType<typeof ioGate<string | null>>[] = [];
  const clears: ReturnType<typeof ioGate<void>>[] = [];
  const store: RecoveryCheckpointStore = {
    load: () => {
      const gate = ioGate<string | null>();
      reads.push(gate);
      return gate.promise;
    },
    replace: (value) => {
      data = value;
      return Promise.resolve();
    },
    clear: async () => {
      const gate = ioGate<void>();
      clears.push(gate);
      await gate.promise;
      data = null;
    },
  };
  return { store, reads, clears, raw: () => data };
}
function trackedRoot(store?: RecoveryCheckpointStore) {
  const root = createApplicationRoot(store);
  sessions.push(root.session);
  return root;
}

describe("T036 genuine production-root startup", () => {
  it("late clear acknowledgment after shutdown cannot enter Library or start the held actor", async () => {
    const target = startupStore();
    const root = trackedRoot(target.store);
    await root.queue.replace(checkpoint());
    root.start();
    target.reads[0]!.resolve(target.raw());
    await tick();
    const actor = selectSession(root.session).currentActivity!;
    const start = vi.spyOn(actor, "start");
    const stop = vi.spyOn(actor, "stop");
    root.session.send({ type: "ABANDON_RECOVERED_ACTIVITY" });
    await tick();
    root.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    target.clears[0]!.resolve();
    await tick();
    expect(root.session.getSnapshot().status).toBe("stopped");
    expect(selectSession(root.session).destination).toBeNull();
    expect(start).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("pending write drains before durable discard and new writes stay fenced until clear", async () => {
    const target = startupStore("{");
    const write = ioGate<void>();
    const replace = target.store.replace.bind(target.store);
    target.store.replace = async (data) => {
      await write.promise;
      await replace(data);
    };
    const root = trackedRoot(target.store);
    root.start();
    target.reads[0]!.resolve("{");
    await tick();
    const pending = root.queue.replace(checkpoint());
    root.session.send({ type: "DISCARD_UNUSABLE_CHECKPOINT" });
    await tick();
    expect(target.clears).toHaveLength(0);
    expect((await root.queue.replace(checkpoint())).status).toBe("blocked");
    write.resolve();
    expect((await pending).status).toBe("durable");
    await tick();
    expect(target.clears).toHaveLength(1);
    expect(selectSession(root.session).destination).toBeNull();
    target.clears[0]!.resolve();
    await tick();
    expect(target.raw()).toBeNull();
    expect(selectSession(root.session).startup).toBe("library-ready");
    root.stop();
  });
  it("rejects invented checked response history instead of salvaging an empty checkpoint", async () => {
    const root = trackedRoot();
    const envelope = checkpoint();
    Object.assign(envelope.checkpoint, {
      position: "CONFIRMATION",
      response: {
        kind: "COMPOSITE",
        parts: [
          {
            key: "difference",
            response: {
              kind: "EXACT_QUANTITY",
              value: {
                magnitude: "1500",
                dimension: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: "per month",
              },
            },
          },
          {
            key: "percentage",
            response: {
              kind: "EXACT_QUANTITY",
              value: {
                magnitude: "10",
                dimension: "PERCENTAGE_CHANGE",
                unit: "%",
                basis: null,
              },
            },
          },
          {
            key: "roles",
            response: {
              kind: "SELECTED_OPTION",
              optionId: "C04-A01-ROLES-ORIGINAL-NEW",
            },
          },
        ],
      },
      responseRevision: 1,
      hasChecked: true,
      checkedRevision: 1,
      feedbackRevision: 1,
    });
    // The real classifier must reject an invented checking history. This negative
    // cannot be used as a positive fixture or silently salvaged as empty.
    await root.store.replace(JSON.stringify(envelope));
    root.start();
    await tick();
    expect(selectSession(root.session).startup).toBe("recovery-failure");
    expect(selectSession(root.session).destination).toBeNull();
    root.stop();
  });
  it("resumes a genuine unfinished ACTIVE response draft without changing its exact semantics", async () => {
    const root = trackedRoot();
    const envelope = checkpoint();
    Object.assign(envelope.checkpoint, {
      position: "ACTIVE",
      responseRevision: 1,
      response: {
        kind: "COMPOSITE",
        parts: [
          {
            key: "difference",
            response: {
              kind: "EXACT_QUANTITY",
              value: {
                magnitude: "1500",
                kind: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: "per month",
              },
            },
          },
        ],
      },
    });
    await root.queue.replace(envelope);
    root.start();
    await tick();
    const actor = selectSession(root.session).currentActivity!;
    const before = actor.getSnapshot();
    expect(before.context.position).toBe("ACTIVE");
    root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
    expect(selectSession(root.session).currentActivity).toBe(actor);
    expect(actor.getSnapshot().context).toEqual(before.context);
    root.stop();
  });
  it("keeps the original Session unresolved until its delayed empty read succeeds, once", async () => {
    const target = startupStore();
    const root = trackedRoot(target.store);
    const session = root.session;
    root.start();
    root.start();
    expect(target.reads).toHaveLength(1);
    expect(selectSession(session).startup).toBe("pending");
    expect(selectSession(session).destination).toBeNull();
    session.send({ type: "SELECT_ACTIVITY", activityId: "C04-A01" });
    expect(selectSession(session).currentActivity).toBeNull();
    target.reads[0]!.resolve(null);
    await tick();
    expect(root.session).toBe(session);
    expect(selectSession(session).startup).toBe("library-ready");
    expect(target.clears).toHaveLength(0);
    expect(root.retryStartupRead()).toBe(false);
    root.stop();
  });

  it.each(["C04-A01", "C04-A02", "C04-A03", "C04-A04"] as const)(
    "retains exact authentic %s actor and semantics until one explicit Resume",
    async (id) => {
      const root = trackedRoot();
      const envelope = checkpoint();
      envelope.checkpoint.activityId = id;
      envelope.checkpoint.scenarioId = id.replace("-A", "-S");
      const original = root.c04Runtime.createActivityActor(id);
      const context = original.getSnapshot().context;
      if (id === "C04-A02")
        Object.assign(envelope.checkpoint, {
          model: {
            evidence: projectC04CheckpointModelV1(context.model!.value.state),
            revision: context.model!.revision,
            engagement: context.c04A02StageEngagement,
          },
        });
      if (id === "C04-A04")
        Object.assign(envelope.checkpoint, {
          staging: {
            responseStage: context.responseStage,
            firstPrimaryCommitment: context.firstPrimaryCommitment,
            currentPrimaryCommitment: context.currentPrimaryCommitment,
            commitmentSequence: context.commitmentSequence,
            reasoningExposed: context.reasoningExposed,
            explanationCommitmentSequence:
              context.explanationCommitmentSequence,
            checkedCommitmentSequence: context.checkedCommitmentSequence,
            terminalEntryRevision: context.terminalEntryRevision,
            terminalTeachingRevision: context.terminalTeachingRevision,
          },
        });
      original.stop();
      await root.queue.replace(envelope);
      root.start();
      await tick();
      const view = selectSession(root.session);
      expect(view.startup).toBe("recovery-choice");
      const actor = view.currentActivity!;
      const start = vi.spyOn(actor, "start");
      const before = actor.getSnapshot();
      const frame = composeC04ActivityFrame(actor);
      expect(
        acquireSessionCheckpointProducer(root.session).replace(envelope),
      ).toBeNull();
      expect(
        applySessionStartupClassification(root.session, view.recovery),
      ).toBe("ignored");
      expect(actor.getSnapshot()).toBe(before);
      root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
      root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
      expect(start).toHaveBeenCalledTimes(1);
      expect(selectSession(root.session).currentActivity).toBe(actor);
      expect(composeC04ActivityFrame(actor)).toEqual(frame);
      expect(actor.getSnapshot().context).toEqual(before.context);
      expect(selectSession(root.session).destination).toEqual({
        kind: "activity",
        activityId: id,
      });
      root.stop();
    },
  );

  it("explicit Abandon retains actor and blocks duplicates until real clear, then fences old producer", async () => {
    const target = startupStore();
    const root = trackedRoot(target.store);
    await root.queue.replace(checkpoint());
    root.start();
    target.reads[0]!.resolve(target.raw());
    await tick();
    const actor = selectSession(root.session).currentActivity!;
    const stop = vi.spyOn(actor, "stop");
    const start = vi.spyOn(actor, "start");
    const stale = acquireSessionCheckpointProducer(root.session);
    root.session.send({ type: "ABANDON_RECOVERED_ACTIVITY" });
    root.session.send({ type: "ABANDON_RECOVERED_ACTIVITY" });
    root.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
    await tick();
    expect(target.clears).toHaveLength(1);
    expect(selectSession(root.session).startup).toBe("clear-pending");
    expect(selectSession(root.session).currentActivity).toBe(actor);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(stale.replace(checkpoint())).toBeNull();
    target.clears[0]!.resolve();
    await tick();
    expect(selectSession(root.session).startup).toBe("library-ready");
    expect(target.raw()).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stale.replace(checkpoint())).toBeNull();
    open(root.session);
    expect(
      (
        await acquireSessionCheckpointProducer(root.session).replace(
          checkpoint(),
        )
      )?.status,
    ).toBe("durable");
    root.stop();
  });

  it.each([
    "{",
    JSON.stringify({ schemaVersion: 99 }),
    JSON.stringify({ ...checkpoint(), studyDefinitionRevision: "wrong" }),
  ])(
    "requires explicit Discard and genuine durable clear for unusable %s",
    async (raw) => {
      const target = startupStore(raw);
      const root = trackedRoot(target.store);
      root.start();
      target.reads[0]!.resolve(raw);
      await tick();
      expect(selectSession(root.session).startup).toBe("recovery-failure");
      expect(selectSession(root.session).currentActivity).toBeNull();
      expect(target.clears).toHaveLength(0);
      root.session.send({ type: "DISCARD_UNUSABLE_CHECKPOINT" });
      await tick();
      expect(selectSession(root.session).destination).toBeNull();
      target.clears[0]!.resolve();
      await tick();
      expect(selectSession(root.session).startup).toBe("library-ready");
      expect(target.raw()).toBeNull();
      root.stop();
    },
  );

  it("preserves genuine read error and retries only on explicit guarded same-root operation", async () => {
    const target = startupStore();
    const root = trackedRoot(target.store);
    expect(root.retryStartupRead()).toBe(false);
    root.start();
    const error = new Error("read offline");
    target.reads[0]!.reject(error);
    await tick();
    expect(selectSession(root.session)).toMatchObject({
      startup: "read-failure",
      technicalError: error,
      destination: null,
    });
    expect(target.reads).toHaveLength(1);
    expect(root.retryStartupRead()).toBe(true);
    expect(root.retryStartupRead()).toBe(false);
    expect(selectSession(root.session).startup).toBe("pending");
    target.reads[1]!.resolve(null);
    await tick();
    expect(selectSession(root.session).startup).toBe("library-ready");
    root.stop();
    expect(root.retryStartupRead()).toBe(false);
  });

  it("failed clear cannot be bypassed; retry performs that actual failed clear", async () => {
    const target = startupStore("{");
    const root = trackedRoot(target.store);
    root.start();
    target.reads[0]!.resolve("{");
    await tick();
    root.session.send({ type: "DISCARD_UNUSABLE_CHECKPOINT" });
    await tick();
    target.clears[0]!.reject(new Error("clear offline"));
    await tick();
    expect(selectSession(root.session)).toMatchObject({
      startup: "clear-failed",
      canRetryRecoveryClear: true,
      canConfirmRecoveryClear: false,
      destination: null,
    });
    root.session.send({ type: "CONFIRM_RECOVERY_CLEAR" });
    expect(target.clears).toHaveLength(1);
    root.session.send({ type: "RETRY_RECOVERY_CLEAR" });
    root.session.send({ type: "RETRY_RECOVERY_CLEAR" });
    await tick();
    expect(target.clears).toHaveLength(2);
    target.clears[1]!.resolve();
    await tick();
    expect(selectSession(root.session).startup).toBe("library-ready");
    root.stop();
  });

  it("orders in-flight replace before discard; paused replace requires explicit recovery-clear", async () => {
    const target = startupStore("{");
    const write = ioGate<void>();
    const replace = target.store.replace.bind(target.store);
    target.store.replace = async (data) => {
      await write.promise;
      await replace(data);
    };
    const root = trackedRoot(target.store);
    root.start();
    target.reads[0]!.resolve("{");
    await tick();
    const pending = root.queue.replace(checkpoint());
    root.session.send({ type: "DISCARD_UNUSABLE_CHECKPOINT" });
    await tick();
    expect(target.clears).toHaveLength(0);
    write.reject(new Error("replace failed"));
    expect((await pending).status).toBe("technical-failure");
    await tick();
    expect(selectSession(root.session)).toMatchObject({
      startup: "clear-failed",
      canRetryRecoveryClear: false,
      canConfirmRecoveryClear: true,
    });
    root.session.send({ type: "RETRY_RECOVERY_CLEAR" });
    expect(target.clears).toHaveLength(0);
    root.session.send({ type: "CONFIRM_RECOVERY_CLEAR" });
    await tick();
    expect(target.clears).toHaveLength(1);
    target.clears[0]!.resolve();
    await tick();
    expect(selectSession(root.session).startup).toBe("library-ready");
    root.stop();
  });

  it("rejects fake, wrong-target and prestart delivery without consuming a valid proof", async () => {
    const root = trackedRoot();
    const other = trackedRoot();
    const result = await recoverCheckpoint(root.queue);
    expect(applySessionStartupClassification(root.session, result)).toBe(
      "ignored",
    );
    expect(beginSessionStartupReadRetry(root.session)).toBe(false);
    other.session.start();
    expect(applySessionStartupClassification(other.session, result)).toBe(
      "ignored",
    );
    root.session.start();
    expect(applySessionStartupClassification(root.session, { ...result })).toBe(
      "ignored",
    );
    root.session.send({ type: "startup.classified", recovery: result });
    expect(selectSession(root.session).startup).toBe("pending");
    expect(applySessionStartupClassification(root.session, result)).toBe(
      "accepted",
    );
    expect(applySessionStartupClassification(root.session, result)).toBe(
      "ignored",
    );
    root.stop();
    other.stop();
  });

  it("disposes an untransferred late actor once without affecting an independent live root", async () => {
    const target = startupStore();
    const root = trackedRoot(target.store);
    await root.queue.replace(checkpoint());
    const restoredStop = vi.spyOn(
      Object.getPrototypeOf(root.session) as AppSessionActor,
      "stop",
    );
    root.start();
    root.stop();
    const other = trackedRoot();
    other.start();
    await tick();
    restoredStop.mockClear();
    target.reads[0]!.resolve(target.raw());
    await tick();
    expect(restoredStop).toHaveBeenCalledTimes(1);
    expect(root.session.getSnapshot().status).toBe("stopped");
    expect(selectSession(root.session).recovery).toBeNull();
    expect(selectSession(other.session).startup).toBe("library-ready");
    expect(other.queue).not.toBe(root.queue);
    other.stop();
  });
});
