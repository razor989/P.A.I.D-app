/** Authored presentation copy only; not mathematical or progression authority. */
export const formulaChapters = [
  {
    title: "Find what changed",
    captions: [
      "The new salary contains the original and the separate addition.",
      "New minus Original identifies only the change: +₱2,000.",
      "The whole stays intact. Subtraction identifies a difference; no money is taken away.",
    ],
    emphasis: ["original", "only the change", "stays intact"],
    parts: ["total", "addition", "original"],
    equations: [
      "₱20,000 + ₱2,000 = ₱22,000",
      "₱22,000 − ₱20,000 = +₱2,000",
      "Change = New − Original",
    ],
  },
  {
    title: "Choose the reference whole",
    captions: [
      "The change belongs above the fraction line: it is what we are comparing.",
      "The original belongs below: it is the starting whole used to measure growth.",
      "B uses B’s own original. Equal added pesos are different shares of different wholes.",
    ],
    emphasis: ["change", "original", "own original"],
    parts: ["addition", "original", "original"],
    equations: [
      "Change = +₱2,000",
      "₱2,000 ÷ ₱20,000 = 1/10 = 0.10",
      "B: ₱2,000 ÷ ₱10,000 = 1/5 = 0.20",
    ],
  },
  {
    title: "Name the percentage",
    captions: [
      "Ten of the original’s hundred equal parts match A’s addition. The same share is 10%.",
      "Multiplying 0.10 by 100 finds the percentage number, 10. Report a 10% increase.",
      "Multiplying by 100% keeps the equality: 0.10 × 100% = 10%. No money changes.",
    ],
    emphasis: ["same share", "percentage number", "keeps the equality"],
    parts: ["addition", "original", "total"],
    equations: [
      "1/10 = 0.10 = 10/100 = 10%",
      "0.10 × 100 = 10; report 10%",
      "0.10 × 100% = 10%",
    ],
  },
  {
    title: "Use the same reasoning",
    captions: [
      "For comparable quantities in the same units, identify Original and New before calculating.",
      "With a positive original, a positive result means increase, negative means decrease, and zero means no change.",
      "If Original is zero, division by zero is undefined. An amount can change without a defined percentage change.",
    ],
    emphasis: ["same units", "positive original", "division by zero"],
    parts: ["original", "addition", "original"],
    equations: [
      "Find the change → compare with Original → express out of 100",
      "Positive: increase · negative: decrease · zero: no change",
      "Original = 0 → percentage change undefined",
    ],
  },
] as const;

export const formulaLessons = {
  original: {
    title: "Why does Original go below?",
    copy: "The green starting whole is the denominator. We measure the addition against this whole, not against the new total. B must use B’s own ₱10,000 original.",
    equation: "A: ₱2,000 ÷ ₱20,000 = 0.10",
    labels: [
      "Original = reference whole",
      "The denominator is not the new salary",
    ],
  },
  addition: {
    title: "What belongs above the line?",
    copy: "New minus Original identifies the gold addition. Only this change belongs in the numerator. The outline is a comparison copy; the original stays intact.",
    equation: "₱22,000 − ₱20,000 = +₱2,000",
    labels: [
      "Original stays whole · ₱20,000",
      "Gold addition = change · +₱2,000",
    ],
  },
  total: {
    title: "The new total is not the increase",
    copy: "The new salary includes the original and addition. A’s increase is 10%; the new total is 110% of the original. Multiplying a share by 100 finds its percentage number, not extra money.",
    equation: "100% original + 10% increase = 110% total",
    labels: ["100% original", "10% increase · 110% total"],
  },
} as const;
