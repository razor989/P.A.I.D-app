import { describe, expect, it } from "vitest";
import { projectReview, projectSourceReview } from "./public";
import type { SourceReviewAuthorization } from "./public";
import { ExactDecimal, quantity } from "../../core/public";

// Synthetic provider edge; canonical Study graph authentication is downstream.
const provider: SourceReviewAuthorization = {
  mode: "SOURCE_REVIEW",
  receivingActivityId: "C01-A04",
  invokingPhase: "ACTIVE",
  providerCompetencyId: "C06",
  sourceRecordId: "C06-S04",
  sourceOutputKey: "commission amount",
  providerRead: {
    kind: "ESTABLISHED",
    provenance: {
      providerCompetencyId: "C06",
      consumerCompetencyId: "C01",
      sourceRecordId: "C06-S04",
      sourceOutputKey: "commission amount",
      relevantCondition: null,
    },
    result: {
      availability: "AVAILABLE",
      resolution: {
        kind: "KNOWN",
        value: quantity(
          ExactDecimal.from("4000"),
          "MONETARY_AMOUNT",
          "PHP",
          null,
        ),
      },
    },
  },
  permittedFields: ["commission amount"],
  requestedFields: ["commission amount"],
  providerFields: [
    { id: "commission amount", text: "PHP 4000" },
    { id: "total compensation", text: "FORBIDDEN_TOTAL_COMPENSATION" },
  ],
};
describe("read-only synthetic Review and Source Review", () => {
  it("retains outcome-neutral terminal origin for a synthetic reconsidered teaching consumer", () => {
    const evidence = Object.freeze({
      evaluation: Object.freeze({ outcome: "RECONSIDERATION" }),
      responseStage: "REASONING",
    });
    const authorization = {
      receivingActivityId: "C04-A04" as const,
      invokingPhase: "POST_CONFIRMATION_EXPLANATION" as const,
      relationships: [
        {
          id: "synthetic-boundary",
          text: "Synthetic authorized boundary relationship",
        },
      ],
    };
    const review = projectReview(
      "C04-A04",
      authorization.invokingPhase,
      authorization.invokingPhase,
      "REVIEW",
      authorization,
    );
    expect(review?.returnTo).toBe("POST_CONFIRMATION_EXPLANATION");
    expect(evidence.evaluation.outcome).toBe("RECONSIDERATION");
    expect(evidence.responseStage).toBe("REASONING");
    expect(JSON.stringify(review)).not.toContain("evaluation");
    expect(
      projectSourceReview(
        "C04-A04",
        authorization.invokingPhase,
        authorization.invokingPhase,
        "SOURCE_REVIEW",
        undefined,
      ),
    ).toBeNull();
  });
  it("retains exact post-confirmation origin without leaking or mutating synthetic authorization", () => {
    const auth = {
      receivingActivityId: "C04-A04" as const,
      invokingPhase: "POST_CONFIRMATION_EXPLANATION" as const,
      relationships: [{ id: "synthetic", text: "Synthetic relationship" }],
    };
    const projection = projectReview(
      "C04-A04",
      auth.invokingPhase,
      auth.invokingPhase,
      "REVIEW",
      auth,
    );
    expect(projection?.returnTo).toBe(auth.invokingPhase);
    expect(projection?.invokingPhase).toBe(auth.invokingPhase);
    expect(
      projectReview(
        "C04-A04",
        auth.invokingPhase,
        "CONFIRMATION",
        "REVIEW",
        auth,
      ),
    ).toBeNull();
    expect(Object.isFrozen(projection?.relationships[0])).toBe(true);
    expect(auth.relationships[0]?.text).toBe("Synthetic relationship");
  });
  it("preserves exact origin, rejects mismatched content and never modifies the supplied record", () => {
    const auth = {
      receivingActivityId: "C04-A03" as const,
      invokingPhase: "EXP-03" as const,
      relationships: [{ id: "relationship", text: "Original is denominator" }],
    };
    const projected = projectReview(
      "C04-A03",
      "EXP-03",
      "EXP-03",
      "REVIEW",
      auth,
    );
    expect(projected?.returnTo).toBe("EXP-03");
    expect(projected?.relationships).toEqual(auth.relationships);
    expect(Object.isFrozen(projected?.relationships[0])).toBe(true);
    expect(() =>
      Object.assign(projected!.relationships[0]!, { text: "altered" }),
    ).toThrow();
    expect(auth.relationships[0]!.text).toBe("Original is denominator");
    expect(
      projectReview("C04-A03", "ACTIVE", "ACTIVE", "REVIEW", auth),
    ).toBeNull();
  });
  it("exposes commission only, never extra provider data or requested forbidden fields", () => {
    const result = projectSourceReview(
      "C01-A04",
      "ACTIVE",
      "ACTIVE",
      "SOURCE_REVIEW",
      provider,
    );
    expect(result?.exposedFields).toEqual([
      { id: "commission amount", text: "PHP 4000" },
    ]);
    expect(JSON.stringify(result)).not.toContain(
      "FORBIDDEN_TOTAL_COMPENSATION",
    );
    expect(Object.isFrozen(result?.exposedFields[0])).toBe(true);
    expect(
      projectSourceReview("C01-A04", "ACTIVE", "ACTIVE", "SOURCE_REVIEW", {
        ...provider,
        requestedFields: ["commission amount", "total compensation"],
      }),
    ).toBeNull();
    expect(
      projectSourceReview(
        "C01-A04",
        "ACTIVE",
        "ACTIVE",
        "SOURCE_REVIEW",
        undefined,
      ),
    ).toBeNull();
    expect(
      projectSourceReview(
        "C04-A03",
        "ACTIVE",
        "ACTIVE",
        "SOURCE_REVIEW",
        provider,
      ),
    ).toBeNull();
    expect(
      projectSourceReview(
        "C01-A04",
        "ENTRY",
        "ENTRY",
        "SOURCE_REVIEW",
        provider,
      ),
    ).toBeNull();
    expect(
      projectSourceReview("C01-A04", "ACTIVE", "ACTIVE", "SOURCE_REVIEW", {
        ...provider,
        providerRead: null,
      }),
    ).toBeNull();
  });
});
