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
  claimRecoveryClassificationV2,
  recoverReferenceCheckpointV2,
} from "@/recovery/rehydration/public";
import {
  projectC04CheckpointV1,
  projectC02ReferenceCheckpointV2,
  projectC02RecoveryObligations,
} from "@/recovery/projection/public";
import { navigate, resolveActivityBack } from "@/session/navigation/public";
import {
  createC02ReferenceActivityActor,
  inspectC02ReferenceActivityActor,
} from "@/engine/activity-runtime/public";
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

describe("T037 B2 authentic public integration feasibility", () => {
  it("projects a live engaged C04 actor through durable Store and exact Session Resume, then resolves real Back", async () => {
    const store = createWebTestStore();
    const root = trackedRoot(store);
    root.start();
    await tick();
    expect(navigate(root.session, { type: "SYSTEM_BACK" })).toBe(
      "platform-root",
    );
    expect(
      navigate(root.session, {
        type: "SELECT_ACTIVITY",
        activityId: "C04-A02",
      }),
    ).toBe("destination-changed");
    const actor = selectSession(root.session).currentActivity!;
    actor.send({ type: "CONTINUE" });
    actor.send({ type: "CONTINUE" });
    expect(actor.getSnapshot().context.position).toBe("EXP-02");
    const before = composeC04ActivityFrame(actor);
    expect(before.exposedDerivedFacts).toEqual([]);
    expect(actor.getSnapshot().context.model?.revision).toBe(0);
    const control = before.modelSelectionControl!;
    actor.send({
      type: "SELECT_MODEL_CHILD",
      modelId: control.modelId,
      position: control.position,
      revision: control.revision,
      selectionId: "C04-S02-A",
    });
    const engaged = composeC04ActivityFrame(actor);
    expect(
      engaged.contentReferences.map((item) => item.text).join(" "),
    ).toContain("₱2,000 ÷ ₱20,000 × 100 = 10%");
    expect(engaged.feedbackState).toBeUndefined();
    expect(engaged.responseControls).toEqual([]);
    const projected = projectC04CheckpointV1(actor);
    expect(projected.model?.engagement["EXP-02"]["C04-S02-A"]).toBe(true);
    const envelope: Parameters<RecoveryCheckpointQueue["replace"]>[0] = {
      schemaVersion: 1,
      studyDefinitionRevision: "PAID-STUDY-DEF-R001",
      kind: "unfinished-activity",
      checkpoint: projected,
    };
    const producer = acquireSessionCheckpointProducer(root.session);
    expect(await producer.replace(envelope)).toMatchObject({
      status: "durable",
    });
    expect(JSON.parse((await store.load())!) as unknown).toMatchObject(
      envelope,
    );
    root.stop();
    expect(producer.replace(envelope)).toBeNull();
    expect(() => projectC04CheckpointV1(actor)).toThrow();

    const restored = trackedRoot(store);
    restored.start();
    await tick();
    expect(selectSession(restored.session).startup).toBe("recovery-choice");
    const held = selectSession(restored.session).currentActivity!;
    const start = vi.spyOn(held, "start");
    expect(start).not.toHaveBeenCalled();
    expect(navigate(restored.session, { type: "SYSTEM_BACK" })).toBe(
      "rejected",
    );
    restored.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
    restored.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
    expect(start).toHaveBeenCalledTimes(1);
    expect(selectSession(restored.session).currentActivity).toBe(held);
    expect(projectC04CheckpointV1(held)).toEqual(projected);
    held.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    expect(navigate(restored.session, { type: "SYSTEM_BACK" })).toBe(
      "support-closed",
    );
    expect(held.getSnapshot().context.position).toBe("EXP-02");
    expect(resolveActivityBack(held)).toBe("explanation-previous");
    expect(held.getSnapshot().context.position).toBe("EXP-01");
    expect(held.getSnapshot().context.c04A02StageEngagement).toEqual(
      projected.model!.engagement,
    );
    expect(
      navigate(restored.session, { type: "SYSTEM_BACK", extra: true }),
    ).toBe("rejected");
    restored.stop();
  });

  it("authenticates opt-in C02 V2 but cannot bypass the required current main-feedback delivery", async () => {
    const store = createWebTestStore();
    const queue = createRecoveryCheckpointQueue(store);
    const entry: Parameters<RecoveryCheckpointQueue["replaceV2"]>[0] = {
      schemaVersion: 2,
      studyDefinitionRevision: "PAID-STUDY-DEF-R001",
      kind: "unfinished-activity",
      checkpoint: {
        competencyId: "C02",
        activityId: "C02-A01",
        scenarioId: "C02-S01",
        embeddedScenarioId: "C02-S01-F",
        profileId: "D5-C02-A01-REFERENCE",
        position: "ENTRY",
        response: null,
        checkedResponse: null,
        responseRevision: 0,
        hasChecked: false,
        checkedRevision: null,
        feedbackRevision: null,
        evaluation: null,
        floor: { kind: "MAIN" },
      },
    };
    expect(await queue.replaceV2(entry)).toMatchObject({ status: "durable" });
    expect((await recoverCheckpoint(queue)).status).toBe("UNUSABLE_CHECKPOINT");
    const recovery = await recoverReferenceCheckpointV2(queue);
    expect(recovery.status).toBe("VALID_REFERENCE_CHECKPOINT_V2");
    if (recovery.status !== "VALID_REFERENCE_CHECKPOINT_V2")
      throw new Error("Expected authenticated reference actor");
    const actor = recovery.actor;
    try {
      expect(claimRecoveryClassificationV2(queue, { ...recovery })).toBe(false);
      expect(claimRecoveryClassificationV2(queue, recovery)).toBe(true);
      expect(claimRecoveryClassificationV2(queue, recovery)).toBe(false);
      actor.start();
      actor.send({ type: "CONTINUE" });
      actor.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "COMPOSITE",
          parts: [
            ["gross", "12100"],
            ["SSS", "600"],
            ["PhilHealth", "302.5"],
            ["Pag-IBIG", "200"],
            ["withholding", "0"],
            ["total deductions", "1102.5"],
            ["net pay", "10997.5"],
          ].map(([key, amount]) => ({
            key: key!,
            response: {
              kind: "EXACT_QUANTITY",
              value: quantity(
                ExactDecimal.from(amount!),
                "MONETARY_AMOUNT",
                "PHP",
                null,
              ),
            },
          })),
        },
      });
      actor.send({ type: "CHECK_RESPONSE" });
      expect(actor.getSnapshot().context.evaluation).toEqual({
        outcome: "CONFIRMED",
        diagnostic: null,
      });
      const checked = projectC02ReferenceCheckpointV2(actor);
      expect(projectC02RecoveryObligations(actor)).toMatchObject({
        requiresAnnaPresentation: true,
        historicalDeliveryAuthenticated: false,
      });
      // The permitted C04 composer is not a generic C02 presentation seam.
      expect(() => composeC04ActivityFrame(actor)).toThrow("Unbound C04 actor");
      actor.send({ type: "CONTINUE" });
      actor.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      actor.send({ type: "CONTINUE" });
      actor.send({
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: { identity: Symbol("unissued negative fixture") },
      });
      actor.send({ type: "CONTINUE" });
      expect(projectC02ReferenceCheckpointV2(actor)).toEqual(checked);
      expect(actor.getSnapshot().context.c02Floor?.phase).toBe("MAIN");
      expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
      expect(await store.load()).not.toBeNull();
    } finally {
      actor.stop();
    }
  });
});

