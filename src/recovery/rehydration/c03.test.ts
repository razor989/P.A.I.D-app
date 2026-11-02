import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import {
  createC03ActivityActor,
  projectC03ActivityFrame,
  createC03ActivityBindings,
  createC03RestoredActivityActor,
  projectC03ModelCheckpoint,
} from "@/engine/c03-activity-binding/public";
import { instructionalContinueEligible } from "@/engine/activity-machine/public";
import {
  projectC03CheckpointV3,
  validateC03CheckpointV3,
  canonicalCheckpointJSON,
} from "../projection/public";
import {
  createRecoveryCheckpointV3,
  parseRecoveryCheckpointV3,
  serializeRecoveryCheckpointV3,
} from "../checkpoint/public";
import { createRecoveryCheckpointQueue } from "../store/public";
import {
  claimRecoveryClassificationV3,
  recoverC03CheckpointV3,
} from "./public";

type Actor = ReturnType<typeof createC03ActivityActor>;
const q = (n: string, multiplier = false) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(
    ExactDecimal.from(n),
    multiplier ? "MULTIPLIER" : "MONETARY_AMOUNT",
    multiplier ? "dimensionless" : "PHP",
    null,
  ),
});
const choice = (selectionId: string) => ({
  kind: "SINGLE_SELECTION" as const,
  selectionId,
});
const response = (
  parts: Record<string, ReturnType<typeof q> | ReturnType<typeof choice>>,
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: Object.entries(parts).map(([key, response]) => ({ key, response })),
});
const answers = [
  response({
    condition: choice("ordinary working day"),
    multiplier: q("1.25", true),
  }),
  response({
    invariants: choice("rate + hours"),
    changes: choice("condition + multiplier + overtimePay"),
    multiplierA: q("1.25", true),
    multiplierB: q("1.69", true),
    difference: q("88"),
  }),
  response({ multiplier: q("1.25", true), overtimePay: q("937.5") }),
  response({
    condition: choice("regular holiday"),
    multiplier: q("2.6", true),
    overtimePay: q("936"),
  }),
];
function select(
  a: Actor,
  child = "C03-S02-A",
  overrides: Partial<Parameters<Actor["send"]>[0]> = {},
) {
  const c = a.getSnapshot().context;
  a.send({
    type: "SELECT_MODEL_CHILD",
    modelId: c.model!.modelId,
    selectionId: child,
    revision: c.model!.revision,
    position: c.position,
    ...overrides,
  } as Parameters<Actor["send"]>[0]);
}
function fresh(index = 1) {
  const a = createC03ActivityActor(`C03-A0${index + 1}`);
  a.start();
  return a;
}
function advance(a: Actor, position: string) {
  for (let i = 0; a.getSnapshot().context.position !== position && i < 8; i++) {
    if (a.getSnapshot().context.position === "EXP-02") select(a);
    a.send({ type: "CONTINUE" });
  }
  expect(a.getSnapshot().context.position).toBe(position);
}
function memory(text: string | null = null) {
  let saved = text;
  const writes: string[] = [];
  const store = {
    load: () => Promise.resolve(saved),
    replace: (value: string) => {
      writes.push(value);
      saved = value;
      return Promise.resolve();
    },
    clear: () => {
      saved = null;
      return Promise.resolve();
    },
  };
  return { queue: createRecoveryCheckpointQueue(store), writes, store };
}
async function roundtrip(a: Actor) {
  const data = projectC03CheckpointV3(a);
  const envelope = createRecoveryCheckpointV3(data);
  const { queue, writes } = memory();
  expect((await queue.replaceV3(envelope)).status).toBe("durable");
  expect(writes).toEqual([serializeRecoveryCheckpointV3(envelope)]);
  const result = await recoverC03CheckpointV3(queue);
  expect(result.status).toBe("VALID_C03_CHECKPOINT_V3");
  if (result.status !== "VALID_C03_CHECKPOINT_V3")
    throw new Error(result.status);
  expect(projectC03CheckpointV3(result.actor)).toEqual(data);
  expect(claimRecoveryClassificationV3(queue, result)).toBe(true);
  expect(claimRecoveryClassificationV3(queue, result)).toBe(false);
  result.actor.start();
  return result.actor;
}

