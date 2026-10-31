type Investigation = {
  incorrect: boolean;
  update(blocked: boolean, help: number): void;
  dispose(): void;
};
const investigations = new WeakMap<HTMLElement, Investigation>();

/** Presentation-only inspection: never submits, persists or authorizes Finish. */
export function detachQuestionThree(host: HTMLElement) {
  investigations.get(host)?.dispose();
  investigations.delete(host);
}

export function mountQuestionThree(
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
  detachQuestionThree(host);
  let step = 0;
  let choice: string | null = null;
  const choices = [
    [
      "smaller",
      "The same added money is a larger share of B’s smaller original",
    ],
    ["equal", "Equal peso increases must be equal percentage increases"],
    ["higher", "A’s higher starting salary must give the higher percentage"],
  ];
  host.innerHTML = `<section class="q3-laboratory" aria-labelledby="q3-title">
    <p class="story-kicker">${incorrect ? "COMPARE THE SHARES" : "WHY DOES THE WHOLE MATTER?"}</p>
    <h3 id="q3-title">Same added money. What changes its share?</h3>
    <p>${incorrect ? "Keep both ₱2,000 additions fixed. Inspect the original that each is compared with; neither original is removed." : "Choose a relationship, then inspect both pictures. This optional reasoning check is not another graded answer and is not required to finish."}</p>
    <section class="q3-help" id="q3-help" tabindex="-1" aria-labelledby="q3-help-title" hidden><h4 id="q3-help-title"></h4><p role="status"></p></section>
    <section class="q3-task" aria-labelledby="q3-task-title" ${incorrect ? "hidden" : ""}><h4 id="q3-task-title">${incorrect ? "Which relationship explains the different shares?" : "Your reasoning"}</h4><div class="q3-choices" role="group" aria-label="Your Q03 reasoning">${choices.map(([id, label]) => `<button class="secondary" data-q3-choice="${id}" aria-pressed="false">${label}</button>`).join("")}</div><p class="q3-response" id="q3-response" tabindex="-1" role="status" hidden></p></section>
    <div class="q3-pair" ${incorrect ? "" : "hidden"}>${["A", "B"]
      .map((id, index) => {
        const original = index === 0 ? "₱20,000" : "₱10,000";
        return `<figure class="q3-model" data-employee="${id}"><div class="story-heading">${portraits[index] ?? ""}<h4>Employee ${id}</h4></div>
        <div class="q3-labels"><div><span>Starting salary</span><strong>${original}</strong></div><div><span>Added money</span><strong>+₱2,000</strong></div></div>
        <p class="q3-scale-note">Peso view · one shared cash scale</p>
        <svg class="q3-peso" viewBox="0 0 264 52" role="img" aria-label="Employee ${id}: original ${original}; separate ₱2,000 addition. Both employees use the same peso scale."><rect class="story-original" x="4" y="10" width="${index === 0 ? 200 : 100}" height="28" rx="3"/><rect class="raise-block" x="${index === 0 ? 208 : 108}" y="10" width="20" height="28" rx="3"/></svg>
        <figcaption>New total: <strong>${index === 0 ? "₱22,000" : "₱12,000"}</strong>. Equal gold widths mean equal added money.</figcaption>
        <section class="q3-share" aria-label="Employee ${id} relative share" hidden><h5>Own original = 100%</h5><p>${original} is this employee’s whole. The outline marks a part equal to the raise; no money is removed.</p><svg viewBox="0 0 264 52" role="img" aria-label="Employee ${id}: own original ${original} shown as a whole of equal display width, not equal pesos. Outlined share matches the separate ₱2,000 raise."><rect class="story-original" x="4" y="10" width="200" height="28" rx="3"/><rect class="q3-share-match" x="4" y="10" width="${index === 0 ? 20 : 40}" height="28" rx="3"/><rect class="raise-block" x="208" y="10" width="${index === 0 ? 20 : 40}" height="28" rx="3"/></svg><p class="q3-scale-note">Own-whole view · equal whole widths represent <strong>different peso amounts</strong>, not one cash scale.</p></section>
        <section class="q3-calculation" aria-label="Employee ${id} calculation" hidden><h5>Change ÷ own original</h5><div class="q3-ratio"><span>₱2,000 <small>change</small></span><span>${original} <small>own original · denominator</small></span></div><p class="q3-equivalence">${index === 0 ? "1/10 = 0.10 = 10/100 = 10%" : "1/5 = 0.20 = 20/100 = 20%"}</p></section>
      </figure>`;
      })
      .join("")}</div>
    <section class="q3-insight" aria-labelledby="q3-insight-title" hidden><p class="story-kicker">PUT THE RELATIONSHIP TOGETHER</p><h4 id="q3-insight-title">Equal pesos, different shares</h4><p>A’s raise is 10% of A’s ₱20,000 original; B’s is 20% of B’s ₱10,000 original. B’s percentage is larger—not because B gained more pesos, but because the same ₱2,000 is compared with a smaller starting whole.</p><p>For the same positive addition and positive originals, a smaller original gives a larger percentage increase. Both originals remain intact.</p></section>
  </section>`;
  const show = () => {
    const worked = incorrect ? step >= 2 : choice !== null;
    host.querySelector<HTMLElement>(".q3-pair")!.hidden = !incorrect && !worked;
    host.querySelector<HTMLElement>(".q3-task")!.hidden =
      incorrect && step === 0;
    host.querySelectorAll<HTMLElement>(".q3-share").forEach((element) => {
      element.hidden = incorrect ? step === 0 : !worked;
    });
    host
      .querySelectorAll<HTMLElement>(".q3-calculation, .q3-insight")
      .forEach((element) => {
        element.hidden = !worked;
      });
  };
  const update = (nextBlocked: boolean, nextHelp: number) => {
    blocked = nextBlocked;
    host.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = blocked;
    });
    if (incorrect && nextHelp > step) {
      step = Math.min(2, nextHelp);
      const panel = host.querySelector<HTMLElement>("#q3-help")!;
      panel.hidden = false;
      panel.querySelector("h4")!.textContent =
        step === 1
          ? "1 · Compare the shares, not just the pesos"
          : "2 · Connect each share to its calculation";
      panel.querySelector("p")!.textContent =
        step === 1
          ? "Both additions are ₱2,000. In the own-whole pictures, each original is 100%, but A’s whole is ₱20,000 and B’s is ₱10,000. The outlined matching part covers more of B’s smaller whole. Equal whole widths here do not mean equal pesos."
          : "Follow each model to its own denominator: A compares ₱2,000 with ₱20,000 to get 0.10, or 10%; B compares ₱2,000 with ₱10,000 to get 0.20, or 20%. The same cash increase does not imply the same percentage.";
    }
    show();
  };
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-q3-choice]",
    );
    if (!button || blocked || button.disabled) return;
    choice = button.dataset.q3Choice ?? null;
    host
      .querySelectorAll<HTMLButtonElement>("[data-q3-choice]")
      .forEach((control) => {
        control.setAttribute("aria-pressed", String(control === button));
      });
    const response = host.querySelector<HTMLElement>("#q3-response")!;
    response.hidden = false;
    response.textContent =
      choice === "smaller"
        ? "That relationship fits: B’s smaller ₱10,000 original makes the same ₱2,000 a larger share. Compare both own-whole outlines below."
        : choice === "equal"
          ? "Equal pesos describe the addition, not its share of the original. The two originals differ. Compare the outlined shares and reconsider why the percentages differ."
          : "A’s higher salary is a larger reference whole, not a larger raise. The same addition covers less of A’s original. Compare both outlined shares and reconsider your reasoning.";
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
