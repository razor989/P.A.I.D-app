type Investigation = {
  incorrect: boolean;
  update(blocked: boolean, help: number): void;
  dispose(): void;
};
const investigations = new WeakMap<HTMLElement, Investigation>();

/** Departure ends this presentation-local investigation; nothing is persisted. */
export function detachQuestionOne(host: HTMLElement) {
  investigations.get(host)?.dispose();
  investigations.delete(host);
}

/** Local investigations only: never dispatches an assessment or Session event. */
export function mountQuestionOne(
  host: HTMLElement,
  incorrect: boolean,
  portraits: readonly string[],
  blocked: boolean,
  help = 0,
) {
  const existing = investigations.get(host);
  if (existing?.incorrect === incorrect) {
    existing.update(blocked, help);
    return;
  }
  detachQuestionOne(host);
  let helpStep = 0;
  let reasoning: string | null = null;
  let mode = incorrect ? "original" : "pesos";
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const animations: Animation[] = [];
  const stop = () => {
    animations.splice(0).forEach((animation) => animation.cancel());
  };
  const draw = () => {
    const share = mode === "shares";
    host.innerHTML = `<section class="q1-laboratory" aria-labelledby="q1-lab-title"><p class="story-kicker">${incorrect ? "SEPARATE WHAT WAS THERE FROM WHAT IS NEW" : "SAME MONEY · DIFFERENT STARTING POINTS"}</p><h3 id="q1-lab-title">${incorrect ? "A total is not a raise" : "What changes when we change the scale?"}</h3><p>${incorrect ? "The new salary includes the original salary. Set aside the original part in both pictures. Watch what remains." : "Keep the gold additions fixed. First compare pesos; then give each starting salary the same 100% width. Does either employee receive more money?"}</p>
      <div class="view-switch" role="group" aria-label="Investigate the two salaries">${(incorrect
        ? [
            ["original", "Show the new totals"],
            ["separate", "Set aside the originals"],
          ]
        : [
            ["pesos", "Compare pesos"],
            ["shares", "Compare shares of the original"],
          ]
      )
        .map(
          ([id, label]) =>
            `<button data-q1-mode="${id}" aria-pressed="${mode === id}" ${blocked ? "disabled" : ""}>${label}</button>`,
        )
        .join("")}</div>
      <div class="q1-pair">${(["A", "B"] as const)
        .map((id, i) => {
          const width = share || id === "A" ? 200 : 100;
          const added = share && id === "B" ? 40 : 20;
          return `<figure><div class="story-heading">${portraits[i]}<strong>Employee ${id}</strong></div><div class="q1-diagram"><div class="q1-anchor q1-anchor-original"><span>Original salary</span><strong>${i === 0 ? "₱20,000" : "₱10,000"}</strong></div><svg viewBox="0 0 264 115" role="img" aria-label="Employee ${id}: original ${i === 0 ? "₱20,000" : "₱10,000"}; added ₱2,000"><g class="q1-original" style="transform:translateY(0px)"><rect class="story-original" x="4" y="12" width="${width}" height="28" rx="3"/></g><g class="q1-added" style="transform:translateX(${width + 8}px)"><rect class="raise-block" x="0" y="12" width="${added}" height="28" rx="3"/></g></svg><div class="q1-anchor q1-anchor-added"><span>Added money</span><strong>+₱2,000</strong></div></div><p class="q1-equation">${incorrect ? "New total: " + (i === 0 ? "₱22,000" : "₱12,000") : "One shared scale · compare the added money"}</p></figure>`;
        })
        .join("")}</div>
      <section class="q1-insight" aria-labelledby="q1-insight-title"><p class="story-kicker">READ THE MODEL</p><h4 id="q1-insight-title">${incorrect ? "A total includes the starting salary" : "Same addition, different reference wholes"}</h4><p class="q1-insight-copy" role="status">${incorrect ? "Compare the gold additions, not the full new totals." : "Switch scales to distinguish added pesos from percentage growth."}</p></section><section class="q1-help" id="q1-help" tabindex="-1" aria-labelledby="q1-help-title" hidden><h4 id="q1-help-title"></h4><p></p></section></section>`;
  };
  draw();
  // Draw once. Mode changes update the retained picture and controls in place.
  const update = (nextBlocked: boolean, nextHelp: number) => {
    blocked = nextBlocked;
    host.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = blocked;
    });
    if (blocked) stop();
    if (incorrect && nextHelp > helpStep) {
      helpStep = nextHelp;
      const panel = host.querySelector<HTMLElement>(".q1-help")!;
      panel.hidden = false;
      panel.querySelector("h4")!.textContent =
        helpStep === 1
          ? "Inspect only what was added"
          : "Connect each picture to subtraction";
      panel.querySelector("p")!.textContent =
        helpStep === 1
          ? "The green parts were already there. Set them aside in this comparison; the equal gold additions remain. No salary is lost."
          : "A: ₱22,000 − ₱20,000 = ₱2,000. B: ₱12,000 − ₱10,000 = ₱2,000. Both differences measure added pesos, not the new totals.";
      host
        .querySelector<HTMLButtonElement>('[data-q1-mode="separate"]')!
        .click();
      host.querySelectorAll<HTMLElement>(".q1-equation").forEach((element) => {
        element.hidden = helpStep < 2;
      });
    }
  };
  const change = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-q1-mode]",
    );
    if (!button || blocked) return;
    const nextMode = button.dataset.q1Mode!;
    if (mode === nextMode) return;
    const elements = [
      ...host.querySelectorAll<SVGElement>(".q1-original,.q1-added,.q1-scale"),
    ];
    const previous = elements.map(
      (element) => getComputedStyle(element).transform,
    );
    stop();
    mode = nextMode;
    host.querySelector("#q1-insight-title")!.textContent = incorrect
      ? mode === "separate"
        ? "The originals stay accounted for"
        : "A total includes the starting salary"
      : "Scale changes · money stays the same";
    const share = mode === "shares",
      removed = mode === "separate";
    host
      .querySelectorAll<HTMLButtonElement>("[data-q1-mode]")
      .forEach((control) =>
        control.setAttribute(
          "aria-pressed",
          String(control.dataset.q1Mode === mode),
        ),
      );
    host.querySelectorAll("figure").forEach((figure, index) => {
      const original = figure.querySelector<SVGElement>(".q1-original")!;
      const addition = figure.querySelector<SVGElement>(".q1-added")!;
      const width = index === 0 || share ? 200 : 100;
      original.style.transform = `translateY(${removed ? 44 : 0}px)`;
      addition.style.transform = `translateX(${removed ? 4 : width + 8}px)`;
      figure.querySelectorAll<SVGElement>(".q1-scale").forEach((rect) => {
        rect.style.transform = `scaleX(${share && index === 1 ? 2 : 1})`;
      });
      figure.querySelector(".q1-anchor-original span")!.textContent = removed
        ? "Original set aside; not lost"
        : share
          ? "Original: 100%"
          : "Original salary";
      figure.querySelector(".q1-anchor-added span")!.textContent = share
        ? "Increase: " + (index === 0 ? "10%" : "20%")
        : "Added money";
      figure
        .querySelector(".q1-diagram")!
        .setAttribute("data-separated", String(removed));
      figure
        .querySelector("svg")!
        .setAttribute(
          "aria-label",
          `Employee ${index === 0 ? "A" : "B"}: ${removed ? "original set aside, not lost" : share ? "original 100%" : "original salary"}; added ₱2,000`,
        );
      figure.querySelector(".q1-equation")!.textContent = incorrect
        ? removed
          ? `${index === 0 ? "₱22,000 − ₱20,000" : "₱12,000 − ₱10,000"} = ₱2,000`
          : `New total: ${index === 0 ? "₱22,000" : "₱12,000"}`
        : share
          ? `${index === 0 ? "₱2,000 / ₱20,000 = 0.10 = 10%" : "₱2,000 / ₱10,000 = 0.20 = 20%"}`
          : "One shared scale: equal gold widths mean equal pesos.";
    });
    host.querySelector(".q1-insight-copy")!.textContent = incorrect
      ? removed
        ? "Both originals are set aside—not lost. Each remaining gold block is ₱2,000. Comparing the new totals would include money earned before the raise."
        : "A new total contains the original and the addition. Compare only the gold additions to measure the raise."
      : share
        ? "B’s gold block looks twice as wide because B’s whole is half as much money. Both employees still gain ₱2,000. A larger percentage does not mean more pesos."
        : "The original bars differ, but the added blocks match. Switching to shares changes the reference scale, not the salary amounts.";
    if (!reduced?.matches)
      elements.forEach((element, index) => {
        const animation = element.animate?.(
          [
            { transform: previous[index] },
            { transform: element.style.transform || "none" },
          ],
          { duration: 700, easing: "ease-in-out" },
        );
        if (animation) {
          animations.push(animation);
          animation.onfinish = () => {
            const index = animations.indexOf(animation);
            if (index >= 0) animations.splice(index, 1);
          };
        }
      });
    button.focus({ preventScroll: true });
  };
  host
    .querySelectorAll<SVGElement>(".q1-pair figure > .q1-diagram > svg rect")
    .forEach((rect) => {
      if (
        (rect.classList.contains("story-original") &&
          rect.getAttribute("width") === "100") ||
        rect.classList.contains("raise-block")
      )
        rect.classList.add("q1-scale");
      rect.style.transformOrigin = `${rect.getAttribute("x")}px 0px`;
    });
  const motionChange = () => {
    if (reduced?.matches) stop();
  };
  host.addEventListener("click", change);
  reduced?.addEventListener("change", motionChange);
  investigations.set(host, {
    incorrect,
    update,
    dispose() {
      stop();
      host.removeEventListener("click", change);
      reduced?.removeEventListener("change", motionChange);
    },
  });
  if (!incorrect) {
    const task = document.createElement("section");
    task.className = "q1-reasoning";
    task.setAttribute("aria-labelledby", "q1-reason-title");
    task.innerHTML =
      '<p class="story-kicker">WHY IS THAT TRUE?</p><h4 id="q1-reason-title">Which comparison establishes the same increase in pesos?</h4><p>Choose the relationship that supports your answer. This is a reasoning check, not another graded answer.</p><div class="q1-reason-choices" role="group" aria-label="Your reasoning">' +
      [
        ["difference", "Compare each new salary minus its original"],
        ["total", "Compare the two new salaries"],
        ["percentage", "Compare their percentage increases"],
      ]
        .map(
          ([value, label]) =>
            '<button data-q1-reason="' +
            value +
            '" aria-pressed="false">' +
            label +
            "</button>",
        )
        .join("") +
      '</div><p class="q1-reason-feedback" role="status"></p>';
    host.querySelector(".q1-laboratory")!.prepend(task);
    const reveal = () =>
      host
        .querySelectorAll<HTMLElement>(
          ".q1-laboratory > .view-switch,.q1-pair,.q1-insight",
        )
        .forEach((element) => {
          element.hidden = reasoning === null;
        });
    reveal();
    task.onclick = (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-q1-reason]",
      );
      if (!button || blocked) return;
      reasoning = button.dataset.q1Reason!;
      task
        .querySelectorAll("button")
        .forEach((control) =>
          control.setAttribute("aria-pressed", String(control === button)),
        );
      task.querySelector(".q1-reason-feedback")!.textContent =
        reasoning === "difference"
          ? "That relationship supports your answer: each new-minus-original difference is ₱2,000. Inspect the pictures to check the same added amount."
          : reasoning === "total"
            ? "New totals include the original money. Compare each new-minus-original difference instead; inspect the additions below and reconsider your reasoning."
            : "Percentages compare growth with different starting wholes, not added pesos. Use new minus original for each employee, then reconsider your reasoning.";
      reveal();
    };
  }
  update(blocked, help);
}
