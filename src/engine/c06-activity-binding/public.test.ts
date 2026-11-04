import { afterEach, describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import {
  c06Activities,
  c06Cases,
  c06CommissionProvider,
  c06Competency,
  c06Copy,
  c06Scenarios,
} from "@/study/competencies/c06/public";
import { createC06ModelState } from "@/competencies/c06-commission/model/public";
import {
  authenticateC06BindingSource,
  createC06ActivityActor,
  createC06ActivityBindings,
  projectC06ActivityFrame,
  readC06CommissionProvider,
  projectC06SourceReview,
} from "./public";

type Actor = ReturnType<typeof createC06ActivityActor>;
const actors: Actor[] = [];
afterEach(() => {
  actors.splice(0).forEach((a) => a.stop());
});
function actor(id: string) {
  const a = createC06ActivityActor(id);
  actors.push(a);
  a.start();
  return a;
}
const q = (n: string, basis: string | null = null, rate = false) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(
    ExactDecimal.from(n),
    rate ? "PERCENTAGE_RATE" : "MONETARY_AMOUNT",
    rate ? "%" : "PHP",
    basis,
  ),
});
const choice = (selectionId: string) => ({
  kind: "SINGLE_SELECTION" as const,
  selectionId,
});
function response(id: string, wrong = false): LearnerResponse {
  const parts =
    id === "C06-A01"
      ? [
          {
            key: "arrangementA",
            response: choice(
              wrong ? "BASE_PLUS_COMMISSION" : "STRAIGHT_COMMISSION",
            ),
          },
          {
            key: "baseA",
            response: {
              kind: "SEMANTIC_BOUNDARY" as const,
              resolution: { kind: "NOT_APPLICABLE" as const },
            },
          },
          { key: "arrangementB", response: choice("BASE_PLUS_COMMISSION") },
          { key: "baseB", response: q("10000", "per month") },
        ]
      : id === "C06-A02"
        ? [
            { key: "rate", response: q("3", null, true) },
            { key: "base", response: q("15000", "per month") },
            { key: "commissionA", response: q("9000", "per month") },
            { key: "totalA", response: q("24000", "per month") },
            { key: "commissionB", response: q("15000", "per month") },
            { key: "totalB", response: q(wrong ? "1" : "30000", "per month") },
          ]
        : id === "C06-A03"
          ? [
              { key: "sales", response: q("2000000") },
              { key: "rate", response: q("5", null, true) },
              { key: "commission", response: q(wrong ? "1" : "100000") },
            ]
          : [
              { key: "arrangement", response: choice("BASE_PLUS_COMMISSION") },
              { key: "commission", response: q(wrong ? "1" : "3600", "June") },
              { key: "total", response: q("18600", "June") },
            ];
  return { kind: "COMPOSITE", parts };
}
function active(a: Actor) {
  a.send({ type: "CONTINUE" });
  for (
    let i = 0;
    i < 6 && a.getSnapshot().context.position.startsWith("EXP-");
    i++
  )
    a.send({ type: "CONTINUE" });
}
function check(a: Actor, r: LearnerResponse) {
  a.send({ type: "RESPONSE_CHANGED", response: r });
  a.send({ type: "CHECK_RESPONSE" });
}

