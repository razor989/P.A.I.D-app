import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "../../core/public";
import type { LearnerResponse } from "../../core/public";
import {
  c04Activities,
  c04Boundary,
  c04Competency,
  c04Copy,
  c04ResponseContracts,
  c04Scenarios,
} from "../../study/competencies/c04/public";
import { deriveC04ModelState } from "../../competencies/c04-percentage-change/model/public";
import type { C04ModelState } from "../../competencies/c04-percentage-change/model/public";
import { createActivityActor } from "../activity-runtime/public";
import type { ActivityActor } from "../activity-runtime/public";
import type { ActivityEvent, Position } from "../activity-machine/public";
import {
  authenticateC04BindingSource,
  composeC04ActivityFrame,
  createC04ActivityActor,
  createC04ActivityBindings,
  createC04ActivityRegistry,
} from "./public";

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
const boundary = {
  kind: "SEMANTIC_BOUNDARY" as const,
  resolution: { kind: "UNDEFINED" as const, reason: "Original value is zero" },
};
const composite = (
  fields: Record<
    string,
    Exclude<LearnerResponse, { kind: "COMPOSITE" | "MODEL_STATE" }>
  >,
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: Object.entries(fields).map(([key, response]) => ({ key, response })),
});
const advance = (a: ActivityActor, count = 1) => {
  for (let i = 0; i < count; i++) a.send({ type: "CONTINUE" });
};
const start = (id: string) => createC04ActivityActor(id).start();
const active = (id: string) => {
  const a = start(id);
  advance(a, id === "C04-A02" ? 6 : 1);
  return a;
};
const frame = composeC04ActivityFrame;
const select = (
  a: ActivityActor,
  selectionId: string,
  overrides: Partial<
    Extract<ActivityEvent, { type: "SELECT_MODEL_CHILD" }>
  > = {},
) => {
  const c = a.getSnapshot().context;
  a.send({
    type: "SELECT_MODEL_CHILD",
    modelId: c.model!.modelId,
    selectionId,
    revision: c.model!.revision,
    position: c.position,
    ...overrides,
  });
};
function option(a: ActivityActor, role: string, index = 0): string {
  return frame(a).responseControls!.find((c) => c.role === role)!.options![
    index
  ]!.id;
}
function response(
  a: ActivityActor,
  wrong = false,
  optional = false,
): LearnerResponse {
  const id = a.getSnapshot().context.activityId;
  if (id === "C04-A01")
    return composite({
      original: money("18000"),
      new: money("18000"),
      difference: money(wrong ? "1" : "0"),
      interpretation: {
        kind: "SINGLE_SELECTION",
        selectionId: option(a, "interpretation", wrong ? 1 : 0),
      },
      ...(optional ? { percentage: percent("0") } : {}),
    });
  if (id === "C04-A02")
    return composite({
      differenceA: money("2000"),
      differenceB: money("2000"),
      percentageA: percent(wrong ? "20" : "10"),
      percentageB: percent("20"),
      comparison: {
        kind: "SINGLE_SELECTION",
        selectionId: option(a, "comparison", wrong ? 1 : 0),
      },
      ...(optional
        ? { originalA: money("20000"), originalB: money("10000") }
        : {}),
    });
  if (id === "C04-A03")
    return composite({
      original: money("30000"),
      new: money("27000"),
      difference: money(wrong ? "3000" : "-3000"),
      percentage: percent(wrong ? "10" : "-10"),
      interpretation: {
        kind: "SINGLE_SELECTION",
        selectionId: option(a, "interpretation", wrong ? 1 : 0),
      },
    });
  return composite({
    difference: money(wrong ? "0" : "1500"),
    percentage: wrong ? percent("100") : boundary,
    explanation: {
      kind: "SINGLE_SELECTION",
      selectionId: option(a, "explanation", wrong ? 1 : 0),
    },
  });
}
function submit(a: ActivityActor, wrong = false, optional = false) {
  if (a.getSnapshot().context.activityId === "C04-A04") {
    a.send({
      type: "RESPONSE_CHANGED",
      response: composite({
        difference: money(wrong ? "0" : "1500"),
        percentage: wrong ? percent("100") : boundary,
      }),
    });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
  }
  a.send({ type: "RESPONSE_CHANGED", response: response(a, wrong, optional) });
  a.send({
    type: a.getSnapshot().context.hasChecked ? "CHECK_AGAIN" : "CHECK_RESPONSE",
  });
}
function feedback(a: ActivityActor) {
  a.send({
    type: "FEEDBACK_DELIVERED",
    revision: a.getSnapshot().context.responseRevision,
  });
}
function terminal(a: ActivityActor) {
  a.send({ type: "CONTINUE" });
  a.send({
    type: "TERMINAL_TEACHING_DELIVERED",
    revision: a.getSnapshot().context.responseRevision,
    contentId: "c04/S04/undefined-result",
  });
}

