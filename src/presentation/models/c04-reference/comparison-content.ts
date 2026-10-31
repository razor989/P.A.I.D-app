/** Authored comparison copy, not mathematical or progression authority. */
export const comparisonChapters = [
  {
    title: "Equal added money",
    captions: [
      "Both employees receive the same ₱2,000 addition.",
      "Equal gold widths mean equal pesos on this common scale.",
      "Neither employee receives more added money.",
    ],
    emphasis: ["same ₱2,000", "equal pesos", "Neither employee"],
    equations: [
      "A: +₱2,000 · B: +₱2,000",
      "Same peso scale → equal added widths",
      "Added pesos: A = B",
    ],
    part: "addition",
  },
  {
    title: "Different starting wholes",
    captions: [
      "A starts with ₱20,000; B starts with ₱10,000.",
      "On the peso scale, B’s original is half as wide as A’s.",
      "We measure each increase against that employee’s own original.",
    ],
    emphasis: ["₱20,000", "half as wide", "own original"],
    equations: [
      "A original: ₱20,000 · B original: ₱10,000",
      "₱10,000 = half of ₱20,000",
      "Same addition · different reference wholes",
    ],
    part: "original",
  },
  {
    title: "Match without removing",
    captions: [
      "An outline copy matches the addition to each starting whole.",
      "One of A’s ten parts matches; one of B’s five parts matches.",
      "The originals stay intact. No money is removed.",
    ],
    emphasis: ["outline copy", "ten parts", "No money is removed"],
    equations: [
      "A: ₱2,000 / ₱20,000 · B: ₱2,000 / ₱10,000",
      "A: 1/10 of the original · B: 1/5",
      "Matching is comparison, not subtraction",
    ],
    part: "total",
  },
  {
    title: "Choose the comparison scale",
    captions: [
      "Now treat each employee’s own original as 100%.",
      "B’s original and addition enlarge together; no salary changes.",
      "Equal 100% widths do not mean equal salaries. Switch scales to check.",
    ],
    emphasis: [
      "own original as 100%",
      "enlarge together",
      "do not mean equal salaries",
    ],
    equations: [
      "A: ₱20,000 = 100% · B: ₱10,000 = 100%",
      "Each addition keeps its share of its own whole",
      "Scale changes · money stays the same",
    ],
    part: "original",
  },
  {
    title: "Name the shares",
    captions: [
      "Divide each intact original into 100 equal parts.",
      "A’s addition matches ten parts; B’s matches twenty.",
      "One tenth is 10%; one fifth is 20%.",
    ],
    emphasis: ["100 equal parts", "ten parts", "20%"],
    equations: [
      "A: 1/10 = 0.10 = 10/100 = 10%",
      "B: 1/5 = 0.20 = 20/100 = 20%",
      "10% of ₱20,000 = 20% of ₱10,000 = ₱2,000",
    ],
    part: "total",
  },
  {
    title: "Same pesos, different percentages",
    captions: [
      "B’s percentage increase is twice A’s: 20% rather than 10%.",
      "This does not mean B received twice the added money.",
      "For the same positive increase, a smaller positive original gives a larger percentage increase.",
    ],
    emphasis: ["twice A’s", "does not mean", "smaller positive original"],
    equations: [
      "20% = 2 × 10%",
      "Both additions are still ₱2,000",
      "Same added pesos ≠ same percentage increase",
    ],
    part: "total",
  },
] as const;

export const comparisonLessons = {
  original: {
    title: "Two different amounts can each be 100%.",
    copy: "A’s reference whole is ₱20,000; B’s is ₱10,000. In the peso view B is half as wide. In the percentage view each employee’s own original represents 100%. Equal percentage widths do not mean equal money.",
    equation: "A: ₱20,000 = 100% · B: ₱10,000 = 100%",
    labels: [
      "Different reference wholes · common peso scale",
      "Each 100% names that employee’s own salary",
    ],
  },
  addition: {
    title: "Equal added pesos, not equal shares.",
    copy: "The two gold additions are both ₱2,000. On a common peso scale they have equal widths. The same added money covers a larger share of B’s smaller starting whole.",
    equation: "Added money: ₱2,000 = ₱2,000",
    labels: [
      "Equal gold widths mean equal pesos",
      "A: ten equal parts · B: five equal parts",
    ],
  },
  total: {
    title: "Match a copy. Keep both originals intact.",
    copy: "An outline copy of the addition matches one tenth of A’s original but one fifth of B’s. Nothing is removed. B’s 20% increase is twice A’s 10% increase; both still receive the same ₱2,000.",
    equation: "A: 1/10 = 10% · B: 1/5 = 20%",
    labels: [
      "An outline copy compares each addition",
      "No money removed · twice the share, not the pesos",
    ],
  },
} as const;

export const comparisonExplorationMarkup = `<aside class="story-callout" id="comparison-inspection" aria-labelledby="comparison-inspection-title" hidden>
  <header><span class="story-kicker">A CLOSER LOOK</span><button type="button" data-explore-close aria-label="Close supplemental explanation">×</button></header>
  <h3 id="comparison-inspection-title"></h3>
  <svg class="explore-diagram" viewBox="0 0 300 150" role="img" aria-label="">
    <text x="8" y="14" data-mini-label></text>
    <text x="8" y="35">A</text><text x="8" y="91">B</text>
    <rect class="mini-original" x="24" y="25" width="200" height="26" rx="3"/>
    <rect class="mini-original" x="24" y="81" width="100" height="26" rx="3"/>
    <g class="mini-divisions">${[25, 81].map((y, row) => Array.from({ length: row === 0 ? 9 : 4 }, (_, i) => `<path d="M${44 + i * 20} ${y}v26"/>`).join("")).join("")}</g>
    <g class="mini-add"><rect x="230" y="25" width="20" height="26" rx="2"/><rect x="130" y="81" width="20" height="26" rx="2"/></g>
    <g class="mini-copy"><rect x="24" y="25" width="20" height="26"/><rect x="24" y="81" width="20" height="26"/></g>
    <path class="mini-reference" d="M24 56v5h200v-5M24 112v5h100v-5"/>
    <text x="8" y="140" data-mini-result></text>
  </svg><p class="mini-equation"></p><p class="mini-copy-text"></p>
  <footer><span>Compare copies · keep both wholes intact</span><button type="button" data-explore-replay aria-label="Replay supplemental diagram">↺</button></footer>
</aside>`;
