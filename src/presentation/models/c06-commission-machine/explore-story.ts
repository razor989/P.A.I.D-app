/** Presentation moments only: playback never sends Actor evidence or advances a stage. */
export const exploreChapters = [
  {
    title: "One agreement. Two kinds of pay.",
    moments: [
      [
        "A monthly promise",
        "One representative has one pay agreement. It promises a fixed monthly salary, alongside commission linked to monthly sales.",
      ],
      [
        "Fixed does not mean all pay",
        "The salary is ₱15,000 each month in both situations. This promise does not grow when the sales record grows.",
      ],
      [
        "Another part can change",
        "The agreement also promises commission at 3% of sales. Keep salary and commission separate: they have different jobs in the pay story.",
      ],
    ],
  },
  {
    title: "What does 3% act on?",
    moments: [
      [
        "Choose the reference",
        "The sales record is the value of goods sold. It is the reference amount for commission—not the representative’s salary or total pay.",
      ],
      [
        "Three in every hundred",
        "A rate of 3% means three hundredths of that sales amount. The highlighted share shows the relationship; the original sales record remains intact.",
      ],
      [
        "Name the operation",
        "Commission = sales × 0.03. Salary is not included in that multiplication. We will use the salary only after commission has been found.",
      ],
    ],
  },
  {
    title: "Follow Situation A, one step at a time.",
    moments: [
      [
        "Read the record",
        "Situation A records ₱300,000 in monthly sales. The agreement still promises 3% commission and a ₱15,000 monthly salary.",
      ],
      [
        "Resolve commission",
        "Three hundredths of ₱300,000 is ₱9,000. This is the sales-linked part of pay—not the value of the goods sold and not the whole monthly pay.",
      ],
      [
        "Assemble total pay",
        "Now bring the fixed ₱15,000 salary alongside the ₱9,000 commission. Together they make ₱24,000 total compensation. The two coloured parts retain their separate meanings.",
      ],
    ],
  },
  {
    title: "Change sales—not the agreement.",
    moments: [
      [
        "Predict before switching",
        "Imagine the same representative recording more sales. Which part of the pay picture should grow? Which promise should stay the same? Select Situation B to investigate.",
      ],
      [
        "Follow the same rate",
        "Follow the selected sales record through the same 3% rate. More sales at this unchanged positive rate produce more commission. A larger commission does not mean a larger rate.",
      ],
      [
        "Follow the consequence",
        "The fixed salary has not changed. Any difference in total compensation comes from the changed commission. Switch between the records and follow sales → commission → total.",
      ],
    ],
  },
  {
    title: "Put the evidence beside itself.",
    moments: [
      [
        "Hold the agreement still",
        "Both situations use the same base-plus-commission agreement: ₱15,000 monthly salary and 3% commission. These stay the same in both situations.",
      ],
      [
        "Compare the changing part",
        "Situation B has higher sales and higher commission. Compare the gold parts of the pay pictures: commission is ₱9,000 in A and ₱15,000 in B.",
      ],
      [
        "Explain the whole difference",
        "The salary parts match. The commission parts do not. That is why total compensation is ₱24,000 in A and ₱30,000 in B. The table records the relationships you have just followed.",
      ],
    ],
  },
  {
    title: "Two operations. Two different jobs.",
    moments: [
      [
        "First: a share of sales",
        "Multiplication answers: how much commission does this sales record earn at the agreed rate? Sales and rate belong in this first calculation.",
      ],
      [
        "Then: combine the pay",
        "Addition answers a different question: how much pay is there altogether? Join the commission you found to the fixed salary—not to sales.",
      ],
      [
        "Carry the explanation",
        "One agreement can produce different totals. In these two situations, sales changes, commission responds, and total pay follows. The salary and rate stay fixed throughout.",
      ],
    ],
  },
] as const;

export function exploreDuration(text: string) {
  // Read a complete thought, inspect its model, then pause before moving on.
  return Math.max(8000, text.trim().split(/\s+/).length * 320 + 2800);
}

export function exploreMoment(time: number, texts?: readonly string[]) {
  const durations = texts?.map(exploreDuration) ?? [8000, 8000, 8000];
  const starts = durations.map((_, i) =>
    durations.slice(0, i).reduce((a, b) => a + b, 0),
  );
  const end = durations.reduce((a, b) => a + b, 0);
  const position = Math.max(0, Math.min(end, Number.isFinite(time) ? time : 0));
  const cue = Math.max(
    0,
    starts.reduce((last, start, i) => (position >= start ? i : last), 0),
  );
  return {
    position,
    cue,
    progress: Math.min(1, (position - starts[cue]!) / durations[cue]!),
    starts,
    end,
  };
}