describe("four canonical production C04 bindings", () => {
  it("rejects wrong scenarios, response membership, duplicate options and malformed source configuration", () => {
    const source = {
      competency: c04Competency,
      activities: c04Activities,
      scenarios: c04Scenarios,
      boundary: c04Boundary,
      copy: c04Copy,
      contracts: c04ResponseContracts,
    };
    const altered =
      (
        patch: Partial<
          NonNullable<Parameters<typeof authenticateC04BindingSource>[0]>
        >,
      ) =>
      () =>
        authenticateC04BindingSource({ ...source, ...patch });
    expect(
      altered({
        scenarios: [
          c04Scenarios[1]!,
          c04Scenarios[0]!,
          ...c04Scenarios.slice(2),
        ],
      }),
    ).toThrow();
    expect(
      altered({
        activities: [
          { ...c04Activities[0]!, scenarioIds: ["C04-S02"] },
          ...c04Activities.slice(1),
        ],
      }),
    ).toThrow();
    expect(
      altered({
        contracts: c04ResponseContracts.map((c, i) =>
          i ? c : { ...c, scenarioId: "C04-S02" },
        ),
      }),
    ).toThrow();
    expect(
      altered({
        contracts: c04ResponseContracts.map((c, i) =>
          i ? c : { ...c, contractId: "wrong" },
        ),
      }),
    ).toThrow();
    const first = c04ResponseContracts[0]!;
    for (const options of [
      [first.choices[0]!.options[0]!, first.choices[0]!.options[0]!],
      [{ id: "", text: "invented" }],
      [{ id: "approved:yes", text: "invented" }],
    ])
      expect(
        altered({
          contracts: [
            { ...first, choices: [{ ...first.choices[0]!, options }] },
            ...c04ResponseContracts.slice(1),
          ],
        }),
      ).toThrow();
    expect(
      altered({ copy: { ...c04Copy, "c04/S01/scenario": "substituted" } }),
    ).toThrow();
    expect(
      altered({
        activities: c04Activities.map((a, i) =>
          i
            ? a
            : {
                ...a,
                modelBinding: {
                  profileId: "wrong",
                  interactionProfileId: "wrong",
                },
              },
        ),
      }),
    ).toThrow();
  });
  it("authenticates Study membership, registers exactly four bindings and constructs T025 actors", () => {
    expect(authenticateC04BindingSource()).toBeUndefined();
    const bindings = createC04ActivityBindings();
    expect(bindings.map((b) => b.activityId)).toEqual([
      "C04-A01",
      "C04-A02",
      "C04-A03",
      "C04-A04",
    ]);
    const registry = createC04ActivityRegistry();
    for (const b of bindings) {
      expect(Object.keys(b.ports)).toEqual([
        "ready",
        "evaluate",
        "completionEligible",
        "sourceReviewAvailable",
        "informationNeeded",
        "informationReturn",
      ]);
      const a = createActivityActor(registry, b.activityId).start();
      expect(a.getSnapshot().context.activityId).toBe(b.activityId);
      expect(frame(a).stateId).toBe("ENTRY");
      a.stop();
    }
    for (const id of [
      "C01-A01",
      "C03-A01",
      "C05-A01",
      "C06-A01",
      "C04-A99",
      "bogus",
      null,
    ])
      expect(() => createActivityActor(registry, id)).toThrow();
  });

  it.each(["C04-A01", "C04-A02", "C04-A03", "C04-A04"])(
    "%s executes both genuine evaluator outcomes with participation completion",
    (id) => {
      for (const wrong of [false, true]) {
        const a = active(id);
        submit(a, wrong);
        expect(a.getSnapshot().context.evaluation?.outcome).toBe(
          wrong ? "RECONSIDERATION" : "CONFIRMED",
        );
        expect(frame(a).feedbackState).toBeUndefined();
        a.send({ type: "FINISH_ACTIVITY" });
        expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
        feedback(a);
        expect(frame(a).feedbackState?.outcome).toBe(
          wrong ? "RECONSIDERATION" : "CONFIRMED",
        );
        if (id === "C04-A04") terminal(a);
        expect(frame(a).completionActionAvailability).toBe(true);
        a.send({ type: "FINISH_ACTIVITY" });
        expect(a.getSnapshot().context.position).toBe("COMPLETE");
        a.stop();
      }
    },
  );

  it.each(["C04-A01", "C04-A02"])(
    "%s preserves optional source fields and required choice membership",
    (id) => {
      const a = active(id);
      const binding = createC04ActivityRegistry().resolve(id);
      expect(binding.ports.ready(response(a))).toBe(true);
      expect(binding.ports.ready(response(a, false, true))).toBe(true);
      expect(binding.ports.ready(composite({ difference: money("0") }))).toBe(
        false,
      );
      expect(binding.ports.ready(composite({ illegal: money("0") }))).toBe(
        false,
      );
      const valid = response(a);
      if (valid.kind !== "COMPOSITE") throw new Error("composite required");
      expect(
        binding.ports.ready({
          ...valid,
          parts: [...valid.parts, ...valid.parts],
        }),
      ).toBe(false);
      expect(
        binding.ports.ready({
          ...valid,
          parts: valid.parts.map((p) =>
            p.response.kind === "SINGLE_SELECTION"
              ? {
                  ...p,
                  response: {
                    kind: "SINGLE_SELECTION",
                    selectionId: "approved:yes",
                  },
                }
              : p,
          ),
        }),
      ).toBe(false);
      submit(a, false, true);
      expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
      a.stop();
    },
  );

  it("A01 keeps equal Original and New roles distinct and revises after feedback", () => {
    const a = active("C04-A01");
    expect(frame(a).exposedModelFacts.map((f) => f.text)).toEqual([
      "Original monthly salary (reference): 18000 PHP per month",
      "New monthly salary: 18000 PHP per month",
    ]);
    expect(frame(a).exposedDerivedFacts).toEqual([]);
    submit(a, true);
    feedback(a);
    a.send({ type: "REVISE" });
    expect(a.getSnapshot().context.position).toBe("REVISION");
    a.send({ type: "RESPONSE_CHANGED", response: response(a) });
    expect(frame(a).feedbackState).toBeUndefined();
    a.send({ type: "CHECK_AGAIN" });
    expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
    a.stop();
  });

  it("A03 uses the revised offer and preserves signed negative mathematics without premature answers", () => {
    const a = active("C04-A03");
    const initial = JSON.stringify(frame(a));
    expect(initial).toContain("Before the position is filled");
    expect(initial).not.toContain("-10");
    expect(frame(a).exposedDerivedFacts).toEqual([]);
    submit(a);
    expect(a.getSnapshot().context.evaluation).toEqual({
      outcome: "CONFIRMED",
      diagnostic: null,
    });
    expect(
      frame(a)
        .exposedDerivedFacts.map((f) => f.text)
        .join(" "),
    ).toContain("-10%");
    a.stop();
  });

  it.each(["C04-A01", "C04-A02", "C04-A03"])(
    "%s Review is source-owned, read-only and returns to exact origin",
    (id) => {
      const a = active(id);
      const before = a.getSnapshot().context;
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(frame(a).review?.returnTo).toBe("ACTIVE");
      expect(frame(a).review?.relationships[0]?.id).toContain(
        "relationship-help",
      );
      expect(frame(a).allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
      expect(frame(a).responseControls).toEqual([]);
      a.send({
        type: "RESPONSE_CHANGED",
        response: composite({ difference: money("9") }),
      });
      a.send({ type: "CHECK_RESPONSE" });
      advance(a);
      if (id === "C04-A02") select(a, "C04-S02-B");
      a.send({ type: "CLOSE_SUPPORT" });
      expect(a.getSnapshot().context).toEqual(before);
      a.stop();
    },
  );

  it.each(["C04-A01", "C04-A02", "C04-A03", "C04-A04"])(
    "%s rejects unsupported source/provider, information and phase actions",
    (id) => {
      const a = start(id);
      const before = a.getSnapshot().context;
      a.send({ type: "CHECK_RESPONSE" });
      a.send({ type: "REVISE" });
      a.send({ type: "PREVIOUS" });
      a.send({ type: "FINISH_ACTIVITY" });
      a.send({ type: "OPEN_SUPPORT", mode: "SOURCE_REVIEW" });
      a.send({ type: "INFO_NEEDED" });
      expect(a.getSnapshot().context).toEqual(before);
      expect(frame(a).sourceReviewAvailability).toBe(false);
      a.stop();
    },
  );
});

describe("A02 actor-local issued model and source-paced teaching", () => {
  const serialized = (a: ActivityActor) => JSON.stringify(frame(a));
  const noDependentCalculation = (a: ActivityActor) => {
    const encoded = serialized(a);
    // Inspect the entire frame, not just the engaged-track namespace.
    for (const forbidden of [
      "10%",
      "20%",
      "÷",
      "× 100",
      "New minus Original:",
      "Difference relative to Original",
      "dependent-teaching",
      "/difference",
      "/percentage",
    ])
      expect(encoded).not.toContain(forbidden);
    expect(frame(a).exposedDerivedFacts).toEqual([]);
  };
  it("gates the complete EXP-02 calculation and canonical interpretation on actual A engagement", () => {
    const a = start("C04-A02");
    advance(a, 2);
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    noDependentCalculation(a);
    expect(serialized(a)).toContain("20000 PHP per month");
    expect(serialized(a)).toContain("22000 PHP per month");
    expect(serialized(a)).toContain(
      "The Original stays fixed as the reference basis.",
    );
    expect(serialized(a)).toContain(
      "The ₱22,000.00 New value tells us the ending salary. It does not replace ₱20,000.00 as the reference denominator.",
    );
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(1);
    const encoded = serialized(a);
    expect(encoded).toContain(
      "For Employee A, the ₱2,000.00 increase is measured relative to the Original salary of ₱20,000.00.",
    );
    expect(encoded).toContain("₱2,000 ÷ ₱20,000 × 100 = 10%");
    expect(encoded).toContain(
      "Employee A’s salary therefore increased by 10% from the Original salary.",
    );
    expect(encoded).toContain("New minus Original: 2000 PHP per month");
    expect(encoded).not.toContain("20%");
    a.stop();
  });
  it.each([false, true])(
    "gates EXP-03 on B engagement, with prior A engagement=%s",
    (engageA) => {
      const a = start("C04-A02");
      advance(a, 2);
      if (engageA) select(a, "C04-S02-A");
      advance(a);
      noDependentCalculation(a);
      expect(serialized(a)).toContain("10000 PHP per month");
      expect(serialized(a)).toContain("12000 PHP per month");
      expect(serialized(a)).toContain(
        "Employee B also gains ₱2,000.00. But this time the Original salary is only ₱10,000.00.",
      );
      expect(serialized(a)).toContain(
        "The same absolute increase is now compared with a smaller starting reference.",
      );
      select(a, "C04-S02-B");
      expect(serialized(a)).toContain("₱2,000 ÷ ₱10,000 × 100 = 20%");
      expect(serialized(a)).toContain(
        "Employee B’s salary therefore increased by 20% from the Original salary.",
      );
      expect(serialized(a)).toContain(
        "The important changed element is: Original Reference Basis ₱20,000 → ₱10,000 not the absolute change.",
      );
      expect(serialized(a)).not.toContain("10%");
      a.stop();
    },
  );
  it("retains opposite-child selection on Previous/re-entry without mixed or automatic dependent reveals", () => {
    const a = start("C04-A02");
    advance(a, 2);
    select(a, "C04-S02-A");
    advance(a);
    select(a, "C04-S02-B");
    const retained = a.getSnapshot().context.model;
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.model).toBe(retained);
    noDependentCalculation(a);
    const facts = frame(a).exposedModelFacts;
    expect(
      facts.find((f) => f.id.includes("authored-focus/C04-S02-A/original"))
        ?.text,
    ).toContain("20000");
    expect(
      facts.find((f) => f.id.includes("selected-track/original"))?.text,
    ).toContain("10000");
    select(a, "C04-S02-A");
    expect(serialized(a)).toContain("10%");
    advance(a);
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-A");
    noDependentCalculation(a);
    select(a, "C04-S02-B");
    a.send({ type: "PREVIOUS" });
    advance(a);
    expect(serialized(a)).toContain("20%");
    expect(serialized(a)).not.toContain("10%");
    a.stop();
  });
  it("includes full source-authored equal-change, comparative and formal teaching on schedule", () => {
    const a = start("C04-A02");
    advance(a);
    const first = serialized(a);
    for (const passage of [
      "Both employees receive the same increase in pesos. Before thinking about percentages, calculate the absolute change for each salary.",
      "Employee A: ₱22,000 − ₱20,000 = ₱2,000.",
      "Employee B: ₱12,000 − ₱10,000 = ₱2,000.",
      "So the two absolute changes are equal: each salary increased by ₱2,000.00. That does not yet tell us whether the percentage increases are equal.",
    ])
      expect(first).toContain(passage);
    expect(first).not.toContain("10%");
    expect(first).not.toContain("20%");
    advance(a, 3);
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    const comparison = serialized(a);
    for (const passage of [
      "Both employees gained exactly ₱2,000.00. Their absolute increases are equal.",
      "But percentage change does not ask only how many pesos changed. It asks how large that change is relative to the Original value.",
      "₱2,000.00 is 10% of ₱20,000.00, but it is 20% of ₱10,000.00. That is why equal peso increases can produce different percentage increases.",
      "Absolute Change A = Absolute Change B but Percentage Change A ≠ Percentage Change B because Original A ≠ Original B.",
    ])
      expect(comparison).toContain(passage);
    for (const child of ["C04-S02-A", "C04-S02-B"])
      expect(
        frame(a).exposedDerivedFacts.some(
          (f) => f.id.includes(child) && f.id.endsWith("/percentage"),
        ),
      ).toBe(true);
    advance(a);
    const formal = serialized(a);
    expect(formal).toContain(
      "We can now state the full relationship. First find the signed difference: New minus Original. Then compare that difference with the Original value. Finally, multiply by 100 to express the relative change as a percentage.",
    );
    expect(formal).toContain(
      "The Original is the reference denominator because percentage change describes change from the starting value.",
    );
    expect(formal).toContain(
      "Percentage Change = (New − Original) ÷ Original × 100",
    );
    expect(formal).toContain("10%");
    expect(formal).toContain("20%");
    advance(a);
    expect(serialized(a)).toContain("10%");
    expect(serialized(a)).toContain("20%");
    a.stop();
  });
  it("has exactly five ordered steps and only adjacent Previous/Continue edges", () => {
    const a = start("C04-A02");
    const positions: Position[] = [];
    for (let i = 0; i < 6; i++) {
      advance(a);
      positions.push(a.getSnapshot().context.position);
    }
    expect(positions).toEqual([
      "EXP-01",
      "EXP-02",
      "EXP-03",
      "EXP-04",
      "EXP-05",
      "ACTIVE",
    ]);
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.position).toBe("ACTIVE");
    a.stop();
    const b = start("C04-A02");
    advance(b);
    b.send({ type: "PREVIOUS" });
    expect(b.getSnapshot().context.position).toBe("EXP-01");
    for (let i = 1; i < 5; i++) {
      advance(b);
      const p = b.getSnapshot().context.position;
      b.send({ type: "PREVIOUS" });
      expect(b.getSnapshot().context.position).toBe(`EXP-0${i}`);
      advance(b);
      expect(b.getSnapshot().context.position).toBe(p);
    }
    b.stop();
  });
  it("initializes genuine A at revision zero without manufacturing engagement and obeys step permissions", () => {
    const a = start("C04-A02");
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    const issued = a.getSnapshot().context.model!.value.state as C04ModelState;
    expect(
      deriveC04ModelState(issued).original.value.magnitude.toString(),
    ).toBe("20000");
    expect(() => deriveC04ModelState({ ...issued })).toThrow("Unissued");
    expect(frame(a).modelSelectionControl).toBeUndefined();
    select(a, "C04-S02-B");
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    advance(a);
    expect(
      frame(a).exposedDerivedFacts.every((f) => !f.id.endsWith("percentage")),
    ).toBe(true);
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    advance(a);
    expect(frame(a).modelSelectionControl?.options.map((o) => o.id)).toEqual([
      "C04-S02-A",
    ]);
    expect(
      frame(a).exposedDerivedFacts.some((f) => f.id.includes("engaged-track")),
    ).toBe(false);
    select(a, "C04-S02-B");
    expect(a.getSnapshot().context.model?.revision).toBe(0);
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(1);
    expect(
      frame(a).exposedDerivedFacts.some(
        (f) => f.id.includes("engaged-track") && f.text.includes("10%"),
      ),
    ).toBe(true);
    advance(a);
    expect(frame(a).modelSelectionControl?.options.map((o) => o.id)).toEqual([
      "C04-S02-B",
    ]);
    expect(
      frame(a).exposedDerivedFacts.some((f) => f.id.includes("engaged-track")),
    ).toBe(false);
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(1);
    select(a, "C04-S02-B");
    expect(a.getSnapshot().context.model?.revision).toBe(2);
    const bView = deriveC04ModelState(
      a.getSnapshot().context.model!.value.state as C04ModelState,
    );
    expect(bView.state).not.toBe(issued);
    expect(bView.original.value.magnitude.toString()).toBe("10000");
    expect(bView.newValue.value.magnitude.toString()).toBe("12000");
    expect(
      bView.change.percentageChange.resolution.kind === "KNOWN" &&
        bView.change.percentageChange.resolution.value.magnitude.toString(),
    ).toBe("20");
    expect(
      frame(a).exposedDerivedFacts.some(
        (f) => f.id.includes("engaged-track") && f.text.includes("20%"),
      ),
    ).toBe(true);
    a.send({ type: "PREVIOUS" });
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-B");
    const f = frame(a);
    expect(
      f.exposedModelFacts.some(
        (f) =>
          f.id.includes("authored-focus/C04-S02-A") && f.text.includes("20000"),
      ),
    ).toBe(true);
    expect(
      f.exposedModelFacts.some(
        (f) => f.id.includes("selected-track") && f.text.includes("10000"),
      ),
    ).toBe(true);
    expect(
      f.exposedDerivedFacts.some((f) => f.id.includes("engaged-track")),
    ).toBe(false);
    advance(a, 2);
    expect(frame(a).modelSelectionControl).toBeUndefined();
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(2);
    advance(a);
    expect(frame(a).modelSelectionControl).toBeUndefined();
    expect(JSON.stringify(frame(a))).toContain(
      "(New − Original) ÷ Original × 100",
    );
    a.stop();
  });
  it("keeps two T022 states independent across navigation, selection, responses and paired Check", () => {
    const registry = createC04ActivityRegistry();
    const a = createActivityActor(registry, "C04-A02").start();
    const b = createActivityActor(registry, "C04-A02").start();
    expect(a.getSnapshot().context.model?.value.state).not.toBe(
      b.getSnapshot().context.model?.value.state,
    );
    advance(a, 6);
    advance(b, 2);
    select(a, "C04-S02-B");
    select(b, "C04-S02-A");
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-B");
    expect(b.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-A");
    const untouched = b.getSnapshot().context;
    submit(a);
    feedback(a);
    expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
    expect(b.getSnapshot().context).toEqual(untouched);
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-B");
    advance(b, 4);
    submit(b, true);
    expect(b.getSnapshot().context.evaluation?.outcome).toBe("RECONSIDERATION");
    a.send({ type: "REVISE" });
    select(a, "C04-S02-A");
    expect(a.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-A");
    expect(b.getSnapshot().context.model?.value.selectionId).toBe("C04-S02-A");
    expect(a.getSnapshot().context.model?.revision).toBe(2);
    expect(b.getSnapshot().context.model?.revision).toBe(1);
    expect(b.getSnapshot().context.evaluation?.outcome).toBe("RECONSIDERATION");
    a.stop();
    b.stop();
  });
  it("rejects malformed and stale selections without touching response/check evidence", () => {
    const a = active("C04-A02");
    const before = a.getSnapshot().context;
    for (const patch of [
      { revision: 99 },
      { position: "EXP-02" as Position },
      { modelId: "wrong" },
      { selectionId: "C04-S03" },
    ])
      select(a, "C04-S02-B", patch);
    a.send({
      type: "SELECT_MODEL_CHILD",
      modelId: before.model!.modelId,
      revision: 0,
      position: "ACTIVE",
      selectionId: "C04-S02-B",
      extra: true,
    } as never);
    expect(a.getSnapshot().context).toEqual(before);
    select(a, "C04-S02-B");
    const after = a.getSnapshot().context;
    expect(after.responseRevision).toBe(before.responseRevision);
    expect(after.hasChecked).toBe(false);
    expect(after.response).toBeNull();
    a.stop();
  });
});

describe("A04 independent primary judgment and both-outcome terminal teaching", () => {
  it("omits reasoning and computed answers before commitment, structurally commits wrong primary and locks it", () => {
    const a = active("C04-A04");
    const initial = frame(a);
    expect(initial.responseStage).toBe("PRIMARY");
    expect(initial.responseControls!.map((c) => c.role)).toEqual([
      "difference",
      "percentage",
    ]);
    expect(initial.exposedDerivedFacts).toEqual([]);
    expect(JSON.stringify(initial)).not.toContain("Original value is zero");
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    a.send({
      type: "RESPONSE_CHANGED",
      response: composite({
        difference: money("0"),
        percentage: percent("100"),
      }),
    });
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.hasChecked).toBe(false);
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    const first = a.getSnapshot().context.firstPrimaryCommitment;
    expect(first?.responseRevision).toBe(1);
    expect(Object.isFrozen(first)).toBe(true);
    expect(frame(a).responseControls!.map((c) => c.role)).toEqual([
      "explanation",
    ]);
    const locked = a.getSnapshot().context;
    a.send({
      type: "RESPONSE_CHANGED",
      response: composite({ difference: money("1500"), percentage: boundary }),
    });
    expect(a.getSnapshot().context).toEqual(locked);
    a.send({ type: "RESPONSE_CHANGED", response: response(a, true) });
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.evaluation?.outcome).toBe("RECONSIDERATION");
    a.send({ type: "REVISE" });
    expect(a.getSnapshot().context.responseStage).toBe("PRIMARY");
    a.send({
      type: "RESPONSE_CHANGED",
      response: composite({ difference: money("1500"), percentage: boundary }),
    });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.firstPrimaryCommitment).toEqual(first);
    expect(a.getSnapshot().context.currentPrimaryCommitment?.sequence).toBe(2);
    expect(
      a.getSnapshot().context.currentPrimaryCommitment
        ?.reasoningPreviouslyExposed,
    ).toBe(true);
    a.send({ type: "RESPONSE_CHANGED", response: response(a) });
    a.send({ type: "CHECK_AGAIN" });
    expect(a.getSnapshot().context.evaluation?.outcome).toBe("CONFIRMED");
    expect(a.getSnapshot().context.checkedCommitmentSequence).toBe(2);
    a.stop();
  });
  it("supports explicit return, clears dependent explanation and requires recommitment", () => {
    const a = active("C04-A04");
    a.send({
      type: "RESPONSE_CHANGED",
      response: composite({ difference: money("1500"), percentage: boundary }),
    });
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    const first = a.getSnapshot().context.firstPrimaryCommitment;
    a.send({ type: "RESPONSE_CHANGED", response: response(a) });
    a.send({ type: "RETURN_TO_PRIMARY" });
    expect(a.getSnapshot().context.responseStage).toBe("PRIMARY");
    expect(a.getSnapshot().context.currentPrimaryCommitment).toBeNull();
    expect(JSON.stringify(a.getSnapshot().context.response)).not.toContain(
      "explanation",
    );
    a.send({ type: "CHECK_RESPONSE" });
    expect(a.getSnapshot().context.evaluation).toBeNull();
    a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
    expect(a.getSnapshot().context.firstPrimaryCommitment).toEqual(first);
    a.stop();
  });
  it.each([false, true])(
    "requires distinct feedback and terminal acknowledgment for outcome wrong=%s",
    (wrong) => {
      const a = active("C04-A04");
      submit(a, wrong);
      const outcome = a.getSnapshot().context.evaluation;
      advance(a);
      expect(a.getSnapshot().context.position).toBe(
        wrong ? "RECONSIDERATION" : "CONFIRMATION",
      );
      feedback(a);
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
      advance(a);
      expect(a.getSnapshot().context.position).toBe(
        "POST_CONFIRMATION_EXPLANATION",
      );
      expect(
        frame(a).contentReferences.some(
          (c) => c.id === "c04/S04/undefined-result",
        ),
      ).toBe(true);
      frame(a);
      expect(a.getSnapshot().context.terminalTeachingRevision).toBeNull();
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).not.toBe("COMPLETE");
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision: 999,
        contentId: "c04/S04/undefined-result",
      });
      expect(a.getSnapshot().context.terminalTeachingRevision).toBeNull();
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(frame(a).review?.returnTo).toBe("POST_CONFIRMATION_EXPLANATION");
      const saved = a.getSnapshot().context;
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context).toEqual(saved);
      a.send({ type: "CLOSE_SUPPORT" });
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision: a.getSnapshot().context.responseRevision,
        contentId: "c04/S04/undefined-result",
      });
      expect(a.getSnapshot().context.evaluation).toEqual(outcome);
      a.send({ type: "FINISH_ACTIVITY" });
      expect(a.getSnapshot().context.position).toBe("COMPLETE");
      a.stop();
    },
  );
  it("keeps commitments, reasoning exposure, feedback and completion local to each actor", () => {
    const a = active("C04-A04"),
      b = active("C04-A04");
    const before = b.getSnapshot().context;
    submit(a, true);
    feedback(a);
    terminal(a);
    a.send({ type: "FINISH_ACTIVITY" });
    expect(b.getSnapshot().context).toEqual(before);
    expect(b.getSnapshot().context.reasoningExposed).toBe(false);
    expect(b.getSnapshot().context.firstPrimaryCommitment).toBeNull();
    a.stop();
    b.stop();
  });
});

describe("actual semantic frame serialization", () => {
  it.each(["C04-A01", "C04-A02", "C04-A03", "C04-A04"])(
    "%s omits private model/evaluator authority at all executed phases",
    (id) => {
      const a = start(id);
      const check = () => {
        const encoded = JSON.stringify(frame(a));
        for (const forbidden of [
          "correctId",
          "modelAdapter",
          "selectedChildId",
          "allowedSelections",
          "checkedResponse",
          "firstPrimaryCommitment",
          "C04ModelState",
          "approved:yes",
        ])
          expect(encoded).not.toContain(forbidden);
        expect(JSON.parse(encoded)).not.toHaveProperty("context");
      };
      check();
      const count = id === "C04-A02" ? 6 : 1;
      for (let i = 0; i < count; i++) {
        advance(a);
        check();
      }
      submit(a, true);
      check();
      feedback(a);
      check();
      if (id === "C04-A04") {
        terminal(a);
        check();
      }
      a.send({ type: "FINISH_ACTIVITY" });
      check();
      a.stop();
    },
  );
});
