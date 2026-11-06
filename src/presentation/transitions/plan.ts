import type { ActivityId, CompetencyId } from "@/core/public";
import type { CompetencySummary, Destination } from "../shell/public";
import { activityStory, competencyStories } from "../destinations/content";
import type { ActivityStep, CompetencyTheme } from "../destinations/content";

/** Decorative transition families. They only describe a destination change
 * the Session has already made; they never decide or cause one. */
export type TransitionFamily = "accordion" | "chapter" | "fallback";
export type TransitionDirection = "forward" | "back";

export type ChapterIdentity = Readonly<{
  activityId: ActivityId;
  competencyId: CompetencyId;
  step: ActivityStep;
  number: string;
  label: string;
}>;

export type TransitionPlan = Readonly<{
  family: TransitionFamily;
  direction: TransitionDirection;
  /** Competency whose colours lead the transition, when one is involved. */
  competencyId: CompetencyId | null;
  /** The chapter (activity) involved in a chapter transition. */
  chapter: ChapterIdentity | null;
}>;

export type World = Readonly<{
  world: string;
  art: string;
  deep: string;
  soft: string;
  wash: string;
}>;

/** The Library's established competency worlds (library.module.css). */
export const worlds: Readonly<Record<CompetencyTheme, World>> = {
  clay: {
    world: "#a8492a",
    art: "#c96f48",
    deep: "#5b2a17",
    soft: "#f4d9c3",
    wash: "#f8ebde",
  },
  sage: {
    world: "#2f5a45",
    art: "#2f5a45",
    deep: "#1f3d30",
    soft: "#dde6cc",
    wash: "#eef1e4",
  },
  indigo: {
    world: "#3f4f8f",
    art: "#4a5a9c",
    deep: "#1f2a55",
    soft: "#d9d5ef",
    wash: "#ecebf7",
  },
};

export function worldOf(id: CompetencyId | null): World {
  return worlds[(id && competencyStories[id]?.theme) || "sage"];
}

export function destinationIdentity(destination: Destination): string {
  return destination.kind === "library"
    ? "library"
    : destination.kind === "competency"
      ? `competency:${destination.competencyId}`
      : `activity:${destination.activityId}`;
}

const depth = { library: 0, competency: 1, activity: 2 } as const;

function chapterOf(
  activityId: ActivityId,
  competencies: readonly CompetencySummary[],
): ChapterIdentity | null {
  for (const competency of competencies) {
    const index = competency.activities.findIndex((a) => a.id === activityId);
    const activity = competency.activities[index];
    if (!activity) continue;
    return {
      activityId,
      competencyId: competency.id,
      step: activityStory(activityId, activity.label).step,
      number: String(index + 1).padStart(2, "0"),
      label: activity.label,
    };
  }
  return null;
}

/** Chooses the decorative family for an actual destination change. Depth
 * (library 0 → competency 1 → activity 2) gives the direction, so in-app Back,
 * the Learning Library button and a Session-driven return all read as returns. */
export function planTransition(
  from: Destination,
  to: Destination,
  competencies: readonly CompetencySummary[],
): TransitionPlan | null {
  if (destinationIdentity(from) === destinationIdentity(to)) return null;
  const forward = depth[to.kind] > depth[from.kind];
  const direction: TransitionDirection = forward ? "forward" : "back";
  const deeper = forward ? to : from;
  const shallower = forward ? from : to;
  if (deeper.kind === "competency" && shallower.kind === "library")
    return {
      family: "accordion",
      direction,
      competencyId: deeper.competencyId,
      chapter: null,
    };
  if (deeper.kind === "activity" && shallower.kind !== "activity") {
    const chapter = chapterOf(deeper.activityId, competencies);
    if (chapter)
      return {
        family: "chapter",
        direction,
        competencyId: chapter.competencyId,
        chapter,
      };
  }
  // Same depth (for example one activity straight to another) or an unknown
  // identity: never guess a journey, use the restrained fallback.
  return {
    family: "fallback",
    direction,
    competencyId:
      to.kind === "competency"
        ? to.competencyId
        : from.kind === "competency"
          ? from.competencyId
          : null,
    chapter: null,
  };
}