type C04Actor = ReturnType<
  ReturnType<typeof createCanonicalC04Runtime>["createActivityActor"]
>;

function c04Composite(
  parts: Record<
    string,
    Exclude<LearnerResponse, { kind: "COMPOSITE" | "MODEL_STATE" }>
  >,
): LearnerResponse {
  return {
    kind: "COMPOSITE",
    parts: Object.entries(parts).map(([key, response]) => ({ key, response })),
  };
}

function checkedC04Response(actor: C04Actor): LearnerResponse {
  const id = actor.getSnapshot().context.activityId;
  const money = (value: string) => ({
    kind: "EXACT_QUANTITY" as const,
    value: quantity(
      ExactDecimal.from(value),
      "MONETARY_AMOUNT",
      "PHP",
      "per month",
    ),
  });
  const percent = (value: string) => ({
    kind: "EXACT_QUANTITY" as const,
    value: quantity(ExactDecimal.from(value), "PERCENTAGE_CHANGE", "%", null),
  });
  const option = (role: string) => ({
    kind: "SINGLE_SELECTION" as const,
    selectionId: composeC04ActivityFrame(actor).responseControls!.find(
      (control) => control.role === role,
    )!.options![0]!.id,
  });
  if (id === "C04-A01")
    return c04Composite({
      original: money("18000"),
      new: money("18000"),
      difference: money("0"),
      percentage: percent("0"),
      interpretation: option("interpretation"),
    });
  if (id === "C04-A02")
    return c04Composite({
      differenceA: money("2000"),
      differenceB: money("2000"),
      percentageA: percent("10"),
      percentageB: percent("20"),
      comparison: option("comparison"),
    });
  if (id === "C04-A03")
    return c04Composite({
      original: money("30000"),
      new: money("27000"),
      difference: money("-3000"),
      percentage: percent("-10"),
      interpretation: option("interpretation"),
    });
  const primary = {
    difference: money("1500"),
    percentage: {
      kind: "SEMANTIC_BOUNDARY" as const,
      resolution: {
        kind: "UNDEFINED" as const,
        reason: "Original value is zero",
      },
    },
  };
  actor.send({ type: "RESPONSE_CHANGED", response: c04Composite(primary) });
  actor.send({ type: "CHECK_RESPONSE" });
  expect(actor.getSnapshot().context.hasChecked).toBe(false);
  actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
  expect(actor.getSnapshot().context.responseStage).toBe("REASONING");
  expect(actor.getSnapshot().context.firstPrimaryCommitment).not.toBeNull();
  return c04Composite({ ...primary, explanation: option("explanation") });
}

