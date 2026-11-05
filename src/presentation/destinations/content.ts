import type { ActivityId, CompetencyId } from "@/core/public";

/** Learner-facing display copy and art direction for the navigation surfaces.
 * Identity, labels, order and availability always come from the Session
 * summaries; this module only adds presentation. */
export type CompetencyTheme = "clay" | "sage" | "indigo";

export type CompetencyStory = Readonly<{
  number: string;
  theme: CompetencyTheme;
  headline: string;
  intro: string;
  blurb: string;
  focus: string;
}>;

export const competencyStories: Partial<
  Readonly<Record<CompetencyId, CompetencyStory>>
> = {
  C03: {
    number: "03",
    theme: "clay",
    headline: "When the workday runs long.",
    intro:
      "Follow real work records hour by hour and see how extra time is paid, and why the conditions behind those hours change the pay.",
    blurb: "Hours beyond the regular day, and how they are paid.",
    focus: "Time · rates · earnings",
  },
  C04: {
    number: "04",
    theme: "sage",
    headline: "Every change has a starting point.",
    intro:
      "Compare an original amount with a new one and measure the change against where it began, the way raises, prices and bills really move.",
    blurb: "Increases and decreases, measured from the original.",
    focus: "Original · change · reference",
  },
  C06: {
    number: "06",
    theme: "indigo",
    headline: "Every sale carries a share.",
    intro:
      "Connect sales, rates and earnings to see how commission grows with each sale, and how different pay agreements compare.",
    blurb: "How sales and rates turn into earnings.",
    focus: "Sales · rate · commission",
  },
};

export type ActivityStep = "prepare" | "explore" | "apply" | "transfer";

export type ActivityStory = Readonly<{
  step: ActivityStep;
  kicker: string;
  description: string;
}>;

const stepByFamily: Readonly<Record<string, ActivityStep>> = {
  Prepare: "prepare",
  "Explore and Learn": "explore",
  Apply: "apply",
  "Check and Transfer": "transfer",
};

/** C04 activity-specific copy, written from the implemented activities. */
const c04Activities: Partial<Readonly<Record<ActivityId, ActivityStory>>> = {
  "C04-A01": {
    step: "prepare",
    kicker: "Get ready",
    description:
      "Meet Maya after her salary review. Explore what changed and share your first thinking before any rules appear. Every starting idea counts.",
  },
  "C04-A02": {
    step: "explore",
    kicker: "Investigate",
    description:
      "Follow two employees’ raises side by side, discover why the original salary is the reference, and build the percentage-change idea step by step.",
  },
  "C04-A03": {
    step: "apply",
    kicker: "Put it to work",
    description:
      "One position, two monthly salary offers. Work out the change, decide what it means, and explain your conclusion.",
  },
  "C04-A04": {
    step: "transfer",
    kicker: "Check and carry over",
    description:
      "Take the idea somewhere new: a shop price, a smaller bill, and a start from zero. Check what still holds when the situation changes.",
  },
};

export function activityStory(id: ActivityId, family: string): ActivityStory {
  return (
    c04Activities[id] ?? {
      step: stepByFamily[family] ?? "prepare",
      kicker: family,
      description: "Open this activity to begin.",
    }
  );
}
