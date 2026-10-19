import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import { projectC04CheckpointV1, validateC04CheckpointV1 } from "./public";
import {
  assertCheckpointData,
  validateC02ReferenceCheckpointV2,
} from "./public";
import {
  createRecoveryCheckpointV1,
  parseRecoveryCheckpointV1,
  serializeRecoveryCheckpointV1,
} from "../checkpoint/public";
import {
  composeC04ActivityFrame,
  createC04ActivityActor,
  createC04ActivityBindings,
  createC04ActivityRegistry,
  projectC04CheckpointModelV1,
} from "@/engine/c04-activity-binding/public";

// D5 bounded SOURCE-CONFORMANCE fixtures only. No production issuer/Store route.
// Context 56b52bdf: final Amendment C C01 §§23–27, C03 §§30–36,
// C05 §§30–35, C06 §§29–42; PP10-A-0202-C01/C03/C05/C06-001.
const fixtureRevision = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const fixtureMoney = z.string().refine((value) => {
  try {
    return ExactDecimal.from(value).toString() === value;
  } catch {
    return false;
  }
});
const compatibilitySchema = z.discriminatedUnion("family", [
  z.strictObject({
    family: z.literal("C01"),
    activityId: z.literal("C01-A02"),
    scenarioId: z.literal("C01-S02"),
    period: z.literal("MAY"),
    members: z.array(z.enum(["REGULAR_PAY", "TRANSPORTATION_ALLOWANCE"])),
    revision: fixtureRevision,
    engagement: z.strictObject({
      regularIncluded: z.boolean(),
      allowanceIncluded: z.boolean(),
    }),
  }),
  z.strictObject({
    family: z.literal("C03"),
    activityId: z.literal("C03-A02"),
    scenarioId: z.literal("C03-S02"),
    selectedChildId: z.enum(["C03-S02-A", "C03-S02-B"]),
    revision: fixtureRevision,
  }),
  z.strictObject({
    family: z.literal("C05"),
    activityId: z.literal("C05-A02"),
    scenarioId: z.literal("C05-S02"),
    revision: fixtureRevision,
    months: z
      .strictObject({ count: z.literal(12), monthlyGiven: fixtureMoney })
      .nullable(),
    semimonthly: z
      .strictObject({ count: z.literal(2), amount: fixtureMoney })
      .nullable(),
    engagement: z.strictObject({ year: z.boolean(), month: z.boolean() }),
  }),
  z.strictObject({
    family: z.literal("C06"),
    activityId: z.enum(["C06-A01", "C06-A02"]),
    scenarioId: z.enum(["C06-S01", "C06-S02"]),
    arrangement: z.enum(["STRAIGHT", "SALARY_PLUS"]),
    revision: fixtureRevision,
    selectedChildId: z.enum([
      "C06-S01-A",
      "C06-S01-B",
      "C06-S02-A",
      "C06-S02-B",
    ]),
    base: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("NOT_APPLICABLE") }),
      z.strictObject({ kind: z.literal("KNOWN"), amount: fixtureMoney }),
    ]),
    commission: fixtureMoney,
    total: fixtureMoney,
  }),
]);

