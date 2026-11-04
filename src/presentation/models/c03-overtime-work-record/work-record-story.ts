/** Local presentation clock, adapted from accepted C04 prepare-story.ts. */
export const momentDuration = 24000;
export const moments = [
  {
    label: "The regular hours",
    title: "Eight hours already worked.",
    captions: [
      "Meet Nico, a covered private-sector employee. On this ordinary working day, he has finished eight regular hours of work.",
      "Those hours are already part of his day. The green tiles gather them into one record: eight hours of regular work completed.",
      "For a regular hour, Nico’s established pay is ₱100.00. That gives us a familiar starting point—but his workday does not end with those eight hours.",
    ],
  },
  {
    label: "The additional hours",
    title: "Then, two more hours.",
    captions: [
      "After finishing his regular work, Nico works two additional hours. His record now has something more to tell us.",
      "The two gold tiles extend the day beyond the eight green ones. They keep the extra work visible alongside the regular work he has already done.",
      "Nico has given two more hours of his time. When you imagine his pay for those hours, would you begin with his usual hourly pay, or wonder whether something changes?",
    ],
  },
  {
    label: "Your first thinking",
    title: "The hours are only part of the story.",
    captions: [
      "The work record brings three details together: Nico’s usual hourly pay, the two additional hours and the ordinary working day on which he worked them.",
      "We know what happened during this day. The question still open is how you imagine those extra hours might be paid—and what you would want to find out first.",
      "Hold that picture of Nico’s day in mind. Your starting idea and your question will give us somewhere to begin the investigation.",
    ],
  },
] as const;
export function projectWorkRecordStory(time: number) {
  const end = moments.length * momentDuration;
  const position = Math.max(0, Math.min(end, Number.isFinite(time) ? time : 0));
  const index = Math.min(
    moments.length - 1,
    Math.floor(position / momentDuration),
  );
  return {
    position,
    end,
    index,
    cue: Math.min(
      2,
      Math.floor((position - index * momentDuration) / (momentDuration / 3)),
    ),
    moment: moments[index]!,
  };
}
