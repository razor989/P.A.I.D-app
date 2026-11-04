import { describe, expect, it } from "vitest";
import { createActivityRestoration } from "./public";

describe("C06 restoration does not open a generic family bypass", () => {
  it("rejects raw or mismatched-family context without changing definition validation", () => {
    const ports = {
      ready: () => false,
      evaluate: () => ({ outcome: "CONFIRMED" as const, diagnostic: null }),
      completionEligible: () => false,
      sourceReviewAvailable: () => false,
      informationNeeded: () => false,
      informationReturn: () => false,
    };
    for (const activityId of ["C06-A03", "C01-A01"] as const) {
      const definition = {
        activityId,
        edges: { ENTRY: { CONTINUE: "ACTIVE" as const } },
        support: {},
      };
      const context = {
        activityId,
        position: "ENTRY" as const,
        origin: null,
        infoOrigin: null,
        response: null,
        responseRevision: 0,
        hasChecked: false,
        checkedResponse: null,
        checkedRevision: null,
        feedbackRevision: null,
        evaluation: null,
      };
      if (activityId === "C01-A01")
        expect(() =>
          createActivityRestoration(definition, ports, context),
        ).toThrow();
      else {
        expect(() =>
          createActivityRestoration(definition, ports, context),
        ).not.toThrow();
        expect(() =>
          createActivityRestoration(definition, ports, {
            ...context,
            position: "EXP-01",
          }),
        ).toThrow();
        expect(() =>
          createActivityRestoration(definition, ports, {
            ...context,
            position: "POST_CONFIRMATION_EXPLANATION",
          }),
        ).toThrow();
        expect(() =>
          createActivityRestoration(definition, ports, {
            ...context,
            activityId: "C04-A03",
          }),
        ).toThrow();
      }
    }
  });
});
