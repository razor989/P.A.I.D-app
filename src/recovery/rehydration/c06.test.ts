import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import {
  createC06ActivityActor,
  createC06RestoredActivityActor,
  createC06ActivityBindings,
} from "@/engine/c06-activity-binding/public";
import { instructionalContinueEligible } from "@/engine/activity-machine/public";
import {
  projectC06CheckpointV4,
  decodeC06CheckpointContext,
  canonicalCheckpointJSON,
  validateC06CheckpointV4,
} from "../projection/public";
import {
  createRecoveryCheckpointV4,
  serializeRecoveryCheckpointV4,
} from "../checkpoint/public";
import { createRecoveryCheckpointQueue } from "../store/public";
import {
  recoverC06CheckpointV4,
  claimRecoveryClassificationV4,
  recoverApplicationCheckpoint,
  claimRecoveryClassification,
} from "./public";

function queue(text: string | null) {
  return createRecoveryCheckpointQueue({
    load: () => Promise.resolve(text),
    replace: async () => {},
    clear: async () => {},
  });
}
function json(a: ReturnType<typeof createC06ActivityActor>) {
  return serializeRecoveryCheckpointV4(
    createRecoveryCheckpointV4(projectC06CheckpointV4(a)),
  );
}
function wrong(id: "C06-A01" | "C06-A04") {
  const q = {
    kind: "EXACT_QUANTITY" as const,
    value: quantity(
      ExactDecimal.from("1"),
      "MONETARY_AMOUNT",
      "PHP",
      id === "C06-A04" ? "June" : "per month",
    ),
  };
  const s = {
    kind: "SINGLE_SELECTION" as const,
    selectionId: "BASE_PLUS_COMMISSION",
  };
  return {
    kind: "COMPOSITE" as const,
    parts:
      id === "C06-A04"
        ? [
            { key: "arrangement", response: s },
            { key: "commission", response: q },
            { key: "total", response: q },
          ]
        : [
            {
              key: "expectation",
              response: {
                kind: "SINGLE_SELECTION" as const,
                selectionId: "SAME",
              },
            },
            {
              key: "investigation",
              response: {
                kind: "SINGLE_SELECTION" as const,
                selectionId: "AGREEMENTS",
              },
            },
          ],
  };
}
describe("C06 authentic reconstruction", () => {
  it.each(["COMMISSION_ONLY", "SALE_PROCEEDS", "SALE_PLUS_COMMISSION"])(
    "round-trips the actual partial A03 interpretation %s",
    async (selectionId) => {
      const actor = createC06ActivityActor("C06-A03");
      actor.start();
      actor.send({ type: "CONTINUE" });
      actor.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "COMPOSITE",
          parts: [
            {
              key: "interpretation",
              response: { kind: "SINGLE_SELECTION", selectionId },
            },
          ],
        },
      });
      const saved = json(actor);
      actor.stop();
      expect((await recoverC06CheckpointV4(queue(saved))).status).not.toBe(
        "UNUSABLE_CHECKPOINT_V4",
      );
    },
  );
  it("rejects the superseded three-quantity A03 contract without inventing decisions", async () => {
    const actor = createC06ActivityActor("C06-A03");
    actor.start();
    const old = json(actor).replace(
      "C06-A03-commission-claim-v2",
      "C06 arrangement, sales, rate and conditional base (task-local reference)",
    );
    actor.stop();
    expect((await recoverC06CheckpointV4(queue(old))).status).toBe(
      "UNUSABLE_CHECKPOINT_V4",
    );
  });
  it.each(["COMMISSION", "SALARY"])(
    "restores A02 reasoning with its authentic outcome (%s)",
    async (selectionId) => {
      const actor = createC06ActivityActor("C06-A02");
      actor.start();
      for (let i = 0; i < 7; i++) actor.send({ type: "CONTINUE" });
      const choice = (selectionId: string) => ({
        kind: "SINGLE_SELECTION" as const,
        selectionId,
      });
      const amount = (n: string, rate = false) => ({
        kind: "EXACT_QUANTITY" as const,
        value: quantity(
          ExactDecimal.from(n),
          rate ? "PERCENTAGE_RATE" : "MONETARY_AMOUNT",
          rate ? "%" : "PHP",
          rate ? null : "per month",
        ),
      });
      actor.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "COMPOSITE",
          parts: [
            { key: "fixedReason", response: choice("AGREEMENT") },
            { key: "changeReason", response: choice(selectionId) },
            { key: "orderReason", response: choice("COMMISSION_FIRST") },
            { key: "rate", response: amount("3", true) },
            { key: "base", response: amount("15000") },
            { key: "commissionA", response: amount("9000") },
            { key: "totalA", response: amount("24000") },
            { key: "commissionB", response: amount("15000") },
            { key: "totalB", response: amount("30000") },
          ],
        },
      });
      actor.send({ type: "CHECK_RESPONSE" });
      const result = await recoverC06CheckpointV4(queue(json(actor)));
      actor.stop();
      expect(result.status).toBe("VALID_C06_CHECKPOINT_V4");
      if (result.status !== "VALID_C06_CHECKPOINT_V4")
        throw new Error("Reasoning recovery failed");
      expect(result.actor.getSnapshot().context.evaluation).toEqual(
        selectionId === "COMMISSION"
          ? { outcome: "CONFIRMED", diagnostic: null }
          : { outcome: "RECONSIDERATION", diagnostic: "CAUSAL_CHANGE" },
      );
      expect(result.actor.getSnapshot().context.feedbackRevision).toBeNull();
      result.actor.stop();
    },
  );
  it.each([
    "C06 arrangement, sales, rate and conditional base (task-local reference)",
    "C06-A02-causal-comparison-v2",
  ])(
    "rejects superseded A02 contract %s instead of inventing question checks",
    async (superseded) => {
      const actor = createC06ActivityActor("C06-A02");
      actor.start();
      const old = json(actor).replace(
        "C06-A02-guided-questions-v3",
        superseded,
      );
      actor.stop();
      expect((await recoverC06CheckpointV4(queue(old))).status).toBe(
        "UNUSABLE_CHECKPOINT_V4",
      );
    },
  );
  it("does not reinterpret a saved response under the superseded A01 contract", async () => {
    const actor = createC06ActivityActor("C06-A01");
    actor.start();
    const old = json(actor).replace(
      "C06-A01-first-thinking-v2",
      "C06 arrangement, sales, rate and conditional base (task-local reference)",
    );
    actor.stop();
    expect((await recoverC06CheckpointV4(queue(old))).status).toBe(
      "UNUSABLE_CHECKPOINT_V4",
    );
  });
  it.each(["C06-A01", "C06-A02", "C06-A03", "C06-A04"] as const)(
    "admits %s into production and preserves queue-bound one-use custody",
    async (id) => {
      const actor = createC06ActivityActor(id);
      actor.start();
      actor.send({ type: "CONTINUE" });
      const saved = json(actor);
      actor.stop();
      const original = queue(saved),
        other = queue(saved);
      const result = await recoverApplicationCheckpoint(original);
      expect(result.status).toBe("VALID_CHECKPOINT");
      expect(claimRecoveryClassification(other, result)).toBe(false);
      expect(claimRecoveryClassification(original, result)).toBe(true);
      expect(claimRecoveryClassification(original, result)).toBe(false);
      if (result.status === "VALID_CHECKPOINT") result.actor.stop();
    },
  );
  it("rejects production custody after restored A01 emits", async () => {
    const actor = createC06ActivityActor("C06-A01");
    actor.start();
    const original = queue(json(actor));
    actor.stop();
    const result = await recoverApplicationCheckpoint(original);
    expect(result.status).toBe("VALID_CHECKPOINT");
    if (result.status !== "VALID_CHECKPOINT") return;
    result.actor.start();
    result.actor.send({ type: "CONTINUE" });
    expect(claimRecoveryClassification(original, result)).toBe(false);
    result.actor.stop();
  });
  it.each(["C06-A01", "C06-A04"] as const)(
    "restores confirmed %s teaching and rejects forged checked evidence",
    async (id) => {
      const response = wrong(id);
      const amount = (value: string, basis: string | null) => ({
        kind: "EXACT_QUANTITY" as const,
        value: quantity(
          ExactDecimal.from(value),
          "MONETARY_AMOUNT",
          "PHP",
          basis,
        ),
      });
      const correct: LearnerResponse = {
        kind: "COMPOSITE",
        parts: response.parts.map((p) => ({
          key: p.key,
          response:
            id === "C06-A01"
              ? p.key === "expectation"
                ? {
                    kind: "SINGLE_SELECTION",
                    selectionId: "DIFFERENT",
                  }
                : p.key === "baseA"
                  ? {
                      kind: "SEMANTIC_BOUNDARY",
                      resolution: { kind: "NOT_APPLICABLE" },
                    }
                  : p.key === "baseB"
                    ? amount("10000", "per month")
                    : p.response
              : p.key === "commission"
                ? amount("3600", "June")
                : p.key === "total"
                  ? amount("18600", "June")
                  : p.response,
        })),
      };
      const a = createC06ActivityActor(id);
      a.start();
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response: correct });
      a.send({ type: "CHECK_RESPONSE" });
      try {
        expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
        const p = projectC06CheckpointV4(a);
        for (const patch of [
          {
            evaluation: {
              outcome: "RECONSIDERATION",
              diagnostic: "COMMISSION",
            },
          },
          { checkedRevision: 2 },
          { feedbackRevision: 2 },
          { teaching: { entryRevision: 1, deliveredRevision: 1 } },
        ])
          expect(() => validateC06CheckpointV4({ ...p, ...patch })).toThrow();
        const bad = JSON.parse(canonicalCheckpointJSON(p)) as {
          checkedResponse: {
            parts: {
              key: string;
              response: { value: { unit: string }; selectionId?: string };
            }[];
          };
          response: unknown;
        };
        const altered = bad.checkedResponse.parts.find(
          (part: { key: string }) =>
            part.key === (id === "C06-A01" ? "expectation" : "commission"),
        )!.response;
        if (id === "C06-A01") altered.selectionId = "INVENTED";
        else altered.value.unit = "USD";
        bad.response = bad.checkedResponse;
        expect(() => validateC06CheckpointV4(bad)).toThrow();
        a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
        a.send({ type: "CONTINUE" });
        const r = await recoverC06CheckpointV4(queue(json(a)));
        if (r.status !== "VALID_C06_CHECKPOINT_V4")
          throw new Error("Invalid confirmed teaching");
        expect(r.actor.getSnapshot().context.position).toBe(
          "POST_CONFIRMATION_EXPLANATION",
        );
        expect(r.actor.getSnapshot().context.evaluation?.outcome).toBe(
          "CONFIRMED",
        );
        expect(
          r.actor.getSnapshot().context.terminalTeachingRevision,
        ).toBeNull();
        r.actor.stop();
      } finally {
        a.stop();
      }
    },
  );
  it("restores selected models, support-normalized partial response and revision without preserving transient Help", async () => {
    const a = createC06ActivityActor("C06-A02");
    a.start();
    a.send({ type: "CONTINUE" });
    try {
      for (let i = 1; i < 4; i++) a.send({ type: "CONTINUE" });
      const c = a.getSnapshot().context;
      a.send({
        type: "SELECT_MODEL_CHILD",
        modelId: c.model!.modelId,
        revision: 0,
        position: "EXP-04",
        selectionId: "C06-S02-B",
      });
      a.send({ type: "PREVIOUS" });
      const r = await recoverC06CheckpointV4(queue(json(a)));
      if (r.status !== "VALID_C06_CHECKPOINT_V4")
        throw new Error("Invalid selected re-entry");
      expect(r.actor.getSnapshot().context.position).toBe("EXP-03");
      expect(r.actor.getSnapshot().context.model?.value.selectionId).toBe(
        "C06-S02-B",
      );
      r.actor.stop();
      for (let i = 0; i < 4; i++) a.send({ type: "CONTINUE" });
      a.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "COMPOSITE",
          parts: [
            {
              key: "rate",
              response: {
                kind: "EXACT_QUANTITY",
                value: quantity(
                  ExactDecimal.from("3"),
                  "PERCENTAGE_RATE",
                  "%",
                  null,
                ),
              },
            },
          ],
        },
      });
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      const partial = await recoverC06CheckpointV4(queue(json(a)));
      if (partial.status !== "VALID_C06_CHECKPOINT_V4")
        throw new Error("Invalid partial recovery");
      expect(partial.actor.getSnapshot().context.origin).toBeNull();
      expect(partial.actor.getSnapshot().context.response?.kind).toBe(
        "COMPOSITE",
      );
      partial.actor.stop();
      const p = projectC06CheckpointV4(a);
      expect(() =>
        validateC06CheckpointV4({ ...p, model: { ...p.model!, revision: 2 } }),
      ).toThrow();
    } finally {
      a.stop();
    }
    const b = createC06ActivityActor("C06-A04");
    b.start();
    b.send({ type: "CONTINUE" });
    b.send({ type: "RESPONSE_CHANGED", response: wrong("C06-A04") });
    b.send({ type: "CHECK_RESPONSE" });
    b.send({ type: "REVISE" });
    try {
      const r = await recoverC06CheckpointV4(queue(json(b)));
      if (r.status !== "VALID_C06_CHECKPOINT_V4")
        throw new Error("Invalid revision recovery");
      expect(r.actor.getSnapshot().context.position).toBe("REVISION");
      r.actor.stop();
    } finally {
      b.stop();
    }
  });
  it.each(["C06-A01", "C06-A02", "C06-A03", "C06-A04"])(
    "reconstructs %s with queue-bound one-shot claims",
    async (id) => {
      const a = createC06ActivityActor(id);
      try {
        const q = queue(json(a));
        const r = await recoverC06CheckpointV4(q);
        expect(r.status).toBe("VALID_C06_CHECKPOINT_V4");
        expect(claimRecoveryClassificationV4(q, { ...r })).toBe(false);
        expect(claimRecoveryClassificationV4(queue(null), r)).toBe(false);
        expect(claimRecoveryClassificationV4(q, r)).toBe(true);
        expect(claimRecoveryClassificationV4(q, r)).toBe(false);
        if (r.status === "VALID_C06_CHECKPOINT_V4") {
          expect(projectC06CheckpointV4(r.actor)).toEqual(
            projectC06CheckpointV4(a),
          );
          r.actor.stop();
        }
      } finally {
        a.stop();
      }
    },
  );
  it("round-trips all six EXP states without response or feedback fabrication", async () => {
    const a = createC06ActivityActor("C06-A02");
    a.start();
    a.send({ type: "CONTINUE" });
    try {
      for (let i = 1; i <= 6; i++) {
        const r = await recoverC06CheckpointV4(queue(json(a)));
        expect(r.status).toBe("VALID_C06_CHECKPOINT_V4");
        if (r.status !== "VALID_C06_CHECKPOINT_V4")
          throw new Error("Invalid EXP recovery");
        expect(r.actor.getSnapshot().context.position).toBe(`EXP-0${i}`);
        expect(r.actor.getSnapshot().context.feedbackRevision).toBeNull();
        r.actor.stop();
        a.send({ type: "CONTINUE" });
      }
    } finally {
      a.stop();
    }
  });
  it.each(["C06-A01", "C06-A04"] as const)(
    "recovers wrong %s checked/teaching state without correcting answers",
    async (id) => {
      const a = createC06ActivityActor(id);
      a.start();
      a.send({ type: "CONTINUE" });
      a.send({ type: "RESPONSE_CHANGED", response: wrong(id) });
      a.send({ type: "CHECK_RESPONSE" });
      try {
        const checked = await recoverC06CheckpointV4(queue(json(a)));
        expect(checked.status).toBe("VALID_C06_CHECKPOINT_V4");
        if (checked.status !== "VALID_C06_CHECKPOINT_V4")
          throw new Error("Invalid checked recovery");
        expect(checked.actor.getSnapshot().context.feedbackRevision).toBeNull();
        checked.actor.stop();
        a.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
        a.send({ type: "CONTINUE" });
        if (id === "C06-A04") {
          expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
          const recovered = await recoverC06CheckpointV4(queue(json(a)));
          expect(recovered.status).toBe("VALID_C06_CHECKPOINT_V4");
          if (recovered.status === "VALID_C06_CHECKPOINT_V4") {
            recovered.actor.start();
            recovered.actor.send({ type: "FINISH_ACTIVITY" });
            expect(recovered.actor.getSnapshot().context.position).toBe(
              "RECONSIDERATION",
            );
            recovered.actor.send({ type: "REVISE" });
            expect(recovered.actor.getSnapshot().context.position).toBe(
              "REVISION",
            );
            expect(recovered.actor.getSnapshot().context.response).toEqual(
              wrong(id),
            );
            recovered.actor.stop();
          }
          return;
        }
        for (const delivered of [false, true]) {
          if (delivered)
            a.send({
              type: "TERMINAL_TEACHING_DELIVERED",
              revision: 1,
              contentId: `c06/S0${id.endsWith("1") ? 1 : 4}/accessibility-summary`,
            });
          const r = await recoverC06CheckpointV4(queue(json(a)));
          if (r.status !== "VALID_C06_CHECKPOINT_V4")
            throw new Error("Invalid teaching recovery");
          expect(r.actor.getSnapshot().context.evaluation?.outcome).toBe(
            "RECONSIDERATION",
          );
          expect(r.actor.getSnapshot().context.terminalTeachingRevision).toBe(
            delivered ? 1 : null,
          );
          r.actor.start();
          r.actor.send({ type: "FINISH_ACTIVITY" });
          expect(r.actor.getSnapshot().context.position).toBe(
            delivered ? "COMPLETE" : "POST_CONFIRMATION_EXPLANATION",
          );
          r.actor.stop();
        }
      } finally {
        a.stop();
      }
    },
  );
  it("rejects detached model state, wrong response membership and incompatible revisions", () => {
    const legacy = createC06ActivityActor("C06-A04");
    legacy.start();
    legacy.send({ type: "CONTINUE" });
    legacy.send({ type: "RESPONSE_CHANGED", response: wrong("C06-A04") });
    legacy.send({ type: "CHECK_RESPONSE" });
    legacy.send({ type: "FEEDBACK_DELIVERED", revision: 1 });
    const checkpoint = projectC06CheckpointV4(legacy);
    expect(() =>
      validateC06CheckpointV4({
        ...checkpoint,
        position: "POST_CONFIRMATION_EXPLANATION",
        teaching: { entryRevision: 1, deliveredRevision: 1 },
      }),
    ).toThrow();
    legacy.stop();
    const a = createC06ActivityActor("C06-A01");
    try {
      const p = projectC06CheckpointV4(a);
      const c = decodeC06CheckpointContext(p);
      const input = {
        activityId: p.activityId,
        scenarioId: p.scenarioId,
        responseContract: p.responseContract,
        context: c,
        model: p.model!.evidence,
      };
      expect(() =>
        createC06RestoredActivityActor({
          ...input,
          context: {
            ...c,
            model: { ...c.model!, value: { ...c.model!.value, state: {} } },
          },
        }),
      ).toThrow();
      expect(() =>
        validateC06CheckpointV4({ ...p, model: { ...p.model!, revision: 1 } }),
      ).toThrow();
      expect(() =>
        validateC06CheckpointV4({
          ...p,
          position: "ACTIVE",
          responseRevision: 1,
          response: {
            kind: "COMPOSITE",
            parts: [
              {
                key: "foreign",
                response: { kind: "SINGLE_SELECTION", selectionId: "x" },
              },
            ],
          },
        }),
      ).toThrow();
      expect(
        instructionalContinueEligible(
          c,
          createC06ActivityBindings()[0]!.definition,
        ),
      ).toBe(true);
      expect(canonicalCheckpointJSON(p)).not.toContain("state");
    } finally {
      a.stop();
    }
  });
  it("rejects a claim after actor start/mutation and stopped actors", async () => {
    const a = createC06ActivityActor("C06-A03");
    try {
      const q = queue(json(a));
      const r = await recoverC06CheckpointV4(q);
      if (r.status !== "VALID_C06_CHECKPOINT_V4")
        throw new Error("Invalid recovery");
      r.actor.start();
      r.actor.send({ type: "CONTINUE" });
      expect(claimRecoveryClassificationV4(q, r)).toBe(false);
      r.actor.stop();
    } finally {
      a.stop();
    }
  });
  it("classifies absent, malformed, incompatible and technical data non-destructively", async () => {
    expect((await recoverC06CheckpointV4(queue(null))).status).toBe(
      "NO_CHECKPOINT_V4",
    );
    for (const text of ["null", "{}", "bad", '{"schemaVersion":3}'])
      expect((await recoverC06CheckpointV4(queue(text))).status).toBe(
        "UNUSABLE_CHECKPOINT_V4",
      );
    const q = createRecoveryCheckpointQueue({
      load: () => Promise.reject(new Error("unavailable")),
      replace: async () => {},
      clear: async () => {},
    });
    expect((await recoverC06CheckpointV4(q)).status).toBe(
      "technical-failure-v4",
    );
  });
});