function inspectCompatibilityFixture(value: unknown) {
  assertCheckpointData(value);
  const data = compatibilitySchema.parse(value);
  const d = (text: string) => ExactDecimal.from(text);
  if (data.family === "C01") {
    if (
      new Set(data.members).size !== data.members.length ||
      (data.members.includes("REGULAR_PAY") &&
        !data.engagement.regularIncluded) ||
      (data.members.includes("TRANSPORTATION_ALLOWANCE") &&
        !data.engagement.allowanceIncluded)
    )
      throw new TypeError("C01 membership/engagement mismatch");
    return {
      data,
      amount: data.members
        .reduce(
          (sum, key) => sum.add(d(key === "REGULAR_PAY" ? "17250" : "1750")),
          d("0"),
        )
        .toString(),
    };
  }
  if (data.family === "C03") {
    // Source tuples share hourly rate 100 and 2 hours, not multiplier/condition.
    return {
      data,
      amount: d("100")
        .multiply(d("2"))
        .multiply(d(data.selectedChildId === "C03-S02-A" ? "1.25" : "1.69"))
        .toString(),
    };
  }
  if (data.family === "C05") {
    if (
      (data.months !== null &&
        (!data.engagement.year ||
          data.months.monthlyGiven !==
            d("480000").divide(d("12")).toString())) ||
      (data.semimonthly !== null &&
        (!data.months ||
          !data.engagement.month ||
          data.semimonthly.amount !==
            d(data.months.monthlyGiven).divide(d("2")).toString()))
    )
      throw new TypeError("C05 missing established partition");
    return {
      data,
      amount: data.semimonthly?.amount ?? data.months?.monthlyGiven ?? "480000",
    };
  }
  const comparison = data.activityId === "C06-A01";
  const second = data.selectedChildId.endsWith("B");
  const prefix = comparison ? "C06-S01" : "C06-S02";
  const arrangement = comparison && !second ? "STRAIGHT" : "SALARY_PLUS";
  const base = comparison ? "10000" : "15000";
  const commission = d(
    comparison ? "80000" : second ? "500000" : "300000",
  ).multiply(d(comparison ? "0.05" : "0.03"));
  if (
    data.scenarioId !== prefix ||
    !data.selectedChildId.startsWith(prefix) ||
    data.arrangement !== arrangement ||
    (arrangement === "STRAIGHT"
      ? data.base.kind !== "NOT_APPLICABLE"
      : data.base.kind !== "KNOWN" || data.base.amount !== base) ||
    data.commission !== commission.toString() ||
    data.total !==
      (arrangement === "STRAIGHT"
        ? commission
        : commission.add(d(base))
      ).toString()
  )
    throw new TypeError("C06 inconsistent complete arrangement");
  return { data, amount: data.total };
}

describe("D5 independently source-conforming fixtures (not production restoration)", () => {
  it("C01 preserves identity, May membership and stage-specific engagement independently of revision", () => {
    const fixture = {
      family: "C01",
      activityId: "C01-A02",
      scenarioId: "C01-S02",
      period: "MAY",
      revision: 2,
      members: ["REGULAR_PAY", "TRANSPORTATION_ALLOWANCE"],
      engagement: { regularIncluded: true, allowanceIncluded: true },
    };
    expect(
      inspectCompatibilityFixture(JSON.parse(JSON.stringify(fixture))).amount,
    ).toBe("19000");
    for (const change of [
      { period: "APRIL" },
      { members: ["REGULAR_PAY", "REGULAR_PAY"] },
      { members: ["MARCH_OVERTIME"] },
      { engagement: { regularIncluded: false, allowanceIncluded: true } },
    ])
      expect(() =>
        inspectCompatibilityFixture({ ...fixture, ...change }),
      ).toThrow();
  });
  it("C03 recomputes condition-specific multipliers rather than restoring a forged result", () => {
    const fixture = {
      family: "C03",
      activityId: "C03-A02",
      scenarioId: "C03-S02",
      revision: 1,
      selectedChildId: "C03-S02-A",
    };
    expect(inspectCompatibilityFixture(fixture).amount).toBe("250");
    expect(
      inspectCompatibilityFixture({ ...fixture, selectedChildId: "C03-S02-B" })
        .amount,
    ).toBe("338");
    for (const change of [
      { selectedChildId: "C03-S02-C" },
      { scenarioId: "C03-S03" },
      { multiplier: "1.25" },
      { overtime: "250" },
    ])
      expect(() =>
        inspectCompatibilityFixture({ ...fixture, ...change }),
      ).toThrow();
  });
  it("C05 requires authentic ordered monthly first partition, not cumulative revision alone", () => {
    const fixture = {
      family: "C05",
      activityId: "C05-A02",
      scenarioId: "C05-S02",
      revision: 2,
      months: { count: 12, monthlyGiven: "40000" },
      semimonthly: { count: 2, amount: "20000" },
      engagement: { year: true, month: true },
    };
    expect(
      inspectCompatibilityFixture(JSON.parse(JSON.stringify(fixture))).amount,
    ).toBe("20000");
    for (const change of [
      { months: null },
      { months: { count: 12, monthlyGiven: "480000" } },
      { semimonthly: { count: 2, amount: "40000" } },
      { engagement: { year: true, month: false } },
      { weekly: "10000" },
    ])
      expect(() =>
        inspectCompatibilityFixture({ ...fixture, ...change }),
      ).toThrow();
  });
  it("C06 preserves full arrangement, straight N/A and dependent salary-plus quantities", () => {
    const straight = {
      family: "C06",
      activityId: "C06-A01",
      scenarioId: "C06-S01",
      selectedChildId: "C06-S01-A",
      revision: 0,
      arrangement: "STRAIGHT",
      base: { kind: "NOT_APPLICABLE" },
      commission: "4000",
      total: "4000",
    };
    const salary = {
      ...straight,
      selectedChildId: "C06-S01-B",
      arrangement: "SALARY_PLUS",
      base: { kind: "KNOWN", amount: "10000" },
      total: "14000",
    };
    expect(inspectCompatibilityFixture(straight).amount).toBe("4000");
    expect(inspectCompatibilityFixture(salary).amount).toBe("14000");
    expect(
      inspectCompatibilityFixture({
        ...salary,
        activityId: "C06-A02",
        scenarioId: "C06-S02",
        selectedChildId: "C06-S02-B",
        base: { kind: "KNOWN", amount: "15000" },
        commission: "15000",
        total: "30000",
      }).amount,
    ).toBe("30000");
    for (const bad of [
      { ...straight, base: { kind: "KNOWN", amount: "0" } },
      { ...salary, base: { kind: "NOT_APPLICABLE" } },
      { ...salary, total: "4000" },
      { ...salary, selectedChildId: "C06-S02-A" },
      { ...salary, commission: "15000" },
    ])
      expect(() => inspectCompatibilityFixture(bad)).toThrow();
  });
  it("fixture provenance cannot promote any family into the C02 production DTO", () => {
    for (const competencyId of ["C01", "C03", "C05", "C06"])
      expect(() =>
        validateC02ReferenceCheckpointV2({
          competencyId,
          fixtureVerified: true,
        }),
      ).toThrow();
  });
});

