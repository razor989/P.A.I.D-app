import { describe, expect, it, vi } from "vitest";
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
  createCanonicalC04Runtime,
  isCanonicalC04Runtime,
  composeC04ActivityFrame,
  createC04ActivityActor,
  createC04RestoredActivityActor,
  createC04ActivityBindings,
  createC04ActivityRegistry,
  projectC04CheckpointModelV1,
  validateC04CheckpointModelV1,
  projectC04CheckpointIdentity,
  validateC04PartialResponseV1,
} from "./public";
import type { C04Restoration } from "./public";

describe("T035 canonical runtime issuance", () => {
  it("authenticates exact issuance, not copies, prototypes, proxies or factories", () => {
    const runtime = createCanonicalC04Runtime();
    expect(isCanonicalC04Runtime(runtime)).toBe(true);
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(runtime.registry)).toBe(true);
    for (const value of [
      null,
      undefined,
      {},
      { ...runtime },
      Object.create(runtime) as unknown,
      new Proxy(runtime, {}),
      () => runtime,
    ])
      expect(isCanonicalC04Runtime(value)).toBe(false);
  });
  it("retains the exact public binding identities and issues independent unstarted actors", () => {
    const runtime = createCanonicalC04Runtime();
    const other = createCanonicalC04Runtime();
    expect(other.registry).not.toBe(runtime.registry);
    const registry = runtime.registry;
    const resolve = vi.spyOn(
      Object.getPrototypeOf(registry) as typeof registry,
      "resolve",
    );
    for (const id of ["C04-A01", "C04-A02", "C04-A03", "C04-A04"]) {
      const binding = registry.resolve(id);
      const a = runtime.createActivityActor(id);
      const b = runtime.createActivityActor(id);
      expect(a).not.toBe(b);
      expect(a.getSnapshot().context.activityId).toBe(id);
      expect(resolve.mock.contexts).toContain(registry);
      expect(Object.keys(a.getSnapshot().children)).toEqual([]);
      const notifications: unknown[] = [];
      const sub = a.subscribe((snapshot) => notifications.push(snapshot));
      expect(notifications).toEqual([]);
      a.start();
      expect(notifications.length).toBeGreaterThan(0);
      a.send({ type: "CONTINUE" });
      expect(b.getSnapshot().context.position).toBe("ENTRY");
      expect(runtime.registry).toBe(registry);
      expect(registry.resolve(id)).toBe(binding);
      sub.unsubscribe();
      a.stop();
      b.stop();
    }
  });
  it.each(["C01-A01", "C04-A05", "C04-S01", "c04-a01", null, {}, 1])(
    "rejects unsupported id %s",
    (id) => {
      expect(() =>
        createCanonicalC04Runtime().createActivityActor(id),
      ).toThrow();
    },
  );
});

describe("D061/S3 source-authenticated reissuance", () => {
  it.each(["C04-S02-A", "C04-S02-B"] as const)(
    "reissues independent %s with no new learner engagement",
    (child) => {
      const fresh = createC04ActivityActor("C04-A02");
      const c = fresh.getSnapshot().context;
      const input: C04Restoration = {
        scenarioId: "C04-S02",
        context: {
          ...c,
          position: "ACTIVE",
          model: { revision: 2, value: { selectionId: child, state: null } },
        },
        modelEvidence: {
          activityId: "C04-A02",
          scenarioId: "C04-S02",
          selectedChildId: child,
        },
      };
      const left = createC04RestoredActivityActor(input),
        right = createC04RestoredActivityActor(input);
      const lm = left.getSnapshot().context.model!,
        rm = right.getSnapshot().context.model!;
      expect(lm.value.state).not.toBe(rm.value.state);
      expect(projectC04CheckpointModelV1(lm.value.state)).toEqual(
        input.modelEvidence,
      );
      expect(deriveC04ModelState(lm.value.state as C04ModelState)).toEqual(
        deriveC04ModelState(rm.value.state as C04ModelState),
      );
      expect(left.getSnapshot().context.c04A02StageEngagement).toEqual(
        c.c04A02StageEngagement,
      );
      expect(left.getSnapshot().context.responseRevision).toBe(0);
      expect(() =>
        createC04RestoredActivityActor({
          ...input,
          context: {
            ...input.context,
            model: {
              revision: 0,
              value: { selectionId: "C04-S02-B", state: null },
            },
          },
          modelEvidence: {
            activityId: "C04-A02",
            scenarioId: "C04-S02",
            selectedChildId: "C04-S02-B",
          },
        }),
      ).toThrow();
      expect(() =>
        createC04RestoredActivityActor({
          ...input,
          context: c as unknown as C04Restoration["context"],
        }),
      ).toThrow();
      const before = left.getSnapshot().context;
      Object.assign(input.context, { responseRevision: 999 });
      expect(left.getSnapshot().context).toBe(before);
      expect(before.responseRevision).toBe(0);
      for (const actor of [fresh, left, right]) actor.stop();
    },
  );
});

