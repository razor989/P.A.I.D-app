/** Absolute-time choreography only. No answer computation or canonical progress. */
export const prepareMoments = [
  {
    name: "Before the review",
    title: "Start with the starting point.",
    caption:
      "The before statement tells us Maya’s monthly salary before the company reviewed it. This is the Original: our reference for comparison.",
  },
  {
    name: "After the review",
    title: "Bring in the second moment.",
    caption:
      "The after statement records the New salary. Keep both statements: the time each describes gives it a different role.",
  },
  {
    name: "One peso scale",
    title: "Make a fair comparison.",
    caption:
      "Line up the two monthly amounts at the same starting point. Both strips use the same peso scale, so their lengths can be compared directly.",
  },
  {
    name: "Your reasoning",
    title: "Two roles. Your comparison.",
    caption:
      "Original names the starting reference; New names the amount after the review. Use the amounts and their roles to decide New minus Original, then explain what happened.",
  },
  {
    name: "The difference",
    title: "Nothing extra. Nothing missing.",
    caption:
      "The aligned endpoints coincide. New minus Original gives the difference shown below; a zero difference is a marker, not a strip of extra salary.",
  },
  {
    name: "The reference",
    title: "The Original is still the reference.",
    caption:
      "Compare the difference with the intact Original salary. The Original represents 100% of itself. That is not the percentage change: the difference is compared with that reference.",
  },
  {
    name: "Percentage change",
    title: "Put the relationship into words.",
    caption:
      "A zero difference compared with a nonzero Original gives 0% change. Maya’s monthly salary did not change. Equal values still have distinct Original and New roles.",
  },
] as const;
export const momentDuration = 4500;
export function projectPrepareStory(time: number, checked: boolean) {
  const count = checked ? prepareMoments.length : 4;
  const end = (count - 1) * momentDuration;
  const position = Math.max(0, Math.min(end, Number.isFinite(time) ? time : 0));
  const index = Math.min(count - 1, Math.floor(position / momentDuration));
  return {
    position,
    index,
    end,
    moment: prepareMoments[index]!,
    showNew: index >= 1,
    aligned: index >= 2,
    showDifference: checked && index >= 4,
    showReference: checked && index >= 5,
    showPercentage: checked && index >= 6,
  };
}