describe("T029 full semantic checkpoint projection", () => {
  const ids = ["C04-A01", "C04-A02", "C04-A03", "C04-A04"];
  const boundary = {
    kind: "SEMANTIC_BOUNDARY" as const,
    resolution: {
      kind: "UNDEFINED" as const,
      reason: "Original value is zero",
    },
  };
  const money = (n: string) => ({
    kind: "EXACT_QUANTITY" as const,
    value: quantity(
      ExactDecimal.from(n),
      "MONETARY_AMOUNT",
      "PHP",
      "per month",
    ),
  });
  const percent = (n: string) => ({
    kind: "EXACT_QUANTITY" as const,
    value: quantity(ExactDecimal.from(n), "PERCENTAGE_CHANGE", "%", null),
  });
  const composite = (
    fields: Record<
      string,
      Exclude<LearnerResponse, { kind: "COMPOSITE" | "MODEL_STATE" }>
    >,
  ): LearnerResponse => ({
    kind: "COMPOSITE",
    parts: Object.entries(fields).map(([key, response]) => ({ key, response })),
  });
  const active = (id: string) => {
    const actor = createC04ActivityActor(id).start();
    for (let i = 0; i < (id === "C04-A02" ? 6 : 1); i++)
      actor.send({ type: "CONTINUE" });
    return actor;
  };
  type Actor = ReturnType<typeof active>;
  const roundTrip = (actor: Actor) => {
    const data = projectC04CheckpointV1(actor);
    const envelope = createRecoveryCheckpointV1(data);
    const json = serializeRecoveryCheckpointV1(envelope);
    expect(parseRecoveryCheckpointV1(json)).toEqual(envelope);
    expect(serializeRecoveryCheckpointV1(parseRecoveryCheckpointV1(json))).toBe(
      json,
    );
    for (const key of [
      "origin",
      "infoOrigin",
      "state.value",
      "children",
      "scroll",
      "timer",
      "animation",
      "selectedChildState",
      "correctId",
      "attempts",
    ])
      expect(json).not.toContain(`"${key}"`);
    return data;
  };
  const submit = (actor: Actor, wrong = false) => {
    const id = actor.getSnapshot().context.activityId;
    if (id === "C04-A04") {
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({
          difference: money(wrong ? "0" : "1500"),
          percentage: wrong ? percent("100") : boundary,
        }),
      });
      actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      roundTrip(actor); // committed primary, no reasoning selection yet
    }
    const controls = composeC04ActivityFrame(actor).responseControls!;
    const role =
      id === "C04-A02"
        ? "comparison"
        : id === "C04-A04"
          ? "explanation"
          : "interpretation";
    const selection = {
      kind: "SINGLE_SELECTION" as const,
      selectionId: controls.find((item) => item.role === role)!.options![
        wrong ? 1 : 0
      ]!.id,
    };
    const fields =
      id === "C04-A01"
        ? {
            original: money("18000"),
            new: money("18000"),
            difference: money(wrong ? "1" : "0"),
            interpretation: selection,
          }
        : id === "C04-A02"
          ? {
              differenceA: money("2000"),
              differenceB: money("2000"),
              percentageA: percent(wrong ? "20" : "10"),
              percentageB: percent("20"),
              comparison: selection,
            }
          : id === "C04-A03"
            ? {
                original: money("30000"),
                new: money("27000"),
                difference: money(wrong ? "3000" : "-3000"),
                percentage: percent(wrong ? "10" : "-10"),
                interpretation: selection,
              }
            : {
                difference: money(wrong ? "0" : "1500"),
                percentage: wrong ? percent("100") : boundary,
                explanation: selection,
              };
    // Branches deliberately use actual source controls for selectable identities.
    actor.send({
      type: "RESPONSE_CHANGED",
      response: composite(
        Object.fromEntries(
          Object.entries(fields).filter(
            (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
              entry[1] !== undefined,
          ),
        ),
      ),
    });
  };
  it.each(ids)("projects baseline, active and support-normalized %s", (id) => {
    const actor = createC04ActivityActor(id).start();
    try {
      expect(roundTrip(actor).position).toBe("ENTRY");
      for (let i = 0; i < (id === "C04-A02" ? 6 : 1); i++) {
        actor.send({ type: "CONTINUE" });
        roundTrip(actor);
      }
      const before = roundTrip(actor);
      actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(roundTrip(actor)).toEqual(before);
      actor.send({ type: "CLOSE_SUPPORT" });
      expect(roundTrip(actor)).toEqual(before);
    } finally {
      actor.stop();
    }
  });
  it.each(ids)(
    "preserves source-valid partial %s and exact precision/non-values",
    (id) => {
      const actor = active(id);
      try {
        const key = id === "C04-A02" ? "differenceA" : "difference";
        actor.send({
          type: "RESPONSE_CHANGED",
          response: composite({
            [key]: money("9007199254740993.1234567890123456789"),
          }),
        });
        expect(roundTrip(actor).response?.parts[0]?.response).toEqual({
          kind: "EXACT_QUANTITY",
          value: {
            magnitude: "9007199254740993.1234567890123456789",
            kind: "MONETARY_AMOUNT",
            unit: "PHP",
            basis: "per month",
          },
        });
        for (const resolution of [
          { kind: "UNKNOWN" as const, reason: "Draft" },
          { kind: "UNDEFINED" as const, reason: "Original is zero" },
          { kind: "NOT_APPLICABLE" as const },
        ]) {
          actor.send({
            type: "RESPONSE_CHANGED",
            response: composite({
              [key]: { kind: "SEMANTIC_BOUNDARY", resolution },
            }),
          });
          expect(roundTrip(actor).response?.parts[0]?.response).toEqual({
            kind: "SEMANTIC_BOUNDARY",
            resolution,
          });
        }
      } finally {
        actor.stop();
      }
    },
  );
  it.each(ids.flatMap((id) => [false, true].map((wrong) => ({ id, wrong }))))(
    "preserves checked/revision/recheck/terminal semantics $id wrong=$wrong",
    ({ id, wrong }) => {
      const actor = active(id);
      try {
        submit(actor, wrong);
        roundTrip(actor);
        actor.send({ type: "CHECK_RESPONSE" });
        const checked = roundTrip(actor);
        expect(checked.evaluation?.outcome).toBe(
          wrong ? "RECONSIDERATION" : "CONFIRMED",
        );
        const revision = checked.responseRevision;
        actor.send({ type: "FEEDBACK_DELIVERED", revision });
        expect(roundTrip(actor).feedbackRevision).toBe(revision);
        actor.send({ type: "REVISE" });
        expect(roundTrip(actor).position).toBe("REVISION");
        submit(actor, false);
        actor.send({ type: "CHECK_AGAIN" });
        expect(roundTrip(actor).evaluation?.outcome).toBe("CONFIRMED");
        actor.send({
          type: "FEEDBACK_DELIVERED",
          revision: actor.getSnapshot().context.responseRevision,
        });
        if (id === "C04-A04") {
          actor.send({ type: "CONTINUE" });
          const terminal = roundTrip(actor);
          expect(terminal.staging?.terminalTeachingRevision).toBeNull();
          actor.send({ type: "FINISH_ACTIVITY" });
          expect(roundTrip(actor).position).toBe(
            "POST_CONFIRMATION_EXPLANATION",
          );
          actor.send({
            type: "TERMINAL_TEACHING_DELIVERED",
            revision: actor.getSnapshot().context.responseRevision,
            contentId: "c04/S04/undefined-result",
          });
          expect(roundTrip(actor).staging?.terminalTeachingRevision).toBe(
            actor.getSnapshot().context.responseRevision,
          );
        }
        actor.send({ type: "FINISH_ACTIVITY" });
        expect(actor.getSnapshot().context.position).toBe("COMPLETE");
        expect(() => projectC04CheckpointV1(actor)).toThrow();
      } finally {
        actor.stop();
      }
    },
  );
  it.each([false, true])(
    "retains A04 terminal teaching for both outcomes wrong=%s",
    (wrong) => {
      const actor = active("C04-A04");
      try {
        submit(actor, wrong);
        actor.send({ type: "CHECK_RESPONSE" });
        actor.send({
          type: "FEEDBACK_DELIVERED",
          revision: actor.getSnapshot().context.responseRevision,
        });
        actor.send({ type: "CONTINUE" });
        expect(roundTrip(actor).position).toBe("POST_CONFIRMATION_EXPLANATION");
        actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
        roundTrip(actor);
        actor.send({ type: "CLOSE_SUPPORT" });
        actor.send({
          type: "TERMINAL_TEACHING_DELIVERED",
          revision: actor.getSnapshot().context.responseRevision,
          contentId: "c04/S04/undefined-result",
        });
        roundTrip(actor);
      } finally {
        actor.stop();
      }
    },
  );
  it("canonicalizes response-role order and rejects malformed/inconsistent evidence", () => {
    const actor = active("C04-A03");
    try {
      submit(actor);
      const draft = roundTrip(actor);
      const reversed = {
        ...draft,
        response: draft.response && {
          ...draft.response,
          parts: [...draft.response.parts].reverse(),
        },
      };
      expect(validateC04CheckpointV1(reversed)).toEqual(reversed);
      actor.send({ type: "CHECK_RESPONSE" });
      const checked = roundTrip(actor);
      const invalid = [
        {
          ...checked,
          position: "RECONSIDERATION",
          evaluation: { outcome: "RECONSIDERATION", diagnostic: "forged" },
        },
        { ...checked, responseRevision: checked.responseRevision + 1 },
        { ...checked, checkedRevision: null },
        { ...checked, feedbackRevision: 999 },
        { ...checked, hasChecked: false },
        { ...checked, position: "ACTIVE" },
        {
          ...checked,
          evaluation: { outcome: "CONFIRMED", diagnostic: "forged" },
        },
        { ...draft, model: {} },
        { ...draft, staging: {} },
        { ...draft, scenarioId: "C04-S01" },
        { ...draft, position: "EXP-99" },
        { ...draft, responseRevision: -1 },
        { ...draft, responseRevision: 0.1 },
        {
          ...draft,
          response: {
            kind: "COMPOSITE",
            parts: [{ key: "leaked", response: boundary }],
          },
        },
        ...[1, "01", "+1", "1.0", "1e3", "-0", "NaN"].map((magnitude) => ({
          ...draft,
          response: {
            kind: "COMPOSITE",
            parts: [
              {
                key: "difference",
                response: {
                  kind: "EXACT_QUANTITY",
                  value: {
                    magnitude,
                    kind: "MONETARY_AMOUNT",
                    unit: "PHP",
                    basis: "per month",
                  },
                },
              },
            ],
          },
        })),
      ];
      for (const value of invalid)
        expect(() => validateC04CheckpointV1(value)).toThrow();
    } finally {
      actor.stop();
    }
  });
  it("rejects forged A04 commitments, stages, and premature terminal delivery", () => {
    const actor = active("C04-A04");
    try {
      submit(actor);
      const data = roundTrip(actor);
      const s = data.staging!;
      const cases = [
        { ...s, currentPrimaryCommitment: null },
        { ...s, commitmentSequence: 9 },
        { ...s, reasoningExposed: false },
        { ...s, explanationCommitmentSequence: 9 },
        { ...s, checkedCommitmentSequence: 1 },
        { ...s, terminalEntryRevision: data.responseRevision },
        { ...s, terminalTeachingRevision: data.responseRevision },
        {
          ...s,
          firstPrimaryCommitment: { ...s.firstPrimaryCommitment!, sequence: 2 },
        },
        {
          ...s,
          currentPrimaryCommitment: {
            ...s.currentPrimaryCommitment!,
            scenarioId: "C04-S01",
          },
        },
        { ...s, responseStage: "PRIMARY" },
      ];
      for (const staging of cases)
        expect(() => validateC04CheckpointV1({ ...data, staging })).toThrow();
    } finally {
      actor.stop();
    }
  });
  it("preserves A02 differentiated engagement histories, Review and Previous invariants", () => {
    const a = createC04ActivityActor("C04-A02").start(),
      b = createC04ActivityActor("C04-A02").start();
    const advance = (actor: Actor) => actor.send({ type: "CONTINUE" });
    const select = (actor: Actor, selectionId: string) => {
      const c = actor.getSnapshot().context;
      actor.send({
        type: "SELECT_MODEL_CHILD",
        modelId: c.model!.modelId,
        revision: c.model!.revision,
        position: c.position,
        selectionId,
      });
    };
    try {
      advance(a);
      advance(a);
      advance(b);
      advance(b);
      select(a, "C04-S02-A");
      advance(a);
      advance(b);
      select(a, "C04-S02-B");
      select(b, "C04-S02-B");
      select(b, "C04-S02-B");
      advance(a);
      advance(b);
      const left = roundTrip(a),
        right = roundTrip(b);
      expect(left.model?.revision).toBe(right.model?.revision);
      expect(left.model?.evidence).toEqual(right.model?.evidence);
      expect(left.model?.engagement).not.toEqual(right.model?.engagement);
      a.send({ type: "PREVIOUS" });
      const previous = roundTrip(a);
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      select(a, "C04-S02-B");
      expect(roundTrip(a)).toEqual(previous);
      a.send({ type: "CLOSE_SUPPORT" });
      advance(a);
      expect(roundTrip(a)).toEqual(left);
      expect(() =>
        validateC04CheckpointV1({
          ...left,
          model: { ...left.model, revision: 0 },
        }),
      ).toThrow();
      expect(() =>
        validateC04CheckpointV1({
          ...left,
          model: {
            ...left.model,
            evidence: { ...left.model!.evidence, selectedChildId: "made-up" },
          },
        }),
      ).toThrow();
    } finally {
      a.stop();
      b.stop();
    }
  });
  it("withholds unauthorized retained actor drafts", () => {
    const actor = active("C04-A01");
    try {
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({ unauthorized: boundary }),
      });
      expect(() => projectC04CheckpointV1(actor)).toThrow();
    } finally {
      actor.stop();
    }
  });
  it("rejects sparse/decorated arrays, hidden fields, cycles and class-like DTOs", () => {
    const actor = active("C04-A01");
    try {
      submit(actor);
      const data = roundTrip(actor);
      const sparse = new Array(1);
      Object.defineProperty(sparse, "extra", {
        value: data.response!.parts[0],
        enumerable: true,
      });
      expect(() =>
        validateC04CheckpointV1({
          ...data,
          response: { ...data.response, parts: sparse },
        }),
      ).toThrow();
      const hidden = Object.defineProperty({ ...data }, Symbol("hidden"), {
        value: true,
      });
      expect(() => validateC04CheckpointV1(hidden)).toThrow();
      const cycle: Record<string, unknown> = { ...data };
      cycle.self = cycle;
      expect(() => validateC04CheckpointV1(cycle)).toThrow();
      const getter = Object.defineProperty({ ...data }, "position", {
        enumerable: true,
        get() {
          throw new Error("invoked");
        },
      });
      expect(() => validateC04CheckpointV1(getter)).toThrow(
        "Non-data checkpoint property",
      );
    } finally {
      actor.stop();
    }
  });
  it("retains A04 first commitment across return, edit and recommit", () => {
    const actor = active("C04-A04");
    try {
      submit(actor, true);
      const first = roundTrip(actor).staging!.firstPrimaryCommitment;
      actor.send({ type: "RETURN_TO_PRIMARY" });
      const returned = roundTrip(actor);
      expect(returned.staging!.firstPrimaryCommitment).toEqual(first);
      expect(returned.staging!.currentPrimaryCommitment).toBeNull();
      actor.send({
        type: "RESPONSE_CHANGED",
        response: composite({
          difference: money("1500"),
          percentage: boundary,
        }),
      });
      roundTrip(actor);
      actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      const recommitted = roundTrip(actor);
      expect(recommitted.staging!.commitmentSequence).toBe(2);
      expect(recommitted.staging!.firstPrimaryCommitment).toEqual(first);
      expect(
        recommitted.staging!.currentPrimaryCommitment!
          .reasoningPreviouslyExposed,
      ).toBe(true);
      const primary = recommitted.response!;
      expect(() =>
        validateC04CheckpointV1({
          ...recommitted,
          response: {
            ...primary,
            parts: primary.parts.map((part) =>
              part.key === "difference"
                ? {
                    ...part,
                    response: {
                      kind: "EXACT_QUANTITY",
                      value: {
                        magnitude: "999",
                        kind: "MONETARY_AMOUNT",
                        unit: "PHP",
                        basis: "per month",
                      },
                    },
                  }
                : part,
            ),
          },
        }),
      ).toThrow();
    } finally {
      actor.stop();
    }
  });
});

