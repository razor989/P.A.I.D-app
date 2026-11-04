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
            { key: "arrangementA", response: s },
            { key: "baseA", response: q },
            { key: "arrangementB", response: s },
            { key: "baseB", response: q },
          ],
  };
}
describe("C06 authentic reconstruction", () => {
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
              ? p.key === "arrangementA"
                ? {
                    kind: "SINGLE_SELECTION",
                    selectionId: "STRAIGHT_COMMISSION",
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
            parts: { key: string; response: { value: { unit: string } } }[];
          };
          response: unknown;
        };
        bad.checkedResponse.parts.find(
          (part: { key: string }) =>
            part.key === (id === "C06-A01" ? "baseB" : "commission"),
        )!.response.value.unit = "USD";
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
