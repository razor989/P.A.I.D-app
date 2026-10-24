// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ExactDecimal, quantity } from "@/core/public";
import type { LearnerResponse } from "@/core/public";
import {
  createC04ActivityActor,
  composeC04ActivityFrame,
} from "@/engine/c04-activity-binding/public";
import type { SemanticActivityFrame } from "@/engine/semantic-frame/public";
import { AnchoredChangeTrack } from "./AnchoredChangeTrack";

afterEach(cleanup);
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
const composite = (
  parts: Record<
    string,
    Exclude<LearnerResponse, { kind: "COMPOSITE" | "MODEL_STATE" }>
  >,
): LearnerResponse => ({
  kind: "COMPOSITE",
  parts: Object.entries(parts).map(([key, response]) => ({ key, response })),
});
function assertProjection(frame: SemanticActivityFrame) {
  const view = render(
    <AnchoredChangeTrack
      frame={frame}
      blocked={false}
      onIntent={vi.fn()}
      onSelect={vi.fn()}
    />,
  );
  for (const fact of [
    ...frame.contentReferences,
    ...frame.exposedModelFacts,
    ...frame.exposedDerivedFacts,
  ]) {
    expect(view.container.textContent).toContain(fact.text);
  }
  // Scenario-established geometry is independent of calculated answer exposure.
  const svg = view.container.querySelector("svg")!;
  const expectedScene =
    frame.activityId === "C04-A01"
      ? "equal"
      : frame.activityId === "C04-A03"
        ? "decrease"
        : "increase";
  expect(svg.getAttribute("data-scene")).toBe(expectedScene);
  expect(svg.querySelector("circle")?.getAttribute("cx")).toBe(
    expectedScene === "equal"
      ? "180"
      : expectedScene === "decrease"
        ? "75"
        : "330",
  );
  expect(svg.textContent).toContain("Original");
  expect(svg.textContent).toContain("New");
  const changeExposed = frame.exposedDerivedFacts.some((fact) =>
    fact.id.endsWith("/difference"),
  );
  const relativeExposed =
    frame.exposedDerivedFacts.some((fact) => fact.id.endsWith("/percentage")) ||
    frame.contentReferences.some((content) =>
      content.id.endsWith("/undefined-result"),
    );
  expect(svg.textContent?.includes("Change Span")).toBe(changeExposed);
  expect(svg.textContent?.includes("Relative to Original")).toBe(
    relativeExposed,
  );
  expect(svg.querySelectorAll("path")).toHaveLength(
    2 +
      (changeExposed && expectedScene !== "equal" ? 1 : 0) +
      (relativeExposed ? 1 : 0),
  );
  const output = view.container.textContent;
  view.unmount();
  return output ?? "";
}

it.each(["C04-A01", "C04-A03", "C04-A04"])(
  "%s keeps independent answers withheld before check and renders only issued facts",
  (id) => {
    const actor = createC04ActivityActor(id).start();
    try {
      for (const phase of ["ENTRY", "ACTIVE"]) {
        const frame = composeC04ActivityFrame(actor);
        expect(frame.stateId).toBe(phase);
        expect(frame.exposedDerivedFacts).toEqual([]);
        expect(frame.feedbackState).toBeUndefined();
        expect(
          frame.contentReferences.some((content) =>
            content.id.endsWith("/undefined-result"),
          ),
        ).toBe(false);
        const output = assertProjection(frame);
        expect(output).not.toMatch(
          /-10%|UNDEFINED — NO PERCENTAGE REPORTED|0%/,
        );
        expect(frame.exposedModelFacts).toHaveLength(2);
        actor.send({ type: "CONTINUE" });
      }
    } finally {
      actor.stop();
    }
  },
);