describe("T029 partial-response authority dependency check", () => {
  it.each(["C04-A01", "C04-A03"])(
    "%s retains partial responses but exposes no source partial-membership validator",
    (id) => {
      const actor = createC04ActivityActor(id).start();
      try {
        actor.send({ type: "CONTINUE" });
        const binding = createC04ActivityRegistry().resolve(id);
        const partial = {
          kind: "COMPOSITE" as const,
          parts: [
            {
              key: "difference",
              response: {
                kind: "SEMANTIC_BOUNDARY" as const,
                resolution: {
                  kind: "UNKNOWN" as const,
                  reason: "Not entered yet",
                },
              },
            },
          ],
        };
        const unknownField = {
          ...partial,
          parts: [{ ...partial.parts[0]!, key: "not-a-source-response-field" }],
        };
        const wrongKind = {
          kind: "COMPOSITE" as const,
          parts: [
            {
              key: "difference",
              response: {
                kind: "SINGLE_SELECTION" as const,
                selectionId: "not-a-quantity",
              },
            },
          ],
        };
        // ready conflates missing required fields with unauthorized supplied data.
        for (const response of [partial, unknownField, wrongKind]) {
          expect(binding.ports.ready(response)).toBe(false);
          const revision = actor.getSnapshot().context.responseRevision;
          actor.send({ type: "RESPONSE_CHANGED", response });
          expect(actor.getSnapshot().context.response).toEqual(response);
          expect(actor.getSnapshot().context.responseRevision).toBe(
            revision + 1,
          );
          actor.send({ type: "CHECK_RESPONSE" });
          expect(actor.getSnapshot().context.checkedResponse).toBeNull();
        }
        expect(binding.definition.responseStages).toBeUndefined();
        expect(Object.keys(binding.ports).sort()).toEqual([
          "completionEligible",
          "evaluate",
          "informationNeeded",
          "informationReturn",
          "ready",
          "sourceReviewAvailable",
        ]);
        // Presentation controls are not the missing persisted-response authority.
        const control = composeC04ActivityFrame(actor).responseControls!.find(
          (item) => item.role === "difference",
        )!;
        expect(Object.keys(control).sort()).toEqual(["acceptedKinds", "role"]);
        expect(control).not.toHaveProperty("required");
        expect(control).not.toHaveProperty("quantityKind");
        expect(control).not.toHaveProperty("unit");
        expect(control).not.toHaveProperty("basis");
      } finally {
        actor.stop();
      }
    },
  );
});

