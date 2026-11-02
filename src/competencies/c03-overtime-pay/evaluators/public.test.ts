import { describe, expect, it } from "vitest";
import { ExactDecimal, quantity } from "@/core/public";
import { createC03ModelState } from "../model/public";
import { c03ResponseReady, evaluateC03Response } from "./public";

// Authenticated Engine composition supplies Study membership, never a private import.
describe("T062 neutral A01 structural participation", () => {
  const state = createC03ModelState({
    activityId: "C03-A01",
    scenarioId: "C03-S01",
    evidenceMode: "ordinary-day record",
    cases: [
      {
        childId: null,
        condition: "ordinary working day",
        rate: quantity(
          ExactDecimal.from("100"),
          "MONETARY_RATE",
          "PHP",
          "per hour",
        ),
        hours: quantity(ExactDecimal.from("2"), "DURATION", "hours", null),
        multiplier: quantity(
          ExactDecimal.from("1.25"),
          "MULTIPLIER",
          "dimensionless",
          null,
        ),
      },
    ],
  });
  const membership = {
    expectation: { options: [{ id: "c03-a01-not-sure" }] },
    investigation: { options: [{ id: "c03-a01-compare-ideas" }] },
  };
  const ports = {
    ready: (r: unknown) => c03ResponseReady(state, r, membership),
    evaluate: (r: unknown) => evaluateC03Response(state, r, membership),
  };
  const part = (key: string, selectionId: string) => ({
    key,
    response: { kind: "SINGLE_SELECTION", selectionId },
  });
  const valid = [
    part("expectation", "c03-a01-not-sure"),
    part("investigation", "c03-a01-compare-ideas"),
  ];
  it("rejects missing, duplicate, extra, unknown, cross-bank, legacy and wrong-kind responses", () => {
    for (const parts of [
      [],
      valid.slice(0, 1),
      [valid[0], valid[0]],
      [...valid, valid[0]],
      [part("expectation", "unknown"), valid[1]],
      [part("expectation", "c03-a01-compare-ideas"), valid[1]],
      [part("condition", "ordinary working day"), part("multiplier", "1.25")],
      [
        { key: "expectation", response: { kind: "TEXT", text: "unsure" } },
        valid[1],
      ],
    ]) {
      const input = { kind: "COMPOSITE", parts };
      expect(ports.ready(input)).toBe(false);
      expect(() => ports.evaluate(input)).toThrow();
    }
    expect(ports.ready({ kind: "COMPOSITE", parts: valid, extra: true })).toBe(
      false,
    );
    expect(ports.evaluate({ kind: "COMPOSITE", parts: valid })).toEqual({
      outcome: "CONFIRMED",
      diagnostic: null,
    });
  });
});