describe("T037 complete public C04 roundtrips and owner boundaries", () => {
  it.each(["C04-A01", "C04-A02", "C04-A03", "C04-A04"] as const)(
    "roundtrips live checked %s response, model, commitments and feedback through one real root",
    async (id) => {
      const store = createWebTestStore();
      const root = trackedRoot(store);
      root.start();
      await tick();
      const actor = open(root.session, id);
      actor.send({ type: "CONTINUE" });
      if (id === "C04-A02") {
        // All five teach steps, with real engagement at the two gated steps.
        expect(actor.getSnapshot().context.position).toBe("EXP-01");
        for (const stage of [
          "EXP-01",
          "EXP-02",
          "EXP-03",
          "EXP-04",
          "EXP-05",
        ]) {
          expect(actor.getSnapshot().context.position).toBe(stage);
          if (stage === "EXP-02" || stage === "EXP-03") {
            const control =
              composeC04ActivityFrame(actor).modelSelectionControl!;
            const child = stage === "EXP-02" ? "C04-S02-A" : "C04-S02-B";
            expect(control.options.some((option) => option.id === child)).toBe(
              true,
            );
            actor.send({
              type: "SELECT_MODEL_CHILD",
              modelId: control.modelId,
              position: control.position,
              revision: control.revision,
              selectionId: child,
            });
          }
          actor.send({ type: "CONTINUE" });
        }
      }
      expect(actor.getSnapshot().context.position).toBe("ACTIVE");
      if (id === "C04-A03" || id === "C04-A04") {
        expect(composeC04ActivityFrame(actor).exposedDerivedFacts).toEqual([]);
      }
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).toBe("ACTIVE");
      actor.send({
        type: "RESPONSE_CHANGED",
        response: checkedC04Response(actor),
      });
      actor.send({ type: "CHECK_RESPONSE" });
      expect(actor.getSnapshot().context.evaluation).toEqual({
        outcome: "CONFIRMED",
        diagnostic: null,
      });
      const feedback = composeC04ActivityFrame(actor);
      expect(
        feedback.contentReferences.some((item) => item.text.length > 0),
      ).toBe(true);
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision,
      });
      const projected = projectC04CheckpointV1(actor);
      expect(projected.hasChecked).toBe(true);
      expect(projected.feedbackRevision).toBe(projected.responseRevision);
      const deliveredFrame = composeC04ActivityFrame(actor);
      const envelope: Parameters<RecoveryCheckpointQueue["replace"]>[0] = {
        schemaVersion: 1 as const,
        studyDefinitionRevision: "PAID-STUDY-DEF-R001",
        kind: "unfinished-activity" as const,
        checkpoint: projected,
      };
      expect(() => projectC04CheckpointV1({ ...actor } as C04Actor)).toThrow();
      const producer = acquireSessionCheckpointProducer(root.session);
      expect(await producer.replace(envelope)).toMatchObject({
        status: "durable",
      });
      const durable = await store.load();
      root.stop();
      expect(producer.replace(envelope)).toBeNull();
      expect(() => projectC04CheckpointV1(actor)).toThrow();
      const resumed = trackedRoot(store);
      resumed.start();
      await tick();
      const recovery = selectSession(resumed.session).recovery;
      if (recovery?.status !== "VALID_CHECKPOINT")
        throw new Error("Expected current V1 recovery");
      const held = recovery.actor;
      const start = vi.spyOn(held, "start");
      expect(projectC04CheckpointV1(held)).toEqual(projected);
      expect(selectSession(resumed.session).destination).toBeNull();
      expect(navigate(resumed.session, { type: "SYSTEM_BACK" })).toBe(
        "rejected",
      );
      expect(await store.load()).toBe(durable);
      expect(start).not.toHaveBeenCalled();
      resumed.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
      resumed.session.send({ type: "CONTINUE_RECOVERED_ACTIVITY" });
      expect(start).toHaveBeenCalledTimes(1);
      expect(selectSession(resumed.session).currentActivity).toBe(held);
      expect(projectC04CheckpointV1(held)).toEqual(projected);
      expect(composeC04ActivityFrame(held)).toEqual(deliveredFrame);
      resumed.stop();
    },
  );

  it("keeps all five teach stages passive until actual stage engagement and prioritizes Review Back", async () => {
    const root = trackedRoot();
    root.start();
    await tick();
    const actor = open(root.session, "C04-A02");
    actor.send({ type: "CONTINUE" });
    for (const stage of ["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05"]) {
      expect(actor.getSnapshot().context.position).toBe(stage);
      const before = projectC04CheckpointV1(actor);
      const frame = composeC04ActivityFrame(actor);
      expect(frame.responseControls).toEqual([]);
      expect(actor.getSnapshot().context.model!.revision).toBe(0);
      if (stage === "EXP-02" || stage === "EXP-03") {
        expect(JSON.stringify(frame)).not.toMatch(/10%|20%|dependent-teaching/);
      }
      actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(navigate(root.session, { type: "SYSTEM_BACK" })).toBe(
        "support-closed",
      );
      expect(projectC04CheckpointV1(actor)).toEqual(before);
      expect(composeC04ActivityFrame(actor)).toEqual(frame);
      actor.send({ type: "CONTINUE" });
    }
    expect(actor.getSnapshot().context.position).toBe("ACTIVE");
    expect(actor.getSnapshot().context.c04A02StageEngagement).toEqual({
      "EXP-02": { "C04-S02-A": false },
      "EXP-03": { "C04-S02-B": false },
    });
    root.stop();
  });

  it("cancels an activity switch through real Back without losing actor or producer ownership", async () => {
    const root = trackedRoot();
    root.start();
    await tick();
    expect(
      navigate(root.session, {
        type: "SELECT_COMPETENCY",
        competencyId: "C04",
      }),
    ).toBe("destination-changed");
    expect(navigate(root.session, { type: "SYSTEM_BACK" })).toBe(
      "destination-changed",
    );
    expect(navigate(root.session, { type: "SYSTEM_BACK" })).toBe(
      "platform-root",
    );
    expect(
      navigate(root.session, {
        type: "SELECT_ACTIVITY",
        activityId: "C04-A01",
      }),
    ).toBe("destination-changed");
    const actor = selectSession(root.session).currentActivity!;
    const before = projectC04CheckpointV1(actor);
    const producer = acquireSessionCheckpointProducer(root.session);
    expect(
      navigate(root.session, {
        type: "SELECT_ACTIVITY",
        activityId: "C04-A03",
      }),
    ).toBe("destination-changed");
    expect(selectSession(root.session).decision).toBe("activitySwitchChoice");
    expect(navigate(root.session, { type: "SYSTEM_BACK" })).toBe(
      "destination-changed",
    );
    expect(selectSession(root.session).decision).toBe("none");
    expect(selectSession(root.session).currentActivity).toBe(actor);
    expect(projectC04CheckpointV1(actor)).toEqual(before);
    expect(
      await producer.replace({
        schemaVersion: 1,
        studyDefinitionRevision: "PAID-STUDY-DEF-R001",
        kind: "unfinished-activity",
        checkpoint: before,
      }),
    ).toMatchObject({ status: "durable" });
    root.stop();
  });

  it("retries the same failed canonical payload before clearing and fencing further writes", async () => {
    const target = createWebTestStore();
    const writes: string[] = [];
    let fail = true;
    const root = trackedRoot({
      load: () => target.load(),
      clear: () => target.clear(),
      replace: async (raw) => {
        writes.push(raw);
        if (fail) throw new Error("write unavailable");
        await target.replace(raw);
      },
    });
    root.start();
    await tick();
    const actor = open(root.session);
    const producer = acquireSessionCheckpointProducer(root.session);
    const envelope: Parameters<RecoveryCheckpointQueue["replace"]>[0] = {
      schemaVersion: 1 as const,
      studyDefinitionRevision: "PAID-STUDY-DEF-R001",
      kind: "unfinished-activity" as const,
      checkpoint: projectC04CheckpointV1(actor),
    };
    expect(await producer.replace(envelope)).toMatchObject({
      status: "technical-failure",
    });
    expect(await producer.replace(envelope)).toMatchObject({
      status: "blocked",
      reason: "paused",
    });
    expect(await target.load()).toBeNull();
    fail = false;
    expect(await root.queue.retry()).toMatchObject({ status: "durable" });
    expect(writes).toHaveLength(2);
    expect(writes[1]).toBe(writes[0]);
    expect(await target.load()).toBe(writes[0]);
    root.session.send({ type: "SELECT_ACTIVITY", activityId: "C04-A03" });
    root.session.send({ type: "ABANDON_AND_OPEN_SELECTED_ACTIVITY" });
    expect(producer.replace(envelope)).toBeNull();
    await tick();
    expect(await target.load()).toBeNull();
    expect(
      selectSession(root.session).currentActivity!.getSnapshot().context
        .activityId,
    ).toBe("C04-A03");
    root.stop();
  });
});