describe("T029 public-boundary characterization, not checkpoint acceptance", () => {
  it("resolves the source alias and reads all four real C04 actors", () => {
    for (const id of ["C04-A01", "C04-A02", "C04-A03", "C04-A04"]) {
      const actor = createC04ActivityActor(id).start();
      try {
        expect(composeC04ActivityFrame(actor).activityId).toBe(id);
        expect(actor.getSnapshot().context.position).toBe("ENTRY");
      } finally {
        actor.stop();
      }
    }
  });

  it("retains opaque model state without exposing a model-owned serialization port", () => {
    const binding = createC04ActivityBindings().find(
      (item) => item.activityId === "C04-A02",
    )!;
    expect(Object.keys(binding.modelAdapter!).sort()).toEqual([
      "initialize",
      "select",
    ]);
    const actor = createC04ActivityActor("C04-A02").start();
    try {
      expect(actor.getSnapshot().context.model?.value.state).toBeDefined();
      expect(
        composeC04ActivityFrame(actor).modelSelectionControl,
      ).toBeUndefined();
      actor.send({ type: "CONTINUE" });
      actor.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(actor.getSnapshot().context.origin).toBe("EXP-01");
      expect(
        composeC04ActivityFrame(actor).modelSelectionControl,
      ).toBeUndefined();
    } finally {
      actor.stop();
    }
  });
});