describe("D061/S2 identity and D019/S1 supplied-response membership", () => {
  it.each(c04Activities)(
    "projects immutable canonical identity for $id",
    (activity) => {
      const descriptor = projectC04CheckpointIdentity(activity.id);
      expect(descriptor).toEqual({
        activityId: activity.id,
        scenarioId: activity.scenarioIds[0],
      });
      expect(Object.keys(descriptor).sort()).toEqual([
        "activityId",
        "scenarioId",
      ]);
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(projectC04CheckpointIdentity(activity.id)).not.toBe(descriptor);
      expect(
        createC04ActivityRegistry().resolve(activity.id).definition.activityId,
      ).toBe(activity.id);
    },
  );
  it.each([null, undefined, 1, {}, "C05-A01", " C04-A01", "C04-A99"])(
    "rejects identity %j",
    (id) => {
      expect(() => projectC04CheckpointIdentity(id)).toThrow();
      expect(
        validateC04PartialResponseV1(
          id,
          composite({ difference: boundary }),
          "RESPONSE",
        ),
      ).toBe(false);
    },
  );
  it.each(["C04-A01", "C04-A03"])(
    "separates incomplete/invalid drafts without changing %s actor behavior",
    (id) => {
      const actor = active(id);
      try {
        const binding = createC04ActivityRegistry().resolve(id);
        const valid = composite({ difference: boundary });
        const invalid = [
          composite({ stranger: boundary }),
          composite({
            difference: { kind: "SINGLE_SELECTION", selectionId: "unknown" },
          }),
        ];
        for (const draft of [valid, ...invalid]) {
          expect(validateC04PartialResponseV1(id, draft, "RESPONSE")).toBe(
            draft === valid,
          );
          expect(binding.ports.ready(draft)).toBe(false);
          actor.send({ type: "RESPONSE_CHANGED", response: draft });
          expect(actor.getSnapshot().context.response).toEqual(draft);
        }
      } finally {
        actor.stop();
      }
    },
  );
  it.each(c04ResponseContracts)(
    "validates complete and incorrect responses for $activityId without correctness",
    (contract) => {
      const actor = active(contract.activityId);
      try {
        if (contract.activityId === "C04-A04") {
          actor.send({
            type: "RESPONSE_CHANGED",
            response: composite({
              difference: money("1500"),
              percentage: boundary,
            }),
          });
          actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
        }
        const stage =
          contract.activityId === "C04-A04" ? "REASONING" : "RESPONSE";
        expect(
          validateC04PartialResponseV1(
            contract.activityId,
            response(actor),
            stage,
          ),
        ).toBe(true);
        expect(
          validateC04PartialResponseV1(
            contract.activityId,
            response(actor, true),
            stage,
          ),
        ).toBe(true);
        expect(
          validateC04PartialResponseV1(
            contract.activityId,
            response(actor),
            "bogus",
          ),
        ).toBe(false);
        expect(
          validateC04PartialResponseV1(contract.activityId, null, stage),
        ).toBe(false);
      } finally {
        actor.stop();
      }
    },
  );
  it("rejects quantities, duplicate roles, malformed data, hidden/accessor values and cross-stage choices", () => {
    const id = "C04-A01";
    for (const q of [
      quantity(ExactDecimal.from("1"), "OTHER", "PHP", "per month"),
      quantity(ExactDecimal.from("1"), "MONETARY_AMOUNT", "USD", "per month"),
      quantity(ExactDecimal.from("1"), "MONETARY_AMOUNT", "PHP", null),
    ]) {
      expect(
        validateC04PartialResponseV1(
          id,
          composite({ difference: { kind: "EXACT_QUANTITY", value: q } }),
          "RESPONSE",
        ),
      ).toBe(false);
    }
    const draft = composite({ difference: boundary });
    expect(
      validateC04PartialResponseV1(
        id,
        {
          kind: "COMPOSITE",
          parts: [
            { key: "difference", response: boundary },
            { key: "difference", response: boundary },
          ],
        },
        "RESPONSE",
      ),
    ).toBe(false);
    expect(
      validateC04PartialResponseV1(
        id,
        { kind: "COMPOSITE", parts: [] },
        "RESPONSE",
      ),
    ).toBe(false);
    expect(
      validateC04PartialResponseV1(id, Object.create(draft), "RESPONSE"),
    ).toBe(false);
    const getter = Object.defineProperty({}, "kind", {
      get() {
        throw new Error("must not run");
      },
      enumerable: true,
    });
    expect(validateC04PartialResponseV1(id, getter, "RESPONSE")).toBe(false);
    const choice = composite({
      explanation: {
        kind: "SINGLE_SELECTION",
        selectionId: c04ResponseContracts[3]!.choices[0]!.options[0]!.id,
      },
    });
    expect(validateC04PartialResponseV1("C04-A04", choice, "PRIMARY")).toBe(
      false,
    );
    expect(validateC04PartialResponseV1("C04-A04", choice, "REASONING")).toBe(
      true,
    );
    expect(
      validateC04PartialResponseV1(
        "C04-A04",
        composite({ difference: boundary }),
        "PRIMARY",
      ),
    ).toBe(true);
    expect(validateC04PartialResponseV1(id, choice, "RESPONSE")).toBe(false);
    expect(
      validateC04PartialResponseV1(
        "C04-A04",
        composite({
          explanation: { kind: "SINGLE_SELECTION", selectionId: "forged" },
        }),
        "REASONING",
      ),
    ).toBe(false);
  });
});