type ReferenceActor = ReturnType<typeof createC02ReferenceActivityActor>;

function referenceResponse(): LearnerResponse {
  return {
    kind: "COMPOSITE",
    parts: [
      ["gross", "12100"],
      ["SSS", "600"],
      ["PhilHealth", "302.5"],
      ["Pag-IBIG", "200"],
      ["withholding", "0"],
      ["total deductions", "1102.5"],
      ["net pay", "10997.5"],
    ].map(([key, amount]) => ({
      key: key!,
      response: {
        kind: "EXACT_QUANTITY",
        value: quantity(
          ExactDecimal.from(amount!),
          "MONETARY_AMOUNT",
          "PHP",
          null,
        ),
      },
    })),
  };
}

/** Inspect actual canonical content and its nonvisual equivalent before handing
 * back current issued authority. This proves headless availability, not a render. */
function presentCurrentReference(actor: ReferenceActor) {
  const { context, definition, delivery } =
    inspectC02ReferenceActivityActor(actor);
  if (!delivery) throw new Error("Expected current authenticated delivery");
  expect(delivery.activityId).toBe("C02-A01");
  expect(delivery.position).toBe(context.position);
  expect(delivery.responseRevision).toBe(context.responseRevision);
  expect(delivery.passages.length).toBeGreaterThan(0);
  expect(delivery.passages.every((passage) => passage.text.length > 0)).toBe(
    true,
  );
  expect(delivery.nonvisual.text.length).toBeGreaterThan(0);
  const floor = definition.embeddedFloor!;
  if (delivery.purpose === "MAIN_FEEDBACK") {
    const expected =
      context.evaluation!.outcome === "CONFIRMED"
        ? floor.mainFeedback.confirmation
        : context.evaluation!.diagnostic === "c02/S01/reconsider-arithmetic"
          ? floor.mainFeedback.arithmetic
          : floor.mainFeedback.payrollRole;
    expect(delivery.scenarioId).toBe("C02-S01");
    expect(delivery.passages).toEqual([expected]);
    expect(delivery.nonvisual).toEqual(expected);
  } else {
    expect(delivery.scenarioId).toBe("C02-S01-F");
    expect(delivery.passages).toEqual([
      floor.scenario,
      floor.task,
      floor.help,
      floor.choices.find((choice) => choice.basis === context.c02Floor!.basis)!
        .feedback,
      floor.explanation,
    ]);
    expect(delivery.nonvisual).toEqual(floor.nonvisual);
  }
  actor.send({
    type:
      delivery.purpose === "MAIN_FEEDBACK"
        ? "C02_MAIN_FEEDBACK_DELIVERED"
        : "C02_FLOOR_TEACHING_DELIVERED",
    capability: delivery.capability,
  });
  return delivery;
}

