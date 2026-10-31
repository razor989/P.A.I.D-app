/** Situation choreography only: no solution, grading or learner evidence. */
export const momentDuration = 8500;
export const prepareMoments = [
  {
    name: "Meet Maya",
    title: "Meet Maya.",
    captions: [
      "Maya gets paid every month.",
      "Her company is about to review her salary.",
      "Let’s follow her story and see what you notice.",
    ],
  },
  {
    name: "Before the review",
    title: "Here’s her salary before the review.",
    captions: [
      "Maya earns ₱18,000 a month.",
      "This statement shows what she earns before the review.",
      "We’ll keep it beside the next statement so we can look at both.",
    ],
  },
  {
    name: "Review day",
    title: "The review takes place.",
    captions: [
      "The company reviews Maya’s salary.",
      "The review is over, and Maya is waiting for her next statement.",
      "A salary review doesn’t tell us the outcome on its own. Let’s see what arrives.",
    ],
  },
  {
    name: "After the review",
    title: "A second statement arrives.",
    captions: [
      "Here’s the statement Maya receives after the review.",
      "It shows a monthly salary of ₱18,000.",
      "Look at it beside the first statement. What catches your attention?",
    ],
  },
  {
    name: "Look again",
    title: "Two documents. What do you notice?",
    captions: [
      "One statement is from before the review. The other is from after it.",
      "Take a closer look at either statement if you’d like.",
      "What would you say about Maya’s salary, and what makes you think so?",
    ],
  },
  {
    name: "Your first thinking",
    title: "What do you think happened?",
    captions: [
      "You’ve seen both statements. What would you say about Maya’s salary?",
      "Let’s try four short questions about what you noticed.",
      "You don’t need a formula or a right answer. Your ideas will give us somewhere to begin.",
    ],
  },
] as const;
export function projectPrepareStory(time: number, _checked = false) {
  void _checked;
  const end = prepareMoments.length * momentDuration;
  const position = Math.max(0, Math.min(end, Number.isFinite(time) ? time : 0));
  const index = Math.min(
    prepareMoments.length - 1,
    Math.floor(position / momentDuration),
  );
  const local = position - index * momentDuration;
  return {
    position,
    end,
    index,
    cue: Math.min(2, Math.floor(local / (momentDuration / 3))),
    moment: prepareMoments[index]!,
    showBefore: index >= 1,
    showAfter: index >= 3,
  };
}
