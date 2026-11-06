import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import { createC06ActivityActor } from "@/engine/c06-activity-binding/public";
import {
  canonicalCheckpointJSON,
  projectC06CheckpointV4,
  validateC06CheckpointV4,
} from "./public";

describe("C06 strict durable projection", () => {
  it.each(["C06-A01", "C06-A02", "C06-A03", "C06-A04"])(
    "projects authentic %s without cached answers",
    (id) => {
      const a = createC06ActivityActor(id);
      try {
        const p = projectC06CheckpointV4(a);
        expect(validateC06CheckpointV4(p)).toEqual(p);
        expect(p.activityId).toBe(id);
        expect(JSON.stringify(p)).not.toContain("magnitude");
        expect(Object.isFrozen(p)).toBe(true);
      } finally {
        a.stop();
      }
    },
  );
  it("round-trips partial responses and selected-child revision, rejecting cross-family/shape corruption", () => {
    // Prepare (A01) now records choices only; Explore (A02) keeps both a
    // selectable model and exact-quantity responses.
    const a = createC06ActivityActor("C06-A02");
    a.start();
    // Six explanation stages (EXP-01…EXP-06), then the response stage.
    for (let stage = 0; stage < 7; stage++) a.send({ type: "CONTINUE" });
    a.send({
      type: "RESPONSE_CHANGED",
      response: {
        kind: "COMPOSITE",
        parts: [
          {
            key: "base",
            response: {
              kind: "EXACT_QUANTITY",
              value: quantity(
                ExactDecimal.from("15000"),
                "MONETARY_AMOUNT",
                "PHP",
                "per month",
              ),
            },
          },
        ],
      },
    });
    const c = a.getSnapshot().context;
    a.send({
      type: "SELECT_MODEL_CHILD",
      modelId: c.model!.modelId,
      selectionId: "C06-S02-B",
      revision: 0,
      position: "ACTIVE",
    });
    try {
      const p = projectC06CheckpointV4(a);
      expect(p.response?.parts).toHaveLength(1);
      expect(p.model?.revision).toBe(1);
      expect(
        canonicalCheckpointJSON(
          validateC06CheckpointV4(JSON.parse(canonicalCheckpointJSON(p))),
        ),
      ).toBe(canonicalCheckpointJSON(p));
      for (const patch of [
        { activityId: "C03-A01" },
        { scenarioId: "C06-S01" },
        { position: "APP-01" },
        { cache: "4000" },
        { responseRevision: -1 },
        { model: null },
        { teaching: { contentId: "c06/S01/teaching" } },
        { feedbackRevision: 1 },
        { responseContract: { id: "wrong", version: 1 } },
      ])
        expect(() => validateC06CheckpointV4({ ...p, ...patch })).toThrow();
      const base = JSON.parse(canonicalCheckpointJSON(p)) as {
        response: { parts: { response: { value: { magnitude: string } } }[] };
      };
      for (const magnitude of ["010000", "10000.0", "-0", "NaN"]) {
        const bad = structuredClone(base);
        bad.response.parts[0]!.response.value.magnitude = magnitude;
        expect(() => validateC06CheckpointV4(bad)).toThrow();
      }
      const wrongChild = {
        ...p,
        model: {
          ...p.model!,
          evidence: { ...p.model!.evidence, selectedChildId: "C06-S01-A" },
        },
      };
      expect(() => validateC06CheckpointV4(wrongChild)).toThrow();
      let touched = false;
      expect(() =>
        validateC06CheckpointV4({
          ...p,
          get cache() {
            touched = true;
            return 1;
          },
        }),
      ).toThrow();
      expect(touched).toBe(false);
    } finally {
      a.stop();
    }
  });
  it("rejects detached actors", () => {
    expect(() =>
      projectC06CheckpointV4(
        {} as Parameters<typeof projectC06CheckpointV4>[0],
      ),
    ).toThrow();
  });
});