function selectReferenceBasis(
  actor: ReferenceActor,
  basis: "8000.00" | "10000.00",
) {
  const { context } = inspectC02ReferenceActivityActor(actor);
  actor.send({
    type: "C02_SELECT_FLOOR_BASIS",
    activityId: "C02-A01",
    scenarioId: "C02-S01-F",
    position: "C02-S01-F",
    mainRevision: context.responseRevision,
    revision: context.c02Floor!.revision,
    basis,
  });
}

describe("T037-14 authenticated opt-in C02 V2 Floor replay", () => {
  it.each(["8000.00", "10000.00"] as const)(
    "replays current main feedback before restoring %s Floor work and requiring fresh teaching",
    async (basis) => {
      const source = createC02ReferenceActivityActor();
      let actor: ReferenceActor | undefined;
      try {
        source.start();
        source.send({ type: "CONTINUE" });
        source.send({
          type: "RESPONSE_CHANGED",
          response: referenceResponse(),
        });
        source.send({ type: "CHECK_RESPONSE" });
        expect(
          inspectC02ReferenceActivityActor(source).context.evaluation,
        ).toEqual({
          outcome: "CONFIRMED",
          diagnostic: null,
        });
        const historicalMain = presentCurrentReference(source);
        expect(source.getSnapshot().context.position).toBe("CONFIRMATION");
        source.send({ type: "CONTINUE" });
        selectReferenceBasis(source, basis);
        const historicalFloor = presentCurrentReference(source);
        const saved = projectC02ReferenceCheckpointV2(source);
        expect(saved.position).toBe("C02-S01-F");
        expect(saved.floor.kind).toBe("FLOOR_WORK");
        const store = createWebTestStore();
        const queue = createRecoveryCheckpointQueue(store);
        expect(
          await queue.replaceV2({
            schemaVersion: 2,
            studyDefinitionRevision: "PAID-STUDY-DEF-R001",
            kind: "unfinished-activity",
            checkpoint: saved,
          }),
        ).toMatchObject({ status: "durable" });
        const raw = await store.load();
        expect(raw).not.toBeNull();
        expect((await recoverCheckpoint(queue)).status).toBe(
          "UNUSABLE_CHECKPOINT",
        );
        const restored = await recoverReferenceCheckpointV2(queue);
        if (restored.status !== "VALID_REFERENCE_CHECKPOINT_V2")
          throw new Error("Expected authenticated V2 restoration");
        actor = restored.actor;
        expect(actor).not.toBe(source);
        expect(restored.checkpoint.checkpoint).toEqual(saved);
        expect(
          claimRecoveryClassificationV2(
            createRecoveryCheckpointQueue(createWebTestStore()),
            restored,
          ),
        ).toBe(false);
        expect(claimRecoveryClassificationV2(queue, { ...restored })).toBe(
          false,
        );
        expect(claimRecoveryClassificationV2(queue, restored)).toBe(true);
        expect(claimRecoveryClassificationV2(queue, restored)).toBe(false);
        // V2 issuance is not the V1 Session startup contract.
        const sessionRoot = trackedRoot();
        sessionRoot.session.start();
        expect(
          applySessionStartupClassification(sessionRoot.session, restored),
        ).toBe("ignored");
        expect(selectSession(sessionRoot.session).startup).toBe("pending");
        sessionRoot.stop();
        actor.start();
        const replay = projectC02ReferenceCheckpointV2(actor);
        expect(replay).toMatchObject({
          position: "CONFIRMATION",
          evaluation: saved.evaluation,
          response: saved.response,
          checkedResponse: saved.checkedResponse,
          responseRevision: saved.responseRevision,
          checkedRevision: saved.checkedRevision,
          feedbackRevision: null,
          floor: {
            kind: "ANNA_REPLAY_PENDING_FLOOR",
            basis,
            revision: 1,
            mainRevision: 1,
          },
        });
        expect(projectC02RecoveryObligations(actor)).toMatchObject({
          historicalDeliveryAuthenticated: false,
          requiresAnnaPresentation: true,
          requiresLearnerContinue: true,
          requiresFloorTeaching: true,
          preservedFloorWork: { basis, revision: 1, mainRevision: 1 },
        });
        // No legacy event, historical owner, wrong purpose, or structural copy
        // can turn previously saved delivery into current actor authority.
        const current = inspectC02ReferenceActivityActor(actor).delivery!;
        actor.send({ type: "CONTINUE" });
        actor.send({
          type: "FEEDBACK_DELIVERED",
          revision: replay.responseRevision,
        });
        actor.send({
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: historicalMain.capability,
        });
        actor.send({
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: historicalFloor.capability,
        });
        actor.send({
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: { ...current.capability },
        });
        actor.send({
          type: "C02_FLOOR_TEACHING_DELIVERED",
          capability: current.capability,
        });
        actor.send({ type: "CONTINUE" });
        expect(projectC02ReferenceCheckpointV2(actor)).toEqual(replay);
        const delivered = presentCurrentReference(actor);
        expect(delivered.purpose).toBe("MAIN_FEEDBACK");
        expect(actor.getSnapshot().context.feedbackRevision).toBe(
          replay.responseRevision,
        );
        expect(actor.getSnapshot().context.position).toBe("CONFIRMATION");
        const acknowledged = actor.getSnapshot().context;
        actor.send({
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: delivered.capability,
        });
        expect(actor.getSnapshot().context).toBe(acknowledged);
        expect(
          projectC02RecoveryObligations(actor).requiresLearnerContinue,
        ).toBe(true);
        actor.send({ type: "CONTINUE" });
        expect(actor.getSnapshot().context).toMatchObject({
          position: "C02-S01-F",
          c02Floor: {
            phase: "FLOOR",
            basis,
            revision: 1,
            mainRevision: 1,
            teachingRevision: null,
          },
        });
        expect(projectC02RecoveryObligations(actor)).toMatchObject({
          preservedFloorWork: null,
          requiresAnnaPresentation: false,
          requiresFloorTeaching: true,
          historicalDeliveryAuthenticated: false,
        });
        const floorBefore = projectC02ReferenceCheckpointV2(actor);
        actor.send({
          type: "C02_FLOOR_TEACHING_DELIVERED",
          capability: historicalFloor.capability,
        });
        actor.send({
          type: "C02_FLOOR_TEACHING_DELIVERED",
          capability: delivered.capability,
        });
        actor.send({ type: "FINISH_ACTIVITY" });
        expect(projectC02ReferenceCheckpointV2(actor)).toEqual(floorBefore);
        expect(await store.load()).toBe(raw);
        const teaching = presentCurrentReference(actor);
        expect(teaching.purpose).toBe("FLOOR_TEACHING");
        expect(projectC02RecoveryObligations(actor).requiresFloorTeaching).toBe(
          false,
        );
        actor.send({ type: "FINISH_ACTIVITY" });
        expect(actor.getSnapshot().context.position).toBe(
          basis === "10000.00" ? "COMPLETE" : "C02-S01-F",
        );
      } finally {
        actor?.stop();
        source.stop();
      }
    },
  );

  it("rejects stale same-number recheck authority and cross-owner current authority", async () => {
    const source = createC02ReferenceActivityActor();
    source.start();
    source.send({ type: "CONTINUE" });
    source.send({ type: "RESPONSE_CHANGED", response: referenceResponse() });
    source.send({ type: "CHECK_RESPONSE" });
    presentCurrentReference(source);
    source.send({ type: "CONTINUE" });
    selectReferenceBasis(source, "10000.00");
    const store = createWebTestStore();
    const queue = createRecoveryCheckpointQueue(store);
    await queue.replaceV2({
      schemaVersion: 2,
      studyDefinitionRevision: "PAID-STUDY-DEF-R001",
      kind: "unfinished-activity",
      checkpoint: projectC02ReferenceCheckpointV2(source),
    });
    source.stop();
    const first = await recoverReferenceCheckpointV2(queue);
    const second = await recoverReferenceCheckpointV2(queue);
    if (
      first.status !== "VALID_REFERENCE_CHECKPOINT_V2" ||
      second.status !== "VALID_REFERENCE_CHECKPOINT_V2"
    )
      throw new Error("Expected replay actors with pending Floor custody");
    const a = first.actor;
    const b = second.actor;
    try {
      for (const actor of [a, b]) {
        actor.start();
        expect(
          projectC02RecoveryObligations(actor).preservedFloorWork,
        ).not.toBeNull();
      }
      const stale = inspectC02ReferenceActivityActor(a).delivery!;
      const bBefore = projectC02ReferenceCheckpointV2(b);
      b.send({
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: stale.capability,
      });
      b.send({ type: "CONTINUE" });
      expect(projectC02ReferenceCheckpointV2(b)).toEqual(bBefore);
      a.send({ type: "REVISE" });
      expect(a.getSnapshot().context.position).toBe("REVISION");
      a.send({ type: "CHECK_AGAIN" });
      expect(a.getSnapshot().context.responseRevision).toBe(
        stale.responseRevision,
      );
      const before = projectC02ReferenceCheckpointV2(a);
      a.send({
        type: "C02_MAIN_FEEDBACK_DELIVERED",
        capability: stale.capability,
      });
      a.send({ type: "CONTINUE" });
      expect(projectC02ReferenceCheckpointV2(a)).toEqual(before);
      presentCurrentReference(a);
      a.send({ type: "CONTINUE" });
      expect(a.getSnapshot().context.position).toBe("C02-S01-F");
    } finally {
      a.stop();
      b.stop();
    }
  });
});

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
