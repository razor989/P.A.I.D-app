import { c04Scenarios } from "@/study/competencies/c04/public";
import {
  createC04ModelState,
  deriveC04ModelState,
  applyC04ModelIntent,
} from "@/competencies/c04-percentage-change/model/public";
import type { C04ModelDefinition } from "@/competencies/c04-percentage-change/model/public";
import type { SemanticActivityFrame } from "@/engine/semantic-frame/public";

/** Existing typed source/model APIs supply values; semantic fact IDs supply permission.
 * D226 COMPLETED-EXPLANATION-01 permits fixed-model values at C04-A02 COMPLETE
 * for local explanation revisit; all other frames retain exact exposure gates.
 */
export function projectC04Reference(frame: SemanticActivityFrame) {
  if (frame.activityId !== "C04-A02") return undefined;
  const completedExplanation = frame.stateId === "COMPLETE";
  const scenario = c04Scenarios[1]!;
  const cases = (["A", "B"] as const).map((id, index) => {
    const original = scenario.facts[index * 2]!;
    const next = scenario.facts[index * 2 + 1]!;
    if (
      original.resolution.kind !== "KNOWN" ||
      next.resolution.kind !== "KNOWN"
    )
      throw new TypeError("Reference requires established salary quantities");
    return {
      childId: `C04-S02-${id}` as const,
      original: { role: original.key, value: original.resolution.value },
      newValue: { role: next.key, value: next.resolution.value },
    };
  });
  const definition: C04ModelDefinition = {
    activityId: "C04-A02",
    scenarioId: "C04-S02",
    cases,
  };
  const seed = createC04ModelState(definition);
  return Object.fromEntries(
    (["A", "B"] as const).map((id) => {
      const prefix = `c04/S02/authored-focus/C04-S02-${id}/`;
      const has = (suffix: string) =>
        completedExplanation ||
        frame.exposedDerivedFacts.some(
          (fact) => fact.id === `${prefix}${suffix}`,
        );
      const view = deriveC04ModelState(
        applyC04ModelIntent(seed, {
          type: "SELECT_CHILD",
          childId: `C04-S02-${id}`,
        }),
      );
      const difference = view.change.difference.resolution;
      const percentage = view.change.percentageChange.resolution;
      const relative = view.change.relativeChange.resolution;
      return [
        id,
        {
          original: view.original.value.magnitude.toString(),
          next: view.newValue.value.magnitude.toString(),
          difference:
            has("difference") && difference.kind === "KNOWN"
              ? difference.value.magnitude.toString()
              : null,
          percentage:
            has("percentage") && percentage.kind === "KNOWN"
              ? percentage.value.magnitude.toString()
              : null,
          relative:
            has("percentage") && relative.kind === "KNOWN"
              ? relative.value.toString()
              : null,
        },
      ];
    }),
  );
}
