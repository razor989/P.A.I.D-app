import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import { projectC04CheckpointV1, validateC04CheckpointV1 } from "./public";
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
