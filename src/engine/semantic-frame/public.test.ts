import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { createActivityMachine } from "../activity-machine/public";
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityPorts,
} from "../activity-machine/public";
import { projectSemanticActivityFrame } from "./public";
import type { FrameContent, FrameInput } from "./public";
import { ExactDecimal, quantity } from "../../core/public";
import type { LearnerResponse } from "../../core/public";

// Synthetic enforcement fixtures, NOT authenticated fixed-bank composition.
const id = "C04-A03" as const;
const response = {
  kind: "SINGLE_SELECTION",
  selectionId: "learner-choice",
} as const;
const definition: ActivityDefinition = {
  activityId: id,
  edges: { ENTRY: { CONTINUE: "ACTIVE" }, ACTIVE: {}, INFO_NEEDED: {} },
  support: {
    ACTIVE: ["REVIEW"],
    CONFIRMATION: ["REVIEW"],
    RECONSIDERATION: ["REVIEW"],
    COMPLETE: [],
  },
};
const ports: ActivityPorts = {
  ready: () => true,
  evaluate: () => ({ outcome: "CONFIRMED", diagnostic: null }),
  completionEligible: () => true,
  sourceReviewAvailable: () => false,
  informationNeeded: () => false,
  informationReturn: () => false,
};
const secret = "SECRET_CORRECT_MINUS_TEN_PERCENT";
const content: FrameContent = {
  responseContract: { id: "choice", text: "Select a direction" },
  references: [
    {
      content: { id: "prompt", text: "Original and New" },
      phases: ["ACTIVE", "RECONSIDERATION", "CONFIRMATION"],
      timing: "PUBLIC",
    },
  ],
  modelFacts: [
    {
      content: { id: "original", text: "Original 30000" },
      phases: ["ACTIVE"],
      timing: "PUBLIC",
    },
  ],
  derivedFacts: [
    {
      content: { id: "answer", text: secret, metadata: { secret } } as never,
      phases: ["ACTIVE", "CONFIRMATION", "RECONSIDERATION"],
      timing: "EXPLICIT_REVEAL",
      revealRevision: 3,
    },
    {
      content: { id: "other", text: "OTHER_SECRET" },
      phases: ["CONFIRMATION", "RECONSIDERATION"],
      timing: "EXPLICIT_REVEAL",
      revealRevision: 99,
    },
  ],
  feedback: {
    outcome: "CONFIRMED",
    revision: 3,
    content: { id: "feedback", text: "Consider the relationship" },
  },
  review: {
    receivingActivityId: id,
    invokingPhase: "ACTIVE",
    relationships: [{ id: "principle", text: "Original is the reference" }],
  },
};
function input(
  overrides: Partial<ActivityContext> = {},
  phase: ActivityContext["position"] = "ACTIVE",
  support: FrameInput["support"] = "NONE",
  source: FrameContent = content,
): FrameInput {
  return {
    definition,
    ports,
    content: source,
    phase,
    support,
    context: {
      activityId: id,
      position: phase,
      origin: support === "NONE" ? null : phase,
      infoOrigin: null,
      response,
      checkedResponse: null,
      responseRevision: 3,
      hasChecked: false,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
      ...overrides,
    },
  };
}
describe("synthetic semantic exposure enforcement", () => {
  it.each(["CONFIRMED", "RECONSIDERATION"] as const)(
    "projects synthetic staged controls and acknowledged terminal teaching for %s without hidden metadata",
    (outcome) => {
      const policy: ActivityDefinition = {
        activityId: "C04-A04",
        edges: {
          ENTRY: { CONTINUE: "ACTIVE" },
          CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
          RECONSIDERATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
        },
        support: {
          ACTIVE: ["REVIEW"],
          POST_CONFIRMATION_EXPLANATION: ["REVIEW"],
        },
        responseStages: {
          contractId: "synthetic-staged",
          version: 1,
          scenarioId: "C04-S04",
          primaryFields: [
            {
              key: "quantity",
              acceptedKinds: ["EXACT_QUANTITY"],
              quantityKind: "MONETARY_AMOUNT",
              unit: "PHP",
              basis: null,
            },
          ],
          reasoningField: "reason",
          optionIds: ["one", "two"],
        },
        terminalTeaching: { outcomes: "BOTH", contentId: "synthetic-teaching" },
      };
      const dependencies: ActivityPorts = {
        ...ports,
        evaluate: () => ({
          outcome,
          diagnostic: outcome === "CONFIRMED" ? null : "RECONSIDER_UNDEFINED",
        }),
      };
      const a = createActor(
        createActivityMachine(policy, dependencies),
      ).start();
      const source: FrameContent = {
        responseContract: {
          id: "synthetic-staged",
          text: "Enter your response",
        },
        modelFacts: [],
        derivedFacts: [],
        references: [
          {
            content: {
              id: "synthetic-teaching",
              text: "HIDDEN_TERMINAL_TRUTH",
            },
            phases: ["ACTIVE", "POST_CONFIRMATION_EXPLANATION"],
            timing: "PUBLIC",
          },
        ],
        responseControls: [
          {
            activityId: "C04-A04",
            contractId: "synthetic-staged",
            version: 1,
            stage: "PRIMARY",
            controls: [{ role: "quantity", acceptedKinds: ["EXACT_QUANTITY"] }],
          },
          {
            activityId: "C04-A04",
            contractId: "synthetic-staged",
            version: 1,
            stage: "REASONING",
            controls: [
              {
                role: "reason",
                acceptedKinds: ["SINGLE_SELECTION"],
                options: [
                  { id: "one", text: "SYNTHETIC_REASON_ONE" },
                  { id: "two", text: "SYNTHETIC_REASON_TWO" },
                ],
              },
            ],
          },
        ],
      };
      const frame = (content = source) =>
        projectSemanticActivityFrame({
          definition: policy,
          ports: dependencies,
          content,
          context: a.getSnapshot().context,
          phase: a.getSnapshot().context.position,
          support: a.getSnapshot().context.origin ? "REVIEW" : "NONE",
        });
      a.send({ type: "CONTINUE" });
      expect(frame().responseStage).toBe("PRIMARY");
      expect(frame().responseControls?.map((control) => control.role)).toEqual([
        "quantity",
      ]);
      expect(JSON.stringify(frame())).not.toMatch(
        /SYNTHETIC_REASON|HIDDEN_TERMINAL_TRUTH|correctId|primaryCommitment/,
      );
      expect(frame().allowedLearnerIntents).not.toContain(
        "COMMIT_PRIMARY_RESPONSE",
      );
      const primary: LearnerResponse = {
        kind: "COMPOSITE",
        parts: [
          {
            key: "quantity",
            response: {
              kind: "EXACT_QUANTITY",
              value: quantity(
                ExactDecimal.from("7"),
                "MONETARY_AMOUNT",
                "PHP",
                null,
              ),
            },
          },
        ],
      };
      a.send({ type: "RESPONSE_CHANGED", response: primary });
      expect(frame().allowedLearnerIntents).toContain(
        "COMMIT_PRIMARY_RESPONSE",
      );
      expect(frame().allowedLearnerIntents).not.toContain("CHECK_RESPONSE");
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(frame().responseControls).toEqual([]);
      expect(frame().allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
      a.send({ type: "CLOSE_SUPPORT" });
      a.send({ type: "COMMIT_PRIMARY_RESPONSE" });
      expect(frame().responseStage).toBe("REASONING");
      expect(frame().responseControls?.map((control) => control.role)).toEqual([
        "reason",
      ]);
      expect(frame().allowedLearnerIntents).toContain("RETURN_TO_PRIMARY");
      expect(frame().allowedLearnerIntents).not.toContain("CHECK_RESPONSE");
      const bad = structuredClone(source);
      Object.assign(bad.responseControls![1]!.controls[0]!, {
        correctId: "one",
      });
      expect(() => frame(bad)).toThrow();
      const wrongVersion = structuredClone(source);
      Object.assign(wrongVersion.responseControls![1]!, { version: 2 });
      expect(() => frame(wrongVersion)).toThrow();
      const forged = {
        ...a.getSnapshot().context,
        currentPrimaryCommitment: {
          ...a.getSnapshot().context.currentPrimaryCommitment!,
          version: 99,
        },
      };
      expect(() =>
        projectSemanticActivityFrame({
          definition: policy,
          ports: dependencies,
          content: source,
          context: forged,
          phase: "ACTIVE",
          support: "NONE",
        }),
      ).toThrow();
      a.send({
        type: "RESPONSE_CHANGED",
        response: {
          kind: "COMPOSITE",
          parts: [
            ...(primary.kind === "COMPOSITE" ? primary.parts : []),
            {
              key: "reason",
              response: { kind: "SINGLE_SELECTION", selectionId: "two" },
            },
          ],
        },
      });
      expect(frame().allowedLearnerIntents).toContain("CHECK_RESPONSE");
      a.send({ type: "CHECK_RESPONSE" });
      expect(frame().allowedLearnerIntents).not.toContain("CONTINUE");
      const revision = a.getSnapshot().context.responseRevision;
      a.send({ type: "FEEDBACK_DELIVERED", revision });
      expect(frame().allowedLearnerIntents).toContain("CONTINUE");
      expect(frame().completionActionAvailability).toBe(false);
      a.send({ type: "CONTINUE" });
      const deliveredSource: FrameContent = {
        ...source,
        references: [
          {
            content: {
              id: "synthetic-teaching",
              text: "HIDDEN_TERMINAL_TRUTH",
            },
            phases: ["POST_CONFIRMATION_EXPLANATION"],
            timing: "CURRENT_FEEDBACK",
          },
        ],
        feedback: {
          outcome,
          revision,
          content: {
            id: "synthetic-feedback",
            text: "Delivered current feedback",
          },
        },
        review: {
          receivingActivityId: "C04-A04",
          invokingPhase: "POST_CONFIRMATION_EXPLANATION",
          relationships: [
            { id: "principle", text: "Approved synthetic relationship" },
          ],
        },
      };
      expect(frame(deliveredSource).contentReferences).toEqual([
        { id: "synthetic-teaching", text: "HIDDEN_TERMINAL_TRUTH" },
      ]);
      expect(frame(deliveredSource).feedbackState?.outcome).toBe(outcome);
      expect(frame(deliveredSource).completionActionAvailability).toBe(false);
      expect(a.getSnapshot().context.terminalTeachingRevision).toBeNull();
      a.send({ type: "OPEN_SUPPORT", mode: "REVIEW" });
      expect(frame(deliveredSource).review?.returnTo).toBe(
        "POST_CONFIRMATION_EXPLANATION",
      );
      expect(frame(deliveredSource).responseControls).toEqual([]);
      a.send({ type: "CLOSE_SUPPORT" });
      // Explicit test simulation of trusted delivery, never projector side effect.
      a.send({
        type: "TERMINAL_TEACHING_DELIVERED",
        revision,
        contentId: "synthetic-teaching",
      });
      expect(frame(deliveredSource).allowedLearnerIntents).toContain(
        "FINISH_ACTIVITY",
      );
      expect(JSON.stringify(frame(deliveredSource))).not.toMatch(
        /correctId|Commitment|diagnostic|"magnitude"/,
      );
      const stale = { ...a.getSnapshot().context, feedbackRevision: null };
      expect(() =>
        projectSemanticActivityFrame({
          definition: policy,
          ports: dependencies,
          content: deliveredSource,
          context: stale,
          phase: "POST_CONFIRMATION_EXPLANATION",
          support: "NONE",
        }),
      ).toThrow();
      a.stop();
    },
  );
  it("projects only current confirmed post-confirmation continuation and phase-gated synthetic content", () => {
    const route: ActivityDefinition = {
      ...definition,
      edges: {
        ...definition.edges,
        CONFIRMATION: { CONTINUE: "POST_CONFIRMATION_EXPLANATION" },
      },
      support: {
        ...definition.support,
        POST_CONFIRMATION_EXPLANATION: ["REVIEW"],
      },
    };
    const explanation = "SYNTHETIC_UNDEFINED_RESULT_EXPLANATION";
    const source: FrameContent = {
      ...content,
      references: [
        ...content.references,
        {
          content: { id: "c04/S04/undefined-result", text: explanation },
          phases: ["POST_CONFIRMATION_EXPLANATION"],
          timing: "CURRENT_FEEDBACK",
        },
      ],
      derivedFacts: [
        {
          content: { id: "synthetic-answer", text: "SYNTHETIC_BOUNDARY" },
          phases: ["POST_CONFIRMATION_EXPLANATION"],
          timing: "CURRENT_FEEDBACK",
        },
        {
          content: { id: "unrelated", text: "UNRELATED_SECRET" },
          phases: ["ACTIVE"],
          timing: "PUBLIC",
        },
      ],
      review: {
        receivingActivityId: id,
        invokingPhase: "POST_CONFIRMATION_EXPLANATION",
        relationships: [
          { id: "synthetic-relation", text: "Synthetic reference" },
        ],
      },
    };
    const checked: Partial<ActivityContext> = {
      hasChecked: true,
      checkedRevision: 3,
      feedbackRevision: 3,
      evaluation: { outcome: "CONFIRMED", diagnostic: "PRIVATE_DIAGNOSTIC" },
    };
    const frame = (
      phase: ActivityContext["position"],
      evidence = checked,
      support: FrameInput["support"] = "NONE",
      selected = route,
    ) =>
      projectSemanticActivityFrame({
        ...input(evidence, phase, support, source),
        definition: selected,
      });
    const before = frame("ACTIVE", {});
    const confirmation = frame("CONFIRMATION");
    expect(before.allowedLearnerIntents).not.toContain("CONTINUE");
    expect(confirmation.allowedLearnerIntents).toContain("CONTINUE");
    expect(confirmation.allowedLearnerIntents).not.toContain("FINISH_ACTIVITY");
    for (const result of [
      before,
      confirmation,
      frame("CONFIRMATION", { ...checked, feedbackRevision: null }),
    ]) {
      expect(JSON.stringify(result)).not.toContain(explanation);
      expect(JSON.stringify(result)).not.toContain("SYNTHETIC_BOUNDARY");
    }
    expect(
      frame("CONFIRMATION", { ...checked, feedbackRevision: null })
        .allowedLearnerIntents,
    ).not.toContain("CONTINUE");
    for (const evidence of [
      { ...checked, checkedRevision: 2 },
      { ...checked, responseRevision: 4 },
      { ...checked, evaluation: null },
      { ...checked, hasChecked: false },
    ]) {
      expect(
        frame("CONFIRMATION", evidence).allowedLearnerIntents,
      ).not.toContain("CONTINUE");
      expect(
        frame("POST_CONFIRMATION_EXPLANATION", evidence).contentReferences,
      ).toEqual([]);
    }
    const explained = frame("POST_CONFIRMATION_EXPLANATION");
    expect(explained.contentReferences).toContainEqual({
      id: "c04/S04/undefined-result",
      text: explanation,
    });
    expect(explained.allowedLearnerIntents).toContain("FINISH_ACTIVITY");
    expect(explained.allowedLearnerIntents).not.toContain("CONTINUE");
    expect(explained.reviewAvailability).toBe(true);
    expect(explained.sourceReviewAvailability).toBe(false);
    expect(JSON.stringify(explained)).not.toContain("UNRELATED_SECRET");
    expect(JSON.stringify(explained)).not.toContain("PRIVATE_DIAGNOSTIC");
    expect(explained).not.toHaveProperty("context");
    const stale = frame("POST_CONFIRMATION_EXPLANATION", {
      ...checked,
      feedbackRevision: null,
    });
    expect(stale.contentReferences).toEqual([]);
    expect(stale.exposedDerivedFacts).toEqual([]);
    expect(stale.completionActionAvailability).toBe(false);
    const review = frame("POST_CONFIRMATION_EXPLANATION", checked, "REVIEW");
    expect(review.stateId).toBe("REVIEW[POST_CONFIRMATION_EXPLANATION]");
    expect(review.review?.returnTo).toBe("POST_CONFIRMATION_EXPLANATION");
    expect(review.allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
    expect(
      frame("POST_CONFIRMATION_EXPLANATION", checked, "NONE", {
        ...route,
        support: { ACTIVE: ["REVIEW"] },
      }).reviewAvailability,
    ).toBe(false);
    expect(() =>
      frame("POST_CONFIRMATION_EXPLANATION", checked, "NONE", definition),
    ).toThrow();
    expect(source.references[1]?.content.text).toBe(explanation);
  });
  it("omits hidden answers, nested metadata, diagnostics and stale evidence before check and during support", () => {
    for (const data of [
      input(),
      input({ responseRevision: 5 }),
      input({}, "ACTIVE", "REVIEW"),
      input(
        {
          hasChecked: true,
          checkedRevision: 2,
          feedbackRevision: 2,
          evaluation: { outcome: "CONFIRMED", diagnostic: null },
        },
        "CONFIRMATION",
      ),
    ]) {
      const frame = projectSemanticActivityFrame(data);
      expect(JSON.stringify(frame)).not.toContain(secret);
      expect(JSON.stringify(frame)).not.toContain("OTHER_SECRET");
      expect(JSON.stringify(frame)).not.toContain("metadata");
      expect(frame.exposedDerivedFacts).toEqual([]);
      expect(frame).not.toHaveProperty("context");
      expect(frame).not.toHaveProperty("evaluation");
    }
  });
  it("checks first after repeated edits, rechecks only after actual check, finishes on both outcomes only with current feedback", () => {
    expect(
      projectSemanticActivityFrame(input()).allowedLearnerIntents,
    ).toContain("CHECK_RESPONSE");
    expect(
      projectSemanticActivityFrame(input()).allowedLearnerIntents,
    ).not.toContain("CHECK_AGAIN");
    expect(
      projectSemanticActivityFrame(input({ hasChecked: true }, "REVISION"))
        .allowedLearnerIntents,
    ).toContain("CHECK_AGAIN");
    for (const outcome of ["CONFIRMED", "RECONSIDERATION"] as const) {
      const phase =
        outcome === "CONFIRMED" ? "CONFIRMATION" : "RECONSIDERATION";
      const checked = input(
        {
          hasChecked: true,
          checkedRevision: 3,
          feedbackRevision: 3,
          evaluation: {
            outcome,
            diagnostic: outcome === "CONFIRMED" ? null : "PRIVATE_DIAGNOSTIC",
          },
        },
        phase,
      );
      const frame = projectSemanticActivityFrame(checked);
      expect(frame.completionActionAvailability).toBe(true);
      expect(frame.allowedLearnerIntents).toContain("FINISH_ACTIVITY");
      expect(JSON.stringify(frame)).not.toContain("PRIVATE_DIAGNOSTIC");
      expect(frame.exposedDerivedFacts).toEqual([
        { id: "answer", text: secret },
      ]);
      expect(JSON.stringify(frame)).not.toContain("OTHER_SECRET");
      expect(
        projectSemanticActivityFrame(
          input({ ...checked.context, feedbackRevision: null }, phase),
        ).completionActionAvailability,
      ).toBe(false);
      expect(
        projectSemanticActivityFrame(
          input({ ...checked.context, responseRevision: 4 }, phase),
        ).exposedDerivedFacts,
      ).toEqual([]);
    }
  });
  it("support blocks underlying actions; COMPLETE does not inherit ACTIVE Review", () => {
    const support = projectSemanticActivityFrame(input({}, "ACTIVE", "REVIEW"));
    expect(support.allowedLearnerIntents).toEqual(["CLOSE_SUPPORT"]);
    expect(support.review?.returnTo).toBe("ACTIVE");
    expect(
      projectSemanticActivityFrame(input({}, "COMPLETE")).reviewAvailability,
    ).toBe(false);
  });
  it("copies and freezes nested output, ignores injected extra properties and does not mutate inputs", () => {
    const frame = projectSemanticActivityFrame(input());
    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.exposedModelFacts[0])).toBe(true);
    expect(Object.isFrozen(frame.allowedLearnerIntents)).toBe(true);
    expect(() =>
      Object.assign(frame.exposedModelFacts[0]!, { text: secret }),
    ).toThrow();
    expect(() =>
      (frame.allowedLearnerIntents as string[]).push("FINISH_ACTIVITY"),
    ).toThrow();
    expect(content.modelFacts[0]!.content.text).toBe("Original 30000");
    expect(() =>
      projectSemanticActivityFrame({
        ...input(),
        phase: "UNKNOWN" as "ACTIVE",
      }),
    ).toThrow("Invalid semantic projection input");
  });
});