describe("D061/S1 source-authenticated checkpoint model facade", () => {
  it("retains the original model-history collision separately from D044/S1 engagement", () => {
    const engaged = createC04ActivityActor("C04-A02").start();
    const skipped = createC04ActivityActor("C04-A02").start();
    try {
      advance(engaged, 2);
      advance(skipped, 2);
      expect(engaged.getSnapshot().context.position).toBe("EXP-02");
      // Only this history performs an employee-A action at EXP-02.
      select(engaged, "C04-S02-A");
      expect(engaged.getSnapshot().context.model!.revision).toBe(1);
      expect(skipped.getSnapshot().context.model!.revision).toBe(0);
      advance(engaged);
      advance(skipped);
      select(engaged, "C04-S02-B");
      // Two permitted employee-B actions at EXP-03 erase the revision distinction.
      select(skipped, "C04-S02-B");
      select(skipped, "C04-S02-B");
      advance(engaged);
      advance(skipped);
      const left = engaged.getSnapshot().context;
      const right = skipped.getSnapshot().context;
      expect(left.position).toBe("EXP-04");
      expect(left.model!.revision).toBe(2);
      expect(left.model).toEqual(right.model);
      expect(left.c04A02StageEngagement).not.toEqual(
        right.c04A02StageEngagement,
      );
      expect(projectC04CheckpointModelV1(left.model!.value.state)).toEqual(
        projectC04CheckpointModelV1(right.model!.value.state),
      );
      // Model evidence still collides; D044/S1 actor evidence now distinguishes it.
      // This is NOT whole-checkpoint preservation acceptance.
    } finally {
      engaged.stop();
      skipped.stop();
    }
  });

  it("reads the exact actor-owned issued state and follows approved selections", () => {
    const actor = createC04ActivityActor("C04-A02").start();
    try {
      const initial = actor.getSnapshot().context.model!.value.state;
      expect(projectC04CheckpointModelV1(initial)).toEqual({
        activityId: "C04-A02",
        scenarioId: "C04-S02",
        selectedChildId: "C04-S02-A",
      });
      advance(actor, 3);
      select(actor, "C04-S02-B");
      const state = actor.getSnapshot().context.model!.value.state;
      const evidence = projectC04CheckpointModelV1(state);
      expect(evidence.selectedChildId).toBe("C04-S02-B");
      expect(projectC04CheckpointModelV1(initial).selectedChildId).toBe(
        "C04-S02-A",
      );
      const parsed: unknown = JSON.parse(JSON.stringify(evidence));
      expect(validateC04CheckpointModelV1(parsed)).toEqual(evidence);
      expect(() => projectC04CheckpointModelV1(parsed)).toThrow(TypeError);
      expect(() => projectC04CheckpointModelV1({ ...evidence })).toThrow(
        TypeError,
      );
      expect(() =>
        projectC04CheckpointModelV1(validateC04CheckpointModelV1(parsed)),
      ).toThrow(TypeError);
      expect(actor.getSnapshot().context.model!.value.state).toBe(state);
    } finally {
      actor.stop();
    }
  });

  it("rejects self-declared identities and extra persisted fields", () => {
    const good = {
      activityId: "C04-A02",
      scenarioId: "C04-S02",
      selectedChildId: "C04-S02-A",
    };
    for (const value of [
      { ...good, activityId: "C04-A04" },
      { ...good, scenarioId: "C04-S04" },
      { ...good, selectedChildId: "C04-S02-C" },
      { ...good, original: "20000" },
      { ...good, revision: 2 },
    ])
      expect(() => validateC04CheckpointModelV1(value)).toThrow(TypeError);
  });
});

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

