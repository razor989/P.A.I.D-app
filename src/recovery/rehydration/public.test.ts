import { describe, expect, it, vi } from "vitest";
import * as referenceRuntime from "@/engine/activity-runtime/public";
import { claimRecoveryClassification, recoverCheckpoint } from "./public";
import {
  claimRecoveryClassificationV2,
  recoverReferenceCheckpointV2,
} from "./public";
import {
  createC02ReferenceActivityActor,
  inspectC02ReferenceActivityActor,
  cancelC02ReferencePendingWork,
} from "@/engine/activity-runtime/public";
import {
  createRecoveryCheckpointV1,
  serializeRecoveryCheckpointV1,
  createRecoveryCheckpointV2,
  serializeRecoveryCheckpointV2,
} from "../checkpoint/public";
import { projectC04CheckpointV1 } from "../projection/public";
import {
  projectC02ReferenceCheckpointV2,
  projectC02RecoveryObligations,
} from "../projection/public";
import { createRecoveryCheckpointQueue } from "../store/public";
import {
  composeC04ActivityFrame,
  createC04ActivityActor,
  createC04ActivityBindings,
  createC04RestoredActivityActor,
  projectC04CheckpointModelV1,
} from "@/engine/c04-activity-binding/public";
import type { C04Restoration } from "@/engine/c04-activity-binding/public";
import { ExactDecimal, quantity } from "@/core/public";

type Actor = ReturnType<typeof createC04ActivityActor>;

