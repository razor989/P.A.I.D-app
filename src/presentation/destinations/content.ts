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

/** Activity-specific copy, written from the implemented activities. */
const activityStories: Partial<Readonly<Record<ActivityId, ActivityStory>>> = {
  "C03-A01": {
    step: "prepare",
    kicker: "Get ready",
    description:
      "Nico’s eight-hour workday is over, but his work isn’t. Look at his work record and share how you imagine the extra hours might be paid, before any rules appear.",
  },
  "C03-A02": {
    step: "explore",
    kicker: "Investigate",
    description:
      "The same extra hours at the same rate can be paid differently. Compare an ordinary day with a rest day and see why the kind of day comes before the calculation.",
  },
  "C03-A03": {
    step: "apply",
    kicker: "Put it to work",
    description:
      "Use James’s monthly work record to calculate his overtime pay, then explain what your result means.",
  },
  "C03-A04": {
    step: "transfer",
    kicker: "Check and carry over",
    description:
      "Take your reasoning to Mara’s overtime on a regular holiday, then bring the overtime-pay ideas together.",
  },
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
  "C06-A01": {
    step: "prepare",
    kicker: "Get ready",
    description:
      "Same sales, different pay agreements. Compare what each agreement promises and share your first thinking about each pay structure.",
  },
  "C06-A02": {
    step: "explore",
    kicker: "Investigate",
    description:
      "Keep one agreement and change the sales. Follow what happens to commission and total pay, and explain what caused the difference.",
  },
  "C06-A03": {
    step: "apply",
    kicker: "Put it to work",
    description:
      "A property sale closes. Choose the pay structure, calculate the straight commission, and explain what it means.",
  },
  "C06-A04": {
    step: "transfer",
    kicker: "Check and carry over",
    description:
      "Bring your reasoning to Lina’s June pay record. Decide which amount does each job, and check how the relationship still holds.",
  },
};

export function activityStory(id: ActivityId, family: string): ActivityStory {
  return (
    activityStories[id] ?? {
      step: stepByFamily[family] ?? "prepare",
      kicker: family,
      description: "Open this activity to begin.",
    }
  );
}