describe("D6 D139/S1 five-stage instructional fidelity", () => {
  // Source: final C04 C3 §§41,45,48,50,54 (full prose), final §§28–39
  // (stage/interaction authority). Literals deliberately do not read the binding map.
  const passages = [
    "Both employees receive the same increase in pesos. Before thinking about percentages, calculate the absolute change for each salary. Employee A: ₱22,000 − ₱20,000 = ₱2,000. Employee B: ₱12,000 − ₱10,000 = ₱2,000. So the two absolute changes are equal: each salary increased by ₱2,000.00. That does not yet tell us whether the percentage increases are equal.",
    "The Original stays fixed as the reference basis. The ₱22,000.00 New value tells us the ending salary. It does not replace ₱20,000.00 as the reference denominator.",
    "Employee B also gains ₱2,000.00. But this time the Original salary is only ₱10,000.00. The same absolute increase is now compared with a smaller starting reference.",
    "Both employees gained exactly ₱2,000.00. Their absolute increases are equal. But percentage change does not ask only how many pesos changed. It asks how large that change is relative to the Original value. ₱2,000.00 is 10% of ₱20,000.00, but it is 20% of ₱10,000.00. That is why equal peso increases can produce different percentage increases. Absolute Change A = Absolute Change B but Percentage Change A ≠ Percentage Change B because Original A ≠ Original B.",
    "We can now state the full relationship. First find the signed difference: New minus Original. Then compare that difference with the Original value. Finally, multiply by 100 to express the relative change as a percentage. The Original is the reference denominator because percentage change describes change from the starting value.",
  ] as const;
  const dependent = [
    "For Employee A, the ₱2,000.00 increase is measured relative to the Original salary of ₱20,000.00. ₱2,000 ÷ ₱20,000 × 100 = 10%. Employee A’s salary therefore increased by 10% from the Original salary.",
    "₱2,000 ÷ ₱10,000 × 100 = 20%. Employee B’s salary therefore increased by 20% from the Original salary. The important changed element is: Original Reference Basis ₱20,000 → ₱10,000 not the absolute change.",
  ] as const;
  const teachingAt = (a: ActivityActor, stage: string, suffix = "teaching") =>
    frame(a).contentReferences.find(
      (item) => item.id === `c04/S02/${stage}/${suffix}`,
    )?.text;
  const focusFacts = (a: ActivityActor, child: string) =>
    frame(a)
      .exposedModelFacts.filter((item) =>
        item.id.includes(`/authored-focus/${child}/`),
      )
      .map((item) => item.text);
  const consequences = (a: ActivityActor, child: string) =>
    frame(a)
      .exposedDerivedFacts.filter((item) =>
        item.id.includes(`/authored-focus/${child}/`),
      )
      .map((item) => item.text);
  const noAssessment = (a: ActivityActor) => {
    const f = frame(a);
    const encoded = JSON.stringify(f);
    expect(f.feedbackState).toBeUndefined();
    expect(f.responseControls).toEqual([]);
    expect(f.eligibleInstructionalDelivery).toBeUndefined();
    for (const forbidden of [
      "Confirmed.",
      "Activity complete.",
      "c04/S03/",
      "c04/S04/",
      "undefined-result",
      "checkedResponse",
      "correctOption",
      "knownAnswer",
    ])
      expect(encoded).not.toContain(forbidden);
  };
  it.each([1, 2, 3, 4, 5])(
    "EXP-0%s complete canonical prose, stage focus, controls and passive projection boundaries",
    (step) => {
      const a = start("C04-A02");
      try {
        advance(a, step);
        const stage = `EXP-0${step}`;
        expect(a.getSnapshot().context.position).toBe(stage);
        expect(teachingAt(a, stage)).toBe(passages[step - 1]);
        expect(
          frame(a).contentReferences.filter((item) =>
            /\/EXP-\d+\/teaching$/.test(item.id),
          ),
        ).toHaveLength(1);
        const children =
          step === 2
            ? ["C04-S02-A"]
            : step === 3
              ? ["C04-S02-B"]
              : ["C04-S02-A", "C04-S02-B"];
        for (const child of children) {
          const employeeA = child === "C04-S02-A";
          const facts = focusFacts(a, child);
          expect(facts).toHaveLength(2);
          expect(facts[0]).toContain(
            `${employeeA ? "20000" : "10000"} PHP per month`,
          );
          expect(facts[0]).toContain("Original");
          expect(facts[1]).toContain(
            `${employeeA ? "22000" : "12000"} PHP per month`,
          );
          expect(facts[1]).toContain("New");
        }
        const control = frame(a).modelSelectionControl;
        if (step === 2 || step === 3) {
          expect(control?.options.map((item) => item.id)).toEqual(children);
          expect(control?.position).toBe(stage);
          expect(control?.revision).toBe(0);
          expect(
            control?.options.every((item) => item.text.includes("New")),
          ).toBe(true);
          expect(frame(a).exposedDerivedFacts).toEqual([]);
        } else expect(control).toBeUndefined();
        const before = a.getSnapshot().context;
        expect(frame(a)).toEqual(frame(a));
        expect(a.getSnapshot().context).toBe(before);
        expect(before.model?.revision).toBe(0);
        expect(before.c04A02StageEngagement).toEqual({
          "EXP-02": { "C04-S02-A": false },
          "EXP-03": { "C04-S02-B": false },
        });
        noAssessment(a);
        if (step <= 3) expect(JSON.stringify(frame(a))).not.toMatch(/10%|20%/);
        if (step === 1) {
          for (const child of children)
            expect(consequences(a, child)).toEqual([
              "New minus Original: 2000 PHP per month",
            ]);
          expect(JSON.stringify(frame(a))).not.toContain("÷");
        }
      } finally {
        a.stop();
      }
    },
  );
  it.each([
    [2, "C04-S02-A", "C04-S02-B", "20000", "22000", "10", "20", 0],
    [3, "C04-S02-B", "C04-S02-A", "10000", "12000", "20", "10", 1],
  ] as const)(
    "EXP-0%s genuine %s action synchronizes full explanation with issued mathematics",
    (
      step,
      child,
      wrongChild,
      original,
      newValue,
      percentage,
      forbidden,
      index,
    ) => {
      const a = start("C04-A02");
      try {
        advance(a, step);
        const stage = `EXP-0${step}`;
        const initial = a.getSnapshot().context;
        select(a, wrongChild);
        select(a, "25000");
        select(a, child, { revision: 99 });
        expect(a.getSnapshot().context).toBe(initial);
        expect(teachingAt(a, stage, "dependent-teaching")).toBeUndefined();
        select(a, child);
        const c = a.getSnapshot().context;
        expect(c.model?.revision).toBe(1);
        expect(c.c04A02StageEngagement?.[stage as "EXP-02" | "EXP-03"]).toEqual(
          { [child]: true },
        );
        const view = deriveC04ModelState(c.model!.value.state as C04ModelState);
        expect(view.original.value.magnitude.toString()).toBe(original);
        expect(view.newValue.value.magnitude.toString()).toBe(newValue);
        expect(view.change.difference.resolution).toMatchObject({
          kind: "KNOWN",
        });
        if (view.change.difference.resolution.kind === "KNOWN")
          expect(
            view.change.difference.resolution.value.magnitude.toString(),
          ).toBe("2000");
        expect(view.change.percentageChange.resolution.kind).toBe("KNOWN");
        if (view.change.percentageChange.resolution.kind === "KNOWN")
          expect(
            view.change.percentageChange.resolution.value.magnitude.toString(),
          ).toBe(percentage);
        expect(teachingAt(a, stage)).toBe(passages[step - 1]);
        expect(teachingAt(a, stage, "dependent-teaching")).toBe(
          dependent[index],
        );
        expect(consequences(a, child)).toEqual([
          "New minus Original: 2000 PHP per month",
          `Difference relative to Original ${original} PHP per month: ${percentage}%`,
        ]);
        expect(JSON.stringify(frame(a))).not.toContain(`${forbidden}%`);
        noAssessment(a);
      } finally {
        a.stop();
      }
    },
  );
  it.each([4, 5])(
    "EXP-0%s paired causal mathematics and model-linked formalization without fabricated engagement",
    (step) => {
      const a = start("C04-A02");
      try {
        advance(a, step);
        expect(consequences(a, "C04-S02-A")).toEqual([
          "New minus Original: 2000 PHP per month",
          "Difference relative to Original 20000 PHP per month: 10%",
        ]);
        expect(consequences(a, "C04-S02-B")).toEqual([
          "New minus Original: 2000 PHP per month",
          "Difference relative to Original 10000 PHP per month: 20%",
        ]);
        const encoded = JSON.stringify(frame(a));
        expect(encoded).not.toMatch(
          /moved farther|looked longer|salary slider/,
        );
        expect(teachingAt(a, `EXP-0${step}`)).toBe(passages[step - 1]);
        expect(
          frame(a).contentReferences.find(
            (item) => item.id === "c04/S02/formula",
          )?.text,
        ).toBe(
          step === 5
            ? "Percentage Change = (New − Original) ÷ Original × 100"
            : undefined,
        );
        const before = a.getSnapshot().context.model;
        select(a, "C04-S02-B");
        expect(a.getSnapshot().context.model).toBe(before);
        a.send({ type: "PREVIOUS" });
        advance(a);
        expect(teachingAt(a, `EXP-0${step}`)).toBe(passages[step - 1]);
        expect(a.getSnapshot().context.model).toBe(before);
        noAssessment(a);
      } finally {
        a.stop();
      }
    },
  );
});