describe("C03 source-bound inspection", () => {
  it("does not count entry, default selection, invalid/wrong-stage/wrong-model/stale events or support", () => {
    const a = fresh();
    const policy = createC03ActivityBindings()[1]!.definition;
    select(a); // ENTRY has no selection permission.
    a.send({ type: "CONTINUE" });
    select(a); // Nor does EXP-01.
    a.send({ type: "CONTINUE" });
    const c = a.getSnapshot().context;
    expect(c.model!.revision).toBe(0);
    expect(instructionalContinueEligible(c, policy)).toBe(false);
    expect(
      instructionalContinueEligible(
        { ...c, c03Inspection: { ordinaryInspectedAtRevision: 1 } },
        policy,
      ),
    ).toBe(false);
    select(a, "C03-S02-B");
    select(a, "fake");
    select(a, "C03-S02-A", { modelId: "C04-A02:Overtime Work Record" });
    select(a, "C03-S02-A", { revision: 1 });
    select(a, "C03-S02-A", { position: "EXP-03" });
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    select(a);
    a.send({ type: "CONTINUE" });
    a.send({ type: "CLOSE_SUPPORT" });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-02");
    expect(
      a.getSnapshot().context.c03Inspection?.ordinaryInspectedAtRevision,
    ).toBeNull();
    const state = a.getSnapshot().context.model!.value.state;
    select(a);
    expect(a.getSnapshot().context.model!.value.state).toBe(state);
    expect(
      a.getSnapshot().context.c03Inspection?.ordinaryInspectedAtRevision,
    ).toBe(1);
    expect(a.getSnapshot().context.responseRevision).toBe(0);
    a.send({ type: "PREVIOUS" });
    a.send({ type: "CONTINUE" });
    expect(instructionalContinueEligible(a.getSnapshot().context, policy)).toBe(
      true,
    );
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-03");
    // No second rest-day inspection prerequisite is authorized.
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-04");
    a.send({ type: "PREVIOUS" });
    select(a, "C03-S02-B");
    select(a);
    select(a, "C03-S02-B");
    expect(a.getSnapshot().context.model!.value.selectionId).toBe("C03-S02-B");
    advance(a, "ACTIVE");
    expect(a.getSnapshot().context.response).toBeNull();
    a.stop();
    const other = fresh(2);
    other.send({ type: "CONTINUE" });
    other.send({
      type: "SELECT_MODEL_CHILD",
      modelId: "C03-A02:Overtime Work Record",
      selectionId: "C03-S02-A",
      revision: 0,
      position: "ACTIVE",
    });
    expect(other.getSnapshot().context.c03Inspection).toBeUndefined();
    other.stop();
  });
});

