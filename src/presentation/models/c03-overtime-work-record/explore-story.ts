/** Presentation time only. Seeking never dispatches learner/Actor evidence. */
export function exploreBeatDuration(text: string) {
  return Math.max(4400, Math.min(8500, text.split(/\s+/).length * 220 + 1800));
}
export const exploreStages = [
  "Two hours. Two kinds of day.",
  "How is an ordinary-day hour paid?",
  "What changes on a rest day?",
  "Why does the same work earn more?",
  "Writing the calculation",
] as const;

export function projectExploreStory(
  time: number,
  durations: readonly number[],
) {
  const starts = durations.map((_, index) =>
    durations.slice(0, index).reduce((sum, value) => sum + value, 0),
  );
  const end = durations.reduce((sum, value) => sum + value, 0);
  const position = Math.max(0, Math.min(end, Number.isFinite(time) ? time : 0));
  const index = starts.reduce(
    (last, start, i) => (position >= start ? i : last),
    0,
  );
  return {
    position,
    end,
    starts,
    index,
    progress: Math.min(
      1,
      (position - (starts[index] ?? 0)) / (durations[index] ?? 1),
    ),
  };
}