describe("D6 D139/S1 stage-specific engagement exposure", () => {
  it("EXP-02/EXP-03 Review open/close preserves stage, model, copy and unearned exposure", () => {
    const a = start("C04-A02");
    try {
      advance(a, 2);
      for (const stage of ["EXP-02", "EXP-03"]) {
        expect(a.getSnapshot().context.position).toBe(stage);
        const model = a.getSnapshot().context.model;
        const presence = a.getSnapshot().context.c04A02StageEngagement;
        const before = frame(a);
        a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
        expect(a.getSnapshot().matches({ support: "review" })).toBe(true);
        expect(a.getSnapshot().context.position).toBe(stage);
        expect(a.getSnapshot().context.model).toBe(model);
        expect(a.getSnapshot().context.c04A02StageEngagement).toBe(presence);
        expect(JSON.stringify(frame(a))).not.toMatch(
          /10%|20%|dependent-teaching/,
        );
        a.send({ type: "CLOSE_SUPPORT" });
        expect(frame(a)).toEqual(before);
        advance(a);
      }
    } finally {
      a.stop();
    }
  });
  it("EXP-04 revision-collision histories authorize comparison without inventing independent A engagement", () => {
    const a = start("C04-A02");
    const b = start("C04-A02");
    try {
      advance(a, 2);
      advance(b, 3);
      select(a, "C04-S02-A");
      advance(a);
      select(a, "C04-S02-B");
      select(b, "C04-S02-B");
      select(b, "C04-S02-B");
      advance(a);
      advance(b);
      expect(a.getSnapshot().context.model).toEqual(
        b.getSnapshot().context.model,
      );
      expect(a.getSnapshot().context.model?.revision).toBe(2);
      expect(a.getSnapshot().context.c04A02StageEngagement).toEqual({
        "EXP-02": { "C04-S02-A": true },
        "EXP-03": { "C04-S02-B": true },
      });
      expect(b.getSnapshot().context.c04A02StageEngagement).toEqual({
        "EXP-02": { "C04-S02-A": false },
        "EXP-03": { "C04-S02-B": true },
      });
      for (const actor of [a, b]) {
        expect(JSON.stringify(frame(actor))).toContain("10%");
        expect(JSON.stringify(frame(actor))).toContain("20%");
        actor.send({ type: "PREVIOUS" });
        actor.send({ type: "PREVIOUS" });
        expect(actor.getSnapshot().context.position).toBe("EXP-02");
        expect(JSON.stringify(frame(actor))).not.toMatch(
          /10%|20%|dependent-teaching/,
        );
      }
    } finally {
      a.stop();
      b.stop();
    }
  });
  // D044/S1 §S1.3 and final C04 storyboard §§30–31: navigation is not engagement.
  it.each(["C04-S02-A", "C04-S02-B"] as const)(
    "EXP-02/EXP-03 preserve legal re-entry boundaries for %s history",
    (child) => {
      const a = start("C04-A02");
      try {
        advance(a, child === "C04-S02-A" ? 2 : 3);
        select(a, child);
        expect(a.getSnapshot().context.model?.revision).toBe(1);
        expect(a.getSnapshot().context.model?.value.selectionId).toBe(child);
        const presence = a.getSnapshot().context.c04A02StageEngagement;
        if (child === "C04-S02-A") advance(a);
        else a.send({ type: "PREVIOUS" });
        expect(a.getSnapshot().context.position).toBe(
          child === "C04-S02-A" ? "EXP-03" : "EXP-02",
        );
        const before = a.getSnapshot().context;
        const projected = frame(a);
        expect(a.getSnapshot().context).toBe(before);
        // Scan every public field, including references, facts and controls.
        const encoded = JSON.stringify(projected);
        expect(encoded).not.toContain("dependent-teaching");
        expect(encoded).not.toMatch(/10%|20%/);
        expect(projected.exposedDerivedFacts).toEqual([]);
        expect(a.getSnapshot().context.c04A02StageEngagement).toBe(presence);
      } finally {
        a.stop();
      }
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