describe("D044/S1 real source actor evidence and remaining identity boundary", () => {
  const start = () => createC04ActivityActor("C04-A02").start();
  const advance = (actor: ReturnType<typeof start>, count = 1) => {
    for (let i = 0; i < count; i++) actor.send({ type: "CONTINUE" });
  };
  const select = (actor: ReturnType<typeof start>, selectionId: string) => {
    const c = actor.getSnapshot().context;
    actor.send({
      type: "SELECT_MODEL_CHILD",
      modelId: c.model!.modelId,
      revision: c.model!.revision,
      position: c.position,
      selectionId,
    });
  };

  it("distinguishes the two original histories through the existing public snapshot", () => {
    const a = start(),
      b = start();
    try {
      advance(a, 2);
      advance(b, 2);
      select(a, "C04-S02-A");
      advance(a);
      advance(b);
      select(a, "C04-S02-B");
      select(b, "C04-S02-B");
      select(b, "C04-S02-B");
      advance(a);
      advance(b);
      const left = a.getSnapshot().context,
        right = b.getSnapshot().context;
      expect(left.position).toBe("EXP-04");
      expect(right.position).toBe(left.position);
      expect(left.model!.revision).toBe(2);
      expect(right.model!.revision).toBe(left.model!.revision);
      expect(projectC04CheckpointModelV1(left.model!.value.state)).toEqual(
        projectC04CheckpointModelV1(right.model!.value.state),
      );
      expect(left.c04A02StageEngagement).not.toEqual(
        right.c04A02StageEngagement,
      );
      expect(JSON.parse(JSON.stringify(left.c04A02StageEngagement))).toEqual(
        left.c04A02StageEngagement,
      );
      expect(left.c04A02StageEngagement!["EXP-02"]["C04-S02-A"]).toBe(true);
      expect(right.c04A02StageEngagement!["EXP-02"]["C04-S02-A"]).toBe(false);
    } finally {
      a.stop();
      b.stop();
    }
  });

  it("real Review rejects selection and preserves authentic presence across Previous/re-entry", () => {
    const a = start();
    try {
      expect(a.getSnapshot().context.c04A02StageEngagement).toEqual({
        "EXP-02": { "C04-S02-A": false },
        "EXP-03": { "C04-S02-B": false },
      });
      advance(a, 2);
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      select(a, "C04-S02-A");
      expect(a.getSnapshot().context.model!.revision).toBe(0);
      a.send({ type: "CLOSE_SUPPORT" });
      select(a, "C04-S02-A");
      const saved = a.getSnapshot().context.c04A02StageEngagement;
      a.send({ type: "PREVIOUS" });
      advance(a);
      expect(a.getSnapshot().context.c04A02StageEngagement).toEqual(saved);
      expect(Object.isFrozen(saved)).toBe(true);
      expect(Object.isFrozen(saved!["EXP-02"])).toBe(true);
      expect(Object.isFrozen(saved!["EXP-03"])).toBe(true);
    } finally {
      a.stop();
    }
  });

  it.each(["C04-A01", "C04-A03"])(
    "characterizes missing public scenario identity for %s (not checkpoint acceptance)",
    (id) => {
      const a = createC04ActivityActor(id).start();
      try {
        const binding = createC04ActivityRegistry().resolve(id);
        expect(Object.keys(binding).sort()).toEqual([
          "activityId",
          "definition",
          "ports",
        ]);
        expect(binding.definition.modelSelection).toBeUndefined();
        expect(binding.definition.responseStages).toBeUndefined();
        expect(Object.keys(binding.definition).sort()).toEqual([
          "activityId",
          "edges",
          "support",
        ]);
        expect(a.getSnapshot().context).not.toHaveProperty("scenarioId");
        expect(a.getSnapshot().context.model).toBeUndefined();
        expect(composeC04ActivityFrame(a)).not.toHaveProperty("scenarioId");
        expect(
          Object.values(binding.ports).every(
            (port) => typeof port === "function",
          ),
        ).toBe(true);
        expect(() =>
          projectC04CheckpointModelV1({
            activityId: id,
            scenarioId: id.replace("-A", "-S"),
          }),
        ).toThrow(TypeError);
        expect(a.getSnapshot().context).not.toHaveProperty(
          "c04A02StageEngagement",
        );
      } finally {
        a.stop();
      }
    },
  );
});
