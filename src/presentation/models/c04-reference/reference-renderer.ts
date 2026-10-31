import type { C04Presentation } from "../c04-anchored-change-track/public";
import { recap } from "./recap";
import { createEmployeeExplanation } from "./employee-explanation";
import { createComparisonExplanation } from "./comparison-explanation";
import { createFormulaExplanation } from "./formula-explanation";
import {
  mountQuestionOne,
  detachQuestionOne,
} from "./question-one-exploration";
import {
  mountQuestionTwo,
  detachQuestionTwo,
} from "./question-two-exploration";
import {
  mountQuestionThree,
  detachQuestionThree,
} from "./question-three-exploration";
type Employee = "A" | "B";
type ReadingState = {
  step: number;
  beats: number[];
  matched: boolean;
  modelView: string;
  compareView: string;
  prediction: string | null;
  predictionRead: boolean;
  role: string | null;
  repair: string | null;
  reviewing: boolean;
  returnScreen: string;
  question: number;
  inspect: Employee;
  checked: boolean;
  help: number;
  attempt: string | null;
};
export function createReferenceRenderer(
  main: HTMLElement,
  announce: (text: string) => void,
) {
  const employeeExplanation = createEmployeeExplanation(announce);
  const employeeBExplanation = createEmployeeExplanation(announce, "B");
  const comparisonExplanation = createComparisonExplanation(announce);
  const formulaExplanation = createFormulaExplanation(announce);
  let viewportIdentity = "";
  let recapHost: HTMLElement | null = null;
  let recapVisible = false;
  let recapVisited = false;
  let recapMotion: Animation[] = [];
  const state: ReadingState = {
    step: 0,
    beats: [0, 0, 0, 0, 0],
    matched: false,
    modelView: "pesos",
    compareView: "pesos",
    prediction: null,
    predictionRead: false,
    role: null,
    repair: null,
    reviewing: false,
    returnScreen: "complete",
    question: 0,
    inspect: "A",
    checked: false,
    help: 0,
    attempt: null,
  };
  let props: C04Presentation;
  let phase = "";
  let practiceIdentity = "";
  let selected = "";
  const moneyIcon = '<span aria-hidden="true">₱</span>';
  const employees = Object.freeze({
    A: Object.freeze({
      original: "₱20,000",
      next: "₱22,000",
      change: "₱2,000",
      percent: "10%",
      fraction: "0.10",
    }),
    B: Object.freeze({
      original: "₱10,000",
      next: "₱12,000",
      change: "₱2,000",
      percent: "20%",
      fraction: "0.20",
    }),
  });
  const titles = [
    "The raise",
    "Employee A",
    "Employee B",
    "Compare",
    "The formula",
  ];
  const nextButton = (label: string | undefined, disabled = false) =>
    `<button class="primary" data-action="next" ${disabled ? "disabled" : ""}>${label} <span aria-hidden="true">→</span></button>`;

  function avatar(id: Employee) {
    return `<span class="avatar avatar-${id}" aria-hidden="true"><span class="hair"></span><span class="face"></span><span class="shirt"></span><span class="avatar-letter">${id}</span></span>`;
  }
  const details = Object.freeze({
    A: { parts: 10, unit: "₱200", share: "one tenth" },
    B: { parts: 20, unit: "₱100", share: "one fifth" },
  });
  const fraction = (top: string, bottom: string) =>
    `<span class="fraction"><span>${top}</span><span>${bottom}</span></span>`;
  function hundred(id: Employee, filled = true) {
    return salaryModel(id, {
      view: "percent",
      percent: filled,
      matched: filled,
    });
  }
  function track(id: Employee, { focus = "" } = {}) {
    return salaryModel(id, { view: "pesos", percent: false, focus });
  }
  function salaryModel(
    id: Employee,
    {
      view = "pesos",
      percent = false,
      matched = false,
      focus = "",
      interactive = false,
      compact = false,
    } = {},
  ) {
    const e = employees[id],
      d = details[id];
    const originalWidth = view === "percent" ? 200 : id === "A" ? 200 : 100;
    const raiseWidth = view === "percent" && id === "B" ? 40 : 20;
    const tiles = id === "A" ? 10 : 5;
    return `<figure class="salary-model employee-${id} focus-${focus}" data-employee="${id}" data-view="${view}">
    <div class="model-heading">${avatar(id)}<h3>Employee ${id}</h3><span aria-hidden="true">${id === "A" ? "●" : "◆"}</span></div>
    <div class="model-labels"><span class="original-value">Starting salary <strong>${e.original}</strong></span><span class="addition-label">Added <strong>+₱2,000</strong></span></div>
    <svg class="salary-svg" viewBox="0 0 264 64" role="img" aria-label="Employee ${id}: original ${e.original} remains intact; add ₱2,000 to make ${e.next}.${percent ? ` Increase divided by original is ${e.fraction}, or ${e.percent}.` : ""}">
      <g class="original-strip"><rect x="4" y="10" width="${originalWidth}" height="35" rx="3" class="original-block"/>${Array.from({ length: tiles - 1 }, (_, i) => `<line x1="${4 + (originalWidth * (i + 1)) / tiles}" x2="${4 + (originalWidth * (i + 1)) / tiles}" y1="10" y2="45" class="tile-divider"/>`).join("")}</g>
      <rect class="raise-block" x="${8 + originalWidth}" y="10" width="${raiseWidth}" height="35" rx="3"/>
      <path class="total-bracket" d="M4 51 v7 H${8 + originalWidth + raiseWidth} v-7"/>
      ${matched ? `<g class="share-match"><path class="match-arrow" d="M${8 + originalWidth + raiseWidth / 2} 5 Q${originalWidth / 2} -8 ${4 + raiseWidth / 2} 5"/><rect x="4" y="10" width="${raiseWidth}" height="35" rx="3" class="equivalent-share"/></g>` : ""}
    </svg>
    <p class="total-salary">New salary = <strong>${e.next}</strong></p>
    <figcaption><p>${view === "pesos" ? "Each block shows ₱2,000." : `Starting salary ${e.original} = 100%.`}</p>${percent ? `<p class="share-equivalence"><strong>${id === "A" ? "1/10" : "1/5"} = ${e.fraction} = ${d.parts}/100 = ${e.percent}</strong>${compact ? "" : `<br>The added amount is ${d.parts} out of 100 parts of the starting salary; 1% of this salary is ${d.unit}.`}</p>` : ""}${matched && !compact ? `<p class="match-caption">The outline shows a part of the starting salary equal to the added money. The starting salary stays whole; no money is removed.</p>` : ""}</figcaption>
    ${interactive ? `<div class="model-tools" role="group" aria-label="Investigate Employee ${id}"><button class="secondary" data-action="match" aria-pressed="${state.matched}">${state.matched ? "Remove the matching outline" : "Match the added block to the starting salary"}</button><button class="text-button" data-action="model-view" aria-pressed="${view === "percent"}">${view === "pesos" ? "Show the starting salary as 100%" : "Show the amounts in pesos"}</button></div>` : ""}
  </figure>`;
  }
  function progress() {
    return `<nav class="progress" aria-label="Lesson progress"><ol>${titles.map((t, i) => `<li class="${i === state.step ? "current" : i < state.step ? "done" : ""}" ${i === state.step ? 'aria-current="step"' : ""}><span class="step-num">${i < state.step ? "✓" : String(i + 1).padStart(2, "0")}</span><span>${t}</span></li>`).join("")}</ol></nav>`;
  }
  const headings = [
    "Two employees get a raise",
    "How much did A’s salary grow?",
    "How much did B’s salary grow?",
    "Why are the percentages different?",
    "Writing the reasoning as a formula",
  ];
  const lastBeats = [1, 3, 3, 2, 3];
  function teaching(title: string, prose: string, extra = "") {
    return `<section id="teaching" class="teaching" tabindex="-1"><h3>${title}</h3><p>${prose}</p>${extra ? `<div id="supporting-detail">${extra}</div>` : ""}</section>`;
  }
  function employeeTeaching(id: Employee, beat: number) {
    const e = employees[id],
      d = details[id];
    if (beat === 0)
      return teaching(
        "The raise is not the whole salary",
        `Subtracting ${e.original} from ${e.next} leaves ₱2,000. This is the extra money—not the new salary. To describe how much the salary grew, we need to compare this extra money with the salary before the raise.`,
      );
    if (beat === 1)
      return teaching(
        "Compare the extra money with the starting salary",
        `Employee ${id} started with ${e.original}. We treat that starting amount as one whole salary, or 100%. Divide the ₱2,000 increase by that whole to find the share added.`,
        `<div class="calculation">${fraction("₱2,000", e.original)}<span>= ${e.fraction}</span></div><p>${e.fraction} means ${d.share} of the original salary. Using the new salary instead would answer a different question: what share of the final salary is the extra money?</p>`,
      );
    if (beat === 2)
      return teaching(
        "A percentage tells us “out of 100”",
        `The intact original salary is our 100%. The separate ₱2,000 addition is equal to ${d.parts} of those hundred parts. It is added alongside the original—not taken from it.`,
        `<div class="operation-result">${id === "A" ? "1/10" : "1/5"} = ${e.fraction} = ${d.parts}/100 = <strong>${e.percent}</strong></div><p>To find the percentage number: ${e.fraction} × 100 = ${d.parts}. Report this as a ${e.percent} increase. Multiplying by 100 finds the number to write before the % sign; it does not add money.</p>`,
      );
    return teaching(
      `${e.percent} describes the increase, not the new salary`,
      `For every ₱100 in Employee ${id}’s original salary, ₱${d.parts} was added. The original is still 100%; the new salary includes that original plus the ${e.percent} increase.`,
      `<div class="operation-result">${e.original} + ₱2,000 = ${e.next}</div><p>${id === "B" ? "B received the same ₱2,000 as A. But ₱2,000 is one fifth of B’s starting salary, rather than one tenth. Next, compare the two relationships together." : "The original salary is our reference because we are measuring growth from that starting point. Next, use the same reasoning for B."}</p>`,
    );
  }
  function comparison(beat: number) {
    return `<div class="comparison-explanation-host" data-parent-beat="${beat}"></div>`;
  }
  function formulaTeaching(beat: number) {
    return `<div class="formula-explanation-host" data-parent-beat="${beat}"></div>`;
  }
  function lesson() {
    const s = state.step,
      beat = state.beats[s] ?? 0;
    let visual, label;
    if (s === 0) {
      visual =
        beat === 0
          ? `<div class="paired">${track("A", { focus: "change" })}${track("B", { focus: "change" })}</div>${teaching("Each salary grew by ₱2,000", "Subtract the original from the new salary. Both differences are +₱2,000, so the employees gained the same number of pesos. But is ₱2,000 a large or small increase? That depends on the amount they started with.")}`
          : `${teaching("What does a percentage represent?", "A percentage describes a share of a chosen whole in 100 equal parts. The whole is 100%; one of its hundred equal parts is 1%. It lets us describe a share without saying only how many pesos it contains.", `<div class="percent-intro">${hundred("A", false)}<p>When we measure salary growth, the chosen whole is the original salary. An increase is compared with that starting amount. We will use the same “out of 100” idea for each employee, even though their starting salaries are different.</p></div>`)}`;
      label =
        beat === 0 ? "What does a percentage mean?" : "Investigate Employee A";
    } else if (s === 1 || s === 2) {
      const id = s === 1 ? "A" : "B";
      const prediction = id === "B" && !state.predictionRead;
      const model = salaryModel(id, {
        interactive: !prediction,
        view: state.modelView,
        percent: !prediction && beat >= 2,
        matched: state.matched,
        focus: beat === 1 ? "original" : "change",
      });
      visual = `<div class="investigation">${model}${prediction ? teaching("Before we calculate B’s percentage", "A started with ₱20,000. B gets the same extra money but starts with ₱10,000. Compared with A, do you think B’s percentage increase will be smaller, equal, or larger?", `<div class="prediction-choices" role="group" aria-label="Unscored prediction">${["smaller", "equal", "larger"].map((value) => `<button class="secondary" data-action="predict" data-value="${value}" aria-pressed="${state.prediction === value}">${value}</button>`).join("")}</div><p id="prediction-feedback" role="status">${state.prediction ? "Keep that prediction in mind. Investigate the model to check why." : "This is not scored. You can predict, or continue with the worked explanation without choosing."}</p>`) : employeeTeaching(id, beat)}</div>`;
      label = [
        "Compare with the starting salary",
        "Show that share out of 100",
        "What does this mean for the salary?",
        s === 1 ? "Investigate Employee B" : "Compare the two raises",
      ][beat];
    } else if (s === 3) {
      visual = comparison(beat);
      label = [
        "Compare out of 100",
        "Explain the difference",
        "Put the reasoning into a formula",
      ][beat];
    } else {
      visual = formulaTeaching(beat);
      label = [
        "Compare the change with the original",
        "Express the share out of 100",
        "Where else does this reasoning apply?",
        "Try it together",
      ][beat];
    }
    return `${progress()}<p class="stage-orientation">${state.reviewing ? "Review · " : ""}Stage ${s + 1} of 5 · ${titles[s]}</p>${state.reviewing ? `<div class="review-tools"><div class="view-switch" role="group" aria-label="Review a stage">${titles.map((t, i) => `<button class="secondary" data-action="review-stage" data-step="${i}" aria-pressed="${s === i}">${t}</button>`).join("")}</div><button class="text-button" data-action="review-return">Return to ${state.returnScreen === "complete" ? "completion" : "practice"}</button></div>` : ""}<section class="lesson-heading"><h2 tabindex="-1">${headings[s]}</h2></section><section class="workbench" aria-label="${titles[s]} investigation">${visual}${s >= 1 ? "" : `<button class="text-button replay-model" data-action="replay-model">Replay the relationship</button>`}</section><div class="lesson-nav"><button class="text-button" data-action="back">← ${s === 0 && beat === 0 ? "Introduction" : "Back"}</button><span class="reading-position">${beat + 1} / ${(lastBeats[s] ?? 0) + 1}</span>${nextButton(s === 2 && !state.predictionRead ? "Investigate B’s share" : label)}</div>`;
  }
  function practiceVisual() {
    const id = state.inspect,
      e = employees[id],
      q = state.question;
    const revealed = state.checked || state.help > 0;
    const visual = salaryModel(id, {
      view: q === 2 && revealed ? "percent" : "pesos",
      percent: q === 2 && revealed,
      matched: state.repair === "change",
      focus:
        state.repair ||
        (q === 1 && revealed
          ? "original"
          : q === 0 && revealed
            ? "change"
            : ""),
    });

    const prompts = [
      "Look at where the salary started and where it ended. What amount was added?",
      "Which amount tells you what this salary started with?",
      "Which starting salary is the same raise being compared with?",
    ];
    const helpCopy = [
      [
        "Compare the two salary labels. The extra money is what remains after removing the original salary from the new salary.",
        `For ${id}, New − Original is ${e.next} − ${e.original}. The change is +₱2,000. Switch employees and check the other subtraction.`,
      ],
      [
        "The original salary is highlighted. That is the amount before any raise, and it is the whole used to measure growth.",
        `For ${id}, compare the ₱2,000 change with the original ${e.original}: ₱2,000 ÷ ${e.original}. Switch employees: does the same whole belong to both?`,
      ],
      [
        "Compare the separate extra tile with the original. Its matching outline marks an equal amount, not money removed from the original.",
        `For ${id}, ₱2,000 ÷ ${e.original} = ${e.fraction} = ${e.percent}. Switch employees and compare the shares, not only the pesos.`,
      ],
    ];
    return `<div class="view-switch" role="group" aria-label="Inspect an employee">${(["A", "B"] as const).map((key) => `<button class="secondary" data-action="inspect" data-id="${key}" aria-pressed="${id === key}">Employee ${key}</button>`).join("")}</div><div id="practice-detail" tabindex="-1">${visual}${state.help > 0 && !state.checked ? repairControls() : ""}<div class="context-explanation"><h3>${state.checked ? "Check it against the picture" : "Use the salary picture"}</h3><p>${state.checked ? (q === 0 ? `${e.next} − ${e.original} leaves the ₱2,000 increase. The other employee has the same difference.` : q === 1 ? `The ₱2,000 raise is compared with ${id}’s own original ${e.original}, not the new ${e.next}. Switch employees to see why the reference changes.` : `The ₱2,000 raise covers ${details[id].parts} out of 100 parts of ${id}’s original salary: ${e.percent}. The whole—not the cash increase—is different for the other employee.`) : state.help > 0 ? helpCopy[q]![state.help - 1] : prompts[q]}</p></div></div>`;
  }
  function entry() {
    return `<section class="entry"><div class="entry-copy"><h2 tabindex="-1">Making sense<br>of a <em>raise</em></h2><p class="lead">Two employees each get ₱2,000 more a month. Did their salaries grow by the same percentage?</p><p class="entry-description">Start with what changed in pesos. Then use the salary pictures to find what each raise means compared with the amount before it.</p><button class="primary" data-action="start">Explore the raises <span aria-hidden="true">→</span></button></div><div class="entry-art" aria-label="Two employees each receive a two thousand peso increase"><span class="orbit orbit-one" aria-hidden="true"></span><span class="orbit orbit-two" aria-hidden="true"></span><div class="art-title">Two monthly salaries</div><div class="pay-ticket ticket-a">${avatar("A")}<span>Employee A</span><strong>+₱2,000</strong><small>₱20,000 → ₱22,000</small></div><div class="pay-ticket ticket-b">${avatar("B")}<span>Employee B</span><strong>+₱2,000</strong><small>₱10,000 → ₱12,000</small></div><span class="art-question" aria-hidden="true">= % ?</span><span class="art-spark" aria-hidden="true">✳</span><p class="art-caption">How much did each salary grow?</p></div></section><section class="entry-bottom"><span class="mini-icon" aria-hidden="true">${moneyIcon}</span><p><strong>What you’ll learn to explain</strong><br>What a percentage means, which salary to compare with, and why the same raise can give different percentages.</p></section>`;
  }
  function quantityFeedback(
    selected: string | null,
    wanted: string,
    id: Employee,
  ) {
    if (!selected)
      return "Choose a part of the picture to inspect, or read the worked explanation below.";
    const e = employees[id];
    const messages: Record<string, Record<string, string>> = {
      change: {
        change: `Yes. The separate ₱2,000 block is the added money: ${e.next} − ${e.original}.`,
        original: `You selected the starting salary, ${e.original}. That money was already there before the raise. The added money is the separate ₱2,000 block.`,
        new: `You selected the new total, ${e.next}. It includes the starting ${e.original} plus ₱2,000. Look for only the added block, not the whole total.`,
      },
      original: {
        original: `Yes. The starting salary, ${e.original}, is the whole used to measure growth. It belongs below the change in the fraction: the denominator.`,
        change: `You selected the added ₱2,000. That is the change, not the starting whole. Compare it with the salary before the raise, ${e.original}.`,
        new: `You selected the new total, ${e.next}. That is the amount after the raise. To measure growth from the start, use the starting salary, ${e.original}, as the whole.`,
      },
    };
    return (
      messages[wanted]?.[selected] ??
      "Inspect the starting salary and the separate added money."
    );
  }
  function repairControls() {
    const wanted = state.question === 1 ? "original" : "change";
    return `<section class="repair-controls"><h4>Inspect the relationship</h4><p>${wanted === "original" ? "Which part of the picture shows the salary before the raise?" : "Which part of the picture shows only the added money?"}</p><div class="view-switch" role="group" aria-label="Graphical reconsideration">${["original", "change", "new"].map((region) => `<button class="secondary" data-action="repair" data-region="${region}" aria-pressed="${state.repair === region}">${region === "original" ? "Starting salary" : region === "change" ? "Added money" : "New total"}</button>`).join("")}</div><p class="repair-feedback" role="status">${quantityFeedback(state.repair, wanted, state.inspect)}</p><p class="inspection-note">Use the picture to reconsider your practice answer. Inspecting a part does not check or submit that answer.</p></section>`;
  }
  function complete() {
    return "<div data-recap-placeholder></div>";
  }
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ) ?? { matches: true, addEventListener() {}, removeEventListener() {} };
  let runningMotion: Animation[] = [];
  function stopMotion() {
    runningMotion.forEach((animation) => animation.cancel());
    runningMotion = [];
  }
  function animateElement(
    element: Element | null | undefined,
    frames: Keyframe[],
    options: KeyframeAnimationOptions = {},
  ) {
    if (
      !element ||
      reducedMotion.matches ||
      typeof element.animate !== "function"
    )
      return;
    runningMotion.push(
      element.animate(frames, {
        duration: 380,
        easing: "cubic-bezier(.2,.75,.25,1)",
        ...options,
      }),
    );
  }
  function moveIn(element: Element | null | undefined, delay = 0) {
    animateElement(
      element,
      [
        { transform: "translateY(15px)", clipPath: "inset(0 0 100% 0)" },
        { transform: "none", clipPath: "inset(0)" },
      ],
      { duration: 420, delay, fill: "backwards" },
    );
  }
  function mathematicalMotion(scope: Element | null = main) {
    if (!scope) return;
    scope
      .querySelectorAll(".raise-block")
      .forEach((element) =>
        animateElement(
          element,
          [{ transform: "translateX(22px)" }, { transform: "translateX(0)" }],
          { duration: 480 },
        ),
      );
    scope.querySelectorAll(".equivalent-share").forEach((element) =>
      animateElement(
        element,
        [
          { transform: "translateX(150px)", opacity: 0.35 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 600 },
      ),
    );
    // Trace from the selected NEW marker back to the fixed ORIGINAL, then emphasize the difference.
    scope.querySelectorAll(".track.lit .track-line").forEach((line) => {
      animateElement(
        line,
        [
          { transform: "scaleX(0)", transformOrigin: "right" },
          { transform: "scaleX(1)", transformOrigin: "right" },
        ],
        { duration: 520 },
      );
    });
    scope
      .querySelectorAll(".difference")
      .forEach((element) => moveIn(element, 150));
    scope
      .querySelectorAll(
        ".focus-original .original-value, .formula-step-1 .fraction>span:last-child",
      )
      .forEach((element) => {
        animateElement(
          element,
          [
            { boxShadow: "0 0 0 0px #879d65" },
            { boxShadow: "0 0 0 9px #879d6580", offset: 0.45 },
            { boxShadow: "0 0 0 3px #879d6500" },
          ],
          { duration: 680 },
        );
      });
    // Fill fixed 10 or 20 parts, rather than changing any canonical value.
    scope.querySelectorAll(".hundred-grid").forEach((grid) => {
      grid.querySelectorAll(".filled").forEach((square, i) => {
        animateElement(
          square,
          [
            { backgroundColor: "#e4e8d9", transform: "scale(.65)" },
            {
              backgroundColor: getComputedStyle(square).backgroundColor,
              transform: "scale(1)",
            },
          ],
          { delay: i * 22, duration: 300, fill: "backwards" },
        );
      });
    });
    scope
      .querySelectorAll(".calculation .fraction, .formal-equation .fraction")
      .forEach((element) => moveIn(element));
    scope
      .querySelectorAll(
        ".operation-result, .formal-equation>span:last-child, .hundred figcaption",
      )
      .forEach((element) => moveIn(element, 160));
  }
  function playMotion(kind = "step") {
    stopMotion();
    main.dataset.motion = kind;
    if (reducedMotion.matches) return;
    const teaching = main.querySelector("#teaching");
    if (kind === "screen" || kind === "back") {
      animateElement(
        main.querySelector(".workbench, .entry, .consolidation-layout"),
        [
          { transform: `translateX(${kind === "back" ? "-18" : "18"}px)` },
          { transform: "none" },
        ],
        { duration: 340 },
      );
      moveIn(main.querySelector("h2"));
    }
    if (kind === "reveal") {
      moveIn(main.querySelector("#supporting-detail"));
      mathematicalMotion(main.querySelector("#supporting-detail"));
      return;
    }
    if (kind === "selection") return;
    moveIn(teaching?.querySelector("h3"));
    moveIn(teaching?.querySelector(":scope > p"), 90);
    if (kind === "correct" || kind === "retry") {
      const feedback = main.querySelector("#feedback");
      animateElement(
        feedback,
        kind === "correct"
          ? [
              { transform: "scale(.97)", borderLeftWidth: "3px" },
              { transform: "scale(1)", borderLeftWidth: "7px", offset: 0.65 },
              { transform: "none", borderLeftWidth: "3px" },
            ]
          : [
              { transform: "translateX(-7px)" },
              { transform: "translateX(4px)", offset: 0.5 },
              { transform: "none" },
            ],
        { duration: 420 },
      );
      moveIn(main.querySelector(".context-explanation"), 110);
      // Even before optional help, direct reconsideration to the relevant labels without giving an answer away.
      const target = main.querySelector(
        state.question === 1 ? ".original-value" : ".track-labels",
      );
      animateElement(
        target,
        [{ backgroundColor: "#ead9b0" }, { backgroundColor: "transparent" }],
        { duration: 850 },
      );
    }
    if (kind === "complete") {
      animateElement(
        main.querySelector(".completion-seal"),
        [
          { transform: "scale(.6) rotate(-20deg)" },
          { transform: "scale(1) rotate(0deg)" },
        ],
        { duration: 600 },
      );
      moveIn(main.querySelector(".completion h2"), 70);
      moveIn(main.querySelector(".completion .lead"), 140);
      main
        .querySelectorAll(".recap-pair article")
        .forEach((element, index) => moveIn(element, 160 + index * 90));
      moveIn(main.querySelector(".transfer-note"), 260);
    }
    mathematicalMotion();
  }

  function showModelConsequence() {
    const diagrams = [...main.querySelectorAll(".salary-svg")];
    if (!diagrams.length) return;
    const bounds = diagrams.map((element) => element.getBoundingClientRect());
    const top = Math.min(...bounds.map((rect) => rect.top));
    const bottom = Math.max(...bounds.map((rect) => rect.bottom));
    // Keep keyboard focus on the chosen control, but bring the affected bars into view.
    // Instant positioning avoids a scrolling delay before the mathematical transition.
    if (top < 16 || bottom > window.innerHeight - 20) {
      window.scrollTo({
        top: Math.max(0, window.scrollY + top - 90),
        behavior: "instant",
      });
    }
  }
  function stopRecapMotion() {
    recapMotion.forEach((animation) => animation.cancel());
    recapMotion = [];
  }
  function enterRecap(returning: boolean) {
    stopRecapMotion();
    if (!recapHost || props.blocked || reducedMotion.matches) return;
    const targets = returning
      ? [recapHost]
      : [
          recapHost,
          recapHost.querySelector(".completion-seal"),
          recapHost.querySelector('[tabindex="-1"]'),
          recapHost.querySelector(".recap-takeaway"),
          ...recapHost.querySelectorAll(":scope > section"),
        ];
    targets.forEach((target, index) => {
      if (!target?.animate) return;
      const animation = target.animate(
        [
          {
            opacity: 0,
            transform: "translateY(" + (index === 1 ? 6 : 10) + "px)",
          },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: returning ? 240 : 400,
          delay: returning ? 0 : Math.min(index * 45, 225),
          easing: "cubic-bezier(.2,.7,.2,1)",
          fill: "backwards",
        },
      );
      recapMotion.push(animation);
      animation.finished.then(
        () => {
          recapMotion = recapMotion.filter((active) => active !== animation);
        },
        () => {},
      );
    });
  }
  function escape(text: string) {
    const element = document.createElement("span");
    element.textContent = text;
    return element.innerHTML;
  }
  function formative() {
    const q = state.question;
    if (q >= 0 && q <= 2) return "";
    const prompts = [
      "Imagine removing the salary that was already there from the new total. Select the region that would remain.",
      "You are rebuilding the comparison fraction. Select the whole that should sit beneath the added money, then switch employees to investigate its size.",
      "Keep the added tile fixed. Predict which employee’s starting whole it would cover more of, then inspect both pictures.",
    ];
    const regions = q === 2 ? ["A", "B"] : ["original", "change", "new"];
    return (
      '<section class="context-explanation" aria-labelledby="reasoning-title"><h3 id="reasoning-title">Try the relationship</h3><p>' +
      prompts[q] +
      '</p><div class="view-switch" role="group" aria-label="Your reasoning attempt">' +
      regions
        .map(
          (region) =>
            '<button class="secondary" data-action="reason" data-region="' +
            region +
            '" aria-pressed="' +
            (state.attempt === region) +
            '">' +
            (region === "original"
              ? "Starting salary"
              : region === "change"
                ? "Added money"
                : region === "new"
                  ? "New total"
                  : "Employee " + region) +
            "</button>",
        )
        .join("") +
      "</div>" +
      (state.attempt
        ? '<p role="status">' +
          (q === 2
            ? "Your prediction was Employee " +
              state.attempt +
              ". Hold the added money fixed and inspect the two starting wholes: the same tile covers a larger share of the smaller whole. Use the two pictures to reconsider your prediction."
            : quantityFeedback(
                state.attempt,
                q === 1 ? "original" : "change",
                state.inspect,
              )) +
          "</p><p>Use the picture to explore, or continue when you are ready.</p>"
        : "<p>Choose a part to inspect its relationship to the whole.</p>") +
      "</section>"
    );
  }
  function practice() {
    const q = state.question + 1;
    const copy = (role: string) =>
      props.frame.contentReferences.find(
        (item) => item.id === "c04/S02/q" + q + "-" + role,
      )?.text ?? "";
    const feedback = props.frame.feedbackState;
    const show = feedback;
    state.checked = !!show && feedback?.outcome === "CONFIRMED";
    const enabled = (intent: Parameters<C04Presentation["onIntent"]>[0]) =>
      !props.blocked && props.frame.allowedLearnerIntents.includes(intent);
    const editable =
      props.frame.allowedLearnerIntents.includes("RESPONSE_CHANGED");
    const field = props.fields?.[0];
    const feedbackMarkup = show
      ? '<div id="feedback" class="feedback ' +
        (feedback.outcome === "CONFIRMED" ? "correct" : "retry") +
        '" tabindex="-1" data-content-id="' +
        escape(feedback.content.id) +
        '" data-presentation-identity="' +
        escape(props.presentationIdentity ?? "") +
        '"><h3>' +
        (feedback.outcome === "CONFIRMED"
          ? "That reasoning fits."
          : "Take another look.") +
        "</h3><p>" +
        escape(feedback.content.text) +
        "</p></div>"
      : "";
    return (
      '<section class="check-header"><p class="practice-count">Guided practice · ' +
      q +
      ' of 3</p><h2 tabindex="-1">' +
      escape(copy("title")) +
      '</h2><p class="lead">' +
      escape(copy("prompt")) +
      '</p></section><div class="consolidation-layout"><section class="choice-panel" aria-label="Your comparison"><fieldset ' +
      (!editable ? "disabled" : "") +
      "><legend>Choose one statement</legend>" +
      (field?.options ?? [])
        .map(
          (option) =>
            '<label class="choice ' +
            (selected === option.id ? "selected" : "") +
            '"><input type="radio" name="answer" value="' +
            escape(option.id) +
            '" ' +
            (selected === option.id ? "checked" : "") +
            "><span>" +
            escape(option.text) +
            "</span></label>",
        )
        .join("") +
      "</fieldset>" +
      feedbackMarkup +
      (feedback?.outcome === "CONFIRMED" ? formative() : "") +
      (editable
        ? '<button class="primary" data-action="primary-check" ' +
          (!enabled("CHECK_RESPONSE") && !enabled("CHECK_AGAIN")
            ? "disabled"
            : "") +
          ">Check my reasoning →</button>"
        : "") +
      (feedback?.outcome === "RECONSIDERATION"
        ? '<button class="primary" data-action="primary-revise">Reconsider my selection</button><button class="text-button" data-action="help">' +
          (state.help === 0
            ? "Help me inspect the comparison"
            : state.help === 1
              ? "Connect it to the calculation"
              : "Both help steps shown") +
          "</button>"
        : "") +
      (enabled("NEXT_GUIDED_QUESTION")
        ? '<button class="primary" data-action="primary-next">Next idea →</button>'
        : "") +
      (enabled("FINISH_ACTIVITY")
        ? '<button class="' +
          (q === 3 && feedback?.outcome === "CONFIRMED"
            ? "primary"
            : "text-button") +
          '" data-action="primary-finish">' +
          (q === 3 && feedback?.outcome === "CONFIRMED"
            ? "See your recap →"
            : "Finish guided practice") +
          "</button>"
        : "") +
      '</section><aside class="practice-visual" aria-label="Inspect the salary relationship">' +
      (q === 1 && feedback
        ? "<div data-question-one></div>"
        : q === 2 && feedback
          ? "<div data-question-two></div>"
          : q === 3 && feedback
            ? "<div data-question-three></div>"
            : practiceVisual()) +
      '</aside></div><div class="lesson-nav"><button class="text-button" data-action="return-lesson">← Revisit the explanation</button></div>'
    );
  }
  function authorized(id: Employee, percentage = false) {
    const record = props.reference?.[id];
    return (
      record?.original === (id === "A" ? "20000" : "10000") &&
      record.next === (id === "A" ? "22000" : "12000") &&
      record.difference === "2000" &&
      (!percentage || record.percentage === (id === "A" ? "10" : "20"))
    );
  }
  function inspectionModel(id: Employee) {
    const record = props.reference?.[id];
    if (
      record?.original !== (id === "A" ? "20000" : "10000") ||
      record.next !== (id === "A" ? "22000" : "12000")
    )
      return '<p role="status">The current production facts do not authorize this picture.</p>';
    // Reuse the V1 artwork, but remove every derived label AND geometric encoding.
    // Unsegmented original width represents only the already exposed starting salary.
    const template = document.createElement("template");
    template.innerHTML = salaryModel(id);
    template.content
      .querySelectorAll(
        ".raise-block, .total-bracket, .tile-divider, .addition-label, .model-key, .model-note, .model-controls, .result-label, .model-total",
      )
      .forEach((element) => element.remove());
    const svg = template.content.querySelector("svg");
    svg?.setAttribute(
      "aria-label",
      "Employee " +
        id +
        ": starting salary " +
        employees[id].original +
        ". Inspect the salary relationship to investigate the added money.",
    );
    const figure = template.content.querySelector("figure");
    // Only keep source-owned avatar/heading, original label and unsegmented original SVG.
    figure
      ?.querySelectorAll(
        ":scope > :not(.model-heading):not(.model-labels):not(svg)",
      )
      .forEach((element) => element.remove());
    return (
      template.innerHTML +
      '<p class="inspection-note">New salary ' +
      employees[id].next +
      '. Select the picture to investigate what changed.</p><button class="primary" data-action="engage">Inspect the added money →</button>'
    );
  }
  function render(focus = false, motion = "step") {
    stopMotion();
    const showingRecap = phase === "COMPLETE" && !state.reviewing;
    const enteringRecap =
      showingRecap && !props.blocked && (!recapVisible || !recapVisited);
    if (!showingRecap || props.blocked) stopRecapMotion();
    const recapFocus = recapHost?.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : null;
    const retainedEmployeeHost = main.querySelector<HTMLElement>(
      ".employee-explanation-host",
    );
    const retainedEmployeeFocus = retainedEmployeeHost?.contains(
      document.activeElement,
    )
      ? (document.activeElement as HTMLElement)
      : null;
    const retainedComparisonHost = main.querySelector<HTMLElement>(
      ".comparison-explanation-host",
    );
    const retainedComparisonFocus = retainedComparisonHost?.contains(
      document.activeElement,
    )
      ? (document.activeElement as HTMLElement)
      : null;
    const retainedFormulaHost = main.querySelector<HTMLElement>(
      ".formula-explanation-host",
    );
    const retainedFormulaFocus = retainedFormulaHost?.contains(
      document.activeElement,
    )
      ? (document.activeElement as HTMLElement)
      : null;
    const retainedQuestionOne = main.querySelector<HTMLElement>(
      "[data-question-one]",
    );
    const retainedQuestionFocus = retainedQuestionOne?.contains(
      document.activeElement,
    )
      ? (document.activeElement as HTMLElement)
      : null;
    const retainedQuestionTwo = main.querySelector<HTMLElement>(
      "[data-question-two]",
    );
    const retainedQuestionTwoFocus = retainedQuestionTwo?.contains(
      document.activeElement,
    )
      ? (document.activeElement as HTMLElement)
      : null;
    const retainedQuestionThree = main.querySelector<HTMLElement>(
      "[data-question-three]",
    );
    const retainedQuestionThreeFocus = retainedQuestionThree?.contains(
      document.activeElement,
    )
      ? (document.activeElement as HTMLElement)
      : null;
    const s = state.step;
    const id: Employee = s === 2 ? "B" : "A";
    const investigation = s === 1 || s === 2;
    if (state.reviewing) main.innerHTML = lesson();
    else if (phase === "ENTRY") main.innerHTML = entry();
    else if (phase === "COMPLETE") main.innerHTML = complete();
    else if (investigation && !authorized(id, true)) {
      main.innerHTML =
        progress() +
        '<section class="lesson-heading"><h2 tabindex="-1">' +
        headings[s] +
        '</h2></section><section class="workbench"><div class="investigation"><div>' +
        inspectionModel(id) +
        "</div>" +
        teaching(
          "Investigate the salary relationship",
          "Select the salary model to inspect what changed. The starting salary stays intact; the raise is a separate addition.",
        ) +
        "</div></section>";
    } else if (phase.startsWith("EXP-")) {
      const ready =
        s === 0
          ? authorized("A") && authorized("B")
          : s < 3
            ? authorized(id, true)
            : authorized("A", true) && authorized("B", true);
      main.innerHTML = ready
        ? lesson()
        : '<p role="status">The current production facts do not authorize this explanation.</p>';
    } else main.innerHTML = practice();
    const recapPlaceholder = main.querySelector("[data-recap-placeholder]");
    if (recapPlaceholder) {
      if (!recapHost) {
        const template = document.createElement("template");
        template.innerHTML = recap(state.question);
        recapHost = template.content.firstElementChild as HTMLElement;
      }
      recapHost.querySelector("[data-recap-stage]")!.textContent =
        "Guided practice ended at question " + (state.question + 1) + " of 3.";
      recapPlaceholder.replaceWith(recapHost);
      recapHost
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((button) => {
          button.disabled = props.blocked;
        });
      const recapTarget =
        props.blocked && recapFocus instanceof HTMLButtonElement
          ? recapHost.querySelector<HTMLElement>('[tabindex="-1"]')
          : recapFocus;
      recapTarget?.focus({ preventScroll: true });
    }
    main.classList.toggle("recap-viewport", showingRecap);
    if (enteringRecap) {
      enterRecap(recapVisited);
      recapVisited = true;
    }
    recapVisible = showingRecap;
    if (
      (phase === "EXP-02" || (state.reviewing && s === 1)) &&
      authorized("A", true)
    ) {
      const investigation = main.querySelector<HTMLElement>(".investigation");
      if (investigation) {
        investigation.replaceChildren(
          retainedEmployeeHost ??
            Object.assign(document.createElement("div"), {
              className: "employee-explanation-host",
            }),
        );
        employeeExplanation.mount(
          investigation.firstElementChild as HTMLElement,
          avatar("A"),
          state.beats[1] ?? 0,
          props.blocked,
        );
        retainedEmployeeFocus?.focus({ preventScroll: true });
      }
    } else employeeExplanation.detach();
    if (
      (phase === "EXP-03" || (state.reviewing && s === 2)) &&
      (state.predictionRead || (state.reviewing && phase === "COMPLETE")) &&
      authorized("B", true)
    ) {
      const investigation = main.querySelector<HTMLElement>(".investigation");
      if (investigation) {
        investigation.replaceChildren(
          retainedEmployeeHost ??
            Object.assign(document.createElement("div"), {
              className: "employee-explanation-host",
            }),
        );
        employeeBExplanation.mount(
          investigation.firstElementChild as HTMLElement,
          avatar("B"),
          state.beats[2] ?? 0,
          props.blocked,
        );
        retainedEmployeeFocus?.focus({ preventScroll: true });
      }
    } else employeeBExplanation.detach();
    const comparisonHost = main.querySelector<HTMLElement>(
      ".comparison-explanation-host",
    );
    if (
      (phase === "EXP-04" || (state.reviewing && s === 3)) &&
      authorized("A", true) &&
      authorized("B", true) &&
      comparisonHost
    ) {
      const host = retainedComparisonHost ?? comparisonHost;
      if (host !== comparisonHost) comparisonHost.replaceWith(host);
      comparisonExplanation.mount(
        host,
        [avatar("A"), avatar("B")],
        state.beats[3] ?? 0,
        props.blocked,
      );
      retainedComparisonFocus?.focus({ preventScroll: true });
    } else comparisonExplanation.detach();
    const formulaHost = main.querySelector<HTMLElement>(
      ".formula-explanation-host",
    );
    if (
      (phase === "EXP-05" || (state.reviewing && s === 4)) &&
      authorized("A", true) &&
      authorized("B", true) &&
      formulaHost
    ) {
      const host = retainedFormulaHost ?? formulaHost;
      if (host !== formulaHost) formulaHost.replaceWith(host);
      formulaExplanation.mount(
        host,
        avatar("A"),
        state.beats[4] ?? 0,
        props.blocked,
      );
      retainedFormulaFocus?.focus({ preventScroll: true });
    } else formulaExplanation.detach();
    let questionOne = main.querySelector<HTMLElement>("[data-question-one]");
    // Q1 post-feedback uses the same previously taught fixed salary pictures as
    // practiceVisual; practice frames intentionally omit authored-focus facts.
    const fixedPractice =
      props.reference?.A?.original === "20000" &&
      props.reference?.A?.next === "22000" &&
      props.reference?.B?.original === "10000" &&
      props.reference?.B?.next === "12000";
    if (questionOne && fixedPractice && props.frame.feedbackState) {
      if (retainedQuestionOne) {
        questionOne.replaceWith(retainedQuestionOne);
        questionOne = retainedQuestionOne;
      }
      mountQuestionOne(
        questionOne,
        props.frame.feedbackState.outcome === "RECONSIDERATION",
        [avatar("A"), avatar("B")],
        props.blocked,
        state.help,
      );
      retainedQuestionFocus?.focus({ preventScroll: true });
    } else if (retainedQuestionOne) detachQuestionOne(retainedQuestionOne);
    let questionTwo = main.querySelector<HTMLElement>("[data-question-two]");
    if (questionTwo && fixedPractice && props.frame.feedbackState) {
      if (retainedQuestionTwo) {
        questionTwo.replaceWith(retainedQuestionTwo);
        questionTwo = retainedQuestionTwo;
      }
      mountQuestionTwo(
        questionTwo,
        props.frame.feedbackState.outcome === "RECONSIDERATION",
        [avatar("A"), avatar("B")],
        props.blocked,
        state.help,
      );
      retainedQuestionTwoFocus?.focus({ preventScroll: true });
    } else if (retainedQuestionTwo) detachQuestionTwo(retainedQuestionTwo);
    let questionThree = main.querySelector<HTMLElement>(
      "[data-question-three]",
    );
    if (questionThree && fixedPractice && props.frame.feedbackState) {
      if (retainedQuestionThree) {
        questionThree.replaceWith(retainedQuestionThree);
        questionThree = retainedQuestionThree;
      }
      mountQuestionThree(
        questionThree,
        props.frame.feedbackState.outcome === "RECONSIDERATION",
        [avatar("A"), avatar("B")],
        props.blocked,
        state.help,
      );
      retainedQuestionThreeFocus?.focus({ preventScroll: true });
    } else if (retainedQuestionThree)
      detachQuestionThree(retainedQuestionThree);
    main.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = button.disabled || props.blocked;
    });
    const libraryReturn = main.querySelector('[data-action="return-library"]');
    if (libraryReturn)
      libraryReturn.textContent = "Return to the Learning Library";
    const next = main.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (
      next &&
      !state.reviewing &&
      state.beats[s] === lastBeats[s] &&
      !props.frame.allowedLearnerIntents.includes("CONTINUE")
    )
      next.disabled = true;
    // Employee A owns absolute-time transforms; inherited entrance motion must not replay them.
    if (
      phase !== "COMPLETE" &&
      !main.querySelector(
        ".employee-explanation-host, .comparison-explanation-host, .formula-explanation-host, [data-question-three]",
      )
    )
      playMotion(motion);
    const currentViewport =
      phase +
      "/" +
      props.frame.responseStage +
      "/" +
      state.reviewing +
      "/" +
      state.step;
    if (
      focus ||
      (viewportIdentity !== currentViewport &&
        !(phase === "ENTRY" && viewportIdentity === ""))
    ) {
      viewportIdentity = currentViewport;
      const heading = main.querySelector<HTMLElement>(
        ".lesson-heading h2, .check-header h2, .completion h2, .entry h2",
      );
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView?.({ block: "start", behavior: "instant" });
    }
    viewportIdentity = currentViewport;
    const feedback = main.querySelector<HTMLElement>(
      "#feedback[data-content-id]",
    );
    if (feedback && !props.blocked) props.onPresented?.("feedback", feedback);
  }
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (!button || button.disabled || props.blocked) return;
    const action = button.dataset.action;
    if (action === "primary-check") {
      props.onIntent(
        props.frame.allowedLearnerIntents.includes("CHECK_RESPONSE")
          ? "CHECK_RESPONSE"
          : "CHECK_AGAIN",
      );
      return;
    }
    if (action === "primary-revise") {
      props.onIntent("REVISE");
      return;
    }
    if (action === "primary-next") {
      props.onIntent("NEXT_GUIDED_QUESTION");
      return;
    }
    if (action === "primary-finish") {
      props.onIntent("FINISH_ACTIVITY");
      return;
    }
    if (action === "reason") {
      state.attempt = button.dataset.region ?? null;
      state.repair = state.question < 2 ? state.attempt : null;
      render(false, "model");
      main.querySelector<HTMLElement>("#feedback")?.focus();
      return;
    }
    if (action === "inspect") {
      state.inspect = button.dataset.id === "B" ? "B" : "A";
      render(false, "model");
      main
        .querySelector<HTMLButtonElement>(
          '[data-action="inspect"][data-id="' + state.inspect + '"]',
        )
        ?.focus();
      return;
    }
    if (action === "help") {
      state.help = Math.min(2, state.help + 1);
      render();
      main
        .querySelector<HTMLElement>(
          state.question === 0
            ? "#q1-help"
            : state.question === 1
              ? "#q2-help"
              : "#q3-help",
        )
        ?.focus({ preventScroll: true });
      return;
    }
    if (action === "repair") {
      state.repair = button.dataset.region ?? null;
      render();
      main.querySelector<HTMLElement>("#practice-detail")?.focus();
      return;
    }
    if (action === "review" || action === "return-lesson") {
      state.reviewing = true;
      state.returnScreen = phase === "COMPLETE" ? "complete" : "practice";
      state.step = action === "review" ? 0 : 4;
      render(true);
      return;
    }
    if (action === "review-return") {
      state.reviewing = false;
      render(true);
      return;
    }
    if (action === "review-stage") {
      state.step = Number(button.dataset.step);
      render(true);
      return;
    }
    if (action === "return-library") {
      props.onReturnToLibrary?.();
      return;
    }
    const s = state.step;
    const employee: Employee = s === 2 ? "B" : "A";
    if (action === "start") {
      props.onIntent("CONTINUE");
      return;
    }
    if (action === "engage") {
      props.onSelect("C04-S02-" + employee);
      return;
    }
    if (action === "next") {
      if (s === 2 && !state.predictionRead) {
        state.predictionRead = true;
        render(true);
        return;
      }
      if (state.beats[s]! < lastBeats[s]!) {
        state.beats[s]!++;
        if ((s === 1 || s === 2) && state.beats[s] === 2)
          state.modelView = "percent";
        if (s === 3 && state.beats[s] === 1) state.compareView = "percent";
        render(false);
        main.querySelector<HTMLElement>("#teaching")?.focus();
      } else if (state.reviewing) {
        if (s < 4) state.step++;
        else state.reviewing = false;
        render(true);
      } else props.onIntent("CONTINUE");
      return;
    }
    if (action === "back") {
      if (state.beats[s]! > 0) {
        state.beats[s]!--;
        render(true, "back");
      } else if (state.reviewing) {
        state.step = Math.max(0, s - 1);
        render(true);
      } else props.onIntent("PREVIOUS");
      return;
    }
    if (action === "replay-model") {
      playMotion("model");
      showModelConsequence();
      return;
    }
    if (action === "match" || action === "model-view") {
      if (s === 1 || s === 2) props.onSelect("C04-S02-" + employee);
      if (action === "match") state.matched = !state.matched;
      else state.modelView = state.modelView === "pesos" ? "percent" : "pesos";
    } else if (action === "view")
      state.compareView = button.dataset.view ?? "pesos";
    else if (action === "predict")
      state.prediction = button.dataset.value ?? null;
    else if (action === "role") state.role = button.dataset.role ?? null;
    else return;
    render(false, "model");
    showModelConsequence();
    main
      .querySelector<HTMLButtonElement>('[data-action="' + action + '"]')
      ?.focus({ preventScroll: true });
    announce(
      main.querySelector<HTMLElement>(".role-feedback, #prediction-feedback")
        ?.innerText ??
        "The salaries stay the same. The picture changes how we compare them.",
    );
  };
  const motionChange = () => {
    if (reducedMotion.matches) {
      stopMotion();
      stopRecapMotion();
    }
  };
  main.addEventListener("click", click);
  const change = (event: Event) => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      input.name !== "answer" ||
      props.blocked
    )
      return;
    const field = props.fields?.[0];
    if (!field?.options?.some((option) => option.id === input.value)) return;
    selected = input.value;
    props.onDraft?.({ [field.role]: selected });
  };
  main.addEventListener("change", change);
  reducedMotion.addEventListener("change", motionChange);
  return {
    update(next: C04Presentation) {
      props = next;
      const identity =
        next.draftIdentity?.split("/").slice(0, -2).join("/") +
        "/" +
        next.frame.responseStage +
        "/" +
        next.presentationIdentity?.split("/").slice(-1)[0];
      if (practiceIdentity !== identity) {
        practiceIdentity = identity;
        selected = "";
        state.help = 0;
        state.attempt = null;
        state.repair = null;
      }
      selected = next.selectedGuidedOption ?? selected;
      state.question = Math.max(
        0,
        ["PESO_COMPARISON", "REFERENCE_PAIR", "PERCENTAGE_COMPARISON"].indexOf(
          next.frame.responseStage ?? "",
        ),
      );
      if (phase !== next.frame.stateId) {
        phase = next.frame.stateId;
        state.step = phase.startsWith("EXP-") ? Number(phase.slice(4)) - 1 : 0;
        state.matched = false;
        state.modelView = "pesos";
        state.role = null;
      }
      render();
    },
    dispose() {
      const questionThree = main.querySelector<HTMLElement>(
        "[data-question-three]",
      );
      if (questionThree) detachQuestionThree(questionThree);
      const questionTwo = main.querySelector<HTMLElement>(
        "[data-question-two]",
      );
      if (questionTwo) detachQuestionTwo(questionTwo);
      const questionOne = main.querySelector<HTMLElement>(
        "[data-question-one]",
      );
      if (questionOne) detachQuestionOne(questionOne);
      employeeExplanation.dispose();
      employeeBExplanation.dispose();
      comparisonExplanation.dispose();
      formulaExplanation.dispose();
      stopMotion();
      stopRecapMotion();
      main.classList.remove("recap-viewport");
      main.removeEventListener("click", click);
      main.removeEventListener("change", change);
      reducedMotion.removeEventListener("change", motionChange);
      main.replaceChildren();
    },
  };
}