describe("C06 canonical composition and Actor delivery", () => {
  it("authenticates all four sources and rejects altered source, accessors and unknown identities", () => {
    authenticateC06BindingSource();
    const source = {
      competency: c06Competency,
      activities: c06Activities,
      scenarios: c06Scenarios,
      cases: c06Cases,
      provider: c06CommissionProvider,
      copy: c06Copy,
    };
    expect(() =>
      authenticateC06BindingSource({
        ...source,
        copy: { ...c06Copy, "c06/S01/task": "changed" },
      } as unknown as typeof source),
    ).toThrow();
    let read = false;
    const hostile = { ...source };
    Object.defineProperty(hostile, "cases", {
      enumerable: true,
      get() {
        read = true;
        return c06Cases;
      },
    });
    expect(() => authenticateC06BindingSource(hostile)).toThrow();
    expect(read).toBe(false);
    for (const id of ["C03-A01", "C06-A05", null])
      expect(() => createC06ActivityActor(id)).toThrow();
  });
  it.each(["C06-A01", "C06-A02", "C06-A03", "C06-A04"])(
    "uses authentic response/check/feedback for %s",
    (id) => {
      const a = actor(id);
      active(a);
      check(a, response(id));
      expect(a.getSnapshot().context.evaluation).toEqual({
        outcome: "CONFIRMED",
        diagnostic: null,
      });
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("CONFIRMATION");
      a.send({ type: "FEEDBACK_DELIVERED", revision: 0 });
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      const rev = a.getSnapshot().context.responseRevision;
      a.send({ type: "FEEDBACK_DELIVERED", revision: rev });
      expect(a.getSnapshot().context.feedbackRevision).toBe(rev);
      if (id === "C06-A01" || id === "C06-A04") {
        a.send({ type: "CONTINUE" });
        expect(a.getSnapshot().context.position).toBe(
          "POST_CONFIRMATION_EXPLANATION",
        );
        const contentId = createC06ActivityBindings().find(
          (b) => b.activityId === id,
        )!.definition.terminalTeaching!.contentId;
        a.send({ type: "FINISH_ACTIVITY" });
        expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
        a.send({
          type: "TERMINAL_TEACHING_DELIVERED",
          revision: rev,
          contentId,
        });
      }
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
    },
  );
  it.each(["C06-A01", "C06-A04"])(
    "retains both-outcome teaching and direct Finish for wrong %s work",
    (id) => {
      const a = actor(id);
      active(a);
      check(a, response(id, true));
      expect(a.getSnapshot().context.evaluation?.outcome).toBe(
        "RECONSIDERATION",
      );
      a.send({ type: "CONTINUE" });
      expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
      const rev = a.getSnapshot().context.responseRevision;
      a.send({ type: "FEEDBACK_DELIVERED", revision: rev });
      a.send({ type: "CONTINUE" });
      const p = projectC06ActivityFrame(a);
      const teachingText = p.frame.contentReferences
        .map((r) => r.text)
        .join(" ");
      expect(teachingText).toContain(
        id === "C06-A01"
          ? "Machine Ends at Commission"
          : "exported read-only to C01",
      );
      if (id === "C06-A04")
        expect(teachingText).toContain("₱800 remains outside C06");
      expect(
        p.frame.contentReferences.some((r) =>
          r.id.endsWith("accessibility-summary"),
        ),
      ).toBe(true);
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision: rev,
        contentId: "wrong",
      });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision: rev,
        contentId: `c06/S0${id.endsWith("1") ? 1 : 4}/accessibility-summary`,
      });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      expect(a.getSnapshot().context.evaluation?.outcome).toBe(
        "RECONSIDERATION",
      );
    },
  );
  it.each(["C06-A02", "C06-A03"])(
    "does not equate wrong %s work with completion",
    (id) => {
      const a = actor(id);
      active(a);
      check(a, response(id, true));
      a.send({
        type: "FEEDBACK_DELIVERED",
        revision: a.getSnapshot().context.responseRevision,
      });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
      a.send({ type: "REVISE" });
      a.send({ type: "RESPONSE_CHANGED", response: response(id) });
      a.send({ type: "CHECK_AGAIN" });
      expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
    },
  );
  it("separates A01 model selections from responses and fences stale/foreign commands", () => {
    const a = actor("C06-A01");
    active(a);
    const c = a.getSnapshot().context;
    a.send({
      type: "SELECT_MODEL_CHILD",
      modelId: c.model!.modelId,
      selectionId: "C06-S01-B",
      revision: 0,
      position: "ACTIVE",
    });
    expect(a.getSnapshot().context.model?.revision).toBe(1);
    expect(a.getSnapshot().context.response).toBeNull();
    for (const selectionId of ["C06-S01-A", "C06-S02-B"])
      a.send({
        type: "SELECT_MODEL_CHILD",
        modelId: c.model!.modelId,
        selectionId,
        revision: 0,
        position: "ACTIVE",
      });
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C06-S01-B");
    expect(projectC06ActivityFrame(a).model).not.toHaveProperty("commission");
  });
  it("exposes six guided phases and only approved sales states", () => {
    const a = actor("C06-A02");
    a.send({ type: "CONTINUE" });
    for (let i = 1; i <= 6; i++) {
      expect(a.getSnapshot().context.position).toBe(`EXP-0${i}`);
      const p = projectC06ActivityFrame(a);
      expect(
        p.frame.contentReferences.some((r) => r.id === `c06/EXP-0${i}`),
      ).toBe(true);
      if (i < 3) expect(p.model).not.toHaveProperty("commission");
      if (i === 4) {
        const c = a.getSnapshot().context;
        a.send({
          type: "SELECT_MODEL_CHILD",
          modelId: c.model!.modelId,
          revision: 0,
          position: c.position,
          selectionId: "C06-S02-B",
        });
        expect(a.getSnapshot().context.model?.value.selectionId).toBe(
          "C06-S02-B",
        );
        expect(a.getSnapshot().context.response).toBeNull();
      }
      if (i >= 5) expect(p.comparison).toHaveLength(2);
      a.send({ type: "CONTINUE" });
    }
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
  });
  it.each(["C06-A03", "C06-A04"])(
    "withholds %s solved amounts from entry, response and Help channels",
    (id) => {
      const a = actor(id);
      expect(projectC06ActivityFrame(a).model).not.toHaveProperty("commission");
      active(a);
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      const p = projectC06ActivityFrame(a);
      expect(p.model).not.toHaveProperty("commission");
      expect(p.model).not.toHaveProperty("totalCompensation");
      expect(JSON.stringify(p)).not.toContain(
        id === "C06-A03" ? "100,000" : "18,600",
      );
      a.send({ type: "CLOSE_SUPPORT" });
      expect(a.getSnapshot().context.response).toBeNull();
    },
  );
  it("straight commission has no base/total branch; provider/source review exports only authorized Commission", () => {
    expect(projectC06ActivityFrame(actor("C06-A03")).model).not.toHaveProperty(
      "baseSalary",
    );
    const p = readC06CommissionProvider();
    expect(p.result.resolution.kind).toBe("KNOWN");
    if (p.result.resolution.kind !== "KNOWN")
      throw new Error("Missing provider");
    expect(p.result.resolution.value.magnitude.toString()).toBe("3600");
    expect(p.result.resolution.value.basis).toBeNull();
    expect(p.provenance.relevantCondition).toContain("June");
    const review = projectC06SourceReview("C01-S04", [
      "sales",
      "rate",
      "commission",
    ]);
    expect(review.fields.map((f) => f.key)).toEqual([
      "sales",
      "rate",
      "commission",
    ]);
    for (const fields of [
      ["total"],
      ["base"],
      ["allowance"],
      ["commission", "commission"],
    ])
      expect(() => projectC06SourceReview("C01-S04", fields)).toThrow();
    expect(() => projectC06SourceReview("C01-S03", ["commission"])).toThrow();
    expect(() =>
      createC06ModelState({
        activityId: "C06-A04",
        scenarioId: "C06-S04",
        cases: [],
      }),
    ).toThrow();
  });
  it("rejects detached and stopped actors", () => {
    const a = actor("C06-A01");
    a.stop();
    expect(() => projectC06ActivityFrame(a)).toThrow();
    expect(() => projectC06ActivityFrame({} as Actor)).toThrow();
  });
});