describe("C03 real checkpoint and queue reconstruction", () => {
  it.each([0, 2, 3])(
    "restores static activity index %i entry, draft, checking, delivery and revision",
    async (index) => {
      const a = fresh(index);
      let restored = await roundtrip(a);
      expect(
        projectC03ActivityFrame(restored).mathematicalExplanation,
      ).toBeNull();
      restored.stop();
      advance(a, "ACTIVE");
      a.send({ type: "RESPONSE_CHANGED", response: answers[index]! });
      restored = await roundtrip(a);
      expect(restored.getSnapshot().context.responseRevision).toBe(1);
      restored.stop();
      a.send({ type: "CHECK_RESPONSE" });
      restored = await roundtrip(a);
      expect(restored.getSnapshot().context.feedbackRevision).toBeNull();
      restored.stop();
      a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
      restored = await roundtrip(a);
      expect(restored.getSnapshot().context.feedbackRevision).toBe(1);
      restored.stop();
      a.send({ type: "REVISE" });
      restored = await roundtrip(a);
      expect(restored.getSnapshot().context.position).toBe("REVISION");
      restored.stop();
      a.stop();
    },
  );
  it.each(["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05", "ACTIVE"])(
    "restores A02 %s and real inspection eligibility",
    async (position) => {
      const a = fresh();
      advance(a, position);
      if (["EXP-03", "EXP-04", "EXP-05"].includes(position))
        select(a, "C03-S02-B");
      const restored = await roundtrip(a);
      if (position === "EXP-02") {
        restored.send({ type: "CONTINUE" });
        expect(restored.getSnapshot().context.position).toBe("EXP-02");
        select(restored);
        restored.send({ type: "CONTINUE" });
        expect(restored.getSnapshot().context.position).toBe("EXP-03");
      }
      if (["EXP-03", "EXP-04", "EXP-05"].includes(position)) {
        expect(restored.getSnapshot().context.model!.value.selectionId).toBe(
          "C03-S02-B",
        );
        if (position !== "EXP-05")
          expect(
            projectC03ActivityFrame(
              restored,
            ).mathematicalExplanation?.multiplier.magnitude.toString(),
          ).toBe("1.69");
      }
      restored.stop();
      a.stop();
    },
  );
  it("restores A02 checked/delivered consolidation without leaking static answers before response", async () => {
    const a = fresh();
    advance(a, "ACTIVE");
    a.send({ type: "RESPONSE_CHANGED", response: answers[1]! });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    const restored = await roundtrip(a);
    expect(restored.getSnapshot().context.evaluation?.outcome).toBe(
      "CONFIRMED",
    );
    restored.stop();
    a.stop();
  });
  it.each([0, 1, 2, 3])(
    "preserves authentic unfinished response parts for activity index %i",
    async (index) => {
      const a = fresh(index);
      advance(a, "ACTIVE");
      const answer = answers[index]!;
      if (answer.kind !== "COMPOSITE") throw new Error("Expected composite");
      const draft: LearnerResponse = {
        kind: "COMPOSITE",
        parts: answer.parts.slice(0, 1),
      };
      a.send({ type: "RESPONSE_CHANGED", response: draft });
      const restored = await roundtrip(a);
      expect(restored.getSnapshot().context.response).toEqual(draft);
      restored.send({ type: "CHECK_RESPONSE" });
      expect(restored.getSnapshot().context.hasChecked).toBe(false);
      restored.stop();
      a.stop();
    },
  );
  it("preserves current answer exposure, stale revisions, incorrect feedback and return-to-review work", async () => {
    const a = fresh(2);
    advance(a, "ACTIVE");
    let restored = await roundtrip(a);
    expect(
      projectC03ActivityFrame(restored).mathematicalExplanation,
    ).toBeNull();
    restored.stop();
    a.send({ type: "RESPONSE_CHANGED", response: answers[2]! });
    a.send({ type: "CHECK_RESPONSE" });
    a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    restored = await roundtrip(a);
    expect(
      projectC03ActivityFrame(restored).mathematicalExplanation,
    ).not.toBeNull();
    restored.stop();
    a.send({ type: "REVISE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: response({
        multiplier: q("1.25", true),
        overtimePay: q("938"),
      }),
    });
    restored = await roundtrip(a);
    expect(restored.getSnapshot().context.responseRevision).toBe(2);
    expect(restored.getSnapshot().context.evaluation).toBeNull();
    expect(
      projectC03ActivityFrame(restored).mathematicalExplanation,
    ).toBeNull();
    restored.send({ type: "CHECK_AGAIN" });
    expect(restored.getSnapshot().context.evaluation?.outcome).toBe(
      "RECONSIDERATION",
    );
    restored.send({ type: "FEEDBACK_DELIVERED", revision: 2 });
    restored.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    const second = await roundtrip(restored);
    expect(second.getSnapshot().context.feedbackRevision).toBe(2);
    expect(projectC03ActivityFrame(second).diagnostic).toBe("ARITHMETIC");
    second.stop();
    restored.stop();
    a.stop();
  });
  it("restores inspected EXP-02 and both child states without requiring a fabricated new event", async () => {
    const a = fresh();
    advance(a, "EXP-02");
    select(a);
    const restored = await roundtrip(a);
    restored.send({ type: "CONTINUE" });
    expect(restored.getSnapshot().context.position).toBe("EXP-03");
    select(restored, "C03-S02-B");
    const rest = await roundtrip(restored);
    select(rest);
    const ordinary = await roundtrip(rest);
    expect(ordinary.getSnapshot().context.model!.value.selectionId).toBe(
      "C03-S02-A",
    );
    ordinary.stop();
    rest.stop();
    restored.stop();
    a.stop();
  });
  it("rejects direct restoration accessors/prototypes, detached model envelopes and inconsistent selection", () => {
    const a = fresh();
    advance(a, "EXP-02");
    const base = {
      ...projectC03ModelCheckpoint(a),
      context: a.getSnapshot().context,
    };
    let reads = 0;
    const accessor = Object.defineProperty({ ...base }, "context", {
      get() {
        reads++;
        return base.context;
      },
      enumerable: true,
    });
    expect(() => createC03RestoredActivityActor(accessor)).toThrow();
    expect(reads).toBe(0);
    expect(() =>
      createC03RestoredActivityActor(
        Object.assign(Object.create({ bad: true }) as typeof base, base),
      ),
    ).toThrow();
    expect(() =>
      createC03RestoredActivityActor({
        ...base,
        context: {
          ...base.context,
          model: {
            ...base.context.model!,
            value: { ...base.context.model!.value, selectionId: "C03-S02-B" },
          },
        },
      }),
    ).toThrow();
    const model = Object.defineProperty({ ...base.model }, "selectedChildId", {
      get() {
        reads++;
        return "C03-S02-A";
      },
      enumerable: true,
    });
    expect(() => createC03RestoredActivityActor({ ...base, model })).toThrow();
    expect(reads).toBe(0);
    a.stop();
  });
  it("projects review origin without persisting a support actor or inventing inspection", async () => {
    const a = fresh();
    advance(a, "EXP-02");
    a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
    const restored = await roundtrip(a);
    expect(restored.getSnapshot().context.origin).toBeNull();
    restored.send({ type: "CONTINUE" });
    expect(restored.getSnapshot().context.position).toBe("EXP-02");
    select(restored);
    restored.send({ type: "CONTINUE" });
    expect(restored.getSnapshot().context.position).toBe("EXP-03");
    restored.stop();
    a.stop();
  });
  it("rejects malformed identity, state, model, inspection, response and cached truth", () => {
    const a = fresh();
    advance(a, "ACTIVE");
    a.send({ type: "RESPONSE_CHANGED", response: answers[1]! });
    const original = projectC03CheckpointV3(a);
    const mutations: Array<(d: typeof original) => unknown> = [
      (d) => ({ ...d, activityId: "C04-A02" }),
      (d) => ({ ...d, scenarioId: "C03-S04" }),
      (d) => ({ ...d, position: "EXP-99" }),
      (d) => ({ ...d, responseContract: { id: "fake", version: 1 } }),
      (d) => ({
        ...d,
        model: {
          ...d.model!,
          evidence: { ...d.model!.evidence, selectedChildId: "fake" },
        },
      }),
      (d) => ({
        ...d,
        model: { ...d.model!, inspection: { ordinaryInspectedAtRevision: 0 } },
      }),
      (d) => ({
        ...d,
        model: {
          ...d.model!,
          inspection: { ordinaryInspectedAtRevision: null },
        },
      }),
      (d) => ({
        ...d,
        model: {
          ...d.model!,
          inspection: { ordinaryInspectedAtRevision: 999 },
        },
      }),
      (d) => ({ ...d, model: { ...d.model!, multiplier: "1.69" } }),
      (d) => ({ ...d, overtimePay: "338" }),
      (d) => ({ ...d, dailyShifts: [2, 2, 2, 2, 2] }),
      (d) => ({ ...d, checkedRevision: 1 }),
      (d) => ({ ...d, feedbackRevision: 1 }),
      (d) => ({ ...d, evaluation: { outcome: "CONFIRMED", diagnostic: null } }),
      (d) => ({
        ...d,
        response: {
          kind: "COMPOSITE",
          parts: [
            ...d.response!.parts,
            {
              key: "unknown",
              response: { kind: "SINGLE_SELECTION", selectionId: "fake" },
            },
          ],
        },
      }),
      (d) => ({
        ...d,
        response: {
          kind: "COMPOSITE",
          parts: [
            {
              key: "multiplierA",
              response: {
                kind: "EXACT_QUANTITY",
                value: {
                  magnitude: "1.250",
                  kind: "MULTIPLIER",
                  unit: "dimensionless",
                  basis: null,
                },
              },
            },
          ],
        },
      }),
      (d) => Object.assign(Object.create({ extra: true }) as object, d),
      (d) =>
        Object.defineProperty({ ...d }, "position", {
          get() {
            throw new Error("Accessor invoked");
          },
          enumerable: true,
        }),
    ];
    for (const mutate of mutations)
      expect(() => validateC03CheckpointV3(mutate(original))).toThrow();
    const checked = fresh(2);
    advance(checked, "ACTIVE");
    checked.send({ type: "RESPONSE_CHANGED", response: answers[2]! });
    checked.send({ type: "CHECK_RESPONSE" });
    const c = projectC03CheckpointV3(checked);
    expect(() =>
      validateC03CheckpointV3({ ...c, checkedRevision: 0 }),
    ).toThrow();
    expect(() =>
      validateC03CheckpointV3({
        ...c,
        evaluation: { outcome: "RECONSIDERATION", diagnostic: "ARITHMETIC" },
      }),
    ).toThrow();
    expect(() =>
      validateC03CheckpointV3({ ...c, feedbackRevision: 2 }),
    ).toThrow();
    const malformed = JSON.parse(JSON.stringify(c)) as typeof c;
    const quantityPart = malformed.response!.parts[0]!.response;
    if (quantityPart.kind !== "EXACT_QUANTITY")
      throw new Error("Expected quantity");
    quantityPart.value.magnitude = "01.25";
    expect(() => validateC03CheckpointV3(malformed)).toThrow();
    const staticEXP = {
      ...c,
      position: "EXP-01",
      response: null,
      responseRevision: 0,
      hasChecked: false,
      checkedResponse: null,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
    };
    expect(() => validateC03CheckpointV3(staticEXP)).toThrow();
    checked.stop();
    a.stop();
  });
  it("preserves wrong-unit submitted evidence as reconsideration, never valid mathematical truth", async () => {
    const a = fresh(2);
    advance(a, "ACTIVE");
    a.send({
      type: "RESPONSE_CHANGED",
      response: response({
        multiplier: q("1.25", true),
        overtimePay: q("937.5", true),
      }),
    });
    a.send({ type: "CHECK_RESPONSE" });
    const restored = await roundtrip(a);
    expect(restored.getSnapshot().context.evaluation).toEqual({
      outcome: "RECONSIDERATION",
      diagnostic: "UNITS",
    });
    restored.stop();
    a.stop();
  });
  it("rejects wrong envelope version/revision and broken JSON without writing", async () => {
    const a = fresh(2);
    const envelope = createRecoveryCheckpointV3(projectC03CheckpointV3(a));
    for (const text of [
      "{",
      "null",
      JSON.stringify({ ...envelope, schemaVersion: 2 }),
      JSON.stringify({ ...envelope, studyDefinitionRevision: "old" }),
      JSON.stringify({ ...envelope, extra: true }),
    ]) {
      expect(() => parseRecoveryCheckpointV3(text)).toThrow();
      const { queue, writes } = memory(text);
      expect((await recoverC03CheckpointV3(queue)).status).toBe(
        "UNUSABLE_CHECKPOINT_V3",
      );
      expect(writes).toEqual([]);
    }
    a.stop();
  });
  it("distinguishes absent storage from unavailable/read failure and enforces queue-bound one-shot claims", async () => {
    const { queue } = memory();
    const none = await recoverC03CheckpointV3(queue);
    expect(none.status).toBe("NO_CHECKPOINT_V3");
    expect(claimRecoveryClassificationV3(memory().queue, none)).toBe(false);
    expect(claimRecoveryClassificationV3(queue, { ...none })).toBe(false);
    expect(claimRecoveryClassificationV3(queue, none)).toBe(true);
    const broken = createRecoveryCheckpointQueue({
      load: () => Promise.reject(new Error("unavailable")),
      replace: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    });
    expect((await recoverC03CheckpointV3(broken)).status).toBe(
      "technical-failure-v3",
    );
    const thrown = { load: () => Promise.reject(new Error("read failure")) };
    expect((await recoverC03CheckpointV3(thrown)).status).toBe(
      "technical-failure-v3",
    );
    const a = fresh();
    advance(a, "EXP-02");
    const saved = memory(
      serializeRecoveryCheckpointV3(
        createRecoveryCheckpointV3(projectC03CheckpointV3(a)),
      ),
    );
    const result = await recoverC03CheckpointV3(saved.queue);
    if (result.status !== "VALID_C03_CHECKPOINT_V3")
      throw new Error(result.status);
    result.actor.start();
    select(result.actor);
    expect(claimRecoveryClassificationV3(saved.queue, result)).toBe(false);
    expect(claimRecoveryClassificationV3(saved.queue, result)).toBe(false);
    result.actor.stop();
    a.stop();
  });
  it("uses the same slot, coalescing, barriers, unknown-outcome pause and same-byte retry", async () => {
    const a = fresh(2);
    const first = createRecoveryCheckpointV3(projectC03CheckpointV3(a));
    advance(a, "ACTIVE");
    const second = createRecoveryCheckpointV3(projectC03CheckpointV3(a));
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const writes: string[] = [];
    const store = {
      load: () => Promise.resolve(null),
      clear: () => Promise.resolve(),
      replace: (text: string) => {
        writes.push(text);
        return new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        });
      },
    };
    const queue = createRecoveryCheckpointQueue(store);
    expect(createRecoveryCheckpointQueue(store)).toBe(queue);
    const busy = queue.replaceV3(first);
    const superseded = queue.replaceV3(first);
    const latest = queue.replaceV3(second);
    expect((await superseded).status).toBe("superseded");
    const barrier = queue.replaceBarrierV3(first);
    const after = queue.replaceV3(second);
    resolve();
    expect((await busy).status).toBe("durable");
    resolve();
    expect((await latest).status).toBe("durable");
    resolve();
    expect((await barrier).status).toBe("durable");
    reject(new Error("unknown acknowledgment"));
    expect((await after).status).toBe("technical-failure");
    expect((await queue.replaceV3(first)).status).toBe("blocked");
    const retry = queue.retry();
    resolve();
    expect((await retry).status).toBe("durable");
    expect(writes).toEqual(
      [first, second, first, second, second].map(serializeRecoveryCheckpointV3),
    );
    expect(canonicalCheckpointJSON(parseRecoveryCheckpointV3(writes[4]!))).toBe(
      writes[4],
    );
    a.stop();
  });
});
