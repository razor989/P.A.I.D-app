import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import {
  c03Activities,
  c03A01Diagnostic,
  c03Competency,
  c03Copy,
  c03Evidence,
  c03Scenarios,
} from "@/study/competencies/c03/public";
import { deriveC03ModelState } from "@/competencies/c03-overtime-pay/model/public";
import type { C03ModelState } from "@/competencies/c03-overtime-pay/model/public";
import {
  authenticateC03BindingSource,
  createC03ActivityActor,
  createC03ActivityBindings,
  createC03RestoredActivityActor,
  isAuthenticatedC03OvertimeProvider,
  projectC03ActivityFrame,
  projectC03ModelCheckpoint,
  readC03OvertimeProvider,
  checkC03ComparisonPart,
} from "./public";

const q = (value: string, multiplier = false) => ({
  kind: "EXACT_QUANTITY" as const,
  value: quantity(
    ExactDecimal.from(value),
    multiplier ? "MULTIPLIER" : "MONETARY_AMOUNT",
    multiplier ? "dimensionless" : "PHP",
    null,
  ),
});
const choice = (id: string) => ({
  kind: "SINGLE_SELECTION" as const,
  selectionId: id,
});
const response = (
  parts: Record<string, ReturnType<typeof q> | ReturnType<typeof choice>>,
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: Object.entries(parts).map(([key, value]) => ({
    key,
    response: value,
  })),
});
const answers = [
  response({
    expectation: choice("c03-a01-not-sure"),
    investigation: choice("c03-a01-compare-ideas"),
  }),
  response({
    invariants: choice("rate + hours"),
    changes: choice("condition + multiplier + overtimePay"),
    multiplierA: q("1.25", true),
    multiplierB: q("1.69", true),
    difference: q("88"),
  }),
  response({ multiplier: q("1.25", true), overtimePay: q("937.50") }),
  response({
    condition: choice("regular holiday"),
    multiplier: q("2.60", true),
    overtimePay: q("936"),
  }),
];
it("A04 requires current confirmed delivery and withholds answers and synthesis on reconsideration", () => {
  for (const [answer, role] of [
    [
      response({
        condition: choice("rest day"),
        multiplier: q("2.6", true),
        overtimePay: q("936"),
      }),
      "reconsider-condition",
    ],
    [
      response({
        condition: choice("regular holiday"),
        multiplier: q("2.6", true),
        overtimePay: q("900"),
      }),
      "reconsider-arithmetic",
    ],
    [
      response({
        condition: choice("regular holiday"),
        multiplier: q("2.6"),
        overtimePay: q("936"),
      }),
      "reconsider-units",
    ],
  ] as const) {
    const actor = active(3);
    try {
      actor.send({ type: "RESPONSE_CHANGED", response: answer });
      actor.send({ type: "CHECK_RESPONSE" });
      expect(
        projectC03ActivityFrame(actor).frame.feedbackState?.content.text,
      ).toBe(c03Copy[`c03/S04/${role}`]);
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision,
      });
      let p = projectC03ActivityFrame(actor);
      expect(p.mathematicalExplanation).toBeNull();
      expect(p.competencyRecords).toBeNull();
      expect(p.frame.allowedLearnerIntents).not.toContain("FINISH_ACTIVITY");
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).toBe("RECONSIDERATION");
      actor.send({ type: "REVISE" });
      actor.send({ type: "RESPONSE_CHANGED", response: answers[3]! });
      actor.send({ type: "CHECK_AGAIN" });
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision - 1,
      });
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).not.toBe("COMPLETE");
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision,
      });
      expect(projectC03ActivityFrame(actor).competencyRecords).toBeNull();
      actor.send({ type: "FINISH_ACTIVITY" });
      p = projectC03ActivityFrame(actor);
      expect(p.frame.stateId).toBe("COMPLETE");
      expect(p.competencyRecords).toHaveLength(4);
      expect(p.competencyRecords?.[3]?.overtimePay.resolution).toMatchObject({
        kind: "KNOWN",
      });
    } finally {
      actor.stop();
    }
  }
});
it("exposes A03 diagnostic feedback without revealing the worked result on incorrect evidence", () => {
  for (const [answer, role] of [
    [
      response({ multiplier: q("1.69", true), overtimePay: q("937.5") }),
      "reconsider-condition",
    ],
    [
      response({ multiplier: q("1.25"), overtimePay: q("937.5") }),
      "reconsider-units",
    ],
  ] as const) {
    const actor = active(2);
    try {
      actor.send({ type: "RESPONSE_CHANGED", response: answer });
      actor.send({ type: "CHECK_RESPONSE" });
      const pending = projectC03ActivityFrame(actor);
      expect(pending.frame.feedbackState?.content.text).toBe(
        c03Copy[`c03/S03/${role}`],
      );
      expect(pending.mathematicalExplanation).toBeNull();
      expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
      actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(
        projectC03ActivityFrame(actor).frame.feedbackState,
      ).toBeUndefined();
      actor.send({ type: "CLOSE_SUPPORT" });
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision,
      });
      expect(projectC03ActivityFrame(actor).mathematicalExplanation).toBeNull();
      expect(
        projectC03ActivityFrame(actor).frame.allowedLearnerIntents,
      ).not.toContain("FINISH_ACTIVITY");
      expect(
        projectC03ActivityFrame(actor).frame.allowedLearnerIntents,
      ).toContain("REVISE");
    } finally {
      actor.stop();
    }
  }
});
it("exposes authentic A02 feedback before delivery for confirmation and arithmetic reconsideration", () => {
  for (const difference of ["88", "80"]) {
    const actor = active(1);
    try {
      expect(
        projectC03ActivityFrame(actor).frame.feedbackState,
      ).toBeUndefined();
      actor.send({
        type: "RESPONSE_CHANGED",
        response: response({
          invariants: choice("rate + hours"),
          changes: choice("condition + multiplier + overtimePay"),
          multiplierA: q("1.25", true),
          multiplierB: q("1.69", true),
          difference: q(difference),
        }),
      });
      actor.send({ type: "CHECK_RESPONSE" });
      const pending = projectC03ActivityFrame(actor);
      expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
      expect(pending.frame.feedbackState?.content.text).toBe(
        difference === "88"
          ? c03Copy["c03/S02/confirmation"]
          : c03Copy["c03/S02/reconsider-difference"],
      );
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).not.toBe("COMPLETE");
      actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(
        projectC03ActivityFrame(actor).frame.feedbackState,
      ).toBeUndefined();
      actor.send({ type: "CLOSE_SUPPORT" });
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision - 1,
      });
      expect(actor.getSnapshot().context.feedbackRevision).toBeNull();
      actor.send({
        type: "FEEDBACK_DELIVERED",
        revision: actor.getSnapshot().context.responseRevision,
      });
      actor.send({ type: "FINISH_ACTIVITY" });
      expect(actor.getSnapshot().context.position).toBe(
        difference === "88" ? "COMPLETE" : "RECONSIDERATION",
      );
    } finally {
      actor.stop();
    }
  }
});
it("checks real partial A02 evidence without fabricating missing answers or checking the Actor", () => {
  const actor = active(1);
  try {
    actor.send({
      type: "RESPONSE_CHANGED",
      response: response({ invariants: choice("rate + multiplier") }),
    });
    expect(checkC03ComparisonPart(actor, "invariants")?.outcome).toBe(
      "RECONSIDERATION",
    );
    expect(() => checkC03ComparisonPart(actor, "difference")).toThrow();
    expect(actor.getSnapshot().context.evaluation).toBeNull();
    expect(actor.getSnapshot().context.checkedRevision).toBeNull();
    actor.send({
      type: "RESPONSE_CHANGED",
      response: response({ invariants: choice("rate + hours") }),
    });
    expect(checkC03ComparisonPart(actor, "invariants")?.outcome).toBe(
      "CONFIRMED",
    );
    actor.send({ type: "CHECK_RESPONSE" });
    expect(actor.getSnapshot().context.position).toBe("ACTIVE");
  } finally {
    actor.stop();
  }
});
function active(index: number) {
  const actor = createC03ActivityActor(`C03-A0${index + 1}`);
  actor.start();
  for (let i = 0; i < (index === 1 ? 6 : 1); i++) {
    if (actor.getSnapshot().context.position === "EXP-02")
      inspectOrdinary(actor);
    actor.send({ type: "CONTINUE" });
  }
  return actor;
}
function inspectOrdinary(actor: ReturnType<typeof createC03ActivityActor>) {
  const c = actor.getSnapshot().context;
  actor.send({
    type: "SELECT_MODEL_CHILD",
    modelId: c.model!.modelId,
    selectionId: "C03-S02-A",
    revision: c.model!.revision,
    position: c.position,
  });
}