it("retains all five authentic A02 stages and engagement-gated dependent passages", () => {
  const actor = createC04ActivityActor("C04-A02").start();
  try {
    const passages = new Set<string>();
    for (const stage of ["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05"]) {
      actor.send({ type: "CONTINUE" });
      let frame = composeC04ActivityFrame(actor);
      expect(frame.stateId).toBe(stage);
      const teaching = frame.contentReferences.find((f) =>
        f.id.endsWith("/teaching"),
      )!;
      passages.add(teaching.text);
      assertProjection(frame);
      const options =
        frame.modelSelectionControl?.options.map((o) => o.id) ?? [];
      if (stage === "EXP-01") expect(options).toEqual([]);
      if (stage === "EXP-02" || stage === "EXP-03") {
        const selectionId = stage === "EXP-02" ? "C04-S02-A" : "C04-S02-B";
        expect(options).toEqual([selectionId]);
        expect(
          frame.contentReferences.some((f) =>
            f.id.endsWith("/dependent-teaching"),
          ),
        ).toBe(false);
        const control = frame.modelSelectionControl!;
        actor.send({
          type: "SELECT_MODEL_CHILD",
          modelId: control.modelId,
          revision: control.revision,
          position: control.position,
          selectionId,
        });
        frame = composeC04ActivityFrame(actor);
        expect(
          frame.contentReferences.some((f) =>
            f.id.endsWith("/dependent-teaching"),
          ),
        ).toBe(true);
        expect(
          frame.exposedDerivedFacts.some((f) =>
            f.text.includes(stage === "EXP-02" ? "10%" : "20%"),
          ),
        ).toBe(true);
        const before = actor.getSnapshot();
        actor.send({
          type: "SELECT_MODEL_CHILD",
          modelId: control.modelId,
          revision: control.revision,
          position: control.position,
          selectionId,
        });
        expect(actor.getSnapshot().context.model).toBe(before.context.model);
        assertProjection(frame);
      }
      if (stage === "EXP-04" || stage === "EXP-05") {
        expect(frame.exposedDerivedFacts.map((f) => f.text).join(" ")).toMatch(
          /2000.*10%.*2000.*20%/,
        );
      }
    }
    expect(passages.size).toBe(5);
    actor.send({ type: "PREVIOUS" });
    expect(composeC04ActivityFrame(actor).stateId).toBe("EXP-04");
    actor.send({ type: "CONTINUE" });
    expect(composeC04ActivityFrame(actor).stateId).toBe("EXP-05");
    actor.send({ type: "CONTINUE" });
    expect(
      composeC04ActivityFrame(actor).modelSelectionControl?.options.map(
        (o) => o.id,
      ),
    ).toEqual(["C04-S02-A", "C04-S02-B"]);
  } finally {
    actor.stop();
  }
});

it.each(["C04-A01", "C04-A03", "C04-A04"])(
  "%s exposes provider answers only on the real checked path",
  (id) => {
    const actor = createC04ActivityActor(id).start();
    try {
      actor.send({ type: "CONTINUE" });
      const option = (role: string) => ({
        kind: "SINGLE_SELECTION" as const,
        selectionId: composeC04ActivityFrame(actor).responseControls!.find(
          (c) => c.role === role,
        )!.options![0]!.id,
      });
      let response: LearnerResponse;
      if (id === "C04-A01")
        response = composite({
          original: money("18000"),
          new: money("18000"),
          difference: money("0"),
          interpretation: option("interpretation"),
        });
      else if (id === "C04-A03")
        response = composite({
          original: money("30000"),
          new: money("27000"),
          difference: money("-3000"),
          percentage: percent("-10"),
          interpretation: option("interpretation"),
        });
      else {
        const primary = {
          difference: money("1500"),
          percentage: {
            kind: "SEMANTIC_BOUNDARY" as const,
            resolution: {
              kind: "UNDEFINED" as const,
              reason: "Original value is zero",
            },
          },
        };
        actor.send({ type: "RESPONSE_CHANGED", response: composite(primary) });
        actor.send({ type: "COMMIT_PRIMARY_RESPONSE" });
        response = composite({
          ...primary,
          explanation: option("explanation"),
        });
      }
      actor.send({ type: "RESPONSE_CHANGED", response });
      actor.send({ type: "CHECK_RESPONSE" });
      let frame = composeC04ActivityFrame(actor);
      expect(frame.exposedDerivedFacts.length).toBeGreaterThan(0);
      const output = assertProjection(frame);
      if (id === "C04-A01") expect(output).toContain("0%");
      if (id === "C04-A03") expect(output).toContain("-10%");
      if (id === "C04-A04") {
        expect(output).toContain("1500 PHP per month");
        expect(
          frame.exposedDerivedFacts.some((f) => f.id.endsWith("/percentage")),
        ).toBe(false);
        actor.send({
          type: "FEEDBACK_DELIVERED",
          revision: actor.getSnapshot().context.responseRevision,
        });
        actor.send({ type: "CONTINUE" });
        frame = composeC04ActivityFrame(actor);
        expect(frame.stateId).toBe("POST_CONFIRMATION_EXPLANATION");
        expect(
          frame.exposedDerivedFacts.some((fact) =>
            fact.id.endsWith("/percentage"),
          ),
        ).toBe(false);
        expect(assertProjection(frame)).toContain(
          "Percentage change undefined.",
        );
      }
    } finally {
      actor.stop();
    }
  },
);
