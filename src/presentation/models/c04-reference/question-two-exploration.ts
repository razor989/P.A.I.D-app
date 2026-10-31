type Investigation = {
  incorrect: boolean;
  update(blocked: boolean, help: number): void;
  dispose(): void;
};
const investigations = new WeakMap<HTMLElement, Investigation>();

/** Q02 state is presentation-local: no assessment, storage or Session events. */
export function detachQuestionTwo(host: HTMLElement) {
  investigations.get(host)?.dispose();
  investigations.delete(host);
}

export function mountQuestionTwo(
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
  detachQuestionTwo(host);
  let step = 0;
  let reason: string | null = null;
  let repair: string | null = null;
  const choices = incorrect
    ? [
        ["original", "Starting salary"],
        ["change", "Added money"],
        ["new", "New total"],
      ]
    : [
        [
          "own",
          "Each raise is compared with that employee’s own starting salary",
        ],
        [
          "shared",
          "Equal added money means both calculations need one shared denominator",
        ],
        ["new", "Growth should be compared with the new salaries"],
      ];
  host.innerHTML = `<section class="q2-laboratory" aria-labelledby="q2-title">
    <p class="story-kicker">${incorrect ? "FIND EACH STARTING WHOLE" : "WHY IS THAT TRUE?"}</p>
    <h3 id="q2-title">${incorrect ? "Whose original belongs underneath?" : "Why does this pair use different denominators?"}</h3>
    <p>${incorrect ? "Keep each employee’s added money with that employee’s own starting amount. Inspect both pictures; neither starting salary is removed." : "Choose a relationship, then inspect the model evidence. This optional reasoning check is not another graded answer."}</p>
    <section class="q2-help" id="q2-help" tabindex="-1" aria-labelledby="q2-help-title" hidden><h4 id="q2-help-title"></h4><p role="status"></p></section>
    <section class="q2-task" ${incorrect ? "hidden" : ""} aria-labelledby="q2-task-title"><h4 id="q2-task-title">${incorrect ? "Which part is the salary before the raise?" : "Your reasoning"}</h4><div class="q2-choices" role="group" aria-label="${incorrect ? "Inspect a salary part" : "Your Q02 reasoning"}">${choices.map(([id, label]) => `<button class="secondary" data-q2-choice="${id}" aria-pressed="false">${label}</button>`).join("")}</div><p id="q2-response" class="q2-response" tabindex="-1" role="status" hidden></p></section>
    <div class="q2-pair" ${incorrect ? "" : "hidden"}>${["A", "B"].map((id, index) => `<figure class="q2-model" data-employee="${id}"><div class="story-heading">${portraits[index] ?? ""}<h4>Employee ${id}</h4></div><div class="q2-labels"><div class="q2-original-label"><span>Starting salary</span><strong>${index === 0 ? "₱20,000" : "₱10,000"}</strong></div><div class="q2-added-label"><span>Added money</span><strong>+₱2,000</strong></div></div><svg viewBox="0 0 264 60" role="img" aria-label="Employee ${id}: original ${index === 0 ? "₱20,000" : "₱10,000"} remains intact; added ₱2,000; new total ${index === 0 ? "₱22,000" : "₱12,000"}. Both pictures use the same peso scale."><rect class="story-original" x="4" y="12" width="${index === 0 ? 200 : 100}" height="28" rx="3"/><rect class="raise-block" x="${index === 0 ? 208 : 108}" y="12" width="20" height="28" rx="3"/></svg><figcaption>New total: <strong>${index === 0 ? "₱22,000" : "₱12,000"}</strong><span class="q2-scale-note">One shared peso scale; equal gold widths mean equal added money.</span></figcaption><div class="q2-fraction" hidden role="group" aria-label="Employee ${id}: ₱2,000 change divided by ${index === 0 ? "₱20,000" : "₱10,000"} original"><span>Employee ${id}’s comparison</span><div class="q2-ratio"><div><strong>₱2,000</strong><span>change</span></div><div><strong>${index === 0 ? "₱20,000" : "₱10,000"}</strong><span>own original · denominator</span></div></div></div></figure>`).join("")}</div>
    <section class="q2-insight" aria-labelledby="q2-insight-title" hidden><p class="story-kicker">READ THE REFERENCE PAIR</p><h4 id="q2-insight-title">Same added money does not mean the same starting whole</h4><p>A started with <strong>₱20,000</strong>; B started with <strong>₱10,000</strong>. Each denominator names the salary before that employee’s raise—not the new total and not the other employee’s original.</p><p>Both originals stay intact. The fraction compares the added money with a reference whole; it does not remove money.</p></section>
  </section>`;
  const show = () => {
    const worked = incorrect ? step >= 2 : reason !== null;
    host.querySelector<HTMLElement>(".q2-pair")!.hidden =
      !incorrect && reason === null;
    host.querySelector<HTMLElement>(".q2-insight")!.hidden = !worked;
    host.querySelectorAll<HTMLElement>(".q2-fraction").forEach((element) => {
      element.hidden = !worked;
    });
    host.querySelector<HTMLElement>(".q2-task")!.hidden =
      incorrect && step === 0;
    host.querySelectorAll<HTMLElement>(".q2-model").forEach((model) => {
      model.dataset.focus = incorrect
        ? (repair ?? (step > 0 ? "original" : ""))
        : worked
          ? "original"
          : "";
    });
  };
  const update = (nextBlocked: boolean, nextHelp: number) => {
    blocked = nextBlocked;
    host.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = blocked;
    });
    if (incorrect && nextHelp > step) {
      step = Math.min(2, nextHelp);
      const panel = host.querySelector<HTMLElement>(".q2-help")!;
      panel.hidden = false;
      panel.querySelector("h4")!.textContent =
        step === 1
          ? "1 · Identify each starting whole"
          : "2 · Put each original beneath its change";
      panel.querySelector("p")!.textContent =
        step === 1
          ? "A’s starting whole is ₱20,000; B’s is ₱10,000. The gold ₱2,000 additions and the new totals are different quantities. Select a part below to inspect its role."
          : "A compares ₱2,000 with A’s original ₱20,000. B compares ₱2,000 with B’s original ₱10,000. Follow each model to its fraction below; one shared denominator would not name both starting salaries.";
    }
    show();
  };
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-q2-choice]",
    );
    if (!button || blocked) return;
    const choice = button.dataset.q2Choice!;
    if (incorrect) repair = choice;
    else reason = choice;
    host
      .querySelectorAll<HTMLButtonElement>("[data-q2-choice]")
      .forEach((control) =>
        control.setAttribute("aria-pressed", String(control === button)),
      );
    const response = host.querySelector<HTMLElement>("#q2-response")!;
    response.hidden = false;
    response.textContent = incorrect
      ? choice === "original"
        ? "Yes. A’s ₱20,000 and B’s ₱10,000 are their starting wholes. Each belongs beneath that employee’s change."
        : choice === "change"
          ? "The gold ₱2,000 is added money—the numerator, not the starting whole. Inspect each starting salary instead, then reconsider your selection."
          : "The new totals include the raise. Growth from the start is measured against each original salary, not ₱22,000 or ₱12,000. Reconsider which part was there before the raise."
      : choice === "own"
        ? "That relationship supports the pair: A uses A’s original ₱20,000; B uses B’s original ₱10,000. Inspect the two model-to-fraction links below."
        : choice === "shared"
          ? "Equal changes do not make the starting salaries equal. A began with ₱20,000 and B with ₱10,000. Inspect the different denominators below and reconsider your reasoning."
          : "New salaries include the added money. To measure growth from the start, use each salary before the raise. Inspect the original-to-denominator links below and reconsider your reasoning.";
    show();
    response.focus({ preventScroll: true });
  };
  host.addEventListener("click", click);
  investigations.set(host, {
    incorrect,
    update,
    dispose() {
      host.removeEventListener("click", click);
    },
  });
  update(blocked, help);
}
