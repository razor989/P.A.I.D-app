import { c04Scenarios } from "@/study/competencies/c04/public";
import {
  createC04ModelState,
  deriveC04ModelState,
} from "@/competencies/c04-percentage-change/model/public";
import type { SemanticActivityFrame } from "@/engine/semantic-frame/public";

/** Numeric source projection only. No prose parsing, grading or zero-denominator scaling. */
export function projectC04Transfer(frame: SemanticActivityFrame) {
  if (frame.activityId !== "C04-A04") return undefined;
  const [original, next] = c04Scenarios[3]!.facts;
  if (
    original?.resolution.kind !== "KNOWN" ||
    next?.resolution.kind !== "KNOWN"
  )
    throw new TypeError("Expected established allowance amounts");
  const model = deriveC04ModelState(
    createC04ModelState({
      activityId: "C04-A04",
      scenarioId: "C04-S04",
      cases: [
        {
          childId: null,
          original: { role: original.key, value: original.resolution.value },
          newValue: { role: next.key, value: next.resolution.value },
        },
      ],
    }),
  );
  const has = (role: string) =>
    frame.exposedModelFacts.some(
      (f) => f.id === `c04/S04/selected-track/${role}`,
    );
  const terminal =
    frame.contentReferences.some((c) => c.id === "c04/S04/undefined-result") &&
    frame.stateId === "POST_CONFIRMATION_EXPLANATION";
  const completed =
    frame.stateId === "COMPLETE" &&
    frame.contentReferences.some((c) => c.id === "c04/S04/completion");
  const difference = model.change.difference.resolution;
  return {
    original: has("original")
      ? model.original.value.magnitude.toString()
      : null,
    next: has("newValue") ? model.newValue.value.magnitude.toString() : null,
    difference:
      (terminal || completed) && difference.kind === "KNOWN"
        ? difference.value.magnitude.toString()
        : null,
    explained: terminal || completed,
  };
}