type ReferenceActor = ReturnType<typeof createC02ReferenceActivityActor>;
function annaReferenceResponse(
  wrong: "none" | "payroll" | "arithmetic" = "none",
) {
  return {
    kind: "COMPOSITE" as const,
    parts: [
      ["gross", wrong === "payroll" ? "1102.5" : "12100"],
      ["SSS", "600"],
      ["PhilHealth", "302.5"],
      ["Pag-IBIG", "200"],
      ["withholding", "0"],
      ["total deductions", wrong === "arithmetic" ? "1" : "1102.5"],
      ["net pay", "10997.5"],
    ].map(([key, amount]) => ({
      key: key!,
      response: {
        kind: "EXACT_QUANTITY" as const,
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

/** Trusted headless availability handoff, not a browser delivery assertion.
 * Access through the existing Machine-owned descriptor with the actual current
 * canonical passages, nonvisual equivalent and consequences before acknowledgment.
 */
function presentReference(actor: ReferenceActor, available = true) {
  const { context, definition } = inspectC02ReferenceActivityActor(actor);
  // Descriptor is exposed by the unchanged Semantic Frame in Runtime tests;
  // this harness obtains it via the fixed profile's delivery-facing inspection.
  const descriptor = inspectC02ReferenceActivityActor(actor).delivery;
  if (!descriptor || !available) return null;
  expect(descriptor.passages.every((passage) => passage.text.length > 0)).toBe(
    true,
  );
  expect(descriptor.nonvisual.text.length).toBeGreaterThan(0);
  if (descriptor.purpose === "MAIN_FEEDBACK") {
    const expected =
      context.evaluation!.outcome === "CONFIRMED"
        ? definition.embeddedFloor!.mainFeedback.confirmation
        : context.evaluation!.diagnostic === "c02/S01/reconsider-arithmetic"
          ? definition.embeddedFloor!.mainFeedback.arithmetic
          : definition.embeddedFloor!.mainFeedback.payrollRole;
    expect(descriptor.passages).toContainEqual(expected);
  } else {
    expect(descriptor.passages).toContainEqual(
      definition.embeddedFloor!.explanation,
    );
    expect(descriptor.passages).toContainEqual(
      definition.embeddedFloor!.choices.find(
        (row) => row.basis === context.c02Floor!.basis,
      )!.feedback,
    );
    expect(descriptor.nonvisual).toEqual(definition.embeddedFloor!.nonvisual);
  }
  actor.send({
    type:
      descriptor.purpose === "MAIN_FEEDBACK"
        ? "C02_MAIN_FEEDBACK_DELIVERED"
        : "C02_FLOOR_TEACHING_DELIVERED",
    capability: descriptor.capability,
  });
  return descriptor.capability;
}

function selectReference(actor: ReferenceActor, basis: "8000.00" | "10000.00") {
  const c = actor.getSnapshot().context;
  actor.send({
    type: "C02_SELECT_FLOOR_BASIS",
    activityId: "C02-A01",
    scenarioId: "C02-S01-F",
    position: "C02-S01-F",
    mainRevision: c.responseRevision,
    revision: c.c02Floor!.revision,
    basis,
  });
}

function savedReference(actor: ReferenceActor) {
  return serializeRecoveryCheckpointV2(
    createRecoveryCheckpointV2(projectC02ReferenceCheckpointV2(actor)),
  );
}

function referenceQueue(raw: string | null) {
  let writes = 0;
  const queue = createRecoveryCheckpointQueue({
    load: () => Promise.resolve(raw),
    replace: () => {
      writes++;
      return Promise.resolve();
    },
    clear: () => {
      writes++;
      return Promise.resolve();
    },
  });
  return {
    queue,
    get writes() {
      return writes;
    },
  };
}

async function restoreReference(raw: string) {
  const disk = referenceQueue(raw);
  const result = await recoverReferenceCheckpointV2(disk.queue);
  expect(result.status).toBe("VALID_REFERENCE_CHECKPOINT_V2");
  if (result.status !== "VALID_REFERENCE_CHECKPOINT_V2")
    throw new Error("unusable reference fixture");
  expect(claimRecoveryClassificationV2(disk.queue, result)).toBe(true);
  expect(claimRecoveryClassificationV2(disk.queue, result)).toBe(false);
  expect(disk.writes).toBe(0);
  return result.actor;
}

describe("D5 eight interruption families with real source-authenticated restoration", () => {
  it("stops a failed candidate actor without overwriting or clearing the original checkpoint", async () => {
    const original = createC02ReferenceActivityActor();
    original.start();
    original.send({ type: "CONTINUE" });
    original.send({
      type: "RESPONSE_CHANGED",
      response: annaReferenceResponse(),
    });
    original.send({ type: "CHECK_RESPONSE" });
    const disk = referenceQueue(savedReference(original));
    const wrongActor = createC02ReferenceActivityActor();
    const stop = vi.spyOn(wrongActor, "stop");
    const constructor = vi
      .spyOn(referenceRuntime, "createC02ReferenceActivityActor")
      .mockReturnValueOnce(wrongActor);
    try {
      expect((await recoverReferenceCheckpointV2(disk.queue)).status).toBe(
        "UNUSABLE_CHECKPOINT_V2",
      );
      expect(stop).toHaveBeenCalledOnce();
      expect(disk.writes).toBe(0);
    } finally {
      constructor.mockRestore();
      stop.mockRestore();
      original.stop();
      wrongActor.stop();
    }
  });
  it("classifies absent and technical-failure V2 reads non-destructively", async () => {
    expect(
      (await recoverReferenceCheckpointV2(referenceQueue(null).queue)).status,
    ).toBe("NO_CHECKPOINT_V2");
    const error = new Error("storage unavailable");
    const queue = { load: () => Promise.reject(error) };
    const result = await recoverReferenceCheckpointV2(queue);
    expect(result).toEqual({ status: "technical-failure-v2", error });
    expect(claimRecoveryClassificationV2(queue, result)).toBe(true);
  });
  it("preserves repeated interrupted replay, revokes pending eligibility on same-number recheck and cancellation", async () => {
    const source = createC02ReferenceActivityActor();
    source.start();
    source.send({ type: "CONTINUE" });
    source.send({
      type: "RESPONSE_CHANGED",
      response: annaReferenceResponse(),
    });
    source.send({ type: "CHECK_RESPONSE" });
    presentReference(source);
    source.send({ type: "CONTINUE" });
    selectReference(source, "10000.00");
    const raw = savedReference(source);
    const a = await restoreReference(raw);
    const b = await restoreReference(savedReference(a));
    expect(projectC02RecoveryObligations(b).preservedFloorWork).toEqual({
      basis: "10000.00",
      revision: 1,
      mainRevision: 1,
    });
    a.start();
    b.start();
    const old = inspectC02ReferenceActivityActor(a).delivery!.capability;
    a.send({ type: "REVISE" });
    expect(projectC02RecoveryObligations(a).preservedFloorWork).toBeNull();
    a.send({ type: "CHECK_AGAIN" });
    expect(a.getSnapshot().context.responseRevision).toBe(1);
    expect(a.getSnapshot().context.checkedRevision).toBe(1);
    const checked = a.getSnapshot().context;
    a.send({ type: "C02_MAIN_FEEDBACK_DELIVERED", capability: old });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context).toBe(checked);
    presentReference(a);
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.c02Floor).toMatchObject({
      phase: "FLOOR",
      basis: null,
      revision: 0,
    });
    cancelC02ReferencePendingWork(b);
    presentReference(b);
    b.send({ type: "CONTINUE" });
    expect(b.getSnapshot().context.c02Floor).toMatchObject({
      basis: null,
      revision: 0,
    });
    source.stop();
    a.stop();
    b.stop();
  });
  it("rejects cross-actor, copied, stale, duplicate and legacy delivery without mutating receiving work", async () => {
    const source = createC02ReferenceActivityActor();
    source.start();
    source.send({ type: "CONTINUE" });
    source.send({
      type: "RESPONSE_CHANGED",
      response: annaReferenceResponse(),
    });
    source.send({ type: "CHECK_RESPONSE" });
    const raw = savedReference(source);
    const a = await restoreReference(raw);
    const b = await restoreReference(raw);
    a.start();
    b.start();
    const token = inspectC02ReferenceActivityActor(a).delivery!.capability;
    const before = b.getSnapshot().context;
    b.send({ type: "C02_MAIN_FEEDBACK_DELIVERED", capability: token });
    b.send({ type: "C02_MAIN_FEEDBACK_DELIVERED", capability: { ...token } });
    b.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    b.send({ type: "CONTINUE" });
    expect(b.getSnapshot().context).toBe(before);
    const consumed = presentReference(a)!;
    const delivered = a.getSnapshot().context;
    a.send({ type: "C02_MAIN_FEEDBACK_DELIVERED", capability: consumed });
    expect(a.getSnapshot().context).toBe(delivered);
    a.send({ type: "CONTINUE" });
    selectReference(a, "10000.00");
    const floor = inspectC02ReferenceActivityActor(a).delivery!.capability;
    selectReference(a, "8000.00");
    const diagnostic = a.getSnapshot().context;
    a.send({ type: "C02_FLOOR_TEACHING_DELIVERED", capability: floor });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context).toBe(diagnostic);
    source.stop();
    a.stop();
    b.stop();
  });
  it("keeps V2 claims queue-bound and one-use and never admits them as V1 Session classification", async () => {
    const actor = createC02ReferenceActivityActor();
    const disk = referenceQueue(savedReference(actor));
    const result = await recoverReferenceCheckpointV2(disk.queue);
    expect(claimRecoveryClassification(disk.queue, result)).toBe(false);
    expect(claimRecoveryClassificationV2(disk.queue, { ...result })).toBe(
      false,
    );
    expect(
      claimRecoveryClassificationV2({ load: () => disk.queue.load() }, result),
    ).toBe(false);
    expect(claimRecoveryClassificationV2(disk.queue, result)).toBe(true);
    expect(claimRecoveryClassificationV2(disk.queue, result)).toBe(false);
    const canceled = await recoverReferenceCheckpointV2(disk.queue);
    if (canceled.status !== "VALID_REFERENCE_CHECKPOINT_V2")
      throw new Error("fixture");
    canceled.actor.stop();
    expect(claimRecoveryClassificationV2(disk.queue, canceled)).toBe(false);
    const touched = await recoverReferenceCheckpointV2(disk.queue);
    if (touched.status !== "VALID_REFERENCE_CHECKPOINT_V2")
      throw new Error("fixture");
    touched.actor.start();
    expect(claimRecoveryClassificationV2(disk.queue, touched)).toBe(false);
    touched.actor.stop();
    if (result.status === "VALID_REFERENCE_CHECKPOINT_V2") result.actor.stop();
    expect((await recoverCheckpoint(disk.queue)).status).toBe(
      "UNUSABLE_CHECKPOINT",
    );
    expect(disk.writes).toBe(0);
    actor.stop();
  });
  it("rejects malformed, contradictory, unsupported and source-inconsistent work non-destructively", async () => {
    const actor = createC02ReferenceActivityActor();
    actor.start();
    actor.send({ type: "CONTINUE" });
    actor.send({ type: "RESPONSE_CHANGED", response: annaReferenceResponse() });
    actor.send({ type: "CHECK_RESPONSE" });
    presentReference(actor);
    actor.send({ type: "CONTINUE" });
    selectReference(actor, "10000.00");
    const envelope = createRecoveryCheckpointV2(
      projectC02ReferenceCheckpointV2(actor),
    );
    const bad = [
      { ...envelope, schemaVersion: 1 },
      { ...envelope, studyDefinitionRevision: "R002" },
      ...[
        { competencyId: "C01" },
        { scenarioId: "C02-S02" },
        { activityId: "C02-A02" },
        { profileId: "arbitrary-registry-binding" },
        { position: "COMPLETE" },
        { responseRevision: 2 },
        { checkedRevision: 0 },
        { feedbackRevision: 0 },
        {
          evaluation: {
            outcome: "RECONSIDERATION",
            diagnostic: "c02/S01/reconsider-arithmetic",
          },
        },
        {
          floor: {
            kind: "FLOOR_WORK",
            basis: "8001.00",
            revision: 1,
            mainRevision: 1,
            teachingRevision: null,
          },
        },
        {
          floor: {
            kind: "FLOOR_WORK",
            basis: "10000.00",
            revision: 0,
            mainRevision: 1,
            teachingRevision: null,
          },
        },
        {
          floor: {
            kind: "FLOOR_WORK",
            basis: "10000.00",
            revision: 1,
            mainRevision: 2,
            teachingRevision: null,
          },
        },
        {
          floor: {
            kind: "FLOOR_WORK",
            basis: "10000.00",
            revision: 1,
            mainRevision: 1,
            teachingRevision: 2,
          },
        },
        { capability: "forged" },
        { explanation: "caller prose" },
        { continued: true },
      ].map((change) => ({
        ...envelope,
        checkpoint: { ...envelope.checkpoint, ...change },
      })),
    ];
    for (const invalid of bad) {
      const disk = referenceQueue(JSON.stringify(invalid));
      expect((await recoverReferenceCheckpointV2(disk.queue)).status).toBe(
        "UNUSABLE_CHECKPOINT_V2",
      );
      expect(disk.writes).toBe(0);
    }
    actor.stop();
  });
  it.each(["none", "payroll", "arithmetic"] as const)(
    "all eight families and fresh replay: Anna=%s",
    async (wrong) => {
      const source = createC02ReferenceActivityActor();
      source.start();
      source.send({ type: "CONTINUE" });
      source.send({
        type: "RESPONSE_CHANGED",
        response: annaReferenceResponse(wrong),
      });
      const cases: {
        name: string;
        raw: string;
        basis: "8000.00" | "10000.00" | null;
        revision: number;
        checked: boolean;
        floor: boolean;
      }[] = [];
      const save = (name: string, checked: boolean, floor: boolean) => {
        const c = source.getSnapshot().context;
        cases.push({
          name,
          raw: savedReference(source),
          basis: c.c02Floor!.basis,
          revision: c.c02Floor!.revision,
          checked,
          floor,
        });
      };
      save("1 unchecked Anna", false, false);
      source.send({ type: "CHECK_RESPONSE" });
      save("2 checked pending Anna", true, false);
      presentReference(source);
      save("3 delivered Anna pre-Continue", true, false);
      source.send({ type: "CONTINUE" });
      save("4 Floor empty", true, true);
      selectReference(source, "8000.00");
      save("5 diagnostic pending", true, true);
      presentReference(source);
      save("6 diagnostic historically delivered", true, true);
      selectReference(source, "10000.00");
      save("7 correct pending", true, true);
      presentReference(source);
      save("8 correct historically Finish-eligible", true, true);
      expect(cases).toHaveLength(8);
      for (const item of cases) {
        const restored = await restoreReference(item.raw);
        let published = 0;
        restored.subscribe(() => published++);
        expect(published, item.name).toBe(0);
        const c = restored.getSnapshot().context;
        expect(c.responseRevision, item.name).toBe(1);
        expect(c.feedbackRevision, item.name).toBeNull();
        expect(c.c02Floor, item.name).toMatchObject({
          phase: "MAIN",
          basis: null,
          revision: 0,
        });
        if (item.checked) {
          expect(c.response, item.name).toBe(c.checkedResponse);
          expect(c.checkedRevision, item.name).toBe(1);
        }
        expect(
          projectC02RecoveryObligations(restored).preservedFloorWork,
        ).toEqual(
          item.floor
            ? { basis: item.basis, revision: item.revision, mainRevision: 1 }
            : null,
        );
        restored.start();
        if (!item.checked) restored.send({ type: "CHECK_RESPONSE" });
        const checked = restored.getSnapshot().context;
        restored.send({ type: "CONTINUE" });
        restored.send({ type: "FINISH_ACTIVITY" });
        expect(restored.getSnapshot().context).toBe(checked);
        expect(presentReference(restored, false)).toBeNull();
        expect(restored.getSnapshot().context.feedbackRevision).toBeNull();
        const main = presentReference(restored)!;
        expect(restored.getSnapshot().context.position).not.toBe("C02-S01-F");
        restored.send({ type: "CONTINUE" });
        expect(restored.getSnapshot().context.c02Floor).toMatchObject({
          phase: "FLOOR",
          basis: item.basis,
          revision: item.revision,
          teachingRevision: null,
        });
        expect(restored.getSnapshot().context.responseRevision).toBe(1);
        expect(restored.getSnapshot().context.checkedRevision).toBe(1);
        restored.send({
          type: "C02_MAIN_FEEDBACK_DELIVERED",
          capability: main,
        });
        restored.send({ type: "FINISH_ACTIVITY" });
        expect(restored.getSnapshot().context.position).toBe("C02-S01-F");
        if (item.basis === "8000.00") {
          presentReference(restored);
          restored.send({ type: "FINISH_ACTIVITY" });
          expect(restored.getSnapshot().context.position).toBe("C02-S01-F");
        }
        if (item.basis !== "10000.00") selectReference(restored, "10000.00");
        presentReference(restored);
        restored.send({ type: "FINISH_ACTIVITY" });
        expect(restored.getSnapshot().context.position).toBe("COMPLETE");
        expect(() => savedReference(restored)).toThrow();
        restored.stop();
      }
      source.stop();
    },
  );
});

describe("T036 queue-bound one-use classifier proof", () => {
  it.each([null, "{", "valid", "throw", "reject"])(
    "authenticates genuine %s only for its queue and once",
    async (mode) => {
      const original = createC04ActivityActor("C04-A01");
      const raw =
        mode === "valid"
          ? serializeRecoveryCheckpointV1(
              createRecoveryCheckpointV1(projectC04CheckpointV1(original)),
            )
          : mode;
      original.stop();
      const error = new Error("actual read failure");
      const queue = createRecoveryCheckpointQueue({
        load: () => {
          if (mode === "throw") throw error;
          return mode === "reject"
            ? Promise.reject(error)
            : Promise.resolve(raw);
        },
        replace: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      });
      const result = await recoverCheckpoint(queue);
      const other = { load: () => queue.load() };
      expect(claimRecoveryClassification(other, result)).toBe(false);
      for (const fake of [{ ...result }, new Proxy(result, {}), {}, null])
        expect(claimRecoveryClassification(queue, fake)).toBe(false);
      expect(claimRecoveryClassification(queue, result)).toBe(true);
      expect(claimRecoveryClassification(queue, result)).toBe(false);
      if (result.status === "VALID_CHECKPOINT") result.actor.stop();
      if (mode === "throw" || mode === "reject")
        expect(result).toMatchObject({ status: "technical-failure", error });
    },
  );
  it("refuses an issued result whose restored actor was started before handoff", async () => {
    const actor = createC04ActivityActor("C04-A01");
    const raw = serializeRecoveryCheckpointV1(
      createRecoveryCheckpointV1(projectC04CheckpointV1(actor)),
    );
    actor.stop();
    const queue = createRecoveryCheckpointQueue({
      load: () => Promise.resolve(raw),
      replace: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    });
    const result = await recoverCheckpoint(queue);
    if (result.status !== "VALID_CHECKPOINT")
      throw Error("Expected real restoration");
    result.actor.start();
    expect(claimRecoveryClassification(queue, result)).toBe(false);
    result.actor.stop();
  });
});
type Response = NonNullable<C04Restoration["context"]["response"]>;
const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"];
const money = (n: string) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(ExactDecimal.from(n), "MONETARY_AMOUNT", "PHP", "per month"),
});
const percent = (n: string) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(ExactDecimal.from(n), "PERCENTAGE_CHANGE", "%", null),
});
const boundary = {
  kind: "SEMANTIC_BOUNDARY" as const,
  resolution: { kind: "UNDEFINED" as const, reason: "Original value is zero" },
};
const composite = (
  fields: Record<
    string,
    Exclude<Response, { kind: "COMPOSITE" | "MODEL_STATE" }>
  >,
): Response => ({
  kind: "COMPOSITE",
  parts: Object.entries(fields).map(([key, response]) => ({ key, response })),
});
function active(id: string) {
  const actor = createC04ActivityActor(id).start();
  for (let i = 0; i < (id === "C04-A02" ? 6 : 1); i++)
    actor.send({ type: "CONTINUE" });
  return actor;
}
async function load(raw: string | null) {
  const calls: string[] = [];
  const queue = createRecoveryCheckpointQueue({
    load: () => {
      calls.push("load");
      return Promise.resolve(raw);
    },
    replace: () => {
      calls.push("replace");
      return Promise.resolve();
    },
    clear: () => {
      calls.push("clear");
      return Promise.resolve();
    },
  });
  const result = await recoverCheckpoint(queue);
  expect(calls).toEqual(["load"]);
  return result;
}
async function roundTrip(original: Actor) {
  const checkpoint = projectC04CheckpointV1(original);
  const envelope = createRecoveryCheckpointV1(checkpoint);
  let raw: string | null = null;
  const queue = createRecoveryCheckpointQueue({
    load: () => Promise.resolve(raw),
    replace: (data) => {
      raw = data;
      return Promise.resolve();
    },
    clear: () => {
      raw = null;
      return Promise.resolve();
    },
  });
  expect((await queue.replace(envelope)).status).toBe("durable");
  const result = await recoverCheckpoint(queue);
  expect(result.status).toBe("VALID_CHECKPOINT");
  if (result.status !== "VALID_CHECKPOINT")
    throw new Error("Restoration failed");
  const restored = result.actor;
  expect(restored).not.toBe(original);
  expect(restored.getSnapshot().value).toEqual({
    instructional: checkpoint.position.startsWith("EXP-")
      ? "exp"
      : (
          {
            ENTRY: "entry",
            ACTIVE: "active",
            REVISION: "revision",
            CONFIRMATION: "confirmation",
            RECONSIDERATION: "reconsideration",
            POST_CONFIRMATION_EXPLANATION: "postConfirmationExplanation",
          } as Record<string, string>
        )[checkpoint.position],
    support: "none",
  });
  expect(projectC04CheckpointV1(restored)).toEqual(checkpoint);
  expect(restored.getSnapshot().context.origin).toBeNull();
  expect(restored.getSnapshot().context.infoOrigin).toBeNull();
  expect(composeC04ActivityFrame(restored)).toEqual(
    composeC04ActivityFrame(original),
  );
  restored.start();
  expect(projectC04CheckpointV1(restored)).toEqual(checkpoint);
  return restored;
}
function submit(actor: Actor, wrong: boolean) {
  const id = actor.getSnapshot().context.activityId;
  const primary = {
    difference: money(wrong ? "0" : "1500"),
    percentage: wrong ? percent("100") : boundary,
  };
  if (id === "C04-A04") {
    actor.send({ type: "RESPONSE_CHANGED", response: composite(primary) });
    actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
  }
  const role =
    id === "C04-A02"
      ? "comparison"
      : id === "C04-A04"
        ? "explanation"
        : "interpretation";
  const selection = {
    kind: "SINGLE_SELECTION" as const,
    selectionId: composeC04ActivityFrame(actor).responseControls!.find(
      (c) => c.role === role,
    )!.options![wrong ? 1 : 0]!.id,
  };
  const response =
    id === "C04-A01"
      ? composite({
          original: money("18000"),
          new: money("18000"),
          difference: money("0"),
          percentage: percent("0"),
          interpretation: selection,
        })
      : id === "C04-A02"
        ? composite({
            originalA: money("20000"),
            originalB: money("10000"),
            differenceA: money("2000"),
            differenceB: money("2000"),
            percentageA: percent("10"),
            percentageB: percent("20"),
            comparison: selection,
          })
        : id === "C04-A03"
          ? composite({
              original: money("30000"),
              new: money("27000"),
              difference: money("-3000"),
              percentage: percent("-10"),
              interpretation: selection,
            })
          : composite({ ...primary, explanation: selection });
  actor.send({ type: "RESPONSE_CHANGED", response });
}
function select(actor: Actor, child: "C04-S02-A" | "C04-S02-B") {
  const c = actor.getSnapshot().context;
  actor.send({
    type: "SELECT_MODEL_CHILD",
    modelId: c.model!.modelId,
    selectionId: child,
    revision: c.model!.revision,
    position: c.position,
  });
}