describe("C03 canonical runtime", () => {
  it("T062 accepts all twenty starting ideas without solution projection", () => {
    for (const expectation of c03A01Diagnostic.expectation.options) {
      for (const investigation of c03A01Diagnostic.investigation.options) {
        const a = active(0);
        const assertNeutral = () => {
          const p = projectC03ActivityFrame(a);
          expect(p.mathematicalExplanation).toBeNull();
          expect(p.frame.review).toBeUndefined();
          expect(JSON.stringify(p)).not.toMatch(
            /1\.25|250|reconsider-condition/,
          );
        };
        assertNeutral();
        a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
        expect(a.getSnapshot().context.position).toBe("ACTIVE");
        a.send({
          type: "RESPONSE_CHANGED",
          response: response({
            expectation: choice(expectation.id),
            investigation: choice(investigation.id),
          }),
        });
        a.send({ type: "CHECK_RESPONSE" });
        expect(a.getSnapshot().context.evaluation).toEqual({
          outcome: "CONFIRMED",
          diagnostic: null,
        });
        assertNeutral();
        expect(
          projectC03ActivityFrame(a).frame.feedbackState?.content.text,
        ).toBe(c03Copy["c03/S01/confirmation"]);
        a.send({
          type: "FEEDBACK_DELIVERED",
          revision: a.getSnapshot().context.responseRevision,
        });
        assertNeutral();
        a.send({ type: "REVISE" });
        a.send({ type: "RESPONSE_CHANGED", response: answers[0]! });
        a.send({
          type: "FEEDBACK_DELIVERED",
          revision: a.getSnapshot().context.responseRevision - 1,
        });
        a.send({ type: "FINISH_ACTIVITY" });
        expect(a.getSnapshot().context.position).toBe("REVISION");
        a.send({ type: "CHECK_AGAIN" });
        a.send({
          type: "FEEDBACK_DELIVERED",
          revision: a.getSnapshot().context.responseRevision,
        });
        a.send({ type: "FINISH_ACTIVITY" });
        expect(a.getSnapshot().context.position).toBe("COMPLETE");
        assertNeutral();
        a.stop();
      }
    }
  });
  it("authenticates exact source and rejects changed facts, evidence and membership", () => {
    authenticateC03BindingSource();
    const source = {
      competency: c03Competency,
      activities: c03Activities,
      scenarios: c03Scenarios,
      evidence: c03Evidence,
      copy: c03Copy,
    };
    expect(() =>
      authenticateC03BindingSource({
        ...source,
        scenarios: [...c03Scenarios].reverse(),
      }),
    ).toThrow();
    expect(() =>
      authenticateC03BindingSource({
        ...source,
        activities: [...c03Activities].reverse(),
      }),
    ).toThrow();
    const changed = {
      ...c03Scenarios[2]!,
      facts: c03Scenarios[2]!.facts.map((f, i) =>
        i
          ? f
          : {
              ...f,
              resolution: {
                kind: "KNOWN" as const,
                value: quantity(
                  ExactDecimal.from("76"),
                  "MONETARY_RATE",
                  "PHP",
                  "per hour",
                ),
              },
            },
      ),
    };
    expect(() =>
      authenticateC03BindingSource({
        ...source,
        scenarios: [
          c03Scenarios[0]!,
          c03Scenarios[1]!,
          changed,
          c03Scenarios[3]!,
        ],
      }),
    ).toThrow();
    expect(() => createC03ActivityActor("C04-A01")).toThrow();
  });
  it.each([0, 1, 2, 3])(
    "executes binding %i through guarded check/delivery/finish",
    (i) => {
      const a = active(i);
      expect(a.getSnapshot().context.position).toBe("ACTIVE");
      a.send({ type: "CHECK_RESPONSE" });
      expect(a.getSnapshot().context.position).toBe("ACTIVE");
      a.send({ type: "FEEDBACK_DELIVERED", revision: 0 });
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      a.send({ type: "RESPONSE_CHANGED", response: answers[i]! });
      a.send({ type: "CHECK_RESPONSE" });
      expect(a.getSnapshot().context.evaluation).toEqual({
        outcome: "CONFIRMED",
        diagnostic: null,
      });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("CONFIRMATION");
      a.send({ type: "FEEDBACK_DELIVERED", revision: 999 });
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      a.send({
        type: "FEEDBACK_DELIVERED",
        revision: a.getSnapshot().context.responseRevision,
      });
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      a.stop();
    },
  );
  it("distinguishes invalid, wrong condition, wrong multiplier, wrong arithmetic and units without speculative diagnosis", () => {
    const bindings = createC03ActivityBindings();
    const ports = bindings[2]!.ports;
    const missing = response({ overtimePay: q("937.5") });
    expect(ports.ready(missing)).toBe(false);
    expect(() => ports.evaluate(missing)).toThrow();
    expect(
      ports.evaluate(
        response({ multiplier: q("1.25", true), overtimePay: q("938") }),
      ),
    ).toEqual({ outcome: "RECONSIDERATION", diagnostic: "ARITHMETIC" });
    expect(
      ports.evaluate(
        response({ multiplier: q("1.69", true), overtimePay: q("937.5") }),
      ).diagnostic,
    ).toBe("CONDITION_MULTIPLIER");
    expect(
      ports.evaluate(
        response({ multiplier: q("1.25"), overtimePay: q("937.5") }),
      ).diagnostic,
    ).toBe("UNITS");
    expect(
      bindings[3]!.ports.evaluate(
        response({
          condition: choice("rest day"),
          multiplier: q("1.25", true),
          overtimePay: q("936"),
        }),
      ).diagnostic,
    ).toBe("WORK_CONDITION");
    expect(
      bindings[0]!.ports.ready(
        response({ condition: choice("fake"), multiplier: q("1.25", true) }),
      ),
    ).toBe(false);
    expect(
      ports.ready(
        response({
          multiplier: q("1.25", true),
          overtimePay: q("937.5"),
          extra: q("1"),
        }),
      ),
    ).toBe(false);
  });
  it.each([2, 3])(
    "preserves independent exposure and invoked Help in %i",
    (i) => {
      const a = active(i);
      let p = projectC03ActivityFrame(a);
      expect(p.mathematicalExplanation).toBeNull();
      expect(p.frame.contentReferences.map((t) => t.id)).not.toContain(
        `c03/S0${i + 1}/accessibility-summary`,
      );
      expect(p.response).toBeNull();
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      p = projectC03ActivityFrame(a);
      expect(p.frame.review?.relationships[0]?.text).toContain(
        i === 3 ? "2.60" : "1.25",
      );
      expect(p.response).toBeNull();
      expect(p.mathematicalExplanation).toBeNull();
      a.send({ type: "CHECK_RESPONSE" });
      expect(a.getSnapshot().context.hasChecked).toBe(false);
      a.send({ type: "CLOSE_SUPPORT" });
      a.send({ type: "RESPONSE_CHANGED", response: answers[i]! });
      a.send({ type: "CHECK_RESPONSE" });
      a.send({
        type: "FEEDBACK_DELIVERED",
        revision: a.getSnapshot().context.responseRevision,
      });
      expect(projectC03ActivityFrame(a).mathematicalExplanation).not.toBeNull();
      a.send({ type: "REVISE" });
      expect(projectC03ActivityFrame(a).mathematicalExplanation).toBeNull();
      a.send({ type: "RESPONSE_CHANGED", response: answers[i]! });
      expect(a.getSnapshot().context.feedbackRevision).toBeNull();
      a.send({ type: "CHECK_AGAIN" });
      expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
      a.stop();
    },
  );
  it("uses five generic EXP steps, Previous, bounded complete selection and taught comparison", () => {
    const a = createC03ActivityActor("C03-A02");
    a.start();
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-01");
    expect(projectC03ActivityFrame(a).mathematicalExplanation).toBeNull();
    a.send({ type: "CONTINUE" });
    expect(
      projectC03ActivityFrame(a).mathematicalExplanation?.overtimePay
        .resolution,
    ).toMatchObject({ kind: "KNOWN" });
    inspectOrdinary(a);
    a.send({ type: "CONTINUE" });
    const model = a.getSnapshot().context.model!;
    const select = {
      type: "SELECT_MODEL_CHILD" as const,
      modelId: model.modelId,
      selectionId: "C03-S02-B",
      revision: model.revision,
      position: "EXP-03" as const,
    };
    a.send({ ...select, modelId: "C04-A02" });
    expect(a.getSnapshot().context.model!.revision).toBe(1);
    a.send(select);
    const v = deriveC03ModelState(
      a.getSnapshot().context.model!.value.state as C03ModelState,
    );
    expect(v.condition).toBe("rest day");
    expect(v.multiplier.magnitude.toString()).toBe("1.69");
    expect(
      v.overtimePay.resolution.kind === "KNOWN" &&
        v.overtimePay.resolution.value.magnitude.toString(),
    ).toBe("338");
    expect(v.rate.magnitude.toString()).toBe("100");
    expect(v.hours.magnitude.toString()).toBe("2");
    expect(a.getSnapshot().context.responseRevision).toBe(0);
    a.send(select);
    expect(a.getSnapshot().context.model!.revision).toBe(2);
    a.send({ type: "CONTINUE" });
    expect(projectC03ActivityFrame(a).comparison).toHaveLength(2);
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.position).toBe("EXP-03");
    a.send({ type: "CONTINUE" });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-05");
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    expect(a.getSnapshot().context.evaluation).toBeNull();
    a.stop();
  });
  it("exports issued immutable exact James overtime without completion or C05 provenance", () => {
    const output = readC03OvertimeProvider();
    expect(output.provenance).toEqual({
      providerCompetencyId: "C03",
      consumerCompetencyId: "C01",
      sourceOutputKey: "overtime-pay value",
      sourceRecordId: "C03-S03",
      relevantCondition: "ordinary working day",
    });
    expect(
      output.result.resolution.kind === "KNOWN" &&
        output.result.resolution.value.magnitude.toString(),
    ).toBe("937.5");
    expect(isAuthenticatedC03OvertimeProvider(output)).toBe(true);
    expect(isAuthenticatedC03OvertimeProvider({ ...output })).toBe(false);
    expect(Object.isFrozen(output)).toBe(true);
  });
  it("restores authentic ACTIVE work and rejects malformed evidence (prior incompatibility retained in Context)", () => {
    const a = active(1);
    const c = a.getSnapshot().context;
    const checkpoint = projectC03ModelCheckpoint(a);
    const restored = createC03RestoredActivityActor({
      ...checkpoint,
      context: c,
    });
    expect(restored.getSnapshot().context.position).toBe("ACTIVE");
    restored.stop();
    expect(() =>
      createC03RestoredActivityActor({
        ...checkpoint,
        context: { ...c, responseRevision: -1 },
      }),
    ).toThrow();
    expect(() =>
      createC03RestoredActivityActor({
        ...checkpoint,
        context: c,
        model: { ...checkpoint.model, selectedChildId: "fake" },
      }),
    ).toThrow();
    expect(() =>
      createC03RestoredActivityActor({
        ...checkpoint,
        scenarioId: "C03-S03",
        context: c,
      }),
    ).toThrow();
    a.stop();
  });
  it("restores authentic EXP-01 without fabricated inspection", () => {
    const a = createC03ActivityActor("C03-A02");
    a.start();
    a.send({ type: "CONTINUE" });
    const checkpoint = projectC03ModelCheckpoint(a);
    const restored = createC03RestoredActivityActor({
      ...checkpoint,
      context: a.getSnapshot().context,
    });
    expect(restored.getSnapshot().context.position).toBe("EXP-01");
    expect(
      restored.getSnapshot().context.c03Inspection?.ordinaryInspectedAtRevision,
    ).toBeNull();
    restored.stop();
    a.stop();
  });
  it("requires genuine EXP-02 inspection, including an accepted same-child event", () => {
    const a = createC03ActivityActor("C03-A02");
    a.start();
    a.send({ type: "CONTINUE" });
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-02");
    expect(a.getSnapshot().context.model!.revision).toBe(0);
    expect(a.getSnapshot().context.c04A02StageEngagement).toBeUndefined();
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-02");
    inspectOrdinary(a);
    a.send({ type: "CONTINUE" });
    expect(a.getSnapshot().context.position).toBe("EXP-03");
    a.stop();
  });
  it("requires confirmed current feedback for A03 completion and preserves reconsidered work", () => {
    const a = active(2);
    const wrong = response({
      multiplier: q("1.25", true),
      overtimePay: q("938"),
    });
    a.send({ type: "RESPONSE_CHANGED", response: wrong });
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
    expect(projectC03ActivityFrame(a).frame.feedbackState?.content.text).toBe(
      c03Copy["c03/S03/reconsider-arithmetic"],
    );
    expect(projectC03ActivityFrame(a).mathematicalExplanation).toBeNull();
    a.send({
      type: "FEEDBACK_DELIVERED",
      revision: a.getSnapshot().context.responseRevision,
    });
    expect(projectC03ActivityFrame(a).diagnostic).toBe("ARITHMETIC");
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("RECONSIDERATION");
    expect(a.getSnapshot().context.response).toEqual(wrong);
    expect(projectC03ActivityFrame(a).mathematicalExplanation).toBeNull();
    a.send({ type: "REVISE" });
    a.send({ type: "RESPONSE_CHANGED", response: answers[2]! });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
    a.send({ type: "CHECK_AGAIN" });
    expect(projectC03ActivityFrame(a).frame.feedbackState?.outcome).toBe(
      "CONFIRMED",
    );
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
    a.send({
      type: "FEEDBACK_DELIVERED",
      revision: a.getSnapshot().context.responseRevision - 1,
    });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
    a.send({
      type: "FEEDBACK_DELIVERED",
      revision: a.getSnapshot().context.responseRevision,
    });
    a.send({ type: "FINISH_ACTIVITY" });
    expect(a.getSnapshot().context.position).toBe("COMPLETE");
    a.stop();
  });
});
