/** Authored B-only supplemental content; geometry keeps the common peso scale. */
export const employeeBChapters = [
  {
    title: "Start with one whole",
    captions: [
      "Employee B starts with ₱10,000.",
      "This starting salary is our chosen whole.",
      "Keep that whole intact as we measure the raise.",
    ],
    emphasis: ["₱10,000", "chosen whole", "whole intact"],
    equations: [
      "₱10,000",
      "₱10,000 = one starting salary",
      "Original salary = 100%",
    ],
  },
  {
    title: "Bring in the added money",
    captions: [
      "The raise adds a separate ₱2,000.",
      "The gold block shows only the added money.",
      "On this same peso scale, it is one fifth as wide as the original.",
    ],
    emphasis: ["₱2,000", "only the added money", "same peso scale"],
    equations: [
      "Added money: ₱2,000",
      "Original stays ₱10,000",
      "₱10,000 + ₱2,000",
    ],
  },
  {
    title: "Join the amounts",
    captions: [
      "Bring the addition alongside the original.",
      "Together, they make the new salary of ₱12,000.",
      "The new total includes money that was already there.",
    ],
    emphasis: ["alongside", "₱12,000", "already there"],
    equations: [
      "₱10,000 + ₱2,000",
      "₱10,000 + ₱2,000 = ₱12,000",
      "New total ≠ added money",
    ],
  },
  {
    title: "Measure against the starting whole",
    captions: [
      "Split the original into five equal parts.",
      "An outline copy of the addition matches one part. No money is removed.",
      "Compare the ₱2,000 addition with the ₱10,000 original: one fifth.",
    ],
    emphasis: ["five equal parts", "outline copy", "one fifth"],
    equations: [
      "Original ₱10,000 = 5 equal parts",
      "Each part matches ₱2,000",
      "₱2,000 / ₱10,000 = 1/5",
    ],
  },
  {
    title: "Name the same share three ways",
    captions: [
      "One fifth is the same share as 0.20 of the original.",
      "Split each fifth into twenty. Our same whole now has 100 equal parts.",
      "The matching share covers twenty of those parts: 20% of the original.",
    ],
    emphasis: ["0.20", "100 equal parts", "20%"],
    equations: [
      "1/5 = 0.20",
      "1/5 = 0.20 = 20/100",
      "1/5 = 0.20 = 20/100 = 20%",
    ],
  },
  {
    title: "Keep increase and total separate",
    captions: [
      "Only the added ₱2,000 is the 20% increase.",
      "The original salary is still 100% of the starting whole.",
      "Original plus increase is 120% altogether—not a 120% increase.",
    ],
    emphasis: ["20% increase", "100%", "120% altogether"],
    equations: [
      "₱2,000 increase = 20%",
      "₱10,000 original = 100%",
      "100% original + 20% increase = 120% total",
    ],
  },
] as const;

export const employeeBLessons = {
  original: {
    title: "Which whole are we measuring against?",
    copy: "B’s starting salary is ₱10,000. We compare the ₱2,000 raise with that original whole. Using ₱12,000 would instead measure the addition’s share of the final salary—a different comparison.",
    equation: "₱2,000 ÷ ₱10,000 = 1/5",
    labels: [
      "Starting whole · ₱10,000",
      "The addition is measured against this whole",
    ],
  },
  addition: {
    title: "One addition. One of five equal parts.",
    copy: "Five equal ₱2,000 parts make B’s ₱10,000 original. An outline copy of the addition matches one of those five parts. No money is removed from the original.",
    equation: "₱2,000 × 5 = ₱10,000",
    labels: [
      "Five equal parts make the original",
      "A copy matches one part · no money removed",
    ],
  },
  total: {
    title: "The total includes the starting salary.",
    copy: "Only the gold ₱2,000 addition is the 20% increase. The green original is still 100%. Together they make 120% of B’s starting whole—not a 120% increase.",
    equation: "100% original + 20% increase = 120% total",
    labels: ["100% original", "+20% increase → 120% total"],
  },
} as const;

export const employeeBExplorationMarkup = `<aside class="story-callout" id="employee-b-inspection" aria-labelledby="employee-b-inspection-title" hidden>
  <header><span class="story-kicker">A CLOSER LOOK</span><button type="button" data-explore-close aria-label="Close supplemental explanation">×</button></header>
  <h3 id="employee-b-inspection-title"></h3>
  <svg class="explore-diagram" viewBox="0 0 300 118" role="img" aria-label="">
    <text x="8" y="17" data-mini-label></text>
    <rect class="mini-original" x="8" y="32" width="120" height="32" rx="3"/>
    <g class="mini-divisions">${Array.from({ length: 4 }, (_, i) => `<path d="M${32 + i * 24} 32v32"/>`).join("")}</g>
    <g class="mini-add"><rect x="134" y="32" width="24" height="32" rx="2"/></g>
    <rect class="mini-copy" x="8" y="32" width="24" height="32"/>
    <path class="mini-reference" d="M8 72v7h120v-7"/>
    <text x="8" y="103" data-mini-result></text>
  </svg><p class="mini-equation"></p><p class="mini-copy-text"></p>
  <footer><span>Explore the model · keep the whole in view</span><button type="button" data-explore-replay aria-label="Replay supplemental diagram">↺</button></footer>
</aside>`;