describe("T031 authentic semantic recovery", () => {
  it("preserves A04 primary drafts, first commitment, reasoning exposure and a second genuine commitment", async () => {
    const actor = active("C04-A04");
    const primary = composite({
      difference: money("1500"),
      percentage: boundary,
    });
    actor.send({ type: "RESPONSE_CHANGED", response: primary });
    let restored = await roundTrip(actor);
    restored.stop();
    expect(composeC04ActivityFrame(actor).completionActionAvailability).toBe(
      false,
    );
    actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    restored = await roundTrip(actor);
    expect(restored.getSnapshot().context.responseStage).toBe("REASONING");
    expect(
      restored.getSnapshot().context.explanationCommitmentSequence,
    ).toBeNull();
    restored.send({ type: "CHECK_RESPONSE" });
    expect(restored.getSnapshot().context.evaluation).toBeNull();
    restored.stop();
    const first = actor.getSnapshot().context.firstPrimaryCommitment;
    actor.send({ type: "RETURN_TO_PRIMARY" });
    restored = await roundTrip(actor);
    restored.stop();
    actor.send({ type: "RESPONSE_CHANGED", response: primary });
    actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    restored = await roundTrip(actor);
    expect(restored.getSnapshot().context.firstPrimaryCommitment).toEqual(
      first,
    );
    expect(
      restored.getSnapshot().context.currentPrimaryCommitment?.sequence,
    ).toBe(2);
    expect(
      restored.getSnapshot().context.currentPrimaryCommitment
        ?.reasoningPreviouslyExposed,
    ).toBe(true);
    restored.stop();
    actor.stop();
  });
  it.each(["UNKNOWN", "UNDEFINED", "NOT_APPLICABLE"] as const)(
    "restores exact %s semantic boundary without deriving an answer",
    async (kind) => {
      const actor = active("C04-A01");
      const resolution =
        kind === "NOT_APPLICABLE"
          ? { kind }
          : { kind, reason: "Unresolved draft" };
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({
          difference: { kind: "SEMANTIC_BOUNDARY", resolution },
        }),
      });
      const restored = await roundTrip(actor);
      expect(
        composeC04ActivityFrame(restored).completionActionAvailability,
      ).toBe(false);
      expect(restored.getSnapshot().context.responseRevision).toBe(1);
      expect(restored.getSnapshot().context.hasChecked).toBe(false);
      restored.stop();
      actor.stop();
    },
  );
  it("classifies missing storage without mutations", async () => {
    expect(await load(null)).toEqual({ status: "NO_CHECKPOINT" });
  });
  it.each(["reject", "queue"])(
    "keeps %s read failure technical",
    async (mode) => {
      const error = new Error("storage offline");
      const result =
        mode === "reject"
          ? await recoverCheckpoint({
              load: () => Promise.reject(error),
            })
          : await recoverCheckpoint(
              createRecoveryCheckpointQueue({
                load: () => Promise.reject(error),
                replace: () => Promise.resolve(),
                clear: () => Promise.resolve(),
              }),
            );
      expect(result).toEqual({ status: "technical-failure", error });
    },
  );
  it.each(ids)(
    "restores unchanged ENTRY and exact partial drafts %s",
    async (id) => {
      const actor = createC04ActivityActor(id).start();
      let restored = await roundTrip(actor);
      restored.stop();
      for (let i = 0; i < (id === "C04-A02" ? 6 : 1); i++)
        actor.send({ type: "CONTINUE" });
      restored = await roundTrip(actor);
      restored.stop();
      const key = id === "C04-A02" ? "differenceA" : "difference";
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({
          [key]: money("9007199254740993.1234567890123456789"),
        }),
      });
      restored = await roundTrip(actor);
      expect(restored.getSnapshot().context.responseRevision).toBe(1);
      restored.send({ type: "CHECK_RESPONSE" });
      expect(restored.getSnapshot().context.evaluation).toBeNull();
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe("ACTIVE");
      restored.stop();
      actor.stop();
    },
  );
  it.each(ids.flatMap((id) => [false, true].map((wrong) => ({ id, wrong }))))(
    "round trips $id checked/revision/delivery wrong=$wrong",
    async ({ id, wrong }) => {
      const actor = active(id);
      submit(actor, wrong);
      let restored = await roundTrip(actor);
      restored.stop();
      actor.send({ type: "CHECK_RESPONSE" });
      expect(actor.getSnapshot().context.evaluation?.outcome).toBe(
        wrong ? "RECONSIDERATION" : "CONFIRMED",
      );
      restored = await roundTrip(actor);
      restored.stop();
      const revision = actor.getSnapshot().context.responseRevision;
      actor.send({ type: "FEEDBACK_DELIVERED", revision });
      restored = await roundTrip(actor);
      restored.stop();
      actor.send({ type: "REVISE" });
      restored = await roundTrip(actor);
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe("REVISION");
      restored.stop();
      actor.send({
        type: "RESPONSE_CHANGED",
        response: actor.getSnapshot().context.response!,
      });
      restored = await roundTrip(actor);
      restored.stop();
      if (id === "C04-A04") {
        actor.send({ type: "RETURN_TO_PRIMARY" });
        restored = await roundTrip(actor);
        restored.stop();
        actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
        restored = await roundTrip(actor);
        restored.stop();
        submit(actor, wrong);
      }
      actor.send({ type: "CHECK_AGAIN" });
      restored = await roundTrip(actor);
      restored.stop();
      actor.stop();
    },
  );
  it("restores all A02 explanation positions, Previous/reentry, and model selection without new engagement", async () => {
    const actor = createC04ActivityActor("C04-A02").start();
    for (let i = 1; i <= 5; i++) {
      actor.send({ type: "CONTINUE" });
      if (i === 2) select(actor, "C04-S02-A");
      if (i === 3) select(actor, "C04-S02-B");
      const restored = await roundTrip(actor);
      expect(restored.getSnapshot().context.position).toBe(`EXP-0${i}`);
      expect(
        projectC04CheckpointModelV1(
          restored.getSnapshot().context.model!.value.state,
        ),
      ).toEqual(
        projectC04CheckpointModelV1(
          actor.getSnapshot().context.model!.value.state,
        ),
      );
      expect(restored.getSnapshot().context.model!.value.state).not.toBe(
        actor.getSnapshot().context.model!.value.state,
      );
      if (i > 1) {
        actor.send({ type: "PREVIOUS" });
        restored.send({ type: "PREVIOUS" });
        expect(projectC04CheckpointV1(restored)).toEqual(
          projectC04CheckpointV1(actor),
        );
        actor.send({ type: "CONTINUE" });
        restored.send({ type: "CONTINUE" });
        expect(projectC04CheckpointV1(restored)).toEqual(
          projectC04CheckpointV1(actor),
        );
      }
      restored.stop();
    }
    actor.stop();
  });
  it("preserves two distinct A02 histories with equal selection/revision/position", async () => {
    const actors = [
      createC04ActivityActor("C04-A02").start(),
      createC04ActivityActor("C04-A02").start(),
    ];
    for (const [index, actor] of actors.entries()) {
      actor.send({ type: "CONTINUE" });
      actor.send({ type: "CONTINUE" });
      if (index === 0) select(actor, "C04-S02-A");
      actor.send({ type: "CONTINUE" });
      select(actor, "C04-S02-B");
      if (index === 1) select(actor, "C04-S02-B");
      actor.send({ type: "CONTINUE" });
    }
    const left = await roundTrip(actors[0]!);
    const right = await roundTrip(actors[1]!);
    expect(left.getSnapshot().context.model!.revision).toBe(
      right.getSnapshot().context.model!.revision,
    );
    expect(left.getSnapshot().context.c04A02StageEngagement).not.toEqual(
      right.getSnapshot().context.c04A02StageEngagement,
    );
    for (const actor of [...actors, left, right]) actor.stop();
  });
  it.each([false, true])(
    "preserves A04 mandatory teaching/Finish wrong=%s",
    async (wrong) => {
      const actor = active("C04-A04");
      submit(actor, wrong);
      actor.send({ type: "CHECK_RESPONSE" });
      const revision = actor.getSnapshot().context.responseRevision;
      actor.send({ type: "FEEDBACK_DELIVERED", revision });
      actor.send({ type: "CONTINUE" });
      let restored = await roundTrip(actor);
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe(
        "POST_CONFIRMATION_EXPLANATION",
      );
      restored.stop();
      const bindingFrame = composeC04ActivityFrame(actor);
      expect(bindingFrame).toBeDefined();
      actor.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision,
        contentId: createC04ActivityBindings().find(
          (b) => b.activityId === "C04-A04",
        )!.definition.terminalTeaching!.contentId,
      });
      restored = await roundTrip(actor);
      expect(restored.getSnapshot().context.terminalTeachingRevision).toBe(
        revision,
      );
      actor.send({ type: "FINISH_ACTIVITY" });
      restored.send({ type: "FINISH_ACTIVITY" });
      expect(restored.getSnapshot().context.position).toBe("COMPLETE");
      expect(restored.getSnapshot().value).toEqual(actor.getSnapshot().value);
      restored.stop();
      actor.stop();
    },
  );
  it.each(["REVIEW", "SOURCE_REVIEW", "REINFORCEMENT"] as const)(
    "normalizes %s support intent without changing underlying semantic evidence",
    async (mode) => {
      const actor = active("C04-A01");
      const before = projectC04CheckpointV1(actor);
      actor.send({ type: "OPEN_SUPPORT", mode });
      const result = await load(
        serializeRecoveryCheckpointV1(
          createRecoveryCheckpointV1(projectC04CheckpointV1(actor)),
        ),
      );
      expect(result.status).toBe("VALID_CHECKPOINT");
      if (result.status === "VALID_CHECKPOINT") {
        expect(result.actor.getSnapshot().value).toEqual({
          instructional: "active",
          support: "none",
        });
        expect(projectC04CheckpointV1(result.actor)).toEqual(before);
        result.actor.stop();
      }
      actor.stop();
    },
  );
  it("isolates two restores, retains immutable responses and genuine independent models", async () => {
    const actor = active("C04-A02");
    select(actor, "C04-S02-B");
    const left = await roundTrip(actor),
      right = await roundTrip(actor);
    expect(left.getSnapshot().context.model!.value.state).not.toBe(
      right.getSnapshot().context.model!.value.state,
    );
    select(left, "C04-S02-A");
    expect(
      projectC04CheckpointModelV1(
        right.getSnapshot().context.model!.value.state,
      ).selectedChildId,
    ).toBe("C04-S02-B");
    expect(projectC04CheckpointV1(right)).toEqual(
      projectC04CheckpointV1(actor),
    );
    for (const a of [actor, left, right]) a.stop();
  });
  it.each([
    "schema",
    "revision",
    "scenario",
    "activity",
    "complete",
    "quantity",
    "diagnostic",
    "checked",
    "extra",
    "staging",
    "engagement",
    "model",
  ])(
    "rejects %s corruption without actor or storage mutation",
    async (kind) => {
      const actor = active(
        kind === "staging"
          ? "C04-A04"
          : kind === "engagement" || kind === "model"
            ? "C04-A02"
            : "C04-A01",
      );
      submit(actor, false);
      actor.send({ type: "CHECK_RESPONSE" });
      const envelope = createRecoveryCheckpointV1(
        projectC04CheckpointV1(actor),
      );
      const bad = JSON.parse(serializeRecoveryCheckpointV1(envelope)) as {
        schemaVersion: number;
        studyDefinitionRevision: string;
        checkpoint: Record<string, unknown>;
      };
      const c = bad.checkpoint;
      if (kind === "schema") bad.schemaVersion = 2;
      if (kind === "revision") bad.studyDefinitionRevision = "obsolete";
      if (kind === "scenario") c.scenarioId = "C04-S04";
      if (kind === "activity") c.activityId = "C05-A01";
      if (kind === "complete") c.position = "COMPLETE";
      if (kind === "quantity")
        c.response = {
          kind: "COMPOSITE",
          parts: [
            {
              key: "difference",
              response: {
                kind: "EXACT_QUANTITY",
                value: {
                  magnitude: "01",
                  kind: "MONETARY_AMOUNT",
                  unit: "PHP",
                  basis: "per month",
                },
              },
            },
          ],
        };
      if (kind === "diagnostic")
        c.evaluation = { outcome: "CONFIRMED", diagnostic: "forged" };
      if (kind === "checked") c.checkedRevision = 999;
      if (kind === "extra") c.attempts = 0;
      if (kind === "staging") c.staging = { responseStage: "PRIMARY" };
      if (kind === "engagement")
        c.model = {
          evidence: {
            activityId: "C04-A02",
            scenarioId: "C04-S02",
            selectedChildId: "C04-S02-A",
          },
          revision: 0,
          engagement: {
            "EXP-02": { "C04-S02-A": true },
            "EXP-03": { "C04-S02-B": true },
          },
        };
      if (kind === "model")
        c.model = {
          evidence: {
            activityId: "C04-A02",
            scenarioId: "C04-S02",
            selectedChildId: "forged",
          },
          revision: 1,
          engagement: {
            "EXP-02": { "C04-S02-A": false },
            "EXP-03": { "C04-S02-B": false },
          },
        };
      expect(await load(JSON.stringify(bad))).toEqual({
        status: "UNUSABLE_CHECKPOINT",
      });
      expect(projectC04CheckpointV1(actor)).toEqual(envelope.checkpoint);
      actor.stop();
    },
  );
  it.each(["", "null", "{", "[]"])("rejects malformed raw %j", async (raw) => {
    expect(await load(raw)).toEqual({ status: "UNUSABLE_CHECKPOINT" });
  });
  it("rejects binding source spoofing, actor context forgery and model injection", () => {
    const actor = createC04ActivityActor("C04-A01");
    const context = actor.getSnapshot().context as C04Restoration["context"];
    expect(() =>
      createC04RestoredActivityActor({ scenarioId: "C04-S02", context }),
    ).toThrow();
    expect(() =>
      createC04RestoredActivityActor({
        scenarioId: "C04-S01",
        context: { ...context, position: "COMPLETE" },
      }),
    ).toThrow();
    expect(() =>
      createC04RestoredActivityActor({
        scenarioId: "C04-S01",
        context: Object.create(context) as typeof context,
      }),
    ).toThrow();
    actor.stop();
    const modelActor = createC04ActivityActor("C04-A02");
    expect(() =>
      createC04RestoredActivityActor({
        scenarioId: "C04-S02",
        context: modelActor.getSnapshot()
          .context as unknown as C04Restoration["context"],
        modelEvidence: projectC04CheckpointModelV1(
          modelActor.getSnapshot().context.model!.value.state,
        ),
      }),
    ).toThrow();
    modelActor.stop();
  });
});
