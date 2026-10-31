import { c04Scenarios } from "@/study/competencies/c04/public";
import {
  createC04ModelState,
  deriveC04ModelState,
} from "@/competencies/c04-percentage-change/model/public";
import type { SemanticActivityFrame } from "@/engine/semantic-frame/public";

/** Fixed source/model values, authorized only by exact current semantic identities. */
export function projectC04Apply(frame: SemanticActivityFrame) {
  if (frame.activityId !== "C04-A03") return undefined;
  const scenario = c04Scenarios[2]!;
  const [original, next] = scenario.facts;
  if (
    original?.resolution.kind !== "KNOWN" ||
    next?.resolution.kind !== "KNOWN"
  )
    throw new TypeError("Expected established offer amounts");
  const view = deriveC04ModelState(
    createC04ModelState({
      activityId: "C04-A03",
      scenarioId: "C04-S03",
      cases: [
        {
          childId: null,
          original: { role: original.key, value: original.resolution.value },
          newValue: { role: next.key, value: next.resolution.value },
        },
      ],
    }),
  );
  const exposed = (role: string) =>
    frame.exposedDerivedFacts.some(
      (fact) => fact.id === `c04/S03/checked/${role}`,
    );
  const difference = view.change.difference.resolution;
  const percentage = view.change.percentageChange.resolution;
  return {
    original: frame.exposedModelFacts.some(
      (fact) => fact.id === "c04/S03/selected-track/original",
    )
      ? view.original.value.magnitude.toString()
      : null,
    next: frame.exposedModelFacts.some(
      (fact) => fact.id === "c04/S03/selected-track/newValue",
    )
      ? view.newValue.value.magnitude.toString()
      : null,
    difference:
      exposed("difference") && difference.kind === "KNOWN"
        ? difference.value.magnitude.toString()
        : null,
    percentage:
      exposed("percentage") && percentage.kind === "KNOWN"
        ? percentage.value.magnitude.toString()
        : null,
    // Geometry is a public-model projection, never a second calculation in React.
    comparisonScale: exposed("percentage")
      ? view.newValue.value.magnitude
          .divide(view.original.value.magnitude)
          .toString()
      : null,
  };
}
